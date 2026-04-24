#!/usr/bin/env node

/**
 * @file check_event_choice_reinforcement.ts
 * @description 检查事件选项的路线增强配置是否正确。
 *
 * 主要职责:
 * - 验证事件选项的路线提交权重
 * - 检查事件选项的路线角色定义
 * - 报告路线增强配置违规
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { getEventChoiceRouteCommitWeight, getEventChoiceRouteRole, getEventChoiceCommitTags, getEventRouteSignal } from '@/content/narrative/routeSignals';

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
    const engine = new GameEngine(61 + index, null, { enableRuntimeDelegation: false });
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
        gold: engine.state.player.gold,
        hp: engine.state.player.hp,
        maxHp: engine.state.player.maxHp,
        intel: engine.state.player.intel,
        deckCount: engine.state.player.deck.length,
        relicCount: engine.state.player.relics.length,
      };

      engine.resolveEventChoice(scenario.choiceId);
      const signal = getEventRouteSignal(scenario.eventId);
      const expectedWeight = getEventChoiceRouteCommitWeight(scenario.eventId, scenario.choiceId);
      const choiceRole = getEventChoiceRouteRole(scenario.eventId, scenario.choiceId);
      const candidateTags = getEventChoiceCommitTags(scenario.eventId, scenario.choiceId);
      const stateChanged =
        engine.state.player.gold !== before.gold ||
        engine.state.player.hp !== before.hp ||
        engine.state.player.maxHp !== before.maxHp ||
        engine.state.player.intel !== before.intel ||
        engine.state.player.deck.length !== before.deckCount ||
        engine.state.player.relics.length !== before.relicCount ||
        !!engine.state.enchantContext;
      const matchingCommit = engine.state.routeState?.recentCommits.find((entry) =>
        entry.source === 'event' &&
        entry.tag === scenario.expectedTag &&
        entry.weight === expectedWeight
      ) ?? null;

      return {
        ...scenario,
        reinforcement: signal?.reinforcement ?? null,
        choiceRole,
        candidateTags,
        stateChanged,
        routeCommitRecorded: matchingCommit?.source === 'event' && matchingCommit.tag === scenario.expectedTag,
        commitWeightRecorded: matchingCommit?.weight === expectedWeight,
        pass:
          stateChanged &&
          matchingCommit?.source === 'event' &&
          matchingCommit.tag === scenario.expectedTag &&
          matchingCommit.weight === expectedWeight,
      };
    } finally {
      engine.dispose();
    }
  });

  const passCount = samples.filter((sample) => sample.pass).length;
  const report = {
    totalSamples: samples.length,
    passCount,
    pass: passCount === samples.length,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'event-choice-reinforcement.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_event_choice_reinforcement] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_event_choice_reinforcement] passCount: ${passCount}/${samples.length}`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
