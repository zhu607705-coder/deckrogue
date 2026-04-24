/**
 * @file gameEngineRuntimeDelegation.test.ts
 * @description Unit tests for game engine runtime delegation and diagnostic capture.
 *
 * 主要职责:
 * - 测试运行时委托的引导快照创建
 * - 测试诊断信息的捕获与报告
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine, type GameEngineRuntimeDelegate, type GameEngineRuntimeDelegateDiagnostics } from '@/core/events/gameEngine';
import type { RuleSnapshot } from '@/runtimeV2';
import rawCardsData from '@/content/data/cards.json';
import rawRelicsData from '@/content/data/relics.json';
import { potionsData } from '@/content/narrative/numericSystem';
import { getCardRouteSignal, getRouteSupportRelicIds } from '@/content/narrative/routeSignals';
import type { CardDef, RelicDef } from '@/core/types';

const cardsData = rawCardsData as unknown as CardDef[];
const relicsData = rawRelicsData as unknown as RelicDef[];

function createBootSnapshot(seed: number, overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'runtime-v2-sync-test',
    seed,
    lifecycle: {
      screen: 'Map',
      phase: 'map',
      pendingNodeResolution: false,
    },
    player: {
      characterId: 'informant',
      hp: 85,
      maxHp: 85,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: ['strike', 'strike', 'defend', 'gather_intel'],
      relicIds: [],
      potionIds: [],
    },
    map: {
      currentNodeId: null,
      nodes: [
        { id: 'floor_1_node_0', type: 'Event', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
        { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: false, next: [] },
      ],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: `run_${seed}`,
      replayLength: 0,
      generatedAt: '2026-03-12T00:00:00.000Z',
      adapter: 'python-wasm',
    },
    ...overrides,
  };
}

class FakeRuntimeDelegate implements GameEngineRuntimeDelegate {
  public startedWithSeed: number | null = null;
  public selectedCharacterIds: string[] = [];
  public enteredNodeIds: string[] = [];
  public completeCombatCalls = 0;
  public takenRewardCardIds: Array<string | undefined> = [];
  public skippedRewards = 0;
  public eventChoices: string[] = [];
  public restCalls = 0;
  public upgradeCardIds: Array<string | undefined> = [];
  public removeCardIds: Array<string | undefined> = [];
  public leaveRoomCalls = 0;
  public loadedSnapshots = 0;
  public snapshot: RuleSnapshot | null = null;

  constructor(
    private readonly responses: {
      selectCharacter?: RuleSnapshot | Error;
      enterNode?: RuleSnapshot | Error;
      completeCombat?: RuleSnapshot | Error;
      takeReward?: RuleSnapshot | Error;
      skipReward?: RuleSnapshot | Error;
      chooseEventOption?: RuleSnapshot | Error;
      rest?: RuleSnapshot | Error;
      upgradeCard?: RuleSnapshot | Error;
      removeCard?: RuleSnapshot | Error;
      leaveRoom?: RuleSnapshot | Error;
    } = {},
  ) {}

  start(seed: number): void {
    this.startedWithSeed = seed;
    this.snapshot = null;
  }

  selectCharacter(characterId: string): RuleSnapshot {
    this.selectedCharacterIds.push(characterId);
    const response = this.responses.selectCharacter ?? createBootSnapshot(this.startedWithSeed ?? 0);
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  enterNode(nodeId: string): RuleSnapshot {
    this.enteredNodeIds.push(nodeId);
    const response = this.responses.enterNode ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      map: {
        currentNodeId: nodeId,
        nodes: [
          { id: nodeId, type: 'Event', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Event',
        phase: 'event',
        pendingNodeResolution: true,
      },
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  completeCombat(): RuleSnapshot {
    this.completeCombatCalls += 1;
    const response = this.responses.completeCombat ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      map: {
        currentNodeId: 'floor_1_node_0',
        nodes: [
          { id: 'floor_1_node_0', type: 'Combat', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Reward',
        phase: 'reward',
        pendingNodeResolution: true,
      },
      reward: {
        cardIds: ['gather_intel', 'strike', 'defend'],
        source: 'combat',
      },
      combat: null,
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  loadSnapshot(snapshot: RuleSnapshot): void {
    this.loadedSnapshots += 1;
    this.snapshot = snapshot;
  }

  chooseEventOption(choiceId: string): RuleSnapshot {
    this.eventChoices.push(choiceId);
    const response = this.responses.chooseEventOption ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      map: {
        currentNodeId: 'floor_1_node_0',
        nodes: [
          { id: 'floor_1_node_0', type: 'Event', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      activeEvent: null,
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  takeReward(cardId?: string): RuleSnapshot {
    this.takenRewardCardIds.push(cardId);
    const response = this.responses.takeReward ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      player: {
        characterId: 'informant',
        hp: 85,
        maxHp: 85,
        gold: 99,
        intel: 0,
        devotion: 0,
        corruption: 0,
        deck: ['strike', 'strike', 'defend', 'gather_intel', cardId ?? 'gather_intel'],
        relicIds: [],
        potionIds: [],
      },
      map: {
        currentNodeId: 'floor_1_node_0',
        nodes: [
          { id: 'floor_1_node_0', type: 'Combat', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      reward: null,
      combat: null,
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  skipReward(): RuleSnapshot {
    this.skippedRewards += 1;
    const response = this.responses.skipReward ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      map: {
        currentNodeId: 'floor_1_node_0',
        nodes: [
          { id: 'floor_1_node_0', type: 'Combat', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      reward: null,
      combat: null,
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  rest(): RuleSnapshot {
    this.restCalls += 1;
    const response = this.responses.rest ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      player: {
        characterId: 'informant',
        hp: 60,
        maxHp: 100,
        gold: 99,
        intel: 0,
        devotion: 0,
        corruption: 0,
        deck: ['strike', 'strike', 'defend', 'gather_intel'],
        relicIds: [],
        potionIds: [],
      },
      map: {
        currentNodeId: 'floor_1_node_0',
        nodes: [
          { id: 'floor_1_node_0', type: 'Rest', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Rest',
        phase: 'rest',
        pendingNodeResolution: true,
      },
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  upgradeCard(cardInstanceId?: string): RuleSnapshot {
    this.upgradeCardIds.push(cardInstanceId);
    const response = this.responses.upgradeCard ?? (this.snapshot ?? createBootSnapshot(this.startedWithSeed ?? 0));
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  removeCard(cardInstanceId?: string): RuleSnapshot {
    this.removeCardIds.push(cardInstanceId);
    const response = this.responses.removeCard ?? (this.snapshot ?? createBootSnapshot(this.startedWithSeed ?? 0));
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  leaveRoom(): RuleSnapshot {
    this.leaveRoomCalls += 1;
    const response = this.responses.leaveRoom ?? createBootSnapshot(this.startedWithSeed ?? 0, {
      map: {
        currentNodeId: 'floor_1_node_0',
        nodes: [
          { id: 'floor_1_node_0', type: 'Event', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
          { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
        ],
      },
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
    });
    if (response instanceof Error) throw response;
    this.snapshot = response;
    return response;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {}
}

function getRouteCard(characterId: string, routeTag: string, role: 'route_confirm' | 'route_payoff'): CardDef {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === role;
  });
  assert.ok(card, `missing ${role} card for ${routeTag}`);
  return card!;
}

test('GameEngine.selectCharacter can project delegated boot snapshot into legacy state', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(31415, null, { runtimeDelegate: delegate });

  engine.selectCharacter('informant');

  assert.equal(delegate.selectedCharacterIds.length, 1);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.character?.id, 'informant');
  assert.equal(engine.state.player.maxHp, 85);
  assert.equal(engine.state.player.deck.length, 4);
  assert.equal(engine.state.map.length, 2);
  assert.equal(engine.state.currentNodeId, null);
  engine.dispose();
});

test('GameEngine.moveToNode keeps legacy legality guards before delegation', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(31415, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  delegate.enteredNodeIds.length = 0;

  engine.state.pendingNodeResolution = true;
  engine.moveToNode('floor_1_node_0');
  assert.equal(delegate.enteredNodeIds.length, 0);

  engine.state.pendingNodeResolution = false;
  engine.moveToNode('floor_2_node_0');
  assert.equal(delegate.enteredNodeIds.length, 0);
  engine.dispose();
});

test('GameEngine falls back to legacy selectCharacter when delegated boot fails and only notifies once', () => {
  const delegate = new FakeRuntimeDelegate({
    selectCharacter: new Error('delegate boot failed'),
  });
  const engine = new GameEngine(27182, null, { runtimeDelegate: delegate });
  let notifyCount = 0;
  const unsubscribe = engine.subscribe(() => {
    notifyCount += 1;
  });

  engine.selectCharacter('informant');

  unsubscribe();
  const diagnostics: GameEngineRuntimeDelegateDiagnostics = engine.getRuntimeDelegationDiagnostics();
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.character?.id, 'informant');
  assert.equal(notifyCount, 1);
  assert.equal(diagnostics.fallbackCount, 1);
  assert.match(diagnostics.lastFallbackReason || '', /delegate boot failed/);
  engine.dispose();
});

test('GameEngine.leaveCurrentRoomToMap delegates event room exit back to map', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });

  engine.selectCharacter('informant');
  engine.moveToNode('floor_1_node_0');
  engine.state.screen = 'Event';
  engine.state.activeEvent = { id: 'mysterious_shrine' };

  engine.leaveCurrentRoomToMap();

  assert.equal(delegate.leaveRoomCalls, 1);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal(engine.state.currentNodeId, 'floor_1_node_0');
  engine.dispose();
});

test('GameEngine.leaveCurrentRoomToMap falls back to legacy room exit when delegated leave_room fails', () => {
  const delegate = new FakeRuntimeDelegate({
    leaveRoom: new Error('delegate leave_room failed'),
  });
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.moveToNode('floor_1_node_0');
  engine.state.screen = 'Event';
  engine.state.activeEvent = { id: 'mysterious_shrine' };

  engine.leaveCurrentRoomToMap();

  const diagnostics = engine.getRuntimeDelegationDiagnostics();
  assert.equal(delegate.leaveRoomCalls, 1);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal(diagnostics.fallbackCount, 1);
  assert.match(diagnostics.lastFallbackReason || '', /delegate leave_room failed/);
  engine.dispose();
});

test('GameEngine.restHeal preserves legacy room-side state while delegating the room exit', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'Rest';
  engine.state.player.hp = 30;
  engine.state.player.maxHp = 100;

  engine.restHeal();

  assert.equal(delegate.leaveRoomCalls, 1);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal(engine.state.player.hp, 60);
  engine.dispose();
});

test('GameEngine.restHeal mirrors the rest command into the delegate before leaving the room', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'Rest';
  engine.state.player.hp = 30;
  engine.state.player.maxHp = 100;

  engine.restHeal();

  assert.equal(delegate.restCalls, 1);
  assert.equal(engine.state.player.hp, 60);
  engine.dispose();
});

test('GameEngine.resolveEventChoice mirrors event choices into the delegate while preserving legacy event effects', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'Event';
  engine.state.player.hp = 50;
  engine.state.player.maxHp = 70;
  engine.state.activeEvent = { id: 'mysterious_shrine', data: {} };

  engine.resolveEventChoice('pray');

  assert.deepEqual(delegate.eventChoices, ['pray']);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.player.maxHp, 80);
  assert.equal(engine.state.player.hp, 60);
  engine.dispose();
});

test('GameEngine.upgradeCard mirrors the upgrade command into the delegate while preserving legacy rest-upgrade flow', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  const cardId = engine.state.player.deck[0]?.instanceId;
  assert.ok(cardId);
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'Upgrade';
  engine.state.upgradeReturnScreen = 'Rest';

  engine.upgradeCard(cardId!);

  assert.deepEqual(delegate.upgradeCardIds, [cardId]);
  assert.equal(engine.state.screen, 'Map');
  engine.dispose();
});

test('GameEngine.removeCard mirrors the remove command into the delegate while preserving legacy event-removal flow', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  const cardId = engine.state.player.deck[0]?.instanceId;
  assert.ok(cardId);
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'RemoveCard';
  engine.state.activeEvent = {
    id: 'martyr_continue',
    stage: 'free_remove',
    data: { freeRemovalsRemaining: 1 },
  };

  engine.removeCard(cardId!);

  assert.deepEqual(delegate.removeCardIds, [cardId]);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.player.deck.some((card) => card.instanceId === cardId), false);
  engine.dispose();
});

test('GameEngine.buyShopCard syncs the runtime delegate after legacy shop purchases', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');

  const beforeSyncs = delegate.loadedSnapshots;
  engine.state.screen = 'Shop';
  engine.state.player.gold = 999;
  const routeCard = getRouteCard('informant', 'informant:evidence', 'route_payoff');
  const shopCard = {
    ...routeCard,
    instanceId: 'shop-card-1',
    baseCardId: routeCard.id,
    runtimeBase: routeCard,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
  engine.state.shopCards = [shopCard as any];

  engine.buyShopCard(shopCard.instanceId, 50);

  assert.equal(engine.state.shopCards.length, 0);
  assert.ok(delegate.loadedSnapshots > beforeSyncs);
  assert.ok(delegate.snapshot?.player.deck.includes(routeCard.id));
  assert.equal(delegate.snapshot?.routeState?.recentCommits.at(-1)?.source, 'shop');
  assert.equal(delegate.snapshot?.routeState?.recentCommits.at(-1)?.tag, 'informant:evidence');
  engine.dispose();
});

test('GameEngine.buyShopCard keeps adjusted shop pricing when basePrice is omitted', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');

  const beforeSyncs = delegate.loadedSnapshots;
  engine.state.screen = 'Shop';
  engine.state.player.gold = 100;
  engine.state.player.relics.push('lantern');
  const routeCard = getRouteCard('informant', 'informant:evidence', 'route_payoff');
  const shopCard = {
    ...routeCard,
    rarity: 'Common',
    instanceId: 'shop-card-adjusted-price',
    baseCardId: routeCard.id,
    runtimeBase: routeCard,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
  engine.state.shopCards = [shopCard as any];

  engine.buyShopCard(shopCard.instanceId);

  assert.equal(engine.state.player.gold, 52);
  assert.equal(engine.state.shopCards.length, 0);
  assert.ok(delegate.loadedSnapshots > beforeSyncs);
  assert.ok(delegate.snapshot?.player.deck.includes(routeCard.id));
  engine.dispose();
});

test('GameEngine.buyShopRelic syncs the runtime delegate after aligned relic purchases', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');

  const alignedRelicId = getRouteSupportRelicIds('informant:evidence')[0];
  const alignedRelic = relicsData.find((entry) => entry.id === alignedRelicId);
  assert.ok(alignedRelic, `missing aligned relic ${alignedRelicId}`);
  const beforeSyncs = delegate.loadedSnapshots;
  engine.state.screen = 'Shop';
  engine.state.player.gold = 999;
  engine.state.shopRelics = [alignedRelicId];

  engine.buyShopRelic(alignedRelicId, alignedRelic!.price);

  assert.equal(engine.state.shopRelics.length, 0);
  assert.ok(delegate.loadedSnapshots > beforeSyncs);
  assert.ok(delegate.snapshot?.player.relicIds.includes(alignedRelicId));
  assert.equal(delegate.snapshot?.routeState?.recentCommits.at(-1)?.source, 'shop');
  assert.equal(delegate.snapshot?.routeState?.recentCommits.at(-1)?.tag, 'informant:evidence');
  engine.dispose();
});

test('GameEngine.buyShopPotion syncs the runtime delegate after potion purchases', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');

  const beforeSyncs = delegate.loadedSnapshots;
  engine.state.screen = 'Shop';
  engine.state.player.gold = 999;
  engine.state.shopPotions = ['healing_potion'];

  engine.buyShopPotion('healing_potion');

  assert.equal(engine.state.shopPotions.length, 0);
  assert.ok(delegate.loadedSnapshots > beforeSyncs);
  assert.ok(delegate.snapshot?.player.potionIds.includes('healing_potion'));
  engine.dispose();
});

test('GameEngine.buyShopPotion falls back to a finite default price for malformed potion data', () => {
  const potion = potionsData.find((entry) => entry.id === 'healing_potion');
  assert.ok(potion, 'missing healing_potion fixture');
  const originalPrice = potion.price;
  (potion as any).price = undefined;

  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(12345, null, { runtimeDelegate: delegate });
  try {
    engine.selectCharacter('informant');
    engine.state.screen = 'Shop';
    engine.state.player.gold = 100;
    engine.state.shopPotions = ['healing_potion'];

    engine.buyShopPotion('healing_potion');

    assert.equal(engine.state.player.gold, 35);
    assert.equal(engine.state.shopPotions.length, 0);
    assert.ok(Number.isFinite(engine.state.player.gold));
    assert.ok(delegate.snapshot?.player.potionIds.includes('healing_potion'));
  } finally {
    potion.price = originalPrice;
    engine.dispose();
  }
});

test('GameEngine.handleCombatVictory can project delegated reward state into the original UI state', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(31415, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.map = [
    { id: 'floor_1_node_0', type: 'Combat', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
    { id: 'floor_2_node_0', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
  ];
  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'room_combat_token';
  engine.state.roomResolutionKind = 'combat';
  engine.state.combat = {
    turn: 1,
    isPlayerTurn: true,
    player: {
      hp: 70,
      maxHp: 85,
      energy: 3,
      maxEnergy: 3,
      block: 0,
      statuses: {},
      intentsSeen: [],
      delayedCards: [],
      powers: [],
      strength: 0,
      dexterity: 0,
      vulnerable: 0,
      weak: 0,
      frail: 0,
      ritual: 0,
      artifact: 0,
      poison: 0,
      devotion: 0,
      intel: 0,
      corruption: 0,
      lastPlayedCard: null,
    },
    enemies: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turnCount: 1,
  } as any;

  (engine as any).handleCombatVictory();

  assert.equal(delegate.completeCombatCalls, 1);
  assert.equal(engine.state.screen, 'Reward');
  assert.equal(engine.state.combat, null);
  assert.equal(engine.state.rewardCards.length, 3);
  assert.equal(engine.state.roomResolutionToken, 'room_combat_token');
  assert.equal(engine.state.roomResolutionKind, 'reward');
  engine.dispose();
});

test('GameEngine.takeReward can resolve delegated reward selection and return to map in the original UI', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(31415, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.state.screen = 'Reward';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'room_reward_token';
  engine.state.roomResolutionKind = 'reward';
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.rewardCards = [
    { id: 'gather_intel', instanceId: 'reward_1', name: 'Gather Intel' },
    { id: 'strike', instanceId: 'reward_2', name: 'Strike' },
  ] as any;

  engine.takeReward('reward_1');

  assert.deepEqual(delegate.takenRewardCardIds, ['gather_intel']);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.rewardCards.length, 0);
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal(engine.state.roomResolutionToken, null);
  assert.equal(engine.state.roomResolutionKind, null);
  assert.ok(engine.state.player.deck.some((card) => card.id === 'gather_intel'));
  engine.dispose();
});

test('GameEngine.skipReward can resolve delegated reward exit and return to map in the original UI', () => {
  const delegate = new FakeRuntimeDelegate();
  const engine = new GameEngine(31415, null, { runtimeDelegate: delegate });
  engine.selectCharacter('informant');
  engine.state.screen = 'Reward';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'room_reward_token';
  engine.state.roomResolutionKind = 'reward';
  engine.state.currentNodeId = 'floor_1_node_0';
  engine.state.rewardCards = [{ id: 'gather_intel', instanceId: 'reward_1', name: 'Gather Intel' }] as any;

  engine.skipReward();

  assert.equal(delegate.skippedRewards, 1);
  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.rewardCards.length, 0);
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal(engine.state.roomResolutionToken, null);
  assert.equal(engine.state.roomResolutionKind, null);
  engine.dispose();
});
