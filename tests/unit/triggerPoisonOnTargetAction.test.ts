import test from 'node:test';
import assert from 'node:assert/strict';

import type { ActionSpec, GameState } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { globalEventBus, type GameEvent } from '@/core/events/eventBus';

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
      relicStates: {},
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
        axisDisposition: 'balanced',
      },
      enemies: [
        {
          id: 'e1',
          defId: 'test_enemy',
          name: 'Poison Target',
          hp: 30,
          maxHp: 30,
          block: 40,
          statuses: { Poison: 7 },
          nextIntent: 'Attack',
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced',
        },
      ],
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: 0,
      warpAlpha: 0.5,
      warpPerilK: 0.05,
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
    campfireChoiceLocked: false,
  } as GameState;
}

test('TriggerPoisonOnTarget bypasses block, clears poison, and emits canonical damage events', () => {
  const state = makeState();
  const queue = new ActionQueue();
  const damageEvents: GameEvent[] = [];
  const deathEvents: GameEvent[] = [];
  const unsubscribeDamage = globalEventBus.subscribe('DamageDealt', (event) => damageEvents.push(event));
  const unsubscribeDeath = globalEventBus.subscribe('EnemyDeath', (event) => deathEvents.push(event));

  try {
    (queue as any)._currentContext = { source: 'player', sourceId: 'player', targetId: 'e1' };

    const action = ActionFactoryV2.createAction({
      type: 'TriggerPoisonOnTarget',
      target: 'Enemy',
    } as ActionSpec);

    action.execute(state, queue);

    assert.equal(state.combat!.enemies[0].block, 40);
    assert.equal(state.combat!.enemies[0].hp, 23);
    assert.equal(state.combat!.enemies[0].statuses.Poison, 0);
    assert.equal(damageEvents.length, 1);
    assert.equal(damageEvents[0].type, 'DamageDealt');
    assert.equal(damageEvents[0].amount, 7);
    assert.equal(damageEvents[0].targetId, 'e1');
    assert.equal(deathEvents.length, 0);
  } finally {
    unsubscribeDamage();
    unsubscribeDeath();
    globalEventBus.clear();
  }
});
