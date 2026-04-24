/**
 * @file triggerAllReactionsAction.test.ts
 * @description Unit tests for trigger-all-reactions action execution in combat.
 *
 * 主要职责:
 * - 测试触发全部反应动作的执行
 * - 测试战斗中的反应链触发
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ActionSpec, GameState } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { globalEventBus, type GameEvent } from '@/core/events/eventBus';

type DamageDealtEvent = Extract<GameEvent, { type: 'DamageDealt' }>;

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
        elements: ['fire', 'ice'],
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
          defId: 'test_enemy_1',
          name: 'Shielded Target',
          hp: 30,
          maxHp: 30,
          block: 5,
          statuses: { PlatedArmor: 1 },
          nextIntent: 'Attack',
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced',
        },
        {
          id: 'e2',
          defId: 'test_enemy_2',
          name: 'Open Target',
          hp: 24,
          maxHp: 24,
          block: 0,
          statuses: {},
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

test('TriggerAllReactions goes through the canonical damage pipeline for each enemy', () => {
  const state = makeState();
  const queue = new ActionQueue();
  const damageEvents: DamageDealtEvent[] = [];
  const unsubscribeDamage = globalEventBus.subscribe('DamageDealt', (event) =>
    damageEvents.push(event as DamageDealtEvent),
  );

  try {
    (queue as any)._currentContext = { source: 'player', sourceId: 'player' };

    const action = ActionFactoryV2.createAction({
      type: 'TriggerAllReactions',
      times: 1,
    } as ActionSpec);

    action.execute(state, queue);

    assert.equal(state.combat!.enemies[0].block, 0);
    assert.equal(state.combat!.enemies[0].hp, 25);
    assert.equal(state.combat!.enemies[0].statuses.PlatedArmor, undefined);
    assert.equal(state.combat!.enemies[1].hp, 14);
    assert.equal(damageEvents.length, 2);
    assert.deepEqual(damageEvents.map((event) => [event.targetId, event.amount]), [
      ['e1', 5],
      ['e2', 10],
    ]);
  } finally {
    unsubscribeDamage();
    globalEventBus.clear();
  }
});
