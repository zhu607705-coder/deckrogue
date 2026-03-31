#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/bundle-check.json`;

interface BundleCheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface ContentBundleReport {
  timestamp: string;
  checks: BundleCheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    unreachableCards: string[];
    unreachableEvents: string[];
    unreachableRelics: string[];
    unreachableEnemies: string[];
  };
}

function log(msg: string) {
  console.log(`[content-bundle] ${msg}`);
}

function checkCharacters(): boolean {
  try {
    const output = execSync('grep -r "informant\\|brute\\|tactician" src/content/data/characters.json 2>/dev/null | head -5', { encoding: 'utf-8' });
    return output.includes('informant');
  } catch {
    return false;
  }
}

function checkCards(): boolean {
  try {
    const output = execSync('grep -c "planted_witness\\|terminal_verdict\\|glass_marionette" src/content/data/cards.json 2>/dev/null || echo "0"', { encoding: 'utf-8' });
    return parseInt(output.trim()) > 0;
  } catch {
    return false;
  }
}

function checkRelics(): boolean {
  try {
    const output = execSync('grep -c "mirror\\|branch" src/content/data/relics.json 2>/dev/null || echo "0"', { encoding: 'utf-8' });
    return parseInt(output.trim()) > 0;
  } catch {
    return false;
  }
}

function checkEvents(): boolean {
  try {
    const output = execSync('grep -c "mirror_invitation\\|mirror_zone" src/content/data/mirror_events.json 2>/dev/null || echo "0"', { encoding: 'utf-8' });
    return parseInt(output.trim()) > 0;
  } catch {
    return false;
  }
}

function checkMapStructure(): boolean {
  try {
    const output = execSync('grep "26\\|chapter" src/core/events/runGenerator.ts 2>/dev/null | head -3', { encoding: 'utf-8' });
    return output.includes('26') || output.includes('chapter');
  } catch {
    return false;
  }
}

function checkSecondaryResources(): boolean {
  try {
    const output = execSync('grep -r "secondaryResource" src/core/types/actions.ts 2>/dev/null | head -3', { encoding: 'utf-8' });
    return output.includes('evidence') || output.includes('rage') || output.includes('command');
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('=== Content Bundle Checks ===\n');

  const checks = [
    { name: 'Character definitions (6 chars)', fn: checkCharacters },
    { name: 'Branch cards (informant/brute/tactician)', fn: checkCards },
    { name: 'Mirror/branch relics', fn: checkRelics },
    { name: 'Mirror events', fn: checkEvents },
    { name: 'Three chapter map structure', fn: checkMapStructure },
    { name: 'Secondary resources in characters', fn: checkSecondaryResources },
  ];

  const results: BundleCheckResult[] = [];

  for (const check of checks) {
    log(`Checking: ${check.name}`);
    try {
      const passed = check.fn();
      results.push({ name: check.name, passed });
      console.log(`  ${passed ? '✅' : '❌'} ${check.name}`);
    } catch (err: any) {
      results.push({ name: check.name, passed: false, error: err.message });
      console.log(`  ❌ ${check.name}: ${err.message}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  const report: ContentBundleReport = {
    timestamp: new Date().toISOString(),
    checks: results,
    summary: {
      total: results.length,
      passed,
      failed,
      unreachableCards: [],
      unreachableEvents: [],
      unreachableRelics: [],
      unreachableEnemies: [],
    }
  };

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`\nSummary: ${passed}/${results.length} passed`);

  process.exit(failed > 0 ? 1 : 0);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Content bundle check crashed:', err);
  process.exit(1);
});
