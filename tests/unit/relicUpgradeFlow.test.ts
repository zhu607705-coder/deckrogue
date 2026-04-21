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
  engine.state.player.relics.push('chaos_sanctum_relic');
  engine.state.player.relicStates.chaos_sanctum_relic = { level: 1, progress: 0, corrupted: true };

  engine.restUpgradeRelic();

  assert.equal(engine.state.screen, 'RelicUpgrade');
  const upgradeInfo = engine.getRelicUpgradeInfo('chaos_sanctum_relic');
  assert.ok(upgradeInfo);
  assert.equal(upgradeInfo.currentLevel, 1);
  assert.equal(upgradeInfo.canUpgrade, true);

  const upgraded = engine.upgradeRelic('chaos_sanctum_relic');
  assert.equal(upgraded, true);
  assert.equal(engine.state.screen, 'RelicUpgrade');
  assert.equal(engine.state.player.relicStates.chaos_sanctum_relic?.level, 2);

  engine.cancelRelicUpgrade();
  assert.equal(engine.state.screen, 'Rest');
});
