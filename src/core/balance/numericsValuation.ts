import { NUMERICS_BASELINE } from '@/core/balance/numericsBaseline';
import { armorToEVU, blockToEVU, damageToEVU, drawToEVU, energyToEVU, goldToEVU, healToEVU, statusToEVU } from '@/core/balance/numericsFormulas';
import type { CardValuationInput, RelicValuationInput, StatusValuationInput, ValuationContext } from '@/core/balance/numericsTypes';

const DEFAULT_RARITY_FACTORS: Record<string, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.6,
  Common: 1,
  Uncommon: 1.25,
  Rare: 1.6
};

const DEFAULT_TYPE_FACTORS: Record<string, number> = {
  attack: 1,
  Attack: 1,
  skill: 1.05,
  Skill: 1.05,
  power: 1.15,
  Power: 1.15,
  warp: 1.1,
  delay: 1.05
};

const DEFAULT_STATUS_FACTORS: Record<string, number> = {
  Strength: 1.2,
  Vulnerable: 1.15,
  Weak: 1,
  Fear: 0.95,
  Poison: 1.1,
  Burn: 1.05,
  PlatedArmor: 1.1
};

export function createValuationContext(): ValuationContext {
  return {
    baseline: NUMERICS_BASELINE,
    varianceWeights: {
      stable: 1,
      conditional: 0.9,
      risky: 0.8,
      chaotic: 0.7
    },
    rarityFactors: { ...DEFAULT_RARITY_FACTORS },
    typeFactors: { ...DEFAULT_TYPE_FACTORS },
    statusFactors: { ...DEFAULT_STATUS_FACTORS }
  };
}

export function evaluateStatusEVU(context: ValuationContext, input: StatusValuationInput): number {
  const factor = context.statusFactors[input.status] ?? 1;
  return statusToEVU(input.stacks, factor, {
    timingTurns: input.timingTurns ?? Math.max(0, (input.duration ?? 1) - 1),
    triggerRate: input.triggerRate,
    variance: input.variance,
    riskScore: input.riskScore,
    targetFactor: input.targetFactor
  });
}

export function evaluateCardEVU(context: ValuationContext, input: CardValuationInput): number {
  const typeFactor = context.typeFactors[input.type || 'attack'] ?? 1;
  const rarityFactor = context.rarityFactors[input.rarity || 'common'] ?? 1;
  const sharedModifiers = {
    timingTurns: input.timingTurns,
    triggerRate: input.triggerRate,
    variance: input.variance,
    riskScore: input.riskScore,
    targetFactor: input.targetFactor
  };

  let total =
    damageToEVU(input.damage || 0, sharedModifiers) +
    blockToEVU(input.block || 0, sharedModifiers) +
    armorToEVU(input.armor || 0, 0, sharedModifiers) +
    drawToEVU(input.draw || 0, sharedModifiers) +
    healToEVU(input.heal || 0, sharedModifiers);

  for (const status of input.statuses || []) {
    total += evaluateStatusEVU(context, status);
  }

  total *= typeFactor * rarityFactor;
  return total;
}

export function evaluateCardEfficiency(context: ValuationContext, input: CardValuationInput): number {
  const evu = evaluateCardEVU(context, input);
  const energyBudget = Math.max(0.25, energyToEVU(Math.max(0, input.cost)));
  return input.cost <= 0 ? evu * 2 : evu / energyBudget;
}

export function evaluateRelicEVU(_context: ValuationContext, input: RelicValuationInput): number {
  const triggerRate = input.triggerRate ?? NUMERICS_BASELINE.discounting.relicTriggerRate;
  const durationTurns = input.durationTurns ?? NUMERICS_BASELINE.discounting.expectedTurnsPerCombat;
  return input.effectEVU * triggerRate * Math.max(1, durationTurns);
}

export function evaluateEconomyEVU(gold = 0, draw = 0, heal = 0): number {
  return goldToEVU(gold) + drawToEVU(draw) + healToEVU(heal);
}
