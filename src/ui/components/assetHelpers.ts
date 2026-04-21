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
