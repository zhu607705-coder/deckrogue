/**
 * @file playwright_map_responsive_smoke.ts
 * @description Responsive smoke audit for the grimdark map node cards and HUD.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

import { checkServer, getDefaultSmokeUrl, spawnDevServer, waitForServer } from './flow_smoke_helpers';

interface ViewportSpec {
  label: string;
  width: number;
  height: number;
}

interface ResponsiveIssue {
  viewport: string;
  selector: string;
  problem: string;
  detail: string;
}

interface ResponsiveAudit {
  baseUrl: string;
  screenshots: Array<{ viewport: string; path: string }>;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  issues: ResponsiveIssue[];
}

const VIEWPORTS: ViewportSpec[] = [
  { label: 'mobile_390x844', width: 390, height: 844 },
  { label: 'tablet_768x1024', width: 768, height: 1024 },
  { label: 'desktop_1440x960', width: 1440, height: 960 },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: getDefaultSmokeUrl(),
    headed: false,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1] || options.url;
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

async function enterMap(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('[data-screen="Launcher"]').waitFor({ timeout: 10_000 });
  await page.locator('[data-screen="Launcher"] [data-keyboard-option="1"]').first().click({ force: true });
  await page.locator('[data-character-id]').first().waitFor({ timeout: 10_000 });
  const characterCard = page.locator('[data-character-id="brute"]').first();
  await characterCard.scrollIntoViewIfNeeded();
  await characterCard.evaluate((element) => {
    if (element instanceof HTMLElement) element.click();
  });
  await page.waitForTimeout(300);
  if (await page.locator('[data-screen="Map"] button[data-node-id]').first().isVisible().catch(() => false)) {
    return;
  }
  const startButton = page.locator('button[data-keyboard-option="9"]').first();
  await startButton.waitFor({ timeout: 10_000 });
  await startButton.scrollIntoViewIfNeeded();
  await startButton.click({ force: true });
  await page.locator('[data-screen="Map"] button[data-node-id]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
}

async function auditMapViewport(page: Page, viewport: string): Promise<ResponsiveIssue[]> {
  const auditScript = new Function('viewportLabel', `
    const issues = [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const selectors = [
      '.grimdark-map-hud__tile',
      '.grimdark-node-card__statusChip',
      '.grimdark-node-card__routeIntel',
      '.grimdark-node-card__routePreviewChip',
    ];

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < viewportWidth &&
        rect.top < viewportHeight &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    };

    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector)).filter(isVisible).slice(0, 24);
      if (elements.length === 0) {
        issues.push({
          viewport: viewportLabel,
          selector,
          problem: 'missing-visible-element',
          detail: 'No visible element matched this map selector.',
        });
        continue;
      }

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.width < 6 || rect.height < 3) {
          issues.push({
            viewport: viewportLabel,
            selector,
            problem: 'too-small',
            detail: Math.round(rect.width) + 'x' + Math.round(rect.height),
          });
        }
        const textElements = Array.from(element.querySelectorAll('span, div')).filter(isVisible);
        for (const textElement of textElements) {
          const textRect = textElement.getBoundingClientRect();
          if (textRect.width > element.getBoundingClientRect().width + 12) {
            issues.push({
              viewport: viewportLabel,
              selector,
              problem: 'child-text-overflow',
              detail: Math.round(textRect.width) + 'px child inside ' + Math.round(rect.width) + 'px parent',
            });
          }
        }
      }
    }

    const mapShell = document.querySelector('[data-screen="Map"]');
    if (!mapShell || !(mapShell instanceof HTMLElement)) {
      issues.push({
        viewport: viewportLabel,
        selector: '[data-screen="Map"]',
        problem: 'missing-map-screen',
        detail: 'Map screen did not render.',
      });
    }

    return issues;
  `);
  return page.evaluate(auditScript as never, viewport) as Promise<ResponsiveIssue[]>;
}

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'map-responsive');
  mkdirSync(outputDir, { recursive: true });

  let devServer: ReturnType<typeof spawnDevServer> | null = null;
  if (!checkServer(options.url)) {
    devServer = spawnDevServer(options.url);
    await waitForServer(options.url);
  }

  const browser = await chromium.launch({ headless: !options.headed });
  const report: ResponsiveAudit = {
    baseUrl: options.url,
    screenshots: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    issues: [],
  };

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on('console', (msg) => {
        if (msg.type() === 'error') report.consoleErrors.push(`${viewport.label}: ${msg.text()}`);
      });
      page.on('pageerror', (error) => {
        report.pageErrors.push(`${viewport.label}: ${error.message}`);
      });
      page.on('requestfailed', (request) => {
        report.failedRequests.push(`${viewport.label}: ${request.resourceType()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
      });
      page.on('response', async (response) => {
        if (response.status() >= 400) {
          const request = response.request();
          report.failedRequests.push(`${viewport.label}: ${request.resourceType()} ${response.url()} HTTP ${response.status()}`);
        }
      });

      await enterMap(page, options.url);
      const screenshotPath = path.join(outputDir, `${viewport.label}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      report.screenshots.push({ viewport: viewport.label, path: screenshotPath });
      report.issues.push(...await auditMapViewport(page, viewport.label));
      await page.close();
    }
  } finally {
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
    writeFileSync(path.join(outputDir, 'map_responsive_report.json'), JSON.stringify(report, null, 2));
  }

  if (
    report.consoleErrors.length > 0 ||
    report.pageErrors.length > 0 ||
    report.failedRequests.length > 0 ||
    report.issues.length > 0
  ) {
    throw new Error(
      `Map responsive smoke failed: consoleErrors=${report.consoleErrors.length}, pageErrors=${report.pageErrors.length}, failedRequests=${report.failedRequests.length}, issues=${report.issues.length}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
