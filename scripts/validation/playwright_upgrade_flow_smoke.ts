#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createRestFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface UpgradeFlowReport {
  baseUrl: string;
  reachedRest: boolean;
  reachedUpgrade: boolean;
  appliedUpgrade: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'upgrade-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'upgrade-flow-smoke');
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
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const screenshots: string[] = [];

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  let reachedRest = false;
  let reachedUpgrade = false;
  let appliedUpgrade = false;
  let returnedToMap = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Rest Flow Smoke');
    await page.getByText('篝火据点').waitFor({ timeout: 10_000 });
    reachedRest = true;
    await page.getByRole('button', { name: /锻造/ }).click();
    await page.getByText('选择一张记忆印痕进行强化').waitFor({ timeout: 10_000 });
    reachedUpgrade = true;
    const start = screenshotPath(outputDir, 'upgrade-start.png');
    await page.screenshot({ path: start, fullPage: true });
    screenshots.push(start);

    await page.locator('.immersive-card').first().click({ force: true });
    appliedUpgrade = true;
    await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
    returnedToMap = true;
    const end = screenshotPath(outputDir, 'upgrade-end.png');
    await page.screenshot({ path: end, fullPage: true });
    screenshots.push(end);
  } finally {
    const report: UpgradeFlowReport = { baseUrl, reachedRest, reachedUpgrade, appliedUpgrade, returnedToMap, consoleErrors, pageErrors, screenshots };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (!reachedRest || !reachedUpgrade || !appliedUpgrade || !returnedToMap || consoleErrors.length || pageErrors.length) {
    throw new Error(`Upgrade flow smoke failed: reachedRest=${reachedRest} reachedUpgrade=${reachedUpgrade} appliedUpgrade=${appliedUpgrade} returnedToMap=${returnedToMap} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
