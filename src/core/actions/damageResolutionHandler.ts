/**
 * @file damageResolutionHandler.ts
 * @description 伤害解析处理器 - 处理战斗中伤害计算和应用的完整流水线
 *
 * 主要职责:
 * - 计算基础伤害，考虑多重伤害修正器 (additive, multiplicative, independent)
 * - 应用状态效果对伤害的修正 (weak, vulnerable, strength, dexterity 等)
 * - 处理真实伤害(True Damage)和穿盾伤害
 * - 管理护盾值的扣除顺序和逻辑
 * - 触发伤害应用相关的事件和副作用
 */
import type { GameState, CombatState } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';
import { finalizeDamage, normalizeDamageBase } from '@/core/balance/numericMath';
import { COMBAT_NUMBERS } from '@/core/balance/numericConstants';
import type { 
  ResolutionIntent, 
  ResolutionStep, 
  ResolutionContext, 
  TriggerWindow,
  ResolutionSideEffect,
  ResolutionStepResult,
} from '@/core/actions/resolutionTypes';

export interface DamageResolutionContext extends ResolutionContext {
  damageContext: {
    amount: number;
    sourceType: 'player' | 'enemy' | 'system';
    sourceId: string;
    isTrueDamage: boolean;
    ignoreBlock: boolean;
  };
}

type CombatTarget = {
  hp: number;
  block: number;
  statuses: Record<string, number>;
};

export class DamageResolutionHandler {
  canHandle(intent: ResolutionIntent): boolean {
    return intent.type === 'deal_damage';
  }

  createSteps(intent: ResolutionIntent, context: ResolutionContext): ResolutionStep[] {
    if (intent.type !== 'deal_damage') return [];

    const steps: ResolutionStep[] = [];
    const timestamp = Date.now();

    for (const target of intent.targets) {
      steps.push({
        stepId: `step_${timestamp}_${steps.length}`,
        intent,
        window: context.window,
        timestamp,
        order: steps.length,
        duration: 0,
      });
    }

    return steps;
  }

  executeStep(step: ResolutionStep, context: ResolutionContext): ResolutionStepResult {
    if (step.intent.type !== 'deal_damage') {
      return { success: false };
    }

    const state = context.state;
    if (!state.combat) {
      return { success: false, actualValue: 0 };
    }

    const intent = step.intent;
    const damageContext = (context as DamageResolutionContext).damageContext;
    
    let target: CombatTarget | undefined;
    
    if (intent.targets[0]?.type === 'player') {
      target = state.combat.player;
    } else if (intent.targets[0]?.type === 'enemy') {
      target = state.combat.enemies.find(e => e.id === intent.targets[0]?.id);
    }

    if (!target) {
      return { success: false, actualValue: 0 };
    }

    const calculatedDamage = this.calculateDamage(state, damageContext, target);
    const actualDamage = this.applyDamageToTarget(state, target, calculatedDamage, damageContext.ignoreBlock);

    const sideEffects = this.collectSideEffects(state, target, actualDamage);

    globalEventBus.publish({
      type: 'DamageDealt',
      amount: actualDamage,
      targetType: intent.targets[0]?.type,
      targetId: intent.targets[0]?.id,
    });

    return {
      success: true,
      actualValue: actualDamage,
      overkill: target.hp <= 0,
      sideEffects,
    };
  }

  private calculateDamage(
    state: GameState, 
    context: { amount: number; sourceType: string; sourceId: string; isTrueDamage: boolean },
    target: CombatTarget
  ): number {
    if (context.isTrueDamage) {
      return context.amount;
    }

    let damage = normalizeDamageBase(context.amount);
    
    damage = this.applyStatusModifiers(state, damage, context, target);
    damage = this.applySoftCaps(damage);

    return finalizeDamage(damage);
  }

  private applyStatusModifiers(
    state: GameState,
    damage: number,
    context: { sourceType: string; sourceId: string },
    target: CombatTarget
  ): number {
    let result = damage;

    if (context.sourceType === 'player') {
      const player = state.combat?.player;
      if (player?.statuses['Strength']) {
        result = normalizeDamageBase(result + player.statuses['Strength']);
      }
      if (player?.statuses['Weak']) {
        result = Math.floor(result * COMBAT_NUMBERS.statusMultipliers.weak);
      }
      if (player?.statuses['Fear']) {
        result = Math.floor(result * COMBAT_NUMBERS.statusMultipliers.fear);
      }
    }

    if (target.statuses['Vulnerable']) {
      result = Math.floor(result * COMBAT_NUMBERS.statusMultipliers.vulnerable);
    }

    return result;
  }

  private applySoftCaps(damage: number): number {
    const softCap = COMBAT_NUMBERS.damage.softCap;
    if (damage > softCap) {
      const excess = damage - softCap;
      return softCap + Math.floor(excess * COMBAT_NUMBERS.damage.softCapExcessRetention);
    }
    return damage;
  }

  private applyDamageToTarget(
    state: GameState,
    target: CombatTarget,
    damage: number,
    ignoreBlock: boolean
  ): number {
    let finalDamage = damage;

    if (!ignoreBlock && target.block > 0) {
      const blocked = Math.min(target.block, finalDamage);
      target.block -= blocked;
      finalDamage -= blocked;
    }

    if (finalDamage > 0) {
      target.hp = Math.max(0, target.hp - finalDamage);
    }

    return finalDamage;
  }

  private collectSideEffects(
    state: GameState,
    target: CombatTarget,
    damage: number
  ): ResolutionSideEffect[] {
    const sideEffects: ResolutionSideEffect[] = [];

    if (target.statuses['PlatedArmor'] && damage > 0) {
      sideEffects.push({
        type: 'trigger_affliction',
        source: 'affliction',
        sourceId: 'plated_armor',
        data: { reduction: 1 },
      });
    }

    if (target.hp <= 0) {
      sideEffects.push({
        type: 'trigger_synergy',
        source: 'synergy',
        sourceId: 'on_kill',
        data: { targetId: target },
      });
    }

    return sideEffects;
  }
}
