#!/usr/bin/env node

/**
 * @file check_rest_route_reinforcement.ts
 * @description 检查休息点的路线增强建议是否正确对齐当前路线。
 *
 * 主要职责:
 * - 运行多角色多种子模拟休息场景
 * - 验证休息建议的路线语义对齐
 * - 检查路线支撑遗物的推荐逻辑
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { RELIC_UPGRADE_CONFIGS } from '@/core/relic/RelicUpgrade';
import { cardsData, getCardRouteSignal, getRouteSupportRelicIds } from '@/content/narrative/numericSystem';
import { buildRestRouteAdvice } from '@/ui/views/restRouteAdvisor';
import type { RunCardInstance } from '@/core/types';
import { seedRecentChoiceOverrideScenario } from './growthRouteScenario';

const CHARACTERS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist', 'penitent_judge', 'void_sanctioner'] as const;
const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
const THRESHOLD = 0.7;

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

function getRestSupportCardId(characterId: string, routeTag: string): string {
  const card =
    cardsData.find((entry) => {
      const signal = getCardRouteSignal(entry);
      return entry.character === characterId && !!entry.upgrade && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_payoff';
    }) ??
    cardsData.find((entry) => {
      const signal = getCardRouteSignal(entry);
      return entry.character === characterId && !!entry.upgrade && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_confirm';
    }) ??
    cardsData.find((entry) => {
      const signal = getCardRouteSignal(entry);
      return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_payoff';
    }) ??
    cardsData.find((entry) => {
      const signal = getCardRouteSignal(entry);
      return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === 'route_confirm';
    });
  if (!card) {
    throw new Error(`Missing rest support card for ${characterId}:${routeTag}`);
  }
  return card.id;
}

function main() {
  const samples: Array<{
    characterId: string;
    seed: number;
    preferredRecentTag: string;
    primaryAction: string | null;
    routeAlignedActions: string[];
    semanticAlignedActions: string[];
    pass: boolean;
  }> = [];

  for (const characterId of CHARACTERS) {
    for (const seed of SEEDS) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        const { preferredRecentTag } = seedRecentChoiceOverrideScenario(engine, characterId, seed);
        const alignedUpgradeCardId = getRestSupportCardId(characterId, preferredRecentTag);
        engine.state.player.deck.push(makeRuntimeCard(alignedUpgradeCardId, `rest-upgrade-${characterId}-${seed}`));

        const alignedRelicId = getRouteSupportRelicIds(preferredRecentTag).find((relicId) =>
          RELIC_UPGRADE_CONFIGS.some((config) => config.relicId === relicId),
        );
        if (alignedRelicId) {
          engine.state.player.relics.push(alignedRelicId);
        }

        const advice = buildRestRouteAdvice({
          characterId,
          deck: engine.state.player.deck,
          relicIds: engine.state.player.relics,
          currentHp: engine.state.player.maxHp,
          maxHp: engine.state.player.maxHp,
          canHeal: true,
          canUpgrade: true,
          canEnchant: true,
          canUpgradeRelic: !!alignedRelicId,
        });

        const routeAlignedActions = Object.values(advice.actionHints)
          .filter((hint): hint is NonNullable<typeof hint> => !!hint)
          .filter((hint) => hint.routeTag === preferredRecentTag)
          .map((hint) => hint.action);
        const semanticAlignedActions = Object.values(advice.actionHints)
          .filter((hint): hint is NonNullable<typeof hint> => !!hint)
          .filter((hint) => hint.routeTag === preferredRecentTag)
          .filter((hint) => hasRouteSemanticReason(hint.reason, advice.preferredRouteLabel))
          .map((hint) => hint.action);
        const pass =
          advice.preferredRouteTag === preferredRecentTag &&
          routeAlignedActions.length > 0 &&
          semanticAlignedActions.length === routeAlignedActions.length &&
          !!advice.primaryAction &&
          routeAlignedActions.includes(advice.primaryAction) &&
          semanticAlignedActions.includes(advice.primaryAction);

        samples.push({
          characterId,
          seed,
          preferredRecentTag,
          primaryAction: advice.primaryAction,
          routeAlignedActions,
          semanticAlignedActions,
          pass,
        });
      } finally {
        engine.dispose();
      }
    }
  }

  const alignedCount = samples.filter((sample) => sample.pass).length;
  const alignmentRate = alignedCount / Math.max(1, samples.length);
  const semanticAlignedCount = samples.filter((sample) => sample.semanticAlignedActions.length > 0).length;
  const semanticAlignmentRate = semanticAlignedCount / Math.max(1, samples.length);
  const report = {
    threshold: THRESHOLD,
    totalSamples: samples.length,
    alignedCount,
    alignmentRate,
    semanticAlignedCount,
    semanticAlignmentRate,
    pass: alignmentRate >= THRESHOLD && semanticAlignmentRate >= THRESHOLD,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'rest-route-reinforcement.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_rest_route_reinforcement] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_rest_route_reinforcement] alignmentRate: ${(alignmentRate * 100).toFixed(1)}% (${alignedCount}/${samples.length})`);
  console.log(
    `[check_rest_route_reinforcement] semanticAlignmentRate: ${(semanticAlignmentRate * 100).toFixed(1)}% (${semanticAlignedCount}/${samples.length})`,
  );
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
