# Engine Refactor V2 Acceptance Baseline

> **产品入口声明**: 
> - 原 UI (`src/App.tsx`) 是**唯一正式产品入口**
> - 当前仓库不发布 Runtime V2 独立 URL 入口
> - 重新引入独立入口时，必须同时提交真实入口文件、npm smoke 脚本、报告证据和本契约更新

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
- The default app entry mode is the legacy/original UI. Runtime V2 is currently consumed through contracts, adapters, parity helpers, and legacy-shell projection tests rather than a standalone React route.
- Runtime V2 loop coverage currently lives in adapter and parity tests:
  - boot/select-character/map parity
  - event/rest/shop/reward room projection
  - Python runtime source sync and Python host tests
- `RenderModel` and `sceneProps` are the only supported read-side contracts for new v2 UI work.
- Legacy DOM views consume Runtime V2 `RenderModel` summaries incrementally for:
  - map progression
  - shop stock and affordability summaries
  - rest and reward room gates
- Python parity acceptance is covered by the Runtime V2 TypeScript suite and Python runtime checks:
  - `map_full_bridge`
  - `map_native_metadata`
  - `map_native_topology`
  - `combat_reward_stable`
  - all must be green across the acceptance seed set

## Fresh Phase A / B Verification Commands
- `npm run test:runtime-v2:ts`
- `npm run check:python-wasm-runtime-sync`
- `npm run test:python-runtime`
- `npm run lint --silent`
- `npm run build --silent`
- `npm run test:ui-smoke`

## Acceptance Criteria
- The six core verification commands above pass fresh on the branch.
- Default app startup enters the legacy/original UI without requiring runtime-v2 query parameters.
- `PythonWasmAdapter` is part of the accepted baseline and remains covered by local Pyodide asset and runtime sync tests.
- `acceptance-v2.md` and repo truth stay aligned; missing file/script references are not allowed.
