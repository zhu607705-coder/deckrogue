/**
 * @file roomBridge.ts
 * @description 房间桥接 - 连接旧系统与新运行时系统的房间操作
 *
 * 主要职责:
 * - 定义 RoomBridgeKind 类型，描述房间类型 (event, rest, shop, reward, combat)
 * - 定义 RoomBridgeAction 联合类型，描述所有房间操作
 * - 实现 resolveRoomBridgeAction，根据操作类型路由到旧系统或新运行时
 * - 支持运行时委托的透明切换
 */
import type { GameState } from '@/core/types';
import type { RuleSnapshot } from '@/runtimeV2/contracts';

export type RoomBridgeKind = 'event' | 'rest' | 'shop' | 'reward' | 'combat';

export type RoomBridgeAction =
  | { type: 'complete_combat' }
  | { type: 'choose_event_option'; choiceId: string }
  | { type: 'rest' }
  | { type: 'upgrade_card'; cardInstanceId?: string }
  | { type: 'remove_card'; cardInstanceId?: string }
  | { type: 'leave_room' }
  | { type: 'buy_shop_card' }
  | { type: 'buy_shop_relic' }
  | { type: 'buy_shop_potion' }
  | { type: 'take_reward'; cardId?: string }
  | { type: 'skip_reward' };

export interface RoomBridgeSelectionContext {
  activeEventId?: string | null;
  upgradeReturnScreen?: GameState['screen'];
}

export interface RoomBridgeContext extends RoomBridgeSelectionContext {
  screen: GameState['screen'];
  canDelegate?: () => boolean;
  loadDelegatedSnapshot?: () => void;
  delegateCompleteCombat?: () => RuleSnapshot;
  delegateTakeReward?: (cardId?: string) => RuleSnapshot;
  delegateSkipReward?: () => RuleSnapshot;
  delegateChooseEventOption?: (choiceId: string) => RuleSnapshot;
  delegateRest?: () => RuleSnapshot;
  delegateUpgradeCard?: (cardInstanceId?: string) => RuleSnapshot;
  delegateRemoveCard?: (cardInstanceId?: string) => RuleSnapshot;
  delegateLeaveRoom?: () => RuleSnapshot;
  applyCombatVictorySnapshot?: (snapshot: RuleSnapshot) => void;
  applyRewardResolutionSnapshot?: (snapshot: RuleSnapshot) => void;
  applyRestSnapshot?: (snapshot: RuleSnapshot) => void;
  applyLeaveRoomSnapshot?: (snapshot: RuleSnapshot) => void;
  syncFromLegacyState: (reason: string) => void;
  recordFallback: (reason: unknown) => void;
}

export interface RoomBridge {
  readonly kind: RoomBridgeKind;
  supports(screen: GameState['screen'], context?: RoomBridgeSelectionContext): boolean;
  performAction?(context: RoomBridgeContext, action: RoomBridgeAction): boolean;
  leaveToMap?(context: RoomBridgeContext): boolean;
  syncAfterLegacyAction?(context: RoomBridgeContext, actionType: RoomBridgeAction['type']): void;
}

function canDelegate(context: RoomBridgeContext): boolean {
  return context.canDelegate?.() === true;
}

export class EventRoomBridge implements RoomBridge {
  readonly kind = 'event' as const;

  supports(screen: GameState['screen'], context?: RoomBridgeSelectionContext): boolean {
    return screen === 'Event' || (screen === 'RemoveCard' && !!context?.activeEventId);
  }

  performAction(context: RoomBridgeContext, action: RoomBridgeAction): boolean {
    if (!canDelegate(context)) return false;
    try {
      switch (action.type) {
        case 'choose_event_option':
          if (!context.delegateChooseEventOption || !context.loadDelegatedSnapshot) return false;
          context.loadDelegatedSnapshot();
          context.delegateChooseEventOption(action.choiceId);
          return true;
        case 'remove_card':
          if (!context.delegateRemoveCard || !context.loadDelegatedSnapshot) return false;
          context.loadDelegatedSnapshot();
          context.delegateRemoveCard(action.cardInstanceId);
          return true;
        default:
          return false;
      }
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }

  leaveToMap(context: RoomBridgeContext): boolean {
    if (!canDelegate(context) || !context.delegateLeaveRoom || !context.loadDelegatedSnapshot || !context.applyLeaveRoomSnapshot) {
      return false;
    }

    try {
      context.loadDelegatedSnapshot();
      context.applyLeaveRoomSnapshot(context.delegateLeaveRoom());
      return true;
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }
}

export class RestRoomBridge implements RoomBridge {
  readonly kind = 'rest' as const;

  supports(screen: GameState['screen'], context?: RoomBridgeSelectionContext): boolean {
    return screen === 'Rest' || (screen === 'Upgrade' && context?.upgradeReturnScreen === 'Rest');
  }

  performAction(context: RoomBridgeContext, action: RoomBridgeAction): boolean {
    if (!canDelegate(context) || !context.loadDelegatedSnapshot) return false;

    try {
      switch (action.type) {
        case 'rest':
          if (!context.delegateRest || !context.applyRestSnapshot) return false;
          context.loadDelegatedSnapshot();
          context.applyRestSnapshot(context.delegateRest());
          return true;
        case 'upgrade_card':
          if (!context.delegateUpgradeCard) return false;
          context.loadDelegatedSnapshot();
          context.delegateUpgradeCard(action.cardInstanceId);
          return true;
        default:
          return false;
      }
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }

  leaveToMap(context: RoomBridgeContext): boolean {
    if (!canDelegate(context) || !context.delegateLeaveRoom || !context.loadDelegatedSnapshot || !context.applyLeaveRoomSnapshot) {
      return false;
    }

    try {
      context.loadDelegatedSnapshot();
      context.applyLeaveRoomSnapshot(context.delegateLeaveRoom());
      return true;
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }
}

export class ShopRoomBridge implements RoomBridge {
  readonly kind = 'shop' as const;

  supports(screen: GameState['screen'], context?: RoomBridgeSelectionContext): boolean {
    return screen === 'Shop'
      || (screen === 'Upgrade' && context?.upgradeReturnScreen === 'Shop')
      || (screen === 'RemoveCard' && context?.upgradeReturnScreen === 'Shop');
  }

  leaveToMap(context: RoomBridgeContext): boolean {
    if (!canDelegate(context) || !context.delegateLeaveRoom || !context.loadDelegatedSnapshot || !context.applyLeaveRoomSnapshot) {
      return false;
    }

    try {
      context.loadDelegatedSnapshot();
      context.applyLeaveRoomSnapshot(context.delegateLeaveRoom());
      return true;
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }

  performAction(context: RoomBridgeContext, action: RoomBridgeAction): boolean {
    if (!canDelegate(context) || !context.loadDelegatedSnapshot) return false;

    try {
      if (action.type !== 'remove_card' || !context.delegateRemoveCard) return false;
      context.loadDelegatedSnapshot();
      context.delegateRemoveCard(action.cardInstanceId);
      return true;
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }

  syncAfterLegacyAction(context: RoomBridgeContext, actionType: RoomBridgeAction['type']): void {
    if (!canDelegate(context)) return;
    if (!['buy_shop_card', 'buy_shop_relic', 'buy_shop_potion'].includes(actionType)) return;
    context.syncFromLegacyState(`shop.${actionType}`);
  }
}

export class RewardRoomBridge implements RoomBridge {
  readonly kind = 'reward' as const;

  supports(screen: GameState['screen']): boolean {
    return screen === 'Reward';
  }

  performAction(context: RoomBridgeContext, action: RoomBridgeAction): boolean {
    if (!canDelegate(context) || !context.loadDelegatedSnapshot || !context.applyRewardResolutionSnapshot) return false;

    try {
      switch (action.type) {
        case 'take_reward':
          if (!context.delegateTakeReward) return false;
          context.loadDelegatedSnapshot();
          context.applyRewardResolutionSnapshot(context.delegateTakeReward(action.cardId));
          return true;
        case 'skip_reward':
          if (!context.delegateSkipReward) return false;
          context.loadDelegatedSnapshot();
          context.applyRewardResolutionSnapshot(context.delegateSkipReward());
          return true;
        default:
          return false;
      }
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }

  syncAfterLegacyAction(context: RoomBridgeContext, actionType: RoomBridgeAction['type']): void {
    if (!canDelegate(context)) return;
    if (actionType !== 'take_reward' && actionType !== 'skip_reward') return;
    context.syncFromLegacyState(`reward.${actionType}`);
  }
}

export class CombatRoomBridge implements RoomBridge {
  readonly kind = 'combat' as const;

  supports(screen: GameState['screen']): boolean {
    return screen === 'Combat';
  }

  performAction(context: RoomBridgeContext, action: RoomBridgeAction): boolean {
    if (!canDelegate(context) || !context.loadDelegatedSnapshot || !context.delegateCompleteCombat || !context.applyCombatVictorySnapshot) {
      return false;
    }

    try {
      if (action.type !== 'complete_combat') return false;
      context.loadDelegatedSnapshot();
      context.applyCombatVictorySnapshot(context.delegateCompleteCombat());
      return true;
    } catch (error) {
      context.recordFallback(error);
      return false;
    }
  }
}

export interface RoomBridgeRegistry {
  getBridge(screen: GameState['screen'], context?: RoomBridgeSelectionContext): RoomBridge | null;
}

export function createRoomBridgeRegistry(bridges: RoomBridge[]): RoomBridgeRegistry {
  return {
    getBridge(screen: GameState['screen'], context?: RoomBridgeSelectionContext): RoomBridge | null {
      return bridges.find((bridge) => bridge.supports(screen, context)) ?? null;
    },
  };
}
