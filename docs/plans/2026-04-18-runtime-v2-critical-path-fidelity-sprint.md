# Runtime-V2 Critical Path Fidelity Sprint Plan

## Status

- Created: 2026-04-18
- Source: GPT Pro planning handoff `gptpro_deckrogue_next_dev_optimization_plan_20260418_step105`
- Execution target: full repository at `/Users/zhuhangcheng/Downloads/好玩/deckrogue`
- Current state: completed in Step 108/109; see `docs/development-reports/project-development-report.md` for verification evidence and Ralph architect approval

## Executive Decision

The next sprint should focus on runtime-v2 player-critical-path fidelity, with a tightly scoped PIXI proof slice after the read-side and scene fidelity work is in place.

This should come before broad parity expansion. The current runtime-v2 proof gate is already closed for the shared-command scope, while the player-facing runtime-v2 scenes remain thinner than the legacy product experience. Better player comprehension now creates more product value than proving another thin renderer path.

## Non-Goals

- Do not reopen closed runtime-v2 proof gates without a concrete blocker.
- Do not claim full PIXI pointer-level parity.
- Do not expand into combat readability in this sprint unless the first three tasks land early.
- Do not do repo-wide dirty-worktree cleanup as the primary task.
- Do not implement against the curated GPT Pro package. It is context only.

## Sprint Goals

1. Runtime-v2 map/shop/rest/event screens explain player decisions clearly.
2. DOM and PIXI runtime-v2 scenes consume the same read-side decision support data.
3. Existing runtime-v2 entry and flow smokes remain green.
4. PIXI proof boundary is prepared for pointer-level critical-path evidence without expanding the public claim prematurely.
5. Shop card-offer alignment is improved only after the read-side UX contract is stable.

## Task 1: Enrich Runtime-V2 Read-Side Contracts

Problem:
Runtime-v2 room payloads are too thin for high-quality map/shop/rest/event UX.

Implementation direction:
Expand `RenderModel.room` and derived scene props so critical-path screens can consume route summaries, room purpose, action recommendation, disabled reasons, and content-backed labels without view-local guessing.

Likely files:

- `src/runtimeV2/contracts.ts`
- `src/runtimeV2/renderModel.ts`
- `src/runtimeV2/sceneProps.ts`
- `src/runtimeV2/legacyRenderBridge.ts`
- `tests/unit/runtimeV2Host.test.ts`
- `tests/unit/runtimeV2ReactEntry.test.tsx`
- `tests/unit/runtimeV2FlowSmokeRoute.test.ts`

Acceptance criteria:

- Map/shop/rest/event scene props expose decision-support data through runtime-v2 read-side contracts.
- Existing command semantics, persistence schema, and combat resolution are unchanged.
- No scene directly imports legacy engine objects for decision support.

Verification:

```bash
npm run lint --silent
npx tsx --test tests/unit/runtimeV2Host.test.ts tests/unit/runtimeV2ReactEntry.test.tsx tests/unit/runtimeV2FlowSmokeRoute.test.ts
```

Stop conditions:

- Stop if the work requires changing adapter command semantics.
- Stop if the work starts altering save schema or combat resolution.

## Task 2: Lift Runtime-V2 DOM Scenes To Legacy-Quality Decision Support

Problem:
Runtime-v2 DOM scenes are functionally proven but still thin for player decision-making.

Implementation direction:
Port the strongest legacy decision-support patterns into runtime-v2 DOM scenes: route fit, recommended action, reason text, cost/benefit framing, and disabled-reason clarity.

Likely files:

- `src/runtimeV2/scenes/MapScene.tsx`
- `src/runtimeV2/scenes/ShopScene.tsx`
- `src/runtimeV2/scenes/RestScene.tsx`
- `src/runtimeV2/scenes/EventScene.tsx`
- `src/runtimeV2/react/runtimeV2AppShell.tsx`
- `src/ui/views/mapRouteAdvisor.ts`
- `src/ui/views/shopRouteAdvisor.ts`
- `src/ui/views/restRouteAdvisor.ts`

Acceptance criteria:

- Runtime-v2 map/shop/rest/event DOM screens explain why an action or node matters.
- Disabled actions explain why they are unavailable.
- Existing DOM runtime-v2 flow smoke remains green.

Verification:

```bash
npm run test:runtime-v2-entry-smoke
npm run test:runtime-v2-flow-smoke -- --renderer=dom
npm run lint --silent
```

Stop conditions:

- Stop if DOM scene work drifts into combat UI or broad visual redesign.
- Stop if a scene starts duplicating route-state truth already present in renderModel/sceneProps.

## Task 3: Port Critical-Path UX To PIXI Scenes

Problem:
PIXI scenes should show the same decision support as DOM scenes before pointer-proof work has product value.

Implementation direction:
Make PIXI map/shop/rest/event scenes consume the same read-side decision-support data as DOM scenes. Keep proof source label as `bridge-assisted-semantic` until pointer evidence exists.

Likely files:

- `src/runtimeV2/pixi/MapScenePixi.tsx`
- `src/runtimeV2/pixi/ShopScenePixi.tsx`
- `src/runtimeV2/pixi/RestScenePixi.tsx`
- `src/runtimeV2/pixi/EventScenePixi.tsx`
- `src/runtimeV2/pixi/SurfaceScenePixi.tsx`
- `src/runtimeV2/pixi/index.ts`

Acceptance criteria:

- PIXI critical-path screens present equivalent route/action guidance to DOM.
- `report_pixi.json` remains green and still honestly reports `bridge-assisted-semantic`.

Verification:

```bash
npm run test:runtime-v2-entry-smoke -- --renderer=pixi
npm run test:runtime-v2-flow-smoke -- --renderer=pixi
npm run lint --silent
```

Stop conditions:

- Stop if work drifts into full PIXI combat interaction.
- Stop if the report wording starts implying pointer-level parity.

## Task 4: Add PIXI Pointer-Level Critical-Path Proof Slice

Problem:
Current PIXI evidence is green but bridge-assisted. It does not prove real pointer interaction.

Implementation direction:
Expose deterministic test-only hit-target telemetry or clickable bounds for PIXI critical-path scenes, then update Playwright to click real canvas positions for a small action set:

- map enter node
- event choice
- rest action
- shop purchase or remove
- deep surface confirm/cancel

Likely files:

- `src/runtimeV2/pixi/MapScenePixi.tsx`
- `src/runtimeV2/pixi/EventScenePixi.tsx`
- `src/runtimeV2/pixi/RestScenePixi.tsx`
- `src/runtimeV2/pixi/ShopScenePixi.tsx`
- `src/runtimeV2/pixi/SurfaceScenePixi.tsx`
- `scripts/validation/playwright_runtime_v2_flow_smoke.ts`

Acceptance criteria:

- PIXI critical-path proof uses pointer action source for the selected actions.
- Bridge dispatch remains available only as debug fallback.
- Report distinguishes pointer-proven steps from bridge-assisted steps.
- Claim boundary is upgraded only to the exact proven slice, not full PIXI pointer parity.

Verification:

```bash
npm run test:runtime-v2-flow-smoke -- --renderer=pixi
npm run test:runtime-v2-entry-smoke -- --renderer=pixi
npm run lint --silent
```

Stop conditions:

- Stop if pointer proof becomes flaky across repeated runs.
- Stop if test-only telemetry leaks into player-facing UI.

## Task 5: Retune Shop Card-Offer Route Alignment

Problem:
Shop route guidance is green overall, but raw route-aligned card offers remain weaker than the product should accept.

Implementation direction:
Increase route-aligned card offer rate when route confidence is high, while preserving enough variance for discovery and keeping relic/service alignment green.

Likely files:

- `src/content/narrative/numericSystem.ts`
- `src/content/narrative/routeSignals.ts`
- `src/content/narrative/routeState.ts`
- `src/core/events/runGenerator.ts`
- `src/ui/views/shopRouteAdvisor.ts`
- `tests/unit/shopRouteAdvisor.test.ts`

Acceptance criteria:

- Route-aligned card offer rate improves materially from the current baseline.
- Relic/service alignment does not regress.
- Route diversity remains acceptable.

Verification:

```bash
npm run check:shop-event-growth-nodes
npm run check:growth-route-formation
npm run check:route-taxonomy-guardrails
npm run test:supplemental-units
```

Stop conditions:

- Stop if route diversity collapses into deterministic offers.
- Stop if primary, relic, or service alignment regresses.

## Execution Order

1. Task 1: read-side contract.
2. Task 2: DOM scene fidelity.
3. Task 3: PIXI scene fidelity.
4. Task 4: PIXI pointer-proof slice.
5. Task 5: shop alignment retune.

Task 5 can move earlier only if the sprint goal changes from runtime-v2 fidelity to balance/content.

## Required Reporting Discipline

For each implementation batch:

- update `docs/development-reports/project-development-report.md`,
- keep claims bounded,
- write fresh validation evidence,
- regenerate any affected reports,
- if packaging for GPT Pro or code review, refresh package files, manifest, zip, and checksum.

## Default Verification Bundle

Use this bundle after Task 1-4 changes:

```bash
npm run lint --silent
npx tsc --noEmit --pretty false --project tsconfig.json
npm run test:runtime-v2:ts
npm run test:runtime-v2-entry-smoke
npm run test:runtime-v2-flow-smoke -- --renderer=dom
npm run test:runtime-v2-flow-smoke -- --renderer=pixi
```

Use this extra bundle after Task 5:

```bash
npm run check:shop-event-growth-nodes
npm run check:growth-route-formation
npm run check:route-taxonomy-guardrails
npm run test:supplemental-units
```
