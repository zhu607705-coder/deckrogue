import type { GameState, CombatState } from '@/core/types';
import type { ResolutionPipelineDiagnostics } from '../actions/resolutionTypes';
import type { MechanicAuditSnapshot } from '../actions/mechanicDescriptor';

export interface SurvivabilityMetrics {
  averageHpPerCombat: number;
  averageDamageTakenPerTurn: number;
  averageBlockPerTurn: number;
  deathRate: number;
  averageTurnsPerCombat: number;
  firstTwoTurnsDamage: number;
  deathSources: Record<string, number>;
}

export interface ResourceLoopMetrics {
  averageIntelPerRun: number;
  averageDevotionPerRun: number;
  averageCorruptionPerRun: number;
  resourceUsageRate: Record<string, number>;
  resourceGainRate: Record<string, number>;
  averageResourceValuePerCombat: number;
}

export interface EconomyMetrics {
  averageGoldPerRun: number;
  shopPurchaseRate: Record<string, number>;
  cardRemovalRate: number;
  averageRewardQuality: number;
  netAssetEvu: number;
  deckFormationTime: number;
}

export interface EnchantmentMetrics {
  enchantmentPickupRate: number;
  averageEnchantmentValue: number;
  afflictionPenaltyRate: number;
  longTermValueContribution: number;
}

export interface ClassSpreadMetrics {
  winRateByClass: Record<string, number>;
  averageRunLengthByClass: Record<string, number>;
  damageOutputByClass: Record<string, number>;
  survivabilityByClass: Record<string, number>;
  spreadVariance: number;
}

export interface SettlementLatencyProfile {
  averageStepDuration: number;
  maxStepDuration: number;
  totalStepsPerCombat: number;
  stepsByWindow: Record<string, number>;
}

export interface TriggerFrequencyByWindow {
  window: string;
  count: number;
  averageIntentsPerTrigger: number;
}

export interface MechanicContributionScore {
  mechanicId: string;
  mechanicType: string;
  totalTriggers: number;
  totalMutations: number;
  contributionScore: number;
}

export interface BalanceOutlierCause {
  metric: string;
  expectedRange: [number, number];
  observed: number;
  deviation: number;
  likelyCauses: string[];
}

export interface BalanceReport {
  timestamp: number;
  runId: string;
  seed: number;
  characterId: string;
  survivability: SurvivabilityMetrics;
  resourceLoop: ResourceLoopMetrics;
  economy: EconomyMetrics;
  enchantment: EnchantmentMetrics;
  classSpread: ClassSpreadMetrics;
  settlementLatency: SettlementLatencyProfile;
  triggerFrequency: TriggerFrequencyByWindow[];
  mechanicContribution: MechanicContributionScore[];
  outliers: BalanceOutlierCause[];
}

export class BalanceReportGenerator {
  private combatHistory: {
    turn: number;
    damageTaken: number;
    blockGained: number;
    deathSource?: string;
  }[] = [];
  
  private resourceHistory: {
    resource: string;
    operation: 'gain' | 'spend';
    amount: number;
    turn: number;
  }[] = [];
  
  private economyHistory: {
    goldSpent: number;
    goldGained: number;
    purchases: { type: string; cost: number }[];
  }[] = [];
  
  private triggerHistory: {
    window: string;
    mechanicId: string;
    intentsGenerated: number;
  }[] = [];
  
  private settlementHistory: {
    duration: number;
    window: string;
    steps: number;
  }[] = [];

  recordCombatTurn(turn: number, damageTaken: number, blockGained: number): void {
    this.combatHistory.push({ turn, damageTaken, blockGained, deathSource: undefined });
  }

  recordDeath(source: string): void {
    if (this.combatHistory.length > 0) {
      this.combatHistory[this.combatHistory.length - 1].deathSource = source;
    }
  }

  recordResourceChange(resource: string, operation: 'gain' | 'spend', amount: number, turn: number): void {
    this.resourceHistory.push({ resource, operation, amount, turn });
  }

  recordEconomyEvent(goldSpent: number, goldGained: number, purchases: { type: string; cost: number }[]): void {
    this.economyHistory.push({ goldSpent, goldGained, purchases });
  }

  recordTrigger(window: string, mechanicId: string, intentsGenerated: number): void {
    this.triggerHistory.push({ window, mechanicId, intentsGenerated });
  }

  recordSettlement(duration: number, window: string, steps: number): void {
    this.settlementHistory.push({ duration, window, steps });
  }

  generateReport(state: GameState): BalanceReport {
    const survivability = this.calculateSurvivability();
    const resourceLoop = this.calculateResourceLoop();
    const economy = this.calculateEconomy();
    const enchantment = this.calculateEnchantment();
    const classSpread = this.calculateClassSpread(state);
    const settlementLatency = this.calculateSettlementLatency();
    const triggerFrequency = this.calculateTriggerFrequency();
    const mechanicContribution = this.calculateMechanicContribution();
    const outliers = this.detectOutliers(survivability, resourceLoop, economy);

    return {
      timestamp: Date.now(),
      runId: state.runId || 'unknown',
      seed: state.seed,
      characterId: state.character?.id || 'unknown',
      survivability,
      resourceLoop,
      economy,
      enchantment,
      classSpread,
      settlementLatency,
      triggerFrequency,
      mechanicContribution,
      outliers,
    };
  }

  private calculateSurvivability(): SurvivabilityMetrics {
    const totalDamage = this.combatHistory.reduce((sum, h) => sum + h.damageTaken, 0);
    const totalBlock = this.combatHistory.reduce((sum, h) => sum + h.blockGained, 0);
    const deaths = this.combatHistory.filter(h => h.deathSource).length;
    const totalTurns = this.combatHistory.length;
    const combats = new Set(this.combatHistory.map((_, i) => Math.floor(i / 10))).size;

    const firstTwoTurnsDamage = this.combatHistory
      .filter(h => h.turn <= 2)
      .reduce((sum, h) => sum + h.damageTaken, 0);

    const deathSources: Record<string, number> = {};
    for (const h of this.combatHistory) {
      if (h.deathSource) {
        deathSources[h.deathSource] = (deathSources[h.deathSource] || 0) + 1;
      }
    }

    return {
      averageHpPerCombat: totalDamage / Math.max(1, combats),
      averageDamageTakenPerTurn: totalDamage / Math.max(1, totalTurns),
      averageBlockPerTurn: totalBlock / Math.max(1, totalTurns),
      deathRate: deaths / Math.max(1, combats),
      averageTurnsPerCombat: totalTurns / Math.max(1, combats),
      firstTwoTurnsDamage,
      deathSources,
    };
  }

  private calculateResourceLoop(): ResourceLoopMetrics {
    const resourceTotals: Record<string, number> = {};
    const resourceUsage: Record<string, { gained: number; spent: number }> = {};

    for (const h of this.resourceHistory) {
      if (!resourceTotals[h.resource]) {
        resourceTotals[h.resource] = 0;
        resourceUsage[h.resource] = { gained: 0, spent: 0 };
      }
      
      if (h.operation === 'gain') {
        resourceTotals[h.resource] += h.amount;
        resourceUsage[h.resource].gained += h.amount;
      } else {
        resourceTotals[h.resource] -= h.amount;
        resourceUsage[h.resource].spent += h.amount;
      }
    }

    const usageRate: Record<string, number> = {};
    const gainRate: Record<string, number> = {};
    
    for (const [resource, usage] of Object.entries(resourceUsage)) {
      usageRate[resource] = usage.spent / Math.max(1, usage.gained);
      gainRate[resource] = usage.gained;
    }

    return {
      averageIntelPerRun: resourceTotals['intel'] || 0,
      averageDevotionPerRun: resourceTotals['devotion'] || 0,
      averageCorruptionPerRun: resourceTotals['corruption'] || 0,
      resourceUsageRate: usageRate,
      resourceGainRate: gainRate,
      averageResourceValuePerCombat: Object.values(resourceTotals).reduce((a, b) => a + b, 0) / Math.max(1, new Set(this.combatHistory.map((_, i) => Math.floor(i / 10))).size),
    };
  }

  private calculateEconomy(): EconomyMetrics {
    const totalGoldSpent = this.economyHistory.reduce((sum, h) => sum + h.goldSpent, 0);
    const totalGoldGained = this.economyHistory.reduce((sum, h) => sum + h.goldGained, 0);
    
    const purchaseCounts: Record<string, number> = {};
    for (const h of this.economyHistory) {
      for (const p of h.purchases) {
        purchaseCounts[p.type] = (purchaseCounts[p.type] || 0) + 1;
      }
    }

    const totalPurchases = Object.values(purchaseCounts).reduce((a, b) => a + b, 0);
    const shopPurchaseRate: Record<string, number> = {};
    for (const [type, count] of Object.entries(purchaseCounts)) {
      shopPurchaseRate[type] = count / Math.max(1, totalPurchases);
    }

    return {
      averageGoldPerRun: totalGoldGained - totalGoldSpent,
      shopPurchaseRate,
      cardRemovalRate: purchaseCounts['remove_card'] || 0,
      averageRewardQuality: totalGoldGained / Math.max(1, this.economyHistory.length),
      netAssetEvu: totalGoldGained - totalGoldSpent * 0.8,
      deckFormationTime: this.economyHistory.length,
    };
  }

  private calculateEnchantment(): EnchantmentMetrics {
    const enchantmentTriggers = this.triggerHistory.filter(h => 
      h.mechanicId.includes('enchantment') || h.mechanicId.includes('affliction')
    );
    
    return {
      enchantmentPickupRate: 0.5,
      averageEnchantmentValue: enchantmentTriggers.reduce((sum, h) => sum + h.intentsGenerated, 0) / Math.max(1, enchantmentTriggers.length),
      afflictionPenaltyRate: this.triggerHistory.filter(h => h.mechanicId.includes('affliction')).length / Math.max(1, this.triggerHistory.length),
      longTermValueContribution: enchantmentTriggers.length * 0.1,
    };
  }

  private calculateClassSpread(state: GameState): ClassSpreadMetrics {
    const characterId = state.character?.id || 'unknown';
    
    return {
      winRateByClass: { [characterId]: 1 },
      averageRunLengthByClass: { [characterId]: this.combatHistory.length },
      damageOutputByClass: { [characterId]: 100 },
      survivabilityByClass: { [characterId]: this.calculateSurvivability().averageHpPerCombat },
      spreadVariance: 0,
    };
  }

  private calculateSettlementLatency(): SettlementLatencyProfile {
    const durations = this.settlementHistory.map(h => h.duration);
    const stepsByWindow: Record<string, number> = {};
    
    for (const h of this.settlementHistory) {
      stepsByWindow[h.window] = (stepsByWindow[h.window] || 0) + h.steps;
    }

    return {
      averageStepDuration: durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length),
      maxStepDuration: Math.max(0, ...durations),
      totalStepsPerCombat: durations.length / Math.max(1, new Set(this.combatHistory.map((_, i) => Math.floor(i / 10))).size),
      stepsByWindow,
    };
  }

  private calculateTriggerFrequency(): TriggerFrequencyByWindow[] {
    const windowCounts: Record<string, { count: number; intents: number }> = {};
    
    for (const h of this.triggerHistory) {
      if (!windowCounts[h.window]) {
        windowCounts[h.window] = { count: 0, intents: 0 };
      }
      windowCounts[h.window].count++;
      windowCounts[h.window].intents += h.intentsGenerated;
    }

    return Object.entries(windowCounts).map(([window, data]) => ({
      window,
      count: data.count,
      averageIntentsPerTrigger: data.intents / Math.max(1, data.count),
    }));
  }

  private calculateMechanicContribution(): MechanicContributionScore[] {
    const mechanicCounts: Record<string, { type: string; triggers: number; mutations: number }> = {};
    
    for (const h of this.triggerHistory) {
      if (!mechanicCounts[h.mechanicId]) {
        mechanicCounts[h.mechanicId] = { type: 'unknown', triggers: 0, mutations: 0 };
      }
      mechanicCounts[h.mechanicId].triggers++;
      mechanicCounts[h.mechanicId].mutations += h.intentsGenerated;
    }

    return Object.entries(mechanicCounts).map(([id, data]) => ({
      mechanicId: id,
      mechanicType: data.type,
      totalTriggers: data.triggers,
      totalMutations: data.mutations,
      contributionScore: data.triggers * 0.5 + data.mutations * 0.3,
    }));
  }

  private detectOutliers(
    survivability: SurvivabilityMetrics,
    resourceLoop: ResourceLoopMetrics,
    economy: EconomyMetrics
  ): BalanceOutlierCause[] {
    const outliers: BalanceOutlierCause[] = [];

    if (survivability.deathRate > 0.3) {
      outliers.push({
        metric: 'deathRate',
        expectedRange: [0, 0.3],
        observed: survivability.deathRate,
        deviation: survivability.deathRate - 0.3,
        likelyCauses: ['enemy_damage_too_high', 'player_block_too_low', 'healing_insufficient'],
      });
    }

    if (survivability.firstTwoTurnsDamage > 50) {
      outliers.push({
        metric: 'firstTwoTurnsDamage',
        expectedRange: [0, 50],
        observed: survivability.firstTwoTurnsDamage,
        deviation: survivability.firstTwoTurnsDamage - 50,
        likelyCauses: ['enemy_burst_too_high', 'player_starting_block_insufficient'],
      });
    }

    if (economy.netAssetEvu < 0) {
      outliers.push({
        metric: 'netAssetEvu',
        expectedRange: [0, 500],
        observed: economy.netAssetEvu,
        deviation: -economy.netAssetEvu,
        likelyCauses: ['shop_prices_too_high', 'gold_rewards_too_low'],
      });
    }

    return outliers;
  }

  reset(): void {
    this.combatHistory = [];
    this.resourceHistory = [];
    this.economyHistory = [];
    this.triggerHistory = [];
    this.settlementHistory = [];
  }
}

export function formatReportAsMarkdown(report: BalanceReport): string {
  return `# Balance Report

**Run ID**: ${report.runId}  
**Character**: ${report.characterId}  
**Seed**: ${report.seed}  
**Timestamp**: ${new Date(report.timestamp).toISOString()}

## Survivability Metrics

| Metric | Value |
|--------|-------|
| Average HP per Combat | ${report.survivability.averageHpPerCombat.toFixed(2)} |
| Average Damage per Turn | ${report.survivability.averageDamageTakenPerTurn.toFixed(2)} |
| Average Block per Turn | ${report.survivability.averageBlockPerTurn.toFixed(2)} |
| Death Rate | ${(report.survivability.deathRate * 100).toFixed(1)}% |
| First 2 Turns Damage | ${report.survivability.firstTwoTurnsDamage.toFixed(2)} |

## Resource Loop Metrics

| Resource | Gained | Usage Rate |
|----------|--------|------------|
| Intel | ${report.resourceLoop.averageIntelPerRun.toFixed(2)} | ${(report.resourceLoop.resourceUsageRate['intel'] * 100 || 0).toFixed(1)}% |
| Devotion | ${report.resourceLoop.averageDevotionPerRun.toFixed(2)} | ${(report.resourceLoop.resourceUsageRate['devotion'] * 100 || 0).toFixed(1)}% |
| Corruption | ${report.resourceLoop.averageCorruptionPerRun.toFixed(2)} | ${(report.resourceLoop.resourceUsageRate['corruption'] * 100 || 0).toFixed(1)}% |

## Economy Metrics

| Metric | Value |
|--------|-------|
| Average Gold per Run | ${report.economy.averageGoldPerRun.toFixed(2)} |
| Card Removal Rate | ${report.economy.cardRemovalRate.toFixed(2)} |
| Net Asset EVU | ${report.economy.netAssetEvu.toFixed(2)} |

## Settlement Latency

| Metric | Value |
|--------|-------|
| Average Step Duration | ${report.settlementLatency.averageStepDuration.toFixed(2)}ms |
| Max Step Duration | ${report.settlementLatency.maxStepDuration.toFixed(2)}ms |
| Total Steps per Combat | ${report.settlementLatency.totalStepsPerCombat.toFixed(2)} |

## Outliers Detected

${report.outliers.length === 0 ? 'No outliers detected.' : report.outliers.map(o => 
  `- **${o.metric}**: Expected [${o.expectedRange[0]}, ${o.expectedRange[1]}], Observed ${o.observed.toFixed(2)} (deviation: ${o.deviation.toFixed(2)})`
).join('\n')}

## Likely Causes

${report.outliers.flatMap(o => o.likelyCauses).map(c => `- ${c}`).join('\n') || 'None identified.'}
`;
}
