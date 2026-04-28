#!/usr/bin/env node
/**
 * @file repeatTestSuite.ts
 * @description Repeats the test suite multiple times to detect flaky tests.
 *
 * 主要职责:
 * - 运行指定次数的测试套件
 * - 检测并报告不稳定的测试
 * - 计算 flake 率
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const REPORT_DIR = 'reports/repeat';
const REPORT_PATH = `${REPORT_DIR}/repeat-report.json`;

interface TestResult {
  iteration: number;
  success: boolean;
  duration: number;
  error?: string;
}

interface RepeatReport {
  timestamp: string;
  command: string;
  times: number;
  results: TestResult[];
  summary: {
    passed: number;
    failed: number;
    flakeRate: number;
    firstFailureIteration?: number;
    firstFailureLog?: string;
  };
}

function log(msg: string) {
  console.log(`[repeat] ${msg}`);
}

function runCommand(command: string): { success: boolean; duration: number; error?: string } {
  const start = Date.now();
  try {
    execSync(command, { stdio: 'pipe' });
    return { success: true, duration: Date.now() - start };
  } catch (err: any) {
    return { 
      success: false, 
      duration: Date.now() - start, 
      error: err.message?.split('\n').slice(-3).join('\n') || 'Unknown error'
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  let times = 10;
  let commands: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--times' && args[i + 1]) {
      times = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i].startsWith('--')) {
      i++;
    } else {
      commands.push(args[i]);
    }
  }
  
  if (commands.length === 0) {
    commands = ['npm run test:supplemental-units 2>&1'];
  }

  console.log('=== DeckRogue Repeat Test Suite ===');
  console.log(`Times: ${times}`);
  console.log(`Commands: ${commands.join(', ')}`);
  console.log('');

  const results: TestResult[] = [];
  let firstFailure: { iteration: number; error: string; log: string } | undefined;

  for (let i = 1; i <= times; i++) {
    process.stdout.write(`Iteration ${i}/${times}... `);
    
    const allSuccess = commands.every(cmd => {
      const result = runCommand(cmd);
      if (!result.success && !firstFailure) {
        const logPath = `${REPORT_DIR}/failure-iter${i}-${Date.now()}.txt`;
        if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
        writeFileSync(logPath, result.error || '');
        firstFailure = { iteration: i, error: result.error || '', log: logPath };
      }
      return result.success;
    });

    results.push({
      iteration: i,
      success: allSuccess,
      duration: 0
    });
    
    console.log(allSuccess ? '✓' : '✗');
  }

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const flakeRate = (failed / times) * 100;

  const report: RepeatReport = {
    timestamp: new Date().toISOString(),
    command: commands.join(' && '),
    times,
    results,
    summary: {
      passed,
      failed,
      flakeRate,
      firstFailureIteration: firstFailure?.iteration,
      firstFailureLog: firstFailure?.log
    }
  };

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n=== Results ===');
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Passed: ${passed}/${times}`);
  console.log(`Failed: ${failed}/${times}`);
  console.log(`Flake Rate: ${flakeRate.toFixed(1)}%`);
  
  if (firstFailure) {
    console.log(`\nFirst Failure: Iteration ${firstFailure.iteration}`);
    console.log(`Log: ${firstFailure.log}`);
  }
  
  console.log(`\nReport: ${REPORT_PATH}`);

  process.exit(failed > 0 ? 1 : 0);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Repeat test crashed:', err);
    process.exit(1);
  });
