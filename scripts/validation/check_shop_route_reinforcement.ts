#!/usr/bin/env node

/**
 * @file check_shop_route_reinforcement.ts
 * @description 检查商店的路线增强建议是否正确对齐当前路线。
 *
 * 主要职责:
 * - 运行多角色多种子模拟商店场景
 * - 验证商店建议的路线语义对齐
 * - 检查路线支撑遗物的推荐逻辑
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { getRouteSupportRelicIds } from '@/content/narrative/routeSignals';
import { buildShopRouteAdvice } from '@/ui/views/shopRouteAdvisor';
import { seedRecentChoiceOverrideScenario } from './growthRouteScenario';

const CHARACTERS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist', 'penitent_judge', 'void_sanctioner'] as const;
const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
const THRESHOLD = 0.8;

function hasRouteSemanticReason(reason: string | undefined, preferredRouteLabel: string | null): boolean {
  if (!reason) return false;
  return (
    reason.includes('当前路线') ||
    reason.includes('对齐当前路线') ||
    reason.includes('路线牌') ||
    reason.includes('支撑当前路线') ||
    (!!preferredRouteLabel && reason.includes(preferredRouteLabel))
  );
}

function main() {
  const samples: Array<{
    characterId: string;
    seed: number;
    deckDominantTag: string;
    preferredRecentTag: string;
    primaryAligned: boolean;
    primarySemanticAligned: boolean;
    cardAligned: boolean;
    relicAligned: boolean;
    serviceAligned: boolean;
    serviceSemanticAligned: boolean;
  }> = [];

  for (const characterId of CHARACTERS) {
    for (const seed of SEEDS) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        const { deckDominantTag, preferredRecentTag } = seedRecentChoiceOverrideScenario(engine, characterId, seed);
        const cardOffers = engine.generateCardRewards(6, { source: 'shop' }).map((card) => ({
          card,
          price: 75,
        }));
        const relicOffers = getRouteSupportRelicIds(preferredRecentTag).slice(0, 2).map((relicId) => ({
          relicId,
          price: 120,
        }));

        const advice = buildShopRouteAdvice({
          characterId,
          deck: engine.state.player.deck,
          gold: 999,
          cardOffers,
          relicOffers,
          canUpgrade: true,
          canEnchant: true,
        });

        const cardAligned = Object.values(advice.cardHints).some((hint) => hint.routeTag === preferredRecentTag);
        const relicAligned = Object.values(advice.relicHints).some((hint) => hint.routeTag === preferredRecentTag);
        const serviceAligned = Object.values(advice.serviceHints).some((hint) => hint?.routeTag === preferredRecentTag);
        const primaryAligned = advice.primaryHint?.routeTag === preferredRecentTag;
        const primarySemanticAligned = hasRouteSemanticReason(advice.primaryHint?.reason, advice.preferredRouteLabel);
        const serviceSemanticAligned = Object.values(advice.serviceHints)
          .filter((hint): hint is NonNullable<typeof hint> => !!hint)
          .every((hint) => hasRouteSemanticReason(hint.reason, advice.preferredRouteLabel));

        samples.push({
          characterId,
          seed,
          deckDominantTag,
          preferredRecentTag,
          primaryAligned,
          primarySemanticAligned,
          cardAligned,
          relicAligned,
          serviceAligned,
          serviceSemanticAligned,
        });
      } finally {
        engine.dispose();
      }
    }
  }

  const primaryAlignedCount = samples.filter((sample) => sample.primaryAligned).length;
  const primarySemanticAlignedCount = samples.filter((sample) => sample.primarySemanticAligned).length;
  const cardAlignedCount = samples.filter((sample) => sample.cardAligned).length;
  const relicAlignedCount = samples.filter((sample) => sample.relicAligned).length;
  const serviceAlignedCount = samples.filter((sample) => sample.serviceAligned).length;
  const serviceSemanticAlignedCount = samples.filter((sample) => sample.serviceSemanticAligned).length;
  const totalSamples = Math.max(1, samples.length);
  const primaryAlignedRate = primaryAlignedCount / totalSamples;
  const primarySemanticAlignedRate = primarySemanticAlignedCount / totalSamples;
  const cardAlignedRate = cardAlignedCount / totalSamples;
  const relicAlignedRate = relicAlignedCount / totalSamples;
  const serviceAlignedRate = serviceAlignedCount / totalSamples;
  const serviceSemanticAlignedRate = serviceSemanticAlignedCount / totalSamples;

  const report = {
    threshold: THRESHOLD,
    totalSamples: samples.length,
    primaryAlignedCount,
    primaryAlignedRate,
    primarySemanticAlignedCount,
    primarySemanticAlignedRate,
    cardAlignedCount,
    cardAlignedRate,
    relicAlignedCount,
    relicAlignedRate,
    serviceAlignedCount,
    serviceAlignedRate,
    serviceSemanticAlignedCount,
    serviceSemanticAlignedRate,
    pass:
      primaryAlignedRate >= THRESHOLD &&
      primarySemanticAlignedRate >= THRESHOLD &&
      serviceAlignedRate >= THRESHOLD &&
      serviceSemanticAlignedRate >= THRESHOLD,
    byCharacter: Object.fromEntries(
      CHARACTERS.map((characterId) => {
        const characterSamples = samples.filter((sample) => sample.characterId === characterId);
        const total = Math.max(1, characterSamples.length);
        return [
          characterId,
          {
            totalSamples: characterSamples.length,
            primaryAlignedRate: characterSamples.filter((sample) => sample.primaryAligned).length / total,
            cardAlignedRate: characterSamples.filter((sample) => sample.cardAligned).length / total,
            relicAlignedRate: characterSamples.filter((sample) => sample.relicAligned).length / total,
            serviceAlignedRate: characterSamples.filter((sample) => sample.serviceAligned).length / total,
          },
        ];
      }),
    ),
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'shop-route-reinforcement.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_shop_route_reinforcement] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(
    `[check_shop_route_reinforcement] primaryAlignedRate: ${(primaryAlignedRate * 100).toFixed(1)}% (${primaryAlignedCount}/${samples.length})`,
  );
  console.log(
    `[check_shop_route_reinforcement] primarySemanticAlignedRate: ${(primarySemanticAlignedRate * 100).toFixed(1)}% (${primarySemanticAlignedCount}/${samples.length})`,
  );
  console.log(
    `[check_shop_route_reinforcement] serviceAlignedRate: ${(serviceAlignedRate * 100).toFixed(1)}% (${serviceAlignedCount}/${samples.length})`,
  );
  console.log(
    `[check_shop_route_reinforcement] serviceSemanticAlignedRate: ${(serviceSemanticAlignedRate * 100).toFixed(1)}% (${serviceSemanticAlignedCount}/${samples.length})`,
  );
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
