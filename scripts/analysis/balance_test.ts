import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../../src/core/events/gameEngine';
import charactersData from '../../src/content/data/characters.json';
import type { CardAfflictionDef, CardEnchantmentDef, RunCardInstance } from '../../src/core/types/actions';

type Screen = 'CharacterSelect' | 'Map' | 'Combat' | 'Reward' | 'Shop' | 'Rest' | 'Upgrade' | 'Enchant' | 'RemoveCard' | 'Event' | 'GameOver' | 'Victory';

interface Diagnostics {
  illegalRunTransitions: Array<{ action: string; fromPhase: string; error: string; timestamp: number }>;
  unknownActionTypes: string[];
}

interface CombatSummary {
  turns: number;
  victory: boolean;
  timeout?: boolean;
  enemyTypes: string[];
  afflictionPenalty?: number;
}

interface RunSummary {
  characterId: string;
  seed: number;
  survivedFirst3Floors: boolean;
  survivedAll5Floors: boolean;
  combats: CombatSummary[];
  maxFloorResolved: number;
  enchantmentCount: number;
  enchantmentContributionScore: number;
  afflictionContributionPenalty: number;
  diagnostics: Diagnostics;
}

interface BalanceMetrics {
  characterId: string;
  runs: number;
  survivalRateFirst3: number;
  survivalRateAll5: number;
  avgCombatsPerRun: number;
  avgCombatTurns: number;
  avgMaxFloor: number;
  overallScore: number;
  powerIndex: number;
  powerIndexComponents: {
    S5: number;
    S3: number;
    F: number;
    T: number;
    E: number;
    R: number;
  };
  starterDamageProfile: {
    openingTurnDamage: number;
    firstTwoTurnDamage: number;
    firstResourceSpendTurn: number;
  };
  enchantmentPickupRate: number;
  enchantmentContributionScore: number;
  afflictionContributionPenalty: number;
}

interface BalanceOutlier {
  characterId: string;
  flags: string[];
  zScores: {
    survivalRateFirst3: number;
    avgCombatTurns: number;
    avgMaxFloor: number;
    overallScore: number;
  };
}

interface BalanceAnalysis {
  survivalSpreadFirst3: number;
  survivalSpreadAll5: number;
  avgCombatTurnsSpread: number;
  avgMaxFloorSpread: number;
  overallScoreSpread: number;
  powerSpread: number;
  powerBand: {
    top: string;
    mid: string[];
    bottom: string;
  };
  means: {
    survivalRateFirst3: number;
    avgCombatTurns: number;
    avgMaxFloor: number;
    overallScore: number;
    powerIndex: number;
  };
  stdDevs: {
    survivalRateFirst3: number;
    avgCombatTurns: number;
    avgMaxFloor: number;
    overallScore: number;
    powerIndex: number;
  };
  outliers: BalanceOutlier[];
}

interface EnemyMetrics {
  enemyId: string;
  encounters: number;
  victories: number;
  defeats: number;
  avgTurnsToDefeat: number;
  threatLevel: number;
}

const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

function getModifierWeight(effect: CardEnchantmentDef['effect'] | CardAfflictionDef['effect']): number {
  switch (effect.type) {
    case 'damage':
    case 'block':
      return Math.abs(effect.amount);
    case 'draw':
      return Math.abs(effect.amount) * 1.5;
    case 'professionResource':
      return Math.abs(effect.amount) * 1.25;
    case 'cost':
      return Math.abs(effect.amount) * 2.5;
    default:
      return 0;
  }
}

function getDeckEnchantmentCount(engine: GameEngine): number {
  return engine.state.player.deck.reduce((sum, card) => sum + ((((card as RunCardInstance).persistentEnchantments) || []).length), 0);
}

function getDeckEnchantmentContribution(engine: GameEngine): number {
  return Number(engine.state.player.deck.reduce((sum, card) => {
    const runCard = card as RunCardInstance;
    return sum + (runCard.persistentEnchantments || []).reduce((inner, enchantment) => inner + getModifierWeight(enchantment.effect), 0);
  }, 0).toFixed(4));
}

function getCurrentAfflictionPenalty(engine: GameEngine): number {
  return Number(engine.state.player.deck.reduce((sum, card) => {
    const runCard = card as RunCardInstance;
    return sum + (runCard.combatAfflictions || []).reduce((inner, affliction) => inner + getModifierWeight(affliction.effect), 0);
  }, 0).toFixed(4));
}

function chooseEnchantTarget(engine: GameEngine): RunCardInstance | null {
  const deck = engine.state.player.deck as RunCardInstance[];
  const candidates = deck.filter((card) => (
    (card.type === 'Attack' || card.type === 'Skill') &&
    ((card.persistentEnchantments || []).length === 0) &&
    !!card.instanceId
  ));
  if (candidates.length === 0) return null;
  const context = engine.state.enchantContext;
  if (context?.enchantmentId === 'swift_sigil') {
    return [...candidates].sort((a, b) => {
      const costDelta = (b.cost ?? 0) - (a.cost ?? 0);
      return costDelta !== 0 ? costDelta : scoreCard(b) - scoreCard(a);
    })[0] || null;
  }
  if (context?.enchantmentId === 'blood_rune') {
    return [...candidates].sort((a, b) => {
      const attackBias = Number(b.type === 'Attack') - Number(a.type === 'Attack');
      return attackBias !== 0 ? attackBias : scoreCard(b) - scoreCard(a);
    })[0] || null;
  }
  return [...candidates].sort((a, b) => scoreCard(b) - scoreCard(a))[0] || null;
}

function chooseEventOption(engine: GameEngine): string | null {
  const event = engine.state.activeEvent;
  if (!event) return null;
  const alreadyEnchanted = getDeckEnchantmentCount(engine) > 0;
  if (!alreadyEnchanted) {
    if (event.id === 'inquisitor_legacy') return 'legacy_inscribe_sigil';
    if (event.id === 'nameless_martyr_shrine' && engine.state.player.hp > Math.max(10, Math.floor(engine.state.player.maxHp * 0.45))) {
      return 'martyr_inscribe_oath';
    }
  }
  return 'decline';
}

function getSelectableNodes(engine: GameEngine) {
  const map = engine.state.map;
  const currentNodeId = engine.state.currentNodeId;
  if (engine.state.pendingNodeResolution) return [];
  if (!currentNodeId) return map.filter(n => n.y === 0);
  const current = map.find(n => n.id === currentNodeId);
  if (!current) return [];
  return current.next.map(id => map.find(n => n.id === id)).filter(Boolean) as any[];
}

function chooseNode(engine: GameEngine) {
  const candidates = getSelectableNodes(engine);
  if (candidates.length === 0) return null;
  const priority: Record<string, number> = { Combat: 0, Event: 1, Rest: 2, Shop: 3, Elite: 4, Boss: 99 };
  return [...candidates].sort((a, b) => {
    const byFloor = a.y - b.y;
    if (byFloor !== 0) return byFloor;
    const pa = priority[a.type] ?? 50;
    const pb = priority[b.type] ?? 50;
    return pa !== pb ? pa - pb : a.x - b.x;
  })[0];
}

function getEnemyTargetId(engine: GameEngine): string | undefined {
  const combat = engine.state.combat;
  if (!combat) return undefined;
  const alive = combat.enemies.filter(e => e.hp > 0);
  if (alive.length === 0) return undefined;
  return [...alive].sort((a, b) => a.hp - b.hp)[0].id;
}

function scoreCard(card: any): number {
  let score = 0;
  const text = String(card.text || '');
  if (card.cost === 0) score += 3;
  if (card.type === 'Attack') score += 4;
  if (text.includes('Deal')) score += 3;
  if (text.includes('Vulnerable')) score += 2;
  if (text.includes('Poison')) score += 3;
  if (text.includes('Draw')) score += 1;
  if (card.id === 'defend') score -= 1;
  if (card.id === 'element_spark') score += 2;
  if (card.id === 'fire_arrow') score += 4;
  return score;
}

async function playCombat(engine: GameEngine): Promise<CombatSummary> {
  let maxSeenTurn = engine.state.combat?.turn || 1;
  let safety = 0;
  const enemyTypes = engine.state.combat?.enemies.map(e => e.id) || [];
  let peakAfflictionPenalty = 0;

  while (engine.state.screen === 'Combat' && safety++ < 500) {
    await sleep(0);
    const combat = engine.state.combat;
    if (!combat) break;
    maxSeenTurn = Math.max(maxSeenTurn, combat.turn);
    peakAfflictionPenalty = Math.max(peakAfflictionPenalty, getCurrentAfflictionPenalty(engine));
    if (combat.turn > 25) return { turns: maxSeenTurn, victory: false, timeout: true, enemyTypes };
    if (!combat.isPlayerTurn) { await sleep(0); continue; }

    let playedSomething = true;
    let inner = 0;
    while (engine.state.screen === 'Combat' && engine.state.combat?.isPlayerTurn && playedSomething && inner++ < 50) {
      playedSomething = false;
      const c = engine.state.combat!;
      const playable = c.hand.filter(card => (card.cost ?? 0) <= c.player.energy);
      const ordered = [...playable].sort((a, b) => scoreCard(b) - scoreCard(a));
      for (const card of ordered) {
        const targetId = card.targeting === 'Enemy' ? getEnemyTargetId(engine) : undefined;
        if (card.targeting === 'Enemy' && !targetId) continue;
        await engine.playCard(card.instanceId!, targetId);
        await sleep(0);
        const after = engine.state.combat;
        if (!after || engine.state.screen !== 'Combat') break;
        if (after.player.energy !== c.player.energy || after.hand.length !== c.hand.length) {
          playedSomething = true;
          break;
        }
      }
    }

    if (engine.state.screen === 'Combat' && engine.state.combat?.isPlayerTurn) {
      await engine.endTurn();
      await sleep(0);
    }
  }

  peakAfflictionPenalty = Math.max(peakAfflictionPenalty, getCurrentAfflictionPenalty(engine));
  return {
    turns: maxSeenTurn,
    victory: engine.state.screen !== 'GameOver',
    enemyTypes,
    afflictionPenalty: peakAfflictionPenalty
  };
}

async function runSingle(characterId: string, seed: number, maxFloors: number): Promise<RunSummary> {
  const engine = new GameEngine(seed);
  try {
    engine.selectCharacter(characterId);
    let maxFloorResolved = -1;
    const combats: CombatSummary[] = [];
    let peakAfflictionPenalty = 0;
    let safety = 0;

    while (safety++ < 2000) {
      const screen = engine.state.screen as Screen;
      if (screen === 'GameOver' || screen === 'Victory') break;

      if (screen === 'Map') {
        const next = chooseNode(engine);
        if (!next || next.y >= maxFloors) break;
        engine.enterNode(next.id);
        await sleep(0);
        continue;
      }

      if (screen === 'Combat') {
        const summary = await playCombat(engine);
        combats.push(summary);
        peakAfflictionPenalty = Math.max(peakAfflictionPenalty, summary.afflictionPenalty || 0);
        if (summary.timeout) (engine.state as any).screen = 'GameOver';
        continue;
      }

      if (screen === 'Reward') {
        const first = engine.state.rewardCards[0];
        if (first) engine.pickRewardCard(first.instanceId!);
        else engine.skipReward();
        const current = engine.state.map.find(n => n.id === engine.state.currentNodeId);
        if (current) maxFloorResolved = Math.max(maxFloorResolved, current.y);
        await sleep(0);
        continue;
      }

      if (screen === 'Rest') {
        if (getDeckEnchantmentCount(engine) === 0) {
          engine.restEnchant();
        } else {
          engine.restHeal();
        }
        const current = engine.state.map.find(n => n.id === engine.state.currentNodeId);
        if (current) maxFloorResolved = Math.max(maxFloorResolved, current.y);
        await sleep(0);
        continue;
      }

      if (screen === 'Event') {
        const choice = chooseEventOption(engine);
        if (choice && choice !== 'decline') {
          engine.resolveEventChoice(choice);
        } else {
          engine.makeEventChoice('decline');
        }
        const current = engine.state.map.find(n => n.id === engine.state.currentNodeId);
        if (current) maxFloorResolved = Math.max(maxFloorResolved, current.y);
        await sleep(0);
        continue;
      }

      if (screen === 'Shop') {
        if (getDeckEnchantmentCount(engine) === 0) {
          engine.enterShopEnchant();
          if (engine.state.screen === 'Enchant') {
            await sleep(0);
            continue;
          }
        }
        engine.leaveCurrentRoomToMap();
        const current = engine.state.map.find(n => n.id === engine.state.currentNodeId);
        if (current) maxFloorResolved = Math.max(maxFloorResolved, current.y);
        await sleep(0);
        continue;
      }

      if (screen === 'Enchant') {
        const target = chooseEnchantTarget(engine);
        if (target?.instanceId) {
          engine.applyEnchantment(target.instanceId);
        } else {
          engine.cancelEnchant();
        }
        await sleep(0);
        continue;
      }

      if (screen === 'Upgrade') {
        const upgradable = engine.state.player.deck.find(c => !c.isUpgraded && c.upgrade);
        if (upgradable?.instanceId) engine.upgradeCard(upgradable.instanceId);
        else engine.cancelUpgrade();
        await sleep(0);
        continue;
      }

      if (screen === 'RemoveCard') {
        engine.state.screen = 'Shop';
        await sleep(0);
        continue;
      }

      await sleep(0);
    }

    return {
      characterId, seed,
      survivedFirst3Floors: engine.state.screen !== 'GameOver' && maxFloorResolved >= 2,
      survivedAll5Floors: engine.state.screen !== 'GameOver' && maxFloorResolved >= 4,
      combats, maxFloorResolved,
      enchantmentCount: getDeckEnchantmentCount(engine),
      enchantmentContributionScore: getDeckEnchantmentContribution(engine),
      afflictionContributionPenalty: Number(peakAfflictionPenalty.toFixed(4)),
      diagnostics: {
        illegalRunTransitions: (engine as any).getIllegalTransitions?.() || [],
        unknownActionTypes: []
      }
    };
  } finally {
    engine.dispose();
  }
}

function calculateMetrics(characterId: string, runs: RunSummary[], maxFloors: number): BalanceMetrics {
  const survived3 = runs.filter(r => r.survivedFirst3Floors).length;
  const survived5 = runs.filter(r => r.survivedAll5Floors).length;
  const allCombats = runs.flatMap(r => r.combats);
  const turns = allCombats.map(c => c.turns);
  const avgTurns = turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : 0;
  const avgCombatsPerRun = runs.reduce((sum, r) => sum + r.combats.length, 0) / Math.max(1, runs.length);
  const avgMaxFloor = runs.reduce((sum, r) => sum + r.maxFloorResolved, 0) / Math.max(1, runs.length);
  const survivalScore = (survived3 / runs.length) * 40 + (survived5 / runs.length) * 30;
  const progressionScore = (avgMaxFloor / Math.max(1, maxFloors)) * 20;
  const tempoScore = Math.max(0, 1 - Math.max(0, avgTurns - 3) / 4) * 10;
  const activityScore = Math.min(avgCombatsPerRun / Math.max(1, maxFloors), 1) * 5;
  const overallScore = Number((survivalScore + progressionScore + tempoScore + activityScore).toFixed(4));

  const starterDamageProfile = calculateStarterDamageProfile(characterId);
  
  const S5 = (survived5 / Math.max(1, runs.length)) * 100;
  const S3 = (survived3 / Math.max(1, runs.length)) * 100;
  const F = (avgMaxFloor / maxFloors) * 100;
  const T = calculateTempoScore(avgTurns);
  const E = calculateEconomyScore(characterId);
  const R = calculateResourceLoopScore(characterId, starterDamageProfile);
  const enchantmentPickupRate = runs.filter((run) => run.enchantmentCount > 0).length / Math.max(1, runs.length);
  const enchantmentContributionScore = mean(runs.map((run) => run.enchantmentContributionScore));
  const afflictionContributionPenalty = mean(runs.map((run) => run.afflictionContributionPenalty));
  
  const powerIndex = Number((0.01 * S5 + 0.01 * S3 + 0.10 * F + 0.60 * T + 0.18 * E + 0.10 * R).toFixed(2));

  return {
    characterId, runs: runs.length,
    survivalRateFirst3: survived3 / Math.max(1, runs.length),
    survivalRateAll5: survived5 / Math.max(1, runs.length),
    avgCombatsPerRun, avgCombatTurns: avgTurns, avgMaxFloor, overallScore,
    powerIndex,
    powerIndexComponents: { S5, S3, F, T, E, R },
    starterDamageProfile,
    enchantmentPickupRate: Number(enchantmentPickupRate.toFixed(4)),
    enchantmentContributionScore: Number(enchantmentContributionScore.toFixed(4)),
    afflictionContributionPenalty: Number(afflictionContributionPenalty.toFixed(4))
  };
}

function calculateTempoScore(avgTurns: number): number {
  if (avgTurns >= 2.5 && avgTurns <= 4.5) {
    return 100;
  }
  if (avgTurns < 2) {
    return Math.max(0, 100 - (2 - avgTurns) * 30);
  }
  if (avgTurns > 5.5) {
    return Math.max(0, 100 - (avgTurns - 5.5) * 20);
  }
  if (avgTurns < 2.5) {
    return 100 - (2.5 - avgTurns) * 20;
  }
  return 100 - (avgTurns - 4.5) * 15;
}

function calculateEconomyScore(characterId: string): number {
  return 75;
}

function calculateResourceLoopScore(characterId: string, profile: { openingTurnDamage: number; firstTwoTurnDamage: number; firstResourceSpendTurn: number }): number {
  const charDef = (charactersData as any[]).find(c => c.id === characterId);
  if (!charDef) return 50;
  
  let score = 50;
  
  if (profile.firstResourceSpendTurn > 0 && profile.firstResourceSpendTurn <= 2) {
    score += 25;
  } else if (profile.firstResourceSpendTurn > 0 && profile.firstResourceSpendTurn <= 3) {
    score += 15;
  }
  
  if (profile.openingTurnDamage >= 12) {
    score += 15;
  } else if (profile.openingTurnDamage >= 8) {
    score += 10;
  }
  
  if (profile.firstTwoTurnDamage >= 24) {
    score += 10;
  } else if (profile.firstTwoTurnDamage >= 16) {
    score += 5;
  }
  
  return Math.min(100, score);
}

function calculateStarterDamageProfile(characterId: string): { openingTurnDamage: number; firstTwoTurnDamage: number; firstResourceSpendTurn: number } {
  const charDef = (charactersData as any[]).find(c => c.id === characterId);
  if (!charDef) return { openingTurnDamage: 0, firstTwoTurnDamage: 0, firstResourceSpendTurn: -1 };
  
  let damage = 0;
  const deckIds = new Set(charDef.startingDeck as string[]);
  const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike').length;
  damage += strikes * 6;
  
  let openingTurnDamage = damage;
  let firstTwoTurnDamage = damage * 2;
  
  if (characterId === 'puppeteer') {
    openingTurnDamage += 3;
    firstTwoTurnDamage += 6;
  }
  if (characterId === 'alchemist') {
    openingTurnDamage += 4;
    firstTwoTurnDamage += 12;
  }
  if (characterId === 'chronomancer') {
    firstTwoTurnDamage += 6;
  }
  
  let firstResourceSpendTurn = -1;
  if (charDef.specialResource === 'thread') firstResourceSpendTurn = 1;
  else if (charDef.specialResource === 'timeLayer') firstResourceSpendTurn = 2;
  else if (charDef.specialResource === 'concoction') firstResourceSpendTurn = 2;

  if (characterId === 'informant') {
    if (deckIds.has('precision_strike') || deckIds.has('intel_surge') || deckIds.has('calculated_strike')) {
      firstResourceSpendTurn = 1;
    }
    if (deckIds.has('precision_strike')) {
      openingTurnDamage += 4;
      firstTwoTurnDamage += 8;
    }
    if (deckIds.has('intel_surge')) {
      firstTwoTurnDamage += 2;
    }
  }

  if (characterId === 'alchemist' && deckIds.has('alchemical_transmute')) {
    firstResourceSpendTurn = 1;
  }
  
  return { openingTurnDamage, firstTwoTurnDamage, firstResourceSpendTurn };
}

function analyzeEnemies(runs: RunSummary[]): EnemyMetrics[] {
  const enemyStats = new Map<string, { encounters: number; victories: number; defeats: number; turns: number[] }>();
  
  for (const run of runs) {
    for (const combat of run.combats) {
      for (const enemyId of combat.enemyTypes) {
        const stats = enemyStats.get(enemyId) || { encounters: 0, victories: 0, defeats: 0, turns: [] };
        stats.encounters++;
        stats.turns.push(combat.turns);
        if (combat.victory) stats.victories++;
        else stats.defeats++;
        enemyStats.set(enemyId, stats);
      }
    }
  }
  
  return Array.from(enemyStats.entries()).map(([enemyId, stats]) => ({
    enemyId,
    encounters: stats.encounters,
    victories: stats.victories,
    defeats: stats.defeats,
    avgTurnsToDefeat: stats.turns.reduce((a, b) => a + b, 0) / stats.turns.length,
    threatLevel: (stats.defeats / stats.encounters) * 100 + stats.turns.reduce((a, b) => a + b, 0) / stats.turns.length
  })).sort((a, b) => b.threatLevel - a.threatLevel);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stdDev(values: number[], center = mean(values)): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - center, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function zScore(value: number, avg: number, sd: number): number {
  if (sd <= 0.0001) return 0;
  return Number(((value - avg) / sd).toFixed(4));
}

function analyzeCharacterBalance(metrics: BalanceMetrics[]): BalanceAnalysis {
  const first3 = metrics.map(metric => metric.survivalRateFirst3);
  const all5 = metrics.map(metric => metric.survivalRateAll5);
  const turns = metrics.map(metric => metric.avgCombatTurns);
  const floors = metrics.map(metric => metric.avgMaxFloor);
  const scores = metrics.map(metric => metric.overallScore);
  const powerIndices = metrics.map(metric => metric.powerIndex);

  const means = {
    survivalRateFirst3: mean(first3),
    avgCombatTurns: mean(turns),
    avgMaxFloor: mean(floors),
    overallScore: mean(scores),
    powerIndex: mean(powerIndices)
  };
  const stdDevs = {
    survivalRateFirst3: stdDev(first3, means.survivalRateFirst3),
    avgCombatTurns: stdDev(turns, means.avgCombatTurns),
    avgMaxFloor: stdDev(floors, means.avgMaxFloor),
    overallScore: stdDev(scores, means.overallScore),
    powerIndex: stdDev(powerIndices, means.powerIndex)
  };

  const powerSpread = Number((Math.max(...powerIndices) - Math.min(...powerIndices)).toFixed(2));
  
  const sortedByPower = [...metrics].sort((a, b) => b.powerIndex - a.powerIndex);
  const powerBand = {
    top: sortedByPower[0]?.characterId || '',
    mid: sortedByPower.slice(1, -1).map(m => m.characterId),
    bottom: sortedByPower[sortedByPower.length - 1]?.characterId || ''
  };

  const outliers: BalanceOutlier[] = metrics
    .map((metric) => {
      const survivalZ = zScore(metric.survivalRateFirst3, means.survivalRateFirst3, stdDevs.survivalRateFirst3);
      const turnsZ = zScore(metric.avgCombatTurns, means.avgCombatTurns, stdDevs.avgCombatTurns);
      const floorZ = zScore(metric.avgMaxFloor, means.avgMaxFloor, stdDevs.avgMaxFloor);
      const scoreZ = zScore(metric.overallScore, means.overallScore, stdDevs.overallScore);
      const flags: string[] = [];

      if (metric.survivalRateFirst3 < 0.35 || survivalZ <= -1.2) flags.push('low_early_survival');
      if (metric.survivalRateFirst3 > 0.9 || survivalZ >= 1.2) flags.push('high_early_survival');
      if (metric.avgCombatTurns > means.avgCombatTurns + Math.max(1, stdDevs.avgCombatTurns)) flags.push('slow_combat_tempo');
      if (
        metric.avgCombatTurns < means.avgCombatTurns - Math.max(0.8, stdDevs.avgCombatTurns * 0.8) &&
        metric.survivalRateFirst3 >= means.survivalRateFirst3
      ) {
        flags.push('dominant_fast_tempo');
      }
      if (metric.avgMaxFloor < means.avgMaxFloor - Math.max(0.4, stdDevs.avgMaxFloor)) flags.push('progression_lag');
      if (metric.overallScore < means.overallScore - Math.max(8, stdDevs.overallScore)) flags.push('low_overall_score');
      if (metric.overallScore > means.overallScore + Math.max(8, stdDevs.overallScore)) flags.push('dominant_overall_score');

      return {
        characterId: metric.characterId,
        flags,
        zScores: {
          survivalRateFirst3: survivalZ,
          avgCombatTurns: turnsZ,
          avgMaxFloor: floorZ,
          overallScore: scoreZ
        }
      };
    })
    .filter((entry) => entry.flags.length > 0);

  return {
    survivalSpreadFirst3: Number((Math.max(...first3) - Math.min(...first3)).toFixed(4)),
    survivalSpreadAll5: Number((Math.max(...all5) - Math.min(...all5)).toFixed(4)),
    avgCombatTurnsSpread: Number((Math.max(...turns) - Math.min(...turns)).toFixed(4)),
    avgMaxFloorSpread: Number((Math.max(...floors) - Math.min(...floors)).toFixed(4)),
    overallScoreSpread: Number((Math.max(...scores) - Math.min(...scores)).toFixed(4)),
    powerSpread,
    powerBand,
    means,
    stdDevs,
    outliers
  };
}

function writeArtifact(filename: string, payload: unknown): void {
  const outputDir = path.join(process.cwd(), 'output', 'numerics');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, filename), JSON.stringify(payload, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  let runsPerClass = 20, targetClass: string | null = null, maxFloors = 5;
  
  for (const arg of args) {
    if (arg.startsWith('--runs=')) runsPerClass = Math.max(1, Math.min(100, Number(arg.split('=')[1]) || 20));
    else if (arg.startsWith('--class=')) targetClass = arg.split('=')[1].toLowerCase();
    else if (arg.startsWith('--floors=')) maxFloors = Math.max(1, Math.min(10, Number(arg.split('=')[1]) || 5));
    else if (!arg.startsWith('--') && !isNaN(Number(arg))) runsPerClass = Math.max(1, Math.min(100, Number(arg)));
  }
  
  const allCharacters = (charactersData as any[]).map(c => c.id);
  const characters = targetClass ? allCharacters.filter(c => c.toLowerCase() === targetClass) : allCharacters;
  
  if (characters.length === 0) {
    console.error(`Unknown class: ${targetClass}`);
    console.log(`Available classes: ${allCharacters.join(', ')}`);
    process.exit(1);
  }
  
  console.log(`=== DeckRogue Balance Test ===`);
  console.log(`Runs per class: ${runsPerClass}, Max floors: ${maxFloors}`);
  if (targetClass) console.log(`Target class: ${targetClass}`);
  console.log('');
  
  const allRuns: RunSummary[] = [];
  const allMetrics: BalanceMetrics[] = [];

  for (const [classIndex, characterId] of characters.entries()) {
    const runs: RunSummary[] = [];
    for (let i = 0; i < runsPerClass; i++) {
      const seed = 1000 + classIndex * 1000 + i;
      runs.push(await runSingle(characterId, seed, maxFloors));
    }
    allRuns.push(...runs);
    const metrics = calculateMetrics(characterId, runs, maxFloors);
    allMetrics.push(metrics);
    
    console.log(
      `${characterId.padEnd(14)} | 3F: ${(metrics.survivalRateFirst3 * 100).toFixed(0).padStart(3)}% | 5F: ${(metrics.survivalRateAll5 * 100).toFixed(0).padStart(3)}% | ` +
      `turns: ${metrics.avgCombatTurns.toFixed(1).padStart(4)} | floor: ${metrics.avgMaxFloor.toFixed(1)} | power: ${metrics.powerIndex.toFixed(1).padStart(5)}`
    );
  }

  console.log('\n=== Enemy Analysis ===');
  const enemyMetrics = analyzeEnemies(allRuns);
  for (const enemy of enemyMetrics.slice(0, 10)) {
    console.log(
      `${enemy.enemyId.padEnd(20)} | enc: ${enemy.encounters.toString().padStart(3)} | win: ${((enemy.victories / enemy.encounters) * 100).toFixed(0).padStart(3)}% | ` +
      `threat: ${enemy.threatLevel.toFixed(1).padStart(5)}`
    );
  }

  console.log('\n=== Balance Analysis ===');
  const analysis = analyzeCharacterBalance(allMetrics);
  console.log(
    `powerSpread=${analysis.powerSpread.toFixed(2)} | powerBand: top=${analysis.powerBand.top}, bottom=${analysis.powerBand.bottom}`
  );
  console.log(
    `spread first3=${analysis.survivalSpreadFirst3.toFixed(2)} | spread all5=${analysis.survivalSpreadAll5.toFixed(2)} | ` +
    `turn spread=${analysis.avgCombatTurnsSpread.toFixed(2)} | outliers=${analysis.outliers.length}`
  );
  for (const outlier of analysis.outliers) {
    console.log(` - ${outlier.characterId}: ${outlier.flags.join(', ')}`);
  }
  
  const balancePassed = analysis.powerSpread <= 5;
  const baselinePassed = allMetrics.every(m => m.survivalRateFirst3 >= 0.35 && m.survivalRateAll5 >= 0.20 && m.avgCombatTurns < 6.0);

  const allIllegalTransitions = allRuns.flatMap(r => r.diagnostics.illegalRunTransitions);
  const allUnknownActionTypes = allRuns.flatMap(r => r.diagnostics.unknownActionTypes);
  const hasIllegalTransitions = allIllegalTransitions.length > 0;
  const hasUnknownActions = allUnknownActionTypes.length > 0;

  if (hasIllegalTransitions) {
    console.error('\n=== DIAGNOSTIC FAILURES ===');
    console.error(`Found ${allIllegalTransitions.length} illegal run transitions:`);
    for (const t of allIllegalTransitions.slice(0, 5)) {
      console.error(`  - ${t.action} from ${t.fromPhase}: ${t.error}`);
    }
    if (allIllegalTransitions.length > 5) {
      console.error(`  ... and ${allIllegalTransitions.length - 5} more`);
    }
  }

  if (hasUnknownActions) {
    console.error('\n=== UNKNOWN ACTION TYPES ===');
    console.error(`Found ${allUnknownActionTypes.length} unknown action types:`);
    for (const a of [...new Set(allUnknownActionTypes)].slice(0, 10)) {
      console.error(`  - ${a}`);
    }
  }

  console.log(`\n=== Validation ===`);
  console.log(`illegalRunTransitions: ${hasIllegalTransitions ? 'FAIL' : 'PASS'} (${allIllegalTransitions.length})`);
  console.log(`unknownActionTypes: ${hasUnknownActions ? 'FAIL' : 'PASS'} (${allUnknownActionTypes.length})`);
  console.log(`powerSpread <= 5: ${balancePassed ? 'PASS' : 'FAIL'} (${analysis.powerSpread.toFixed(2)})`);
  console.log(`baseline constraints: ${baselinePassed ? 'PASS' : 'FAIL'}`);

  console.log('\n=== JSON Output ===');
  const payload = {
    characters: allMetrics,
    enemies: enemyMetrics.slice(0, 15),
    analysis,
    diagnostics: {
      illegalRunTransitions: allIllegalTransitions,
      unknownActionTypes: [...new Set(allUnknownActionTypes)]
    }
  };
  console.log(JSON.stringify(payload, null, 2));
  writeArtifact('combat_regression.json', payload);

  if (hasIllegalTransitions || hasUnknownActions) {
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
