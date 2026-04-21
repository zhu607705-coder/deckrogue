#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const REPORT_DIR = 'reports/content';
const CHANGELOG_DIR = 'changelogs/numeric';
const REPORT_PATH = `${REPORT_DIR}/numeric-diff.json`;

interface NumericChange {
  timestamp: string;
  author: string;
  reason: string;
  affectedObjects: string[];
  changes: Array<{
    object: string;
    field: string;
    before: any;
    after: any;
    diff: any;
  }>;
  verificationCommand: string;
  rollbackAnchor: string;
  version: string;
}

interface NumericDiffReport {
  timestamp: string;
  totalChanges: number;
  byCategory: Record<string, number>;
  byAuthor: Record<string, number>;
  recentChanges: NumericChange[];
  unverifiedChanges: NumericChange[];
  missingRollbackAnchors: NumericChange[];
  summary: {
    hasUnverified: boolean;
    hasMissingAnchors: boolean;
    overallStatus: 'pass' | 'fail';
  };
}

function log(msg: string) {
  console.log(`[numeric-diff] ${msg}`);
}

function loadJsonFile(filepath: string): any {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadChangeLogs(): NumericChange[] {
  const changes: NumericChange[] = [];
  
  if (!existsSync(CHANGELOG_DIR)) {
    return changes;
  }

  const files = readdirSync(CHANGELOG_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filepath = join(CHANGELOG_DIR, file);
    const content = loadJsonFile(filepath);
    if (content && Array.isArray(content.changes)) {
      changes.push(content);
    }
  }

  return changes.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function analyzeChanges(changes: NumericChange[]): NumericDiffReport {
  const byCategory: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};
  const unverifiedChanges: NumericChange[] = [];
  const missingRollbackAnchors: NumericChange[] = [];

  for (const change of changes) {
    byAuthor[change.author] = (byAuthor[change.author] || 0) + 1;
    
    for (const obj of change.affectedObjects) {
      byCategory[obj] = (byCategory[obj] || 0) + 1;
    }

    if (!change.verificationCommand || change.verificationCommand.trim() === '') {
      unverifiedChanges.push(change);
    }

    if (!change.rollbackAnchor || change.rollbackAnchor.trim() === '') {
      missingRollbackAnchors.push(change);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalChanges: changes.length,
    byCategory,
    byAuthor,
    recentChanges: changes.slice(0, 10),
    unverifiedChanges,
    missingRollbackAnchors,
    summary: {
      hasUnverified: unverifiedChanges.length > 0,
      hasMissingAnchors: missingRollbackAnchors.length > 0,
      overallStatus: unverifiedChanges.length === 0 && missingRollbackAnchors.length === 0 ? 'pass' : 'fail'
    }
  };
}

function createChangeTemplate(): NumericChange {
  return {
    timestamp: new Date().toISOString(),
    author: '',
    reason: '',
    affectedObjects: [],
    changes: [],
    verificationCommand: '',
    rollbackAnchor: '',
    version: '1.0.0'
  };
}

function main() {
  log('Starting numeric diff report...');

  ensureDir(REPORT_DIR);
  ensureDir(CHANGELOG_DIR);

  const changes = loadChangeLogs();
  const report = analyzeChanges(changes);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  log(`Total changes: ${report.totalChanges}`);
  log(`Unverified changes: ${report.unverifiedChanges.length}`);
  log(`Missing rollback anchors: ${report.missingRollbackAnchors.length}`);

  if (report.unverifiedChanges.length > 0) {
    log('\nUnverified changes:');
    for (const change of report.unverifiedChanges.slice(0, 5)) {
      log(`  - ${change.timestamp}: ${change.reason}`);
    }
  }

  if (report.missingRollbackAnchors.length > 0) {
    log('\nMissing rollback anchors:');
    for (const change of report.missingRollbackAnchors.slice(0, 5)) {
      log(`  - ${change.timestamp}: ${change.reason}`);
    }
  }

  log(`Report saved to: ${REPORT_PATH}`);

  const templatePath = `${CHANGELOG_DIR}/template.json`;
  if (!existsSync(templatePath)) {
    writeFileSync(templatePath, JSON.stringify(createChangeTemplate(), null, 2));
    log(`\nCreated template: ${templatePath}`);
  }

  log(`\nReport saved to: ${REPORT_PATH}`);

  if (report.summary.overallStatus === 'fail') {
    log('\n⚠️ Some changes need attention');
  } else {
    log('\n✅ All changes are properly documented');
  }
}

main();
