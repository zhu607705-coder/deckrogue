/**
 * @file unifiedEngineAdapter.ts
 * @description 统一引擎适配器，提供 legacy 和 runtimeV2 两种模式的抽象接口
 *
 * 主要职责:
 * - 定义 EngineMode 引擎模式类型（legacy / runtimeV2）
 * - 实现 LegacyEngineAdapter 适配旧版 GameEngine
 * - 实现 RuntimeV2EngineAdapter 适配新版 EngineHost
 * - 提供工厂函数根据模式创建对应适配器
 */
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
    const resolveDeckInstanceId = (token?: string): string | undefined => {
      if (!token) return undefined;
      const [indexPart, rawCardId] = token.split(':');
      const index = Number(indexPart);
      if (Number.isInteger(index) && index >= 0) {
        return this.engine.state.player.deck[index]?.instanceId;
      }
      const normalizedCardId = rawCardId ?? token;
      return this.engine.state.player.deck.find((card) => card.id === normalizedCardId)?.instanceId;
    };

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
      case 'cancel_surface':
        if (this.engine.state.screen === 'Upgrade') {
          this.engine.cancelUpgrade();
        } else if (this.engine.state.screen === 'RemoveCard') {
          this.engine.cancelCardRemoval();
        } else if (this.engine.state.screen === 'Enchant') {
          this.engine.cancelEnchant();
        } else if (this.engine.state.screen === 'RelicUpgrade') {
          this.engine.cancelRelicUpgrade();
        }
        break;
      case 'buy_shop_card': {
        const shopCard = this.engine.state.shopCards.find((card) => card.id === command.cardId);
        if (shopCard) {
          this.engine.buyShopCard(shopCard.instanceId);
        }
        break;
      }
      case 'buy_shop_relic':
        this.engine.buyShopRelic(command.relicId);
        break;
      case 'buy_shop_potion':
        this.engine.buyShopPotion(command.potionId);
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
      case 'enter_enchant': {
        if (this.engine.state.screen === 'Rest') {
          this.engine.restEnchant();
        } else if (this.engine.state.screen === 'Shop') {
          this.engine.enterShopEnchant();
        }
        break;
      }
      case 'apply_enchantment': {
        const resolvedInstanceId = resolveDeckInstanceId(command.cardInstanceId);
        if (resolvedInstanceId) {
          this.engine.applyEnchantment(resolvedInstanceId);
        }
        break;
      }
      case 'enter_relic_upgrade':
        if (this.engine.state.screen === 'Rest') {
          this.engine.restUpgradeRelic();
        }
        break;
      case 'upgrade_relic':
        this.engine.upgradeRelic(command.relicId);
        break;
      case 'upgrade_card': {
        const engine = this.engine as unknown as {
          enterUpgrade?: (returnScreen?: 'Rest' | 'Shop') => void;
          upgradeCard?: (cardInstanceId: string) => void;
        };
        const resolvedInstanceId = resolveDeckInstanceId(command.cardInstanceId);
        if (resolvedInstanceId && typeof engine.upgradeCard === 'function') {
          engine.upgradeCard(resolvedInstanceId);
        } else if (typeof engine.enterUpgrade === 'function' && (this.engine.state.screen === 'Rest' || this.engine.state.screen === 'Shop')) {
          engine.enterUpgrade(this.engine.state.screen);
        }
        break;
      }
      case 'remove_card': {
        const engine = this.engine as unknown as {
          enterCardRemoval?: () => void;
          removeCard?: (cardInstanceId: string) => void;
        };
        const resolvedInstanceId = resolveDeckInstanceId(command.cardInstanceId);
        if (resolvedInstanceId && typeof engine.removeCard === 'function') {
          engine.removeCard(resolvedInstanceId);
        } else if (typeof engine.enterCardRemoval === 'function' && (this.engine.state.screen === 'Rest' || this.engine.state.screen === 'Shop' || this.engine.state.screen === 'Event')) {
          if (this.engine.state.screen === 'Rest' || this.engine.state.screen === 'Shop') {
            this.engine.state.upgradeReturnScreen = this.engine.state.screen;
          }
          engine.enterCardRemoval();
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
