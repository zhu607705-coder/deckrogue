#!/usr/bin/env node

/**
 * @file playwright_event_flow_smoke.ts
 * @description 使用 Playwright 测试事件流程的冒烟测试。
 *
 * 主要职责:
 * - 创建事件测试 fixture
 * - 验证事件触发、选择和解决
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createEventFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface EventFlowReport {
  baseUrl: string;
  reachedEvent: boolean;
  resolvedEvent: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'event-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'event-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createEventFixture()]);
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

  let reachedEvent = false;
  let resolvedEvent = false;
  let returnedToMap = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Event Flow Smoke');
    await page.getByText('无名神龛').waitFor({ timeout: 10_000 });
    reachedEvent = true;
    const eventStart = screenshotPath(outputDir, 'event-start.png');
    await page.screenshot({ path: eventStart, fullPage: true });
    screenshots.push(eventStart);

    await page.getByRole('button', { name: /祈祷/ }).click();
    resolvedEvent = true;
    await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    returnedToMap = true;
    const map = screenshotPath(outputDir, 'event-end.png');
    await page.screenshot({ path: map, fullPage: true });
    screenshots.push(map);
  } finally {
    const report: EventFlowReport = {
      baseUrl,
      reachedEvent,
      resolvedEvent,
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

  if (!reachedEvent || !resolvedEvent || !returnedToMap || pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(`Event flow smoke failed: reachedEvent=${reachedEvent} resolvedEvent=${resolvedEvent} returnedToMap=${returnedToMap} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
