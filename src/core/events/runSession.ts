/**
 * RunSession - Facade for run lifecycle ownership
 * 
 * This module provides a clean abstraction layer for run state management,
 * separating ownership concerns from GameEngine's game logic.
 */
import type { GameState } from '@/core/types';
import { deriveRunTransitionState, transitionRunState, type RunAction, type RunTransitionState } from './runStateMachine';
import { runPhaseToScreen } from './runStateMachine';

export interface RunSessionConfig {
  seed?: number;
  characterId?: string;
}

export class RunSession {
  private _state: RunTransitionState;
  private _disposed = false;
  
  constructor(config?: RunSessionConfig) {
    this._state = {
      lifecycle: 'idle',
      phase: 'character_select',
      pendingNodeResolution: false
    };
  }
  
  get state(): Readonly<RunTransitionState> {
    return this._state;
  }
  
  get isDisposed(): boolean {
    return this._disposed;
  }
  
  /**
   * Transition the run to a new state
   */
  transition(action: RunAction): RunTransitionState {
    if (this._disposed) {
      console.warn('[RunSession] Cannot transition disposed session');
      return this._state;
    }
    
    this._state = transitionRunState(this._state, action);
    return this._state;
  }
  
  /**
   * Pause the run
   */
  pause(): void {
    if (this._disposed) return;
    this.transition({ type: 'RUN_PAUSED' } as RunAction);
  }
  
  /**
   * Resume the run
   */
  resume(): void {
    if (this._disposed) return;
    this.transition({ type: 'RUN_RESUMED' } as RunAction);
  }
  
  /**
   * Mark a node as completed
   */
  completeNode(): void {
    if (this._disposed) return;
    // This will transition back to map from any room phase
    this.transition({ type: 'REWARD_TAKEN' } as RunAction);
  }
  
  /**
   * Load state from a saved game state
   */
  loadState(gameState: GameState): void {
    if (this._disposed) {
      console.warn('[RunSession] Cannot load state into disposed session');
      return;
    }
    
    // Derive run state from game state
    this._state = deriveRunTransitionState(gameState);
  }
  
  /**
   * Create a snapshot of current session state
   */
  snapshot(): RunTransitionState {
    return { ...this._state };
  }
  
  /**
   * Dispose the session and clean up resources
   */
  dispose(): void {
    if (this._disposed) return;
    
    this._disposed = true;
    this._state = {
      lifecycle: 'ended',
      phase: 'game_over',
      pendingNodeResolution: false
    };
  }
}

/**
 * Create a new RunSession instance
 */
export function createRunSession(config?: RunSessionConfig): RunSession {
  return new RunSession(config);
}
