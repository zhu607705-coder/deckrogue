/**
 * @file intentSelector.ts
 * @description 意图选择器 - 综合多种因素为敌人选择最优意图
 *
 * 主要职责:
 * - 综合考虑状态感知、战斗记忆、风险评估、群体协作等因素选择意图
 * - 定义 EnemyDefBase 和 EnemyStateBase 接口，描述敌人定义和状态
 * - 定义 IntentCooldownState 接口，管理意图冷却
 * - 实现基于难度、性格、AI档案的意图选择策略
 */
import { intentTagger, type IntentCategory, type IntentTag } from '@/core/ai/intentTags';
import { combatMemory, type PlayerPatternAnalysis } from '@/core/ai/combatMemory';
import {
  extractPlayerStatus,
  extractEnemyStatus,
  assessCombatSituation,
  type PlayerStatusSnapshot,
  type EnemyStatusSnapshot,
  type CombatSituationAssessment
} from '@/core/ai/statePerception';
import {
  assessEnemyRisk,
  type RiskProfile,
  DEFAULT_RISK_THRESHOLDS
} from '@/core/ai/riskAssessment';
import {
  calculateIntentDistribution,
  detectIntentConflicts,
  adjustIntentWeightForGroup
} from '@/core/ai/groupCoordination';
import { applyDifficultyToCombat, type DifficultyProfile } from '@/core/difficulty/DynamicDifficulty';
import type { GameState, CombatState } from '@/core/types';
import type { EnemyAiPersonality, EnemyAiProfile, EnemyAntiStallProfile, EnemyIntentBiasRule } from '@/core/types/enemyAI';
import { normalizeIntentPolicyIntent, parseIntentPolicyWeight, resolveIntentPolicyList } from '@/core/ai/intentPolicy';

type CombatEnemyState = NonNullable<GameState['combat']>['enemies'][number];

export interface EnemyDefBase {
  id: string;
  keywords?: string[];
  intent_policy?: IntentPolicy[];
  intentPolicy?: IntentPolicy[];
  name?: string;
  ai_profile?: EnemyAiProfile;
}

export interface IntentPolicy {
  intent: string;
  weight?: number;
}

export interface EnemyStateBase {
  id: string;
  hp: number;
  maxHp: number;
  block?: number;
  statuses?: Record<string, number>;
  lastUsedIntent?: string | null;
  nonAttackIntentStreak?: number;
  parent?: { enemies?: CombatEnemyState[] };
}

export interface CombatPlayerStateBase {
  hp: number;
  maxHp: number;
  block?: number;
  energy?: number;
  statuses?: Record<string, number>;
}

type EnemyDef = EnemyDefBase;
type EnemyState = EnemyStateBase;
type CombatPlayerState = CombatPlayerStateBase;

export interface IntentOption {
  intent: string;
  baseWeight: number;
  utilityScore: number;
  finalWeight: number;
}

export interface CombatStateSnapshot {
  playerHpPercent: number;
  playerBlock: number;
  playerHasVulnerable: boolean;
  playerHasWeak: boolean;
  playerHasFrail: boolean;
  playerHp: number;
  playerMaxHp: number;
  playerEnergy: number;
  playerStatuses: Record<string, number>;
  enemyHpPercent: number;
  enemyBlock: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStatuses: Record<string, number>;
  turnNumber: number;
  lastUsedIntent: string | null;
  otherEnemiesCount: number;
  relicResonances: string[];
  dangerousRelicCombos: string[];
  hasResonanceBonus: boolean;
}

export type PersonalityProfile = EnemyAiPersonality;

export interface IntentCooldownState {
  [intent: string]: number;
}

export type { EnemyAiProfile, EnemyAntiStallProfile, EnemyIntentBiasRule };

export class IntentSelector {
  constructor() {}

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
    patterns?: PlayerPatternAnalysis,
    difficultyModifier?: number,
    relicResonances?: string[],
    dangerousRelicCombos?: string[]
  ): string {
    const intentPolicy = resolveIntentPolicyList(enemyDef);
    if (!Array.isArray(intentPolicy) || intentPolicy.length === 0) {
      return 'Attack';
    }

    const allEnemies = enemyState.parent?.enemies || [enemyState];
    const otherEnemies = allEnemies.filter((e: EnemyState) => e.id !== enemyState.id);

    const personalityProfile = personality || this.getDefaultPersonality(enemyDef);

    const playerSnapshot = extractPlayerStatus(playerState);
    const enemySnapshot = extractEnemyStatus(enemyState);

    const baseSituation = assessCombatSituation(
      playerSnapshot,
      [enemySnapshot]
    );

    const adjustedSituation = situation || (difficultyModifier !== undefined ? {
      ...baseSituation,
      threatLevel: this.adjustThreatForDifficulty(baseSituation.threatLevel, difficultyModifier),
      opportunityLevel: this.adjustOpportunityForDifficulty(baseSituation.opportunityLevel, difficultyModifier)
    } : baseSituation);

    const riskProfile = risk || assessEnemyRisk(
      enemySnapshot.hpPercent,
      enemySnapshot.block,
      playerSnapshot.hpPercent,
      playerSnapshot.block,
      playerSnapshot.statuses,
      0,
      0,
      false
    );

    const playerPatterns = patterns || combatMemory.analyzePlayerPatterns();

    const activeRelicResonances = relicResonances || [];
    const activeDangerousCombos = dangerousRelicCombos || [];

    const stateSnapshot = this.createStateSnapshot(
      playerState,
      enemyState,
      turnNumber,
      enemyState.lastUsedIntent || null,
      otherEnemies.length,
      activeRelicResonances,
      activeDangerousCombos
    );

    const distribution = calculateIntentDistribution(
      allEnemies,
      { hp: playerState.hp, maxHp: playerState.maxHp, block: playerState.block || 0, energy: playerState.energy || 0, statuses: playerState.statuses || {} }
    );

    const otherEnemyIntents = otherEnemies
      .map((e: EnemyState) => e.lastUsedIntent)
      .filter((i: string | null | undefined): i is string => i != null);

    const options: IntentOption[] = intentPolicy.map((policy: IntentPolicy) => {
      const intent = normalizeIntentPolicyIntent(policy.intent);
      const baseWeight = parseIntentPolicyWeight(policy.weight, enemyDef.id, intent);

      const cooldownPenalty = this.calculateCooldownPenalty(intent, cooldowns);

      const hasConflict = detectIntentConflicts(intent, otherEnemyIntents);
      const category = intentTagger.getIntentMetadata(intent).category;
      const coordination = adjustIntentWeightForGroup(baseWeight, category, distribution, hasConflict, 0);

      const comprehensiveUtility = this.calculateComprehensiveUtility(
        intent,
        stateSnapshot,
        personalityProfile,
        adjustedSituation,
        riskProfile,
        playerPatterns
      );

      const finalWeight = coordination.adjustedWeight
        * (1 - cooldownPenalty)
        * (1 + comprehensiveUtility);

      return {
        intent,
        baseWeight: coordination.adjustedWeight,
        utilityScore: comprehensiveUtility,
        finalWeight: Math.max(0, finalWeight)
      };
    });

    const totalWeight = options.reduce((sum, opt) => sum + opt.finalWeight, 0);
    if (totalWeight <= 0) {
      return this.selectZeroWeightFallback(options);
    }

    let roll = rng() * totalWeight;
    for (const option of options) {
      roll -= option.finalWeight;
      if (roll <= 0) {
        return option.intent;
      }
    }

    return options[0].intent;
  }

  private selectZeroWeightFallback(options: IntentOption[]): string {
    const attack = options.find(option => option.intent === 'Attack');
    if (attack) return attack.intent;

    const bestBase = options.reduce<IntentOption | null>((best, option) => {
      if (!best) return option;
      if (option.baseWeight > best.baseWeight) return option;
      return best;
    }, null);

    return bestBase?.intent || 'Attack';
  }

  private createStateSnapshot(
    playerState: CombatPlayerState,
    enemyState: EnemyState,
    turnNumber: number,
    lastUsedIntent: string | null,
    otherEnemiesCount: number,
    relicResonances: string[] = [],
    dangerousRelicCombos: string[] = []
  ): CombatStateSnapshot {
    const playerStatuses = playerState.statuses || {};
    const enemyStatuses = enemyState.statuses || {};

    return {
      playerHpPercent: playerState.maxHp > 0 ? playerState.hp / playerState.maxHp : 1,
      playerBlock: playerState.block || 0,
      playerHasVulnerable: (playerStatuses['Vulnerable'] || 0) > 0,
      playerHasWeak: (playerStatuses['Weak'] || 0) > 0,
      playerHasFrail: (playerStatuses['Frail'] || 0) > 0,
      playerHp: playerState.hp,
      playerMaxHp: playerState.maxHp,
      playerEnergy: playerState.energy || 0,
      playerStatuses,
      enemyHpPercent: enemyState.maxHp > 0 ? enemyState.hp / enemyState.maxHp : 1,
      enemyBlock: enemyState.block || 0,
      enemyHp: enemyState.hp,
      enemyMaxHp: enemyState.maxHp,
      enemyStatuses,
      turnNumber,
      lastUsedIntent,
      otherEnemiesCount,
      relicResonances,
      dangerousRelicCombos,
      hasResonanceBonus: relicResonances.length > 0
    };
  }

  private getDefaultPersonality(enemyDef: EnemyDef): PersonalityProfile {
    const keywords = (enemyDef.keywords || []).map((k: string) => k.toLowerCase());

    let aggression = 0.5;
    let defensiveness = 0.5;
    let unpredictability = 0.3;
    let revengefulness = 0.2;

    if (keywords.includes('boss')) {
      aggression = 0.8;
      unpredictability = 0.5;
    }
    if (keywords.includes('elite')) {
      aggression = 0.65;
      defensiveness = 0.4;
    }
    if (keywords.includes('tank') || keywords.includes('defender')) {
      defensiveness = 0.8;
      aggression = 0.3;
    }
    if (keywords.includes('berserker') || keywords.includes('frenzy')) {
      aggression = 0.95;
      defensiveness = 0.1;
      unpredictability = 0.6;
    }

    return {
      aggression,
      defensiveness,
      unpredictability,
      revengefulness
    };
  }

  private calculateCooldownPenalty(intent: string, cooldowns: IntentCooldownState): number {
    const remaining = cooldowns[intent] || 0;
    if (remaining <= 0) return 0;
    return Math.min(0.95, remaining * 0.25);
  }

  private calculateComprehensiveUtility(
    intent: string,
    state: CombatStateSnapshot,
    personality: PersonalityProfile,
    situation: CombatSituationAssessment,
    risk: RiskProfile,
    patterns: PlayerPatternAnalysis
  ): number {
    const stateUtility = this.calculateStateBasedUtility(intent, state);
    const personalityMatch = this.calculatePersonalityMatch(intent, personality);
    const situationMatch = this.calculateSituationMatch(intent, situation, state.turnNumber);
    const riskAdjustment = this.calculateRiskAdjustment(intent, risk);
    const patternMatch = this.calculatePatternMatch(intent, patterns);

    const totalUtility =
      stateUtility * 0.25 +
      personalityMatch * 0.15 +
      situationMatch * 0.25 +
      riskAdjustment * 0.20 +
      patternMatch * 0.15 +
      this.calculateRelicAwarenessUtility(intent, state) * 0.1;

    return Math.max(-0.8, Math.min(1.2, totalUtility));
  }

  private calculateRelicAwarenessUtility(
    intent: string,
    state: CombatStateSnapshot
  ): number {
    let utility = 0;

    if (state.dangerousRelicCombos.length > 0) {
      if (intentTagger.hasTag(intent, 'controlling')) {
        utility += 0.3;
      }
    }

    if (state.hasResonanceBonus) {
      if (intentTagger.hasTag(intent, 'aggressive')) {
        utility += 0.1;
      }
    }

    if (state.relicResonances.includes('warp_trio')) {
      if (intentTagger.hasTag(intent, 'aggressive')) {
        utility += 0.15;
      }
    }

    if (state.relicResonances.includes('iron_guardian')) {
      if (intentTagger.hasTag(intent, 'bursty')) {
        utility += 0.1;
      }
    }

    return utility;
  }

  private calculateStateBasedUtility(intent: string, state: CombatStateSnapshot): number {
    let utility = 0;

    if (intentTagger.hasTag(intent, 'aggressive')) {
      utility += 0.1;

      if (state.playerHpPercent < 0.3) {
        utility += 0.35;
      }

      if (state.playerHasVulnerable) {
        utility += 0.25;
      }

      if (state.playerBlock > 0 && !state.playerHasWeak) {
        utility += 0.1;
      }

      if (state.enemyHpPercent < 0.3) {
        utility += 0.2;
      }

      if (state.playerHpPercent > 0.7 && state.playerBlock > 0) {
        utility += 0.15;
      }
    }

    if (intentTagger.hasTag(intent, 'defensive')) {
      utility += 0.1;

      if (state.enemyHpPercent < 0.4) {
        utility += 0.3;
      }

      if (state.enemyBlock === 0) {
        utility += 0.2;
      }

      if (state.enemyHpPercent > 0.7 && state.enemyBlock === 0) {
        utility += 0.15;
      }

      if (state.playerHpPercent > 0.5 && state.enemyHpPercent > 0.6) {
        utility += 0.1;
      }
    }

    if (intentTagger.hasTag(intent, 'setup')) {
      utility += 0.05;

      if (state.turnNumber <= 2) {
        utility += 0.3;
      } else if (state.turnNumber <= 4) {
        utility += 0.15;
      }

      if (state.enemyHpPercent > 0.5) {
        utility += 0.1;
      }
    }

    if (intentTagger.hasTag(intent, 'controlling')) {
      if (!state.playerHasWeak && !state.playerHasVulnerable) {
        utility += 0.2;
      }

      if (state.playerBlock === 0) {
        utility += 0.15;
      }
    }

    if (intentTagger.hasTag(intent, 'bursty')) {
      if (state.playerHpPercent < 0.25) {
        utility += 0.4;
      } else if (state.playerHpPercent < 0.5) {
        utility += 0.2;
      }

      if (state.enemyHpPercent < 0.4) {
        utility += 0.15;
      }
    }

    if (intentTagger.hasTag(intent, 'healing')) {
      if (state.enemyHpPercent < 0.5) {
        utility += 0.35;
      } else if (state.enemyHpPercent < 0.7) {
        utility += 0.15;
      }
    }

    if (intentTagger.hasTag(intent, 'area_damage')) {
      if (state.otherEnemiesCount >= 2) {
        utility += 0.25;
      } else if (state.otherEnemiesCount >= 1) {
        utility += 0.1;
      }
    }

    if (intentTagger.hasTag(intent, 'single_target')) {
      if (state.otherEnemiesCount === 0 && state.enemyHpPercent < 0.5) {
        utility += 0.2;
      }
    }

    if (intent === state.lastUsedIntent) {
      const repeatPenalty = intentTagger.hasTag(intent, 'setup') ? 0.4 : 0.15;
      utility -= repeatPenalty;
    } else if (state.lastUsedIntent && intentTagger.areIntentsSimilar(intent, state.lastUsedIntent)) {
      utility -= 0.1;
    }

    return utility;
  }

  private calculatePersonalityMatch(intent: string, personality: PersonalityProfile): number {
    let match = 0;

    if (intentTagger.hasTag(intent, 'aggressive')) {
      match += (personality.aggression - 0.5) * 0.6;
    }

    if (intentTagger.hasTag(intent, 'defensive')) {
      match += (personality.defensiveness - 0.5) * 0.6;
    }

    if (intentTagger.hasTag(intent, 'sustaining')) {
      match += (personality.defensiveness - 0.5) * 0.3;
    }

    if (intentTagger.hasTag(intent, 'controlling')) {
      match += (personality.aggression - 0.5) * 0.2 + (personality.defensiveness - 0.5) * 0.2;
    }

    if (intentTagger.hasTag(intent, 'setup')) {
      match += personality.unpredictability * 0.2;
    }

    if (intentTagger.hasTag(intent, 'punitive') || intentTagger.hasTag(intent, 'bursty')) {
      match += (personality.revengefulness - 0.5) * 0.4;
    }

    return match;
  }

  private calculateSituationMatch(intent: string, situation: CombatSituationAssessment, turnNumber: number): number {
    let match = 0;

    if (situation.recommendedStrategy === 'aggressive') {
      if (intentTagger.hasTag(intent, 'aggressive') || intentTagger.hasTag(intent, 'bursty')) {
        match += 0.35;
      }
      if (intentTagger.hasTag(intent, 'setup') && turnNumber <= 3) {
        match += 0.2;
      }
      if (intentTagger.hasTag(intent, 'defensive')) {
        match -= 0.25;
      }
    }

    if (situation.recommendedStrategy === 'defensive') {
      if (intentTagger.hasTag(intent, 'defensive') || intentTagger.hasTag(intent, 'sustaining')) {
        match += 0.35;
      }
      if (intentTagger.hasTag(intent, 'healing')) {
        match += 0.25;
      }
      if (intentTagger.hasTag(intent, 'aggressive') && !intentTagger.hasTag(intent, 'bursty')) {
        match -= 0.2;
      }
    }

    if (situation.recommendedStrategy === 'evasive') {
      if (intentTagger.hasTag(intent, 'defensive') || intentTagger.hasTag(intent, 'healing')) {
        match += 0.4;
      }
      if (intentTagger.hasTag(intent, 'aggressive')) {
        match -= 0.35;
      }
      if (intentTagger.hasTag(intent, 'setup')) {
        match -= 0.3;
      }
    }

    if (situation.recommendedStrategy === 'balanced') {
      if (intentTagger.hasTag(intent, 'controlling') || intentTagger.hasTag(intent, 'setup')) {
        match += 0.2;
      }
    }

    match += situation.suggestedIntentBias * 0.3;

    if (situation.threatLevel === 'critical') {
      if (intentTagger.hasTag(intent, 'defensive') || intentTagger.hasTag(intent, 'healing')) {
        match += 0.3;
      }
      if (intentTagger.hasTag(intent, 'setup')) {
        match -= 0.25;
      }
    }

    if (situation.opportunityLevel === 'high') {
      if (intentTagger.hasTag(intent, 'aggressive') || intentTagger.hasTag(intent, 'bursty')) {
        match += 0.2;
      }
    }

    return match;
  }

  private calculateRiskAdjustment(intent: string, risk: RiskProfile): number {
    let adjustment = 0;

    if (risk.survivalRisk > DEFAULT_RISK_THRESHOLDS.critical) {
      if (intentTagger.hasTag(intent, 'defensive') || intentTagger.hasTag(intent, 'healing')) {
        adjustment += 0.4;
      }
      if (intentTagger.hasTag(intent, 'aggressive') && !intentTagger.hasTag(intent, 'bursty')) {
        adjustment -= 0.3;
      }
    }

    if (risk.aggressionRisk > DEFAULT_RISK_THRESHOLDS.high) {
      if (intentTagger.hasTag(intent, 'bursty') || intentTagger.hasTag(intent, 'setup')) {
        adjustment += 0.25;
      }
      if (intentTagger.hasTag(intent, 'aggressive')) {
        adjustment -= 0.2;
      }
    }

    if (risk.defensiveRisk > DEFAULT_RISK_THRESHOLDS.high) {
      if (intentTagger.hasTag(intent, 'healing')) {
        adjustment += 0.3;
      }
      if (intentTagger.hasTag(intent, 'setup')) {
        adjustment += 0.2;
      }
    }

    if (risk.overallRisk > DEFAULT_RISK_THRESHOLDS.medium) {
      if (intentTagger.hasTag(intent, 'defensive')) {
        adjustment += 0.15;
      }
      if (intentTagger.hasTag(intent, 'aggressive')) {
        adjustment -= 0.1;
      }
    }

    if (risk.overallRisk < DEFAULT_RISK_THRESHOLDS.medium) {
      if (intentTagger.hasTag(intent, 'aggressive')) {
        adjustment += 0.2;
      }
      if (intentTagger.hasTag(intent, 'setup')) {
        adjustment += 0.15;
      }
    }

    return adjustment;
  }

  private calculatePatternMatch(intent: string, patterns: PlayerPatternAnalysis): number {
    let match = 0;

    if (patterns.vulnerableToBurst) {
      if (intentTagger.hasTag(intent, 'bursty') || intentTagger.hasTag(intent, 'aggressive')) {
        match += 0.35;
      }
      if (intentTagger.hasTag(intent, 'setup')) {
        match -= 0.2;
      }
    }

    if (patterns.prefersAggression) {
      if (intentTagger.hasTag(intent, 'controlling') || intentTagger.hasTag(intent, 'defensive')) {
        match += 0.25;
      }
      if (intentTagger.hasTag(intent, 'bursty')) {
        match += 0.15;
      }
    } else {
      if (intentTagger.hasTag(intent, 'aggressive') || intentTagger.hasTag(intent, 'bursty')) {
        match += 0.2;
      }
    }

    if (patterns.averageDamageDealtPerTurn > 10) {
      if (intentTagger.hasTag(intent, 'defensive') || intentTagger.hasTag(intent, 'sustaining')) {
        match += 0.2;
      }
      if (intentTagger.hasTag(intent, 'aggressive') && !intentTagger.hasTag(intent, 'bursty')) {
        match -= 0.1;
      }
    }

    if (patterns.averageBlockGainedPerTurn > 8) {
      if (intentTagger.hasTag(intent, 'aggressive') || intentTagger.hasTag(intent, 'setup')) {
        match += 0.15;
      }
    }

    if (patterns.aggressivePlaysInLastTurns > patterns.defensivePlaysInLastTurns * 2) {
      if (intentTagger.hasTag(intent, 'controlling')) {
        match += 0.2;
      }
      if (intentTagger.hasTag(intent, 'defensive')) {
        match += 0.1;
      }
    }

    if (patterns.aggressivePlaysInLastTurns < patterns.defensivePlaysInLastTurns) {
      if (intentTagger.hasTag(intent, 'aggressive') || intentTagger.hasTag(intent, 'bursty')) {
        match += 0.2;
      }
    }

    return match;
  }

  private adjustThreatForDifficulty(
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

  private adjustOpportunityForDifficulty(
    opportunity: CombatSituationAssessment['opportunityLevel'],
    difficulty: number
  ): CombatSituationAssessment['opportunityLevel'] {
    if (difficulty > 1.2) {
      if (opportunity === 'high') return 'medium';
      if (opportunity === 'medium') return 'low';
    }
    if (difficulty < 0.8) {
      if (opportunity === 'low') return 'medium';
      if (opportunity === 'medium') return 'high';
    }
    return opportunity;
  }

  public updateCooldowns(cooldowns: IntentCooldownState, usedIntent: string): IntentCooldownState {
    const newCooldowns: IntentCooldownState = {};

    for (const [intent, remaining] of Object.entries(cooldowns)) {
      if (remaining > 0) {
        newCooldowns[intent] = remaining - 1;
      }
    }

    newCooldowns[usedIntent] = 2;

    return newCooldowns;
  }
}

export const intentSelector = new IntentSelector();
