/**
 * @file actionManagerAndRoomFlow.test.ts
 * @description Unit tests for action manager and room flow interactions.
 *
 * 主要职责:
 * - 测试 ActionManager 的创建与获取
 * - 测试房间流程中的动作管理
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ActionManager, createActionManager, getActionManager } from '@/core/actions/actionManager';
import { GameEngine } from '@/core/events/gameEngine';

function createMinimalState() {
  return {
    seed: 1,
    rngState: 1,
    character: null,
    player: {
      hp: 10,
      maxHp: 10,
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
      runEffects: {},
    },
    combat: null,
    map: [],
    currentNodeId: null,
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Map',
    pendingNodeResolution: false,
    campfireChoiceLocked: false,
    metaRuntime: {
      unlockedPoolIds: [],
      appliedUpgradeIds: [],
      appliedPactIds: [],
    },
  } as any;
}

test.afterEach(() => {
  ActionManager.resetInstance();
});

test('createActionManager binds the global singleton used by runtime consumers', () => {
  const manager = createActionManager(createMinimalState());
  assert.equal(getActionManager(), manager);
});

test('skipReward clears room token and returns to map without illegal transition noise', () => {
  const engine = new GameEngine(4321, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.map = [{ id: 'combat-node', type: 'Combat', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'combat-node';
  engine.state.pendingNodeResolution = true;
  (engine.state as any).roomResolutionToken = 'room_reward_token';
  engine.state.screen = 'Reward';
  engine.state.rewardCards = engine.generateCardRewards(3);

  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    engine.skipReward();
  } finally {
    console.error = originalError;
    engine.dispose();
  }

  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal((engine.state as any).roomResolutionToken, null);
  assert.equal(errors.some((entry) => entry.includes('Illegal run transition')), false);
});

test('event resolution leaves the room without illegal transition noise when a room token exists', () => {
  const engine = new GameEngine(2468, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.map = [{ id: 'event-node', type: 'Event', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'event-node';
  engine.state.pendingNodeResolution = true;
  (engine.state as any).roomResolutionToken = 'room_event_token';
  engine.state.activeEvent = { id: 'rusting_medicae', data: {} };
  engine.state.screen = 'Event';

  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    engine.resolveEventChoice('medicae_extract');
  } finally {
    console.error = originalError;
    engine.dispose();
  }

  assert.equal(engine.state.screen, 'Map');
  assert.equal(engine.state.pendingNodeResolution, false);
  assert.equal((engine.state as any).roomResolutionToken, null);
  assert.equal(errors.some((entry) => entry.includes('Illegal run transition')), false);
});

test('restDisperse enters remove-card mode instead of leaving the room immediately', () => {
  const engine = new GameEngine(1357, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.map = [{ id: 'rest-node', type: 'Rest', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'rest-node';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'rest_room_token';
  engine.state.screen = 'Rest';
  engine.state.player.relics.push('mark_of_chaos');
  engine.state.player.relicStates['mark_of_chaos'] = { level: 1, progress: 0, corrupted: true };

  engine.restDisperse();

  assert.equal(engine.state.screen, 'RemoveCard');
  assert.equal(engine.state.pendingNodeResolution, true);
  assert.equal((engine.state as any).roomResolutionToken, 'rest_room_token');
  engine.dispose();
});

test('handleCombatVictory preserves room contract metadata through reward transition', () => {
  const engine = new GameEngine(9753, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.map = [{ id: 'combat-node', type: 'Combat', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'combat-node';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'room_combat_token';
  engine.state.roomResolutionKind = 'combat';
  engine.state.screen = 'Combat';
  engine.state.combat = {
    player: {
      hp: 10,
      maxHp: 10,
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
  } as any;

  try {
    (engine as any).handleCombatVictory();

    assert.equal(engine.state.screen, 'Reward');
    assert.equal(engine.state.pendingNodeResolution, true);
    assert.equal(engine.state.roomResolutionToken, 'room_combat_token');
    assert.equal(engine.state.roomResolutionKind, 'reward');
    assert.ok(engine.state.rewardCards.length > 0);

    engine.skipReward();

    assert.equal(engine.state.screen, 'Map');
    assert.equal(engine.state.pendingNodeResolution, false);
    assert.equal(engine.state.roomResolutionToken, null);
    assert.equal(engine.state.roomResolutionKind, null);
  } finally {
    engine.dispose();
  }
});

test('duplicate combat victory signals are ignored after reward transition', () => {
  const engine = new GameEngine(8642, null, { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  engine.state.map = [{ id: 'combat-node', type: 'Combat', revealed: true, next: [], x: 0, y: 0 }];
  engine.state.currentNodeId = 'combat-node';
  engine.state.pendingNodeResolution = true;
  engine.state.roomResolutionToken = 'room_combat_token';
  engine.state.roomResolutionKind = 'combat';
  engine.state.screen = 'Combat';
  engine.state.combat = {
    player: {
      hp: 10,
      maxHp: 10,
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
  } as any;

  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    (engine as any).handleCombatVictory();
    (engine as any).handleCombatVictory();
    (engine as any).runFlowManager.applyRunTransition({ type: 'COMBAT_WON' });

    assert.equal(engine.state.screen, 'Reward');
    assert.equal(engine.state.pendingNodeResolution, true);
    assert.equal(engine.state.roomResolutionToken, 'room_combat_token');
    assert.equal(errors.some((entry) => entry.includes('Illegal run transition')), false);
  } finally {
    console.error = originalError;
    engine.dispose();
  }
});
