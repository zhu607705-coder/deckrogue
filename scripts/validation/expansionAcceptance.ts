#!/usr/bin/env node
/**
 * @file expansionAcceptance.ts
 * @description Runs expansion acceptance tests to validate new content integration.
 *
 * 主要职责:
 * - 运行扩展内容验收测试
 * - 验证新内容与现有系统的集成
 * - 报告测试结果
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const REPORT_DIR = 'reports/expansion';
const REPORT_PATH = `${REPORT_DIR}/expansion.json`;

interface ExpansionResult {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  testCount?: number;
  error?: string;
}

interface ExpansionReport {
  timestamp: string;
  results: ExpansionResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    totalTests: number;
  };
}

function log(msg: string) {
  console.log(`[expansion] ${msg}`);
}

function runTest(name: string, command: string): ExpansionResult {
  const start = Date.now();
  log(`Running: ${name}`);

  try {
    const output = execSync(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    const duration = Date.now() - start;

    const passMatch = output.match(/# pass (\d+)/);
    const failMatch = output.match(/# fail (\d+)/);
    const testCount = passMatch ? parseInt(passMatch[1]) : 0;
    const failCount = failMatch ? parseInt(failMatch[1]) : 0;

    const passed = failCount === 0;

    return {
      name,
      status: passed ? 'pass' : 'fail',
      duration,
      testCount,
      error: passed ? undefined : `${failCount} tests failed`
    };
  } catch (err: any) {
    const duration = Date.now() - start;
    return {
      name,
      status: 'fail',
      duration,
      error: err.message?.slice(-500) || 'Test crashed'
    };
  }
}

async function main(): Promise<void> {
  console.log('=== Expansion Content Acceptance ===\n');

  const tests = [
    { name: 'Mirror Zone Flow Tests', command: 'npm run test:supplemental-units -- --test-name-pattern="mirrorZoneFlow" 2>&1' },
    { name: 'Enchantment Flow Tests', command: 'npm run test:supplemental-units -- --test-name-pattern="enchant" 2>&1' },
    { name: 'Run Card Instance Tests', command: 'npm run test:supplemental-units -- --test-name-pattern="run card|persistent enchantment|clearing combat afflictions" 2>&1' },
  ];

  const results: ExpansionResult[] = [];

  for (const test of tests) {
    const result = runTest(test.name, test.command);
    results.push(result);
    console.log(`  ${result.status === 'pass' ? '✅' : '❌'} ${test.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const totalTests = results.reduce((sum, r) => sum + (r.testCount || 0), 0);

  const report: ExpansionReport = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      totalTests
    }
  };

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`\nSummary: ${passed}/${results.length} suites passed, ${totalTests} tests total`);

  process.exit(failed > 0 ? 1 : 0);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Expansion acceptance crashed:', err);
  process.exit(1);
});
