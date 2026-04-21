#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function readJson(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function main() {
  const growth = readJson(path.join(process.cwd(), 'reports', 'growth', 'growth-route-formation.json'));
  const tradeoff = readJson(path.join(process.cwd(), 'reports', 'growth', 'reward-tradeoff-quality.json'));
  const nodes = readJson(path.join(process.cwd(), 'reports', 'growth', 'shop-event-growth-nodes.json'));

  const report = {
    generatedAt: new Date().toISOString(),
    growthRouteFormation: {
      pass: growth.pass,
      totalSamples: growth.totalSamples,
      formedCount: growth.formedCount,
      formationRate: growth.formationRate,
      threshold: growth.threshold,
      distribution: growth.distribution,
    },
    rewardTradeoffQuality: {
      pass: tradeoff.pass,
      totalSamples: tradeoff.totalSamples,
      tradeoffCount: tradeoff.tradeoffCount,
      tradeoffRate: tradeoff.tradeoffRate,
      threshold: tradeoff.threshold,
    },
    shopEventGrowthNodes: {
      pass: nodes.pass,
      totalSamples: nodes.totalSamples,
      anyNodeCount: nodes.anyNodeCount,
      anyNodeRate: nodes.anyNodeRate,
      shopCount: nodes.shopCount,
      shopRate: nodes.shopRate,
      eventCount: nodes.eventCount,
      eventRate: nodes.eventRate,
      threshold: nodes.threshold,
      byCharacter: nodes.byCharacter,
    },
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'growth-route-summary.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[report_growth_route_formation] report: ${path.relative(process.cwd(), reportPath)}`);
}

main();
