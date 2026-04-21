import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { getEventChoiceRouteCommitWeight } from '@/content/narrative/routeSignals';

function setupEvent(engine: GameEngine, eventId: string, routeTag: string) {
  engine.selectCharacter(routeTag.startsWith('chronomancer:') ? 'chronomancer' : 'informant');
  engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
  engine.state.activeEvent = { id: eventId, data: {} };
  engine.state.screen = 'Event';
  engine.state.routeState = {
    primaryTag: routeTag,
    secondaryTag: routeTag === 'chronomancer:warp' ? 'chronomancer:time_layer' : 'informant:intel',
    confidence: 70,
    stage: 'committed',
    recentCommits: [{ tag: routeTag, source: 'reward', floor: 2, weight: 16 }],
  };
}

test('event confirm choice records a confirm-weight event commit', () => {
  const engine = new GameEngine(401, null, { enableRuntimeDelegation: false });
  try {
    setupEvent(engine, 'inquisitor_legacy', 'informant:evidence');
    engine.resolveEventChoice('legacy_read_codex');
    const matchingCommit = engine.state.routeState?.recentCommits.find((entry) =>
      entry.source === 'event' &&
      entry.tag === 'informant:intel' &&
      entry.weight === getEventChoiceRouteCommitWeight('inquisitor_legacy', 'legacy_read_codex')
    );
    assert.ok(matchingCommit);
  } finally {
    engine.dispose();
  }
});

test('event support choice records a support-weight event commit', () => {
  const engine = new GameEngine(402, null, { enableRuntimeDelegation: false });
  try {
    setupEvent(engine, 'rusting_medicae', 'informant:intel');
    engine.resolveEventChoice('medicae_extract');
    const matchingCommit = engine.state.routeState?.recentCommits.find((entry) =>
      entry.source === 'event' &&
      entry.tag === 'informant:intel' &&
      entry.weight === getEventChoiceRouteCommitWeight('rusting_medicae', 'medicae_extract')
    );
    assert.ok(matchingCommit);
  } finally {
    engine.dispose();
  }
});

test('event payoff choice records a payoff-weight event commit', () => {
  const engine = new GameEngine(404, null, { enableRuntimeDelegation: false });
  try {
    setupEvent(engine, 'rusting_medicae', 'informant:intel');
    engine.resolveEventChoice('medicae_implant');
    const matchingCommit = engine.state.routeState?.recentCommits.find((entry) =>
      entry.source === 'event' &&
      entry.tag === 'informant:intel' &&
      entry.weight === getEventChoiceRouteCommitWeight('rusting_medicae', 'medicae_implant')
    );
    assert.ok(matchingCommit);
  } finally {
    engine.dispose();
  }
});

test('event pivot choice can redirect commit to an alternate route tag', () => {
  const engine = new GameEngine(403, null, { enableRuntimeDelegation: false });
  try {
    setupEvent(engine, 'warp_tear_whispers', 'chronomancer:warp');
    engine.resolveEventChoice('tear_seal');
    const matchingCommit = engine.state.routeState?.recentCommits.find((entry) =>
      entry.source === 'event' &&
      entry.tag === 'chronomancer:time_layer' &&
      entry.weight === getEventChoiceRouteCommitWeight('warp_tear_whispers', 'tear_seal')
    );
    assert.ok(matchingCommit);
  } finally {
    engine.dispose();
  }
});
