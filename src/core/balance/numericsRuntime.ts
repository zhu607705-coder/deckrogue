import { NUMERICS_BASELINE } from '@/core/balance/numericsBaseline';
import { ECONOMY_DEFAULTS } from '@/core/balance/numericConstants';
import { createValuationContext, evaluateCardEVU, evaluateCardEfficiency, evaluateRelicEVU } from '@/core/balance/numericsValuation';
import { derivePriceGold, floorScalingMultiplier } from '@/core/balance/numericsFormulas';
import type { CardValuationInput, PriceQuote, RewardQuote, ValuationContext } from '@/core/balance/numericsTypes';

export function createRuntimeNumericsContext(): ValuationContext {
  return createValuationContext();
}

export function quoteCardValue(input: CardValuationInput): { evu: number; efficiency: number } {
  const context = createRuntimeNumericsContext();
  const evu = evaluateCardEVU(context, input);
  return {
    evu,
    efficiency: evaluateCardEfficiency(context, input)
  };
}

export function quoteRelicPrice(effectEVU: number, rarityFactor = 1): PriceQuote {
  return derivePriceGold(effectEVU, {
    rarityFactor,
    minPrice: NUMERICS_BASELINE.pricing.relicBase
  });
}

export function quotePotionPrice(effectEVU: number, floorMultiplier = 1): PriceQuote {
  return derivePriceGold(effectEVU, {
    floorMultiplier,
    minPrice: NUMERICS_BASELINE.pricing.potionBase
  });
}

export function quoteCardPrice(cardEVU: number, floorMultiplier = 1): PriceQuote {
  return derivePriceGold(cardEVU, {
    floorMultiplier,
    minPrice: NUMERICS_BASELINE.pricing.cardCommon
  });
}

export function quoteRemovalPrice(removedCards: number): number {
  return NUMERICS_BASELINE.pricing.removalBase + removedCards * NUMERICS_BASELINE.pricing.removalStep;
}

export function calculateEnemyRuntimeScaling(floor: number): { hpMultiplier: number; damageMultiplier: number } {
  return {
    hpMultiplier: floorScalingMultiplier(floor, { linearGrowth: 0.15, logDivisor: 10 }),
    damageMultiplier: floorScalingMultiplier(floor, { linearGrowth: 0.1, logDivisor: 10 })
  };
}

export function calculateRewardRuntime(
  floor: number,
  options?: { isElite?: boolean; isBoss?: boolean; cardChoiceBonus?: number }
): RewardQuote {
  const isElite = !!options?.isElite;
  const isBoss = !!options?.isBoss;
  const hpScale = floorScalingMultiplier(floor, { linearGrowth: 0.08, logDivisor: 10 });
  const baseGold = ECONOMY_DEFAULTS.config.baseGoldReward + (floor - 1) * ECONOMY_DEFAULTS.config.goldPerFloor;
  const gold = Math.floor(baseGold * (isBoss ? 3 : isElite ? 2 : 1));
  const cardChoices = Math.max(1, Math.round((isBoss ? 2 : isElite ? 1.5 : 1) + (options?.cardChoiceBonus || 0)));
  return {
    gold,
    cardChoices,
    potionChance: Math.min(0.5, 0.25 + floor * 0.02),
    relicChance: isBoss ? 1 : Math.min(1, 0.1 * hpScale * (isElite ? 2 : 1))
  };
}
