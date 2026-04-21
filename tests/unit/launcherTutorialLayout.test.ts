import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { checkServer, getDefaultSmokeUrl, spawnDevServer, waitForServer } from '../../scripts/validation/flow_smoke_helpers';

test('launcher remains aligned after closing tutorial and resizing to tablet viewport', { timeout: 60_000 }, async () => {
  const url = getDefaultSmokeUrl();
  const ownsDevServer = !checkServer(url);
  const devServer = ownsDevServer ? spawnDevServer(url) : null;

  if (ownsDevServer) {
    await waitForServer(url);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /术语、资源与战斗流程/ }).click();
    await page.getByText('新手战区教程').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /返回当前界面|关闭教程/ }).first().click();
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForFunction(() => {
      const shell = document.querySelector('.launcher-shell') as HTMLElement | null;
      return !shell || (shell.scrollLeft === 0 && shell.scrollTop === 0);
    }, { timeout: 2_000 });

    const selectors = ['section', 'button', '.launcher-panel', '.launcher-shell [data-keyboard-focus="true"]'];
    const issues: Array<{ selector: string; left: number; right: number }> = [];

    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = Math.min(await locator.count(), 24);
      for (let index = 0; index < count; index += 1) {
        const element = locator.nth(index);
        if (!(await element.isVisible())) continue;
        const rect = await element.boundingBox();
        if (!rect) continue;
        if (rect.x + rect.width > 1024 + 24 || rect.x < -24) {
          issues.push({
            selector,
            left: Math.round(rect.x),
            right: Math.round(rect.x + rect.width),
          });
        }
      }
    }

    assert.deepEqual(issues, []);
  } finally {
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }
});
