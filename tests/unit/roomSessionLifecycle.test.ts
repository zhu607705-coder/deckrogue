/**
 * @file roomSessionLifecycle.test.ts
 * @description Unit tests for room session lifecycle and surface stack management.
 *
 * 主要职责:
 * - 测试商店嵌套表面的单一 RoomSession 所有者
 * - 测试表面栈的正确推入与弹出
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { createRoomSessionForNode, setRoomSession, syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import { projectRuleSnapshotToLegacyState } from '@/runtimeV2/legacyStateProjector';

test('shop nested surfaces keep a single RoomSession owner while switching surfaces', () => {
  const engine = new GameEngine(1234, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = 'shop_node';
    engine.state.screen = 'Shop';
    engine.state.player.gold = 999;
    setRoomSession(engine.state, createRoomSessionForNode({
      token: 'room_shop_token',
      nodeId: 'shop_node',
      ownerKind: 'shop',
    }));

    engine.enterUpgrade('Shop');
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['shop', 'upgrade']);
    assert.equal(engine.state.roomSession?.ownerKind, 'shop');
    assert.equal(engine.state.roomResolutionKind, 'shop');

    engine.cancelUpgrade();
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['shop']);

    engine.enterShopEnchant();
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['shop', 'enchant']);
    assert.equal(engine.state.roomSession?.ownerKind, 'shop');

    engine.cancelEnchant();
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['shop']);
  } finally {
    engine.dispose();
  }
});

test('rest relic-upgrade uses RoomSession rest ownership instead of degrading to shop', () => {
  const engine = new GameEngine(5678, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = 'rest_node';
    engine.state.screen = 'Rest';
    engine.state.player.relics.push('mark_of_chaos');
    setRoomSession(engine.state, createRoomSessionForNode({
      token: 'room_rest_token',
      nodeId: 'rest_node',
      ownerKind: 'rest',
    }));

    engine.restUpgradeRelic();
    assert.equal(engine.state.roomSession?.ownerKind, 'rest');
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['rest', 'relic_upgrade']);

    engine.cancelRelicUpgrade();
    assert.equal(engine.state.screen, 'Rest');
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['rest']);
  } finally {
    engine.dispose();
  }
});

test('rest disperse keeps rest RoomSession ownership through cancel', () => {
  const engine = new GameEngine(6789, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = 'rest_node';
    engine.state.screen = 'Rest';
    setRoomSession(engine.state, createRoomSessionForNode({
      token: 'room_rest_token',
      nodeId: 'rest_node',
      ownerKind: 'rest',
    }));

    engine.restDisperse();
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['rest', 'remove_card']);
    assert.equal(engine.state.roomSession?.ownerKind, 'rest');

    engine.cancelCardRemoval();
    assert.equal(engine.state.screen, 'Rest');
    assert.deepEqual(engine.state.roomSession?.surfaceStack, ['rest']);
    assert.equal(engine.state.roomSession?.ownerKind, 'rest');
  } finally {
    engine.dispose();
  }
});

test('RoomSession round-trips through normalizeLegacyGameState and legacy projector', () => {
  const engine = new GameEngine(2468, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = 'event_node';
    engine.state.screen = 'Enchant';
    engine.state.enchantContext = {
      source: 'Event',
      enchantmentId: 'swift_sigil',
      returnScreen: 'Event',
    };
    syncRoomSessionFromLegacyState(engine.state);

    const snapshot = normalizeLegacyGameState(engine.state, engine.getSaveData());
    assert.ok(snapshot.roomSession);
    assert.equal(snapshot.roomSession?.ownerKind, 'event');
    assert.deepEqual(snapshot.roomSession?.surfaceStack, ['event', 'enchant']);

    const projection = projectRuleSnapshotToLegacyState(snapshot);
    assert.ok(projection.roomSession);
    assert.equal(projection.roomSession?.ownerKind, 'event');
    assert.deepEqual(projection.roomSession?.surfaceStack, ['event', 'enchant']);
  } finally {
    engine.dispose();
  }
});

test('syncRoomSessionFromLegacyState clears stale room markers on settled screens', () => {
  const engine = new GameEngine(9753, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = 'floor_1_node_0';
    setRoomSession(engine.state, createRoomSessionForNode({
      token: 'stale-room',
      nodeId: 'floor_1_node_0',
      ownerKind: 'combat',
    }));
    engine.state.screen = 'Victory';
    engine.state.pendingNodeResolution = false;

    syncRoomSessionFromLegacyState(engine.state);

    assert.equal(engine.state.roomSession, null);
    assert.equal(engine.state.roomResolutionToken, null);
    assert.equal(engine.state.roomResolutionKind, null);
    assert.equal(engine.state.pendingNodeResolution, false);
  } finally {
    engine.dispose();
  }
});

test('normalizeLegacyGameState ignores stale roomSession when legacy state is already settled', () => {
  const engine = new GameEngine(8642, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = 'floor_1_node_0';
    setRoomSession(engine.state, createRoomSessionForNode({
      token: 'stale-room',
      nodeId: 'floor_1_node_0',
      ownerKind: 'combat',
    }));
    engine.state.screen = 'Map';
    engine.state.pendingNodeResolution = false;

    const snapshot = normalizeLegacyGameState(engine.state, {});

    assert.equal(snapshot.lifecycle.pendingNodeResolution, false);
    assert.equal(snapshot.roomSession, null);
  } finally {
    engine.dispose();
  }
});

test('getSaveData serializes authoritative roomSession from legacy room resolution fields', () => {
  const engine = new GameEngine(6428, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    const firstNode = engine.state.map.find((node) => node.y === 0);
    engine.state.currentNodeId = firstNode?.id ?? 'floor_1_node_0';
    engine.state.screen = 'Shop';
    engine.state.pendingNodeResolution = true;
    engine.state.roomResolutionToken = 'legacy-shop-token';
    engine.state.roomResolutionKind = 'shop';
    engine.state.roomSession = null;

    const saveData = engine.getSaveData() as { state: typeof engine.state };

    assert.equal(saveData.state.roomSession?.token, 'legacy-shop-token');
    assert.equal(saveData.state.roomSession?.ownerKind, 'shop');
    assert.deepEqual(saveData.state.roomSession?.surfaceStack, ['shop']);
  } finally {
    engine.dispose();
  }
});
