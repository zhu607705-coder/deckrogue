/**
 * @file routeStateSurfaceContext.test.ts
 * @description Unit tests for route state and surface context preservation through runtime snapshots.
 *
 * 主要职责:
 * - 测试快照中路由状态的保留
 * - 测试休息升级表面上下文的正确投影
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import { projectRuleSnapshotToLegacyState } from '@/runtimeV2/legacyStateProjector';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import { syncRoomSessionFromLegacyState } from '@/core/events/roomSession';

test('runtime snapshot preserves routeState and rest upgrade surface context through projection', () => {
  const engine = new GameEngine(41, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
    engine.state.screen = 'Upgrade';
    engine.state.upgradeReturnScreen = 'Rest';
    engine.state.campfireChoiceLocked = true;
    engine.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 72,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'reward', floor: 2, weight: 16 }],
    };
    syncSurfaceContextFromLegacyState(engine.state);
    syncRoomSessionFromLegacyState(engine.state);

    const snapshot = normalizeLegacyGameState(engine.state, {});
    const projection = projectRuleSnapshotToLegacyState(snapshot);

    assert.equal(projection.routeState?.primaryTag, 'informant:evidence');
    assert.equal(projection.surfaceContext?.upgradeReturnScreen, 'Rest');
    assert.equal(projection.surfaceContext?.campfireChoiceLocked, true);
    assert.equal(projection.pendingNodeResolution, true);
  } finally {
    engine.dispose();
  }
});

test('loadSaveData restores rest upgrade cancel back to rest instead of map', () => {
  const source = new GameEngine(43, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(44, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Upgrade';
    source.state.upgradeReturnScreen = 'Rest';
    source.state.campfireChoiceLocked = true;
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 72,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'reward', floor: 2, weight: 16 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    restored.loadSaveData({
      state: structuredClone(source.state),
      rngState: source.state.rngState,
    });
    restored.cancelUpgrade();

    assert.equal(restored.state.screen, 'Rest');
    assert.equal(restored.state.campfireChoiceLocked, false);
    assert.notEqual(restored.state.routeState, null);
  } finally {
    source.dispose();
    restored.dispose();
  }
});

test('restartCombatFromCheckpoint preserves authoritative route and nested surface context in the refreshed checkpoint', () => {
  const engine = new GameEngine(45, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    const firstNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? 'floor_1_node_0';
    engine.state.currentNodeId = firstNodeId;
    engine.state.screen = 'Map';
    engine.state.pendingNodeResolution = true;
    engine.state.roomResolutionToken = 'room_shop_token';
    engine.state.roomResolutionKind = 'shop';
    engine.state.upgradeReturnScreen = 'Shop';
    engine.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 74,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(engine.state);
    syncRoomSessionFromLegacyState(engine.state);
    engine.state.combatRestartCheckpoint = {
      nodeId: firstNodeId,
      nodeType: 'Combat',
      rngState: engine.state.rngState,
      pendingNodeResolution: true,
      stateSnapshot: structuredClone({
        ...engine.state,
        combat: null,
        rewardCards: [],
        shopCards: [],
        shopRelics: [],
        shopPotions: [],
      }),
    };

    const restarted = engine.restartCombatFromCheckpoint();

    assert.equal(restarted, true);
    assert.equal(engine.state.screen, 'Combat');
    assert.equal(engine.state.routeState?.primaryTag, 'informant:evidence');
    assert.equal(engine.state.combatRestartCheckpoint?.stateSnapshot.routeState?.primaryTag, 'informant:evidence');
    assert.equal(engine.state.combatRestartCheckpoint?.stateSnapshot.surfaceContext?.upgradeReturnScreen, 'Shop');
    assert.equal(engine.state.combatRestartCheckpoint?.stateSnapshot.roomSession?.ownerKind, 'shop');
  } finally {
    engine.dispose();
  }
});

test('loadSaveData keeps checkpoint authoritative slices intact before restartCombatFromCheckpoint', () => {
  const source = new GameEngine(46, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(47, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    const firstNodeId = source.state.map.find((node) => node.y === 0)?.id ?? 'floor_1_node_0';
    source.state.currentNodeId = firstNodeId;
    source.state.screen = 'Map';
    source.state.pendingNodeResolution = true;
    source.state.roomResolutionToken = 'room_shop_token';
    source.state.roomResolutionKind = 'shop';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 76,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);
    source.state.combatRestartCheckpoint = {
      nodeId: firstNodeId,
      nodeType: 'Combat',
      rngState: source.state.rngState,
      pendingNodeResolution: true,
      stateSnapshot: structuredClone({
        ...source.state,
        combat: null,
        rewardCards: [],
        shopCards: [],
        shopRelics: [],
        shopPotions: [],
      }),
    };

    restored.loadSaveData(source.getSaveData());
    const restarted = restored.restartCombatFromCheckpoint();

    assert.equal(restarted, true);
    assert.equal(restored.state.screen, 'Combat');
    assert.equal(restored.state.routeState?.primaryTag, 'informant:evidence');
    assert.equal(restored.state.combatRestartCheckpoint?.stateSnapshot.routeState?.primaryTag, 'informant:evidence');
    assert.equal(restored.state.combatRestartCheckpoint?.stateSnapshot.surfaceContext?.upgradeReturnScreen, 'Shop');
    assert.equal(restored.state.combatRestartCheckpoint?.stateSnapshot.roomSession?.ownerKind, 'shop');
  } finally {
    source.dispose();
    restored.dispose();
  }
});

test('loadSaveData preserves explicit null authoritative slices instead of re-deriving legacy mirrors', () => {
  const source = new GameEngine(48, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(49, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    const firstNodeId = source.state.map.find((node) => node.y === 0)?.id ?? 'floor_1_node_0';
    source.state.currentNodeId = firstNodeId;
    source.state.screen = 'Map';
    source.state.pendingNodeResolution = true;
    source.state.roomResolutionToken = 'legacy_shop_room';
    source.state.roomResolutionKind = 'shop';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.surfaceContext = null;
    source.state.roomSession = null;
    source.state.routeState = null;

    restored.loadSaveData({
      state: structuredClone(source.state),
      rngState: source.state.rngState,
    });

    assert.equal(restored.state.surfaceContext, null);
    assert.equal(restored.state.roomSession, null);
    assert.equal(restored.state.routeState, null);
  } finally {
    source.dispose();
    restored.dispose();
  }
});

test('loadSaveData rebuilds omitted authoritative slices from legacy mirrors for compat saves', () => {
  const source = new GameEngine(50, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(51, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    const firstNodeId = source.state.map.find((node) => node.y === 0)?.id ?? 'floor_1_node_0';
    source.state.currentNodeId = firstNodeId;
    source.state.screen = 'Map';
    source.state.pendingNodeResolution = true;
    source.state.roomResolutionToken = 'legacy_shop_room';
    source.state.roomResolutionKind = 'shop';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 74,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const compatState = structuredClone(source.state) as unknown as Record<string, unknown>;
    delete compatState.surfaceContext;
    delete compatState.roomSession;
    delete compatState.routeState;

    restored.loadSaveData({
      state: compatState,
      rngState: source.state.rngState,
    });

    assert.equal(restored.state.surfaceContext?.upgradeReturnScreen, 'Shop');
    assert.equal(restored.state.roomSession?.ownerKind, 'shop');
    assert.notEqual(restored.state.routeState, null);
  } finally {
    source.dispose();
    restored.dispose();
  }
});
