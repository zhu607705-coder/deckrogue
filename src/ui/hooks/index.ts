/**
 * @file index.ts
 * @description Hooks 导出入口 - 统一导出所有自定义 React Hooks
 *
 * 主要职责:
 * - 导出意图伪装、卡牌预览、战斗遥测等 Hooks
 * - 导出效果清理类 Hooks 工具
 */

export { useIntentMasquerade } from '@/ui/hooks/useIntentMasquerade';
export { useCardPreview } from '@/ui/hooks/useCardPreview';
export { useCombatTelemetry } from '@/ui/hooks/useCombatTelemetry';
export {
  useEffectCleanup,
  useEventListenerCleanup,
  useIntervalCleanup,
  useTimeoutCleanup,
  useAnimationFrameCleanup,
  useWeakRefCleanup
} from '@/ui/hooks/useEffectCleanup';
