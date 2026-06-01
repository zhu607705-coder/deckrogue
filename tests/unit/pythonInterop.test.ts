import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePythonSnapshot } from '@/runtimeV2/pythonInterop';
import { unwrapPythonSnapshotEnvelope } from '@/runtimeV2/pythonInterop';

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

test('normalizePythonSnapshot preserves Python special resource fields', () => {
  const snapshot = normalizePythonSnapshot({
    seed: 17,
    player: {
      character_id: 'chronomancer',
      hp: 55,
      max_hp: 60,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      secondary_resources: {
        evidence: 1,
      },
      time_layer: 3,
      thread: 2,
      concoction: 4,
      deck: ['time_shear'],
      relic_ids: [],
      potion_ids: [],
      relic_states: {},
    },
    map: {
      current_node_id: null,
      nodes: [],
    },
  });

  assert.equal(snapshot.player.timeLayer, 3);
  assert.equal(snapshot.player.thread, 2);
  assert.equal(snapshot.player.concoction, 4);
  assert.equal(snapshot.player.secondaryResources?.evidence, 1);
});

test('unwrapPythonSnapshotEnvelope rejects failed Python runtime envelopes', () => {
  assert.throws(
    () => unwrapPythonSnapshotEnvelope({ ok: false, error: 'unsupported command' }),
    /unsupported command/,
  );
});

test('unwrapPythonSnapshotEnvelope rejects successful envelopes without snapshots', () => {
  assert.throws(
    () => unwrapPythonSnapshotEnvelope({ ok: true }),
    /missing snapshot/i,
  );
});
