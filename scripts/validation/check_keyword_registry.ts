#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/keyword-registry.json`;

interface KeywordDef {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  abbreviation: string;
  category: string;
  iconHint: string;
  logFormat: string;
  uiPriority: number;
  validOn: string[];
  stacking?: string;
  examples?: string[];
  characterRestriction?: string[];
}

interface KeywordRegistry {
  version: string;
  lastUpdated: string;
  keywords: Record<string, KeywordDef>;
  categories: Record<string, any>;
  stackingTypes: Record<string, any>;
}

interface CheckResult {
  keywordId: string;
  status: 'valid' | 'missing_field' | 'invalid_category' | 'invalid_stacking' | 'missing_examples';
  issues: string[];
}

interface RegistryReport {
  timestamp: string;
  totalKeywords: number;
  validKeywords: number;
  invalidKeywords: number;
  missingFields: number;
  invalidCategories: number;
  invalidStackingTypes: number;
  missingExamples: number;
  results: CheckResult[];
  summary: {
    byCategory: Record<string, number>;
    byStackingType: Record<string, number>;
  };
}

function log(msg: string) {
  console.log(`[keyword-registry] ${msg}`);
}

function loadJsonFile(filepath: string): any {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

const REQUIRED_FIELDS = ['id', 'name', 'nameEn', 'description', 'abbreviation', 'category', 'iconHint', 'logFormat', 'uiPriority', 'validOn'];
const VALID_CATEGORIES = ['mechanic', 'status', 'buff', 'debuff', 'resource', 'enemy_type'];
const VALID_STACKING_TYPES = ['intensity', 'duration', 'none'];

function checkKeyword(keyword: KeywordDef): CheckResult {
  const issues: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in keyword) || keyword[field as keyof KeywordDef] === undefined) {
      issues.push(`Missing required field: ${field}`);
    }
  }

  if (keyword.category && !VALID_CATEGORIES.includes(keyword.category)) {
    issues.push(`Invalid category: ${keyword.category}`);
  }

  if (keyword.stacking && !VALID_STACKING_TYPES.includes(keyword.stacking)) {
    issues.push(`Invalid stacking type: ${keyword.stacking}`);
  }

  if (!keyword.examples || keyword.examples.length === 0) {
    issues.push('Missing examples');
  }

  return {
    keywordId: keyword.id,
    status: issues.length === 0 ? 'valid' : issues[0].includes('Missing required') ? 'missing_field' : issues[0].includes('Invalid category') ? 'invalid_category' : issues[0].includes('Invalid stacking') ? 'invalid_stacking' : 'missing_examples',
    issues
  };
}

function checkRegistry(): RegistryReport {
  const registryPath = resolve('src/content/data/keywordRegistry.json');
  const registry = loadJsonFile(registryPath) as KeywordRegistry;

  if (!registry) {
    throw new Error('Failed to load keywordRegistry.json');
  }

  const results: CheckResult[] = [];
  const byCategory: Record<string, number> = {};
  const byStackingType: Record<string, number> = {};

  for (const [id, keyword] of Object.entries(registry.keywords)) {
    const result = checkKeyword(keyword);
    results.push(result);

    byCategory[keyword.category] = (byCategory[keyword.category] || 0) + 1;
    if (keyword.stacking) {
      byStackingType[keyword.stacking] = (byStackingType[keyword.stacking] || 0) + 1;
    }
  }

  const validKeywords = results.filter(r => r.status === 'valid').length;
  const invalidKeywords = results.filter(r => r.status !== 'valid').length;

  return {
    timestamp: new Date().toISOString(),
    totalKeywords: results.length,
    validKeywords,
    invalidKeywords,
    missingFields: results.filter(r => r.status === 'missing_field').length,
    invalidCategories: results.filter(r => r.status === 'invalid_category').length,
    invalidStackingTypes: results.filter(r => r.status === 'invalid_stacking').length,
    missingExamples: results.filter(r => r.status === 'missing_examples').length,
    results,
    summary: {
      byCategory,
      byStackingType
    }
  };
}

function main() {
  log('Starting keyword registry check...');

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  const report = checkRegistry();

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  log(`Total keywords: ${report.totalKeywords}`);
  log(`Valid: ${report.validKeywords}`);
  log(`Invalid: ${report.invalidKeywords}`);

  if (report.invalidKeywords > 0) {
    log('\nIssues found:');
    for (const result of report.results.filter(r => r.status !== 'valid')) {
      log(`  - ${result.keywordId}: ${result.issues.join(', ')}`);
    }
  }

  log(`\nReport saved to: ${REPORT_PATH}`);

  if (report.invalidKeywords > 0) {
    process.exit(1);
  }

  log('\n✅ All keywords are valid');
}

main();
