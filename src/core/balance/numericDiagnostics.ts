/**
 * @file numericDiagnostics.ts
 * @description 数值诊断 - 分析数值权重变更对游戏内容的影响
 *
 * 主要职责:
 * - 实现 analyzeWeightChange，分析权重变更对卡牌、遗物、事件和敌人的影响
 * - 生成 NumericDiagnosticReport，列出所有受影响的内容项
 * - 提供数值平衡调整的诊断和验证功能
 */
import type { ValuationWeights } from '@/core/balance/valuationKernel';
import { DEFAULT_VALUATION_WEIGHTS, calculateCardStaticEVU, calculateRelicStaticEVU } from '@/core/balance/valuationKernel';
import type { CompiledCardProfile, CompiledRelicProfile, CompiledEventOptionProfile, CompiledEnemyIntentProfile } from '@/core/balance/numericProfileCompiler';
import type { RuntimeCoefficients } from '@/core/balance/runtimeCoefficients';
import { DEFAULT_RUNTIME_COEFFICIENTS, calculateDamage } from '@/core/balance/runtimeCoefficients';

export interface WeightChangeImpact {
  weightKey: string;
  oldValue: number;
  newValue: number;
  affectedCards: Array<{ id: string; oldEVU: number; newEVU: number; delta: number }>;
  affectedRelics: Array<{ id: string; oldEVU: number; newEVU: number; delta: number }>;
  affectedEvents: Array<{ id: string; oldEVU: number; newEVU: number; delta: number }>;
  affectedEnemies: Array<{ id: string; oldPressure: number; newPressure: number; delta: number }>;
}

export interface NumericDiagnosticReport {
  timestamp: string;
  weightImpacts: WeightChangeImpact[];
  summary: {
    totalCardsAffected: number;
    totalRelicsAffected: number;
    totalEventsAffected: number;
    totalEnemiesAffected: number;
    averageEVUShift: number;
    maxEVUShift: number;
  };
}

export function analyzeWeightChange(
  weightKey: keyof ValuationWeights,
  newValue: number,
  currentWeights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS,
  cards: Array<{ id: string; cost: number; rarity: string; type: string; damage?: number; block?: number; draw?: number; heal?: number }> = [],
  relics: Array<{ id: string; rarity: string; effects: any[] }> = []
): WeightChangeImpact {
  const oldValue = currentWeights[weightKey];
  const newWeights: ValuationWeights = { ...currentWeights, [weightKey]: newValue };

  const affectedCards = cards.map(card => {
    const oldEVU = calculateCardStaticEVU({
      cost: card.cost,
      rarity: card.rarity,
      type: card.type,
      damage: card.damage,
      block: card.block,
      draw: card.draw,
      heal: card.heal,
    }, currentWeights);

    const newEVU = calculateCardStaticEVU({
      cost: card.cost,
      rarity: card.rarity,
      type: card.type,
      damage: card.damage,
      block: card.block,
      draw: card.draw,
      heal: card.heal,
    }, newWeights);

    return { id: card.id, oldEVU, newEVU, delta: newEVU - oldEVU };
  }).filter(c => Math.abs(c.delta) > 0.01);

  const affectedRelics = relics.map(relic => {
    const oldEVU = calculateRelicStaticEVU({ effects: relic.effects }, currentWeights);
    const newEVU = calculateRelicStaticEVU({ effects: relic.effects }, newWeights);
    return { id: relic.id, oldEVU, newEVU, delta: newEVU - oldEVU };
  }).filter(r => Math.abs(r.delta) > 0.01);

  return {
    weightKey,
    oldValue,
    newValue,
    affectedCards,
    affectedRelics,
    affectedEvents: [],
    affectedEnemies: [],
  };
}

export interface BalanceReport {
  cards: {
    total: number;
    byRarity: Record<string, { count: number; avgEVU: number; minEVU: number; maxEVU: number }>;
    outliers: Array<{ id: string; evu: number; reason: string }>;
  };
  relics: {
    total: number;
    byRarity: Record<string, { count: number; avgEVU: number; minEVU: number; maxEVU: number }>;
    outliers: Array<{ id: string; evu: number; reason: string }>;
  };
  enemies: {
    total: number;
    byChapter: Record<number, { count: number; avgPressure: number; maxPressure: number }>;
    outliers: Array<{ id: string; pressure: number; reason: string }>;
  };
}

export function generateBalanceReport(
  cardProfiles: CompiledCardProfile[],
  relicProfiles: CompiledRelicProfile[],
  enemyProfiles: CompiledEnemyIntentProfile[]
): BalanceReport {
  const cardByRarity: Record<string, { count: number; totalEVU: number; minEVU: number; maxEVU: number }> = {};

  for (const card of cardProfiles) {
    if (!cardByRarity[card.rarity]) {
      cardByRarity[card.rarity] = { count: 0, totalEVU: 0, minEVU: Infinity, maxEVU: -Infinity };
    }
    cardByRarity[card.rarity].count++;
    cardByRarity[card.rarity].totalEVU += card.totalEVU;
    cardByRarity[card.rarity].minEVU = Math.min(cardByRarity[card.rarity].minEVU, card.totalEVU);
    cardByRarity[card.rarity].maxEVU = Math.max(cardByRarity[card.rarity].maxEVU, card.totalEVU);
  }

  const cardOutliers: Array<{ id: string; evu: number; reason: string }> = [];
  for (const card of cardProfiles) {
    const rarityStats = cardByRarity[card.rarity];
    if (rarityStats) {
      const avgEVU = rarityStats.totalEVU / rarityStats.count;
      const threshold = avgEVU * 1.5;
      if (card.totalEVU > threshold) {
        cardOutliers.push({ id: card.id, evu: card.totalEVU, reason: `EVU ${card.totalEVU.toFixed(2)} > 1.5x average for ${card.rarity}` });
      } else if (card.totalEVU < avgEVU * 0.5) {
        cardOutliers.push({ id: card.id, evu: card.totalEVU, reason: `EVU ${card.totalEVU.toFixed(2)} < 0.5x average for ${card.rarity}` });
      }
    }
  }

  const relicByRarity: Record<string, { count: number; totalEVU: number; minEVU: number; maxEVU: number }> = {};
  for (const relic of relicProfiles) {
    if (!relicByRarity[relic.rarity]) {
      relicByRarity[relic.rarity] = { count: 0, totalEVU: 0, minEVU: Infinity, maxEVU: -Infinity };
    }
    relicByRarity[relic.rarity].count++;
    relicByRarity[relic.rarity].totalEVU += relic.totalEVU;
    relicByRarity[relic.rarity].minEVU = Math.min(relicByRarity[relic.rarity].minEVU, relic.totalEVU);
    relicByRarity[relic.rarity].maxEVU = Math.max(relicByRarity[relic.rarity].maxEVU, relic.totalEVU);
  }

  const enemyByChapter: Record<number, { count: number; totalPressure: number; maxPressure: number }> = {};
  for (const enemy of enemyProfiles) {
    const chapter = 1;
    if (!enemyByChapter[chapter]) {
      enemyByChapter[chapter] = { count: 0, totalPressure: 0, maxPressure: 0 };
    }
    enemyByChapter[chapter].count++;
    enemyByChapter[chapter].totalPressure += enemy.pressureEVU;
    enemyByChapter[chapter].maxPressure = Math.max(enemyByChapter[chapter].maxPressure, enemy.pressureEVU);
  }

  return {
    cards: {
      total: cardProfiles.length,
      byRarity: Object.fromEntries(
        Object.entries(cardByRarity).map(([rarity, stats]) => [
          rarity,
          { count: stats.count, avgEVU: stats.totalEVU / stats.count, minEVU: stats.minEVU, maxEVU: stats.maxEVU },
        ])
      ),
      outliers: cardOutliers,
    },
    relics: {
      total: relicProfiles.length,
      byRarity: Object.fromEntries(
        Object.entries(relicByRarity).map(([rarity, stats]) => [
          rarity,
          { count: stats.count, avgEVU: stats.totalEVU / stats.count, minEVU: stats.minEVU, maxEVU: stats.maxEVU },
        ])
      ),
      outliers: [],
    },
    enemies: {
      total: enemyProfiles.length,
      byChapter: Object.fromEntries(
        Object.entries(enemyByChapter).map(([chapter, stats]) => [
          chapter,
          { count: stats.count, avgPressure: stats.totalPressure / stats.count, maxPressure: stats.maxPressure },
        ])
      ),
      outliers: [],
    },
  };
}

export interface CoefficientValidationResult {
  valid: boolean;
  issues: Array<{ coefficient: string; issue: string; value: number }>;
}

export function validateRuntimeCoefficients(
  coefficients: RuntimeCoefficients = DEFAULT_RUNTIME_COEFFICIENTS
): CoefficientValidationResult {
  const issues: Array<{ coefficient: string; issue: string; value: number }> = [];

  if (coefficients.damage.weakMultiplier <= 0 || coefficients.damage.weakMultiplier >= 1) {
    issues.push({ coefficient: 'damage.weakMultiplier', issue: 'Should be between 0 and 1 (exclusive)', value: coefficients.damage.weakMultiplier });
  }

  if (coefficients.damage.vulnerableMultiplier <= 1) {
    issues.push({ coefficient: 'damage.vulnerableMultiplier', issue: 'Should be greater than 1', value: coefficients.damage.vulnerableMultiplier });
  }

  if (coefficients.softCaps.damageSoftCap <= 0) {
    issues.push({ coefficient: 'softCaps.damageSoftCap', issue: 'Should be positive', value: coefficients.softCaps.damageSoftCap });
  }

  if (coefficients.softCaps.damageSoftCapRetention < 0 || coefficients.softCaps.damageSoftCapRetention > 1) {
    issues.push({ coefficient: 'softCaps.damageSoftCapRetention', issue: 'Should be between 0 and 1', value: coefficients.softCaps.damageSoftCapRetention });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function simulateDamageScenario(
  baseDamage: number,
  scenarios: Array<{
    name: string;
    strength?: number;
    weak?: boolean;
    vulnerable?: boolean;
    block?: number;
  }>,
  coefficients: RuntimeCoefficients = DEFAULT_RUNTIME_COEFFICIENTS
): Array<{ name: string; result: ReturnType<typeof calculateDamage> }> {
  return scenarios.map(scenario => ({
    name: scenario.name,
    result: calculateDamage({
      baseDamage,
      strength: scenario.strength,
      weak: scenario.weak,
      vulnerable: scenario.vulnerable,
      targetBlock: scenario.block,
    }, coefficients),
  }));
}

export const numericDiagnostics = {
  analyzeWeightChange,
  generateBalanceReport,
  validateRuntimeCoefficients,
  simulateDamageScenario,
};

export default numericDiagnostics;
