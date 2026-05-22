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
import { __numericSystemTesting, getMapRuntimeConfig } from '@/content/narrative/numericSystem';

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

test('numeric config schema rejects missing and nonnumeric versions', () => {
  const validateNumericConfig = (__numericSystemTesting as any).validateNumericConfig as (value: unknown) => unknown;

  assert.throws(
    () => validateNumericConfig({ cards: { byId: {} }, potions: { byId: {} }, relics: { byId: {} }, enemies: { byId: {} }, events: {} }),
    /version/
  );
  assert.throws(
    () => validateNumericConfig({ version: '1', cards: { byId: {} }, potions: { byId: {} }, relics: { byId: {} }, enemies: { byId: {} }, events: {} }),
    /version/
  );
});

test('content entity schema rejects numeric field typos before runtime use', () => {
  const validateCardsData = (__numericSystemTesting as any).validateCardsData as (value: unknown) => unknown;
  const validateEnemiesData = (__numericSystemTesting as any).validateEnemiesData as (value: unknown) => unknown;

  assert.throws(
    () => validateCardsData([
      { id: 'bad_card', name: 'Bad', rarity: 'Common', cost: 'free', type: 'Attack', targeting: 'Enemy', tags: [], text: '', actions: [] },
    ]),
    /cost/
  );
  assert.throws(
    () => validateEnemiesData([
      { id: 'bad_enemy', name: 'Bad', hp_range: [5, 'ten'], intent_policy: [{ intent: 'Attack', weight: 1 }], moves: { Attack: [] }, keywords: [] },
    ]),
    /hp_range/
  );
});

test('card modifier schema rejects unsupported effect contracts', () => {
  const validateCardModifiersData = (__numericSystemTesting as any).validateCardModifiersData as (value: unknown) => unknown;
  const base = {
    id: 'bad_modifier',
    name: 'Bad Modifier',
    scope: 'persistent',
    description: 'Invalid modifier fixture.',
    effect: { type: 'damage', amount: 1 },
  };

  assert.doesNotThrow(() => validateCardModifiersData([base]));
  assert.throws(
    () => validateCardModifiersData([{ ...base, effect: { type: 'unknownEffect', amount: 1 } }]),
    /unsupported card modifier effect type/
  );
  assert.throws(
    () => validateCardModifiersData([{ ...base, effect: { type: 'professionResource', amount: 1 } }]),
    /resource/
  );
  assert.throws(
    () => validateCardModifiersData([{ ...base, effect: { type: 'professionResource', amount: 1, resource: 'missing' } }]),
    /unsupported profession resource/
  );
});

test('numeric entity overrides reject bad patch types and undeclared fields', () => {
  const applyEntityOverrides = (__numericSystemTesting as any).applyEntityOverrides as (
    source: unknown[],
    patches: Record<string, Record<string, unknown>>,
    kind: string,
    validate: (value: unknown, context?: string) => unknown
  ) => unknown[];
  const validateCardsData = (__numericSystemTesting as any).validateCardsData as (value: unknown, context?: string) => unknown;
  const source = [
    { id: 'strike', name: 'Strike', rarity: 'Common', cost: 1, type: 'Attack', targeting: 'Enemy', tags: [], text: '', actions: [{ type: 'DealDamage', amount: 5 }] },
  ];

  assert.throws(
    () => applyEntityOverrides(source, { strike: { cost: 'free' } }, 'cards', validateCardsData),
    /cost/
  );
  assert.throws(
    () => applyEntityOverrides(source, { strike: { $set: { 'stealthBonusActions.amount': 3 } } }, 'cards', validateCardsData),
    /unknown patch path/
  );
});

test('story event numeric defs reject nonnumeric and non-authorized fields', () => {
  const applyStoryEventOverrides = (__numericSystemTesting as any).applyStoryEventOverrides as (
    source: unknown[],
    defs: Record<string, unknown>
  ) => unknown[];
  const source = [
    { id: 'event_a', title: 'Event A', loreText: [], floorMin: 1, floorMax: 3, weight: 1, options: [] },
  ];

  assert.throws(
    () => applyStoryEventOverrides(source, { event_a: { options: [] } }),
    /options/
  );
  assert.throws(
    () => applyStoryEventOverrides(source, { event_a: { weight: 'heavy' } }),
    /weight/
  );
});

test('entity maps reject duplicate ids instead of silently overwriting', () => {
  const createEntityMap = (__numericSystemTesting as any).createEntityMap as (kind: string, items: Array<{ id: string }>) => Map<string, unknown>;

  assert.throws(
    () => createEntityMap('cards', [{ id: 'strike' }, { id: 'strike' }]),
    /Duplicate cards id/
  );
});

test('map runtime config is cached after schema validation', () => {
  assert.strictEqual(getMapRuntimeConfig(), getMapRuntimeConfig());
});
