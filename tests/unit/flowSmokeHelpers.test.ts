import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBossTerminalFixture,
  createEventFixture,
  createGameOverFixture,
  createRemoveCardFixture,
  createRestFixture,
  createRewardFixture,
  createShopFixture,
  createVictoryFixture,
} from '../../scripts/validation/flow_smoke_helpers';

type FixtureState = {
  screen: string;
  pendingNodeResolution?: boolean;
  roomResolutionToken?: string | null;
  roomResolutionKind?: string | null;
  routeState?: {
    primaryTag: string | null;
    confidence: number;
  } | null;
  surfaceContext?: {
    upgradeReturnScreen?: string;
    relicUpgradeReturnScreen?: string;
    enchantReturnScreen?: string;
  } | null;
  roomSession?: {
    token: string;
    ownerKind: string;
    resolverKind: string;
    surfaceStack: string[];
  } | null;
};

function getFixtureState(fixture: { saveData: Record<string, unknown> }): FixtureState {
  return (fixture.saveData as { state: FixtureState }).state;
}

test('first-room flow smoke fixtures serialize authoritative RoomSession state', () => {
  const fixtures = [
    createRewardFixture(),
    createShopFixture(),
    createEventFixture(),
    createRestFixture(),
    createRemoveCardFixture(),
  ];

  for (const fixture of fixtures) {
    const state = getFixtureState(fixture);
    assert.equal(state.pendingNodeResolution, true, `${fixture.slotId} should stay inside a room`);
    assert.ok(state.roomSession, `${fixture.slotId} should serialize roomSession`);
    assert.equal(state.roomResolutionToken, state.roomSession?.token, `${fixture.slotId} should mirror roomSession token`);
    assert.equal(state.roomResolutionKind, state.roomSession?.resolverKind, `${fixture.slotId} should mirror roomSession kind`);
    assert.ok(state.roomSession?.surfaceStack.length, `${fixture.slotId} should retain room surface stack`);
    assert.ok(state.routeState !== undefined, `${fixture.slotId} should serialize routeState`);
    assert.ok(state.surfaceContext !== undefined, `${fixture.slotId} should serialize surfaceContext`);
  }
});

test('terminal flow smoke fixtures clear stale room state before serialization', () => {
  const fixtures = [
    createVictoryFixture(),
    createBossTerminalFixture(),
    createGameOverFixture(),
  ];

  for (const fixture of fixtures) {
    const state = getFixtureState(fixture);
    assert.equal(state.pendingNodeResolution, false, `${fixture.slotId} should not serialize pending resolution`);
    assert.equal(state.roomSession ?? null, null, `${fixture.slotId} should not serialize a stale roomSession`);
    assert.equal(state.roomResolutionToken ?? null, null, `${fixture.slotId} should not serialize a room token`);
    assert.equal(state.roomResolutionKind ?? null, null, `${fixture.slotId} should not serialize a room kind`);
  }
});
