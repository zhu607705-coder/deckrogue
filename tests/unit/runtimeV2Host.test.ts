/**
 * @file runtimeV2Host.test.ts
 * @description Unit tests for runtime v2 engine host and legacy oracle adapter boot.
 *
 * 主要职责:
 * - 测试引擎主机启动旧版 oracle 适配器
 * - 测试 dispatch 后快照的合约投影
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { globalEventBus } from '@/core/events/eventBus';
import { potionsData } from '@/content/narrative/numericSystem';
import {
  createEngineHost,
  DispatchFailedError,
  createLegacyOracleAdapter,
  createPythonWasmAdapter,
  normalizeLegacyGameState,
  type RuleRuntimeAdapter,
  type RuleSnapshot
} from '@/runtimeV2';

test('engine host can boot a legacy oracle adapter and project a contract snapshot', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());

  await host.start({ seed: 12345 });
  const result = await host.dispatch({ type: 'select_character', characterId: 'informant' });

  assert.equal(result.ok, true);
  assert.equal(result.error, undefined);
  assert.equal(result.snapshot.player.characterId, 'informant');
  assert.equal(result.snapshot.lifecycle.screen, 'Map');
  assert.ok(result.snapshot.player.deck.length > 0);
  assert.ok(result.snapshot.map.nodes.length > 0);
  assert.ok(result.diff.changedPaths.includes('player.characterId'));
});

test('engine host can round-trip a legacy oracle snapshot through load_snapshot', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  await host.start({ seed: 67890 });
  const selected = await host.dispatch({ type: 'select_character', characterId: 'brute' });

  const secondHost = createEngineHost(createLegacyOracleAdapter());
  await secondHost.start({ seed: 1 });
  const loaded = await secondHost.dispatch({ type: 'load_snapshot', snapshot: selected.snapshot });

  assert.equal(loaded.snapshot.player.characterId, 'brute');
  assert.deepEqual(loaded.snapshot.map.nodes, selected.snapshot.map.nodes);
  assert.deepEqual(loaded.snapshot.player.deck, selected.snapshot.player.deck);
});

test('legacy normalizer preserves key state from the current game engine', () => {
  const engine = new GameEngine(13579, null);
  try {
    engine.selectCharacter('tactician');
    const snapshot = normalizeLegacyGameState(engine.state, engine.getSaveData());

    assert.equal(snapshot.player.characterId, 'tactician');
    assert.equal(snapshot.player.hp, engine.state.player.hp);
    assert.equal(snapshot.player.maxHp, engine.state.player.maxHp);
    assert.deepEqual(snapshot.player.deck, engine.state.player.deck.map((card) => card.id));
    assert.equal(snapshot.map.nodes.length, engine.state.map.length);
  } finally {
    engine.dispose();
  }
});

function createStubSnapshot(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'test-runtime',
    seed: 7,
    lifecycle: {
      screen: 'Map',
      phase: 'map',
      pendingNodeResolution: false
    },
    player: {
      characterId: 'informant',
      hp: 70,
      maxHp: 70,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: ['strike', 'defend'],
      relicIds: [],
      potionIds: []
    },
    map: {
      currentNodeId: null,
      nodes: [
        { id: 'node-1', type: 'Event', x: 0.5, y: 0, revealed: true, next: ['node-2'] },
        { id: 'node-2', type: 'Combat', x: 0.5, y: 1, revealed: false, next: [] }
      ]
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: 'stub-run',
      replayLength: 0,
      generatedAt: new Date(0).toISOString(),
      adapter: 'python-wasm'
    },
    ...overrides
  };
}

class StubRoomAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private snapshot: RuleSnapshot = createStubSnapshot();

  async start(): Promise<RuleSnapshot> {
    this.snapshot = createStubSnapshot();
    return this.snapshot;
  }

  async dispatch(command: Parameters<RuleRuntimeAdapter['dispatch']>[0]): Promise<RuleSnapshot> {
    if (command.type === 'enter_node') {
      this.snapshot = createStubSnapshot({
        lifecycle: {
          screen: 'Event',
          phase: 'event',
          pendingNodeResolution: true
        },
        map: {
          currentNodeId: command.nodeId,
          nodes: [
            { id: 'node-1', type: 'Event', x: 0.5, y: 0, revealed: true, next: ['node-2'] },
            { id: 'node-2', type: 'Combat', x: 0.5, y: 1, revealed: true, next: [] }
          ]
        },
        meta: {
          runId: 'stub-run',
          replayLength: 1,
          generatedAt: new Date(0).toISOString(),
          adapter: 'python-wasm'
        }
      });
      return this.snapshot;
    }

    if (command.type === 'leave_room') {
      this.snapshot = createStubSnapshot({
        lifecycle: {
          screen: 'Map',
          phase: 'map',
          pendingNodeResolution: false
        },
        map: {
          currentNodeId: 'node-1',
          nodes: [
            { id: 'node-1', type: 'Event', x: 0.5, y: 0, revealed: true, next: ['node-2'] },
            { id: 'node-2', type: 'Combat', x: 0.5, y: 1, revealed: true, next: [] }
          ]
        },
        meta: {
          runId: 'stub-run',
          replayLength: 2,
          generatedAt: new Date(0).toISOString(),
          adapter: 'python-wasm'
        }
      });
      return this.snapshot;
    }

    return this.snapshot;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    this.snapshot = createStubSnapshot();
  }
}

class ObservableStubAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private snapshot: RuleSnapshot = createStubSnapshot();
  private listeners = new Set<(snapshot: RuleSnapshot) => void>();
  private pendingResolve: ((snapshot: RuleSnapshot) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;

  async start(): Promise<RuleSnapshot> {
    this.snapshot = createStubSnapshot();
    return this.snapshot;
  }

  async dispatch(command: Parameters<RuleRuntimeAdapter['dispatch']>[0]): Promise<RuleSnapshot> {
    if (command.type === 'enter_node') {
      return new Promise<RuleSnapshot>((resolve, reject) => {
        this.pendingResolve = resolve;
        this.pendingReject = reject;
      });
    }
    return this.snapshot;
  }

  emitSnapshot(snapshot: RuleSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  resolveDispatch(snapshot: RuleSnapshot): void {
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.pendingReject = null;
    this.snapshot = snapshot;
    resolve?.(snapshot);
  }

  rejectDispatch(error: Error): void {
    const reject = this.pendingReject;
    this.pendingResolve = null;
    this.pendingReject = null;
    reject?.(error);
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: RuleSnapshot) => void): () => void {
    this.listeners.add(listener);
    if (this.snapshot) {
      listener(this.snapshot);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {}
}

test('engine host accepts enter_node and leave_room commands for runtime v2 adapters', async () => {
  const host = createEngineHost(new StubRoomAdapter());

  await host.start({ seed: 7 });
  const entered = await host.dispatch({ type: 'enter_node', nodeId: 'node-1' });
  assert.equal(entered.snapshot.lifecycle.phase, 'event');
  assert.equal(entered.snapshot.map.currentNodeId, 'node-1');
  assert.ok(entered.diff.changedPaths.includes('lifecycle.phase'));
  assert.ok(entered.diff.changedPaths.includes('map.currentNodeId'));

  const left = await host.dispatch({ type: 'leave_room' });
  assert.equal(left.snapshot.lifecycle.phase, 'map');
  assert.equal(left.snapshot.lifecycle.pendingNodeResolution, false);
  assert.equal(left.snapshot.meta.replayLength, 2);
});

test('engine host reports narrow array element diffs without stringifying the whole array', async () => {
  class StubDeckAdapter extends StubRoomAdapter {
    override async dispatch(): Promise<RuleSnapshot> {
      return createStubSnapshot({
        player: {
          ...createStubSnapshot().player,
          deck: ['strike', 'guard_protocol'],
        },
      });
    }
  }

  const host = createEngineHost(new StubDeckAdapter());
  await host.start({ seed: 7 });
  const result = await host.dispatch({ type: 'leave_room' });

  assert.ok(result.diff.changedPaths.includes('player.deck.1'));
  assert.ok(!result.diff.changedPaths.includes('player.deck'));
});

test('engine host reports object array reorders and value changes with keyed paths', async () => {
  class StubMapReorderAdapter extends StubRoomAdapter {
    override async dispatch(): Promise<RuleSnapshot> {
      return createStubSnapshot({
        map: {
          currentNodeId: null,
          nodes: [
            { id: 'node-2', type: 'Combat', x: 0.5, y: 1, revealed: false, next: [] },
            { id: 'node-1', type: 'Event', x: 0.75, y: 0, revealed: true, next: ['node-2'] },
          ],
        },
      });
    }
  }

  const host = createEngineHost(new StubMapReorderAdapter());
  await host.start({ seed: 7 });
  const result = await host.dispatch({ type: 'leave_room' });

  assert.ok(result.diff.changedPaths.includes('map.nodes.$order'));
  assert.ok(result.diff.changedPaths.includes('map.nodes[id=node-1].x'));
  assert.ok(!result.diff.changedPaths.includes('map.nodes'));
  assert.ok(!result.diff.changedPaths.some((path) => path.startsWith('map.nodes.0.')));
});

test('engine host discards adapter subscription snapshots when dispatch fails', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const snapshots: RuleSnapshot[] = [];
  host.subscribe((snapshot) => snapshots.push(snapshot));
  snapshots.length = 0;

  const partial = createStubSnapshot({
    lifecycle: { screen: 'Event', phase: 'event', pendingNodeResolution: true },
  });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' });
  adapter.emitSnapshot(partial);
  adapter.rejectDispatch(new Error('adapter exploded'));

  const result = await dispatch;
  assert.equal(result.ok, false);
  assert.match(result.error?.message ?? '', /adapter exploded/);
  assert.equal(result.snapshot.lifecycle.phase, 'map');
  assert.equal(host.getSnapshot()?.lifecycle.phase, 'map');
  assert.deepEqual(snapshots.map((snapshot) => snapshot.lifecycle.phase), ['map']);
});

test('engine host replays rollback snapshot to subscribers added during a failed dispatch', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' });
  const phases: string[] = [];

  host.subscribe((snapshot) => phases.push(snapshot.lifecycle.phase));
  assert.deepEqual(phases, []);

  adapter.rejectDispatch(new Error('adapter exploded'));

  const result = await dispatch;
  assert.equal(result.ok, false);
  assert.deepEqual(phases, ['map']);
});

test('engine host dispatch failures expose captured global events for diagnostics', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' });

  globalEventBus.publish({ type: 'CombatStart' } as any);
  adapter.rejectDispatch(new Error('adapter exploded'));

  const result = await dispatch;
  assert.equal(result.ok, false);
  assert.equal(result.snapshot.lifecycle.phase, 'map');
  assert.ok(result.events.some((event) => event.type === 'CombatStart'));
  assert.equal(result.error?.name, 'Error');
  assert.match(result.error?.message ?? '', /adapter exploded/);
});

test('engine host can still throw failed dispatches when requested', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' }, { throwOnFailure: true });

  globalEventBus.publish({ type: 'CombatStart' } as any);
  adapter.rejectDispatch(new Error('adapter exploded'));

  await assert.rejects(
    dispatch,
    (error: unknown) => {
      assert.ok(error instanceof DispatchFailedError);
      assert.ok(error.events.some((event) => event.type === 'CombatStart'));
      assert.equal(error.result.ok, false);
      assert.match(String(error.cause), /adapter exploded/);
      return true;
    }
  );
});

test('engine host emits one startup snapshot when adapter subscribe replays immediately', async () => {
  const host = createEngineHost(new ObservableStubAdapter());
  const phases: string[] = [];
  host.subscribe((snapshot) => phases.push(snapshot.lifecycle.phase));

  await host.start({ seed: 7 });

  assert.deepEqual(phases, ['map']);
});

test('engine host emits one startup snapshot when adapter subscribe replays asynchronously', async () => {
  class AsyncReplayAdapter extends ObservableStubAdapter {
    override subscribe(listener: (snapshot: RuleSnapshot) => void): () => void {
      const unsubscribe = super.subscribe(() => {});
      const snapshot = this.getSnapshot();
      queueMicrotask(() => {
        if (snapshot) listener(snapshot);
      });
      return unsubscribe;
    }
  }

  const host = createEngineHost(new AsyncReplayAdapter());
  const phases: string[] = [];
  host.subscribe((snapshot) => phases.push(snapshot.lifecycle.phase));

  await host.start({ seed: 7 });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(phases, ['map']);
});

test('engine host does not immediately replay a stale snapshot to subscribers added during dispatch', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' });
  const phases: string[] = [];

  host.subscribe((snapshot) => phases.push(snapshot.lifecycle.phase));
  assert.deepEqual(phases, []);

  adapter.resolveDispatch(createStubSnapshot({
    lifecycle: { screen: 'Event', phase: 'event', pendingNodeResolution: true },
  }));
  await dispatch;

  assert.deepEqual(phases, ['event']);
});

test('engine host coalesces adapter subscription updates into the successful dispatch result', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const phases: string[] = [];
  host.subscribe((snapshot) => phases.push(snapshot.lifecycle.phase));
  phases.length = 0;

  const finalSnapshot = createStubSnapshot({
    lifecycle: { screen: 'Event', phase: 'event', pendingNodeResolution: true },
  });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' });
  adapter.emitSnapshot(finalSnapshot);
  adapter.resolveDispatch(finalSnapshot);
  await dispatch;

  assert.deepEqual(phases, ['event']);
});

test('engine host refuses to repopulate snapshot after dispose races an in-flight dispatch', async () => {
  const adapter = new ObservableStubAdapter();
  const host = createEngineHost(adapter);
  await host.start({ seed: 7 });
  const dispatch = host.dispatch({ type: 'enter_node', nodeId: 'node-1' });

  host.dispose();
  adapter.resolveDispatch(createStubSnapshot({
    lifecycle: { screen: 'Event', phase: 'event', pendingNodeResolution: true },
  }));

  await assert.rejects(dispatch, /disposed/i);
  assert.equal(host.getSnapshot(), null);
});

test('engine host includes global events published during a dispatch result', async () => {
  class EventPublishingAdapter extends StubRoomAdapter {
    override async dispatch(): Promise<RuleSnapshot> {
      globalEventBus.publish({ type: 'CombatStart' } as any);
      return createStubSnapshot({
        lifecycle: { screen: 'Combat', phase: 'combat', pendingNodeResolution: false },
      });
    }
  }

  const host = createEngineHost(new EventPublishingAdapter());
  await host.start({ seed: 7 });
  const result = await host.dispatch({ type: 'enter_node', nodeId: 'node-1' });

  assert.equal(result.events[0]?.type, 'runtime.enter_node');
  assert.ok(result.events.some((event) => event.type === 'CombatStart'));
});

test('legacy oracle adapter keeps its GameEngine contract explicit instead of using unknown method probes', () => {
  const source = readFileSync(resolve('src/runtimeV2/bridge/legacyOracleAdapter.ts'), 'utf-8');
  assert.equal(source.includes('as unknown as'), false);
});

test('engine host can surface reward snapshots from runtime v2 adapters', async () => {
  class StubRewardAdapter extends StubRoomAdapter {
    override async dispatch(command: Parameters<RuleRuntimeAdapter['dispatch']>[0]): Promise<RuleSnapshot> {
      if (command.type === 'complete_combat') {
        return createStubSnapshot({
          lifecycle: {
            screen: 'Reward',
            phase: 'reward',
            pendingNodeResolution: true
          },
          map: {
            currentNodeId: 'node-2',
            nodes: [
              { id: 'node-1', type: 'Event', x: 0.5, y: 0, revealed: true, next: ['node-2'] },
              { id: 'node-2', type: 'Combat', x: 0.5, y: 1, revealed: true, next: [] }
            ]
          },
          combat: null,
          reward: {
            cardIds: ['gather_intel', 'precision_strike', 'surveillance'],
            source: 'combat'
          },
          meta: {
            runId: 'stub-run',
            replayLength: 2,
            generatedAt: new Date(0).toISOString(),
            adapter: 'python-wasm'
          }
        });
      }
      return super.dispatch(command);
    }
  }

  const host = createEngineHost(new StubRewardAdapter());
  await host.start({ seed: 7 });
  const reward = await host.dispatch({ type: 'complete_combat' });

  assert.equal(reward.snapshot.lifecycle.phase, 'reward');
  assert.deepEqual(reward.snapshot.reward?.cardIds, ['gather_intel', 'precision_strike', 'surveillance']);
  assert.equal(reward.snapshot.reward?.source, 'combat');
});

test('engine host can derive a render model from the active snapshot', async () => {
  class StubRenderAdapter extends StubRoomAdapter {
    override async dispatch(command: Parameters<RuleRuntimeAdapter['dispatch']>[0]): Promise<RuleSnapshot> {
      if (command.type === 'complete_combat') {
        return createStubSnapshot({
          lifecycle: {
            screen: 'Reward',
            phase: 'reward',
            pendingNodeResolution: true
          },
          map: {
            currentNodeId: 'node-2',
            nodes: [
              { id: 'node-1', type: 'Event', x: 0.5, y: 0, revealed: true, next: ['node-2'] },
              { id: 'node-2', type: 'Combat', x: 0.5, y: 1, revealed: true, next: ['node-3'] },
              { id: 'node-3', type: 'Rest', x: 0.5, y: 2, revealed: true, next: [] }
            ]
          },
          reward: {
            cardIds: ['gather_intel', 'precision_strike', 'surveillance'],
            source: 'combat'
          }
        });
      }
      return super.dispatch(command);
    }
  }

  const host = createEngineHost(new StubRenderAdapter());
  await host.start({ seed: 7 });

  const initialRenderModel = host.getRenderModel();
  assert.ok(initialRenderModel);
  assert.equal(initialRenderModel.player.deckCount, 2);
  assert.equal(initialRenderModel.player.healthRatio, 1);
  assert.deepEqual(initialRenderModel.map.revealedNodeIds, ['node-1']);
  assert.deepEqual(initialRenderModel.map.availableNodeIds, ['node-1']);

  await host.dispatch({ type: 'enter_node', nodeId: 'node-1' });
  const roomRenderModel = host.getRenderModel();
  assert.ok(roomRenderModel);
  assert.deepEqual(roomRenderModel.map.availableNodeIds, ['node-2']);

  await host.dispatch({ type: 'complete_combat' });
  const rewardRenderModel = host.getRenderModel();
  assert.ok(rewardRenderModel);
  assert.equal(rewardRenderModel.reward?.offerCount, 3);
  assert.deepEqual(rewardRenderModel.map.availableNodeIds, ['node-3']);
});

test('engine host can subscribe to render model updates', async () => {
  const host = createEngineHost(new StubRoomAdapter());
  const phases: string[] = [];
  const unsubscribe = host.subscribeRenderModel((renderModel) => {
    phases.push(renderModel.lifecycle.phase);
  });

  await host.start({ seed: 7 });
  await host.dispatch({ type: 'enter_node', nodeId: 'node-1' });

  unsubscribe();
  await host.dispatch({ type: 'leave_room' });

  assert.deepEqual(phases, ['map', 'event']);
});

test('engine host render model exposes generic room kind for shop snapshots', async () => {
  class StubShopAdapter extends StubRoomAdapter {
    override async start(): Promise<RuleSnapshot> {
      return createStubSnapshot({
        lifecycle: {
          screen: 'Shop',
          phase: 'shop',
          pendingNodeResolution: true,
        },
      });
    }
  }

  const host = createEngineHost(new StubShopAdapter());
  await host.start({ seed: 7 });

  const renderModel = host.getRenderModel();
  assert.ok(renderModel);
  assert.equal(renderModel.room?.kind, 'shop');
});

test('legacy oracle shop snapshots expose purchasable card offers to runtime-v2 render model', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  let selectedShopNodeId: string | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const candidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Shop' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (candidate) {
      selectedShopNodeId = candidate.id;
      break;
    }
  }

  assert.ok(selectedShopNodeId, 'expected at least one seed with an available first-floor shop node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedShopNodeId! });
  const renderModel = host.getRenderModel();
  const offers = ((renderModel?.room as any)?.cards ?? []) as Array<{ id: string; price: number }>;
  const relicOffers = ((renderModel?.room as any)?.relics ?? []) as Array<{ id: string; price: number }>;
  const potionOffers = ((renderModel?.room as any)?.potions ?? []) as Array<{ id: string; price: number }>;

  assert.equal(renderModel?.room?.kind, 'shop');
  assert.ok(offers.length > 0, 'expected runtime-v2 shop room to expose at least one purchasable card');
  assert.ok(relicOffers.length > 0, 'expected runtime-v2 shop room to expose at least one purchasable relic');
  assert.ok(potionOffers.length > 0, 'expected runtime-v2 shop room to expose at least one purchasable potion');
  assert.equal(typeof offers[0]?.id, 'string');
  assert.equal(typeof offers[0]?.price, 'number');
  assert.equal(typeof relicOffers[0]?.id, 'string');
  assert.equal(typeof potionOffers[0]?.id, 'string');

  host.dispose();
});

test('legacy normalizer serializes adjusted shop prices from the live engine state', () => {
  let engine: GameEngine | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    const candidate = new GameEngine(seed, null, { enableRuntimeDelegation: false });
    candidate.selectCharacter('informant');
    const shopNode = candidate.state.map.find((node) => node.type === 'Shop' && node.y === 0);
    if (shopNode) {
      engine = candidate;
      candidate.state.player.relics.push('lantern');
      candidate.enterNode(shopNode.id);
      break;
    }
    candidate.dispose();
  }

  assert.ok(engine, 'expected at least one seed with an available first-floor shop node');

  try {
    const snapshot = normalizeLegacyGameState(engine.state, engine.getSaveData());
    const firstCard = engine.state.shopCards[0];
    assert.ok(firstCard, 'expected at least one shop card');
    const expectedPrice = engine.getAdjustedShopPrice(
      firstCard.rarity === 'Rare' ? 150 : firstCard.rarity === 'Uncommon' ? 75 : 50
    );

    assert.equal(snapshot.shop?.cards[0]?.id, firstCard.id);
    assert.equal(snapshot.shop?.cards[0]?.price, expectedPrice);
  } finally {
    engine.dispose();
  }
});

test('legacy normalizer serializes finite fallback prices for malformed potion offers', () => {
  const potion = potionsData.find((entry) => entry.id === 'healing_potion');
  assert.ok(potion, 'missing healing_potion fixture');
  const originalPrice = potion.price;
  (potion as any).price = undefined;
  const engine = new GameEngine(20260416, null, { enableRuntimeDelegation: false });

  try {
    engine.selectCharacter('informant');
    engine.state.screen = 'Shop';
    engine.state.player.gold = 100;
    engine.state.shopPotions = ['healing_potion'];

    const snapshot = normalizeLegacyGameState(engine.state, engine.getSaveData());

    assert.equal(snapshot.shop?.potions[0]?.id, 'healing_potion');
    assert.equal(snapshot.shop?.potions[0]?.price, 65);
    assert.ok(Number.isFinite(snapshot.shop?.potions[0]?.price));
  } finally {
    potion.price = originalPrice;
    engine.dispose();
  }
});

test('engine host render model keeps current-node successors available even before reveal flags advance', async () => {
  class StubProgressionAdapter extends StubRoomAdapter {
    override async start(): Promise<RuleSnapshot> {
      return createStubSnapshot({
        player: {
          characterId: 'informant',
          hp: 85,
          maxHp: 85,
          gold: 115,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend', 'vanishing_strike'],
          relicIds: [],
          potionIds: [],
        },
        map: {
          currentNodeId: 'node-1',
          nodes: [
            { id: 'node-1', type: 'Combat', x: 0.4, y: 0, revealed: true, next: ['node-2'] },
            { id: 'node-2', type: 'Event', x: 0.5, y: 1, revealed: false, next: [] },
          ],
        },
      });
    }
  }

  const host = createEngineHost(new StubProgressionAdapter());
  await host.start({ seed: 7 });

  const renderModel = host.getRenderModel();
  assert.ok(renderModel);
  assert.deepEqual(renderModel.map.availableNodeIds, ['node-2']);
});

test('legacy oracle event rooms still expose follow-up map nodes after leaving the room', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  let selectedEventNodeId: string | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const candidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Event' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (candidate) {
      selectedEventNodeId = candidate.id;
      break;
    }
  }

  assert.ok(selectedEventNodeId, 'expected at least one seed with an available first-floor event node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedEventNodeId });
  await host.dispatch({ type: 'leave_room' });

  const renderModel = host.getRenderModel();
  assert.ok(renderModel);
  assert.ok(renderModel.map.availableNodeIds.length > 0, 'event return should still expose at least one follow-up node');

  host.dispose();
});

test('legacy oracle upgrade and remove-card commands enter dedicated surfaces before applying card selections', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  let selectedRestNodeId: string | null = null;
  let selectedShopNodeId: string | null = null;

  for (let seed = 1; seed <= 60; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const restCandidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Rest' && renderModel.map.availableNodeIds.includes(node.id)
    );
    const shopCandidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Shop' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (restCandidate && shopCandidate) {
      selectedRestNodeId = restCandidate.id;
      selectedShopNodeId = shopCandidate.id;
      break;
    }
  }

  assert.ok(selectedRestNodeId, 'expected a first-floor rest node');
  assert.ok(selectedShopNodeId, 'expected a first-floor shop node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedRestNodeId! });
  await host.dispatch({ type: 'upgrade_card' });
  let renderModel = host.getRenderModel();
  assert.equal(renderModel?.screen, 'Upgrade');
  assert.equal(renderModel?.room?.kind, 'upgrade');
  assert.ok((renderModel?.room?.choices?.length ?? 0) > 0);

  await host.dispatch({ type: 'cancel_surface' });
  renderModel = host.getRenderModel();
  assert.equal(renderModel?.screen, 'Rest');

  await host.start({ seed: 1 });
  for (let seed = 1; seed <= 60; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const candidateModel = host.getRenderModel();
    const shopCandidate = candidateModel?.map.nodes.find(
      (node) => node.type === 'Shop' && candidateModel.map.availableNodeIds.includes(node.id)
    );
    if (shopCandidate) {
      selectedShopNodeId = shopCandidate.id;
      break;
    }
  }

  await host.dispatch({ type: 'enter_node', nodeId: selectedShopNodeId! });
  const shopRenderModel = host.getRenderModel();
  const initialDeckCount = shopRenderModel?.player.deckCount ?? 0;
  await host.dispatch({ type: 'remove_card' });
  renderModel = host.getRenderModel();
  assert.equal(renderModel?.screen, 'RemoveCard');
  assert.equal(renderModel?.room?.kind, 'remove_card');
  const selectedToken = renderModel?.room?.choices?.[0]?.id;
  assert.ok(selectedToken, 'expected at least one remove-card token');

  await host.dispatch({ type: 'remove_card', cardInstanceId: selectedToken });
  renderModel = host.getRenderModel();
  assert.equal(renderModel?.screen, 'Shop');
  assert.equal(renderModel?.player.deckCount, initialDeckCount - 1);

  host.dispose();
});

test('legacy oracle combat rewards still expose follow-up map nodes after returning to map', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  let selectedCombatNodeId: string | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const candidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Combat' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (candidate) {
      selectedCombatNodeId = candidate.id;
      break;
    }
  }

  assert.ok(selectedCombatNodeId, 'expected at least one seed with an available first-floor combat node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedCombatNodeId });
  await host.dispatch({ type: 'complete_combat' });
  await host.dispatch({ type: 'take_reward' });

  const renderModel = host.getRenderModel();
  assert.ok(renderModel);
  assert.ok(renderModel.map.availableNodeIds.length > 0, 'reward return should still expose at least one follow-up node');

  host.dispose();
});

test('load_snapshot preserves follow-up map nodes after legacy event room return', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  let selectedEventNodeId: string | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const candidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Event' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (candidate) {
      selectedEventNodeId = candidate.id;
      break;
    }
  }

  assert.ok(selectedEventNodeId, 'expected at least one seed with an available first-floor event node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedEventNodeId });
  const left = await host.dispatch({ type: 'leave_room' });
  const availableBeforeSave = host.getRenderModel()?.map.availableNodeIds ?? [];

  const restoredHost = createEngineHost(createLegacyOracleAdapter());
  await restoredHost.start({ seed: 999 });
  await restoredHost.dispatch({ type: 'load_snapshot', snapshot: left.snapshot });

  const restoredRenderModel = restoredHost.getRenderModel();
  assert.ok(restoredRenderModel);
  assert.equal(restoredRenderModel.map.currentNodeId, left.snapshot.map.currentNodeId);
  assert.deepEqual(restoredRenderModel.map.availableNodeIds, availableBeforeSave);

  host.dispose();
  restoredHost.dispose();
});

test('load_snapshot preserves follow-up map nodes after legacy reward return', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());
  let selectedCombatNodeId: string | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const candidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Combat' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (candidate) {
      selectedCombatNodeId = candidate.id;
      break;
    }
  }

  assert.ok(selectedCombatNodeId, 'expected at least one seed with an available first-floor combat node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedCombatNodeId });
  await host.dispatch({ type: 'complete_combat' });
  const returnedToMap = await host.dispatch({ type: 'take_reward' });
  const availableBeforeSave = host.getRenderModel()?.map.availableNodeIds ?? [];

  const restoredHost = createEngineHost(createLegacyOracleAdapter());
  await restoredHost.start({ seed: 999 });
  await restoredHost.dispatch({ type: 'load_snapshot', snapshot: returnedToMap.snapshot });

  const restoredRenderModel = restoredHost.getRenderModel();
  assert.ok(restoredRenderModel);
  assert.equal(restoredRenderModel.map.currentNodeId, returnedToMap.snapshot.map.currentNodeId);
  assert.deepEqual(restoredRenderModel.map.availableNodeIds, availableBeforeSave);
  assert.equal(restoredRenderModel.player.deckCount, host.getRenderModel()?.player.deckCount);

  host.dispose();
  restoredHost.dispose();
});

test.skip('python wasm rest command heals and returns to map with follow-up nodes intact', async () => {
  const host = createEngineHost(createPythonWasmAdapter());
  let selectedRestNodeId: string | null = null;

  for (let seed = 1; seed <= 40; seed += 1) {
    await host.start({ seed });
    await host.dispatch({ type: 'select_character', characterId: 'informant' });
    const renderModel = host.getRenderModel();
    const candidate = renderModel?.map.nodes.find(
      (node) => node.type === 'Rest' && renderModel.map.availableNodeIds.includes(node.id)
    );
    if (candidate) {
      selectedRestNodeId = candidate.id;
      break;
    }
  }

  assert.ok(selectedRestNodeId, 'expected at least one seed with an available first-floor rest node');

  await host.dispatch({ type: 'enter_node', nodeId: selectedRestNodeId });
  const hpBeforeRest = host.getSnapshot()?.player.hp ?? 0;
  await host.dispatch({ type: 'rest' });

  const renderModel = host.getRenderModel();
  const snapshot = host.getSnapshot();
  assert.equal(renderModel?.screen, 'Map');
  assert.equal(snapshot?.lifecycle.phase, 'map');
  assert.ok((snapshot?.player.hp ?? 0) >= hpBeforeRest);
  assert.ok((renderModel?.map.availableNodeIds.length ?? 0) > 0, 'rest return should still expose follow-up map nodes');

  host.dispose();
});
