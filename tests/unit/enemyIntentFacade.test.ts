import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { enemiesData } from '@/content/narrative/numericSystem';
import { buildEnemyPerceptionSnapshot, selectEnemyIntentForCombat } from '@/core/ai';
import { cooldownsReducer } from '@/core/ai/cooldowns';

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 1,
    character: null,
    player: {
      hp: 8,
      maxHp: 20,
      energy: 3,
      maxEnergy: 3,
      block: 2,
      gold: 0,
      intel: 0,
      deck: [],
      relics: [],
      potions: [],
      corruption: 0,
      devotion: 0,
      relicStates: {},
      runEffects: {},
    },
    combat: {
      player: {
        hp: 8,
        maxHp: 20,
        block: 2,
        energy: 3,
        statuses: { Vulnerable: 1 },
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
          id: 'enemy_1',
          defId: 'test_enemy',
          name: 'Test Enemy',
          hp: 20,
          maxHp: 20,
          block: 0,
          statuses: {},
          nextIntent: 'Attack',
          lastUsedIntent: null,
          intentCooldowns: {},
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced',
        },
      ],
      drawPile: [],
      hand: [
        {
          id: 'heavy_strike',
          name: 'Heavy Strike',
          type: 'Attack',
          rarity: 'Common',
          cost: 2,
          text: '造成 10 点伤害。',
          actions: [{ type: 'DealDamage', amount: 10 }],
          instanceId: 'heavy_strike_1',
          baseCardId: 'heavy_strike',
          runtimeBase: {
            id: 'heavy_strike',
            name: 'Heavy Strike',
            type: 'Attack',
            rarity: 'Common',
            cost: 2,
            text: '造成 10 点伤害。',
            actions: [{ type: 'DealDamage', amount: 10 }],
          },
          persistentEnchantments: [],
          combatAfflictions: [],
        } as any,
        {
          id: 'finisher_barrage',
          name: 'Finisher Barrage',
          type: 'Attack',
          rarity: 'Common',
          cost: 2,
          text: '造成 14 点伤害。',
          actions: [{ type: 'DealDamage', amount: 14 }],
          instanceId: 'finisher_barrage_1',
          baseCardId: 'finisher_barrage',
          runtimeBase: {
            id: 'finisher_barrage',
            name: 'Finisher Barrage',
            type: 'Attack',
            rarity: 'Common',
            cost: 2,
            text: '造成 14 点伤害。',
            actions: [{ type: 'DealDamage', amount: 14 }],
          },
          persistentEnchantments: [],
          combatAfflictions: [],
        } as any,
        {
          id: 'guard_protocol',
          name: 'Guard Protocol',
          type: 'Skill',
          rarity: 'Common',
          cost: 1,
          text: '获得 8 点护盾。',
          actions: [{ type: 'GainBlock', amount: 8 }],
          instanceId: 'guard_protocol_1',
          baseCardId: 'guard_protocol',
          runtimeBase: {
            id: 'guard_protocol',
            name: 'Guard Protocol',
            type: 'Skill',
            rarity: 'Common',
            cost: 1,
            text: '获得 8 点护盾。',
            actions: [{ type: 'GainBlock', amount: 8 }],
          },
          persistentEnchantments: [],
          combatAfflictions: [],
        } as any,
      ],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: false,
      warpTide: 0,
      warpAlpha: 0.5,
      warpPerilK: 0.05,
    },
    map: [],
    currentNodeId: null,
    roomResolutionToken: null,
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Combat',
    pendingNodeResolution: false,
    campfireChoiceLocked: false,
    metaRuntime: {
      unlockedPoolIds: [],
      appliedUpgradeIds: [],
      appliedPactIds: [],
      ascensionIntentAggroBias: 0.5,
    },
  } as GameState;
}

test('selectEnemyIntentForCombat returns a policy intent through the unified AI entry', () => {
  const state = makeState();
  const enemyDef = {
    id: 'test_enemy',
    name: 'Test Enemy',
    keywords: [],
    intent_policy: [
      { intent: 'Strike', weight: 1 },
      { intent: 'Guard', weight: 1 },
    ],
  };

  const intent = selectEnemyIntentForCombat(state, enemyDef, state.combat!.enemies[0], 1, () => 0.2, {});
  assert.ok(['Strike', 'Guard'].includes(intent));
});

test('buildEnemyPerceptionSnapshot converts live hand state into fuzzy intent bands', () => {
  const state = makeState();
  const enemyDef = {
    id: 'test_enemy',
    keywords: ['elite'],
    intent_policy: [],
  };

  const perception = buildEnemyPerceptionSnapshot(state, enemyDef, state.combat!.enemies[0]);

  assert.equal(perception.attackIntentBand, 'high');
  assert.equal(perception.comboThreatBand, 'high');
  assert.equal(perception.playerHpBand, 'pressured');
  assert.ok(perception.perceptionAccuracy >= 0.6);
});

test('cooldownsReducer decays previous cooldowns and records the used intent', () => {
  const next = cooldownsReducer({ Guard: 2, Strike: 1 }, 'Strike');

  assert.deepEqual(next, {
    Guard: 1,
    Strike: 1,
  });
});

test('lagavulin sample allocates enough control weight that a high roll resolves to siphon under attack-heavy pressure', () => {
  const state = makeState();
  state.combat!.player.hp = 16;
  state.combat!.player.maxHp = 20;
  state.combat!.player.block = 2;
  state.combat!.enemies[0].defId = 'lagavulin';
  state.combat!.enemies[0].name = 'Lagavulin';
  const lagavulin = enemiesData.find((enemy) => enemy.id === 'lagavulin');

  assert.ok(lagavulin);
  const intent = selectEnemyIntentForCombat(state, lagavulin, state.combat!.enemies[0], 1, () => 0.8, {});
  assert.equal(intent, 'siphon');
});

test('lagavulin sample prefers attack when player enters kill range', () => {
  const state = makeState();
  state.combat!.player.hp = 4;
  state.combat!.player.maxHp = 20;
  state.combat!.player.block = 0;
  state.combat!.enemies[0].defId = 'lagavulin';
  state.combat!.enemies[0].name = 'Lagavulin';
  const lagavulin = enemiesData.find((enemy) => enemy.id === 'lagavulin');

  assert.ok(lagavulin);
  const intent = selectEnemyIntentForCombat(state, lagavulin, state.combat!.enemies[0], 1, () => 0.1, {});
  assert.equal(intent, 'attack');
});

test('lagavulin anti-stall forces attack after one non-attack streak', () => {
  const state = makeState();
  state.combat!.player.hp = 16;
  state.combat!.player.maxHp = 20;
  state.combat!.player.block = 1;
  state.combat!.enemies[0].defId = 'lagavulin';
  state.combat!.enemies[0].name = 'Lagavulin';
  state.combat!.enemies[0].lastUsedIntent = 'siphon';
  (state.combat!.enemies[0] as any).nonAttackIntentStreak = 1;
  const lagavulin = enemiesData.find((enemy) => enemy.id === 'lagavulin');

  assert.ok(lagavulin);
  const intent = selectEnemyIntentForCombat(state, lagavulin, state.combat!.enemies[0], 2, () => 0.8, {});
  assert.equal(intent, 'attack');
});

test('gremlin_nob sample keeps an attack-first personality under pressure', () => {
  const state = makeState();
  state.combat!.player.hp = 15;
  state.combat!.player.maxHp = 20;
  state.combat!.player.block = 1;
  state.combat!.enemies[0].defId = 'gremlin_nob';
  state.combat!.enemies[0].name = 'Gremlin Nob';
  const gremlinNob = enemiesData.find((enemy) => enemy.id === 'gremlin_nob');

  assert.ok(gremlinNob);
  const intent = selectEnemyIntentForCombat(state, gremlinNob, state.combat!.enemies[0], 1, () => 0.85, {});
  assert.ok(['rush', 'skull_bash'].includes(intent));
});

test('slime_boss sample leans into prep when perception reads a defensive player', () => {
  const state = makeState();
  state.combat!.player.hp = 16;
  state.combat!.player.maxHp = 20;
  state.combat!.player.block = 18;
  state.combat!.enemies[0].defId = 'slime_boss';
  state.combat!.enemies[0].name = 'Slime Boss';
  const slimeBoss = enemiesData.find((enemy) => enemy.id === 'slime_boss');

  assert.ok(slimeBoss);
  const intent = selectEnemyIntentForCombat(state, slimeBoss, state.combat!.enemies[0], 1, () => 0.8, {});
  assert.equal(intent, 'prep');
});
