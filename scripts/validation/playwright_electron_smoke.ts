#!/usr/bin/env node

/**
 * @file playwright_electron_smoke.ts
 * @description 使用 Playwright 测试 Electron 桌面应用的冒烟测试。
 *
 * 主要职责:
 * - 构建 Electron 应用并启动
 * - 验证桌面应用的基本功能
 * - 记录截图和错误日志
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

const require = createRequire(import.meta.url);
const electronBinary = require('electron') as string;
const viteCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');

const REPORT_DIR = path.join(process.cwd(), 'reports', 'desktop');
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'playwright');
const PRODUCTION_LOCK_PATH = path.join(REPORT_DIR, 'desktop-smoke-production.lock');

interface DesktopSmokeReport {
  timestamp: string;
  mode: 'development' | 'production';
  overallStatus: 'pass' | 'fail';
  closeStatus: 'pending' | 'pass' | 'fail';
  closeError?: string;
  screenshots: string[];
  steps: string[];
  responsiveChecks: DesktopResponsiveCheck[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  rendererCrashes: string[];
}

interface DesktopResponsiveCheck {
  step: string;
  viewport: string;
  width: number;
  height: number;
  documentWidth: number;
  horizontalOverflow: boolean;
  smallTextCount: number;
  smallTapTargetCount: number;
  status: 'pass' | 'fail';
  issues: string[];
}

const DESKTOP_RESPONSIVE_VIEWPORTS = [
  { name: 'desktop-min-960x540', width: 960, height: 540 },
  { name: 'desktop-default-1280x720', width: 1280, height: 720 },
  { name: 'desktop-wide-1600x900', width: 1600, height: 900 },
];

function createRunId(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseArgs() {
  const modeArg = process.argv.slice(2).find((arg) => arg.startsWith('--mode='));
  return {
    mode: (modeArg?.split('=')[1] === 'development' ? 'development' : 'production') as 'development' | 'production',
  };
}

function getReportPath(mode: DesktopSmokeReport['mode']) {
  return path.join(REPORT_DIR, mode === 'production' ? 'desktop-smoke.json' : 'desktop-smoke-dev.json');
}

function writeReport(report: DesktopSmokeReport) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(getReportPath(report.mode), JSON.stringify(report, null, 2));
}

function clearStaleProductionSmokeLock(): void {
  if (!existsSync(PRODUCTION_LOCK_PATH)) {
    return;
  }
  try {
    const payload = JSON.parse(readFileSync(PRODUCTION_LOCK_PATH, 'utf-8')) as { pid?: unknown };
    const stalePid = typeof payload.pid === 'number' ? payload.pid : Number.NaN;
    if (!Number.isInteger(stalePid) || stalePid <= 0) {
      rmSync(PRODUCTION_LOCK_PATH, { force: true });
      return;
    }
    try {
      process.kill(stalePid, 0);
    } catch {
      rmSync(PRODUCTION_LOCK_PATH, { force: true });
    }
  } catch {
    rmSync(PRODUCTION_LOCK_PATH, { force: true });
  }
}

async function acquireProductionSmokeLock(): Promise<() => void> {
  mkdirSync(REPORT_DIR, { recursive: true });
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const fd = openSync(PRODUCTION_LOCK_PATH, 'wx');
      writeFileSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
      return () => {
        try {
          closeSync(fd);
        } catch {}
        rmSync(PRODUCTION_LOCK_PATH, { force: true });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      clearStaleProductionSmokeLock();
      await delay(500);
    }
  }
  throw new Error(`Timed out waiting for production desktop smoke lock: ${PRODUCTION_LOCK_PATH}`);
}

function ensureVisible(label: string, count: number) {
  if (count <= 0) {
    throw new Error(`Desktop smoke failed: missing ${label}`);
  }
}

async function evaluateResponsiveReadability(page: Page): Promise<Omit<DesktopResponsiveCheck, 'step' | 'viewport' | 'width' | 'height' | 'status'>> {
  return page.evaluate(`
    (() => {
    const issues = [];
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const horizontalOverflow = documentWidth > viewportWidth + 2;
    if (horizontalOverflow) {
      issues.push('horizontal-overflow documentWidth=' + documentWidth + ' viewportWidth=' + viewportWidth);
    }

    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const smallTextSelectors = [
      '.campaign-shell',
      '.campaign-action',
      '.campaign-copy',
      '.combat-guide-panel',
      '.grimdark-map-hud',
      '.grimdark-resource-card',
      '.grimdark-node-card',
      '.combat-hud',
      '.combat-hud__bandLabel',
      '.combat-hud__turnLabel',
      '.grimdark-pile-btn',
      '.grimdark-end-turn-btn',
      '.grimdark-turn',
      '.grimdark-intent',
      '.grimdark-player-hud',
      '.grimdark-enemy-hud',
      '.grimdark-action-hand',
      '.app-menu-panel',
      '.screen-loading-fallback',
      '.deckrogue-error-boundary',
      '.immersive-card__titleZh',
      '.immersive-card__text',
    ];

    let smallTextCount = 0;
    for (const element of Array.from(document.querySelectorAll(smallTextSelectors.join(',')))) {
      if (!isVisible(element)) continue;
      const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
      if (fontSize > 0 && fontSize < 9.5) {
        smallTextCount += 1;
        if (issues.length < 20) {
          issues.push('small-text fontSize=' + fontSize + 'px text=' + (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60));
        }
      }
    }

    let smallTapTargetCount = 0;
    for (const element of Array.from(document.querySelectorAll('button, [role="button"], [data-keyboard-focus="true"]'))) {
      if (!isVisible(element)) continue;
      if (element.disabled || element.getAttribute('aria-disabled') === 'true') continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > viewportWidth) continue;
      const isTinyIcon = rect.width <= 34 && rect.height <= 34 && (element.textContent || '').trim().length <= 2;
      if (!isTinyIcon && (rect.width < 32 || rect.height < 32)) {
        smallTapTargetCount += 1;
        if (issues.length < 20) {
          issues.push('small-target target=' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ' text=' + (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60));
        }
      }
    }

    return {
      documentWidth,
      horizontalOverflow,
      smallTextCount,
      smallTapTargetCount,
      issues,
    };
    })()
  `);
}

async function captureResponsiveChecks(
  page: Page,
  app: ElectronApplication,
  report: DesktopSmokeReport,
  step: string
) {
  for (const viewport of DESKTOP_RESPONSIVE_VIEWPORTS) {
    await app.evaluate(new Function('electronModules', `
      const { BrowserWindow } = electronModules;
      const [window] = BrowserWindow.getAllWindows();
      if (!window) {
        throw new Error('Desktop smoke failed: no Electron BrowserWindow for responsive check');
      }
      window.setSize(${viewport.width}, ${viewport.height});
    `) as (electronModules: unknown) => void);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(200);
    const result = await evaluateResponsiveReadability(page);
    const check: DesktopResponsiveCheck = {
      step,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      documentWidth: result.documentWidth,
      horizontalOverflow: result.horizontalOverflow,
      smallTextCount: result.smallTextCount,
      smallTapTargetCount: result.smallTapTargetCount,
      status: result.issues.length === 0 ? 'pass' : 'fail',
      issues: result.issues,
    };
    report.responsiveChecks.push(check);
  }
}

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Desktop smoke dev server did not become ready at ${url}`);
}

function spawnDevServer(url: string): ChildProcess {
  return spawn(process.execPath, [viteCli, '--port=3000', '--host=127.0.0.1'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url,
    },
  });
}

async function installCrashDiagnostics(
  app: ElectronApplication,
  report: DesktopSmokeReport
): Promise<void> {
  await app.evaluate(new Function('electronModules', `
    const { app: electronApp, BrowserWindow } = electronModules;
    const attachWindowDiagnostics = (window) => {
      window.webContents.on('render-process-gone', (_event, details) => {
        console.log(
          '[desktop-smoke] render-process-gone ' + window.webContents.getURL() + ' ' + JSON.stringify(details)
        );
      });
    };

    electronApp.on('render-process-gone', (_event, webContents, details) => {
      console.log('[desktop-smoke] app-render-process-gone ' + webContents.getURL() + ' ' + JSON.stringify(details));
    });
    electronApp.on('child-process-gone', (_event, details) => {
      console.log('[desktop-smoke] child-process-gone ' + JSON.stringify(details));
    });

    for (const window of BrowserWindow.getAllWindows()) {
      attachWindowDiagnostics(window);
    }
    electronApp.on('browser-window-created', (_event, window) => attachWindowDiagnostics(window));
  `) as (electronModules: unknown) => void);

  const electronProcess = app.process();
  electronProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.includes('[desktop-smoke]')) {
        report.rendererCrashes.push(line.trim());
      }
    }
  });
  electronProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    if (/GPU process|FATAL|crash|exception/i.test(text)) {
      report.rendererCrashes.push(text.trim());
    }
  });
}

async function clickCharacterCard(page: Page, characterId: string) {
  const card = page.locator(`[data-character-id="${characterId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ force: true });
}

async function enterFirstCombat(page: Page) {
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
  const combatNode = page.locator('button[data-node-type="Combat"]').first();
  if (await combatNode.count()) {
    await combatNode.click({ force: true });
  } else {
    const fallbackCombatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗|Combat/i }).first();
    if (await fallbackCombatNode.count()) {
      await fallbackCombatNode.click({ force: true });
    } else {
      await page.locator('button[data-node-id]:not([disabled])').first().click({ force: true });
    }
  }
  await Promise.race([
    page.locator('.enemy-standee').first().waitFor({ timeout: 10_000 }),
    page.locator('.player-standee').first().waitFor({ timeout: 10_000 })
  ]);
}

async function closeElectronApp(app: ElectronApplication) {
  try {
    await app.evaluate(new Function('electronModules', `
      const { app: electronApp, BrowserWindow } = electronModules;
      for (const window of BrowserWindow.getAllWindows()) {
        try {
          window.destroy();
        } catch {}
      }
      electronApp.exit(0);
    `) as (electronModules: unknown) => void);
    await delay(300);
  } catch {
    try {
      await app.close();
    } catch (error) {
      if (!String(error).includes('No dialog is showing')) {
        throw error;
      }
    }
  }
}

async function main() {
  const { mode } = parseArgs();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const runId = createRunId();

  const report: DesktopSmokeReport = {
    timestamp: new Date().toISOString(),
    mode,
    overallStatus: 'fail',
    closeStatus: 'pending',
    screenshots: [],
    steps: [],
    responsiveChecks: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    rendererCrashes: [],
  };

  let devServer: ChildProcess | null = null;
  let releaseProductionLock: (() => void) | null = null;
  const tempUserDataDir = path.join(os.tmpdir(), `deckrogue-electron-smoke-user-data-${runId}`);
  rmSync(tempUserDataDir, { recursive: true, force: true });
  mkdirSync(tempUserDataDir, { recursive: true });

  try {
    if (mode === 'production') {
      releaseProductionLock = await acquireProductionSmokeLock();
      execSync('npm run build:desktop', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
    } else {
      const devServerUrl = 'http://127.0.0.1:3000';
      devServer = spawnDevServer(devServerUrl);
      await waitForServer(devServerUrl);
    }

    const app: ElectronApplication = await electron.launch({
      executablePath: electronBinary,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-gpu-compositing',
        path.join(process.cwd(), 'electron', 'main.mjs'),
      ],
      env: {
        ...process.env,
        DECKROGUE_DESKTOP_ENTRY_MODE: 'legacy',
        DECKROGUE_DESKTOP_SMOKE: '1',
        DECKROGUE_DESKTOP_MIN_WIDTH: '960',
        DECKROGUE_DESKTOP_MIN_HEIGHT: '540',
        DECKROGUE_DISABLE_HARDWARE_ACCELERATION: '1',
        DECKROGUE_FORCE_LOCAL_DIST: mode === 'production' ? '1' : '0',
        VITE_DEV_SERVER_URL: mode === 'development' ? 'http://127.0.0.1:3000' : '',
        DECKROGUE_USER_DATA_DIR: tempUserDataDir,
      },
    });

    await installCrashDiagnostics(app, report);
    const page = await app.firstWindow();
    page.on('crash', () => {
      report.rendererCrashes.push('renderer page crashed before smoke completed');
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        report.consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      report.pageErrors.push(error.message);
    });
    page.on('dialog', (dialog) => {
      void dialog.dismiss().catch(() => {});
    });
    page.on('requestfailed', (request) => {
      report.failedRequests.push(`${request.resourceType()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        report.failedRequests.push(`${response.request().resourceType()} ${response.url()} HTTP ${response.status()}`);
      }
    });

    await page.waitForLoadState('domcontentloaded');
    await page.getByText('战区启动器').waitFor({ timeout: 15_000 });
    const launcherShot = path.join(OUTPUT_DIR, `desktop_${runId}_launcher.png`);
    await page.screenshot({ path: launcherShot, fullPage: true });
    report.screenshots.push(launcherShot);
    report.steps.push('launcher');
    await captureResponsiveChecks(page, app, report, 'launcher');

    await page.getByRole('button', { name: /战区教程/i }).click();
    await page.getByText('新手战区教程').waitFor({ timeout: 10_000 });
    const tutorialShot = path.join(OUTPUT_DIR, `desktop_${runId}_tutorial.png`);
    await page.screenshot({ path: tutorialShot, fullPage: true });
    report.screenshots.push(tutorialShot);
    report.steps.push('tutorial');
    await captureResponsiveChecks(page, app, report, 'tutorial');
    await page.getByRole('button', { name: '返回当前界面' }).click();
    await page.getByText('新手战区教程').waitFor({ state: 'hidden', timeout: 10_000 });
    await page.locator('[data-screen="Launcher"]').waitFor({ timeout: 10_000 });

    await page.locator('button').filter({ hasText: /开始新战区/i }).first().click();
    await page.getByText('选择你的执行体').waitFor({ timeout: 10_000 });
    const characterShot = path.join(OUTPUT_DIR, `desktop_${runId}_character_select.png`);
    await page.screenshot({ path: characterShot, fullPage: true });
    report.screenshots.push(characterShot);
    report.steps.push('character_select');
    await captureResponsiveChecks(page, app, report, 'character_select');
    await clickCharacterCard(page, 'brute');
    await page.waitForTimeout(300);
    const startGameButton = page.getByRole('button', { name: /Start Game|开始战区部署|开始游戏/i });
    if (await startGameButton.count()) {
      await startGameButton.first().click();
    }

    const mapNodes = await page.locator('button[data-node-id]').count();
    ensureVisible('map nodes', mapNodes);
    const mapShot = path.join(OUTPUT_DIR, `desktop_${runId}_map.png`);
    await page.screenshot({ path: mapShot, fullPage: true });
    report.screenshots.push(mapShot);
    report.steps.push('map');
    await captureResponsiveChecks(page, app, report, 'map');

    await enterFirstCombat(page);
    const combatShot = path.join(OUTPUT_DIR, `desktop_${runId}_combat.png`);
    await page.screenshot({ path: combatShot, fullPage: true });
    report.screenshots.push(combatShot);
    report.steps.push('combat');
    await captureResponsiveChecks(page, app, report, 'combat');

    try {
      await closeElectronApp(app);
      report.closeStatus = 'pass';
    } catch (error) {
      report.closeStatus = 'fail';
      report.closeError = error instanceof Error ? error.message : String(error);
    }

    report.overallStatus =
      report.closeStatus === 'pass' &&
      report.responsiveChecks.every((check) => check.status === 'pass') &&
      report.consoleErrors.length === 0 &&
      report.pageErrors.length === 0 &&
      report.failedRequests.length === 0 &&
      report.rendererCrashes.length === 0
        ? 'pass'
        : 'fail';

    writeReport(report);

    if (report.overallStatus === 'fail') {
      throw new Error('Desktop smoke detected console, page, or network errors');
    }
  } catch (error) {
    writeReport(report);
    console.error('[test:desktop-smoke] failed:', error);
    process.exit(1);
  } finally {
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
    try {
      rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch {}
    if (releaseProductionLock) {
      releaseProductionLock();
    }
  }
}

main().catch((error) => {
  console.error('[test:desktop-smoke] crashed:', error);
  process.exit(1);
});
