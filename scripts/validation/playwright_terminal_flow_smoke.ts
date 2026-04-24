#!/usr/bin/env node

/**
 * @file playwright_terminal_flow_smoke.ts
 * @description 使用 Playwright 测试终局流程的冒烟测试。
 *
 * 主要职责:
 * - 创建终局（游戏结束）测试 fixture
 * - 验证游戏结束流程和返回主菜单
 * - 记录截图和错误日志
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  createGameOverFixture,
  createVictoryFixture,
  ensureDir,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface TerminalCaseReport {
  slotName: string;
  reachedTerminal: boolean;
  exitedTerminal: boolean;
  screenshot: string;
}

interface TerminalFlowReport {
  baseUrl: string;
  consoleErrors: string[];
  pageErrors: string[];
  cases: TerminalCaseReport[];
}

async function runCase(baseUrl: string, slotName: string, terminalTitle: string, restartLabel: string, screenshotFile: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await bootstrapContext(context, [createVictoryFixture(), createGameOverFixture()]);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  let reachedTerminal = false;
  let exitedTerminal = false;
  const shot = screenshotFile;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await loadSlotFromLauncher(page, slotName);
    await page.getByText(terminalTitle).waitFor({ timeout: 10_000 });
    reachedTerminal = true;
    await page.screenshot({ path: shot, fullPage: true });
    await page.getByRole('button', { name: restartLabel }).click();
    await page.getByText('选择你的执行体').waitFor({ timeout: 10_000 });
    exitedTerminal = true;
  } finally {
    await context.close();
    await browser.close();
  }

  return { reachedTerminal, exitedTerminal, consoleErrors, pageErrors };
}

async function main() {
  const baseUrl = getDefaultSmokeUrl();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'terminal-flow-smoke.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'terminal-flow-smoke');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer = null as ReturnType<typeof spawnDevServer> | null;
  if (!checkServer(baseUrl)) {
    devServer = spawnDevServer(baseUrl);
    await waitForServer(baseUrl);
  }

  const cases: TerminalCaseReport[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  try {
    const victoryShot = screenshotPath(outputDir, 'victory-terminal.png');
    const victory = await runCase(baseUrl, 'Terminal Flow Victory', '行动归档', '再来一局', victoryShot);
    cases.push({
      slotName: 'Terminal Flow Victory',
      reachedTerminal: victory.reachedTerminal,
      exitedTerminal: victory.exitedTerminal,
      screenshot: victoryShot,
    });
    consoleErrors.push(...victory.consoleErrors);
    pageErrors.push(...victory.pageErrors);

    const gameOverShot = screenshotPath(outputDir, 'gameover-terminal.png');
    const gameOver = await runCase(baseUrl, 'Terminal Flow GameOver', '执行失败 (MIA/KIA)', '派遣下一任牺牲者', gameOverShot);
    cases.push({
      slotName: 'Terminal Flow GameOver',
      reachedTerminal: gameOver.reachedTerminal,
      exitedTerminal: gameOver.exitedTerminal,
      screenshot: gameOverShot,
    });
    consoleErrors.push(...gameOver.consoleErrors);
    pageErrors.push(...gameOver.pageErrors);
  } finally {
    const report: TerminalFlowReport = {
      baseUrl,
      consoleErrors,
      pageErrors,
      cases,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }

  const failedCase = cases.find((entry) => !entry.reachedTerminal || !entry.exitedTerminal);
  if (failedCase || consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Terminal flow smoke failed: failedCase=${failedCase?.slotName || 'none'} pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
