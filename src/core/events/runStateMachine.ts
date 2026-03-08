import type { GameState } from '@/core/types';

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
  | 'upgrade'
  | 'remove_card'
  | 'game_over'
  | 'victory';

export type RunAction =
  | { type: 'RUN_STARTED' }
  | { type: 'RUN_LOADED' }
  | { type: 'RUN_PAUSED' }
  | { type: 'RUN_RESUMED' }
  | { type: 'NODE_ENTERED'; phase: Extract<RunPhaseState, 'combat' | 'event' | 'shop' | 'rest'> }
  | { type: 'COMBAT_WON' }
  | { type: 'PLAYER_DIED' }
  | { type: 'EVENT_RESOLVED' }
  | { type: 'SHOP_LEFT' }
  | { type: 'REST_COMPLETED' }
  | { type: 'REWARD_TAKEN' | 'REWARD_SKIPPED' }
  | { type: 'RUN_ENDED'; phase: Extract<RunPhaseState, 'game_over' | 'victory'> };

export interface RunTransitionState {
  lifecycle: RunLifecycleState;
  phase: RunPhaseState;
  pendingNodeResolution: boolean;
}

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
    case 'event':
      return 'Event';
    case 'shop':
      return 'Shop';
    case 'rest':
      return 'Rest';
    case 'upgrade':
      return 'Upgrade';
    case 'remove_card':
      return 'RemoveCard';
    case 'game_over':
      return 'GameOver';
    case 'victory':
      return 'Victory';
  }
}

export function deriveRunTransitionState(state: GameState, lifecycle: RunLifecycleState = 'in_run'): RunTransitionState {
  return {
    lifecycle,
    phase: screenToRunPhase(state.screen),
    pendingNodeResolution: Boolean(state.pendingNodeResolution)
  };
}

export function transitionRunState(current: RunTransitionState, action: RunAction): RunTransitionState {
  switch (action.type) {
    case 'RUN_STARTED':
    case 'RUN_LOADED':
      return { lifecycle: 'in_run', phase: 'map', pendingNodeResolution: false };
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
      return { ...current, phase: action.phase, pendingNodeResolution: true };
    case 'COMBAT_WON':
      if (current.phase !== 'combat') {
        throw new Error(`Illegal run transition: cannot resolve combat victory from ${current.phase}`);
      }
      return { ...current, phase: 'reward', pendingNodeResolution: true };
    case 'PLAYER_DIED':
      if (current.lifecycle !== 'in_run' && current.lifecycle !== 'paused') {
        throw new Error(`Illegal run transition: cannot die from ${current.lifecycle}`);
      }
      return { lifecycle: 'ended', phase: 'game_over', pendingNodeResolution: false };
    case 'EVENT_RESOLVED':
    case 'SHOP_LEFT':
    case 'REST_COMPLETED':
    case 'REWARD_TAKEN':
    case 'REWARD_SKIPPED':
      if (!current.pendingNodeResolution) {
        throw new Error(`Illegal run transition: cannot leave room when no node is pending`);
      }
      return { lifecycle: 'in_run', phase: 'map', pendingNodeResolution: false };
    case 'RUN_ENDED':
      return { lifecycle: 'ended', phase: action.phase, pendingNodeResolution: false };
  }
}

