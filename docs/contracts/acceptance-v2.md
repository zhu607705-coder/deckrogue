# Engine Refactor V2 Acceptance Baseline

> **产品入口声明**: 
> - 原 UI (`src/App.tsx`) 是**唯一正式产品入口**
> - Runtime V2 独立壳 (`?runtimeV2=1`) 仅用于 debug/parity/实验
> - 统一壳 (`?unified=1`) 用于新引擎集成测试

## Current Baseline
- `@/runtimeV2` exports the production v2 contract surface:
  - `RuleCommand`, `RuleSnapshot`, `RuleResult`, `RenderModel`, `SaveGameV2`, `ReplayLogV1`, `MigrationReport`, `AssetManifest`
  - `createEngineHost()`, `createLegacyOracleAdapter()`, `createPythonWasmAdapter()`
  - render/scene helpers, React entry hooks, and Pixi scene exports
- `EngineHost` is the single app-facing runtime façade:
  - starts a runtime adapter
  - dispatches normalized commands
  - emits normalized snapshots
  - exposes `getRenderModel()` and `subscribeRenderModel()`
- `LegacyOracleAdapter` remains available for parity/debug only.
- `PythonWasmAdapter` is implemented and browser-runnable through Pyodide.
- `RuntimeV2App` is a debug/parity entry only:
  - default app entry mode is `legacy` (original UI is the official product entry)
  - explicit runtime-v2 entry via `?runtimeV2=1` for debug/parity testing
  - explicit legacy fallback via `?legacy=1`
- `RuntimeV2App` can independently drive the current core loop:
  - `Launcher -> CharacterSelect -> Map -> Event/Rest/Shop/Combat -> Reward -> Map`
- `RenderModel` and `sceneProps` are the only supported read-side contracts for new v2 UI work.
- DOM and Pixi scene implementations both exist for:
  - `Map`
  - `Combat`
  - `Reward`
  - `Rest`
  - `Event`
  - `Shop`
- Python parity acceptance is now a hard gate:
  - `map_full_bridge`
  - `map_native_metadata`
  - `map_native_topology`
  - `combat_reward_stable`
  - all must be green across the acceptance seed set

## Fresh Phase A / B Verification Commands
- `npm run test:runtime-v2:ts`
- `npm run test:runtime-v2:py`
- `npm run accept:runtime-v2-parity`
- `npm run lint --silent`
- `npm run build --silent`
- `npm run test:ui-smoke`

## Acceptance Criteria
- The five core verification commands above pass fresh on the branch.
- Default app startup enters `legacy` without requiring `?runtimeV2=1`.
- Explicit runtime-v2 entry via `?runtimeV2=1`.
- `PythonWasmAdapter` and Pixi renderer are part of the accepted baseline, not deferred work.
- `acceptance-v2.md` and repo truth stay aligned; outdated “non-goal” language is not allowed.
