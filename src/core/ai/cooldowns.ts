/**
 * @file cooldowns.ts
 * @description 意图冷却系统 - 管理 AI 意图的冷却计时器
 *
 * 主要职责:
 * - 实现 cooldownsReducer，递减所有意图的冷却计数
 * - 记录已使用的意图并设置冷却计时
 * - 防止 AI 连续使用相同意图
 */
import type { IntentCooldownState } from '@/core/ai/intentSelector';

export function cooldownsReducer(current: IntentCooldownState, usedIntent: string): IntentCooldownState {
  const next: IntentCooldownState = {};
  for (const [intent, remaining] of Object.entries(current)) {
    const value = Math.max(0, Number(remaining || 0) - 1);
    if (value > 0) next[intent] = value;
  }
  if (usedIntent) {
    next[usedIntent] = Math.max(next[usedIntent] || 0, 1);
  }
  return next;
}
