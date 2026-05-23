/**
 * @file restHealing.ts
 * @description Shared rest-site healing math for legacy and runtime-v2 surfaces.
 */

export function calculateRestHealAmount(maxHp: number): number {
  if (!Number.isFinite(maxHp) || maxHp <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(maxHp * 0.3));
}
