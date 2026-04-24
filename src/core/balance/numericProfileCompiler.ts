/**
 * @file numericProfileCompiler.ts
 * @description 数值档案编译器 - 编译卡牌、遗物、事件的数值特征档案
 *
 * 主要职责:
 * - 定义 NumericVector 接口，描述数值特征向量 (damage, block, draw, heal, statuses, resources)
 * - 编译 CompiledCardProfile、CompiledRelicProfile 等档案
 * - 为数值诊断系统提供预编译的数值特征数据
 */
import type { ValuationWeights, VarianceClass } from './valuationKernel';
import {
  DEFAULT_VALUATION_WEIGHTS,
  calculateDamageEVU,
  calculateBlockEVU,
  calculateDrawEVU,
  calculateHealEVU,
  calculateStatusEVU,
  calculateResourceEVU,
  RARITY_FACTORS,
  TYPE_FACTORS,
} from './valuationKernel';
import { VARIANCE_FACTORS } from './numericsFormulas';

export interface NumericVector {
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
}

export interface CompiledCardProfile extends NumericVector {
  id: string;
  name: string;
  cost: number;
  rarity: string;
  type: string;
  totalEVU: number;
  priceGold: number;
}

export interface CompiledRelicProfile extends NumericVector {
  id: string;
  name: string;
  rarity: string;
  totalEVU: number;
  priceGold: number;
}

export interface CompiledEventOptionProfile extends NumericVector {
  eventId: string;
  optionId: string;
  text: string;
  totalEVU: number;
  danger: 'low' | 'medium' | 'high';
}

export interface CompiledEnemyIntentProfile {
  enemyId: string;
  intentId: string;
  damage: number;
  damageHits: number;
  block: number;
  statuses: Array<{ status: string; stacks: number; evu: number }>;
  heal: number;
  pressureEVU: number;
}

export interface CardCompilerInput {
  id: string;
  name: string;
  cost: number;
  rarity: string;
  type: string;
  actions: CardActionDefinition[];
  character?: string;
}

export interface CardActionDefinition {
  type: string;
  amount?: number;
  hits?: number;
  target?: string;
  status?: string;
  stacks?: number;
  duration?: number;
  resource?: string;
  variance?: VarianceClass;
  condition?: string;
}

export function compileCardProfile(
  card: CardCompilerInput,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): CompiledCardProfile {
  let damage = 0;
  let damageHits = 1;
  let damageTargets = 1;
  let block = 0;
  let draw = 0;
  let heal = 0;
  const statuses: Array<{ status: string; stacks: number; evu: number }> = [];
  const resources: Array<{ resource: string; amount: number; evu: number }> = [];
  let variance: VarianceClass = 'stable';
  let risk = 1.0;

  for (const action of card.actions) {
    switch (action.type) {
      case 'DealDamage':
        damage += action.amount ?? 0;
        damageHits = action.hits ?? 1;
        damageTargets = action.target === 'AllEnemies' ? 3 : 1;
        if (action.condition) {
          variance = 'conditional';
          risk *= 0.9;
        }
        break;
      case 'GainBlock':
        block += action.amount ?? 0;
        break;
      case 'Draw':
        draw += action.amount ?? 0;
        break;
      case 'Heal':
        heal += action.amount ?? 0;
        break;
      case 'ApplyStatus':
        if (action.status && action.stacks) {
          const statusEVU = calculateStatusEVU(
            { status: action.status, stacks: action.stacks, duration: action.duration ?? 1 },
            weights
          );
          statuses.push({ status: action.status, stacks: action.stacks, evu: statusEVU });
        }
        break;
      case 'GainResource':
        if (action.resource && action.amount) {
          const resourceEVU = calculateResourceEVU(
            { resource: action.resource as any, amount: action.amount },
            weights
          );
          resources.push({ resource: action.resource, amount: action.amount, evu: resourceEVU });
        }
        break;
    }
    if (action.variance) {
      variance = action.variance;
    }
  }

  const rarityFactor = RARITY_FACTORS[card.rarity] ?? 1.0;
  const typeFactor = TYPE_FACTORS[card.type] ?? 1.0;
  const varianceFactor = VARIANCE_FACTORS[variance];

  const damageEVU = calculateDamageEVU({ baseDamage: damage, hits: damageHits, targetCount: damageTargets, variance }, weights);
  const blockEVU = calculateBlockEVU({ block, variance }, weights);
  const drawEVU = calculateDrawEVU({ cards: draw, variance }, weights);
  const healEVU = calculateHealEVU({ heal, variance }, weights);
  const statusEVU = statuses.reduce((sum, s) => sum + s.evu, 0);
  const resourceEVU = resources.reduce((sum, r) => sum + r.evu, 0);

  const effectEVU = damageEVU + blockEVU + drawEVU + healEVU + statusEVU + resourceEVU;
  const costEVU = card.cost * weights.energy;

  const totalEVU = (effectEVU - costEVU) * rarityFactor * typeFactor * varianceFactor * risk;
  const priceGold = Math.floor(Math.abs(totalEVU) / weights.gold);

  return {
    id: card.id,
    name: card.name,
    cost: card.cost,
    rarity: card.rarity,
    type: card.type,
    damage: damageEVU,
    block: blockEVU,
    draw: drawEVU,
    heal: healEVU,
    statuses,
    resources,
    variance,
    risk,
    timing: 0,
    targetProfile: {
      aoe: damageTargets > 1,
      multiHit: damageHits > 1,
      targetCount: damageTargets,
    },
    totalEVU,
    priceGold,
  };
}

export interface RelicCompilerInput {
  id: string;
  name: string;
  rarity: string;
  trigger: string;
  effect: RelicEffectDefinition;
}

export interface RelicEffectDefinition {
  type: string;
  amount?: number;
  status?: string;
  stacks?: number;
  duration?: number;
  resource?: string;
  triggerRate?: number;
}

export function compileRelicProfile(
  relic: RelicCompilerInput,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): CompiledRelicProfile {
  let damage = 0;
  let block = 0;
  let draw = 0;
  let heal = 0;
  const statuses: Array<{ status: string; stacks: number; evu: number }> = [];
  const resources: Array<{ resource: string; amount: number; evu: number }> = [];

  const effect = relic.effect;
  const triggerRate = effect.triggerRate ?? 1.0;

  switch (effect.type) {
    case 'ApplyStatusAllEnemies':
      if (effect.status && effect.stacks) {
        const statusEVU = calculateStatusEVU(
          { status: effect.status, stacks: effect.stacks, duration: effect.duration ?? 1 },
          weights
        );
        statuses.push({ status: effect.status, stacks: effect.stacks, evu: statusEVU * 3 * triggerRate });
      }
      break;
    case 'GainBlock':
      block = (effect.amount ?? 0) * triggerRate;
      break;
    case 'DealTrueDamageRandomEnemy':
      damage = (effect.amount ?? 0) * triggerRate;
      break;
    case 'Heal':
      heal = (effect.amount ?? 0) * triggerRate;
      break;
    case 'DrawAndHeal':
      draw = (effect.amount ?? 0) * triggerRate;
      heal = (effect.amount ?? 0) * triggerRate;
      break;
    case 'GainEnergy':
      resources.push({ resource: 'energy', amount: effect.amount ?? 0, evu: (effect.amount ?? 0) * weights.energy * triggerRate });
      break;
  }

  const damageEVU = calculateDamageEVU({ baseDamage: damage }, weights);
  const blockEVU = calculateBlockEVU({ block }, weights);
  const drawEVU = calculateDrawEVU({ cards: draw }, weights);
  const healEVU = calculateHealEVU({ heal }, weights);
  const statusEVU = statuses.reduce((sum, s) => sum + s.evu, 0);
  const resourceEVU = resources.reduce((sum, r) => sum + r.evu, 0);

  const totalEVU = damageEVU + blockEVU + drawEVU + healEVU + statusEVU + resourceEVU;
  const priceGold = Math.floor(totalEVU / weights.gold);

  return {
    id: relic.id,
    name: relic.name,
    rarity: relic.rarity,
    damage: damageEVU,
    block: blockEVU,
    draw: drawEVU,
    heal: healEVU,
    statuses,
    resources,
    variance: 'stable',
    risk: 1.0,
    timing: 0,
    targetProfile: {
      aoe: false,
      multiHit: false,
      targetCount: 1,
    },
    totalEVU,
    priceGold,
  };
}

export interface EventOptionCompilerInput {
  eventId: string;
  optionId: string;
  text: string;
  gains: string[];
  costs: string[];
  danger: 'low' | 'medium' | 'high';
}

export function compileEventOptionProfile(
  option: EventOptionCompilerInput,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): CompiledEventOptionProfile {
  let damage = 0;
  let block = 0;
  let draw = 0;
  let heal = 0;
  const statuses: Array<{ status: string; stacks: number; evu: number }> = [];
  const resources: Array<{ resource: string; amount: number; evu: number }> = [];

  for (const gain of option.gains) {
    const match = gain.match(/(\d+)?\s*(HP|heal|gold|relic|potion|card|Intel|energy)/i);
    if (match) {
      const amount = parseInt(match[1] ?? '1', 10);
      switch (match[2].toLowerCase()) {
        case 'hp':
        case 'heal':
          heal += amount;
          break;
        case 'gold':
          resources.push({ resource: 'gold', amount, evu: amount * weights.gold });
          break;
        case 'intel':
          resources.push({ resource: 'intel', amount, evu: amount * weights.intel });
          break;
        case 'energy':
          resources.push({ resource: 'energy', amount, evu: amount * weights.energy });
          break;
      }
    }
  }

  for (const cost of option.costs) {
    const match = cost.match(/(\d+)?\s*(HP|gold|curse|Max HP)/i);
    if (match) {
      const amount = parseInt(match[1] ?? '1', 10);
      switch (match[2].toLowerCase()) {
        case 'hp':
          heal -= amount;
          break;
        case 'gold':
          resources.push({ resource: 'gold', amount: -amount, evu: -amount * weights.gold });
          break;
        case 'max hp':
          heal -= amount * 2;
          break;
      }
    }
  }

  const healEVU = calculateHealEVU({ heal }, weights);
  const resourceEVU = resources.reduce((sum, r) => sum + r.evu, 0);

  const dangerFactor = option.danger === 'low' ? 1.0 : option.danger === 'medium' ? 0.9 : 0.8;

  const totalEVU = (healEVU + resourceEVU) * dangerFactor;

  return {
    eventId: option.eventId,
    optionId: option.optionId,
    text: option.text,
    damage,
    block,
    draw,
    heal,
    statuses,
    resources,
    variance: 'stable',
    risk: dangerFactor,
    timing: 0,
    targetProfile: {
      aoe: false,
      multiHit: false,
      targetCount: 1,
    },
    totalEVU,
    danger: option.danger,
  };
}

export interface EnemyIntentCompilerInput {
  enemyId: string;
  intentId: string;
  damage?: number;
  damageHits?: number;
  block?: number;
  statuses?: Array<{ status: string; stacks: number }>;
  heal?: number;
}

export function compileEnemyIntentProfile(
  intent: EnemyIntentCompilerInput,
  weights: ValuationWeights = DEFAULT_VALUATION_WEIGHTS
): CompiledEnemyIntentProfile {
  const damage = intent.damage ?? 0;
  const damageHits = intent.damageHits ?? 1;
  const block = intent.block ?? 0;
  const heal = intent.heal ?? 0;

  const statuses = (intent.statuses ?? []).map(s => ({
    status: s.status,
    stacks: s.stacks,
    evu: calculateStatusEVU({ status: s.status, stacks: s.stacks }, weights),
  }));

  const damagePressure = calculateDamageEVU({ baseDamage: damage, hits: damageHits }, weights);
  const blockPressure = block * weights.block * 0.5;
  const statusPressure = statuses.reduce((sum, s) => sum + s.evu, 0);
  const healPressure = heal * weights.heal * 0.8;

  const pressureEVU = damagePressure + blockPressure + statusPressure + healPressure;

  return {
    enemyId: intent.enemyId,
    intentId: intent.intentId,
    damage,
    damageHits,
    block,
    statuses,
    heal,
    pressureEVU,
  };
}

export const numericProfileCompiler = {
  compileCardProfile,
  compileRelicProfile,
  compileEventOptionProfile,
  compileEnemyIntentProfile,
};

export default numericProfileCompiler;
