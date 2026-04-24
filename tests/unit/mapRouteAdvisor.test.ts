/**
 * @file mapRouteAdvisor.test.ts
 * @description Unit tests for map route advisor dossier generation.
 *
 * 主要职责:
 * - 测试 buildRouteDossiers 生成的对比路由档案
 * - 测试路由建议中的属性正确性
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { MapNode } from '@/core';
import { buildRouteDossiers } from '@/ui/views/mapRouteAdvisor';

const map: MapNode[] = [
  { id: 'n1', type: 'Combat', revealed: true, next: ['n4', 'n5'], x: 0.2, y: 0 },
  { id: 'n2', type: 'Event', revealed: true, next: ['n5'], x: 0.5, y: 0 },
  { id: 'n3', type: 'Shop', revealed: true, next: ['n6'], x: 0.8, y: 0 },
  { id: 'n4', type: 'Elite', revealed: true, next: ['n7'], x: 0.2, y: 1 },
  { id: 'n5', type: 'Rest', revealed: true, next: ['n7'], x: 0.5, y: 1 },
  { id: 'n6', type: 'Event', revealed: true, next: ['n7'], x: 0.8, y: 1 },
  { id: 'n7', type: 'Boss', revealed: false, next: [], x: 0.5, y: 2 },
];

test('buildRouteDossiers produces contrasting dossiers for selectable map routes', () => {
  const dossiers = buildRouteDossiers(map, ['n1', 'n2', 'n3'], {
    hp: 18,
    maxHp: 40,
    intel: 1,
    relicCount: 2,
    characterId: 'informant',
  });

  assert.equal(dossiers.length, 3);
  const byId = new Map(dossiers.map((dossier) => [dossier.nodeId, dossier]));
  assert.equal(byId.get('n1')?.summary.includes('头目'), true);
  assert.equal(byId.get('n3')?.summary.includes('补给'), true);
  assert.equal(byId.get('n3')?.mystery >= 2, true);
  assert.equal(byId.get('n3')?.summary.includes('异动'), true);
});
