/**
 * @file specialActionBehavior.test.ts
 * @description Unit tests for special action behavior and card instance interactions.
 *
 * 主要职责:
 * - 测试特殊动作的行为逻辑
 * - 测试卡牌实例与动作管理器的交互
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { cardsData, getCardDefById } from '@/content/narrative/numericSystem';
import { createRunCardInstance } from '@/core/combat/runCardInstance';
import { ActionManager } from '@/core/actions/actionManager';
import { ActionFactoryV2, setupActionManager } from '@/core/actions/v2/ActionFactory';

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 1,
    character: null,
    player: {
      hp: 40,
      maxHp: 40,
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
        hp: 20,
        maxHp: 20,
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

function makeManager(state: GameState): ActionManager {
  const manager = new ActionManager(state);
  setupActionManager(manager);
  ActionManager.bindInstance(manager);
  return manager;
}

function addEnemy(state: GameState, statuses: Record<string, number> = {}) {
  const enemy = {
    id: 'enemy_1',
    defId: 'training_dummy',
    name: 'Training Dummy',
    hp: 40,
    maxHp: 40,
    block: 0,
    statuses: { ...statuses },
    nextIntent: 'Attack',
  } as NonNullable<GameState['combat']>['enemies'][number];
  state.combat!.enemies = [enemy];
  return enemy;
}

test('ReturnLastCard creates a valid run-card instance and preserves temp cost override', () => {
  const state = makeState();
  const manager = makeManager(state);
  const card = getCardDefById('calculated_strike');
  assert.ok(card);
  state.combat!.player.lastPlayedCard = createRunCardInstance(card!, 'played_card');

  manager.executeImmediate({ type: 'ReturnLastCard', costModifier: 0 }, { source: 'player' });

  const returned = state.combat!.hand[0];
  assert.ok(returned);
  assert.equal(returned.baseCardId, 'calculated_strike');
  assert.ok(Array.isArray(returned.persistentEnchantments));
  assert.ok(Array.isArray(returned.combatAfflictions));
  assert.equal(returned.tempCost, 0);
});

test('MutateCard creates a normalized run-card instance in discard and deck', () => {
  const state = makeState();
  const manager = makeManager(state);
  const sourceCard = getCardDefById('dead_drop');
  assert.ok(sourceCard);

  manager.executeImmediate(
    { type: 'MutateCard', mutateTo: 'paranoia' } as any,
    { source: 'player', card: createRunCardInstance(sourceCard!, 'source_card') }
  );

  const discardCard = state.combat!.discardPile[0];
  const deckCard = state.player.deck[0];
  assert.ok(discardCard);
  assert.ok(deckCard);
  assert.equal(discardCard.baseCardId, 'paranoia');
  assert.equal(deckCard.baseCardId, 'paranoia');
  assert.ok(Array.isArray(discardCard.persistentEnchantments));
  assert.ok(Array.isArray(discardCard.combatAfflictions));
});

test('route resource actions enable evidence draw loops against debuffed targets', () => {
  const state = makeState();
  const manager = makeManager(state);
  addEnemy(state, { Weak: 1 });
  const drawCard = getCardDefById('calculated_strike');
  assert.ok(drawCard);
  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'draw_card'));

  manager.enqueueAll(
    [
      { type: 'GainResource', resource: 'evidence', amount: 1 },
      { type: 'ConditionalDraw', condition: { type: 'TargetHasDebuff' }, amount: 1 },
    ] as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();

  const player = state.player as typeof state.player & { evidence?: number; secondaryResources?: Record<string, number> };
  assert.equal(player.evidence, 1);
  assert.equal(player.secondaryResources?.evidence, 1);
  assert.equal(state.combat!.hand.length, 1);
});

test('resource spend effects consume route resources and apply payoff status', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state);
  const player = state.player as typeof state.player & { rage?: number; secondaryResources?: Record<string, number> };
  player.rage = 1;
  player.secondaryResources = { rage: 1 };

  manager.enqueue(
    {
      type: 'SpendResourceEffect',
      resource: 'rage',
      amount: 1,
      effect: { type: 'ApplyStatus', status: 'Vulnerable', stacks: 1 },
    } as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();

  assert.equal(player.rage, 0);
  assert.equal(player.secondaryResources?.rage, 0);
  assert.equal(enemy.statuses.Vulnerable, 1);
});

test('conditional payoff damage and next-debuff bonuses execute through the queue', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state, { Weak: 1, Vulnerable: 1 });

  manager.enqueue(
    {
      type: 'ConditionalDamage',
      condition: { type: 'TargetHasBothDebuffs', debuffs: ['Weak', 'Vulnerable'] },
      bonus: 12,
      target: 'Enemy',
    } as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();
  assert.ok(enemy.hp <= 28, `expected payoff damage, got enemy hp ${enemy.hp}`);

  enemy.statuses = {};
  manager.enqueueAll(
    [
      { type: 'BonusNextDebuff', status: 'Weak', bonus: 1 },
      { type: 'ApplyStatus', status: 'Weak', amount: 1, target: 'Enemy' },
    ] as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();
  assert.equal(enemy.statuses.Weak, 2);
});

test('puppet summon loops gain thread mastery and summon bonuses', () => {
  const state = makeState();
  const manager = makeManager(state);

  manager.enqueueAll(
    [
      { type: 'ApplyStatus', status: 'ThreadMastery', amount: 1, target: 'Self' },
      { type: 'Summon', id: 'mirror_puppet', attack: 3, hp: 1 },
      { type: 'ConditionalSummonBonus', condition: { type: 'HasResource', resource: 'thread' }, attack: 2 },
    ] as any,
    { source: 'player' }
  );
  manager.executeAllSync();

  assert.equal(state.combat!.player.thread, 1);
  assert.equal(state.combat!.player.constructs.length, 1);
  assert.equal(state.combat!.player.constructs[0].atk, 5);
});

test('all card action specs are registered with the v2 action factory', () => {
  const registered = new Set(ActionFactoryV2.getRegisteredTypes());
  const unknown = new Map<string, string[]>();

  const walk = (actions: any[] | undefined, owner: string) => {
    for (const action of actions || []) {
      if (!registered.has(action.type)) {
        unknown.set(action.type, [...(unknown.get(action.type) || []), owner]);
      }
      walk(action.actions, owner);
      walk(action.trueActions, owner);
      walk(action.falseActions, owner);
      if (action.ifTrue) walk([action.ifTrue], owner);
      if (action.ifFalse) walk([action.ifFalse], owner);
      if (Array.isArray(action.effects)) walk(action.effects, owner);
      if (Array.isArray(action.effect)) walk(action.effect, owner);
      else if (action.effect?.type) walk([action.effect], owner);
    }
  };

  for (const card of cardsData) {
    walk((card as any).actions, card.id);
    walk((card as any).upgrade?.actions, `${card.id}:upgrade`);
  }

  assert.deepEqual([...unknown.entries()], []);
});

test('resource refund enables first spend loop without losing the payoff', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state);
  const player = state.player as typeof state.player & { evidence?: number; secondaryResources?: Record<string, number> };
  player.evidence = 1;
  player.secondaryResources = { evidence: 1 };

  manager.enqueueAll(
    [
      { type: 'ResourceRefund', amount: 1, target: 'Self' },
      { type: 'SpendResourceEffect', resource: 'evidence', amount: 1, effect: { type: 'ApplyStatus', status: 'Weak', amount: 1 } },
    ] as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();

  assert.equal(player.evidence, 1);
  assert.equal(player.secondaryResources?.evidence, 1);
  assert.equal(enemy.statuses.Weak, 1);
});

test('cleanup and poison trigger actions remove debuffs and convert poison to damage', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state, { Poison: 4, Strength: 3, Ritual: 2 });
  state.combat!.player.statuses = { Weak: 2, Vulnerable: 1 };

  manager.enqueueAll(
    [
      { type: 'RemoveStatus', status: ['Strength', 'Ritual'], amount: 2, target: 'Enemy' },
      { type: 'RemoveAnyDebuff', amount: 1, target: 'Self' },
      { type: 'TriggerPoisonAllEnemies' },
    ] as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();

  assert.equal(enemy.statuses.Strength, 1);
  assert.equal(enemy.statuses.Ritual, 2);
  assert.equal(state.combat!.player.statuses.Weak, 1);
  assert.equal(enemy.statuses.Poison, undefined);
  assert.equal(enemy.hp, 36);
});

test('cost and delayed loop actions attach visible runtime state', () => {
  const state = makeState();
  const manager = makeManager(state);
  const attack = getCardDefById('calculated_strike');
  assert.ok(attack);
  state.combat!.hand.push(createRunCardInstance(attack!, 'attack_in_hand'));

  manager.enqueueAll(
    [
      { type: 'NextAttackCostDown', amount: 1 },
      { type: 'DelayedEnergy', amount: 1 },
      { type: 'EndOfTurnDrawPenalty', amount: 1 },
      { type: 'DelayNextCardEffect', percent: 50 },
      { type: 'MultiplyDamage', amount: 2 },
    ] as any,
    { source: 'player' }
  );
  manager.executeAllSync();

  assert.equal(state.combat!.hand[0].cost, Math.max(0, attack!.cost - 1));
  assert.equal(state.combat!.player.statuses.DelayedEnergy, 1);
  assert.equal(state.combat!.player.statuses.DrawPenaltyNextTurn, 1);
  assert.equal(state.combat!.player.statuses.DelayNextCardEffectPercent, 50);
  assert.equal(state.combat!.player.statuses.DoubleDamageThisTurn, 2);
});
