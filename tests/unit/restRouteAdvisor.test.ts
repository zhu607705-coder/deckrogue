import test from 'node:test';
import assert from 'node:assert/strict';

import rawCardsData from '@/content/data/cards.json';
import type { CardDef, RunCardInstance } from '@/core/types';
import { getCardRouteSignal } from '@/content/narrative/routeSignals';
import { buildRestRouteAdvice } from '@/ui/views/restRouteAdvisor';

const cardsData = rawCardsData as unknown as CardDef[];

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

test('rest route advice keeps recent sustain actions ahead of stale deck history', () => {
  const oldRouteCard = getRouteCardId('chronomancer', 'chronomancer:time_layer', 'route_confirm');
  const recentRouteCard = getRouteCardId('chronomancer', 'chronomancer:warp', 'route_confirm');
  const alignedUpgradeCard = getRouteCardId('chronomancer', 'chronomancer:warp', 'route_payoff');
  const offRouteUpgradeCard = getRouteCardId('chronomancer', 'chronomancer:delay', 'route_confirm');

  const advice = buildRestRouteAdvice({
    characterId: 'chronomancer',
    deck: [
      makeRuntimeCard(oldRouteCard, 'old-1'),
      makeRuntimeCard(oldRouteCard, 'old-2'),
      makeRuntimeCard(offRouteUpgradeCard, 'delay-upgrade'),
      makeRuntimeCard(recentRouteCard, 'recent-1'),
      makeRuntimeCard(alignedUpgradeCard, 'warp-upgrade'),
    ],
    relicIds: ['bag_of_prep', 'lantern', 'vajra'],
    currentHp: 48,
    maxHp: 60,
    canHeal: true,
    canUpgrade: true,
    canEnchant: true,
    canUpgradeRelic: true,
  });

  assert.equal(advice.preferredRouteTag, 'chronomancer:warp');
  assert.equal(advice.primaryAction, 'upgrade');
  assert.deepEqual(advice.orderedActions, ['upgrade', 'enchant', 'relic_upgrade']);
  assert.equal(advice.actionHints.upgrade?.routeTag, 'chronomancer:warp');
  assert.equal(advice.actionHints.enchant?.routeTag, 'chronomancer:warp');
  assert.equal(advice.actionHints.relic_upgrade?.routeTag, 'chronomancer:warp');
  assert.equal(advice.actionHints.relic_upgrade?.routeLabel, '跃迁链');
  assert.equal(advice.actionHints.heal, undefined);
});

test('rest route advice falls back to heal stability when route sustain actions are unavailable', () => {
  const oldRouteCard = getRouteCardId('chronomancer', 'chronomancer:time_layer', 'route_confirm');

  const advice = buildRestRouteAdvice({
    characterId: 'chronomancer',
    deck: [makeRuntimeCard(oldRouteCard, 'old-1')],
    relicIds: [],
    currentHp: 12,
    maxHp: 40,
    canHeal: true,
    canUpgrade: false,
    canEnchant: false,
    canUpgradeRelic: false,
  });

  assert.equal(advice.preferredRouteTag, 'chronomancer:time_layer');
  assert.equal(advice.primaryAction, 'heal');
  assert.deepEqual(advice.orderedActions, ['heal']);
  assert.equal(advice.actionHints.heal?.emphasis, 'stability');
  assert.match(advice.actionHints.heal?.reason || '', /生命偏低/);
  assert.equal(advice.actionHints.upgrade, undefined);
  assert.equal(advice.actionHints.enchant, undefined);
  assert.equal(advice.actionHints.relic_upgrade, undefined);
});
