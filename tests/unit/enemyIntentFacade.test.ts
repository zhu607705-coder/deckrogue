/**
 * @file enemyIntentFacade.test.ts
 * @description Unit tests for enemy intent facade and perception snapshot building.
 *
 * 主要职责:
 * - 测试意图感知快照的构建
 * - 测试冷却缩减逻辑
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { enemiesData } from '@/content/narrative/numericSystem';
import { GameEngine } from '@/core/events/gameEngine';
import { buildEnemyPerceptionSnapshot, selectEnemyIntentForCombat } from '@/core/ai';
import { combatMemory } from '@/core/ai/combatMemory';
import { adjustIntentWeightForGroup } from '@/core/ai/groupCoordination';
import { intentSelector } from '@/core/ai/intentSelector';
import { parseIntentPolicyWeight } from '@/core/ai/intentPolicy';
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

function makeTestCard(
  id: string,
  type: 'Attack' | 'Skill',
  cost: number,
  actions: Array<{ type: string; amount?: number }>
) {
  return {
    id,
    name: id.replace(/_/g, ' '),
    type,
    rarity: 'Common',
    cost,
    text: '',
    actions,
    instanceId: `${id}_1`,
    baseCardId: id,
    runtimeBase: {
      id,
      name: id.replace(/_/g, ' '),
      type,
      rarity: 'Common',
      cost,
      text: '',
      actions,
    },
    persistentEnchantments: [],
    combatAfflictions: [],
  } as any;
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

test('intent selector falls back to Attack instead of the first policy when every final weight is zero', () => {
  const state = makeState();
  const intent = intentSelector.selectIntent(
    {
      id: 'zero_weight_enemy',
      keywords: [],
      intent_policy: [
        { intent: 'RareOpener', weight: 0 },
        { intent: 'Attack', weight: 0 },
      ],
    },
    state.combat!.enemies[0],
    state.combat!.player,
    1,
    () => 0.99,
    {},
  );

  assert.equal(intent, 'Attack');
});

test('intent selector consumes legacy camelCase intentPolicy definitions', () => {
  const state = makeState();
  const intent = intentSelector.selectIntent(
    {
      id: 'camel_policy_enemy',
      keywords: [],
      intentPolicy: [
        { intent: 'Guard', weight: 1 },
      ],
    },
    state.combat!.enemies[0],
    state.combat!.player,
    1,
    () => 0.1,
    {},
  );

  assert.equal(intent, 'Guard');
});

test('intent policy weight parser rejects non-number authoring values instead of coercing them', () => {
  assert.equal(parseIntentPolicyWeight(0.5, 'test_enemy', 'Attack'), 0.5);
  assert.equal(parseIntentPolicyWeight(undefined, 'test_enemy', 'Attack'), 1);
  assert.throws(() => parseIntentPolicyWeight('0.5', 'test_enemy', 'Attack'), /number/);
  assert.throws(() => parseIntentPolicyWeight(true, 'test_enemy', 'Attack'), /number/);
  assert.throws(() => parseIntentPolicyWeight(null, 'test_enemy', 'Attack'), /number/);
});

test('intent bias multiplier zero suppresses a matching intent instead of defaulting to one', () => {
  const state = makeState();
  const enemyDef = {
    id: 'zero_bias_enemy',
    name: 'Zero Bias Enemy',
    keywords: [],
    intent_policy: [
      { intent: 'attack', weight: 1 },
      { intent: 'defend', weight: 1 },
    ],
    ai_profile: {
      perceptionAccuracy: 0.95,
      personality: {
        aggression: 0.5,
        defensiveness: 0.5,
        unpredictability: 0.3,
        revengefulness: 0.2,
      },
      intentBiases: [
        { intent: 'attack', multiplier: 0 },
      ],
    },
  };

  const intent = selectEnemyIntentForCombat(state, enemyDef, state.combat!.enemies[0], 1, () => 0.1, {});

  assert.equal(intent, 'defend');
});

test('group coordination preserves explicit zero intent weights', () => {
  const adjusted = adjustIntentWeightForGroup(
    0,
    'special',
    { attackWeight: 0.35, defendWeight: 0.25, debuffWeight: 0.15, buffWeight: 0.1, specialWeight: 0.15 },
    false,
    0,
  );

  assert.equal(adjusted.adjustedWeight, 0);
});

test('authored enemy intent policies keep at least one positive-weight fallback', () => {
  const offenders = enemiesData
    .filter((enemy) => Array.isArray(enemy.intent_policy) && enemy.intent_policy.length > 0)
    .filter((enemy) => !enemy.intent_policy.some((policy) => parseIntentPolicyWeight(policy.weight, enemy.id, policy.intent) > 0))
    .map((enemy) => enemy.id);

  assert.deepEqual(offenders, []);
});

test('starting a new GameEngine run clears combat memory from the previous run', () => {
  combatMemory.clear();
  combatMemory.recordAction({
    turn: 1,
    actor: 'player',
    cardPlayed: 'heavy_strike',
    damageDealt: 20,
    playerHpBefore: 20,
    playerHpAfter: 20,
  });
  assert.equal(combatMemory.analyzePlayerPatterns().aggressivePlaysInLastTurns, 1);

  const engine = new GameEngine(1234, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    assert.equal(combatMemory.analyzePlayerPatterns().aggressivePlaysInLastTurns, 0);
  } finally {
    engine.dispose();
    combatMemory.clear();
  }
});

test('real GameEngine card plays write player combat memory patterns', async () => {
  combatMemory.clear();
  const engine = new GameEngine(200200, null, { enableRuntimeDelegation: false });

  try {
    engine.selectCharacter('informant');
    engine.startCombat('Combat');

    const combat = engine.state.combat;
    assert.ok(combat);
    const enemyId = combat.enemies.find((enemy) => enemy.hp > 0)?.id;
    assert.ok(enemyId);

    const damageCard = combat.hand.find((card) =>
      card.actions.some((action) => action.type === 'DealDamage')
    );
    const blockCard = combat.hand.find((card) =>
      card.actions.some((action) => action.type === 'GainBlock')
    );
    assert.ok(damageCard);
    assert.ok(blockCard);

    await engine.playCard(damageCard.instanceId, enemyId);
    await engine.playCard(blockCard.instanceId);

    const patterns = combatMemory.analyzePlayerPatterns();
    const detailed = combatMemory.getDetailedPlayerPatterns();

    assert.equal(patterns.aggressivePlaysInLastTurns, 1);
    assert.equal(patterns.defensivePlaysInLastTurns, 1);
    assert.equal(patterns.averageCardsPerTurn, 2);
    assert.ok(patterns.averageDamageDealtPerTurn > 0);
    assert.ok(patterns.averageBlockGainedPerTurn > 0);
    assert.equal(detailed.cardUsageFrequency[damageCard.id], 1);
    assert.equal(detailed.cardUsageFrequency[blockCard.id], 1);
  } finally {
    engine.dispose();
    combatMemory.clear();
  }
});

test('buildEnemyPerceptionSnapshot converts live hand state into fuzzy intent bands', () => {
  const state = makeState();
  const enemyDef = {
    id: 'test_enemy',
    keywords: ['elite'],
    intent_policy: [],
    ai_profile: { perceptionAccuracy: 1 },
  };

  const perception = buildEnemyPerceptionSnapshot(state, enemyDef, state.combat!.enemies[0]);

  assert.equal(perception.attackIntentBand, 'high');
  assert.equal(perception.comboThreatBand, 'high');
  assert.equal(perception.playerHpBand, 'pressured');
  assert.ok(perception.perceptionAccuracy >= 0.6);
});

test('buildEnemyPerceptionSnapshot discounts attacks the player cannot pay for this turn', () => {
  const state = makeState();
  state.combat!.player.energy = 1;
  state.combat!.hand = [
    makeTestCard('expensive_burst_a', 'Attack', 3, [{ type: 'DealDamage', amount: 30 }]),
    makeTestCard('expensive_burst_b', 'Attack', 3, [{ type: 'DealDamage', amount: 30 }]),
    makeTestCard('guard_protocol', 'Skill', 1, [{ type: 'GainBlock', amount: 8 }]),
  ];
  const enemyDef = {
    id: 'test_enemy',
    keywords: ['elite'],
    intent_policy: [],
    ai_profile: { perceptionAccuracy: 1 },
  };

  const perception = buildEnemyPerceptionSnapshot(state, enemyDef, state.combat!.enemies[0]);

  assert.equal(perception.attackIntentBand, 'low');
  assert.equal(perception.comboThreatBand, 'none');
  assert.equal(perception.defenseIntentBand, 'medium');
});

test('buildEnemyPerceptionSnapshot promotes cheap lethal hand damage even when attack count is low', () => {
  const state = makeState();
  state.combat!.player.energy = 1;
  state.combat!.enemies[0].hp = 16;
  state.combat!.enemies[0].maxHp = 30;
  state.combat!.hand = [
    makeTestCard('needle_execution', 'Attack', 1, [{ type: 'DealDamage', amount: 18 }]),
    makeTestCard('minor_guard', 'Skill', 1, [{ type: 'GainBlock', amount: 5 }]),
    makeTestCard('minor_guard_two', 'Skill', 1, [{ type: 'GainBlock', amount: 5 }]),
  ];
  const enemyDef = {
    id: 'test_enemy',
    keywords: ['elite'],
    intent_policy: [],
  };

  const perception = buildEnemyPerceptionSnapshot(state, enemyDef, state.combat!.enemies[0]);

  assert.equal(perception.attackIntentBand, 'high');
  assert.equal(perception.comboThreatBand, 'high');
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
  const intent = selectEnemyIntentForCombat(state, lagavulin, state.combat!.enemies[0], 2, () => 0.99, {});
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
