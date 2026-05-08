#!/usr/bin/env node

/**
 * @file check_shop_event_growth_nodes.ts
 * @description 检查商店和事件的成长节点对齐情况。
 *
 * 主要职责:
 * - 验证商店卡牌与路线标签的对齐
 * - 检查事件节点与路线的对齐
 * - 生成对齐质量报告
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { getCardRouteSignal, getEventRouteSignal } from '@/content/narrative/numericSystem';
import { seedRecentChoiceOverrideScenario } from './growthRouteScenario';

const CHARACTERS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist', 'penitent_judge', 'void_sanctioner'] as const;
const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
const THRESHOLD = 0.5;

function main() {
  const samples: Array<{
    characterId: string;
    seed: number;
    deckDominantTag: string;
    preferredRecentTag: string;
    shopAligned: boolean;
    eventAligned: boolean;
    anyNodeAligned: boolean;
  }> = [];

  for (const characterId of CHARACTERS) {
    for (const seed of SEEDS) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        const { deckDominantTag, preferredRecentTag } = seedRecentChoiceOverrideScenario(engine, characterId, seed);

        const shopCards = engine.generateCardRewards(6, { source: 'shop' });
        const shopAligned = shopCards.some((card) => {
          const signal = getCardRouteSignal(card);
          return !!(signal && signal.routeTags.includes(preferredRecentTag));
        });

        const eventNode =
          engine.state.map.find((node) => node.type === 'Event' && node.y === 1) ??
          engine.state.map.find((node) => node.y === 1) ??
          engine.state.map.find((node) => node.type === 'Event' && node.y === 0) ??
          engine.state.map.find((node) => node.y === 0) ??
          engine.state.map[0];
        engine.state.currentNodeId = eventNode.id;
        engine.startEvent();
        const eventSignal = engine.state.activeEvent ? getEventRouteSignal(engine.state.activeEvent.id) : null;
        const eventAligned = !!(eventSignal && eventSignal.routeTags.includes(preferredRecentTag));

        samples.push({
          characterId,
          seed,
          deckDominantTag,
          preferredRecentTag,
          shopAligned,
          eventAligned,
          anyNodeAligned: shopAligned || eventAligned,
        });
      } finally {
        engine.dispose();
      }
    }
  }

  const anyNodeCount = samples.filter((sample) => sample.anyNodeAligned).length;
  const anyNodeRate = anyNodeCount / Math.max(1, samples.length);
  const shopCount = samples.filter((sample) => sample.shopAligned).length;
  const eventCount = samples.filter((sample) => sample.eventAligned).length;
  const shopRate = shopCount / Math.max(1, samples.length);
  const eventRate = eventCount / Math.max(1, samples.length);
  const byCharacter = Object.fromEntries(
    CHARACTERS.map((characterId) => {
      const characterSamples = samples.filter((sample) => sample.characterId === characterId);
      const total = characterSamples.length;
      const characterShopCount = characterSamples.filter((sample) => sample.shopAligned).length;
      const characterEventCount = characterSamples.filter((sample) => sample.eventAligned).length;
      return [characterId, {
        totalSamples: total,
        anyNodeCount: characterSamples.filter((sample) => sample.anyNodeAligned).length,
        anyNodeRate: total > 0 ? characterSamples.filter((sample) => sample.anyNodeAligned).length / total : 0,
        shopCount: characterShopCount,
        shopRate: total > 0 ? characterShopCount / total : 0,
        eventCount: characterEventCount,
        eventRate: total > 0 ? characterEventCount / total : 0,
      }];
    }),
  );
  const characterFailures = Object.entries(byCharacter)
    .filter(([, entry]) => entry.shopRate < THRESHOLD || entry.eventRate < THRESHOLD)
    .map(([characterId, entry]) => ({
      characterId,
      shopRate: entry.shopRate,
      eventRate: entry.eventRate,
      shopCount: entry.shopCount,
      eventCount: entry.eventCount,
      totalSamples: entry.totalSamples,
    }));
  const characterPassCount = CHARACTERS.length - characterFailures.length;
  const report = {
    threshold: THRESHOLD,
    totalSamples: samples.length,
    anyNodeCount,
    anyNodeRate,
    shopCount,
    shopRate,
    eventCount,
    eventRate,
    characterPassCount,
    characterFailures,
    pass: characterFailures.length === 0,
    byCharacter,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'shop-event-growth-nodes.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_shop_event_growth_nodes] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_shop_event_growth_nodes] anyNodeRate: ${(anyNodeRate * 100).toFixed(1)}% (${anyNodeCount}/${samples.length})`);
  console.log(`[check_shop_event_growth_nodes] shopRate: ${(shopRate * 100).toFixed(1)}% (${shopCount}/${samples.length})`);
  console.log(`[check_shop_event_growth_nodes] eventRate: ${(eventRate * 100).toFixed(1)}% (${eventCount}/${samples.length})`);
  console.log(`[check_shop_event_growth_nodes] characterPassCount: ${characterPassCount}/${CHARACTERS.length}`);
  if (!report.pass) {
    console.log(`[check_shop_event_growth_nodes] characterFailures: ${characterFailures.map((entry) => `${entry.characterId}: shop ${(entry.shopRate * 100).toFixed(1)}%, event ${(entry.eventRate * 100).toFixed(1)}%`).join('; ')}`);
    process.exitCode = 1;
  }
}

main();
