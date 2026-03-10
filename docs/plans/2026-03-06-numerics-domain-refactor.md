# Numerics Domain Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace scattered balance/economy/scaling formulas with a unified numerics domain so combat, economy, relics, potions, and diagnostics share one valuation baseline.

**Architecture:** Introduce a new numerics layer inside `src/core/balance` with baseline constants, formula functions, valuation helpers, and runtime adapters. Existing systems (`balanceSystem`, `economySystem`, diagnostics, and documentation) become thin consumers of the unified numerics domain instead of maintaining parallel formulas.

**Tech Stack:** TypeScript, Vite, React app runtime, existing analysis scripts with `tsx`.

---

### Task 1: Add the numerics domain foundation

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsTypes.ts`
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsBaseline.ts`
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsPolicy.ts`
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsFormulas.ts`
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsValuation.ts`
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/index.ts`

**Step 1: Write the failing import test**

Create a minimal script-level assertion in diagnostics or a local test harness that imports the new numerics exports from `@/core/balance` and fails because they do not exist yet.

**Step 2: Run the import check to verify it fails**

Run: `node -e "import('./src/core/balance/index.ts').then(m => console.log(!!m.createValuationContext)).catch(err => { console.error(err.message); process.exit(1); })"`

Expected: failure due to missing export or unsupported source path resolution before implementation.

**Step 3: Implement the numerics foundation**

Add:
- EVU baseline constants for energy, damage, block, armor, draw, heal, gold, status
- policy helpers for delay discount, variance discount, risk adjustment, diminishing returns
- formula helpers for damage, block, armor, energy, draw, status, Warp Tide, and price derivation
- valuation context helpers for converting gameplay values into EVU
- runtime adapter helpers consumable by `balanceSystem` and `economySystem`

**Step 4: Export the new numerics layer**

Modify `src/core/balance/index.ts` so numerics modules are exported from the balance barrel.

**Step 5: Run a focused import check**

Run: `node --input-type=module -e "import('./dist-check.mjs').catch(()=>process.exit(1))"` or equivalent `tsx`-based import command after implementation.

Expected: import succeeds and new numerics symbols are present.

**Step 6: Commit**

```bash
git add src/core/balance
git commit -m "refactor: add unified numerics domain foundation"
```

### Task 2: Rewire balance and economy systems

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/balanceSystem.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/features/progression/economySystem.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericConstants.ts`

**Step 1: Write a failing regression check**

Use the existing diagnostics scripts to assert that balance and economy expose comparable value/price outputs from a shared baseline. Add one small assertion that currently fails because formulas are divergent.

**Step 2: Run the regression check to verify it fails**

Run: `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=3`

Expected: no unified-baseline metrics exist yet or drift output is missing.

**Step 3: Refactor `balanceSystem`**

Replace direct value math with calls into the numerics valuation/runtime layer:
- resource exchange
- card valuation
- relic valuation
- enemy scaling
- status soft cap

**Step 4: Refactor `economySystem`**

Replace local pricing/reward derivations with numerics-based price and reward formulas while preserving current public API signatures.

**Step 5: Keep backwards-compatible outputs**

Do not change the method names or return shapes of `balanceSystem` and `economySystem`. The refactor must be internal.

**Step 6: Run diagnostics**

Run: `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=3`

Expected: script completes and reports no structural numeric failures.

**Step 7: Commit**

```bash
git add src/core/balance/balanceSystem.ts src/features/progression/economySystem.ts src/core/balance/numericConstants.ts
git commit -m "refactor: rebase balance and economy on numerics domain"
```

### Task 3: Upgrade diagnostics for drift and baseline consistency

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts`
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/.gitkeep`

**Step 1: Write a failing output expectation**

Define expected output artifacts or JSON sections:
- baseline drift
- combat summary
- economy summary
- risk summary

**Step 2: Run diagnostics to verify the sections do not yet exist**

Run the scripts and confirm the new output fields are absent before implementation.

**Step 3: Implement diagnostics extensions**

Add:
- baseline drift checks
- EVU-based economy regression summaries
- risk-reward summaries for Warp and corruption-related systems
- optional JSON artifact output under `output/numerics/`

**Step 4: Run all analysis scripts**

Run:
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=3`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts --runs=3 --floors=3`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=3`

Expected: scripts succeed and emit unified-baseline metrics.

**Step 5: Commit**

```bash
git add scripts/analysis output/numerics
git commit -m "feat: add unified numerics regression diagnostics"
```

### Task 4: Update the development report

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/reports/development/development_report_2026-03-06.md`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/reports/development/README.md`

**Step 1: Rewrite the numerics architecture section**

Describe:
- previous architecture defects
- advantages preserved
- new numerics-domain structure
- concrete outcomes from diagnostics
- remaining limitations and next steps

**Step 2: Reference actual evidence**

Use only real files and command outputs from this implementation.

**Step 3: Run README consistency check**

Run: `npm run check:readme-consistency`

Expected: OK.

**Step 4: Commit**

```bash
git add docs/reports/development
git commit -m "docs: update development report for numerics architecture refactor"
```

### Task 5: Full verification

**Files:**
- No direct file edits unless verification reveals a defect.

**Step 1: Run quality gates**

Run:
- `npm run lint`
- `npm run build`
- `npm run check:import-boundaries`
- `npm run check:deprecated-imports`
- `npm run check:readme-consistency`

Expected: all pass.

**Step 2: Run core numerics diagnostics**

Run:
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=3`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts --runs=3 --floors=3`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=3`

Expected: all complete without runtime errors.

**Step 3: Summarize evidence**

Capture:
- which files changed
- what numerics baseline was introduced
- what diagnostics now measure
- what remains to be refactored in relic/synergy/runtime systems

**Step 4: Commit final verification adjustments if needed**

```bash
git add -A
git commit -m "chore: finalize numerics domain verification"
```
