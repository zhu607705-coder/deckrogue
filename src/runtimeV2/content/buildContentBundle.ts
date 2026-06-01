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
import enemiesDataRaw from '@/content/data/enemies.json';
import relicsDataRaw from '@/content/data/relics.json';
import potionsDataRaw from '@/content/data/potions.json';
import { baseCardsData } from '@/content/narrative/cardsDataEntry';
import { charactersData, getMapRuntimeConfig } from '@/content/narrative/numericSystem';
import { getCardRouteSignal } from '@/content/narrative/routeSignals';
import { normalizeIntentPolicyIntent, parseIntentPolicyWeight, resolveIntentPolicyList } from '@/core/ai';
import type { ContentBundle } from '@/runtimeV2/contracts';

type CharacterEntry = {
  id: string;
  name?: string;
  description?: string;
  maxHp: number;
  maxEnergy: number;
  startingDeck: string[];
  extendedPool?: string[];
  specialResource?: string;
  secondaryResource?: string;
  portraitPrompt?: string;
  complexity?: 'low' | 'medium' | 'high';
  archetype?: string[];
  background?: string;
  mechanicNarrative?: string;
  loreFragments?: string[];
};

type EnemyEntry = {
  id: string;
  name?: string;
  hp_range?: number[];
  keywords?: string[];
  description?: string;
  intent_policy?: Array<{ intent?: string; weight?: number }>;
  intentPolicy?: Array<{ intent?: string; weight?: number }>;
};

type RelicEntry = {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  rarity?: string;
  corrupted?: boolean;
};

type PotionEntry = {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  rarity?: string;
};

const MAP_FLOORS = 26;
const MAP_BRANCHING = 3;

export function buildRuntimeV2ContentBundle(): ContentBundle {
  const mapRuntimeConfig = getMapRuntimeConfig();
  const characters = (charactersData as CharacterEntry[]).map((entry) => ({
    id: entry.id,
    name: entry.name ? String(entry.name) : undefined,
    description: entry.description ? String(entry.description) : undefined,
    max_hp: Math.max(1, Math.floor(Number(entry.maxHp) || 1)),
    max_energy: Math.max(1, Math.floor(Number(entry.maxEnergy) || 1)),
    starting_gold: 99,
    starting_deck: [...(entry.startingDeck || [])],
    extended_pool: [...(entry.extendedPool || [])],
    special_resource: entry.specialResource,
    secondary_resource: entry.secondaryResource,
    portrait_prompt: entry.portraitPrompt ? String(entry.portraitPrompt) : undefined,
    complexity: entry.complexity,
    archetype: [...(entry.archetype || [])],
    background: entry.background ? String(entry.background) : undefined,
    mechanic_narrative: entry.mechanicNarrative ? String(entry.mechanicNarrative) : undefined,
    lore_fragments: [...(entry.loreFragments || [])],
  }));

  const cards = baseCardsData.map((entry) => {
    const signal = getCardRouteSignal(entry);
    return {
      id: entry.id,
      name: entry.name ? String(entry.name) : undefined,
      rarity: String(entry.rarity || 'Common'),
      cost: Math.max(0, Math.floor(Number(entry.cost) || 0)),
      type: entry.type ? String(entry.type) : undefined,
      targeting: entry.targeting ? String(entry.targeting) : undefined,
      tags: [...(entry.tags || [])],
      text: entry.text ? String(entry.text) : undefined,
      upgrade: entry.upgrade ? { ...entry.upgrade } : undefined,
      character: String(entry.character || 'All'),
      route_tags: signal?.routeTags ? [...signal.routeTags] : [],
      route_signal_strength: signal?.routeSignalStrength ?? 0,
      early_game_role: signal?.earlyGameRole ?? null,
    };
  });

  const enemies = (enemiesDataRaw as EnemyEntry[]).map((entry) => {
    const minHp = Math.max(1, Math.floor(Number(entry.hp_range?.[0] ?? 1)));
    const maxHp = Math.max(minHp, Math.floor(Number(entry.hp_range?.[1] ?? minHp)));
    return {
      id: entry.id,
      name: entry.name ? String(entry.name) : undefined,
      hp_range: [minHp, maxHp] as [number, number],
      keywords: [...(entry.keywords || [])],
      description: entry.description ? String(entry.description) : undefined,
      intent_policy: resolveIntentPolicyList(entry).map((policy) => ({
        intent: normalizeIntentPolicyIntent(policy.intent),
        weight: parseIntentPolicyWeight(policy.weight, entry.id, normalizeIntentPolicyIntent(policy.intent)),
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
    name: entry.name ? String(entry.name) : undefined,
    description: entry.description ? String(entry.description) : undefined,
    price: Math.max(1, Math.floor(Number(entry.price) || 150)),
    rarity: entry.rarity ? String(entry.rarity) : undefined,
    corrupted: entry.corrupted === true ? true : undefined,
  }));

  const potions = (potionsDataRaw as PotionEntry[]).map((entry) => ({
    id: entry.id,
    name: entry.name ? String(entry.name) : undefined,
    description: entry.description ? String(entry.description) : undefined,
    price: Math.max(1, Math.floor(Number(entry.price) || 65)),
    rarity: entry.rarity ? String(entry.rarity) : undefined,
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
