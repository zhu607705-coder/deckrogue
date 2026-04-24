#!/usr/bin/env node

/**
 * @file playwright_real_ui_30_clicks.ts
 * @description 使用 Playwright 运行真实 UI 的 30 次点击压力测试。
 *
 * 主要职责:
 * - 启动开发服务器并运行浏览器
 * - 模拟 30 次用户点击操作
 * - 验证 UI 响应性和稳定性
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createBossPhaseFixture,
  createEventFixture,
  createGameOverFixture,
  createRemoveCardFixture,
  createRestFixture,
  createRewardFixture,
  createShopFixture,
  createVictoryFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
  type SaveSlotFixture,
} from './flow_smoke_helpers';

interface UiIssue {
  selector: string;
  problem: string;
  detail: string;
}

interface VisualAudit {
  scenario: number;
  name: string;
  activeScreen: string | null;
  screenshot: string;
  brokenImages: UiIssue[];
  layoutIssues: UiIssue[];
}

interface ScenarioResult {
  index: number;
  name: string;
  specialty: string;
  status: 'pass' | 'fail';
  clicks: string[];
  screenshot?: string;
  activeScreen?: string | null;
  error?: string;
  durationMs: number;
}

interface ScenarioContext {
  page: Page;
  baseUrl: string;
  click: (label: string, locator: Locator) => Promise<void>;
}

interface ScenarioDefinition {
  name: string;
  specialty: string;
  viewport?: { width: number; height: number };
  fixtures?: () => SaveSlotFixture[];
  action: (ctx: ScenarioContext) => Promise<void>;
}

interface RealUi30ClicksReport {
  baseUrl: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  totalClicks: number;
  startedAt: string;
  completedAt: string;
  results: ScenarioResult[];
  visualAudits: VisualAudit[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

const DESKTOP = { width: 1440, height: 960 };
const TABLET = { width: 1024, height: 768 };
const MOBILE = { width: 390, height: 844 };

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: getDefaultSmokeUrl(),
    headed: false,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

function appendQuery(url: string, query: string): string {
  const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${normalized}/${query.startsWith('?') ? query : `?${query}`}`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

async function getActiveScreen(page: Page): Promise<string | null> {
  return page.locator('[data-screen]').first().getAttribute('data-screen').catch(() => null);
}

async function waitForLauncher(page: Page) {
  await page.getByText('战区启动器').waitFor({ timeout: 15_000 });
}

async function waitForMap(page: Page) {
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 15_000 });
}

async function waitForCombat(page: Page) {
  await page.locator('.enemy-standee, .player-standee').first().waitFor({ timeout: 15_000 });
}

async function waitForCharacterSelect(page: Page) {
  await page.getByText('选择你的执行体').waitFor({ timeout: 15_000 });
}

async function waitForShop(page: Page) {
  await page.getByText(/黑市拾荒者|军需黑市/).waitFor({ timeout: 15_000 });
}

async function waitForRest(page: Page) {
  await page.getByText('篝火据点').waitFor({ timeout: 15_000 });
}

async function waitForReward(page: Page) {
  await page.getByRole('button', { name: '保持当前构筑' }).waitFor({ timeout: 15_000 });
}

async function waitForRuntimeV2Map(page: Page, renderer: 'dom' | 'pixi') {
  await page.locator(`[data-screen="Map"][data-renderer="${renderer}"]`).waitFor({ timeout: 30_000 });
}

async function openLegacyRun(ctx: ScenarioContext, characterId = 'informant') {
  await ctx.page.goto(ctx.baseUrl, { waitUntil: 'networkidle' });
  await waitForLauncher(ctx.page);
  await ctx.click('launcher: start new run', ctx.page.getByRole('button', { name: /开始新战区|New Run/i }).first());
  await waitForCharacterSelect(ctx.page);
  await ctx.click(`character select: ${characterId}`, ctx.page.locator(`[data-character-id="${characterId}"]`).first());
  if (await ctx.page.getByRole('button', { name: /开始战区部署|Start Game|开始游戏/i }).count()) {
    await ctx.click('character select: deploy', ctx.page.getByRole('button', { name: /开始战区部署|Start Game|开始游戏/i }).first());
  }
  await waitForMap(ctx.page);
}

async function enterFirstCombat(ctx: ScenarioContext) {
  const combatNode = ctx.page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗/i }).first();
  if (await combatNode.count()) {
    await ctx.click('map: enter combat node', combatNode);
  } else {
    await ctx.click('map: enter first available node', ctx.page.locator('button[data-node-id]:not([disabled])').first());
  }
  await waitForCombat(ctx.page);
}

async function dismissCombatTutorial(ctx: ScenarioContext) {
  const acknowledge = ctx.page.getByRole('button', { name: '知道了' }).first();
  if (await acknowledge.count()) {
    await ctx.click('combat: dismiss tutorial', acknowledge);
    await ctx.page.waitForTimeout(250);
  }
}

async function waitForPlayerTurn(page: Page) {
  await page.waitForFunction(() => {
    const marker = document.querySelector('[data-keyboard-end-turn="true"]') as HTMLButtonElement | null;
    return Boolean(marker) && !marker.disabled;
  }, undefined, { timeout: 15_000 });
}

async function playFirstPlayableCard(ctx: ScenarioContext) {
  await waitForPlayerTurn(ctx.page);
  const cards = ctx.page.locator('[data-keyboard-card]');
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const className = (await card.getAttribute('class')) || '';
    const disabled = await card.getAttribute('aria-disabled');
    if (className.includes('is-disabled') || disabled === 'true') continue;
    await ctx.click(`combat: play card ${index + 1}`, card);
    const target = ctx.page.locator('[data-keyboard-target="true"]').first();
    if (await target.count()) {
      await ctx.click('combat: target enemy', target);
    }
    await ctx.page.waitForTimeout(300);
    return;
  }
  throw new Error('No playable card found.');
}

async function openMenuSubpage(ctx: ScenarioContext, name: string) {
  await ctx.click('menu: open', ctx.page.getByRole('button', { name: '菜单' }).first());
  await ctx.click(`menu: ${name}`, ctx.page.getByRole('button', { name }).first());
  await ctx.page.getByText(name).first().waitFor({ timeout: 10_000 });
}

async function backFromSubpage(ctx: ScenarioContext) {
  await ctx.click('menu: subpage back', ctx.page.getByRole('button', { name: '← 返回' }).first());
}

async function quickSaveFromMap(ctx: ScenarioContext) {
  await openMenuSubpage(ctx, '存档 / 读取');
  await ctx.click('save: quick save', ctx.page.getByRole('button', { name: '快速存档' }).first());
  await ctx.page.waitForTimeout(300);
}

async function returnToLauncherFromMenu(ctx: ScenarioContext) {
  await ctx.click('menu: open for launcher return', ctx.page.getByRole('button', { name: '菜单' }).first());
  await ctx.click('menu: return launcher', ctx.page.getByRole('button', { name: '返回启动器' }).first());
  await waitForLauncher(ctx.page);
}

async function returnToLauncherAfterQuickSave(ctx: ScenarioContext) {
  if (await ctx.page.getByRole('button', { name: '← 返回' }).count()) {
    await backFromSubpage(ctx);
    await ctx.click('menu: return launcher', ctx.page.getByRole('button', { name: '返回启动器' }).first());
  } else {
    await returnToLauncherFromMenu(ctx);
    return;
  }
  await waitForLauncher(ctx.page);
}

async function loadFixtureSlot(ctx: ScenarioContext, slotName: string) {
  await ctx.page.goto(ctx.baseUrl, { waitUntil: 'networkidle' });
  await waitForLauncher(ctx.page);
  const slotCard = ctx.page.getByText(slotName).locator('xpath=ancestor::div[.//button[normalize-space()="读取"]][1]');
  await slotCard.scrollIntoViewIfNeeded();
  await ctx.click(`launcher: load ${slotName}`, slotCard.getByRole('button', { name: '读取' }));
}

async function auditVisual(page: Page, index: number, name: string, outputDir: string): Promise<VisualAudit> {
  await page.waitForTimeout(150);
  const screenshot = screenshotPath(outputDir, `${String(index).padStart(2, '0')}-${slugify(name)}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const auditScript = new Function(`
    const activeRoot = document.querySelector('[data-screen]') || document;
    const queryAll = (selector) => Array.from(activeRoot.querySelectorAll(selector));
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const intersectsViewport = rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight;
      return rect.width > 0 && rect.height > 0 && intersectsViewport && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') > 0.02;
    };
    const issueFor = (selector, problem, detail) => ({ selector, problem, detail });
    const brokenImages = queryAll('img')
      .filter((img) => isVisible(img) && img.naturalWidth === 0)
      .map((img) => issueFor('img', 'broken-image', img.currentSrc || img.src || img.alt || 'unknown'));
    const layoutIssues = [];
    const selectors = ['button', '[role="button"]', 'a', 'input', 'select', 'textarea', '.campaign-choice', '.immersive-card', '.enemy-standee', '.player-standee', '[data-screen]'];
    for (const selector of selectors) {
      const elements = queryAll(selector).slice(0, 40);
      for (const el of elements) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) {
          layoutIssues.push(issueFor(selector, 'zero-sized', Math.round(rect.width) + 'x' + Math.round(rect.height)));
        }
        const isPannableDisabledMapNode = el.matches('button[data-node-id][disabled]');
        if (!isPannableDisabledMapNode && (rect.right > window.innerWidth + 24 || rect.left < -24)) {
          layoutIssues.push(issueFor(selector, 'viewport-overflow', JSON.stringify({
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            viewport: [window.innerWidth, window.innerHeight],
          })));
        }
        const tag = el.tagName.toLowerCase();
        if ((tag === 'button' || el.getAttribute('role') === 'button') && !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) {
          layoutIssues.push(issueFor(selector, 'empty-control-label', el.outerHTML.slice(0, 160)));
        }
      }
    }
    const overflowNode = activeRoot instanceof HTMLElement ? activeRoot : document.documentElement;
    if (overflowNode.scrollWidth > window.innerWidth + 24) {
      layoutIssues.push(issueFor('document', 'horizontal-overflow', overflowNode.scrollWidth + ' > ' + window.innerWidth));
    }
    return { brokenImages, layoutIssues };
  `);
  const audit = await page.evaluate(auditScript as never) as { brokenImages: UiIssue[]; layoutIssues: UiIssue[] };
  return {
    scenario: index,
    name,
    activeScreen: await getActiveScreen(page),
    screenshot,
    brokenImages: audit.brokenImages,
    layoutIssues: audit.layoutIssues,
  };
}

function buildScenarios(): ScenarioDefinition[] {
  return [
    {
      name: 'launcher tutorial opens on desktop',
      specialty: 'Launcher tutorial modal',
      action: async (ctx) => {
        await ctx.page.goto(ctx.baseUrl, { waitUntil: 'networkidle' });
        await waitForLauncher(ctx.page);
        await ctx.click('launcher: open tutorial', ctx.page.getByRole('button', { name: /术语、资源与战斗流程|战区教程/ }).first());
        await ctx.page.getByText('术语索引').first().waitFor({ timeout: 10_000 });
      },
    },
    {
      name: 'launcher tutorial closes cleanly',
      specialty: 'Tutorial close control',
      action: async (ctx) => {
        await ctx.page.goto(ctx.baseUrl, { waitUntil: 'networkidle' });
        await waitForLauncher(ctx.page);
        await ctx.click('launcher: open tutorial', ctx.page.getByRole('button', { name: /术语、资源与战斗流程|战区教程/ }).first());
        await ctx.page.getByText('术语索引').first().waitFor({ timeout: 10_000 });
        await ctx.click('tutorial: close', ctx.page.getByRole('button', { name: /返回当前界面|关闭教程/ }).first());
        await waitForLauncher(ctx.page);
      },
    },
    {
      name: 'launcher tablet layout tutorial',
      specialty: 'Tablet layout',
      viewport: TABLET,
      action: async (ctx) => {
        await ctx.page.goto(ctx.baseUrl, { waitUntil: 'networkidle' });
        await waitForLauncher(ctx.page);
        await ctx.click('tablet: open tutorial', ctx.page.getByRole('button', { name: /术语、资源与战斗流程|战区教程/ }).first());
        await ctx.page.getByText('术语索引').first().waitFor({ timeout: 10_000 });
      },
    },
    {
      name: 'launcher mobile layout tutorial',
      specialty: 'Mobile layout',
      viewport: MOBILE,
      action: async (ctx) => {
        await ctx.page.goto(ctx.baseUrl, { waitUntil: 'networkidle' });
        await waitForLauncher(ctx.page);
        await ctx.click('mobile: open tutorial', ctx.page.getByRole('button', { name: /术语、资源与战斗流程|战区教程/ }).first());
        await ctx.page.getByText('术语索引').first().waitFor({ timeout: 10_000 });
      },
    },
    {
      name: 'new run informant reaches map',
      specialty: 'Character selection Informant',
      action: (ctx) => openLegacyRun(ctx, 'informant'),
    },
    {
      name: 'new run brute reaches map',
      specialty: 'Character selection Brute',
      action: (ctx) => openLegacyRun(ctx, 'brute'),
    },
    {
      name: 'new run alchemist reaches map',
      specialty: 'Character selection Alchemist',
      action: (ctx) => openLegacyRun(ctx, 'alchemist'),
    },
    {
      name: 'map first node enters combat',
      specialty: 'Map node click',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'brute');
        await enterFirstCombat(ctx);
      },
    },
    {
      name: 'combat tutorial acknowledge',
      specialty: 'Combat tutorial prompt',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await enterFirstCombat(ctx);
        await dismissCombatTutorial(ctx);
      },
    },
    {
      name: 'combat play card and target',
      specialty: 'Combat card targeting',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await enterFirstCombat(ctx);
        await dismissCombatTutorial(ctx);
        await playFirstPlayableCard(ctx);
      },
    },
    {
      name: 'combat end turn',
      specialty: 'Combat end-turn control',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'brute');
        await enterFirstCombat(ctx);
        await dismissCombatTutorial(ctx);
        await ctx.click('combat: end turn', ctx.page.locator('[data-keyboard-end-turn="true"], button:has-text("结束周期")').first());
        await ctx.page.waitForTimeout(800);
      },
    },
    {
      name: 'map menu opens',
      specialty: 'Global menu shell',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await ctx.click('menu: open', ctx.page.getByRole('button', { name: '菜单' }).first());
        await ctx.page.getByRole('button', { name: '返回启动器' }).waitFor({ timeout: 10_000 });
      },
    },
    {
      name: 'menu theme panel opens',
      specialty: 'Theme menu panel',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await openMenuSubpage(ctx, '主题与视觉');
      },
    },
    {
      name: 'theme toggles light and dark',
      specialty: 'Theme switching',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await openMenuSubpage(ctx, '主题与视觉');
        await ctx.click('theme: light', ctx.page.getByRole('button', { name: /亮色/ }).first());
        await ctx.click('theme: dark', ctx.page.getByRole('button', { name: /暗色/ }).first());
      },
    },
    {
      name: 'save menu quick save',
      specialty: 'Quick save',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await quickSaveFromMap(ctx);
      },
    },
    {
      name: 'keybind menu restore defaults',
      specialty: 'Keybind settings',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await openMenuSubpage(ctx, '键位设置');
        await ctx.click('keybinds: restore defaults', ctx.page.getByText('恢复默认').first());
      },
    },
    {
      name: 'continue after quick save',
      specialty: 'Continue run',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await quickSaveFromMap(ctx);
        await returnToLauncherAfterQuickSave(ctx);
        await ctx.click('launcher: continue', ctx.page.getByRole('button', { name: /继续作战/i }).first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'load saved slot from launcher',
      specialty: 'Manual save load',
      action: async (ctx) => {
        await openLegacyRun(ctx, 'informant');
        await quickSaveFromMap(ctx);
        await returnToLauncherAfterQuickSave(ctx);
        const loadButton = ctx.page.getByRole('button', { name: '读取' }).first();
        await ctx.click('launcher: load first slot', loadButton);
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'reward skip returns map',
      specialty: 'Reward skip',
      fixtures: () => [createRewardFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Reward Flow Smoke');
        await waitForReward(ctx.page);
        await ctx.click('reward: keep current build', ctx.page.getByRole('button', { name: '保持当前构筑' }).first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'reward pick first card',
      specialty: 'Reward card pick',
      fixtures: () => [createRewardFixture(5301)],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Reward Flow Smoke');
        await waitForReward(ctx.page);
        await ctx.click('reward: pick option 1', ctx.page.locator('.reward-view__draftStage [data-keyboard-option="1"]').first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'shop enchant opens and closes',
      specialty: 'Shop enchant service',
      fixtures: () => [createShopFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Shop Flow Smoke');
        await waitForShop(ctx.page);
        await ctx.click('shop: enchant service', ctx.page.getByText('附魔服务').locator('xpath=ancestor::button[1]').first());
        await ctx.page.locator('[data-keyboard-close="true"]').first().waitFor({ timeout: 10_000 });
        await ctx.click('shop: close enchant', ctx.page.locator('[data-keyboard-close="true"]').first());
        await waitForShop(ctx.page);
      },
    },
    {
      name: 'shop leave returns map',
      specialty: 'Shop exit',
      fixtures: () => [createShopFixture(5302)],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Shop Flow Smoke');
        await waitForShop(ctx.page);
        await ctx.click('shop: leave', ctx.page.getByRole('button', { name: '离开据点' }).first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'event prayer choice returns map',
      specialty: 'Event choice',
      fixtures: () => [createEventFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Event Flow Smoke');
        await ctx.page.getByText('无名神龛').waitFor({ timeout: 10_000 });
        await ctx.click('event: prayer', ctx.page.getByRole('button', { name: /祈祷/ }).first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'rest heal returns map',
      specialty: 'Rest heal',
      fixtures: () => [createRestFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Rest Flow Smoke');
        await waitForRest(ctx.page);
        await ctx.click('rest: heal', ctx.page.getByRole('button', { name: /休整/ }).first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'rest upgrade card returns map',
      specialty: 'Card upgrade',
      fixtures: () => [createRestFixture(5303)],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Rest Flow Smoke');
        await waitForRest(ctx.page);
        await ctx.click('rest: forge', ctx.page.getByRole('button', { name: /锻造/ }).first());
        await ctx.page.getByText('选择一张记忆印痕进行强化').waitFor({ timeout: 10_000 });
        await ctx.click('upgrade: first card', ctx.page.locator('.immersive-card').first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'rest remove card returns map',
      specialty: 'Card removal',
      fixtures: () => [createRemoveCardFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Remove Card Flow Smoke');
        await waitForRest(ctx.page);
        await ctx.click('rest: remove', ctx.page.getByRole('button', { name: /驱散/ }).first());
        await ctx.page.getByText('焚毁记忆印痕').waitFor({ timeout: 10_000 });
        await ctx.click('remove: first card', ctx.page.locator('[data-keyboard-option="1"]').first());
        await waitForMap(ctx.page);
      },
    },
    {
      name: 'victory terminal restarts run',
      specialty: 'Victory terminal',
      fixtures: () => [createVictoryFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Terminal Flow Victory');
        await ctx.page.getByText('行动归档').waitFor({ timeout: 10_000 });
        await ctx.click('victory: new run', ctx.page.getByRole('button', { name: '再来一局' }).first());
        await waitForCharacterSelect(ctx.page);
      },
    },
    {
      name: 'gameover terminal restarts run',
      specialty: 'Game over terminal',
      fixtures: () => [createGameOverFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Terminal Flow GameOver');
        await ctx.page.getByText('执行失败 (MIA/KIA)').waitFor({ timeout: 10_000 });
        await ctx.click('gameover: next sacrifice', ctx.page.getByRole('button', { name: '派遣下一任牺牲者' }).first());
        await waitForCharacterSelect(ctx.page);
      },
    },
    {
      name: 'boss phase end turn effect',
      specialty: 'Boss phase trigger',
      fixtures: () => [createBossPhaseFixture()],
      action: async (ctx) => {
        await loadFixtureSlot(ctx, 'Boss Phase Flow');
        await waitForCombat(ctx.page);
        await ctx.click('boss: end turn', ctx.page.getByRole('button', { name: /结束周期/ }).first());
        await ctx.page.waitForTimeout(1200);
        const body = await ctx.page.locator('body').innerText();
        if (!body.includes('过热的机械释放灼热冲击') && !body.includes('14/20')) {
          throw new Error('Boss phase effect did not appear after ending turn.');
        }
      },
    },
    {
      name: 'runtime v2 dom reaches map',
      specialty: 'Runtime V2 DOM path',
      action: async (ctx) => {
        await ctx.page.goto(appendQuery(ctx.baseUrl, 'runtimeV2=1&adapter=python-wasm&renderer=dom&seed=2468'), { waitUntil: 'networkidle' });
        await ctx.page.getByText('Launch Runtime V2').waitFor({ timeout: 10_000 });
        await ctx.click('runtime-v2: start new run', ctx.page.getByRole('button', { name: /开始新局|Start New Run/ }).first());
        await ctx.page.locator('[data-screen="CharacterSelect"]').waitFor({ timeout: 30_000 });
        await ctx.click('runtime-v2: select informant', ctx.page.locator('button[data-character-id="informant"]').first());
        await waitForRuntimeV2Map(ctx.page, 'dom');
      },
    },
  ];
}

async function runScenario(
  browser: Browser,
  baseUrl: string,
  outputDir: string,
  index: number,
  scenario: ScenarioDefinition,
  report: RealUi30ClicksReport
): Promise<ScenarioResult> {
  const started = Date.now();
  const clicks: string[] = [];
  const context: BrowserContext = await browser.newContext({ viewport: scenario.viewport ?? DESKTOP });
  if (scenario.fixtures) {
    await bootstrapContext(context, scenario.fixtures());
  }
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(`[${scenario.name}] ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(`[${scenario.name}] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'unknown';
    if (!errorText.includes('ERR_ABORTED')) {
      report.failedRequests.push(`[${scenario.name}] ${request.resourceType()} ${request.url()} ${errorText}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      report.failedRequests.push(`[${scenario.name}] ${response.request().resourceType()} ${response.url()} HTTP ${response.status()}`);
    }
  });

  const click = async (label: string, locator: Locator) => {
    console.log(`[real-ui-30-clicks] ${index}/30 ${scenario.name}: ${label}`);
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ force: true });
    clicks.push(label);
  };

  try {
    await scenario.action({ page, baseUrl, click });
    const visualAudit = await auditVisual(page, index, scenario.name, outputDir);
    report.visualAudits.push(visualAudit);
    if (visualAudit.brokenImages.length || visualAudit.layoutIssues.length) {
      throw new Error(
        `visual issues: brokenImages=${visualAudit.brokenImages.length} layoutIssues=${visualAudit.layoutIssues.length}`
      );
    }
    return {
      index,
      name: scenario.name,
      specialty: scenario.specialty,
      status: 'pass',
      clicks,
      screenshot: visualAudit.screenshot,
      activeScreen: visualAudit.activeScreen,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const screenshot = screenshotPath(outputDir, `${String(index).padStart(2, '0')}-${slugify(scenario.name)}-failed.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    return {
      index,
      name: scenario.name,
      specialty: scenario.specialty,
      status: 'fail',
      clicks,
      screenshot,
      activeScreen: await getActiveScreen(page).catch(() => null),
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'real-ui-30-clicks.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'real-ui-30-clicks');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  const scenarios = buildScenarios();
  if (scenarios.length !== 30) {
    throw new Error(`Expected 30 scenarios, got ${scenarios.length}`);
  }

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(options.url)) {
    devServer = spawnDevServer(options.url);
    await waitForServer(options.url);
  }

  const report: RealUi30ClicksReport = {
    baseUrl: options.url,
    totalScenarios: 0,
    passedScenarios: 0,
    failedScenarios: 0,
    totalClicks: 0,
    startedAt: new Date().toISOString(),
    completedAt: '',
    results: [],
    visualAudits: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  const browser = await chromium.launch({ headless: !options.headed });
  try {
    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index];
      const result = await runScenario(browser, options.url, outputDir, index + 1, scenario, report);
      report.results.push(result);
      report.totalClicks += result.clicks.length;
      report.totalScenarios = report.results.length;
      report.passedScenarios = report.results.filter((entry) => entry.status === 'pass').length;
      report.failedScenarios = report.results.filter((entry) => entry.status === 'fail').length;
      writeFileSync(reportPath, JSON.stringify({ ...report, completedAt: new Date().toISOString() }, null, 2));
      console.log(
        `[real-ui-30-clicks] ${index + 1}/30 ${scenario.name}: ${result.status} (${result.durationMs}ms, clicks=${result.clicks.length})`
      );
      if (result.status === 'fail') break;
    }
  } finally {
    report.completedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (
    report.results.length !== 30 ||
    report.failedScenarios > 0 ||
    report.consoleErrors.length ||
    report.pageErrors.length ||
    report.failedRequests.length
  ) {
    const failed = report.results.find((entry) => entry.status === 'fail');
    throw new Error(
      `real-ui-30-clicks failed: completed=${report.results.length}/30 failed=${failed?.name ?? 'none'} console=${report.consoleErrors.length} page=${report.pageErrors.length} requests=${report.failedRequests.length}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
