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
import { cardsData, getCardDefById, getRelicDefById, relicsData } from '@/content/narrative/numericSystem';
import { createRunCardInstance } from '@/core/combat/runCardInstance';
import { ActionManager } from '@/core/actions/actionManager';
import { ActionFactoryV2, setupActionManager } from '@/core/actions/v2/ActionFactory';
import { GameEngine } from '@/core/events/gameEngine';
import { globalEventBus } from '@/core/events/eventBus';
import { RelicSystem, relicSystem } from '@/features/relics/relicSystem';

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

function withTemporaryRelicDefs<T>(defs: any[], run: () => T): T {
  const data = relicsData as any[];
  const originalLength = data.length;
  data.push(...defs);
  try {
    return run();
  } finally {
    data.splice(originalLength);
  }
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

test('new secondary resources share route resource gain and spend storage', () => {
  const state = makeState();
  const manager = makeManager(state);
  const player = state.player as typeof state.player & {
    verdict?: number;
    seal?: number;
    secondaryResources?: Record<string, number>;
  };
  player.seal = 2;
  player.secondaryResources = { seal: 2 };

  manager.enqueueAll(
    [
      { type: 'GainResource', resource: 'verdict', amount: 2 },
      {
        type: 'SpendResourceEffect',
        resource: 'seal',
        amount: 1,
        effect: { type: 'GainBlock', amount: 3, target: 'Self' },
      },
    ] as any,
    { source: 'player', targetId: 'player' }
  );
  manager.executeAllSync();

  assert.equal(player.verdict, 2);
  assert.equal(player.secondaryResources?.verdict, 2);
  assert.equal(player.seal, 1);
  assert.equal(player.secondaryResources?.seal, 1);
  assert.equal(state.combat!.player.block, 3);
});

test('legacy relic utility actions draw, heal, and fractured hourglass gains conditional energy', () => {
  const state = makeState();
  const manager = makeManager(state);
  const drawCard = getCardDefById('calculated_strike');
  const hourglass = getRelicDefById('fractured_hourglass');
  assert.ok(drawCard);
  assert.ok(hourglass);
  assert.equal(hourglass!.effect?.type, 'ConditionalEnergyGain');
  assert.equal(hourglass!.effect?.condition?.type, 'ResourceAmount');
  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'draw_heal_card'));
  state.combat!.player.hp = 10;
  state.player.relics = ['fractured_hourglass'];
  const player = state.player as typeof state.player & { command?: number; secondaryResources?: Record<string, number> };
  player.command = 1;
  player.secondaryResources = { command: 1 };

  manager.enqueueAll(
    [
      { type: 'DrawAndHeal', drawAmount: 1, healAmount: 3, target: 'Self' },
    ] as any,
    { source: 'player', targetId: 'player' }
  );
  relicSystem.trigger('StartTurn', state, (actionOrSpec: any, ctx: any) => manager.enqueueUrgent(actionOrSpec, ctx, 'relic'), {
    playerTurn: true,
  });
  manager.executeAllSync();

  assert.equal(state.combat!.hand.length, 1);
  assert.equal(state.combat!.player.hp, 13);
  assert.equal(state.combat!.player.energy, 4);

  player.command = 0;
  player.secondaryResources.command = 0;
  state.combat!.player.energy = 3;
  relicSystem.trigger('StartTurn', state, (actionOrSpec: any, ctx: any) => manager.enqueueUrgent(actionOrSpec, ctx, 'relic'), {
    playerTurn: true,
  });
  manager.executeAllSync();

  assert.equal(state.combat!.player.energy, 3);
});

test('route resource relic events resolve against the active game state', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state);
  const player = state.player as typeof state.player & {
    verdict?: number;
    secondaryResources?: Record<string, number>;
  };
  player.relics = ['nullglass_lens', 'blackened_gavel'];
  player.verdict = 1;
  player.secondaryResources = { verdict: 1 };
  relicSystem.bindStateTracker(() => state);

  manager.enqueueAll(
    [
      { type: 'GainResource', resource: 'seal', amount: 1 },
      {
        type: 'SpendResourceEffect',
        resource: 'verdict',
        amount: 1,
        effect: { type: 'GainBlock', amount: 1, target: 'Self' },
      },
    ] as any,
    { source: 'player', targetId: enemy.id }
  );
  manager.executeAllSync();

  assert.equal(state.combat!.player.block, 3);
  assert.equal(enemy.hp, 37);
});

test('card-played relic events flush queued effects immediately', () => {
  const state = makeState();
  makeManager(state);
  state.player.relics = ['confessor_sigil'];
  relicSystem.bindStateTracker(() => state);

  globalEventBus.publish({ type: 'CardPlayed', cardId: 'edict_mark', cardType: 'Skill' } as any);

  assert.equal(state.combat!.player.block, 2);
});

test('JSON-defined relic events resolve on the event-bus path', () => {
  withTemporaryRelicDefs([
    {
      id: 'json_card_play_block',
      name: 'JSON Card Play Block',
      description: 'Gain block on card played.',
      price: 1,
      trigger: 'CardPlayed',
      tags: [],
      effect: { type: 'GainBlock', amount: 5, target: 'Self' },
    },
  ], () => {
    const state = makeState();
    makeManager(state);
    state.player.relics = ['json_card_play_block'];
    relicSystem.bindStateTracker(() => state);

    globalEventBus.publish({ type: 'CardPlayed', cardId: 'calculated_strike', cardType: 'Attack' } as any);

    assert.equal(state.combat!.player.block, 5);
  });
});

test('JSON-defined card-played wrappers trigger only on their configured card count', () => {
  const state = makeState();
  makeManager(state);
  state.player.relics = ['echo_buckle'];
  relicSystem.bindStateTracker(() => state);

  state.combat!.player.cardsPlayedThisTurn = 4;
  globalEventBus.publish({ type: 'CardPlayed', cardId: 'calculated_strike', cardType: 'Attack' } as any);
  assert.equal(state.combat!.player.block, 4);

  state.combat!.player.cardsPlayedThisTurn = 5;
  globalEventBus.publish({ type: 'CardPlayed', cardId: 'calculated_strike', cardType: 'Attack' } as any);
  assert.equal(state.combat!.player.block, 4);
});

test('JSON-defined RelicAcquired effects trigger only for the acquired relic itself', () => {
  withTemporaryRelicDefs([
    {
      id: 'json_acquired_block',
      name: 'JSON Acquired Block',
      description: 'Gain block when this relic is acquired.',
      price: 1,
      trigger: 'RelicAcquired',
      tags: [],
      effect: { type: 'GainBlock', amount: 7, target: 'Self' },
    },
    {
      id: 'json_other_pickup',
      name: 'JSON Other Pickup',
      description: 'Passive fixture relic.',
      price: 1,
      trigger: 'Passive',
      tags: [],
      effect: { type: 'Passive' },
    },
  ], () => {
    const state = makeState();
    makeManager(state);
    state.player.relics = ['json_acquired_block'];
    relicSystem.bindStateTracker(() => state);

    globalEventBus.publish({ type: 'RelicAcquired', relicId: 'json_other_pickup' } as any);
    assert.equal(state.combat!.player.block, 0);

    globalEventBus.publish({ type: 'RelicAcquired', relicId: 'json_acquired_block' } as any);
    assert.equal(state.combat!.player.block, 7);
  });
});

test('relic event ordering uses data priority instead of pickup order', () => {
  withTemporaryRelicDefs([
    {
      id: 'priority_late_relic',
      name: 'Priority Late Relic',
      description: 'Runs after the higher priority relic.',
      price: 1,
      trigger: 'CardPlayed',
      tags: [],
      priority: 0,
      effect: { type: 'Passive' },
    },
    {
      id: 'priority_early_relic',
      name: 'Priority Early Relic',
      description: 'Runs before the lower priority relic.',
      price: 1,
      trigger: 'CardPlayed',
      tags: [],
      priority: 10,
      effect: { type: 'Passive' },
    },
  ], () => {
    const state = makeState();
    makeManager(state);
    state.player.relics = ['priority_late_relic', 'priority_early_relic'];
    relicSystem.bindStateTracker(() => state);

    const order: string[] = [];
    const effectMap = (relicSystem as any).relicEffects as Map<string, any[]>;
    const previousLate = effectMap.get('priority_late_relic');
    const previousEarly = effectMap.get('priority_early_relic');
    effectMap.set('priority_late_relic', [{ trigger: 'CardPlayed', action: () => order.push('late') }]);
    effectMap.set('priority_early_relic', [{ trigger: 'CardPlayed', action: () => order.push('early') }]);
    try {
      globalEventBus.publish({ type: 'CardPlayed', cardId: 'calculated_strike', cardType: 'Attack' } as any);
    } finally {
      if (previousLate) effectMap.set('priority_late_relic', previousLate);
      else effectMap.delete('priority_late_relic');
      if (previousEarly) effectMap.set('priority_early_relic', previousEarly);
      else effectMap.delete('priority_early_relic');
    }

    assert.deepEqual(order, ['early', 'late']);
  });
});

test('relic event dispatch isolates a throwing relic effect and still runs later relics', () => {
  withTemporaryRelicDefs([
    {
      id: 'throwing_relic',
      name: 'Throwing Relic',
      description: 'Throws during event dispatch.',
      price: 1,
      trigger: 'CardPlayed',
      tags: [],
      priority: 10,
      effect: { type: 'Passive' },
    },
    {
      id: 'resilient_relic',
      name: 'Resilient Relic',
      description: 'Runs after the throwing relic.',
      price: 1,
      trigger: 'CardPlayed',
      tags: [],
      priority: 0,
      effect: { type: 'Passive' },
    },
  ], () => {
    const state = makeState();
    makeManager(state);
    state.player.relics = ['throwing_relic', 'resilient_relic'];
    relicSystem.bindStateTracker(() => state);

    const effectMap = (relicSystem as any).relicEffects as Map<string, any[]>;
    const previousThrowing = effectMap.get('throwing_relic');
    const previousResilient = effectMap.get('resilient_relic');
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    };
    effectMap.set('throwing_relic', [{
      trigger: 'CardPlayed',
      action: () => {
        throw new Error('fixture relic failure');
      },
    }]);
    effectMap.set('resilient_relic', [{
      trigger: 'CardPlayed',
      action: (_state: GameState, _event: any, enqueueUrgent: any) => {
        enqueueUrgent(ActionFactoryV2.createAction({ type: 'GainBlock', amount: 4, target: 'Self' }), {
          source: 'relic_resilient_relic',
        });
      },
    }]);
    try {
      globalEventBus.publish({ type: 'CardPlayed', cardId: 'calculated_strike', cardType: 'Attack' } as any);
    } finally {
      console.error = originalError;
      if (previousThrowing) effectMap.set('throwing_relic', previousThrowing);
      else effectMap.delete('throwing_relic');
      if (previousResilient) effectMap.set('resilient_relic', previousResilient);
      else effectMap.delete('resilient_relic');
    }

    assert.equal(state.combat!.player.block, 4);
    assert.ok(errors.some((entry) => entry.includes('fixture relic failure')));
  });
});

test('RelicSystem constructor is lazy until a state tracker is bound', () => {
  const state = makeState();
  makeManager(state);
  state.player.relics = ['confessor_sigil'];
  globalEventBus.clear();

  const lazySystem = new RelicSystem(() => state);
  const listeners = (globalEventBus as any).listeners as Map<string, unknown[]>;
  assert.equal((listeners.get('CardPlayed') || []).length, 0);

  globalEventBus.publish({ type: 'CardPlayed', cardId: 'edict_mark', cardType: 'Skill' } as any);
  assert.equal(state.combat!.player.block, 0);

  lazySystem.bindStateTracker(() => state);
  assert.ok((listeners.get('CardPlayed') || []).length > 0);

  globalEventBus.publish({ type: 'CardPlayed', cardId: 'edict_mark', cardType: 'Skill' } as any);
  assert.equal(state.combat!.player.block, 2);

  lazySystem.dispose();
});

test('exported relicSystem singleton is lazy until a state tracker is bound', () => {
  const state = makeState();
  makeManager(state);
  state.player.relics = ['confessor_sigil'];
  globalEventBus.clear();

  const listeners = (globalEventBus as any).listeners as Map<string, unknown[]>;
  assert.equal((listeners.get('CardPlayed') || []).length, 0);

  globalEventBus.publish({ type: 'CardPlayed', cardId: 'edict_mark', cardType: 'Skill' } as any);
  assert.equal(state.combat!.player.block, 0);

  relicSystem.bindStateTracker(() => state);
  assert.ok((listeners.get('CardPlayed') || []).length > 0);

  globalEventBus.publish({ type: 'CardPlayed', cardId: 'edict_mark', cardType: 'Skill' } as any);
  assert.equal(state.combat!.player.block, 2);

  relicSystem.dispose();
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

test('kill conditions can inspect the just defeated target', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state);
  enemy.hp = 5;

  manager.enqueueAll(
    [
      { type: 'DealDamage', amount: 10, target: 'Enemy' },
      { type: 'ConditionalResourceGain', condition: { type: 'Kill' }, resource: 'evidence', amount: 1 },
    ] as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();

  const player = state.player as typeof state.player & { evidence?: number; secondaryResources?: Record<string, number> };
  assert.equal(enemy.hp, 0);
  assert.equal(player.evidence, 1);
  assert.equal(player.secondaryResources?.evidence, 1);
});

test('kill conditions do not trigger when the target survives', () => {
  const state = makeState();
  const manager = makeManager(state);
  const enemy = addEnemy(state);
  enemy.hp = 20;

  manager.enqueueAll(
    [
      { type: 'DealDamage', amount: 5, target: 'Enemy' },
      { type: 'ConditionalResourceGain', condition: { type: 'Kill' }, resource: 'evidence', amount: 1 },
    ] as any,
    { source: 'player', targetId: 'enemy_1' }
  );
  manager.executeAllSync();

  const player = state.player as typeof state.player & { evidence?: number; secondaryResources?: Record<string, number> };
  assert.equal(enemy.hp, 15);
  assert.equal(player.evidence, undefined);
  assert.equal(player.secondaryResources?.evidence, undefined);
});

test('NoAttackYet checks attacks rather than all cards played this turn', () => {
  const state = makeState();
  const manager = makeManager(state);
  const drawCard = getCardDefById('calculated_strike');
  assert.ok(drawCard);
  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'draw_card'));
  state.combat!.player.cardsPlayedThisTurn = 1;
  state.combat!.player.attacksPlayedThisTurn = 0;

  manager.enqueue(
    { type: 'ConditionalDraw', condition: { type: 'NoAttackYet' }, amount: 1 } as any,
    { source: 'player', card: { type: 'Skill' } }
  );
  manager.executeAllSync();
  assert.equal(state.combat!.hand.length, 1);

  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'draw_card_2'));
  state.combat!.player.attacksPlayedThisTurn = 1;
  manager.enqueue(
    { type: 'ConditionalDraw', condition: { type: 'NoAttackYet' }, amount: 1 } as any,
    { source: 'player', card: { type: 'Skill' } }
  );
  manager.executeAllSync();
  assert.equal(state.combat!.hand.length, 1);
});

test('NoAttackYet allows the first attack action but not later attack actions', () => {
  const state = makeState();
  const manager = makeManager(state);
  const drawCard = getCardDefById('calculated_strike');
  assert.ok(drawCard);
  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'draw_card'));
  state.combat!.player.attacksPlayedThisTurn = 1;

  manager.enqueue(
    { type: 'ConditionalDraw', condition: { type: 'NoAttackYet' }, amount: 1 } as any,
    { source: 'player', card: { type: 'Attack' } }
  );
  manager.executeAllSync();
  assert.equal(state.combat!.hand.length, 1);

  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'draw_card_2'));
  state.combat!.player.attacksPlayedThisTurn = 2;
  manager.enqueue(
    { type: 'ConditionalDraw', condition: { type: 'NoAttackYet' }, amount: 1 } as any,
    { source: 'player', card: { type: 'Attack' } }
  );
  manager.executeAllSync();
  assert.equal(state.combat!.hand.length, 1);
});

test('command line adjustment branch draws once without leaving a cost discount', () => {
  const state = makeState();
  const manager = makeManager(state);
  const drawCard = getCardDefById('calculated_strike');
  assert.ok(drawCard);
  state.combat!.drawPile.push(
    createRunCardInstance(drawCard!, 'draw_card_1'),
    createRunCardInstance(drawCard!, 'draw_card_2')
  );
  const player = state.player as typeof state.player & { command?: number; secondaryResources?: Record<string, number> };
  player.command = 1;
  player.secondaryResources = { command: 1 };

  manager.enqueueAll(
    [
      {
        type: 'ConditionalEffect',
        condition: { type: 'NoResource', resource: 'command' },
        effects: [{ type: 'NextCardCostDown', amount: 1 }],
      },
      { type: 'ConditionalDraw', condition: { type: 'HasResource', resource: 'command' }, amount: 1 },
    ] as any,
    { source: 'player' }
  );
  manager.executeAllSync();

  assert.equal(state.combat!.hand.length, 1);
  assert.equal(state.combat!.drawPile.length, 1);
  assert.equal(state.combat!.player.statuses.NextCardCostDown, undefined);
});

test('next-card cost reduction remains a pure cost action when command exists', () => {
  const state = makeState();
  const manager = makeManager(state);
  const defend = getCardDefById('defend');
  assert.ok(defend);
  state.combat!.hand.push(createRunCardInstance(defend!, 'defend_in_hand'));
  const player = state.player as typeof state.player & { command?: number; secondaryResources?: Record<string, number> };
  player.command = 1;
  player.secondaryResources = { command: 1 };

  manager.enqueue({ type: 'NextCardCostDown', amount: 1 } as any, { source: 'player' });
  manager.executeAllSync();

  assert.equal(state.combat!.hand[0].tempCost, 0);
  assert.equal(state.combat!.player.statuses.NextCardCostDown, undefined);
});

test('pending next-card cost discount is consumed by one actual card play', async () => {
  const engine = new GameEngine(406, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const power = getCardDefById('palace_signal');
  const defend = getCardDefById('defend');
  assert.ok(power);
  assert.ok(defend);
  addEnemy(state);
  state.combat!.hand = [
    createRunCardInstance(power!, 'discounted_power'),
    createRunCardInstance(defend!, 'normal_defend'),
  ];
  state.combat!.player.statuses.NextCardCostDown = 1;
  state.combat!.player.energy = 3;
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('discounted_power');
  assert.equal(state.combat!.player.energy, 2);
  assert.equal(state.combat!.player.statuses.NextCardCostDown, undefined);

  await engine.playCard('normal_defend');
  assert.equal(state.combat!.player.energy, 1);
  engine.dispose();
});

test('stored start-of-turn effects fire from their runtime trigger', async () => {
  const engine = new GameEngine(407, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const power = getCardDefById('palace_signal');
  const zeroCostCard = getCardDefById('briefing_order');
  assert.ok(power);
  assert.ok(zeroCostCard);
  addEnemy(state);
  state.combat!.hand = [createRunCardInstance(power!, 'palace_signal_in_hand')];
  state.combat!.drawPile = [createRunCardInstance(zeroCostCard!, 'zero_cost_draw')];
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('palace_signal_in_hand');
  assert.equal(state.combat!.player.statuses['Watcher:DrawZeroCostCard'], 1);

  state.combat!.turn = 2;
  state.combat!.player.block = 0;
  engine.startTurn();

  assert.equal(state.combat!.player.block, 3);
  engine.dispose();
});

test('stored draw watchers fire when Draw actions draw zero-cost cards', async () => {
  const engine = new GameEngine(409, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const power = getCardDefById('palace_signal');
  const zeroCostCard = getCardDefById('briefing_order');
  assert.ok(power);
  assert.ok(zeroCostCard);
  addEnemy(state);
  state.combat!.hand = [createRunCardInstance(power!, 'palace_signal_in_hand')];
  state.combat!.drawPile = [createRunCardInstance(zeroCostCard!, 'zero_cost_draw')];
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('palace_signal_in_hand');
  state.combat!.player.block = 0;

  (engine as any).actionManager.enqueue({ type: 'Draw', amount: 1 }, { source: 'player' });
  (engine as any).actionManager.executeAll();

  assert.equal(state.combat!.hand.length, 1);
  assert.equal(state.combat!.player.block, 3);
  engine.dispose();
});

test('stored draw watchers ignore non-zero-cost drawn cards', async () => {
  const engine = new GameEngine(410, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const power = getCardDefById('palace_signal');
  const oneCostCard = getCardDefById('calculated_strike');
  assert.ok(power);
  assert.ok(oneCostCard);
  addEnemy(state);
  state.combat!.hand = [createRunCardInstance(power!, 'palace_signal_in_hand')];
  state.combat!.drawPile = [createRunCardInstance(oneCostCard!, 'one_cost_draw')];
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('palace_signal_in_hand');
  state.combat!.player.block = 0;

  (engine as any).actionManager.enqueue({ type: 'Draw', amount: 1 }, { source: 'player' });
  (engine as any).actionManager.executeAll();

  assert.equal(state.combat!.hand.length, 1);
  assert.equal(state.combat!.player.block, 0);
  engine.dispose();
});

test('stored draw watchers trigger once per turn', async () => {
  const engine = new GameEngine(411, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const power = getCardDefById('palace_signal');
  const zeroCostCard = getCardDefById('briefing_order');
  assert.ok(power);
  assert.ok(zeroCostCard);
  addEnemy(state);
  state.combat!.hand = [createRunCardInstance(power!, 'palace_signal_in_hand')];
  state.combat!.drawPile = [
    createRunCardInstance(zeroCostCard!, 'zero_cost_draw_1'),
    createRunCardInstance(zeroCostCard!, 'zero_cost_draw_2'),
  ];
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('palace_signal_in_hand');
  state.combat!.player.block = 0;

  (engine as any).actionManager.enqueue({ type: 'Draw', amount: 1 }, { source: 'player' });
  (engine as any).actionManager.executeAll();
  (engine as any).actionManager.enqueue({ type: 'Draw', amount: 1 }, { source: 'player' });
  (engine as any).actionManager.executeAll();

  assert.equal(state.combat!.hand.length, 2);
  assert.equal(state.combat!.player.block, 3);
  engine.dispose();
});

test('stored resource gain watchers fire from specialized resource actions', () => {
  const engine = new GameEngine(413, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.player.hp = 10;
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  (engine as any).actionManager.enqueueAll(
    [
      {
        type: 'StartOfTurnEffect',
        trigger: { type: 'GainResource', resource: 'concoction', amount: 2 },
        effect: { type: 'Heal', amount: 2, target: 'Self' },
      },
      { type: 'GainConcoction', amount: 2 },
    ] as any,
    { source: 'player' }
  );
  (engine as any).actionManager.executeAll();

  assert.equal(state.combat!.player.concoction, 2);
  assert.equal(state.combat!.player.hp, 12);
  engine.dispose();
});

test('stored resource spend watchers use the actual spent amount', () => {
  const engine = new GameEngine(414, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const player = state.player as typeof state.player & { command?: number; secondaryResources?: Record<string, number> };
  player.command = 2;
  player.secondaryResources = { command: 2 };
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  (engine as any).actionManager.enqueueAll(
    [
      {
        type: 'StartOfTurnEffect',
        trigger: { type: 'SpendResource', resource: 'command', amount: 2 },
        effect: { type: 'GainBlock', amount: 4, target: 'Self' },
      },
      { type: 'SpendResourceUpTo', resource: 'command', maxAmount: 2 },
    ] as any,
    { source: 'player' }
  );
  (engine as any).actionManager.executeAll();

  assert.equal(player.command, 0);
  assert.equal(state.combat!.player.block, 4);
  engine.dispose();
});

test('combat manager triggers start-turn relic effects in active combat', () => {
  const engine = new GameEngine(415, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.player.relics = ['ruined_reactor'];
  state.player.relicStates = { ruined_reactor: { level: 0, progress: 0, corrupted: true } };
  state.combat!.player.energy = 0;
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  (engine as any).combatManager.startPlayerTurn();

  assert.equal(state.combat!.player.energy, 4);
  assert.equal(state.player.relicStates.ruined_reactor.progress, 1);
  engine.dispose();
});

test('GainedBlockThisTurn ignores carried block and tracks new block gains', () => {
  const state = makeState();
  const manager = makeManager(state);
  const drawCard = getCardDefById('calculated_strike');
  assert.ok(drawCard);
  state.combat!.player.block = 5;
  state.combat!.player.blockGainedThisTurn = 0;
  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'blocked_draw_1'));

  manager.enqueue(
    { type: 'ConditionalDraw', condition: { type: 'GainedBlockThisTurn' }, amount: 1 } as any,
    { source: 'player' }
  );
  manager.executeAllSync();
  assert.equal(state.combat!.hand.length, 0);

  state.combat!.drawPile.push(createRunCardInstance(drawCard!, 'blocked_draw_2'));
  manager.enqueueAll(
    [
      { type: 'GainBlock', amount: 2, target: 'Self' },
      { type: 'ConditionalDraw', condition: { type: 'GainedBlockThisTurn' }, amount: 1 },
    ] as any,
    { source: 'player' }
  );
  manager.executeAllSync();

  assert.equal(state.combat!.player.blockGainedThisTurn, 2);
  assert.equal(state.combat!.hand.length, 1);
});

test('dead enemy targets do not consume targeted cards', async () => {
  const engine = new GameEngine(408, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const attack = getCardDefById('calculated_strike');
  assert.ok(attack);
  const deadEnemy = addEnemy(state);
  deadEnemy.hp = 0;
  state.combat!.enemies.push({
    ...deadEnemy,
    id: 'enemy_2',
    hp: 20,
    maxHp: 20,
  });
  state.combat!.hand = [createRunCardInstance(attack!, 'attack_in_hand')];
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('attack_in_hand', 'enemy_1');

  assert.equal(state.combat!.hand.length, 1);
  assert.equal(state.combat!.discardPile.length, 0);
  assert.equal(state.combat!.player.energy, 3);
  assert.equal(state.combat!.enemies[1].hp, 20);
  engine.dispose();
});

test('dead enemy targets resolve combat when no alive enemies remain', async () => {
  const engine = new GameEngine(412, null, { enableRuntimeDelegation: false });
  const state = makeState();
  const attack = getCardDefById('calculated_strike');
  assert.ok(attack);
  const deadEnemy = addEnemy(state);
  deadEnemy.hp = 0;
  state.screen = 'Combat';
  state.pendingNodeResolution = true;
  state.combat!.hand = [createRunCardInstance(attack!, 'attack_in_hand')];
  (engine as any).state = state;
  (engine as any).actionManager.updateState(state);

  await engine.playCard('attack_in_hand', 'enemy_1');

  assert.equal(engine.state.screen, 'Reward');
  assert.equal(engine.state.combat, null);
  engine.dispose();
});
