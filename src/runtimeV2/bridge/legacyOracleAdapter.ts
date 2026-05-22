/**
 * @file legacyOracleAdapter.ts
 * @description 旧版预言机适配器，将 GameEngine 包装为 RuleRuntimeAdapter 接口
 *
 * 主要职责:
 * - 订阅 GameEngine 状态变更并转换为 RuleSnapshot
 * - 实现 start / dispatch 接口以执行规则命令
 * - 管理监听器并派发快照更新事件
 */
import { GameEngine } from '@/core/events/gameEngine';
import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';

export class LegacyOracleAdapter implements RuleRuntimeAdapter {
  readonly source = 'legacy-oracle' as const;
  private engine: GameEngine | null = null;
  private snapshot: RuleSnapshot | null = null;
  private engineUnsubscribe: (() => void) | null = null;
  private listeners = new Set<(snapshot: RuleSnapshot) => void>();
  private dispatchDepth = 0;
  private pendingEmit = false;

  private createEngine(seed?: number): GameEngine {
    return new GameEngine(seed, null, { enableRuntimeDelegation: false });
  }

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.dispose();
    this.engine = this.createEngine(options.seed);
    this.engineUnsubscribe = this.engine.subscribe(() => {
      this.snapshot = normalizeLegacyGameState(this.engine!.state, this.engine!.getSaveData());
      if (this.dispatchDepth > 0) {
        this.pendingEmit = true;
        return;
      }
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

    const resolveDeckInstanceId = (token?: string): string | undefined => {
      if (!token) return undefined;
      const [indexPart, rawCardId] = token.split(':');
      const index = Number(indexPart);
      if (Number.isInteger(index) && index >= 0) {
        return this.engine!.state.player.deck[index]?.instanceId;
      }
      const normalizedCardId = rawCardId ?? token;
      return this.engine!.state.player.deck.find((card) => card.id === normalizedCardId)?.instanceId;
    };

    if (command.type === 'start_run') {
      return this.start({ seed: command.seed });
    }

    this.dispatchDepth += 1;
    try {

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

    if (command.type === 'cancel_surface') {
      if (this.engine.state.screen === 'Upgrade') {
        this.engine.cancelUpgrade();
      } else if (this.engine.state.screen === 'RemoveCard') {
        this.engine.cancelCardRemoval();
      } else if (this.engine.state.screen === 'Enchant') {
        this.engine.cancelEnchant();
      } else if (this.engine.state.screen === 'RelicUpgrade') {
        this.engine.cancelRelicUpgrade();
      } else {
        throw new Error('cancel_surface is only valid during upgrade, remove_card, enchant, or relic_upgrade phase');
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'buy_shop_card') {
      const shopCard = this.engine.state.shopCards.find((card) => card.id === command.cardId);
      if (!shopCard) {
        throw new Error(`Shop card is not offered: ${command.cardId}`);
      }
      this.engine.buyShopCard(shopCard.instanceId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'buy_shop_relic') {
      if (!this.engine.state.shopRelics.includes(command.relicId)) {
        throw new Error(`Shop relic is not offered: ${command.relicId}`);
      }
      this.engine.buyShopRelic(command.relicId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'buy_shop_potion') {
      if (!this.engine.state.shopPotions.includes(command.potionId)) {
        throw new Error(`Shop potion is not offered: ${command.potionId}`);
      }
      this.engine.buyShopPotion(command.potionId);
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
      if (!this.engine.state.combat) {
        throw new Error('complete_combat requires an active combat in the legacy oracle adapter');
      }
      this.engine.handleCombatVictory();
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'choose_event_option') {
      if (!this.engine.state.activeEvent) {
        this.engine.leaveCurrentRoomToMap();
      } else {
        this.engine.resolveEventChoice(command.choiceId);
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'rest') {
      this.engine.restHeal();
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'enter_enchant') {
      if (this.engine.state.screen === 'Rest') {
        this.engine.restEnchant();
      } else if (this.engine.state.screen === 'Shop') {
        this.engine.enterShopEnchant();
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'apply_enchantment') {
      const resolvedInstanceId = resolveDeckInstanceId(command.cardInstanceId);
      if (!resolvedInstanceId) {
        throw new Error(`Enchant target could not be resolved: ${command.cardInstanceId ?? 'missing'}`);
      }
      this.engine.applyEnchantment(resolvedInstanceId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'enter_relic_upgrade') {
      if (this.engine.state.screen === 'Rest') {
        this.engine.restUpgradeRelic();
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'upgrade_relic') {
      if (this.engine.state.screen !== 'RelicUpgrade') {
        throw new Error('upgrade_relic is only valid during relic_upgrade phase');
      }
      const relicState = this.engine.state.player.relicStates[command.relicId];
      if (!relicState) {
        throw new Error(`Relic is not available for upgrade: ${command.relicId}`);
      }
      if (!relicState.corrupted) {
        throw new Error(`Relic is not corrupted and cannot use the runtime-v2 relic upgrade flow: ${command.relicId}`);
      }
      const upgradeInfo = this.engine.getRelicUpgradeInfo(command.relicId);
      if (!upgradeInfo?.canAfford) {
        throw new Error('Not enough gold to upgrade relic');
      }
      this.engine.upgradeRelic(command.relicId);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'upgrade_card') {
      const resolvedInstanceId = resolveDeckInstanceId(command.cardInstanceId);
      if (resolvedInstanceId) {
        if (this.engine.state.screen !== 'Upgrade') {
          throw new Error('upgrade_card with card selector is only valid during upgrade phase');
        }
        this.engine.upgradeCard(resolvedInstanceId);
      } else if (this.engine.state.screen === 'Rest' || this.engine.state.screen === 'Shop') {
        this.engine.enterUpgrade(this.engine.state.screen);
      } else if (command.cardInstanceId) {
        throw new Error(`Upgrade target could not be resolved: ${command.cardInstanceId}`);
      }
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    if (command.type === 'remove_card') {
      const resolvedInstanceId = resolveDeckInstanceId(command.cardInstanceId);
      if (resolvedInstanceId) {
        if (this.engine.state.screen !== 'RemoveCard') {
          throw new Error('remove_card with card selector is only valid during remove_card phase');
        }
        this.engine.removeCard(resolvedInstanceId);
      } else if (this.engine.state.screen === 'Rest' || this.engine.state.screen === 'Shop' || this.engine.state.screen === 'Event') {
        if (this.engine.state.screen === 'Rest' || this.engine.state.screen === 'Shop') {
          this.engine.state.upgradeReturnScreen = this.engine.state.screen;
        }
        this.engine.enterCardRemoval();
      } else if (command.cardInstanceId) {
        throw new Error(`Remove-card target could not be resolved: ${command.cardInstanceId}`);
      } else {
        throw new Error('remove_card without card selector is only valid during rest, shop, or event phase');
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
      this.engine = this.createEngine(command.snapshot.seed);
      this.engine.loadSaveData(legacySaveData);
      this.snapshot = normalizeLegacyGameState(this.engine.state, this.engine.getSaveData());
      return this.snapshot;
    }

    throw new Error(`Unsupported command for legacy oracle adapter: ${(command as RuleCommand).type}`);
    } finally {
      this.dispatchDepth = Math.max(0, this.dispatchDepth - 1);
      if (this.dispatchDepth === 0 && this.pendingEmit) {
        this.pendingEmit = false;
        this.emit();
      }
    }
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
    this.dispatchDepth = 0;
    this.pendingEmit = false;
    this.listeners.clear();
  }
}

export function createLegacyOracleAdapter(): LegacyOracleAdapter {
  return new LegacyOracleAdapter();
}
