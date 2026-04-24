/**
 * @file index.ts
 * @description DOM 场景组件统一导出入口，汇聚所有场景组件
 *
 * 主要职责:
 * - 重新导出所有 DOM 场景组件（Map、Combat、Reward、Rest、Event、Shop、Surface）
 * - 为外部消费者提供单一导入来源
 */
export { MapScene, type MapSceneComponentProps } from './MapScene';
export { CombatScene, type CombatSceneComponentProps } from './CombatScene';
export { RewardScene, type RewardSceneComponentProps } from './RewardScene';
export { RestScene, type RestSceneComponentProps } from './RestScene';
export { EventScene, type EventSceneComponentProps } from './EventScene';
export { ShopScene, type ShopSceneComponentProps } from './ShopScene';
export { SurfaceScene, type SurfaceSceneProps } from './SurfaceScene';
