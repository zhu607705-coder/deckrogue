/**
 * @file simulate_early_balance.ts
 * @description Simulates early game economy and asset EVU balance for all characters.
 *
 * 主要职责:
 * - 模拟前期经济系统与资产 EVU 增长
 * - 测试商店可负担性与移除费用
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../../src/core/events/gameEngine';
import { EconomySystem } from '../../src/features/progression/economySystem';
import { balanceSystem } from '../../src/core/balance/balanceSystem';
import { goldToEVU } from '../../src/core/balance/numericsFormulas';
import { relicsData, potionsData } from '../../src/content/narrative/numericSystem';
import { STORY_EVENTS } from '../../src/content/narrative/storyEvents';
import charactersData from '../../src/content/data/characters.json';
import type { CardDef, EventOption, GameState, MapNode, RunCardInstance } from '../../src/core/types';

type Screen =
  | 'CharacterSelect'
  | 'Map'
  | 'Combat'
  | 'Reward'
  | 'Shop'
  | 'Rest'
  | 'Upgrade'
  | 'RemoveCard'
  | 'Enchant'
  | 'Event'
  | 'GameOver'
  | 'Victory';

type NodeType = MapNode['type'];
type PathPolicy = 'aggressive' | 'economy' | 'balanced';

type PolicyResult = {
  policy: PathPolicy;
  runs: RunSummary[];
  resolvedCounts: Record<NodeType, number>;
  resolvedByFloor: Record<string, Record<NodeType, number>>;
}

type PolicySummary = {
  policy: PathPolicy;
  avgGoldGainPerFloor: number[];
  netAssetEVUByCheckpoint: number[];
  netAssetEVUGrowthByFloor: number[];
  netAssetCoverageByCheckpoint: number[];
  shopAffordability: { card: number; potion: number; relic: number };
  removalAffordability: { floor1Cost: number; floor3Cost: number; floor1Affordable: boolean; floor3Affordable: boolean };
  rewardToPriceRatio: { card: number; potion: number; relic: number; removal: number };
  nodeDistribution: {
    generated: Record<NodeType, number>;
    resolved: Record<NodeType, number>;
    absoluteDrift: Record<NodeType, number>;
    totalVariationDistance: number;
    generatedByFloor: Record<string, Record<NodeType, number>>;
    resolvedByFloor: Record<string, Record<NodeType, number>>;
  };
}

interface CombatSummary {
  turns: number;
  victory: boolean;
  timeout?: boolean;
}

interface AssetSnapshot {
  checkpoint: number;
  nodeType: NodeType | 'Start';
  netAssetEVU: number;
  goldEVU: number;
  cardEVU: number;
  relicEVU: number;
  potionEVU: number;
  gold: number;
  deckSize: number;
  relicCount: number;
  potionCount: number;
}
interface RunSummary {
  characterId: string;
  policy: PathPolicy;
  survivedFirst3Floors: boolean;
  combats: CombatSummary[];
  nodesResolved: number;
  maxFloorResolved: number;
  resolvedNodes: Array<{ floor: number; type: NodeType }>;
  generatedNodeCounts: Record<NodeType, number>;
  generatedNodeCountsByFloor: Record<string, Record<NodeType, number>>;
  assetSnapshots: AssetSnapshot[];
  diagnostics: {
    illegalRunTransitions: Array<{ action: string; fromPhase: string; error: string; timestamp: number }>;
    unknownActionTypes: string[];
  };
}
interface EconomySnapshot {
  avgGoldGainPerFloor: number[];
  netAssetEVUByCheckpoint: number[];
  netAssetEVUGrowthByFloor: number[];
  netAssetCoverageByCheckpoint: number[];
  shopAffordability: { card: number; potion: number; relic: number };
  removalAffordability: { floor1Cost: number; floor3Cost: number; floor1Affordable: boolean; floor3Affordable: boolean };
  rewardToPriceRatio: { card: number; potion: number; relic: number; removal: number };
  nodeDistribution: {
    generated: Record<NodeType, number>;
    resolved: Record<NodeType, number>;
    absoluteDrift: Record<NodeType, number>;
    totalVariationDistance: number;
    generatedByFloor: Record<string, Record<NodeType, number>>;
    resolvedByFloor: Record<string, Record<NodeType, number>>;
  };
  resolvedByPolicy?: Record<PathPolicy, PolicyResult>;
}
const TRACKED_NODE_TYPES: NodeType[] = ['Combat', 'Elite', 'Event', 'Shop', 'Boss', 'Rest'];
const CHECKPOINTS = [0, 1, 2, 3] as const;
const policies: PathPolicy[] = ['balanced', 'aggressive', 'economy'];
const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const relicPriceById = new Map((relicsData as any[]).map((relic: any) => [relic.id, relic.price || 150]));
const potionPriceById = new Map((potionsData as any[]).map((potion: any) => [potion.id, potion.price || 75]));
const storyEventById = new Map(STORY_EVENTS.map(event => [event.id, event]));
let outputDir = path.join(process.cwd(), 'output', 'numerics');

function emptyNodeCountRecord(): Record<NodeType, number> {
  return {
    Combat: 0,
    Elite: 0,
    Event: 0,
    Shop: 0,
    Boss: 0,
    Rest: 0
  };
}

function getSelectableNodes(engine: GameEngine) {
  const map = engine.state.map;
  const currentNodeId = engine.state.currentNodeId;
  if (engine.state.pendingNodeResolution) return [];
  if (!currentNodeId) return map.filter(n => n.y === 0);
  const current = map.find(n => n.id === currentNodeId);
  if (!current) return [];
  return current.next.map(id => map.find(n => n.id === id)).filter(Boolean) as MapNode[];
}

function chooseNodeWithPolicy(engine: GameEngine, policy: PathPolicy): MapNode | null {
  const candidates = getSelectableNodes(engine);
  if (candidates.length === 0) return null;

  const state = engine.state;
  const player = state.player;
  const hpRatio = player.hp / player.maxHp;
  const gold = player.gold || 0;
  const floor = state.currentNodeId ? (state.map.find(n => n.id === state.currentNodeId)?.y ?? 0) : 0;
  const deckSize = player.deck?.length || 10;
  const relicCount = player.relics?.length || 0;
  const potionCount = player.potions?.length || 0;

  function scoreNode(node: MapNode): number {
    let score = 0;
    
    switch (policy) {
      case 'aggressive':
        if (node.type === 'Combat') score += 100;
        else if (node.type === 'Elite') score += 80;
        else if (node.type === 'Event') score += 30;
        else if (node.type === 'Rest') score += 10;
        else if (node.type === 'Shop') score += 5;
        break;
        
      case 'balanced':
      default:
        if (node.type === 'Rest') {
          if (hpRatio < 0.4) score += 150;
          else if (hpRatio < 0.6) score += 80;
          else score += 20;
        } else if (node.type === 'Combat') {
          if (hpRatio >= 0.5) score += 70;
          else score += 30;
        } else if (node.type === 'Shop') {
          if (gold >= 50 && gold < 200) score += 60;
          else if (gold >= 200) score += 40;
          else score += 15;
        } else if (node.type === 'Event') {
          score += 40;
        } else if (node.type === 'Elite') {
          if (hpRatio >= 0.6 && gold >= 30) score += 50;
          else score += 5;
        }
        break;
      
      case 'economy':
        if (node.type === 'Shop') {
          if (gold >= 50 && gold < 150) score += 100;
          else if (gold >= 150 && gold < 300) score += 70;
          else if (gold >= 300) score += 40;
          else score += 20;
        } else if (node.type === 'Event') {
          score += 60;
        } else if (node.type === 'Rest') {
          score += 50;
        } else if (node.type === 'Combat') {
          score += 30;
        } else if (node.type === 'Elite') {
          score += 10;
        }
        break;
    }
    
    if (node.type === 'Boss') score = 200;
    
    return score;
  }

  return [...candidates].sort((a, b) => {
    const byFloor = a.y - b.y;
    if (byFloor !== 0) return byFloor;
    const scoreDiff = scoreNode(b) - scoreNode(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.x - b.x;
  })[0];
}

function getEnemyTargetId(engine: GameEngine): string | undefined {
  const combat = engine.state.combat;
  if (!combat) return undefined;
  const alive = combat.enemies.filter(e => e.hp > 0);
  if (alive.length === 0) return undefined;
  return [...alive].sort((a, b) => a.hp - b.hp)[0].id;
}

function scoreCard(engine: GameEngine, card: any): number {
  let score = 0;
  const text = String(card.text || '');
  const combat = engine.state.combat;
  const player = combat?.player;
  
  if (card.cost === 0) score += 3;
  if (card.type === 'Attack') score += 4;
  if (text.includes('Deal')) score += 3;
  if (text.includes('Vulnerable')) score += 2;
  if (text.includes('Poison')) score += 3;
  if (text.includes('Gain ') && text.includes('Strength')) score += 2;
  if (text.includes('Draw')) score += 1;
  if (text.includes('Delay')) score += 2;
  if (card.id === 'defend') score -= 1;
  if (card.id === 'go_dark') {
    score += (engine.state.player.intel || 0) >= 2 ? 4 : -2;
  }
  if (card.id === 'time_warp') {
    const delayed = engine.state.combat?.player.delayedCards.length || 0;
    score += delayed > 0 ? 6 : -3;
  }
  if (card.id === 'acrobatics' && (engine.state.combat?.hand.length || 0) <= 2) score += 2;
  if (card.id === 'frost_armor' || card.id === 'wire_guard') score += 1;
  
  if (text.includes('Construct') || text.includes('construct') || text.includes('Golem') || text.includes('golem')) {
    const constructs = player?.constructs?.length || 0;
    if (constructs === 0) score += 5;
    else if (constructs < 3) score += 3;
    else score += 1;
  }
  
  if (text.includes('Thread') || text.includes('thread')) {
    const threads = player?.thread || 0;
    if (text.includes('Spend') && threads >= 2) score += 4;
    if (text.includes('Gain')) score += 3;
  }
  
  if (text.includes('Element') || text.includes('element') || text.includes('Fire') || text.includes('Frost') || text.includes('Acid')) {
    const elements = player?.elements?.length || 0;
    if (elements === 0) score += 3;
    else if (elements >= 2) score += 4;
    else score += 2;
  }
  
  if (text.includes('Concoction') || text.includes('concoction')) {
    const concoction = player?.concoction || 0;
    if (text.includes('Spend') && concoction >= 1) score += 4;
    if (text.includes('Gain')) score += 3;
  }
  
  if (text.includes('Time Layer') || text.includes('time layer')) {
    const timeLayer = player?.timeLayer || 0;
    if (text.includes('Spend') && timeLayer >= 1) score += 4;
    if (text.includes('Gain')) score += 3;
  }
  
  if (card.id === 'scrap_golem' || card.id === 'reinforced_golem') {
    score += 4;
  }
  if (card.id === 'thread_weave') {
    score += 3;
  }
  if (card.id === 'element_spark') {
    score += 3;
  }
  if (card.id === 'time_shift') {
    score += 3;
  }
  
  return score;
}

async function playCombat(engine: GameEngine): Promise<CombatSummary> {
  let maxSeenTurn = engine.state.combat?.turn || 1;
  let safety = 0;

  while (engine.state.screen === 'Combat' && safety++ < 500) {
    await sleep(0);
    const combat = engine.state.combat;
    if (!combat) break;
    maxSeenTurn = Math.max(maxSeenTurn, combat.turn);
    if (combat.turn > 20) {
      return { turns: maxSeenTurn, victory: false, timeout: true };
    }

    if (!combat.isPlayerTurn) {
      await sleep(0);
      continue;
    }

    let playedSomething = true;
    let inner = 0;
    while (engine.state.screen === 'Combat' && engine.state.combat?.isPlayerTurn && playedSomething && inner++ < 50) {
      playedSomething = false;
      const c = engine.state.combat!;
      const playable = c.hand.filter(card => (card.cost ?? 0) <= c.player.energy);
      const ordered = [...playable].sort((a, b) => scoreCard(engine, b) - scoreCard(engine, a));
      for (const card of ordered) {
        const beforeEnergy = c.player.energy;
        const beforeHandLen = c.hand.length;
        const targetId = card.targeting === 'Enemy' ? getEnemyTargetId(engine) : undefined;
        if (card.targeting === 'Enemy' && !targetId) continue;
        await engine.playCard(card.instanceId!, targetId);
        await sleep(0);
        const after = engine.state.combat;
        if (!after || engine.state.screen !== 'Combat') break;
        if (after.player.energy !== beforeEnergy || after.hand.length !== beforeHandLen) {
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
  return {
    turns: maxSeenTurn,
    victory: engine.state.screen !== 'GameOver'
  };
}

function estimateCardAssetEVU(card: CardDef): number {
  const rarity = String(card.rarity || 'Common').toLowerCase();
  let marketGold = 50;
  if (rarity === 'starter') marketGold = 30;
  else if (rarity === 'uncommon') marketGold = 75;
  else if (rarity === 'rare') marketGold = 150;
  const upgradeMultiplier = card.isUpgraded ? 1.15 : 1;
  return goldToEVU(marketGold) * upgradeMultiplier;
}

function estimateRelicAssetEVU(relicId: string): number {
  return goldToEVU(relicPriceById.get(relicId) ?? 150);
}
function estimatePotionAssetEVU(potionId: string): number {
  return goldToEVU(potionPriceById.get(potionId) ?? 75);
}
function buildAssetSnapshot(state: GameState, checkpoint: number, nodeType: NodeType | 'Start'): AssetSnapshot {
  const goldEVU = goldToEVU(state.player.gold || 0);
  const cardEVU = (state.player.deck || []).reduce((sum, card) => sum + estimateCardAssetEVU(card), 0);
  const relicEVU = (state.player.relics || []).reduce((sum, relicId) => sum + estimateRelicAssetEVU(relicId), 0);
  const potionEVU = (state.player.potions || []).reduce((sum, potionId) => sum + estimatePotionAssetEVU(potionId), 0);

  return {
    checkpoint,
    nodeType,
    netAssetEVU: Number((goldEVU + cardEVU + relicEVU + potionEVU).toFixed(4)),
    goldEVU: Number(goldEVU.toFixed(4)),
    cardEVU: Number(cardEVU.toFixed(4)),
    relicEVU: Number(relicEVU.toFixed(4)),
    potionEVU: Number(potionEVU.toFixed(4)),
    gold: state.player.gold || 0,
    deckSize: state.player.deck.length,
    relicCount: state.player.relics.length,
    potionCount: state.player.potions.length
  };
}
function countGeneratedNodes(map: MapNode[], floorCount = 3) {
  const counts = emptyNodeCountRecord();
  const byFloor: Record<string, Record<NodeType, number>> = {};
  for (let floor = 0; floor < floorCount; floor++) {
    byFloor[`floor${floor + 1}`] = emptyNodeCountRecord();
  }
  for (const node of map) {
    if (node.y >= floorCount) continue;
    counts[node.type] += 1;
    byFloor[`floor${node.y + 1}`][node.type] += 1;
  }
  return { counts, byFloor };
}
function pushResolvedSnapshot(
  engine: GameEngine,
  resolvedNodeIds: Set<string>,
  resolvedNodes: Array<{ floor: number; type: NodeType }>,
  assetSnapshots: AssetSnapshot[]
): number | null {
  const current = engine.state.map.find(n => n.id === engine.state.currentNodeId);
  if (!current || resolvedNodeIds.has(current.id)) return null;
  resolvedNodeIds.add(current.id);
  resolvedNodes.push({ floor: current.y + 1, type: current.type });
  assetSnapshots.push(buildAssetSnapshot(engine.state, current.y + 1, current.type));
  return current.y;
}
function normalizeCounts(record: Record<NodeType, number>): Record<NodeType, number> {
  const total = TRACKED_NODE_TYPES.reduce((sum, type) => sum + (record[type] || 0), 0);
  if (total <= 0) return emptyNodeCountRecord();
  return TRACKED_NODE_TYPES.reduce((acc, type) => {
    acc[type] = Number(((record[type] || 0) / total).toFixed(4));
    return acc;
  }, emptyNodeCountRecord());
}
function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function isEventOptionAvailable(option: EventOption, state: GameState): boolean {
  try {
    return !option.condition || option.condition(state);
  } catch {
    return false;
  }
}

function scoreEventOption(engine: GameEngine, policy: PathPolicy, option: EventOption): number {
  const hpRatio = engine.state.player.hp / Math.max(1, engine.state.player.maxHp);
  const danger = option.danger ?? 'medium';
  const dangerScoreByPolicy: Record<PathPolicy, Record<NonNullable<EventOption['danger']>, number>> = {
    balanced: {
      low: 36,
      medium: hpRatio >= 0.45 ? 44 : 18,
      high: hpRatio >= 0.75 ? 30 : -35
    },
    aggressive: {
      low: 20,
      medium: hpRatio >= 0.35 ? 36 : 14,
      high: hpRatio >= 0.6 ? 54 : 6
    },
    economy: {
      low: 48,
      medium: hpRatio >= 0.5 ? 38 : 16,
      high: hpRatio >= 0.8 ? 22 : -42
    }
  };
  let score = dangerScoreByPolicy[policy][danger];
  const searchable = [
    option.id,
    option.text,
    option.description,
    ...(option.gains ?? []),
    ...(option.costs ?? [])
  ].join(' ').toLowerCase();

  if (/(gold|relic|potion|card|remove|salvage|extract|wealth|bargain|explore)/.test(searchable)) score += 8;
  if (/(heal|restore|purify|seal|guard|ignore)/.test(searchable)) score += hpRatio < 0.7 ? 12 : 4;
  if (/(curse|corruption|max hp|blood|embrace|desecrate|implant|open_casket)/.test(searchable)) score -= 10;
  if (/(inscribe|enchant)/.test(searchable)) score -= 24;
  if (option.id === 'medicae_salvage') score += policy === 'economy' ? 8 : -6;
  if (option.id === 'martyr_offer_wealth' && engine.state.player.gold >= 50) score += policy === 'economy' ? 10 : 2;
  if (option.id === 'secret_passage_ignore') score += hpRatio < 0.45 ? 18 : 0;
  if (option.id === 'legacy_read_codex' && engine.state.character?.id === 'informant') score += 8;
  return score;
}

function chooseEventChoice(engine: GameEngine, policy: PathPolicy): string | null {
  const event = engine.state.activeEvent;
  if (!event) return null;
  if (event.id === 'rusting_medicae' && event.stage === 'salvage_aftermath') {
    return 'medicae_salvage_flee';
  }
  const eventDef = storyEventById.get(event.id);
  if (!eventDef) return null;

  const options = eventDef.options.filter(option => isEventOptionAvailable(option, engine.state));
  if (options.length === 0) return null;

  return [...options].sort((a, b) => {
    const scoreDiff = scoreEventOption(engine, policy, b) - scoreEventOption(engine, policy, a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.id.localeCompare(b.id);
  })[0].id;
}

function chooseCardForRemoval(engine: GameEngine): RunCardInstance | undefined {
  const removablePriority = ['greed_sin', 'paranoia', 'perjury_stigma', 'psychic_backlash', 'strike', 'defend'];
  for (const cardId of removablePriority) {
    const card = engine.state.player.deck.find(entry => entry.id === cardId && entry.instanceId);
    if (card) return card;
  }
  return engine.state.player.deck.find(entry => !!entry.instanceId);
}

function buildPolicySnapshot(runs: RunSummary[]): PolicySummary {
  const economy = new EconomySystem();
  const floors = [1, 2, 3];
  const avgGoldGainPerFloor = floors.map(floor => economy.calculateExpectedGoldGain(floor));
  const cumulativeGold = avgGoldGainPerFloor.reduce<number[]>((acc, gold, index) => {
    const previous = index === 0 ? 0 : acc[index - 1];
    acc.push(previous + gold);
    return acc;
  }, []);
  const shopQuotes = floors.map(floor => economy.calculateShopPrices(floor));
  const affordability = {
    card: average(cumulativeGold.map((gold, index) => (gold >= shopQuotes[index].cardCost ? 1 : 0))),
    potion: average(cumulativeGold.map((gold, index) => (gold >= shopQuotes[index].potionCost ? 1 : 0))),
    relic: average(cumulativeGold.map((gold, index) => (gold >= shopQuotes[index].relicCost ? 1 : 0)))
  };
  const netAssetEVUByCheckpoint = CHECKPOINTS.map((checkpoint) => {
    const values = runs
      .map(run => run.assetSnapshots.find(snapshot => snapshot.checkpoint === checkpoint)?.netAssetEVU)
      .filter((value): value is number => typeof value === 'number');
    return Number(average(values).toFixed(4));
  });
  const netAssetCoverageByCheckpoint = CHECKPOINTS.map((checkpoint) => {
    return runs.filter(run => run.assetSnapshots.some(snapshot => snapshot.checkpoint === checkpoint)).length;
  });
  const netAssetEVUGrowthByFloor = [1, 2, 3].map((floor) => {
    return Number((netAssetEVUByCheckpoint[floor] - netAssetEVUByCheckpoint[floor - 1]).toFixed(4));
  });
  const generatedCounts = emptyNodeCountRecord();
  const resolvedCounts = emptyNodeCountRecord();
  const generatedByFloor: Record<string, Record<NodeType, number>> = {
    floor1: emptyNodeCountRecord(),
    floor2: emptyNodeCountRecord(),
    floor3: emptyNodeCountRecord()
  };
  const resolvedByFloor: Record<string, Record<NodeType, number>> = {
    floor1: emptyNodeCountRecord(),
    floor2: emptyNodeCountRecord(),
    floor3: emptyNodeCountRecord()
  };
  for (const run of runs) {
    for (const type of TRACKED_NODE_TYPES) {
      generatedCounts[type] += run.generatedNodeCounts[type] || 0;
    }
    for (const [floorKey, counts] of Object.entries(run.generatedNodeCountsByFloor)) {
      for (const type of TRACKED_NODE_TYPES) {
        generatedByFloor[floorKey][type] += counts[type] || 0;
      }
    }
    for (const node of run.resolvedNodes) {
      resolvedCounts[node.type] += 1;
      const floorKey = `floor${node.floor}`;
      if (resolvedByFloor[floorKey]) {
        resolvedByFloor[floorKey][node.type] += 1;
      }
    }
  }
  const normalizedGenerated = normalizeCounts(generatedCounts);
  const normalizedResolved = normalizeCounts(resolvedCounts);
  const absoluteDrift = TRACKED_NODE_TYPES.reduce((acc, type) => {
    acc[type] = Number(Math.abs((normalizedResolved[type] || 0) - (normalizedGenerated[type] || 0)).toFixed(4));
    return acc;
  }, emptyNodeCountRecord());
  const totalVariationDistance = Number(
    (
      TRACKED_NODE_TYPES.reduce((sum, type) => sum + Math.abs((normalizedResolved[type] || 0) - (normalizedGenerated[type] || 0)), 0) / 2
    ).toFixed(4)
  );
  return {
    policy: runs[0]?.policy || 'balanced',
    avgGoldGainPerFloor,
    netAssetEVUByCheckpoint,
    netAssetEVUGrowthByFloor,
    netAssetCoverageByCheckpoint,
    shopAffordability: affordability,
    removalAffordability: {
      floor1Cost: economy.calculateCardRemovalCost(1, 0),
      floor3Cost: economy.calculateCardRemovalCost(3, 0),
      floor1Affordable: cumulativeGold[0] >= economy.calculateCardRemovalCost(1, 0),
      floor3Affordable: cumulativeGold[2] >= economy.calculateCardRemovalCost(3, 0)
    },
    rewardToPriceRatio: {
      card: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, shopQuotes[index].cardCost))),
      potion: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, shopQuotes[index].potionCost))),
      relic: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, shopQuotes[index].relicCost))),
      removal: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, economy.calculateCardRemovalCost(index + 1, 0))))
    },
    nodeDistribution: {
      generated: normalizedGenerated,
      resolved: normalizedResolved,
      absoluteDrift,
      totalVariationDistance,
      generatedByFloor: Object.fromEntries(
        Object.entries(generatedByFloor).map(([floorKey, counts]) => [floorKey, normalizeCounts(counts)])
      ) as Record<string, Record<NodeType, number>>,
      resolvedByFloor: Object.fromEntries(
        Object.entries(resolvedByFloor).map(([floorKey, counts]) => [floorKey, normalizeCounts(counts)])
      ) as Record<string, Record<NodeType, number>>
    }
  };
}
function summarizeRunsByPolicy(characterId: string, runsByPolicy: Map<PathPolicy, RunSummary[]>): { characterId: string; resolvedByPolicy: Record<PathPolicy, PolicySummary> } {
  const result = {} as Record<PathPolicy, PolicySummary>;
  for (const policy of policies) {
    const policyRuns = runsByPolicy.get(policy) || [];
    result[policy] = buildPolicySnapshot(policyRuns);
  }
  return {
    characterId,
    resolvedByPolicy: result
  };
}
function buildFullSummary(characterId: string, runs: RunSummary[]): any {
  const runsByPolicy: Map<PathPolicy, RunSummary[]> = new Map();
  for (const policy of policies) {
    runsByPolicy.set(policy, runs.filter(r => r.policy === policy));
  }
  const { resolvedByPolicy } = summarizeRunsByPolicy(characterId, runsByPolicy);
  const survived = runs.filter(r => r.survivedFirst3Floors).length;
  const allCombats = runs.flatMap(r => r.combats);
  const turns = allCombats.map(c => c.turns).sort((a, b) => a - b);
  const avgTurns = turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : 0;
  const medianTurns = turns.length ? turns[Math.floor(turns.length / 2)] : 0;
  const avgCombatsPerRun = runs.reduce((sum, r) => sum + r.combats.length, 0) / Math.max(1, runs.length);
  const avgMaxFloor = runs.reduce((sum, r) => sum + r.maxFloorResolved, 0) / Math.max(1, runs.length);
  const economy = new EconomySystem();
  const floors = [1, 2, 3];
  const avgGoldGainPerFloor = floors.map(floor => economy.calculateExpectedGoldGain(floor));
  const cumulativeGold = avgGoldGainPerFloor.reduce<number[]>((acc, gold, index) => {
    const previous = index === 0 ? 0 : acc[index - 1];
    acc.push(previous + gold);
    return acc;
  }, []);
  const shopQuotes = floors.map(floor => economy.calculateShopPrices(floor));
  const affordability = {
    card: average(cumulativeGold.map((gold, index) => (gold >= shopQuotes[index].cardCost ? 1 : 0))),
    potion: average(cumulativeGold.map((gold, index) => (gold >= shopQuotes[index].potionCost ? 1 : 0))),
    relic: average(cumulativeGold.map((gold, index) => (gold >= shopQuotes[index].relicCost ? 1 : 0)))
  };
  const netAssetEVUByCheckpoint = CHECKPOINTS.map((checkpoint) => {
    const values = runs
      .map(run => run.assetSnapshots.find(snapshot => snapshot.checkpoint === checkpoint)?.netAssetEVU)
      .filter((value): value is number => typeof value === 'number');
    return Number(average(values).toFixed(4));
  });
  const netAssetCoverageByCheckpoint = CHECKPOINTS.map((checkpoint) => {
    return runs.filter(run => run.assetSnapshots.some(snapshot => snapshot.checkpoint === checkpoint)).length;
  });
  const netAssetEVUGrowthByFloor = [1, 2, 3].map((floor) => {
    return Number((netAssetEVUByCheckpoint[floor] - netAssetEVUByCheckpoint[floor - 1]).toFixed(4));
  });
  const generatedCounts = emptyNodeCountRecord();
  const resolvedCounts = emptyNodeCountRecord();
  const generatedByFloor: Record<string, Record<NodeType, number>> = {
    floor1: emptyNodeCountRecord(),
    floor2: emptyNodeCountRecord(),
    floor3: emptyNodeCountRecord()
  };
  const resolvedByFloor: Record<string, Record<NodeType, number>> = {
    floor1: emptyNodeCountRecord(),
    floor2: emptyNodeCountRecord(),
    floor3: emptyNodeCountRecord()
  };
  for (const run of runs) {
    for (const type of TRACKED_NODE_TYPES) {
      generatedCounts[type] += run.generatedNodeCounts[type] || 0;
    }
    for (const [floorKey, counts] of Object.entries(run.generatedNodeCountsByFloor)) {
      for (const type of TRACKED_NODE_TYPES) {
        generatedByFloor[floorKey][type] += counts[type] || 0;
      }
    }
    for (const node of run.resolvedNodes) {
      resolvedCounts[node.type] += 1;
      const floorKey = `floor${node.floor}`;
      if (resolvedByFloor[floorKey]) {
        resolvedByFloor[floorKey][node.type] += 1;
      }
    }
  }
  const normalizedGenerated = normalizeCounts(generatedCounts);
  const normalizedResolved = normalizeCounts(resolvedCounts);
  const absoluteDrift = TRACKED_NODE_TYPES.reduce((acc, type) => {
    acc[type] = Number(Math.abs((normalizedResolved[type] || 0) - (normalizedGenerated[type] || 0)).toFixed(4));
    return acc;
  }, emptyNodeCountRecord());
  const totalVariationDistance = Number(
    (
      TRACKED_NODE_TYPES.reduce((sum, type) => sum + Math.abs((normalizedResolved[type] || 0) - (normalizedGenerated[type] || 0)), 0) / 2
    ).toFixed(4)
  );
  return {
    characterId,
    runs: runs.length,
    survivalRateFirst3: survived / Math.max(1, runs.length),
    avgCombatsPerRun,
    avgCombatTurns: avgTurns,
    medianCombatTurns: medianTurns,
    avgMaxFloorResolved: avgMaxFloor,
    avgGoldGainPerFloor,
    netAssetEVUByCheckpoint,
    netAssetEVUGrowthByFloor,
    netAssetCoverageByCheckpoint,
    shopAffordability: affordability,
    removalAffordability: {
      floor1Cost: economy.calculateCardRemovalCost(1, 0),
      floor3Cost: economy.calculateCardRemovalCost(3, 0),
      floor1Affordable: cumulativeGold[0] >= economy.calculateCardRemovalCost(1, 0),
      floor3Affordable: cumulativeGold[2] >= economy.calculateCardRemovalCost(3, 0)
    },
    rewardToPriceRatio: {
      card: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, shopQuotes[index].cardCost))),
      potion: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, shopQuotes[index].potionCost))),
      relic: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, shopQuotes[index].relicCost))),
      removal: average(avgGoldGainPerFloor.map((gold, index) => gold / Math.max(1, economy.calculateCardRemovalCost(index + 1, 0))))
    },
    nodeDistribution: {
      generated: normalizedGenerated,
      resolved: normalizedResolved,
      absoluteDrift,
      totalVariationDistance,
      generatedByFloor: Object.fromEntries(
        Object.entries(generatedByFloor).map(([floorKey, counts]) => [floorKey, normalizeCounts(counts)])
      ) as Record<string, Record<NodeType, number>>,
      resolvedByFloor: Object.fromEntries(
        Object.entries(resolvedByFloor).map(([floorKey, counts]) => [floorKey, normalizeCounts(counts)])
      ) as Record<string, Record<NodeType, number>>
    },
    resolvedByPolicy,
    starterDamageProfile: {
      openingTurnDamage: calculateOpeningTurnDamage(characterId),
      firstTwoTurnDamage: calculateFirstTwoTurnDamage(characterId),
      firstResourceSpendTurn: estimateFirstResourceSpendTurn(characterId)
    }
  };
}

function calculateOpeningTurnDamage(characterId: string): number {
  const charDef = charactersData.find(c => c.id === characterId);
  if (!charDef) return 0;
  
  let damage = 0;
  const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike').length;
  damage += strikes * 6;
  
  if (characterId === 'puppeteer') {
    damage += 3;
  }
  if (characterId === 'alchemist') {
    damage += 4;
  }
  
  return damage;
}

function calculateFirstTwoTurnDamage(characterId: string): number {
  const openingDamage = calculateOpeningTurnDamage(characterId);
  let damage = openingDamage * 2;
  
  if (characterId === 'puppeteer') {
    damage += 3;
  }
  if (characterId === 'alchemist') {
    damage += 8;
  }
  
  return damage;
}

function estimateFirstResourceSpendTurn(characterId: string): number {
  const charDef = charactersData.find(c => c.id === characterId);
  if (!charDef || !charDef.specialResource) return -1;
  
  if (characterId === 'puppeteer') return 1;
  if (characterId === 'chronomancer') return 2;
  if (characterId === 'alchemist') return 2;
  
  return -1;
}
function writeArtifact(filename: string, payload: unknown): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, filename), JSON.stringify(payload, null, 2));
}
async function runSingle(characterId: string, seed: number, policy: PathPolicy): Promise<RunSummary> {
  const engine = new GameEngine(seed);
  engine.selectCharacter(characterId);
  const generated = countGeneratedNodes(engine.state.map, 3);
  const resolvedNodes: Array<{ floor: number; type: NodeType }> = [];
  const resolvedNodeIds = new Set<string>();
  const assetSnapshots: AssetSnapshot[] = [buildAssetSnapshot(engine.state, 0, 'Start')];
  const unknownActionTypes = new Set<string>();
  let nodesResolved = 0;
  let maxFloorResolved = -1;
  const combats: CombatSummary[] = [];
  let safety = 0;
  while (safety++ < 1000) {
    const screen = engine.state.screen as Screen;
    if (screen === 'GameOver' || screen === 'Victory') break;
    if (screen === 'Map') {
      const next = chooseNodeWithPolicy(engine, policy);
      if (!next) break;
      if (next.y > 2) break;
      engine.enterNode(next.id);
      await sleep(0);
      continue;
    }
    if (screen === 'Combat') {
      const summary = await playCombat(engine);
      combats.push(summary);
      if (summary.timeout) {
        (engine.state as any).screen = 'GameOver';
      }
      continue;
    }
    if (screen === 'Reward') {
      const first = engine.state.rewardCards[0];
      if (first) engine.pickRewardCard(first.instanceId!);
      else engine.skipReward();
      const resolvedFloor = pushResolvedSnapshot(engine, resolvedNodeIds, resolvedNodes, assetSnapshots);
      if (resolvedFloor !== null) {
        nodesResolved += 1;
        maxFloorResolved = Math.max(maxFloorResolved, resolvedFloor);
      }
      await sleep(0);
      continue;
    }
    if (screen === 'Rest') {
      engine.restHeal();
      const resolvedFloor = pushResolvedSnapshot(engine, resolvedNodeIds, resolvedNodes, assetSnapshots);
      if (resolvedFloor !== null) {
        nodesResolved += 1;
        maxFloorResolved = Math.max(maxFloorResolved, resolvedFloor);
      }
      await sleep(0);
      continue;
    }
    if (screen === 'Event') {
      const eventId = engine.state.activeEvent?.id ?? 'unknown';
      const eventStage = engine.state.activeEvent?.stage ?? null;
      const choice = chooseEventChoice(engine, policy);
      if (choice) engine.resolveEventChoice(choice);
      else engine.makeEventChoice('decline');
      await sleep(0);
      if (engine.state.screen === 'Event' && !engine.state.activeEvent) {
        engine.leaveCurrentRoomToMap();
      }
      if (engine.state.screen === 'Map' || !engine.state.activeEvent) {
        const resolvedFloor = pushResolvedSnapshot(engine, resolvedNodeIds, resolvedNodes, assetSnapshots);
        if (resolvedFloor !== null) {
          nodesResolved += 1;
          maxFloorResolved = Math.max(maxFloorResolved, resolvedFloor);
        }
      } else if (engine.state.screen === 'Event') {
        const activeEvent = engine.state.activeEvent;
        if (activeEvent?.id === eventId && (activeEvent.stage ?? null) !== eventStage) {
          await sleep(0);
          continue;
        }
        unknownActionTypes.add(`unresolved_event_choice:${eventId}:${choice ?? 'decline'}`);
        break;
      }
      await sleep(0);
      continue;
    }
    if (screen === 'Shop') {
      engine.leaveCurrentRoomToMap();
      const resolvedFloor = pushResolvedSnapshot(engine, resolvedNodeIds, resolvedNodes, assetSnapshots);
      if (resolvedFloor !== null) {
        nodesResolved += 1;
        maxFloorResolved = Math.max(maxFloorResolved, resolvedFloor);
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
      const removable = chooseCardForRemoval(engine);
      if (removable?.instanceId) engine.removeCard(removable.instanceId);
      else engine.cancelCardRemoval();
      const resolvedFloor = engine.state.screen === 'Map'
        ? pushResolvedSnapshot(engine, resolvedNodeIds, resolvedNodes, assetSnapshots)
        : null;
      if (resolvedFloor !== null) {
        nodesResolved += 1;
        maxFloorResolved = Math.max(maxFloorResolved, resolvedFloor);
      }
      await sleep(0);
      continue;
    }
    if (screen === 'Enchant') {
      const target = engine.state.player.deck.find(card => card.instanceId && !card.persistentEnchantments?.length);
      if (target?.instanceId) engine.applyEnchantment(target.instanceId);
      else engine.cancelEnchant();
      if (engine.state.screen === 'Event') {
        unknownActionTypes.add(`unresolved_event_enchant:${engine.state.activeEvent?.id ?? 'unknown'}`);
        break;
      }
      await sleep(0);
      continue;
    }
    await sleep(0);
  }
  const survivedFirst3Floors = engine.state.screen !== 'GameOver' && maxFloorResolved >= 2;
  const summary: RunSummary = {
    characterId,
    policy,
    survivedFirst3Floors,
    combats,
    nodesResolved,
    maxFloorResolved,
    resolvedNodes,
    generatedNodeCounts: generated.counts,
    generatedNodeCountsByFloor: generated.byFloor,
    assetSnapshots,
    diagnostics: {
      illegalRunTransitions: (engine as any).getIllegalTransitions?.() || [],
      unknownActionTypes: [...unknownActionTypes]
    }
  };
  engine.dispose();
  return summary;
}
async function main() {
  const args = process.argv.slice(2);
  let runsPerClass = 20;
  let targetClass: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--runs=')) {
      runsPerClass = Math.max(1, Math.min(100, Number(arg.split('=')[1]) || 20));
    } else if (arg.startsWith('--class=')) {
      targetClass = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--output-dir=')) {
      const rawOutputDir = arg.slice('--output-dir='.length);
      if (rawOutputDir) {
        outputDir = path.resolve(rawOutputDir);
      }
    } else if (!arg.startsWith('--') && !isNaN(Number(arg))) {
      runsPerClass = Math.max(1, Math.min(100, Number(arg)));
    }
  }
  const allCharacters = (charactersData as any[]).map(c => c.id);
  const characters = targetClass
    ? allCharacters.filter(c => c.toLowerCase() === targetClass)
    : allCharacters;
  if (characters.length === 0) {
    console.error(`Unknown class: ${targetClass}`);
    console.log(`Available classes: ${allCharacters.join(', ')}`);
    process.exit(1);
  }
  console.log(`Running ${runsPerClass} simulation(s) per class...`);
  if (targetClass) {
    console.log(`Target class: ${targetClass}`);
  }
  console.log('');
  const allSummaries = [];
  const allRunDiagnostics: RunSummary[] = [];
  for (const [classIndex, characterId] of characters.entries()) {
    const runsByPolicy: Map<PathPolicy, RunSummary[]> = new Map();
    for (const policy of policies) {
      const runs: RunSummary[] = [];
      for (let i = 0; i < runsPerClass; i++) {
        const seed = 1000 + classIndex * 1000 + i + (policy === 'aggressive' ? 500000 : 0);
        runs.push(await runSingle(characterId, seed, policy));
      }
      runsByPolicy.set(policy, runs);
    }
    const allRuns: RunSummary[] = [];
    for (const policy of policies) {
      allRuns.push(...(runsByPolicy.get(policy)!));
    }
    allRunDiagnostics.push(...allRuns);
    const summary = buildFullSummary(characterId, allRuns);
    allSummaries.push(summary);
    const balancedSummary = summary.resolvedByPolicy?.balanced;
    console.log(
      `${characterId.padEnd(14)} | first3 win ${(summary.survivalRateFirst3 * 100).toFixed(0)}% | avg fights ${summary.avgCombatsPerRun.toFixed(1)} | avg turns ${summary.avgCombatTurns.toFixed(2)} | asset Δ ${summary.netAssetEVUGrowthByFloor.map((v: number) => v.toFixed(2)).join('/')}`
    );
  }
  console.log('\nJSON:');
  const allIllegalTransitions = allRunDiagnostics.flatMap((r: any) => r.diagnostics?.illegalRunTransitions || []);
  const allUnknownActionTypes = allRunDiagnostics.flatMap((r: any) => r.diagnostics?.unknownActionTypes || []);
  const hasIllegalTransitions = allIllegalTransitions.length > 0;
  const hasUnknownActions = allUnknownActionTypes.length > 0;

  if (hasIllegalTransitions) {
    console.error('\n=== DIAGNOSTIC FAILURES ===');
    console.error(`Found ${allIllegalTransitions.length} illegal run transitions:`);
    for (const t of allIllegalTransitions.slice(0, 5)) {
      console.error(`  - ${t.action} from ${t.fromPhase}: ${t.error}`);
    }
  }

  if (hasUnknownActions) {
    console.error('\n=== UNKNOWN ACTION TYPES ===');
    console.error(`Found ${allUnknownActionTypes.length} unknown action types:`);
    for (const a of [...new Set(allUnknownActionTypes)].slice(0, 10)) {
      console.error(`  - ${a}`);
    }
  }

  console.log(`\nDiagnostics: illegalRunTransitions=${allIllegalTransitions.length}, unknownActionTypes=${allUnknownActionTypes.length}`);

  const payload = { summaries: allSummaries, diagnostics: { illegalRunTransitions: allIllegalTransitions, unknownActionTypes: [...new Set(allUnknownActionTypes)] } };
  console.log(JSON.stringify(payload, null, 2));
  writeArtifact('economy_regression.json', payload);

  if (hasIllegalTransitions || hasUnknownActions) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
