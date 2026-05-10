/**
 * @file index.ts
 * @description 战斗视图组件导出入口
 *
 * 主要职责:
 * - 导出 CombatHUD, WarpEye, Battlefield, ActionHand 组件
 * - 导出 modals 子模块
 */

export { CombatHUD } from '@/ui/views/combat/CombatHUD';
export { WarpEye } from '@/ui/views/combat/WarpEye';
export { Battlefield } from '@/ui/views/combat/Battlefield';
export { ActionHand } from '@/ui/views/combat/ActionHand';
export * from '@/ui/views/combat/modals';
