/**
 * @file routeAdvisorDeck.ts
 * @description Converts runtime-v2 deck ids into card instances for route advisors.
 */

import { cardsData } from '@/content/narrative/numericSystem';
import type { RunCardInstance } from '@/core/types/actions';

function normalizeRuntimeDeckCardId(cardId: string): string {
  return cardId.replace(/[+*]+$/g, '');
}

function createRuntimeRouteCard(cardId: string, index: number): RunCardInstance | null {
  const normalizedCardId = normalizeRuntimeDeckCardId(cardId);
  const card = cardsData.find((entry) => entry.id === normalizedCardId);
  if (!card) return null;
  const isUpgraded = cardId.includes('+');
  return {
    ...card,
    id: card.id,
    instanceId: `${index}:${cardId}`,
    baseCardId: card.id,
    runtimeBase: card,
    isUpgraded,
    persistentEnchantments: cardId.includes('*')
      ? [
          {
            id: 'runtime_projected_enchantment',
            name: 'Runtime Projected Enchantment',
            description: 'Projected runtime-v2 enchantment marker.',
            scope: 'persistent',
            effect: { type: 'damage', amount: 0 },
          },
        ]
      : [],
    combatAfflictions: [],
  };
}

export function createRuntimeRouteDeck(deck: readonly string[]): RunCardInstance[] {
  return deck.map(createRuntimeRouteCard).filter((card): card is RunCardInstance => !!card);
}
