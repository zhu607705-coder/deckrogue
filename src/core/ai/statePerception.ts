/**
 * @file statePerception.ts
 * @description 状态感知系统 - 从战斗状态提取玩家和敌人的状态快照
 *
 * 主要职责:
 * - 提取 PlayerStatusSnapshot，包含 HP%、能量、状态效果、遗物共鸣等信息
 * - 提取 EnemyStatusSnapshot 包含敌人意图、HP、波段信息
 * - 实现 assessCombatSituation 评估战斗整体局势
 * - 为 AI 系统提供可量化的状态数据
 */
import type { CombatState } from '@/core/types/combat';

type CombatPlayerState = CombatState['player'];
type CombatEnemyState = CombatState['enemies'][number];

export interface ActiveResonance {
  setId: string;
  count: number;
  isActive: boolean;
}

export interface PlayerStatusSnapshot {
  hpPercent: number;
  maxHp: number;
  block: number;
  energy: number;
  statuses: Record<string, number>;
  hasVulnerable: boolean;
  hasWeak: boolean;
  hasFrail: boolean;
  hasPoison: boolean;
  hasStealth: boolean;
  hasIntel: boolean;
  hasCorruption: boolean;
  hasDevotion: boolean;
  relicResonances: string[];
  dangerousRelicCombos: string[];
  hasResonanceBonus: boolean;
}

export interface EnemyStatusSnapshot {
  hpPercent: number;
  maxHp: number;
  block: number;
  statuses: Record<string, number>;
  remainingIntents: string[];
  lastUsedIntent: string | null;
  cooldowns: Record<string, number>;
}

export interface CombatSituationAssessment {
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  opportunityLevel: 'low' | 'medium' | 'high';
  recommendedStrategy: 'aggressive' | 'defensive' | 'balanced' | 'evasive';
  suggestedIntentBias: number;
}

export function extractPlayerStatus(playerState: any): PlayerStatusSnapshot {
  const statuses = playerState.statuses || {};

  return {
    hpPercent: playerState.maxHp > 0 ? playerState.hp / playerState.maxHp : 1,
    maxHp: playerState.maxHp || 0,
    block: playerState.block || 0,
    energy: playerState.energy || 0,
    statuses: { ...statuses },
    hasVulnerable: (statuses['Vulnerable'] || 0) > 0,
    hasWeak: (statuses['Weak'] || 0) > 0,
    hasFrail: (statuses['Frail'] || 0) > 0,
    hasPoison: (statuses['Poison'] || 0) > 0,
    hasStealth: (statuses['Stealth'] || 0) > 0,
    hasIntel: (statuses['Intel'] || 0) > 0 || (playerState.intel || 0) > 0,
    hasCorruption: (playerState.corruption || 0) > 0 || (statuses['Corruption'] || 0) > 0,
    hasDevotion: (playerState.devotion || 0) > 0 || (statuses['Devotion'] || 0) > 0,
    relicResonances: [],
    dangerousRelicCombos: [],
    hasResonanceBonus: false
  };
}

export function extractEnemyStatus(enemyState: any): EnemyStatusSnapshot {
  const statuses = enemyState.statuses || {};
  const cooldowns = enemyState.intentCooldowns || {};

  return {
    hpPercent: enemyState.maxHp > 0 ? enemyState.hp / enemyState.maxHp : 1,
    maxHp: enemyState.maxHp || 0,
    block: enemyState.block || 0,
    statuses: { ...statuses },
    remainingIntents: [],
    lastUsedIntent: enemyState.lastUsedIntent || null,
    cooldowns: { ...cooldowns }
  };
}

export function extractResonanceStatus(
  playerState: any,
  resonances: ActiveResonance[]
): {
  relicResonances: string[];
  dangerousRelicCombos: string[];
  hasResonanceBonus: boolean;
} {
  return {
    relicResonances: resonances.map(r => r.setId),
    dangerousRelicCombos: [],
    hasResonanceBonus: resonances.length > 0
  };
}

export function assessCombatSituation(
  player: PlayerStatusSnapshot,
  enemies: EnemyStatusSnapshot[]
): CombatSituationAssessment {
  const threatLevel = calculateThreatLevel(player, enemies);
  const opportunityLevel = calculateOpportunityLevel(player, enemies);
  const recommendedStrategy = determineRecommendedStrategy(player, enemies, threatLevel, opportunityLevel);
  const suggestedIntentBias = calculateIntentBias(player, enemies, recommendedStrategy);

  return {
    threatLevel,
    opportunityLevel,
    recommendedStrategy,
    suggestedIntentBias
  };
}

function calculateThreatLevel(
  player: PlayerStatusSnapshot,
  enemies: EnemyStatusSnapshot[]
): 'low' | 'medium' | 'high' | 'critical' {
  let threatScore = 0;

  if (player.hpPercent < 0.25) {
    threatScore += 3;
  } else if (player.hpPercent < 0.5) {
    threatScore += 2;
  } else if (player.hpPercent < 0.75) {
    threatScore += 1;
  }

  if (player.hasVulnerable) {
    threatScore += 2;
  }

  if (player.hasFrail && player.block <= 0) {
    threatScore += 1.5;
  }

  const aliveEnemies = enemies.filter(e => e.hpPercent > 0);
  let totalDamagePotential = 0;
  let attackingEnemies = 0;

  for (const enemy of aliveEnemies) {
    if (enemy.hpPercent > 0) {
      if (enemy.lastUsedIntent === 'Attack' || enemy.lastUsedIntent?.includes('Attack')) {
        attackingEnemies++;
      }

      const enemyThreatWeight = 1 - enemy.hpPercent;
      totalDamagePotential += enemyThreatWeight;
    }
  }

  threatScore += attackingEnemies * 1.5;

  if (aliveEnemies.length > 1) {
    threatScore += 1;
  }

  if (aliveEnemies.length >= 3) {
    threatScore += 1.5;
  }

  const totalEnemyHpPercent = aliveEnemies.reduce((sum, e) => sum + e.hpPercent, 0);
  if (totalEnemyHpPercent < 0.3 && aliveEnemies.length > 0) {
    threatScore += 2;
  }

  if (threatScore >= 7) return 'critical';
  if (threatScore >= 5) return 'high';
  if (threatScore >= 2) return 'medium';
  return 'low';
}

function calculateOpportunityLevel(
  player: PlayerStatusSnapshot,
  enemies: EnemyStatusSnapshot[]
): 'low' | 'medium' | 'high' {
  let opportunityScore = 0;

  const aliveEnemies = enemies.filter(e => e.hpPercent > 0);
  if (aliveEnemies.length === 0) return 'high';

  const weakEnemies = aliveEnemies.filter(e => e.hpPercent < 0.5);
  opportunityScore += weakEnemies.length * 1.5;

  const stunnedOrWeakenedEnemies = aliveEnemies.filter(e =>
    (e.statuses['Weak'] || 0) > 0 ||
    (e.statuses['Stunned'] || 0) > 0
  );
  opportunityScore += stunnedOrWeakenedEnemies.length * 2;

  if (player.energy > 2) {
    opportunityScore += 1;
  }

  if (player.hasIntel) {
    opportunityScore += 1.5;
  }

  if (player.block > 0) {
    opportunityScore += 0.5;
  }

  const avgEnemyHp = aliveEnemies.reduce((sum, e) => sum + e.hpPercent, 0) / aliveEnemies.length;
  if (avgEnemyHp > 0.8) {
    opportunityScore -= 1;
  }

  if (opportunityScore >= 5) return 'high';
  if (opportunityScore >= 2) return 'medium';
  return 'low';
}

function determineRecommendedStrategy(
  player: PlayerStatusSnapshot,
  enemies: EnemyStatusSnapshot[],
  threatLevel: 'low' | 'medium' | 'high' | 'critical',
  opportunityLevel: 'low' | 'medium' | 'high'
): 'aggressive' | 'defensive' | 'balanced' | 'evasive' {
  if (player.hpPercent < 0.2) {
    return 'evasive';
  }

  if (threatLevel === 'critical') {
    if (player.hasVulnerable || player.hasFrail) {
      return 'evasive';
    }
    return 'defensive';
  }

  if (threatLevel === 'high') {
    if (player.block <= 0 && player.hpPercent < 0.5) {
      return 'defensive';
    }
    if (opportunityLevel === 'high' && player.block > 0) {
      return 'aggressive';
    }
    return 'balanced';
  }

  if (opportunityLevel === 'high' && player.block > 0) {
    return 'aggressive';
  }

  if (opportunityLevel === 'low' && threatLevel === 'low') {
    return 'balanced';
  }

  if (player.block <= 0 && !player.hasVulnerable && !player.hasFrail) {
    return 'defensive';
  }

  return 'balanced';
}

function calculateIntentBias(
  player: PlayerStatusSnapshot,
  enemies: EnemyStatusSnapshot[],
  strategy: 'aggressive' | 'defensive' | 'balanced' | 'evasive'
): number {
  let bias = 0;

  switch (strategy) {
    case 'aggressive':
      bias = 0.8;
      break;
    case 'defensive':
      bias = -0.6;
      break;
    case 'evasive':
      bias = -1.0;
      break;
    case 'balanced':
      bias = 0;
      break;
  }

  if (player.hasVulnerable) {
    bias -= 0.3;
  }

  if (player.hasWeak) {
    bias += 0.2;
  }

  const aliveEnemies = enemies.filter(e => e.hpPercent > 0);
  const lowHpEnemies = aliveEnemies.filter(e => e.hpPercent < 0.3);
  if (lowHpEnemies.length > 0) {
    bias += 0.4;
  }

  if (player.energy >= 3) {
    bias += 0.2;
  }

  return Math.max(-1, Math.min(1, bias));
}
