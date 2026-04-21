import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import rawCardsData from '@/content/data/cards.json';
import rawRelicsData from '@/content/data/relics.json';
import {
  getCardRouteAffinityTags,
  getCardRouteSignal,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  getRouteTaxonomyForCharacter,
  sortCardsByRouteAffinity,
  resolvePreferredRouteTag,
  sortRelicIdsByRouteAffinity,
} from '@/content/narrative/routeSignals';
import { maybeRecordRouteCommit, syncRouteStateFromLegacyState } from '@/content/narrative/numericSystem';
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

function getNeutralCardId(characterId: string) {
  const card = cardsData.find((entry) => {
    return entry.character === characterId && getCardRouteAffinityTags(entry).length === 0;
  });
  assert.ok(card, `missing neutral card for ${characterId}`);
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
    engine.state.player.relics.push('bag_of_prep', 'lantern', 'vajra', 'mark_of_chaos');
    engine.state.screen = 'Rest';

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

test('midgame reward and shop sustain the committed route after a neutral utility pick', () => {
  const engine = new GameEngine(31, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');

    const staleRouteCard = getRouteCardId('informant', 'informant:intel', 'route_confirm');
    const recentRouteCard = getRouteCardId('informant', 'informant:evidence', 'route_confirm');
    const neutralCard = getNeutralCardId('informant');

    engine.state.player.deck.push(makeRuntimeCard(staleRouteCard, 'stale-1'));
    engine.state.player.deck.push(makeRuntimeCard(staleRouteCard, 'stale-2'));
    engine.state.player.deck.push(makeRuntimeCard(recentRouteCard, 'recent-1'));
    engine.state.player.deck.push(makeRuntimeCard(neutralCard, 'neutral-1'));
    maybeRecordRouteCommit(engine.state, 'informant:evidence', 'reward', 2, 16);
    maybeRecordRouteCommit(engine.state, 'informant:evidence', 'shop', 3, 12);
    syncRouteStateFromLegacyState(engine.state);

    setFloor(engine, 4);
    const reward = engine.generateCardRewards(3, { source: 'combat' });
    assert.equal(
      reward.some((card) => getCardRouteAffinityTags(card).includes('informant:evidence')),
      true,
    );

    const shop = engine.generateCardRewards(6, { source: 'shop' });
    assert.equal(
      shop.some((card) => getCardRouteAffinityTags(card).includes('informant:evidence')),
      true,
    );
  } finally {
    engine.dispose();
  }
});

test('real shop purchase paths write shop commits into authoritative route state', () => {
  const engine = new GameEngine(37, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    maybeRecordRouteCommit(engine.state, 'informant:evidence', 'reward', 2, 16);
    syncRouteStateFromLegacyState(engine.state);

    const alignedCardId = getRouteCardId('informant', 'informant:evidence', 'route_payoff');
    const alignedRelicId = getRouteSupportRelicIds('informant:evidence')[0];
    const alignedRelic = relicsData.find((entry) => entry.id === alignedRelicId);
    assert.ok(alignedRelic, `missing aligned relic ${alignedRelicId}`);

    engine.state.screen = 'Shop';
    engine.state.player.gold = 999;
    engine.state.shopCards = [makeRuntimeCard(alignedCardId, 'shop-card-1')];
    engine.state.shopRelics = [alignedRelicId];

    engine.buyShopCard('shop-card-1', 50);
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.source, 'shop');
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.tag, 'informant:evidence');
    assert.equal(engine.state.routeState?.primaryTag, 'informant:evidence');

    engine.buyShopRelic(alignedRelicId, alignedRelic!.price);
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.source, 'shop');
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.tag, 'informant:evidence');
    assert.equal(engine.state.routeState?.primaryTag, 'informant:evidence');
  } finally {
    engine.dispose();
  }
});

test('legacy direct shop entry points also preserve authoritative shop route commits', () => {
  const engine = new GameEngine(41, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    maybeRecordRouteCommit(engine.state, 'informant:evidence', 'reward', 2, 16);
    syncRouteStateFromLegacyState(engine.state);

    const alignedCardId = getRouteCardId('informant', 'informant:evidence', 'route_payoff');
    const alignedRelicId = getRouteSupportRelicIds('informant:evidence')[0];
    assert.ok(alignedRelicId, 'missing aligned direct relic');

    engine.state.screen = 'Shop';
    engine.state.player.gold = 999;
    engine.state.shopCards = [makeRuntimeCard(alignedCardId, 'shop-card-direct-1')];
    engine.state.shopRelics = [alignedRelicId];

    engine.buyCard('shop-card-direct-1');
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.source, 'shop');
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.tag, 'informant:evidence');
    assert.equal(engine.state.routeState?.primaryTag, 'informant:evidence');

    engine.buyRelic(alignedRelicId);
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.source, 'shop');
    assert.equal(engine.state.routeState?.recentCommits.at(-1)?.tag, 'informant:evidence');
    assert.equal(engine.state.routeState?.primaryTag, 'informant:evidence');
  } finally {
    engine.dispose();
  }
});
