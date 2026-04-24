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
export type {
  UIModel,
  UICard,
  UIPlayerModel,
  UIMapModel,
  UIRoomModel,
  UICombatModel,
  UIRewardModel,
  UIEventModel,
  UINotification,
  ScreenId,
  RoomKind,
  CardType,
  CardRarity,
} from './uiModel';
export { UIModelConverter, getUIModelConverter, convertToUIModel } from './uiModelConverter';
export { EventBus, getEventBus, resetEventBus } from './eventBus';
export type { EventType, UIEvent, CombatDamageEvent, RewardOfferedEvent, PlayerStatChangedEvent } from './eventBus';
export { UIModelManager, getUIModelManager, resetUIModelManager } from './uiModelManager';
export type { Change, ChangeEvent } from './uiModelManager';
export { deepEqual, generateHash } from './utils';
export { PluginManager, VersionManager, getPluginManager, getVersionManager, resetPluginManager, resetVersionManager } from './pluginSystem';
export type { UIPlugin, UISystem, UIModelVersion } from './pluginSystem';
export { ErrorHandler, getErrorHandler, resetErrorHandler } from './errorHandler';
export type { ValidationResult, ErrorContext } from './errorHandler';
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
export { resolveAppEntryMode } from './react/entryMode';
export {
  EngineHostProvider,
  useEngineHost,
  useRenderModel,
  useSnapshot,
  useStatus,
  useDispatch,
} from './react/engineHostContext';
export type { EngineHostProviderProps } from './react/engineHostContext';
export { RuntimeV2AppShell } from './react/runtimeV2AppShell';
export type { RuntimeV2CharacterOption, RuntimeV2AppShellProps } from './react/runtimeV2AppShell';
export { RuntimeV2App } from './react/runtimeV2App';
export { DEFAULT_RUNTIME_V2_ADAPTER, DEFAULT_RUNTIME_V2_RENDERER } from './react/runtimeV2App';
export type { RuntimeV2AppProps } from './react/runtimeV2App';
export {
  RUNTIME_V2_SEED_STORAGE_KEY,
  coerceRuntimeV2Seed,
  loadRuntimeV2Seed,
  resolveRuntimeV2SeedFromSearch,
  saveRuntimeV2Seed,
} from './react/launcherSeed';
export {
  RUNTIME_V2_SAVE_STORAGE_KEY,
  RUNTIME_V2_REPLAY_STORAGE_KEY,
  loadRuntimeV2SaveGame,
  saveRuntimeV2SaveGame,
  loadRuntimeV2ReplayLog,
  saveRuntimeV2ReplayLog,
} from './react/runtimeV2Storage';
export {
  deriveMapSceneProps,
  deriveCombatSceneProps,
  deriveRewardSceneProps,
  deriveRestSceneProps,
  deriveEventSceneProps,
  deriveShopSceneProps,
  deriveCharacterSelectSceneProps,
  deriveSceneProps,
  type MapSceneProps,
  type CombatSceneProps,
  type RewardSceneProps,
  type RestSceneProps,
  type EventSceneProps,
  type ShopSceneProps,
  type CharacterSelectSceneProps,
  type SceneProps,
} from './sceneProps';
export {
  MapScene,
  CombatScene,
  RewardScene,
  RestScene,
  EventScene,
  ShopScene,
  SurfaceScene,
  type MapSceneComponentProps,
  type CombatSceneComponentProps,
  type RewardSceneComponentProps,
  type RestSceneComponentProps,
  type EventSceneComponentProps,
  type ShopSceneComponentProps,
  type SurfaceSceneProps,
} from './scenes';
export {
  COLORS,
  createTextStyle,
  drawRoundedRect,
  drawCircle,
  MapScenePixi,
  CombatScenePixi,
  RewardScenePixi,
  RestScenePixi,
  EventScenePixi,
  ShopScenePixi,
  type MapScenePixiProps,
  type CombatScenePixiProps,
  type RewardScenePixiProps,
  type RestScenePixiProps,
  type EventScenePixiProps,
  type ShopScenePixiProps,
} from './pixi';
export type { RendererType } from './react/runtimeV2AppShell';
export {
  createLegacyAdapter,
  createRuntimeV2Adapter,
  type EngineMode,
  type UnifiedEngineAdapter,
} from './bridge/unifiedEngineAdapter';
export {
  UnifiedEngineProvider,
  useUnifiedEngine,
  useEngineMode,
  useUnifiedRenderModel,
  useUnifiedSnapshot,
  useUnifiedDispatch,
  useEngineStatus,
} from './react/unifiedEngineContext';
export type { UnifiedEngineProviderProps } from './react/unifiedEngineContext';
