#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const REPORT_DIR = 'reports/gate';
const REPORT_JSON = `${REPORT_DIR}/gate.json`;

interface StageResult {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  error?: string;
}

interface GateReport {
  timestamp: string;
  overallStatus: 'pass' | 'fail';
  stages: StageResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

function log(msg: string) {
  console.log(`[gate] ${msg}`);
}

function runCommand(name: string, command: string): StageResult {
  const start = Date.now();
  log(`Starting: ${name}`);

  try {
    const output = execSync(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024
    });
    const duration = Date.now() - start;
    log(`✓ ${name} passed (${duration}ms)`);
    return { name, status: 'pass', duration };
  } catch (err: any) {
    const duration = Date.now() - start;
    const stderr = err.stderr || '';
    const errorMsg = stderr.slice(-500) || String(err);
    log(`✗ ${name} failed (${duration}ms)`);
    log(`  Error: ${errorMsg.split('\n').slice(-3).join('\n  ')}`);
    return { name, status: 'fail', duration, error: errorMsg };
  }
}

function main() {
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  console.log('=== DeckRogue Gate Checks ===');
  console.log('');

  const stages: Array<{ name: string; command: string }> = [
    { name: 'Lint', command: 'npm run lint' },
    { name: 'Build', command: 'npm run build' },
    { name: 'UI Smoke Tests', command: 'npm run test:ui-smoke' },
    { name: 'UI Smoke Expansion', command: 'npm run test:ui-smoke:expansion' },
    { name: 'Check Experience Polish', command: 'npm run check:experience-polish' },
  ];

  const results: StageResult[] = [];
  let failed = false;

  for (const stage of stages) {
    const result = runCommand(stage.name, stage.command);
    results.push(result);
    if (result.status === 'fail') {
      failed = true;
      break;
    }
  }

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  const report: GateReport = {
    timestamp: new Date().toISOString(),
    overallStatus: failed ? 'fail' : 'pass',
    stages: results,
    summary: {
      total: results.length,
      passed: passCount,
      failed: failCount
    }
  };

  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  console.log('');
  console.log('=== Summary ===');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Report: ${REPORT_JSON}`);

  if (report.overallStatus === 'pass') {
    console.log('\n✅ All gate checks passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Gate check failed.');
    process.exit(1);
  }
}

main();
