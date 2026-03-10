# DeckRogue Runtime, Balance, and Content Next Steps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize runtime ownership and state transitions, make simulation/regression trustworthy, then expand profession card pools and rebalance combat/economy on top of the new baseline.

**Architecture:** This plan treats runtime architecture, regression credibility, and content expansion as three separate layers. Runtime ownership and transition control are fixed first, because profession balance and economy tuning are not reliable while `GameSetup` and `GameEngine` still share authority and regression scripts still use biased path selection. Once the runtime and diagnostics are stable, profession-specific card pools and resource mechanics can be expanded against a single numerics baseline.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Playwright, tsx test runner, local JSON content data.

---

### Task 1: Lock current baseline snapshots before further refactors

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/pre_refactor_snapshot.md`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md`

**Step 1: Capture current regression artifacts**

Run:
```bash
cp /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/baseline_audit.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/baseline_audit.pre_runtime_refactor.json
cp /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.pre_runtime_refactor.json
cp /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.pre_runtime_refactor.json
```
Expected: files copied without error.

**Step 2: Write a short baseline summary**

Record:
- current profession survival spread
- current shop affordability
- current UI smoke status
- current bundle state

**Step 3: Append the snapshot note to progress log**

Add one dated line to `/Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md`.

**Step 4: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/*.pre_runtime_refactor.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/pre_refactor_snapshot.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md
git commit -m "docs: snapshot regression baseline before runtime refactor"
```

### Task 2: Introduce explicit event contract for runtime lifecycle

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/eventContract.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts`

**Step 1: Write the failing test**

Add a test asserting that runtime lifecycle event names are imported from one module and that known terminal events are present.

**Step 2: Run test to verify it fails**

Run:
```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts
```
Expected: FAIL because the contract is incomplete or not imported.

**Step 3: Write minimal implementation**

Add a typed constant/export group for:
- `RUN_STARTED`
- `RUN_LOADED`
- `RUN_PAUSED`
- `RUN_RESUMED`
- `NODE_ENTERED`
- `NODE_COMPLETED`
- `COMBAT_WON`
- `PLAYER_DEFEATED`
- `RUN_ENDED`

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/eventContract.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts
git commit -m "refactor: add runtime event contract"
```

### Task 3: Add explicit run state machine module

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/runStateMachine.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runStateMachine.test.ts`

**Step 1: Write the failing test**

Test legal and illegal transitions for:
- `idle -> in_run/character_select`
- `map -> combat`
- `combat -> reward`
- `combat -> game_over`
- illegal `reward -> combat`

**Step 2: Run test to verify it fails**

Run:
```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runStateMachine.test.ts
```
Expected: FAIL because the state machine does not exist or is incomplete.

**Step 3: Write minimal implementation**

Add:
- `AppLifecycleState`
- `RunLifecycleState`
- `RunPhaseState`
- `RunAction`
- `transition(current, action)`

Keep the reducer minimal; no business side effects in this file.

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/runStateMachine.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runStateMachine.test.ts
git commit -m "refactor: add explicit run state machine"
```

### Task 4: Give GameEngine a full disposable subscription lifecycle

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts`

**Step 1: Extend the failing test**

Add assertions that:
- `dispose()` unregisters global event listeners
- disposed engine does not respond to `PlayerDeath`
- active engine still responds before disposal

**Step 2: Run test to verify it fails**

Run:
```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts
```
Expected: FAIL on duplicate handling or listener leakage.

**Step 3: Implement minimal lifecycle control**

Add:
- `globalDisposables`
- `subscribeToGlobalEvent()` helper
- `dispose()`
- guard so post-dispose callbacks no-op

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts
git commit -m "refactor: make game engine subscriptions disposable"
```

### Task 5: Make GameSetup own run creation and disposal cleanly

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/persistence/setup.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts`

**Step 1: Write the failing test**

Assert that:
- `startNewRun()` disposes existing run before replacing it
- `loadRun()` disposes existing run before replacing it
- `clearActiveRun()` clears engine after dispose

**Step 2: Run test to verify it fails**

Run the same lifecycle test command.
Expected: FAIL because disposal order is not enforced.

**Step 3: Implement minimal fix**

Add:
- central `disposeCurrentRun()`
- `disposables[]` for setup-owned listeners
- use `disposeCurrentRun()` in `startNewRun`, `loadRun`, `clearActiveRun`, `shutdown`

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/persistence/setup.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts
git commit -m "refactor: centralize run disposal in setup"
```

### Task 6: Introduce RunSession facade and move ownership out of GameEngine

**Files:**
- Create: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/runSession.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/persistence/setup.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts`

**Step 1: Write the failing test**

Add assertions that `GameSetup` interacts with a session object and that `GameEngine` delegates core lifecycle methods.

**Step 2: Run test to verify it fails**

Expected: FAIL because there is no session layer.

**Step 3: Write minimal implementation**

Create `RunSession` with:
- state reference
- `dispose()`
- `pause()`, `resume()`, `completeNode()`, `loadState()`, `snapshot()` placeholders

Refactor `GameEngine` to hold a `RunSession` and delegate high-level lifecycle calls without changing public API.

**Step 4: Run tests**

Run:
```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runStateMachine.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/runSession.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/persistence/setup.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runStateMachine.test.ts
git commit -m "refactor: add run session ownership layer"
```

### Task 7: Make regression route selection policy-based and reproducible

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts`

**Step 1: Write the failing test**

Assert that analysis output includes:
- `resolvedByPolicy.balanced`
- `resolvedByPolicy.aggressive`
- `resolvedByPolicy.economy`
- non-trivial node mix for `balanced`

**Step 2: Run tests to verify they fail**

Run:
```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts
```
Expected: FAIL because current output is single-policy or over-biased.

**Step 3: Implement minimal policy system**

Add deterministic strategies:
- `balanced`
- `aggressive`
- `economy`

Decision inputs must include HP ratio, current gold, floor, and checkpoint economy pressure.

**Step 4: Re-run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts
git commit -m "test: make balance regression route policies explicit"
```

### Task 8: Expand profession schema for larger card pools and archetype metadata

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/meta.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/numericsDomain.test.ts`

**Step 1: Write the failing validation test**

Assert card definitions can carry:
- `profession`
- `archetype`
- `subArchetype`
- `mechanicTags`

and that starter decks contain at least one main archetype enabler.

**Step 2: Run test to verify it fails**

Expected: FAIL because fields are missing or not enforced.

**Step 3: Implement schema updates**

Update types and content validation only. Do not add the 60 cards yet.

**Step 4: Run tests**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/meta.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/numericsDomain.test.ts
git commit -m "refactor: add profession archetype metadata"
```

### Task 9: Add profession runtime resources for high-complexity classes

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/combat.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/ActionFactory.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/SpecialActions.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/numericsDomain.test.ts`

**Step 1: Write failing tests**

Add tests for:
- `GainTimeLayer / SpendTimeLayer`
- `GainThread / SpendThread`
- `GainConcoction / SpendConcoction`

**Step 2: Run tests to verify they fail**

Expected: FAIL on missing action handlers.

**Step 3: Implement minimal resource action set**

Add only the resource read/write handlers and defaults in player combat state.

**Step 4: Run tests to verify they pass**

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/combat.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/ActionFactory.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/SpecialActions.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/numericsDomain.test.ts
git commit -m "feat: add profession runtime resource actions"
```

### Task 10: Add first batch of new profession cards

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts`

**Step 1: Add only one profession batch**

Start with the thinnest pools first:
- `Informant`
- `Brute`
- `Tactician`

Add `10` cards each using `6 main + 4 secondary` structure.

**Step 2: Update starter decks**

Each starter deck must include:
- base attack/defend cards
- one main-mechanic enabler
- one secondary hook

**Step 3: Run tests**

Run:
```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
```
Expected: FAIL or drift if content is too strong/weak.

**Step 4: Adjust only low-rarity cards**

Use EVU baseline, do not tune rares first.

**Step 5: Re-run tests**

Expected: PASS or improved spread.

**Step 6: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts
git commit -m "feat: expand starter profession card pools"
```

### Task 11: Add second batch of high-complexity profession cards

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/Battlefield.tsx`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts`

**Step 1: Add 10 cards each for**
- `Chronomancer`
- `Puppeteer`
- `Alchemist`

**Step 2: Expose resources in player panel**

Only show resource counters when the profession actually uses them.

**Step 3: Run tests**

```bash
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts
```
Expected: likely FAIL first due to spread.

**Step 4: Tune common and uncommon cards**

Do not patch with class-specific economy bonuses.

**Step 5: Re-run tests**

Expected: spread narrows.

**Step 6: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/Battlefield.tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts
git commit -m "feat: add advanced profession mechanics and cards"
```

### Task 12: Re-tune economy against expanded card pool

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/features/progression/economySystem.ts`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts`

**Step 1: Run the failing economy regression**

```bash
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=12
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
```
Expected: likely drift after card pool expansion.

**Step 2: Adjust reward and price parameters**

Allowed knobs:
- `baseGoldReward`
- `goldPerFloor`
- card/potion shop baseline if audit regresses

Do not add hidden discounts.

**Step 3: Re-run tests**

Expected: PASS on affordability and reward-to-price thresholds.

**Step 4: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/features/progression/economySystem.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts
git commit -m "fix: retune economy for expanded profession pools"
```

### Task 13: Normalize Grimdark theme usage across combat views

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.css`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/Battlefield.tsx`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/CombatHUD.tsx`
- Test: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/playwright_ui_smoke.ts`

**Step 1: Extract duplicated combat panel styles into theme utilities**

Focus on:
- panel frames
- intent labels
- resource chips
- frontline/construct card shells

**Step 2: Run build and smoke**

```bash
npm run build --silent
npm run test:ui-smoke -- --url=http://127.0.0.1:3010
```
Expected: PASS with no new layout issues.

**Step 3: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.css /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/Battlefield.tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/CombatHUD.tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/playwright_ui_smoke.ts
git commit -m "refactor: consolidate grimdark combat theme usage"
```

### Task 14: Final regression sweep and docs update

**Files:**
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/reports/development/development_report_2026-03-06.md`
- Modify: `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/DEVELOPMENT.md`

**Step 1: Run full verification**

```bash
npm run lint --silent
npm run build --silent
npm run check:import-boundaries
npm run check:deprecated-imports
npm run check:readme-consistency
npx tsx --test /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runStateMachine.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/numericsDomain.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts /Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/balanceDetection.test.ts
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=3
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts --runs=12 --floors=5
npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=12
npm run test:ui-smoke -- --url=http://127.0.0.1:3010
```
Expected: all checks green, regression outputs updated.

**Step 2: Update progress and development report**

Document:
- runtime ownership changes
- regression policy changes
- profession expansion status
- economy rebalance status
- UI theme consolidation status

**Step 3: Commit**

```bash
git add /Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/reports/development/development_report_2026-03-06.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/DEVELOPMENT.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/*.json /Users/zhuhangcheng/Downloads/好玩/deckrogue/output/playwright/*.json
git commit -m "docs: record runtime and balance overhaul results"
```
