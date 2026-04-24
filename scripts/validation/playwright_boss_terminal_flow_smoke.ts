#!/usr/bin/env node

/**
 * @file playwright_boss_terminal_flow_smoke.ts
 * @description 使用 Playwright 测试 Boss 终端流程的冒烟测试。
 *
 * 主要职责:
 * - 创建 Boss 终端测试 fixture
 * - 验证终端访问和返回角色选择
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createBossTerminalFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface BossTerminalFlowReport {
  baseUrl: string;
  reachedTerminal: boolean;
  exitedToCharacterSelect: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  screenshots: string[];
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'boss-terminal-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'boss-terminal-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createBossTerminalFixture()]);
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

  let reachedTerminal = false;
  let exitedToCharacterSelect = false;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, 'Boss Terminal Flow');
    await page.getByText('行动归档').waitFor({ timeout: 10_000 });
    reachedTerminal = true;
    const terminal = screenshotPath(outputDir, 'boss-terminal.png');
    await page.screenshot({ path: terminal, fullPage: true });
    screenshots.push(terminal);

    await page.getByRole('button', { name: '再来一局' }).click();
    await page.getByText('选择你的执行体').waitFor({ timeout: 10_000 });
    exitedToCharacterSelect = true;
    const charSelect = screenshotPath(outputDir, 'boss-terminal-exit.png');
    await page.screenshot({ path: charSelect, fullPage: true });
    screenshots.push(charSelect);
  } finally {
    const report: BossTerminalFlowReport = {
      baseUrl,
      reachedTerminal,
      exitedToCharacterSelect,
      consoleErrors,
      pageErrors,
      screenshots,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  if (!reachedTerminal || !exitedToCharacterSelect || pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(`Boss terminal flow smoke failed: reachedTerminal=${reachedTerminal} exitedToCharacterSelect=${exitedToCharacterSelect} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
