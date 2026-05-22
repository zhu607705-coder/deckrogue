/**
 * @file runStateMachine.ts
 * @description Run 状态机 - 定义和驱动 Run 生命周期的状态转换
 *
 * 主要职责:
 * - 定义 App/Run/Phase 三层生命周期状态类型
 * - 定义 RunAction 联合类型，描述所有可触发的状态转换动作
 * - 实现 transitionRunState，处理状态转换逻辑
 * - 实现 deriveRunTransitionState，从 GameState 推导当前转换状态
 * - 提供 screenToRunPhase 和 runPhaseToScreen 双向转换
 */
import type { GameState, RoomResolutionKind } from '@/core/types';

export type AppLifecycleState = 'booting' | 'ready' | 'shutting_down';
export type RunLifecycleState = 'idle' | 'in_run' | 'paused' | 'ended';
export type RunPhaseState =
  | 'character_select'
  | 'map'
  | 'combat'
  | 'event'
  | 'shop'
  | 'rest'
  | 'reward'
  | 'enchant'
  | 'upgrade'
  | 'relic_upgrade'
  | 'remove_card'
  | 'game_over'
  | 'victory';

export type RunAction =
  | { type: 'RUN_STARTED' }
  | { type: 'RUN_LOADED' }
  | { type: 'RUN_PAUSED' }
  | { type: 'RUN_RESUMED' }
  | { type: 'NODE_ENTERED'; phase: Extract<RunPhaseState, 'combat' | 'event' | 'shop' | 'rest'>; roomResolutionToken?: string | null }
  | { type: 'COMBAT_WON'; roomResolutionToken?: string | null }
  | { type: 'PLAYER_DIED' }
  | { type: 'EVENT_RESOLVED'; roomResolutionToken?: string | null }
  | { type: 'SHOP_LEFT'; roomResolutionToken?: string | null }
  | { type: 'REST_COMPLETED'; roomResolutionToken?: string | null }
  | { type: 'REWARD_TAKEN' | 'REWARD_SKIPPED'; roomResolutionToken?: string | null }
  | { type: 'RUN_ENDED'; phase: Extract<RunPhaseState, 'game_over' | 'victory'> };

export interface RunTransitionState {
  lifecycle: RunLifecycleState;
  phase: RunPhaseState;
  pendingNodeResolution: boolean;
  roomResolutionToken?: string | null;
  roomResolutionKind?: RoomResolutionKind | null;
}

type RoomExitActionType =
  | 'EVENT_RESOLVED'
  | 'SHOP_LEFT'
  | 'REST_COMPLETED'
  | 'REWARD_TAKEN'
  | 'REWARD_SKIPPED';

const ROOM_EXIT_PHASES: Record<RoomExitActionType, RunPhaseState> = {
  EVENT_RESOLVED: 'event',
  SHOP_LEFT: 'shop',
  REST_COMPLETED: 'rest',
  REWARD_TAKEN: 'reward',
  REWARD_SKIPPED: 'reward',
};

const NESTED_ROOM_PHASES = new Set<RunPhaseState>(['enchant', 'upgrade', 'relic_upgrade', 'remove_card']);

export function screenToRunPhase(screen: GameState['screen']): RunPhaseState {
  switch (screen) {
    case 'CharacterSelect':
      return 'character_select';
    case 'Map':
      return 'map';
    case 'Combat':
      return 'combat';
    case 'Reward':
      return 'reward';
    case 'Enchant':
      return 'enchant';
    case 'Event':
      return 'event';
    case 'Shop':
      return 'shop';
    case 'Rest':
      return 'rest';
    case 'Upgrade':
      return 'upgrade';
    case 'RelicUpgrade':
      return 'relic_upgrade';
    case 'RemoveCard':
      return 'remove_card';
    case 'GameOver':
      return 'game_over';
    case 'Victory':
      return 'victory';
  }
}

export function runPhaseToScreen(phase: RunPhaseState): GameState['screen'] {
  switch (phase) {
    case 'character_select':
      return 'CharacterSelect';
    case 'map':
      return 'Map';
    case 'combat':
      return 'Combat';
    case 'reward':
      return 'Reward';
    case 'enchant':
      return 'Enchant';
    case 'event':
      return 'Event';
    case 'shop':
      return 'Shop';
    case 'rest':
      return 'Rest';
    case 'upgrade':
      return 'Upgrade';
    case 'relic_upgrade':
      return 'RelicUpgrade';
    case 'remove_card':
      return 'RemoveCard';
    case 'game_over':
      return 'GameOver';
    case 'victory':
      return 'Victory';
  }
}

export function deriveRunTransitionState(state: GameState, lifecycle: RunLifecycleState = 'in_run'): RunTransitionState {
  const phase = screenToRunPhase(state.screen);
  const roomSession = state.roomSession ?? null;
  const inferredRoomKind =
    phase === 'combat' ||
    phase === 'reward' ||
    phase === 'event' ||
    phase === 'shop' ||
    phase === 'rest'
      ? phase
      : null;
  const canImplicitlyResolveRoom =
    phase === 'combat' ||
    phase === 'event' ||
    phase === 'shop' ||
    phase === 'rest' ||
    phase === 'reward' ||
    phase === 'enchant' ||
    phase === 'upgrade' ||
    phase === 'relic_upgrade' ||
    phase === 'remove_card';
  const roomResolutionToken =
    roomSession?.token ??
    state.roomResolutionToken ??
    (state.pendingNodeResolution || canImplicitlyResolveRoom ? `legacy:${state.currentNodeId ?? phase}` : null);
  return {
    lifecycle,
    phase,
    pendingNodeResolution: Boolean(roomResolutionToken),
    roomResolutionToken,
    roomResolutionKind: roomSession?.resolverKind ?? state.roomResolutionKind ?? inferredRoomKind
  };
}

export function transitionRunState(current: RunTransitionState, action: RunAction): RunTransitionState {
  const activeRoomResolutionToken =
    current.roomResolutionToken ??
    (current.pendingNodeResolution ? '__legacy_pending__' : null);
  switch (action.type) {
    case 'RUN_STARTED':
    case 'RUN_LOADED':
      return { lifecycle: 'in_run', phase: 'map', pendingNodeResolution: false, roomResolutionToken: null };
    case 'RUN_PAUSED':
      if (current.lifecycle !== 'in_run') {
        throw new Error(`Illegal run transition: cannot pause from ${current.lifecycle}`);
      }
      return { ...current, lifecycle: 'paused' };
    case 'RUN_RESUMED':
      if (current.lifecycle !== 'paused') {
        throw new Error(`Illegal run transition: cannot resume from ${current.lifecycle}`);
      }
      return { ...current, lifecycle: 'in_run' };
    case 'NODE_ENTERED':
      if (current.lifecycle !== 'in_run' || current.phase !== 'map') {
        throw new Error(`Illegal run transition: cannot enter node from ${current.lifecycle}/${current.phase}`);
      }
      return {
        ...current,
        phase: action.phase,
        pendingNodeResolution: true,
        roomResolutionToken: action.roomResolutionToken ?? activeRoomResolutionToken ?? '__pending__',
        roomResolutionKind: action.phase
      };
    case 'COMBAT_WON':
      if (current.phase !== 'combat') {
        throw new Error(`Illegal run transition: cannot resolve combat victory from ${current.phase}`);
      }
      return {
        ...current,
        phase: 'reward',
        pendingNodeResolution: true,
        roomResolutionToken: action.roomResolutionToken ?? activeRoomResolutionToken ?? '__combat__',
        roomResolutionKind: 'reward'
      };
    case 'PLAYER_DIED':
      if (current.lifecycle !== 'in_run' && current.lifecycle !== 'paused') {
        throw new Error(`Illegal run transition: cannot die from ${current.lifecycle}`);
      }
      return { lifecycle: 'ended', phase: 'game_over', pendingNodeResolution: false, roomResolutionToken: null, roomResolutionKind: null };
    case 'EVENT_RESOLVED':
    case 'SHOP_LEFT':
    case 'REST_COMPLETED':
    case 'REWARD_TAKEN':
    case 'REWARD_SKIPPED':
      if (
        current.phase !== ROOM_EXIT_PHASES[action.type] &&
        !(NESTED_ROOM_PHASES.has(current.phase) && current.roomResolutionKind === ROOM_EXIT_PHASES[action.type])
      ) {
        throw new Error(`Illegal run transition: ${action.type} cannot resolve from ${current.phase}`);
      }
      if (!activeRoomResolutionToken) {
        throw new Error(`Illegal run transition: cannot leave room when no node is pending`);
      }
      if (action.roomResolutionToken && activeRoomResolutionToken !== action.roomResolutionToken) {
        throw new Error('Illegal run transition: room resolution token mismatch');
      }
      return { lifecycle: 'in_run', phase: 'map', pendingNodeResolution: false, roomResolutionToken: null, roomResolutionKind: null };
    case 'RUN_ENDED':
      return { lifecycle: 'ended', phase: action.phase, pendingNodeResolution: false, roomResolutionToken: null, roomResolutionKind: null };
  }
}
