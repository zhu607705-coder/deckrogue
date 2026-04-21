export const ASSET_PLACEHOLDERS = {
  card: '/assets/cards/strike.png',
  relic: '/assets/relics/anchor.png',
  potion: '/assets/potions/healing_potion.png',
  character: '/assets/characters/informant.png',
  enemy: '/assets/enemies/goblin.png',
  mapRoom: '/assets/map/map_event.svg',
  merchant: '/assets/map/map_shop.svg'
} as const;

export function localCardArt(id: string): string {
  return `/assets/cards/${id}.png`;
}

const KNOWN_ENEMY_ART = new Set([
  'alchemy_master',
  'barrier',
  'chaos_egg',
  'cultist',
  'fission',
  'fission_small',
  'goblin',
  'gremlin_nob',
  'hexaghost',
  'intelligence_officer',
  'jaw_worm',
  'lagavulin',
  'martyr_frenzy',
  'predictor',
  'puppet_queen',
  'slime_boss',
  'slime_small',
  'slime_small_glass',
  'slime_small_rot',
  'symbiote_a',
  'symbiote_b',
  'time_guardian',
  'goblin_trapper',
  'barrier_redeemer',
  'cultist_herald',
  'jaw_worm_burrower',
]);

export function localEnemyArt(id: string): string {
  return KNOWN_ENEMY_ART.has(id) ? `/assets/enemies/${id}.png` : ASSET_PLACEHOLDERS.enemy;
}

export function bindImgFallback(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackSrc: string
): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === '1') {
    return;
  }
  img.dataset.fallbackApplied = '1';
  img.src = fallbackSrc;
}
import type { SyntheticEvent } from 'react';
