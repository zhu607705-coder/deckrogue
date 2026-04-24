/**
 * @file playwright_unified_runtime_v2_smoke.ts
 * @description 使用 Playwright 对统一运行时 V2 进行冒烟测试。
 *
 * 主要职责:
 * - 启动 Playwright 浏览器访问统一运行时 V2
 * - 检查控制台错误、页面错误和请求失败
 * - 执行基础功能检查并生成报告
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

interface UnifiedRuntimeV2SmokeReport {
  baseUrl: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  checks: Array<{ label: string; status: 'passed' | 'failed'; detail: string }>;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://127.0.0.1:3000',
    headed: false,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

function appendQuery(url: string, query: string) {
  const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${normalized}/${query.startsWith('?') ? query : `?${query}`}`;
}

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'unified_runtime_v2');
  mkdirSync(outputDir, { recursive: true });

  const report: UnifiedRuntimeV2SmokeReport = {
    baseUrl: options.url,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    checks: [],
  };

  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    report.failedRequests.push(`${request.resourceType()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const request = response.request();
      report.failedRequests.push(`${request.resourceType()} ${response.url()} HTTP ${response.status()}`);
    }
  });

  try {
    const url = appendQuery(options.url, 'unified=1');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '新引擎' }).first().click();
    await page.locator('[data-character-id="informant"]').waitFor({ timeout: 45_000 });
    report.checks.push({ label: 'switch_to_runtime_v2', status: 'passed', detail: 'Unified shell switched to runtime-v2 character select.' });

    await page.locator('[data-character-id="informant"]').click();
    await page.locator('[data-scene="map"]').waitFor({ timeout: 45_000 });
    report.checks.push({ label: 'select_character_to_map', status: 'passed', detail: 'Runtime-v2 unified shell entered the map after character selection.' });

    await page.screenshot({ path: path.join(outputDir, 'unified_runtime_v2_map.png'), fullPage: true });
  } finally {
    writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }

  if (report.consoleErrors.length || report.pageErrors.length || report.failedRequests.length) {
    throw new Error(
      `unified runtime-v2 smoke failed: console=${report.consoleErrors.length}, page=${report.pageErrors.length}, requests=${report.failedRequests.length}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
