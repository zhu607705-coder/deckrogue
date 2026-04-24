/**
 * @file index.ts
 * @description PixiJS 渲染层统一导出入口，汇聚所有场景组件和工具函数
 *
 * 主要职责:
 * - 重新导出所有 Pixi 场景组件（Map、Combat、Reward、Rest、Event、Shop、Surface）
 * - 重新导出工具函数（COLORS、createTextStyle、drawRoundedRect、drawCircle）
 * - 为外部消费者提供单一导入来源
 */
export { COLORS, createTextStyle, drawRoundedRect, drawCircle } from './pixiUtils';
export { MapScenePixi } from './MapScenePixi';
export type { MapScenePixiProps } from './MapScenePixi';
export { CombatScenePixi } from './CombatScenePixi';
export type { CombatScenePixiProps } from './CombatScenePixi';
export { RewardScenePixi } from './RewardScenePixi';
export type { RewardScenePixiProps } from './RewardScenePixi';
export { RestScenePixi } from './RestScenePixi';
export type { RestScenePixiProps } from './RestScenePixi';
export { EventScenePixi } from './EventScenePixi';
export type { EventScenePixiProps } from './EventScenePixi';
export { ShopScenePixi } from './ShopScenePixi';
export type { ShopScenePixiProps } from './ShopScenePixi';
export { SurfaceScenePixi } from './SurfaceScenePixi';
export type { SurfaceScenePixiProps } from './SurfaceScenePixi';
