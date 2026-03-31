#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const REPORT_DIR = 'reports/release';
const REPORT_PATH = `${REPORT_DIR}/release-readiness.json`;

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
  'electron-builder.json',
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

type UiSmokeExpansionReport = {
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
  failedRequests?: unknown[];
  audits?: Array<{
    brokenImages?: unknown[];
    layoutIssues?: unknown[];
  }>;
};

type DesktopBuildReport = {
  overallStatus?: string;
  rendererIndexPath?: string;
  electronMainPath?: string;
  preloadPath?: string;
};

type DesktopSmokeReport = {
  mode?: string;
  overallStatus?: string;
  steps?: string[];
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
  failedRequests?: unknown[];
};

type WindowsInstallerReport = {
  overallStatus?: string;
  artifactPath?: string | null;
  platform?: string;
};

type WindowsInstallerCheckInput = {
  currentPlatform: string;
  reportExists: boolean;
  reportFresh: boolean;
  reportHealthy: boolean;
  artifactExists: boolean;
};

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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

export function evaluateWindowsInstallerCheck(input: WindowsInstallerCheckInput): ReleaseCheck {
  if (!input.reportExists) {
    return {
      id: 'windows_installer',
      status: 'fail',
      evidence: input.currentPlatform === 'win32'
        ? 'Windows installer report missing on Windows build machine; run dist:win'
        : 'Windows installer report missing; Windows EXE delivery requires a verified installer artifact from a Windows build machine or CI'
    };
  }

  if (!input.reportFresh) {
    return {
      id: 'windows_installer',
      status: 'fail',
      evidence: 'windows installer report is stale for current workspace state; run dist:win again on a Windows builder'
    };
  }

  if (!input.reportHealthy || !input.artifactExists) {
    return {
      id: 'windows_installer',
      status: 'fail',
      evidence: 'windows installer report is not green or installer artifact is missing'
    };
  }

  return {
    id: 'windows_installer',
    status: 'pass',
    evidence: 'windows installer report is green and fresh'
  };
}

function checkDesktopArtifacts(freshnessBaseline: number): ReleaseCheck[] {
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
    const healthy = buildReport?.overallStatus === 'pass' && rendererExists && mainExists && preloadExists;
    checks.push(healthy && fresh
      ? { id: 'desktop_build_report', status: 'pass', evidence: 'desktop build report is green and fresh' }
      : { id: 'desktop_build_report', status: 'fail', evidence: fresh ? 'desktop build report is not green or missing expected artifacts' : 'desktop build report is stale for current workspace state; run build:desktop again' });
  }

  const smokeReportPath = resolve('reports/desktop/desktop-smoke.json');
  if (!existsSync(smokeReportPath)) {
    checks.push({ id: 'desktop_smoke_report', status: 'fail', evidence: 'reports/desktop/desktop-smoke.json missing; run test:desktop-smoke' });
  } else {
    const smokeReport = readJsonFile<DesktopSmokeReport>(smokeReportPath);
    const fresh = isArtifactFresh(smokeReportPath, freshnessBaseline);
    const expectedSteps = ['launcher', 'tutorial', 'character_select', 'map', 'combat'];
    const stepsCovered = expectedSteps.every((step) => smokeReport?.steps?.includes(step));
    const healthy =
      smokeReport?.overallStatus === 'pass' &&
      smokeReport?.mode === 'production' &&
      (smokeReport.consoleErrors?.length || 0) === 0 &&
      (smokeReport.pageErrors?.length || 0) === 0 &&
      (smokeReport.failedRequests?.length || 0) === 0 &&
      stepsCovered;
    checks.push(healthy && fresh
      ? { id: 'desktop_smoke_report', status: 'pass', evidence: 'desktop smoke report is green, production-mode, and fresh' }
      : { id: 'desktop_smoke_report', status: 'fail', evidence: fresh ? 'desktop smoke report is not green, not production-mode, or misses required flow steps' : 'desktop smoke report is stale for current workspace state; run test:desktop-smoke again' });
  }

  const windowsInstallerReportPath = resolve('reports/desktop/windows-installer.json');
  const reportExists = existsSync(windowsInstallerReportPath);
  const installerReport = reportExists ? readJsonFile<WindowsInstallerReport>(windowsInstallerReportPath) : null;
  const fresh = reportExists ? isArtifactFresh(windowsInstallerReportPath, freshnessBaseline) : false;
  const artifactExists = installerReport?.artifactPath ? existsSync(installerReport.artifactPath) : false;
  const healthy = installerReport?.overallStatus === 'pass' && installerReport?.platform === 'win32';
  checks.push(evaluateWindowsInstallerCheck({
    currentPlatform: process.platform,
    reportExists,
    reportFresh: fresh,
    reportHealthy: healthy,
    artifactExists,
  }));
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
    return { id: 'reports_dir', status: 'warn', evidence: 'reports/ missing; no accumulated logs to inspect' };
  }
  const sizeMb = statSync(reportsDir).isDirectory()
    ? Math.round((readdirSync(reportsDir).length / 100) * 10) / 10
    : 0;
  return {
    id: 'reports_dir',
    status: 'warn',
    evidence: `reports/ present; manual log growth review still required (rough entry score=${sizeMb})`
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
    const consoleErrors = uiSmokeReport?.consoleErrors?.length ?? Number.NaN;
    const pageErrors = uiSmokeReport?.pageErrors?.length ?? Number.NaN;
    const failedRequests = uiSmokeReport?.failedRequests?.length ?? Number.NaN;
    const auditFailures = (uiSmokeReport?.audits || []).some((audit) =>
      (audit.brokenImages?.length || 0) > 0 || (audit.layoutIssues?.length || 0) > 0
    );
    const cleanReport =
      Number.isFinite(consoleErrors) &&
      Number.isFinite(pageErrors) &&
      Number.isFinite(failedRequests) &&
      consoleErrors === 0 &&
      pageErrors === 0 &&
      failedRequests === 0 &&
      !auditFailures;
    const fresh = isArtifactFresh(latestUiExpansion, freshnessBaseline);
    checks.push(cleanReport && fresh
      ? { id: 'ui_smoke_expansion_report', status: 'pass', evidence: `ui smoke expansion report is clean and fresh: ${latestUiExpansion}` }
      : { id: 'ui_smoke_expansion_report', status: 'fail', evidence: fresh ? `ui smoke expansion report contains errors: ${latestUiExpansion}` : `ui smoke expansion report is stale for current workspace state: ${latestUiExpansion}` });
  }

  return checks;
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
    ...checkDoctorAndSecurityArtifacts(),
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
