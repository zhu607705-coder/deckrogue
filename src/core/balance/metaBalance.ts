import metaBalanceJson from '@/content/data/metaBalance.json';

export type MetaBalanceConfig = typeof metaBalanceJson;

export const metaBalance: MetaBalanceConfig = metaBalanceJson;

export function getMetaUnlockedWeightBonus(): number {
  return Math.max(0, Number(metaBalance.poolWeights?.metaUnlockedWeightBonus ?? 0));
}

export function getAscensionMaxLevel(): number {
  return Math.max(0, Math.floor(Number((metaBalance as any).ascension?.maxLevel ?? 0)));
}

export function getAscensionLevelConfig(level: number): any | null {
  const normalized = Math.max(0, Math.floor(Number(level) || 0));
  if (normalized <= 0) return null;
  const levels = (metaBalance as any).ascension?.levels;
  if (!levels || typeof levels !== 'object') return null;
  return levels[String(normalized)] || null;
}
