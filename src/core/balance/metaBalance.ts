/**
 * @file metaBalance.ts
 * @description Meta平衡配置 - 管理游戏的元数据平衡配置
 *
 * 主要职责:
 * - 从 JSON 配置文件加载 MetaBalanceConfig
 * - 提供 ascension (攀登难度) 相关的配置查询接口
 * - 提供 unlock 权重加成的查询接口
 * - 作为游戏元层面数值平衡的单一数据源
 */
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
  const levels = (metaBalance as any).ascension?.levels;
  if (!levels || typeof levels !== 'object') return null;
  return levels[String(normalized)] || null;
}
