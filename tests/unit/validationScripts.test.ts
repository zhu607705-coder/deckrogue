/**
 * @file validationScripts.test.ts
 * @description Static regressions for validation script project-root handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

test('game doctor prunes old logs before release readiness growth checks', () => {
  const source = readFileSync('scripts/doctor/gameDoctor.ts', 'utf-8');

  assert.match(source, /DEFAULT_LOG_RETENTION_LIMIT\s*=\s*1200/);
  assert.match(source, /function pruneDoctorLogs/);
  assert.match(source, /assertInsideDirectory/);
  assert.match(source, /rmSync\(staleLog\.path,\s*\{\s*force:\s*true\s*\}\)/);
  assert.match(source, /const prunedLogs = pruneDoctorLogs\(\)/);
});

test('game doctor keeps Python WASM runtime sync and package tests gated', () => {
  const source = readFileSync('scripts/doctor/gameDoctor.ts', 'utf-8');
  const releaseReadiness = readFileSync('scripts/validation/check_release_readiness.ts', 'utf-8');
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };

  assert.equal(
    pkg.scripts['check:runtime-v2-adapter-differential-parity'],
    'tsx scripts/validation/check_runtime_v2_adapter_differential_parity.ts',
  );
  assert.match(source, /Runtime V2 Adapter Differential Parity/);
  assert.match(source, /npm run check:runtime-v2-adapter-differential-parity/);
  assert.match(source, /Check Python WASM Runtime Sync/);
  assert.match(source, /npm run check:python-wasm-runtime-sync/);
  assert.match(source, /Python Runtime Unit Tests/);
  assert.match(source, /npm run test:python-runtime/);
  assert.match(releaseReadiness, /Runtime V2 Adapter Differential Parity/);
});

test('real UI round stress treats missing or invalid scenario reports as failures', () => {
  const source = readFileSync('scripts/validation/playwright_real_ui_30_rounds.ts', 'utf-8');

  assert.match(source, /if\s*\(!reportData\.reportGenerated\)/);
  assert.match(source, /reportSummary\?\.\s*parseError/);
  assert.match(source, /Scenario report was not generated/);
  assert.match(source, /Scenario report could not be parsed/);
});

test('enemy AI profile gate rejects numeric authoring values encoded as strings', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-ai-profile-'));
  const enemyDataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(enemyDataDir, { recursive: true });
    writeFileSync(
      join(enemyDataDir, 'enemies.json'),
      JSON.stringify([
        {
          id: 'stringly_ai_profile',
          keywords: [],
          intent_policy: [{ intent: 'attack', weight: 1 }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
          ai_profile: {
            perceptionAccuracy: '0.5',
            personality: {
              aggression: '0.4',
              defensiveness: 0.3,
              unpredictability: 0.2,
              revengefulness: 0.1,
            },
            intentBiases: [{ intent: 'attack', multiplier: '1.1' }],
            antiStall: {
              maxNonAttackTurns: '2',
              forcedAttackMultiplier: '1.5',
              suppressedIntents: [],
            },
          },
        },
      ]),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'check_enemy_ai_profiles.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.notEqual(result.status, 0, `expected stringly numeric profile to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stderr, /must be a finite number/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects card costs encoded as strings', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-authoring-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'string_cost_card',
          name: 'String Cost Card',
          rarity: 'Common',
          cost: '1',
          type: 'Attack',
          targeting: 'Enemy',
          text: 'Deal 4 damage.',
          actions: [{ type: 'DealDamage', amount: 4 }],
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'enemies.json'),
      JSON.stringify([
        {
          id: 'fixture_enemy',
          name: 'Fixture Enemy',
          hp_range: [10, 12],
          intent_policy: [{ intent: 'attack', weight: 1 }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'relics.json'),
      JSON.stringify([
        {
          id: 'fixture_relic',
          name: 'Fixture Relic',
          description: 'Fixture relic.',
        },
      ]),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'check_content_authoring.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.notEqual(result.status, 0, `expected string card cost to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Invalid cost/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects invalid card action schema', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-actions-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'string_action_amount_card',
          name: 'String Action Amount Card',
          rarity: 'Common',
          cost: 1,
          type: 'Attack',
          targeting: 'Enemy',
          text: 'Deal 4 damage.',
          actions: [{ type: 'DealDamage', amount: '4' }],
        },
        {
          id: 'unknown_action_card',
          name: 'Unknown Action Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          text: 'Do a missing action.',
          actions: [{ type: 'MissingActionType', amount: 1 }],
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'enemies.json'),
      JSON.stringify([
        {
          id: 'fixture_enemy',
          name: 'Fixture Enemy',
          hp_range: [10, 12],
          intent_policy: [{ intent: 'attack', weight: 1 }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'relics.json'),
      JSON.stringify([
        {
          id: 'fixture_relic',
          name: 'Fixture Relic',
          description: 'Fixture relic.',
        },
      ]),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'check_content_authoring.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.notEqual(result.status, 0, `expected invalid card actions to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Invalid action numeric field/);
    assert.match(result.stdout, /Unknown card action type/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate parses UTF-8 BOM relic data instead of silently skipping relics', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-relic-bom-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'cards.json'), JSON.stringify([]));
    writeFileSync(join(dataDir, 'enemies.json'), JSON.stringify([]));
    writeFileSync(
      join(dataDir, 'relics.json'),
      `\ufeff${JSON.stringify([
        {
          id: 'bom_relic',
          name: 'BOM Relic',
          description: 'Relic data with a UTF-8 BOM should still be validated.',
        },
      ])}`,
      'utf-8',
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'check_content_authoring.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected BOM relic data to pass, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Relics: 1\/1 valid/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
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

test('route reinforcement and save-load parity checks stay on the release gate path', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
  const doctorSource = readFileSync('scripts/doctor/gameDoctor.ts', 'utf-8');
  const releaseReadiness = readFileSync('scripts/validation/check_release_readiness.ts', 'utf-8');
  const validationReadme = readFileSync('scripts/validation/README.md', 'utf-8');
  const expectedChecks = [
    {
      script: 'check:route-state-save-load-parity',
      command: 'tsx scripts/validation/check_route_state_save_load_parity.ts',
      stage: 'Check Route State Save Load Parity',
    },
    {
      script: 'check:event-choice-reinforcement',
      command: 'tsx scripts/validation/check_event_choice_reinforcement.ts',
      stage: 'Check Event Choice Reinforcement',
    },
    {
      script: 'check:rest-route-reinforcement',
      command: 'tsx scripts/validation/check_rest_route_reinforcement.ts',
      stage: 'Check Rest Route Reinforcement',
    },
    {
      script: 'check:shop-route-reinforcement',
      command: 'tsx scripts/validation/check_shop_route_reinforcement.ts',
      stage: 'Check Shop Route Reinforcement',
    },
  ];

  for (const check of expectedChecks) {
    assert.equal(pkg.scripts[check.script], check.command);
    assert.match(doctorSource, new RegExp(check.stage));
    assert.match(doctorSource, new RegExp(check.script));
    assert.match(releaseReadiness, new RegExp(check.stage));
    assert.match(validationReadme, new RegExp(check.script));
  }
});

test('github transport diagnostics are documented and gated for Windows SSH over 443', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
  const scriptSource = readFileSync('scripts/validation/check_github_transport.ts', 'utf-8');
  const docsSource = readFileSync('docs/environment/github-ssh-over-443.md', 'utf-8');
  const validationReadme = readFileSync('scripts/validation/README.md', 'utf-8');

  assert.equal(pkg.scripts['check:github-transport'], 'tsx scripts/validation/check_github_transport.ts');
  assert.match(scriptSource, /git\s+remote\s+get-url\s+origin/);
  assert.match(scriptSource, /ssh\.github\.com/);
  assert.match(scriptSource, /git@github\.com:zhu607705-coder\/deckrogue\.git/);
  assert.match(docsSource, /ssh-keygen -t ed25519/);
  assert.match(docsSource, /gh ssh-key add/);
  assert.match(docsSource, /HostName ssh\.github\.com/);
  assert.match(docsSource, /Port 443/);
  assert.match(docsSource, /git remote set-url origin git@github\.com:zhu607705-coder\/deckrogue\.git/);
  assert.match(validationReadme, /check:github-transport/);
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
