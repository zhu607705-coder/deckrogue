/**
 * @file index.ts
 * @description React 子模块统一导出入口，汇聚所有 React 层公共 API
 *
 * 主要职责:
 * - 重新导出引擎宿主上下文相关的 Provider 和 Hooks
 * - 重新导出应用壳和应用组件
 * - 重新导出种子管理工具函数
 */
export { resolveAppEntryMode } from './entryMode.ts';
export {
  EngineHostProvider,
  useEngineHost,
  useRenderModel,
  useSnapshot,
  useStatus,
  useDispatch,
} from './engineHostContext';
export type { EngineHostProviderProps } from './engineHostContext';
export { RuntimeV2AppShell } from './runtimeV2AppShell';
export type { RuntimeV2CharacterOption, RuntimeV2AppShellProps } from './runtimeV2AppShell';
export { RuntimeV2App } from './runtimeV2App';
export type { RuntimeV2AppProps } from './runtimeV2App';
export {
  RUNTIME_V2_SEED_STORAGE_KEY,
  coerceRuntimeV2Seed,
  loadRuntimeV2Seed,
  resolveRuntimeV2SeedFromSearch,
  saveRuntimeV2Seed,
} from './launcherSeed';
export type { RenderModelRoomChoice } from '../contracts';
