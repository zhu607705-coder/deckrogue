import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../../src/core/events/gameEngine';
import { combatSystem } from '../../src/core/combat/combatSystem';
import { economySystem, EconomySystem } from '../../src/features/progression/economySystem';
import { balanceSystem } from '../../src/core/balance/balanceSystem';
import { synergySystem } from '../../src/features/synergies/synergySystem';
import { NUMERICS_BASELINE, warpPerilChance, warpPowerMultiplier } from '../../src/core/balance';
import charactersData from '../../src/content/data/characters.json';
import type { GameState } from '../../src/core/types';

type FindingKind = 'NaN' | 'Infinity' | 'Negative';
type Severity = 'error' | 'warn';

interface NumericFinding {
  kind: FindingKind;
  severity: Severity;
  source: string;
  path: string;
  value: number;
  context?: Record<string, unknown>;
}

interface CliOptions {
  runsPerClass: number;
  maxFloors: number;
  maxCombatTurns: number;
  targetClass?: string;
}

interface DriftMetric {
  name: string;
  baseline: number;
  observed: number;
  drift: number;
  severity: Severity;
}

interface DriftFinding {
  kind: 'BaselineDrift';
  severity: Severity;
  name: string;
  baseline: number;
  observed: number;
  drift: number;
}

const defaultOptions: CliOptions = {
  runsPerClass: 2,
  maxFloors: 3,
  maxCombatTurns: 8
};

function parseArgs(): CliOptions {
  const options = { ...defaultOptions };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--runs=')) options.runsPerClass = Math.max(1, Math.min(20, Number(arg.split('=')[1]) || options.runsPerClass));
    else if (arg.startsWith('--floors=')) options.maxFloors = Math.max(1, Math.min(10, Number(arg.split('=')[1]) || options.maxFloors));
    else if (arg.startsWith('--turns=')) options.maxCombatTurns = Math.max(1, Math.min(50, Number(arg.split('=')[1]) || options.maxCombatTurns));
    else if (arg.startsWith('--class=')) options.targetClass = arg.split('=')[1]?.toLowerCase();
  }
  return options;
}

function shouldAllowNegative(path: string): boolean {
  // Derived stats / coordinates could legitimately be negative in future; keep low-noise defaults.
  const allowPatterns = [
    '.x', // map coordinates may become centered around 0
    '.y'
  ];
  if (/\.actions\[\d+\]\.amount$/.test(path)) return true;
  if (/\.actions\[\d+\]\.bonus$/.test(path)) return true;
  if (/\.effect\.amount$/.test(path)) return true;
  return allowPatterns.some(pattern => path.endsWith(pattern));
}

function scanNumbers(
  value: unknown,
  source: string,
  path: string,
  findings: NumericFinding[],
  scanCounter: { count: number },
  seen = new WeakSet<object>()
): void {
  if (typeof value === 'number') {
    scanCounter.count += 1;
    if (Number.isNaN(value)) {
      findings.push({ kind: 'NaN', severity: 'error', source, path, value });
      return;
    }
    if (!Number.isFinite(value)) {
      findings.push({ kind: 'Infinity', severity: 'error', source, path, value });
      return;
    }
    if (value < 0 && !shouldAllowNegative(path)) {
      findings.push({ kind: 'Negative', severity: 'warn', source, path, value });
    }
    return;
  }

  if (!value || typeof value !== 'object') return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanNumbers(item, source, `${path}[${index}]`, findings, scanCounter, seen));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    scanNumbers(child, source, path ? `${path}.${key}` : key, findings, scanCounter, seen);
  }
}

function getSelectableNodes(engine: GameEngine) {
  const { map, currentNodeId, pendingNodeResolution } = engine.state;
  if (pendingNodeResolution) return [];
  if (!currentNodeId) return map.filter(n => n.y === 0);
  const current = map.find(n => n.id === currentNodeId);
  if (!current) return [];
  return current.next.map(id => map.find(n => n.id === id)).filter(Boolean) as typeof map;
}

function chooseNode(engine: GameEngine) {
  const candidates = getSelectableNodes(engine);
  if (candidates.length === 0) return null;
  const priority: Record<string, number> = { Combat: 0, Event: 1, Rest: 2, Shop: 3, Elite: 4, Boss: 99 };
  return [...candidates].sort((a, b) => (a.y - b.y) || ((priority[a.type] ?? 50) - (priority[b.type] ?? 50)) || (a.x - b.x))[0];
}

function getEnemyTargetId(engine: GameEngine): string | undefined {
  const combat = engine.state.combat;
  if (!combat) return undefined;
  const alive = combat.enemies.filter(e => e.hp > 0);
  if (!alive.length) return undefined;
  return alive.sort((a, b) => a.hp - b.hp)[0]?.id;
}

async function stepCombat(engine: GameEngine, maxTurns: number): Promise<void> {
  let safety = 0;
  while (engine.state.screen === 'Combat' && safety++ < 200) {
    const combat = engine.state.combat;
    if (!combat) return;
    if (combat.turn > maxTurns) {
      (engine.state as any).screen = 'GameOver';
      return;
    }

    if (!combat.isPlayerTurn) {
      await new Promise(resolve => setTimeout(resolve, 0));
      continue;
    }

    const playable = combat.hand.filter(card => (card.cost ?? 0) <= combat.player.energy);
    if (playable.length === 0) {
      await engine.endTurn();
      continue;
    }

    const card = playable[0];
    const targetId = card.targeting === 'Enemy' ? getEnemyTargetId(engine) : undefined;
    if (card.targeting === 'Enemy' && !targetId) {
      await engine.endTurn();
      continue;
    }
    await engine.playCard(card.instanceId!, targetId);
  }
}

function scanEconomy(findings: NumericFinding[], counters: Record<string, number>) {
  const counter = { count: 0 };
  for (let floor = 1; floor <= 10; floor++) {
    scanNumbers(economySystem.calculateEnemyScaling(floor), 'economy', `enemyScaling.floor${floor}`, findings, counter);
    scanNumbers(economySystem.calculateShopPrices(floor), 'economy', `shopPrices.floor${floor}`, findings, counter);
    scanNumbers(economySystem.calculateCombatRewards(floor, [], floor === 10 ? 'Boss' : floor % 4 === 0 ? 'Elite' : 'Combat'), 'economy', `combatRewards.floor${floor}`, findings, counter);
    scanNumbers(economySystem.getDifficultyRating(floor, 100), 'economy', `difficulty.floor${floor}`, findings, counter);
    scanNumbers(economySystem.getRarityRoll(floor), 'economy', `rarityRoll.floor${floor}`, findings, counter);
  }

  const seededA = new EconomySystem();
  seededA.configureRandomization({ seed: 999, rarityWeightMultipliers: { rare: 2 }, chanceMultipliers: { relicReward: 1.5 } });
  const seededB = new EconomySystem();
  seededB.configureRandomization({ seed: 999, rarityWeightMultipliers: { rare: 2 }, chanceMultipliers: { relicReward: 1.5 } });
  const seqA = [seededA.getRarityRoll(3), seededA.shouldOfferRelicReward(3), seededA.shouldOfferPotionReward()];
  const seqB = [seededB.getRarityRoll(3), seededB.shouldOfferRelicReward(3), seededB.shouldOfferPotionReward()];
  if (JSON.stringify(seqA) !== JSON.stringify(seqB)) {
    findings.push({
      kind: 'Negative',
      severity: 'error',
      source: 'economy',
      path: 'rng.reproducibility',
      value: -1,
      context: { seqA, seqB }
    });
  }
  counters.economy = counter.count;
}

function scanBalanceAndCombatFormulas(findings: NumericFinding[], counters: Record<string, number>) {
  const counter = { count: 0 };
  for (let floor = 1; floor <= 10; floor++) {
    scanNumbers(balanceSystem.calculateExpectedGoldGain(floor, false, false), 'balance', `expectedGold.floor${floor}`, findings, counter);
    scanNumbers(balanceSystem.calculateExpectedCardRewards(floor), 'balance', `expectedCards.floor${floor}`, findings, counter);
    scanNumbers(balanceSystem.calculateEnemyHpScaling(20, floor), 'balance', `enemyHpScale.floor${floor}`, findings, counter);
    scanNumbers(balanceSystem.calculateEnemyDamageScaling(8, floor), 'balance', `enemyDamageScale.floor${floor}`, findings, counter);
    scanNumbers(balanceSystem.calculateStatusSoftCap(2, floor + 5), 'balance', `statusSoftCap.floor${floor}`, findings, counter);
  }

  synergySystem.resetAll();
  const state = new GameEngine(123).state;
  state.player.corruption = 50;
  state.combat = {
    player: {
      hp: 50, maxHp: 50, block: 0, energy: 3, statuses: { Strength: 2 }, delayedCards: [], constructs: [], elements: [],
      potionToxicity: 0, potionsUsedThisTurn: 0, cardsPlayedThisTurn: 0, intel: 0, devotion: 0, corruptionAxis: 0, axisDisposition: 'balanced'
    },
    enemies: [{ id: 'e1', defId: 'test', name: 'Enemy', hp: 30, maxHp: 30, block: 0, statuses: { Vulnerable: 1 }, nextIntent: 'Attack', devotion: 0, corruptionAxis: 0, axisDisposition: 'balanced' }],
    drawPile: [], hand: [], discardPile: [], exhaustPile: [], turn: 1, isPlayerTurn: true, warpTide: 0, warpAlpha: 0.5, warpPerilK: 0.05
  } as any;
  const damage = combatSystem.calculateDamage(state, {
    amount: 14, sourceType: 'player', sourceId: 'player', targetType: 'enemy', targetId: 'e1', modifiers: [], isTrueDamage: false, ignoreBlock: false
  });
  scanNumbers(damage, 'combat', 'damage.sample', findings, counter);
  counters.formulas = counter.count;
}

async function scanRuntimeStates(options: CliOptions, findings: NumericFinding[], counters: Record<string, number>) {
  const counter = { count: 0 };
  const allCharacters = (charactersData as any[]).map(c => c.id);
  const characters = options.targetClass ? allCharacters.filter(id => id.toLowerCase() === options.targetClass) : allCharacters;

  for (const [classIndex, characterId] of characters.entries()) {
    for (let run = 0; run < options.runsPerClass; run++) {
      const engine = new GameEngine(10_000 + classIndex * 1_000 + run);
      engine.selectCharacter(characterId);
      scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.afterSelect`, findings, counter);

      let resolved = 0;
      let safety = 0;
      while (safety++ < 200 && resolved < options.maxFloors) {
        const screen = engine.state.screen;
        if (screen === 'GameOver' || screen === 'Victory') break;
        if (screen === 'Map') {
          const node = chooseNode(engine);
          if (!node || node.y >= options.maxFloors) break;
          engine.enterNode(node.id);
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.entered.${node.type}.f${node.y}`, findings, counter);
          continue;
        }
        if (screen === 'Combat') {
          await stepCombat(engine, options.maxCombatTurns);
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.combatStep`, findings, counter);
          continue;
        }
        if (screen === 'Reward') {
          if (engine.state.rewardCards[0]) engine.takeReward(engine.state.rewardCards[0].instanceId);
          else engine.skipReward();
          resolved += 1;
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.afterReward`, findings, counter);
          continue;
        }
        if (screen === 'Rest') {
          engine.restHeal();
          resolved += 1;
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.afterRest`, findings, counter);
          continue;
        }
        if (screen === 'Event') {
          engine.makeEventChoice('decline');
          resolved += 1;
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.afterEvent`, findings, counter);
          continue;
        }
        if (screen === 'Shop') {
          engine.leaveCurrentRoomToMap();
          resolved += 1;
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.afterShop`, findings, counter);
          continue;
        }
        if (screen === 'Upgrade') {
          const upgradable = engine.state.player.deck.find(c => c.upgrade && !c.isUpgraded);
          if (upgradable?.instanceId) engine.upgradeCard(upgradable.instanceId);
          else engine.leaveCurrentRoomToMap();
          scanNumbers(engine.state, 'runtime', `${characterId}.run${run}.afterUpgrade`, findings, counter);
          continue;
        }
        break;
      }
    }
  }

  counters.runtime = counter.count;
}

function summarize(findings: NumericFinding[]): { errors: number; warnings: number } {
  return {
    errors: findings.filter(f => f.severity === 'error').length,
    warnings: findings.filter(f => f.severity === 'warn').length
  };
}

function summarizeDrift(metrics: DriftMetric[]): { errors: number; warnings: number } {
  return {
    errors: metrics.filter(m => m.severity === 'error').length,
    warnings: metrics.filter(m => m.severity === 'warn').length
  };
}

function createDriftFindings(metrics: DriftMetric[]): DriftFinding[] {
  return metrics
    .filter(metric => metric.drift > 0.1)
    .map(metric => ({
      kind: 'BaselineDrift',
      severity: metric.severity,
      name: metric.name,
      baseline: metric.baseline,
      observed: metric.observed,
      drift: metric.drift
    }));
}

function calculateBaselineDrift(): DriftMetric[] {
  const metrics: DriftMetric[] = [];
  const pushMetric = (name: string, baseline: number, observed: number) => {
    const drift = baseline === 0 ? 0 : Math.abs(observed - baseline) / baseline;
    metrics.push({
      name,
      baseline,
      observed,
      drift,
      severity: drift > 0.2 ? 'error' : drift > 0.1 ? 'warn' : 'warn'
    });
  };

  pushMetric('resource.damage', NUMERICS_BASELINE.evu.damage, balanceSystem.damageToEnergy(1));
  pushMetric('resource.block', NUMERICS_BASELINE.evu.block, balanceSystem.blockToEnergy(1));
  pushMetric('resource.draw', NUMERICS_BASELINE.evu.draw, balanceSystem.drawToEnergy(1));

  const shop = economySystem.calculateShopPrices(1);
  pushMetric('price.card.common', NUMERICS_BASELINE.pricing.cardCommon, shop.cardCost);
  pushMetric('price.relic.base', NUMERICS_BASELINE.pricing.relicBase, shop.relicCost);
  pushMetric('price.potion.base', NUMERICS_BASELINE.pricing.potionBase, shop.potionCost);

  return metrics;
}

function calculateRiskSummary() {
  const points = [25, 50, 75, 90];
  return points.map((warpTide) => ({
    warpTide,
    multiplier: Number(warpPowerMultiplier(warpTide).toFixed(4)),
    perilChance: Number(warpPerilChance(warpTide).toFixed(4))
  }));
}

function writeArtifact(filename: string, payload: unknown): void {
  const outputDir = path.join(process.cwd(), 'output', 'numerics');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, filename), JSON.stringify(payload, null, 2));
}

async function main() {
  const options = parseArgs();
  const findings: NumericFinding[] = [];
  const scanCounts: Record<string, number> = {};

  scanEconomy(findings, scanCounts);
  scanBalanceAndCombatFormulas(findings, scanCounts);
  await scanRuntimeStates(options, findings, scanCounts);

  const summary = summarize(findings);
  const driftMetrics = calculateBaselineDrift();
  const driftFindings = createDriftFindings(driftMetrics);
  const driftSummary = summarizeDrift(driftMetrics);
  const riskSummary = calculateRiskSummary();
  const diagnosticsPayload = {
    options,
    scanCounts,
    summary: {
      errors: summary.errors + driftSummary.errors,
      warnings: summary.warnings + driftSummary.warnings
    },
    anomalySummary: summary,
    driftSummary,
    driftMetrics,
    driftFindings,
    riskSummary,
    findings
  };
  console.log('=== Numeric Diagnostics ===');
  console.log(`Scanned numbers: ${Object.entries(scanCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`Findings: errors=${diagnosticsPayload.summary.errors}, warnings=${diagnosticsPayload.summary.warnings}`);
  console.log(`Baseline drift metrics: ${driftMetrics.length}`);

  if (findings.length > 0) {
    console.log('\nTop findings:');
    for (const finding of findings.slice(0, 50)) {
      console.log(`- [${finding.severity}] ${finding.kind} @ ${finding.source}:${finding.path} => ${String(finding.value)}`);
      if (finding.context) {
        console.log(`  context: ${JSON.stringify(finding.context)}`);
      }
    }
  } else {
    console.log('No numeric anomalies detected.');
  }

  if (driftFindings.length > 0) {
    console.log('\nBaseline drift findings:');
    for (const finding of driftFindings) {
      console.log(
        `- [${finding.severity}] ${finding.name}: baseline=${finding.baseline}, observed=${finding.observed}, drift=${finding.drift.toFixed(4)}`
      );
    }
  }

  console.log('\nJSON:');
  console.log(JSON.stringify(diagnosticsPayload, null, 2));
  writeArtifact('baseline_audit.json', diagnosticsPayload);

  if (diagnosticsPayload.summary.errors > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
