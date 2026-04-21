import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { getCardDefById } from '@/content/narrative/numericSystem';
import { createRunCardInstance } from '@/core/combat/runCardInstance';
import { ActionManager } from '@/core/actions/actionManager';
import { setupActionManager } from '@/core/actions/v2/ActionFactory';

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
  return manager;
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
