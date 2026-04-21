import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'child_process';
import { chromium, type Page } from 'playwright';

interface UiAuditIssue {
  selector: string;
  problem: string;
  detail: string;
}

interface ViewAudit {
  label: string;
  screenshot: string;
  brokenImages: Array<{ src: string; alt: string; width: number; height: number }>;
  layoutIssues: UiAuditIssue[];
}

interface SmokeReport {
  baseUrl: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  audits: ViewAudit[];
}

interface AuditResult {
  brokenImages: Array<{ src: string; alt: string; width: number; height: number }>;
  layoutIssues: UiAuditIssue[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://127.0.0.1:3000',
    headed: false
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

function checkServer(url: string): boolean {
  try {
    execSync(`curl -s --max-time 2 ${url} > /dev/null 2>&1`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function ensureVisible(locatorCount: Promise<number>, label: string) {
  const count = await locatorCount;
  if (count <= 0) {
    throw new Error(`UI smoke failed: missing ${label}`);
  }
}

async function clickCharacterCard(page: Page, characterName: string) {
  const card = page.locator('div.cursor-pointer').filter({
    has: page.getByRole('heading', { name: characterName })
  }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ force: true });
}

async function auditView(page: Page, label: string, screenshotName: string, layoutSelectors: string[]): Promise<ViewAudit> {
  const screenshotPath = path.join(process.cwd(), 'output', 'playwright', screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const auditScript = new Function('selectors', `
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const brokenImages = Array.from(document.images)
      .filter((img) => isVisible(img) && img.naturalWidth === 0)
      .map((img) => ({
        src: img.currentSrc || img.src,
        alt: img.alt,
        width: img.clientWidth,
        height: img.clientHeight
      }));
    const layoutIssues = [];
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector)).slice(0, 16);
      for (const el of elements) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) {
          layoutIssues.push({
            selector,
            problem: 'zero-sized',
            detail: Math.round(rect.width) + 'x' + Math.round(rect.height)
          });
        }
        if (rect.right > innerWidth + 24 || rect.left < -24 || rect.bottom > innerHeight + 24 || rect.top < -24) {
          layoutIssues.push({
            selector,
            problem: 'viewport-overflow',
            detail: JSON.stringify({
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              viewport: [innerWidth, innerHeight]
            })
          });
        }
      }
    }
    return { brokenImages, layoutIssues };
  `);
  const result = await page.evaluate(auditScript as never, layoutSelectors) as AuditResult;

  return {
    label,
    screenshot: screenshotPath,
    brokenImages: result.brokenImages,
    layoutIssues: result.layoutIssues
  };
}

async function openMenuAndReturnToLauncher(page: Page) {
  await page.getByRole('button', { name: '菜单' }).click();
  await page.getByRole('button', { name: '返回启动器' }).click();
  await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
}

async function quickSaveFromMenu(page: Page) {
  await page.getByRole('button', { name: '菜单' }).click();
  await page.getByRole('button', { name: '存档 / 读取' }).click();
  await page.getByRole('button', { name: '快速存档' }).click();
  await page.waitForTimeout(300);
}

async function enterFirstCombat(page: Page) {
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
  const combatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗/i }).first();
  if (await combatNode.count()) {
    await combatNode.click();
  } else {
    await page.locator('button[data-node-id]:not([disabled])').first().click();
  }
  await Promise.race([
    page.locator('.enemy-standee').first().waitFor({ timeout: 10_000 }),
    page.locator('.player-standee').first().waitFor({ timeout: 10_000 })
  ]);
}

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright');
  mkdirSync(outputDir, { recursive: true });

  if (!checkServer(options.url)) {
    console.log('Server not running at', options.url, '- skipping UI smoke tests');
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const audits: ViewAudit[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.resourceType()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
  });
  page.on('response', async (response) => {
    if (response.status() >= 400) {
      const request = response.request();
      failedRequests.push(`${request.resourceType()} ${response.url()} HTTP ${response.status()}`);
    }
  });

  try {
    await page.goto(options.url, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'launcher', 'launcher.png', [
      'button',
      'section',
      'img'
    ]));

    await page.getByRole('button', { name: /开始新战区/i }).click();
    await page.getByText('选择你的执行体').waitFor({ timeout: 10_000 });
    audits.push(await auditView(page, 'character_select', 'character_select.png', [
      'img',
      'button',
      '[class*="max-w-[18rem]"]'
    ]));

    await clickCharacterCard(page, 'The Brute');
    await page.waitForTimeout(300);
    const startGameButton = page.getByRole('button', { name: /Start Game/i });
    if (await startGameButton.count()) {
      await startGameButton.scrollIntoViewIfNeeded();
      await startGameButton.click();
    }
    await ensureVisible(page.locator('button[data-node-id]').count(), 'map nodes');
    audits.push(await auditView(page, 'map', 'map.png', [
      'button[data-node-id]',
      'img'
    ]));

    await enterFirstCombat(page);
    await page.waitForTimeout(800);
    audits.push(await auditView(page, 'combat', 'combat.png', [
      '.player-standee',
      '.enemy-standee',
      '.immersive-card',
      'img'
    ]));

    await quickSaveFromMenu(page);
    await openMenuAndReturnToLauncher(page);
    audits.push(await auditView(page, 'launcher_after_save', 'launcher_after_save.png', [
      'button',
      'img'
    ]));

    await page.getByRole('button', { name: /继续作战/i }).click();
    await Promise.race([
      page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 }),
      page.locator('.enemy-standee').first().waitFor({ timeout: 10_000 })
    ]);
    audits.push(await auditView(page, 'after_continue', 'after_continue.png', [
      'button[data-node-id]',
      '.enemy-standee',
      '.player-standee',
      '.immersive-card',
      'img'
    ]));

    await openMenuAndReturnToLauncher(page);
    const loadButton = page.getByRole('button', { name: '读取' }).first();
    if (await loadButton.count()) {
      await loadButton.click();
      await Promise.race([
        page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 }),
        page.locator('.enemy-standee').first().waitFor({ timeout: 10_000 })
      ]);
      audits.push(await auditView(page, 'after_load_slot', 'after_load_slot.png', [
        'button[data-node-id]',
        '.enemy-standee',
        '.player-standee',
        '.immersive-card',
        'img'
      ]));
    } else {
      throw new Error('UI smoke failed: no save slot load button after returning to launcher');
    }
  } finally {
    const report: SmokeReport = {
      baseUrl: options.url,
      consoleErrors,
      pageErrors,
      failedRequests,
      audits
    };
    writeFileSync(path.join(outputDir, 'ui_smoke_report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
