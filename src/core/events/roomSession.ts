/**
 * @file roomSession.ts
 * @description 房间会话管理 - 跟踪当前房间/节点的会话状态
 *
 * 主要职责:
 * - 实现 createRoomSessionForNode，为指定节点创建房间会话
 * - 实现 syncRoomSessionFromLegacyState，从旧状态同步房间会话
 * - 实现 syncRoomSessionFromTransition，从状态转换同步房间会话
 * - 管理房间解决令牌 (roomResolutionToken) 和房间归属类型
 */
import type {
  GameState,
  RoomOwnerKind,
  RoomResolutionKind,
  RoomSession,
  RoomSurface,
} from '@/core/types';
import { inferRoomResolutionKindFromLegacyState } from '@/core/events/roomResolutionInference';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import type { RunTransitionState } from '@/core/events/runStateMachine';

function inferRoomSurfaceFromScreen(screen: GameState['screen']): RoomSurface | null {
  switch (screen) {
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
      return 'upgrade';
    case 'RemoveCard':
      return 'remove_card';
    case 'Enchant':
      return 'enchant';
    case 'RelicUpgrade':
      return 'relic_upgrade';
    default:
      return null;
  }
}

function inferRoomOwnerKindFromLegacyState(
  state: Pick<
    GameState,
    'screen' | 'activeEvent' | 'campfireChoiceLocked' | 'upgradeReturnScreen' | 'relicUpgradeReturnScreen' | 'enchantContext'
  >,
  resolverKind: RoomResolutionKind | null
): RoomOwnerKind | null {
  if (state.screen === 'Combat') return 'combat';
  if (state.screen === 'Event' || state.activeEvent) return 'event';
  if (state.screen === 'Shop') return 'shop';
  if (state.screen === 'Rest') return 'rest';
  if (state.screen === 'Reward' || resolverKind === 'reward') return 'combat';

  if (state.relicUpgradeReturnScreen === 'Rest') return 'rest';
  if (state.relicUpgradeReturnScreen === 'Shop') return 'shop';

  if (state.upgradeReturnScreen === 'Rest' || state.campfireChoiceLocked) return 'rest';
  if (state.upgradeReturnScreen === 'Shop') return 'shop';

  const enchantSource = state.enchantContext?.returnScreen ?? state.enchantContext?.source;
  if (enchantSource === 'Event') return 'event';
  if (enchantSource === 'Rest') return 'rest';
  if (enchantSource === 'Shop') return 'shop';

  if (resolverKind === 'combat' || resolverKind === 'event' || resolverKind === 'shop' || resolverKind === 'rest') {
    return resolverKind;
  }

  return null;
}

function buildSurfaceStack(ownerKind: RoomOwnerKind, surface: RoomSurface | null): RoomSurface[] {
  if (!surface || surface === ownerKind) {
    return [ownerKind];
  }
  if (surface === 'reward' && ownerKind === 'combat') {
    return ['combat', 'reward'];
  }
  return [ownerKind, surface];
}

function inferRoomSessionStatus(resolverKind: RoomResolutionKind, surface: RoomSurface | null): RoomSession['status'] {
  return resolverKind === 'reward' || surface === 'reward' ? 'resolving' : 'active';
}

export function syncLegacyRoomResolutionFields(
  state: Pick<GameState, 'roomSession' | 'pendingNodeResolution' | 'roomResolutionToken' | 'roomResolutionKind'>
): void {
  state.pendingNodeResolution = !!state.roomSession;
  state.roomResolutionToken = state.roomSession?.token ?? null;
  state.roomResolutionKind = state.roomSession?.resolverKind ?? null;
}

export function setRoomSession(
  state: Pick<GameState, 'roomSession' | 'pendingNodeResolution' | 'roomResolutionToken' | 'roomResolutionKind'>,
  session: RoomSession | null
): void {
  state.roomSession = session;
  syncLegacyRoomResolutionFields(state);
}

export function createRoomSession(params: {
  token: string;
  nodeId: string | null;
  ownerKind: RoomOwnerKind;
  resolverKind: RoomResolutionKind;
  surface?: RoomSurface | null;
  status?: RoomSession['status'];
}): RoomSession {
  const surface = params.surface ?? params.ownerKind;
  return {
    token: params.token,
    nodeId: params.nodeId,
    ownerKind: params.ownerKind,
    resolverKind: params.resolverKind,
    surfaceStack: buildSurfaceStack(params.ownerKind, surface),
    status: params.status ?? inferRoomSessionStatus(params.resolverKind, surface),
  };
}

export function createRoomSessionForNode(params: {
  token: string;
  nodeId: string | null;
  ownerKind: RoomOwnerKind;
}): RoomSession {
  return createRoomSession({
    token: params.token,
    nodeId: params.nodeId,
    ownerKind: params.ownerKind,
    resolverKind: params.ownerKind,
    surface: params.ownerKind,
    status: 'active',
  });
}

export function hydrateRoomSessionFromLegacyState(
  state: Pick<
    GameState,
    | 'screen'
    | 'currentNodeId'
    | 'roomSession'
    | 'roomResolutionToken'
    | 'roomResolutionKind'
    | 'pendingNodeResolution'
    | 'activeEvent'
    | 'campfireChoiceLocked'
    | 'upgradeReturnScreen'
    | 'relicUpgradeReturnScreen'
    | 'enchantContext'
  >,
  options: { isEventFreeCardRemovalMode?: boolean } = {}
): RoomSession | null {
  const surface = inferRoomSurfaceFromScreen(state.screen);
  if (!state.pendingNodeResolution && !surface) {
    return null;
  }

  const resolverKind =
    state.roomResolutionKind ??
    inferRoomResolutionKindFromLegacyState(state, options);
  if (!resolverKind) {
    return null;
  }

  const ownerKind = state.roomSession?.ownerKind ?? inferRoomOwnerKindFromLegacyState(state, resolverKind);
  if (!ownerKind) {
    return null;
  }

  const token =
    state.roomSession?.token ??
    state.roomResolutionToken ??
    `legacy:${state.currentNodeId ?? resolverKind}`;

  return {
    token,
    nodeId: state.currentNodeId ?? state.roomSession?.nodeId ?? null,
    ownerKind,
    resolverKind,
    surfaceStack: buildSurfaceStack(ownerKind, surface),
    status: inferRoomSessionStatus(resolverKind, surface),
  };
}

export function syncRoomSessionFromLegacyState(
  state: Pick<
    GameState,
    | 'screen'
    | 'currentNodeId'
    | 'roomSession'
    | 'surfaceContext'
    | 'roomResolutionToken'
    | 'roomResolutionKind'
    | 'pendingNodeResolution'
    | 'activeEvent'
    | 'campfireChoiceLocked'
    | 'upgradeReturnScreen'
    | 'relicUpgradeReturnScreen'
    | 'enchantContext'
  >,
  options: { isEventFreeCardRemovalMode?: boolean } = {}
): RoomSession | null {
  syncSurfaceContextFromLegacyState(state, options);
  const session = hydrateRoomSessionFromLegacyState(state, options);
  setRoomSession(state, session);
  return session;
}

export function syncRoomSessionFromTransition(
  state: Pick<
    GameState,
    | 'screen'
    | 'currentNodeId'
    | 'roomSession'
    | 'surfaceContext'
    | 'roomResolutionToken'
    | 'roomResolutionKind'
    | 'pendingNodeResolution'
    | 'activeEvent'
    | 'campfireChoiceLocked'
    | 'upgradeReturnScreen'
    | 'relicUpgradeReturnScreen'
    | 'enchantContext'
  >,
  transition: Pick<RunTransitionState, 'phase' | 'pendingNodeResolution' | 'roomResolutionToken' | 'roomResolutionKind'>
): RoomSession | null {
  syncSurfaceContextFromLegacyState(state);
  if (!transition.pendingNodeResolution || !transition.roomResolutionToken || !transition.roomResolutionKind) {
    setRoomSession(state, null);
    return null;
  }

  const currentSession = state.roomSession;
  const surface = inferRoomSurfaceFromScreen(state.screen);
  const ownerKind =
    currentSession?.ownerKind ??
    inferRoomOwnerKindFromLegacyState(state, transition.roomResolutionKind) ??
    (transition.roomResolutionKind === 'reward' ? 'combat' : transition.roomResolutionKind);

  const nextSession: RoomSession = {
    token: transition.roomResolutionToken,
    nodeId: state.currentNodeId ?? currentSession?.nodeId ?? null,
    ownerKind,
    resolverKind: transition.roomResolutionKind,
    surfaceStack: buildSurfaceStack(ownerKind, surface),
    status: inferRoomSessionStatus(transition.roomResolutionKind, surface),
  };

  setRoomSession(state, nextSession);
  return nextSession;
}
