import test from 'node:test';
import assert from 'node:assert/strict';

import { projectRuleSnapshotToLegacyState } from '@/runtimeV2/legacyStateProjector';
import type { RuleSnapshot } from '@/runtimeV2';

function makeSnapshot(screen: RuleSnapshot['lifecycle']['screen'], phase: RuleSnapshot['lifecycle']['phase']): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'test-runtime',
    seed: 1,
    lifecycle: {
      screen,
      phase,
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'informant',
      hp: 10,
      maxHp: 10,
      gold: 0,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
      relicIds: [],
      potionIds: [],
    },
    map: {
      currentNodeId: 'node_1',
      nodes: [],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: 'test-run',
      replayLength: 0,
      generatedAt: new Date(0).toISOString(),
      adapter: 'python-wasm',
    },
  };
}

test('projectRuleSnapshotToLegacyState accepts Enchant screen projections', () => {
  const projection = projectRuleSnapshotToLegacyState(makeSnapshot('Enchant', 'enchant'));
  assert.equal(projection.screen, 'Enchant');
  assert.equal(projection.pendingNodeResolution, true);
});

test('projectRuleSnapshotToLegacyState accepts RelicUpgrade screen projections', () => {
  const projection = projectRuleSnapshotToLegacyState(makeSnapshot('RelicUpgrade', 'relic_upgrade'));
  assert.equal(projection.screen, 'RelicUpgrade');
  assert.equal(projection.pendingNodeResolution, true);
});

test('projectRuleSnapshotToLegacyState ignores stale roomSession when snapshot is already back on map', () => {
  const snapshot = makeSnapshot('Map', 'map');
  snapshot.lifecycle.pendingNodeResolution = false;
  snapshot.roomSession = {
    token: 'stale-room',
    nodeId: 'node_1',
    ownerKind: 'combat',
    resolverKind: 'reward',
    surfaceStack: ['combat'],
    status: 'active',
  };

  const projection = projectRuleSnapshotToLegacyState(snapshot);

  assert.equal(projection.screen, 'Map');
  assert.equal(projection.pendingNodeResolution, false);
  assert.equal(projection.roomSession, null);
});
