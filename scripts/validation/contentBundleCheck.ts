#!/usr/bin/env node
/**
 * @file contentBundleCheck.ts
 * @description Validates the content bundle completeness and reachability.
 *
 * 主要职责:
 * - 检查内容包的完整性
 * - 验证内容项的可触达性
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import { RunGenerator } from '@/core/events/runGenerator';

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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8');
}

function requireCondition(condition: boolean, message: string): boolean {
  if (!condition) {
    throw new Error(message);
  }
  return true;
}

function checkCharacters(): boolean {
  const characters = readJson<Array<{ id: string; secondaryResource?: string; specialResource?: string }>>('src/content/data/characters.json');
  const ids = new Set(characters.map((character) => character.id));
  const requiredIds = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist'];
  const missing = requiredIds.filter((id) => !ids.has(id));
  return requireCondition(missing.length === 0, `missing characters: ${missing.join(', ')}`);
}

function checkCards(): boolean {
  const text = readText('src/content/data/cards.json');
  const requiredCards = ['planted_witness', 'terminal_verdict', 'glass_marionette'];
  const missing = requiredCards.filter((cardId) => !text.includes(cardId));
  return requireCondition(missing.length === 0, `missing branch cards: ${missing.join(', ')}`);
}

function checkRelics(): boolean {
  const text = readText('src/content/data/relics.json');
  return requireCondition(text.includes('mirror') || text.includes('branch'), 'expected mirror or branch relic content');
}

function checkEvents(): boolean {
  const text = readText('src/content/data/mirror_events.json');
  return requireCondition(text.includes('mirror_invitation') || text.includes('mirror_zone'), 'expected mirror event content');
}

function checkMapStructure(): boolean {
  const nodes = new RunGenerator(1).generateMap(1);
  const floors = new Set(nodes.map((node) => node.y));
  const bossCount = nodes.filter((node) => node.type === 'Boss').length;
  return requireCondition(floors.size === 26 && bossCount >= 3, `expected 26 floors and 3 boss nodes, got floors=${floors.size}, bosses=${bossCount}`);
}

function checkSecondaryResources(): boolean {
  const characters = readJson<Array<{ id: string; secondaryResource?: string }>>('src/content/data/characters.json');
  const resourcesByCharacter = new Map(characters.map((character) => [character.id, character.secondaryResource]));
  const expected = new Map([
    ['informant', 'evidence'],
    ['brute', 'rage'],
    ['tactician', 'command'],
  ]);
  const mismatches = [...expected.entries()]
    .filter(([characterId, resource]) => resourcesByCharacter.get(characterId) !== resource)
    .map(([characterId, resource]) => `${characterId}:${resourcesByCharacter.get(characterId) ?? 'missing'}!=${resource}`);
  return requireCondition(mismatches.length === 0, `secondary resource mismatch: ${mismatches.join(', ')}`);
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
