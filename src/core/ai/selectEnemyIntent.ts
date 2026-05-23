/**
 * @file selectEnemyIntent.ts
 * @description 敌人意图选择入口 - 整合各子系统为敌人选择最终意图
 *
 * 主要职责:
 * - 整合 combatMemory、handKnowledge、intentTagger、intentSelector 等子系统
 * - 定义 EnemyPerceptionSnapshot，描述 AI 对当前局势的感知快照
 * - 实现基于感知、记忆、群体协作的意图选择流程
 * - 输出最终意图选择结果
 */
import type { ActionSpec, GameState, RunCardInstance } from '@/core/types';

import { combatMemory, type PlayerPatternAnalysis } from '@/core/ai/combatMemory';
import { handKnowledgeSystem } from '@/core/ai/handKnowledge';
import { parseIntentPolicyWeight, resolveIntentPolicyList } from '@/core/ai/intentPolicy';
import { intentTagger } from '@/core/ai/intentTags';
import {
  intentSelector,
  type EnemyAiProfile,
  type EnemyDefBase,
  type EnemyIntentBiasRule,
  type EnemyStateBase,
  type IntentCooldownState,
  type PersonalityProfile,
} from '@/core/ai/intentSelector';
import {
  assessCombatSituation,
  extractEnemyStatus,
  extractPlayerStatus,
  type CombatSituationAssessment,
} from '@/core/ai/statePerception';

type CombatEnemyState = NonNullable<GameState['combat']>['enemies'][number];
type IntentBand = 'low' | 'medium' | 'high';
type HpBand = 'safe' | 'pressured' | 'kill_range';
type BlockBand = 'none' | 'light' | 'heavy';
type ComboThreatBand = 'none' | 'suspected' | 'high';

export interface EnemyPerceptionSnapshot {
  perceptionAccuracy: number;
  attackIntentBand: IntentBand;
  defenseIntentBand: IntentBand;
  comboThreatBand: ComboThreatBand;
  playerHpBand: HpBand;
  enemyHpBand: HpBand;
  playerBlockBand: BlockBand;
  visibleCardIds: string[];
}

function buildPlayerSnapshot(state: GameState) {
  const combatPlayer = state.combat?.player;
  if (combatPlayer) {
    return {
      hp: combatPlayer.hp,
      maxHp: combatPlayer.maxHp,
      block: combatPlayer.block || 0,
      energy: combatPlayer.energy || 0,
      statuses: combatPlayer.statuses || {},
    };
  }

  return {
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    block: state.player.block || 0,
    energy: state.player.energy || state.player.maxEnergy || 0,
    statuses: {},
  };
}

function derivePerceptionAccuracy(enemyDef: EnemyDefBase): number {
  const profileAccuracy = enemyDef.ai_profile?.perceptionAccuracy;
  if (typeof profileAccuracy === 'number') {
    return Math.max(0.1, Math.min(0.95, profileAccuracy));
  }
  if (enemyDef.keywords?.includes('boss')) return 0.85;
  if (enemyDef.keywords?.includes('elite')) return 0.65;
  return 0.45;
}

function classifyIntentBand(numerator: number, denominator: number): IntentBand {
  if (denominator <= 0) return 'low';
  const ratio = numerator / denominator;
  if (ratio >= 0.6) return 'high';
  if (ratio >= 0.3) return 'medium';
  return 'low';
}

function classifyHpBand(hp: number, maxHp: number): HpBand {
  if (maxHp <= 0) return 'safe';
  const ratio = hp / maxHp;
  if (ratio < 0.3) return 'kill_range';
  if (ratio < 0.7) return 'pressured';
  return 'safe';
}

function classifyBlockBand(block: number): BlockBand {
  if (block <= 0) return 'none';
  if (block >= 12) return 'heavy';
  return 'light';
}

function isDefensiveCard(card: RunCardInstance): boolean {
  return card.actions?.some((action) => action.type === 'GainBlock' || action.type === 'Heal') ?? false;
}

function isComboThreatCard(card: RunCardInstance): boolean {
  return card.cost >= 2 || (card.actions?.length || 0) >= 2;
}

function strongestIntentBand(a: IntentBand, b: IntentBand): IntentBand {
  const rank: Record<IntentBand, number> = { low: 0, medium: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function nonNegativeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function getPlayableCost(card: RunCardInstance): number {
  return Math.max(0, Math.floor(nonNegativeNumber(card.tempCost ?? card.cost)));
}

function isActionDamage(action: ActionSpec): boolean {
  return action.type === 'DealDamage'
    || action.type === 'DealDamagePiercing'
    || action.type === 'ConditionalDamage'
    || action.type === 'ConditionalBonusDamage'
    || action.type === 'ConditionalDelayedDamage'
    || action.type === 'ElementalOverloadDamage'
    || action.type === 'PrecisionThrowDamage'
    || action.type === 'SolventDamage'
    || action.type === 'RemovePoisonAndDealDamage'
    || action.type === 'PuppetAttack';
}

function isActionDefense(action: ActionSpec): boolean {
  return action.type === 'GainBlock'
    || action.type === 'ConditionalBonusBlock'
    || action.type === 'EmergencyBlock'
    || action.type === 'Heal'
    || action.type === 'HealSelf'
    || action.type === 'ConditionalHeal';
}

function getActionMagnitude(action: ActionSpec): number {
  const direct = Math.max(
    nonNegativeNumber(action.amount),
    nonNegativeNumber(action.damage),
    nonNegativeNumber(action.block),
    nonNegativeNumber(action.bonus),
  );
  const repeats = Math.max(1, Math.floor(nonNegativeNumber((action as ActionSpec & { hits?: number }).hits || action.times || 1)));
  return direct * repeats;
}

function accumulateActionPotential(actions: ActionSpec[] | undefined): { damage: number; defense: number; actionCount: number } {
  const totals = { damage: 0, defense: 0, actionCount: 0 };
  if (!actions) return totals;

  const visit = (action: ActionSpec): void => {
    totals.actionCount += 1;
    if (isActionDamage(action)) totals.damage += getActionMagnitude(action);
    if (isActionDefense(action)) totals.defense += getActionMagnitude(action);

    for (const nested of [action.actions, action.effects, action.trueActions, action.falseActions]) {
      for (const child of nested || []) visit(child);
    }
    if (action.effect && 'type' in action.effect) {
      visit(action.effect as ActionSpec);
    }
    if (action.ifTrue) visit(action.ifTrue);
    if (action.ifFalse) visit(action.ifFalse);
  };

  for (const action of actions) visit(action);
  return totals;
}

function classifyDamagePotentialBand(damagePotential: number, enemyHp: number): IntentBand {
  if (damagePotential <= 0) return 'low';
  if (damagePotential >= Math.max(12, enemyHp)) return 'high';
  if (damagePotential >= Math.max(6, enemyHp * 0.35)) return 'medium';
  return 'low';
}

function classifyDefensePotentialBand(defensePotential: number): IntentBand {
  if (defensePotential >= 12) return 'high';
  if (defensePotential >= 6) return 'medium';
  return 'low';
}

export function buildEnemyPerceptionSnapshot(
  state: GameState,
  enemyDef: EnemyDefBase,
  enemyState: CombatEnemyState | (EnemyStateBase & Partial<CombatEnemyState>),
): EnemyPerceptionSnapshot {
  const combat = state.combat;
  const hand = combat?.hand ?? [];
  const perceptionAccuracy = derivePerceptionAccuracy(enemyDef);
  handKnowledgeSystem.updateFromIntel(perceptionAccuracy, hand);

  const visibleCount = Math.min(hand.length, Math.max(1, Math.ceil(hand.length * perceptionAccuracy)));
  const visibleCards = hand.slice(0, visibleCount);
  const playerEnergy = state.combat?.player.energy ?? state.player.energy ?? state.player.maxEnergy ?? 0;
  const playableCards = visibleCards.filter((card) => getPlayableCost(card) <= playerEnergy);
  const playableAttackCount = playableCards.filter((card) => card.type === 'Attack').length;
  const playableDefenseCount = playableCards.filter((card) => isDefensiveCard(card)).length;
  const comboThreatCount = playableCards.filter((card) => isComboThreatCard(card)).length;
  const immediatePotential = playableCards.reduce((totals, card) => {
    const cardPotential = accumulateActionPotential(card.actions);
    return {
      damage: totals.damage + cardPotential.damage,
      defense: totals.defense + cardPotential.defense,
      actionCount: totals.actionCount + cardPotential.actionCount,
    };
  }, { damage: 0, defense: 0, actionCount: 0 });

  const dangerousKnownCards = handKnowledgeSystem.getDangerousCardCount();
  const attackIntentBand = strongestIntentBand(
    classifyIntentBand(playableAttackCount, Math.max(1, visibleCards.length)),
    classifyDamagePotentialBand(immediatePotential.damage, enemyState.hp),
  );
  const defenseIntentBand = strongestIntentBand(
    classifyIntentBand(playableDefenseCount, Math.max(1, visibleCards.length)),
    classifyDefensePotentialBand(immediatePotential.defense),
  );
  const comboThreatBand: ComboThreatBand =
    immediatePotential.damage >= enemyState.hp || comboThreatCount >= 2 || dangerousKnownCards >= 3
      ? 'high'
      : immediatePotential.damage >= Math.max(10, enemyState.hp * 0.45) || comboThreatCount >= 1 || dangerousKnownCards >= 1
        ? 'suspected'
        : 'none';

  return {
    perceptionAccuracy,
    attackIntentBand,
    defenseIntentBand,
    comboThreatBand,
    playerHpBand: classifyHpBand(state.combat?.player.hp ?? state.player.hp, state.combat?.player.maxHp ?? state.player.maxHp),
    enemyHpBand: classifyHpBand(enemyState.hp, enemyState.maxHp),
    playerBlockBand: classifyBlockBand(state.combat?.player.block ?? state.player.block ?? 0),
    visibleCardIds: visibleCards.map((card) => card.id),
  };
}

function bumpThreatLevel(level: CombatSituationAssessment['threatLevel']): CombatSituationAssessment['threatLevel'] {
  if (level === 'low') return 'medium';
  if (level === 'medium') return 'high';
  return 'critical';
}

function lowerOpportunityLevel(level: CombatSituationAssessment['opportunityLevel']): CombatSituationAssessment['opportunityLevel'] {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

function deriveSituationFromPerception(
  baseSituation: CombatSituationAssessment,
  perception: EnemyPerceptionSnapshot,
): CombatSituationAssessment {
  let threatLevel = baseSituation.threatLevel;
  let opportunityLevel = baseSituation.opportunityLevel;
  let recommendedStrategy = baseSituation.recommendedStrategy;
  let suggestedIntentBias = baseSituation.suggestedIntentBias;

  if (perception.attackIntentBand === 'high' || perception.comboThreatBand === 'high') {
    threatLevel = bumpThreatLevel(threatLevel);
    recommendedStrategy = perception.enemyHpBand === 'kill_range' ? 'evasive' : 'defensive';
    suggestedIntentBias += 0.2;
  }

  if (perception.defenseIntentBand === 'high' || perception.playerBlockBand === 'heavy') {
    opportunityLevel = lowerOpportunityLevel(opportunityLevel);
    if (recommendedStrategy === 'aggressive') {
      recommendedStrategy = 'balanced';
    }
    suggestedIntentBias += 0.1;
  }

  if (perception.playerHpBand === 'kill_range' && perception.comboThreatBand !== 'none') {
    recommendedStrategy = 'aggressive';
    suggestedIntentBias += 0.15;
  }

  return {
    ...baseSituation,
    threatLevel,
    opportunityLevel,
    recommendedStrategy,
    suggestedIntentBias,
  };
}

function derivePatternsFromPerception(
  basePatterns: PlayerPatternAnalysis,
  perception: EnemyPerceptionSnapshot,
): PlayerPatternAnalysis {
  return {
    ...basePatterns,
    aggressivePlaysInLastTurns:
      basePatterns.aggressivePlaysInLastTurns + (perception.attackIntentBand === 'high' ? 2 : perception.attackIntentBand === 'medium' ? 1 : 0),
    defensivePlaysInLastTurns:
      basePatterns.defensivePlaysInLastTurns + (perception.defenseIntentBand === 'high' ? 2 : perception.defenseIntentBand === 'medium' ? 1 : 0),
    averageDamageDealtPerTurn:
      basePatterns.averageDamageDealtPerTurn + (perception.comboThreatBand === 'high' ? 8 : perception.attackIntentBand === 'high' ? 4 : 0),
    averageBlockGainedPerTurn:
      basePatterns.averageBlockGainedPerTurn + (perception.playerBlockBand === 'heavy' ? 10 : perception.playerBlockBand === 'light' ? 4 : 0),
    prefersAggression:
      perception.attackIntentBand === 'high'
        ? true
        : perception.defenseIntentBand === 'high'
          ? false
          : basePatterns.prefersAggression,
    vulnerableToBurst: basePatterns.vulnerableToBurst || perception.comboThreatBand === 'high',
  };
}

function mergePersonalityProfile(enemyDef: EnemyDefBase): PersonalityProfile | undefined {
  const override = enemyDef.ai_profile?.personality;
  if (!override) return undefined;
  return {
    aggression: typeof override.aggression === 'number' ? override.aggression : 0.5,
    defensiveness: typeof override.defensiveness === 'number' ? override.defensiveness : 0.5,
    unpredictability: typeof override.unpredictability === 'number' ? override.unpredictability : 0.3,
    revengefulness: typeof override.revengefulness === 'number' ? override.revengefulness : 0.2,
  };
}

function matchesBiasRule(rule: EnemyIntentBiasRule, perception: EnemyPerceptionSnapshot): boolean {
  return (!rule.attackIntentBand || rule.attackIntentBand === perception.attackIntentBand) &&
    (!rule.defenseIntentBand || rule.defenseIntentBand === perception.defenseIntentBand) &&
    (!rule.comboThreatBand || rule.comboThreatBand === perception.comboThreatBand) &&
    (!rule.playerHpBand || rule.playerHpBand === perception.playerHpBand) &&
    (!rule.enemyHpBand || rule.enemyHpBand === perception.enemyHpBand) &&
    (!rule.playerBlockBand || rule.playerBlockBand === perception.playerBlockBand);
}

function applyIntentProfile(
  enemyDef: EnemyDefBase,
  enemyState: CombatEnemyState | (EnemyStateBase & Partial<CombatEnemyState>),
  perception: EnemyPerceptionSnapshot,
): EnemyDefBase {
  const profile = enemyDef.ai_profile;
  const intentPolicy = resolveIntentPolicyList(enemyDef);
  if (!profile || intentPolicy.length === 0) {
    return enemyDef;
  }

  const adjustedPolicies = intentPolicy.map((policy) => {
    let weight = parseIntentPolicyWeight(policy.weight, enemyDef.id, policy.intent);

    for (const rule of profile.intentBiases || []) {
      if (rule.intent !== policy.intent) continue;
      if (!matchesBiasRule(rule, perception)) continue;
      const multiplier = typeof rule.multiplier === 'number' && Number.isFinite(rule.multiplier)
        ? rule.multiplier
        : 1;
      weight *= Math.max(0, multiplier);
    }

    const antiStall = profile.antiStall;
    if (antiStall && (enemyState.nonAttackIntentStreak || 0) >= antiStall.maxNonAttackTurns) {
      if ((antiStall.suppressedIntents || []).includes(policy.intent)) {
        weight = 0;
      } else if (intentTagger.isCategory(policy.intent, 'attack') || intentTagger.hasTag(policy.intent, 'aggressive')) {
        weight *= Math.max(1, Number(antiStall.forcedAttackMultiplier) || 1);
      }
    }

    return { ...policy, weight };
  });

  return {
    ...enemyDef,
    intent_policy: adjustedPolicies,
  };
}

export function selectEnemyIntentForCombat(
  state: GameState,
  enemyDef: EnemyDefBase,
  enemyState: CombatEnemyState | (EnemyStateBase & Partial<CombatEnemyState>),
  turnNumber: number,
  rng: () => number,
  cooldowns: IntentCooldownState = {},
): string {
  const combatEnemies = state.combat?.enemies || [];
  const normalizedEnemyState: EnemyStateBase = {
    id: enemyState.id,
    hp: enemyState.hp,
    maxHp: enemyState.maxHp,
    block: enemyState.block || 0,
    statuses: enemyState.statuses || {},
    lastUsedIntent: enemyState.lastUsedIntent || null,
    parent: { enemies: combatEnemies.length > 0 ? combatEnemies : undefined },
  };
  const playerSnapshot = buildPlayerSnapshot(state);
  const perception = buildEnemyPerceptionSnapshot(state, enemyDef, enemyState);
  const profiledEnemyDef = applyIntentProfile(enemyDef, enemyState, perception);
  const situation = deriveSituationFromPerception(
    assessCombatSituation(extractPlayerStatus(playerSnapshot), [extractEnemyStatus(normalizedEnemyState)]),
    perception,
  );
  const patterns = derivePatternsFromPerception(combatMemory.analyzePlayerPatterns(), perception);
  const personality = mergePersonalityProfile(enemyDef);

  return intentSelector.selectIntent(
    profiledEnemyDef,
    normalizedEnemyState,
    playerSnapshot,
    turnNumber,
    rng,
    cooldowns,
    personality,
    situation,
    undefined,
    patterns,
    Math.max(0, Number(state.metaRuntime?.ascensionIntentAggroBias || 0)),
  );
}
