import type { GameEngine } from '@/core/events/gameEngine';
import type { EngineHost, RenderModel, RuleCommand, RuleSnapshot } from '@/runtimeV2';
import { createLegacyRenderModel } from '@/runtimeV2/legacyRenderBridge';

export type EngineMode = 'legacy' | 'runtimeV2';

export interface UnifiedEngineAdapter {
  readonly mode: EngineMode;
  readonly snapshot: RuleSnapshot | null;
  readonly renderModel: RenderModel | null;
  subscribe(listener: () => void): () => void;
  dispatch(command: RuleCommand): Promise<void>;
  start(options?: { seed?: number }): Promise<void>;
  dispose(): void;
  getLegacyEngine(): GameEngine | null;
}

export class LegacyEngineAdapter implements UnifiedEngineAdapter {
  readonly mode = 'legacy' as const;
  private listeners = new Set<() => void>();
  
  constructor(private engine: GameEngine) {}
  
  get snapshot(): RuleSnapshot | null {
    return null;
  }
  
  get renderModel(): RenderModel | null {
    return createLegacyRenderModel(this.engine);
  }

  getLegacyEngine(): GameEngine | null {
    return this.engine;
  }
  
  async start(options?: { seed?: number }): Promise<void> {
    // Legacy engine doesn't need explicit start
  }
  
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubscribe = this.engine.subscribe(() => {
      listener();
    });
    return () => {
      this.listeners.delete(listener);
      unsubscribe();
    };
  }
  
  async dispatch(command: RuleCommand): Promise<void> {
    switch (command.type) {
      case 'select_character':
        this.engine.selectCharacter(command.characterId);
        break;
      case 'enter_node':
        this.engine.enterNode(command.nodeId);
        break;
      case 'leave_room':
        this.engine.leaveCurrentRoomToMap();
        break;
      case 'take_reward': {
        const rewardCard = command.cardId
          ? this.engine.state.rewardCards.find(card => card.id === command.cardId)
          : this.engine.state.rewardCards[0];
        this.engine.takeReward(rewardCard?.instanceId);
        break;
      }
      case 'skip_reward':
        this.engine.skipReward();
        break;
      case 'complete_combat': {
        const completeCombat = (this.engine as unknown as { handleCombatVictory?: () => void }).handleCombatVictory;
        if (typeof completeCombat === 'function') {
          completeCombat.call(this.engine);
        }
        break;
      }
      case 'choose_event_option': {
        const engine = this.engine as unknown as {
          chooseEventOption?: (choice: string) => void;
          resolveEventChoice?: (choice: string) => void;
        };
        const chooseMethod = engine.chooseEventOption ?? engine.resolveEventChoice;
        if (typeof chooseMethod === 'function') {
          chooseMethod.call(this.engine, command.choiceId);
        } else {
          this.engine.leaveCurrentRoomToMap();
        }
        break;
      }
      case 'rest': {
        const engine = this.engine as unknown as { restHeal?: () => void };
        if (typeof engine.restHeal === 'function') {
          engine.restHeal();
        }
        break;
      }
      case 'upgrade_card': {
        const engine = this.engine as unknown as {
          restUpgrade?: () => void;
          upgradeCard?: (cardInstanceId: string) => void;
        };
        if (command.cardInstanceId && typeof engine.upgradeCard === 'function') {
          engine.upgradeCard(command.cardInstanceId);
        } else if (typeof engine.restUpgrade === 'function') {
          engine.restUpgrade();
        }
        break;
      }
      case 'remove_card': {
        const engine = this.engine as unknown as { removeCard?: (cardInstanceId: string) => void };
        if (typeof engine.removeCard === 'function') {
          if (command.cardInstanceId) {
            engine.removeCard(command.cardInstanceId);
          } else {
            const firstCard = this.engine.state.player.deck[0];
            if (firstCard) {
              engine.removeCard(firstCard.instanceId);
            }
          }
        }
        break;
      }
      default:
        console.warn(`LegacyEngineAdapter: Unsupported command type: ${(command as RuleCommand).type}`);
    }
    this.emit();
  }
  
  dispose(): void {
    this.engine.dispose();
    this.listeners.clear();
  }
  
  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export class RuntimeV2EngineAdapter implements UnifiedEngineAdapter {
  readonly mode = 'runtimeV2' as const;
  private listeners = new Set<() => void>();
  private _snapshot: RuleSnapshot | null = null;
  private _renderModel: RenderModel | null = null;
  
  constructor(private host: EngineHost) {}
  
  get snapshot(): RuleSnapshot | null {
    return this._snapshot;
  }
  
  get renderModel(): RenderModel | null {
    return this._renderModel;
  }

  getLegacyEngine(): GameEngine | null {
    const adapter = this.host.getAdapter();
    if (adapter && 'getEngine' in adapter && typeof (adapter as any).getEngine === 'function') {
      return (adapter as any).getEngine() as GameEngine | null;
    }
    return null;
  }
  
  async start(options?: { seed?: number }): Promise<void> {
    await this.host.start(options);
    this._snapshot = this.host.getSnapshot();
    this._renderModel = this.host.getRenderModel();
    this.emit();
  }
  
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubscribeSnapshot = this.host.subscribe((snapshot) => {
      this._snapshot = snapshot;
      this._renderModel = this.host.getRenderModel();
      this.emit();
    });
    const unsubscribeRender = this.host.subscribeRenderModel((renderModel) => {
      this._renderModel = renderModel;
      this.emit();
    });
    return () => {
      this.listeners.delete(listener);
      unsubscribeSnapshot();
      unsubscribeRender();
    };
  }
  
  async dispatch(command: RuleCommand): Promise<void> {
    await this.host.dispatch(command);
    this._snapshot = this.host.getSnapshot();
    this._renderModel = this.host.getRenderModel();
    this.emit();
  }
  
  dispose(): void {
    this.host.dispose();
    this.listeners.clear();
    this._snapshot = null;
    this._renderModel = null;
  }
  
  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createLegacyAdapter(engine: GameEngine): UnifiedEngineAdapter {
  return new LegacyEngineAdapter(engine);
}

export function createRuntimeV2Adapter(host: EngineHost): UnifiedEngineAdapter {
  return new RuntimeV2EngineAdapter(host);
}
