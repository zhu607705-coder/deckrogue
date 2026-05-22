/**
 * @file validationScripts.test.ts
 * @description Static regressions for validation script project-root handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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

test('dead file scan resolves extensionless script imports', () => {
  const source = readFileSync('scripts/validation/dead_file_scan.ts', 'utf-8');

  assert.match(source, /resolveRepoFileImport/);
  assert.match(source, /\$\{base\}\.ts/);
  assert.match(source, /extractImportSpecs/);
  assert.match(source, /scriptFilesSet\.has\(target\)/);
});

test('numeric diagnostics keeps signed RNG and zero drift out of warning totals', () => {
  const source = readFileSync('scripts/analysis/numeric_diagnostics.ts', 'utf-8');

  assert.match(source, /'\.rngState'/);
  assert.match(source, /'\.runtimeRngState'/);
  assert.match(source, /Severity \| 'ok'/);
  assert.match(source, /drift > 0\.2 \? 'error' : drift > 0\.1 \? 'warn' : 'ok'/);
});

test('content contract layer guards character raw data imports', () => {
  const source = readFileSync('scripts/validation/check_content_contract_layer.ts', 'utf-8');

  assert.match(source, /@\/content\/data\/characters\.json/);
  assert.match(source, /src\/content\/narrative\/numericSystem\.ts/);
});

test('experience polish requires complete UI expansion evidence', () => {
  const source = readFileSync('scripts/validation/check_experience_polish.ts', 'utf-8');
  const contractSource = readFileSync('scripts/validation/uiSmokeExpansionContract.ts', 'utf-8');
  const smokeSource = readFileSync('scripts/validation/playwright_ui_smoke_expansion.ts', 'utf-8');

  for (const label of ['combat', 'reward', 'shop', 'event', 'upgrade']) {
    assert.match(contractSource, new RegExp(`['"]${label}['"]`));
  }
  assert.match(source, /validateUiSmokeExpansionReport/);
  assert.match(contractSource, /generatedAt is stale for current workspace state/);
  assert.match(contractSource, /ui smoke expansion did not complete/);
  assert.match(contractSource, /screenshot is stale for current workspace state/);
  assert.match(smokeSource, /generatedAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(smokeSource, /completed\s*=\s*true/);
  assert.match(source, /process\.exit\(1\)/);
});

test('desktop smoke isolates production runs', () => {
  const source = readFileSync('scripts/validation/playwright_electron_smoke.ts', 'utf-8');

  assert.match(source, /desktop-smoke-production\.lock/);
  assert.match(source, /deckrogue-electron-smoke-user-data-\$\{runId\}/);
  assert.match(source, /desktop_\$\{runId\}_launcher\.png/);
});

test('real UI round stress treats missing or invalid scenario reports as failures', () => {
  const source = readFileSync('scripts/validation/playwright_real_ui_30_rounds.ts', 'utf-8');

  assert.match(source, /if\s*\(!reportData\.reportGenerated\)/);
  assert.match(source, /reportSummary\?\.\s*parseError/);
  assert.match(source, /Scenario report was not generated/);
  assert.match(source, /Scenario report could not be parsed/);
});

test('script debt repair keeps route and Python runtime checks gated', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
  const reviewCi = readFileSync('scripts/validation/review_ci.ts', 'utf-8');

  assert.equal(pkg.scripts['test:python-runtime'], 'tsx scripts/validation/run_python_runtime_tests.ts');
  assert.equal(pkg.scripts['check:event-tradeoff-route-state'], 'tsx scripts/validation/check_event_tradeoff_route_state.ts');
  assert.equal(pkg.scripts['check:midgame-route-sustain'], 'tsx scripts/validation/check_midgame_route_sustain.ts');

  assert.match(reviewCi, /test:python-runtime/);
  assert.match(reviewCi, /check:event-tradeoff-route-state/);
  assert.match(reviewCi, /check:midgame-route-sustain/);
});

test('obsolete one-off script generators remain removed', () => {
  for (const file of [
    'scripts/add_character_expansion_cards.py',
    'scripts/add_character_expansion_events.py',
    'scripts/add_character_expansion_relics.py',
    'scripts/add_meta_achievements.py',
    'scripts/analysis/balanceLayerAnalysis.ts',
    'scripts/analysis/find_missing_artwork.ts',
    'scripts/assets/generate_asset_polish_targets.py',
  ]) {
    assert.equal(existsSync(file), false, `${file} should stay removed unless it is reintroduced with an npm/docs owner`);
  }
});
