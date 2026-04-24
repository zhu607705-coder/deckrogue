/**
 * @file buildContentBundle.ts
 * @description 内容包构建器，将 JSON 数据和代码定义聚合为 RuntimeV2 可用的 ContentBundle
 *
 * 主要职责:
 * - 从 characters / enemies / relics / potions JSON 读取角色、敌人、遗物、药水定义
 * - 从 cardsDataEntry 读取卡牌定义
 * - 从 numericSystem 读取地图运行时配置
 * - 输出完整的 ContentBundle 对象供规则引擎使用
 */
import charactersDataRaw from '@/content/data/characters.json';
import enemiesDataRaw from '@/content/data/enemies.json';
import relicsDataRaw from '@/content/data/relics.json';
import potionsDataRaw from '@/content/data/potions.json';
import { baseCardsData } from '@/content/narrative/cardsDataEntry';
import { getMapRuntimeConfig } from '@/content/narrative/numericSystem';
import type { ContentBundle } from '@/runtimeV2/contracts';

type CharacterEntry = {
  id: string;
  maxHp: number;
  maxEnergy: number;
  startingDeck: string[];
  extendedPool?: string[];
  specialResource?: string;
};

type EnemyEntry = {
  id: string;
  hp_range?: number[];
  keywords?: string[];
  intent_policy?: Array<{ intent?: string; weight?: number }>;
};

type RelicEntry = {
  id: string;
  price?: number;
  rarity?: string;
};

type PotionEntry = {
  id: string;
  price?: number;
};

const MAP_FLOORS = 26;
const MAP_BRANCHING = 3;

export function buildRuntimeV2ContentBundle(): ContentBundle {
  const mapRuntimeConfig = getMapRuntimeConfig();
  const characters = (charactersDataRaw as CharacterEntry[]).map((entry) => ({
    id: entry.id,
    max_hp: Math.max(1, Math.floor(Number(entry.maxHp) || 1)),
    max_energy: Math.max(1, Math.floor(Number(entry.maxEnergy) || 1)),
    starting_gold: 99,
    starting_deck: [...(entry.startingDeck || [])],
    extended_pool: [...(entry.extendedPool || [])],
    special_resource: entry.specialResource,
  }));

  const cards = baseCardsData.map((entry) => ({
    id: entry.id,
    rarity: String(entry.rarity || 'Common'),
    character: String(entry.character || 'All'),
  }));

  const enemies = (enemiesDataRaw as EnemyEntry[]).map((entry) => {
    const minHp = Math.max(1, Math.floor(Number(entry.hp_range?.[0] ?? 1)));
    const maxHp = Math.max(minHp, Math.floor(Number(entry.hp_range?.[1] ?? minHp)));
    return {
      id: entry.id,
      hp_range: [minHp, maxHp] as [number, number],
      keywords: [...(entry.keywords || [])],
      intent_policy: (entry.intent_policy || []).map((policy) => ({
        intent: String(policy.intent || 'Attack'),
        weight: Math.max(0, Number(policy.weight) || 0),
      })),
    };
  });

  const encounters = {
    normal: enemies.filter((entry) => !entry.keywords.includes('elite') && !entry.keywords.includes('boss')).map((entry) => entry.id),
    elite: enemies.filter((entry) => entry.keywords.includes('elite')).map((entry) => entry.id),
    boss: enemies.filter((entry) => entry.keywords.includes('boss')).map((entry) => entry.id),
  };

  const relics = (relicsDataRaw as RelicEntry[]).map((entry) => ({
    id: entry.id,
    price: Math.max(1, Math.floor(Number(entry.price) || 150)),
    rarity: entry.rarity ? String(entry.rarity) : undefined,
  }));

  const potions = (potionsDataRaw as PotionEntry[]).map((entry) => ({
    id: entry.id,
    price: Math.max(1, Math.floor(Number(entry.price) || 65)),
  }));

  return {
    version: 'runtime-v2-draft',
    characters,
    cards,
    relics,
    potions,
    enemies,
    map: {
      floors: MAP_FLOORS,
      branching: MAP_BRANCHING,
      runtime_strategy: {
        floor_type_caps: { ...mapRuntimeConfig.floorTypeCaps },
        opening_route_expectation: {
          max_spread: mapRuntimeConfig.openingRouteExpectation.maxSpread,
          traversal_depth: mapRuntimeConfig.openingRouteExpectation.traversalDepth,
          weights: { ...mapRuntimeConfig.openingRouteExpectation.weights },
          max_branches_per_floor: { ...mapRuntimeConfig.openingRouteExpectation.maxBranchesPerFloor },
        },
        opening_route_contrast: {
          max_floor: mapRuntimeConfig.openingRouteContrast.maxFloor,
          require_third_flavor_on_floor_1: mapRuntimeConfig.openingRouteContrast.requireThirdFlavorOnFloor1,
          utility_types: [...mapRuntimeConfig.openingRouteContrast.utilityTypes],
        },
      },
      encounters,
    },
  };
}
