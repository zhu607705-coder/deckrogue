#!/usr/bin/env node

/**
 * @file playwright_ui_smoke_expansion.ts
 * @description 使用 Playwright 进行扩展的 UI 冒烟测试。
 *
 * 主要职责:
 * - 测试更多 UI 场景和路径
 * - 验证 UI 组件在不同状态下的表现
 * - 记录详细测试结果
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { GameEngine, createDefaultMetaProfile } from '@/core';
import { createRoomSessionForNode, setRoomSession, syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import { syncRouteStateFromLegacyState } from '@/content/narrative/numericSystem';
import charactersData from '@/content/data/characters.json';
import type { RoomOwnerKind } from '@/core/types';
import { calculateSaveChecksum, checkServer, getDefaultSmokeUrl, spawnDevServer, waitForServer } from './flow_smoke_helpers';

interface UiAuditIssue {
  selector: string;
  problem: string;
  detail: string;
}

interface ViewAudit {
  label: string;
  screenshot: string;
  brokenImages: Array<{ src: string; alt: string; width: number; height: number }>;
  layoutIssues: UiAuditIssue[];
}

interface SmokeReport {
  generatedAt: string;
  completed: boolean;
  failedStep: string | null;
  baseUrl: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  audits: ViewAudit[];
  slotsLoaded: string[];
  tutorialChecked: boolean;
}

interface AuditResult {
  brokenImages: Array<{ src: string; alt: string; width: number; height: number }>;
  layoutIssues: UiAuditIssue[];
}

interface SaveSlotFixture {
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

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: getDefaultSmokeUrl(),
    headed: false
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

async function ensureVisible(locatorCount: Promise<number>, label: string) {
  const count = await locatorCount;
  if (count <= 0) {
    throw new Error(`UI smoke expansion failed: missing ${label}`);
  }
}

async function clickCharacterCard(page: Page, characterId: string) {
  const card = page.locator(`[data-character-id="${characterId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ force: true });
}

async function auditView(page: Page, label: string, screenshotName: string, layoutSelectors: string[]): Promise<ViewAudit> {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  });
  const screenshotPath = path.join(process.cwd(), 'output', 'playwright', screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const auditScript = new Function('selectors', `
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const intersectsViewport = rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight;
      return rect.width > 0 && rect.height > 0 && intersectsViewport && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const brokenImages = Array.from(document.images)
      .filter((img) => isVisible(img) && img.naturalWidth === 0)
      .map((img) => ({
        src: img.currentSrc || img.src,
        alt: img.alt,
        width: img.clientWidth,
        height: img.clientHeight
      }));
    const layoutIssues = [];
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector)).slice(0, 24);
      for (const el of elements) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) {
          layoutIssues.push({
            selector,
            problem: 'zero-sized',
            detail: Math.round(rect.width) + 'x' + Math.round(rect.height)
          });
        }
        if (rect.right > innerWidth + 24 || rect.left < -24) {
          layoutIssues.push({
            selector,
            problem: 'viewport-overflow',
            detail: JSON.stringify({
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              viewport: [innerWidth, innerHeight]
            })
          });
        }
      }
    }
    return { brokenImages, layoutIssues };
  `);
  const result = await page.evaluate(auditScript as never, layoutSelectors) as AuditResult;
  return {
    label,
    screenshot: screenshotPath,
    brokenImages: result.brokenImages,
    layoutIssues: result.layoutIssues
  };
}

function buildSaveData(engine: GameEngine, slotId: string, name: string): SaveSlotFixture {
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
      checksum: ''
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
        runStartTime: timestamp - 180_000
      }
    }
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

function refreshFixtureRoomSession(engine: GameEngine): void {
  setRoomSession(engine.state, null);
  syncRoomSessionFromLegacyState(engine.state);
  syncSurfaceContextFromLegacyState(engine.state);
  syncRouteStateFromLegacyState(engine.state);
  if (!engine.state.roomSession && engine.state.pendingNodeResolution) {
    primeCurrentRoomSession(engine);
  }
}

function createEngineAtFirstRoom(seed: number): GameEngine {
  const engine = new GameEngine(seed, createDefaultMetaProfile(), { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
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

function createEngineAtMapStart(seed: number): GameEngine {
  const engine = new GameEngine(seed, createDefaultMetaProfile(), { enableRuntimeDelegation: false });
  engine.selectCharacter('informant');
  return engine;
}

function createExpansionSaveFixtures(): SaveSlotFixture[] {
  const mapEngine = createEngineAtMapStart(4100);

  const combatEngine = createEngineAtFirstRoom(4101);
  (combatEngine as any).startCombat('Combat');

  const rewardEngine = createEngineAtFirstRoom(4102);
  const rewardNode = rewardEngine.state.currentNodeId
    ? rewardEngine.state.map.find((node) => node.id === rewardEngine.state.currentNodeId)
    : null;
  if (rewardNode) {
    rewardNode.type = 'Combat';
  }
  rewardEngine.state.rewardCards = (rewardEngine as any).generateCardRewards(3);
  rewardEngine.state.screen = 'Reward';
  refreshFixtureRoomSession(rewardEngine);

  const shopEngine = createEngineAtFirstRoom(4103);
  (shopEngine as any).enterShop();
  refreshFixtureRoomSession(shopEngine);

  const eventEngine = createEngineAtFirstRoom(4104);
  (eventEngine as any).startEvent();
  refreshFixtureRoomSession(eventEngine);

  const upgradeEngine = createEngineAtFirstRoom(4105);
  (upgradeEngine as any).enterShop();
  upgradeEngine.enterUpgrade('Shop');
  refreshFixtureRoomSession(upgradeEngine);

  const victoryEngine = createEngineAtFirstRoom(4106);
  victoryEngine.state.player.gold = 133;
  victoryEngine.state.player.corruption = 18;
  victoryEngine.state.player.devotion = 11;
  victoryEngine.state.lastCombatVoxLog = ['VOX-001 - Terminal sweep complete.'];
  victoryEngine.state.screen = 'Victory';
  victoryEngine.state.combat = null;
  victoryEngine.state.rewardCards = [];
  victoryEngine.state.pendingNodeResolution = false;
  setRoomSession(victoryEngine.state, null);

  return [
    buildSaveData(mapEngine, 'ui_smoke_map', 'UI Smoke Map'),
    buildSaveData(combatEngine, 'ui_smoke_combat', 'UI Smoke Combat'),
    buildSaveData(rewardEngine, 'ui_smoke_reward', 'UI Smoke Reward'),
    buildSaveData(shopEngine, 'ui_smoke_shop', 'UI Smoke Shop'),
    buildSaveData(eventEngine, 'ui_smoke_event', 'UI Smoke Event'),
    buildSaveData(upgradeEngine, 'ui_smoke_upgrade', 'UI Smoke Upgrade'),
    buildSaveData(victoryEngine, 'ui_smoke_victory', 'UI Smoke Victory')
  ];
}

function buildStoragePayload() {
  const slots = createExpansionSaveFixtures();
  const saveEntries = Object.fromEntries(
    slots.map((fixture) => [`deckrogue_save_${fixture.slotId}`, JSON.stringify(fixture.saveData)])
  );
  const metaProfile = createDefaultMetaProfile();
  metaProfile.unlocks.characters = charactersData.map((character) => character.id);
  metaProfile.progression.ascensionUnlockedLevelByCharacter = {
    informant: 2,
    brute: 0,
    tactician: 0,
    puppeteer: 0,
    chronomancer: 0,
    alchemist: 0,
    penitent_judge: 0,
    void_sanctioner: 0
  };
  metaProfile.preferences.selectedAscension = 2;

  return {
    slots: slots.map((fixture) => ({
      ...fixture.slot,
      checksum: calculateSaveChecksum(saveEntries[`deckrogue_save_${fixture.slotId}`]),
    })),
    saveEntries,
    metaProfile: JSON.stringify(metaProfile)
  };
}

async function ensureMenuOpen(page: Page) {
  const backdrop = page.locator('.app-menu-backdrop');
  const alreadyOpen = await backdrop.count().then(async (count) => count > 0 && await backdrop.first().isVisible()).catch(() => false);
  if (!alreadyOpen) {
    await page.getByRole('button', { name: '菜单' }).click();
    await backdrop.first().waitFor({ timeout: 10_000 });
  }
}

async function openMenuAndReturnToLauncher(page: Page, baseUrl: string) {
  const menuButton = page.getByRole('button', { name: '菜单' });
  const hasMenuButton = await menuButton.count().then(async (count) => count > 0 && await menuButton.first().isVisible()).catch(() => false);
  if (hasMenuButton) {
    await ensureMenuOpen(page);
    await page.getByRole('button', { name: '返回启动器' }).click();
  } else {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
  }
  await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
}

async function enterFirstCombat(page: Page) {
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
  const combatNode = page.locator('button[data-node-type="Combat"]').first();
  if (await combatNode.count()) {
    await combatNode.click({ force: true });
  } else {
    const fallbackCombatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗|Combat/i }).first();
    if (await fallbackCombatNode.count()) {
      await fallbackCombatNode.click({ force: true });
    } else {
      await page.locator('button[data-node-id]:not([disabled])').first().click({ force: true });
    }
  }
  await Promise.race([
    page.locator('.enemy-standee').first().waitFor({ timeout: 10_000 }),
    page.locator('.player-standee').first().waitFor({ timeout: 10_000 })
  ]);
}

async function loadSlotFromLauncher(page: Page, slotName: string) {
  const slotCard = page
    .getByText(slotName)
    .locator('xpath=ancestor::div[.//button[normalize-space()="读取"]][1]');
  await slotCard.scrollIntoViewIfNeeded();
  await slotCard.getByRole('button', { name: '读取' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
}

async function openMenuSubpage(page: Page, label: string) {
  await ensureMenuOpen(page);
  await page.getByRole('button', { name: label }).click();
}

async function backFromMenuSubpage(page: Page) {
  await page.getByRole('button', { name: '← 返回' }).click();
}

async function bootstrapContext(context: BrowserContext) {
  const payload = buildStoragePayload();
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

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright');
  mkdirSync(outputDir, { recursive: true });
  let devServer: ReturnType<typeof spawnDevServer> | null = null;

  if (!checkServer(options.url)) {
    devServer = spawnDevServer(options.url);
    await waitForServer(options.url);
  }

  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context);
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const audits: ViewAudit[] = [];
  const slotsLoaded: string[] = [];
  let tutorialChecked = false;
  let completed = false;
  let failedStep: string | null = null;

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'unknown';
    if (errorText.includes('ERR_ABORTED')) {
      return;
    }
    failedRequests.push(`${request.resourceType()} ${request.url()} ${errorText}`);
  });
  page.on('response', async (response) => {
    if (response.status() >= 400) {
      const request = response.request();
      failedRequests.push(`${request.resourceType()} ${response.url()} HTTP ${response.status()}`);
    }
  });

  try {
    await page.goto(options.url, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    audits.push(
      await auditView(page, 'launcher', 'expansion_launcher.png', [
        '.launcher-shell [data-keyboard-focus="true"]',
        '.launcher-shell .launcher-panel',
        '.launcher-shell img',
      ])
    );

    await page.getByRole('button', { name: /术语、资源与战斗流程/ }).click();
    await page.getByText('新手战区教程').waitFor({ timeout: 10_000 });
    await page.locator('text=术语索引').first().waitFor({ timeout: 10_000 });
    audits.push(
      await auditView(page, 'tutorial', 'expansion_tutorial.png', [
        '[data-screen="Tutorial"] button',
        '[data-screen="Tutorial"] section',
        '[data-screen="Tutorial"] .glossary-term',
        '[data-screen="Tutorial"] img',
      ])
    );
    tutorialChecked = true;
    await page.getByRole('button', { name: /返回当前界面|关闭教程/ }).first().click();
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForFunction(() => {
      const shell = document.querySelector('.launcher-shell') as HTMLElement | null;
      return !shell || (shell.scrollLeft === 0 && shell.scrollTop === 0);
    }, { timeout: 2_000 });
    audits.push(
      await auditView(page, 'launcher_tablet', 'expansion_launcher_tablet.png', [
        '.launcher-shell [data-keyboard-focus="true"]',
        '.launcher-shell .launcher-panel',
        '.launcher-shell img',
      ])
    );
    await page.setViewportSize({ width: 1440, height: 960 });

    await page.getByRole('button', { name: /开始新战区/i }).click();
    await page.getByText('选择你的执行体').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'character_select', 'expansion_character_select.png', ['img', 'button', '[class*="max-w-[18rem]"]']));

    await clickCharacterCard(page, 'informant');
    await page.goto(options.url, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });

    await loadSlotFromLauncher(page, 'UI Smoke Map');
    slotsLoaded.push('UI Smoke Map');
    await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    await ensureVisible(page.locator('button[data-node-id]').count(), 'map nodes');
    audits.push(await auditView(page, 'map', 'expansion_map.png', ['button[data-node-id]', 'img']));

    await enterFirstCombat(page);
    audits.push(await auditView(page, 'combat', 'expansion_combat.png', ['.player-standee', '.enemy-standee', '.immersive-card', 'img']));

    await openMenuSubpage(page, '主题与视觉');
    await page.getByText('主题与视觉').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'settings_theme', 'expansion_theme.png', ['button', 'img']));
    await backFromMenuSubpage(page);

    await openMenuSubpage(page, '存档 / 读取');
    await page.getByText('存档 / 读取').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'save_load', 'expansion_save_load.png', ['button', 'img']));
    await backFromMenuSubpage(page);

    await openMenuSubpage(page, '键位设置');
    await page.getByText('键位设置').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'keybinds', 'expansion_keybinds.png', ['button']));
    await backFromMenuSubpage(page);

    await openMenuAndReturnToLauncher(page, options.url);

    await loadSlotFromLauncher(page, 'UI Smoke Reward');
    slotsLoaded.push('UI Smoke Reward');
    await page.getByText(/选取.?一张记忆印痕|选取 1 张记忆印痕/).waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'reward', 'expansion_reward.png', ['button', 'img', '[data-keyboard-option]']));
    await openMenuAndReturnToLauncher(page, options.url);

    await loadSlotFromLauncher(page, 'UI Smoke Shop');
    slotsLoaded.push('UI Smoke Shop');
    await page.getByText('黑市拾荒者').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'shop', 'expansion_shop.png', ['button', 'img', 'select']));
    await openMenuAndReturnToLauncher(page, options.url);

    await loadSlotFromLauncher(page, 'UI Smoke Event');
    slotsLoaded.push('UI Smoke Event');
    await Promise.race([
      page.getByText(/叙事事件|Field Omen|Narrative Event/).waitFor({ timeout: 10_000 }),
      page.locator('button[data-keyboard-option="1"]').waitFor({ timeout: 10_000 })
    ]);
    audits.push(await auditView(page, 'event', 'expansion_event.png', ['button', 'img']));
    await openMenuAndReturnToLauncher(page, options.url);

    await loadSlotFromLauncher(page, 'UI Smoke Upgrade');
    slotsLoaded.push('UI Smoke Upgrade');
    await page.getByText('选择一张记忆印痕进行强化').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'upgrade', 'expansion_upgrade.png', ['button', 'img']));
    await openMenuAndReturnToLauncher(page, options.url);

    await loadSlotFromLauncher(page, 'UI Smoke Victory');
    slotsLoaded.push('UI Smoke Victory');
    await page.getByText(/行动归档( \/ Victory)?/).waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'victory', 'expansion_victory.png', ['button', 'img']));
    completed = true;
  } catch (error) {
    failedStep = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    const report: SmokeReport = {
      generatedAt: new Date().toISOString(),
      completed,
      failedStep,
      baseUrl: options.url,
      consoleErrors,
      pageErrors,
      failedRequests,
      audits,
      slotsLoaded,
      tutorialChecked
    };
    writeFileSync(path.join(outputDir, 'ui_smoke_expansion_report.json'), JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }

  const totalBrokenImages = audits.reduce((sum, audit) => sum + audit.brokenImages.length, 0);
  const totalLayoutIssues = audits.reduce((sum, audit) => sum + audit.layoutIssues.length, 0);

  if (pageErrors.length > 0 || failedRequests.length > 0 || totalBrokenImages > 0 || totalLayoutIssues > 0) {
    const details = [
      pageErrors.length ? `pageErrors=${pageErrors.length}` : '',
      failedRequests.length ? `failedRequests=${failedRequests.length}` : '',
      totalBrokenImages ? `brokenImages=${totalBrokenImages}` : '',
      totalLayoutIssues ? `layoutIssues=${totalLayoutIssues}` : ''
    ].filter(Boolean).join(', ');
    throw new Error(`UI smoke expansion found issues: ${details}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
