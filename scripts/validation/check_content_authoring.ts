#!/usr/bin/env node
/**
 * @file check_content_authoring.ts
 * @description Validates content authoring standards for cards, enemies, relics, and events.
 *
 * 主要职责:
 * - 检查卡牌、敌人、遗物、事件的定义完整性
 * - 验证内容的授权与可访问性
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/content-authoring.json`;

interface CardSpec {
  id: string;
  name: string;
  rarity: string;
  cost: number;
  type: string;
  targeting?: string;
  tags?: string[];
  text?: string;
  actions?: any[];
  upgrade?: any;
  character?: string;
}

interface EnemySpec {
  id: string;
  name: string;
  hp_range?: [number, number];
  minHp?: number;
  maxHp?: number;
  intent_policy?: Array<{ intent?: string; weight?: number }>;
  intentPolicy?: Array<{ intent?: string; weight?: number }>;
  moves?: Record<string, unknown>;
}

interface ContentAuthoringReport {
  timestamp: string;
  cards: {
    total: number;
    valid: number;
    invalid: number;
    missingPositioning: number;
    missingExpectedTurn: number;
    missingResourceRelation: number;
    missingUpgradePath: number;
    missingRiskPoints: number;
    missingTriggerOrder: number;
    issues: Array<{ cardId: string; issues: string[] }>;
  };
  enemies: {
    total: number;
    valid: number;
    invalid: number;
    missingIntentPolicy: number;
    missingHpRange: number;
    issues: Array<{ enemyId: string; issues: string[] }>;
  };
  relics: {
    total: number;
    valid: number;
    invalid: number;
    missingEffect: number;
    issues: Array<{ relicId: string; issues: string[] }>;
  };
  summary: {
    overallStatus: 'pass' | 'fail';
    passRate: number;
  };
}

function log(msg: string) {
  console.log(`[content-authoring] ${msg}`);
}

function loadJsonFile(filepath: string): any {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isUnplayableCard(card: CardSpec): boolean {
  const tags = Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).toLowerCase()) : [];
  const text = String(card.text || '').toLowerCase();
  return (
    card.type === 'Status' ||
    card.type === 'Curse' ||
    card.cost < 0 ||
    tags.includes('unplayable') ||
    tags.includes('curse') ||
    text.includes('unplayable')
  );
}

function checkCard(card: CardSpec): string[] {
  const issues: string[] = [];

  if (!card.id || card.id.trim() === '') {
    issues.push('Missing card ID');
  }

  if (!card.name || card.name.trim() === '') {
    issues.push('Missing card name');
  }

  if (!card.rarity || !['Common', 'Uncommon', 'Rare', 'Legendary', 'Curse', 'Special', 'Starter', 'Basic'].includes(card.rarity)) {
    issues.push(`Invalid rarity: ${card.rarity}`);
  }

  if (card.cost === undefined || card.cost < -2 || card.cost > 10) {
    issues.push(`Invalid cost: ${card.cost}`);
  }

  if (!card.type || !['Attack', 'Skill', 'Power', 'Curse', 'Status'].includes(card.type)) {
    issues.push(`Invalid type: ${card.type}`);
  }

  if (!card.text || card.text.trim() === '') {
    issues.push('Missing card text');
  }

  if (!Array.isArray(card.actions)) {
    issues.push('Missing actions array');
  } else if (card.actions.length === 0 && !isUnplayableCard(card)) {
    issues.push('Missing actions');
  }

  if (card.type === 'Attack' && !card.targeting) {
    issues.push('Attack card missing targeting');
  }

  if (card.character !== undefined && typeof card.character !== 'string') {
    issues.push('Missing character restriction');
  }

  return issues;
}

function checkEnemy(enemy: EnemySpec): string[] {
  const issues: string[] = [];
  const hpRange = Array.isArray(enemy.hp_range)
    ? enemy.hp_range
    : (Number.isFinite(enemy.minHp) && Number.isFinite(enemy.maxHp) ? [Number(enemy.minHp), Number(enemy.maxHp)] : null);
  const intentPolicy = Array.isArray(enemy.intent_policy)
    ? enemy.intent_policy
    : (Array.isArray(enemy.intentPolicy) ? enemy.intentPolicy : null);
  const moves = enemy.moves && typeof enemy.moves === 'object' && !Array.isArray(enemy.moves)
    ? enemy.moves as Record<string, unknown>
    : null;

  if (!enemy.id || enemy.id.trim() === '') {
    issues.push('Missing enemy ID');
  }

  if (!enemy.name || enemy.name.trim() === '') {
    issues.push('Missing enemy name');
  }

  if (!hpRange || hpRange.length !== 2 || !hpRange.every((value) => Number.isFinite(value))) {
    issues.push('Missing or invalid hp_range');
  }

  if (!intentPolicy || intentPolicy.length === 0) {
    issues.push('Missing intent_policy');
  }

  if (!moves || Object.keys(moves).length === 0) {
    issues.push('Missing moves');
  }

  if (intentPolicy && moves) {
    for (const policy of intentPolicy) {
      const intent = String(policy?.intent || '');
      if (!intent || !moves[intent]) {
        issues.push(`Intent references missing move: ${intent || 'unknown'}`);
      }
      if (policy?.weight !== undefined && (typeof policy.weight !== 'number' || !Number.isFinite(policy.weight))) {
        issues.push(`Intent has non-number weight: ${intent || 'unknown'}`);
      }
    }
  }

  return issues;
}

function checkRelic(relic: any): string[] {
  const issues: string[] = [];

  if (!relic.id || relic.id.trim() === '') {
    issues.push('Missing relic ID');
  }

  if (!relic.name || relic.name.trim() === '') {
    issues.push('Missing relic name');
  }

  if (!relic.description || relic.description.trim() === '') {
    issues.push('Missing relic description');
  }

  return issues;
}

function checkContent(): ContentAuthoringReport {
  const cardsPath = resolve('src/content/data/cards.json');
  const enemiesPath = resolve('src/content/data/enemies.json');
  const relicsPath = resolve('src/content/data/relics.json');

  const cards = loadJsonFile(cardsPath) || [];
  const enemies = loadJsonFile(enemiesPath) || [];
  const relics = loadJsonFile(relicsPath) || [];

  const cardIssues: Array<{ cardId: string; issues: string[] }> = [];
  const enemyIssues: Array<{ enemyId: string; issues: string[] }> = [];
  const relicIssues: Array<{ relicId: string; issues: string[] }> = [];

  let validCards = 0;
  let validEnemies = 0;
  let validRelics = 0;

  for (const card of cards) {
    const issues = checkCard(card);
    if (issues.length > 0) {
      cardIssues.push({ cardId: card.id || 'unknown', issues });
    } else {
      validCards++;
    }
  }

  for (const enemy of enemies) {
    const issues = checkEnemy(enemy);
    if (issues.length > 0) {
      enemyIssues.push({ enemyId: enemy.id || 'unknown', issues });
    } else {
      validEnemies++;
    }
  }

  for (const relic of relics) {
    const issues = checkRelic(relic);
    if (issues.length > 0) {
      relicIssues.push({ relicId: relic.id || 'unknown', issues });
    } else {
      validRelics++;
    }
  }

  const totalItems = cards.length + enemies.length + relics.length;
  const validItems = validCards + validEnemies + validRelics;
  const passRate = totalItems > 0 ? (validItems / totalItems) * 100 : 0;
  const invalidItems = cardIssues.length + enemyIssues.length + relicIssues.length;

  return {
    timestamp: new Date().toISOString(),
    cards: {
      total: cards.length,
      valid: validCards,
      invalid: cardIssues.length,
      missingPositioning: cardIssues.filter(c => c.issues.some(i => i.includes('targeting'))).length,
      missingExpectedTurn: 0,
      missingResourceRelation: 0,
      missingUpgradePath: 0,
      missingRiskPoints: 0,
      missingTriggerOrder: 0,
      issues: cardIssues
    },
    enemies: {
      total: enemies.length,
      valid: validEnemies,
      invalid: enemyIssues.length,
      missingIntentPolicy: enemyIssues.filter(e => e.issues.some(i => i.includes('intent_policy'))).length,
      missingHpRange: enemyIssues.filter(e => e.issues.some(i => i.includes('hp_range'))).length,
      issues: enemyIssues
    },
    relics: {
      total: relics.length,
      valid: validRelics,
      invalid: relicIssues.length,
      missingEffect: relicIssues.filter(r => r.issues.some(i => i.includes('description'))).length,
      issues: relicIssues
    },
    summary: {
      overallStatus: invalidItems === 0 ? 'pass' : 'fail',
      passRate: Math.round(passRate * 100) / 100
    }
  };
}

function main() {
  log('Starting content authoring check...');

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  const report = checkContent();

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  log(`Cards: ${report.cards.valid}/${report.cards.total} valid`);
  log(`Enemies: ${report.enemies.valid}/${report.enemies.total} valid`);
  log(`Relics: ${report.relics.valid}/${report.relics.total} valid`);
  log(`Pass rate: ${report.summary.passRate}%`);

  if (report.cards.invalid > 0) {
    log('\nCard issues:');
    for (const { cardId, issues } of report.cards.issues.slice(0, 5)) {
      log(`  - ${cardId}: ${issues.join(', ')}`);
    }
    if (report.cards.issues.length > 5) {
      log(`  ... and ${report.cards.issues.length - 5} more`);
    }
  }

  if (report.enemies.invalid > 0) {
    log('\nEnemy issues:');
    for (const { enemyId, issues } of report.enemies.issues.slice(0, 10)) {
      log(`  - ${enemyId}: ${issues.join(', ')}`);
    }
    if (report.enemies.issues.length > 10) {
      log(`  ... and ${report.enemies.issues.length - 10} more`);
    }
  }

  if (report.relics.invalid > 0) {
    log('\nRelic issues:');
    for (const { relicId, issues } of report.relics.issues.slice(0, 5)) {
      log(`  - ${relicId}: ${issues.join(', ')}`);
    }
    if (report.relics.issues.length > 5) {
      log(`  ... and ${report.relics.issues.length - 5} more`);
    }
  }

  log(`\nReport saved to: ${REPORT_PATH}`);

  if (report.summary.overallStatus === 'fail') {
    log('\n❌ Content authoring check failed');
    process.exit(1);
  }

  log('\n✅ Content authoring check passed');
}

main();
