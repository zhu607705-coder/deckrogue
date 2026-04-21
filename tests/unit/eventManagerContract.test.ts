import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';

function attachCombat(engine: GameEngine): void {
  engine.state.combat = {
    player: {
      hp: engine.state.player.hp,
      maxHp: engine.state.player.maxHp,
      block: 0,
      energy: engine.state.player.maxEnergy,
      statuses: {},
      delayedCards: [],
      constructs: [],
      elements: [],
      potionToxicity: 0,
      potionsUsedThisTurn: 0,
      cardsPlayedThisTurn: 0,
      damageTakenThisTurn: 0,
      damageTakenLastTurn: 0,
      intel: engine.state.player.intel,
      devotion: engine.state.player.devotion || 0,
      corruptionAxis: engine.state.player.corruption || 0,
      axisDisposition: 'balanced',
    },
    enemies: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 1,
    isPlayerTurn: true,
    warpTide: 0,
    warpAlpha: 0.5,
    warpPerilK: 0.05,
  };
}

test('rusting medicae extract grants potions without crashing the weighted reward path', () => {
  const engine = new GameEngine(4321, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.metaRuntime = { unlockedPoolIds: ['healing_potion'], appliedUpgradeIds: [], appliedPactIds: [] };
  engine.state.map = [{ id: 'event-node', type: 'Event', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'event-node';
  engine.state.pendingNodeResolution = true;
  engine.state.activeEvent = { id: 'rusting_medicae', data: {} };
  engine.state.screen = 'Event';

  engine.resolveEventChoice('medicae_extract');

  assert.ok(engine.state.player.potions.length >= 1);
  assert.equal(engine.state.screen, 'Map');
  engine.dispose();
});

test('event relic acquisition uses live relic fields for corruption and combat pulse text', () => {
  const engine = new GameEngine(8765, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  attachCombat(engine);
  engine.state.activeEvent = { id: 'mysterious_shrine', offeredRelicId: 'mark_of_chaos' };
  engine.state.screen = 'Event';

  engine.makeEventChoice('accept');

  assert.equal(engine.state.player.relics.includes('mark_of_chaos'), true);
  assert.equal(engine.state.player.relicStates['mark_of_chaos']?.corrupted, true);
  assert.equal(engine.state.combat?.warpPulse?.text.includes('混沌烙印'), true);
  engine.dispose();
});
