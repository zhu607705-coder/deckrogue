import { GameEngine } from '@/core/events/gameEngine';
import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';

export class LegacyOracleAdapter implements RuleRuntimeAdapter {
  readonly source = 'legacy-oracle' as const;
  private engine: GameEngine | null = null;
  private snapshot: RuleSnapshot | null = null;
  private engineUnsubscribe: (() => void) | null = null;
  private listeners = new Set<(snapshot: RuleSnapshot) => void>();

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.dispose();
    this.engine = new GameEngine(options.seed, null, { enableRuntimeDelegation: false });
    this.engineUnsubscribe = this.engine.subscribe(() => {
      this.snapshot = normalizeLegacyGameState(this.engine!.state, this.engine!.getSaveData());
      this.emit();
    });
    this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
    return this.snapshot;
  }

  private emit(): void {
    if (this.snapshot) {
      for (const listener of this.listeners) {
        listener(this.snapshot);
      }
    }
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.engine) {
      await this.start();
    }
    if (!this.engine) {
      throw new Error('Legacy oracle adapter failed to initialize GameEngine');
    }

    if (command.type === 'start_run') {
      return this.start({ seed: command.seed });
    }

    if (command.type === 'select_character') {
      this.engine.selectCharacter(command.characterId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'enter_node') {
      this.engine.enterNode(command.nodeId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'leave_room') {
      this.engine.leaveCurrentRoomToMap();
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'take_reward') {
      const rewardCard = command.cardId
        ? this.engine.state.rewardCards.find((card) => card.id === command.cardId)
        : this.engine.state.rewardCards[0];
      this.engine.takeReward(rewardCard?.instanceId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'skip_reward') {
      this.engine.skipReward();
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'complete_combat') {
      const completeCombat = (this.engine as unknown as { handleCombatVictory?: () => void }).handleCombatVictory;
      if (!this.engine.state.combat || typeof completeCombat !== 'function') {
        throw new Error('complete_combat requires an active combat in the legacy oracle adapter');
      }
      completeCombat.call(this.engine);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'choose_event_option') {
      const engine = this.engine as unknown as {
        chooseEventOption?: (choice: string) => void;
        resolveEventChoice?: (choice: string) => void;
      };
      const chooseMethod = engine.chooseEventOption ?? engine.resolveEventChoice;
      if (!this.engine.state.activeEvent || typeof chooseMethod !== 'function') {
        this.engine.leaveCurrentRoomToMap();
      } else {
        chooseMethod.call(this.engine, command.choiceId);
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'rest') {
      const engine = this.engine as unknown as { restHeal?: () => void };
      if (typeof engine.restHeal === 'function') {
        engine.restHeal();
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'upgrade_card') {
      const engine = this.engine as unknown as {
        restUpgrade?: () => void;
        upgradeCard?: (cardInstanceId: string) => void;
        state: { deck: Array<{ instanceId: string }> };
      };
      if (command.cardInstanceId && typeof engine.upgradeCard === 'function') {
        engine.upgradeCard(command.cardInstanceId);
      } else if (typeof engine.restUpgrade === 'function') {
        engine.restUpgrade();
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'remove_card') {
      const engine = this.engine as unknown as {
        removeCard?: (cardInstanceId: string) => void;
        state: { deck: Array<{ instanceId: string }> };
      };
      if (command.cardInstanceId && typeof engine.removeCard === 'function') {
        engine.removeCard(command.cardInstanceId);
      } else if (typeof engine.removeCard === 'function') {
        const firstCard = engine.state.deck[0];
        if (firstCard) {
          engine.removeCard(firstCard.instanceId);
        }
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'load_snapshot') {
      const legacySaveData = command.snapshot.compat?.legacySaveData;
      if (!legacySaveData) {
        throw new Error('load_snapshot requires compat.legacySaveData when using the legacy oracle adapter');
      }
      this.dispose();
      this.engine = new GameEngine(command.snapshot.seed, null);
      this.engine.loadSaveData(legacySaveData);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    throw new Error(`Unsupported command for legacy oracle adapter: ${(command as RuleCommand).type}`);
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  getEngine(): GameEngine | null {
    return this.engine;
  }

  subscribe(listener: (snapshot: RuleSnapshot) => void): () => void {
    this.listeners.add(listener);
    if (this.snapshot) {
      listener(this.snapshot);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.engineUnsubscribe) {
      this.engineUnsubscribe();
      this.engineUnsubscribe = null;
    }
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
    this.snapshot = null;
    this.listeners.clear();
  }
}

export function createLegacyOracleAdapter(): LegacyOracleAdapter {
  return new LegacyOracleAdapter();
}
