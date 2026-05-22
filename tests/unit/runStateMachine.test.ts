/**
 * @file runStateMachine.test.ts
 * @description Unit tests for run state machine phase and transition mappings.
 *
 * 主要职责:
 * - 测试屏幕到运行阶段的映射
 * - 测试运行状态转换的正确性
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  screenToRunPhase,
  runPhaseToScreen,
  deriveRunTransitionState,
  transitionRunState,
  type RunTransitionState
} from '../../src/core/events/runStateMachine';

test('screenToRunPhase should map CharacterSelect to character_select', () => {
  assert.strictEqual(screenToRunPhase('CharacterSelect'), 'character_select');
});

test('screenToRunPhase should map Map to map', () => {
  assert.strictEqual(screenToRunPhase('Map'), 'map');
});

test('screenToRunPhase should map Combat to combat', () => {
  assert.strictEqual(screenToRunPhase('Combat'), 'combat');
});

test('screenToRunPhase should map Reward to reward', () => {
  assert.strictEqual(screenToRunPhase('Reward'), 'reward');
});

test('screenToRunPhase should map Enchant to enchant', () => {
  assert.strictEqual(screenToRunPhase('Enchant'), 'enchant');
});

test('screenToRunPhase should map Event to event', () => {
  assert.strictEqual(screenToRunPhase('Event'), 'event');
});

test('screenToRunPhase should map Shop to shop', () => {
  assert.strictEqual(screenToRunPhase('Shop'), 'shop');
});

test('screenToRunPhase should map Rest to rest', () => {
  assert.strictEqual(screenToRunPhase('Rest'), 'rest');
});

test('screenToRunPhase should map Upgrade to upgrade', () => {
  assert.strictEqual(screenToRunPhase('Upgrade'), 'upgrade');
});

test('screenToRunPhase should map RelicUpgrade to relic_upgrade', () => {
  assert.strictEqual(screenToRunPhase('RelicUpgrade'), 'relic_upgrade');
});

test('screenToRunPhase should map RemoveCard to remove_card', () => {
  assert.strictEqual(screenToRunPhase('RemoveCard'), 'remove_card');
});

test('screenToRunPhase should map GameOver to game_over', () => {
  assert.strictEqual(screenToRunPhase('GameOver'), 'game_over');
});

test('screenToRunPhase should map Victory to victory', () => {
  assert.strictEqual(screenToRunPhase('Victory'), 'victory');
});

test('runPhaseToScreen should be inverse of screenToRunPhase', () => {
  const screens: Array<'CharacterSelect' | 'Map' | 'Combat' | 'Reward' | 'Enchant' | 'Event' | 'Shop' | 'Rest' | 'Upgrade' | 'RelicUpgrade' | 'RemoveCard' | 'GameOver' | 'Victory'> = [
    'CharacterSelect', 'Map', 'Combat', 'Reward', 'Enchant', 'Event', 'Shop', 'Rest', 'Upgrade', 'RelicUpgrade', 'RemoveCard', 'GameOver', 'Victory'
  ];
  for (const screen of screens) {
    assert.strictEqual(runPhaseToScreen(screenToRunPhase(screen)), screen);
  }
});

test('deriveRunTransitionState should derive state from game state', () => {
  const gameState = { screen: 'Map' as const, pendingNodeResolution: false } as any;
  const result = deriveRunTransitionState(gameState);
  assert.strictEqual(result.lifecycle, 'in_run');
  assert.strictEqual(result.phase, 'map');
  assert.strictEqual(result.pendingNodeResolution, false);
});

test('deriveRunTransitionState should respect custom lifecycle', () => {
  const gameState = { screen: 'Map' as const, pendingNodeResolution: false } as any;
  const result = deriveRunTransitionState(gameState, 'paused');
  assert.strictEqual(result.lifecycle, 'paused');
});

test('deriveRunTransitionState should derive pendingNodeResolution from state', () => {
  const gameState = { screen: 'Combat' as const, pendingNodeResolution: true } as any;
  const result = deriveRunTransitionState(gameState);
  assert.strictEqual(result.pendingNodeResolution, true);
});

test('deriveRunTransitionState preserves explicit roomResolutionKind for nested room screens', () => {
  const gameState = { screen: 'Upgrade' as const, pendingNodeResolution: false, roomResolutionKind: 'shop' } as any;
  const result = deriveRunTransitionState(gameState);
  assert.strictEqual(result.pendingNodeResolution, true);
  assert.strictEqual(result.roomResolutionKind, 'shop');
});

test('deriveRunTransitionState preserves explicit roomResolutionKind for Enchant screen', () => {
  const gameState = { screen: 'Enchant' as const, pendingNodeResolution: false, roomResolutionKind: 'event' } as any;
  const result = deriveRunTransitionState(gameState);
  assert.strictEqual(result.phase, 'enchant');
  assert.strictEqual(result.pendingNodeResolution, true);
  assert.strictEqual(result.roomResolutionKind, 'event');
});

test('deriveRunTransitionState preserves explicit roomResolutionKind for RelicUpgrade screen', () => {
  const gameState = { screen: 'RelicUpgrade' as const, pendingNodeResolution: false, roomResolutionKind: 'rest' } as any;
  const result = deriveRunTransitionState(gameState);
  assert.strictEqual(result.phase, 'relic_upgrade');
  assert.strictEqual(result.pendingNodeResolution, true);
  assert.strictEqual(result.roomResolutionKind, 'rest');
});

test('deriveRunTransitionState prefers roomSession over stale mirrored roomResolution fields', () => {
  const gameState = {
    screen: 'Reward' as const,
    pendingNodeResolution: false,
    roomResolutionToken: 'stale_token',
    roomResolutionKind: 'combat',
    roomSession: {
      token: 'session_token',
      nodeId: 'combat_node',
      ownerKind: 'combat',
      resolverKind: 'reward',
      surfaceStack: ['combat', 'reward'],
      status: 'resolving',
    },
  } as any;
  const result = deriveRunTransitionState(gameState);
  assert.strictEqual(result.pendingNodeResolution, true);
  assert.strictEqual(result.roomResolutionToken, 'session_token');
  assert.strictEqual(result.roomResolutionKind, 'reward');
});

test('transitionRunState RUN_STARTED should transition to in_run/map', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'RUN_STARTED' });
  assert.strictEqual(result.lifecycle, 'in_run');
  assert.strictEqual(result.phase, 'map');
  assert.strictEqual(result.pendingNodeResolution, false);
});

test('transitionRunState RUN_LOADED should transition to in_run/map', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'RUN_LOADED' });
  assert.strictEqual(result.lifecycle, 'in_run');
  assert.strictEqual(result.phase, 'map');
  assert.strictEqual(result.pendingNodeResolution, false);
});

test('transitionRunState RUN_PAUSED should transition to paused from in_run', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'RUN_PAUSED' });
  assert.strictEqual(result.lifecycle, 'paused');
});

test('transitionRunState RUN_PAUSED should throw when not in_run', () => {
  const pausedState: RunTransitionState = {
    lifecycle: 'paused',
    phase: 'map',
    pendingNodeResolution: false
  };
  assert.throws(() => transitionRunState(pausedState, { type: 'RUN_PAUSED' }));
});

test('transitionRunState RUN_RESUMED should transition to in_run from paused', () => {
  const pausedState: RunTransitionState = {
    lifecycle: 'paused',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(pausedState, { type: 'RUN_RESUMED' });
  assert.strictEqual(result.lifecycle, 'in_run');
});

test('transitionRunState RUN_RESUMED should throw when not paused', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  assert.throws(() => transitionRunState(defaultState, { type: 'RUN_RESUMED' }));
});

test('transitionRunState NODE_ENTERED should transition to specified phase from map', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'NODE_ENTERED', phase: 'combat' });
  assert.strictEqual(result.phase, 'combat');
  assert.strictEqual(result.pendingNodeResolution, true);
  assert.strictEqual(result.roomResolutionKind, 'combat');
});

test('transitionRunState NODE_ENTERED should allow entering event', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'NODE_ENTERED', phase: 'event' });
  assert.strictEqual(result.phase, 'event');
});

test('transitionRunState NODE_ENTERED should throw when not in_run', () => {
  const pausedState: RunTransitionState = {
    lifecycle: 'paused',
    phase: 'map',
    pendingNodeResolution: false
  };
  assert.throws(() => transitionRunState(pausedState, { type: 'NODE_ENTERED', phase: 'combat' }));
});

test('transitionRunState NODE_ENTERED should throw when not in map phase', () => {
  const combatState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'combat',
    pendingNodeResolution: true
  };
  assert.throws(() => transitionRunState(combatState, { type: 'NODE_ENTERED', phase: 'event' }));
});

test('transitionRunState COMBAT_WON should transition to reward from combat', () => {
  const combatState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'combat',
    pendingNodeResolution: true
  };
  const result = transitionRunState(combatState, { type: 'COMBAT_WON' });
  assert.strictEqual(result.phase, 'reward');
  assert.strictEqual(result.pendingNodeResolution, true);
  assert.strictEqual(result.roomResolutionKind, 'reward');
});

test('transitionRunState COMBAT_WON should throw when not in combat', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  assert.throws(() => transitionRunState(defaultState, { type: 'COMBAT_WON' }));
});

test('transitionRunState PLAYER_DIED should transition to game_over from in_run', () => {
  const combatState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'combat',
    pendingNodeResolution: true
  };
  const result = transitionRunState(combatState, { type: 'PLAYER_DIED' });
  assert.strictEqual(result.lifecycle, 'ended');
  assert.strictEqual(result.phase, 'game_over');
});

test('transitionRunState PLAYER_DIED should throw when already ended', () => {
  const endedState: RunTransitionState = {
    lifecycle: 'ended',
    phase: 'game_over',
    pendingNodeResolution: false
  };
  assert.throws(() => transitionRunState(endedState, { type: 'PLAYER_DIED' }));
});

test('transitionRunState EVENT_RESOLVED should transition to map when pending', () => {
  const eventState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'event',
    pendingNodeResolution: true
  };
  const result = transitionRunState(eventState, { type: 'EVENT_RESOLVED' });
  assert.strictEqual(result.phase, 'map');
  assert.strictEqual(result.pendingNodeResolution, false);
  assert.strictEqual(result.roomResolutionKind, null);
});

test('transitionRunState EVENT_RESOLVED should reject non-event phases even with a token', () => {
  const combatState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'combat',
    pendingNodeResolution: true,
    roomResolutionToken: 'combat_token'
  };
  assert.throws(() => transitionRunState(combatState, { type: 'EVENT_RESOLVED' }));
});

test('transitionRunState EVENT_RESOLVED should throw when no pending resolution', () => {
  const eventState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'event',
    pendingNodeResolution: false
  };
  assert.throws(() => transitionRunState(eventState, { type: 'EVENT_RESOLVED' }));
});

test('transitionRunState SHOP_LEFT should transition to map when pending', () => {
  const shopState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'shop',
    pendingNodeResolution: true
  };
  const result = transitionRunState(shopState, { type: 'SHOP_LEFT' });
  assert.strictEqual(result.phase, 'map');
});

test('transitionRunState SHOP_LEFT should reject combat phase even with a token', () => {
  const combatState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'combat',
    pendingNodeResolution: true,
    roomResolutionToken: 'combat_token'
  };
  assert.throws(() => transitionRunState(combatState, { type: 'SHOP_LEFT' }));
});

test('transitionRunState REST_COMPLETED should transition to map when pending', () => {
  const restState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'rest',
    pendingNodeResolution: true
  };
  const result = transitionRunState(restState, { type: 'REST_COMPLETED' });
  assert.strictEqual(result.phase, 'map');
});

test('transitionRunState REST_COMPLETED should allow rest-owned nested enchant screens', () => {
  const enchantState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'enchant',
    pendingNodeResolution: true,
    roomResolutionToken: 'rest_token',
    roomResolutionKind: 'rest'
  };
  const result = transitionRunState(enchantState, { type: 'REST_COMPLETED' });
  assert.strictEqual(result.phase, 'map');
});

test('transitionRunState REST_COMPLETED should reject shop phase even with a token', () => {
  const shopState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'shop',
    pendingNodeResolution: true,
    roomResolutionToken: 'shop_token'
  };
  assert.throws(() => transitionRunState(shopState, { type: 'REST_COMPLETED' }));
});

test('transitionRunState REWARD_TAKEN should transition to map when pending', () => {
  const rewardState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'reward',
    pendingNodeResolution: true
  };
  const result = transitionRunState(rewardState, { type: 'REWARD_TAKEN' });
  assert.strictEqual(result.phase, 'map');
});

test('transitionRunState REWARD_TAKEN should reject rest phase even with a token', () => {
  const restState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'rest',
    pendingNodeResolution: true,
    roomResolutionToken: 'rest_token'
  };
  assert.throws(() => transitionRunState(restState, { type: 'REWARD_TAKEN' }));
});

test('transitionRunState REWARD_SKIPPED should transition to map when pending', () => {
  const rewardState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'reward',
    pendingNodeResolution: true
  };
  const result = transitionRunState(rewardState, { type: 'REWARD_SKIPPED' });
  assert.strictEqual(result.phase, 'map');
});

test('transitionRunState RUN_ENDED should transition to ended state with specified phase', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'RUN_ENDED', phase: 'victory' });
  assert.strictEqual(result.lifecycle, 'ended');
  assert.strictEqual(result.phase, 'victory');
});

test('transitionRunState RUN_ENDED should transition to game_over', () => {
  const defaultState: RunTransitionState = {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  };
  const result = transitionRunState(defaultState, { type: 'RUN_ENDED', phase: 'game_over' });
  assert.strictEqual(result.lifecycle, 'ended');
  assert.strictEqual(result.phase, 'game_over');
});
