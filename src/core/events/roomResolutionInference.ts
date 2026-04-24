/**
 * @file roomResolutionInference.ts
 * @description 房间解决推断 - 从游戏状态推断房间解决类型
 *
 * 主要职责:
 * - 实现 inferRoomResolutionKindFromLegacyState，根据 screen 状态推断房间类型
 * - 支持升级返回屏幕、 campfire 选择等边界情况处理
 * - 为房间会话系统提供解决类型推断
 */
import type { GameState, RoomResolutionKind } from '@/core/types';

interface RoomResolutionInferenceOptions {
  isEventFreeCardRemovalMode?: boolean;
}

export function inferRoomResolutionKindFromLegacyState(
  state: Pick<
    GameState,
    'screen' | 'activeEvent' | 'campfireChoiceLocked' | 'upgradeReturnScreen' | 'relicUpgradeReturnScreen' | 'enchantContext'
  >,
  options: RoomResolutionInferenceOptions = {}
): RoomResolutionKind | null {
  switch (state.screen) {
    case 'Combat':
      return 'combat';
    case 'Reward':
      return 'reward';
    case 'Event':
      return 'event';
    case 'Shop':
      return 'shop';
    case 'Rest':
      return 'rest';
    case 'Upgrade':
      if (state.upgradeReturnScreen === 'Rest' || state.campfireChoiceLocked) return 'rest';
      if (state.upgradeReturnScreen === 'Shop') return 'shop';
      return 'shop';
    case 'RemoveCard':
      if (options.isEventFreeCardRemovalMode || state.activeEvent) return 'event';
      if (state.upgradeReturnScreen === 'Rest' || state.campfireChoiceLocked) return 'rest';
      if (state.upgradeReturnScreen === 'Shop') return 'shop';
      return 'shop';
    case 'Enchant': {
      const source = state.enchantContext?.returnScreen ?? state.enchantContext?.source;
      if (source === 'Event') return 'event';
      if (source === 'Rest') return 'rest';
      if (source === 'Shop') return 'shop';
      return state.campfireChoiceLocked ? 'rest' : 'shop';
    }
    case 'RelicUpgrade':
      if (state.relicUpgradeReturnScreen === 'Shop') return 'shop';
      return 'rest';
    default:
      return null;
  }
}
