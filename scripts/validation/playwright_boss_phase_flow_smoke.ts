#!/usr/bin/env node

/**
 * @file playwright_boss_phase_flow_smoke.ts
 * @description 使用 Playwright 测试 Boss 阶段流程的冒烟测试。
 *
 * 主要职责:
 * - 创建 Boss 阶段测试 fixture
 * - 验证 Boss 战斗和阶段效果触发
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createBossPhaseFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface BossPhaseFlowReport {
  baseUrl: string;
  reachedCombat: boolean;
  triggeredPhaseEffect: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'boss-phase-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'boss-phase-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);
  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createBossPhaseFixture()]);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const screenshots: string[] = [];

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  let reachedCombat = false;
  let triggeredPhaseEffect = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Boss Phase Flow');
    await page.getByRole('button', { name: /结束周期/ }).waitFor({ timeout: 10_000 });
    reachedCombat = true;
    const start = screenshotPath(outputDir, 'boss-phase-start.png');
    await page.screenshot({ path: start, fullPage: true });
    screenshots.push(start);

    await page.getByRole('button', { name: /结束周期/ }).click({ force: true });
    await page.waitForTimeout(1200);
    const body = await page.locator('body').innerText();
    triggeredPhaseEffect = body.includes('过热的机械释放灼热冲击') || body.includes('14/20');
    const end = screenshotPath(outputDir, 'boss-phase-end.png');
    await page.screenshot({ path: end, fullPage: true });
    screenshots.push(end);
  } finally {
    const report: BossPhaseFlowReport = { baseUrl, reachedCombat, triggeredPhaseEffect, consoleErrors, pageErrors, screenshots };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (!reachedCombat || !triggeredPhaseEffect || consoleErrors.length || pageErrors.length) {
    throw new Error(`Boss phase flow smoke failed: reachedCombat=${reachedCombat} triggeredPhaseEffect=${triggeredPhaseEffect} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
