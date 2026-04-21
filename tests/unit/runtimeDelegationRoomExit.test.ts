import test from 'node:test';
import assert from 'node:assert/strict';

import { SyncBootAndMapRuntimeDelegate } from '@/core/events/runtimeDelegation';
import type { RuleSnapshot } from '@/runtimeV2/contracts';

function makeSnapshot(overrides: Partial<RuleSnapshot>): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'runtime-v2-sync',
    seed: 1,
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
      deck: ['precision_strike'],
      relicIds: [],
      potionIds: [],
    },
    map: {
      currentNodeId: 'floor_1_node_0',
      nodes: [
        { id: 'floor_1_node_0', type: 'Combat', x: 0, y: 0, revealed: true, next: ['floor_2_node_0'] },
        { id: 'floor_2_node_0', type: 'Event', x: 0, y: 1, revealed: true, next: [] },
      ],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    roomSession: null,
    meta: {
      runId: 'test-run',
      replayLength: 1,
      generatedAt: new Date(0).toISOString(),
      adapter: 'python-wasm',
    },
    ...overrides,
  };
}

test('SyncBootAndMapRuntimeDelegate.takeReward clears stale roomSession when returning to map', () => {
  const delegate = new SyncBootAndMapRuntimeDelegate();
  delegate.start(1);
  delegate.loadSnapshot(
    makeSnapshot({
      lifecycle: {
        screen: 'Reward',
        phase: 'reward',
        pendingNodeResolution: true,
      },
      reward: {
        cardIds: ['precision_strike', 'watch'],
        source: 'combat',
      },
      roomSession: {
        token: 'room_token',
        nodeId: 'floor_1_node_0',
        ownerKind: 'combat',
        resolverKind: 'reward',
        surfaceStack: ['combat'],
        status: 'active',
      },
    }),
  );

  const snapshot = delegate.takeReward('precision_strike');

  assert.equal(snapshot.lifecycle.screen, 'Map');
  assert.equal(snapshot.lifecycle.pendingNodeResolution, false);
  assert.equal(snapshot.roomSession, null);
});

test('SyncBootAndMapRuntimeDelegate.skipReward clears stale roomSession when returning to map', () => {
  const delegate = new SyncBootAndMapRuntimeDelegate();
  delegate.start(1);
  delegate.loadSnapshot(
    makeSnapshot({
      lifecycle: {
        screen: 'Reward',
        phase: 'reward',
        pendingNodeResolution: true,
      },
      reward: {
        cardIds: ['precision_strike', 'watch'],
        source: 'combat',
      },
      roomSession: {
        token: 'room_token',
        nodeId: 'floor_1_node_0',
        ownerKind: 'combat',
        resolverKind: 'reward',
        surfaceStack: ['combat'],
        status: 'active',
      },
    }),
  );

  const snapshot = delegate.skipReward();

  assert.equal(snapshot.lifecycle.screen, 'Map');
  assert.equal(snapshot.lifecycle.pendingNodeResolution, false);
  assert.equal(snapshot.roomSession, null);
});

test('SyncBootAndMapRuntimeDelegate.leaveRoom clears stale roomSession when returning to map', () => {
  const delegate = new SyncBootAndMapRuntimeDelegate();
  delegate.start(1);
  delegate.loadSnapshot(
    makeSnapshot({
      lifecycle: {
        screen: 'Event',
        phase: 'event',
        pendingNodeResolution: true,
      },
      activeEvent: {
        id: 'mysterious_shrine',
        stage: 'choice',
        data: {},
      },
      roomSession: {
        token: 'room_token',
        nodeId: 'floor_1_node_0',
        ownerKind: 'event',
        resolverKind: 'event',
        surfaceStack: ['event'],
        status: 'active',
      },
    }),
  );

  const snapshot = delegate.leaveRoom();

  assert.equal(snapshot.lifecycle.screen, 'Map');
  assert.equal(snapshot.lifecycle.pendingNodeResolution, false);
  assert.equal(snapshot.roomSession, null);
});
