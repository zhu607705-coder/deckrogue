#!/usr/bin/env node

/**
 * @file check_growth_route_formation.ts
 * @description 检查成长路线形成情况，验证路线标签分布和形成率。
 *
 * 主要职责:
 * - 运行多角色多种子模拟
 * - 分析路线标签的分布和形成率
 * - 识别标签垄断或形成率不达标的情况
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { GameEngine } from '@/core/events/gameEngine';
import { analyzeRouteSignals, getCardRouteSignal } from '@/content/narrative/numericSystem';

const CHARACTERS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist', 'penitent_judge', 'void_sanctioner'] as const;
const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
const THRESHOLD = 0.7;

export interface SampleResult {
  characterId: string;
  seed: number;
  dominantTag: string | null;
  reward1: string[];
  reward2: string[];
  formed: boolean;
}

export interface RouteTagDistributionEntry {
  tag: string;
  count: number;
  share: number;
  formedCount: number;
  formationRate: number;
}

export interface CharacterRouteDistribution {
  characterId: string;
  totalSamples: number;
  formedCount: number;
  formationRate: number;
  uniqueTagCount: number;
  maxTagShare: number;
  minNonzeroTagShare: number;
  dominantTags: RouteTagDistributionEntry[];
  warnings: string[];
}

export interface RouteDistributionSummary {
  reportOnly: true;
  warningCount: number;
  warningRules: {
    minUniqueTagCount: number;
    maxTagShare: number;
  };
  byCharacter: CharacterRouteDistribution[];
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

export function summarizeRouteDistribution(samples: SampleResult[]): RouteDistributionSummary {
  const minUniqueTagCount = 2;
  const maxTagShareLimit = 0.85;
  const byCharacter = [...new Set(samples.map((sample) => sample.characterId))].sort().map((characterId) => {
    const characterSamples = samples.filter((sample) => sample.characterId === characterId);
    const formedCount = characterSamples.filter((sample) => sample.formed).length;
    const tagCounts = new Map<string, { count: number; formedCount: number }>();
    for (const sample of characterSamples) {
      const tag = sample.dominantTag ?? 'unknown';
      const current = tagCounts.get(tag) ?? { count: 0, formedCount: 0 };
      current.count += 1;
      if (sample.formed) {
        current.formedCount += 1;
      }
      tagCounts.set(tag, current);
    }
    const dominantTags = [...tagCounts.entries()]
      .map(([tag, value]) => ({
        tag,
        count: value.count,
        share: value.count / Math.max(1, characterSamples.length),
        formedCount: value.formedCount,
        formationRate: value.formedCount / Math.max(1, value.count),
      }))
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
    const nonzeroShares = dominantTags.map((entry) => entry.share).filter((share) => share > 0);
    const maxTagShare = nonzeroShares.length ? Math.max(...nonzeroShares) : 0;
    const minNonzeroTagShare = nonzeroShares.length ? Math.min(...nonzeroShares) : 0;
    const warnings: string[] = [];
    if (dominantTags.length < minUniqueTagCount) {
      warnings.push(`uniqueTagCount ${dominantTags.length} < ${minUniqueTagCount}`);
    }
    if (maxTagShare > maxTagShareLimit) {
      warnings.push(`maxTagShare ${maxTagShare.toFixed(2)} > ${maxTagShareLimit}`);
    }
    return {
      characterId,
      totalSamples: characterSamples.length,
      formedCount,
      formationRate: formedCount / Math.max(1, characterSamples.length),
      uniqueTagCount: dominantTags.length,
      maxTagShare,
      minNonzeroTagShare,
      dominantTags,
      warnings,
    };
  });

  return {
    reportOnly: true,
    warningCount: byCharacter.reduce((total, entry) => total + entry.warnings.length, 0),
    warningRules: {
      minUniqueTagCount,
      maxTagShare: maxTagShareLimit,
    },
    byCharacter,
  };
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
    distribution: summarizeRouteDistribution(samples),
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
