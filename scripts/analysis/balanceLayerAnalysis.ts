import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

interface BalanceMetric {
  name: string;
  category: 'survivability' | 'rhythm' | 'resource_loop' | 'economy' | 'deck_growth';
  baseline: { min: number; max: number };
  observed: number;
  weight: number;
}

interface BalanceLayer {
  category: BalanceMetric['category'];
  metrics: BalanceMetric[];
  score: number;
  status: 'green' | 'yellow' | 'red';
}

interface BalanceReport {
  timestamp: number;
  runId: string;
  seed: number;
  characterId: string;
  layers: BalanceLayer[];
  overallScore: number;
  overallStatus: 'green' | 'yellow' | 'red';
  outliers: {
    metric: string;
    expectedRange: [number, number];
    observed: number;
    deviation: number;
    likelyCauses: string[];
  }[];
}

const DEFAULT_BASELINES: Record<BalanceMetric['category'], { metrics: Record<string, { min: number; max: number; weight: number }> }> = {
  survivability: {
    metrics: {
      death_rate: { min: 0, max: 0.3, weight: 1.0 },
      average_hp_per_combat: { min: 5, max: 30, weight: 0.8 },
      first_two_turns_damage: { min: 0, max: 50, weight: 0.9 },
      block_efficiency: { min: 0.3, max: 0.8, weight: 0.7 },
    },
  },
  rhythm: {
    metrics: {
      average_turns_per_combat: { min: 3, max: 12, weight: 0.8 },
      combat_duration_variance: { min: 0, max: 5, weight: 0.6 },
      enemy_death_rate_by_turn: { min: 0.1, max: 0.5, weight: 0.7 },
    },
  },
  resource_loop: {
    metrics: {
      intel_usage_rate: { min: 0.2, max: 0.8, weight: 0.7 },
      devotion_contribution: { min: 0, max: 20, weight: 0.6 },
      corruption_penalty_rate: { min: 0, max: 0.3, weight: 0.8 },
      resource_gain_per_floor: { min: 0.5, max: 3, weight: 0.7 },
    },
  },
  economy: {
    metrics: {
      gold_per_floor: { min: 10, max: 50, weight: 0.7 },
      shop_purchase_rate: { min: 0.1, max: 0.6, weight: 0.6 },
      card_removal_rate: { min: 0, max: 0.3, weight: 0.5 },
      net_asset_evu: { min: 0, max: 500, weight: 0.8 },
    },
  },
  deck_growth: {
    metrics: {
      deck_size_growth_rate: { min: 0, max: 0.5, weight: 0.6 },
      card_quality_improvement: { min: 0, max: 1, weight: 0.7 },
      synergy_formation_rate: { min: 0, max: 0.8, weight: 0.5 },
    },
  },
};

function calculateLayerScore(metrics: BalanceMetric[]): number {
  if (metrics.length === 0) return 1;
  
  let totalWeight = 0;
  let weightedScore = 0;
  
  for (const metric of metrics) {
    const { min, max } = metric.baseline;
    const range = max - min;
    
    let normalizedScore = 1;
    if (metric.observed < min) {
      normalizedScore = Math.max(0, 1 - (min - metric.observed) / range);
    } else if (metric.observed > max) {
      normalizedScore = Math.max(0, 1 - (metric.observed - max) / range);
    }
    
    weightedScore += normalizedScore * metric.weight;
    totalWeight += metric.weight;
  }
  
  return totalWeight > 0 ? weightedScore / totalWeight : 1;
}

function determineStatus(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 0.8) return 'green';
  if (score >= 0.5) return 'yellow';
  return 'red';
}

export function generateBalanceReport(
  observedMetrics: Record<string, number>,
  runId: string,
  seed: number,
  characterId: string
): BalanceReport {
  const layers: BalanceLayer[] = [];
  const outliers: BalanceReport['outliers'] = [];
  
  for (const [category, config] of Object.entries(DEFAULT_BASELINES)) {
    const metrics: BalanceMetric[] = [];
    
    for (const [metricName, baseline] of Object.entries(config.metrics)) {
      const observed = observedMetrics[metricName] ?? baseline.min;
      
      const metric: BalanceMetric = {
        name: metricName,
        category: category as BalanceMetric['category'],
        baseline: { min: baseline.min, max: baseline.max },
        observed,
        weight: baseline.weight,
      };
      
      metrics.push(metric);
      
      if (observed < baseline.min || observed > baseline.max) {
        const deviation = observed < baseline.min 
          ? baseline.min - observed 
          : observed - baseline.max;
        
        outliers.push({
          metric: metricName,
          expectedRange: [baseline.min, baseline.max],
          observed,
          deviation,
          likelyCauses: inferLikelyCauses(metricName, observed, baseline),
        });
      }
    }
    
    const score = calculateLayerScore(metrics);
    
    layers.push({
      category: category as BalanceMetric['category'],
      metrics,
      score,
      status: determineStatus(score),
    });
  }
  
  const overallScore = layers.reduce((sum, l) => sum + l.score, 0) / layers.length;
  
  return {
    timestamp: Date.now(),
    runId,
    seed,
    characterId,
    layers,
    overallScore,
    overallStatus: determineStatus(overallScore),
    outliers,
  };
}

function inferLikelyCauses(metric: string, observed: number, baseline: { min: number; max: number }): string[] {
  const causes: string[] = [];
  
  if (metric === 'death_rate' && observed > baseline.max) {
    causes.push('enemy_damage_too_high');
    causes.push('player_block_insufficient');
    causes.push('healing_mechanics_weak');
  }
  
  if (metric === 'first_two_turns_damage' && observed > baseline.max) {
    causes.push('enemy_burst_damage_excessive');
    causes.push('starting_block_too_low');
  }
  
  if (metric === 'net_asset_evu' && observed < baseline.min) {
    causes.push('gold_rewards_too_low');
    causes.push('shop_prices_too_high');
    causes.push('removal_cost_excessive');
  }
  
  if (metric === 'intel_usage_rate' && observed < baseline.min) {
    causes.push('intel_gain_mechanics_weak');
    causes.push('intel_spend_opportunities_limited');
  }
  
  if (causes.length === 0) {
    causes.push('unknown_cause');
  }
  
  return causes;
}

export function formatReportAsMarkdown(report: BalanceReport): string {
  const lines: string[] = [];
  
  lines.push('# Balance Analysis Report');
  lines.push('');
  lines.push(`**Run ID**: ${report.runId}`);
  lines.push(`**Character**: ${report.characterId}`);
  lines.push(`**Seed**: ${report.seed}`);
  lines.push(`**Overall Score**: ${(report.overallScore * 100).toFixed(1)}% (${report.overallStatus.toUpperCase()})`);
  lines.push('');
  
  for (const layer of report.layers) {
    const statusIcon = layer.status === 'green' ? '✅' : layer.status === 'yellow' ? '⚠️' : '❌';
    lines.push(`## ${statusIcon} ${layer.category.toUpperCase()}`);
    lines.push('');
    lines.push(`**Score**: ${(layer.score * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('| Metric | Baseline | Observed | Status |');
    lines.push('|--------|----------|----------|--------|');
    
    for (const metric of layer.metrics) {
      const inRange = metric.observed >= metric.baseline.min && metric.observed <= metric.baseline.max;
      const status = inRange ? '✅' : '❌';
      lines.push(`| ${metric.name} | [${metric.baseline.min}, ${metric.baseline.max}] | ${metric.observed.toFixed(2)} | ${status} |`);
    }
    lines.push('');
  }
  
  if (report.outliers.length > 0) {
    lines.push('## 🚨 Outliers Detected');
    lines.push('');
    
    for (const outlier of report.outliers) {
      lines.push(`### ${outlier.metric}`);
      lines.push(`- **Expected**: [${outlier.expectedRange[0]}, ${outlier.expectedRange[1]}]`);
      lines.push(`- **Observed**: ${outlier.observed.toFixed(2)}`);
      lines.push(`- **Deviation**: ${outlier.deviation.toFixed(2)}`);
      lines.push(`- **Likely Causes**: ${outlier.likelyCauses.join(', ')}`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

export function formatTechnicalTable(report: BalanceReport): string {
  const lines: string[] = [];
  
  lines.push('category,metric,baseline_min,baseline_max,observed,weight,score');
  
  for (const layer of report.layers) {
    for (const metric of layer.metrics) {
      const inRange = metric.observed >= metric.baseline.min && metric.observed <= metric.baseline.max;
      const score = inRange ? 1 : 0;
      lines.push(`${layer.category},${metric.name},${metric.baseline.min},${metric.baseline.max},${metric.observed.toFixed(3)},${metric.weight},${score}`);
    }
  }
  
  return lines.join('\n');
}

if (require.main === module) {
  const sampleMetrics: Record<string, number> = {
    death_rate: 0.15,
    average_hp_per_combat: 20,
    first_two_turns_damage: 25,
    block_efficiency: 0.5,
    average_turns_per_combat: 7,
    combat_duration_variance: 2,
    enemy_death_rate_by_turn: 0.3,
    intel_usage_rate: 0.5,
    devotion_contribution: 10,
    corruption_penalty_rate: 0.1,
    resource_gain_per_floor: 1.5,
    gold_per_floor: 30,
    shop_purchase_rate: 0.3,
    card_removal_rate: 0.1,
    net_asset_evu: 200,
    deck_size_growth_rate: 0.2,
    card_quality_improvement: 0.5,
    synergy_formation_rate: 0.4,
  };
  
  const report = generateBalanceReport(sampleMetrics, 'test_run', 12345, 'informant');
  console.log(formatReportAsMarkdown(report));
}
