#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createEventFixture,
  createRemoveCardFixture,
  createRestFixture,
  createRewardFixture,
  createShopFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface ClickRecord {
  index: number;
  label: string;
  screenBefore: string | null;
  screenAfter: string | null;
}

interface RealUiClicksReport {
  baseUrl: string;
  totalClicks: number;
  clicks: ClickRecord[];
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function getActiveScreen(page: Page): Promise<string | null> {
  return page.locator('[data-screen]').first().getAttribute('data-screen').catch(() => null);
}

async function clickAndRecord(
  page: Page,
  index: number,
  label: string,
  locator: Locator,
  clicks: ClickRecord[],
  postWait?: () => Promise<void>
) {
  const screenBefore = await getActiveScreen(page);
  console.log(`[real-ui-30] click ${index}: ${label} | before=${screenBefore ?? 'unknown'}`);
  await locator.click({ force: true });
  if (postWait) {
    await postWait();
  }
  const screenAfter = await getActiveScreen(page);
  console.log(`[real-ui-30] click ${index}: ${label} | after=${screenAfter ?? 'unknown'}`);
  clicks.push({ index, label, screenBefore, screenAfter });
}

async function waitForLauncher(page: Page) {
  await page.getByText('战区启动器').waitFor({ timeout: 15_000 });
}

async function waitForMap(page: Page) {
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 15_000 });
}

async function waitForRest(page: Page) {
  await page.getByText('篝火据点').waitFor({ timeout: 15_000 });
}

async function waitForShop(page: Page) {
  await page.getByText('军需黑市').waitFor({ timeout: 15_000 });
}

async function waitForEvent(page: Page) {
  await page.getByRole('button', { name: /祈祷/ }).waitFor({ timeout: 15_000 });
}

async function waitForReward(page: Page) {
  await page.getByRole('button', { name: '保持当前构筑' }).waitFor({ timeout: 15_000 });
}

async function waitForCharacterSelect(page: Page) {
  await page.getByRole('button', { name: /开始游戏|Start Game|开始战区部署/ }).waitFor({ timeout: 15_000 }).catch(async () => {
    await page.locator('div.cursor-pointer').first().waitFor({ timeout: 15_000 });
  });
}

async function main() {
  const baseUrl = getDefaultSmokeUrl().replace(/:\d+$/, ':3200');
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'real-ui-30-clicks.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'real-ui-30-clicks');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [
    createRestFixture(),
    createRemoveCardFixture(),
    createShopFixture(),
    createEventFixture(),
    createRewardFixture(),
  ]);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const screenshots: string[] = [];
  const clicks: ClickRecord[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await waitForLauncher(page);

    let i = 1;
    await clickAndRecord(page, i++, '打开教程', page.getByRole('button', { name: /术语、资源与战斗流程|战区教程/ }).first(), clicks, async () => {
      await page.getByText('术语索引').first().waitFor({ timeout: 15_000 });
    });
    await clickAndRecord(page, i++, '关闭教程', page.getByRole('button', { name: /返回当前界面|关闭教程/ }).first(), clicks, async () => {
      await page.waitForTimeout(300);
    });

    await clickAndRecord(page, i++, '点击开始新战区', page.getByRole('button', { name: /开始新战区|New Expedition/i }).first(), clicks, async () => {
      await waitForCharacterSelect(page);
    });
    const informantCard = page.locator('[data-character-id="informant"]').first();
    await clickAndRecord(page, i++, '点击 Informant 角色卡', informantCard, clicks, async () => {
      await waitForMap(page);
    });
    await clickAndRecord(page, i++, '打开菜单', page.getByRole('button', { name: '菜单' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '战区教程' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '菜单内打开教程', page.getByRole('button', { name: '战区教程' }).first(), clicks, async () => {
      await page.getByText('术语索引').first().waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '教程内关闭', page.getByRole('button', { name: /返回当前界面|关闭教程/ }).first(), clicks, async () => {
      await page.waitForTimeout(300);
    });
    await clickAndRecord(page, i++, '重新打开菜单', page.getByRole('button', { name: '菜单' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '主题与视觉' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '菜单内打开主题与视觉', page.getByRole('button', { name: '主题与视觉' }).first(), clicks, async () => {
      await page.getByText('色彩模式').first().waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '切换亮色', page.getByRole('button', { name: /亮色/ }).first(), clicks, async () => {
      await page.waitForTimeout(250);
    });
    await clickAndRecord(page, i++, '切换暗色', page.getByRole('button', { name: /暗色/ }).first(), clicks, async () => {
      await page.waitForTimeout(250);
    });
    await clickAndRecord(page, i++, '主题页返回', page.getByRole('button', { name: '← 返回' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '键位设置' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '菜单内打开存档读取', page.getByRole('button', { name: '存档 / 读取' }).first(), clicks, async () => {
      await page.getByText('快速存档').first().waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '存档页返回', page.getByRole('button', { name: '← 返回' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '键位设置' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '菜单内打开键位设置', page.getByRole('button', { name: '键位设置' }).first(), clicks, async () => {
      await page.getByText('恢复默认').first().waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '键位恢复默认', page.getByText('恢复默认').first(), clicks, async () => {
      await page.waitForTimeout(250);
    });
    await clickAndRecord(page, i++, '键位页返回', page.getByRole('button', { name: '← 返回' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '返回启动器' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '返回启动器', page.getByRole('button', { name: '返回启动器' }).first(), clicks, async () => {
      await waitForLauncher(page);
    });

    await clickAndRecord(page, i++, '读取 Rest fixture', page.getByText('Rest Flow Smoke').locator('xpath=ancestor::div[.//button[normalize-space()="读取"]][1]').getByRole('button', { name: '读取' }), clicks, async () => {
      await waitForRest(page);
    });
    await clickAndRecord(page, i++, '点击休整', page.getByRole('button', { name: /休整/ }), clicks, async () => {
      await waitForMap(page);
    });
    await clickAndRecord(page, i++, '打开菜单 2', page.getByRole('button', { name: '菜单' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '返回启动器' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '再次返回启动器', page.getByRole('button', { name: '返回启动器' }).first(), clicks, async () => {
      await waitForLauncher(page);
    });

    await clickAndRecord(page, i++, '读取 Shop fixture', page.getByText('Shop Flow Smoke').locator('xpath=ancestor::div[.//button[normalize-space()="读取"]][1]').getByRole('button', { name: '读取' }), clicks, async () => {
      await waitForShop(page);
    });
    const enchantButton = page.getByText('附魔服务').locator('xpath=ancestor::button[1]').first();
    await clickAndRecord(page, i++, '点击附魔服务', enchantButton, clicks, async () => {
      await page.locator('[data-keyboard-close="true"]').first().waitFor({ timeout: 15_000 });
    });
    await clickAndRecord(page, i++, '关闭附魔界面', page.locator('[data-keyboard-close="true"]').first(), clicks, async () => {
      await waitForShop(page);
    });
    await clickAndRecord(page, i++, '离开据点', page.getByRole('button', { name: '离开据点' }), clicks, async () => {
      await waitForMap(page);
    });
    await clickAndRecord(page, i++, '打开菜单 3', page.getByRole('button', { name: '菜单' }).first(), clicks, async () => {
      await page.getByRole('button', { name: '返回启动器' }).waitFor({ timeout: 10_000 });
    });
    await clickAndRecord(page, i++, '第三次返回启动器', page.getByRole('button', { name: '返回启动器' }).first(), clicks, async () => {
      await waitForLauncher(page);
    });

    await clickAndRecord(page, i++, '读取 Reward fixture', page.getByText('Reward Flow Smoke').locator('xpath=ancestor::div[.//button[normalize-space()="读取"]][1]').getByRole('button', { name: '读取' }), clicks, async () => {
      await waitForReward(page);
    });
    await clickAndRecord(page, i++, '点击保持当前构筑', page.getByRole('button', { name: '保持当前构筑' }), clicks, async () => {
      await waitForMap(page);
    });

    if (clicks.length !== 30) {
      throw new Error(`Expected 30 UI clicks, got ${clicks.length}`);
    }

    const finalShot = screenshotPath(outputDir, 'final-state.png');
    await page.screenshot({ path: finalShot, fullPage: true });
    screenshots.push(finalShot);
  } finally {
    const report: RealUiClicksReport = {
      baseUrl,
      totalClicks: clicks.length,
      clicks,
      consoleErrors,
      pageErrors,
      screenshots,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(`real-ui-30-clicks reported console/page errors: console=${consoleErrors.length} page=${pageErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
