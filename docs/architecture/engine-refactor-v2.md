# DeckRogue Engine Refactor V2

## Goal
- Establish the first executable foundation for the v2 engine: Python rules-core scaffold, TypeScript runtime bridge, legacy oracle adapter, and stable contracts that future WASM/Pixi work will target.
- Keep the existing `GameEngine` as the source of truth during migration, while preventing new v2 consumers from depending on raw legacy state shapes.

## Implemented Slice
- `src/runtimeV2/contracts.ts`
  - Defines `RuleCommand`, `RuleSnapshot`, `RuleResult`, `RenderModel`, `SaveGameV2`, `ReplayLogV1`, `MigrationReport`, and `AssetManifest`.
- `src/runtimeV2/bridge/engineHost.ts`
  - Introduces the host-facing `EngineHost` façade with `start()`, `dispatch()`, `getSnapshot()`, and `subscribe()`.
- `src/runtimeV2/bridge/legacyOracleAdapter.ts`
  - Wraps the current `GameEngine` behind the new runtime contract.
- `src/runtimeV2/normalizeLegacyGameState.ts`
  - Converts legacy `GameState` into a stable `RuleSnapshot`.
- `python_runtime/src/deckrogue_rules_core/runtime.py`
  - Adds the first Python `RulesCore` scaffold with `boot()`, `dispatch()`, `snapshot()`, and `load()`.

## Runtime Boundary
- TypeScript owns platform bootstrap, host orchestration, and current compatibility.
- Python owns the future authoritative rules-core API shape.
- `RuleSnapshot.compat.legacySaveData` is explicitly temporary and exists only to support oracle round-tripping during migration.
- New v2 code must consume `RuleSnapshot` and `RuleCommand`; it must not reach into `GameEngine.state` directly.

## Immediate Next Steps
1. Replace the Python scaffold map generator with content-bundle-driven generation compiled from existing JSON.
2. Add a real Python-WASM adapter implementation behind `PythonWasmAdapter`.
3. Extend parity coverage from character select/map generation to combat entry, reward flow, and save/load replay.
4. Start separating render-facing `RenderModel` from raw snapshot payloads before Pixi integration.
