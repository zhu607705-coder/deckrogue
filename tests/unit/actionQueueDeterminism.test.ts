/**
 * @file actionQueueDeterminism.test.ts
 * @description Unit tests for action queue determinism and event emission order.
 *
 * 主要职责:
 * - 测试 ActionQueue 的确定性执行顺序
 * - 测试事件总线的事件发射一致性
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { ActionManager } from '@/core/actions/actionManager';
import { ActionQueue, type IAction } from '@/core/actions/actionQueue';
import { globalEventBus, type GameEvent } from '@/core/events/eventBus';

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 1,
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
      runEffects: {},
    },
    combat: null,
    map: [],
    currentNodeId: null,
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Map',
    pendingNodeResolution: false,
    campfireChoiceLocked: false,
    metaRuntime: {
      unlockedPoolIds: [],
      appliedUpgradeIds: [],
      appliedPactIds: [],
    },
  } as GameState;
}

test.afterEach(() => {
  globalEventBus.clear();
  ActionManager.resetInstance();
});

test('ActionQueue keeps deterministic order for front inserts and equal-priority entries', () => {
  const queue = new ActionQueue();
  const order: string[] = [];
  const state = makeState();

  class MockAction implements IAction {
    constructor(readonly type: string, private readonly label: string) {}
    execute(): void {
      order.push(this.label);
    }
  }

  queue.push(new MockAction('A', 'base-1'), { source: 'player' }, 0);
  queue.push(new MockAction('B', 'base-2'), { source: 'player' }, 0);
  queue.pushFront(new MockAction('C', 'front-1'), { source: 'system' }, 0);
  queue.pushFront(new MockAction('D', 'front-2'), { source: 'system' }, 0);
  queue.pushBack(new MockAction('E', 'base-3'), { source: 'player' }, 0);

  queue.processQueue(state);

  assert.deepEqual(order, ['front-2', 'front-1', 'base-1', 'base-2', 'base-3']);
});

test('ActionQueue executes front-inserted urgent actions before later high-priority back entries', () => {
  const queue = new ActionQueue();
  const order: string[] = [];
  const state = makeState();

  class MockAction implements IAction {
    constructor(readonly type: string, private readonly label: string) {}
    execute(): void {
      order.push(this.label);
    }
  }

  queue.pushFront(new MockAction('Urgent', 'urgent'), { source: 'system' }, 0);
  queue.enqueue(new MockAction('HighPriority', 'high-priority'), { source: 'player' }, 99);

  queue.processQueue(state);

  assert.deepEqual(order, ['urgent', 'high-priority']);
});

test('ActionQueue applies maxQueueSize consistently to front and back insertion APIs', () => {
  const queue = new ActionQueue({
    maxQueueSize: 2,
    processingMode: 'sequential',
    priorityOrder: 'priority',
  });

  class MockAction implements IAction {
    constructor(readonly type: string) {}
    execute(): void {}
  }

  queue.enqueue(new MockAction('BaseOne'), { source: 'player' }, 0);
  queue.pushBack(new MockAction('BaseTwo'), { source: 'player' }, 0);
  queue.pushFront(new MockAction('UrgentThree'), { source: 'system' }, 0);

  const snapshot = queue.getQueueSnapshot();
  assert.equal(snapshot.length, 2);
  assert.deepEqual(snapshot.map((entry) => entry.action.type), ['UrgentThree', 'BaseTwo']);
});

test('ActionManager publishes ActionStart and ActionEnd with real execution context metadata', () => {
  const manager = new ActionManager(makeState());
  const starts: Array<Extract<GameEvent, { type: 'ActionStart' }>> = [];
  const ends: Array<Extract<GameEvent, { type: 'ActionEnd' }>> = [];
  const offStart = globalEventBus.subscribe('ActionStart', (event) => starts.push(event as Extract<GameEvent, { type: 'ActionStart' }>));
  const offEnd = globalEventBus.subscribe('ActionEnd', (event) => ends.push(event as Extract<GameEvent, { type: 'ActionEnd' }>));

  class MockAction implements IAction {
    readonly type = 'MockAction';
    execute(): void {}
  }

  try {
    manager.enqueueAction(new MockAction(), {
      source: 'player',
      sourceId: 'player',
      targetId: 'enemy_1',
      cardId: 'strike',
      cardInstanceId: 'card_1',
    });

    const snapshot = manager.getQueueSnapshot();
    assert.equal(snapshot.length, 1);
    assert.equal(snapshot[0].sequence, 0);
    assert.equal(snapshot[0].cardId, 'strike');

    manager.executeAllSync();

    assert.equal(starts.length, 1);
    assert.equal(ends.length, 1);
    assert.equal(starts[0].actionType, 'MockAction');
    assert.equal(starts[0].source, 'player');
    assert.equal(starts[0].sourceId, 'player');
    assert.equal(starts[0].targetId, 'enemy_1');
    assert.equal(starts[0].cardId, 'strike');
    assert.equal(starts[0].cardInstanceId, 'card_1');
    assert.equal(ends[0].actionId, starts[0].actionId);
    assert.equal(ends[0].sequence, starts[0].sequence);
    assert.equal(ends[0].targetId, 'enemy_1');
  } finally {
    offStart();
    offEnd();
  }
});
