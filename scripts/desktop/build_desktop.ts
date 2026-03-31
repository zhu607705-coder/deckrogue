#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPORT_DIR = path.join(process.cwd(), 'reports', 'desktop');
const REPORT_PATH = path.join(REPORT_DIR, 'desktop-build.json');

interface DesktopBuildReport {
  timestamp: string;
  overallStatus: 'pass' | 'fail';
  rendererIndexPath: string;
  electronMainPath: string;
  preloadPath: string;
  entryMode: 'legacy' | 'runtime-v2' | 'unified';
  evidence: string[];
}

function writeReport(report: DesktopBuildReport) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function main() {
  const rendererIndexPath = path.join(process.cwd(), 'dist', 'index.html');
  const electronMainPath = path.join(process.cwd(), 'electron', 'main.mjs');
  const preloadPath = path.join(process.cwd(), 'electron', 'preload.cjs');
  const evidence: string[] = [];

  try {
    execSync('npm run build --silent', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    if (!existsSync(rendererIndexPath)) {
      throw new Error('dist/index.html missing after renderer build');
    }
    if (!existsSync(electronMainPath)) {
      throw new Error('electron/main.mjs missing');
    }
    if (!existsSync(preloadPath)) {
      throw new Error('electron/preload.cjs missing');
    }

    evidence.push('renderer dist built');
    evidence.push('electron main entry present');
    evidence.push('electron preload entry present');

    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'pass',
      rendererIndexPath,
      electronMainPath,
      preloadPath,
      entryMode: 'unified',
      evidence,
    });
  } catch (error) {
    evidence.push(error instanceof Error ? error.message : String(error));
    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'fail',
      rendererIndexPath,
      electronMainPath,
      preloadPath,
      entryMode: 'unified',
      evidence,
    });
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error('[build:desktop] failed:', error);
  process.exit(1);
}
