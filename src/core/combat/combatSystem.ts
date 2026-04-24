/**
 * @file combatSystem.ts
 * @description 战斗系统核心 - 管理战斗中的伤害计算和状态应用
 *
 * 主要职责:
 * - 管理伤害修正器列表 (DamageModifier)
 * - 应用护盾值、状态效果到玩家和敌人
 * - 与全局事件总线同步战斗事件
 */
import { GameState, CombatState } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';
import { COMBAT_NUMBERS } from '@/core/balance/numericConstants';
import { applyDamageMultiplierStep, clampNumber, finalizeDamage, normalizeDamageBase } from '@/core/balance/numericMath';
import { synergySystem } from '@/features/synergies/synergySystem';

export interface DamageModifier {
  type: 'additive' | 'multiplicative' | 'independent';
  value: number;
  source: string;
  priority: number;
}

export interface DamageContext {
  amount: number;
  sourceType: 'player' | 'enemy' | 'system';
  sourceId: string;
  targetType: 'player' | 'enemy';
  targetId: string;
  modifiers: DamageModifier[];
  isTrueDamage: boolean;
  ignoreBlock: boolean;
}

export class CombatSystem {
  private damageModifiers: Map<string, DamageModifier[]> = new Map();

  constructor() {
    this.initializeDefaultModifiers();
  }

  private initializeDefaultModifiers() {
    this.damageModifiers.set('strength', [{
      type: 'additive',
      value: 0,
      source: 'status',
      priority: 10
    }]);

    this.damageModifiers.set('weak', [{
      type: 'multiplicative',
      value: COMBAT_NUMBERS.statusMultipliers.weak,
      source: 'status',
      priority: 20
    }]);

    this.damageModifiers.set('fear', [{
      type: 'multiplicative',
      value: COMBAT_NUMBERS.statusMultipliers.fear,
      source: 'status',
      priority: 20
    }]);

    this.damageModifiers.set('vulnerable', [{
      type: 'multiplicative',
      value: COMBAT_NUMBERS.statusMultipliers.vulnerable,
      source: 'status',
      priority: 30
    }]);

    this.damageModifiers.set('martyrs_vigor', [{
      type: 'multiplicative',
      value: COMBAT_NUMBERS.statusMultipliers.martyrsVigor,
      source: 'status',
      priority: 40
    }]);
  }

  private applyStatusModifiers(state: GameState, damage: number, context: DamageContext): number {
    const sourceEntity = context.sourceType === 'player'
      ? state.combat?.player
      : state.combat?.enemies.find(e => e.id === context.sourceId);
    const targetEntity = context.targetType === 'player'
      ? state.combat?.player
      : state.combat?.enemies.find(e => e.id === context.targetId);

    if (!sourceEntity || !targetEntity) return damage;

    let result = normalizeDamageBase(damage);

    if (sourceEntity.statuses['Strength']) {
      result = normalizeDamageBase(result + sourceEntity.statuses['Strength']);
    }
    if (sourceEntity.statuses['Weak']) {
      result = applyDamageMultiplierStep(result, COMBAT_NUMBERS.statusMultipliers.weak);
    }
    if (sourceEntity.statuses['Fear']) {
      result = applyDamageMultiplierStep(result, COMBAT_NUMBERS.statusMultipliers.fear);
    }
    if (targetEntity.statuses['Vulnerable']) {
      result = applyDamageMultiplierStep(result, COMBAT_NUMBERS.statusMultipliers.vulnerable);
    }
    if (sourceEntity.statuses['MartyrsVigor']) {
      result = applyDamageMultiplierStep(result, COMBAT_NUMBERS.statusMultipliers.martyrsVigor);
    }

    return finalizeDamage(result);
  }

  private applySynergyModifiers(state: GameState, damage: number, context: DamageContext): number {
    if (context.sourceType !== 'player') return damage;
    const synergyMultiplier = synergySystem.calculateTotalMultiplier();
    return applyDamageMultiplierStep(damage, synergyMultiplier);
  }

  private applySoftCaps(damage: number): number {
    const softCap = COMBAT_NUMBERS.damage.softCap;
    if (damage > softCap) {
      const excess = damage - softCap;
      return softCap + Math.floor(excess * COMBAT_NUMBERS.damage.softCapExcessRetention);
    }
    return damage;
  }

  private applyPlayerCorruptionDamageBonus(state: GameState, damage: number, sourceType: 'player' | 'enemy' | 'system'): number {
    if (sourceType !== 'player') return damage;
    const corruption = clampNumber(
      state.player.corruption || 0,
      COMBAT_NUMBERS.corruption.min,
      COMBAT_NUMBERS.corruption.max
    );
    if (corruption <= 0) return damage;
    const corruptionMultiplier =
      1 + Math.min(COMBAT_NUMBERS.corruption.damageBonusCap, corruption * COMBAT_NUMBERS.corruption.bonusPerPoint);
    return applyDamageMultiplierStep(damage, corruptionMultiplier);
  }

  private applyPlayerRelicDamageBonuses(state: GameState, damage: number, sourceType: 'player' | 'enemy' | 'system'): number {
    if (sourceType !== 'player') return damage;
    if (!state.player.relics?.includes('martyrs_mark')) return damage;
    const combatPlayer = state.combat?.player;
    const hp = combatPlayer?.hp ?? state.player.hp;
    const maxHp = combatPlayer?.maxHp ?? state.player.maxHp;
    if (!maxHp || hp <= 0) return damage;
    const missingRatio = Math.max(0, Math.min(1, (maxHp - hp) / maxHp));
    const martyrMultiplier = 1 + missingRatio * 0.6;
    return applyDamageMultiplierStep(damage, martyrMultiplier);
  }

  private applyPostStatusDamagePipeline(
    state: GameState,
    damage: number,
    sourceType: 'player' | 'enemy' | 'system',
    context?: DamageContext
  ): number {
    let result = normalizeDamageBase(damage);
    if (context) {
      result = this.applySynergyModifiers(state, result, context);
    } else if (sourceType === 'player') {
      result = applyDamageMultiplierStep(result, synergySystem.calculateTotalMultiplier());
    }

    result = this.applyPlayerCorruptionDamageBonus(state, result, sourceType);
    result = this.applyPlayerRelicDamageBonuses(state, result, sourceType);
    result = this.applySoftCaps(result);
    return finalizeDamage(result);
  }

  public calculateDamage(state: GameState, context: DamageContext): number {
    let damage = normalizeDamageBase(context.amount);

    if (context.isTrueDamage) {
      return finalizeDamage(damage);
    }

    damage = this.applyStatusModifiers(state, damage, context);
    return this.applyPostStatusDamagePipeline(state, damage, context.sourceType, context);
  }

  public applyDamage(state: GameState, context: DamageContext): number {
    const calculatedDamage = this.calculateDamage(state, context);
    let finalDamage = calculatedDamage;

    if (!state.combat) return 0;

    let target: any;
    if (context.targetType === 'player') {
      target = state.combat.player;
    } else {
      target = state.combat.enemies.find(e => e.id === context.targetId);
    }

    if (!target) return 0;

    if (!context.ignoreBlock && target.block > 0) {
      const blocked = Math.min(target.block, finalDamage);
      target.block -= blocked;
      finalDamage -= blocked;
      if (blocked > 0) {
        globalEventBus.publish({
          type: 'BlockReduced',
          amount: blocked,
          targetType: context.targetType,
          targetId: context.targetId
        });
      }
    }

    if (finalDamage > 0) {
      const hpBefore = target.hp;
      target.hp = Math.max(0, target.hp - finalDamage);
      const actualDamage = hpBefore - target.hp;
      if (context.targetType === 'enemy' && (target.statuses?.['PlatedArmor'] || 0) > 0) {
        target.statuses['PlatedArmor'] = Math.max(0, (target.statuses['PlatedArmor'] || 0) - 1);
        if (target.statuses['PlatedArmor'] <= 0) {
          delete target.statuses['PlatedArmor'];
        }
      }

      if (context.targetType === 'player') {
        state.player.hp = target.hp;
        state.combat.player.damageTakenThisTurn = Math.max(
          0,
          Math.floor(state.combat.player.damageTakenThisTurn || 0) + actualDamage
        );
      }

      globalEventBus.publish({
        type: 'DamageDealt',
        amount: actualDamage,
        targetType: context.targetType,
        targetId: context.targetId
      });

      globalEventBus.publish({
        type: 'DamageReceived',
        amount: actualDamage,
        sourceType: context.sourceType === 'player' ? 'self' : 'enemy'
      });

      if (target.hp <= 0 && context.targetType === 'enemy') {
        globalEventBus.publish({ type: 'EnemyDeath', enemyId: context.targetId });
      } else if (target.hp <= 0 && context.targetType === 'player') {
        globalEventBus.publish({ type: 'PlayerDeath' });
      }

      return actualDamage;
    }

    return 0;
  }

  public applyStatus(state: GameState, targetType: 'player' | 'enemy', targetId: string, status: string, amount: number): void {
    if (!state.combat) return;

    let target: any;
    if (targetType === 'player') {
      target = state.combat.player;
    } else {
      target = state.combat.enemies.find(e => e.id === targetId);
    }

    if (!target) return;

    target.statuses[status] = (target.statuses[status] || 0) + amount;

    if (target.statuses[status] < 0) {
      target.statuses[status] = 0;
    }

    globalEventBus.publish({
      type: 'StatusApplied',
      status,
      amount,
      targetType,
      targetId
    });
  }

  public gainBlock(state: GameState, targetType: 'player' | 'enemy', targetId: string, amount: number): void {
    if (!state.combat) return;
    if (!Number.isFinite(amount)) {
      console.error('[CombatSystem] Illegal block amount:', { targetType, targetId, amount });
      return;
    }

    let target: any;
    if (targetType === 'player') {
      target = state.combat.player;
    } else {
      target = state.combat.enemies.find(e => e.id === targetId);
    }

    if (!target) return;

    const nextBlock = Math.max(0, Math.floor((target.block || 0) + amount));
    if (nextBlock !== (target.block || 0) + amount) {
      console.warn('[CombatSystem] Clamped block mutation', {
        targetType,
        targetId,
        previousBlock: target.block || 0,
        amount,
        nextBlock
      });
    }
    target.block = nextBlock;

    globalEventBus.publish({ type: 'BlockGained', amount });
  }

  public processTurnEnd(state: GameState, playerTurn: boolean): void {
    if (!state.combat) return;

    if (playerTurn) {
      const player = state.combat.player;
      player.cardsPlayedThisTurn = 0;
      player.potionToxicity = Math.max(0, player.potionToxicity - COMBAT_NUMBERS.potionToxicityDecayPerTurn);
      player.potionsUsedThisTurn = 0;
      delete player.statuses['NextAttackDiscount'];
      delete player.statuses['DoubleCastNextCard'];
      delete player.statuses['DoubleDamageNextAttack'];
    }
  }

  public processTurnStart(state: GameState, playerTurn: boolean): void {
    if (!state.combat) return;

    if (playerTurn) {
      const player = state.combat.player;
      player.energy = state.player.maxEnergy;
    }
  }

  public calculateEffectiveDamage(
    state: GameState,
    baseDamage: number,
    sourceStatuses: Record<string, number>,
    targetStatuses: Record<string, number>,
    sourceType: 'player' | 'enemy' | 'system' = 'player'
  ): number {
    let damage = normalizeDamageBase(baseDamage);

    if (sourceStatuses['Strength']) damage = normalizeDamageBase(damage + sourceStatuses['Strength']);
    if (sourceStatuses['Weak']) damage = applyDamageMultiplierStep(damage, COMBAT_NUMBERS.statusMultipliers.weak);
    if (sourceStatuses['Fear']) damage = applyDamageMultiplierStep(damage, COMBAT_NUMBERS.statusMultipliers.fear);
    if (targetStatuses['Vulnerable']) damage = applyDamageMultiplierStep(damage, COMBAT_NUMBERS.statusMultipliers.vulnerable);
    if (sourceStatuses['MartyrsVigor']) damage = applyDamageMultiplierStep(damage, COMBAT_NUMBERS.statusMultipliers.martyrsVigor);

    return this.applyPostStatusDamagePipeline(state, damage, sourceType);
  }
}

export const combatSystem = new CombatSystem();
