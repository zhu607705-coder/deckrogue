/**
 * @file combatViewModel.test.ts
 * @description Unit tests for combat view model value clamping and intent threat levels.
 *
 * 主要职责:
 * - 测试角色资源快照的数值钳制
 * - 测试意图威胁等级计算
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { IntentDisplay } from '@/types';
import {
  clampCombatInteger,
  clampCombatPercent,
  getCardPlayabilitySnapshot,
  getCharacterResourceSnapshot,
  getIntentThreatLevel
} from '@/ui/views/combat/combatViewModel';

test('combat view model: character resource snapshot clamps invalid values', () => {
  const snapshot = getCharacterResourceSnapshot(
    'informant',
    { timeLayer: 0, thread: 0, concoction: 0 },
    { evidence: -7 }
  );

  assert.deepEqual(snapshot, {
    label: '证据',
    value: 0,
    tone: 'grimdark-pill--resource'
  });
});

test('combat view model: clamp helpers keep values in display-safe range', () => {
  assert.equal(clampCombatInteger(-12), 0);
  assert.equal(clampCombatInteger(6.9), 6);
  assert.equal(clampCombatPercent(125), 100);
  assert.equal(clampCombatPercent(-3), 0);
  assert.equal(clampCombatPercent(Number.NaN), 0);
});

test('combat view model: card playability snapshot centralizes cost and disabled state', () => {
  assert.deepEqual(
    getCardPlayabilitySnapshot({ cost: 2, tempCost: 1, tags: [] } as any, 3, true),
    {
      cost: 1,
      remainingEnergy: 2,
      isUnplayable: false,
      isDisabled: false,
    }
  );

  assert.deepEqual(
    getCardPlayabilitySnapshot({ cost: 1, tags: ['Unplayable'] } as any, 3, true),
    {
      cost: 1,
      remainingEnergy: 2,
      isUnplayable: true,
      isDisabled: true,
    }
  );

  assert.equal(getCardPlayabilitySnapshot({ cost: 4, tags: [] } as any, 2, true).isDisabled, true);
  assert.equal(getCardPlayabilitySnapshot({ cost: 0, tags: [] } as any, 2, false).isDisabled, true);
});

test('combat view model: intent threat level prefers lethal and control signals', () => {
  const lethalIntent: IntentDisplay = {
    icon: '⚔️',
    text: '36',
    tone: 'attack',
    breakdown: {
      totalDamage: 36,
      hits: [18, 18],
      block: 0,
      statuses: [],
      extras: []
    }
  };

  const controlIntent: IntentDisplay = {
    icon: '✦',
    text: '弱化',
    tone: 'status',
    breakdown: {
      totalDamage: 0,
      hits: [],
      block: 0,
      statuses: [{ status: 'Weak', amount: 2, target: 'player' }],
      extras: []
    }
  };

  assert.equal(getIntentThreatLevel(lethalIntent), '致命');
  assert.equal(getIntentThreatLevel(controlIntent), '控场');
});
