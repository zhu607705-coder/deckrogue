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
        reachedReward: true,
        returnedToMap: true,
        consoleErrors: [],
        pageErrors: [],
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

test('release readiness requires doctor reports to include the runtime V2 TypeScript stage', () => {
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
          { name: 'Supplemental Unit Tests', status: 'pass', duration: 1 },
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
    assert.match(check.evidence, /Runtime V2 TypeScript Tests/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
