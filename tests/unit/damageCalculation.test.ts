import test from 'node:test';
import assert from 'node:assert/strict';

import { combatSystem, DamageContext } from '../../src/core/combat/combatSystem';
import { synergySystem } from '../../src/features/synergies/synergySystem';
import type { GameState } from '../../src/core/types';

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
          hp: 999,
          maxHp: 999,
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

function makeContext(partial: Partial<DamageContext>): DamageContext {
  return {
    amount: 0,
    sourceType: 'enemy',
    sourceId: 'e1',
    targetType: 'player',
    targetId: 'player',
    modifiers: [],
    isTrueDamage: false,
    ignoreBlock: false,
    ...partial
  };
}

test('damage applies status modifiers in deterministic floor-rounded order', () => {
  synergySystem.resetAll();
  const state = makeState();
  state.combat!.enemies[0].statuses = {
    Strength: 2,
    Weak: 1,
    Fear: 1,
    MartyrsVigor: 1
  };
  state.combat!.player.statuses = { Vulnerable: 1 };

  const result = combatSystem.calculateDamage(
    state,
    makeContext({
      amount: 10,
      sourceType: 'enemy',
      sourceId: 'e1',
      targetType: 'player',
      targetId: 'player'
    })
  );

  // 10 +2 =12 -> *0.75=9 -> *0.85=7 -> *1.5=10 -> *2=20
  assert.equal(result, 20);
});

test('player corruption damage bonus is capped and floored consistently', () => {
  synergySystem.resetAll();
  const state = makeState();
  state.player.corruption = 100; // capped at +35%

  const result = combatSystem.calculateDamage(
    state,
    makeContext({
      amount: 10,
      sourceType: 'player',
      sourceId: 'player',
      targetType: 'enemy',
      targetId: 'e1'
    })
  );

  assert.equal(result, 12); // floor(10 * 1.25), capped by current corruption formula
});

test('soft cap applies after multipliers', () => {
  synergySystem.resetAll();
  const state = makeState();

  const result = combatSystem.calculateDamage(
    state,
    makeContext({
      amount: 300,
      sourceType: 'enemy',
      sourceId: 'e1',
      targetType: 'player',
      targetId: 'player'
    })
  );

  // softCap 200 + floor((300 - 200) * 0.5) = 250
  assert.equal(result, 250);
});

test('true damage bypasses status modifiers and soft cap calculation', () => {
  synergySystem.resetAll();
  const state = makeState();
  state.player.corruption = 100;
  state.combat!.player.statuses = { Vulnerable: 5 };

  const result = combatSystem.calculateDamage(
    state,
    makeContext({
      amount: 300,
      sourceType: 'player',
      sourceId: 'player',
      targetType: 'enemy',
      targetId: 'e1',
      isTrueDamage: true
    })
  );

  assert.equal(result, 300);
});

test('applyDamage true damage with ignoreBlock bypasses block and updates HP exactly', () => {
  synergySystem.resetAll();
  const state = makeState();
  state.combat!.enemies[0].block = 50;
  state.combat!.enemies[0].hp = 40;
  state.combat!.enemies[0].maxHp = 40;

  const dealt = combatSystem.applyDamage(
    state,
    makeContext({
      amount: 12,
      sourceType: 'system',
      sourceId: 'test',
      targetType: 'enemy',
      targetId: 'e1',
      isTrueDamage: true,
      ignoreBlock: true
    })
  );

  assert.equal(dealt, 12);
  assert.equal(state.combat!.enemies[0].block, 50);
  assert.equal(state.combat!.enemies[0].hp, 28);
});
