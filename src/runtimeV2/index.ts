/**
 * @file index.ts
 * @description RuntimeV2 模块统一导出入口，汇聚所有公共 API 和类型
 *
 * 主要职责:
 * - 重新导出 contracts 中的核心类型与接口
 * - 重新导出各子模块的工厂函数和工具
 * - 为外部消费者提供单一导入来源
 */
export type {
  AssetManifest,
  AssetManifestEntry,
  ContentBundle,
  EngineHostStartOptions,
  MigrationReport,
  RenderModel,
  RenderModelRoomChoice,
  ReplayLogV1,
  RuleCommand,
  RuleDiff,
  RuleEvent,
  RuleResult,
  RuleResultError,
  RuleRuntimeAdapter,
  RuleSnapshot,
  SaveGameV2,
} from '@/runtimeV2/contracts';
export { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
export {
  projectRuleActiveEventForParity,
  readLegacyActiveEventOutcome,
  readRuleActiveEventOutcome,
  type ActiveEventParityProjection,
  type ActiveEventOutcomeProjection,
} from '@/runtimeV2/activeEventOutcome';
export { migrateLegacySaveDataToSaveGameV2 } from '@/runtimeV2/migration';
export { createRenderModel } from '@/runtimeV2/renderModel';
export { createLegacyRenderModel } from '@/runtimeV2/legacyRenderBridge';
export { DispatchFailedError, EngineHost, createEngineHost, type EngineHostDispatchOptions } from '@/runtimeV2/bridge/engineHost';
export { LegacyOracleAdapter, createLegacyOracleAdapter } from '@/runtimeV2/bridge/legacyOracleAdapter';
export { PythonWasmAdapter, createPythonWasmAdapter } from '@/runtimeV2/bridge/pythonWasmAdapter';
export { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';
export { ContentService, getContentService, resetContentService } from '@/runtimeV2/content/contentService';
export type { CardData, CharacterData, EnemyData, RelicData } from '@/runtimeV2/content/contentService';
export {
  runParityScenario,
  runResolvedParityScenario,
  type ParityDiff,
  type ParityScenarioResult,
  type ParityStep,
} from '@/runtimeV2/parity';
export {
  compareMapSnapshots,
  isPerfectParityReport,
  summarizeParityReportEntries,
  type MapSnapshotComparison,
  type ParityReportEntry,
  type ParityReportSummary,
  type RuleCommandSemanticCode,
} from '@/runtimeV2/parityReport';
export {
  appendReplayCommand,
  createReplayLogV1,
  createSaveGameV2,
  replayOnAdapter,
  restoreSnapshotFromSaveGame,
} from '@/runtimeV2/persistence';
