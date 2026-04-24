#!/usr/bin/env npx tsx
/**
 * @file test-ai-features.ts
 * @description AI-enhanced system feature tests including intent, memory, risk assessment, and difficulty.
 *
 * 主要职责:
 * - 测试意图选择器的行为
 * - 测试战斗记忆系统
 * - 测试风险评估算法
 * - 测试动态难度调整
 */

import { intentSelector } from '../src/core/ai/intentSelector';
import { combatMemory } from '../src/core/ai/combatMemory';
import { extractPlayerStatus, extractEnemyStatus, assessCombatSituation } from '../src/core/ai/statePerception';
import { calculateSurvivalRisk, calculateAggressionRisk, assessEnemyRisk } from '../src/core/ai/riskAssessment';
import { calculateIntentDistribution, detectIntentConflicts } from '../src/core/ai/groupCoordination';
import { AdaptiveBossAI, ADAPTATION_THRESHOLDS } from '../src/core/ai/AdaptiveBossAI';
import { calculatePerformanceMetrics, calculateDifficultyAdjustment, createInitialDifficultyProfile } from '../src/core/difficulty/DynamicDifficulty';
import { detectActiveResonances, RESONANCE_SETS } from '../src/core/relic/RelicResonance';
import { peekPlayerHand, swapPlayerCards, detectCardManipulation } from '../src/core/combat/CardManipulation';
import { HandKnowledgeSystemImpl, handKnowledgeSystem } from '../src/core/ai/handKnowledge';
import { checkOutcomeCondition } from '../src/core/narrative/BranchingOutcomes';

console.log('========================================');
console.log('AI增强系统 - 功能验证测试');
console.log('========================================\n');

// 测试计数器
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

// ============ Phase 1: AI基础测试 ============
console.log('\n--- Phase 1: AI基础系统测试 ---\n');

// 测试1: 意图选择器基础功能
test('意图选择器 - 基础意图选择', () => {
  const enemyDef = {
    id: 'test_enemy',
    name: 'Test Enemy',
    intent_policy: [
      { intent: 'Attack', weight: 3 },
      { intent: 'Defend', weight: 2 },
      { intent: 'Buff', weight: 1 }
    ]
  };

  const enemyState = {
    id: 'enemy1',
    hp: 50,
    maxHp: 100,
    block: 0,
    statuses: {} as Record<string, number>,
    lastUsedIntent: '',
    intentCooldowns: {} as Record<string, number>
  };

  const playerState = {
    hp: 70,
    maxHp: 100,
    block: 0,
    energy: 3,
    statuses: {}
  };

  const intent = intentSelector.selectIntent(enemyDef, enemyState, playerState, 1, Math.random);
  return ['Attack', 'Defend', 'Buff'].includes(intent);
});

// 测试2: 状态感知 - 玩家状态提取
test('状态感知 - 玩家状态提取', () => {
  const playerState = {
    hp: 70,
    maxHp: 100,
    block: 10,
    energy: 3,
    statuses: { Vulnerable: 1, Weak: 0 }
  };

  const status = extractPlayerStatus(playerState as any);

  return (
    status.hpPercent === 0.7 &&
    status.hasVulnerable === true &&
    status.hasWeak === false &&
    status.block === 10
  );
});

// 测试3: 状态感知 - 战斗形势评估
test('状态感知 - 战斗形势评估', () => {
  const playerStatus = {
    hpPercent: 0.5,
    maxHp: 100,
    block: 5,
    energy: 3,
    statuses: {},
    hasVulnerable: false,
    hasWeak: false,
    hasFrail: false,
    hasPoison: false,
    hasStealth: false,
    hasIntel: false,
    hasCorruption: false,
    hasDevotion: false,
    relicResonances: [],
    dangerousRelicCombos: [],
    hasResonanceBonus: false
  };

  const enemyStatus = {
    hpPercent: 0.8,
    maxHp: 100,
    block: 0,
    statuses: {} as Record<string, number>,
    remainingIntents: ['Attack'],
    lastUsedIntent: null,
    cooldowns: {} as Record<string, number>
  };

  const assessment = assessCombatSituation(playerStatus, [enemyStatus as any]);

  return (
    ['low', 'medium', 'high', 'critical'].includes(assessment.threatLevel) &&
    ['aggressive', 'defensive', 'balanced', 'evasive'].includes(assessment.recommendedStrategy)
  );
});

// 测试4: 风险评估 - 生存风险计算
test('风险评估 - 生存风险计算', () => {
  const risk1 = calculateSurvivalRisk(0.9, 0, 15);
  const risk2 = calculateSurvivalRisk(0.3, 0, 15);
  const risk3 = calculateSurvivalRisk(0.3, 20, 10);

  return risk1 < risk2 && risk3 < risk2;
});

// 测试5: 风险评估 - 综合风险评估
test('风险评估 - 综合风险评估', () => {
  const risk = assessEnemyRisk(0.5, 0, 0.7, 0, {}, 10, 15, false);

  return (
    typeof risk.survivalRisk === 'number' &&
    typeof risk.aggressionRisk === 'number' &&
    typeof risk.defensiveRisk === 'number' &&
    typeof risk.overallRisk === 'number' &&
    risk.overallRisk >= 0 &&
    risk.overallRisk <= 1
  );
});

// 测试6: 群体协调 - 意图分配
test('群体协调 - 意图分配计算', () => {
  const enemies = [{ nextIntent: 'Attack' }, { nextIntent: 'Defend' }];
  const playerStatus = { hp: 50, maxHp: 100, block: 0, energy: 3, statuses: {} };

  const dist = calculateIntentDistribution(enemies as any[], playerStatus);

  const total = dist.attackWeight + dist.defendWeight + dist.debuffWeight + dist.buffWeight + dist.specialWeight;

  return Math.abs(total - 1.0) < 0.01;
});

// 测试7: 群体协调 - 冲突检测
test('群体协调 - 意图冲突检测', () => {
  const conflict1 = detectIntentConflicts('Attack', ['Attack', 'Attack'], 2);
  const conflict2 = detectIntentConflicts('Attack', ['Defend', 'Buff'], 2);

  return conflict1 === true && conflict2 === false;
});

// 测试8: 战斗记忆 - 记录动作
test('战斗记忆 - 记录动作', () => {
  combatMemory.clear();

  combatMemory.recordAction({
    turn: 1,
    actor: 'player',
    damageDealt: 10,
    playerHpBefore: 100,
    playerHpAfter: 100
  });

  const patterns = combatMemory.analyzePlayerPatterns();

  return patterns.aggressivePlaysInLastTurns === 1;
});

// ============ Phase 2: Boss适应测试 ============
console.log('\n--- Phase 2: Boss适应系统测试 ---\n');

// 测试9: Boss适应AI - 玩家风格识别
test('Boss适应AI - 玩家风格识别', () => {
  const bossAI = new AdaptiveBossAI();

  const aggressivePatterns = {
    aggressivePlaysInLastTurns: 8,
    defensivePlaysInLastTurns: 2,
    averageCardsPerTurn: 4,
    averageDamageDealtPerTurn: 15,
    averageBlockGainedPerTurn: 2,
    prefersAggression: true,
    vulnerableToBurst: true,
    cardUsageFrequency: {},
    blockTimingPreference: 'late' as const,
    damageFocus: 'single' as const,
    statusEffectAwareness: 'high' as const
  };

  const playerType = bossAI.identifyPlayerType(aggressivePatterns);

  return playerType === 'aggressive';
});

// 测试10: Boss适应AI - 反制策略生成
test('Boss适应AI - 反制策略生成', () => {
  const bossAI = new AdaptiveBossAI();

  const patterns = {
    aggressivePlaysInLastTurns: 5,
    defensivePlaysInLastTurns: 3,
    averageCardsPerTurn: 4,
    averageDamageDealtPerTurn: 10,
    averageBlockGainedPerTurn: 5,
    prefersAggression: false,
    vulnerableToBurst: false,
    cardUsageFrequency: {},
    blockTimingPreference: 'early' as const,
    damageFocus: 'balanced' as const,
    statusEffectAwareness: 'medium' as const
  };

  const strategy = bossAI.generateCounterStrategy('aggressive', patterns);

  return strategy.type === 'burst' && strategy.effectiveness > 0;
});

// 测试11: Boss适应AI - 档案管理
test('Boss适应AI - 档案管理', () => {
  const bossAI = new AdaptiveBossAI();

  const profile1 = bossAI.getOrCreateProfile('boss1');
  const profile2 = bossAI.getOrCreateProfile('boss1');

  return profile1 === profile2 && profile1.enemyId === 'boss1';
});

// ============ Phase 3: 卡牌操控测试 ============
console.log('\n--- Phase 3: 卡牌操控系统测试 ---\n');

// 测试12: 卡牌操控 - 手牌窥视
test('卡牌操控 - 手牌窥视', () => {
  const hand = [
    { id: 'strike', name: 'Strike' },
    { id: 'defend', name: 'Defend' },
    { id: 'bash', name: 'Bash' }
  ];

  const knowledge = peekPlayerHand(hand as any[], 'test_source', 1);

  return knowledge.knownCards.length >= 1 && knowledge.knownCards.length <= 3;
});

// 测试13: 卡牌操控 - 卡牌交换
test('卡牌操控 - 卡牌交换', () => {
  const hand = [
    { id: 'strike', name: 'Strike' },
    { id: 'defend', name: 'Defend' }
  ];
  const discardPile: any[] = [];

  const result = swapPlayerCards(hand as any[], discardPile, 0, 1);

  // 交换后，手牌顺序交换，两张卡都被放入弃牌堆
  return (
    result.hand[0].id === 'defend' &&
    result.hand[1].id === 'strike' &&
    result.discardPile.length === 2
  );
});

// 测试14: AI预知 - 危险卡牌检测
test('AI预知 - 危险卡牌检测', () => {
  handKnowledgeSystem.resetKnowledge();

  const hand = [
    { id: 'strike', name: 'Strike' },
    { id: 'defend', name: 'Defend' },
    { id: 'heavy_strike', name: 'Heavy Strike' }
  ];

  handKnowledgeSystem.updateFromIntel(1, hand as any[]);

  const dangerousCount = handKnowledgeSystem.getDangerousCardCount();

  return dangerousCount >= 1;
});

// ============ Phase 4: 动态难度测试 ============
console.log('\n--- Phase 4: 动态难度系统测试 ---\n');

// 测试15: 动态难度 - 性能指标计算
test('动态难度 - 性能指标计算', () => {
  const recentRuns = [
    { outcome: 'victory' as const, avgCombatTurns: 8, floorsCleared: 15, relics: [] },
    { outcome: 'defeat' as const, avgCombatTurns: 10, floorsCleared: 10, relics: [] },
    { outcome: 'victory' as const, avgCombatTurns: 7, floorsCleared: 15, relics: [] }
  ];

  const metrics = calculatePerformanceMetrics(recentRuns as any[], null);

  return metrics.recentWinRate === 2/3;
});

// 测试16: 动态难度 - 难度调整
test('动态难度 - 难度调整', () => {
  const profile = createInitialDifficultyProfile();
  profile.playerPerformance.recentWinRate = 0.8;
  profile.playerPerformance.averageCombatTurns = 6;
  profile.playerPerformance.avgDamageTakenPerTurn = 3;
  profile.playerPerformance.avgEffectiveDamage = 12;
  profile.playerPerformance.relicCount = 5;
  profile.playerPerformance.healthPercentRemaining = 0.8;

  const result = calculateDifficultyAdjustment(profile, profile.playerPerformance);

  return typeof result.newDifficulty === 'number';
});

// ============ Phase 5: 遗物共鸣测试 ============
console.log('\n--- Phase 5: 遗物共鸣系统测试 ---\n');

// 测试17: 遗物共鸣 - 共鸣检测(2件激活)
test('遗物共鸣 - 共鸣检测(部分匹配)', () => {
  const relics = ['mark_of_chaos', 'bag_of_prep'];

  // detectActiveResonances 只返回完全匹配的套装
  const resonances = detectActiveResonances(relics);

  // 'mark_of_chaos' 只匹配 warp_trio，但缺少其他两件，所以返回空
  return resonances.length === 0;
});

// 测试18: 遗物共鸣 - 共鸣检测(3件完全激活)
test('遗物共鸣 - 共鸣检测(3件激活)', () => {
  // 使用实际存在的组合: tech_superiority
  const relics = ['lantern', 'ruined_reactor', 'anchor'];

  const resonances = detectActiveResonances(relics);

  // 完整匹配 tech_superiority 三件套
  return resonances.length === 1 && resonances[0].id === 'tech_superiority';
});

// 测试19: 遗物共鸣 - 无共鸣
test('遗物共鸣 - 无共鸣检测', () => {
  const relics = ['vajra', 'bag_of_prep'];

  const resonances = detectActiveResonances(relics);

  return resonances.length === 0;
});

// ============ Phase 6: 分支结局测试 ============
console.log('\n--- Phase 6: 分支结局系统测试 ---\n');

// 测试20: 分支结局 - HP阈值条件检测
test('分支结局 - HP阈值条件检测', () => {
  const condition = {
    type: 'hp_threshold' as const,
    params: { threshold: 50, target: 'enemy' },  // threshold 是 0-100 百分比
    comparison: 'lte' as const
  };

  const combatState = {
    turn: 1,
    player: { hp: 100, maxHp: 100 },
    enemies: [{ hp: 10, maxHp: 100 }]  // 10/100 = 10%
  };

  const result = checkOutcomeCondition(condition, combatState as any, [], []);

  // 敌人HP = 10% <= threshold 50%，应该返回 true
  return result === true;
});

// ============ 测试结果汇总 ============
console.log('\n========================================');
console.log('测试结果汇总');
console.log('========================================');
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`总计: ${passed + failed}`);
console.log('========================================\n');

if (failed === 0) {
  console.log('🎉 所有测试通过！AI增强系统功能验证成功！\n');
} else {
  console.log(`⚠️  有 ${failed} 个测试失败，请检查相关模块。\n`);
}

process.exit(failed > 0 ? 1 : 0);
