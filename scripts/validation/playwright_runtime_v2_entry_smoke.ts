import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

interface RuntimeV2EntrySmokeReport {
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

async function bootToCharacterSelect(page: Page, url: string, screenshotPath: string) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByText('Launch Runtime V2').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: /开始新局|Start New Run/ }).click();
  await page.locator('[data-screen="CharacterSelect"]').waitFor({ timeout: 30_000 });
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'runtime_v2_entry');
  mkdirSync(outputDir, { recursive: true });

  const report: RuntimeV2EntrySmokeReport = {
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
    const defaultUrl = options.url;
    await page.goto(defaultUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    report.checks.push({ label: 'default_legacy_launcher', status: 'passed', detail: 'Default entry rendered the legacy launcher.' });
    await page.screenshot({ path: path.join(outputDir, 'default_legacy_launcher.png'), fullPage: true });

    const seedUrl = appendQuery(options.url, 'runtimeV2=1&seed=2468');
    await page.goto(seedUrl, { waitUntil: 'networkidle' });
    await page.getByText('Launch Runtime V2').waitFor({ timeout: 10_000 });
    const seedValue = await page.locator('input[type="number"]').inputValue();
    if (seedValue !== '2468') {
      throw new Error(`runtime-v2 launcher smoke failed: expected URL seed 2468, got ${seedValue}`);
    }
    report.checks.push({ label: 'runtime_v2_url_seed_override', status: 'passed', detail: 'Runtime V2 launcher respected ?seed=2468.' });

    const pythonDomUrl = appendQuery(options.url, 'runtimeV2=1&adapter=python-wasm&renderer=dom&seed=2468');
    await bootToCharacterSelect(page, pythonDomUrl, path.join(outputDir, 'python_dom_character_select.png'));
    if ((await page.locator('.runtime-v2-app-shell').getAttribute('data-adapter')) !== 'python-wasm') {
      throw new Error('runtime-v2 entry smoke failed: python-wasm DOM path did not expose python-wasm adapter.');
    }
    if ((await page.locator('.runtime-v2-app-shell').getAttribute('data-renderer')) !== 'dom') {
      throw new Error('runtime-v2 entry smoke failed: python-wasm DOM path did not expose dom renderer.');
    }
    await page.locator('button[data-character-id="informant"]').click();
    await page.locator('[data-screen="Map"][data-renderer="dom"][data-adapter="python-wasm"]').waitFor({ timeout: 30_000 });
    report.checks.push({ label: 'python_dom_map', status: 'passed', detail: 'python-wasm + DOM path advanced to DOM map.' });

    const pythonPixiUrl = appendQuery(options.url, 'runtimeV2=1&adapter=python-wasm&renderer=pixi&seed=2468');
    await bootToCharacterSelect(page, pythonPixiUrl, path.join(outputDir, 'python_pixi_character_select.png'));
    await page.locator('button[data-character-id="informant"]').click();
    await page.locator('[data-screen="Map"][data-renderer="pixi"][data-adapter="python-wasm"]').waitFor({ timeout: 30_000 });
    report.checks.push({ label: 'python_pixi_map', status: 'passed', detail: 'python-wasm + Pixi path advanced to Pixi map.' });
    await page.screenshot({ path: path.join(outputDir, 'python_pixi_map.png'), fullPage: true });

    const legacyAdapterUrl = appendQuery(options.url, 'runtimeV2=1&adapter=legacy&renderer=dom&seed=2468');
    await bootToCharacterSelect(page, legacyAdapterUrl, path.join(outputDir, 'legacy_dom_character_select.png'));
    if ((await page.locator('.runtime-v2-app-shell').getAttribute('data-adapter')) !== 'legacy') {
      throw new Error('runtime-v2 entry smoke failed: legacy adapter path did not expose legacy adapter.');
    }
    await page.locator('button[data-character-id="informant"]').click();
    await page.locator('[data-screen="Map"][data-renderer="dom"][data-adapter="legacy"]').waitFor({ timeout: 30_000 });
    report.checks.push({ label: 'legacy_adapter_dom_map', status: 'passed', detail: 'legacy adapter + DOM path advanced to DOM map.' });

    const legacyFallbackUrl = appendQuery(options.url, 'legacy=1');
    await page.goto(legacyFallbackUrl, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    report.checks.push({ label: 'legacy_fallback_launcher', status: 'passed', detail: 'Explicit legacy fallback booted the legacy launcher.' });
    await page.screenshot({ path: path.join(outputDir, 'legacy_launcher.png'), fullPage: true });
  } finally {
    writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }

  if (report.consoleErrors.length || report.pageErrors.length || report.failedRequests.length) {
    throw new Error(
      `runtime-v2 entry smoke failed: console=${report.consoleErrors.length}, page=${report.pageErrors.length}, requests=${report.failedRequests.length}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
