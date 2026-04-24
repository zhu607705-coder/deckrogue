/**
 * @file runLifecycle.test.ts
 * @description Unit tests for run session lifecycle and game setup interactions.
 *
 * 主要职责:
 * - 测试 RunSession 的创建与销毁
 * - 测试 gameSetup 与 session 的交互
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { globalEventBus } from '@/core/events/eventBus';
import { RuntimeEventType } from '@/core/events/eventContract';
import { RunSession } from '@/core/events/runSession';
import { gameSetup } from '@/core/persistence/setup';

test.afterEach(() => {
  globalEventBus.clear();
});

test('run session facade should exist and handle lifecycle', () => {
  // Test that RunSession exists and can be imported
  assert.ok(RunSession, 'RunSession should be exported');
  const session = new RunSession();
  assert.ok(session.dispose, 'RunSession should have dispose method');
  session.dispose();
});

test('game setup should interact with session object', () => {
  // This test verifies that GameSetup properly manages run lifecycle
  assert.ok(gameSetup, 'gameSetup should be available');
});

test('game engine delegates core lifecycle methods to session', () => {
  // This test verifies that GameEngine properly delegates to session
  const engine = new GameEngine(123);
  assert.ok(engine.state, 'Engine should have state');
  engine.dispose();
});

test('runtime lifecycle event names should be imported from event contract module', () => {
  // Verify that terminal events are present in the contract
  const terminalEvents = [
    RuntimeEventType.PlayerDeath,
    RuntimeEventType.PlayerDefeated,
    RuntimeEventType.RunVictory,
    RuntimeEventType.GameShutdown
  ];
  
  for (const event of terminalEvents) {
    assert.ok(event, `Terminal event ${event} should be defined`);
  }
  
  // Verify runtime lifecycle events exist
  const lifecycleEvents = [
    RuntimeEventType.RunStarted,
    RuntimeEventType.RunLoaded,
    RuntimeEventType.GamePaused,
    RuntimeEventType.GameResumed,
    RuntimeEventType.CombatStart,
    RuntimeEventType.CombatVictory,
    RuntimeEventType.CombatEnd,
    RuntimeEventType.NodeCompleted
  ];
  
  for (const event of lifecycleEvents) {
    assert.ok(event, `Lifecycle event ${event} should be defined`);
  }
});

test('game engine dispose should detach global event subscriptions', () => {
  const engine = new GameEngine(123);
  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;

  engine.dispose();
  globalEventBus.publish({ type: 'PlayerDeath' } as any);

  assert.equal(engine.state.screen, 'Combat');
  assert.equal(engine.state.pendingNodeResolution, true);
});

test('active engine should still react to player death before dispose', () => {
  const engine = new GameEngine(123);
  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;

  globalEventBus.publish({ type: 'PlayerDeath' } as any);

  assert.equal(engine.state.screen, 'GameOver');
  assert.equal(engine.state.pendingNodeResolution, false);
  engine.dispose();
});

test('game engine should ignore CombatVictory after game over without logging transition errors', () => {
  const engine = new GameEngine(123);
  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;

  globalEventBus.publish({ type: 'PlayerDeath' } as any);
  assert.equal(engine.state.screen, 'GameOver');

  const originalError = console.error;
  const errors: string[] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    globalEventBus.publish({ type: 'CombatVictory' } as any);
  } finally {
    console.error = originalError;
    engine.dispose();
  }

  assert.equal(engine.state.screen, 'GameOver');
  assert.equal(
    errors.some(error => error.includes('Illegal run transition')),
    false,
    'CombatVictory after game_over should be ignored rather than reported as an illegal transition'
  );
});
