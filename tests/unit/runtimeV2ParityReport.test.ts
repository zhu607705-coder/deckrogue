/**
 * @file runtimeV2ParityReport.test.ts
 * @description Unit tests for runtime v2 parity report comparison and summary.
 *
 * 主要职责:
 * - 测试地图快照的比较逻辑
 * - 测试完美一致性报告的判定
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { RuleSnapshot } from '@/runtimeV2/contracts';
import {
  compareMapSnapshots,
  isPerfectParityReport,
  summarizeParityReportEntries,
  type ParityReportEntry,
} from '@/runtimeV2/parityReport';

function createSnapshot(nodes: RuleSnapshot['map']['nodes']): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'rules-core-draft',
    seed: 42,
    lifecycle: {
      screen: 'Map',
      phase: 'map',
      pendingNodeResolution: false,
    },
    player: {
      characterId: 'informant',
      hp: 85,
      maxHp: 85,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
      relicIds: [],
      potionIds: [],
    },
    map: {
      currentNodeId: null,
      nodes,
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: 'report-test',
      replayLength: 0,
      generatedAt: new Date(0).toISOString(),
      adapter: 'python-wasm',
    },
  };
}

test('compareMapSnapshots splits metadata mismatches from topology mismatches', () => {
  const legacy = createSnapshot([
    { id: 'n1', type: 'Combat', x: 0.25, y: 0, revealed: true, next: ['n2'] },
    { id: 'n2', type: 'Event', x: 0.5, y: 1, revealed: false, next: [] },
  ]);
  const candidate = createSnapshot([
    { id: 'n1', type: 'Combat', x: 0.25, y: 0, revealed: true, next: ['n3'] },
    { id: 'n2', type: 'Shop', x: 0.5, y: 1, revealed: false, next: [] },
  ]);

  const comparison = compareMapSnapshots(legacy, candidate);

  assert.equal(comparison.metadataMatches, false);
  assert.equal(comparison.topologyMatches, false);
  assert.deepEqual(comparison.metadataMismatchNodeIds, ['n2']);
  assert.deepEqual(comparison.topologyMismatchNodeIds, ['n1']);
});

test('summarizeParityReportEntries groups pass and fail counts by scenario', () => {
  const entries: ParityReportEntry[] = [
    { scenario: 'map_full_bridge', seed: 1, passed: true, stableDiffCount: 0 },
    { scenario: 'map_full_bridge', seed: 2, passed: false, stableDiffCount: 1, topologyMismatchNodeIds: ['n2'] },
    { scenario: 'map_native_topology', seed: 1, passed: false, stableDiffCount: 0, topologyMismatchNodeIds: ['n1', 'n2'] },
    { scenario: 'map_native_topology', seed: 2, passed: false, stableDiffCount: 0, topologyMismatchNodeIds: ['n2'] },
    { scenario: 'map_native_metadata', seed: 1, passed: true, stableDiffCount: 0, topologyMismatchNodeIds: ['ignored-node'] },
  ];

  const summary = summarizeParityReportEntries(entries);

  assert.deepEqual(summary, [
    {
      scenario: 'map_full_bridge',
      total: 2,
      passed: 1,
      failed: 1,
      failureSeeds: [2],
      topologyHotspots: [{ nodeId: 'n2', count: 1 }],
    },
    {
      scenario: 'map_native_metadata',
      total: 1,
      passed: 1,
      failed: 0,
      failureSeeds: [],
      topologyHotspots: [],
    },
    {
      scenario: 'map_native_topology',
      total: 2,
      passed: 0,
      failed: 2,
      failureSeeds: [1, 2],
      topologyHotspots: [
        { nodeId: 'n2', count: 2 },
        { nodeId: 'n1', count: 1 },
      ],
    },
  ]);
});

test('isPerfectParityReport only returns true when every scenario is fully green', () => {
  assert.equal(
    isPerfectParityReport([
      {
        scenario: 'map_native_topology',
        total: 10,
        passed: 10,
        failed: 0,
        failureSeeds: [],
        topologyHotspots: [],
      },
      {
        scenario: 'combat_reward_stable',
        total: 10,
        passed: 10,
        failed: 0,
        failureSeeds: [],
        topologyHotspots: [],
      },
    ]),
    true,
  );

  assert.equal(
    isPerfectParityReport([
      {
        scenario: 'map_native_topology',
        total: 10,
        passed: 9,
        failed: 1,
        failureSeeds: [7],
        topologyHotspots: [{ nodeId: 'floor_4_node_2', count: 1 }],
      },
    ]),
    false,
  );
});
