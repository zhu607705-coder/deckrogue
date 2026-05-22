/**
 * @file releaseAndTranslationGate.test.ts
 * @description Unit tests for release readiness and translation audit gate checks.
 *
 * 主要职责:
 * - 测试翻译审计的数据记录审计
 * - 测试英文残留检测的有效性
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { auditDataRecords, type AuditDataFieldConfig } from '../../scripts/validation/translation_audit.ts';

const DESKTOP_SMOKE_SOURCE = readFileSync(resolve('scripts/validation/playwright_electron_smoke.ts'), 'utf-8');
const RELEASE_READINESS_SOURCE = readFileSync(resolve('scripts/validation/check_release_readiness.ts'), 'utf-8');

test('translation audit flags visible English in data-driven relic and achievement content', () => {
  const fields: AuditDataFieldConfig[] = [
    { path: 'description', label: 'description' },
    { path: 'trigger', label: 'trigger' },
    { path: 'title', label: 'title' },
  ];
  const items = auditDataRecords('src/content/data/test.json', [
    { id: 'relic_1', description: 'Gain 1 Energy at the start of each combat.', trigger: 'StartCombat' },
    { id: 'achievement_1', title: 'Warp Echoes Hunter' },
  ], fields);

  assert.equal(items.filter((item) => item.kind === 'english-residue').length, 3);
  assert.ok(items.some((item) => item.excerpt.includes('Gain 1 Energy')));
  assert.ok(items.some((item) => item.excerpt.includes('StartCombat')));
  assert.ok(items.some((item) => item.excerpt.includes('Warp Echoes Hunter')));
});

test('desktop smoke reports and release readiness require clean Electron close', () => {
  assert.match(DESKTOP_SMOKE_SOURCE, /closeStatus:\s*'pending'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.closeStatus\s*=\s*'pass'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.closeStatus\s*=\s*'fail'/);
  assert.match(DESKTOP_SMOKE_SOURCE, /report\.closeStatus\s*===\s*'pass'/);
  assert.match(RELEASE_READINESS_SOURCE, /smokeReport\?\.closeStatus\s*===\s*'pass'/);
});
