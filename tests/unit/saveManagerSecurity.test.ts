/**
 * @file saveManagerSecurity.test.ts
 * @description Unit tests for save validation and checksum handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { SaveManager } from '@/core/persistence/saveManager';
import { globalEventBus } from '@/core/events/eventBus';

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
  };
}

function attachStorage() {
  const storage = createStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
  return storage;
}

test.afterEach(() => {
  globalEventBus.clear();
  delete (globalThis as any).localStorage;
});

test('loadGame rejects saves when slot checksum no longer matches stored data', () => {
  const storage = attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(123, null, { enableRuntimeDelegation: false });

  try {
    assert.equal(manager.saveGame('slot-a', engine.state, 1000), true);
    const key = 'deckrogue_save_slot-a';
    const raw = storage.getItem(key);
    assert.ok(raw, 'save should be written');
    const tampered = JSON.parse(raw);
    tampered.playTime = 2000;
    storage.setItem(key, JSON.stringify(tampered));

    assert.equal(manager.loadGame('slot-a'), null);
  } finally {
    engine.dispose();
  }
});

test('importSave rejects malformed payloads before writing a save slot', () => {
  const storage = attachStorage();
  const manager = new SaveManager();
  const malformed = btoa(JSON.stringify({ version: '1.0.0', metadata: {} }));

  assert.equal(manager.importSave('bad-slot', malformed), false);
  assert.equal(storage.getItem('deckrogue_save_bad-slot'), null);
  assert.deepEqual(manager.getSaveSlots(), []);
});

test('importSave writes migrated validated data and checksum for imported slots', () => {
  attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(456, null, { enableRuntimeDelegation: false });

  try {
    assert.equal(manager.saveGame('source', engine.state, 500), true);
    const exported = manager.exportSave('source');
    assert.ok(exported, 'export should return payload');

    assert.equal(manager.importSave('imported', exported), true);
    const loaded = manager.loadGame('imported');
    assert.ok(loaded, 'imported save should load');
    assert.equal(loaded.metadata.seed, 456);
    assert.ok(manager.getSaveSlots().find((slot) => slot.id === 'imported')?.checksum);
  } finally {
    engine.dispose();
  }
});
