import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSaveGameV2,
  createReplayLogV1,
  replayOnAdapter,
  restoreSnapshotFromSaveGame,
  type EngineHostStartOptions,
  type RuleCommand,
  type RuleRuntimeAdapter,
  type RuleSnapshot,
} from '@/runtimeV2';

function createSnapshot(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'test-runtime',
    seed: 77,
    lifecycle: {
      screen: 'Map',
      phase: 'map',
      pendingNodeResolution: false,
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
      potionIds: [],
    },
    map: {
      currentNodeId: null,
      nodes: [],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: 'run-1',
      replayLength: 0,
      generatedAt: new Date(0).toISOString(),
      adapter: 'python-wasm',
    },
    ...overrides,
  };
}

class ReplayStubAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private snapshot: RuleSnapshot | null = null;

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.snapshot = createSnapshot({ seed: options.seed ?? 77 });
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    const current = this.snapshot ?? (await this.start());
    if (command.type === 'select_character') {
      this.snapshot = createSnapshot({
        seed: current.seed,
        player: { ...current.player, characterId: command.characterId, deck: ['strike', 'defend', 'gather_intel'] },
        meta: { ...current.meta, replayLength: 1 },
      });
      return this.snapshot;
    }
    if (command.type === 'enter_node') {
      this.snapshot = createSnapshot({
        seed: current.seed,
        lifecycle: { screen: 'Combat', phase: 'combat', pendingNodeResolution: true },
        map: {
          currentNodeId: command.nodeId,
          nodes: [{ id: command.nodeId, type: 'Combat', x: 0.5, y: 0, revealed: true, next: [] }],
        },
        combat: {
          turn: 1,
          isPlayerTurn: true,
          playerBlock: 0,
          playerEnergy: 3,
          enemyIds: ['slime_small'],
          enemies: [
            {
              id: 'enemy-1',
              defId: 'slime_small',
              hp: 24,
              maxHp: 24,
              block: 0,
              nextIntent: 'tackle',
            },
          ],
          hand: ['strike', 'defend'],
          drawPileCount: 1,
          discardPileCount: 0,
        },
        reward: null,
        meta: { ...current.meta, replayLength: 2 },
      });
      return this.snapshot;
    }
    if (command.type === 'complete_combat') {
      this.snapshot = createSnapshot({
        seed: current.seed,
        lifecycle: { screen: 'Reward', phase: 'reward', pendingNodeResolution: true },
        map: {
          currentNodeId: 'node-1',
          nodes: [{ id: 'node-1', type: 'Combat', x: 0.5, y: 0, revealed: true, next: [] }],
        },
        combat: null,
        reward: { cardIds: ['gather_intel', 'surveillance', 'precision_strike'], source: 'combat' },
        meta: { ...current.meta, replayLength: 3 },
      });
      return this.snapshot;
    }
    if (command.type === 'take_reward') {
      this.snapshot = createSnapshot({
        seed: current.seed,
        lifecycle: { screen: 'Map', phase: 'map', pendingNodeResolution: false },
        map: {
          currentNodeId: 'node-1',
          nodes: [{ id: 'node-1', type: 'Combat', x: 0.5, y: 0, revealed: true, next: [] }],
        },
        player: { ...current.player, deck: [...current.player.deck, command.cardId ?? 'gather_intel'] },
        combat: null,
        reward: null,
        meta: { ...current.meta, replayLength: 4 },
      });
      return this.snapshot;
    }
    this.snapshot = current;
    return current;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    this.snapshot = null;
  }
}

test('createSaveGameV2 wraps and restores a runtime snapshot', () => {
  const snapshot = createSnapshot({
    reward: {
      cardIds: ['gather_intel', 'surveillance', 'precision_strike'],
      source: 'combat',
    },
  });

  const saveGame = createSaveGameV2(snapshot, 'web', '2026-03-11T10:00:00.000Z');
  const restored = restoreSnapshotFromSaveGame(saveGame);

  assert.equal(saveGame.hostPlatform, 'web');
  assert.equal(saveGame.savedAt, '2026-03-11T10:00:00.000Z');
  assert.deepEqual(restored, snapshot);
});

test('replayOnAdapter replays an ordered command log to the final snapshot', async () => {
  const replayLog = createReplayLogV1(77, [
    { type: 'select_character', characterId: 'informant' },
    { type: 'enter_node', nodeId: 'node-1' },
    { type: 'complete_combat' },
    { type: 'take_reward', cardId: 'gather_intel' },
  ]);

  const finalSnapshot = await replayOnAdapter(new ReplayStubAdapter(), replayLog);

  assert.equal(finalSnapshot.seed, 77);
  assert.equal(finalSnapshot.lifecycle.phase, 'map');
  assert.equal(finalSnapshot.map.currentNodeId, 'node-1');
  assert.equal(finalSnapshot.reward, null);
  assert.ok(finalSnapshot.player.deck.includes('gather_intel'));
  assert.equal(finalSnapshot.meta.replayLength, 4);
});
