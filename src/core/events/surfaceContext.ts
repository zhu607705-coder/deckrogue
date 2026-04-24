/**
 * @file surfaceContext.ts
 * @description 表面上下文 - 管理房间切换时的界面上下文恢复
 *
 * 主要职责:
 * - 实现 deriveSurfaceContextFromLegacyState，从旧状态推导表面上下文
 * - 实现 applySurfaceContext，将表面上下文应用到游戏状态
 * - 实现 syncSurfaceContextFromLegacyState，同步表面上下文
 * - 管理升级返回屏幕、遗物升级返回屏幕、附魔上下文等恢复逻辑
 */
import type { GameState, SurfaceContext } from '@/core/types';

function cloneEnchantContext(enchantContext: GameState['enchantContext']): GameState['enchantContext'] {
  if (!enchantContext) return null;
  return {
    ...enchantContext,
  };
}

export function deriveSurfaceContextFromLegacyState(
  state: Pick<
    GameState,
    | 'surfaceContext'
    | 'upgradeReturnScreen'
    | 'relicUpgradeReturnScreen'
    | 'campfireChoiceLocked'
    | 'pendingUpgradeRefund'
    | 'enchantContext'
  >,
  options: { isEventFreeCardRemovalMode?: boolean } = {}
): SurfaceContext | null {
  const context: SurfaceContext = {};

  if (state.upgradeReturnScreen) {
    context.upgradeReturnScreen = state.upgradeReturnScreen;
  }
  if (state.relicUpgradeReturnScreen) {
    context.relicUpgradeReturnScreen = state.relicUpgradeReturnScreen;
  }

  const enchantContext = cloneEnchantContext(state.enchantContext ?? null);
  if (enchantContext) {
    context.enchantContext = enchantContext;
    context.enchantReturnScreen = enchantContext.returnScreen ?? enchantContext.source;
  }

  if (state.campfireChoiceLocked) {
    context.campfireChoiceLocked = true;
  }
  if (state.pendingUpgradeRefund) {
    context.pendingUpgradeRefund = true;
  }
  if (options.isEventFreeCardRemovalMode) {
    context.isEventFreeCardRemovalMode = true;
  }

  return Object.keys(context).length > 0 ? context : null;
}

export function applySurfaceContext(
  state: Pick<
    GameState,
    | 'surfaceContext'
    | 'upgradeReturnScreen'
    | 'relicUpgradeReturnScreen'
    | 'campfireChoiceLocked'
    | 'pendingUpgradeRefund'
    | 'enchantContext'
  >,
  surfaceContext: SurfaceContext | null
): SurfaceContext | null {
  state.surfaceContext = surfaceContext ? {
    ...surfaceContext,
    enchantContext: cloneEnchantContext(surfaceContext.enchantContext ?? null),
  } : null;
  state.upgradeReturnScreen = surfaceContext?.upgradeReturnScreen;
  state.relicUpgradeReturnScreen = surfaceContext?.relicUpgradeReturnScreen;
  state.campfireChoiceLocked = !!surfaceContext?.campfireChoiceLocked;
  state.pendingUpgradeRefund = !!surfaceContext?.pendingUpgradeRefund;
  state.enchantContext = cloneEnchantContext(surfaceContext?.enchantContext ?? null);
  if (!state.enchantContext && surfaceContext?.enchantReturnScreen) {
    state.enchantContext = {
      source: surfaceContext.enchantReturnScreen,
      enchantmentId: '',
      returnScreen: surfaceContext.enchantReturnScreen,
    };
  }
  return state.surfaceContext;
}

export function syncSurfaceContextFromLegacyState(
  state: Pick<
    GameState,
    | 'surfaceContext'
    | 'upgradeReturnScreen'
    | 'relicUpgradeReturnScreen'
    | 'campfireChoiceLocked'
    | 'pendingUpgradeRefund'
    | 'enchantContext'
  >,
  options: { isEventFreeCardRemovalMode?: boolean } = {}
): SurfaceContext | null {
  const context = deriveSurfaceContextFromLegacyState(state, options);
  return applySurfaceContext(state, context);
}
