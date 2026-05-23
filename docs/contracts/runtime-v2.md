# Runtime V2 Contracts

> **重要声明**: Runtime V2 是 DeckRogue 的规则内核实现，但 **不是产品入口**。
> - **正式产品入口**: 原 UI (`src/App.tsx`)，默认启动
> - **Runtime V2 用途**: 规则合约、parity 测试、Python/Pyodide adapter 验证、迁移辅助
> - **当前入口状态**: 仓库当前不发布独立 runtime-v2 URL/React shell；如重新引入，必须同时补回真实入口文件、smoke 脚本和本文件契约。

## Core Commands
- `start_run`
  - Starts or resets a run with an optional seed.
- `select_character`
  - Selects the active character and projects the runtime into map phase.
- `enter_node`
  - Resolves a normalized map node. Combat/elite/boss nodes must transition into a combat snapshot; non-combat nodes may park the runtime in a pending room phase.
- `leave_room`
  - Returns from a non-combat room back to map phase while preserving `currentNodeId` and revealed-path state.
- `complete_combat`
  - Ends the current combat snapshot and projects the runtime into reward phase.
- `take_reward`
  - Claims an offered reward card and returns to map phase.
- `skip_reward`
  - Clears the current reward payload and returns to map phase without changing the deck.
- `load_snapshot`
  - Restores a previously captured `RuleSnapshot`.

## Content Bundle
- `ContentBundle.version`
  - Version tag for the rules-core payload crossing the WASM boundary.
- `ContentBundle.characters`
  - Snake-case normalized player definitions: `id`, `max_hp`, `max_energy`, `starting_gold`, `starting_deck`, optional `extended_pool`, optional `special_resource`.
- `ContentBundle.cards`
  - Minimal reward-pool metadata: `id`, `rarity`, `character`.
- `ContentBundle.enemies`
  - Minimal combat seed data: `id`, `hp_range`, `keywords`, optional `intent_policy`.
- `ContentBundle.map`
  - Runtime generation config: `floors`, `branching`, optional deterministic `node_types` override for tests/benchmarks, optional parity fallback `prebuilt_nodes`, and `encounters.normal|elite|boss`.

## Core Snapshot
- `RuleSnapshot.lifecycle`
  - `screen`, `phase`, `pendingNodeResolution`
- `RuleSnapshot.player`
  - `characterId`, vitals, currencies, deck IDs, relic IDs, potion IDs
- `RuleSnapshot.map`
  - `currentNodeId`, normalized node list
- `RuleSnapshot.combat`
  - Optional combat summary for render/debug consumers
- `RuleSnapshot.reward`
  - Optional reward summary; currently `cardIds` plus `source='combat'`
- `RuleSnapshot.meta`
  - Adapter source, replay length, generated timestamp
- `RuleSnapshot.compat`
  - Transitional compatibility payloads; currently only `legacySaveData`

## Persistence Shapes
- `SaveGameV2`
  - Snapshot + host platform + save timestamp
- `ReplayLogV1`
  - Seed + ordered command list
- `MigrationReport`
  - Source/target schema metadata + warnings

## Persistence Helpers
- `createSaveGameV2(snapshot, hostPlatform, savedAt?)`
  - Wraps a `RuleSnapshot` into the normalized save envelope used by browser/desktop/mobile hosts.
- `restoreSnapshotFromSaveGame(saveGame)`
  - Restores the raw `RuleSnapshot` payload from a `SaveGameV2`.
- `createReplayLogV1(seed, commands)`
  - Creates a deterministic replay artifact from a seed plus ordered command list.
- `replayOnAdapter(adapter, replayLog)`
  - Replays a `ReplayLogV1` against any `RuleRuntimeAdapter` and returns the final snapshot.

## Parity Harness
- `runParityScenario({ legacyAdapter, candidateAdapter, seed, commands })`
  - Replays the same command sequence against two adapters and reports field-level diffs over the current stable parity subset.
- `compareMapSnapshots(legacySnapshot, candidateSnapshot)`
  - Splits exact map parity into node-metadata (`id/type/x/y/revealed`) and topology (`next`) comparisons so migration reports can show whether a map mismatch is structural or connectivity-only.
- `summarizeParityReportEntries(entries)`
  - Collapses repeated parity samples into per-scenario pass/fail totals plus failure seed lists.
- Current stable parity subset:
  - `seed`
  - `lifecycle.screen|phase|pendingNodeResolution`
  - `player.characterId|hp|maxHp|gold|intel|devotion|corruption`
  - `player.deck/relic/potion` counts
  - `map.currentNodeId`
  - `combat` summary counts
  - `reward` summary counts/source
- Current baseline command sequences covered by tests:
  - `select_character`
  - `select_character -> enter_node(Event) -> leave_room`
  - `select_character -> enter_node(Combat) -> complete_combat -> skip_reward`
- Current real-Python parity coverage:
  - `select_character` can already run against the live Python rules-core host with zero diffs on the stable subset.
  - `select_character` also matches legacy map node metadata exactly for the current baseline content bundle.
  - `select_character` now also matches the full legacy map snapshot for both the native Python host path and the bridge-backed parity host, including `next` path connectivity.
  - `enter_node` can already run against the live Python rules-core host through adapter-specific command resolution and achieve zero diffs on the stable subset for the current baseline sequence.
  - The current baseline `enter_node(Combat)` combat snapshot now matches the legacy oracle exactly for `enemyIds`, opening `hand`, `drawPileCount`, player `block/energy`, and enemy `hp/maxHp/block/nextIntent`.
  - `complete_combat -> skip_reward` can now also achieve zero diffs on the stable subset for the current baseline combat sequence.
  - `complete_combat -> take_reward` without an explicit `cardId` now also matches the legacy oracle on the stable subset, including the legacy default of claiming the first offered card.
  - The current baseline `complete_combat` reward offer itself now matches the legacy oracle exactly for the real-Python combat parity sequence.
  - The current baseline `complete_combat -> take_reward` sequence now also matches the legacy oracle for exact deck content after the default reward pickup.
- Current exclusions:
  - Exact deck ordering parity after reward generation
  - Detailed mid-combat state/value parity beyond the current combat-entry snapshot

## Render Projection
- `createRenderModel(snapshot)`
  - Derives a render-facing `RenderModel` from a normalized snapshot so the future Pixi/React shell does not need to read rules payloads directly.
  - Also emits generic room kinds for `Shop`, `Rest`, and `Reward` screens, even when only partial room detail is available from the normalized snapshot.
- `createLegacyRenderModel(engine)`
  - Projects the current compatibility `GameEngine` into the same `RenderModel`, allowing the existing React shell to migrate incrementally without waiting for Python-WASM app runtime integration.
  - Also enriches legacy-only room summaries for `shop`, `rest`, and `reward` screens while the runtime snapshot schema is still being expanded.
- `EngineHost.getRenderModel()`
  - Returns the current derived render model for the active runtime snapshot.
- `EngineHost.subscribeRenderModel(listener)`
  - Emits a fresh `RenderModel` on every host start/dispatch cycle.

## Current Implementation Notes
- The TypeScript oracle path fully supports `select_character` and `load_snapshot`.
- `buildRuntimeV2ContentBundle()` now compiles the current `characters.json` and `enemies.json` into the normalized content payload expected by the Python core.
- `buildRuntimeV2ContentBundle()` also compiles minimal card metadata plus character `extended_pool` so the Python scaffold can reproduce the current reward-draft rules.
- The Python scaffold supports `start_run`, `select_character`, `enter_node`, `leave_room`, `complete_combat`, `take_reward`, `skip_reward`, `snapshot`, and `load`.
- Both TypeScript and Python runtime layers now expose minimal save/replay helpers so Phase 2 can verify deterministic command logs before the WASM bridge is wired.
- A baseline parity harness now exists for Phase 3. It intentionally compares only stable, already-agreed fields until Python map generation and combat semantics are brought into alignment with the legacy oracle.
- The current product shell is the legacy `AppShell` path. Runtime V2 remains available as an imported contract/adapter surface through `src/runtimeV2/index.ts`, not as an advertised URL route.
- Runtime V2 browser and desktop bridge coverage is currently unit/static driven: `npm run test:runtime-v2:ts`, `npm run check:python-wasm-runtime-sync`, and `npm run test:python-runtime`.
- The Python combat baseline now mirrors two legacy random sources: the map generator still uses a separate run-generator RNG, while combat/reward parity uses the same runtime RNG start state as the legacy `GameEngine` (`rngState = 0`).
- `LegacyOracleAdapter.complete_combat` is currently a headless parity/testing bridge that delegates to the legacy engine's internal combat-victory handler; it exists to unblock parity work before the new runtime owns combat resolution end-to-end.
- `PythonProcessAdapter` is a Node-only parity/testing host that drives the live Python rules-core over a JSONL subprocess protocol. It is not the final WASM bridge.
- `PythonProcessAdapter` now defaults to native Python map generation. `map.prebuilt_nodes` remains available as an explicit parity fallback path via `usePrebuiltMapNodes: true`.
- `scripts/analysis/runtime_v2_parity_report.ts` is now the baseline multi-seed Phase 3 report. It writes `output/runtime_v2/parity_report.json`, supports `--require-perfect`, and currently shows, on the fresh 10-seed sample, that `map_full_bridge`, `map_native_metadata`, `map_native_topology`, and `combat_reward_stable` are all green.
- The current Phase 3 acceptance evidence is split across `npm run test:runtime-v2:ts`, `npm run check:python-wasm-runtime-sync`, and `npm run test:python-runtime`. Do not document a separate parity npm script unless it exists in `package.json`.
- `RenderModel` is no longer a placeholder contract only. It now carries derived player/map/combat/reward data such as `deckCount`, `healthRatio`, `revealedNodeIds`, `availableNodeIds`, `enemyCount`, and `offerCount`.
- `AppShell` now uses `RenderModel` for top-level shell concerns (`screen` routing, keyboard context, and background-layer selection) while the concrete legacy page views still receive `engine` props. This is the current Phase 4 bridge state.
- `MapView` is the first non-combat leaf view to consume `RenderModel.map` data (`currentNodeId`, `currentFloor`, `availableNodeIds`) while keeping legacy `engine` methods for interaction. This is the current per-screen migration pattern.
- `RewardView` and `RestView` now also read render-projected summary fields for view gating (`offerCount`, `hp/maxHp`, `healAmount`) while leaving concrete button actions on the compatibility `engine` path.
- `ShopView` now reads render-projected player summary fields (`gold`, `deckCount`, `potionCount`) for affordability and service gating, while pricing and purchase actions still stay on the compatibility `engine` path.
- `ShopView`, `RestView`, and `RewardView` now prefer `renderModel.room` for room-specific gating and stock/offer summaries when that projection is available.
- No independent runtime-v2 React shell is currently present in `src/runtimeV2`. Runtime V2 loop coverage is exercised through adapters, parity utilities, and legacy shell projection tests.
- `createRenderModel()` now preserves `currentNode.next` as a fallback source for `availableNodeIds` when successor reveal flags have not advanced yet; this keeps post-reward map progression playable in the independent shell.
- `PythonWasmAdapter` aligns its loader URL with the installed `pyodide@0.29.3` package, unwraps `{ snapshot, events }` dispatch envelopes correctly, and uses bundled `dist/pyodide` assets under the desktop `deckrogue://app` protocol.
- Runtime V2 contract docs are guarded by `tests/unit/runtimeV2ContractDocs.test.ts`, which rejects missing file or npm-script references in this document and `docs/contracts/acceptance-v2.md`.
- `compat.legacySaveData` is migration-only and must be removed once Python-WASM reaches save/load parity.
