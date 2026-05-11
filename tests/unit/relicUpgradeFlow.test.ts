/**
 * @file relicUpgradeFlow.test.ts
 * @description Unit tests for relic upgrade flow from rest and corrupted relic handling.
 *
 * 主要职责:
 * - 测试遗物升级从休息界面的流程
 * - 测试腐化遗物的升级与返回
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '@/core/events/gameEngine';

function buildEngine() {
  const engine = new GameEngine(12345, null);
  engine.selectCharacter('informant');
  return engine;
}

test('rest relic upgrade can upgrade a corrupted relic and return to rest on cancel', () => {
  const engine = buildEngine();
  engine.state.screen = 'Rest';
  engine.state.player.gold = 999;
  engine.state.player.relics.push('entropy_sanctum_relic');
  engine.state.player.relicStates.entropy_sanctum_relic = { level: 1, progress: 0, corrupted: true };

  engine.restUpgradeRelic();

  assert.equal(engine.state.screen, 'RelicUpgrade');
  const upgradeInfo = engine.getRelicUpgradeInfo('entropy_sanctum_relic');
  assert.ok(upgradeInfo);
  assert.equal(upgradeInfo.currentLevel, 1);
  assert.equal(upgradeInfo.canUpgrade, true);

  const upgraded = engine.upgradeRelic('entropy_sanctum_relic');
  assert.equal(upgraded, true);
  assert.equal(engine.state.screen, 'RelicUpgrade');
  assert.equal(engine.state.player.relicStates.entropy_sanctum_relic?.level, 2);

  engine.cancelRelicUpgrade();
  assert.equal(engine.state.screen, 'Rest');
});
