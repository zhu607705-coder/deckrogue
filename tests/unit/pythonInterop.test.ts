import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePythonSnapshot } from '@/runtimeV2/pythonInterop';

test('normalizePythonSnapshot lifts active event outcome fields from nested payload data', () => {
  const snapshot = normalizePythonSnapshot({
    seed: 11,
    player: {
      character_id: 'informant',
      deck: ['gather_intel'],
      relic_states: {},
    },
    map: {
      current_node_id: null,
      nodes: [],
    },
    active_event: {
      id: 'machine_psalm_archive',
      stage: 'choice',
      data: {
        last_choice_id: 'machine_psalm_copy',
        choice_role: 'confirm',
        outcome_kind: 'support',
      },
    },
  });

  assert.deepEqual(snapshot.activeEvent, {
    id: 'machine_psalm_archive',
    stage: 'choice',
    lastChoiceId: 'machine_psalm_copy',
    choiceRole: 'confirm',
    outcomeKind: 'support',
    data: {
      lastChoiceId: 'machine_psalm_copy',
      choiceRole: 'confirm',
      outcomeKind: 'support',
    },
  });
});

test('normalizePythonSnapshot accepts a custom generatedAt fallback', () => {
  const snapshot = normalizePythonSnapshot(
    {
      player: {
        relic_states: {},
      },
      map: {
        current_node_id: null,
        nodes: [],
      },
    },
    {
      generatedAtFallback: () => '1970-01-01T00:00:00.000Z',
    },
  );

  assert.equal(snapshot.meta.generatedAt, '1970-01-01T00:00:00.000Z');
});
