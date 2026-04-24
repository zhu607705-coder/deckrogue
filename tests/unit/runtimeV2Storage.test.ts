/**
 * @file runtimeV2Storage.test.ts
 * @description Unit tests for runtime v2 storage abstraction for save game and replay.
 *
 * 主要职责:
 * - 测试 localStorage 的存档读写
 * - 测试回放日志的持久化
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ReplayLogV1, SaveGameV2 } from '@/runtimeV2';
import {
  RUNTIME_V2_REPLAY_STORAGE_KEY,
  RUNTIME_V2_SAVE_STORAGE_KEY,
  loadRuntimeV2ReplayLog,
  loadRuntimeV2SaveGame,
  saveRuntimeV2ReplayLog,
  saveRuntimeV2SaveGame,
} from '@/runtimeV2/react/runtimeV2Storage';

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test('saveRuntimeV2SaveGame round-trips a SaveGameV2 payload through storage', () => {
  const storage = createStorage();
  const saveGame: SaveGameV2 = {
    schemaVersion: 2,
    savedAt: '2026-03-12T10:00:00.000Z',
    hostPlatform: 'web',
    snapshot: {
      schemaVersion: 2,
      engineVersion: 'test',
      seed: 7,
      lifecycle: { screen: 'Map', phase: 'map', pendingNodeResolution: false },
      player: { characterId: 'informant', hp: 70, maxHp: 70, gold: 99, intel: 0, devotion: 0, corruption: 0, deck: [], relicIds: [], potionIds: [] },
      map: { currentNodeId: null, nodes: [] },
      combat: null,
      reward: null,
      activeEvent: null,
      meta: { runId: null, replayLength: 0, generatedAt: '2026-03-12T10:00:00.000Z', adapter: 'python-wasm' },
    },
  };

  saveRuntimeV2SaveGame(saveGame, storage);
  assert.equal(storage.getItem(RUNTIME_V2_SAVE_STORAGE_KEY) !== null, true);
  assert.deepEqual(loadRuntimeV2SaveGame(storage), saveGame);
});

test('loadRuntimeV2SaveGame returns null for invalid payloads', () => {
  const storage = createStorage({ [RUNTIME_V2_SAVE_STORAGE_KEY]: '{"schemaVersion":1}' });
  assert.equal(loadRuntimeV2SaveGame(storage), null);
});

test('saveRuntimeV2ReplayLog round-trips a ReplayLogV1 payload through storage', () => {
  const storage = createStorage();
  const replayLog: ReplayLogV1 = {
    schemaVersion: 1,
    seed: 42,
    commands: [{ type: 'select_character', characterId: 'informant' }],
  };

  saveRuntimeV2ReplayLog(replayLog, storage);
  assert.equal(storage.getItem(RUNTIME_V2_REPLAY_STORAGE_KEY) !== null, true);
  assert.deepEqual(loadRuntimeV2ReplayLog(storage), replayLog);
});

test('loadRuntimeV2ReplayLog returns null for invalid payloads', () => {
  const storage = createStorage({ [RUNTIME_V2_REPLAY_STORAGE_KEY]: '{"schemaVersion":2}' });
  assert.equal(loadRuntimeV2ReplayLog(storage), null);
});
