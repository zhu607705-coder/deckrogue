# AI增强与新系统机制实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现全面AI/敌人行为改进 + 新系统机制，按依赖关系顺序执行：AI基础 → Boss适应 → 卡牌操控 → 难度调整 → 共鸣 → 多结局

**Architecture:** 模块化设计，各系统独立实现后集成。AI基础系统采用实用主义（基于规则的启发式方法），确保稳定性和可调试性。

**Tech Stack:** TypeScript, React 19, Pixi.js, Python WASM Runtime

---

## 目录结构规划

```
src/core/ai/
├── intentSelector.ts      # [改进] 意图选择器 - 增强效用函数
├── intentTags.ts          # [已有] 意图标签系统
├── combatMemory.ts        # [已有] 战斗记忆系统 - 扩展记录
├── statePerception.ts     # [新建] 状态感知系统
├── groupCoordination.ts   # [新建] 群体协调系统
├── riskAssessment.ts      # [新建] 风险评估系统
├── AdaptiveBossAI.ts      # [新建] Boss适应AI系统
│
src/core/combat/
├── CombatManager.ts       # [已有] 战斗管理器 - 集成新AI
├── CardManipulation.ts    # [新建] 卡牌操控系统
│
src/core/difficulty/
├── DynamicDifficulty.ts   # [新建] 动态难度系统
│
src/core/relic/
├── RelicResonance.ts      # [新建] 遗物共鸣系统
│
src/core/narrative/
├── BranchingOutcomes.ts   # [新建] 分支结局系统
│
src/content/data/
├── bossPhases.json        # [已有] Boss阶段 - 扩展支持适应AI
├── enemies.json           # [已有] 敌人数据 - 添加新字段
```

---

## Phase 1: AI基础改进 (Tasks 1-5)

### Task 1: 状态感知系统 (State Perception)

**Files:**
- Create: `src/core/ai/statePerception.ts`
- Modify: `src/core/ai/intentSelector.ts:1-10` (imports)
- Test: 集成测试

- [ ] **Step 1: 创建状态感知系统基础接口**

```typescript
// src/core/ai/statePerception.ts
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
```

- [ ] **Step 2: 实现玩家状态快照提取**

```typescript
export function extractPlayerStatus(playerState: any): PlayerStatusSnapshot {
  return {
    hpPercent: playerState.maxHp > 0 ? playerState.hp / playerState.maxHp : 1,
    maxHp: playerState.maxHp,
    block: playerState.block || 0,
    energy: playerState.energy || 0,
    statuses: playerState.statuses || {},
    hasVulnerable: (playerState.statuses?.Vulnerable || 0) > 0,
    hasWeak: (playerState.statuses?.Weak || 0) > 0,
    hasFrail: (playerState.statuses?.Frail || 0) > 0,
    hasPoison: (playerState.statuses?.Poison || 0) > 0,
    hasStealth: (playerState.statuses?.Stealth || 0) > 0,
    hasIntel: (playerState.statuses?.Intel || 0) > 0,
    hasCorruption: (playerState.corruptionAxis || 0) > 0,
    hasDevotion: (playerState.devotion || 0) > 0
  };
}
```

- [ ] **Step 3: 实现敌人状态快照提取**

```typescript
export function extractEnemyStatus(enemyState: any): EnemyStatusSnapshot {
  return {
    hpPercent: enemyState.maxHp > 0 ? enemyState.hp / enemyState.maxHp : 1,
    maxHp: enemyState.maxHp,
    block: enemyState.block || 0,
    statuses: enemyState.statuses || {},
    remainingIntents: enemyState.nextIntent ? [enemyState.nextIntent] : [],
    lastUsedIntent: enemyState.lastUsedIntent || null,
    cooldowns: enemyState.intentCooldowns || {}
  };
}
```

- [ ] **Step 4: 实现战斗形势评估**

```typescript
export function assessCombatSituation(
  player: PlayerStatusSnapshot,
  enemies: EnemyStatusSnapshot[]
): CombatSituationAssessment {
  const totalEnemyHp = enemies.reduce((sum, e) => sum + e.hpPercent, 0) / Math.max(1, enemies.length);
  const threatLevel = calculateThreatLevel(player, enemies);
  const opportunityLevel = calculateOpportunityLevel(player, enemies);
  const recommendedStrategy = determineRecommendedStrategy(threatLevel, opportunityLevel, player);

  return {
    threatLevel,
    opportunityLevel,
    recommendedStrategy,
    suggestedIntentBias: calculateIntentBias(recommendedStrategy, player)
  };
}

function calculateThreatLevel(player: PlayerStatusSnapshot, enemies: EnemyStatusSnapshot[]): CombatSituationAssessment['threatLevel'] {
  if (player.hpPercent < 0.2) return 'critical';
  if (player.hpPercent < 0.4 || enemies.some(e => e.hpPercent > 0.8)) return 'high';
  if (player.hpPercent < 0.6) return 'medium';
  return 'low';
}

function calculateOpportunityLevel(player: PlayerStatusSnapshot, enemies: EnemyStatusSnapshot[]): CombatSituationAssessment['opportunityLevel'] {
  if (enemies.some(e => e.hpPercent < 0.2)) return 'high';
  if (player.hasVulnerable || player.hasWeak) return 'high';
  if (player.hpPercent > 0.8 && enemies.every(e => e.hpPercent < 0.5)) return 'medium';
  return 'low';
}

function determineRecommendedStrategy(
  threat: CombatSituationAssessment['threatLevel'],
  opportunity: CombatSituationAssessment['opportunityLevel'],
  player: PlayerStatusSnapshot
): CombatSituationAssessment['recommendedStrategy'] {
  if (threat === 'critical') return 'defensive';
  if (opportunity === 'high' && threat === 'low') return 'aggressive';
  if (threat === 'high') return 'balanced';
  return 'balanced';
}

function calculateIntentBias(strategy: CombatSituationAssessment['recommendedStrategy'], player: PlayerStatusSnapshot): number {
  const baseBias = strategy === 'aggressive' ? 0.3 : strategy === 'defensive' ? -0.3 : 0;
  if (player.hasVulnerable) return baseBias + 0.2;
  if (player.hasWeak) return baseBias + 0.1;
  return baseBias;
}
```

- [ ] **Step 5: 导出并集成到intentSelector**

```typescript
// src/core/ai/index.ts (新建)
export { extractPlayerStatus, extractEnemyStatus, assessCombatSituation } from './statePerception';
export type { PlayerStatusSnapshot, EnemyStatusSnapshot, CombatSituationAssessment } from './statePerception';
```

---

### Task 2: 群体协调系统 (Group Coordination)

**Files:**
- Create: `src/core/ai/groupCoordination.ts`
- Modify: `src/core/ai/intentSelector.ts` (集成)
- Test: 集成测试

- [ ] **Step 1: 创建群体协调接口**

```typescript
// src/core/ai/groupCoordination.ts
export interface GroupCoordinationState {
  totalIntentBudget: number;
  usedIntentBudget: Record<string, number>;
  recommendedIntentDistribution: IntentDistribution;
}

export interface IntentDistribution {
  attackWeight: number;
  defendWeight: number;
  debuffWeight: number;
  buffWeight: number;
  specialWeight: number;
}

export interface CoordinationResult {
  adjustedWeight: number;
  reason: string;
}
```

- [ ] **Step 2: 实现意图分配策略**

```typescript
export function calculateIntentDistribution(
  enemies: any[],
  playerStatus: PlayerStatusSnapshot
): IntentDistribution {
  let attackWeight = 0.4;
  let defendWeight = 0.2;
  let debuffWeight = 0.2;
  let buffWeight = 0.1;
  let specialWeight = 0.1;

  if (playerStatus.hasVulnerable) {
    attackWeight += 0.15;
    debuffWeight -= 0.1;
  }

  if (playerStatus.block > 0) {
    debuffWeight += 0.1;
    attackWeight -= 0.05;
  }

  if (playerStatus.hasFrail) {
    attackWeight += 0.1;
  }

  const total = attackWeight + defendWeight + debuffWeight + buffWeight + specialWeight;
  return {
    attackWeight: attackWeight / total,
    defendWeight: defendWeight / total,
    debuffWeight: debuffWeight / total,
    buffWeight: buffWeight / total,
    specialWeight: specialWeight / total
  };
}
```

- [ ] **Step 3: 实现意图冲突检测**

```typescript
export function detectIntentConflicts(
  currentEnemyIntent: string,
  otherEnemyIntents: string[],
  threshold: number = 2
): boolean {
  const similarCount = otherEnemyIntents.filter(
    other => areIntentsSimilar(currentEnemyIntent, other)
  ).length;
  return similarCount >= threshold;
}

function areIntentsSimilar(intentA: string, intentB: string): boolean {
  const intentLower = (s: string) => s.toLowerCase();
  const a = intentLower(intentA);
  const b = intentLower(intentB);

  if (a === b) return true;
  if (a.includes('attack') && b.includes('attack')) return true;
  if (a.includes('defend') && b.includes('defend')) return true;
  if (a.includes('multi') && b.includes('multi')) return true;
  if (a.includes('debuff') && b.includes('debuff')) return true;

  return false;
}
```

- [ ] **Step 4: 实现权重调整函数**

```typescript
export function adjustIntentWeightForGroup(
  baseWeight: number,
  intentCategory: string,
  distribution: IntentDistribution,
  hasConflict: boolean,
  enemyIndex: number
): CoordinationResult {
  let adjustedWeight = baseWeight;
  let reason = 'base';

  const targetWeight = distribution[intentCategory + 'Weight' as keyof IntentDistribution] || 0.2;
  const ratio = baseWeight / targetWeight;

  if (ratio > 1.5) {
    adjustedWeight *= 0.7;
    reason = 'overrepresented_category';
  } else if (ratio < 0.5) {
    adjustedWeight *= 1.3;
    reason = 'underrepresented_category';
  }

  if (hasConflict) {
    const otherEnemies = enemyIndex > 0 ? enemyIndex : 1;
    adjustedWeight *= Math.pow(0.8, otherEnemies);
    reason = 'intent_conflict';
  }

  return {
    adjustedWeight: Math.max(0, adjustedWeight),
    reason
  };
}
```

- [ ] **Step 5: 集成到CombatManager**

在 `CombatManager.startCombat` 中，为多个敌人计算协调分布：

```typescript
// 在 CombatManager.ts 中添加
import { calculateIntentDistribution, detectIntentConflicts, adjustIntentWeightForGroup } from '@/core/ai/groupCoordination';

// 在 generateEnemies 返回后添加协调状态
private calculateGroupCoordination(enemies: any[], playerStatus: any) {
  const distribution = calculateIntentDistribution(enemies, playerStatus);
  const otherEnemies: string[] = [];

  return enemies.map((enemy, index) => {
    const currentIntent = enemy.nextIntent || 'Attack';
    const hasConflict = detectIntentConflicts(currentIntent, otherEnemies);
    otherEnemies.push(currentIntent);

    return {
      ...enemy,
      coordinationData: {
        distribution,
        hasConflict,
        adjustedByGroup: hasConflict
      }
    };
  });
}
```

---

### Task 3: 风险评估系统 (Risk Assessment)

**Files:**
- Create: `src/core/ai/riskAssessment.ts`
- Modify: `src/core/ai/intentSelector.ts` (集成)
- Test: 集成测试

- [ ] **Step 1: 创建风险评估接口**

```typescript
// src/core/ai/riskAssessment.ts
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
```

- [ ] **Step 2: 实现生存风险计算**

```typescript
export function calculateSurvivalRisk(
  hpPercent: number,
  block: number,
  expectedDamageNextTurn: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): number {
  let risk = 0;

  if (hpPercent < thresholds.critical) {
    risk = 0.9;
  } else if (hpPercent < thresholds.high) {
    risk = 0.7;
  } else if (hpPercent < thresholds.medium) {
    risk = 0.4;
  } else {
    risk = 0.1;
  }

  const effectiveBlock = block / Math.max(1, expectedDamageNextTurn);
  if (effectiveBlock < 0.5) {
    risk = Math.min(1, risk + 0.2);
  }

  return Math.max(0, Math.min(1, risk));
}
```

- [ ] **Step 3: 实现攻击风险计算**

```typescript
export function calculateAggressionRisk(
  playerHpPercent: number,
  playerBlock: number,
  playerStatuses: Record<string, number>,
  targetEnemyHpPercent: number,
  canKillThisTurn: boolean
): number {
  let risk = 0;

  if (canKillThisTurn) {
    risk = 0.1;
  } else if (playerHpPercent < 0.3) {
    risk = 0.7;
  } else if (playerBlock > 0 && playerStatuses.Vulnerable > 0) {
    risk = 0.3;
  } else if (playerBlock > 0) {
    risk = 0.2;
  } else {
    risk = 0;
  }

  if (targetEnemyHpPercent < 0.2) {
    risk += 0.2;
  }

  return Math.max(0, Math.min(1, risk));
}
```

- [ ] **Step 4: 实现防御风险计算**

```typescript
export function calculateDefensiveRisk(
  currentBlock: number,
  expectedDamage: number,
  hpPercent: number,
  hasHealingOrShield: boolean
): number {
  let risk = 0;

  if (currentBlock >= expectedDamage) {
    risk = 0;
  } else {
    const damageThrough = expectedDamage - currentBlock;
    const hpDamageRatio = damageThrough / Math.max(1, hpPercent * 100);
    risk = Math.min(1, hpDamageRatio);
  }

  if (!hasHealingOrShield && hpPercent < 0.5) {
    risk = Math.min(1, risk + 0.2);
  }

  return Math.max(0, Math.min(1, risk));
}
```

- [ ] **Step 5: 实现综合风险评估**

```typescript
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
    expectedDamageToEnemy,
    DEFAULT_RISK_THRESHOLDS
  );

  const aggressionRisk = calculateAggressionRisk(
    playerHpPercent,
    playerBlock,
    playerStatuses,
    enemyHpPercent,
    canKillPlayer
  );

  const defensiveRisk = calculateDefensiveRisk(
    enemyBlock,
    expectedDamageToPlayer,
    enemyHpPercent,
    false
  );

  const overallRisk = (survivalRisk * 0.4 + aggressionRisk * 0.3 + defensiveRisk * 0.3);

  return {
    survivalRisk,
    aggressionRisk,
    defensiveRisk,
    overallRisk
  };
}
```

- [ ] **Step 6: 集成到intentSelector**

在效用函数中添加风险调整：

```typescript
// 在 intentSelector.ts 中添加
import { assessEnemyRisk } from './riskAssessment';

// 在 calculateUtility 中添加
if (intentTagger.hasTag(intent, 'aggressive')) {
  const risk = assessEnemyRisk(
    state.enemyHpPercent,
    state.enemyBlock,
    state.playerHpPercent,
    state.playerBlock,
    { Vulnerable: state.playerHasVulnerable ? 1 : 0, Weak: state.playerHasWeak ? 1 : 0 },
    10, // expectedDamageToEnemy
    15, // expectedDamageToPlayer
    false
  );

  if (risk.survivalRisk > 0.7) {
    utility += 0.25;
  }
}
```

---

### Task 4: 扩展战斗记忆系统 (Enhanced Combat Memory)

**Files:**
- Modify: `src/core/ai/combatMemory.ts` (扩展)
- Modify: `src/core/combat/CombatManager.ts` (集成记录)
- Test: 集成测试

- [ ] **Step 1: 扩展记录接口**

```typescript
// 在 combatMemory.ts 中添加
export interface EnhancedCombatActionRecord extends CombatActionRecord {
  handCards?: string[];
  deckSize?: number;
  discardSize?: number;
  energySpent?: number;
  energyRemaining?: number;
  blockStrategy?: 'early' | 'late' | 'none';
  damageStrategy?: 'focus' | 'spread' | 'balanced';
  relicTriggers?: string[];
  statusEffectTiming?: Record<string, number>;
}

export interface DetailedPlayerPatternAnalysis extends PlayerPatternAnalysis {
  cardUsageFrequency: Record<string, number>;
  blockTimingPreference: 'early' | 'late' | 'opportunistic';
  damageFocus: 'single' | 'multi' | 'balanced';
  statusEffectAwareness: 'low' | 'medium' | 'high';
  predictedNextPlay?: string;
}
```

- [ ] **Step 2: 添加手牌状态记录**

```typescript
public recordHandState(handCards: string[], energySpent: number, energyRemaining: number): void {
  this.currentHandState = {
    handCards: handCards.map(c => c),
    energySpent,
    energyRemaining,
    timestamp: Date.now()
  };
}
```

- [ ] **Step 3: 添加卡牌使用频率分析**

```typescript
public analyzeCardUsageFrequency(): Record<string, number> {
  const frequency: Record<string, number> = {};

  for (const record of this.records) {
    if (record.cardPlayed) {
      frequency[record.cardPlayed] = (frequency[record.cardPlayed] || 0) + 1;
    }
  }

  return frequency;
}

public getMostUsedCards(count: number = 5): string[] {
  const frequency = this.analyzeCardUsageFrequency();
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([card]) => card);
}
```

- [ ] **Step 4: 添加出牌时机分析**

```typescript
public analyzeBlockTiming(): 'early' | 'late' | 'opportunistic' {
  const blockRecords = this.records.filter(r => r.blockGained && r.blockGained > 0);

  if (blockRecords.length < 2) return 'opportunistic';

  let earlyBlocks = 0;
  let lateBlocks = 0;

  for (const record of blockRecords) {
    if (record.turn <= 3) {
      earlyBlocks++;
    } else {
      lateBlocks++;
    }
  }

  if (earlyBlocks > lateBlocks * 1.5) return 'early';
  if (lateBlocks > earlyBlocks * 1.5) return 'late';
  return 'opportunistic';
}
```

- [ ] **Step 5: 添加预测功能**

```typescript
public predictNextPlayerIntent(): string | null {
  const recentCards = this.getRecentRecords(3)
    .filter(r => r.cardPlayed)
    .map(r => r.cardPlayed);

  if (recentCards.length < 2) return null;

  const lastCard = recentCards[recentCards.length - 1];
  const secondLastCard = recentCards[recentCards.length - 2];

  if (lastCard === secondLastCard) {
    return lastCard;
  }

  const frequency = this.analyzeCardUsageFrequency();
  const mostUsed = this.getMostUsedCards(1)[0];

  return mostUsed || null;
}
```

- [ ] **Step 6: 在CombatManager中集成记录**

```typescript
// 在 CombatManager.ts 中添加记录调用
import { combatMemory } from '@/core/ai/combatMemory';

// 在玩家出牌后记录
combatMemory.recordAction({
  turn: state.combat!.turn,
  actor: 'player',
  cardPlayed: card.id,
  damageDealt: result.damage || 0,
  blockGained: result.block || 0,
  playerHpBefore: state.player.hp + result.damage || state.player.hp,
  playerHpAfter: state.player.hp,
  handCards: state.combat!.hand.map(c => c.id),
  energySpent: card.cost || 0,
  energyRemaining: state.combat!.player.energy
});
```

---

### Task 5: 意图选择器增强 (Enhanced Intent Selector)

**Files:**
- Modify: `src/core/ai/intentSelector.ts` (大幅改进)
- Test: TypeScript编译 + 集成测试

- [ ] **Step 1: 添加综合效用计算**

```typescript
// 在 IntentSelector 中添加
private calculateComprehensiveUtility(
  intent: string,
  state: CombatStateSnapshot,
  personality: PersonalityProfile,
  situation: CombatSituationAssessment,
  risk: RiskProfile,
  patterns: PlayerPatternAnalysis
): number {
  let utility = 0;

  utility += this.calculateStateBasedUtility(intent, state);
  utility += this.calculatePersonalityMatch(intent, personality);
  utility += this.calculateSituationMatch(intent, situation);
  utility += this.calculateRiskAdjustment(intent, risk);
  utility += this.calculatePatternMatch(intent, patterns);

  return utility;
}
```

- [ ] **Step 2: 实现状态基础效用**

```typescript
private calculateStateBasedUtility(intent: string, state: CombatStateSnapshot): number {
  let utility = 0;

  if (intentTagger.hasTag(intent, 'aggressive')) {
    if (state.playerHpPercent < 0.3) utility += 0.4;
    if (state.playerHasVulnerable) utility += 0.3;
    if (state.playerBlock > 0 && state.playerHasWeak) utility -= 0.2;
  }

  if (intentTagger.hasTag(intent, 'defensive')) {
    if (state.enemyHpPercent < 0.4) utility += 0.35;
    if (state.enemyBlock === 0) utility += 0.2;
  }

  if (intentTagger.hasTag(intent, 'setup') && state.turnNumber <= 2) {
    utility += 0.3;
  }

  return utility;
}
```

- [ ] **Step 3: 实现人格匹配效用**

```typescript
private calculatePersonalityMatch(intent: string, personality: PersonalityProfile): number {
  let utility = 0;

  const aggressionMatch = intentTagger.hasTag(intent, 'aggressive')
    ? personality.aggression
    : (1 - personality.aggression);

  const defensiveMatch = intentTagger.hasTag(intent, 'defensive')
    ? personality.defensiveness
    : (1 - personality.defensiveness);

  utility += (aggressionMatch - 0.5) * 0.4;
  utility += (defensiveMatch - 0.5) * 0.3;

  return utility;
}
```

- [ ] **Step 4: 实现形势匹配效用**

```typescript
private calculateSituationMatch(intent: string, situation: CombatSituationAssessment): number {
  let utility = 0;

  if (situation.recommendedStrategy === 'aggressive') {
    if (intentTagger.hasTag(intent, 'aggressive') || intentTagger.hasTag(intent, 'bursty')) {
      utility += 0.3;
    }
  }

  if (situation.recommendedStrategy === 'defensive') {
    if (intentTagger.hasTag(intent, 'defensive')) {
      utility += 0.3;
    }
  }

  if (situation.threatLevel === 'critical' && intentTagger.hasTag(intent, 'defensive')) {
    utility += 0.2;
  }

  return utility;
}
```

- [ ] **Step 5: 实现风险调整**

```typescript
private calculateRiskAdjustment(intent: string, risk: RiskProfile): number {
  let utility = 0;

  if (risk.survivalRisk > 0.7) {
    if (intentTagger.hasTag(intent, 'defensive') || intentTagger.hasTag(intent, 'healing')) {
      utility += 0.25;
    }
  }

  if (risk.aggressionRisk > 0.7 && intentTagger.hasTag(intent, 'aggressive')) {
    utility -= 0.2;
  }

  return utility;
}
```

- [ ] **Step 6: 实现模式匹配效用**

```typescript
private calculatePatternMatch(intent: string, patterns: PlayerPatternAnalysis): number {
  let utility = 0;

  if (patterns.vulnerableToBurst) {
    if (intentTagger.hasTag(intent, 'bursty')) {
      utility += 0.35;
    }
  }

  if (patterns.prefersAggression) {
    if (intentTagger.hasTag(intent, 'controlling')) {
      utility += 0.2;
    }
    if (intentTagger.hasTag(intent, 'defensive')) {
      utility += 0.15;
    }
  } else {
    if (intentTagger.hasTag(intent, 'aggressive')) {
      utility += 0.2;
    }
  }

  return utility;
}
```

- [ ] **Step 7: 更新selectIntent方法**

```typescript
public selectIntent(
  enemyDef: EnemyDef,
  enemyState: EnemyState,
  playerState: CombatPlayerState,
  turnNumber: number,
  rng: () => number,
  cooldowns: IntentCooldownState = {},
  personality?: PersonalityProfile,
  situation?: CombatSituationAssessment,
  risk?: RiskProfile,
  patterns?: PlayerPatternAnalysis
): string {
  if (!Array.isArray(enemyDef.intent_policy) || enemyDef.intent_policy.length === 0) {
    return 'Attack';
  }

  const personalityProfile = personality || this.getDefaultPersonality(enemyDef);
  const stateSnapshot = this.createStateSnapshot(playerState, enemyState, turnNumber, enemyState.lastUsedIntent || null);
  const situationAssessment = situation || assessCombatSituation(
    extractPlayerStatus(playerState),
    [extractEnemyStatus(enemyState)]
  );
  const riskProfile = risk || assessEnemyRisk(/* ... */);
  const playerPatterns = patterns || combatMemory.analyzePlayerPatterns();

  const options: IntentOption[] = enemyDef.intent_policy.map(policy => {
    const intent = policy.intent || 'Attack';
    const baseWeight = Math.max(0, Number(policy.weight) || 0);

    const cooldownPenalty = this.calculateCooldownPenalty(intent, cooldowns);
    const comprehensiveUtility = this.calculateComprehensiveUtility(
      intent, stateSnapshot, personalityProfile, situationAssessment, riskProfile, playerPatterns
    );
    const personalityBias = this.calculatePersonalityBias(intent, personalityProfile);

    const finalWeight = baseWeight * (1 - cooldownPenalty) * (1 + comprehensiveUtility) * (1 + personalityBias);

    return {
      intent,
      baseWeight,
      utilityScore: comprehensiveUtility,
      finalWeight: Math.max(0, finalWeight)
    };
  });

  // ... 选择逻辑保持不变
}
```

---

## Phase 2: Boss适应机制 (Tasks 6-8)

### Task 6: Boss适应AI核心 (Adaptive Boss AI Core)

**Files:**
- Create: `src/core/ai/AdaptiveBossAI.ts`
- Modify: `src/core/types/combat.ts` (添加字段)
- Test: 集成测试

- [ ] **Step 1: 创建适应AI接口**

```typescript
// src/core/ai/AdaptiveBossAI.ts
export interface AdaptationProfile {
  playerArchetype: 'aggressive' | 'defensive' | 'balanced' | 'unknown';
  adaptationLevel: number;
  learnedBehaviors: LearnedBehavior[];
  lastAdaptedTurn: number;
  counterStrategy: CounterStrategy;
}

export interface LearnedBehavior {
  trigger: string;
  response: string;
  effectiveness: number;
  timesUsed: number;
}

export interface CounterStrategy {
  type: 'punitive' | 'controlling' | 'defensive' | 'aggressive';
  targetCards: string[];
  targetBehaviors: string[];
  confidence: number;
}

export const ADAPTATION_THRESHOLDS = {
  minTurnsToAdapt: 4,
  effectivenessThreshold: 0.6,
  adaptationRate: 0.15
};
```

- [ ] **Step 2: 实现玩家风格识别**

```typescript
public identifyPlayerArchetype(patterns: DetailedPlayerPatternAnalysis): AdaptationProfile['playerArchetype'] {
  const { aggressivePlaysInLastTurns, defensivePlaysInLastTurns, damageStrategy } = patterns;

  const aggressionRatio = aggressivePlaysInLastTurns / Math.max(1, aggressivePlaysInLastTurns + defensivePlaysInLastTurns);

  if (aggressionRatio > 0.7) return 'aggressive';
  if (aggressionRatio < 0.3) return 'defensive';
  return 'balanced';
}
```

- [ ] **Step 3: 实现适应策略生成**

```typescript
public generateCounterStrategy(archetype: AdaptationProfile['playerArchetype']): CounterStrategy {
  switch (archetype) {
    case 'aggressive':
      return {
        type: 'punitive',
        targetCards: ['strike', 'defend'],
        targetBehaviors: ['high_damage'],
        confidence: 0.7
      };
    case 'defensive':
      return {
        type: 'controlling',
        targetCards: ['defend', 'block'],
        targetBehaviors: ['stalling'],
        confidence: 0.6
      };
    default:
      return {
        type: 'balanced',
        targetCards: [],
        targetBehaviors: [],
        confidence: 0.5
      };
  }
}
```

- [ ] **Step 4: 实现适应更新逻辑**

```typescript
public updateAdaptation(
  currentProfile: AdaptationProfile,
  combatResult: { intent: string; damageDealt: number; playerReacted: boolean },
  turnNumber: number
): AdaptationProfile {
  if (turnNumber - currentProfile.lastAdaptedTurn < ADAPTATION_THRESHOLDS.minTurnsToAdapt) {
    return currentProfile;
  }

  const effectiveness = combatResult.damageDealt > 0 ? 1 : 0;

  const existingBehavior = currentProfile.learnedBehaviors.find(
    b => b.trigger === combatResult.intent
  );

  if (existingBehavior) {
    existingBehavior.effectiveness = existingBehavior.effectiveness * 0.7 + effectiveness * 0.3;
    existingBehavior.timesUsed++;
  } else {
    currentProfile.learnedBehaviors.push({
      trigger: combatResult.intent,
      response: combatResult.intent,
      effectiveness,
      timesUsed: 1
    });
  }

  if (effectiveness > ADAPTATION_THRESHOLDS.effectivenessThreshold) {
    currentProfile.adaptationLevel = Math.min(1, currentProfile.adaptationLevel + ADAPTATION_THRESHOLDS.adaptationRate);
  }

  return {
    ...currentProfile,
    lastAdaptedTurn: turnNumber
  };
}
```

- [ ] **Step 5: 实现意图调整**

```typescript
public adjustIntentForAdaptation(
  baseIntent: string,
  adaptation: AdaptationProfile,
  rng: () => number
): string {
  if (adaptation.adaptationLevel < 0.3 || rng() > adaptation.adaptationLevel) {
    return baseIntent;
  }

  const strategy = adaptation.counterStrategy;

  if (strategy.type === 'punitive') {
    const intents = ['Retaliate', 'Counter', 'Defend', 'Attack'];
    return intents[Math.floor(rng() * intents.length)];
  }

  if (strategy.type === 'controlling') {
    const intents = ['Weaken', 'Vulnerable', 'Defend', 'Attack'];
    return intents[Math.floor(rng() * intents.length)];
  }

  return baseIntent;
}
```

---

### Task 7: Boss阶段适应集成 (Boss Phase Adaptation Integration)

**Files:**
- Modify: `src/core/combat/BossPhaseManager.ts`
- Modify: `src/content/data/bossPhases.json` (添加字段)
- Test: 集成测试

- [ ] **Step 1: 在BossPhaseManager中添加适应状态**

```typescript
// BossPhaseManager.ts 中添加
import { AdaptiveBossAI } from '@/core/ai/AdaptiveBossAI';

interface BossPhaseState {
  // ... existing fields
  adaptationProfile?: AdaptationProfile;
  adaptationEnabled: boolean;
}
```

- [ ] **Step 2: 实现阶段切换时的适应保留**

```typescript
// 在切换Boss阶段时保留适应状态
private transitionToPhase(
  enemy: any,
  newPhaseIndex: number,
  adaptationProfile?: AdaptationProfile
): void {
  // ... 现有逻辑

  if (adaptationProfile && this.adaptationEnabled) {
    this.updateBossState(enemy.id, {
      adaptationProfile,
      adaptationEnabled: true
    });
  }
}
```

- [ ] **Step 3: 在bossPhases.json中添加适应配置**

```json
{
  "boss_phases": [
    {
      "id": "boss_xxx_phase1",
      "adaptation_enabled": true,
      "adaptation_config": {
        "start_adapting_at_turn": 5,
        "adaptation_rate": 0.15,
        "max_adaptation_level": 0.8,
        "counter_strategy_type": "punitive"
      }
    }
  ]
}
```

---

### Task 8: Boss适应UI提示 (Boss Adaptation UI)

**Files:**
- Modify: `src/runtimeV2/scenes/CombatScene.tsx`
- Modify: `src/ui/views/combat/Battlefield.tsx`
- Test: UI测试

- [ ] **Step 1: 添加适应状态UI**

```typescript
// CombatScene.tsx 中添加
const [bossAdaptationLevel, setBossAdaptationLevel] = useState(0);

useEffect(() => {
  const updateAdaptationUI = () => {
    const bossEnemy = combatState?.enemies.find(e => e.defId?.includes('boss'));
    if (bossEnemy?.adaptationProfile?.adaptationLevel) {
      setBossAdaptationLevel(bossEnemy.adaptationProfile.adaptationLevel);
    }
  };

  updateAdaptationUI();
}, [combatState]);
```

- [ ] **Step 2: 渲染适应指示器**

```tsx
// Battlefield.tsx 中添加
{bossAdaptationLevel > 0 && (
  <div className="boss-adaptation-indicator">
    <span className="adaptation-label">BOSS ADAPTING</span>
    <div className="adaptation-bar">
      <div
        className="adaptation-fill"
        style={{ width: `${bossAdaptationLevel * 100}%` }}
      />
    </div>
  </div>
)}
```

---

## Phase 3: 卡牌操控/预知系统 (Tasks 9-11)

### Task 9: 卡牌操控系统核心 (Card Manipulation Core)

**Files:**
- Create: `src/core/combat/CardManipulation.ts`
- Modify: `src/core/actions/actionManager.ts`
- Test: 集成测试

- [ ] **Step 1: 创建卡牌操控接口**

```typescript
// src/core/combat/CardManipulation.ts
export interface CardManipulationEffect {
  type: 'peek' | 'swap' | 'steal' | 'discard' | 'return';
  targetCardIds: string[];
  source: 'enemy' | 'relic' | 'curse';
  description: string;
  canCounter: boolean;
}

export interface HandKnowledge {
  knownCards: string[];
  unknownIndices: number[];
  confidence: number;
}

export interface CardSwapResult {
  originalCard: string;
  swappedCard: string;
  reason: string;
}
```

- [ ] **Step 2: 实现手牌偷看**

```typescript
export function peekPlayerHand(
  hand: any[],
  source: string,
  intelLevel: number = 1
): HandKnowledge {
  const visibleCount = Math.min(hand.length, Math.ceil(hand.length * intelLevel));
  const visibleCards = hand.slice(0, visibleCount).map(c => c.id);

  return {
    knownCards: visibleCards,
    unknownIndices: hand.slice(visibleCount).map((_, i) => i + visibleCount),
    confidence: intelLevel
  };
}
```

- [ ] **Step 3: 实现手牌交换**

```typescript
export function swapPlayerCards(
  hand: any[],
  discardPile: any[],
  cardAIndex: number,
  cardBIndex: number
): { hand: any[]; discardPile: any[] } {
  const newHand = [...hand];
  const newDiscardPile = [...discardPile];

  const temp = newHand[cardAIndex];
  newHand[cardAIndex] = newHand[cardBIndex];
  newHand[cardBIndex] = temp;

  if (cardAIndex !== cardBIndex) {
    newDiscardPile.push(hand[cardAIndex]);
  }

  return { hand: newHand, discardPile: newDiscardPile };
}
```

- [ ] **Step 4: 实现卡牌操控检测**

```typescript
export function detectCardManipulation(
  previousHand: any[],
  currentHand: any[],
  combatLog: string[]
): CardManipulationEffect | null {
  const previousIds = previousHand.map(c => c.id).sort();
  const currentIds = currentHand.map(c => c.id).sort();

  if (JSON.stringify(previousIds) !== JSON.stringify(currentIds)) {
    const removed = previousIds.filter(id => !currentIds.includes(id));
    const added = currentIds.filter(id => !previousIds.includes(id));

    if (removed.length > 0 && added.length > 0) {
      return {
        type: 'swap',
        targetCardIds: removed,
        source: 'enemy',
        description: 'Enemy swapped your cards',
        canCounter: true
      };
    }

    if (removed.length > 0) {
      return {
        type: 'discard',
        targetCardIds: removed,
        source: 'enemy',
        description: 'Enemy discarded your cards',
        canCounter: true
      };
    }
  }

  return null;
}
```

---

### Task 10: AI预知能力 (AI Foreknowledge Ability)

**Files:**
- Modify: `src/core/ai/intentSelector.ts`
- Create: `src/core/ai/handKnowledge.ts`
- Test: 集成测试

- [ ] **Step 1: 创建手牌知识系统**

```typescript
// src/core/ai/handKnowledge.ts
export interface HandKnowledgeSystem {
  currentKnowledge: HandKnowledge;
  updateFromIntel(intelLevel: number, hand: any[]): void;
  predictPlayerActions(): string[];
  getBestCounterIntent(): string;
}
```

- [ ] **Step 2: 实现预知逻辑**

```typescript
export class HandKnowledgeSystem {
  private knowledge: HandKnowledge = { knownCards: [], unknownIndices: [], confidence: 0 };

  public updateFromIntel(intelLevel: number, hand: any[]): void {
    const peekResult = peekPlayerHand(hand, 'enemy_intel', intelLevel);
    this.knowledge = peekResult;
  }

  public predictPlayerActions(): string[] {
    const cardNames = this.knowledge.knownCards;
    const dangerousCards = cardNames.filter(name =>
      name.includes('attack') || name.includes('strike') || name.includes('damage')
    );
    return dangerousCards;
  }

  public getBestCounterIntent(): string {
    const dangerousActions = this.predictPlayerActions();

    if (dangerousActions.length > 0) {
      const intents = ['Defend', 'Block', 'Vulnerable', 'Counter'];
      return intents[Math.floor(Math.random() * intents.length)];
    }

    return 'Attack';
  }
}
```

- [ ] **Step 3: 集成到intentSelector**

```typescript
// 在 intentSelector.ts 中添加预知效用
private calculateForeknowledgeUtility(
  intent: string,
  handKnowledge: HandKnowledgeSystem
): number {
  let utility = 0;

  const dangerousActions = handKnowledge.predictPlayerActions();

  if (dangerousActions.length > 0 && intentTagger.hasTag(intent, 'defensive')) {
    utility += 0.25;
  }

  if (dangerousActions.length > 2 && intentTagger.hasTag(intent, 'controlling')) {
    utility += 0.2;
  }

  return utility;
}
```

---

### Task 11: 卡牌操控内容 (Card Manipulation Content)

**Files:**
- Modify: `src/content/data/enemies.json`
- Modify: `src/content/data/cards.json`
- Test: 内容测试

- [ ] **Step 1: 添加具有卡牌操控能力的敌人**

```json
// enemies.json 中添加
{
  "id": "psychic_infiltrator",
  "name": "Psychic Infiltrator",
  "keywords": ["elite", "psychic"],
  "intent_policy": [
    { "intent": "Mind Peek", "weight": 2 },
    { "intent": "Card Swap", "weight": 1.5 },
    { "intent": "Attack", "weight": 3 },
    { "intent": "Defend", "weight": 1 }
  ],
  "intel_level": 2,
  "can_manipulate_cards": true
}
```

- [ ] **Step 2: 添加卡牌操控相关卡牌/动作**

```json
// cards.json 中添加反制卡牌
{
  "id": "mental_shield",
  "name": "Mental Shield",
  "type": "Skill",
  "cost": 1,
  "effects": [
    { "type": "block", "value": 5 },
    { "type": "status_immunity", "duration": 2, "effect": "card_manipulation" }
  ]
}
```

---

## Phase 4: 动态难度调整 (Tasks 12-14)

### Task 12: 动态难度系统核心 (Dynamic Difficulty Core)

**Files:**
- Create: `src/core/difficulty/DynamicDifficulty.ts`
- Modify: `src/core/types/combat.ts`
- Test: 集成测试

- [ ] **Step 1: 创建难度系统接口**

```typescript
// src/core/difficulty/DynamicDifficulty.ts
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

export const DIFFICULTY_TIERS = {
  casual: { min: 0, max: 0.5, label: 'Casual' },
  standard: { min: 0.5, max: 0.8, label: 'Standard' },
  challenging: { min: 0.8, max: 1.0, label: 'Challenging' },
  brutal: { min: 1.0, max: 1.3, label: 'Brutal' }
};
```

- [ ] **Step 2: 实现性能指标计算**

```typescript
export function calculatePerformanceMetrics(
  recentRuns: RunSummary[],
  currentCombat: CombatState
): PlayerPerformanceMetrics {
  const completedRuns = recentRuns.filter(r => r.outcome !== 'ongoing');

  const winRate = completedRuns.length > 0
    ? completedRuns.filter(r => r.outcome === 'victory').length / completedRuns.length
    : 0.5;

  const avgCombatTurns = recentRuns.length > 0
    ? recentRuns.reduce((sum, r) => sum + r.avgCombatTurns, 0) / recentRuns.length
    : 10;

  return {
    recentWinRate: winRate,
    averageCombatTurns: avgCombatTurns,
    avgDamageTakenPerTurn: currentCombat ?
      calculateDamageTakenPerTurn(currentCombat) : 5,
    avgEffectiveDamage: 8,
    relicCount: currentCombat ? currentCombat.player.relics?.length || 0 : 0,
    healthPercentRemaining: currentCombat ?
      currentCombat.player.hp / currentCombat.player.maxHp : 1
  };
}

function calculateDamageTakenPerTurn(combat: CombatState): number {
  if (!combat || combat.turn === 0) return 0;
  const totalDamage = combat.turn * 5;
  return totalDamage / combat.turn;
}
```

- [ ] **Step 3: 实现难度调整算法**

```typescript
export function calculateDifficultyAdjustment(
  currentProfile: DifficultyProfile,
  metrics: PlayerPerformanceMetrics
): { newDifficulty: number; adjustmentReason: string } {
  const winRateDelta = metrics.recentWinRate - 0.5;
  const healthDelta = metrics.healthPercentRemaining - 0.5;
  const turnDelta = (metrics.averageCombatTurns - currentProfile.playerPerformance.averageCombatTurns) / 10;

  let adjustment = 0;
  let reasons: string[] = [];

  if (winRateDelta > 0.2) {
    adjustment += 0.1;
    reasons.push('High win rate');
  } else if (winRateDelta < -0.2) {
    adjustment -= 0.1;
    reasons.push('Low win rate');
  }

  if (healthDelta > 0.3 && winRateDelta > 0) {
    adjustment += 0.05;
    reasons.push('Too comfortable');
  }

  if (turnDelta > 0.5) {
    adjustment -= 0.05;
    reasons.push('Combat too slow');
  }

  const newDifficulty = Math.max(
    0.5,
    Math.min(1.5, currentProfile.currentDifficulty + adjustment)
  );

  return {
    newDifficulty,
    adjustmentReason: reasons.join(', ') || 'No change'
  };
}
```

- [ ] **Step 4: 实现战斗强度调整**

```typescript
export function applyDifficultyToCombat(
  difficulty: number,
  baseDamage: number,
  baseHp: number,
  baseIntentWeight: number
): { damage: number; hp: number; intentWeight: number } {
  const damageMultiplier = 0.8 + (difficulty * 0.4);
  const hpMultiplier = 0.8 + (difficulty * 0.3);
  const intentWeightBoost = (difficulty - 1) * 0.2;

  return {
    damage: Math.round(baseDamage * damageMultiplier),
    hp: Math.round(baseHp * hpMultiplier),
    intentWeight: baseIntentWeight * (1 + intentWeightBoost)
  };
}
```

---

### Task 13: 难度感知AI (Difficulty-Aware AI)

**Files:**
- Modify: `src/core/ai/intentSelector.ts`
- Modify: `src/core/ai/riskAssessment.ts`
- Test: 集成测试

- [ ] **Step 1: 添加难度到AI决策**

```typescript
// 在 intentSelector.ts 中添加
public selectIntent(
  // ... existing params
  difficultyModifier: number = 1.0
): string {
  // ... existing logic

  const situationAssessment = situation || assessCombatSituation(
    extractPlayerStatus(playerState),
    [extractEnemyStatus(enemyState)]
  );

  // 调整形势评估
  const adjustedSituation = {
    ...situationAssessment,
    threatLevel: adjustThreatForDifficulty(situationAssessment.threatLevel, difficultyModifier),
    opportunityLevel: adjustOpportunityForDifficulty(situationAssessment.opportunityLevel, difficultyModifier)
  };

  // ... continue with adjusted situation
}

function adjustThreatForDifficulty(
  threat: CombatSituationAssessment['threatLevel'],
  difficulty: number
): CombatSituationAssessment['threatLevel'] {
  if (difficulty > 1.2) {
    if (threat === 'medium') return 'high';
    if (threat === 'low') return 'medium';
  }
  if (difficulty < 0.8) {
    if (threat === 'high') return 'medium';
    if (threat === 'medium') return 'low';
  }
  return threat;
}
```

---

### Task 14: 难度系统持久化 (Difficulty Persistence)

**Files:**
- Modify: `src/core/persistence/saveManager.ts`
- Modify: `src/core/events/runSession.ts`
- Test: 集成测试

- [ ] **Step 1: 保存难度配置**

```typescript
// 在 SaveManager 中添加
interface SaveData {
  // ... existing fields
  difficultyProfile?: DifficultyProfile;
  recentRuns?: RunSummary[];
}

// 保存逻辑
public saveDifficultyProfile(profile: DifficultyProfile): void {
  this.saveData.difficultyProfile = profile;
  this.persist();
}

// 加载逻辑
public loadDifficultyProfile(): DifficultyProfile | null {
  return this.saveData.difficultyProfile || null;
}
```

---

## Phase 5: 遗物共鸣系统 (Tasks 15-17)

### Task 15: 遗物共鸣核心 (Relic Resonance Core)

**Files:**
- Create: `src/core/relic/RelicResonance.ts`
- Modify: `src/core/types/combat.ts`
- Test: 集成测试

- [ ] **Step 1: 创建共鸣系统接口**

```typescript
// src/core/relic/RelicResonance.ts
export interface ResonanceSet {
  id: string;
  relics: string[];
  bonus: ResonanceBonus;
  description: string;
}

export interface ResonanceBonus {
  type: 'passive' | 'triggered' | 'enhanced';
  effect: ResonanceEffect;
  stackable: boolean;
}

export interface ResonanceEffect {
  statBoost?: Record<string, number>;
  newAbility?: string;
  enhancedAbility?: string;
  combatModifier?: CombatModifier;
}

export interface ActiveResonance {
  setId: string;
  stacks: number;
  currentBonus: ResonanceBonus;
  triggerHistory: number[];
}

export const RESONANCE_SETS: ResonanceSet[] = [
  {
    id: 'warp_trio',
    relics: ['mark_of_chaos', 'heretics_metronome', 'nurgles_blessing'],
    bonus: {
      type: 'enhanced',
      effect: {
        combatModifier: {
          warpTideBoost: 10,
          damageBoost: 0.05
        }
      },
      stackable: false
    },
    description: 'Chaos Unleashed: Increased warp effects and damage'
  },
  {
    id: 'iron_guardian',
    relics: ['vajra', 'seal_of_defiance', 'zealots_chain'],
    bonus: {
      type: 'passive',
      effect: {
        statBoost: { block: 3, armor: 2 }
      },
      stackable: true
    },
    description: 'Impenetrable Defense: Gain block at start of combat'
  }
];
```

- [ ] **Step 2: 实现共鸣检测**

```typescript
export function detectActiveResonances(playerRelics: string[]): ActiveResonance[] {
  const activeResonances: ActiveResonance[] = [];

  for (const set of RESONANCE_SETS) {
    const matchingRelics = playerRelics.filter(r => set.relics.includes(r));

    if (matchingRelics.length >= 2) {
      activeResonances.push({
        setId: set.id,
        stacks: matchingRelics.length,
        currentBonus: set.bonus,
        triggerHistory: []
      });
    }
  }

  return activeResonances;
}
```

- [ ] **Step 3: 实现共鸣效果应用**

```typescript
export function applyResonanceBonuses(
  combatState: CombatState,
  resonances: ActiveResonance[]
): CombatState {
  let modifiedState = { ...combatState };

  for (const resonance of resonances) {
    const set = RESONANCE_SETS.find(s => s.id === resonance.setId);
    if (!set) continue;

    if (set.bonus.type === 'passive' && set.bonus.effect.statBoost) {
      modifiedState.player.block = (modifiedState.player.block || 0) +
        (set.bonus.effect.statBoost.block || 0) * resonance.stacks;
    }

    if (set.bonus.type === 'triggered') {
      resonance.triggerHistory.push(Date.now());
    }

    if (set.bonus.type === 'enhanced' && set.bonus.effect.combatModifier) {
      const mods = set.bonus.effect.combatModifier;
      if (mods.warpTideBoost) {
        modifiedState.warpTide = Math.min(100, modifiedState.warpTide + mods.warpTideBoost);
      }
    }
  }

  return modifiedState;
}
```

- [ ] **Step 4: 实现共鸣UI数据**

```typescript
export interface ResonanceUIState {
  activeResonances: {
    setId: string;
    relics: string[];
    stacks: number;
    description: string;
    isFullyActivated: boolean;
  }[];
}

export function getResonanceUIState(resonances: ActiveResonance[]): ResonanceUIState {
  return {
    activeResonances: resonances.map(r => {
      const set = RESONANCE_SETS.find(s => s.id === r.setId);
      return {
        setId: r.setId,
        relics: set?.relics || [],
        stacks: r.stacks,
        description: set?.description || '',
        isFullyActivated: r.stacks >= 3
      };
    })
  };
}
```

---

### Task 16: 遗物共鸣AI感知 (Relic Resonance AI Awareness)

**Files:**
- Modify: `src/core/ai/statePerception.ts`
- Modify: `src/core/ai/intentSelector.ts`
- Test: 集成测试

- [ ] **Step 1: 添加遗物感知到状态快照**

```typescript
// 在 PlayerStatusSnapshot 中添加
export interface PlayerStatusSnapshot {
  // ... existing fields
  relicResonances: ActiveResonance[];
  dangerousRelicCombos: string[];
}
```

- [ ] **Step 2: 在效用计算中考虑遗物共鸣**

```typescript
// 在 intentSelector.ts 中添加
private calculateRelicAwarenessUtility(
  intent: string,
  playerStatus: PlayerStatusSnapshot
): number {
  let utility = 0;

  if (playerStatus.dangerousRelicCombos.length > 0) {
    if (intentTagger.hasTag(intent, 'controlling')) {
      utility += 0.3;
    }
  }

  if (playerStatus.relicResonances.some(r => r.currentBonus.type === 'passive')) {
    utility += 0.1;
  }

  return utility;
}
```

---

### Task 17: 遗物共鸣内容配置 (Relic Resonance Content)

**Files:**
- Modify: `src/content/data/relics.json`
- Create: `src/core/relic/resonanceSets.ts`
- Test: 内容测试

- [ ] **Step 1: 添加更多共鸣组合**

```typescript
// src/core/relic/resonanceSets.ts
export const ADDITIONAL_RESONANCE_SETS: ResonanceSet[] = [
  {
    id: 'time_master',
    relics: ['warp_distorter', 'corrupted_tome', 'mechanicus_coolant'],
    bonus: {
      type: 'enhanced',
      effect: {
        combatModifier: {
          turnReduction: 1,
          extraAction: true
        }
      },
      stackable: false
    },
    description: 'Temporal Mastery: Extra action each turn'
  },
  {
    id: 'berserker_frenzy',
    relics: ['martyrs_censer', 'seal_of_martyrdom', 'corrupted_relic'],
    bonus: {
      type: 'triggered',
      effect: {
        enhancedAbility: 'damage_boost_low_hp'
      },
      stackable: true
    },
    description: 'Death Seeking: Massive damage boost when low HP'
  }
];
```

---

## Phase 6: 多重结局/分支战斗 (Tasks 18-20)

### Task 18: 分支结局系统核心 (Branching Outcomes Core)

**Files:**
- Create: `src/core/narrative/BranchingOutcomes.ts`
- Modify: `src/core/types/combat.ts`
- Modify: `src/content/data/bossPhases.json`
- Test: 集成测试

- [ ] **Step 1: 创建分支结局接口**

```typescript
// src/core/narrative/BranchingOutcomes.ts
export interface BranchingOutcome {
  id: string;
  triggerCondition: OutcomeCondition;
  combatModification: CombatModification;
  narrative: NarrativeEntry;
  availableChoices: OutcomeChoice[];
}

export interface OutcomeCondition {
  type: 'hp_threshold' | 'turn_count' | 'status_count' | 'action_sequence' | 'relic_owned';
  params: Record<string, any>;
  comparison: 'gte' | 'lte' | 'eq' | 'contains';
}

export interface CombatModification {
  enemyBehavior?: 'pacifist' | 'berserk' | 'negotiate' | 'transform';
  newEnemy?: string;
  removeEnemy?: string;
  addIntent?: string;
  modifyHp?: number;
}

export interface NarrativeEntry {
  title: string;
  description: string;
  flavorText: string;
  icon?: string;
}

export interface OutcomeChoice {
  id: string;
  label: string;
  description: string;
  requirements: OutcomeCondition[];
  result: {
    combatContinuation: boolean;
    reward?: RewardSpec;
    penalty?: RewardSpec;
    narrative: NarrativeEntry;
  };
}
```

- [ ] **Step 2: 实现条件检测**

```typescript
export function checkOutcomeCondition(
  condition: OutcomeCondition,
  combatState: CombatState,
  playerRelics: string[],
  combatHistory: CombatActionRecord[]
): boolean {
  switch (condition.type) {
    case 'hp_threshold':
      return checkHpThreshold(condition, combatState);
    case 'turn_count':
      return checkTurnCount(condition, combatState);
    case 'status_count':
      return checkStatusCount(condition, combatState);
    case 'relic_owned':
      return condition.params.relics.some((r: string) => playerRelics.includes(r));
    default:
      return false;
  }
}

function checkHpThreshold(condition: OutcomeCondition, state: CombatState): boolean {
  const hpPercent = state.player.hp / state.player.maxHp;
  const threshold = condition.params.threshold;

  switch (condition.comparison) {
    case 'gte': return hpPercent >= threshold;
    case 'lte': return hpPercent <= threshold;
    case 'eq': return Math.abs(hpPercent - threshold) < 0.01;
    default: return false;
  }
}
```

- [ ] **Step 3: 实现分支结果应用**

```typescript
export function applyOutcomeChoice(
  choice: OutcomeChoice,
  combatState: CombatState,
  context: GameState
): { combatState: CombatState; context: GameState; narrative: NarrativeEntry } {
  let newCombatState = { ...combatState };
  let newContext = { ...context };

  if (!choice.result.combatContinuation) {
    newContext.screen = 'Map';
    newContext.currentNodeId = null;
  }

  if (choice.result.reward) {
    applyReward(newContext, choice.result.reward);
  }

  if (choice.result.penalty) {
    applyPenalty(newContext, choice.result.penalty);
  }

  return {
    combatState: newCombatState,
    context: newContext,
    narrative: choice.result.narrative
  };
}
```

---

### Task 19: 分支战斗UI (Branching Combat UI)

**Files:**
- Modify: `src/runtimeV2/scenes/CombatScene.tsx`
- Create: `src/ui/views/combat/BranchingOutcomeModal.tsx`
- Test: UI测试

- [ ] **Step 1: 创建分支结局模态框**

```tsx
// src/ui/views/combat/BranchingOutcomeModal.tsx
import React from 'react';

interface BranchingOutcomeModalProps {
  outcome: BranchingOutcome;
  onSelectChoice: (choice: OutcomeChoice) => void;
  onDecline: () => void;
}

export function BranchingOutcomeModal({ outcome, onSelectChoice, onDecline }: BranchingOutcomeModalProps) {
  return (
    <div className="branching-outcome-modal">
      <div className="modal-content">
        <h2 className="outcome-title">{outcome.narrative.title}</h2>
        <p className="outcome-description">{outcome.narrative.description}</p>

        <div className="choice-list">
          {outcome.availableChoices.map(choice => (
            <button
              key={choice.id}
              className="outcome-choice-button"
              onClick={() => onSelectChoice(choice)}
            >
              <span className="choice-label">{choice.label}</span>
              <span className="choice-description">{choice.description}</span>
            </button>
          ))}
        </div>

        <button className="decline-button" onClick={onDecline}>
          Continue Combat
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 集成到CombatScene**

```tsx
// CombatScene.tsx 中添加
const [branchingOutcome, setBranchingOutcome] = useState<BranchingOutcome | null>(null);

useEffect(() => {
  const checkBranchingOutcomes = () => {
    const availableOutcomes = detectAvailableOutcomes(combatState, context);
    if (availableOutcomes.length > 0) {
      setBranchingOutcome(availableOutcomes[0]);
    }
  };

  checkBranchingOutcomes();
}, [combatState]);

{branchingOutcome && (
  <BranchingOutcomeModal
    outcome={branchingOutcome}
    onSelectChoice={handleOutcomeChoice}
    onDecline={() => setBranchingOutcome(null)}
  />
)}
```

---

### Task 20: 分支战斗内容配置 (Branching Combat Content)

**Files:**
- Create: `src/content/data/branchingOutcomes.json`
- Modify: `src/content/data/bossPhases.json`
- Test: 内容测试

- [ ] **Step 1: 创建分支结局配置**

```json
{
  "branching_outcomes": [
    {
      "id": "slime_mercy",
      "trigger_enemy": "slime_boss",
      "trigger_condition": {
        "type": "hp_threshold",
        "params": { "threshold": 0.1, "target": "enemy" },
        "comparison": "lte"
      },
      "narrative": {
        "title": "Slime's Desperate Plea",
        "description": "The Slime King oozes toward you, weakened and desperate...",
        "flavorText": "You could show mercy, or end its suffering."
      },
      "available_choices": [
        {
          "id": "accept_mercy",
          "label": "Show Mercy",
          "description": "Spare the slime and receive a blessing",
          "result": {
            "combat_continuation": false,
            "reward": { "type": "relic", "id": "slime_blessing" },
            "narrative": { "title": "Mercy Granted", "description": "The slime transforms into a helpful ally." }
          }
        },
        {
          "id": "finish_it",
          "label": "Finish It",
          "description": "End the slime's suffering",
          "result": {
            "combat_continuation": true,
            "narrative": { "title": "Merciful End", "description": "The slime dissolves peacefully." }
          }
        }
      ]
    }
  ]
}
```

---

## 任务依赖关系

```
Phase 1 (AI基础):
Task 1 (状态感知) ─┬─> Task 5 (意图选择器增强)
Task 2 (群体协调) ─┤
Task 3 (风险评估) ─┤
Task 4 (记忆扩展) ─┘

Phase 2 (Boss适应):
Task 6 (Boss适应AI) ← Task 5
Task 7 (Boss阶段集成) ← Task 6
Task 8 (Boss UI) ← Task 7

Phase 3 (卡牌操控):
Task 9 (操控核心) ← Task 5
Task 10 (AI预知) ← Task 9, Task 5
Task 11 (操控内容) ← Task 9

Phase 4 (动态难度):
Task 12 (难度核心) ← Task 4
Task 13 (难度AI) ← Task 12, Task 5
Task 14 (难度持久化) ← Task 12

Phase 5 (遗物共鸣):
Task 15 (共鸣核心) ← Task 4
Task 16 (共鸣AI) ← Task 15, Task 5
Task 17 (共鸣内容) ← Task 15

Phase 6 (分支结局):
Task 18 (结局核心) ← Task 5
Task 19 (结局UI) ← Task 18
Task 20 (结局内容) ← Task 18
```

---

## 验证清单

### Phase 1 - AI基础
- [ ] TypeScript 编译通过
- [ ] AI决策在战斗日志中可追踪
- [ ] 群体敌人意图不冲突
- [ ] 风险评估符合预期

### Phase 2 - Boss适应
- [ ] Boss能识别玩家风格
- [ ] 适应效果在UI中显示
- [ ] 阶段切换保留适应状态

### Phase 3 - 卡牌操控
- [ ] 手牌偷看正确显示
- [ ] 卡牌交换正确执行
- [ ] 操控检测准确

### Phase 4 - 动态难度
- [ ] 难度随玩家表现调整
- [ ] 难度变化在UI中可见
- [ ] 难度持久化正确

### Phase 5 - 遗物共鸣
- [ ] 共鸣检测正确
- [ ] 共鸣效果正确应用
- [ ] UI显示活跃共鸣

### Phase 6 - 分支结局
- [ ] 分支条件正确触发
- [ ] 选择结果正确应用
- [ ] 叙事内容正确显示

---

## 实施顺序建议

**方案B: 模块化并行型 - 依赖管理版**

由于任务之间存在依赖关系，建议以下实施顺序：

**第一轮 (并行，基础无依赖)**:
- Task 1, Task 2, Task 3, Task 4 (Phase 1基础模块)

**第二轮 (等待Task 1-4完成)**:
- Task 5 (Phase 1收尾，依赖所有基础模块)

**第三轮 (等待Task 5完成，可并行)**:
- Task 6, Task 9, Task 12, Task 15, Task 18 (Phase 2-6核心)

**第四轮 (依赖上一轮对应核心)**:
- Task 7, Task 10, Task 13, Task 16, Task 19

**第五轮 (依赖第四轮)**:
- Task 8, Task 11, Task 14, Task 17, Task 20

---

**Plan saved to:** `docs/superpowers/plans/2026-04-01-ai-enhanced-system.md`
