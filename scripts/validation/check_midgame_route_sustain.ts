#!/usr/bin/env node

/**
 * @file check_midgame_route_sustain.ts
 * @description 检查中期路线持续性，验证路线在中期的延续和转变。
 *
 * 主要职责:
 * - 运行多角色多种子模拟至中期
 * - 检查路线在中期阶段的持续性
 * - 报告路线流失或异常切换问题
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { cardsData, getCardRouteAffinityTags, getCardRouteSignal, maybeRecordRouteCommit, syncRouteStateFromLegacyState } from '@/content/narrative/numericSystem';
import type { RunCardInstance } from '@/core/types';

const CHARACTERS = ['informant', 'tactician', 'chronomancer', 'alchemist'] as const;
const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);
const THRESHOLD = 0.75;

function makeRuntimeCard(cardId: string, instanceId: string): RunCardInstance {
  const card = cardsData.find((entry) => entry.id === cardId);
  if (!card) {
    throw new Error(`Missing card ${cardId}`);
  }
  return {
    ...card,
    instanceId,
    baseCardId: card.id,
    runtimeBase: card,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
}

function getRouteConfirmCardId(characterId: string, routeTag: string): string {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_confirm';
  });
  if (!card) {
    throw new Error(`Missing route-confirm card for ${routeTag}`);
  }
  return card.id;
}

function getNeutralCardId(characterId: string): string {
  const card = cardsData.find((entry) => entry.character === characterId && getCardRouteAffinityTags(entry).length === 0);
  if (!card) {
    throw new Error(`Missing neutral card for ${characterId}`);
  }
  return card.id;
}

function setFloor(engine: GameEngine, floorIndex: number) {
  const node = engine.state.map.find((entry) => entry.y === floorIndex);
  if (!node) {
    throw new Error(`Missing floor index ${floorIndex}`);
  }
  engine.state.currentNodeId = node.id;
}

function main() {
  const samples: Array<{
    characterId: string;
    seed: number;
    preferredRouteTag: string;
    rewardAligned: boolean;
    shopAligned: boolean;
    sustain: boolean;
  }> = [];

  for (const characterId of CHARACTERS) {
    for (const seed of SEEDS) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        const knownTags = [...new Set(cardsData.flatMap((entry) => {
          const signal = getCardRouteSignal(entry);
          return entry.character === characterId && signal ? signal.routeTags : [];
        }))];
        if (knownTags.length < 2) continue;

        const staleTag = knownTags[seed % knownTags.length]!;
        const preferredRouteTag = knownTags[(seed + 1) % knownTags.length]!;
        if (staleTag === preferredRouteTag) continue;

        engine.state.player.deck.push(makeRuntimeCard(getRouteConfirmCardId(characterId, staleTag), `stale-a-${seed}`));
        engine.state.player.deck.push(makeRuntimeCard(getRouteConfirmCardId(characterId, staleTag), `stale-b-${seed}`));
        engine.state.player.deck.push(makeRuntimeCard(getRouteConfirmCardId(characterId, preferredRouteTag), `recent-${seed}`));
        engine.state.player.deck.push(makeRuntimeCard(getNeutralCardId(characterId), `neutral-${seed}`));
        maybeRecordRouteCommit(engine.state, preferredRouteTag, 'reward', 2, 16);
        maybeRecordRouteCommit(engine.state, preferredRouteTag, 'shop', 3, 12);
        syncRouteStateFromLegacyState(engine.state);

        setFloor(engine, 4);
        const reward = engine.generateCardRewards(3, { source: 'combat' });
        const shop = engine.generateCardRewards(6, { source: 'shop' });
        const rewardAligned = reward.some((card) => getCardRouteAffinityTags(card).includes(preferredRouteTag));
        const shopAligned = shop.some((card) => getCardRouteAffinityTags(card).includes(preferredRouteTag));

        samples.push({
          characterId,
          seed,
          preferredRouteTag,
          rewardAligned,
          shopAligned,
          sustain: rewardAligned && shopAligned,
        });
      } finally {
        engine.dispose();
      }
    }
  }

  const sustainCount = samples.filter((sample) => sample.sustain).length;
  const sustainRate = sustainCount / Math.max(1, samples.length);
  const report = {
    threshold: THRESHOLD,
    totalSamples: samples.length,
    sustainCount,
    sustainRate,
    pass: sustainRate >= THRESHOLD,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'midgame-route-sustain.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_midgame_route_sustain] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_midgame_route_sustain] sustainRate: ${(sustainRate * 100).toFixed(1)}% (${sustainCount}/${samples.length})`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
