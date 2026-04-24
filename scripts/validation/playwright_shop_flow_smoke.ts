#!/usr/bin/env node

/**
 * @file playwright_shop_flow_smoke.ts
 * @description 使用 Playwright 测试商店流程的冒烟测试。
 *
 * 主要职责:
 * - 创建商店测试 fixture
 * - 验证商店购买和移除功能
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createShopFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface ShopFlowReport {
  baseUrl: string;
  reachedShop: boolean;
  reachedEnchant: boolean;
  returnedToShop: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'shop-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'shop-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createShopFixture()]);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const screenshots: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  let reachedShop = false;
  let reachedEnchant = false;
  let returnedToShop = false;
  let returnedToMap = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Shop Flow Smoke');
    await page.getByText('黑市拾荒者').waitFor({ timeout: 10_000 });
    reachedShop = true;
    const shopStart = screenshotPath(outputDir, 'shop-start.png');
    await page.screenshot({ path: shopStart, fullPage: true });
    screenshots.push(shopStart);

    const enchantButton = page.getByText('附魔服务').locator('xpath=ancestor::button[1]').first();
    await enchantButton.scrollIntoViewIfNeeded();
    await enchantButton.click({ force: true });
    await Promise.race([
      page.getByText('黑市附魔').waitFor({ timeout: 10_000 }),
      page.getByText('选择一张牌接受附魔').waitFor({ timeout: 10_000 }),
    ]);
    reachedEnchant = true;
    const enchant = screenshotPath(outputDir, 'shop-enchant.png');
    await page.screenshot({ path: enchant, fullPage: true });
    screenshots.push(enchant);

    await page.locator('[data-keyboard-close="true"]').first().click({ force: true });
    await page.getByText('黑市拾荒者').waitFor({ timeout: 10_000 });
    returnedToShop = true;

    await page.getByRole('button', { name: '离开据点' }).click();
    await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    returnedToMap = true;
    const map = screenshotPath(outputDir, 'shop-end.png');
    await page.screenshot({ path: map, fullPage: true });
    screenshots.push(map);
  } finally {
    const report: ShopFlowReport = {
      baseUrl,
      reachedShop,
      reachedEnchant,
      returnedToShop,
      returnedToMap,
      consoleErrors,
      pageErrors,
      screenshots,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (!reachedShop || !reachedEnchant || !returnedToShop || !returnedToMap || pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(`Shop flow smoke failed: reachedShop=${reachedShop} reachedEnchant=${reachedEnchant} returnedToShop=${returnedToShop} returnedToMap=${returnedToMap} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
