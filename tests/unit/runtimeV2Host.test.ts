import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import {
  createEngineHost,
  createLegacyOracleAdapter,
  normalizeLegacyGameState,
  type RuleRuntimeAdapter,
  type RuleSnapshot
} from '@/runtimeV2';

test('engine host can boot a legacy oracle adapter and project a contract snapshot', async () => {
  const host = createEngineHost(createLegacyOracleAdapter());

  await host.start({ seed: 12345 });
  const result = await host.dispatch({ type: 'select_character', characterId: 'informant' });

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
