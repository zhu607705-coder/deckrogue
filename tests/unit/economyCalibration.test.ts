/**
 * @file economyCalibration.test.ts
 * @description Unit tests for economy calibration and gold balance regression.
 *
 * 主要职责:
 * - 测试经济系统的数值基线
 * - 测试金币收益与商店可负担性
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EconomySystem } from '@/features/progression/economySystem';
import { NUMERICS_BASELINE } from '@/core/balance/numericsBaseline';

interface EconomyDiagnosticSummary {
  characterId: string;
  avgGoldGainPerFloor?: number[];
  netAssetEVUByCheckpoint?: number[];
  netAssetEVUGrowthByFloor?: number[];
  netAssetCoverageByCheckpoint?: number[];
  shopAffordability?: {
    card: number;
    potion: number;
    relic: number;
  };
  removalAffordability?: {
    floor1Cost: number;
    floor3Cost: number;
    floor1Affordable: boolean;
    floor3Affordable: boolean;
  };
  rewardToPriceRatio?: {
    card: number;
    potion: number;
    relic: number;
    removal: number;
  };
  nodeDistribution?: {
    generated?: Record<string, number>;
    resolved?: Record<string, number>;
    absoluteDrift?: Record<string, number>;
    totalVariationDistance?: number;
    generatedByFloor?: Record<string, Record<string, number>>;
    resolvedByFloor?: Record<string, Record<string, number>>;
  };
  resolvedByPolicy?: Record<'balanced' | 'aggressive' | 'economy', PolicyResult>;
}

interface PolicyResult {
  policy: 'balanced' | 'aggressive' | 'economy';
  avgGoldGainPerFloor: number[];
  netAssetEVUByCheckpoint: number[];
  netAssetEVUGrowthByFloor: number[];
  netAssetCoverageByCheckpoint: number[];
  shopAffordability: { card: number; potion: number; relic: number };
  removalAffordability: { floor1Cost: number; floor3Cost: number; floor1Affordable: boolean; floor3Affordable: boolean };
  rewardToPriceRatio: { card: number; potion: number; relic: number; removal: number };
  nodeDistribution: {
    generated: Record<string, number>;
    resolved: Record<string, number>;
    absoluteDrift: Record<string, number>;
    totalVariationDistance: number;
    generatedByFloor: Record<string, Record<string, number>>;
    resolvedByFloor: Record<string, Record<string, number>>;
  };
}

function loadEconomyRegression(): EconomyDiagnosticSummary[] {
  const raw = readFileSync(
    '/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json',
    'utf8'
  );
  return JSON.parse(raw) as EconomyDiagnosticSummary[];
}

test('economy regression must expose per-floor average gold gain', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    assert.ok(Array.isArray(summary.avgGoldGainPerFloor), `missing avgGoldGainPerFloor for ${summary.characterId}`);
    assert.equal(summary.avgGoldGainPerFloor?.length, 3, `expected 3 floor entries for ${summary.characterId}`);
  }
});

test('economy regression must expose shop and removal affordability summaries', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    assert.ok(summary.shopAffordability, `missing shopAffordability for ${summary.characterId}`);
    assert.ok(summary.removalAffordability, `missing removalAffordability for ${summary.characterId}`);
    assert.ok(
      (summary.shopAffordability?.card ?? 0) >= 0.75,
      `expected card affordability >= 0.75 for ${summary.characterId}, got ${summary.shopAffordability?.card}`
    );
  }
});

test('economy regression must expose reward-to-price ratios', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    assert.ok(summary.rewardToPriceRatio, `missing rewardToPriceRatio for ${summary.characterId}`);
    assert.ok(
      (summary.rewardToPriceRatio?.card ?? 0) >= 1.05,
      `expected card reward-to-price ratio >= 1.05 for ${summary.characterId}, got ${summary.rewardToPriceRatio?.card}`
    );
    assert.ok(
      (summary.rewardToPriceRatio?.potion ?? 0) >= 0.75,
      `expected potion reward-to-price ratio >= 0.75 for ${summary.characterId}, got ${summary.rewardToPriceRatio?.potion}`
    );
  }
});

test('economy regression must expose net asset EVU growth checkpoints', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    assert.ok(summary.netAssetEVUByCheckpoint, `missing netAssetEVUByCheckpoint for ${summary.characterId}`);
    assert.ok(summary.netAssetEVUGrowthByFloor, `missing netAssetEVUGrowthByFloor for ${summary.characterId}`);
    assert.ok(summary.netAssetCoverageByCheckpoint, `missing netAssetCoverageByCheckpoint for ${summary.characterId}`);
    assert.equal(summary.netAssetEVUByCheckpoint?.length, 4, `expected 4 EVU checkpoints for ${summary.characterId}`);
    assert.equal(summary.netAssetEVUGrowthByFloor?.length, 3, `expected 3 EVU growth entries for ${summary.characterId}`);
    assert.equal(summary.netAssetCoverageByCheckpoint?.length, 4, `expected 4 EVU coverage entries for ${summary.characterId}`);
    for (const value of summary.netAssetEVUByCheckpoint || []) {
      assert.ok(Number.isFinite(value), `expected finite EVU checkpoint value for ${summary.characterId}, got ${value}`);
    }
    for (const value of summary.netAssetEVUGrowthByFloor || []) {
      assert.ok(Number.isFinite(value), `expected finite EVU growth value for ${summary.characterId}, got ${value}`);
    }
  }
});

test('economy regression must expose node distribution drift analysis', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    assert.ok(summary.nodeDistribution, `missing nodeDistribution for ${summary.characterId}`);
    assert.ok(summary.nodeDistribution?.generated, `missing generated node distribution for ${summary.characterId}`);
    assert.ok(summary.nodeDistribution?.resolved, `missing resolved node distribution for ${summary.characterId}`);
    assert.ok(summary.nodeDistribution?.absoluteDrift, `missing node drift distribution for ${summary.characterId}`);
    assert.ok(
      typeof summary.nodeDistribution?.totalVariationDistance === 'number',
      `missing totalVariationDistance for ${summary.characterId}`
    );
    assert.ok(
      (summary.nodeDistribution?.totalVariationDistance ?? -1) >= 0 &&
      (summary.nodeDistribution?.totalVariationDistance ?? 2) <= 1,
      `expected totalVariationDistance within [0,1] for ${summary.characterId}, got ${summary.nodeDistribution?.totalVariationDistance}`
    );
    assert.ok(summary.nodeDistribution?.generatedByFloor, `missing generatedByFloor for ${summary.characterId}`);
    assert.ok(summary.nodeDistribution?.resolvedByFloor, `missing resolvedByFloor for ${summary.characterId}`);
  }
});

test('shop prices must align to unified baseline at floor 1', () => {
  const economy = new EconomySystem();
  const prices = economy.calculateShopPrices(1);
  assert.equal(
    prices.cardCost,
    NUMERICS_BASELINE.pricing.cardCommon,
    `expected card cost ${NUMERICS_BASELINE.pricing.cardCommon} at floor 1, got ${prices.cardCost}`
  );
  assert.equal(
    prices.potionCost,
    NUMERICS_BASELINE.pricing.potionBase,
    `expected potion cost ${NUMERICS_BASELINE.pricing.potionBase} at floor 1, got ${prices.potionCost}`
  );
});

test('shop prices must grow with floor multiplier', () => {
  const economy = new EconomySystem();
  const prices1 = economy.calculateShopPrices(1);
  const prices3 = economy.calculateShopPrices(3);
  assert.ok(
    prices3.cardCost > prices1.cardCost,
    `expected card cost to grow from floor 1 to 3, got ${prices1.cardCost} -> ${prices3.cardCost}`
  );
  assert.ok(
    prices3.potionCost > prices1.potionCost,
    `expected potion cost to grow from floor 1 to 3, got ${prices1.potionCost} -> ${prices3.potionCost}`
  );
});

test('economy regression must expose resolvedByPolicy with balanced, aggressive, economy strategies', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    assert.ok(summary.resolvedByPolicy, `missing resolvedByPolicy for ${summary.characterId}`);
    assert.ok(summary.resolvedByPolicy?.balanced, `missing resolvedByPolicy.balanced for ${summary.characterId}`);
    assert.ok(summary.resolvedByPolicy?.aggressive, `missing resolvedByPolicy.aggressive for ${summary.characterId}`);
    assert.ok(summary.resolvedByPolicy?.economy, `missing resolvedByPolicy.economy for ${summary.characterId}`);
  }
});

test('balanced policy must have non-trivial node mix', () => {
  const payload = loadEconomyRegression();
  for (const summary of payload) {
    const balanced = summary.resolvedByPolicy?.balanced;
    assert.ok(balanced, `missing balanced policy for ${summary.characterId}`);
    const nodeDist = balanced?.nodeDistribution;
    assert.ok(nodeDist, `missing nodeDistribution for balanced policy of ${summary.characterId}`);
    const resolved = nodeDist?.resolved;
    assert.ok(resolved, `missing resolved nodes for balanced policy of ${summary.characterId}`);
    const nodeTypes = Object.keys(resolved || {});
    const nonZeroTypes = nodeTypes.filter(type => (resolved?.[type] || 0) > 0);
    assert.ok(
      nonZeroTypes.length >= 2,
      `expected balanced policy to have at least 2 node types with non-zero resolved count for ${summary.characterId}, got ${nonZeroTypes.length}: ${nonZeroTypes.join(', ')}`
    );
  }
});
