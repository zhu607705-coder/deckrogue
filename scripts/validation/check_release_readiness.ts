#!/usr/bin/env node

/**
 * @file check_release_readiness.ts
 * @description 检查发布准备情况，验证发布前的必要条件和最佳实践。
 *
 * 主要职责:
 * - 检查 README 更新和版本变更
 * - 验证测试覆盖率和构建状态
 * - 生成发布准备报告
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import {
  type UiSmokeExpansionReport,
  validateUiSmokeExpansionReport,
} from './uiSmokeExpansionContract';
import { REQUIRED_PYODIDE_ASSET_FILES } from '../desktop/pyodide_assets.ts';

const REPORT_DIR = 'reports/release';
const REPORT_PATH = `${REPORT_DIR}/release-readiness.json`;
const DEFAULT_REPORT_MAX_FILES = 2000;
const DEFAULT_REPORT_MAX_BYTES = 50 * 1024 * 1024;

type CheckStatus = 'pass' | 'warn' | 'fail';

interface ReleaseCheck {
  id: string;
  status: CheckStatus;
  evidence: string;
}

interface ReleaseReadinessReport {
  timestamp: string;
  checks: ReleaseCheck[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
    overallStatus: 'pass' | 'fail';
  };
}

const FRESHNESS_ROOTS = [
  'package.json',
  'package-lock.json',
  'electron',
  'index.html',
  'public',
  'src',
  'scripts',
  'CHANGELOG.md',
  'VERSION',
  'docs/releases',
  'docs/contracts/settlement-order.md'
];

const FRESHNESS_IGNORE_SEGMENTS = new Set(['.git', 'node_modules', 'dist', 'reports', 'output']);

type DoctorReport = {
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
  };
};

type SecurityReport = {
  summary?: {
    overallStatus?: string;
    riskLevel?: string;
  };
  analysis?: {
    overallStatus?: string;
    riskLevel?: string;
  };
};

type GenericFlowReport = Record<string, unknown> & {
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
};

type DesktopBuildReport = {
  overallStatus?: string;
  rendererIndexPath?: string;
  electronMainPath?: string;
  preloadPath?: string;
  pyodideAssetDir?: string;
  pyodideAssets?: Array<{
    fileName?: string;
    path?: string;
    sizeBytes?: number;
  }>;
};

type DesktopSmokeReport = {
  mode?: string;
  overallStatus?: string;
  closeStatus?: string;
  closeError?: string;
  screenshots?: unknown[];
  steps?: string[];
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
  failedRequests?: unknown[];
};

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function collectDirectorySummary(target: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const entryPath = resolve(target, entry.name);
    if (entry.isDirectory()) {
      const child = collectDirectorySummary(entryPath);
      files += child.files;
      bytes += child.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(entryPath).size;
    }
  }

  return { files, bytes };
}

function checkFile(path: string, id: string): ReleaseCheck {
  return existsSync(path)
    ? { id, status: 'pass', evidence: `${path} exists` }
    : { id, status: 'fail', evidence: `${path} is missing` };
}

function getLatestMtime(target: string): number {
  const abs = resolve(target);
  if (!existsSync(abs)) return 0;
  const stats = statSync(abs);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }

  let latest = stats.mtimeMs;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (FRESHNESS_IGNORE_SEGMENTS.has(entry.name)) continue;
    latest = Math.max(latest, getLatestMtime(resolve(abs, entry.name)));
  }
  return latest;
}

function getWorkspaceFreshnessBaseline(): number {
  return FRESHNESS_ROOTS.reduce((latest, target) => Math.max(latest, getLatestMtime(target)), 0);
}

function isArtifactFresh(path: string, freshnessBaseline: number): boolean {
  return statSync(path).mtimeMs >= freshnessBaseline;
}

function readJsonFile<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function collectScreenshotEvidence(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectScreenshotEvidence(entry));
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const screenshots: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'screenshot' && typeof nested === 'string') {
      screenshots.push(nested);
      continue;
    }
    if (key === 'screenshots' && Array.isArray(nested)) {
      screenshots.push(...nested.filter((entry): entry is string => typeof entry === 'string'));
      continue;
    }
    screenshots.push(...collectScreenshotEvidence(nested));
  }
  return screenshots;
}

function hasFreshScreenshotEvidence(report: unknown, freshnessBaseline: number): boolean {
  const screenshots = collectScreenshotEvidence(report);
  return screenshots.length > 0 && screenshots.every((screenshot) => {
    if (screenshot.trim().length === 0) {
      return false;
    }
    const screenshotPath = resolve(screenshot);
    return existsSync(screenshotPath) && isArtifactFresh(screenshotPath, freshnessBaseline);
  });
}

function checkVersionConsistency(): ReleaseCheck {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as { version?: string };
  const versionFile = existsSync('VERSION') ? readFileSync('VERSION', 'utf-8').trim() : '';
  return packageJson.version === versionFile
    ? { id: 'version_consistency', status: 'pass', evidence: `package.json=${packageJson.version}, VERSION=${versionFile}` }
    : { id: 'version_consistency', status: 'fail', evidence: `package.json=${packageJson.version}, VERSION=${versionFile || 'missing'}` };
}

function checkBuildArtifacts(freshnessBaseline: number): ReleaseCheck[] {
  const results: ReleaseCheck[] = [];
  const distIndex = resolve('dist/index.html');
  if (!existsSync(distIndex)) {
    results.push({ id: 'dist_index', status: 'fail', evidence: 'dist/index.html missing; run build first' });
  } else {
    const fresh = isArtifactFresh(distIndex, freshnessBaseline);
    results.push(fresh
      ? { id: 'dist_index', status: 'pass', evidence: 'dist/index.html exists and is fresh' }
      : { id: 'dist_index', status: 'fail', evidence: 'dist/index.html is stale for current workspace state; run build again' });
  }

  const assetsDir = resolve('dist/assets');
  if (!existsSync(assetsDir)) {
    results.push({ id: 'dist_assets', status: 'fail', evidence: 'dist/assets missing' });
  } else {
    const assetCount = readdirSync(assetsDir).length;
    const fresh = isArtifactFresh(assetsDir, freshnessBaseline);
    results.push(assetCount > 0 && fresh
      ? { id: 'dist_assets', status: 'pass', evidence: `dist/assets contains ${assetCount} files and is fresh` }
      : { id: 'dist_assets', status: 'fail', evidence: assetCount === 0 ? 'dist/assets is empty' : 'dist/assets is stale for current workspace state; run build again' });
  }

  return results;
}

function hasBundledPyodideAssets(buildReport: DesktopBuildReport | null): boolean {
  if (!buildReport?.pyodideAssetDir || !existsSync(buildReport.pyodideAssetDir)) {
    return false;
  }
  const reportedAssets = Array.isArray(buildReport.pyodideAssets) ? buildReport.pyodideAssets : [];
  return REQUIRED_PYODIDE_ASSET_FILES.every((fileName) => {
    const reported = reportedAssets.find((asset) => asset.fileName === fileName);
    if (!reported?.path || (reported.sizeBytes ?? 0) <= 0) {
      return false;
    }
    if (!existsSync(reported.path)) {
      return false;
    }
    return statSync(reported.path).isFile() && statSync(reported.path).size > 0;
  });
}

export function checkDesktopArtifacts(freshnessBaseline: number): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [];
  const buildReportPath = resolve('reports/desktop/desktop-build.json');
  if (!existsSync(buildReportPath)) {
    checks.push({ id: 'desktop_build_report', status: 'fail', evidence: 'reports/desktop/desktop-build.json missing; run build:desktop' });
  } else {
    const buildReport = readJsonFile<DesktopBuildReport>(buildReportPath);
    const fresh = isArtifactFresh(buildReportPath, freshnessBaseline);
    const rendererExists = buildReport?.rendererIndexPath ? existsSync(buildReport.rendererIndexPath) : false;
    const mainExists = buildReport?.electronMainPath ? existsSync(buildReport.electronMainPath) : false;
    const preloadExists = buildReport?.preloadPath ? existsSync(buildReport.preloadPath) : false;
    const pyodideAssetsBundled = hasBundledPyodideAssets(buildReport);
    const healthy = buildReport?.overallStatus === 'pass' && rendererExists && mainExists && preloadExists && pyodideAssetsBundled;
    checks.push(healthy && fresh
      ? { id: 'desktop_build_report', status: 'pass', evidence: 'desktop build report is green, fresh, and includes bundled Pyodide runtime assets' }
      : { id: 'desktop_build_report', status: 'fail', evidence: fresh ? 'desktop build report is not green, missing expected artifacts, or missing bundled Pyodide runtime assets' : 'desktop build report is stale for current workspace state; run build:desktop again' });
  }

  const smokeReportPath = resolve('reports/desktop/desktop-smoke.json');
  if (!existsSync(smokeReportPath)) {
    checks.push({ id: 'desktop_smoke_report', status: 'fail', evidence: 'reports/desktop/desktop-smoke.json missing; run test:desktop-smoke' });
  } else {
    const smokeReport = readJsonFile<DesktopSmokeReport>(smokeReportPath);
    const fresh = isArtifactFresh(smokeReportPath, freshnessBaseline);
    const expectedSteps = ['launcher', 'tutorial', 'character_select', 'map', 'combat'];
    const stepsCovered = expectedSteps.every((step) => smokeReport?.steps?.includes(step));
    const screenshots = Array.isArray(smokeReport?.screenshots) ? smokeReport.screenshots : [];
    const screenshotsFresh =
      screenshots.length >= expectedSteps.length &&
      screenshots.every((screenshot) => {
        if (typeof screenshot !== 'string' || screenshot.trim().length === 0) {
          return false;
        }
        const screenshotPath = resolve(screenshot);
        return existsSync(screenshotPath) && isArtifactFresh(screenshotPath, freshnessBaseline);
      });
    const healthy =
      smokeReport?.overallStatus === 'pass' &&
      smokeReport?.closeStatus === 'pass' &&
      smokeReport?.mode === 'production' &&
      (smokeReport.consoleErrors?.length || 0) === 0 &&
      (smokeReport.pageErrors?.length || 0) === 0 &&
      (smokeReport.failedRequests?.length || 0) === 0 &&
      stepsCovered &&
      screenshotsFresh;
    checks.push(healthy && fresh
      ? { id: 'desktop_smoke_report', status: 'pass', evidence: 'desktop smoke report is green, closed cleanly, production-mode, includes screenshot evidence, and is fresh' }
      : { id: 'desktop_smoke_report', status: 'fail', evidence: fresh ? 'desktop smoke report is not green, did not close cleanly, is not production-mode, misses required flow steps, or lacks fresh screenshot evidence' : 'desktop smoke report is stale for current workspace state; run test:desktop-smoke again' });
  }

  return checks;
}

function checkSaveAndSettingsContracts(): ReleaseCheck[] {
  const content = readFileSync('src/core/persistence/saveManager.ts', 'utf-8');
  const results: ReleaseCheck[] = [];

  results.push(content.includes("SAVE_KEY_PREFIX = 'deckrogue_save_'")
    ? { id: 'save_namespace', status: 'pass', evidence: 'fixed save key namespace detected' }
    : { id: 'save_namespace', status: 'fail', evidence: 'fixed save key namespace missing' });

  results.push(content.includes('saveSettings(settings')
    && content.includes('loadSettings()')
    ? { id: 'settings_persistence', status: 'pass', evidence: 'saveSettings/loadSettings present' }
    : { id: 'settings_persistence', status: 'fail', evidence: 'settings persistence methods missing' });

  results.push(content.includes('clearAllData(): boolean')
    ? { id: 'save_cleanup', status: 'pass', evidence: 'clearAllData available' }
    : { id: 'save_cleanup', status: 'fail', evidence: 'clearAllData missing' });

  return results;
}

function checkArtifactWeight(): ReleaseCheck {
  const reportsDir = resolve('reports');
  if (!existsSync(reportsDir)) {
    return { id: 'reports_dir', status: 'pass', evidence: 'reports/ missing; no accumulated logs to inspect' };
  }
  const stats = statSync(reportsDir);
  if (!stats.isDirectory()) {
    return { id: 'reports_dir', status: 'fail', evidence: 'reports exists but is not a directory' };
  }

  const maxFiles = getPositiveIntegerEnv('RELEASE_READINESS_REPORT_MAX_FILES', DEFAULT_REPORT_MAX_FILES);
  const maxBytes = getPositiveIntegerEnv('RELEASE_READINESS_REPORT_MAX_BYTES', DEFAULT_REPORT_MAX_BYTES);
  const summary = collectDirectorySummary(reportsDir);
  const sizeMiB = Math.round((summary.bytes / (1024 * 1024)) * 100) / 100;
  const maxMiB = Math.round((maxBytes / (1024 * 1024)) * 100) / 100;
  const withinLimits = summary.files <= maxFiles && summary.bytes <= maxBytes;

  return withinLimits
    ? {
      id: 'reports_dir',
      status: 'pass',
      evidence: `reports/ growth checked: ${summary.files} files, ${sizeMiB} MiB <= ${maxFiles} files, ${maxMiB} MiB`
    }
    : {
      id: 'reports_dir',
      status: 'fail',
      evidence: `reports/ exceeds growth limits: ${summary.files} files, ${sizeMiB} MiB > ${maxFiles} files or ${maxMiB} MiB`
    };
}

function checkDoctorAndSecurityArtifacts(): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [];
  const freshnessBaseline = getWorkspaceFreshnessBaseline();
  const latestDoctor = resolve('reports/doctor/report.json');
  const inFlightDoctor = process.env.DOCTOR_IN_FLIGHT === '1';
  if (inFlightDoctor) {
    checks.push({
      id: 'doctor_report',
      status: 'warn',
      evidence: 'doctor report is being generated by the current in-flight doctor run'
    });
  } else if (!existsSync(latestDoctor)) {
    checks.push({ id: 'doctor_report', status: 'fail', evidence: 'no doctor report found in reports/doctor' });
  } else {
    const doctorReport = readJsonFile<DoctorReport>(latestDoctor);
    const failed = doctorReport?.summary?.failed ?? Number.NaN;
    const fresh = isArtifactFresh(latestDoctor, freshnessBaseline);
    checks.push(Number.isFinite(failed) && failed === 0 && fresh
      ? { id: 'doctor_report', status: 'pass', evidence: `latest doctor report is green and fresh: ${latestDoctor}` }
      : { id: 'doctor_report', status: 'fail', evidence: fresh ? `latest doctor report is not green: ${latestDoctor}` : `latest doctor report is stale for current workspace state: ${latestDoctor}` });
  }

  const latestSecurity = resolve('reports/security/security-report.json');
  if (!existsSync(latestSecurity)) {
    checks.push({ id: 'security_report', status: 'fail', evidence: 'no security report found in reports/security' });
  } else {
    const securityReport = readJsonFile<SecurityReport>(latestSecurity);
    const overallStatus = securityReport?.summary?.overallStatus || securityReport?.analysis?.overallStatus;
    const fresh = isArtifactFresh(latestSecurity, freshnessBaseline);
    checks.push(overallStatus === 'healthy' && fresh
      ? { id: 'security_report', status: 'pass', evidence: `latest security report is healthy and fresh: ${latestSecurity}` }
      : { id: 'security_report', status: 'fail', evidence: fresh ? `latest security report is not healthy: ${latestSecurity}` : `latest security report is stale for current workspace state: ${latestSecurity}` });
  }

  const latestUiExpansion = existsSync(resolve('output/playwright/ui_smoke_expansion_report.json'))
    ? resolve('output/playwright/ui_smoke_expansion_report.json')
    : null;
  if (!latestUiExpansion) {
    checks.push({ id: 'ui_smoke_expansion_report', status: 'fail', evidence: 'output/playwright/ui_smoke_expansion_report.json missing' });
  } else {
    const uiSmokeReport = readJsonFile<UiSmokeExpansionReport>(latestUiExpansion);
    const failures = validateUiSmokeExpansionReport(uiSmokeReport, {
      reportPath: latestUiExpansion,
      freshnessBaseline,
    });
    checks.push(failures.length === 0
      ? { id: 'ui_smoke_expansion_report', status: 'pass', evidence: `ui smoke expansion report is clean and fresh: ${latestUiExpansion}` }
      : { id: 'ui_smoke_expansion_report', status: 'fail', evidence: `ui smoke expansion report failed contract: ${failures.join('; ')}` });
  }

  return checks;
}

export function checkFlowReport(
  id: string,
  reportRelPath: string,
  freshnessBaseline: number,
  predicate: (report: GenericFlowReport) => boolean,
  successEvidence: string,
  failureEvidence: string
): ReleaseCheck {
  const reportPath = resolve(reportRelPath);
  if (!existsSync(reportPath)) {
    return { id, status: 'fail', evidence: `${reportRelPath} missing` };
  }
  const report = readJsonFile<GenericFlowReport>(reportPath);
  const fresh = isArtifactFresh(reportPath, freshnessBaseline);
  const screenshotEvidenceFresh = hasFreshScreenshotEvidence(report, freshnessBaseline);
  const clean =
    (report?.consoleErrors?.length || 0) === 0 &&
    (report?.pageErrors?.length || 0) === 0 &&
    !!report &&
    screenshotEvidenceFresh &&
    predicate(report);
  return clean && fresh
    ? { id, status: 'pass', evidence: successEvidence }
    : {
      id,
      status: 'fail',
      evidence: fresh
        ? (screenshotEvidenceFresh ? failureEvidence : `${failureEvidence}; missing or stale screenshot evidence`)
        : `${reportRelPath} is stale for current workspace state`
    };
}

function checkCanonicalFlowArtifacts(freshnessBaseline: number): ReleaseCheck[] {
  return [
    checkFlowReport(
      'reward_flow_smoke',
      'reports/flows/reward-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedReward === true && report.returnedToMap === true,
      'reward flow smoke report is green and fresh',
      'reward flow smoke report is not green'
    ),
    checkFlowReport(
      'terminal_flow_smoke',
      'reports/flows/terminal-flow-smoke.json',
      freshnessBaseline,
      (report) => Array.isArray(report.cases) && report.cases.every((entry: any) => entry.reachedTerminal === true && entry.exitedTerminal === true),
      'terminal flow smoke report is green and fresh',
      'terminal flow smoke report is not green'
    ),
    checkFlowReport(
      'shop_flow_smoke',
      'reports/flows/shop-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedShop === true && report.reachedEnchant === true && report.returnedToShop === true && report.returnedToMap === true,
      'shop flow smoke report is green and fresh',
      'shop flow smoke report is not green'
    ),
    checkFlowReport(
      'event_flow_smoke',
      'reports/flows/event-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedEvent === true && report.resolvedEvent === true && report.returnedToMap === true,
      'event flow smoke report is green and fresh',
      'event flow smoke report is not green'
    ),
    checkFlowReport(
      'rest_flow_smoke',
      'reports/flows/rest-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedRest === true && report.healed === true && report.returnedToMap === true,
      'rest flow smoke report is green and fresh',
      'rest flow smoke report is not green'
    ),
    checkFlowReport(
      'upgrade_flow_smoke',
      'reports/flows/upgrade-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedRest === true && report.reachedUpgrade === true && report.appliedUpgrade === true && report.returnedToMap === true,
      'upgrade flow smoke report is green and fresh',
      'upgrade flow smoke report is not green'
    ),
    checkFlowReport(
      'remove_card_flow_smoke',
      'reports/flows/remove-card-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedRest === true && report.reachedRemoveCard === true && report.removedCard === true && report.returnedToMap === true,
      'remove-card flow smoke report is green and fresh',
      'remove-card flow smoke report is not green'
    ),
    checkFlowReport(
      'boss_phase_flow_smoke',
      'reports/flows/boss-phase-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedCombat === true && report.triggeredPhaseEffect === true,
      'boss phase flow smoke report is green and fresh',
      'boss phase flow smoke report is not green'
    ),
    checkFlowReport(
      'boss_terminal_flow_smoke',
      'reports/flows/boss-terminal-flow-smoke.json',
      freshnessBaseline,
      (report) => report.reachedTerminal === true && report.exitedToCharacterSelect === true,
      'boss terminal flow smoke report is green and fresh',
      'boss terminal flow smoke report is not green'
    ),
  ];
}

function checkFreezeDefinition(): ReleaseCheck[] {
  const freezePath = 'docs/releases/current-version-freeze.md';
  if (!existsSync(freezePath)) {
    return [{ id: 'freeze_definition', status: 'fail', evidence: `${freezePath} missing` }];
  }

  const content = readFileSync(freezePath, 'utf-8');
  const checks: ReleaseCheck[] = [];
  const expectedSnippets = [
    { id: 'freeze_roles', text: '角色数：`6`' },
    { id: 'freeze_chapters', text: '章节数：`3`' },
    { id: 'freeze_scope', text: '修 bug' }
  ];

  for (const snippet of expectedSnippets) {
    checks.push(content.includes(snippet.text)
      ? { id: snippet.id, status: 'pass', evidence: `found "${snippet.text}" in current-version-freeze.md` }
      : { id: snippet.id, status: 'fail', evidence: `missing "${snippet.text}" in current-version-freeze.md` });
  }

  const nodeTypes = ['`Combat`', '`Elite`', '`Event`', '`Shop`', '`Rest`', '`Boss`'];
  const missingNodeTypes = nodeTypes.filter((snippet) => !content.includes(snippet));
  checks.push(missingNodeTypes.length === 0
    ? { id: 'freeze_nodes', status: 'pass', evidence: 'all required map node types documented in current-version-freeze.md' }
    : { id: 'freeze_nodes', status: 'fail', evidence: `missing map node types: ${missingNodeTypes.join(', ')}` });

  return checks;
}

function checkEnemyVariantReadiness(): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [];
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts || {};
  const requiredScripts = [
    'check:enemy-visual-identity',
    'check:enemy-variant-behavior',
    'check:enemy-first3-exposure',
    'check:map-route-constraints'
  ];

  for (const scriptName of requiredScripts) {
    checks.push(scripts[scriptName]
      ? { id: `script_${scriptName.replace(/[:]/g, '_')}`, status: 'pass', evidence: `${scriptName} present in package.json` }
      : { id: `script_${scriptName.replace(/[:]/g, '_')}`, status: 'fail', evidence: `${scriptName} missing from package.json` });
  }

  const requiredFiles = [
    'scripts/validation/check_enemy_visual_identity.ts',
    'scripts/validation/check_enemy_variant_behavior.ts',
    'scripts/validation/check_enemy_first3_exposure.ts',
    'scripts/validation/check_map_route_constraints.ts',
    'scripts/assets/generate_enemy_variant_art.cjs'
  ];

  for (const file of requiredFiles) {
    checks.push(checkFile(file, file.replace(/[/.:-]+/g, '_')));
  }

  const enemiesPath = resolve('src/content/data/enemies.json');
  if (!existsSync(enemiesPath)) {
    checks.push({ id: 'enemy_variant_records', status: 'fail', evidence: 'src/content/data/enemies.json missing' });
  } else {
    const enemies = readJsonFile<Array<{ id: string; keywords?: string[] }>>(enemiesPath) || [];
    const variantCount = enemies.filter((enemy) => enemy.keywords?.includes('variant')).length;
    checks.push(variantCount >= 6
      ? { id: 'enemy_variant_records', status: 'pass', evidence: `found ${variantCount} variant enemy records` }
      : { id: 'enemy_variant_records', status: 'fail', evidence: `expected at least 6 variant enemy records, found ${variantCount}` });
  }

  const enemyAssetDir = resolve('public/assets/enemies');
  const requiredAssets = [
    'slime_small_glass.png',
    'slime_small_rot.png',
    'goblin_trapper.png',
    'barrier_redeemer.png',
    'cultist_herald.png',
    'jaw_worm_burrower.png'
  ];
  const missingAssets = requiredAssets.filter((asset) => !existsSync(resolve(enemyAssetDir, asset)));
  checks.push(missingAssets.length === 0
    ? { id: 'enemy_variant_assets', status: 'pass', evidence: `all ${requiredAssets.length} planned variant assets exist` }
    : { id: 'enemy_variant_assets', status: 'fail', evidence: `missing variant assets: ${missingAssets.join(', ')}` });

  return checks;
}

export function main() {
  ensureDir(REPORT_DIR);
  const freshnessBaseline = getWorkspaceFreshnessBaseline();
  const checks: ReleaseCheck[] = [
    checkVersionConsistency(),
    checkFile('CHANGELOG.md', 'changelog'),
    checkFile('docs/releases/current-version-freeze.md', 'version_freeze'),
    checkFile('docs/contracts/settlement-order.md', 'settlement_order'),
    checkFile('docs/releases/release-checklist.md', 'release_checklist'),
    checkFile('docs/releases/blind-test-template.md', 'blind_test_template'),
    ...checkFreezeDefinition(),
    ...checkBuildArtifacts(freshnessBaseline),
    ...checkDesktopArtifacts(freshnessBaseline),
    ...checkSaveAndSettingsContracts(),
    ...checkEnemyVariantReadiness(),
    ...checkDoctorAndSecurityArtifacts(),
    ...checkCanonicalFlowArtifacts(freshnessBaseline),
    checkArtifactWeight()
  ];

  const passed = checks.filter((check) => check.status === 'pass').length;
  const warned = checks.filter((check) => check.status === 'warn').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  const report: ReleaseReadinessReport = {
    timestamp: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      passed,
      warned,
      failed,
      overallStatus: failed > 0 ? 'fail' : 'pass'
    }
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`[release-readiness] report: ${REPORT_PATH}`);
  console.log(`[release-readiness] pass=${passed} warn=${warned} fail=${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main();
}
