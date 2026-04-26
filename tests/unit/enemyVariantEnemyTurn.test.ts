/**
 * @file enemyVariantEnemyTurn.test.ts
 * @description Unit tests for enemy variant behavior during enemy turns in combat.
 *
 * 主要职责:
 * - 测试敌人变体的回合行为
 * - 测试敌人回合中的状态变化
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { GameEngine } from '@/core/events/gameEngine';
import { createRunCardInstance } from '@/core/combat/runCardInstance';
import { getCardDefById } from '@/content/narrative/numericSystem';

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 0,
    runId: 'run_enemy_variant_turns',
    runStartedAt: Date.now(),
    character: null,
    player: {
      hp: 20,
      maxHp: 20,
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
        hp: 20,
        maxHp: 20,
        block: 0,
        energy: 3,
        statuses: {
          Weak: 1,
          Vulnerable: 1,
        },
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
          id: 'enemy_variant_1',
          defId: 'goblin_trapper',
          name: 'Goblin Wirebinder',
          hp: 26,
          maxHp: 26,
          block: 0,
          statuses: {} as Record<string, number>,
          nextIntent: 'mark_prey',
          lastUsedIntent: '',
          intentCooldowns: {} as Record<string, number>,
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced'
        },
        {
          id: 'enemy_variant_2',
          defId: 'cultist_herald',
          name: 'Ashen Herald',
          hp: 48,
          maxHp: 48,
          block: 0,
          statuses: {} as Record<string, number>,
          nextIntent: 'war_psalm',
          lastUsedIntent: '',
          intentCooldowns: {} as Record<string, number>,
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced'
        },
        {
          id: 'enemy_variant_3',
          defId: 'barrier_redeemer',
          name: 'Redeemer Bulwark',
          hp: 28,
          maxHp: 28,
          block: 0,
          statuses: {} as Record<string, number>,
          nextIntent: 'hymnal_guard',
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
      isPlayerTurn: false,
      warpTide: 0,
      warpAlpha: 0.5,
      warpPerilK: 0.05
    },
    map: [
      {
        id: 'floor_1_node_0',
        type: 'Combat',
        revealed: true,
        next: [],
        x: 0,
        y: 0
      }
    ],
    currentNodeId: 'floor_1_node_0',
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Combat',
    pendingNodeResolution: true,
    campfireChoiceLocked: false,
    combatVoxLog: [],
    lastCombatVoxLog: [],
    lastDeathVoxLog: []
  };
}

test('enemy variants can apply player debuffs during the active enemy turn path', async () => {
  const engine = new GameEngine(401, null, { enableRuntimeDelegation: false });
  (engine as any).state = makeState();

  await engine.executeEnemyTurn();

  assert.equal(engine.state.combat?.player.statuses.Vulnerable, 2);
  assert.equal(engine.state.combat?.player.hp, 14);
  engine.dispose();
});

test('enemy variants can gain self block and self buffs during the active enemy turn path', async () => {
  const engine = new GameEngine(402, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.enemies = [state.combat!.enemies[2]];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  const bulwark = engine.state.combat?.enemies[0];
  assert.equal(bulwark?.block, 8);
  assert.equal(bulwark?.statuses.Strength, 1);
  engine.dispose();
});

test('enemy variants can buff allied enemies during the active enemy turn path', async () => {
  const engine = new GameEngine(403, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.enemies = [
    state.combat!.enemies[1],
    {
      ...state.combat!.enemies[0],
      id: 'ally_guard',
      defId: 'goblin_trapper',
      name: 'Goblin Wirebinder',
      nextIntent: 'snare_shot',
    }
  ];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  assert.equal(engine.state.combat?.enemies[0]?.statuses.Strength, 1);
  assert.equal(engine.state.combat?.enemies[1]?.statuses.Strength, 1);
  engine.dispose();
});

test('enemy variants can apply draw penalties and hand cost disruption', async () => {
  const engine = new GameEngine(404, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const card = getCardDefById('calculated_strike');
  assert.ok(card);
  state.combat!.hand = [createRunCardInstance(card!, 'hand_attack')];
  state.combat!.enemies = [{
    ...state.combat!.enemies[0],
    id: 'data_leech_1',
    defId: 'data_leech',
    name: 'Data Leech',
    nextIntent: 'scramble',
  }];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  assert.equal(engine.state.combat?.hand[0]?.cost, card!.cost + 1);
  engine.dispose();
});

test('enemy variants can summon allies through generic summon moves', async () => {
  const engine = new GameEngine(405, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.enemies = [{
    ...state.combat!.enemies[0],
    id: 'fusion_censer_1',
    defId: 'fusion_censer',
    name: 'Fusion Censer',
    nextIntent: 'stoke',
  }];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  assert.ok((engine.state.combat?.enemies.length || 0) >= 2);
  assert.ok(engine.state.combat?.enemies.some(enemy => enemy.defId === 'coolant_hound'));
  engine.dispose();
});

test('enemy variants can cleanse debuffs before applying self damage boosts', async () => {
  const engine = new GameEngine(406, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.enemies = [{
    ...state.combat!.enemies[0],
    id: 'intelligence_officer_1',
    defId: 'intelligence_officer',
    name: 'Intelligence Officer',
    statuses: { Weak: 1, Vulnerable: 1 },
    nextIntent: 'counter_surveillance',
  }];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  const officer = engine.state.combat?.enemies[0];
  assert.equal(officer?.statuses.Weak, undefined);
  assert.equal(officer?.statuses.Vulnerable, undefined);
  assert.equal(officer?.statuses.Strength, 4);
  engine.dispose();
});

test('enemy AllEnemies status actions apply to the enemy side instead of the player', async () => {
  const engine = new GameEngine(407, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.player.statuses = {};
  state.combat!.enemies = [{
    ...state.combat!.enemies[0],
    id: 'plague_choir_1',
    defId: 'plague_choir',
    name: 'Plague Choir',
    statuses: {},
    nextIntent: 'chant',
  }];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  assert.equal(engine.state.combat?.player.statuses.Poison, undefined);
  assert.equal(engine.state.combat?.enemies[0]?.statuses.Poison, 1);
  engine.dispose();
});

test('enemy AllEnemies block actions apply to the enemy side', async () => {
  const engine = new GameEngine(408, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.enemies = [{
    ...state.combat!.enemies[0],
    id: 'spore_wretch_1',
    defId: 'spore_wretch',
    name: 'Spore Wretch',
    statuses: {},
    nextIntent: 'shed',
  }];
  (engine as any).state = state;

  await engine.executeEnemyTurn();

  assert.equal(engine.state.combat?.enemies[0]?.block, 4);
  engine.dispose();
});

test('enemy target resolver separates all enemies, allies, and explicit enemy ids', () => {
  const engine = new GameEngine(409, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.player.statuses = {};
  state.combat!.enemies = [
    {
      ...state.combat!.enemies[0],
      id: 'caster',
      defId: 'caster_def',
      hp: 12,
      maxHp: 20,
      block: 0,
      statuses: {},
    },
    {
      ...state.combat!.enemies[1],
      id: 'ally',
      defId: 'ally_def',
      hp: 8,
      maxHp: 20,
      block: 0,
      statuses: {},
    },
    {
      ...state.combat!.enemies[2],
      id: 'dead_ally',
      defId: 'dead_def',
      hp: 0,
      maxHp: 20,
      block: 0,
      statuses: {},
    },
  ];
  (engine as any).state = state;
  const manager = (engine as any).combatManager;
  const caster = state.combat!.enemies[0];
  const ally = state.combat!.enemies[1];
  const dead = state.combat!.enemies[2];

  manager.executeEnemyActionSpec(caster, { type: 'ApplyStatus', target: 'AllEnemies', status: 'Poison', amount: 1 });
  assert.equal(state.combat!.player.statuses.Poison, undefined);
  assert.equal(caster.statuses.Poison, 1);
  assert.equal(ally.statuses.Poison, 1);
  assert.equal(dead.statuses.Poison, undefined);

  manager.executeEnemyActionSpec(caster, { type: 'ApplyStatus', target: 'AllAllies', status: 'Strength', amount: 2 });
  assert.equal(caster.statuses.Strength, undefined);
  assert.equal(ally.statuses.Strength, 2);

  manager.executeEnemyActionSpec(caster, { type: 'ApplyStatus', target: 'ally', status: 'Weak', amount: 1 });
  assert.equal(state.combat!.player.statuses.Weak, undefined);
  assert.equal(ally.statuses.Weak, 1);

  manager.executeEnemyActionSpec(caster, { type: 'GainBlock', target: 'AllAllies', amount: 3 });
  assert.equal(caster.block, 0);
  assert.equal(ally.block, 3);

  manager.executeEnemyActionSpec(caster, { type: 'Heal', target: 'ally', amount: 4 });
  assert.equal(ally.hp, 12);
  engine.dispose();
});
