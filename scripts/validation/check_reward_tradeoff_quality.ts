#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { getCardRouteSignal } from '@/content/narrative/numericSystem';
import { seedRecentChoiceOverrideScenario } from './growthRouteScenario';

const CHARACTERS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist'] as const;
const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
const THRESHOLD = 0.7;

function main() {
  const samples: Array<{
    characterId: string;
    seed: number;
    deckDominantTag: string;
    preferredRecentTag: string;
    reward: string[];
    hasRouteCard: boolean;
    hasCounterweight: boolean;
    tradeoff: boolean;
  }> = [];

  for (const characterId of CHARACTERS) {
    for (const seed of SEEDS) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        const { deckDominantTag, preferredRecentTag } = seedRecentChoiceOverrideScenario(engine, characterId, seed);

        const reward = engine.generateCardRewards(3, { source: 'combat' });
        const hasRouteCard = reward.some((card) => {
          const signal = getCardRouteSignal(card);
          return !!(
            signal &&
            signal.routeTags.includes(preferredRecentTag) &&
            (signal.earlyGameRole === 'route_confirm' || signal.earlyGameRole === 'route_payoff')
          );
        });
        const hasCounterweight = reward.some((card) => {
          const signal = getCardRouteSignal(card);
          if (!signal) return true;
          return (
            !signal.routeTags.includes(preferredRecentTag) ||
            signal.earlyGameRole === 'generic_power' ||
            signal.earlyGameRole === 'generic_fallback'
          );
        });
        samples.push({
          characterId,
          seed,
          deckDominantTag,
          preferredRecentTag,
          reward: reward.map((card) => card.id),
          hasRouteCard,
          hasCounterweight,
          tradeoff: hasRouteCard && hasCounterweight,
        });
      } finally {
        engine.dispose();
      }
    }
  }

  const tradeoffCount = samples.filter((sample) => sample.tradeoff).length;
  const tradeoffRate = tradeoffCount / Math.max(1, samples.length);
  const report = {
    threshold: THRESHOLD,
    totalSamples: samples.length,
    tradeoffCount,
    tradeoffRate,
    pass: tradeoffRate >= THRESHOLD,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'reward-tradeoff-quality.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_reward_tradeoff_quality] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_reward_tradeoff_quality] tradeoffRate: ${(tradeoffRate * 100).toFixed(1)}% (${tradeoffCount}/${samples.length})`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
