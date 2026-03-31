import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RuntimeActionQueue,
  type RuntimeAction,
  type RuntimeActionResult,
} from '@/core/runtimeKernel/runtimeActionQueue';
import {
  CombatRoomBridge,
  EventRoomBridge,
  RestRoomBridge,
  RewardRoomBridge,
  ShopRoomBridge,
  createRoomBridgeRegistry,
  type RoomBridgeContext,
} from '@/core/runtimeKernel/roomBridge';
import { GameFlowOrchestrator } from '@/core/runtimeKernel/gameFlowOrchestrator';

test('RuntimeActionQueue executes actions in order and stops on stop result', () => {
  const order: string[] = [];
  const queue = new RuntimeActionQueue<{ order: string[] }>();

  const first: RuntimeAction<{ order: string[] }> = {
    name: 'first',
    execute(ctx): RuntimeActionResult {
      ctx.order.push('first');
      return { type: 'continue' };
    },
  };
  const second: RuntimeAction<{ order: string[] }> = {
    name: 'second',
    execute(ctx): RuntimeActionResult {
      ctx.order.push('second');
      return { type: 'stop', handled: true };
    },
  };
  const third: RuntimeAction<{ order: string[] }> = {
    name: 'third',
    execute(ctx): RuntimeActionResult {
      ctx.order.push('third');
      return { type: 'continue' };
    },
  };

  queue.addActions([first, second, third]);
  const result = queue.execute({ order });

  assert.deepEqual(order, ['first', 'second']);
  assert.equal(result.type, 'stop');
  assert.equal(result.handled, true);
});

test('room bridge registry resolves room-specific bridges by screen', () => {
  const registry = createRoomBridgeRegistry([
    new EventRoomBridge(),
    new RestRoomBridge(),
    new ShopRoomBridge(),
    new RewardRoomBridge(),
    new CombatRoomBridge(),
  ]);

  assert.equal(registry.getBridge('Event')?.kind, 'event');
  assert.equal(registry.getBridge('Rest')?.kind, 'rest');
  assert.equal(registry.getBridge('Shop')?.kind, 'shop');
  assert.equal(registry.getBridge('Reward')?.kind, 'reward');
  assert.equal(registry.getBridge('Combat')?.kind, 'combat');
  assert.equal(registry.getBridge('Map'), null);
});

test('ShopRoomBridge syncs runtime from legacy state after successful legacy shop action', () => {
  const calls: string[] = [];
  const bridge = new ShopRoomBridge();
  const context: RoomBridgeContext = {
    screen: 'Shop',
    canDelegate() {
      return true;
    },
    syncFromLegacyState(reason) {
      calls.push(reason);
    },
    recordFallback() {
      calls.push('fallback');
    },
  };

  bridge.syncAfterLegacyAction(context, 'buy_shop_card');

  assert.deepEqual(calls, ['shop.buy_shop_card']);
});

test('RewardRoomBridge delegates reward selection through the runtime bridge', () => {
  const calls: string[] = [];
  const bridge = new RewardRoomBridge();
  const context: RoomBridgeContext = {
    screen: 'Reward',
    canDelegate() {
      return true;
    },
    loadDelegatedSnapshot() {
      calls.push('load');
    },
    delegateTakeReward(cardId) {
      calls.push(`take:${cardId}`);
      return {} as any;
    },
    applyRewardResolutionSnapshot() {
      calls.push('apply');
    },
    syncFromLegacyState() {},
    recordFallback() {
      calls.push('fallback');
    },
  };

  const handled = bridge.performAction?.(context, { type: 'take_reward', cardId: 'gather_intel' });

  assert.equal(handled, true);
  assert.deepEqual(calls, ['load', 'take:gather_intel', 'apply']);
});

test('GameFlowOrchestrator prefers delegated character selection before legacy fallback', () => {
  const calls: string[] = [];
  const orchestrator = new GameFlowOrchestrator({
    selectCharacter(characterId) {
      calls.push(`delegated:${characterId}`);
      return true;
    },
    selectCharacterLegacy() {
      calls.push('legacy');
      return true;
    },
    syncRuntimeFromLegacyState(reason) {
      calls.push(`sync:${reason}`);
    },
    moveToNode() {
      return false;
    },
    moveToNodeLegacy() {
      return false;
    },
    resolveNodeEntry() {},
    getNode() {
      return null;
    },
    canMoveToNode() {
      return false;
    },
    recordFallback(reason) {
      calls.push(`fallback:${String(reason)}`);
    },
  });

  const handled = orchestrator.selectCharacter('informant');

  assert.equal(handled, true);
  assert.deepEqual(calls, ['delegated:informant', 'sync:select_character']);
});
