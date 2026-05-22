/**
 * @file validationScripts.test.ts
 * @description Static regressions for validation script project-root handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dead file scan resolves the repository root above scripts/validation', () => {
  const source = readFileSync('scripts/validation/dead_file_scan.ts', 'utf-8');

  assert.match(source, /path\.resolve\(__dirname,\s*'\.\.',\s*'\.\.'\)/);
  assert.doesNotMatch(source, /const ROOT = path\.resolve\(__dirname,\s*'\.\.'\);/);
});

test('dead file scan resolves Vite source aliases', () => {
  const source = readFileSync('scripts/validation/dead_file_scan.ts', 'utf-8');

  assert.match(source, /spec\.startsWith\('@\/'\)/);
  assert.match(source, /path\.join\(ROOT,\s*'src',\s*spec\.slice\(2\)\)/);
  assert.match(source, /\\bimport\\s\*\['"\]\(\[\^'"\]\+\)\['"\]/);
});

test('dead file scan includes test and tool source entrypoints', () => {
  const source = readFileSync('scripts/validation/dead_file_scan.ts', 'utf-8');

  assert.match(source, /externalEntrypoints/);
  assert.match(source, /collectExternalSourceEntrypoints/);
  assert.match(source, /EXTERNAL_SOURCE_REFERENCE_PREFIXES/);
  assert.match(source, /'tests\/'/);
  assert.match(source, /'scripts\/'/);
});

test('content contract layer guards character raw data imports', () => {
  const source = readFileSync('scripts/validation/check_content_contract_layer.ts', 'utf-8');

  assert.match(source, /@\/content\/data\/characters\.json/);
  assert.match(source, /src\/content\/narrative\/numericSystem\.ts/);
});

test('experience polish requires complete UI expansion evidence', () => {
  const source = readFileSync('scripts/validation/check_experience_polish.ts', 'utf-8');

  for (const label of ['combat', 'reward', 'shop', 'event', 'upgrade']) {
    assert.match(source, new RegExp(`['"]${label}['"]`));
  }
  assert.match(source, /validateUiSmokeExpansionReport/);
  assert.match(source, /process\.exit\(1\)/);
});

test('desktop smoke isolates production runs', () => {
  const source = readFileSync('scripts/validation/playwright_electron_smoke.ts', 'utf-8');

  assert.match(source, /desktop-smoke-production\.lock/);
  assert.match(source, /deckrogue-electron-smoke-user-data-\$\{runId\}/);
  assert.match(source, /desktop_\$\{runId\}_launcher\.png/);
});
