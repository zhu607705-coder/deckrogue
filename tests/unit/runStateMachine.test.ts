import test from 'node:test';
import assert from 'node:assert/strict';

import { transitionRunState, RunTransitionState } from '@/core/events/runStateMachine';

test('run state machine should allow idle -> in_run/character_select transition', () => {
  const started = transitionRunState(
    { lifecycle: 'idle', phase: 'character_select', pendingNodeResolution: false },
    { type: 'RUN_STARTED' }
  );
  assert.equal(started.lifecycle, 'in_run');
  assert.equal(started.phase, 'map');
});

test('run state machine should allow map -> combat transition', () => {
  const entered = transitionRunState(
    { lifecycle: 'in_run', phase: 'map', pendingNodeResolution: false },
    { type: 'NODE_ENTERED', phase: 'combat' }
  );
  assert.equal(entered.phase, 'combat');
  assert.equal(entered.pendingNodeResolution, true);
});

test('run state machine should allow combat -> reward transition', () => {
  const inCombat: RunTransitionState = { lifecycle: 'in_run', phase: 'combat', pendingNodeResolution: true };
  const won = transitionRunState(
    { lifecycle: 'in_run', phase: 'combat', pendingNodeResolution: true },
    { type: 'COMBAT_WON' }
  );
  assert.equal(won.phase, 'reward');
});

test('run state machine should allow combat -> game_over transition', () => {
  const defeated = transitionRunState(
    { lifecycle: 'in_run', phase: 'combat', pendingNodeResolution: true },
    { type: 'PLAYER_DIED' }
  );
  assert.equal(defeated.lifecycle, 'ended');
  assert.equal(defeated.phase, 'game_over');
});

test('run state machine should reject illegal reward -> combat transition', () => {
  assert.throws(
    () => transitionRunState(
      { lifecycle: 'in_run', phase: 'reward', pendingNodeResolution: true },
      { type: 'NODE_ENTERED', phase: 'combat' }
    ),
    /cannot enter node/
  );
});

test('run state machine should allow the happy path map -> combat -> reward -> map', () => {
  const started = transitionRunState(
    { lifecycle: 'idle', phase: 'character_select', pendingNodeResolution: false },
    { type: 'RUN_STARTED' }
  );
  assert.deepEqual(started, {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  });

  const entered = transitionRunState(started, { type: 'NODE_ENTERED', phase: 'combat' });
  assert.deepEqual(entered, {
    lifecycle: 'in_run',
    phase: 'combat',
    pendingNodeResolution: true
  });

  const won = transitionRunState(entered, { type: 'COMBAT_WON' });
  assert.deepEqual(won, {
    lifecycle: 'in_run',
    phase: 'reward',
    pendingNodeResolution: true
  });

  const backToMap = transitionRunState(won, { type: 'REWARD_TAKEN' });
  assert.deepEqual(backToMap, {
    lifecycle: 'in_run',
    phase: 'map',
    pendingNodeResolution: false
  });
});

test('run state machine should reject entering a node from non-map phase', () => {
  assert.throws(
    () => transitionRunState(
      { lifecycle: 'in_run', phase: 'combat', pendingNodeResolution: true },
      { type: 'NODE_ENTERED', phase: 'event' }
    ),
    /cannot enter node/
  );
});

test('run state machine should end the run on player death', () => {
  const ended = transitionRunState(
    { lifecycle: 'in_run', phase: 'combat', pendingNodeResolution: true },
    { type: 'PLAYER_DIED' }
  );
  assert.deepEqual(ended, {
    lifecycle: 'ended',
    phase: 'game_over',
    pendingNodeResolution: false
  });
});

