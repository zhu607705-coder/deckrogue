/**
 * @file validationScripts.test.ts
 * @description Static regressions for validation script project-root handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  const electronMain = readFileSync('electron/main.mjs', 'utf-8');

  assert.match(source, /desktop-smoke-production\.lock/);
  assert.match(source, /readFileSync\(PRODUCTION_LOCK_PATH/);
  assert.match(source, /process\.kill\(stalePid,\s*0\)/);
  assert.match(source, /rmSync\(PRODUCTION_LOCK_PATH,\s*\{\s*force:\s*true\s*\}\)/);
  assert.match(source, /deckrogue-electron-smoke-user-data-\$\{runId\}/);
  assert.match(source, /responsiveChecks:\s*\[\]/);
  assert.match(source, /DESKTOP_RESPONSIVE_VIEWPORTS/);
  assert.match(source, /desktop-min-960x540/);
  assert.match(source, /captureResponsiveChecks\(page,\s*app,\s*report,\s*'launcher'\)/);
  assert.match(source, /captureResponsiveChecks\(page,\s*app,\s*report,\s*'combat'\)/);
  assert.match(source, /report\.responsiveChecks\.every\(\(check\)\s*=>\s*check\.status\s*===\s*'pass'\)/);
  assert.match(source, /desktop_\$\{runId\}_launcher\.png/);
  assert.match(source, /rendererCrashes:\s*\[\]/);
  assert.match(source, /new Function\('electronModules'/);
  assert.doesNotMatch(source, /app\.evaluate\(async \(\{/);
  assert.doesNotMatch(source, /app\.evaluate\(\(\{/);
  assert.match(source, /page\.on\('crash'/);
  assert.match(source, /render-process-gone/);
  assert.match(source, /--no-sandbox/);
  assert.match(source, /disable-gpu/);
  assert.match(source, /disable-gpu-sandbox/);
  assert.match(source, /disable-gpu-compositing/);
  assert.match(electronMain, /app\.disableHardwareAcceleration\(\)/);
  assert.match(electronMain, /disable-gpu/);
  assert.match(electronMain, /disable-gpu-sandbox/);
  assert.match(electronMain, /disable-gpu-compositing/);
  assert.match(electronMain, /DECKROGUE_DESKTOP_MIN_WIDTH/);
  assert.match(electronMain, /DECKROGUE_DESKTOP_MIN_HEIGHT/);
  assert.match(electronMain, /minWidth:\s*Number\.isFinite\(desktopMinWidth\)\s*\?\s*desktopMinWidth\s*:\s*960/);
  assert.match(electronMain, /minHeight:\s*Number\.isFinite\(desktopMinHeight\)\s*\?\s*desktopMinHeight\s*:\s*540/);
});

test('game doctor keeps Windows desktop installer distribution gated after smoke', () => {
  const source = readFileSync('scripts/doctor/gameDoctor.ts', 'utf-8');
  const desktopSmokeIndex = source.indexOf("name: 'Desktop Smoke'");
  const winDistIndex = source.indexOf("name: 'Windows Desktop Distribution'");
  const releaseIndex = source.indexOf("name: 'Check Release Readiness'");

  assert.ok(desktopSmokeIndex >= 0, 'Desktop Smoke stage missing');
  assert.ok(winDistIndex > desktopSmokeIndex, 'Windows distribution must run after Desktop Smoke so it can reuse fresh dist');
  assert.ok(releaseIndex > winDistIndex, 'Release readiness must run after Windows distribution');
  assert.match(source, /npm run dist:win -- --skip-build/);
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

test('game doctor classifies GitHub transport failures as environment issues', () => {
  const source = readFileSync('scripts/doctor/gameDoctor.ts', 'utf-8');

  assert.match(source, /'environment'/);
  assert.match(source, /github transport/);
  assert.match(source, /check_github_transport/);
  assert.doesNotMatch(source, /lower\.includes\('ui'\)/);
  assert.match(source, /\\bui\\b/);
});

test('Python runtime launchers skip unavailable Windows py launcher before falling back to python', () => {
  const runtimeTestSource = readFileSync('scripts/validation/run_python_runtime_tests.ts', 'utf-8');
  const adapterSource = readFileSync('src/runtimeV2/node/pythonProcessAdapter.ts', 'utf-8');

  assert.match(runtimeTestSource, /resolvePythonCommandCandidates/);
  assert.match(runtimeTestSource, /result\.status !== 0/);
  assert.match(runtimeTestSource, /continue/);
  assert.doesNotMatch(runtimeTestSource, /process\.exit\(result\.status \?\? 1\);/);

  assert.match(adapterSource, /resolveAvailablePythonCommand/);
  assert.doesNotMatch(adapterSource, /return \{ command: 'py', argsPrefix: \['-3'\] \};/);
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

test('enemy AI profile gate rejects intent policy weights encoded as strings', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-ai-profile-policy-weight-'));
  const enemyDataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(enemyDataDir, { recursive: true });
    writeFileSync(
      join(enemyDataDir, 'enemies.json'),
      JSON.stringify([
        {
          id: 'stringly_policy_weight_enemy',
          keywords: [],
          intent_policy: [{ intent: 'attack', weight: '1' }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
          ai_profile: {
            perceptionAccuracy: 0.5,
            personality: {
              aggression: 0.4,
              defensiveness: 0.3,
              unpredictability: 0.2,
              revengefulness: 0.1,
            },
            intentBiases: [{ intent: 'attack', multiplier: 1.1 }],
            antiStall: {
              maxNonAttackTurns: 2,
              forcedAttackMultiplier: 1.5,
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

    assert.notEqual(result.status, 0, `expected stringly intent policy weight to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stderr, /intent_policy\.attack\.weight must be a finite number/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('enemy AI profile gate rejects intent bias bands that runtime perception cannot produce', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-ai-profile-band-'));
  const enemyDataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(enemyDataDir, { recursive: true });
    writeFileSync(
      join(enemyDataDir, 'enemies.json'),
      JSON.stringify([
        {
          id: 'invalid_band_ai_profile',
          keywords: [],
          intent_policy: [{ intent: 'attack', weight: 1 }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
          ai_profile: {
            perceptionAccuracy: 0.5,
            personality: {
              aggression: 0.4,
              defensiveness: 0.3,
              unpredictability: 0.2,
              revengefulness: 0.1,
            },
            intentBiases: [{ intent: 'attack', playerHpBand: 'healthy', multiplier: 1.1 }],
            antiStall: {
              maxNonAttackTurns: 2,
              forcedAttackMultiplier: 1.5,
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

    assert.notEqual(result.status, 0, `expected impossible intent bias band to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stderr, /playerHpBand.*safe, pressured, kill_range/);
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
          tags: [],
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
          keywords: [],
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
          tags: [],
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
          tags: [],
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
          keywords: [],
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

test('content authoring gate rejects non-attack cards without targeting', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-targeting-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'missing_skill_targeting',
          name: 'Missing Skill Targeting',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          tags: [],
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
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
          keywords: [],
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

    assert.notEqual(result.status, 0, `expected missing non-attack targeting to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Missing targeting/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects cards missing runtime tags array', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-card-tags-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'missing_tags_card',
          name: 'Missing Tags Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
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
          keywords: [],
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
          trigger: 'StartCombat',
          effect: { type: 'GainBlock', amount: 1 },
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

    assert.notEqual(result.status, 0, `expected missing card tags to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Missing or invalid tags/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects enemies missing runtime keywords array', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-enemy-keywords-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'fixture_card',
          name: 'Fixture Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          tags: [],
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'enemies.json'),
      JSON.stringify([
        {
          id: 'missing_keywords_enemy',
          name: 'Missing Keywords Enemy',
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
          trigger: 'StartCombat',
          effect: { type: 'GainBlock', amount: 1 },
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

    assert.notEqual(result.status, 0, `expected missing enemy keywords to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Missing or invalid keywords/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects relics missing runtime trigger and effect contracts', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-relic-contract-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'fixture_card',
          name: 'Fixture Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          tags: [],
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
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
          keywords: [],
          intent_policy: [{ intent: 'attack', weight: 1 }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'relics.json'),
      JSON.stringify([
        {
          id: 'runtime_incomplete_relic',
          name: 'Runtime Incomplete Relic',
          description: 'Missing trigger and effect contract.',
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

    assert.notEqual(result.status, 0, `expected incomplete relic runtime contract to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Missing relic trigger/);
    assert.match(result.stdout, /Missing relic effect contract/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects invalid relic optional runtime fields', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-relic-optional-fields-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'fixture_card',
          name: 'Fixture Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          tags: [],
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
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
          keywords: [],
          intent_policy: [{ intent: 'attack', weight: 1 }],
          moves: { attack: [{ type: 'DealDamage', amount: 4 }] },
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'relics.json'),
      JSON.stringify([
        {
          id: 'invalid_optional_relic',
          name: 'Invalid Optional Relic',
          description: 'Has invalid optional runtime fields.',
          price: '99',
          tags: ['valid', 42],
          priority: '10',
          trigger: 'StartCombat',
          effect: { type: 'GainBlock', amount: 1 },
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

    assert.notEqual(result.status, 0, `expected invalid relic optional fields to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Invalid relic price/);
    assert.match(result.stdout, /Invalid relic tags/);
    assert.match(result.stdout, /Invalid relic priority/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate rejects potions missing runtime price and effect contracts', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-potion-contract-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'fixture_card',
          name: 'Fixture Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          tags: [],
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
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
          keywords: [],
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
          trigger: 'StartCombat',
          effect: { type: 'GainBlock', amount: 1 },
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'potions.json'),
      JSON.stringify([
        {
          id: 'runtime_incomplete_potion',
          name: 'Runtime Incomplete Potion',
          description: 'Missing price and effect.',
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

    assert.notEqual(result.status, 0, `expected incomplete potion runtime contract to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /Missing or invalid potion price/);
    assert.match(result.stdout, /Missing potion effect contract/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('content authoring gate reports malformed potion strings instead of crashing', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-content-potion-string-contract-'));
  const dataDir = join(fixtureRoot, 'src', 'content', 'data');

  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'cards.json'),
      JSON.stringify([
        {
          id: 'fixture_card',
          name: 'Fixture Card',
          rarity: 'Common',
          cost: 1,
          type: 'Skill',
          targeting: 'Self',
          tags: [],
          text: 'Gain 4 block.',
          actions: [{ type: 'GainBlock', amount: 4 }],
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
          keywords: [],
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
          trigger: 'StartCombat',
          effect: { type: 'GainBlock', amount: 1 },
        },
      ]),
    );
    writeFileSync(
      join(dataDir, 'potions.json'),
      JSON.stringify([
        {
          id: 42,
          name: { text: 'Broken Potion' },
          description: ['not a string'],
          price: 25,
          effect: { type: 'Heal', amount: 4 },
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

    assert.notEqual(result.status, 0, `expected malformed potion strings to fail, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Missing potion ID/);
    assert.match(result.stdout, /Missing potion name/);
    assert.match(result.stdout, /Missing potion description/);
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
          trigger: 'StartCombat',
          effect: { type: 'GainBlock', amount: 1 },
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
  const doctorSource = readFileSync('scripts/doctor/gameDoctor.ts', 'utf-8');
  const releaseReadiness = readFileSync('scripts/validation/check_release_readiness.ts', 'utf-8');

  assert.equal(pkg.scripts['check:github-transport'], 'tsx scripts/validation/check_github_transport.ts');
  assert.match(scriptSource, /git\s+remote\s+get-url\s+origin/);
  assert.match(scriptSource, /DECKROGUE_GIT_COMMAND/);
  assert.match(scriptSource, /DECKROGUE_SSH_COMMAND/);
  assert.match(scriptSource, /ssh\.github\.com/);
  assert.match(scriptSource, /git@github\.com:zhu607705-coder\/deckrogue\.git/);
  assert.match(doctorSource, /Check GitHub Transport/);
  assert.match(doctorSource, /check:github-transport/);
  assert.match(releaseReadiness, /github_transport/);
  assert.match(releaseReadiness, /check:github-transport/);
  assert.match(docsSource, /ssh-keygen -t ed25519/);
  assert.match(docsSource, /gh ssh-key add/);
  assert.match(docsSource, /HostName ssh\.github\.com/);
  assert.match(docsSource, /Port 443/);
  assert.match(docsSource, /git remote set-url origin git@github\.com:zhu607705-coder\/deckrogue\.git/);
  assert.match(validationReadme, /check:github-transport/);
});

test('github transport diagnostics resolve tilde identities against the active OpenSSH profile', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-github-transport-home-'));
  const binDir = join(fixtureRoot, 'bin');
  const sshHome = join(fixtureRoot, 'openssh-home');
  const sshDir = join(sshHome, '.ssh');

  try {
    mkdirSync(binDir, { recursive: true });
    mkdirSync(sshDir, { recursive: true });
    mkdirSync(join(fixtureRoot, 'docs', 'environment'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'docs', 'environment', 'github-ssh-over-443.md'), 'setup guide');
    writeFileSync(join(sshDir, 'id_ed25519_github'), 'private-key');
    writeFileSync(
      join(binDir, 'git.cmd'),
      [
        '@echo off',
        'if "%1"=="remote" if "%2"=="get-url" if "%3"=="origin" (',
        '  echo git@github.com:zhu607705-coder/deckrogue.git',
        '  exit /b 0',
        ')',
        'exit /b 1',
      ].join('\r\n'),
    );
    writeFileSync(
      join(binDir, 'ssh.cmd'),
      [
        '@echo off',
        'echo host github.com',
        'echo user git',
        'echo hostname ssh.github.com',
        'echo port 443',
        'echo identityfile ~/.ssh/id_ed25519_github',
        `echo userknownhostsfile ${sshHome.replace(/\\/g, '/')}/.ssh/known_hosts ${sshHome.replace(/\\/g, '/')}/.ssh/known_hosts2`,
        'exit /b 0',
      ].join('\r\n'),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'check_github_transport.ts'),
      ],
      {
        cwd: fixtureRoot,
        env: {
          ...process.env,
          DECKROGUE_GIT_COMMAND: join(binDir, 'git.cmd'),
          DECKROGUE_SSH_COMMAND: join(binDir, 'ssh.cmd'),
        },
        encoding: 'utf-8',
      },
    );

    assert.equal(result.status, 0, `expected github transport check to pass, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /found SSH identity file/);
    assert.match(result.stdout, /openssh-home/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('security report reads camelCase vulnerability baseline counters', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-security-baseline-'));
  const vulnerabilityDir = join(fixtureRoot, 'reports', 'vulnerability');

  try {
    mkdirSync(vulnerabilityDir, { recursive: true });
    writeFileSync(
      join(vulnerabilityDir, 'vulnerability-scan.json'),
      JSON.stringify({
        timestamp: '2026-05-24T00:00:00.000Z',
        summary: {
          total: 80,
          critical: 0,
          high: 0,
          medium: 78,
          low: 2,
          byCategory: {},
          bySubCategory: {
            'array-bounds-risk': 78,
            'unexpected-debug-code': 2,
          },
        },
        baseline: {
          unprotectedJsonParse: 0,
          arrayBoundsRisk: 78,
          nullableAccessRisk: 0,
          unexpectedDebugCode: 2,
        },
        vulnerabilities: [],
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'security_report.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected security report to run, stdout=${result.stdout}, stderr=${result.stderr}`);
    assert.match(result.stdout, /优先处理核心模块的数组越界问题/);
    const report = JSON.parse(readFileSync(join(fixtureRoot, 'reports', 'security', 'security-report.json'), 'utf-8')) as {
      analysis: { recommendations: string[] };
    };
    assert.ok(report.analysis.recommendations.includes('优先处理核心模块的数组越界问题'));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('report bundle surfaces release readiness failed checks', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-report-bundle-release-fail-'));
  const releaseDir = join(fixtureRoot, 'reports', 'release');
  const doctorDir = join(fixtureRoot, 'reports', 'doctor');

  try {
    mkdirSync(releaseDir, { recursive: true });
    mkdirSync(doctorDir, { recursive: true });
    writeFileSync(join(doctorDir, 'report.md'), '# Doctor report');
    writeFileSync(
      join(releaseDir, 'release-readiness.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        checks: [
          {
            id: 'desktop_build_report',
            status: 'fail',
            evidence: 'desktop build report is stale for current workspace state; run build:desktop again',
          },
          {
            id: 'version_consistency',
            status: 'pass',
            evidence: 'package.json=0.0.0, VERSION=0.0.0',
          },
        ],
        summary: {
          total: 2,
          passed: 1,
          warned: 0,
          failed: 1,
          overallStatus: 'fail',
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'generate_report_bundle.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected report bundle to run, stdout=${result.stdout}, stderr=${result.stderr}`);

    const bundle = readFileSync(join(fixtureRoot, 'docs', 'reports', 'report_bundle.md'), 'utf-8');
    assert.match(bundle, /失败项/);
    assert.match(bundle, /desktop_build_report/);
    assert.match(bundle, /desktop build report is stale/);
    assert.match(bundle, /`reports\/doctor\/\*\.md`：`1` 份/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('report bundle reports destructive suite failed cases instead of counting every case as pass', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-report-bundle-destructive-fail-'));
  const systemDir = join(fixtureRoot, 'reports', 'system');

  try {
    mkdirSync(systemDir, { recursive: true });
    writeFileSync(
      join(systemDir, 'destructive-suite.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        cases: [
          { name: 'factory reset preserves unrelated keys', status: 'pass' },
          { name: 'corrupt save is quarantined', status: 'fail' },
        ],
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'generate_report_bundle.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected report bundle to run, stdout=${result.stdout}, stderr=${result.stderr}`);

    const bundle = readFileSync(join(fixtureRoot, 'docs', 'reports', 'report_bundle.md'), 'utf-8');
    assert.match(bundle, /\| destructive suite \| `reports\/system\/destructive-suite\.json` \| 1\/2 pass \|/);
    assert.doesNotMatch(bundle, /destructive suite \| `2\/2 pass`/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('report bundle reads fallback security report summary schema', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-report-bundle-security-summary-'));
  const securityDir = join(fixtureRoot, 'reports', 'security');

  try {
    mkdirSync(securityDir, { recursive: true });
    writeFileSync(
      join(securityDir, 'security-report.json'),
      JSON.stringify({
        generatedAt: '2026-05-25T00:00:00.000Z',
        summary: {
          total: 12,
          critical: 0,
          high: 1,
          medium: 8,
          low: 3,
        },
        analysis: {
          overallStatus: 'needs-attention',
          riskLevel: 'high',
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'generate_report_bundle.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected report bundle to run, stdout=${result.stdout}, stderr=${result.stderr}`);

    const bundle = readFileSync(join(fixtureRoot, 'docs', 'reports', 'report_bundle.md'), 'utf-8');
    assert.match(bundle, /security report：`12` 个问题，`critical = 0`，`high = 1`/);
    assert.match(bundle, /\| security report \| `reports\/security\/security-report\.json` \| 12 issues, critical=0, high=1 \|/);
    assert.doesNotMatch(bundle, /security report：`null` 个问题/);
    assert.doesNotMatch(bundle, /security report \| `reports\/security\/security-report\.json` \| 无高危/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('report bundle surfaces Windows distribution artifact size and hash evidence', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-report-bundle-win-dist-'));
  const desktopDir = join(fixtureRoot, 'reports', 'desktop');
  const releaseDir = join(fixtureRoot, 'release', 'win');
  const exePath = join(releaseDir, 'DeckRogue-0.0.0-x64.exe');
  const artifactHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  try {
    mkdirSync(desktopDir, { recursive: true });
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(exePath, 'installer-v1');
    writeFileSync(
      join(desktopDir, 'win-dist.json'),
      JSON.stringify({
        timestamp: '2026-05-25T00:00:00.000Z',
        overallStatus: 'pass',
        artifacts: [
          {
            path: exePath,
            sizeBytes: 12,
            sha256: artifactHash,
            updatedAt: '2026-05-25T00:00:00.000Z',
          },
        ],
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'generate_report_bundle.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected report bundle to run, stdout=${result.stdout}, stderr=${result.stderr}`);

    const bundle = readFileSync(join(fixtureRoot, 'docs', 'reports', 'report_bundle.md'), 'utf-8');
    assert.match(
      bundle,
      /\| windows distribution \| `reports\/desktop\/win-dist\.json` \| pass, exe=12 bytes, sha256=aaaaaaaaaaaa, updatedAt=2026-05-25T00:00:00.000Z \|/,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('report bundle downgrades Windows distribution when installer hash evidence is missing', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-report-bundle-win-dist-missing-hash-'));
  const desktopDir = join(fixtureRoot, 'reports', 'desktop');
  const releaseDir = join(fixtureRoot, 'release', 'win');
  const exePath = join(releaseDir, 'DeckRogue-0.0.0-x64.exe');

  try {
    mkdirSync(desktopDir, { recursive: true });
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(exePath, 'installer-v1');
    writeFileSync(
      join(desktopDir, 'win-dist.json'),
      JSON.stringify({
        timestamp: '2026-05-25T00:00:00.000Z',
        overallStatus: 'pass',
        artifacts: [
          {
            path: exePath,
            sizeBytes: 12,
            updatedAt: '2026-05-25T00:00:00.000Z',
          },
        ],
      }),
    );

    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'generate_report_bundle.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected report bundle to run, stdout=${result.stdout}, stderr=${result.stderr}`);

    const bundle = readFileSync(join(fixtureRoot, 'docs', 'reports', 'report_bundle.md'), 'utf-8');
    assert.match(
      bundle,
      /\| windows distribution \| `reports\/desktop\/win-dist\.json` \| fail, exe=12 bytes, sha256=missing, updatedAt=2026-05-25T00:00:00.000Z \|/,
    );
    assert.doesNotMatch(bundle, /\| windows distribution \| `reports\/desktop\/win-dist\.json` \| pass, exe=12 bytes, sha256=missing/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('report bundle surfaces responsive readability coverage and issue counts', () => {
  const repoRoot = process.cwd();
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'deckrogue-report-bundle-responsive-'));
  const reportBundleSource = readFileSync(resolve('scripts/validation/generate_report_bundle.ts'), 'utf-8');
  mkdirSync(join(fixtureRoot, 'reports', 'ui'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'docs', 'reports'), { recursive: true });
  writeFileSync(join(fixtureRoot, 'reports', 'ui', 'responsive-readability.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    overallStatus: 'fail',
    surfaceCount: 4,
    viewportCount: 3,
    profileCount: 2,
    audits: [
      { surface: 'launcher', viewport: 'mobile-320x640', profile: 'baseline', screenshot: join(fixtureRoot, 'output', 'launcher.png') },
      { surface: 'combat', viewport: 'mobile-320x640', profile: 'baseline', screenshot: join(fixtureRoot, 'output', 'combat.png') },
    ],
    issues: [
      { kind: 'small-text', surface: 'combat', viewport: 'mobile-320x640', selector: '.immersive-card__text' },
      { kind: 'tap-target-small', surface: 'launcher', viewport: 'tablet-768x1024', selector: 'button' },
    ],
  }));

  try {
    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(repoRoot, 'scripts', 'validation', 'generate_report_bundle.ts'),
      ],
      { cwd: fixtureRoot, encoding: 'utf-8' },
    );

    assert.equal(result.status, 0, `expected report bundle to run, stdout=${result.stdout}, stderr=${result.stderr}`);
    const bundle = readFileSync(join(fixtureRoot, 'docs', 'reports', 'report_bundle.md'), 'utf-8');

    assert.match(reportBundleSource, /responsive-readability\.json/);
    assert.match(bundle, /响应式可读性/);
    assert.match(bundle, /4 surfaces \/ 3 viewports \/ 2 profiles \/ 2 issues/);
    assert.match(bundle, /small-text/);
    assert.match(bundle, /tap-target-small/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
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
