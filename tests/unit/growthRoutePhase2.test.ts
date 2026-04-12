import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import rawCardsData from '@/content/data/cards.json';
import rawRelicsData from '@/content/data/relics.json';
import {
  getCardRouteSignal,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  getRouteTaxonomyForCharacter,
  sortCardsByRouteAffinity,
  resolvePreferredRouteTag,
  sortRelicIdsByRouteAffinity,
} from '@/content/narrative/routeSignals';
import type { CardDef, RelicDef, RunCardInstance } from '@/core/types';

const cardsData = rawCardsData as unknown as CardDef[];
const relicsData = rawRelicsData as unknown as RelicDef[];

function setFloor(engine: GameEngine, floorIndex: number) {
  const node = engine.state.map.find((entry) => entry.y === floorIndex);
  assert.ok(node, `missing node on floor index ${floorIndex}`);
  engine.state.currentNodeId = node!.id;
}

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

function getRouteCardId(characterId: string, routeTag: string, role: 'route_confirm' | 'route_payoff') {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === role;
  });
  assert.ok(card, `missing ${role} card for ${routeTag}`);
  return card!.id;
}

test('route taxonomy guardrail keeps every route connected to confirm, payoff, and support relics', () => {
  const characters = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist'];

  for (const characterId of characters) {
    const knownTags = getKnownRouteTagsForCharacter(characterId);
    const taxonomy = getRouteTaxonomyForCharacter(characterId);
    assert.deepEqual(
      taxonomy.map((entry) => entry.routeTag).sort(),
      [...knownTags].sort(),
      `taxonomy drift for ${characterId}`,
    );

    for (const entry of taxonomy) {
      assert.ok(getRouteCardId(characterId, entry.routeTag, 'route_confirm'));
      assert.ok(getRouteCardId(characterId, entry.routeTag, 'route_payoff'));
      const supportRelicIds = getRouteSupportRelicIds(entry.routeTag);
      assert.ok(supportRelicIds.length >= 2, `expected at least two support relics for ${entry.routeTag}`);
      for (const relicId of supportRelicIds) {
        assert.ok(relicsData.some((relic) => relic.id === relicId), `missing relic ${relicId} for ${entry.routeTag}`);
      }
    }
  }
});

test('midgame shop relics reinforce the recent route instead of stale deck history', () => {
  const engine = new GameEngine(19, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    const oldRouteCard = getRouteCardId('informant', 'informant:intel', 'route_confirm');
    const recentRouteCard = getRouteCardId('informant', 'informant:evidence', 'route_confirm');
    engine.state.player.deck.push(makeRuntimeCard(oldRouteCard, 'old-1'));
    engine.state.player.deck.push(makeRuntimeCard(oldRouteCard, 'old-2'));
    engine.state.player.deck.push(makeRuntimeCard(recentRouteCard, 'recent-1'));
    setFloor(engine, 3);

    engine.enterShop();

    const alignedRelic = engine.state.shopRelics.find((relicId) => getRelicRouteTags(relicId).includes('informant:evidence'));
    assert.ok(alignedRelic, 'expected at least one relic aligned with the recent route');
  } finally {
    engine.dispose();
  }
});

test('route-affinity sorting pushes aligned upgrades and enchant targets to the front', () => {
  const cards = [
    makeRuntimeCard(getRouteCardId('tactician', 'tactician:command', 'route_confirm'), 'command-1'),
    makeRuntimeCard(getRouteCardId('tactician', 'tactician:poison', 'route_confirm'), 'poison-1'),
    makeRuntimeCard(getRouteCardId('tactician', 'tactician:poison', 'route_payoff'), 'poison-2'),
  ];

  const sorted = sortCardsByRouteAffinity(cards, 'tactician:poison');

  assert.equal(getCardRouteSignal(sorted[0])?.routeTags.includes('tactician:poison'), true);
  assert.equal(getCardRouteSignal(sorted[0])?.earlyGameRole, 'route_payoff');
  assert.equal(getCardRouteSignal(sorted[1])?.routeTags.includes('tactician:poison'), true);
  assert.equal(getCardRouteSignal(sorted[2])?.routeTags.includes('tactician:command'), true);
});

test('rest upgrade surfaces keep recent route sustain ahead of stale deck history', () => {
  const engine = new GameEngine(23, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('chronomancer');

    const oldRouteCard = getRouteCardId('chronomancer', 'chronomancer:time_layer', 'route_confirm');
    const recentRouteCard = getRouteCardId('chronomancer', 'chronomancer:warp', 'route_confirm');
    const alignedUpgradeCard = getRouteCardId('chronomancer', 'chronomancer:warp', 'route_payoff');
    const offRouteUpgradeCard = getRouteCardId('chronomancer', 'chronomancer:delay', 'route_confirm');

    engine.state.player.deck.push(makeRuntimeCard(oldRouteCard, 'old-1'));
    engine.state.player.deck.push(makeRuntimeCard(oldRouteCard, 'old-2'));
    engine.state.player.deck.push(makeRuntimeCard(offRouteUpgradeCard, 'delay-upgrade'));
    engine.state.player.deck.push(makeRuntimeCard(recentRouteCard, 'recent-1'));
    engine.state.player.deck.push(makeRuntimeCard(alignedUpgradeCard, 'warp-upgrade'));
    engine.state.player.relics.push('bag_of_prep', 'lantern', 'vajra');

    const routeTags = getKnownRouteTagsForCharacter('chronomancer');
    const preferredRouteTag = resolvePreferredRouteTag(engine.state.player.deck, routeTags);
    assert.equal(preferredRouteTag, 'chronomancer:warp');

    const sortedUpgrades = sortCardsByRouteAffinity(
      engine.state.player.deck.filter((card) => !card.isUpgraded && card.upgrade),
      preferredRouteTag,
    );
    assert.equal(getCardRouteSignal(sortedUpgrades[0])?.routeTags.includes('chronomancer:warp'), true);

    engine.restUpgradeRelic();
    assert.equal(engine.state.screen, 'RelicUpgrade');
    assert.equal(engine.state.relicUpgradeReturnScreen, 'Rest');

    const sortedRelics = sortRelicIdsByRouteAffinity(['bag_of_prep', 'lantern', 'vajra'], preferredRouteTag);
    assert.equal(getRelicRouteTags(sortedRelics[0]).includes('chronomancer:warp'), true);
    assert.equal(sortedRelics[0], 'lantern');
  } finally {
    engine.dispose();
  }
});
