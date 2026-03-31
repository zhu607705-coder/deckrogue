#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

import type { GameState, RunCardInstance } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { GameEngine } from '@/core/events/gameEngine';
import { combatSystem } from '@/core/combat/combatSystem';
import { SaveManager } from '@/core/persistence/saveManager';

const REPORT_DIR = 'reports/system';
const REPORT_PATH = `${REPORT_DIR}/system-assertions.json`;
const LOG_STAMP = Date.now();

interface AssertionProbe {
  id: string;
  category: 'resource' | 'trigger_order' | 'death_settlement' | 'status_stacking' | 'save_replay';
  status: 'pass' | 'fail';
  trace: string[];
  evidence: Record<string, unknown>;
}

interface AssertionReport {
  timestamp: string;
  unitTestCommand: string;
  unitTests: {
    passed: boolean;
    logPath?: string;
  };
  settlementOrderDocumented: boolean;
  probes: AssertionProbe[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    overallStatus: 'pass' | 'fail';
  };
}

interface StorageMock extends Storage {
  clear(): void;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function installStorageMock(): StorageMock {
  const store = new Map<string, string>();
  const storage: StorageMock = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage
  });

  return storage;
}

function makeCard(id: string, instanceId: string): RunCardInstance {
  return {
    id,
    instanceId,
    baseCardId: id,
    name: id,
    rarity: 'Common',
    cost: 1,
    type: 'Skill',
    targeting: 'None',
    tags: [],
    text: id,
    actions: [],
    runtimeBase: {
      id,
      name: id,
      rarity: 'Common',
      cost: 1,
      type: 'Skill',
      targeting: 'None',
      tags: [],
      text: id,
      actions: []
    },
    persistentEnchantments: [],
    combatAfflictions: []
  };
}

function makeState(): GameState {
  return {
    seed: 1,
    rngState: 0,
    runId: 'system_assertions',
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
        axisDisposition: 'balanced'
      },
      enemies: [
        {
          id: 'enemy_1',
          defId: 'barrier',
          name: 'Barrier',
          hp: 10,
          maxHp: 10,
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
    map: [{ id: 'floor_1_node_0', type: 'Combat', revealed: true, next: [], x: 0, y: 0 }],
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

function runUnitTests(): { passed: boolean; logPath: string } {
  ensureDir(REPORT_DIR);
  const logPath = `${REPORT_DIR}/system-assertions-tests-${LOG_STAMP}.log`;
  try {
    const output = execSync('npx tsx --test tests/unit/systemAssertions.test.ts', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    writeFileSync(logPath, output);
    return { passed: true, logPath };
  } catch (error: any) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    writeFileSync(logPath, output);
    return { passed: false, logPath };
  }
}

function probeDrawReshuffle(): AssertionProbe {
  const state = makeState();
  state.combat!.discardPile = [makeCard('a', 'a1'), makeCard('b', 'b1')];
  const action = ActionFactoryV2.createAction({ type: 'Draw', amount: 2 });
  const queue = new ActionQueue();
  action.execute(state, queue);

  return {
    id: 'draw_reshuffle',
    category: 'resource',
    status: state.combat!.hand.length === 2 ? 'pass' : 'fail',
    trace: ['draw_requested', 'discard_reshuffled', 'hand_incremented'],
    evidence: {
      handSize: state.combat!.hand.length,
      drawPileSize: state.combat!.drawPile.length,
      discardPileSize: state.combat!.discardPile.length
    }
  };
}

function probePlayerPoisonDeath(): AssertionProbe {
  const engine = new GameEngine(201, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.player.hp = 1;
  state.player.hp = 1;
  state.combat!.player.statuses.Poison = 1;
  state.combatRestartCheckpoint = {
    nodeId: 'floor_1_node_0',
    nodeType: 'Combat',
    stateSnapshot: { screen: 'Combat' },
    rngState: 0,
    pendingNodeResolution: true
  };
  (engine as any).state = state;
  (engine as any).startTurn();
  const status: AssertionProbe['status'] =
    engine.state.screen === 'GameOver' && !engine.state.combatRestartCheckpoint ? 'pass' : 'fail';
  const probe: AssertionProbe = {
    id: 'player_poison_defeat',
    category: 'death_settlement',
    status,
    trace: ['turn_start', 'poison_damage', 'death_check', 'checkpoint_cleared', 'run_ended'],
    evidence: {
      screen: engine.state.screen,
      checkpointCleared: !engine.state.combatRestartCheckpoint
    }
  };
  engine.dispose();
  return probe;
}

async function probeEnemyPoisonVictory(): Promise<AssertionProbe> {
  const engine = new GameEngine(202, null, { enableRuntimeDelegation: false });
  const state = makeState();
  state.combat!.enemies = [{
    id: 'enemy_poisoned',
    defId: 'barrier',
    name: 'Poisoned Enemy',
    hp: 1,
    maxHp: 10,
    block: 0,
    statuses: { Poison: 1 },
    nextIntent: 'Attack',
    devotion: 0,
    corruptionAxis: 0,
    axisDisposition: 'balanced'
  }];
  state.combatRestartCheckpoint = {
    nodeId: 'floor_1_node_0',
    nodeType: 'Combat',
    stateSnapshot: { screen: 'Combat' },
    rngState: 0,
    pendingNodeResolution: true
  };
  (engine as any).state = state;
  await (engine as any).executeEnemyTurn();
  const status: AssertionProbe['status'] =
    engine.state.screen === 'Reward' && !engine.state.combatRestartCheckpoint ? 'pass' : 'fail';
  const probe: AssertionProbe = {
    id: 'enemy_poison_victory',
    category: 'trigger_order',
    status,
    trace: ['enemy_turn_start', 'poison_damage', 'enemy_death', 'combat_victory', 'reward_transition'],
    evidence: {
      screen: engine.state.screen,
      combatCleared: engine.state.combat === null,
      checkpointCleared: !engine.state.combatRestartCheckpoint
    }
  };
  engine.dispose();
  return probe;
}

function probeNegativeStatusClamp(): AssertionProbe {
  const state = makeState();
  combatSystem.applyStatus(state, 'enemy', 'enemy_1', 'Poison', 3);
  combatSystem.applyStatus(state, 'enemy', 'enemy_1', 'Poison', -10);

  return {
    id: 'negative_status_clamp',
    category: 'status_stacking',
    status: state.combat!.enemies[0].statuses.Poison === 0 ? 'pass' : 'fail',
    trace: ['status_applied', 'status_reduced', 'status_clamped'],
    evidence: {
      poison: state.combat!.enemies[0].statuses.Poison
    }
  };
}

function probeSaveLoadRoundTrip(): AssertionProbe {
  const storage = installStorageMock();
  storage.clear();
  const saveManager = new SaveManager();
  saveManager.startRun();

  const state = makeState();
  state.screen = 'Event';
  state.player.hp = 17;
  state.currentNodeId = 'floor_1_node_0';

  const saved = saveManager.saveGame('system_assertions_slot', state, 321);
  const loaded = saveManager.loadGame('system_assertions_slot');
  const restoredEngine = new GameEngine(203, null, { enableRuntimeDelegation: false });

  try {
    if (!saved || !loaded) {
      return {
        id: 'save_load_roundtrip',
        category: 'save_replay',
        status: 'fail',
        trace: ['save_requested', 'load_requested'],
        evidence: { saved, loaded: !!loaded }
      };
    }

    restoredEngine.loadSaveData(loaded);
    return {
      id: 'save_load_roundtrip',
      category: 'save_replay',
      status:
        restoredEngine.state.screen === state.screen &&
        restoredEngine.state.player.hp === state.player.hp &&
        restoredEngine.state.currentNodeId === state.currentNodeId
          ? 'pass'
          : 'fail',
      trace: ['save_requested', 'save_completed', 'load_requested', 'state_restored'],
      evidence: {
        screen: restoredEngine.state.screen,
        hp: restoredEngine.state.player.hp,
        currentNodeId: restoredEngine.state.currentNodeId,
        slots: saveManager.getSaveSlots().length
      }
    };
  } finally {
    restoredEngine.dispose();
  }
}

async function main(): Promise<void> {
  ensureDir(REPORT_DIR);

  const unitTests = runUnitTests();
  const probes = [
    probeDrawReshuffle(),
    probePlayerPoisonDeath(),
    await probeEnemyPoisonVictory(),
    probeNegativeStatusClamp(),
    probeSaveLoadRoundTrip()
  ];

  const passed = probes.filter((probe) => probe.status === 'pass').length + (unitTests.passed ? 1 : 0);
  const total = probes.length + 1;
  const report: AssertionReport = {
    timestamp: new Date().toISOString(),
    unitTestCommand: 'npx tsx --test tests/unit/systemAssertions.test.ts',
    unitTests,
    settlementOrderDocumented: existsSync('docs/contracts/settlement-order.md'),
    probes,
    summary: {
      total,
      passed,
      failed: total - passed,
      overallStatus: unitTests.passed && probes.every((probe) => probe.status === 'pass') && existsSync('docs/contracts/settlement-order.md') ? 'pass' : 'fail'
    }
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`[system-assertions] report: ${REPORT_PATH}`);
  console.log(`[system-assertions] probes: ${probes.filter((probe) => probe.status === 'pass').length}/${probes.length}`);

  process.exit(report.summary.overallStatus === 'pass' ? 0 : 1);
}

main().catch((error) => {
  console.error('[system-assertions] crashed:', error);
  process.exit(1);
});
