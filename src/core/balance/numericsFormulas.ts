import { NUMERICS_BASELINE } from '@/core/balance/numericsBaseline';
import { applyArmorDiminishing, applyRiskAdjustment, applySoftCap, applyTriggerRate, applyTurnDiscount, applyVarianceDiscount, clampNonNegative } from '@/core/balance/numericsPolicy';
import type { PriceQuote, ValuationModifiers, VarianceClass } from '@/core/balance/numericsTypes';

function applyModifiers(baseEVU: number, modifiers: ValuationModifiers = {}): number {
  const timed = applyTurnDiscount(baseEVU, modifiers.timingTurns);
  const triggered = applyTriggerRate(timed, modifiers.triggerRate);
  const varianceAdjusted = applyVarianceDiscount(triggered, modifiers.variance);
  const riskAdjusted = applyRiskAdjustment(varianceAdjusted, modifiers.riskScore);
  return riskAdjusted * Math.max(0, modifiers.targetFactor ?? 1);
}

export function energyToEVU(energy: number, modifiers?: ValuationModifiers): number {
  return applyModifiers(clampNonNegative(energy) * NUMERICS_BASELINE.evu.energy, modifiers);
}

export function damageToEVU(damage: number, modifiers?: ValuationModifiers): number {
  return applyModifiers(clampNonNegative(damage) * NUMERICS_BASELINE.evu.damage, modifiers);
}

export function blockToEVU(block: number, modifiers?: ValuationModifiers): number {
  return applyModifiers(clampNonNegative(block) * NUMERICS_BASELINE.evu.block, modifiers);
}

export function armorToEVU(armor: number, currentArmor = 0, modifiers?: ValuationModifiers): number {
  const base = applyArmorDiminishing(clampNonNegative(armor) * NUMERICS_BASELINE.evu.armor, currentArmor);
  return applyModifiers(base, modifiers);
}

export function drawToEVU(draw: number, modifiers?: ValuationModifiers): number {
  return applyModifiers(clampNonNegative(draw) * NUMERICS_BASELINE.evu.draw, modifiers);
}

export function healToEVU(heal: number, modifiers?: ValuationModifiers): number {
  return applyModifiers(clampNonNegative(heal) * NUMERICS_BASELINE.evu.heal, modifiers);
}

export function goldToEVU(gold: number, modifiers?: ValuationModifiers): number {
  return applyModifiers(clampNonNegative(gold) * NUMERICS_BASELINE.evu.gold, modifiers);
}

export function statusToEVU(stacks: number, factor = 1, modifiers?: ValuationModifiers): number {
  const raw = clampNonNegative(stacks) * NUMERICS_BASELINE.evu.status * Math.max(0, factor);
  const capped = applySoftCap(raw, NUMERICS_BASELINE.caps.statusSoftCapStacks * NUMERICS_BASELINE.evu.status, NUMERICS_BASELINE.caps.statusSoftCapExcessRetention);
  return applyModifiers(capped, modifiers);
}

export function warpPowerMultiplier(warpTide: number, alpha = NUMERICS_BASELINE.risk.warpAlpha): number {
  const W = Math.max(0, Math.min(100, warpTide));
  return 1 + alpha * Math.pow(W / 100, 2);
}

export function warpPerilChance(warpTide: number, sensitivity = NUMERICS_BASELINE.risk.perilK): number {
  const W = Math.max(0, Math.min(100, warpTide));
  const numerator = Math.exp(sensitivity * W) - 1;
  const denominator = Math.exp(100 * sensitivity) - 1;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export function derivePriceGold(
  evu: number,
  options?: {
    floorMultiplier?: number;
    rarityFactor?: number;
    shopFactor?: number;
    minPrice?: number;
  }
): PriceQuote {
  const floorMultiplier = Math.max(0.1, options?.floorMultiplier ?? 1);
  const rarityFactor = Math.max(0.1, options?.rarityFactor ?? 1);
  const shopFactor = Math.max(0.1, options?.shopFactor ?? 1);
  const rawGold = clampNonNegative(evu) / NUMERICS_BASELINE.evu.gold * floorMultiplier * rarityFactor * shopFactor;
  const gold = Math.max(Math.floor(options?.minPrice ?? 0), Math.floor(rawGold));
  return { evu: clampNonNegative(evu), gold };
}

export function floorScalingMultiplier(
  floor: number,
  options?: {
    linearGrowth?: number;
    logDivisor?: number;
  }
): number {
  const safeFloor = Math.max(1, floor);
  const linearGrowth = options?.linearGrowth ?? 0.1;
  const logDivisor = options?.logDivisor ?? 10;
  const logarithmicDampening = Math.log10(1 + safeFloor / logDivisor);
  return 1 + (safeFloor - 1) * linearGrowth * logarithmicDampening;
}

export function multiHitAdjustedDamage(baseDamage: number, hits: number, perAdditionalHitPenalty = 0.1, minScalingFactor = 0.5): number {
  const safeHits = Math.max(1, Math.floor(hits));
  const scalingFactor = 1 - (safeHits - 1) * perAdditionalHitPenalty;
  return Math.floor(clampNonNegative(baseDamage) * safeHits * Math.max(minScalingFactor, scalingFactor));
}

export function classifyVarianceFromTags(tags: string[] = []): VarianceClass {
  const lowered = tags.map((tag) => String(tag).toLowerCase());
  if (lowered.some((tag) => ['chaos', 'random', 'gamble'].includes(tag))) return 'chaotic';
  if (lowered.some((tag) => ['warp', 'corruption', 'risk'].includes(tag))) return 'risky';
  if (lowered.some((tag) => ['conditional', 'combo', 'delay'].includes(tag))) return 'conditional';
  return 'stable';
}
