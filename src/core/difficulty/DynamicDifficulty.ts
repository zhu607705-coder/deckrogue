import type { CombatState } from '@/core/types/combat';
import { clamp } from '@/core/utils/numberBounds';

export interface DifficultyProfile {
  baseDifficulty: number;
  currentDifficulty: number;
  adjustmentFactor: number;
  playerPerformance: PlayerPerformanceMetrics;
  nextAdjustment: 'increase' | 'decrease' | 'maintain';
  adjustmentMagnitude: number;
}

export interface PlayerPerformanceMetrics {
  recentWinRate: number;
  averageCombatTurns: number;
  avgDamageTakenPerTurn: number;
  avgEffectiveDamage: number;
  relicCount: number;
  healthPercentRemaining: number;
}

export interface RunSummary {
  outcome: 'victory' | 'defeat' | 'ongoing';
  avgCombatTurns: number;
  floorsCleared: number;
  relics: string[];
}

export const DIFFICULTY_TIERS = {
  casual: { min: 0, max: 0.5, label: 'Casual' },
  standard: { min: 0.5, max: 0.8, label: 'Standard' },
  challenging: { min: 0.8, max: 1.0, label: 'Challenging' },
  brutal: { min: 1.0, max: 1.3, label: 'Brutal' }
} as const;

export const DIFFICULTY_BOUNDS = {
  min: 0.5,
  max: 1.5
} as const;

const PERFORMANCE_WEIGHTS = {
  winRateImportance: 0.4,
  combatSpeedImportance: 0.2,
  damageEfficiencyImportance: 0.25,
  survivalImportance: 0.15
};

const OPTIMAL_COMBAT_TURNS = 8;
const COMBAT_TURN_TOLERANCE = 5;

export function calculatePerformanceMetrics(
  recentRuns: RunSummary[],
  currentCombat: CombatState | null
): PlayerPerformanceMetrics {
  const completedRuns = recentRuns.filter(r => r.outcome !== 'ongoing');

  if (completedRuns.length === 0) {
    const defaultMetrics: PlayerPerformanceMetrics = {
      recentWinRate: 0.5,
      averageCombatTurns: OPTIMAL_COMBAT_TURNS,
      avgDamageTakenPerTurn: 5,
      avgEffectiveDamage: 10,
      relicCount: 3,
      healthPercentRemaining: 0.7
    };

    if (currentCombat) {
      return calculateCurrentCombatMetrics(currentCombat, defaultMetrics);
    }

    return defaultMetrics;
  }

  const wins = completedRuns.filter(r => r.outcome === 'victory').length;
  const recentWinRate = wins / completedRuns.length;

  const totalCombatTurns = completedRuns.reduce((sum, r) => sum + r.avgCombatTurns, 0);
  const averageCombatTurns = totalCombatTurns / completedRuns.length;

  const avgRelicCount = completedRuns.reduce((sum, r) => sum + r.relics.length, 0) / completedRuns.length;

  const metrics: PlayerPerformanceMetrics = {
    recentWinRate,
    averageCombatTurns,
    avgDamageTakenPerTurn: 5,
    avgEffectiveDamage: 10,
    relicCount: avgRelicCount,
    healthPercentRemaining: 0.5
  };

  if (currentCombat) {
    return calculateCurrentCombatMetrics(currentCombat, metrics);
  }

  return metrics;
}

function calculateCurrentCombatMetrics(
  currentCombat: CombatState,
  baseMetrics: PlayerPerformanceMetrics
): PlayerPerformanceMetrics {
  const playerHpPercent = currentCombat.player.hp / currentCombat.player.maxHp;

  const totalEnemyHp = currentCombat.enemies.reduce((sum, e) => sum + e.maxHp, 0);
  const currentTotalEnemyHp = currentCombat.enemies.reduce((sum, e) => sum + e.hp, 0);
  const damageDealtToEnemies = totalEnemyHp - currentTotalEnemyHp;

  const turnsElapsed = Math.max(1, currentCombat.turn);
  const avgDamagePerTurn = damageDealtToEnemies / turnsElapsed;

  const avgDamageTaken = (currentCombat.player.maxHp - currentCombat.player.hp) / turnsElapsed;

  return {
    ...baseMetrics,
    averageCombatTurns: turnsElapsed,
    avgDamageTakenPerTurn: avgDamageTaken,
    avgEffectiveDamage: avgDamagePerTurn,
    healthPercentRemaining: playerHpPercent
  };
}

export function calculateDifficultyAdjustment(
  currentProfile: DifficultyProfile,
  metrics: PlayerPerformanceMetrics
): { newDifficulty: number; adjustmentReason: string } {
  let score = 0;
  const reasons: string[] = [];

  if (metrics.recentWinRate > 0.7) {
    score += PERFORMANCE_WEIGHTS.winRateImportance;
    reasons.push('High win rate');
  } else if (metrics.recentWinRate < 0.3) {
    score -= PERFORMANCE_WEIGHTS.winRateImportance;
    reasons.push('Low win rate');
  }

  const turnDeviation = Math.abs(metrics.averageCombatTurns - OPTIMAL_COMBAT_TURNS);
  if (turnDeviation > COMBAT_TURN_TOLERANCE) {
    if (metrics.averageCombatTurns > OPTIMAL_COMBAT_TURNS) {
      score -= PERFORMANCE_WEIGHTS.combatSpeedImportance;
      reasons.push('Combat too slow');
    } else {
      score += PERFORMANCE_WEIGHTS.combatSpeedImportance;
      reasons.push('Combat very fast');
    }
  }

  const expectedDamageRatio = metrics.avgEffectiveDamage / Math.max(1, metrics.avgDamageTakenPerTurn);
  if (expectedDamageRatio > 2) {
    score += PERFORMANCE_WEIGHTS.damageEfficiencyImportance;
    reasons.push('High damage efficiency');
  } else if (expectedDamageRatio < 0.5) {
    score -= PERFORMANCE_WEIGHTS.damageEfficiencyImportance;
    reasons.push('Low damage efficiency');
  }

  if (metrics.healthPercentRemaining > 0.8) {
    score += PERFORMANCE_WEIGHTS.survivalImportance;
    reasons.push('High survivability');
  } else if (metrics.healthPercentRemaining < 0.3) {
    score -= PERFORMANCE_WEIGHTS.survivalImportance;
    reasons.push('Low survivability');
  }

  const baseAdjustment = score * currentProfile.adjustmentFactor;

  const adjustmentMagnitude = Math.abs(baseAdjustment);
  let direction: 'increase' | 'decrease' | 'maintain' = 'maintain';
  if (baseAdjustment > 0.01) {
    direction = 'increase';
  } else if (baseAdjustment < -0.01) {
    direction = 'decrease';
  }

  const newDifficulty = clamp(
    currentProfile.currentDifficulty + baseAdjustment,
    DIFFICULTY_BOUNDS
  );

  const adjustmentReason = reasons.length > 0
    ? reasons.join(', ')
    : 'No significant performance change';

  return {
    newDifficulty,
    adjustmentReason
  };
}

export function applyDifficultyToCombat(
  difficulty: number,
  baseDamage: number,
  baseHp: number,
  baseIntentWeight: number
): { damage: number; hp: number; intentWeight: number } {
  const damageMultiplier = 0.7 + (difficulty * 0.6);
  const hpMultiplier = 0.8 + (difficulty * 0.4);
  const intentMultiplier = 0.6 + (difficulty * 0.8);

  return {
    damage: Math.round(baseDamage * damageMultiplier),
    hp: Math.round(baseHp * hpMultiplier),
    intentWeight: Math.round(baseIntentWeight * intentMultiplier)
  };
}

export function createInitialDifficultyProfile(): DifficultyProfile {
  return {
    baseDifficulty: 1.0,
    currentDifficulty: 1.0,
    adjustmentFactor: 0.05,
    playerPerformance: {
      recentWinRate: 0.5,
      averageCombatTurns: OPTIMAL_COMBAT_TURNS,
      avgDamageTakenPerTurn: 5,
      avgEffectiveDamage: 10,
      relicCount: 0,
      healthPercentRemaining: 1.0
    },
    nextAdjustment: 'maintain',
    adjustmentMagnitude: 0
  };
}

export function getDifficultyTier(difficulty: number): string {
  for (const [tierName, tier] of Object.entries(DIFFICULTY_TIERS)) {
    if (difficulty >= tier.min && difficulty < tier.max) {
      return tier.label;
    }
  }

  if (difficulty < DIFFICULTY_TIERS.casual.max) {
    return DIFFICULTY_TIERS.casual.label;
  }
  return DIFFICULTY_TIERS.brutal.label;
}

export function shouldAdjustDifficulty(profile: DifficultyProfile, turnsPlayed: number): boolean {
  if (turnsPlayed < 10) {
    return false;
  }

  const adjustmentThreshold = 5;
  const turnsSinceLastAdjustment = turnsPlayed % adjustmentThreshold;

  return turnsSinceLastAdjustment === 0;
}
