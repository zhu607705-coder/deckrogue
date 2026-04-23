/**
 * @file index.ts
 * @description core 模块的统一导出入口
 *
 * 主要职责:
 * - 汇总并导出所有核心子模块 (types, actions, balance, combat, events, persistence)
 * - 作为 @/core 的公共 API 边界
 */
export * from '@/core/types';
export * from '@/core/actions';
export * from '@/core/balance';
export * from '@/core/combat';
export * from '@/core/events';
export * from '@/core/persistence';
