import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';

test('active combat manager applies cathedral engine overheat pulse during enemy turn', async () => {
  const engine = new GameEngine(7777, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');

  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'boss_phase_flow';
  engine.state.combat = {
    player: {
      hp: 20,
      maxHp: 20,
      block: 10,
      energy: 3,
      statuses: {},
      delayedCards: [],
      constructs: [],
      elements: [],
      potionToxicity: 0,
      potionsUsedThisTurn: 0,
      cardsPlayedThisTurn: 0,
      damageTakenThisTurn: 0,
      damageTakenLastTurn: 0,
      intel: 0,
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    },
    enemies: [
      {
        id: 'boss_1',
        defId: 'cathedral_engine',
        name: 'Cathedral Engine',
        hp: 60,
        maxHp: 100,
        block: 0,
        statuses: {},
        nextIntent: 'Attack',
        lastUsedIntent: '',
        intentCooldowns: {},
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced',
      },
    ],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 2,
    isPlayerTurn: true,
    warpTide: 0,
    warpAlpha: 0.5,
    warpPerilK: 0.05,
    bossPhase: {
      enemyId: 'boss_1',
      bossDefId: 'cathedral_engine',
      phaseIndex: 1,
      phaseId: 'overheat_mass',
      phaseName: 'Overheat Mass',
      phaseHint: '',
      enteredTurn: 1,
      currentPlayerTurnCards: [],
      previousPlayerTurnCards: [],
      flags: {},
      adaptationEnabled: false,
    },
  };

  await engine.endTurn();

  assert.equal(engine.state.combat?.player.hp, 14);
  assert.equal(engine.state.combatVoxLog?.some((line) => line.includes('过热的机械释放灼热冲击')), true);
  engine.dispose();
});
