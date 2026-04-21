import type { IntentCooldownState } from './intentSelector';

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
