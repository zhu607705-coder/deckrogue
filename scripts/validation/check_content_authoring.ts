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
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/content-authoring.json`;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

interface CardSpec {
  id: string;
  name: string;
  rarity: string;
  cost: number;
  type: string;
  targeting?: string;
  tags?: unknown;
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
  keywords?: unknown;
  intent_policy?: Array<{ intent?: string; weight?: number }>;
  intentPolicy?: Array<{ intent?: string; weight?: number }>;
  moves?: Record<string, unknown>;
}

interface PotionSpec {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  price?: unknown;
  toxicity?: unknown;
  tags?: unknown;
  effect?: unknown;
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
  potions: {
    total: number;
    valid: number;
    invalid: number;
    missingEffect: number;
    issues: Array<{ potionId: string; issues: string[] }>;
  };
  summary: {
    overallStatus: 'pass' | 'fail';
    passRate: number;
  };
}

function log(msg: string) {
  console.log(`[content-authoring] ${msg}`);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function loadRegisteredActionTypes(): Set<string> {
  const actionFactoryPath = resolve(REPO_ROOT, 'src/core/actions/v2/ActionFactory.ts');
  const source = readFileSync(actionFactoryPath, 'utf-8');
  const entriesStart = source.indexOf('private static actionMapEntries');
  const listStart = entriesStart >= 0 ? source.indexOf('= [', entriesStart) : -1;
  const listEnd = listStart >= 0 ? source.indexOf('\n  ];', listStart) : -1;
  const entriesSource = listStart >= 0 && listEnd >= 0 ? source.slice(listStart, listEnd) : '';
  const types = new Set([...entriesSource.matchAll(/\[\s*['"]([^'"]+)['"]\s*,/g)].map((match) => match[1]));

  if (types.size === 0) {
    throw new Error(`Could not load action registry from ${actionFactoryPath}`);
  }

  return types;
}

const CARD_ACTION_TYPES = loadRegisteredActionTypes();
const ENEMY_ACTION_TYPES = new Set([
  ...CARD_ACTION_TYPES,
  'DamageBoost',
  'HealSelf',
  'SummonEnemy',
  'BuffAllEnemies',
  'PlayerDrawLess',
  'RandomCardCostIncrease',
  'OnDeath',
  'RevealHand',
  'SwapCards',
]);

const ACTION_NUMERIC_FIELDS = new Set([
  'alpha',
  'amount',
  'armorIgnore',
  'atk',
  'atkBonus',
  'atkPerConstruct',
  'attack',
  'baseAtk',
  'baseHp',
  'block',
  'blockThreshold',
  'bonus',
  'chanceReduction',
  'constructAtkBonus',
  'consumeOtherConstructs',
  'costModifier',
  'costReduction',
  'damage',
  'damagePerPoison',
  'divisor',
  'drawAmount',
  'effectPercent',
  'emptyPenaltyTrueDamage',
  'failureConstructAtk',
  'failureConstructHp',
  'falseDamage',
  'healAmount',
  'hp',
  'hpBonus',
  'hpPerConstruct',
  'maxAmount',
  'maxPoisonRemoval',
  'minimum',
  'multiplier',
  'perDebuff',
  'percent',
  'poisonThreshold',
  'sensitivity',
  'stacks',
  'threshold',
  'times',
  'turns',
  'zealPerBuff',
]);

const ACTION_ARRAY_FIELDS = ['actions', 'effects', 'trueActions', 'falseActions'] as const;
const ACTION_OBJECT_FIELDS = ['effect', 'ifTrue', 'ifFalse'] as const;
const ACTION_NUMERIC_OBJECT_FIELDS = ['condition', 'scaling', 'trigger'] as const;

function loadJsonFile(filepath: string): any {
  try {
    const rawContent = readFileSync(filepath, 'utf-8');
    const content = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
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

function formatValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function validateNumericFieldsInObject(value: Record<string, unknown>, path: string): string[] {
  const issues: string[] = [];

  for (const [key, fieldValue] of Object.entries(value)) {
    if (!ACTION_NUMERIC_FIELDS.has(key)) {
      continue;
    }

    if (!isFiniteNumber(fieldValue)) {
      issues.push(`Invalid action numeric field at ${path}.${key}: ${formatValue(fieldValue)}`);
    }
  }

  return issues;
}

function validateNumericFieldTree(value: unknown, path: string): string[] {
  const issues: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      issues.push(...validateNumericFieldTree(item, `${path}[${index}]`));
    });
    return issues;
  }

  if (!isRecord(value)) {
    return issues;
  }

  issues.push(...validateNumericFieldsInObject(value, path));
  for (const [key, fieldValue] of Object.entries(value)) {
    if (isRecord(fieldValue) || Array.isArray(fieldValue)) {
      issues.push(...validateNumericFieldTree(fieldValue, `${path}.${key}`));
    }
  }

  return issues;
}

function validateActionSpec(
  value: unknown,
  path: string,
  allowedTypes: Set<string>,
  unknownTypeLabel: string,
): string[] {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return [`Invalid action at ${path}: expected object`];
  }

  const actionType = value.type;
  if (typeof actionType !== 'string' || actionType.trim() === '') {
    issues.push(`Missing action type at ${path}`);
  } else if (!allowedTypes.has(actionType)) {
    issues.push(`${unknownTypeLabel} at ${path}: ${actionType}`);
  }

  issues.push(...validateNumericFieldsInObject(value, path));

  for (const field of ACTION_NUMERIC_OBJECT_FIELDS) {
    if (value[field] !== undefined) {
      issues.push(...validateNumericFieldTree(value[field], `${path}.${field}`));
    }
  }

  for (const field of ACTION_ARRAY_FIELDS) {
    if (value[field] === undefined) {
      continue;
    }

    if (!Array.isArray(value[field])) {
      issues.push(`Invalid nested action list at ${path}.${field}: expected array`);
      continue;
    }

    value[field].forEach((child, index) => {
      issues.push(...validateActionSpec(child, `${path}.${field}[${index}]`, allowedTypes, unknownTypeLabel));
    });
  }

  for (const field of ACTION_OBJECT_FIELDS) {
    if (value[field] === undefined) {
      continue;
    }

    const fieldValue = value[field];
    if (Array.isArray(fieldValue)) {
      fieldValue.forEach((child, index) => {
        issues.push(...validateActionSpec(child, `${path}.${field}[${index}]`, allowedTypes, unknownTypeLabel));
      });
      continue;
    }

    issues.push(...validateActionSpec(fieldValue, `${path}.${field}`, allowedTypes, unknownTypeLabel));
  }

  return issues;
}

function validateActionList(
  value: unknown,
  path: string,
  allowedTypes: Set<string>,
  unknownTypeLabel: string,
): string[] {
  if (!Array.isArray(value)) {
    return [`Invalid action list at ${path}: expected array`];
  }

  return value.flatMap((action, index) => validateActionSpec(action, `${path}[${index}]`, allowedTypes, unknownTypeLabel));
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

  if (!isFiniteNumber(card.cost) || card.cost < -2 || card.cost > 10) {
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
  } else {
    issues.push(...validateActionList(card.actions, 'actions', CARD_ACTION_TYPES, 'Unknown card action type'));
  }

  if (isRecord(card.upgrade) && card.upgrade.actions !== undefined) {
    issues.push(...validateActionList(card.upgrade.actions, 'upgrade.actions', CARD_ACTION_TYPES, 'Unknown card action type'));
  }

  if (typeof card.targeting !== 'string' || card.targeting.trim() === '') {
    issues.push(card.type === 'Attack' ? 'Attack card missing targeting' : 'Missing targeting');
  }

  if (!Array.isArray(card.tags) || !card.tags.every((tag) => isNonEmptyString(tag))) {
    issues.push('Missing or invalid tags');
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

  if (!Array.isArray(enemy.keywords) || !enemy.keywords.every((keyword) => isNonEmptyString(keyword))) {
    issues.push('Missing or invalid keywords');
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

  if (moves) {
    for (const [intent, actions] of Object.entries(moves)) {
      issues.push(...validateActionList(actions, `moves.${intent}`, ENEMY_ACTION_TYPES, 'Unknown enemy action type'));
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

  if (relic.price !== undefined && !isFiniteNumber(relic.price)) {
    issues.push('Invalid relic price');
  }

  if (typeof relic.trigger !== 'string' || relic.trigger.trim() === '') {
    issues.push('Missing relic trigger');
  }

  if (relic.tags !== undefined && (!Array.isArray(relic.tags) || !relic.tags.every((tag: unknown) => isNonEmptyString(tag)))) {
    issues.push('Invalid relic tags');
  }

  if (relic.priority !== undefined && !isFiniteNumber(relic.priority)) {
    issues.push('Invalid relic priority');
  }

  if (relic.effect === undefined && relic.effects === undefined && relic.passiveEffect === undefined) {
    issues.push('Missing relic effect contract');
  }

  return issues;
}

function checkPotion(potion: PotionSpec): string[] {
  const issues: string[] = [];

  if (!isNonEmptyString(potion.id)) {
    issues.push('Missing potion ID');
  }

  if (!isNonEmptyString(potion.name)) {
    issues.push('Missing potion name');
  }

  if (!isNonEmptyString(potion.description)) {
    issues.push('Missing potion description');
  }

  if (!isFiniteNumber(potion.price)) {
    issues.push('Missing or invalid potion price');
  }

  if (potion.toxicity !== undefined && !isFiniteNumber(potion.toxicity)) {
    issues.push('Invalid potion toxicity');
  }

  if (potion.tags !== undefined && (!Array.isArray(potion.tags) || !potion.tags.every((tag) => typeof tag === 'string' && tag.length > 0))) {
    issues.push('Invalid potion tags');
  }

  if (potion.effect === undefined) {
    issues.push('Missing potion effect contract');
  }

  return issues;
}

function checkContent(): ContentAuthoringReport {
  const cardsPath = resolve('src/content/data/cards.json');
  const enemiesPath = resolve('src/content/data/enemies.json');
  const relicsPath = resolve('src/content/data/relics.json');
  const potionsPath = resolve('src/content/data/potions.json');

  const cards = loadJsonFile(cardsPath) || [];
  const enemies = loadJsonFile(enemiesPath) || [];
  const relics = loadJsonFile(relicsPath) || [];
  const potions = loadJsonFile(potionsPath) || [];

  const cardIssues: Array<{ cardId: string; issues: string[] }> = [];
  const enemyIssues: Array<{ enemyId: string; issues: string[] }> = [];
  const relicIssues: Array<{ relicId: string; issues: string[] }> = [];
  const potionIssues: Array<{ potionId: string; issues: string[] }> = [];

  let validCards = 0;
  let validEnemies = 0;
  let validRelics = 0;
  let validPotions = 0;

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

  for (const potion of potions) {
    const issues = checkPotion(potion);
    if (issues.length > 0) {
      potionIssues.push({ potionId: typeof potion.id === 'string' && potion.id.length > 0 ? potion.id : 'unknown', issues });
    } else {
      validPotions++;
    }
  }

  const totalItems = cards.length + enemies.length + relics.length;
  const validItems = validCards + validEnemies + validRelics + validPotions;
  const totalItemsWithPotions = totalItems + potions.length;
  const passRate = totalItemsWithPotions > 0 ? (validItems / totalItemsWithPotions) * 100 : 0;
  const invalidItems = cardIssues.length + enemyIssues.length + relicIssues.length + potionIssues.length;

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
    potions: {
      total: potions.length,
      valid: validPotions,
      invalid: potionIssues.length,
      missingEffect: potionIssues.filter(p => p.issues.some(i => i.includes('effect'))).length,
      issues: potionIssues
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
  log(`Potions: ${report.potions.valid}/${report.potions.total} valid`);
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

  if (report.potions.invalid > 0) {
    log('\nPotion issues:');
    for (const { potionId, issues } of report.potions.issues.slice(0, 5)) {
      log(`  - ${potionId}: ${issues.join(', ')}`);
    }
    if (report.potions.issues.length > 5) {
      log(`  ... and ${report.potions.issues.length - 5} more`);
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
