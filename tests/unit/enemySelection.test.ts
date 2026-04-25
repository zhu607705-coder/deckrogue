/**
 * @file enemySelection.test.ts
 * @description Unit tests for enemy selection pool filtering and floor eligibility.
 *
 * 主要职责:
 * - 测试低层展示变体的优先级
 * - 测试楼层合法的敌人池筛选
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { enemiesData } from '@/content/narrative/numericSystem';
import { clampEnemyCountForEncounter, getFloorEligibleEnemyPool, prioritizeEnemyPoolForEncounter } from '@/core/combat/enemySelection';

const enemies = enemiesData as Array<{ id: string; keywords?: string[]; hp_range?: [number, number] }>;

test('prioritizeEnemyPoolForEncounter prefers showcase variants on floors 1-3', () => {
  const floor1 = prioritizeEnemyPoolForEncounter(enemies, 1, 'Combat');
  const floor2 = prioritizeEnemyPoolForEncounter(enemies, 2, 'Combat');
  const floor3 = prioritizeEnemyPoolForEncounter(enemies, 3, 'Combat');

  assert.ok(floor1.every((enemy) => enemy.keywords?.includes('showcase_floor_1')));
  assert.ok(floor2.every((enemy) => enemy.keywords?.includes('showcase_floor_2')));
  assert.ok(floor3.every((enemy) => enemy.keywords?.includes('showcase_floor_3')));
});

test('getFloorEligibleEnemyPool keeps combat pool on-node-type and floor-legal', () => {
  const floor1Pool = getFloorEligibleEnemyPool(enemies, 1, 'Combat');

  assert.ok(floor1Pool.length > 0);
  assert.ok(floor1Pool.every((enemy) => !enemy.keywords?.includes('elite') && !enemy.keywords?.includes('boss')));
  assert.ok(floor1Pool.every((enemy) => enemy.id !== 'fission_small'));
});

test('clampEnemyCountForEncounter prevents duplicate singleton showcase rooms in the first 3 floors', () => {
  const floor2 = prioritizeEnemyPoolForEncounter(enemies, 2, 'Combat');
  const floor3 = prioritizeEnemyPoolForEncounter(enemies, 3, 'Combat');
  const laterCombatPool = getFloorEligibleEnemyPool(enemies, 4, 'Combat');

  assert.equal(floor2.length, 1);
  assert.equal(floor3.length, 1);
  assert.equal(clampEnemyCountForEncounter(2, 2, 'Combat', floor2), 1);
  assert.equal(clampEnemyCountForEncounter(2, 3, 'Combat', floor3), 1);
  assert.equal(clampEnemyCountForEncounter(2, 4, 'Combat', laterCombatPool), 2);
  assert.equal(clampEnemyCountForEncounter(2, 2, 'Elite', floor2), 1);
  assert.equal(clampEnemyCountForEncounter(2, 4, 'Elite', laterCombatPool), 2);
  assert.equal(clampEnemyCountForEncounter(Number.NaN, 4, 'Combat', laterCombatPool), 1);
});
