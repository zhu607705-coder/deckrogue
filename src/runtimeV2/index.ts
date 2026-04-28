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
  RuleRuntimeAdapter,
  RuleSnapshot,
  SaveGameV2,
} from './contracts';
export { normalizeLegacyGameState } from './normalizeLegacyGameState';
export {
  projectRuleActiveEventForParity,
  readLegacyActiveEventOutcome,
  readRuleActiveEventOutcome,
  type ActiveEventParityProjection,
  type ActiveEventOutcomeProjection,
} from './activeEventOutcome';
export { migrateLegacySaveDataToSaveGameV2 } from './migration';
export { createRenderModel } from './renderModel';
export { createLegacyRenderModel } from './legacyRenderBridge';
export { EngineHost, createEngineHost } from './bridge/engineHost';
export { LegacyOracleAdapter, createLegacyOracleAdapter } from './bridge/legacyOracleAdapter';
export { PythonWasmAdapter, createPythonWasmAdapter } from './bridge/pythonWasmAdapter';
export { buildRuntimeV2ContentBundle } from './content/buildContentBundle';
export { ContentService, getContentService, resetContentService } from './content/contentService';
export type { CardData, CharacterData, EnemyData, RelicData } from './content/contentService';
export {
  runParityScenario,
  runResolvedParityScenario,
  type ParityDiff,
  type ParityScenarioResult,
  type ParityStep,
} from './parity';
export {
  compareMapSnapshots,
  isPerfectParityReport,
  summarizeParityReportEntries,
  type MapSnapshotComparison,
  type ParityReportEntry,
  type ParityReportSummary,
  type RuleCommandSemanticCode,
} from './parityReport';
export {
  appendReplayCommand,
  createReplayLogV1,
  createSaveGameV2,
  replayOnAdapter,
  restoreSnapshotFromSaveGame,
} from './persistence';
