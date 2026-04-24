/**
 * @file runtimeV2FlowSmokeRoute.test.ts
 * @description Unit tests for runtime v2 flow smoke coverage route discovery and relic fixture synthesis.
 *
 * 主要职责:
 * - 测试覆盖率路由的发现逻辑
 * - 测试可购买遗物 fixture 的合成
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPurchasableRelicFixture, findCoverageRoute } from '../../scripts/validation/playwright_runtime_v2_flow_smoke';

test('runtime-v2 flow smoke can find the main event/rest/combat coverage route', () => {
  const route = findCoverageRoute(400, ['Event', 'Rest', 'Combat']);
  const routeTypes = new Set(route.path.map((step) => step.type));

  assert.equal(routeTypes.has('Event'), true);
  assert.equal(routeTypes.has('Rest'), true);
  assert.equal(routeTypes.has('Combat'), true);
});

test('runtime-v2 flow smoke can find a shop coverage route', () => {
  const route = findCoverageRoute(400, ['Shop']);
  const routeTypes = new Set(route.path.map((step) => step.type));

  assert.equal(routeTypes.has('Shop'), true);
  assert.equal(route.path.at(-1)?.type, 'Shop');
});

test('runtime-v2 flow smoke can synthesize a purchasable relic fixture from a live shop snapshot', () => {
  const fixture = createPurchasableRelicFixture({
    schemaVersion: 2,
    savedAt: '2026-04-14T00:00:00Z',
    hostPlatform: 'web',
    snapshot: {
      schemaVersion: 2,
      engineVersion: 'runtime-v2-draft',
      seed: 2,
      lifecycle: {
        screen: 'Shop',
        phase: 'shop',
        pendingNodeResolution: true,
      },
      player: {
        characterId: 'informant',
        hp: 70,
        maxHp: 70,
        gold: 99,
        intel: 0,
        devotion: 0,
        corruption: 0,
        deck: ['strike', 'defend'],
        relicIds: [],
        potionIds: [],
      },
      map: {
        currentNodeId: 'floor_1_node_3',
        nodes: [],
      },
      combat: null,
      reward: null,
      shop: {
        cards: [],
        relics: [
          { id: 'corrupted_relic', price: 240 },
          { id: 'ledger_mask', price: 150 },
        ],
        potions: [],
        cardRemovalCost: 75,
      },
      activeEvent: null,
      meta: {
        runId: 'runtime-v2-shop-fixture',
        replayLength: 2,
        generatedAt: '2026-04-14T00:00:00Z',
        adapter: 'python-wasm',
        runtimeRngState: 123,
      },
    },
  }, {
    schemaVersion: 1,
    seed: 2,
    commands: [
      { type: 'select_character', characterId: 'informant' },
      { type: 'enter_node', nodeId: 'floor_1_node_3' },
    ],
  });
  const loadSnapshotCommand = fixture.replayLog.commands.at(-1) as { type: 'load_snapshot'; snapshot: { player: { gold: number } } };

  assert.equal(fixture.selectedRelicId, 'ledger_mask');
  assert.equal(fixture.saveGame.snapshot.player.gold, 150);
  assert.equal(loadSnapshotCommand?.type, 'load_snapshot');
  assert.equal(loadSnapshotCommand?.snapshot.player.gold, 150);
});
