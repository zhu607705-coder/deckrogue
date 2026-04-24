/**
 * @file systemAssertions.test.ts
 * @description Unit tests for system assertions and storage mock installation.
 *
 * 主要职责:
 * - 测试系统断言的有效性
 * - 测试存储模拟的安装与清理
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState, RunCardInstance } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { combatSystem } from '@/core/combat/combatSystem';
import { GameEngine } from '@/core/events/gameEngine';
import { SaveManager } from '@/core/persistence/saveManager';

interface StorageMock extends Storage {
  clear(): void;
}

function installStorageMock(): StorageMock {
  const store = new Map<string, string>();
  const storage: StorageMock = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage
  });

  return storage;
}

function makeCard(id: string, instanceId: string): RunCardInstance {
  return {
    id,
    instanceId,
    baseCardId: id,
    name: id,
    rarity: 'Common',
    cost: 1,
    type: 'Skill',
    targeting: 'None',
    tags: [],
    text: id,
    actions: [],
    runtimeBase: {
      id,
      name: id,
      rarity: 'Common',
      cost: 1,
      type: 'Skill',
      targeting: 'None',
      tags: [],
      text: id,
      actions: []
    },
    persistentEnchantments: [],
    combatAfflictions: []
  };
}

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 0,
    runId: 'run_system_assertions',
    runStartedAt: Date.now(),
    character: null,
    player: {
      hp: 20,
      maxHp: 20,
      energy: 3,
      maxEnergy: 3,
      gold: 0,
      intel: 0,
      deck: [],
      relics: [],
      potions: [],
      corruption: 0,
      devotion: 0,
      relicStates: {},
      runEffects: {}
    },
    combat: {
      player: {
        hp: 20,
        maxHp: 20,
        block: 0,
        energy: 3,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0,
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
        intel: 0,
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      },
      enemies: [
        {
          id: 'enemy_1',
          defId: 'test_enemy',
          name: 'Test Enemy',
          hp: 10,
          maxHp: 10,
          block: 0,
          statuses: {} as Record<string, number>,
          nextIntent: 'Attack',
          lastUsedIntent: '',
          intentCooldowns: {} as Record<string, number>,
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced'
        }
      ],
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: 0,
      warpAlpha: 0.5,
      warpPerilK: 0.05
    },
    map: [
      {
        id: 'floor_1_node_0',
        type: 'Combat',
        revealed: true,
        next: [],
        x: 0,
        y: 0
      }
    ],
    currentNodeId: 'floor_1_node_0',
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Combat',
    pendingNodeResolution: true,
    campfireChoiceLocked: false,
    combatVoxLog: [],
    lastCombatVoxLog: [],
    lastDeathVoxLog: []
  };
}

test('system assertion: draw should reshuffle discard pile when draw pile is empty', () => {
  const state = makeState();
  state.combat!.discardPile = [
    makeCard('discard_a', 'discard_a_1'),
    makeCard('discard_b', 'discard_b_1')
  ];

  const queue = new ActionQueue();
  const action = ActionFactoryV2.createAction({ type: 'Draw', amount: 2 });
  action.execute(state, queue);

  assert.equal(state.combat!.hand.length, 2);
  assert.equal(state.combat!.discardPile.length, 0);
  assert.equal(state.combat!.drawPile.length, 0);
  assert.deepEqual(
    state.combat!.hand.map((card) => card.baseCardId).sort(),
    ['discard_a', 'discard_b']
  );
});

test('system assertion: draw should stop cleanly when both draw and discard are empty', () => {
  const state = makeState();
  const queue = new ActionQueue();
  const action = ActionFactoryV2.createAction({ type: 'Draw', amount: 5 });

  action.execute(state, queue);

  assert.equal(state.combat!.hand.length, 0);
  assert.equal(state.combat!.drawPile.length, 0);
  assert.equal(state.combat!.discardPile.length, 0);
});

test('system assertion: modify energy should never push energy below zero', () => {
  const state = makeState();
  const queue = new ActionQueue();
  state.combat!.player.energy = 1;
  const action = ActionFactoryV2.createAction({ type: 'ModifyEnergy', amount: -5 });

  action.execute(state, queue);

  assert.equal(state.combat!.player.energy, 0);
});

test('system assertion: lethal player poison at turn start should end the run and clear combat restart checkpoint', () => {
  const engine = new GameEngine(101, null, { enableRuntimeDelegation: false });
  const checkpointState = makeState();
  checkpointState.combat!.player.hp = 1;
  checkpointState.combat!.player.statuses.Poison = 1;
  checkpointState.player.hp = 1;
  checkpointState.combatRestartCheckpoint = {
    nodeId: 'floor_1_node_0',
    nodeType: 'Combat',
    stateSnapshot: { screen: 'Combat' },
    rngState: 0,
    pendingNodeResolution: true
  };
  (engine as any).state = checkpointState;

  (engine as any).startTurn();

  assert.equal(engine.state.screen, 'GameOver');
  assert.equal(engine.state.combatRestartCheckpoint, undefined);
  engine.dispose();
});

test('system assertion: lethal enemy poison should resolve combat victory and clear combat restart checkpoint', async () => {
  const engine = new GameEngine(102, null, { enableRuntimeDelegation: false });
  const victoryState = makeState();
  victoryState.combat!.enemies = [
    {
      id: 'enemy_poisoned',
      defId: 'barrier',
      name: 'Poisoned Enemy',
      hp: 1,
      maxHp: 10,
      block: 0,
      statuses: { Poison: 1 } as Record<string, number>,
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {} as Record<string, number>,
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced'
    }
  ];
  victoryState.combatRestartCheckpoint = {
    nodeId: 'floor_1_node_0',
    nodeType: 'Combat',
    stateSnapshot: { screen: 'Combat' },
    rngState: 0,
    pendingNodeResolution: true
  };
  (engine as any).state = victoryState;

  await (engine as any).executeEnemyTurn();

  assert.equal(engine.state.screen, 'Reward');
  assert.equal(engine.state.combat, null);
  assert.equal(engine.state.combatRestartCheckpoint, undefined);
  engine.dispose();
});

test('system assertion: statuses should never go negative when reduced below zero', () => {
  const state = makeState();

  combatSystem.applyStatus(state, 'enemy', 'enemy_1', 'Poison', 3);
  combatSystem.applyStatus(state, 'enemy', 'enemy_1', 'Poison', -10);

  assert.equal(state.combat!.enemies[0].statuses.Poison, 0);
});

test('system assertion: save/load roundtrip should preserve screen, hp, and node id', () => {
  const storage = installStorageMock();
  storage.clear();
  const saveManager = new SaveManager();
  saveManager.startRun();

  const state = makeState();
  state.screen = 'Event';
  state.player.hp = 17;
  state.currentNodeId = 'floor_1_node_0';

  const saved = saveManager.saveGame('system_assertions_slot', state, 321);
  assert.equal(saved, true);

  const loaded = saveManager.loadGame('system_assertions_slot');
  assert.ok(loaded, 'expected loadGame to return save data');

  const restoredEngine = new GameEngine(103, null, { enableRuntimeDelegation: false });
  try {
    restoredEngine.loadSaveData(loaded!);
    assert.equal(restoredEngine.state.screen, 'Event');
    assert.equal(restoredEngine.state.player.hp, 17);
    assert.equal(restoredEngine.state.currentNodeId, 'floor_1_node_0');
    assert.equal(saveManager.getSaveSlots().length, 1);
  } finally {
    restoredEngine.dispose();
  }
});
