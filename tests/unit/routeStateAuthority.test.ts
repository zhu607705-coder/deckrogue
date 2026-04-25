/**
 * @file routeStateAuthority.test.ts
 * @description Unit tests for route state authority and committed route outranking.
 *
 * 主要职责:
 * - 测试已提交路由状态优先于近期卡牌信号
 * - 测试路由状态的权威性判定
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cardsData, getKnownRouteTagsForCharacter } from '@/content/narrative/numericSystem';
import { getPreferredRouteTagFromState } from '@/content/narrative/routeState';
import type { RouteState, RunCardInstance } from '@/core/types';

function makeRuntimeCard(cardId: string, instanceId: string): RunCardInstance {
  const card = cardsData.find((entry) => entry.id === cardId);
  assert.ok(card, `missing card ${cardId}`);
  return {
    ...card!,
    instanceId,
    baseCardId: card!.id,
    runtimeBase: card!,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
}

test('authoritative committed routeState outranks recent off-route deck signal even without recent commits', () => {
  const knownRouteTags = getKnownRouteTagsForCharacter('chronomancer');
  const deck = [
    makeRuntimeCard('warp_surge', 'warp-confirm'),
    makeRuntimeCard('temporal_mastery', 'warp-payoff'),
    makeRuntimeCard('time_bomb', 'off-route-recent'),
  ];
  const routeState: RouteState = {
    primaryTag: 'chronomancer:warp',
    secondaryTag: 'chronomancer:time_layer',
    confidence: 74,
    stage: 'committed',
    recentCommits: [],
  };

  assert.equal(getPreferredRouteTagFromState(deck, knownRouteTags, routeState), 'chronomancer:warp');
});

test('pivoting routeState can follow repeated recent commits away from stale primary tag', () => {
  const knownRouteTags = getKnownRouteTagsForCharacter('chronomancer');
  const deck = [
    makeRuntimeCard('warp_surge', 'warp-confirm'),
    makeRuntimeCard('time_bomb', 'pivot-confirm-1'),
    makeRuntimeCard('delayed_blast', 'pivot-payoff-1'),
  ];
  const routeState: RouteState = {
    primaryTag: 'chronomancer:warp',
    secondaryTag: 'chronomancer:delay',
    confidence: 58,
    stage: 'pivoting',
    recentCommits: [
      { tag: 'chronomancer:warp', source: 'reward', floor: 2, weight: 16 },
      { tag: 'chronomancer:delay', source: 'event', floor: 4, weight: 28 },
      { tag: 'chronomancer:delay', source: 'shop', floor: 5, weight: 20 },
    ],
  };

  assert.equal(getPreferredRouteTagFromState(deck, knownRouteTags, routeState), 'chronomancer:delay');
});
