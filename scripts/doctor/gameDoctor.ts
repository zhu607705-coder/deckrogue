#!/usr/bin/env node
/**
 * @file gameDoctor.ts
 * @description Runs comprehensive diagnostics including type check, build, and runtime tests.
 *
 * 主要职责:
 * - 执行多阶段诊断检查
 * - 生成健康度报告
 * - 报告失败的检查项
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const REPORT_DIR = 'reports/doctor';
const REPORT_JSON = `${REPORT_DIR}/report.json`;
const REPORT_MD = `${REPORT_DIR}/report.md`;

interface StageResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  logPath?: string;
  failureType?: 'typecheck' | 'build' | 'runtime' | 'parity' | 'content' | 'expansion' | 'ui' | 'flake' | 'performance' | 'release' | 'security' | 'health';
  error?: string;
}

interface DoctorReport {
  timestamp: string;
  gitHead?: string;
  gitDirty?: boolean;
  totalDuration: number;
  overallStatus: 'pass' | 'fail';
  failFast: boolean;
  stages: StageResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    byCategory: Record<string, number>;
  };
}

function log(msg: string) {
  console.log(`[doctor] ${msg}`);
}

function saveLog(name: string, output: string): string {
  const logPath = `${REPORT_DIR}/logs/${name.replace(/\s+/g, '_')}-${Date.now()}.log`;
  const logDir = logPath.substring(0, logPath.lastIndexOf('/'));
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  writeFileSync(logPath, output);
  return logPath;
}

function runCommand(name: string, command: string, extraEnv: Record<string, string> = {}): StageResult {
  const start = Date.now();
  log(`Starting: ${name}`);

  try {
    const output = execSync(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      env: {
        ...process.env,
        ...extraEnv,
      },
      maxBuffer: 50 * 1024 * 1024
    });
    const duration = Date.now() - start;
    const logPath = saveLog(name, output);
    log(`✓ ${name} passed (${duration}ms)`);
    return { name, status: 'pass', duration, logPath };
  } catch (err: any) {
    const duration = Date.now() - start;
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    const combined = stdout + '\n' + stderr;
    const logPath = saveLog(name, combined);

    const failureType = classifyFailure(name, combined);
    log(`✗ ${name} failed (${duration}ms) [${failureType}]`);

    return {
      name,
      status: 'fail',
      duration,
      logPath,
      failureType,
      error: stderr.slice(-500)
    };
  }
}

function classifyFailure(name: string, output: string): StageResult['failureType'] {
  const lower = output.toLowerCase();
  if (name.includes('lint') || lower.includes('typescript') || lower.includes('type error')) return 'typecheck';
  if (name.includes('build') || lower.includes('compilation') || lower.includes('webpack')) return 'build';
  if (name.toLowerCase().includes('security') || lower.includes('security posture') || lower.includes('vulnerability density')) return 'security';
  if (name.toLowerCase().includes('health') || lower.includes('code health status')) return 'health';
  if (name.toLowerCase().includes('release') || lower.includes('changelog') || lower.includes('version_consistency')) return 'release';
  if (lower.includes('runtime') && lower.includes('test')) return 'runtime';
  if (lower.includes('parity') || lower.includes('mismatch')) return 'parity';
  if (lower.includes('content') || lower.includes('bundle') || lower.includes('reachability') || lower.includes('translation audit')) return 'content';
  if (lower.includes('expansion') || lower.includes('mirror') || lower.includes('branch')) return 'expansion';
  if (lower.includes('ui') || lower.includes('playwright') || lower.includes('smoke')) return 'ui';
  if (lower.includes('flake') || lower.includes('intermittent')) return 'flake';
  if (lower.includes('timeout') || lower.includes('slow')) return 'performance';
  return 'runtime';
}

function generateReport(results: StageResult[], failFast: boolean): DoctorReport {
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  let gitHead: string | undefined;
  let gitDirty = false;
  try {
    gitHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim().slice(0, 8);
    gitDirty = execSync('git status --porcelain', { encoding: 'utf-8' }).trim().length > 0;
  } catch {}

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const skipCount = results.filter(r => r.status === 'skip').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const byCategory: Record<string, number> = {};
  results.filter(r => r.failureType).forEach(r => {
    byCategory[r.failureType!] = (byCategory[r.failureType!] || 0) + 1;
  });

  const report: DoctorReport = {
    timestamp: new Date().toISOString(),
    gitHead,
    gitDirty,
    totalDuration,
    overallStatus: failCount === 0 ? 'pass' : 'fail',
    failFast,
    stages: results,
    summary: {
      total: results.length,
      passed: passCount,
      failed: failCount,
      skipped: skipCount,
      byCategory
    }
  };

  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  let md = `# DeckRogue Game Doctor Report\n\n`;
  md += `**Timestamp:** ${report.timestamp}\n`;
  md += `**Git:** ${gitHead || 'unknown'}${gitDirty ? ' (dirty)' : ''}\n`;
  md += `**Total Duration:** ${totalDuration}ms\n\n`;
  md += `## Overall Status: ${failCount === 0 ? '✅ ALL PASS' : `❌ ${failCount} FAILED`}\n\n`;
  md += `## Stage Results\n\n`;
  md += `| Stage | Status | Duration | Type | Log |\n`;
  md += `|-------|--------|----------|------|-----|\n`;
  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'skip' ? '⏭️' : '❌';
    md += `| ${r.name} | ${icon} | ${r.duration}ms | ${r.failureType || '-'} | ${r.logPath ? '[log]' : '-'} |\n`;
  }
  md += `\n## Summary\n\n`;
  md += `- **Total:** ${report.summary.total}\n`;
  md += `- **Passed:** ${passCount}\n`;
  md += `- **Failed:** ${failCount}\n`;
  md += `- **Skipped:** ${skipCount}\n`;
  if (Object.keys(byCategory).length > 0) {
    md += `\n## Failures by Category\n\n`;
    for (const [cat, count] of Object.entries(byCategory)) {
      md += `- **${cat}:** ${count}\n`;
    }
  }

  writeFileSync(REPORT_MD, md);
  console.log(`\nJSON Report: ${REPORT_JSON}`);
  console.log(`MD Report: ${REPORT_MD}`);

  return report;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const failFast = !args.includes('--report-all');
  console.log('=== DeckRogue Game Doctor (Expansion Ready) ===');
  console.log('');

  const stages: Array<{ name: string; command: string; env?: Record<string, string> }> = [
    { name: 'Lint', command: 'npm run lint --silent' },
    { name: 'Build', command: 'npm run build --silent' },
    { name: 'Desktop Build', command: 'npm run build:desktop 2>&1' },
    { name: 'Supplemental Unit Tests', command: 'npm run test:supplemental-units 2>&1' },
    { name: 'Check Content Bundle', command: 'npm run check:content-bundle 2>&1' },
    { name: 'Check Content Reachability', command: 'npm run check:content-reachability 2>&1' },
    { name: 'Check Deep Reachability', command: 'npm run check:deep-reachability 2>&1' },
    { name: 'Check Content Contract Layer', command: 'npm run check:content-contract-layer 2>&1' },
    { name: 'Check Enemy AI Boundaries', command: 'npm run check:enemy-ai-boundaries 2>&1' },
    { name: 'Check Enemy AI Profiles', command: 'npm run check:enemy-ai-profiles 2>&1' },
    { name: 'Check Enemy Visual Identity', command: 'npm run check:enemy-visual-identity 2>&1' },
    { name: 'Check Enemy Variant Behavior', command: 'npm run check:enemy-variant-behavior 2>&1' },
    { name: 'Check Enemy First3 Exposure', command: 'npm run check:enemy-first3-exposure 2>&1' },
    { name: 'Check Map Route Constraints', command: 'npm run check:map-route-constraints 2>&1' },
    { name: 'Check Combat Orchestration Layer', command: 'npm run check:combat-orchestration-layer 2>&1' },
    { name: 'Check UI Runtime Boundaries', command: 'npm run check:ui-runtime-boundaries 2>&1' },
    { name: 'Check Keyword Registry', command: 'npm run check:keyword-registry 2>&1' },
    { name: 'Check Content Authoring', command: 'npm run check:content-authoring 2>&1' },
    { name: 'Vulnerability Scanner Tests', command: 'npm run test:vulnerability-scan 2>&1' },
    { name: 'Check Vulnerability Scan', command: 'npm run check:vulnerability-scan 2>&1' },
    { name: 'Report Code Health', command: 'npm run report:code-health 2>&1' },
    { name: 'Report Security', command: 'npm run report:security 2>&1' },
    { name: 'Translation Audit', command: 'npm run report:translation-audit 2>&1' },
    { name: 'Report Numeric Diff', command: 'npm run report:numeric-diff 2>&1' },
    { name: 'Check System Assertions', command: 'npm run check:system-assertions 2>&1' },
    { name: 'Destructive Regression', command: 'npm run test:destructive 2>&1' },
    { name: 'Scenario Matrix', command: 'npm run test:scenarios 2>&1' },
    { name: 'Report Ecosystem Balance', command: 'npm run report:ecosystem-balance 2>&1' },
    { name: 'Report Enemy AI Tuning', command: 'npm run report:enemy-ai-tuning 2>&1' },
    { name: 'Accept Expansion Content', command: 'npm run accept:expansion-content 2>&1' },
    { name: 'UI Smoke Tests', command: 'npm run test:ui-smoke 2>&1' },
    { name: 'UI Smoke Expansion', command: 'npm run test:ui-smoke:expansion 2>&1' },
    { name: 'Reward Flow Smoke', command: 'npm run test:reward-flow-smoke 2>&1' },
    { name: 'Terminal Flow Smoke', command: 'npm run test:terminal-flow-smoke 2>&1' },
    { name: 'Shop Flow Smoke', command: 'npm run test:shop-flow-smoke 2>&1' },
    { name: 'Event Flow Smoke', command: 'npm run test:event-flow-smoke 2>&1' },
    { name: 'Rest Flow Smoke', command: 'npm run test:rest-flow-smoke 2>&1' },
    { name: 'Upgrade Flow Smoke', command: 'npm run test:upgrade-flow-smoke 2>&1' },
    { name: 'Remove Card Flow Smoke', command: 'npm run test:remove-card-flow-smoke 2>&1' },
    { name: 'Boss Phase Flow Smoke', command: 'npm run test:boss-phase-flow-smoke 2>&1' },
    { name: 'Boss Terminal Flow Smoke', command: 'npm run test:boss-terminal-flow-smoke 2>&1' },
    { name: 'Desktop Smoke', command: 'npm run test:desktop-smoke 2>&1' },
    { name: 'Check Experience Polish', command: 'npm run check:experience-polish 2>&1' },
    { name: 'Check Release Readiness', command: 'npm run check:release-readiness 2>&1', env: { DOCTOR_IN_FLIGHT: '1' } },
  ];

  const results: StageResult[] = [];

  for (const stage of stages) {
    const result = runCommand(stage.name, stage.command, stage.env);
    results.push(result);
    if (failFast && result.status === 'fail') {
      console.log(`\n❌ Stopping on first failure: ${stage.name}`);
      break;
    }
  }

  const report = generateReport(results, failFast);

  console.log('\n=== Summary ===');
  console.log(`Total: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Skipped: ${report.summary.skipped}`);

  if (report.summary.failed > 0) {
    console.log('\nFailures by Category:');
    for (const [cat, count] of Object.entries(report.summary.byCategory)) {
      console.log(`  ${cat}: ${count}`);
    }
  }

  if (report.overallStatus === 'pass') {
    console.log('\n✅ All stages passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some stages failed. See report for details.');
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Doctor crashed:', err);
  process.exit(1);
});
