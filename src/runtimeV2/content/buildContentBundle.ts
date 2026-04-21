import charactersDataRaw from '@/content/data/characters.json';
import cardsDataRaw from '@/content/data/cards.json';
import enemiesDataRaw from '@/content/data/enemies.json';
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

type CardEntry = {
  id: string;
  rarity?: string;
  character?: string;
};

const MAP_FLOORS = 26;
const MAP_BRANCHING = 3;

export function buildRuntimeV2ContentBundle(): ContentBundle {
  const characters = (charactersDataRaw as CharacterEntry[]).map((entry) => ({
    id: entry.id,
    max_hp: Math.max(1, Math.floor(Number(entry.maxHp) || 1)),
    max_energy: Math.max(1, Math.floor(Number(entry.maxEnergy) || 1)),
    starting_gold: 99,
    starting_deck: [...(entry.startingDeck || [])],
    extended_pool: [...(entry.extendedPool || [])],
    special_resource: entry.specialResource,
  }));

  const cards = (cardsDataRaw as CardEntry[]).map((entry) => ({
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

  return {
    version: 'runtime-v2-draft',
    characters,
    cards,
    enemies,
    map: {
      floors: MAP_FLOORS,
      branching: MAP_BRANCHING,
      encounters,
    },
  };
}
