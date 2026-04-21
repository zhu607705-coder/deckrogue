#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createRewardFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface RewardFlowReport {
  baseUrl: string;
  reachedReward: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'reward-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'reward-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createRewardFixture()]);
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

  let reachedReward = false;
  let returnedToMap = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Reward Flow Smoke');
    await page.getByText('选取一张记忆印痕').waitFor({ timeout: 10_000 });
    reachedReward = true;

    const rewardShot = screenshotPath(outputDir, 'reward-start.png');
    await page.screenshot({ path: rewardShot, fullPage: true });
    screenshots.push(rewardShot);

    await page.getByRole('button', { name: '保持当前构筑' }).click();
    await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    returnedToMap = true;

    const mapShot = screenshotPath(outputDir, 'reward-end.png');
    await page.screenshot({ path: mapShot, fullPage: true });
    screenshots.push(mapShot);
  } finally {
    const report: RewardFlowReport = {
      baseUrl,
      reachedReward,
      returnedToMap,
      consoleErrors,
      pageErrors,
      screenshots,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }

  if (!reachedReward || !returnedToMap || pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(`Reward flow smoke failed: reachedReward=${reachedReward} returnedToMap=${returnedToMap} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
