/**
 * @file destructiveRegression.test.ts
 * @description Unit tests for destructive regression detection in action queue and combat system.
 *
 * 主要职责:
 * - 测试动作队列的回归检测
 * - 测试战斗系统的破坏性变更检测
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState, RunCardInstance } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { combatSystem } from '@/core/combat/combatSystem';

function makeCard(id: string, instanceId: string): RunCardInstance {
  return {
    id,
    instanceId,
    baseCardId: id,
    name: id,
    rarity: 'Common',
    cost: 0,
    type: 'Skill',
    targeting: 'None',
    tags: [],
    text: id,
    actions: [],
    runtimeBase: {
      id,
      name: id,
      rarity: 'Common',
      cost: 0,
      type: 'Skill',
      targeting: 'None',
      tags: [],
      text: id,
      actions: []
    },
    persistentEnchantments: [],
    combatAfflictions: []
  };
}

function makeState(): GameState {
  return {
    seed: 77,
    rngState: 0,
    runId: 'run_destructive',
    runStartedAt: Date.now(),
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
      devotion: 0,
      relicStates: {},
      runEffects: {}
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
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
        intel: 0,
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      },
      enemies: [
        {
          id: 'boss_extreme',
          defId: 'boss_test',
          name: 'Extreme Target',
          hp: 5000,
          maxHp: 5000,
          block: 0,
          statuses: {} as Record<string, number>,
          nextIntent: 'Attack',
          lastUsedIntent: '',
          intentCooldowns: {} as Record<string, number>,
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
    campfireChoiceLocked: false,
    combatVoxLog: [],
    lastCombatVoxLog: [],
    lastDeathVoxLog: []
  };
}

test('destructive: extreme damage should never push hp below zero', () => {
  const state = makeState();
  const damage = combatSystem.applyDamage(state, {
    amount: 9999,
    sourceType: 'player',
    sourceId: 'player',
    targetType: 'enemy',
    targetId: 'boss_extreme',
    modifiers: [],
    isTrueDamage: true,
    ignoreBlock: true
  });

  assert.equal(damage, 5000);
  assert.equal(state.combat!.enemies[0].hp, 0);
});

test('destructive: extreme draw request should consume all available cards without crashing', () => {
  const state = makeState();
  state.combat!.discardPile = [
    makeCard('c1', 'c1_1'),
    makeCard('c2', 'c2_1'),
    makeCard('c3', 'c3_1')
  ];
  const queue = new ActionQueue();
  const action = ActionFactoryV2.createAction({ type: 'Draw', amount: 999 });

  action.execute(state, queue);

  assert.equal(state.combat!.hand.length, 3);
  assert.equal(state.combat!.drawPile.length, 0);
  assert.equal(state.combat!.discardPile.length, 0);
});

test('destructive: extreme poison stacks should stay finite', () => {
  const state = makeState();
  combatSystem.applyStatus(state, 'enemy', 'boss_extreme', 'Poison', 1_000_000);

  assert.equal(state.combat!.enemies[0].statuses.Poison, 1_000_000);
  assert.ok(Number.isFinite(state.combat!.enemies[0].statuses.Poison));
});

test('destructive: negative block grants should not underflow block below zero', () => {
  const state = makeState();
  state.combat!.player.block = 2;

  combatSystem.gainBlock(state, 'player', 'player', -10);

  assert.equal(state.combat!.player.block, 0);
});

test('destructive: extreme energy gain should stay finite and deterministic', () => {
  const state = makeState();
  const action = ActionFactoryV2.createAction({ type: 'ModifyEnergy', amount: 999 });

  action.execute(state, new ActionQueue());

  assert.equal(state.combat!.player.energy, 1002);
  assert.ok(Number.isFinite(state.combat!.player.energy));
});

test('destructive: extreme status reduction should clamp to zero', () => {
  const state = makeState();

  combatSystem.applyStatus(state, 'enemy', 'boss_extreme', 'Vulnerable', 2000);
  combatSystem.applyStatus(state, 'enemy', 'boss_extreme', 'Vulnerable', -5000);

  assert.equal(state.combat!.enemies[0].statuses.Vulnerable, 0);
});
