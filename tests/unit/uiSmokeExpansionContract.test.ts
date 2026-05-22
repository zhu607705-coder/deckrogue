/**
 * @file uiSmokeExpansionContract.test.ts
 * @description Regression tests for UI smoke expansion report freshness and completeness gates.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  REQUIRED_UI_AUDIT_LABELS,
  REQUIRED_UI_SMOKE_SLOTS,
  type UiSmokeExpansionReport,
  validateUiSmokeExpansionReport,
} from '../../scripts/validation/uiSmokeExpansionContract.ts';

function touch(filePath: string): void {
  closeSync(openSync(filePath, 'w'));
}

function makeCompleteReport(screenshotPath: string): UiSmokeExpansionReport {
  return {
    generatedAt: new Date(Date.now() + 5_000).toISOString(),
    completed: true,
    failedStep: null,
    baseUrl: 'http://127.0.0.1:3000',
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    audits: REQUIRED_UI_AUDIT_LABELS.map((label) => ({
      label,
      screenshot: screenshotPath,
      brokenImages: [],
      layoutIssues: [],
    })),
    slotsLoaded: [...REQUIRED_UI_SMOKE_SLOTS],
    tutorialChecked: true,
  };
}

test('UI smoke expansion contract accepts complete fresh evidence', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'deckrogue-ui-contract-'));
  try {
    const reportPath = path.join(dir, 'ui_smoke_expansion_report.json');
    const screenshotPath = path.join(dir, 'expansion.png');
    touch(screenshotPath);
    writeFileSync(reportPath, '{}');

    const failures = validateUiSmokeExpansionReport(makeCompleteReport(screenshotPath), {
      reportPath,
      freshnessBaseline: Date.now() - 1_000,
    });

    assert.deepEqual(failures, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('UI smoke expansion contract rejects stale or partial evidence', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'deckrogue-ui-contract-'));
  try {
    const reportPath = path.join(dir, 'ui_smoke_expansion_report.json');
    const screenshotPath = path.join(dir, 'expansion.png');
    touch(screenshotPath);
    writeFileSync(reportPath, '{}');

    const report = makeCompleteReport(screenshotPath);
    const failures = validateUiSmokeExpansionReport({
      ...report,
      generatedAt: undefined,
      completed: false,
      failedStep: 'missing map nodes',
      audits: report.audits?.filter((audit) => audit.label !== 'combat'),
      slotsLoaded: ['UI Smoke Map'],
    }, {
      reportPath,
      freshnessBaseline: Date.now() - 1_000,
    });

    assert.ok(failures.includes('ui smoke expansion did not complete: missing map nodes'));
    assert.ok(failures.includes('missing or invalid generatedAt'));
    assert.ok(failures.includes('missing audit: combat'));
    assert.ok(failures.includes('missing loaded slot: UI Smoke Reward'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
