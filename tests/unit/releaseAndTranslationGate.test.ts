/**
 * @file releaseAndTranslationGate.test.ts
 * @description Unit tests for release readiness and translation audit gate checks.
 *
 * 主要职责:
 * - 测试翻译审计的数据记录审计
 * - 测试英文残留检测的有效性
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { REQUIRED_PYODIDE_ASSET_FILES } from '../../scripts/desktop/pyodide_assets.ts';
import {
  checkDesktopArtifacts,
  checkDoctorReportArtifact,
  checkFlowReport,
  checkResponsiveReadabilityReport,
} from '../../scripts/validation/check_release_readiness.ts';
import { auditDataRecords, type AuditDataFieldConfig } from '../../scripts/validation/translation_audit.ts';

const DESKTOP_SMOKE_SOURCE = readFileSync(resolve('scripts/validation/playwright_electron_smoke.ts'), 'utf-8');
const RELEASE_READINESS_SOURCE = readFileSync(resolve('scripts/validation/check_release_readiness.ts'), 'utf-8');

test('translation audit flags visible English in data-driven relic and achievement content', () => {
  const fields: AuditDataFieldConfig[] = [
    { path: 'description', label: 'description' },
    { path: 'trigger', label: 'trigger' },
    { path: 'title', label: 'title' },
  ];
  const items = auditDataRecords('src/content/data/test.json', [
    { id: 'relic_1', description: 'Gain 1 Energy at the start of each combat.', trigger: 'StartCombat' },
    { id: 'achievement_1', title: 'Warp Echoes Hunter' },
  ], fields);

  assert.equal(items.filter((item) => item.kind === 'english-residue').length, 3);
  assert.ok(items.some((item) => item.excerpt.includes('Gain 1 Energy')));
  assert.ok(items.some((item) => item.excerpt.includes('StartCombat')));
  assert.ok(items.some((item) => item.excerpt.includes('Warp Echoes Hunter')));
});

test('desktop smoke reports and release readiness require clean Electron close', () => {
  assert.match(DESKTOP_SMOKE_SOURCE, /closeStatus:\s*'pending'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.closeStatus\s*=\s*'pass'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.closeStatus\s*=\s*'fail'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.closeStatus\s*===\s*'pass'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /responsiveChecks:\s*\[\]/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.responsiveChecks\.every\(\(check\)\s*=>\s*check\.status\s*===\s*'pass'\)/);
  assert.match(RELEASE_READINESS_SOURCE, /smokeReport\?\.closeStatus\s*===\s*'pass'/);
});

test('release readiness rejects desktop smoke reports with missing screenshot evidence', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-desktop-evidence-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const distDir = join(fixtureRoot, 'dist');
  const electronDir = join(fixtureRoot, 'electron');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: [join(fixtureRoot, 'output', 'playwright', 'missing.png')],
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );

    process.chdir(fixtureRoot);
    const smokeCheck = checkDesktopArtifacts(0).find((check) => check.id === 'desktop_smoke_report');

    assert.equal(smokeCheck?.status, 'fail');
    assert.match(smokeCheck?.evidence || '', /screenshot/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects desktop smoke reports with empty screenshot evidence', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-desktop-empty-screenshot-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const distDir = join(fixtureRoot, 'dist');
  const electronDir = join(fixtureRoot, 'electron');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');
  const screenshotPaths = ['launcher', 'tutorial', 'character_select', 'map', 'combat']
    .map((step) => join(outputDir, `${step}.png`));

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    for (const screenshotPath of screenshotPaths) {
      writeFileSync(screenshotPath, '');
    }
    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'fail',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: screenshotPaths,
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );

    process.chdir(fixtureRoot);
    const smokeCheck = checkDesktopArtifacts(0).find((check) => check.id === 'desktop_smoke_report');

    assert.equal(smokeCheck?.status, 'fail');
    assert.match(smokeCheck?.evidence || '', /screenshot/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects desktop builds without bundled Pyodide runtime assets', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-desktop-pyodide-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const distDir = join(fixtureRoot, 'dist');
  const electronDir = join(fixtureRoot, 'electron');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');
  const screenshotPaths = ['launcher', 'tutorial', 'character_select', 'map', 'combat']
    .map((step) => join(outputDir, `${step}.png`));

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    for (const screenshotPath of screenshotPaths) {
      writeFileSync(screenshotPath, 'png-bytes');
    }
    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
        pyodideAssetDir: join(distDir, 'pyodide'),
        pyodideAssets: REQUIRED_PYODIDE_ASSET_FILES.map((fileName) => ({
          fileName,
          path: join(distDir, 'pyodide', fileName),
          sizeBytes: 0,
        })),
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: screenshotPaths,
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );

    process.chdir(fixtureRoot);
    const buildCheck = checkDesktopArtifacts(0).find((check) => check.id === 'desktop_build_report');

    assert.equal(buildCheck?.status, 'fail');
    assert.match(buildCheck?.evidence || '', /Pyodide/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects desktop builds with stale bundled Pyodide runtime assets', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-desktop-stale-pyodide-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const distDir = join(fixtureRoot, 'dist');
  const pyodideAssetDir = join(distDir, 'pyodide');
  const electronDir = join(fixtureRoot, 'electron');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');
  const staleAssetTime = new Date('2000-01-01T00:00:00Z');
  const screenshotPaths = ['launcher', 'tutorial', 'character_select', 'map', 'combat']
    .map((step) => join(outputDir, `${step}.png`));

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(pyodideAssetDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    for (const screenshotPath of screenshotPaths) {
      writeFileSync(screenshotPath, 'png-bytes');
    }

    const pyodideAssets = REQUIRED_PYODIDE_ASSET_FILES.map((fileName) => {
      const assetPath = join(pyodideAssetDir, fileName);
      writeFileSync(assetPath, 'asset-bytes');
      utimesSync(assetPath, staleAssetTime, staleAssetTime);
      return {
        fileName,
        path: assetPath,
        sizeBytes: 11,
      };
    });

    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
        pyodideAssetDir,
        pyodideAssets,
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: screenshotPaths,
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );

    process.chdir(fixtureRoot);
    const buildCheck = checkDesktopArtifacts(Date.now() - 1000).find((check) => check.id === 'desktop_build_report');

    assert.equal(buildCheck?.status, 'fail');
    assert.match(buildCheck?.evidence || '', /fresh bundled Pyodide/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects missing Windows installer distribution evidence', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-win-dist-missing-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const distDir = join(fixtureRoot, 'dist');
  const pyodideAssetDir = join(distDir, 'pyodide');
  const electronDir = join(fixtureRoot, 'electron');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');
  const screenshotPaths = ['launcher', 'tutorial', 'character_select', 'map', 'combat']
    .map((step) => join(outputDir, `${step}.png`));

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(pyodideAssetDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    for (const screenshotPath of screenshotPaths) {
      writeFileSync(screenshotPath, 'png-bytes');
    }

    const pyodideAssets = REQUIRED_PYODIDE_ASSET_FILES.map((fileName) => {
      const assetPath = join(pyodideAssetDir, fileName);
      writeFileSync(assetPath, 'asset-bytes');
      return {
        fileName,
        path: assetPath,
        sizeBytes: 11,
      };
    });

    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
        pyodideAssetDir,
        pyodideAssets,
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: screenshotPaths,
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );

    process.chdir(fixtureRoot);
    const winDistCheck = checkDesktopArtifacts(0).find((check) => check.id === 'win_dist_report');

    assert.equal(winDistCheck?.status, 'fail');
    assert.match(winDistCheck?.evidence || '', /dist:win|win-dist/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects Windows installer reports with mismatched artifact size', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-win-dist-size-mismatch-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const releaseDir = join(fixtureRoot, 'release', 'win');
  const distDir = join(fixtureRoot, 'dist');
  const pyodideAssetDir = join(distDir, 'pyodide');
  const electronDir = join(fixtureRoot, 'electron');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');
  const installerPath = join(releaseDir, 'DeckRogue-0.0.0-x64.exe');
  const screenshotPaths = ['launcher', 'tutorial', 'character_select', 'map', 'combat']
    .map((step) => join(outputDir, `${step}.png`));

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(releaseDir, { recursive: true });
    mkdirSync(pyodideAssetDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    writeFileSync(installerPath, 'real-exe-bytes');
    for (const screenshotPath of screenshotPaths) {
      writeFileSync(screenshotPath, 'png-bytes');
    }

    const pyodideAssets = REQUIRED_PYODIDE_ASSET_FILES.map((fileName) => {
      const assetPath = join(pyodideAssetDir, fileName);
      writeFileSync(assetPath, 'asset-bytes');
      return {
        fileName,
        path: assetPath,
        sizeBytes: 11,
      };
    });

    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
        pyodideAssetDir,
        pyodideAssets,
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: screenshotPaths,
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'win-dist.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        releaseDir,
        stagingDir: join(fixtureRoot, '.desktop-build', 'win-app'),
        artifacts: [
          {
            path: installerPath,
            sizeBytes: 999,
            updatedAt: new Date().toISOString(),
          },
        ],
        evidence: ['exe artifacts produced: 1'],
      }),
    );

    process.chdir(fixtureRoot);
    const winDistCheck = checkDesktopArtifacts(0).find((check) => check.id === 'win_dist_report');

    assert.equal(winDistCheck?.status, 'fail');
    assert.match(winDistCheck?.evidence || '', /size/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects Windows installer reports with mismatched artifact hash', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-win-dist-hash-mismatch-'));
  const desktopReportsDir = join(fixtureRoot, 'reports', 'desktop');
  const releaseDir = join(fixtureRoot, 'release', 'win');
  const distDir = join(fixtureRoot, 'dist');
  const pyodideAssetDir = join(distDir, 'pyodide');
  const electronDir = join(fixtureRoot, 'electron');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const rendererIndexPath = join(distDir, 'index.html');
  const electronMainPath = join(electronDir, 'main.mjs');
  const preloadPath = join(electronDir, 'preload.cjs');
  const installerPath = join(releaseDir, 'DeckRogue-0.0.0-x64.exe');
  const installerBytes = 'same-size-v1';
  const screenshotPaths = ['launcher', 'tutorial', 'character_select', 'map', 'combat']
    .map((step) => join(outputDir, `${step}.png`));

  try {
    mkdirSync(desktopReportsDir, { recursive: true });
    mkdirSync(releaseDir, { recursive: true });
    mkdirSync(pyodideAssetDir, { recursive: true });
    mkdirSync(electronDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(rendererIndexPath, '<!doctype html>');
    writeFileSync(electronMainPath, 'export {};');
    writeFileSync(preloadPath, 'module.exports = {};');
    writeFileSync(installerPath, installerBytes);
    for (const screenshotPath of screenshotPaths) {
      writeFileSync(screenshotPath, 'png-bytes');
    }

    const pyodideAssets = REQUIRED_PYODIDE_ASSET_FILES.map((fileName) => {
      const assetPath = join(pyodideAssetDir, fileName);
      writeFileSync(assetPath, 'asset-bytes');
      return {
        fileName,
        path: assetPath,
        sizeBytes: 11,
      };
    });

    writeFileSync(
      join(desktopReportsDir, 'desktop-build.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        rendererIndexPath,
        electronMainPath,
        preloadPath,
        pyodideAssetDir,
        pyodideAssets,
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'desktop-smoke.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'production',
        overallStatus: 'pass',
        closeStatus: 'pass',
        screenshots: screenshotPaths,
        steps: ['launcher', 'tutorial', 'character_select', 'map', 'combat'],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      }),
    );
    writeFileSync(
      join(desktopReportsDir, 'win-dist.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        releaseDir,
        stagingDir: join(fixtureRoot, '.desktop-build', 'win-app'),
        artifacts: [
          {
            path: installerPath,
            sizeBytes: installerBytes.length,
            sha256: '0'.repeat(64),
            updatedAt: new Date().toISOString(),
          },
        ],
        evidence: ['exe artifacts produced: 1'],
      }),
    );

    process.chdir(fixtureRoot);
    const winDistCheck = checkDesktopArtifacts(0).find((check) => check.id === 'win_dist_report');

    assert.equal(winDistCheck?.status, 'fail');
    assert.match(winDistCheck?.evidence || '', /hash|sha256/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects flow smoke reports with missing screenshot evidence', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-flow-evidence-'));
  const reportsDir = join(fixtureRoot, 'reports', 'flows');
  const reportRelPath = 'reports/flows/reward-flow-smoke.json';

  try {
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(
      join(fixtureRoot, reportRelPath),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reachedReward: true,
        returnedToMap: true,
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
        screenshots: [join(fixtureRoot, 'output', 'playwright', 'missing-reward.png')],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkFlowReport(
      'reward_flow_smoke',
      reportRelPath,
      0,
      (report) => report.reachedReward === true && report.returnedToMap === true,
      'reward flow smoke report is green and fresh',
      'reward flow smoke report is not green',
    );

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /screenshot/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects flow smoke reports with empty screenshot evidence', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-flow-empty-screenshot-'));
  const reportsDir = join(fixtureRoot, 'reports', 'flows');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const reportRelPath = 'reports/flows/reward-flow-smoke.json';
  const screenshotPath = join(outputDir, 'reward.png');

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(screenshotPath, '');
    writeFileSync(
      join(fixtureRoot, reportRelPath),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reachedReward: true,
        returnedToMap: true,
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
        screenshots: [screenshotPath],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkFlowReport(
      'reward_flow_smoke',
      reportRelPath,
      0,
      (report) => report.reachedReward === true && report.returnedToMap === true,
      'reward flow smoke report is green and fresh',
      'reward flow smoke report is not green',
    );

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /screenshot/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects flow smoke reports with failed network requests', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-flow-failed-requests-'));
  const reportsDir = join(fixtureRoot, 'reports', 'flows');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const reportRelPath = 'reports/flows/reward-flow-smoke.json';
  const screenshotPath = join(outputDir, 'reward.png');

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(screenshotPath, 'png-bytes');
    writeFileSync(
      join(fixtureRoot, reportRelPath),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reachedReward: true,
        returnedToMap: true,
        consoleErrors: [],
        pageErrors: [],
        failedRequests: ['http://127.0.0.1:3000/assets/missing-card.webp'],
        screenshots: [screenshotPath],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkFlowReport(
      'reward_flow_smoke',
      reportRelPath,
      0,
      (report) => report.reachedReward === true && report.returnedToMap === true,
      'reward flow smoke report is green and fresh',
      'reward flow smoke report is not green',
    );

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /failed request/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects flow smoke reports with stale generatedAt evidence', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-flow-generated-at-'));
  const reportsDir = join(fixtureRoot, 'reports', 'flows');
  const outputDir = join(fixtureRoot, 'output', 'playwright');
  const reportRelPath = 'reports/flows/reward-flow-smoke.json';
  const screenshotPath = join(outputDir, 'reward.png');
  const reportPath = join(fixtureRoot, reportRelPath);
  const freshTime = new Date('2026-05-25T00:00:00Z');

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(screenshotPath, 'png-bytes');
    writeFileSync(
      reportPath,
      JSON.stringify({
        generatedAt: '2000-01-01T00:00:00.000Z',
        reachedReward: true,
        returnedToMap: true,
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
        screenshots: [screenshotPath],
      }),
    );
    utimesSync(reportPath, freshTime, freshTime);
    utimesSync(screenshotPath, freshTime, freshTime);

    process.chdir(fixtureRoot);
    const check = checkFlowReport(
      'reward_flow_smoke',
      reportRelPath,
      Date.parse('2026-05-24T00:00:00Z'),
      (report) => report.reachedReward === true && report.returnedToMap === true,
      'reward flow smoke report is green and fresh',
      'reward flow smoke report is not green',
    );

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /generatedAt/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects responsive readability reports with unresolved issues', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-responsive-readability-'));
  const reportsDir = join(fixtureRoot, 'reports', 'ui');
  const outputDir = join(fixtureRoot, 'output', 'playwright', 'ui-responsive-readability');
  const screenshotPath = join(outputDir, 'mobile-system-menu.png');

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(screenshotPath, 'png-bytes');
    writeFileSync(
      join(reportsDir, 'responsive-readability.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        overallStatus: 'pass',
        surfaceCount: 3,
        viewportCount: 2,
        profileCount: 1,
        audits: [
          {
            surface: 'relic-upgrade',
            viewport: 'mobile-320x640',
            profile: 'baseline',
            screenshot: screenshotPath,
          },
        ],
        issues: [
          {
            surface: 'combat',
            viewport: 'mobile-320x640',
            kind: 'small-text',
            selector: '.immersive-card__text',
            detail: 'fontSize=8px',
          },
        ],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkResponsiveReadabilityReport(0);

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /responsive readability/i);
    assert.match(check.evidence, /issues/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness requires responsive readability report to cover real screenshots', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-responsive-readability-screenshots-'));
  const reportsDir = join(fixtureRoot, 'reports', 'ui');

  try {
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(
      join(reportsDir, 'responsive-readability.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        overallStatus: 'pass',
        surfaceCount: 3,
        viewportCount: 2,
        profileCount: 1,
        audits: [
          {
            surface: 'system-menu-root',
            viewport: 'mobile-320x640',
            profile: 'baseline',
            screenshot: join(fixtureRoot, 'output', 'playwright', 'missing.png'),
          },
        ],
        issues: [],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkResponsiveReadabilityReport(0);

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /screenshot/i);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects focused responsive readability reports without full profile coverage', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-responsive-readability-focused-'));
  const reportsDir = join(fixtureRoot, 'reports', 'ui');
  const outputDir = join(fixtureRoot, 'output', 'playwright', 'ui-responsive-readability');
  const screenshotPath = join(outputDir, 'baseline-mobile-system-menu.png');

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(screenshotPath, 'png-bytes');
    writeFileSync(
      join(reportsDir, 'responsive-readability.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        overallStatus: 'pass',
        surfaceCount: 6,
        viewportCount: 6,
        profileCount: 1,
        profiles: [
          {
            name: 'baseline',
            surfaceCount: 6,
            viewportCount: 6,
            rootFontPercent: 100,
            colorScheme: 'default',
          },
        ],
        audits: [
          {
            surface: 'system-menu-root',
            viewport: 'mobile-320x640',
            profile: 'baseline',
            screenshot: screenshotPath,
          },
        ],
        issues: [],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkResponsiveReadabilityReport(0);

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /profile coverage/i);
    assert.match(check.evidence, /text-zoom-200/);
    assert.match(check.evidence, /light-theme/);
    assert.match(check.evidence, /extreme-aspect/);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness accepts complete responsive readability profile coverage', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-responsive-readability-complete-'));
  const reportsDir = join(fixtureRoot, 'reports', 'ui');
  const outputDir = join(fixtureRoot, 'output', 'playwright', 'ui-responsive-readability');
  const requiredProfiles = [
    ['baseline', 30, 11],
    ['text-zoom-200', 18, 3],
    ['light-theme', 15, 2],
    ['extreme-aspect', 18, 4],
  ] as const;

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    const audits = requiredProfiles.flatMap(([profile, surfaceCount, viewportCount]) => {
      const entries = [];
      for (let index = 0; index < surfaceCount; index += 1) {
        const screenshotPath = join(outputDir, `${profile}-surface-${index}.png`);
        writeFileSync(screenshotPath, 'png-bytes');
        entries.push({
          surface: index === 0 ? 'relic-upgrade' : `surface-${index}`,
          viewport: `viewport-${index % viewportCount}`,
          profile,
          screenshot: screenshotPath,
        });
      }
      return entries;
    });

    writeFileSync(
      join(reportsDir, 'responsive-readability.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        overallStatus: 'pass',
        surfaceCount: 30,
        viewportCount: 11,
        profileCount: 4,
        profiles: requiredProfiles.map(([name, surfaceCount, viewportCount]) => ({
          name,
          surfaceCount,
          viewportCount,
          rootFontPercent: name === 'text-zoom-200' ? 200 : 100,
          colorScheme: name === 'light-theme' ? 'light' : 'default',
        })),
        audits,
        issues: [],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkResponsiveReadabilityReport(0);

    assert.equal(check.status, 'pass');
    assert.match(check.evidence, /4 profiles/);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects responsive readability reports that miss the relic upgrade screen', () => {
  const previousCwd = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-responsive-readability-missing-relic-'));
  const reportsDir = join(fixtureRoot, 'reports', 'ui');
  const outputDir = join(fixtureRoot, 'output', 'playwright', 'ui-responsive-readability');
  const requiredProfiles = [
    ['baseline', 30, 11],
    ['text-zoom-200', 18, 3],
    ['light-theme', 15, 2],
    ['extreme-aspect', 18, 4],
  ] as const;

  try {
    mkdirSync(reportsDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    const audits = requiredProfiles.flatMap(([profile, surfaceCount, viewportCount]) => {
      const entries = [];
      for (let index = 0; index < surfaceCount; index += 1) {
        const screenshotPath = join(outputDir, `${profile}-missing-relic-surface-${index}.png`);
        writeFileSync(screenshotPath, 'png-bytes');
        entries.push({
          surface: `surface-${index}`,
          viewport: `viewport-${index % viewportCount}`,
          profile,
          screenshot: screenshotPath,
        });
      }
      return entries;
    });

    writeFileSync(
      join(reportsDir, 'responsive-readability.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        overallStatus: 'pass',
        surfaceCount: 30,
        viewportCount: 11,
        profileCount: 4,
        profiles: requiredProfiles.map(([name, surfaceCount, viewportCount]) => ({
          name,
          surfaceCount,
          viewportCount,
          rootFontPercent: name === 'text-zoom-200' ? 200 : 100,
          colorScheme: name === 'light-theme' ? 'light' : 'default',
        })),
        audits,
        issues: [],
      }),
    );

    process.chdir(fixtureRoot);
    const check = checkResponsiveReadabilityReport(0);

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /relic-upgrade/);
  } finally {
    process.chdir(previousCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness rejects doctor reports generated for a stale git state', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-doctor-git-state-'));
  const doctorReportPath = join(fixtureRoot, 'reports', 'doctor', 'report.json');

  try {
    mkdirSync(join(fixtureRoot, 'reports', 'doctor'), { recursive: true });
    writeFileSync(
      doctorReportPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        gitHead: 'oldhead',
        gitDirty: true,
        summary: {
          total: 44,
          passed: 44,
          failed: 0,
          skipped: 0,
        },
      }),
    );

    const check = checkDoctorReportArtifact(doctorReportPath, 0, {
      gitHead: 'newhead',
      gitDirty: false,
    });

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /git state/i);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness surfaces failed doctor stages even when the report is stale', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-doctor-stale-failure-'));
  const doctorReportPath = join(fixtureRoot, 'reports', 'doctor', 'report.json');
  const staleTime = new Date('2000-01-01T00:00:00Z');

  try {
    mkdirSync(join(fixtureRoot, 'reports', 'doctor'), { recursive: true });
    writeFileSync(
      doctorReportPath,
      JSON.stringify({
        timestamp: staleTime.toISOString(),
        gitHead: 'samehead',
        gitDirty: false,
        stages: [
          { name: 'Check GitHub Transport', status: 'fail', duration: 1, failureType: 'environment' },
        ],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          byCategory: {
            environment: 1,
          },
        },
      }),
    );
    utimesSync(doctorReportPath, staleTime, staleTime);

    const check = checkDoctorReportArtifact(doctorReportPath, Date.parse('2026-05-25T00:00:00Z'), {
      gitHead: 'samehead',
      gitDirty: false,
    });

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /Check GitHub Transport/);
    assert.match(check.evidence, /environment/);
    assert.match(check.evidence, /stale/i);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('release readiness requires doctor reports to include runtime V2 and Python runtime stages', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-doctor-runtime-v2-'));
  const doctorReportPath = join(fixtureRoot, 'reports', 'doctor', 'report.json');

  try {
    mkdirSync(join(fixtureRoot, 'reports', 'doctor'), { recursive: true });
    writeFileSync(
      doctorReportPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        gitHead: 'samehead',
        gitDirty: false,
        stages: [
          { name: 'Lint', status: 'pass', duration: 1 },
          { name: 'Runtime V2 TypeScript Tests', status: 'pass', duration: 1 },
        ],
        summary: {
          total: 2,
          passed: 2,
          failed: 0,
          skipped: 0,
        },
      }),
    );

    const check = checkDoctorReportArtifact(doctorReportPath, 0, {
      gitHead: 'samehead',
      gitDirty: false,
    });

    assert.equal(check.status, 'fail');
    assert.match(check.evidence, /Check Python WASM Runtime Sync/);
    assert.match(check.evidence, /Python Runtime Unit Tests/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
