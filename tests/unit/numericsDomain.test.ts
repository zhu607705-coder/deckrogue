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
