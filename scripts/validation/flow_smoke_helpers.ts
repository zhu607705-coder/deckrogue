/**
 * @file flow_smoke_helpers.ts
 * @description 提供流程冒烟测试的辅助工具函数和共享 fixture。
 *
 * 主要职责:
 * - 管理开发服务器的启动和等待
 * - 提供存档槽位 fixture 创建工具
 * - 封装 Playwright 上下文引导逻辑
 */

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import type { BrowserContext, Page } from 'playwright';

import { GameEngine, createDefaultMetaProfile } from '@/core';
import { createRoomSessionForNode, setRoomSession, syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import { syncRouteStateFromLegacyState } from '@/content/narrative/numericSystem';
import charactersData from '@/content/data/characters.json';
import type { RoomOwnerKind } from '@/core/types';

export interface SaveSlotFixture {
  slotId: string;
  slot: {
    id: string;
    name: string;
    timestamp: number;
    playTime: number;
    floor: number;
    chapterIndex: number;
    characterId: string;
    checksum: string;
  };
  saveData: Record<string, unknown>;
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

const DEFAULT_SMOKE_PORT = process.env.PLAYWRIGHT_SMOKE_PORT || reserveSmokePort();
const SERVER_PROBE_SCRIPT = `
  const url = process.argv[1];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  timeout.unref();
  fetch(url, { signal: controller.signal })
    .then((response) => process.exit(response.ok ? 0 : 1))
    .catch(() => process.exit(1));
`;

function reserveSmokePort(): string {
  return execFileSync(process.execPath, ['-e', `
    const net = require('node:net');
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') process.exit(1);
      console.log(address.port);
      server.close();
    });
    server.on('error', () => process.exit(1));
  `], { encoding: 'utf8' }).trim();
}

export function getDefaultSmokeUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${DEFAULT_SMOKE_PORT}`;
}

function getServerTarget(url: string): { host: string; port: string } {
  const parsed = new URL(url);
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  return {
    host: parsed.hostname,
    port,
  };
}

export function checkServer(url: string): boolean {
  try {
    execFileSync(process.execPath, ['-e', SERVER_PROBE_SCRIPT, url], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function waitForServer(url: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (checkServer(url)) return;
    await delay(500);
  }
  throw new Error(`flow smoke dev server did not become ready at ${url}`);
}

export function spawnDevServer(url: string): ChildProcess {
  const { host, port } = getServerTarget(url);
  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  return spawn(process.execPath, [viteBin, '--host', host, '--port', port, '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DISABLE_HMR: 'true',
      VITE_DEV_SERVER_URL: url,
    },
  });
}

export function buildSaveData(engine: GameEngine, slotId: string, name: string): SaveSlotFixture {
  const payload = engine.getSaveData() as { state: any };
  const state = JSON.parse(JSON.stringify(payload.state));
  const currentNode = state.currentNodeId ? state.map.find((node: any) => node.id === state.currentNodeId) : null;
  const floor = currentNode ? currentNode.y + 1 : 1;
  const chapterIndex = Math.ceil(floor / 8);
  const timestamp = Date.now();

  return {
    slotId,
    slot: {
      id: slotId,
      name,
      timestamp,
      playTime: 180,
      floor,
      chapterIndex,
      characterId: state.character?.id || 'informant',
      checksum: '',
    },
    saveData: {
      version: '1.0.0',
      timestamp,
      playTime: 180,
      state,
      metadata: {
        floor,
        chapterIndex,
        characterId: state.character?.id || 'informant',
        seed: state.seed,
        runStartTime: timestamp - 180_000,
      },
    },
  };
}

function inferFixtureRoomOwnerKind(nodeType: string): RoomOwnerKind {
  switch (nodeType) {
    case 'Event':
      return 'event';
    case 'Shop':
      return 'shop';
    case 'Rest':
      return 'rest';
    default:
      return 'combat';
  }
}

function primeCurrentRoomSession(engine: GameEngine, token?: string): void {
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (!currentNode || !engine.state.currentNodeId) {
    return;
  }

  setRoomSession(
    engine.state,
    createRoomSessionForNode({
      token: token ?? `fixture_room_${currentNode.id}`,
      nodeId: currentNode.id,
      ownerKind: inferFixtureRoomOwnerKind(currentNode.type),
    })
  );
}

function refreshFixtureRoomSession(
  engine: GameEngine,
  options: Parameters<typeof syncRoomSessionFromLegacyState>[1] = {}
): void {
  setRoomSession(engine.state, null);
  syncRoomSessionFromLegacyState(engine.state, options);
  syncSurfaceContextFromLegacyState(engine.state, options);
  syncRouteStateFromLegacyState(engine.state);
  if (!engine.state.roomSession && engine.state.pendingNodeResolution) {
    primeCurrentRoomSession(engine);
  }
}

export function createEngineAtFirstRoom(seed: number, characterId = 'informant'): GameEngine {
  const engine = new GameEngine(seed, createDefaultMetaProfile(), { enableRuntimeDelegation: false });
  engine.selectCharacter(characterId);
  const firstNode = engine.state.map.find((node) => node.y === 0);
  if (!firstNode) {
    throw new Error('Unable to create first-room save fixture: missing floor 1 node');
  }
  firstNode.revealed = true;
  engine.state.currentNodeId = firstNode.id;
  engine.state.pendingNodeResolution = true;
  primeCurrentRoomSession(engine, `fixture_room_${firstNode.id}`);
  syncRouteStateFromLegacyState(engine.state);
  syncSurfaceContextFromLegacyState(engine.state);
  return engine;
}

export function createRewardFixture(seed = 5101): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (currentNode) {
    currentNode.type = 'Combat';
  }
  engine.state.rewardCards = engine.generateCardRewards(3);
  engine.state.screen = 'Reward';
  refreshFixtureRoomSession(engine);
  return buildSaveData(engine, 'reward_flow_smoke', 'Reward Flow Smoke');
}

export function createShopFixture(seed = 5104): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (currentNode) {
    currentNode.type = 'Shop';
  }
  (engine as any).enterShop();
  refreshFixtureRoomSession(engine);
  return buildSaveData(engine, 'shop_flow_smoke', 'Shop Flow Smoke');
}

export function createEventFixture(seed = 5105): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (currentNode) {
    currentNode.type = 'Event';
  }
  engine.state.activeEvent = { id: 'mysterious_shrine' };
  engine.state.screen = 'Event';
  refreshFixtureRoomSession(engine);
  return buildSaveData(engine, 'event_flow_smoke', 'Event Flow Smoke');
}

export function createRestFixture(seed = 5107): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (currentNode) {
    currentNode.type = 'Rest';
  }
  engine.state.player.hp = Math.max(1, engine.state.player.maxHp - 15);
  engine.state.screen = 'Rest';
  refreshFixtureRoomSession(engine);
  return buildSaveData(engine, 'rest_flow_smoke', 'Rest Flow Smoke');
}

export function createRemoveCardFixture(seed = 5109): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (currentNode) {
    currentNode.type = 'Rest';
  }
  engine.state.screen = 'Rest';
  refreshFixtureRoomSession(engine);
  return buildSaveData(engine, 'remove_card_flow_smoke', 'Remove Card Flow Smoke');
}

export function createBossPhaseFixture(seed = 5108): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  engine.state.map = [
    {
      id: 'boss_phase_node',
      type: 'Boss',
      revealed: true,
      next: [],
      x: 0.5,
      y: 8,
    },
  ];
  engine.state.currentNodeId = 'boss_phase_node';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'Combat';
  primeCurrentRoomSession(engine, 'boss_phase_fixture');
  engine.state.combat = {
    player: {
      hp: 20,
      maxHp: 20,
      block: 10,
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
    enemies: [
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
      },
    ],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 2,
    isPlayerTurn: true,
    warpTide: 0,
    warpAlpha: 0.5,
    warpPerilK: 0.05,
    bossPhase: {
      enemyId: 'boss_1',
      bossDefId: 'cathedral_engine',
      phaseIndex: 1,
      phaseId: 'overheat_mass',
      phaseName: 'Overheat Mass',
      phaseHint: '',
      enteredTurn: 1,
      currentPlayerTurnCards: [],
      previousPlayerTurnCards: [],
      flags: {},
      adaptationEnabled: false,
    },
  };
  return buildSaveData(engine, 'boss_phase_flow', 'Boss Phase Flow');
}

function clearTerminalRoomState(engine: GameEngine): void {
  engine.state.combat = null;
  engine.state.rewardCards = [];
  setRoomSession(engine.state, null);
}

export function createVictoryFixture(seed = 5102): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  engine.state.player.gold = 133;
  engine.state.player.corruption = 18;
  engine.state.player.devotion = 11;
  engine.state.lastCombatVoxLog = ['VOX-001 - Terminal sweep complete.'];
  engine.state.screen = 'Victory';
  clearTerminalRoomState(engine);
  return buildSaveData(engine, 'terminal_flow_victory', 'Terminal Flow Victory');
}

export function createBossTerminalFixture(seed = 5106): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  engine.state.map = [
    {
      id: 'boss_terminal_node',
      type: 'Boss',
      revealed: true,
      next: [],
      x: 0.5,
      y: 8,
    },
  ];
  engine.state.currentNodeId = 'boss_terminal_node';
  engine.state.player.gold = 211;
  engine.state.player.corruption = 23;
  engine.state.player.devotion = 17;
  engine.state.lastCombatVoxLog = ['VOX-999 - Final boss collapsed.'];
  engine.state.screen = 'Victory';
  clearTerminalRoomState(engine);
  return buildSaveData(engine, 'boss_terminal_flow', 'Boss Terminal Flow');
}

export function createGameOverFixture(seed = 5103): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'brute');
  engine.state.player.hp = 0;
  engine.state.player.corruption = 37;
  engine.state.player.devotion = 4;
  engine.state.lastDeathVoxLog = ['VOX-ERR - Vital signs lost.'];
  engine.state.screen = 'GameOver';
  clearTerminalRoomState(engine);
  return buildSaveData(engine, 'terminal_flow_gameover', 'Terminal Flow GameOver');
}

export function calculateSaveChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  return hash.toString(16);
}

export function buildStoragePayload(fixtures: SaveSlotFixture[]) {
  const metaProfile = createDefaultMetaProfile();
  metaProfile.unlocks.characters = charactersData.map((character) => character.id);
  const saveEntries = Object.fromEntries(
    fixtures.map((fixture) => [`deckrogue_save_${fixture.slotId}`, JSON.stringify(fixture.saveData)])
  );
  return {
    slots: fixtures.map((fixture) => ({
      ...fixture.slot,
      checksum: calculateSaveChecksum(saveEntries[`deckrogue_save_${fixture.slotId}`]),
    })),
    saveEntries,
    metaProfile: JSON.stringify(metaProfile),
  };
}

export async function bootstrapContext(context: BrowserContext, fixtures: SaveSlotFixture[]) {
  const payload = buildStoragePayload(fixtures);
  await context.addInitScript((data) => {
    localStorage.clear();
    localStorage.setItem('deckrogue_engine_mode', 'legacy');
    localStorage.setItem('deckrogue_meta_profile_v1', data.metaProfile);
    localStorage.setItem('deckrogue_save_slots', JSON.stringify(data.slots));
    for (const [key, value] of Object.entries(data.saveEntries)) {
      localStorage.setItem(key, value as string);
    }
  }, payload);
}

export async function loadSlotFromLauncher(page: Page, slotName: string) {
  const slotCard = page
    .getByText(slotName)
    .locator('xpath=ancestor::div[.//button[normalize-space()="读取"]][1]');
  await slotCard.scrollIntoViewIfNeeded();
  await slotCard.getByRole('button', { name: '读取' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
}

export function screenshotPath(dir: string, file: string): string {
  ensureDir(dir);
  return path.join(dir, file);
}
