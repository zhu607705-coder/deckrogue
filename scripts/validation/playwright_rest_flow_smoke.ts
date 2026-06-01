#!/usr/bin/env node

/**
 * @file playwright_rest_flow_smoke.ts
 * @description 使用 Playwright 测试休息点流程的冒烟测试。
 *
 * 主要职责:
 * - 创建休息点测试 fixture
 * - 验证休息和治疗功能
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createFlowSmokeErrorCollector,
  createRestFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface RestFlowReport {
  generatedAt: string;
  baseUrl: string;
  reachedRest: boolean;
  healed: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'rest-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'rest-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);
  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createRestFixture()]);
  const page = await context.newPage();
  const errorCollector = createFlowSmokeErrorCollector(page);
  const screenshots: string[] = [];

  let reachedRest = false;
  let healed = false;
  let returnedToMap = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Rest Flow Smoke');
    await page.getByText('篝火据点').waitFor({ timeout: 10_000 });
    reachedRest = true;
    const start = screenshotPath(outputDir, 'rest-start.png');
    await page.screenshot({ path: start, fullPage: true });
    screenshots.push(start);

    await page.getByRole('button', { name: /休整/ }).click();
    healed = true;
    await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    returnedToMap = true;
    const end = screenshotPath(outputDir, 'rest-end.png');
    await page.screenshot({ path: end, fullPage: true });
    screenshots.push(end);
  } finally {
    const report: RestFlowReport = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      reachedRest,
      healed,
      returnedToMap,
      consoleErrors: errorCollector.consoleErrors,
      pageErrors: errorCollector.pageErrors,
      failedRequests: errorCollector.failedRequests,
      screenshots,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (!reachedRest || !healed || !returnedToMap || errorCollector.consoleErrors.length || errorCollector.pageErrors.length || errorCollector.failedRequests.length) {
    throw new Error(`Rest flow smoke failed: reachedRest=${reachedRest} healed=${healed} returnedToMap=${returnedToMap} pageErrors=${errorCollector.pageErrors.length} consoleErrors=${errorCollector.consoleErrors.length} failedRequests=${errorCollector.failedRequests.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
