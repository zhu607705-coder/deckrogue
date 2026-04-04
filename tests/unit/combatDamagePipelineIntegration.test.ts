import test from 'node:test';
import assert from 'node:assert/strict';

import type { GameState } from '@/core/types';
import { globalEventBus, type GameEvent } from '@/core/events/eventBus';
import { ActionManager } from '@/core/actions/actionManager';
import { CombatManager } from '@/core/events/CombatManager';
import { BossPhaseManager } from '@/core/combat/BossPhaseManager';
import { GameEngine } from '@/core/events/gameEngine';

type DamageReceivedEvent = Extract<GameEvent, { type: 'DamageReceived' }>;
type DamageDealtEvent = Extract<GameEvent, { type: 'DamageDealt' }>;

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

function makeCombatManager(state: GameState): CombatManager {
  const actionManager = new ActionManager(state);
  const deps = {
    getState: () => state,
    rng: () => 0,
    generateId: () => 'generated-id',
    createRuntimeCard: (card: any) => card,
    shuffleDeck: <T,>(deck: T[]) => deck,
    syncRngState: () => {},
    appendVoxLog: () => {},
    notify: () => {},
    getCurrentFloorNumber: () => 1,
    applyRunTransition: () => {},
    syncPlayerStateFromCombat: () => {},
    clearCombatAfflictionsForRunCards: () => {},
    generateCardRewards: () => [],
    tryDelegatedCompleteCombat: () => false,
    ensureRunEffects: () => ({}),
  };

  return new CombatManager(deps as any, actionManager);
}

function makeBossPhaseManager(state: GameState, voxLog: string[]): BossPhaseManager {
  return new BossPhaseManager({
    getState: () => state,
    rng: () => 0,
    generateId: () => 'boss-generated-id',
    appendVoxLog: (message) => voxLog.push(message),
    notify: () => {},
    applyEnemyHpTuning: (baseHp) => baseHp,
    getCurrentFloorNumber: () => 1,
  });
}

test.afterEach(() => {
  globalEventBus.clear();
  ActionManager.resetInstance();
});

test('construct attacks go through the shared damage pipeline and emit death events', () => {
  const state = makeState();
  state.combat!.player.constructs = [
    { id: 'construct_1', name: 'Servo Skull', hp: 5, maxHp: 5, atk: 9 } as any,
  ];
  state.combat!.enemies = [
    {
      id: 'enemy_1',
      defId: 'test_enemy',
      name: 'Construct Target',
      hp: 5,
      maxHp: 5,
      block: 4,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
  ];

  const manager = makeCombatManager(state);
  const damageEvents: DamageDealtEvent[] = [];
  const deathEvents: GameEvent[] = [];
  const offDamage = globalEventBus.subscribe('DamageDealt', (event) => damageEvents.push(event as DamageDealtEvent));
  const offDeath = globalEventBus.subscribe('EnemyDeath', (event) => deathEvents.push(event));

  try {
    (manager as any).executeConstructAttacks();

    assert.equal(state.combat!.enemies[0].block, 0);
    assert.equal(state.combat!.enemies[0].hp, 0);
    assert.equal(damageEvents.length, 1);
    assert.equal(damageEvents[0].amount, 5);
    assert.equal(deathEvents.length, 1);
    assert.equal((deathEvents[0] as any).enemyId, 'enemy_1');
  } finally {
    offDamage();
    offDeath();
    manager.dispose();
  }
});

test('construct attacks retarget living enemies after a kill', () => {
  const state = makeState();
  state.combat!.player.constructs = [
    { id: 'construct_1', name: 'Servo Skull A', hp: 5, maxHp: 5, atk: 9 } as any,
    { id: 'construct_2', name: 'Servo Skull B', hp: 5, maxHp: 5, atk: 3 } as any,
  ];
  state.combat!.enemies = [
    {
      id: 'enemy_1',
      defId: 'test_enemy',
      name: 'First Target',
      hp: 5,
      maxHp: 5,
      block: 0,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
    {
      id: 'enemy_2',
      defId: 'test_enemy',
      name: 'Second Target',
      hp: 6,
      maxHp: 6,
      block: 0,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
  ];

  const manager = makeCombatManager(state);

  try {
    (manager as any).executeConstructAttacks();

    assert.equal(state.combat!.enemies[0].hp, 0);
    assert.equal(state.combat!.enemies[1].hp, 3);
  } finally {
    manager.dispose();
  }
});

test('boss phase pulse true damage preserves block and emits canonical player damage events', async () => {
  const state = makeState();
  state.combat!.turn = 2;
  state.combat!.player.hp = 20;
  state.combat!.player.block = 10;
  state.combat!.enemies = [
    {
      id: 'boss_1',
      defId: 'cathedral_engine',
      name: 'Cathedral Engine',
      hp: 60,
      maxHp: 100,
      block: 0,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
  ];
  (state.combat as any).bossPhase = {
    phaseIndex: 1,
    phaseId: 'overheat_mass',
    phaseName: 'Overheat Mass',
    phaseHint: '',
    enteredTurn: 1,
    enemyId: 'boss_1',
    currentPlayerTurnCards: [],
    previousPlayerTurnCards: [],
    flags: {},
    adaptationEnabled: false,
  };

  const voxLog: string[] = [];
  const manager = makeBossPhaseManager(state, voxLog);
  const damageEvents: DamageReceivedEvent[] = [];
  const offDamage = globalEventBus.subscribe('DamageReceived', (event) => damageEvents.push(event as DamageReceivedEvent));

  try {
    await manager.applyBossPhaseEnemyPrelude(state.combat!.enemies[0]);

    assert.equal(state.combat!.player.block, 10);
    assert.equal(state.combat!.player.hp, 14);
    assert.equal(state.combat!.player.statuses.Vulnerable, 1);
    assert.equal(damageEvents.length, 1);
    assert.equal(damageEvents[0].amount, 6);
    assert.ok(voxLog.includes('过热的机械释放灼热冲击，造成直接伤害并施加易伤。'));
  } finally {
    offDamage();
  }
});

test('boss phase echo last player attack uses shared damage pipeline and respects block', async () => {
  const state = makeState();
  state.combat!.turn = 3;
  state.combat!.player.hp = 20;
  state.combat!.player.block = 5;
  state.combat!.enemies = [
    {
      id: 'boss_2',
      defId: 'time_guardian',
      name: 'Time Guardian',
      hp: 40,
      maxHp: 100,
      block: 0,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
  ];
  (state.combat as any).bossPhase = {
    phaseIndex: 1,
    phaseId: 'time_reversal',
    phaseName: 'Time Reversal',
    phaseHint: '',
    enteredTurn: 2,
    enemyId: 'boss_2',
    currentPlayerTurnCards: [],
    previousPlayerTurnCards: [{ damage: 10 }, { damage: 6 }],
    flags: {},
    adaptationEnabled: false,
  };

  const voxLog: string[] = [];
  const manager = makeBossPhaseManager(state, voxLog);
  const damageEvents: DamageReceivedEvent[] = [];
  const offDamage = globalEventBus.subscribe('DamageReceived', (event) => damageEvents.push(event as DamageReceivedEvent));

  try {
    await manager.applyBossPhaseEnemyPrelude(state.combat!.enemies[0]);

    assert.equal(state.combat!.player.block, 0);
    assert.equal(state.combat!.player.hp, 14);
    assert.equal(damageEvents.length, 1);
    assert.equal(damageEvents[0].amount, 6);
    assert.ok(voxLog.includes('Boss 回响造成 6 点伤害！'));
  } finally {
    offDamage();
  }
});

test('boss phase echo clamps scaled damage to configured min and max bounds', async () => {
  const lowState = makeState();
  lowState.combat!.turn = 3;
  lowState.combat!.player.hp = 20;
  lowState.combat!.player.block = 0;
  lowState.combat!.enemies = [
    {
      id: 'boss_low',
      defId: 'time_guardian',
      name: 'Time Guardian',
      hp: 40,
      maxHp: 100,
      block: 0,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
  ];
  (lowState.combat as any).bossPhase = {
    phaseIndex: 1,
    phaseId: 'time_reversal',
    phaseName: 'Time Reversal',
    phaseHint: '',
    enteredTurn: 2,
    enemyId: 'boss_low',
    currentPlayerTurnCards: [],
    previousPlayerTurnCards: [{ damage: 2 }],
    flags: {},
    adaptationEnabled: false,
  };

  const highState = makeState();
  highState.combat!.turn = 3;
  highState.combat!.player.hp = 40;
  highState.combat!.player.block = 0;
  highState.combat!.enemies = [
    {
      id: 'boss_high',
      defId: 'time_guardian',
      name: 'Time Guardian',
      hp: 40,
      maxHp: 100,
      block: 0,
      statuses: {},
      nextIntent: 'Attack',
      lastUsedIntent: '',
      intentCooldowns: {},
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    } as any,
  ];
  (highState.combat as any).bossPhase = {
    phaseIndex: 1,
    phaseId: 'time_reversal',
    phaseName: 'Time Reversal',
    phaseHint: '',
    enteredTurn: 2,
    enemyId: 'boss_high',
    currentPlayerTurnCards: [],
    previousPlayerTurnCards: [{ damage: 50 }],
    flags: {},
    adaptationEnabled: false,
  };

  await makeBossPhaseManager(lowState, []).applyBossPhaseEnemyPrelude(lowState.combat!.enemies[0]);
  await makeBossPhaseManager(highState, []).applyBossPhaseEnemyPrelude(highState.combat!.enemies[0]);

  assert.equal(lowState.combat!.player.hp, 14);
  assert.equal(highState.combat!.player.hp, 20);
});

test('CardPlayed combat log resolves card names from card data', () => {
  const engine = new GameEngine(101, null, { enableRuntimeDelegation: false });

  try {
    engine.state.combat = {
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
    };
    engine.state.screen = 'Combat';
    (engine as any).resetCombatVoxLog();

    globalEventBus.publish({
      type: 'CardPlayed',
      cardId: 'calculated_strike',
      cardType: 'Attack',
      cardInstanceId: 'card_1',
      targetId: 'enemy_1',
    } as any);

    assert.equal(
      engine.state.combatVoxLog?.some((line) => line.includes('执行指令：计算打击。')),
      true,
    );
  } finally {
    engine.dispose();
  }
});
