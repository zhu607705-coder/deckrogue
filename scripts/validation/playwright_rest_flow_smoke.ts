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

interface RestFlowReport {
  baseUrl: string;
  reachedRest: boolean;
  healed: boolean;
  returnedToMap: boolean;
  consoleErrors: string[];
  pageErrors: string[];
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
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const screenshots: string[] = [];

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

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
    const report: RestFlowReport = { baseUrl, reachedRest, healed, returnedToMap, consoleErrors, pageErrors, screenshots };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (!reachedRest || !healed || !returnedToMap || consoleErrors.length || pageErrors.length) {
    throw new Error(`Rest flow smoke failed: reachedRest=${reachedRest} healed=${healed} returnedToMap=${returnedToMap} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
