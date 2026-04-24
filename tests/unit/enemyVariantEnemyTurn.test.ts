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
  assert.equal(bulwark?.block, 10);
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
