import test from 'node:test';
import assert from 'node:assert/strict';

import { enemiesData } from '@/content/narrative/numericSystem';

function hasIntentPolicy(enemy: (typeof enemiesData)[number]): boolean {
  const policies = enemy.intent_policy || (enemy as any).intentPolicy || [];
  return Array.isArray(policies) && policies.length > 0;
}

test('all enemies with intent policies declare an ai_profile for unified enemy AI rollout', () => {
  const missingProfiles = enemiesData
    .filter((enemy) => hasIntentPolicy(enemy))
    .filter((enemy) => !enemy.ai_profile)
    .map((enemy) => enemy.id);

  assert.deepEqual(missingProfiles, []);
});

test('enemy ai_profile intent biases only reference declared intents', () => {
  const invalidReferences = enemiesData
    .filter((enemy) => hasIntentPolicy(enemy))
    .flatMap((enemy) => {
      const policies = enemy.intent_policy || (enemy as any).intentPolicy || [];
      const knownIntents = new Set(policies.map((policy: { intent: string }) => policy.intent));
      return (enemy.ai_profile?.intentBiases || [])
        .filter((rule) => !knownIntents.has(rule.intent))
        .map((rule) => `${enemy.id}:${rule.intent}`);
    });

  assert.deepEqual(invalidReferences, []);
});
