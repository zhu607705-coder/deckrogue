#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { analyzeRouteSignals, getCardRouteSignal } from '@/content/narrative/numericSystem';

const CHARACTERS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist'] as const;
const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
const THRESHOLD = 0.7;

interface SampleResult {
  characterId: string;
  seed: number;
  dominantTag: string | null;
  reward1: string[];
  reward2: string[];
  formed: boolean;
}

function chooseRouteCard(engine: GameEngine) {
  const reward = engine.generateCardRewards(3, { source: 'combat' });
  const sorted = [...reward].sort((a, b) => {
    const signalA = getCardRouteSignal(a);
    const signalB = getCardRouteSignal(b);
    const weightA = (signalA?.earlyGameRole === 'route_confirm' ? 5 : signalA?.earlyGameRole === 'route_payoff' ? 4 : signalA?.earlyGameRole === 'generic_power' ? 3 : 1);
    const weightB = (signalB?.earlyGameRole === 'route_confirm' ? 5 : signalB?.earlyGameRole === 'route_payoff' ? 4 : signalB?.earlyGameRole === 'generic_power' ? 3 : 1);
    return weightB - weightA;
  });
  return { reward, chosen: sorted[0] };
}

function main() {
  const samples: SampleResult[] = [];

  for (const characterId of CHARACTERS) {
    for (const seed of SEEDS) {
      const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        const floor1 = engine.state.map.find((node) => node.y === 0)!;
        engine.state.currentNodeId = floor1.id;
        const first = chooseRouteCard(engine);
        engine.state.player.deck.push(first.chosen);

        const floor2 = engine.state.map.find((node) => node.y === 1) ?? floor1;
        engine.state.currentNodeId = floor2.id;
        const dominantTag = getCardRouteSignal(first.chosen)?.routeTags[0] ?? analyzeRouteSignals(engine.state.player.deck).dominantTag;
        const reward2 = engine.generateCardRewards(3, { source: 'combat' });
        const formed = reward2.some((card) => {
          const signal = getCardRouteSignal(card);
          return !!(dominantTag && signal && signal.routeTags.includes(dominantTag) && (signal.earlyGameRole === 'route_confirm' || signal.earlyGameRole === 'route_payoff'));
        });

        samples.push({
          characterId,
          seed,
          dominantTag,
          reward1: first.reward.map((card) => card.id),
          reward2: reward2.map((card) => card.id),
          formed,
        });
      } finally {
        engine.dispose();
      }
    }
  }

  const formedCount = samples.filter((sample) => sample.formed).length;
  const formationRate = formedCount / Math.max(1, samples.length);
  const report = {
    threshold: THRESHOLD,
    totalSamples: samples.length,
    formedCount,
    formationRate,
    pass: formationRate >= THRESHOLD,
    samples,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'growth-route-formation.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_growth_route_formation] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_growth_route_formation] formationRate: ${(formationRate * 100).toFixed(1)}% (${formedCount}/${samples.length})`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
