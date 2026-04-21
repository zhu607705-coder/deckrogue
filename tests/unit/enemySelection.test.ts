import test from 'node:test';
import assert from 'node:assert/strict';

import { enemiesData } from '@/content/narrative/numericSystem';
import { getFloorEligibleEnemyPool, prioritizeEnemyPoolForEncounter } from '@/core/combat/enemySelection';

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
