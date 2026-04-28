/**
 * @file standeeArt.ts
 * @description Canonical runtime paths for lossless optimized artwork.
 */

export function localCardArt(id: string): string {
  return `/assets/cards/${id}.webp`;
}

const WEBP_CHARACTER_IDS = new Set([
  'alchemist',
  'brute',
  'chronomancer',
  'informant',
  'penitent_judge',
  'puppeteer',
  'tactician',
  'void_sanctioner',
]);

const WEBP_ENEMY_IDS = new Set([
  'alchemy_master',
  'barrier',
  'blight_larva',
  'card_swap',
  'catacomb_matron',
  'cathedral_engine',
  'chaos_egg',
  'coolant_hound',
  'corrupt_titanus',
  'cultist',
  'cyst_bearer',
  'data_leech',
  'fission',
  'fission_small',
  'fusion_censer',
  'goblin',
  'grave_mender',
  'gremlin_nob',
  'hexaghost',
  'intelligence_officer',
  'iron_choir_twin_a',
  'iron_choir_twin_b',
  'jaw_worm',
  'lagavulin',
  'logic_saint',
  'maggot_reliquary',
  'martyr_frenzy',
  'mind_peek',
  'mire_guard',
  'overclocked_abbot',
  'plague_abbot',
  'plague_choir',
  'pox_cathedral',
  'predictor',
  'psychic_infiltrator',
  'puppet_queen',
  'reactor_thrall',
  'rot_hound',
  'sanctum_praetor',
  'scrap_surgeon',
  'servo_confessor',
  'slime_boss',
  'slime_small',
  'spore_wretch',
  'symbiote_a',
  'symbiote_b',
  'the_mire_saint',
  'time_guardian',
]);

const WEBP_EVENT_IDS = new Set([
  'event_martyr_shrine',
  'event_rusting_medicae',
  'npc_inquisitor_interrogator',
  'npc_medicae_servitor',
  'npc_shrine_warden',
  'npc_warp_oracle',
]);

const WEBP_SHOP_IDS = new Set([
  'shop_merchant_salvager',
  'shop_salvage_exchange',
]);

function localOptimizedArt(kind: 'characters' | 'enemies' | 'events' | 'shop', id: string, webpIds: Set<string>): string {
  return `/assets/${kind}/${id}.${webpIds.has(id) ? 'webp' : 'png'}`;
}

export function localCharacterArt(id: string): string {
  return localOptimizedArt('characters', id, WEBP_CHARACTER_IDS);
}

export function localEnemyArt(id: string): string {
  return localOptimizedArt('enemies', id, WEBP_ENEMY_IDS);
}

export function localEventArt(id: string): string {
  return localOptimizedArt('events', id, WEBP_EVENT_IDS);
}

export function localShopArt(id: string): string {
  return localOptimizedArt('shop', id, WEBP_SHOP_IDS);
}
