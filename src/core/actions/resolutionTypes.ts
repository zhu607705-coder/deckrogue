import type { GameState } from '@/core/types';

export type TriggerWindow =
  | 'on_command'
  | 'on_target_resolved'
  | 'on_damage_applied'
  | 'on_status_applied'
  | 'on_kill'
  | 'on_turn_start'
  | 'on_turn_end'
  | 'on_combat_end'
  | 'on_room_exit';

export type TriggerSource = 
  | 'card'
  | 'relic'
  | 'potion'
  | 'synergy'
  | 'enchantment'
  | 'affliction'
  | 'character_resource'
  | 'enemy_intent'
  | 'system';

export interface ResolutionIntent {
  type: 'deal_damage' | 'apply_block' | 'apply_status' | 'heal' | 'gain_energy' | 'draw_cards' | 'discard_cards' | 'shuffle_deck' | 'gain_gold' | 'gain_relic' | 'gain_potion' | 'remove_card' | 'upgrade_card' | 'transform_card';
  source: TriggerSource;
  sourceId: string;
  targets: ResolutionTarget[];
  value?: number;
  metadata?: Record<string, unknown>;
}

export interface ResolutionTarget {
  type: 'player' | 'enemy' | 'card';
  id: string;
}

export interface ResolutionStep {
  stepId: string;
  intent: ResolutionIntent;
  window: TriggerWindow;
  timestamp: number;
  order: number;
  duration: number;
  result?: ResolutionStepResult;
}

export interface ResolutionStepResult {
  success: boolean;
  actualValue?: number;
  overkill?: boolean;
  sideEffects?: ResolutionSideEffect[];
}

export interface ResolutionContext {
  state: GameState;
  combatContext?: {
    turn: number;
    isPlayerTurn: boolean;
    playerBlock: number;
    playerEnergy: number;
  };
  source: TriggerSource;
  sourceId: string;
  window: TriggerWindow;
  startTime: number;
}

export interface ResolutionResult {
  success: boolean;
  error?: string;
  intents: ResolutionIntent[];
  steps: ResolutionStep[];
  diagnostics: {
    totalIntents: number;
    totalSteps: number;
    currentWindow: TriggerWindow | null;
    duration: number;
  };
}

export interface ResolutionSideEffect {
  type: 'trigger_relic' | 'trigger_enchantment' | 'trigger_affliction' | 'trigger_synergy' | 'trigger_character_resource';
  source: TriggerSource;
  sourceId: string;
  data?: Record<string, unknown>;
}

export interface ResolutionPipelineConfig {
  enableLogging: boolean;
  enableDiagnostics: boolean;
  maxStepsPerFrame: number;
}

export interface ResolutionPipelineDiagnostics {
  totalIntents: number;
  totalSteps: number;
  currentWindow: TriggerWindow | null;
  lastIntent: ResolutionIntent | null;
  lastStep: ResolutionStep | null;
  averageStepDuration: number;
  maxStepDuration: number;
}
