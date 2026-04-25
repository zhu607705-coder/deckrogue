/**
 * @file shopRouteAdvisor.test.ts
 * @description Unit tests for shop route advisor and route-aware shop suggestions.
 *
 * 主要职责:
 * - 测试 buildShopRouteAdvice 的路由感知建议
 * - 测试遗物路由标签的亲和性排序
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cardsData } from '@/content/narrative/numericSystem';
import type { RunCardInstance } from '@/core/types';
import { getCardRouteSignal, getRouteSupportRelicIds } from '@/content/narrative/routeSignals';
import { buildShopRouteAdvice } from '@/ui/views/shopRouteAdvisor';

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

function getRouteCardId(
  characterId: string,
  routeTag: string,
  role: 'route_confirm' | 'route_payoff',
): string {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === role;
  });
  assert.ok(card, `missing ${role} card for ${routeTag}`);
  return card!.id;
}

test('shop route advice keeps recent route offers ahead of stale deck history', () => {
  const oldRouteCard = getRouteCardId('chronomancer', 'chronomancer:time_layer', 'route_confirm');
  const recentRouteCard = getRouteCardId('chronomancer', 'chronomancer:warp', 'route_confirm');
  const alignedOfferCard = getRouteCardId('chronomancer', 'chronomancer:warp', 'route_payoff');
  const offRouteOfferCard = getRouteCardId('chronomancer', 'chronomancer:delay', 'route_confirm');
  const alignedRelicId = getRouteSupportRelicIds('chronomancer:warp')[0];

  assert.ok(alignedRelicId, 'missing chronomancer warp support relic');

  const advice = buildShopRouteAdvice({
    characterId: 'chronomancer',
    deck: [
      makeRuntimeCard(oldRouteCard, 'old-1'),
      makeRuntimeCard(oldRouteCard, 'old-2'),
      makeRuntimeCard(oldRouteCard, 'old-3'),
      makeRuntimeCard(recentRouteCard, 'recent-1'),
      makeRuntimeCard(alignedOfferCard, 'route-upgrade'),
    ],
    gold: 300,
    cardOffers: [
      { card: makeRuntimeCard(offRouteOfferCard, 'offer-off'), price: 50 },
      { card: makeRuntimeCard(alignedOfferCard, 'offer-warp'), price: 75 },
    ],
    relicOffers: [
      { relicId: alignedRelicId!, price: 120 },
      { relicId: 'bag_of_prep', price: 120 },
    ],
    canUpgrade: true,
    canEnchant: true,
  });

  assert.equal(advice.preferredRouteTag, 'chronomancer:warp');
  assert.equal(advice.preferredRouteLabel, '跃迁链');
  assert.equal(advice.primaryHint?.targetType, 'card');
  assert.equal(advice.primaryHint?.routeTag, 'chronomancer:warp');
  assert.match(advice.primaryHint?.reason || '', /当前路线|对齐当前路线/);
  assert.equal(advice.cardHints['offer-warp']?.routeTag, 'chronomancer:warp');
  assert.match(advice.cardHints['offer-warp']?.reason || '', /当前路线|对齐当前路线/);
  assert.equal(advice.cardHints['offer-off'], undefined);
  assert.equal(advice.relicHints[alignedRelicId!]?.routeTag, 'chronomancer:warp');
  assert.match(advice.relicHints[alignedRelicId!]?.reason || '', /当前路线/);
  assert.equal(advice.serviceHints.upgrade?.routeTag, 'chronomancer:warp');
  assert.match(advice.serviceHints.upgrade?.reason || '', /当前路线/);
  assert.equal(advice.serviceHints.enchant?.routeTag, 'chronomancer:warp');
  assert.match(advice.serviceHints.enchant?.reason || '', /路线牌|当前路线/);
});

test('shop route advice falls back to route service when budget blocks aligned offers', () => {
  const recentRouteCard = getRouteCardId('alchemist', 'alchemist:acid', 'route_confirm');
  const alignedDeckPayoff = getRouteCardId('alchemist', 'alchemist:acid', 'route_payoff');
  const alignedOfferCard = getRouteCardId('alchemist', 'alchemist:acid', 'route_payoff');
  const alignedRelicId = getRouteSupportRelicIds('alchemist:acid')[0];

  assert.ok(alignedRelicId, 'missing alchemist acid support relic');

  const advice = buildShopRouteAdvice({
    characterId: 'alchemist',
    deck: [
      makeRuntimeCard(recentRouteCard, 'recent-1'),
      makeRuntimeCard(alignedDeckPayoff, 'deck-payoff'),
    ],
    gold: 60,
    cardOffers: [{ card: makeRuntimeCard(alignedOfferCard, 'offer-acid'), price: 150 }],
    relicOffers: [{ relicId: alignedRelicId!, price: 180 }],
    canUpgrade: true,
    canEnchant: true,
  });

  assert.equal(advice.preferredRouteTag, 'alchemist:acid');
  assert.equal(advice.primaryHint?.targetType, 'service');
  assert.equal(advice.primaryHint?.targetId, 'upgrade');
  assert.match(advice.primaryHint?.reason || '', /当前路线/);
  assert.equal(advice.serviceHints.upgrade?.routeTag, 'alchemist:acid');
  assert.match(advice.serviceHints.upgrade?.reason || '', /当前路线/);
  assert.equal(Object.keys(advice.cardHints).length, 0);
  assert.equal(Object.keys(advice.relicHints).length, 0);
});

test('shop route advice returns empty hints when no route has formed', () => {
  const advice = buildShopRouteAdvice({
    characterId: 'chronomancer',
    deck: [],
    gold: 200,
    cardOffers: [],
    relicOffers: [],
    canUpgrade: false,
    canEnchant: false,
  });

  assert.equal(advice.preferredRouteTag, null);
  assert.equal(advice.preferredRouteLabel, null);
  assert.equal(advice.primaryHint, null);
  assert.deepEqual(advice.cardHints, {});
  assert.deepEqual(advice.relicHints, {});
  assert.deepEqual(advice.serviceHints, {});
});

test('shop route advice surfaces affinity override cards in hints', () => {
  const advice = buildShopRouteAdvice({
    characterId: 'informant',
    deck: [
      makeRuntimeCard('planted_witness', 'route-confirm'),
      makeRuntimeCard('cross_examiner', 'route-payoff'),
    ],
    gold: 200,
    cardOffers: [
      { card: makeRuntimeCard('sealed_testimony', 'offer-override'), price: 55 },
    ],
    relicOffers: [],
    canUpgrade: false,
    canEnchant: true,
  });

  assert.equal(advice.preferredRouteTag, 'informant:evidence');
  assert.equal(advice.cardHints['offer-override']?.routeTag, 'informant:evidence');
  assert.equal(advice.primaryHint?.targetId, 'offer-override');
});
