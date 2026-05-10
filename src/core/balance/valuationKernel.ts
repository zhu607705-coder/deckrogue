/**
 * @file valuationKernel.ts
 * @description 估值核心 - 提供 EVU 计算的核心算法
 *
 * 主要职责:
 * - 定义 ValuationWeights 接口，描述各资源的权重配置
 * - 实现 calculateCardStaticEVU 和 calculateRelicStaticEVU 核心估值函数
 * - 定义 DEFAULT_VALUATION_WEIGHTS 默认权重配置
 * - 提供稀有度因子 (RARITY_FACTORS) 和类型因子 (TYPE_FACTORS)
 */
import type { VarianceClass } from '@/core/balance/numericsTypes';
import { VARIANCE_FACTORS } from '@/core/balance/numericsFormulas';

export type { VarianceClass } from '@/core/balance/numericsTypes';
export interface ValuationWeights {
  energy: number;
  damage: number;
  block: number;
  armor: number;
  draw: number;
  heal: number;
  gold: number;
  status: number;
  intel: number;
  devotion: number;
  corruption: number;
  thread: number;
  timeLayer: number;
  concoction: number;
  verdict: number;
  seal: number;
}

export const DEFAULT_VALUATION_WEIGHTS: ValuationWeights = {
  energy: 1.00,
  damage: 0.14,
  block: 0.16,
  armor: 0.22,
  draw: 0.34,
  heal: 0.10,
  gold: 0.02,
  status: 0.18,
  intel: 0.26,
  devotion: 0.22,
  corruption: 0.18,
  thread: 0.24,
  timeLayer: 0.30,
  concoction: 0.28,
  verdict: 0.27,
  seal: 0.25,
};

export type StatusType =
  | 'Strength'
  | 'Vulnerable'
  | 'Weak'
  | 'Frail'
  | 'Poison'
  | 'Burn'
  | 'PlatedArmor'
  | 'Fear'
  | 'Dexterity'
  | 'Artifact'
  | 'Barricade'
  | 'Buffer'
  | 'Intangible'
  | 'Regeneration'
  | 'Ritual'
  | 'Thorns';

export const STATUS_FACTORS: Record<StatusType, number> = {
  Strength: 1.20,
  Vulnerable: 1.15,
  Weak: 1.00,
  Frail: 0.95,
  Poison: 1.10,
  Burn: 1.05,
  PlatedArmor: 1.10,
  Fear: 0.95,
  Dexterity: 1.15,
  Artifact: 1.30,
  Barricade: 1.25,
  Buffer: 1.20,
  Intangible: 1.35,
  Regeneration: 1.12,
  Ritual: 1.08,
  Thorns: 1.05,
};

export const RARITY_FACTORS: Record<string, number> = {
  Common: 1.00,
  Uncommon: 1.25,
  Rare: 1.60,
  Starter: 0.92,
  Legendary: 2.00,
};

export const TYPE_FACTORS: Record<string, number> = {
  Attack: 1.00,
  Skill: 1.05,
  Power: 1.15,
  Curse: 0.50,
  Status: 0.60,
};

export const GAMMA = 0.82;

export function durationFactor(duration: number): number {
  if (duration <= 0) return 1.00;
  let factor = 0;
  for (let t = 0; t < duration; t++) {
    factor += Math.pow(GAMMA, t);
  }
  return factor;
}

export function aoeFactor(targetCount: number): number {
  if (targetCount <= 1) return 1.00;
  return 1 + 0.72 * Math.min(targetCount - 1, 2) + 0.35 * Math.max(targetCount - 3, 0);
}

export function multiHitFactor(hits: number): number {
  if (hits <= 1) return 1.00;
  return Math.max(0.5, 1 - 0.1 * (hits - 1));
}

export function timingFactor(turnDelay: number): number {
  return Math.pow(GAMMA, turnDelay);
}

export interface StatusValuationParams {
  status: string;
  stacks: number;
  duration?: number;
  timingTurns?: number;
  triggerRate?: number;
  reliabilityFactor?: number;
}

export function calculateStatusEVU(
  params: StatusValuationParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { status, stacks, duration = 1, timingTurns = 0, triggerRate = 1.0, reliabilityFactor = 1.0 } = params;

  const statusFactor = STATUS_FACTORS[status as StatusType] ?? 1.00;
  const durFactor = durationFactor(duration);
  const timeFactor = timingFactor(timingTurns);

  return stacks * durFactor * weights.status * statusFactor * timeFactor * triggerRate * reliabilityFactor;
}

export interface DamageValuationParams {
  baseDamage: number;
  hits?: number;
  targetCount?: number;
  timingTurns?: number;
  variance?: VarianceClass;
}

export function calculateDamageEVU(
  params: DamageValuationParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { baseDamage, hits = 1, targetCount = 1, timingTurns = 0, variance = 'stable' } = params;

  const hitFactor = multiHitFactor(hits);
  const aoe = aoeFactor(targetCount);
  const timeFactor = timingFactor(timingTurns);
  const varianceFactor = VARIANCE_FACTORS[variance];

  return baseDamage * hits * hitFactor * aoe * weights.damage * timeFactor * varianceFactor;
}

export interface BlockValuationParams {
  block: number;
  timingTurns?: number;
  variance?: VarianceClass;
}

export function calculateBlockEVU(
  params: BlockValuationParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { block, timingTurns = 0, variance = 'stable' } = params;

  const timeFactor = timingFactor(timingTurns);
  const varianceFactor = VARIANCE_FACTORS[variance];

  return block * weights.block * timeFactor * varianceFactor;
}

export interface DrawValuationParams {
  cards: number;
  timingTurns?: number;
  variance?: VarianceClass;
}

export function calculateDrawEVU(
  params: DrawValuationParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { cards, timingTurns = 0, variance = 'stable' } = params;

  const timeFactor = timingFactor(timingTurns);
  const varianceFactor = VARIANCE_FACTORS[variance];

  return cards * weights.draw * timeFactor * varianceFactor;
}

export interface HealValuationParams {
  heal: number;
  timingTurns?: number;
  variance?: VarianceClass;
}

export function calculateHealEVU(
  params: HealValuationParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { heal, timingTurns = 0, variance = 'stable' } = params;

  const timeFactor = timingFactor(timingTurns);
  const varianceFactor = VARIANCE_FACTORS[variance];

  return heal * weights.heal * timeFactor * varianceFactor;
}

export interface ResourceValuationParams {
  resource: 'intel' | 'devotion' | 'corruption' | 'thread' | 'timeLayer' | 'concoction' | 'verdict' | 'seal';
  amount: number;
  timingTurns?: number;
  variance?: VarianceClass;
}

export function calculateResourceEVU(
  params: ResourceValuationParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { resource, amount, timingTurns = 0, variance = 'stable' } = params;

  const timeFactor = timingFactor(timingTurns);
  const varianceFactor = VARIANCE_FACTORS[variance];

  const weightKey = resource as keyof ValuationWeights;
  const weight = weights[weightKey] ?? weights.status;

  return amount * weight * timeFactor * varianceFactor;
}

export interface CardStaticEVUParams {
  cost: number;
  rarity: string;
  type: string;
  damage?: number;
  damageHits?: number;
  damageTargets?: number;
  block?: number;
  draw?: number;
  heal?: number;
  statuses?: StatusValuationParams[];
  resources?: ResourceValuationParams[];
  variance?: VarianceClass;
  riskFactor?: number;
  conditionalDiscount?: number;
}

export function calculateCardStaticEVU(
  params: CardStaticEVUParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const {
    cost,
    rarity,
    type,
    damage = 0,
    damageHits = 1,
    damageTargets = 1,
    block = 0,
    draw = 0,
    heal = 0,
    statuses = [],
    resources = [],
    variance = 'stable',
    riskFactor = 1.0,
    conditionalDiscount = 1.0,
  } = params;

  const rarityFactor = RARITY_FACTORS[rarity] ?? 1.00;
  const typeFactor = TYPE_FACTORS[type] ?? 1.00;
  const varianceFactor = VARIANCE_FACTORS[variance];

  const damageEVU = damage > 0 ? calculateDamageEVU({ baseDamage: damage, hits: damageHits, targetCount: damageTargets, variance }, weights) : 0;
  const blockEVU = block > 0 ? calculateBlockEVU({ block, variance }, weights) : 0;
  const drawEVU = draw > 0 ? calculateDrawEVU({ cards: draw, variance }, weights) : 0;
  const healEVU = heal > 0 ? calculateHealEVU({ heal, variance }, weights) : 0;
  const statusEVU = statuses.reduce((sum, s) => sum + calculateStatusEVU(s, weights), 0);
  const resourceEVU = resources.reduce((sum, r) => sum + calculateResourceEVU(r, weights), 0);

  const effectEVU = damageEVU + blockEVU + drawEVU + healEVU + statusEVU + resourceEVU;
  const costEVU = cost * weights.energy;

  const grossEVU = effectEVU - costEVU;

  return grossEVU * rarityFactor * typeFactor * varianceFactor * riskFactor * conditionalDiscount;
}

export interface RelicStaticEVUParams {
  triggerRate?: number;
  durationTurns?: number;
  variance?: VarianceClass;
  effects: Array<{
    damage?: number;
    block?: number;
    draw?: number;
    heal?: number;
    statuses?: StatusValuationParams[];
    resources?: ResourceValuationParams[];
  }>;
}

export function calculateRelicStaticEVU(
  params: RelicStaticEVUParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { triggerRate = 1.0, durationTurns = 1, variance = 'stable', effects } = params;

  const varianceFactor = VARIANCE_FACTORS[variance];
  const durFactor = durationFactor(durationTurns);

  let totalEVU = 0;

  for (const effect of effects) {
    const damageEVU = effect.damage ? calculateDamageEVU({ baseDamage: effect.damage }, weights) : 0;
    const blockEVU = effect.block ? calculateBlockEVU({ block: effect.block }, weights) : 0;
    const drawEVU = effect.draw ? calculateDrawEVU({ cards: effect.draw }, weights) : 0;
    const healEVU = effect.heal ? calculateHealEVU({ heal: effect.heal }, weights) : 0;
    const statusEVU = effect.statuses?.reduce((sum, s) => sum + calculateStatusEVU(s, weights), 0) ?? 0;
    const resourceEVU = effect.resources?.reduce((sum, r) => sum + calculateResourceEVU(r, weights), 0) ?? 0;

    totalEVU += damageEVU + blockEVU + drawEVU + healEVU + statusEVU + resourceEVU;
  }

  return totalEVU * triggerRate * durFactor * varianceFactor;
}

export interface EnemyIntentPressureParams {
  damage?: number;
  damageHits?: number;
  block?: number;
  statuses?: StatusValuationParams[];
  heal?: number;
}

export function calculateEnemyIntentPressure(
  params: EnemyIntentPressureParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): number {
  const { damage = 0, damageHits = 1, block = 0, statuses = [], heal = 0 } = params;

  const damagePressure = calculateDamageEVU({ baseDamage: damage, hits: damageHits }, weights);
  const blockPressure = block * weights.block * 0.5;
  const statusPressure = statuses.reduce((sum, s) => sum + calculateStatusEVU(s, weights), 0);
  const healPressure = heal * weights.heal * 0.8;

  return damagePressure + blockPressure + statusPressure + healPressure;
}

export interface CompiledNumericProfile {
  damage: number;
  block: number;
  draw: number;
  heal: number;
  statuses: Array<{ status: string; stacks: number; evu: number }>;
  resources: Array<{ resource: string; amount: number; evu: number }>;
  variance: VarianceClass;
  risk: number;
  timing: number;
  targetProfile: {
    aoe: boolean;
    multiHit: boolean;
    targetCount: number;
  };
  totalEVU: number;
}

export function compileNumericProfile(
  params: CardStaticEVUParams,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): CompiledNumericProfile {
  const {
    damage = 0,
    damageHits = 1,
    damageTargets = 1,
    block = 0,
    draw = 0,
    heal = 0,
    statuses = [],
    resources = [],
    variance = 'stable',
    riskFactor = 1.0,
  } = params;

  const damageEVU = damage > 0 ? calculateDamageEVU({ baseDamage: damage, hits: damageHits, targetCount: damageTargets, variance }, weights) : 0;
  const blockEVU = block > 0 ? calculateBlockEVU({ block, variance }, weights) : 0;
  const drawEVU = draw > 0 ? calculateDrawEVU({ cards: draw, variance }, weights) : 0;
  const healEVU = heal > 0 ? calculateHealEVU({ heal, variance }, weights) : 0;

  const compiledStatuses = statuses.map(s => ({
    status: s.status,
    stacks: s.stacks,
    evu: calculateStatusEVU(s, weights),
  }));

  const compiledResources = resources.map(r => ({
    resource: r.resource,
    amount: r.amount,
    evu: calculateResourceEVU(r, weights),
  }));

  const statusEVU = compiledStatuses.reduce((sum, s) => sum + s.evu, 0);
  const resourceEVU = compiledResources.reduce((sum, r) => sum + r.evu, 0);

  const totalEVU = calculateCardStaticEVU(params, weights);

  return {
    damage: damageEVU,
    block: blockEVU,
    draw: drawEVU,
    heal: healEVU,
    statuses: compiledStatuses,
    resources: compiledResources,
    variance,
    risk: riskFactor,
    timing: 0,
    targetProfile: {
      aoe: damageTargets > 1,
      multiHit: damageHits > 1,
      targetCount: damageTargets,
    },
    totalEVU,
  };
}

export const valuationKernel = {
  weights: DEFAULT_VALUATION_WEIGHTS,
  statusFactors: STATUS_FACTORS,
  rarityFactors: RARITY_FACTORS,
  typeFactors: TYPE_FACTORS,
  varianceFactors: VARIANCE_FACTORS,
  gamma: GAMMA,

  durationFactor,
  aoeFactor,
  multiHitFactor,
  timingFactor,

  calculateStatusEVU,
  calculateDamageEVU,
  calculateBlockEVU,
  calculateDrawEVU,
  calculateHealEVU,
  calculateResourceEVU,
  calculateCardStaticEVU,
  calculateRelicStaticEVU,
  calculateEnemyIntentPressure,
  compileNumericProfile,
};

export default valuationKernel;
