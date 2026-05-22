/**
 * @file intentPolicy.ts
 * @description Shared guardrails for enemy intent policy authoring and runtime selection.
 */

export function parseIntentPolicyWeight(value: unknown, enemyId = 'unknown', intent = 'unknown'): number {
  if (value === undefined) {
    return 1;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`intent_policy.weight for ${enemyId}/${intent} must be a finite number`);
  }
  return Math.max(0, value);
}

export function normalizeIntentPolicyIntent(value: unknown): string {
  const intent = typeof value === 'string' ? value.trim() : '';
  return intent || 'Attack';
}

export type IntentPolicyLike = {
  intent?: unknown;
  weight?: unknown;
};

export function resolveIntentPolicyList<T extends IntentPolicyLike>(
  enemyDef: { intent_policy?: T[]; intentPolicy?: T[] },
): T[] {
  if (Array.isArray(enemyDef.intent_policy)) {
    return enemyDef.intent_policy;
  }
  if (Array.isArray(enemyDef.intentPolicy)) {
    return enemyDef.intentPolicy;
  }
  return [];
}
