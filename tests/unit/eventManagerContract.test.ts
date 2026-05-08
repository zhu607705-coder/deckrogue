/**
 * @file eventManagerContract.test.ts
 * @description Unit tests for event manager contract and story event interactions.
 *
 * 主要职责:
 * - 测试事件管理器的合约
 * - 测试故事事件的选择与结算
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { getStoryEventOptionPresentation } from '@/content/narrative/numericSystem';

function attachCombat(engine: GameEngine): void {
  engine.state.combat = {
    player: {
      hp: engine.state.player.hp,
      maxHp: engine.state.player.maxHp,
      block: 0,
      energy: engine.state.player.maxEnergy,
      statuses: {},
      delayedCards: [],
      constructs: [],
      elements: [],
      potionToxicity: 0,
      potionsUsedThisTurn: 0,
      cardsPlayedThisTurn: 0,
      damageTakenThisTurn: 0,
      damageTakenLastTurn: 0,
      intel: engine.state.player.intel,
      devotion: engine.state.player.devotion || 0,
      corruptionAxis: engine.state.player.corruption || 0,
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
  };
}

test('rusting medicae extract grants potions without crashing the weighted reward path', () => {
  const engine = new GameEngine(4321, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.metaRuntime = { unlockedPoolIds: ['healing_potion'], appliedUpgradeIds: [], appliedPactIds: [] };
  engine.state.map = [{ id: 'event-node', type: 'Event', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'event-node';
  engine.state.pendingNodeResolution = true;
  engine.state.activeEvent = { id: 'rusting_medicae', data: {} };
  engine.state.screen = 'Event';

  engine.resolveEventChoice('medicae_extract');

  assert.ok(engine.state.player.potions.length >= 1);
  assert.equal(engine.state.screen, 'Map');
  engine.dispose();
});

test('event relic acquisition uses live relic fields for corruption and combat pulse text', () => {
  const engine = new GameEngine(8765, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  attachCombat(engine);
  engine.state.activeEvent = { id: 'mysterious_shrine', offeredRelicId: 'mark_of_entropy' };
  engine.state.screen = 'Event';

  engine.makeEventChoice('accept');

  assert.equal(engine.state.player.relics.includes('mark_of_entropy'), true);
  assert.equal(engine.state.player.relicStates['mark_of_entropy']?.corrupted, true);
  assert.equal(engine.state.combat?.warpPulse?.text.includes('熵变烙印'), true);
  engine.dispose();
});

test('story event presentation exposes adapter-owned decision tags', () => {
  const engine = new GameEngine(1122, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');

    const payoff = getStoryEventOptionPresentation('rusting_medicae', 'medicae_implant', engine.state);
    const pivot = getStoryEventOptionPresentation('rusting_medicae', 'medicae_salvage', engine.state);
    const recovery = getStoryEventOptionPresentation('warp_tear_whispers', 'tear_seal', engine.state);

    assert.ok(payoff?.tags?.some((tag) => tag.id === 'payoff'));
    assert.ok(payoff?.tags?.some((tag) => tag.id === 'burden'));
    assert.ok(pivot?.tags?.some((tag) => tag.id === 'pivot'));
    assert.ok(pivot?.tags?.some((tag) => tag.id === 'debt'));
    assert.ok(recovery?.tags?.some((tag) => tag.id === 'recovery'));
  } finally {
    engine.dispose();
  }
});

test('neutral story event follow-up choices do not inherit route commit tags', () => {
  const engine = new GameEngine(1123, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');

    const followUp = getStoryEventOptionPresentation('rusting_medicae', 'medicae_salvage_flee', engine.state);

    assert.equal(followUp?.tags?.some((tag) => tag.id === 'commit'), false);
    assert.ok(followUp?.tags?.some((tag) => tag.id === 'burden'));
  } finally {
    engine.dispose();
  }
});
