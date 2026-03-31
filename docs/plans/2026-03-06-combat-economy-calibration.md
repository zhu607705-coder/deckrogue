# Combat And Economy Calibration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Calibrate early combat balance and economy progression against the unified numerics domain so that profession survival and purchasing power converge into a controlled target band.

**Architecture:** Keep the numerics baseline and formulas intact, then tune only content-level starting strength and runtime reward/price curve parameters. Drive every change with regression outputs from the combat and economy analysis scripts, using tests first to pin the intended range.

**Tech Stack:** TypeScript, Vite, tsx scripts, JSON content data, lightweight unit tests via Node test runner

---

### Task 1: Lock the combat calibration target with failing tests

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts`
- Reference: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json`
- Reference: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`

**Step 1: Write the failing test**

Write tests that assert:
- `informant` must not have zero early survival in the target fixtures
- `brute` and `tactician` must not both sit at perfect early survival in the target fixtures
- profession spread must tighten compared with the current regression baseline

Use a fixture-style helper so the test can consume either saved regression output or directly computed summaries.

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
```

Expected: FAIL because current regression data still shows `informant = 0` and `brute/tactician = 1`.

**Step 3: Write minimal implementation support**

If needed, add a small helper in:

- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts`

to expose stable summary fields needed by the test.

**Step 4: Run test to verify it still reflects the failure clearly**

Run the same test command again.

Expected: FAIL with assertion messages tied to combat targets, not parser errors.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts
git commit -m "test: lock combat calibration targets"
```

### Task 2: Calibrate early combat content

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
- Reference: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts`

**Step 1: Write the failing test**

Add or extend tests to define the intended early combat band:
- `informant.survivalRateFirst3 > 0`
- `brute.survivalRateFirst3 < 1` or at least no longer materially above the band
- no profession should exceed the weakest by more than a defined spread threshold in the small-run regression

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
```

Expected: FAIL.

**Step 3: Write minimal implementation**

Make the smallest content changes necessary:
- improve `informant` early turn conversion or reduce dead-draw frequency
- reduce `brute` early guaranteed pressure
- reduce `tactician` low-floor poison/card-cycle overperformance

Prefer changing:
- starting decks
- starter card cost/value
- early conditional thresholds

Avoid changing late-game rare cards unless strictly necessary.

**Step 4: Run regression**

Run:

```bash
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts --runs=12 --floors=3
```

Expected: updated `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json` with tightened spread.

**Step 5: Run tests**

Run:

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
git commit -m "feat: calibrate early combat balance"
```

### Task 3: Lock the economy calibration target with failing tests

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts`
- Reference: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts`

**Step 1: Write the failing test**

Add tests that require economy regression output to include:
- per-floor average gold gain
- shop affordability summary
- removal affordability summary
- a simple reward-to-price ratio

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
```

Expected: FAIL because current artifact is still too coarse.

**Step 3: Write minimal implementation support**

Extend:

- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts`

to emit the required fields without changing gameplay behavior yet.

**Step 4: Run test again**

Run the same command.

Expected: FAIL on target values, not on missing fields.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts
git commit -m "test: lock economy calibration targets"
```

### Task 4: Calibrate reward and price curves

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/features/progression/economySystem.ts`
- Reference: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsBaseline.ts`

**Step 1: Write the failing test**

Extend economy tests to assert:
- early-floor average gold can realistically fund at least one meaningful shop decision
- removal cost scales but does not outpace early earning completely
- reward-to-price ratio remains within a bounded range

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
```

Expected: FAIL.

**Step 3: Write minimal implementation**

Adjust only runtime curve parameters:
- gold reward growth
- potion/relic chance growth if needed
- card/relic/potion shop multipliers
- removal escalation if affordability is broken

Do not reintroduce hard-coded prices outside the numerics runtime.

**Step 4: Run regression**

Run:

```bash
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=12
```

Expected: updated `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json` with affordability and ratio metrics in range.

**Step 5: Run tests**

Run:

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/features/progression/economySystem.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
git commit -m "feat: calibrate economy progression"
```

### Task 5: Update report and verify the whole calibration pass

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md`

**Step 1: Update report content**

Document:
- original combat imbalance
- original economy gap
- concrete changes made
- new regression results
- remaining limitations

**Step 2: Run verification commands**

Run:

```bash
npm run lint
npm run build
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/numericsDomain.test.ts
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=3
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts --runs=12 --floors=3
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=12
npm run check:import-boundaries
npm run check:deprecated-imports
npm run check:readme-consistency
```

Expected: all checks pass and output artifacts reflect tightened combat and economy bands.

**Step 3: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics
git commit -m "docs: record combat and economy calibration pass"
```

Plan complete and saved to `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-combat-economy-calibration.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
