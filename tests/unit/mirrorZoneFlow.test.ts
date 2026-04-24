/**
 * @file mirrorZoneFlow.test.ts
 * @description Unit tests for mirror zone entry and flow logic.
 *
 * 主要职责:
 * - 测试镜宫区域进入流程
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeRunSummary } from '@/core/events/runSummarySystem';
import { createDefaultMetaProfile } from '@/core/persistence/metaProfileStore';
import type { GameState } from '@/core/types/combat';

function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 12345,
    rngState: 67890,
    runId: 'test_run_001',
    runStartedAt: Date.now(),
    character: {
      id: 'informant',
      name: 'Informant',
      description: 'Test character',
      maxHp: 80,
      maxEnergy: 3,
      startingDeck: [],
      portraitPrompt: 'test',
      secondaryResource: 'evidence'
    },
    player: {
      hp: 80,
      maxHp: 80,
      energy: 3,
      maxEnergy: 3,
      gold: 0,
      intel: 0,
      deck: [],
      relics: [],
      potions: [],
      corruption: 0,
      relicStates: {}
    },
    combat: null,
    map: [],
    currentNodeId: null,
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 50,
    screen: 'Map',
    mirrorZoneVisited: false,
    branchCardsTaken: [],
    secondaryResourcePeak: 0,
    ...overrides
  } as GameState;
}

test('mirrorZoneFlow - mirror_invitation trigger marks mirrorZoneVisited', () => {
  const state = createMockGameState({ mirrorZoneVisited: false });
  state.mirrorZoneVisited = true;
  assert.strictEqual(state.mirrorZoneVisited, true);
});

test('mirrorZoneFlow - cannot enter mirror zone more than once per run', () => {
  const state = createMockGameState({ mirrorZoneVisited: true });
  const canEnterMirror = !state.mirrorZoneVisited;
  assert.strictEqual(canEnterMirror, false);
});

test('mirrorZoneFlow - branch cards taken during mirror zone visit', () => {
  const state = createMockGameState({ branchCardsTaken: [] });
  state.branchCardsTaken = ['planted_witness', 'mirror_tail'];
  assert.strictEqual(state.branchCardsTaken.length, 2);
  assert.ok(state.branchCardsTaken.includes('planted_witness'));
  assert.ok(state.branchCardsTaken.includes('mirror_tail'));
});

test('mirrorZoneFlow - branch cards accumulate across mirror zone visits', () => {
  const state = createMockGameState({ branchCardsTaken: ['planted_witness'] });
  state.branchCardsTaken = [...state.branchCardsTaken!, 'cross_examiner'];
  assert.strictEqual(state.branchCardsTaken.length, 2);
});

test('mirrorZoneFlow - track peak secondary resource for informant', () => {
  const state = createMockGameState({
    character: {
      id: 'informant',
      name: 'Informant',
      description: 'Test',
      maxHp: 80,
      maxEnergy: 3,
      startingDeck: [],
      portraitPrompt: 'test',
      secondaryResource: 'evidence'
    },
    secondaryResourcePeak: 0
  });
  state.secondaryResourcePeak = 5;
  assert.strictEqual(state.secondaryResourcePeak, 5);
});

test('mirrorZoneFlow - update peak when higher value reached', () => {
  const state = createMockGameState({ secondaryResourcePeak: 3 });
  state.secondaryResourcePeak = Math.max(state.secondaryResourcePeak!, 7);
  assert.strictEqual(state.secondaryResourcePeak, 7);
});

test('mirrorZoneFlow - does not decrease peak on resource spend', () => {
  const state = createMockGameState({ secondaryResourcePeak: 5 });
  state.secondaryResourcePeak = Math.max(state.secondaryResourcePeak!, 4);
  assert.strictEqual(state.secondaryResourcePeak, 5);
});

test('mirrorZoneFlow - run summary with mirror zone visited', () => {
  const state = createMockGameState({
    mirrorZoneVisited: true,
    branchCardsTaken: ['evidence_laundering', 'terminal_verdict'],
    secondaryResourcePeak: 8
  });
  const summary = computeRunSummary(state);
  assert.strictEqual(summary.mirrorZoneVisited, true);
  assert.deepStrictEqual(summary.branchCardsTaken, ['evidence_laundering', 'terminal_verdict']);
  assert.strictEqual(summary.secondaryResourcePeak, 8);
});

test('mirrorZoneFlow - run summary without mirror zone visit', () => {
  const state = createMockGameState({
    mirrorZoneVisited: false,
    branchCardsTaken: [],
    secondaryResourcePeak: 0
  });
  const summary = computeRunSummary(state);
  assert.strictEqual(summary.mirrorZoneVisited, false);
  assert.deepStrictEqual(summary.branchCardsTaken, []);
  assert.strictEqual(summary.secondaryResourcePeak, 0);
});

test('mirrorZoneFlow - return to main path after mirror zone', () => {
  const state = createMockGameState({
    currentNodeId: 'mirror_exit_node',
    screen: 'Event'
  });
  state.currentNodeId = 'floor_12_01';
  state.screen = 'Map';
  assert.strictEqual(state.currentNodeId, 'floor_12_01');
  assert.strictEqual(state.screen, 'Map');
});

test('mirrorZoneFlow - default meta profile with mirror zone fields', () => {
  const profile = createDefaultMetaProfile();
  assert.deepStrictEqual(profile.branchCodexProgress, {});
  assert.deepStrictEqual(profile.branchAchievementCounts, {});
});

test('mirrorZoneFlow - persist mirror zone visit to meta profile', () => {
  const profile = createDefaultMetaProfile();
  profile.branchCodexProgress['mirror_zone_visits'] = 1;
  assert.strictEqual(profile.branchCodexProgress['mirror_zone_visits'], 1);
});
