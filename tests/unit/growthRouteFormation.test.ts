/**
 * @file growthRouteFormation.test.ts
 * @description Unit tests for growth route formation and route signal confirmation.
 *
 * 主要职责:
 * - 测试路由卡牌信号的确认
 * - 测试路由分布的统计摘要
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { cardsData, getCardRouteSignal, getEventRouteSignal, getKnownRouteTagsForCharacter } from '@/content/narrative/numericSystem';
import type { RunCardInstance } from '@/core/types';
import { summarizeRouteDistribution, type SampleResult } from '../../scripts/validation/check_growth_route_formation';

function setFloor(engine: GameEngine, floorIndex: number) {
  const node = engine.state.map.find((entry) => entry.y === floorIndex);
  assert.ok(node, `missing node on floor index ${floorIndex}`);
  engine.state.currentNodeId = node!.id;
}

function getRouteCardId(characterId: string, routeTag: string) {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_confirm';
  });
  assert.ok(card, `missing route-confirm card for ${routeTag}`);
  return card!.id;
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

test('early tactician reward offers a route signal and a counterweight option', () => {
  const engine = new GameEngine(1, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('tactician');
    setFloor(engine, 0);

    const reward = engine.generateCardRewards(3, { source: 'combat' });
    const hasRouteSignal = reward.some((card) => !!getCardRouteSignal(card));
    const hasCounterweight = reward.some((card) => {
      const signal = getCardRouteSignal(card);
      return !signal || signal.earlyGameRole === 'generic_power' || signal.earlyGameRole === 'generic_fallback';
    });

    assert.equal(hasRouteSignal, true);
    assert.equal(hasCounterweight, true);
  } finally {
    engine.dispose();
  }
});

test('second reward reinforces the route chosen from the first reward', () => {
  const engine = new GameEngine(3, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('chronomancer');
    setFloor(engine, 0);

    const reward1 = engine.generateCardRewards(3, { source: 'combat' });
    const chosen = reward1.find((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_confirm') ?? reward1[0];
    const routeTag = getCardRouteSignal(chosen)?.routeTags[0];
    assert.ok(routeTag, 'expected first reward to establish a route');

    engine.state.player.deck.push(chosen);
    setFloor(engine, 1);

    const reward2 = engine.generateCardRewards(3, { source: 'combat' });
    const hasRouteReinforcement = reward2.some((card) => getCardRouteSignal(card)?.routeTags.includes(routeTag!));
    const hasCounterweight = reward2.some((card) => {
      const signal = getCardRouteSignal(card);
      return !signal || !signal.routeTags.includes(routeTag!) || signal.earlyGameRole === 'generic_power';
    });

    assert.equal(hasRouteReinforcement, true);
    assert.equal(hasCounterweight, true);
  } finally {
    engine.dispose();
  }
});

test('early shop offers at least one card aligned with the current route', () => {
  const engine = new GameEngine(5, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    setFloor(engine, 0);
    const reward1 = engine.generateCardRewards(3, { source: 'combat' });
    const chosen = reward1.find((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_confirm') ?? reward1[0];
    const routeTag = getCardRouteSignal(chosen)?.routeTags[0];
    assert.ok(routeTag, 'expected first reward to establish a route');

    engine.state.player.deck.push(chosen);
    setFloor(engine, 1);
    engine.enterShop();

    const alignedShopCards = engine.state.shopCards.filter((card) => getCardRouteSignal(card)?.routeTags.includes(routeTag!));
    assert.ok(alignedShopCards.length >= 2, `expected at least two early shop cards aligned with ${routeTag}, got ${alignedShopCards.length}`);
  } finally {
    engine.dispose();
  }
});

test('committed recent route overrides stale deck dominant route for reward, shop, and event reinforcement', () => {
  const engine = new GameEngine(11, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    const knownTags = new Set(getKnownRouteTagsForCharacter('informant'));
    const oldTag = 'informant:intel';
    const recentTag = 'informant:evidence';
    assert.equal(knownTags.has(oldTag), true);
    assert.equal(knownTags.has(recentTag), true);

    const oldCardId = getRouteCardId('informant', oldTag!);
    const recentCardId = getRouteCardId('informant', recentTag!);
    engine.state.player.deck.push(makeRuntimeCard(oldCardId, 'stale-1'));
    engine.state.player.deck.push(makeRuntimeCard(oldCardId, 'stale-2'));
    engine.state.player.deck.push(makeRuntimeCard(recentCardId, 'recent-1'));
    engine.state.routeState = {
      primaryTag: recentTag,
      secondaryTag: oldTag,
      confidence: 72,
      stage: 'committed',
      recentCommits: [{ tag: recentTag, source: 'reward', floor: 2, weight: 16 }],
    };

    setFloor(engine, 1);

    const reward = engine.generateCardRewards(3, { source: 'combat' });
    const reinforcedRecentReward = reward.some((card) => {
      const signal = getCardRouteSignal(card);
      return !!(signal && signal.routeTags.includes(recentTag!) && (signal.earlyGameRole === 'route_confirm' || signal.earlyGameRole === 'route_payoff'));
    });
    const staleDominantReward = reward.some((card) => {
      const signal = getCardRouteSignal(card);
      return !!(signal && signal.routeTags.includes(oldTag!) && (signal.earlyGameRole === 'route_confirm' || signal.earlyGameRole === 'route_payoff'));
    });
    assert.equal(reinforcedRecentReward, true);
    assert.equal(staleDominantReward, false);

    engine.enterShop();
    const alignedShopCards = engine.state.shopCards.filter((card) => getCardRouteSignal(card)?.routeTags.includes(recentTag!));
    assert.ok(alignedShopCards.length >= 2, `expected committed route shop to include two ${recentTag} cards, got ${alignedShopCards.length}`);

    const eventNode = engine.state.map.find((node) => node.type === 'Event' && node.y === 1);
    assert.ok(eventNode, 'expected early event node');
    engine.state.currentNodeId = eventNode!.id;
    engine.startEvent();
    const eventSignal = engine.state.activeEvent ? getEventRouteSignal(engine.state.activeEvent.id) : null;
    assert.ok(eventSignal, 'expected event route signal');
    assert.equal(eventSignal!.routeTags.includes(recentTag!), true);
    assert.equal(eventSignal!.routeTags.includes(oldTag!), false);
  } finally {
    engine.dispose();
  }
});

test('first reward distributes soft starter routes across multiple build openings', () => {
  const characters = ['informant', 'puppeteer', 'alchemist'];

  for (const characterId of characters) {
    const pickedTags: string[] = [];

    for (let seed = 1; seed <= 20; seed += 1) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        setFloor(engine, 0);
        const reward = engine.generateCardRewards(3, { source: 'combat' });
        const chosen = reward.find((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_confirm') ?? reward[0];
        const tag = getCardRouteSignal(chosen)?.routeTags[0];
        if (tag) pickedTags.push(tag);
      } finally {
        engine.dispose();
      }
    }

    const counts = new Map<string, number>();
    for (const tag of pickedTags) counts.set(tag, (counts.get(tag) || 0) + 1);
    const maxShare = Math.max(...Array.from(counts.values())) / Math.max(1, pickedTags.length);

    assert.ok(counts.size >= 2, `${characterId} should open at least two route tags, got ${Array.from(counts.keys()).join(', ')}`);
    assert.ok(maxShare <= 0.85, `${characterId} first reward route share collapsed to ${maxShare}`);
  }
});

test('growth route distribution summary flags collapsed per-character route tags without failing formation pass', () => {
  const samples: SampleResult[] = [
    { characterId: 'informant', seed: 1, dominantTag: 'informant:intel', reward1: [], reward2: [], formed: true },
    { characterId: 'informant', seed: 2, dominantTag: 'informant:intel', reward1: [], reward2: [], formed: true },
    { characterId: 'brute', seed: 1, dominantTag: 'brute:rage', reward1: [], reward2: [], formed: true },
    { characterId: 'brute', seed: 2, dominantTag: 'brute:armor', reward1: [], reward2: [], formed: false },
  ];

  const summary = summarizeRouteDistribution(samples);
  const informant = summary.byCharacter.find((entry) => entry.characterId === 'informant');
  const brute = summary.byCharacter.find((entry) => entry.characterId === 'brute');

  assert.equal(summary.reportOnly, true);
  assert.equal(informant?.uniqueTagCount, 1);
  assert.equal(informant?.maxTagShare, 1);
  assert.ok(informant?.warnings.some((warning) => warning.includes('uniqueTagCount')));
  assert.equal(brute?.uniqueTagCount, 2);
  assert.equal(brute?.maxTagShare, 0.5);
});
