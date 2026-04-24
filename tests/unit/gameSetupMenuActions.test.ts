/**
 * @file gameSetupMenuActions.test.ts
 * @description Unit tests for game setup menu actions and save/load interactions.
 *
 * 主要职责:
 * - 测试游戏设置的创建与重置
 * - 测试存档存储的交互
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { createGameSetup, resetGameSetup } from '@/core/persistence/setup';

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

function mountActiveRun() {
  const setup = createGameSetup({ enableAutoSave: false, enableDebugLogging: false }) as any;
  const engine = new GameEngine(123, null);
  setup.engine = engine;
  setup.state = {
    isInitialized: true,
    isRunning: true,
    isPaused: false,
    currentSeed: 123,
    currentSaveSlot: null,
  };
  return { setup: setup as ReturnType<typeof createGameSetup>, engine };
}

test.afterEach(() => {
  resetGameSetup();
  delete (globalThis as any).localStorage;
});

test('saveAndQuit writes both quicksave and a normal slot before exiting', () => {
  attachStorage();
  const { setup, engine } = mountActiveRun();

  const result = setup.saveAndQuit();

  assert.equal(result.ok, true);
  assert.equal((setup as any).state.isRunning, false);
  assert.equal((setup as any).engine, null);

  const slotIds = setup.getSaveManager().getSaveSlots().map((slot) => slot.id);
  assert.ok(slotIds.includes('quicksave'), 'quicksave should exist');
  assert.ok(
    slotIds.some((slotId) => slotId !== 'quicksave'),
    'a normal save slot should also be created'
  );

  engine.dispose();
});

test('saveAndQuit keeps the run active if the normal slot write fails', () => {
  attachStorage();
  const { setup, engine } = mountActiveRun();
  const saveManager = setup.getSaveManager() as any;
  const originalSaveGame = saveManager.saveGame.bind(saveManager);

  saveManager.saveGame = (slotId: string, ...args: unknown[]) => {
    if (slotId === 'quicksave') {
      return originalSaveGame(slotId, ...args);
    }
    return false;
  };

  try {
    const result = setup.saveAndQuit();
    assert.equal(result.ok, false);
    assert.equal(result.error, '存档槽保存失败');
    assert.equal((setup as any).state.isRunning, true);
    assert.equal((setup as any).engine, engine);
  } finally {
    saveManager.saveGame = originalSaveGame;
    engine.dispose();
  }
});

test('restartCurrentCombat restores the room-entry state before re-entering the same combat', () => {
  attachStorage();
  const { setup, engine } = mountActiveRun();

  const map = [
    { id: 'fight', type: 'Combat', x: 0, y: 1, revealed: true, next: [] },
  ] as any;

  engine.state.map = map;
  engine.state.currentNodeId = 'fight';
  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;
  engine.state.combat = {
    player: {
      hp: 50,
      maxHp: 80,
      block: 7,
      energy: 1,
      statuses: {},
      delayedCards: [],
      constructs: [],
      elements: [],
      potionToxicity: 0,
      potionsUsedThisTurn: 0,
      cardsPlayedThisTurn: 0,
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    },
    enemies: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 2,
    isPlayerTurn: true,
    warpTide: 0,
    warpAlpha: 0.5,
    warpPerilK: 0.05,
  } as any;
  engine.state.combatRestartCheckpoint = {
    nodeId: 'fight',
    nodeType: 'Combat',
    rngState: 321,
    pendingNodeResolution: true,
    stateSnapshot: {
      map: JSON.parse(JSON.stringify(map)),
      currentNodeId: 'fight',
      screen: 'Map',
      pendingNodeResolution: true,
      player: {
        ...JSON.parse(JSON.stringify(engine.state.player)),
        hp: 80,
      },
      combat: null,
      rewardCards: [],
      shopCards: [],
      shopRelics: [],
      shopPotions: [],
      cardRemovalCost: engine.state.cardRemovalCost,
    },
  };

  try {
    const result = setup.restartCurrentCombat();
    assert.equal(result.ok, true);
    assert.equal(engine.state.screen, 'Combat');
    assert.equal(engine.state.currentNodeId, 'fight');
    assert.equal(engine.state.player.hp, 80);
    assert.equal(engine.state.combat?.player.hp, 80);
    assert.ok(engine.state.combatRestartCheckpoint, 'a new room-entry checkpoint should be re-created for the restarted combat');
  } finally {
    engine.dispose();
  }
});
