/**
 * @file index.ts
 * @description events 子模块的统一导出入口
 *
 * 主要职责:
 * - 汇总并导出所有事件系统功能 (eventBus, gameEngine, EventManager, CombatManager, RunFlowManager 等)
 */
export { globalEventBus, EventBus } from '@/core/events/eventBus';
export type { GameEvent } from '@/core/events/eventBus';
export { GameEngine } from '@/core/events/gameEngine';
export { EventManager } from '@/core/events/EventManager';
export { CombatManager } from '@/core/events/CombatManager';
export { RunFlowManager } from '@/core/events/RunFlowManager';
export { metricsTracker, MetricsTracker } from '@/core/events/metricsTracker';
export * from '@/core/events/bossPhaseSystem';
export * from '@/core/events/runGenerator';
export * from '@/core/events/runSummarySystem';
