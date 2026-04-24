/**
 * @file CardManipulation.ts
 * @description 卡牌操作工具 - 实现查看、交换、窃取等卡牌操作
 *
 * 主要职责:
 * - 实现 peekPlayerHand，查看玩家手牌 (基于情报等级)
 * - 实现 swapPlayerCard，与玩家手牌交换
 * - 实现 stealPlayerCard，窃取玩家手牌
 * - 管理 HandKnowledge 结构，记录已知卡牌信息
 */
import type { RunCardInstance } from '@/core/types/actions';

export type CardManipulationType = 'peek' | 'swap' | 'steal' | 'discard' | 'return';

export interface CardManipulationEffect {
  type: CardManipulationType;
  targetCardIds: string[];
  source: 'enemy' | 'relic' | 'curse';
  description: string;
  canCounter: boolean;
}

export interface HandKnowledge {
  knownCards: string[];
  unknownIndices: number[];
  confidence: number;
}

export interface CardSwapResult {
  originalCard: string;
  swappedCard: string;
  reason: string;
}

export function peekPlayerHand(
  hand: RunCardInstance[],
  source: string,
  intelLevel: number = 1,
  rng: () => number = Math.random
): HandKnowledge {
  if (hand.length === 0) {
    return { knownCards: [], unknownIndices: [], confidence: 0 };
  }

  const knownCount = Math.min(Math.floor(intelLevel), hand.length);
  const shuffledIndices = [...Array(hand.length).keys()];
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }
  const knownIndices = shuffledIndices.slice(0, knownCount);
  const knownCards = knownIndices.map(i => hand[i].instanceId);
  const unknownIndices = shuffledIndices.slice(knownCount);

  return {
    knownCards,
    unknownIndices,
    confidence: knownCount / hand.length
  };
}

export function swapPlayerCards(
  hand: RunCardInstance[],
  discardPile: RunCardInstance[],
  cardAIndex: number,
  cardBIndex: number
): { hand: RunCardInstance[]; discardPile: RunCardInstance[] } {
  const newHand = [...hand];
  const newDiscardPile = [...discardPile];

  if (cardAIndex < 0 || cardAIndex >= newHand.length ||
      cardBIndex < 0 || cardBIndex >= newHand.length) {
    return { hand: newHand, discardPile: newDiscardPile };
  }

  const cardA = newHand[cardAIndex];
  const cardB = newHand[cardBIndex];

  newHand[cardAIndex] = cardB;
  newHand[cardBIndex] = cardA;

  newDiscardPile.push(cardA, cardB);

  return { hand: newHand, discardPile: newDiscardPile };
}

export function discardRandomCards(
  hand: RunCardInstance[],
  discardPile: RunCardInstance[],
  count: number,
  rng: () => number = Math.random
): { hand: RunCardInstance[]; discardPile: RunCardInstance[]; discarded: string[] } {
  const newHand = [...hand];
  const newDiscardPile = [...discardPile];
  const discarded: string[] = [];

  const actualCount = Math.min(count, newHand.length);

  for (let i = 0; i < actualCount; i++) {
    const randomIndex = Math.floor(rng() * newHand.length);
    const discardedCard = newHand.splice(randomIndex, 1)[0];
    if (discardedCard) {
      discarded.push(discardedCard.instanceId);
      newDiscardPile.push(discardedCard);
    }
  }

  return { hand: newHand, discardPile: newDiscardPile, discarded };
}

export function detectCardManipulation(
  previousHand: RunCardInstance[],
  currentHand: RunCardInstance[],
  combatLog: string[]
): CardManipulationEffect | null {
  const previousIds = new Set(previousHand.map(c => c.instanceId));
  const currentIds = new Set(currentHand.map(c => c.instanceId));

  const removedCards = previousHand.filter(c => !currentIds.has(c.instanceId));
  const addedCards = currentHand.filter(c => !previousIds.has(c.instanceId));

  if (removedCards.length === 0 && addedCards.length === 0) {
    return null;
  }

  const manipulationKeywords = ['交换', 'swap', 'discard', '丢弃', 'peek', '窥视', 'steal', '偷取'];
  const logEntry = combatLog.find(entry =>
    manipulationKeywords.some(keyword => entry.toLowerCase().includes(keyword))
  );

  let type: CardManipulationType = 'swap';
  if (removedCards.length > 0 && addedCards.length === 0) {
    type = 'discard';
  } else if (removedCards.length === 0 && addedCards.length > 0) {
    type = 'peek';
  } else if (removedCards.length === addedCards.length && removedCards.length > 1) {
    type = 'swap';
  }

  let source: 'enemy' | 'relic' | 'curse' = 'enemy';
  if (logEntry) {
    if (logEntry.toLowerCase().includes('relic') || logEntry.toLowerCase().includes('遗物')) {
      source = 'relic';
    } else if (logEntry.toLowerCase().includes('curse') || logEntry.toLowerCase().includes('诅咒')) {
      source = 'curse';
    }
  }

  const targetCardIds = [
    ...removedCards.map(c => c.instanceId),
    ...addedCards.map(c => c.instanceId)
  ];

  return {
    type,
    targetCardIds,
    source,
    description: logEntry || `检测到手牌被${type}操控`,
    canCounter: source !== 'curse'
  };
}

export function isCardManipulationImmune(playerStatuses: Record<string, number>): boolean {
  const immunityStatuses = ['WarpShield', 'TemporalStasis', 'Immutable', 'Untouchable'];
  return immunityStatuses.some(status => (playerStatuses[status] ?? 0) > 0);
}

export function applyManipulationEffect(
  effect: CardManipulationEffect,
  hand: RunCardInstance[],
  discardPile: RunCardInstance[]
): { hand: RunCardInstance[]; discardPile: RunCardInstance[] } {
  let newHand = [...hand];
  let newDiscardPile = [...discardPile];

  switch (effect.type) {
    case 'peek':
      break;

    case 'swap':
      if (effect.targetCardIds.length >= 2) {
        const idsToSwap = effect.targetCardIds.slice(0, 2);
        const indices = idsToSwap.map(id => newHand.findIndex(c => c.instanceId === id));
        if (indices[0] !== -1 && indices[1] !== -1) {
          const temp = newHand[indices[0]];
          newHand[indices[0]] = newHand[indices[1]];
          newHand[indices[1]] = temp;
        }
      }
      break;

    case 'steal':
    case 'discard':
      const cardsToDiscard = newHand.filter(c => effect.targetCardIds.includes(c.instanceId));
      newDiscardPile = [...newDiscardPile, ...cardsToDiscard];
      newHand = newHand.filter(c => !effect.targetCardIds.includes(c.instanceId));
      break;

    case 'return':
      const cardsToReturn = newHand.filter(c => effect.targetCardIds.includes(c.instanceId));
      newDiscardPile = [...newDiscardPile, ...cardsToReturn];
      newHand = newHand.filter(c => !effect.targetCardIds.includes(c.instanceId));
      break;
  }

  return { hand: newHand, discardPile: newDiscardPile };
}

export function createManipulationEffect(
  type: CardManipulationType,
  targetCardIds: string[],
  source: 'enemy' | 'relic' | 'curse',
  description: string,
  canCounter: boolean = true
): CardManipulationEffect {
  return {
    type,
    targetCardIds,
    source,
    description,
    canCounter
  };
}

export function validateManipulationTargets(
  hand: RunCardInstance[],
  targetCardIds: string[]
): { valid: boolean; validIds: string[]; invalidIds: string[] } {
  const handIds = new Set(hand.map(c => c.instanceId));
  const validIds: string[] = [];
  const invalidIds: string[] = [];

  for (const id of targetCardIds) {
    if (handIds.has(id)) {
      validIds.push(id);
    } else {
      invalidIds.push(id);
    }
  }

  return {
    valid: invalidIds.length === 0,
    validIds,
    invalidIds
  };
}
