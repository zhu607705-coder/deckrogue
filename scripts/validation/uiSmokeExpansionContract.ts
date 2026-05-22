import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export interface UiSmokeAudit {
  label: string;
  screenshot?: string;
  brokenImages?: unknown[];
  layoutIssues?: unknown[];
}

export interface UiSmokeExpansionReport {
  generatedAt?: string;
  completed?: boolean;
  failedStep?: string | null;
  baseUrl?: string;
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
  failedRequests?: unknown[];
  audits?: UiSmokeAudit[];
  slotsLoaded?: string[];
  tutorialChecked?: boolean;
}

export interface UiSmokeExpansionValidationOptions {
  reportPath?: string;
  freshnessBaseline?: number;
  requireScreenshotFreshness?: boolean;
}

export const UI_SMOKE_EXPANSION_REPORT_PATH = resolve('output/playwright/ui_smoke_expansion_report.json');

export const REQUIRED_UI_AUDIT_LABELS = [
  'launcher',
  'tutorial',
  'launcher_tablet',
  'character_select',
  'map',
  'combat',
  'settings_theme',
  'save_load',
  'keybinds',
  'reward',
  'shop',
  'event',
  'upgrade',
  'victory',
];

export const REQUIRED_UI_SMOKE_SLOTS = [
  'UI Smoke Map',
  'UI Smoke Reward',
  'UI Smoke Shop',
  'UI Smoke Event',
  'UI Smoke Upgrade',
  'UI Smoke Victory',
];

const FRESHNESS_ROOTS = [
  'package.json',
  'package-lock.json',
  'electron',
  'index.html',
  'public',
  'src',
  'scripts',
];

const FRESHNESS_IGNORE_SEGMENTS = new Set(['.git', 'node_modules', 'dist', 'reports', 'output']);

function getLatestMtime(target: string): number {
  const abs = resolve(target);
  if (!existsSync(abs)) return 0;
  const stats = statSync(abs);
  if (!stats.isDirectory()) return stats.mtimeMs;

  let latest = stats.mtimeMs;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (FRESHNESS_IGNORE_SEGMENTS.has(entry.name)) continue;
    latest = Math.max(latest, getLatestMtime(resolve(abs, entry.name)));
  }
  return latest;
}

export function getUiSmokeFreshnessBaseline(): number {
  return FRESHNESS_ROOTS.reduce((latest, target) => Math.max(latest, getLatestMtime(target)), 0);
}

function isFresh(path: string, baseline: number): boolean {
  return existsSync(path) && statSync(path).mtimeMs >= baseline;
}

function parseGeneratedAt(report: UiSmokeExpansionReport): number | null {
  if (!report.generatedAt) return null;
  const value = Date.parse(report.generatedAt);
  return Number.isFinite(value) ? value : null;
}

export function validateUiSmokeExpansionReport(
  report: UiSmokeExpansionReport | null,
  options: UiSmokeExpansionValidationOptions = {},
): string[] {
  if (!report) return ['missing ui_smoke_expansion_report.json'];
  const failures: string[] = [];
  const freshnessBaseline = options.freshnessBaseline ?? getUiSmokeFreshnessBaseline();
  const reportPath = options.reportPath ?? UI_SMOKE_EXPANSION_REPORT_PATH;

  if (report.completed !== true) {
    failures.push(report.failedStep ? `ui smoke expansion did not complete: ${report.failedStep}` : 'ui smoke expansion did not complete');
  }

  const generatedAtMs = parseGeneratedAt(report);
  if (generatedAtMs == null) {
    failures.push('missing or invalid generatedAt');
  } else if (generatedAtMs < freshnessBaseline) {
    failures.push('generatedAt is stale for current workspace state');
  }

  if (!isFresh(reportPath, freshnessBaseline)) {
    failures.push('ui_smoke_expansion_report.json is stale for current workspace state');
  }

  const auditLabels = new Set((report.audits || []).map((audit) => audit.label));
  for (const label of REQUIRED_UI_AUDIT_LABELS) {
    if (!auditLabels.has(label)) failures.push(`missing audit: ${label}`);
  }

  const slotsLoaded = new Set(report.slotsLoaded || []);
  for (const slot of REQUIRED_UI_SMOKE_SLOTS) {
    if (!slotsLoaded.has(slot)) failures.push(`missing loaded slot: ${slot}`);
  }

  if (report.tutorialChecked !== true) failures.push('tutorial was not checked');
  if ((report.consoleErrors || []).length > 0) failures.push(`consoleErrors=${report.consoleErrors?.length ?? 0}`);
  if ((report.pageErrors || []).length > 0) failures.push(`pageErrors=${report.pageErrors?.length ?? 0}`);
  if ((report.failedRequests || []).length > 0) failures.push(`failedRequests=${report.failedRequests?.length ?? 0}`);

  const requireScreenshotFreshness = options.requireScreenshotFreshness ?? true;
  for (const audit of report.audits || []) {
    if ((audit.brokenImages || []).length > 0) failures.push(`${audit.label}: brokenImages=${audit.brokenImages?.length ?? 0}`);
    if ((audit.layoutIssues || []).length > 0) failures.push(`${audit.label}: layoutIssues=${audit.layoutIssues?.length ?? 0}`);
    if (REQUIRED_UI_AUDIT_LABELS.includes(audit.label)) {
      if (!audit.screenshot) {
        failures.push(`${audit.label}: missing screenshot`);
      } else if (!existsSync(audit.screenshot)) {
        failures.push(`${audit.label}: screenshot missing on disk`);
      } else if (requireScreenshotFreshness && !isFresh(audit.screenshot, freshnessBaseline)) {
        failures.push(`${audit.label}: screenshot is stale for current workspace state`);
      }
    }
  }

  return failures;
}
