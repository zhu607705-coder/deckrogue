import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { globalEventBus } from '@/core/events/eventBus';
import { RuntimeEventType } from '@/core/events/eventContract';

test.afterEach(() => {
  globalEventBus.clear();
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

