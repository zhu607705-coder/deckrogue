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
import { createHash } from 'crypto';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { execSync } from 'child_process';
import {
  type UiSmokeExpansionReport,
  validateUiSmokeExpansionReport,
} from './uiSmokeExpansionContract';
import { REQUIRED_PYODIDE_ASSET_FILES } from '../desktop/pyodide_assets.ts';

const REPORT_DIR = 'reports/release';
const REPORT_PATH = `${REPORT_DIR}/release-readiness.json`;
const DEFAULT_REPORT_MAX_FILES = 2000;
const DEFAULT_REPORT_MAX_BYTES = 50 * 1024 * 1024;
const REQUIRED_DOCTOR_STAGE_NAMES = [
  'Check GitHub Transport',
  'Windows Desktop Distribution',
  'Runtime V2 TypeScript Tests',
  'Runtime V2 Adapter Differential Parity',
  'Check Python WASM Runtime Sync',
  'Python Runtime Unit Tests',
  'Check Route State Save Load Parity',
  'Check Event Choice Reinforcement',
  'Check Rest Route Reinforcement',
  'Check Shop Route Reinforcement',
];

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
  gitHead?: string;
  gitDirty?: boolean;
  stages?: Array<{
    name?: string;
    status?: string;
    failureType?: string;
  }>;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    byCategory?: Record<string, number>;
  };
};

type GitState = {
  gitHead?: string;
  gitDirty?: boolean;
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
  generatedAt?: string;
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
  failedRequests?: unknown[];
};

type ResponsiveReadabilityReport = Record<string, unknown> & {
  generatedAt?: string;
  overallStatus?: string;
  surfaceCount?: number;
  viewportCount?: number;
  profileCount?: number;
  profiles?: Array<{
    name?: string;
    surfaceCount?: number;
    viewportCount?: number;
  }>;
  audits?: Array<{
    surface?: string;
    viewport?: string;
    profile?: string;
  }>;
  issues?: unknown[];
};

const REQUIRED_RESPONSIVE_READABILITY_PROFILES = [
  { name: 'baseline', minSurfaceCount: 30, minViewportCount: 11 },
  { name: 'text-zoom-200', minSurfaceCount: 18, minViewportCount: 3 },
  { name: 'light-theme', minSurfaceCount: 15, minViewportCount: 2 },
  { name: 'extreme-aspect', minSurfaceCount: 18, minViewportCount: 4 },
] as const;

const REQUIRED_RESPONSIVE_READABILITY_SURFACES = ['relic-upgrade'] as const;

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

type WinDistReport = {
  overallStatus?: string;
  artifacts?: Array<{
    path?: string;
    sizeBytes?: number;
    sha256?: string;
  }>;
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

function hasFreshNonEmptyArtifact(path: string, freshnessBaseline: number): boolean {
  if (!existsSync(path)) {
    return false;
  }
  const stats = statSync(path);
  return stats.isFile() && stats.size > 0 && stats.mtimeMs >= freshnessBaseline;
}

function readJsonFile<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function getCurrentGitState(): GitState {
  try {
    const gitHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim().slice(0, 8);
    const gitDirty = execSync('git status --porcelain', { encoding: 'utf-8' }).trim().length > 0;
    return { gitHead, gitDirty };
  } catch {
    return {};
  }
}

function getMissingRequiredDoctorStages(doctorReport: DoctorReport | null): string[] {
  const stages = Array.isArray(doctorReport?.stages) ? doctorReport.stages : [];
  return REQUIRED_DOCTOR_STAGE_NAMES.filter((requiredName) => {
    const stage = stages.find((entry) => entry.name === requiredName);
    return stage?.status !== 'pass';
  });
}

function summarizeFailedDoctorStages(doctorReport: DoctorReport | null): string {
  const stages = Array.isArray(doctorReport?.stages) ? doctorReport.stages : [];
  const failedStages = stages
    .filter((entry) => entry.status === 'fail')
    .map((entry) => {
      const name = entry.name || '<unnamed stage>';
      return entry.failureType ? `${name} [${entry.failureType}]` : name;
    });
  if (failedStages.length > 0) {
    return failedStages.join(', ');
  }

  const categories = doctorReport?.summary?.byCategory;
  if (categories && typeof categories === 'object') {
    const categorySummary = Object.entries(categories)
      .filter(([, count]) => Number.isFinite(count) && count > 0)
      .map(([category, count]) => `${category}: ${count}`)
      .join(', ');
    if (categorySummary) {
      return `failure categories: ${categorySummary}`;
    }
  }

  return '';
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
    return hasFreshNonEmptyArtifact(screenshotPath, freshnessBaseline);
  });
}

function hasFreshGeneratedAt(report: GenericFlowReport | null, freshnessBaseline: number): boolean {
  if (!report?.generatedAt) {
    return false;
  }
  const generatedAtMs = Date.parse(report.generatedAt);
  return Number.isFinite(generatedAtMs) && generatedAtMs >= freshnessBaseline;
}

function hasFreshReportGeneratedAt(report: { generatedAt?: string } | null, freshnessBaseline: number): boolean {
  if (!report?.generatedAt) {
    return false;
  }
  const generatedAtMs = Date.parse(report.generatedAt);
  return Number.isFinite(generatedAtMs) && generatedAtMs >= freshnessBaseline;
}

function getResponsiveReadabilityProfileCoverageFailures(report: ResponsiveReadabilityReport | null): string[] {
  const failures: string[] = [];
  const profiles = Array.isArray(report?.profiles) ? report.profiles : [];
  const audits = Array.isArray(report?.audits) ? report.audits : [];
  const profileByName = new Map(profiles.map((profile) => [profile.name, profile]));

  for (const requirement of REQUIRED_RESPONSIVE_READABILITY_PROFILES) {
    const profile = profileByName.get(requirement.name);
    if (!profile) {
      failures.push(`${requirement.name} missing`);
      continue;
    }

    const profileAudits = audits.filter((audit) => audit.profile === requirement.name);
    const auditedSurfaces = new Set(profileAudits.map((audit) => audit.surface).filter((name): name is string => typeof name === 'string' && name.length > 0));
    const auditedViewports = new Set(profileAudits.map((audit) => audit.viewport).filter((name): name is string => typeof name === 'string' && name.length > 0));
    const surfaceCount = typeof profile.surfaceCount === 'number' ? profile.surfaceCount : 0;
    const viewportCount = typeof profile.viewportCount === 'number' ? profile.viewportCount : 0;

    if (surfaceCount < requirement.minSurfaceCount || auditedSurfaces.size < requirement.minSurfaceCount) {
      failures.push(`${requirement.name} surfaces ${Math.min(surfaceCount, auditedSurfaces.size)}/${requirement.minSurfaceCount}`);
    }
    for (const requiredSurface of REQUIRED_RESPONSIVE_READABILITY_SURFACES) {
      if (!auditedSurfaces.has(requiredSurface)) {
        failures.push(`${requirement.name} missing ${requiredSurface}`);
      }
    }
    if (viewportCount < requirement.minViewportCount || auditedViewports.size < requirement.minViewportCount) {
      failures.push(`${requirement.name} viewports ${Math.min(viewportCount, auditedViewports.size)}/${requirement.minViewportCount}`);
    }
  }

  return failures;
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

function hasBundledPyodideAssets(buildReport: DesktopBuildReport | null, freshnessBaseline: number): boolean {
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
    const stats = statSync(reported.path);
    return stats.isFile() && stats.size > 0 && isArtifactFresh(reported.path, freshnessBaseline);
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
    const pyodideAssetsBundled = hasBundledPyodideAssets(buildReport, freshnessBaseline);
    const healthy = buildReport?.overallStatus === 'pass' && rendererExists && mainExists && preloadExists && pyodideAssetsBundled;
    checks.push(healthy && fresh
      ? { id: 'desktop_build_report', status: 'pass', evidence: 'desktop build report is green, fresh, and includes bundled Pyodide runtime assets' }
      : { id: 'desktop_build_report', status: 'fail', evidence: fresh ? 'desktop build report is not green, missing expected artifacts, or missing fresh bundled Pyodide runtime assets' : 'desktop build report is stale for current workspace state; run build:desktop again' });
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
        return hasFreshNonEmptyArtifact(screenshotPath, freshnessBaseline);
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

  const winDistReportPath = resolve('reports/desktop/win-dist.json');
  if (!existsSync(winDistReportPath)) {
    checks.push({ id: 'win_dist_report', status: 'fail', evidence: 'reports/desktop/win-dist.json missing; run dist:win' });
  } else {
    const winDistReport = readJsonFile<WinDistReport>(winDistReportPath);
    const fresh = isArtifactFresh(winDistReportPath, freshnessBaseline);
    const artifacts = Array.isArray(winDistReport?.artifacts) ? winDistReport.artifacts : [];
    const exeArtifact = artifacts.find((artifact) =>
      typeof artifact.path === 'string' && artifact.path.toLowerCase().endsWith('.exe')
    );
    const exeExists = !!exeArtifact?.path && existsSync(exeArtifact.path);
    const exeFresh = exeExists && isArtifactFresh(exeArtifact!.path!, freshnessBaseline);
    const exeSize = exeExists ? statSync(exeArtifact!.path!).size : 0;
    const reportedExeSize = exeArtifact?.sizeBytes;
    const exeSizeMatchesReport =
      typeof reportedExeSize === 'number' &&
      Number.isFinite(reportedExeSize) &&
      reportedExeSize === exeSize;
    const exeSha256 = exeExists ? createHash('sha256').update(readFileSync(exeArtifact!.path!)).digest('hex') : null;
    const exeHashMatchesReport =
      typeof exeArtifact?.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(exeArtifact.sha256) &&
      exeArtifact.sha256.toLowerCase() === exeSha256;
    const healthy =
      winDistReport?.overallStatus === 'pass' &&
      exeExists &&
      exeFresh &&
      exeSize > 0 &&
      exeSizeMatchesReport &&
      exeHashMatchesReport;
    checks.push(healthy && fresh
      ? { id: 'win_dist_report', status: 'pass', evidence: 'Windows installer distribution report is green, fresh, and includes a fresh .exe artifact' }
      : { id: 'win_dist_report', status: 'fail', evidence: fresh ? 'Windows installer distribution report is not green, lacks a fresh .exe artifact, or has mismatched artifact size/hash evidence; run dist:win' : 'Windows installer distribution report is stale for current workspace state; run dist:win' });
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

function checkGithubTransport(): ReleaseCheck {
  try {
    const output = execSync('npm run check:github-transport --silent', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 5 * 1024 * 1024,
    });
    const passCount = (output.match(/\[check_github_transport\] PASS /g) || []).length;
    return {
      id: 'github_transport',
      status: 'pass',
      evidence: `GitHub SSH-over-443 transport check passed (${passCount} checks)`
    };
  } catch (error: any) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`.trim();
    const tail = output.split(/\r?\n/).slice(-3).join('; ');
    return {
      id: 'github_transport',
      status: 'fail',
      evidence: tail || 'GitHub SSH-over-443 transport check failed; run npm run check:github-transport'
    };
  }
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

export function checkDoctorReportArtifact(
  latestDoctor: string,
  freshnessBaseline: number,
  currentGitState: GitState = getCurrentGitState()
): ReleaseCheck {
  if (!existsSync(latestDoctor)) {
    return { id: 'doctor_report', status: 'fail', evidence: 'no doctor report found in reports/doctor' };
  }

  const doctorReport = readJsonFile<DoctorReport>(latestDoctor);
  const failed = doctorReport?.summary?.failed ?? Number.NaN;
  const fresh = isArtifactFresh(latestDoctor, freshnessBaseline);
  const missingRequiredStages = getMissingRequiredDoctorStages(doctorReport);
  const failedStageSummary = summarizeFailedDoctorStages(doctorReport);
  const gitHeadMatches =
    typeof currentGitState.gitHead === 'string' &&
    currentGitState.gitHead.length > 0 &&
    doctorReport?.gitHead === currentGitState.gitHead;
  const gitDirtyMatches =
    typeof currentGitState.gitDirty === 'boolean' &&
    doctorReport?.gitDirty === currentGitState.gitDirty;
  const gitStateMatches = gitHeadMatches && gitDirtyMatches;

  if (Number.isFinite(failed) && failed === 0 && fresh && gitStateMatches && missingRequiredStages.length === 0) {
    const dirtyLabel = currentGitState.gitDirty ? 'dirty' : 'clean';
    return {
      id: 'doctor_report',
      status: 'pass',
      evidence: `latest doctor report is green, fresh, and matches current git state (${currentGitState.gitHead}, ${dirtyLabel}): ${latestDoctor}`
    };
  }

  let evidence = `latest doctor report is not green: ${latestDoctor}`;
  if (Number.isFinite(failed) && failed > 0 && failedStageSummary) {
    evidence = `latest doctor report failed stages: ${failedStageSummary}; ${latestDoctor}`;
    if (!fresh) {
      evidence += '; report is stale for current workspace state';
    }
  } else if (!fresh) {
    evidence = `latest doctor report is stale for current workspace state: ${latestDoctor}`;
  } else if (Number.isFinite(failed) && failed === 0 && !gitStateMatches) {
    const expectedDirty = currentGitState.gitDirty === true ? 'dirty' : currentGitState.gitDirty === false ? 'clean' : 'unknown';
    const actualDirty = doctorReport?.gitDirty === true ? 'dirty' : doctorReport?.gitDirty === false ? 'clean' : 'unknown';
    evidence = `latest doctor report git state does not match current workspace: report=${doctorReport?.gitHead ?? 'unknown'}/${actualDirty}, current=${currentGitState.gitHead ?? 'unknown'}/${expectedDirty}`;
  } else if (Number.isFinite(failed) && failed === 0 && missingRequiredStages.length > 0) {
    evidence = `latest doctor report is missing required passing stages: ${missingRequiredStages.join(', ')}`;
  }

  return { id: 'doctor_report', status: 'fail', evidence };
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
  } else {
    checks.push(checkDoctorReportArtifact(latestDoctor, freshnessBaseline));
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

export function checkResponsiveReadabilityReport(freshnessBaseline: number): ReleaseCheck {
  const reportRelPath = 'reports/ui/responsive-readability.json';
  const reportPath = resolve(reportRelPath);
  if (!existsSync(reportPath)) {
    return { id: 'ui_responsive_readability_report', status: 'fail', evidence: `${reportRelPath} missing; run scripts/validation/playwright_ui_responsive_readability.ts` };
  }

  const report = readJsonFile<ResponsiveReadabilityReport>(reportPath);
  const fresh = isArtifactFresh(reportPath, freshnessBaseline);
  const generatedAtFresh = hasFreshReportGeneratedAt(report, freshnessBaseline);
  const screenshotEvidenceFresh = hasFreshScreenshotEvidence(report, freshnessBaseline);
  const issues = Array.isArray(report?.issues) ? report.issues : null;
  const audits = Array.isArray(report?.audits) ? report.audits : null;
  const profileCoverageFailures = getResponsiveReadabilityProfileCoverageFailures(report);
  const countsPresent =
    typeof report?.surfaceCount === 'number' && report.surfaceCount > 0 &&
    typeof report?.viewportCount === 'number' && report.viewportCount > 0 &&
    typeof report?.profileCount === 'number' && report.profileCount > 0 &&
    Array.isArray(audits) && audits.length > 0;
  const clean =
    report?.overallStatus === 'pass' &&
    Array.isArray(issues) &&
    issues.length === 0 &&
    countsPresent &&
    generatedAtFresh &&
    screenshotEvidenceFresh &&
    profileCoverageFailures.length === 0;

  if (clean && fresh) {
    return {
      id: 'ui_responsive_readability_report',
      status: 'pass',
      evidence: `responsive readability report is clean and fresh: ${reportRelPath} (${report.surfaceCount} surfaces, ${report.viewportCount} viewports, ${report.profileCount} profiles, ${audits?.length ?? 0} audits)`,
    };
  }

  let evidence = `responsive readability report failed contract: ${reportRelPath}`;
  if (!fresh) {
    evidence = `${reportRelPath} is stale for current workspace state`;
  } else if (!generatedAtFresh) {
    evidence += '; missing, invalid, or stale generatedAt evidence';
  } else if (!screenshotEvidenceFresh) {
    evidence += '; missing or stale screenshot evidence';
  } else if (!Array.isArray(issues)) {
    evidence += '; issues array is missing';
  } else if (issues.length > 0) {
    evidence += `; ${issues.length} issues remain`;
  } else if (report?.overallStatus !== 'pass') {
    evidence += `; overallStatus=${report?.overallStatus ?? 'missing'}`;
  } else if (!countsPresent) {
    evidence += '; missing positive surface/viewport/profile/audit counts';
  } else if (profileCoverageFailures.length > 0) {
    evidence += `; profile coverage incomplete: ${profileCoverageFailures.join(', ')}`;
  }

  return { id: 'ui_responsive_readability_report', status: 'fail', evidence };
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
  const generatedAtFresh = hasFreshGeneratedAt(report, freshnessBaseline);
  const failedRequests = Array.isArray(report?.failedRequests) ? report.failedRequests : null;
  const failedRequestsClean = Array.isArray(failedRequests) && failedRequests.length === 0;
  const clean =
    (report?.consoleErrors?.length || 0) === 0 &&
    (report?.pageErrors?.length || 0) === 0 &&
    failedRequestsClean &&
    !!report &&
    generatedAtFresh &&
    screenshotEvidenceFresh &&
    predicate(report);
  return clean && fresh
    ? { id, status: 'pass', evidence: successEvidence }
    : {
      id,
      status: 'fail',
      evidence: fresh
        ? (!generatedAtFresh
          ? `${failureEvidence}; missing, invalid, or stale generatedAt evidence`
          : (screenshotEvidenceFresh ? `${failureEvidence}${failedRequestsClean ? '' : '; failed request evidence present or missing'}` : `${failureEvidence}; missing or stale screenshot evidence`))
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
    checkGithubTransport(),
    ...checkEnemyVariantReadiness(),
    ...checkDoctorAndSecurityArtifacts(),
    checkResponsiveReadabilityReport(freshnessBaseline),
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
