#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'fs';

import { GameEngine } from '@/core/events/gameEngine';
import { RunGenerator } from '@/core/events/runGenerator';
import { SaveManager } from '@/core/persistence/saveManager';
import { globalEventBus } from '@/core/events/eventBus';
import type { GameState, MapNode } from '@/core/types';

const REPORT_DIR = 'reports/scenarios';
const REPORT_PATH = `${REPORT_DIR}/scenario-matrix.json`;

type ScenarioStatus = 'pass' | 'fail';

interface ScenarioResult {
  scenarioId: string;
  seed: number;
  character: string;
  finalScreen?: string;
  chapterReached?: number;
  currentNodeId?: string | null;
  rewardState?: string;
  summaryFields?: Record<string, unknown>;
  failureStep?: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface ScenarioMatrixReport {
  timestamp: string;
  scenarios: ScenarioResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    byScenario: Record<string, { passed: number; failed: number }>;
  };
}

interface StorageMock extends Storage {
  clear(): void;
}

function log(message: string) {
  console.log(`[scenario] ${message}`);
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
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

function createEngine(seed: number, character: string): GameEngine {
  const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
  engine.selectCharacter(character);
  assertCondition(engine.state.screen === 'Map', `expected Map after character select, got ${engine.state.screen}`);
  return engine;
}

function firstFloorNodesOfType(engine: GameEngine, nodeType: MapNode['type']): MapNode[] {
  return engine.state.map.filter((node) => node.y === 0 && node.type === nodeType);
}

function findEngineWithFirstFloorNode(nodeType: MapNode['type'], character: string, seedStart = 1, seedEnd = 160): { engine: GameEngine; seed: number; node: MapNode } {
  for (let seed = seedStart; seed <= seedEnd; seed++) {
    const engine = createEngine(seed, character);
    const node = firstFloorNodesOfType(engine, nodeType)[0];
    if (node) {
      return { engine, seed, node };
    }
    engine.dispose();
  }
  throw new Error(`unable to find first-floor ${nodeType} node for ${character}`);
}

function defeatCurrentCombat(engine: GameEngine) {
  const combat = engine.state.combat;
  assertCondition(combat, 'combat state missing');
  const lastEnemy = combat.enemies[combat.enemies.length - 1];
  assertCondition(lastEnemy, 'combat has no enemies');
  for (const enemy of combat.enemies) {
    enemy.hp = 0;
  }
  (engine as unknown as { handleEnemyDefeated: (enemyId: string) => void }).handleEnemyDefeated(lastEnemy.id);
}

function snapshotCombatSignature(state: GameState) {
  const combat = state.combat;
  assertCondition(combat, 'combat signature requested outside combat');
  return {
    enemyDefs: combat.enemies.map((enemy) => enemy.defId),
    enemyHp: combat.enemies.map((enemy) => enemy.hp),
    handSize: combat.hand.length,
    drawPileSize: combat.drawPile.length,
    playerHp: combat.player.hp,
    playerEnergy: combat.player.energy
  };
}

function currentChapterFromNodeId(nodeId: string | null | undefined): number {
  if (!nodeId) return 0;
  const match = nodeId.match(/floor_(\d+)_node_/);
  if (!match) return 0;
  const floor = Number(match[1]);
  if (floor <= 10) return 1;
  if (floor <= 18) return 2;
  return 3;
}

function runScenario(
  scenarioId: string,
  character: string,
  executor: () => Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'>
): ScenarioResult {
  const startedAt = Date.now();
  try {
    const result = executor();
    return {
      scenarioId,
      character,
      duration: Date.now() - startedAt,
      passed: true,
      ...result
    };
  } catch (error) {
    return {
      scenarioId,
      character,
      duration: Date.now() - startedAt,
      passed: false,
      seed: -1,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function scenarioCharacterSelectMap(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const seed = 12345;
  const engine = createEngine(seed, 'informant');
  try {
    const floors = new Set(engine.state.map.map((node) => node.y + 1));
    assertCondition(floors.size === 10, `expected first chapter map with 10 floors, got ${floors.size}`);
    return {
      seed,
      finalScreen: engine.state.screen,
      chapterReached: 1,
      currentNodeId: engine.state.currentNodeId,
      summaryFields: {
        totalFloors: floors.size,
        firstFloorNodeCount: engine.state.map.filter((node) => node.y === 0).length
      }
    };
  } finally {
    engine.dispose();
  }
}

function scenarioCombatRewardMap(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const { engine, seed, node } = findEngineWithFirstFloorNode('Combat', 'informant');
  try {
    engine.enterNode(node.id);
    let screen: string = engine.state.screen;
    assertCondition(screen === 'Combat', `expected Combat, got ${screen}`);
    assertCondition(!!engine.state.combatRestartCheckpoint, 'combat checkpoint missing on room entry');
    defeatCurrentCombat(engine);
    screen = engine.state.screen;
    assertCondition(screen === 'Reward', `expected Reward after combat victory, got ${screen}`);
    engine.skipReward();
    screen = engine.state.screen;
    assertCondition(screen === 'Map', `expected Map after reward exit, got ${screen}`);
    assertCondition(engine.state.pendingNodeResolution === false, 'expected room resolution to clear after reward');
    return {
      seed,
      finalScreen: engine.state.screen,
      chapterReached: currentChapterFromNodeId(engine.state.currentNodeId),
      currentNodeId: engine.state.currentNodeId,
      rewardState: 'reward_then_map'
    };
  } finally {
    engine.dispose();
  }
}

function scenarioEventReturnMap(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const { engine, seed, node } = findEngineWithFirstFloorNode('Event', 'informant');
  try {
    engine.enterNode(node.id);
    let screen: string = engine.state.screen;
    assertCondition(screen === 'Event', `expected Event, got ${screen}`);
    assertCondition(!!engine.state.activeEvent, 'active event missing after entering event room');
    engine.leaveCurrentRoomToMap();
    screen = engine.state.screen;
    assertCondition(screen === 'Map', `expected Map after event resolution, got ${screen}`);
    return {
      seed,
      finalScreen: engine.state.screen,
      chapterReached: currentChapterFromNodeId(engine.state.currentNodeId),
      currentNodeId: engine.state.currentNodeId,
      rewardState: 'event_then_map'
    };
  } finally {
    engine.dispose();
  }
}

function scenarioShopReturnMap(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const { engine, seed, node } = findEngineWithFirstFloorNode('Shop', 'informant');
  try {
    engine.enterNode(node.id);
    let screen: string = engine.state.screen;
    assertCondition(screen === 'Shop', `expected Shop, got ${screen}`);
    engine.leaveCurrentRoomToMap();
    screen = engine.state.screen;
    assertCondition(screen === 'Map', `expected Map after leaving shop, got ${screen}`);
    return {
      seed,
      finalScreen: engine.state.screen,
      chapterReached: currentChapterFromNodeId(engine.state.currentNodeId),
      currentNodeId: engine.state.currentNodeId,
      rewardState: 'shop_then_map'
    };
  } finally {
    engine.dispose();
  }
}

function scenarioSaveLoadRoundTrip(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const storage = installStorageMock();
  storage.clear();
  const saveManager = new SaveManager();
  const seed = 23456;
  const engine = createEngine(seed, 'brute');
  try {
    saveManager.startRun();
    const eventNode = firstFloorNodesOfType(engine, 'Event')[0];
    if (eventNode) {
      engine.enterNode(eventNode.id);
      assertCondition(engine.state.screen === 'Event', 'expected to enter Event before save');
    }
    const saveOk = saveManager.saveGame('scenario_slot', engine.state, 1234);
    assertCondition(saveOk, 'saveGame failed');
    const loaded = saveManager.loadGame('scenario_slot');
    assertCondition(!!loaded, 'loadGame returned null');
    const restoredEngine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
    try {
      restoredEngine.loadSaveData(loaded);
      assertCondition(restoredEngine.state.screen === engine.state.screen, 'screen mismatch after loadSaveData');
      assertCondition(restoredEngine.state.currentNodeId === engine.state.currentNodeId, 'currentNodeId mismatch after loadSaveData');
      assertCondition(restoredEngine.state.player.deck.length === engine.state.player.deck.length, 'deck length mismatch after loadSaveData');
      return {
        seed,
        finalScreen: restoredEngine.state.screen,
        chapterReached: currentChapterFromNodeId(restoredEngine.state.currentNodeId),
        currentNodeId: restoredEngine.state.currentNodeId,
        summaryFields: {
          saveSlots: saveManager.getSaveSlots().length,
          activeEvent: restoredEngine.state.activeEvent?.id ?? null
        }
      };
    } finally {
      restoredEngine.dispose();
    }
  } finally {
    engine.dispose();
  }
}

function scenarioCheckpointRestart(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const { engine, seed, node } = findEngineWithFirstFloorNode('Combat', 'tactician');
  try {
    engine.enterNode(node.id);
    assertCondition(engine.state.screen === 'Combat', `expected Combat, got ${engine.state.screen}`);
    const checkpoint = engine.state.combatRestartCheckpoint;
    assertCondition(!!checkpoint, 'combat checkpoint missing');
    const before = snapshotCombatSignature(engine.state);
    const combat = engine.state.combat;
    assertCondition(combat, 'combat state missing before restart');
    combat.player.block = 77;
    if (combat.enemies[0]) {
      combat.enemies[0].hp = Math.max(0, combat.enemies[0].hp - 5);
    }
    const restarted = engine.restartCombatFromCheckpoint(checkpoint);
    assertCondition(restarted, 'restartCombatFromCheckpoint returned false');
    const after = snapshotCombatSignature(engine.state);
    assertCondition(JSON.stringify(before.enemyDefs) === JSON.stringify(after.enemyDefs), 'enemy lineup mismatch after restart');
    assertCondition(JSON.stringify(before.enemyHp) === JSON.stringify(after.enemyHp), 'enemy hp mismatch after restart');
    assertCondition(before.playerHp === after.playerHp, 'player hp mismatch after restart');
    assertCondition(before.playerEnergy === after.playerEnergy, 'player energy mismatch after restart');
    assertCondition(!!engine.state.combatRestartCheckpoint, 'checkpoint should be recreated after restart');
    return {
      seed,
      finalScreen: engine.state.screen,
      chapterReached: currentChapterFromNodeId(engine.state.currentNodeId),
      currentNodeId: engine.state.currentNodeId,
      summaryFields: after
    };
  } finally {
    engine.dispose();
  }
}

function scenarioChapterBoundaries(): Omit<ScenarioResult, 'scenarioId' | 'character' | 'duration' | 'passed'> {
  const seed = 34567;
  const generator = new RunGenerator(seed);
  const map = generator.generateMap(seed);
  const floors = new Set(map.map((node) => node.y + 1));
  assertCondition(floors.size === 26, `expected 26 floors, got ${floors.size}`);
  assertCondition(generator.getChapterFloors(1) === 10, 'chapter 1 floors mismatch');
  assertCondition(generator.getChapterFloors(2) === 8, 'chapter 2 floors mismatch');
  assertCondition(generator.getChapterFloors(3) === 8, 'chapter 3 floors mismatch');
  assertCondition(generator.isChapterBoss(10), 'floor 10 should be chapter boss');
  assertCondition(generator.isChapterBoss(18), 'floor 18 should be chapter boss');
  assertCondition(generator.isChapterBoss(26), 'floor 26 should be chapter boss');
  assertCondition(generator.isChapterRest(9), 'floor 9 should be chapter rest');
  assertCondition(generator.isChapterRest(17), 'floor 17 should be chapter rest');
  assertCondition(generator.isChapterRest(25), 'floor 25 should be chapter rest');
  return {
    seed,
    finalScreen: 'Map',
    chapterReached: 3,
    currentNodeId: null,
    summaryFields: {
      totalFloors: floors.size,
      chapter1Floors: generator.getChapterFloors(1),
      chapter2Floors: generator.getChapterFloors(2),
      chapter3Floors: generator.getChapterFloors(3)
    }
  };
}

function main() {
  installStorageMock();
  ensureDir(REPORT_DIR);
  console.log('=== DeckRogue Scenario Matrix ===');

  const scenarioResults: ScenarioResult[] = [
    runScenario('character_select_map', 'informant', scenarioCharacterSelectMap),
    runScenario('combat_reward_map', 'informant', scenarioCombatRewardMap),
    runScenario('event_return_map', 'informant', scenarioEventReturnMap),
    runScenario('shop_return_map', 'informant', scenarioShopReturnMap),
    runScenario('save_load_roundtrip', 'brute', scenarioSaveLoadRoundTrip),
    runScenario('checkpoint_restart', 'tactician', scenarioCheckpointRestart),
    runScenario('chapter_boundaries', 'informant', scenarioChapterBoundaries)
  ];

  for (const result of scenarioResults) {
    const status: ScenarioStatus = result.passed ? 'pass' : 'fail';
    log(`${status === 'pass' ? '✓' : '✗'} ${result.scenarioId} (${result.character}, seed=${result.seed})`);
    if (!result.passed && result.error) {
      log(`  reason: ${result.error}`);
    }
  }

  const byScenario: Record<string, { passed: number; failed: number }> = {};
  for (const result of scenarioResults) {
    byScenario[result.scenarioId] = byScenario[result.scenarioId] || { passed: 0, failed: 0 };
    if (result.passed) {
      byScenario[result.scenarioId].passed += 1;
    } else {
      byScenario[result.scenarioId].failed += 1;
    }
  }

  const report: ScenarioMatrixReport = {
    timestamp: new Date().toISOString(),
    scenarios: scenarioResults,
    summary: {
      total: scenarioResults.length,
      passed: scenarioResults.filter((item) => item.passed).length,
      failed: scenarioResults.filter((item) => !item.passed).length,
      byScenario
    }
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Report: ${REPORT_PATH}`);

  globalEventBus.clear();
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main();
