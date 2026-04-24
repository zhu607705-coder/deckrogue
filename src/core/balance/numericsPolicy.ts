/**
 * @file numericsPolicy.ts
 * @description 数值策略 - 定义数值修正的策略函数
 *
 * 主要职责:
 * - 定义 VARIANCE_WEIGHTS，为不同方差等级提供权重系数
 * - 实现 clampNonNegative (非负钳制) 和 applyTurnDiscount (回合折价)
 * - 实现 applyTriggerRate (触发率修正) 和 resolveVarianceWeight (方差权重解析)
 * - 应用风险调整和条件折扣到 EVU 计算中
 */
import { NUMERICS_BASELINE } from '@/core/balance/numericsBaseline';
import type { VarianceClass } from '@/core/balance/numericsTypes';

export const VARIANCE_WEIGHTS: Record<VarianceClass, number> = {
  stable: 1,
  conditional: 0.9,
  risky: 0.8,
  chaotic: 0.7
};

export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function applyTurnDiscount(value: number, turns = 0, gamma = NUMERICS_BASELINE.discounting.delayedGamma): number {
  const safeTurns = Math.max(0, turns);
  return clampNonNegative(value) * Math.pow(gamma, safeTurns);
}

export function applyTriggerRate(value: number, triggerRate = 1): number {
  return clampNonNegative(value) * Math.max(0, triggerRate);
}

export function resolveVarianceWeight(variance: VarianceClass | number | undefined): number {
  if (typeof variance === 'number' && Number.isFinite(variance)) {
    return Math.max(0, Math.min(1, variance));
  }
  return VARIANCE_WEIGHTS[variance || 'stable'] ?? 1;
}

export function applyVarianceDiscount(value: number, variance: VarianceClass | number | undefined): number {
  return clampNonNegative(value) * resolveVarianceWeight(variance);
}

export function applyRiskAdjustment(
  value: number,
  riskScore = 0,
  safeFloor = NUMERICS_BASELINE.risk.safeFloor
): number {
  const normalizedRisk = Math.max(0, Math.min(1, riskScore));
  const modifier = safeFloor + (1 - safeFloor) * (1 - normalizedRisk);
  return clampNonNegative(value) * modifier;
}

export function applySoftCap(value: number, softCap: number, excessRetention: number): number {
  const safeValue = clampNonNegative(value);
  if (safeValue <= softCap) return safeValue;
  const excess = safeValue - softCap;
  return softCap + excess * Math.max(0, Math.min(1, excessRetention));
}

export function applyArmorDiminishing(value: number, currentArmor = 0, armorSoftCap = NUMERICS_BASELINE.caps.armorSoftCap): number {
  const safeArmor = clampNonNegative(currentArmor);
  const divisor = 1 + safeArmor / Math.max(1, armorSoftCap);
  return clampNonNegative(value) / divisor;
}
