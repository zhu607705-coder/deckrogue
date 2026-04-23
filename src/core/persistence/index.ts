/**
 * @file index.ts
 * @description persistence 子模块的统一导出入口
 *
 * 主要职责:
 * - 汇总并导出所有持久化相关的功能 (setup, metaInjection, saveManager, metaProfileStore, codexStore)
 */
export { gameSetup, createGameSetup, getGameSetup, resetGameSetup } from '@/core/persistence/setup';
export { applyMetaProfileToNewRunState } from '@/core/persistence/metaInjection';
export * from '@/core/persistence/saveManager';
export * from '@/core/persistence/metaProfileStore';
export * from '@/core/persistence/codexStore';
