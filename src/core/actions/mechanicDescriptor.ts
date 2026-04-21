import type { GameState, CombatState } from '@/core/types';
import type { TriggerWindow, TriggerSource, ResolutionIntent, ResolutionStep, ResolutionContext, ResolutionStepResult } from './resolutionTypes';

export interface ResourceMutation {
  resource: 'intel' | 'devotion' | 'corruption' | 'thread' | 'timeLayer' | 'concoction';
  operation: 'add' | 'subtract' | 'set' | 'multiply';
  value: number;
  source: TriggerSource;
  sourceId: string;
}

export interface EffectDefinition {
  id: string;
  type: 'stat_modifier' | 'trigger' | 'resource_mutation' | 'room_bonus';
  scope: 'persistent' | 'combat' | 'room';
  apply: (context: MechanicContext) => MechanicResult;
  remove?: (context: MechanicContext) => MechanicResult;
  description: string;
  icon?: string;
  tone?: 'blessing' | 'ward' | 'warp' | 'hex' | 'neutral';
}

export interface TriggerDefinition {
  id: string;
  window: TriggerWindow;
  source: TriggerSource;
  condition?: (context: MechanicContext) => boolean;
  effect: (context: MechanicContext) => MechanicResult;
  priority: number;
  once?: boolean;
}

export interface MechanicDescriptor {
  id: string;
  type: 'enchantment' | 'affliction' | 'character_resource' | 'relic' | 'potion' | 'synergy' | 'room_bonus';
  scope: 'persistent' | 'combat' | 'room';
  effects: EffectDefinition[];
  triggers: TriggerDefinition[];
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface MechanicContext {
  state: GameState;
  combat?: CombatState;
  source: TriggerSource;
  sourceId: string;
  window: TriggerWindow;
  data?: Record<string, unknown>;
}

export interface MechanicResult {
  success: boolean;
  mutations?: ResourceMutation[];
  sideEffects?: MechanicSideEffect[];
  message?: string;
}

export interface MechanicSideEffect {
  type: 'trigger_mechanic' | 'apply_status' | 'deal_damage' | 'heal' | 'draw' | 'discard';
  target: 'player' | 'enemy' | 'all_enemies';
  value?: number;
  data?: Record<string, unknown>;
}

export interface MechanicAuditSnapshot {
  mechanicId: string;
  mechanicType: MechanicDescriptor['type'];
  triggerWindow: TriggerWindow;
  triggered: boolean;
  mutationsApplied: ResourceMutation[];
  sideEffectsTriggered: number;
  timestamp: number;
}

export class MechanicRegistry {
  private static readonly MAX_AUDIT_LOG_SIZE = 1000;

  private mechanics: Map<string, MechanicDescriptor> = new Map();
  private auditLog: MechanicAuditSnapshot[] = [];

  private trimAuditLog(): void {
    if (this.auditLog.length > MechanicRegistry.MAX_AUDIT_LOG_SIZE) {
      this.auditLog = this.auditLog.slice(-MechanicRegistry.MAX_AUDIT_LOG_SIZE);
    }
  }

  register(mechanic: MechanicDescriptor): void {
    this.mechanics.set(mechanic.id, mechanic);
  }

  unregister(mechanicId: string): void {
    this.mechanics.delete(mechanicId);
  }

  getMechanicsByType(type: MechanicDescriptor['type']): MechanicDescriptor[] {
    return Array.from(this.mechanics.values()).filter(m => m.type === type && m.active);
  }

  getMechanicsByScope(scope: MechanicDescriptor['scope']): MechanicDescriptor[] {
    return Array.from(this.mechanics.values()).filter(m => m.scope === scope && m.active);
  }

  evaluateTriggers(window: TriggerWindow, context: MechanicContext): MechanicResult[] {
    const results: MechanicResult[] = [];
    const activeMechanics = Array.from(this.mechanics.values()).filter(m => m.active);

    for (const mechanic of activeMechanics) {
      const relevantTriggers = mechanic.triggers.filter(t => t.window === window);

      for (const trigger of relevantTriggers) {
        const conditionMet = !trigger.condition || trigger.condition(context);

        const audit: MechanicAuditSnapshot = {
          mechanicId: mechanic.id,
          mechanicType: mechanic.type,
          triggerWindow: window,
          triggered: conditionMet,
          mutationsApplied: [],
          sideEffectsTriggered: 0,
          timestamp: Date.now(),
        };

        if (conditionMet) {
          const result = trigger.effect(context);
          results.push(result);

          audit.mutationsApplied = result.mutations || [];
          audit.sideEffectsTriggered = result.sideEffects?.length || 0;
        }

        this.auditLog.push(audit);
        this.trimAuditLog();
      }
    }

    return results;
  }

  applyMutations(state: GameState, mutations: ResourceMutation[]): void {
    for (const mutation of mutations) {
      this.applyMutation(state, mutation);
    }
  }

  private applyMutation(state: GameState, mutation: ResourceMutation): void {
    const player = state.player;
    const combatPlayer = state.combat?.player;

    switch (mutation.resource) {
      case 'intel':
        player.intel = this.applyOperation(player.intel, mutation);
        break;
      case 'devotion':
        player.devotion = player.devotion || 0;
        player.devotion = this.applyOperation(player.devotion, mutation);
        if (combatPlayer) {
          combatPlayer.devotion = player.devotion;
        }
        break;
      case 'corruption':
        player.corruption = this.applyOperation(player.corruption, mutation);
        if (combatPlayer) {
          combatPlayer.corruptionAxis = player.corruption;
        }
        break;
      case 'thread':
        if (combatPlayer) {
          combatPlayer.thread = combatPlayer.thread || 0;
          combatPlayer.thread = this.applyOperation(combatPlayer.thread, mutation);
        }
        break;
      case 'timeLayer':
        if (combatPlayer) {
          combatPlayer.timeLayer = combatPlayer.timeLayer || 0;
          combatPlayer.timeLayer = this.applyOperation(combatPlayer.timeLayer, mutation);
        }
        break;
      case 'concoction':
        if (combatPlayer) {
          combatPlayer.concoction = combatPlayer.concoction || 0;
          combatPlayer.concoction = this.applyOperation(combatPlayer.concoction, mutation);
        }
        break;
    }
  }

  private applyOperation(current: number, mutation: ResourceMutation): number {
    switch (mutation.operation) {
      case 'add':
        return current + mutation.value;
      case 'subtract':
        return Math.max(0, current - mutation.value);
      case 'set':
        return mutation.value;
      case 'multiply':
        return Math.floor(current * mutation.value);
    }
  }

  getAuditLog(): MechanicAuditSnapshot[] {
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }
}

export function createDefaultMechanicRegistry(): MechanicRegistry {
  const registry = new MechanicRegistry();

  registry.register({
    id: 'intel_on_kill',
    type: 'character_resource',
    scope: 'combat',
    active: true,
    effects: [],
    triggers: [
      {
        id: 'intel_kill_trigger',
        window: 'on_kill',
        source: 'character_resource',
        priority: 10,
        condition: (context) => {
          const characterId = context.state.character?.id;
          return characterId === 'informant';
        },
        effect: (context) => {
          return {
            success: true,
            mutations: [
              {
                resource: 'intel',
                operation: 'add',
                value: 1,
                source: 'character_resource',
                sourceId: 'intel_on_kill',
              },
            ],
            message: '获得 1 点情报',
          };
        },
      },
    ],
  });

  registry.register({
    id: 'devotion_on_block',
    type: 'character_resource',
    scope: 'combat',
    active: true,
    effects: [],
    triggers: [
      {
        id: 'devotion_block_trigger',
        window: 'on_damage_applied',
        source: 'character_resource',
        priority: 5,
        condition: (context) => {
          const characterId = context.state.character?.id;
          return characterId === 'tactician' && (context.state.player.devotion || 0) > 0;
        },
        effect: (context) => {
          const devotion = context.state.player.devotion || 0;
          return {
            success: true,
            sideEffects: [
              {
                type: 'heal',
                target: 'player',
                value: Math.floor(devotion / 2),
              },
            ],
            message: `虔诚治愈 ${Math.floor(devotion / 2)} 点生命`,
          };
        },
      },
    ],
  });

  registry.register({
    id: 'corruption_on_damage',
    type: 'character_resource',
    scope: 'combat',
    active: true,
    effects: [],
    triggers: [
      {
        id: 'corruption_damage_trigger',
        window: 'on_damage_applied',
        source: 'character_resource',
        priority: 8,
        condition: (context) => {
          const characterId = context.state.character?.id;
          return characterId === 'corrupted' && (context.state.player.corruption || 0) > 0;
        },
        effect: (context) => {
          const corruption = context.state.player.corruption || 0;
          return {
            success: true,
            sideEffects: [
              {
                type: 'deal_damage',
                target: 'all_enemies',
                value: Math.floor(corruption / 3),
              },
            ],
            message: `腐化造成 ${Math.floor(corruption / 3)} 点伤害`,
          };
        },
      },
    ],
  });

  return registry;
}
