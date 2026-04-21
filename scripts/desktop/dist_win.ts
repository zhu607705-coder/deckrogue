#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');

const REPORT_DIR = path.join(process.cwd(), 'reports', 'desktop');
const REPORT_PATH = path.join(REPORT_DIR, 'windows-installer.json');

interface WindowsInstallerReport {
  timestamp: string;
  overallStatus: 'pass' | 'fail';
  artifactPath: string | null;
  platform: string;
  evidence: string[];
}

function writeReport(report: WindowsInstallerReport) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function main() {
  const evidence: string[] = [];
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { version?: string };
  const version = pkg.version || '0.0.0';
  const artifactPath = path.join(process.cwd(), 'dist-desktop', `DeckRogue-Setup-${version}.exe`);

  if (process.platform !== 'win32') {
    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'fail',
      artifactPath: null,
      platform: process.platform,
      evidence: ['Windows installer packaging requires a Windows build machine or Windows CI'],
    });
    throw new Error('dist:win can only run on Windows');
  }

  try {
    execSync('npm run build:desktop', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    execSync(`${process.execPath} "${electronBuilderCli}" --win nsis --x64 --config electron-builder.json`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    if (!existsSync(artifactPath)) {
      throw new Error(`Expected installer missing: ${artifactPath}`);
    }

    evidence.push('renderer build completed');
    evidence.push('electron-builder win/nsis packaging completed');
    evidence.push(`installer ready at ${artifactPath}`);

    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'pass',
      artifactPath,
      platform: process.platform,
      evidence,
    });
  } catch (error) {
    evidence.push(error instanceof Error ? error.message : String(error));
    writeReport({
      timestamp: new Date().toISOString(),
      overallStatus: 'fail',
      artifactPath: existsSync(artifactPath) ? artifactPath : null,
      platform: process.platform,
      evidence,
    });
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error('[dist:win] failed:', error);
  process.exit(1);
}
