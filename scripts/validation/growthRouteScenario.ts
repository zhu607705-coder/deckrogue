/**
 * @file growthRouteScenario.ts
 * @description 成长路线场景构建工具，为路线测试创建标准化的游戏状态。
 *
 * 主要职责:
 * - 提供种子驱动的路线场景构建函数
 * - 生成路线确认卡牌的运行时实例
 * - 设置最近选择覆盖的游戏引擎状态
 */

import { cardsData, getCardRouteSignal, getKnownRouteTagsForCharacter } from '@/content/narrative/numericSystem';
import { GameEngine } from '@/core/events/gameEngine';
import type { RunCardInstance } from '@/core/types';

function getRouteConfirmCardId(characterId: string, routeTag: string): string {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_confirm';
  });
  if (!card) {
    throw new Error(`Missing route-confirm card for ${characterId}:${routeTag}`);
  }
  return card.id;
}

function makeRuntimeCard(cardId: string, instanceId: string): RunCardInstance {
  const card = cardsData.find((entry) => entry.id === cardId);
  if (!card) {
    throw new Error(`Missing card ${cardId}`);
  }
  return {
    ...card,
    instanceId,
    baseCardId: card.id,
    runtimeBase: card,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
}

export function seedRecentChoiceOverrideScenario(engine: GameEngine, characterId: string, seed: number) {
  const knownRouteTags = getKnownRouteTagsForCharacter(characterId);
  if (knownRouteTags.length < 2) {
    throw new Error(`Expected at least two route tags for ${characterId}`);
  }
  const deckDominantTag = knownRouteTags[seed % knownRouteTags.length]!;
  const preferredRecentTag = knownRouteTags[(seed + 1) % knownRouteTags.length]!;
  if (deckDominantTag === preferredRecentTag) {
    throw new Error(`Recent-choice override scenario requires distinct tags for ${characterId}`);
  }

  const staleCardId = getRouteConfirmCardId(characterId, deckDominantTag);
  const recentCardId = getRouteConfirmCardId(characterId, preferredRecentTag);
  engine.state.player.deck.push(makeRuntimeCard(staleCardId, `stale-a-${seed}`));
  engine.state.player.deck.push(makeRuntimeCard(staleCardId, `stale-b-${seed}`));
  engine.state.player.deck.push(makeRuntimeCard(staleCardId, `stale-c-${seed}`));
  engine.state.player.deck.push(makeRuntimeCard(recentCardId, `recent-${seed}`));
  engine.state.currentNodeId = engine.state.map.find((node) => node.y === 1)?.id ?? engine.state.currentNodeId;

  return { deckDominantTag, preferredRecentTag };
}
