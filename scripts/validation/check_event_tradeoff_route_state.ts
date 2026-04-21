#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { readLegacyActiveEventOutcome } from '@/runtimeV2';
import {
  getEventChoiceCommitTags,
  getEventChoiceRouteCommitWeight,
  getEventChoiceRouteRole,
  getKnownRouteTagsForCharacter,
} from '@/content/narrative/routeSignals';

const CASES = [
  {
    label: 'rusting_medicae_payoff',
    characterId: 'informant',
    routeTag: 'informant:intel',
    eventId: 'rusting_medicae',
    choiceId: 'medicae_implant',
    expectedTag: 'informant:intel',
  },
  {
    label: 'rusting_medicae_support',
    characterId: 'informant',
    routeTag: 'informant:intel',
    eventId: 'rusting_medicae',
    choiceId: 'medicae_extract',
    expectedTag: 'informant:intel',
  },
  {
    label: 'rusting_medicae_staged_pivot_retention',
    characterId: 'informant',
    routeTag: 'informant:intel',
    eventId: 'rusting_medicae',
    choiceId: 'medicae_salvage',
    expectedTag: 'informant:intel',
  },
  {
    label: 'inquisitor_legacy_confirm',
    characterId: 'informant',
    routeTag: 'informant:evidence',
    eventId: 'inquisitor_legacy',
    choiceId: 'legacy_read_codex',
    expectedTag: 'informant:intel',
  },
  {
    label: 'nameless_martyr_shrine_pivot',
    characterId: 'informant',
    routeTag: 'informant:evidence',
    eventId: 'nameless_martyr_shrine',
    choiceId: 'martyr_desecrate',
    expectedTag: 'brute:rage',
  },
  {
    label: 'warp_tear_whispers_pivot',
    characterId: 'chronomancer',
    routeTag: 'chronomancer:warp',
    eventId: 'warp_tear_whispers',
    choiceId: 'tear_seal',
    expectedTag: 'chronomancer:time_layer',
  },
] as const;

function main() {
  const samples = CASES.map((scenario, index) => {
    const engine = new GameEngine(101 + index, null, { enableRuntimeDelegation: false });
    const restored = new GameEngine(201 + index, null, { enableRuntimeDelegation: false });
    try {
      engine.selectCharacter(scenario.characterId);
      engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
      engine.state.activeEvent = { id: scenario.eventId, data: {} };
      engine.state.screen = 'Event';
      engine.state.routeState = {
        primaryTag: scenario.routeTag,
        secondaryTag: null,
        confidence: 68,
        stage: 'committed',
        recentCommits: [{ tag: scenario.routeTag, source: 'reward', floor: 2, weight: 16 }],
      };

      const before = {
        primaryTag: engine.state.routeState.primaryTag,
        stage: engine.state.routeState.stage,
        confidence: engine.state.routeState.confidence,
      };

      engine.resolveEventChoice(scenario.choiceId);

      const routeCommitWeight = getEventChoiceRouteCommitWeight(scenario.eventId, scenario.choiceId);
      const choiceRole = getEventChoiceRouteRole(scenario.eventId, scenario.choiceId);
      const candidateTags = getEventChoiceCommitTags(scenario.eventId, scenario.choiceId);
      const knownRouteTags = getKnownRouteTagsForCharacter(scenario.characterId);
      const after = {
        primaryTag: engine.state.routeState?.primaryTag ?? null,
        stage: engine.state.routeState?.stage ?? null,
        confidence: engine.state.routeState?.confidence ?? null,
      };
      const matchingCommit = engine.state.routeState?.recentCommits.find((entry) =>
        entry.source === 'event'
        && entry.tag === scenario.expectedTag
        && entry.weight === routeCommitWeight,
      ) ?? null;
      restored.loadSaveData(engine.getSaveData());
      const restoredMatchingCommit = restored.state.routeState?.recentCommits.find((entry) =>
        entry.source === 'event'
        && entry.tag === scenario.expectedTag
        && entry.weight === routeCommitWeight,
      ) ?? null;
      const sourceOutcome = readLegacyActiveEventOutcome(engine.state.activeEvent);
      const restoredOutcome = readLegacyActiveEventOutcome(restored.state.activeEvent);
      const saveLoadRetainsRouteState =
        restored.state.routeState?.primaryTag === after.primaryTag
        && restored.state.routeState?.stage === after.stage
        && restored.state.routeState?.confidence === after.confidence
        && restoredMatchingCommit?.source === 'event';
      const saveLoadRetainsEventOutcome =
        (engine.state.activeEvent === null && restored.state.activeEvent === null)
        || (
          restoredOutcome.lastChoiceId === sourceOutcome.lastChoiceId
          && restoredOutcome.choiceRole === sourceOutcome.choiceRole
          && restoredOutcome.outcomeKind === sourceOutcome.outcomeKind
        );

      const routeDeltaPass = (() => {
        if (choiceRole === 'pivot') {
          const canBecomePrimaryTag = knownRouteTags.includes(scenario.expectedTag);
          if (!canBecomePrimaryTag) {
            return after.primaryTag !== null
              && (after.stage === 'pivoting' || after.stage === 'committed')
              && (after.confidence ?? 0) >= before.confidence;
          }
          return after.primaryTag === scenario.expectedTag
            && (after.stage === 'pivoting' || after.stage === 'committed')
            && (after.confidence ?? 0) >= 35;
        }
        if (choiceRole === 'confirm') {
          return after.primaryTag === scenario.expectedTag
            && after.stage === 'committed'
            && (after.confidence ?? 0) >= before.confidence;
        }
        if (choiceRole === 'payoff') {
          return after.primaryTag === scenario.expectedTag
            && (after.confidence ?? 0) >= before.confidence;
        }
        if (choiceRole === 'support') {
          return after.primaryTag === scenario.expectedTag
            && (after.confidence ?? 0) >= before.confidence - 8;
        }
        return false;
      })();

      return {
        ...scenario,
        choiceRole,
        candidateTags,
        before,
        after,
        routeCommitRecorded: matchingCommit?.source === 'event' && matchingCommit.tag === scenario.expectedTag,
        commitWeightRecorded: matchingCommit?.weight === routeCommitWeight,
        routeDeltaPass,
        saveLoadRetainsRouteState,
        saveLoadRetainsEventOutcome,
        pass:
          routeDeltaPass
          && matchingCommit?.source === 'event'
          && matchingCommit.tag === scenario.expectedTag
          && matchingCommit.weight === routeCommitWeight
          && saveLoadRetainsRouteState
          && saveLoadRetainsEventOutcome,
      };
    } finally {
      engine.dispose();
      restored.dispose();
    }
  });

  const passCount = samples.filter((sample) => sample.pass).length;
  const report = {
    totalSamples: samples.length,
    passCount,
    pass: passCount === samples.length,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'event-tradeoff-route-state.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_event_tradeoff_route_state] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_event_tradeoff_route_state] passCount: ${passCount}/${samples.length}`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
