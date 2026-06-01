#!/usr/bin/env node

/**
 * @file playwright_reward_flow_smoke.ts
 * @description 使用 Playwright 测试奖励流程的冒烟测试。
 *
 * 主要职责:
 * - 创建奖励选择测试 fixture
 * - 验证战斗后奖励选择功能
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createFlowSmokeErrorCollector,
  createRewardFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface RewardFlowReport {
  generatedAt: string;
  baseUrl: string;
  reachedReward: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
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

  const errorCollector = createFlowSmokeErrorCollector(page);
  const screenshots: string[] = [];

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
      generatedAt: new Date().toISOString(),
      baseUrl,
      reachedReward,
      returnedToMap,
      consoleErrors: errorCollector.consoleErrors,
      pageErrors: errorCollector.pageErrors,
      failedRequests: errorCollector.failedRequests,
      screenshots,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }

  if (!reachedReward || !returnedToMap || errorCollector.pageErrors.length > 0 || errorCollector.consoleErrors.length > 0 || errorCollector.failedRequests.length > 0) {
    throw new Error(`Reward flow smoke failed: reachedReward=${reachedReward} returnedToMap=${returnedToMap} pageErrors=${errorCollector.pageErrors.length} consoleErrors=${errorCollector.consoleErrors.length} failedRequests=${errorCollector.failedRequests.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
