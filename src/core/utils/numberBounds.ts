/**
 * @file numberBounds.ts
 * @description 数值边界工具 - 定义游戏数值的有效范围和钳制函数
 *
 * 主要职责:
 * - 定义 NumberBounds 接口，描述数值的最小和最大值
 * - 定义 DEFAULT_BOUNDS，为 HP、能量、护盾、伤害、金币等定义默认边界
 * - 实现 clamp 函数，将数值钳制到指定范围内
 * - 为数值系统提供边界保护
 */
export interface NumberBounds {
  min: number;
  max: number;
}

export const DEFAULT_BOUNDS = {
  HP: { min: 0, max: 999 },
  ENERGY: { min: 0, max: 10 },
  BLOCK: { min: 0, max: 999 },
  DAMAGE: { min: 0, max: 999 },
  STATUS_STACKS: { min: 0, max: 99 },
  GOLD: { min: 0, max: 9999 },
  CARD_COST: { min: -2, max: 10 },
  DECK_SIZE: { min: 0, max: 99 },
  HAND_SIZE: { min: 0, max: 10 },
  FLOOR: { min: 1, max: 50 },
  ASCENSION: { min: 0, max: 20 },
  CORRUPTION: { min: 0, max: 100 },
  RESONANCE: { min: 0, max: 100 },
  TIME_LAYER: { min: 0, max: 100 },
  THREAD: { min: 0, max: 100 },
  CONCOCTION: { min: 0, max: 100 },
  INTEL: { min: 0, max: 100 },
  COMMAND: { min: 0, max: 100 },
  RAGE: { min: 0, max: 100 },
  DEVOTION: { min: 0, max: 100 }
} as const;

export function clamp(value: number, bounds: NumberBounds): number {
  return Math.max(bounds.min, Math.min(bounds.max, value));
}

export function clampHp(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.HP);
}

export function clampEnergy(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.ENERGY);
}

export function clampBlock(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.BLOCK);
}

export function clampDamage(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.DAMAGE);
}

export function clampStatusStacks(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.STATUS_STACKS);
}

export function clampGold(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.GOLD);
}

export function clampCardCost(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.CARD_COST);
}

export function clampFloor(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.FLOOR);
}

export function clampAscension(value: number): number {
  return clamp(value, DEFAULT_BOUNDS.ASCENSION);
}

export function clampResource(value: number, resourceType: keyof typeof DEFAULT_BOUNDS): number {
  const bounds = DEFAULT_BOUNDS[resourceType];
  if (!bounds) {
    console.warn(`Unknown resource type: ${resourceType}`);
    return value;
  }
  return clamp(value, bounds);
}

export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (isValidNumber(value)) return value;
  return defaultValue;
}

export function safePositiveNumber(value: unknown, defaultValue: number = 1): number {
  if (isValidNumber(value) && value > 0) return value;
  return defaultValue;
}

export function safeNonNegativeNumber(value: unknown, defaultValue: number = 0): number {
  if (isValidNumber(value) && value >= 0) return value;
  return defaultValue;
}

export function safeInteger(value: unknown, defaultValue: number = 0): number {
  if (isValidNumber(value) && Number.isInteger(value)) return value;
  return defaultValue;
}

export function safePercentage(value: unknown, defaultValue: number = 0): number {
  if (isValidNumber(value)) {
    return clamp(value, { min: 0, max: 100 });
  }
  return defaultValue;
}

export function safeRatio(value: unknown, defaultValue: number = 0): number {
  if (isValidNumber(value)) {
    return clamp(value, { min: 0, max: 1 });
  }
  return defaultValue;
}

export function isWithinBounds(value: number, bounds: NumberBounds): boolean {
  return value >= bounds.min && value <= bounds.max;
}

export function validateNumber(value: unknown, bounds: NumberBounds, defaultValue: number): number {
  if (!isValidNumber(value)) return defaultValue;
  return clamp(value, bounds);
}

export function safeAdd(a: unknown, b: unknown, bounds: NumberBounds, defaultValue: number = 0): number {
  const numA = safeNumber(a, 0);
  const numB = safeNumber(b, 0);
  return clamp(numA + numB, bounds);
}

export function safeSubtract(a: unknown, b: unknown, bounds: NumberBounds, defaultValue: number = 0): number {
  const numA = safeNumber(a, 0);
  const numB = safeNumber(b, 0);
  return clamp(numA - numB, bounds);
}

export function safeMultiply(a: unknown, b: unknown, bounds: NumberBounds, defaultValue: number = 0): number {
  const numA = safeNumber(a, 0);
  const numB = safeNumber(b, 0);
  return clamp(numA * numB, bounds);
}

export function safeDivide(a: unknown, b: unknown, bounds: NumberBounds, defaultValue: number = 0): number {
  const numA = safeNumber(a, 0);
  const numB = safeNumber(b, 1);
  if (numB === 0) return defaultValue;
  return clamp(numA / numB, bounds);
}

export function safePercentOf(value: unknown, total: unknown, bounds: NumberBounds): number {
  const numValue = safeNumber(value, 0);
  const numTotal = safeNumber(total, 1);
  if (numTotal === 0) return 0;
  return clamp((numValue / numTotal) * 100, bounds);
}

export function roundToDecimal(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function floorToDecimal(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}

export function ceilToDecimal(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(value * factor) / factor;
}
