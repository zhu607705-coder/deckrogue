/**
 * @file numericsDomain.test.ts
 * @description Unit tests for the numerics baseline and derived formulas.
 *
 * 主要职责:
 * - 测试能量与伤害的 EVU 换算
 * - 测试扭曲力量/危难几率的单调性
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NUMERICS_BASELINE,
  derivePriceGold,
  energyToEVU,
  damageToEVU,
  warpPerilChance,
  warpPowerMultiplier
} from '@/core/balance';
import { __numericSystemTesting } from '@/content/narrative/numericSystem';

test('energy and damage EVU use the unified baseline', () => {
  assert.equal(energyToEVU(1), NUMERICS_BASELINE.evu.energy);
  assert.equal(damageToEVU(10), 10 * NUMERICS_BASELINE.evu.damage);
});

test('warp power multiplier and peril chance are monotonic', () => {
  const lowPower = warpPowerMultiplier(20);
  const highPower = warpPowerMultiplier(80);
  const lowPeril = warpPerilChance(20);
  const highPeril = warpPerilChance(80);

  assert.ok(highPower > lowPower);
  assert.ok(highPeril > lowPeril);
  assert.ok(highPeril <= 1);
});

test('price derivation preserves baseline common-card floor', () => {
  const quote = derivePriceGold(1, { minPrice: NUMERICS_BASELINE.pricing.cardCommon });
  assert.ok(quote.gold >= NUMERICS_BASELINE.pricing.cardCommon);
});

test('numeric path overrides apply valid nested object and array paths', () => {
  const target = {
    actions: [
      {
        amount: 1,
        trueActions: [
          { amount: 2 },
          { amount: 3 },
        ],
      },
    ],
    upgrade: {
      actions: [{ amount: 4 }],
    },
  };

  __numericSystemTesting.applyPathOverrides(target, {
    'actions[0].amount': 5,
    'actions[0].trueActions[1].amount': 8,
    'upgrade.actions[0].amount': 7,
  });

  assert.equal(target.actions[0].amount, 5);
  assert.equal(target.actions[0].trueActions[1].amount, 8);
  assert.equal(target.upgrade.actions[0].amount, 7);
});

test('numeric path overrides reject exact prototype-pollution tokens', () => {
  const target: Record<string, unknown> = {};

  __numericSystemTesting.applyPathOverrides(target, {
    '__proto__.polluted': true,
    'constructor.prototype.polluted': true,
    'prototype.polluted': true,
  });

  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(target, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(target, 'constructor'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(target, 'prototype'), false);
});

test('numeric path overrides allow safe keys containing unsafe-token substrings', () => {
  const target: Record<string, unknown> = {};

  __numericSystemTesting.applyPathOverrides(target, {
    'prototypeBonus.amount': 3,
    'constructorNote.amount': 4,
  });

  assert.deepEqual(target.prototypeBonus, { amount: 3 });
  assert.deepEqual(target.constructorNote, { amount: 4 });
});
