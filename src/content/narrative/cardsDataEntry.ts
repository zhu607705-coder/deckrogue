import rawCardsData from '@/content/data/cards.json';
import type { CardDef } from '@/core/types';

export const baseCardsData: CardDef[] = rawCardsData as unknown as CardDef[];
export const baseCardMap = new Map(baseCardsData.map((card) => [card.id, card]));
