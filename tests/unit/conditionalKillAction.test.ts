import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState, ActionSpec } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 0,
    character: null,
    player: {
      hp: 100,
      maxHp: 100,
      energy: 3,
      maxEnergy: 3,
      gold: 0,
      intel: 0,
      deck: [],
      relics: [],
      potions: [],
      corruption: 0,
      relicStates: {}
    },
    combat: {
      player: {
        hp: 100,
        maxHp: 100,
        block: 0,
        energy: 3,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0,
        intel: 0,
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      },
      enemies: [
        {
          id: 'e1',
          defId: 'test_enemy',
          name: 'Test Enemy',
          hp: 0,
          maxHp: 20,
          block: 0,
          statuses: {},
          nextIntent: 'Attack',
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced'
        }
      ],
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: 0,
      warpAlpha: 0.5,
      warpPerilK: 0.05
    },
    map: [],
    currentNodeId: null,
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Combat',
    pendingNodeResolution: false,
    campfireChoiceLocked: false
  } as GameState;
}

test('conditional kill action should be registered in the action factory', () => {
  const action = ActionFactoryV2.createAction({
    type: 'ConditionalKill',
    trueActions: [{ type: 'GainEnergy', amount: 1, target: 'Self' }]
  } as ActionSpec);

  assert.notEqual(action.type, 'Null');
});

test('conditional kill action should execute trueActions when target is dead', () => {
  const state = makeState();
  const queue = new ActionQueue(state);
  queue._currentContext = { source: 'player', targetId: 'e1' };

  const action = ActionFactoryV2.createAction({
    type: 'ConditionalKill',
    trueActions: [{ type: 'GainEnergy', amount: 1, target: 'Self' }]
  } as ActionSpec);

  action.execute(state, queue);
  queue.processQueueSync();

  assert.equal(state.combat?.player.energy, 4);
});
