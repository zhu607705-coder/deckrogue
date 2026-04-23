/**
 * @file resolutionTypes.ts
 * @description 动作解析类型 - 定义触发窗口、解析意图和解析步骤的类型系统
 *
 * 主要职责:
 * - 定义 TriggerWindow 类型，描述触发时机 (on_command, on_damage_applied, on_kill 等)
 * - 定义 TriggerSource 类型，描述触发来源 (card, relic, potion, synergy 等)
 * - 定义 ResolutionIntent 类型，描述动作的解析意图 (deal_damage, apply_status, heal 等)
 * - 定义 ResolutionStep 和 ResolutionContext 类型，用于动作解析流水线
 */
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
