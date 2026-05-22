/**
 * @file saveManagerSecurity.test.ts
 * @description Unit tests for save validation and checksum handling.
 *
 * These checks cover local, non-adversarial save integrity. Browser-local saves
 * are not an anti-cheat boundary because a user can rewrite storage metadata.
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

test('loadGame rejects saves when slot checksum metadata is missing', () => {
  const storage = attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(124, null, { enableRuntimeDelegation: false });

  try {
    assert.equal(manager.saveGame('slot-no-checksum', engine.state, 1000), true);
    const slots = JSON.parse(storage.getItem('deckrogue_save_slots') || '[]');
    delete slots[0].checksum;
    storage.setItem('deckrogue_save_slots', JSON.stringify(slots));

    assert.equal(manager.loadGame('slot-no-checksum'), null);
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

test('importSave rejects same-major versions without an explicit migration', () => {
  attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(789, null, { enableRuntimeDelegation: false });

  try {
    assert.equal(manager.saveGame('source', engine.state, 500), true);
    const exported = manager.exportSave('source');
    assert.ok(exported, 'export should return payload');
    const payload = JSON.parse(atob(exported));
    payload.version = '1.0.1';

    assert.equal(manager.importSave('unknown-version', btoa(JSON.stringify(payload))), false);
    assert.equal(manager.loadGame('unknown-version'), null);
  } finally {
    engine.dispose();
  }
});

test('clearActiveSaves removes save slots and payloads without deleting profile or settings data', () => {
  const storage = attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(790, null, { enableRuntimeDelegation: false });
  storage.setItem('deckrogue_settings', JSON.stringify({ volume: 0.5 }));
  storage.setItem('deckrogue_unlocks', JSON.stringify({ characters: ['warrior', 'informant'] }));
  storage.setItem('deckrogue_stats', JSON.stringify({ totalRuns: 3 }));
  storage.setItem('deckrogue_recent_runs', JSON.stringify([{ seed: 1 }]));
  storage.setItem('deckrogue_difficulty_profile', JSON.stringify({ currentDifficulty: 2 }));
  storage.setItem('deckrogue_meta_profile_v1', JSON.stringify({ currencies: { requisition: 4 } }));
  storage.setItem('deckrogue_animation_speed', 'fast');

  try {
    assert.equal(manager.saveGame('active-slot', engine.state, 100), true);
    assert.equal((manager as any).clearActiveSaves(), true);

    assert.deepEqual(manager.getSaveSlots(), []);
    assert.equal(storage.getItem('deckrogue_save_active-slot'), null);
    assert.equal(storage.getItem('deckrogue_settings'), JSON.stringify({ volume: 0.5 }));
    assert.equal(storage.getItem('deckrogue_unlocks'), JSON.stringify({ characters: ['warrior', 'informant'] }));
    assert.equal(storage.getItem('deckrogue_stats'), JSON.stringify({ totalRuns: 3 }));
    assert.equal(storage.getItem('deckrogue_recent_runs'), JSON.stringify([{ seed: 1 }]));
    assert.equal(storage.getItem('deckrogue_difficulty_profile'), JSON.stringify({ currentDifficulty: 2 }));
    assert.equal(storage.getItem('deckrogue_meta_profile_v1'), JSON.stringify({ currencies: { requisition: 4 } }));
    assert.equal(storage.getItem('deckrogue_animation_speed'), 'fast');
  } finally {
    engine.dispose();
  }
});

test('clearAllUserData removes saves and progression while preserving local presentation preferences', () => {
  const storage = attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(791, null, { enableRuntimeDelegation: false });
  storage.setItem('deckrogue_settings', JSON.stringify({ keybinds: { endTurn: 'KeyQ' } }));
  storage.setItem('deckrogue_unlocks', JSON.stringify({ characters: ['informant'] }));
  storage.setItem('deckrogue_stats', JSON.stringify({ totalRuns: 7 }));
  storage.setItem('deckrogue_recent_runs', JSON.stringify([{ seed: 2 }]));
  storage.setItem('deckrogue_difficulty_profile', JSON.stringify({ currentDifficulty: 3 }));
  storage.setItem('deckrogue_meta_profile_v1', JSON.stringify({ runHistory: [{ runId: 'r1' }] }));
  storage.setItem('deckrogue_codex_profile_v1', JSON.stringify({ unlocked: ['term'] }));
  storage.setItem('deckrogue_animation_speed', 'slow');
  storage.setItem('deckrogue_grimdark_terms', 'false');

  try {
    assert.equal(manager.saveGame('user-slot', engine.state, 100), true);
    assert.equal((manager as any).clearAllUserData(), true);

    assert.deepEqual(manager.getSaveSlots(), []);
    assert.equal(storage.getItem('deckrogue_save_user-slot'), null);
    assert.equal(storage.getItem('deckrogue_settings'), null);
    assert.equal(storage.getItem('deckrogue_unlocks'), null);
    assert.equal(storage.getItem('deckrogue_stats'), null);
    assert.equal(storage.getItem('deckrogue_recent_runs'), null);
    assert.equal(storage.getItem('deckrogue_difficulty_profile'), null);
    assert.equal(storage.getItem('deckrogue_meta_profile_v1'), null);
    assert.equal(storage.getItem('deckrogue_codex_profile_v1'), null);
    assert.equal(storage.getItem('deckrogue_animation_speed'), 'slow');
    assert.equal(storage.getItem('deckrogue_grimdark_terms'), 'false');
  } finally {
    engine.dispose();
  }
});

test('factoryReset removes every deckrogue key while preserving unrelated localStorage entries', () => {
  const storage = attachStorage();
  const manager = new SaveManager();
  storage.setItem('deckrogue_settings', '{}');
  storage.setItem('deckrogue_unlocks', '{}');
  storage.setItem('deckrogue_animation_speed', 'normal');
  storage.setItem('deckrogue_meta_profile_v1', '{}');
  storage.setItem('other_app_settings', 'keep');

  assert.equal((manager as any).factoryReset(), true);

  assert.equal(storage.getItem('deckrogue_settings'), null);
  assert.equal(storage.getItem('deckrogue_unlocks'), null);
  assert.equal(storage.getItem('deckrogue_animation_speed'), null);
  assert.equal(storage.getItem('deckrogue_meta_profile_v1'), null);
  assert.equal(storage.getItem('other_app_settings'), 'keep');
});

test('save/load preserves nameless martyr free-removal event state', () => {
  attachStorage();
  const manager = new SaveManager();
  const engine = new GameEngine(792, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(793, null, { enableRuntimeDelegation: false });

  try {
    engine.selectCharacter('informant');
    engine.state.map = [{ id: 'event-node', type: 'Event', revealed: true, next: [], x: 0, y: 0 }];
    engine.state.currentNodeId = 'event-node';
    engine.state.pendingNodeResolution = true;
    engine.state.roomResolutionToken = 'event_room_token';
    engine.state.roomResolutionKind = 'event';
    engine.state.screen = 'Event';
    engine.state.player.gold = 100;
    engine.state.activeEvent = { id: 'nameless_martyr_shrine', data: {} } as any;

    engine.resolveEventChoice('martyr_offer_wealth');
    assert.equal(engine.state.screen, 'RemoveCard');
    assert.equal(engine.state.activeEvent?.stage, 'free_remove');
    assert.equal(Number(engine.state.activeEvent?.data?.freeRemovalsRemaining || 0) > 0, true);

    assert.equal(manager.saveGame('martyr-free-remove', engine.state, 1000), true);
    const loaded = manager.loadGame('martyr-free-remove');
    assert.ok(loaded, 'free-removal save should load');
    restored.loadSaveData(loaded!);

    assert.equal(restored.state.screen, 'RemoveCard');
    assert.equal(restored.state.activeEvent?.id, 'nameless_martyr_shrine');
    assert.equal(restored.state.activeEvent?.stage, 'free_remove');
    assert.equal(Number(restored.state.activeEvent?.data?.freeRemovalsRemaining || 0) > 0, true);
    assert.equal(restored.isEventFreeCardRemovalMode(), true);
  } finally {
    engine.dispose();
    restored.dispose();
  }
});
