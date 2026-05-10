/**
 * @file groupCoordination.ts
 * @description 群体协作系统 - 多敌人战斗时的意图分配协调
 *
 * 主要职责:
 * - 定义 IntentDistribution，描述攻击/防御/减益/增益意图的权重分配
 * - 实现 calculateIntentDistribution，根据战场态势计算意图分布
 * - 实现 detectIntentConflicts，检测多个敌人的意图冲突
 * - 实现 adjustIntentWeightForGroup，为群体战斗调整个体意图权重
 */
import { intentTagger, type IntentCategory } from '@/core/ai/intentTags';

export interface IntentDistribution {
  attackWeight: number;
  defendWeight: number;
  debuffWeight: number;
  buffWeight: number;
  specialWeight: number;
}

export interface PlayerStatusSnapshot {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  statuses: Record<string, number>;
}

export interface GroupCoordinationState {
  totalIntentBudget: number;
  usedIntentBudget: Record<string, number>;
  recommendedIntentDistribution: IntentDistribution;
}

export interface CoordinationResult {
  adjustedWeight: number;
  reason: string;
}

export function calculateIntentDistribution(
  enemies: any[],
  playerStatus: PlayerStatusSnapshot
): IntentDistribution {
  const totalWeight = 1.0;
  const enemyCount = Math.max(1, enemies.length);

  let attackWeight = 0.35;
  let defendWeight = 0.25;
  let debuffWeight = 0.15;
  let buffWeight = 0.10;
  let specialWeight = 0.15;

  if (playerStatus.statuses) {
    const vulnerable = playerStatus.statuses['Vulnerable'] || 0;
    const weak = playerStatus.statuses['Weak'] || 0;

    if (vulnerable > 0) {
      attackWeight += 0.15;
      debuffWeight -= 0.05;
    }

    if (weak > 0) {
      attackWeight += 0.10;
      defendWeight += 0.05;
    }
  }

  if (playerStatus.block > 15) {
    defendWeight -= 0.05;
    debuffWeight += 0.05;
  }

  if (playerStatus.block === 0 && playerStatus.hp < playerStatus.maxHp * 0.5) {
    attackWeight += 0.10;
    defendWeight -= 0.05;
  }

  const hpPercent = playerStatus.maxHp > 0 ? playerStatus.hp / playerStatus.maxHp : 1;
  if (hpPercent < 0.3) {
    attackWeight += 0.15;
    defendWeight -= 0.10;
  } else if (hpPercent > 0.8) {
    debuffWeight += 0.05;
    buffWeight += 0.05;
  }

  if (enemyCount >= 3) {
    attackWeight += 0.05;
    defendWeight -= 0.05;
  } else if (enemyCount === 1) {
    defendWeight += 0.10;
    attackWeight -= 0.05;
  }

  const weights = [attackWeight, defendWeight, debuffWeight, buffWeight, specialWeight];
  const sum = weights.reduce((a, b) => a + b, 0);

  if (sum > 0) {
    const scale = totalWeight / sum;
    attackWeight *= scale;
    defendWeight *= scale;
    debuffWeight *= scale;
    buffWeight *= scale;
    specialWeight *= scale;
  }

  return {
    attackWeight: Math.max(0.05, attackWeight),
    defendWeight: Math.max(0.05, defendWeight),
    debuffWeight: Math.max(0.0, debuffWeight),
    buffWeight: Math.max(0.0, buffWeight),
    specialWeight: Math.max(0.0, specialWeight)
  };
}

export function detectIntentConflicts(
  currentEnemyIntent: string,
  otherEnemyIntents: string[],
  threshold: number = 2
): boolean {
  if (!otherEnemyIntents || otherEnemyIntents.length === 0) {
    return false;
  }

  let conflictCount = 0;

  for (const otherIntent of otherEnemyIntents) {
    if (areIntentsSimilar(currentEnemyIntent, otherIntent)) {
      conflictCount++;
    }
  }

  return conflictCount >= threshold;
}

export function areIntentsSimilar(intentA: string, intentB: string): boolean {
  if (!intentA || !intentB) {
    return false;
  }

  const intentALower = intentA.toLowerCase();
  const intentBLower = intentB.toLowerCase();

  if (intentALower === intentBLower) {
    return true;
  }

  const categoryA = getCategoryFromIntent(intentALower);
  const categoryB = getCategoryFromIntent(intentBLower);

  if (categoryA !== categoryB) {
    return false;
  }

  const attackKeywords = ['attack', 'strike', 'damage', 'slam', 'punch', 'burn', 'slash', 'claw', 'bite'];
  const defendKeywords = ['block', 'defend', 'shield', 'barrier', 'guard', 'fortify'];
  const debuffKeywords = ['debuff', 'weaken', 'vulnerable', 'poison', 'frail', 'curse', 'hex'];
  const buffKeywords = ['buff', 'strength', 'power', 'rage', 'frenzy', 'haste', 'empower'];
  const specialKeywords = ['summon', 'heal', 'special', 'ultimate', 'execute', 'multi'];

  const checkKeywordOverlap = (keywords: string[]): boolean => {
    const matchA = keywords.some(k => intentALower.includes(k));
    const matchB = keywords.some(k => intentBLower.includes(k));
    return matchA && matchB;
  };

  if (categoryA === 'attack') {
    if (intentALower.includes('all') || intentBLower.includes('all')) {
      return checkKeywordOverlap(attackKeywords);
    }
    if (intentALower.includes('multi') && intentBLower.includes('multi')) {
      return true;
    }
  }

  if (categoryA === 'defend') {
    if (intentALower.includes('block') && intentBLower.includes('block')) {
      return true;
    }
  }

  if (categoryA === 'debuff') {
    const debuffOverlap = debuffKeywords.filter(k =>
      intentALower.includes(k) && intentBLower.includes(k)
    );
    if (debuffOverlap.length >= 1) {
      return true;
    }
  }

  if (categoryA === 'buff') {
    const buffOverlap = buffKeywords.filter(k =>
      intentALower.includes(k) && intentBLower.includes(k)
    );
    if (buffOverlap.length >= 1) {
      return true;
    }
  }

  if (categoryA === 'special') {
    if (intentALower.includes('heal') && intentBLower.includes('heal')) {
      return true;
    }
    if (intentALower.includes('summon') && intentBLower.includes('summon')) {
      return true;
    }
  }

  return false;
}

function getCategoryFromIntent(intent: string): IntentCategory {
  if (/attack|strike|damage|slam|burn|punch|kick|gore|claw|bite|smite|execute|slash/.test(intent)) {
    return 'attack';
  }
  if (/block|defend|shield|barrier|guard|fortify|protect/.test(intent)) {
    return 'defend';
  }
  if (/debuff|weaken|vulnerable|poison|curse|doom|frail|fear|slow|corrupt|hex/.test(intent)) {
    return 'debuff';
  }
  if (/buff|strengthen|power|empower|rage|frenzy|enrage|haste|quicken|ascend|transcend/.test(intent)) {
    return 'buff';
  }
  if (/summon|call|spawn|create|construct|golem|ally/.test(intent)) {
    return 'summon';
  }
  return 'special';
}

function getCategoryWeight(category: IntentCategory, distribution: IntentDistribution): number {
  switch (category) {
    case 'attack': return distribution.attackWeight;
    case 'defend': return distribution.defendWeight;
    case 'debuff': return distribution.debuffWeight;
    case 'buff': return distribution.buffWeight;
    default: return distribution.specialWeight;
  }
}

export function adjustIntentWeightForGroup(
  baseWeight: number,
  intentCategory: string,
  distribution: IntentDistribution,
  hasConflict: boolean,
  enemyIndex: number
): CoordinationResult {
  let adjustedWeight = baseWeight;
  let reason = '';

  const category = intentCategory as IntentCategory;
  const targetWeight = getCategoryWeight(category, distribution);

  const categoryMultiplier = 1 + (targetWeight - 0.2) * 0.3;
  adjustedWeight *= categoryMultiplier;

  if (hasConflict) {
    const conflictPenalty = 0.6 - (enemyIndex * 0.1);
    adjustedWeight *= Math.max(0.3, conflictPenalty);
    reason = `意图冲突降低权重 (${Math.round((1 - Math.max(0.3, conflictPenalty)) * 100)}% 惩罚)`;
  } else {
    reason = `基于意图分配调整 (目标权重: ${(targetWeight * 100).toFixed(1)}%)`;
  }

  if (enemyIndex === 0) {
    adjustedWeight *= 1.1;
    reason += ' | 首领敌人加成';
  } else if (enemyIndex > 1) {
    adjustedWeight *= 0.95;
    reason += ' | 从属敌人轻微惩罚';
  }

  adjustedWeight = Math.max(0.1, adjustedWeight);

  return {
    adjustedWeight,
    reason: reason.trim()
  };
}

export class GroupCoordination {
  private state: GroupCoordinationState;
  private conflictThreshold: number;

  constructor(totalBudget: number = 100, conflictThreshold: number = 2) {
    this.state = {
      totalIntentBudget: totalBudget,
      usedIntentBudget: {},
      recommendedIntentDistribution: {
        attackWeight: 0.35,
        defendWeight: 0.25,
        debuffWeight: 0.15,
        buffWeight: 0.10,
        specialWeight: 0.15
      }
    };
    this.conflictThreshold = conflictThreshold;
  }

  public updateDistribution(distribution: IntentDistribution): void {
    this.state.recommendedIntentDistribution = { ...distribution };
  }

  public recordIntentUsage(intent: string, weight: number): void {
    const category = getCategoryFromIntent(intent.toLowerCase());
    const current = this.state.usedIntentBudget[category] || 0;
    this.state.usedIntentBudget[category] = current + weight;
  }

  public checkForConflict(intent: string, otherIntents: string[]): boolean {
    return detectIntentConflicts(intent, otherIntents, this.conflictThreshold);
  }

  public getState(): GroupCoordinationState {
    return {
      ...this.state,
      recommendedIntentDistribution: { ...this.state.recommendedIntentDistribution }
    };
  }

  public reset(): void {
    this.state.usedIntentBudget = {};
  }

  public getAdjustedWeight(
    baseWeight: number,
    intent: string,
    enemyIndex: number,
    otherEnemyIntents: string[]
  ): CoordinationResult {
    const category = getCategoryFromIntent(intent.toLowerCase());
    const hasConflict = this.checkForConflict(intent, otherEnemyIntents);

    return adjustIntentWeightForGroup(
      baseWeight,
      category,
      this.state.recommendedIntentDistribution,
      hasConflict,
      enemyIndex
    );
  }
}

export const groupCoordination = new GroupCoordination();
