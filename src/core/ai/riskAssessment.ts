export interface RiskProfile {
  survivalRisk: number;
  aggressionRisk: number;
  defensiveRisk: number;
  overallRisk: number;
}

export interface RiskThresholds {
  critical: number;
  high: number;
  medium: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  critical: 0.8,
  high: 0.6,
  medium: 0.4
};

export function calculateSurvivalRisk(
  hpPercent: number,
  block: number,
  expectedDamageNextTurn: number,
  thresholds?: RiskThresholds
): number {
  const t = thresholds || DEFAULT_RISK_THRESHOLDS;
  const clampedHp = Math.max(0, Math.min(1, hpPercent));
  let baseRisk = 1 - clampedHp;

  if (expectedDamageNextTurn > 0) {
    const effectiveBlock = Math.min(block, expectedDamageNextTurn);
    const damageRatio = (expectedDamageNextTurn - effectiveBlock) / Math.max(1, expectedDamageNextTurn);
    const blockProtection = block / Math.max(1, expectedDamageNextTurn);
    baseRisk = Math.min(1, baseRisk + damageRatio * (1 - clampedHp) * 0.5);
    baseRisk = Math.max(0, baseRisk - blockProtection * 0.2);
  }

  if (clampedHp < t.critical) {
    baseRisk = Math.min(1, baseRisk + 0.15);
  } else if (clampedHp < t.high) {
    baseRisk = Math.min(1, baseRisk + 0.05);
  }

  return Math.max(0, Math.min(1, baseRisk));
}

export function calculateAggressionRisk(
  playerHpPercent: number,
  playerBlock: number,
  playerStatuses: Record<string, number>,
  targetEnemyHpPercent: number,
  canKillThisTurn: boolean
): number {
  let baseRisk = 0.5;

  const playerVulnerable = (playerStatuses?.Vulnerable || 0) > 0;
  const playerWeak = (playerStatuses?.Weak || 0) > 0;

  if (canKillThisTurn) {
    baseRisk = 0.2;
  } else if (playerHpPercent < 0.3) {
    baseRisk = 0.15;
  } else if (playerHpPercent < 0.5) {
    baseRisk = 0.3;
  }

  if (playerBlock > 0) {
    baseRisk = Math.min(1, baseRisk + 0.1);
  }

  if (playerVulnerable) {
    baseRisk = Math.min(1, baseRisk - 0.15);
  }

  if (playerWeak) {
    baseRisk = Math.min(1, baseRisk + 0.1);
  }

  if (targetEnemyHpPercent < 0.3) {
    baseRisk = Math.min(1, baseRisk + 0.15);
  } else if (targetEnemyHpPercent > 0.7) {
    baseRisk = Math.max(0, baseRisk - 0.1);
  }

  return Math.max(0, Math.min(1, baseRisk));
}

export function calculateDefensiveRisk(
  currentBlock: number,
  expectedDamage: number,
  hpPercent: number,
  hasHealingOrShield: boolean
): number {
  if (expectedDamage <= 0) {
    return 0.1;
  }

  const effectiveDamage = Math.max(0, expectedDamage - currentBlock);
  const damageRatio = effectiveDamage / expectedDamage;

  let baseRisk = damageRatio * 0.8;

  if (hpPercent < 0.3) {
    baseRisk = Math.min(1, baseRisk + 0.2);
  } else if (hpPercent < 0.5) {
    baseRisk = Math.min(1, baseRisk + 0.1);
  }

  if (hasHealingOrShield) {
    baseRisk = Math.max(0, baseRisk - 0.15);
  }

  if (currentBlock > expectedDamage) {
    baseRisk = Math.max(0, baseRisk - 0.2);
  }

  return Math.max(0, Math.min(1, baseRisk));
}

export function assessEnemyRisk(
  enemyHpPercent: number,
  enemyBlock: number,
  playerHpPercent: number,
  playerBlock: number,
  playerStatuses: Record<string, number>,
  expectedDamageToEnemy: number,
  expectedDamageToPlayer: number,
  canKillPlayer: boolean
): RiskProfile {
  const survivalRisk = calculateSurvivalRisk(
    enemyHpPercent,
    enemyBlock,
    expectedDamageToEnemy
  );

  const aggressionRisk = calculateAggressionRisk(
    playerHpPercent,
    playerBlock,
    playerStatuses,
    enemyHpPercent,
    false
  );

  const defensiveRisk = calculateDefensiveRisk(
    enemyBlock,
    expectedDamageToPlayer,
    enemyHpPercent,
    false
  );

  const overallRisk = (survivalRisk * 0.4 + aggressionRisk * 0.35 + defensiveRisk * 0.25);

  return {
    survivalRisk: Math.round(survivalRisk * 100) / 100,
    aggressionRisk: Math.round(aggressionRisk * 100) / 100,
    defensiveRisk: Math.round(defensiveRisk * 100) / 100,
    overallRisk: Math.round(overallRisk * 100) / 100
  };
}
