/**
 * @file numericMath.ts
 * @description 数值数学工具 - 提供伤害计算中的基础数学运算
 *
 * 主要职责:
 * - 提供 clampNumber (数值钳制) 和 quantizeFloat (浮点数量化) 等基础数学运算
 * - 实现 normalizeDamageBase (伤害基础值标准化)
 * - 实现 applyDamageMultiplierStep (伤害乘数步骤计算)
 * - 实现 finalizeDamage (最终伤害值计算)
 */
import { COMBAT_NUMBERS, NUMERIC_PRECISION } from '@/core/balance/numericConstants';

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function quantizeFloat(value: number, decimals: number = NUMERIC_PRECISION.internalFloatDecimals): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function floorInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

export function normalizeDamageBase(value: number): number {
  return Math.max(COMBAT_NUMBERS.damage.min, floorInt(quantizeFloat(value)));
}

export function applyDamageMultiplierStep(baseDamage: number, multiplier: number): number {
  const safeBase = Math.max(COMBAT_NUMBERS.damage.min, quantizeFloat(baseDamage));
  const safeMultiplier = Math.max(0, quantizeFloat(multiplier));
  return Math.max(COMBAT_NUMBERS.damage.min, floorInt(quantizeFloat(safeBase * safeMultiplier)));
}

export function finalizeDamage(value: number): number {
  return Math.max(COMBAT_NUMBERS.damage.min, floorInt(quantizeFloat(value)));
}

