import test from 'node:test';
import assert from 'node:assert/strict';

import { auditDataRecords, type AuditDataFieldConfig } from '../../scripts/validation/translation_audit.ts';

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
