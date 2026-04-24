/**
 * @file index.ts
 * @description combat 子模块的统一导出入口
 *
 * 主要职责:
 * - 汇总并导出所有战斗相关功能 (combatSystem, targetingService, runCardInstance, CardManipulation)
 */
export * from '@/core/combat/combatSystem';
export { TargetingService, targetingService } from '@/core/combat/targetingService';

export * from '@/core/combat/runCardInstance';

export * from '@/core/combat/CardManipulation';
