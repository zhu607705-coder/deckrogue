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
