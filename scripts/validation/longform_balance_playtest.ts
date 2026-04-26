/**
 * Longform balance playtest coverage for build, card, relic, and event tuning.
 *
 * This is intentionally stronger than a smoke test: it uses GameEngine combat,
 * plays each route build through normal/elite/boss encounters, probes every
 * card through playCard, starts a combat with every relic, and resolves every
 * story-event option through EventManager.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createRunCardInstance } from '@/core/combat/runCardInstance';
import { GameEngine } from '@/core/events/gameEngine';
import type { ActionSpec, CardDef, GameState, MapNode, RelicDef, RunCardInstance } from '@/core/types';
import {
  cardsData,
  enemiesData,
  getCardRouteAffinityTags,
  getEventChoiceRouteRole,
  getEventRouteSignal,
  getGenericPowerIdsForCharacter,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  relicsData,
  STORY_EVENTS,
} from '@/content/narrative/numericSystem';
import charactersDataRaw from '@/content/data/characters.json';

type EncounterType = 'Combat' | 'Elite' | 'Boss';
type CharacterDefLite = {
  id: string;
  maxHp: number;
  maxEnergy: number;
  startingDeck: string[];
  specialResource?: string;
  secondaryResource?: string;
};

type CombatSummary = {
  encounter: EncounterType;
  victory: boolean;
  turns: number;
  hpAfter: number;
  maxHp: number;
  cardsPlayed: number;
  timeout?: boolean;
  enemyDefIds: string[];
};

type BuildRunSummary = {
  characterId: string;
  routeTag: string;
  seed: number;
  victories: number;
  encounters: CombatSummary[];
  survived: boolean;
  finalHp: number;
  finalHpRatio: number;
  deckIds: string[];
  relicIds: string[];
  playedCardIds: string[];
  error?: string;
};

type CardProbeResult = {
  total: number;
  passed: number;
  failed: Array<{ cardId: string; characterId: string; reason: string }>;
};

type RelicProbeResult = {
  total: number;
  passed: number;
  failed: Array<{ relicId: string; characterId: string; reason: string }>;
};

type EventProbeResult = {
  totalOptions: number;
  resolved: number;
  unresolved: Array<{ eventId: string; choiceId: string; screen: string; activeEvent: string | null; reason: string }>;
};

type CoverageSummary = {
  characters: { covered: number; total: number; missing: string[] };
  routeBuilds: { covered: number; total: number; missing: string[] };
  cards: { covered: number; total: number; missing: string[] };
  relics: { covered: number; total: number; missing: string[] };
  events: { covered: number; total: number; missing: string[] };
};

type BalanceFinding = {
  severity: 'low' | 'medium' | 'high';
  area: 'build' | 'card' | 'relic' | 'event' | 'coverage';
  id: string;
  message: string;
};

type LongformReport = {
  generatedAt: string;
  pass: number;
  runsPerBuild: number;
  thresholds: {
    minBuildSurvival: number;
    maxBuildSurvival: number;
    minAverageFinalHpRatio: number;
    maxAverageFinalHpRatio: number;
    maxAverageTurns: number;
  };
  coverage: CoverageSummary;
  buildSummaries: Array<{
    characterId: string;
    routeTag: string;
    runs: number;
    survivalRate: number;
    avgFinalHpRatio: number;
    avgTurns: number;
    victoryRate: number;
    lowSampleRuns: Array<{ seed: number; victories: number; finalHpRatio: number; turns: number }>;
  }>;
  probes: {
    cards: CardProbeResult;
    relics: RelicProbeResult;
    events: EventProbeResult;
  };
  buildRuns: BuildRunSummary[];
  findings: BalanceFinding[];
};

const charactersData = charactersDataRaw as CharacterDefLite[];
const ENCOUNTERS: EncounterType[] = ['Combat', 'Elite', 'Boss'];
const DEFAULT_RUNS_PER_BUILD = 3;
const MIN_BUILD_SURVIVAL = 0.72;
const MAX_BUILD_SURVIVAL = 1;
const MIN_AVG_FINAL_HP_RATIO = 0.18;
const MAX_AVG_FINAL_HP_RATIO = 0.88;
const MAX_AVG_TURNS = 12;

const sleep = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function parseNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parseStringArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function cardDefById(cardId: string): CardDef | null {
  return cardsData.find((card) => card.id === cardId) ?? null;
}

function routeOwner(routeTag: string | null | undefined): string | null {
  return typeof routeTag === 'string' && routeTag.includes(':') ? routeTag.split(':')[0] ?? null : null;
}

function isCardCompatibleWithCharacter(card: CardDef, characterId: string): boolean {
  const owner = card.character ?? 'All';
  if (owner === 'All' || owner === characterId) return true;
  const routeTags = getCardRouteAffinityTags(card);
  return routeTags.some((tag) => routeOwner(tag) === characterId);
}

function characterForCard(card: CardDef): string {
  if (card.character && card.character !== 'All' && charactersData.some((character) => character.id === card.character)) {
    return card.character;
  }
  const routeTagOwner = getCardRouteAffinityTags(card).map(routeOwner).find((owner): owner is string => !!owner);
  if (routeTagOwner && charactersData.some((character) => character.id === routeTagOwner)) return routeTagOwner;

  const actionTypes = flattenActions(card.actions).map((action) => action.type);
  if (actionTypes.some((type) => String(type).includes('Thread'))) return 'puppeteer';
  if (actionTypes.some((type) => String(type).includes('TimeLayer') || String(type).includes('Delay'))) return 'chronomancer';
  if (actionTypes.some((type) => String(type).includes('Concoction') || String(type).includes('Element'))) return 'alchemist';
  return 'informant';
}

function characterForRelic(relic: RelicDef): string {
  const tagOwner = getRelicRouteTags(relic.id).map(routeOwner).find((owner): owner is string => !!owner);
  return tagOwner && charactersData.some((character) => character.id === tagOwner) ? tagOwner : 'informant';
}

function makeRunCard(card: CardDef, idHint: string): RunCardInstance {
  return createRunCardInstance(card, `longform_${idHint}_${card.id}`);
}

function makeDeck(cardIds: string[], idHint: string): RunCardInstance[] {
  return cardIds
    .map((cardId, index) => {
      const card = cardDefById(cardId);
      return card ? makeRunCard(card, `${idHint}_${index}`) : null;
    })
    .filter((card): card is RunCardInstance => !!card);
}

function preparePlayerForProbe(engine: GameEngine): void {
  engine.state.player.gold = 250;
  engine.state.player.intel = 10;
  engine.state.player.devotion = 20;
  engine.state.player.corruption = 10;
  engine.state.player.hp = engine.state.player.maxHp;
  engine.state.player.energy = engine.state.player.maxEnergy;
}

function ensureRelicState(state: GameState, relicIds: string[]): void {
  for (const relicId of relicIds) {
    state.player.relicStates[relicId] = state.player.relicStates[relicId] ?? { level: 1, progress: 0, corrupted: false };
  }
}

function prepareCombatResources(engine: GameEngine): void {
  const combat = engine.state.combat;
  if (!combat) return;
  combat.player.energy = Math.max(combat.player.energy, 9);
  combat.player.intel = Math.max(combat.player.intel ?? 0, 10);
  combat.player.timeLayer = Math.max(combat.player.timeLayer ?? 0, 10);
  combat.player.thread = Math.max(combat.player.thread ?? 0, 10);
  combat.player.concoction = Math.max(combat.player.concoction ?? 0, 10);
  combat.player.statuses.Strength = Math.max(combat.player.statuses.Strength ?? 0, 2);
  combat.player.statuses.Dexterity = Math.max(combat.player.statuses.Dexterity ?? 0, 2);
  for (const enemy of combat.enemies) {
    enemy.statuses.Poison = Math.max(enemy.statuses.Poison ?? 0, 4);
    enemy.statuses.Vulnerable = Math.max(enemy.statuses.Vulnerable ?? 0, 1);
    enemy.statuses.Weak = Math.max(enemy.statuses.Weak ?? 0, 1);
    enemy.block = Math.max(enemy.block, 3);
  }
}

function flattenActions(actions: ActionSpec[] | undefined): ActionSpec[] {
  const flattened: ActionSpec[] = [];
  for (const action of actions ?? []) {
    flattened.push(action);
    flattened.push(...flattenActions(action.actions));
    flattened.push(...flattenActions(action.effects));
    flattened.push(...flattenActions(action.trueActions));
    flattened.push(...flattenActions(action.falseActions));
    if (action.ifTrue) flattened.push(...flattenActions([action.ifTrue]));
    if (action.ifFalse) flattened.push(...flattenActions([action.ifFalse]));
    if (action.effect && 'type' in action.effect) flattened.push(action.effect as ActionSpec);
  }
  return flattened;
}

function actionAmount(action: ActionSpec, fallback = 0): number {
  return Math.max(
    fallback,
    Number(action.amount ?? 0),
    Number(action.damage ?? 0),
    Number(action.block ?? 0),
    Number(action.stacks ?? 0),
  );
}

function getCombatResource(engine: GameEngine, resource: string | undefined): number {
  const combatPlayer = engine.state.combat?.player as unknown as Record<string, unknown> | undefined;
  const player = engine.state.player as unknown as Record<string, unknown>;
  const key = resource || '';
  if (!key) return 0;
  if (typeof combatPlayer?.[key] === 'number') return Math.max(0, Math.floor(Number(combatPlayer[key])));
  if (typeof player[key] === 'number') return Math.max(0, Math.floor(Number(player[key])));
  return 0;
}

function scoreResourceEffect(engine: GameEngine, action: ActionSpec): number {
  const resource = String(action.resource || '');
  const available = getCombatResource(engine, resource);
  const effect = action.effect as ActionSpec | undefined;
  if (!effect || available <= 0) return 0;
  const maxSpend = action.type === 'SpendResourceUpTo'
    ? Math.min(available, Math.max(0, Number((action as any).maxAmount ?? action.amount ?? 0)))
    : action.type === 'SpendResourceEffect'
      ? Math.min(available, Math.max(0, Number(action.amount ?? 0)))
      : available;
  const amount = actionAmount(effect, 1) * Math.max(1, maxSpend);
  if (effect.type === 'DealDamage' || effect.type === 'DealDamagePiercing' || effect.type === 'DealWarpDamage') return amount * 1.75;
  if (effect.type === 'ApplyStatus') return amount * 2;
  if (effect.type === 'GainBlock') return amount * 1.2;
  if (effect.type === 'Draw') return amount * 3;
  return maxSpend * 3;
}

function estimateIncomingDamage(engine: GameEngine): number {
  const combat = engine.state.combat;
  if (!combat) return 0;
  let incoming = 0;
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0 || !enemy.nextIntent) continue;
    const enemyDef = enemiesData.find((entry) => entry.id === enemy.defId) as any;
    const moves = enemyDef?.moves?.[enemy.nextIntent] as ActionSpec[] | undefined;
    for (const action of flattenActions(moves)) {
      if (action.type === 'DealDamage' || action.type === 'ConditionalDamage' || action.type === 'DealWarpDamage') {
        incoming += Number(action.amount ?? (action as any).trueDamage ?? (action as any).falseDamage ?? 0);
      }
    }
    incoming += Math.max(0, Number(enemy.statuses.Strength || 0));
  }
  return incoming;
}

function scoreCard(engine: GameEngine, card: RunCardInstance): number {
  const combat = engine.state.combat;
  let score = card.cost === 0 ? 4 : 0;
  if (card.type === 'Attack') score += 5;
  if (card.type === 'Power') score += 7;
  if (card.type === 'Skill') score += 2;
  const incomingDamage = estimateIncomingDamage(engine);
  const missingBlock = Math.max(0, incomingDamage - (combat?.player.block ?? 0));

  for (const action of flattenActions(card.actions)) {
    const amount = actionAmount(action, 1);
    switch (String(action.type)) {
      case 'DealDamage':
      case 'ConditionalDamage':
        score += amount * 1.5;
        break;
      case 'DealWarpDamage':
      case 'DealDamagePiercing':
      case 'PrecisionThrowDamage':
        score += amount * 1.75;
        break;
      case 'ElementalOverloadDamage':
      case 'SolventDamage':
      case 'RemovePoisonAndDealDamage':
        score += amount * 1.6 + 4;
        break;
      case 'GainBlock':
      case 'ConditionalBonusBlock':
      case 'EmergencyBlock':
        score += amount * (missingBlock > 0 ? 2.15 : (combat?.player.hp ?? 1) / Math.max(1, combat?.player.maxHp ?? 1) < 0.45 ? 1.45 : 0.95);
        break;
      case 'ApplyStatus':
        score += action.status === 'Poison' || action.status === 'Burn' ? amount * 2.2 : amount * 1.5;
        break;
      case 'Draw':
      case 'ConditionalDraw':
      case 'DelayedDraw':
        score += amount * 3;
        break;
      case 'GainEnergy':
      case 'ModifyEnergy':
      case 'DelayedEnergy':
        score += amount * 4;
        break;
      case 'GainIntel':
      case 'GainTimeLayer':
      case 'GainThread':
      case 'GainConcoction':
      case 'GainResource':
      case 'ConditionalResourceGain':
        score += amount * 3.2;
        break;
      case 'SpendIntel':
      case 'SpendTimeLayer':
      case 'SpendThread':
      case 'SpendConcoction':
        score += 4;
        break;
      case 'SpendResourceEffect':
      case 'SpendResourceUpTo':
      case 'SpendAllResourceEffect':
        score += scoreResourceEffect(engine, action) + 4;
        break;
      case 'Summon':
      case 'SummonMegaConstruct':
        score += 8 + Number(action.hp ?? action.baseHp ?? 0) * 0.25 + Number(action.atk ?? action.attack ?? action.baseAtk ?? 0) * 1.5;
        break;
      case 'TriggerPoisonOnTarget':
      case 'TriggerPoisonAllEnemies':
      case 'TriggerReactions':
      case 'TriggerAllReactions':
      case 'TriggerRandomElementReaction':
        score += 9;
        break;
      case 'TriggerDelay':
        score += 8 + (combat?.player.delayedCards.length ?? 0) * 7;
        break;
      case 'ConstructOverdrive':
        score += 6 + (combat?.player.constructs.length ?? 0) * Math.max(3, Number(action.multiplier ?? 1) * 3);
        break;
      case 'PuppetAttack':
      case 'PuppetBuff':
      case 'BuffConstructs':
      case 'BuffAllConstructs':
        score += 6 + (combat?.player.constructs.length ?? 0) * 4;
        break;
      case 'ReplayLastCard':
      case 'ReturnLastCard':
      case 'CopyLeftmostSkill':
      case 'DelayNextCardEffect':
        score += 6;
        break;
      case 'HealSelf':
      case 'Heal':
      case 'ConditionalHeal':
        score += amount * 1.4;
        break;
      default:
        score += 1;
        break;
    }
  }

  const routeTags = getCardRouteAffinityTags(card);
  if (engine.state.routeState?.primaryTag && routeTags.includes(engine.state.routeState.primaryTag)) score += 5;
  return score - Math.max(0, card.cost - 1) * 0.8;
}

function chooseRouteReward(engine: GameEngine, routeTag: string): RunCardInstance | null {
  const rewards = engine.state.rewardCards ?? [];
  if (rewards.length === 0) return null;
  return [...rewards].sort((a, b) => {
    const aAligned = getCardRouteAffinityTags(a).includes(routeTag) ? 1 : 0;
    const bAligned = getCardRouteAffinityTags(b).includes(routeTag) ? 1 : 0;
    if (aAligned !== bAligned) return bAligned - aAligned;
    const rarityWeight = (card: RunCardInstance) => card.rarity === 'Rare' ? 3 : card.rarity === 'Uncommon' ? 2 : 1;
    return rarityWeight(b) - rarityWeight(a);
  })[0] ?? null;
}

function applyRouteRunRecovery(engine: GameEngine, routeTag: string, completedEncounter: EncounterType): void {
  if (engine.state.screen === 'Reward') {
    const reward = chooseRouteReward(engine, routeTag);
    if (reward) engine.takeReward(reward.instanceId);
    else engine.skipReward();
  }
  if (completedEncounter === 'Elite') {
    engine.state.screen = 'Rest';
    engine.restHeal();
  }
}

function getEnemyTargetId(engine: GameEngine): string | undefined {
  const alive = engine.state.combat?.enemies.filter((enemy) => enemy.hp > 0) ?? [];
  return [...alive].sort((a, b) => a.hp - b.hp)[0]?.id;
}

async function playCombat(engine: GameEngine): Promise<Omit<CombatSummary, 'encounter' | 'enemyDefIds'>> {
  let maxSeenTurn = engine.state.combat?.turn ?? 1;
  let cardsPlayed = 0;
  let safety = 0;

  while (engine.state.screen === 'Combat' && safety++ < 600) {
    await sleep();
    const combat = engine.state.combat;
    if (!combat) break;
    maxSeenTurn = Math.max(maxSeenTurn, combat.turn);
    if (combat.turn > 24) {
      return {
        victory: false,
        turns: maxSeenTurn,
        hpAfter: combat.player.hp,
        maxHp: combat.player.maxHp,
        cardsPlayed,
        timeout: true,
      };
    }
    if (!combat.isPlayerTurn) continue;

    let playedSomething = true;
    let inner = 0;
    while (engine.state.screen === 'Combat' && engine.state.combat?.isPlayerTurn && playedSomething && inner++ < 60) {
      playedSomething = false;
      const current = engine.state.combat;
      if (!current) break;
      const playable = current.hand.filter((card) => (card.cost ?? 0) <= current.player.energy);
      const ordered = [...playable].sort((a, b) => scoreCard(engine, b) - scoreCard(engine, a));
      for (const card of ordered) {
        const beforeEnergy = current.player.energy;
        const beforeHandLength = current.hand.length;
        const targetId = card.targeting === 'Enemy' ? getEnemyTargetId(engine) : undefined;
        if (card.targeting === 'Enemy' && !targetId) continue;
        await engine.playCard(card.instanceId, targetId);
        await sleep();
        const after = engine.state.combat;
        if (!after || engine.state.screen !== 'Combat') {
          cardsPlayed += 1;
          break;
        }
        if (after.player.energy !== beforeEnergy || after.hand.length !== beforeHandLength) {
          cardsPlayed += 1;
          playedSomething = true;
          break;
        }
      }
    }
    if (engine.state.screen === 'Combat' && engine.state.combat?.isPlayerTurn) {
      await engine.endTurn();
      await sleep();
    }
  }

  return {
    victory: engine.state.screen !== 'GameOver',
    turns: maxSeenTurn,
    hpAfter: engine.state.player.hp,
    maxHp: engine.state.player.maxHp,
    cardsPlayed,
  };
}

function buildRouteDeck(characterId: string, routeTag: string): string[] {
  const character = charactersData.find((entry) => entry.id === characterId);
  const startingDeck = character?.startingDeck ?? [];
  const trimmedStartingDeck: string[] = [];
  let removedBasics = 0;
  for (const cardId of startingDeck) {
    if (removedBasics < 3 && (cardId === 'strike' || cardId === 'defend')) {
      removedBasics += 1;
      continue;
    }
    trimmedStartingDeck.push(cardId);
  }
  const routeCards = cardsData
    .filter((card) => isCardCompatibleWithCharacter(card, characterId))
    .filter((card) => getCardRouteAffinityTags(card).includes(routeTag))
    .sort((a, b) => {
      const roleWeight = (card: CardDef) =>
        card.earlyGameRole === 'route_payoff' ? 4 : card.earlyGameRole === 'route_confirm' ? 3 : card.earlyGameRole === 'generic_power' ? 2 : 1;
      return roleWeight(b) - roleWeight(a) || a.id.localeCompare(b.id);
    })
    .map((card) => card.id);
  const genericPowerIds = getGenericPowerIdsForCharacter(characterId);
  const neutralCards = cardsData
    .filter((card) => isCardCompatibleWithCharacter(card, characterId))
    .filter((card) => !['Starter'].includes(card.rarity))
    .filter((card) => getCardRouteAffinityTags(card).length === 0 || genericPowerIds.includes(card.id))
    .sort((a, b) => {
      const rarityWeight = (card: CardDef) => card.rarity === 'Rare' ? 3 : card.rarity === 'Uncommon' ? 2 : 1;
      return rarityWeight(b) - rarityWeight(a) || a.id.localeCompare(b.id);
    })
    .slice(0, 5)
    .map((card) => card.id);
  return unique([...trimmedStartingDeck, ...routeCards.slice(0, 12), ...neutralCards]).slice(0, 20);
}

function buildRouteRelics(routeTag: string): string[] {
  const support = getRouteSupportRelicIds(routeTag).filter((relicId) => relicsData.some((relic) => relic.id === relicId));
  const isStartingRelic = (relic: RelicDef): boolean =>
    Boolean((relic as RelicDef & { isStartingRelic?: boolean }).isStartingRelic);
  const fallback = relicsData
    .filter((relic) => !isStartingRelic(relic) && !support.includes(relic.id))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, 2)
    .map((relic) => relic.id);
  return unique([...support.slice(0, 3), ...fallback]).slice(0, 4);
}

async function runBuildScenario(characterId: string, routeTag: string, seed: number): Promise<BuildRunSummary> {
  const engine = new GameEngine(seed, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter(characterId);
    preparePlayerForProbe(engine);
    const deckIds = buildRouteDeck(characterId, routeTag);
    const relicIds = buildRouteRelics(routeTag);
    engine.state.player.deck = makeDeck(deckIds, `${characterId}_${routeTag}_${seed}`);
    engine.state.player.relics = relicIds;
    ensureRelicState(engine.state, relicIds);
    engine.state.routeState = {
      primaryTag: routeTag,
      secondaryTag: null,
      confidence: 85,
      stage: 'committed',
      recentCommits: [{ tag: routeTag, floor: 1, source: 'reward', weight: 40 }],
    };

    const encounters: CombatSummary[] = [];
    const playedCardIds = new Set<string>();
    for (const encounter of ENCOUNTERS) {
      engine.startCombat(encounter);
      const enemyDefIds = engine.state.combat?.enemies.map((enemy) => enemy.defId) ?? [];
      const combatResult = await playCombat(engine);
      for (const card of engine.state.combat?.discardPile ?? []) playedCardIds.add(card.id);
      encounters.push({ encounter, enemyDefIds, ...combatResult });
      if (!combatResult.victory || combatResult.timeout || engine.state.screen === 'GameOver') break;
      applyRouteRunRecovery(engine, routeTag, encounter);
      engine.state.screen = 'Map';
    }

    const victories = encounters.filter((entry) => entry.victory && !entry.timeout).length;
    const finalHp = Math.max(0, engine.state.player.hp);
    return {
      characterId,
      routeTag,
      seed,
      victories,
      encounters,
      survived: victories === ENCOUNTERS.length && engine.state.screen !== 'GameOver' && finalHp > 0,
      finalHp,
      finalHpRatio: Number((finalHp / Math.max(1, engine.state.player.maxHp)).toFixed(4)),
      deckIds,
      relicIds,
      playedCardIds: [...playedCardIds].sort(),
    };
  } catch (error) {
    return {
      characterId,
      routeTag,
      seed,
      victories: 0,
      encounters: [],
      survived: false,
      finalHp: engine.state.player.hp,
      finalHpRatio: Number((engine.state.player.hp / Math.max(1, engine.state.player.maxHp)).toFixed(4)),
      deckIds: buildRouteDeck(characterId, routeTag),
      relicIds: buildRouteRelics(routeTag),
      playedCardIds: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    engine.dispose();
  }
}

async function runCardProbes(): Promise<CardProbeResult & { coveredIds: string[] }> {
  const failed: CardProbeResult['failed'] = [];
  const coveredIds = new Set<string>();
  for (const card of cardsData) {
    const characterId = characterForCard(card);
    const engine = new GameEngine(70_000 + coveredIds.size, null, { enableRuntimeDelegation: false });
    try {
      engine.selectCharacter(characterId);
      preparePlayerForProbe(engine);
      engine.state.player.deck = makeDeck([card.id, ...charactersData.find((entry) => entry.id === characterId)?.startingDeck ?? []], `probe_${card.id}`);
      engine.startCombat('Combat');
      prepareCombatResources(engine);
      if (!engine.state.combat) throw new Error('combat did not start');
      const instance = makeRunCard(card, `probe_${card.id}`);
      engine.state.combat.hand = [instance];
      engine.state.combat.drawPile = [];
      const beforeCardsPlayed = engine.state.combat.player.cardsPlayedThisTurn;
      const beforeEnergy = engine.state.combat.player.energy;
      const targetId = card.targeting === 'Enemy' ? getEnemyTargetId(engine) : undefined;
      if (card.targeting === 'Enemy' && !targetId) throw new Error('no enemy target');
      await engine.playCard(instance.instanceId, targetId);
      await sleep();
      const afterCombat = engine.state.combat;
      const played =
        engine.state.screen !== 'Combat' ||
        (afterCombat?.player.cardsPlayedThisTurn ?? beforeCardsPlayed) > beforeCardsPlayed ||
        (afterCombat?.player.energy ?? beforeEnergy) < beforeEnergy ||
        afterCombat?.player.lastPlayedCard?.instanceId === instance.instanceId;
      if (!played) throw new Error('playCard did not consume energy or register card play');
      coveredIds.add(card.id);
    } catch (error) {
      failed.push({ cardId: card.id, characterId, reason: error instanceof Error ? error.message : String(error) });
    } finally {
      engine.dispose();
    }
  }
  return {
    total: cardsData.length,
    passed: coveredIds.size,
    failed,
    coveredIds: [...coveredIds].sort(),
  };
}

async function runRelicProbes(): Promise<RelicProbeResult & { coveredIds: string[] }> {
  const failed: RelicProbeResult['failed'] = [];
  const coveredIds = new Set<string>();
  for (const relic of relicsData) {
    const characterId = characterForRelic(relic);
    const engine = new GameEngine(80_000 + coveredIds.size, null, { enableRuntimeDelegation: false });
    try {
      engine.selectCharacter(characterId);
      preparePlayerForProbe(engine);
      engine.state.player.relics = [relic.id];
      ensureRelicState(engine.state, [relic.id]);
      engine.startCombat('Combat');
      await sleep();
      if (engine.state.screen !== 'Combat' || !engine.state.combat) throw new Error('combat did not start with relic');
      coveredIds.add(relic.id);
    } catch (error) {
      failed.push({ relicId: relic.id, characterId, reason: error instanceof Error ? error.message : String(error) });
    } finally {
      engine.dispose();
    }
  }
  return {
    total: relicsData.length,
    passed: coveredIds.size,
    failed,
    coveredIds: [...coveredIds].sort(),
  };
}

function chooseEventCharacter(eventId: string): string {
  const routeOwnerId = getEventRouteSignal(eventId)?.routeTags.map(routeOwner).find((owner): owner is string => !!owner);
  return routeOwnerId && charactersData.some((entry) => entry.id === routeOwnerId) ? routeOwnerId : 'informant';
}

function firstMapNodeAtOrBefore(engine: GameEngine, floor: number): MapNode | null {
  const zeroBasedFloor = Math.max(0, floor - 1);
  return [...engine.state.map].sort((a, b) => Math.abs(a.y - zeroBasedFloor) - Math.abs(b.y - zeroBasedFloor))[0] ?? null;
}

async function runEventProbes(): Promise<EventProbeResult & { coveredChoiceIds: string[] }> {
  const unresolved: EventProbeResult['unresolved'] = [];
  const coveredChoiceIds = new Set<string>();
  for (const eventDef of STORY_EVENTS) {
    for (const choice of eventDef.options) {
      const characterId = chooseEventCharacter(eventDef.id);
      const engine = new GameEngine(90_000 + coveredChoiceIds.size, null, { enableRuntimeDelegation: false });
      try {
        engine.selectCharacter(characterId);
        preparePlayerForProbe(engine);
        engine.state.currentNodeId = firstMapNodeAtOrBefore(engine, eventDef.floorMin)?.id ?? engine.state.currentNodeId;
        engine.state.activeEvent = { id: eventDef.id, data: {} };
        engine.state.screen = 'Event';
        const eventSignal = getEventRouteSignal(eventDef.id);
        const primaryTag = eventSignal?.routeTags.find((tag) => routeOwner(tag) === characterId) ?? getKnownRouteTagsForCharacter(characterId)[0] ?? null;
        engine.state.routeState = primaryTag
          ? {
              primaryTag,
              secondaryTag: null,
              confidence: 80,
              stage: 'committed',
              recentCommits: [{ tag: primaryTag, floor: eventDef.floorMin, source: 'reward', weight: 32 }],
            }
          : null;
        engine.resolveEventChoice(choice.id);
        await sleep();
        const consumed =
          engine.state.activeEvent === null ||
          engine.state.screen !== 'Event' ||
          engine.state.activeEvent.stage !== undefined ||
          engine.state.activeEvent?.data?.salvageRewardsClaimed === true ||
          engine.state.activeEvent?.data?.freeRemovalsRemaining !== undefined;
        if (!consumed) {
          unresolved.push({
            eventId: eventDef.id,
            choiceId: choice.id,
            screen: engine.state.screen,
            activeEvent: engine.state.activeEvent?.id ?? null,
            reason: `choice role ${getEventChoiceRouteRole(eventDef.id, choice.id) ?? 'none'} did not resolve state`,
          });
        } else {
          coveredChoiceIds.add(`${eventDef.id}:${choice.id}`);
        }
      } catch (error) {
        unresolved.push({
          eventId: eventDef.id,
          choiceId: choice.id,
          screen: engine.state.screen,
          activeEvent: engine.state.activeEvent?.id ?? null,
          reason: error instanceof Error ? error.message : String(error),
        });
      } finally {
        engine.dispose();
      }
    }
  }
  return {
    totalOptions: STORY_EVENTS.reduce((sum, eventDef) => sum + eventDef.options.length, 0),
    resolved: coveredChoiceIds.size,
    unresolved,
    coveredChoiceIds: [...coveredChoiceIds].sort(),
  };
}

function summarizeBuildRuns(buildRuns: BuildRunSummary[]): LongformReport['buildSummaries'] {
  const grouped = new Map<string, BuildRunSummary[]>();
  for (const run of buildRuns) {
    const key = `${run.characterId}::${run.routeTag}`;
    grouped.set(key, [...(grouped.get(key) ?? []), run]);
  }
  return [...grouped.values()].map((runs) => {
    const allEncounters = runs.flatMap((run) => run.encounters);
    const survivalRate = runs.filter((run) => run.survived).length / Math.max(1, runs.length);
    const avgFinalHpRatio = runs.reduce((sum, run) => sum + run.finalHpRatio, 0) / Math.max(1, runs.length);
    const avgTurns = allEncounters.reduce((sum, entry) => sum + entry.turns, 0) / Math.max(1, allEncounters.length);
    const victoryRate = allEncounters.filter((entry) => entry.victory && !entry.timeout).length / Math.max(1, allEncounters.length);
    return {
      characterId: runs[0].characterId,
      routeTag: runs[0].routeTag,
      runs: runs.length,
      survivalRate: Number(survivalRate.toFixed(4)),
      avgFinalHpRatio: Number(avgFinalHpRatio.toFixed(4)),
      avgTurns: Number(avgTurns.toFixed(2)),
      victoryRate: Number(victoryRate.toFixed(4)),
      lowSampleRuns: runs
        .filter((run) => !run.survived || run.finalHpRatio < MIN_AVG_FINAL_HP_RATIO)
        .map((run) => ({
          seed: run.seed,
          victories: run.victories,
          finalHpRatio: run.finalHpRatio,
          turns: run.encounters.reduce((sum, entry) => sum + entry.turns, 0),
        })),
    };
  }).sort((a, b) => a.characterId.localeCompare(b.characterId) || a.routeTag.localeCompare(b.routeTag));
}

function buildCoverage(
  buildRuns: BuildRunSummary[],
  cardProbe: CardProbeResult & { coveredIds: string[] },
  relicProbe: RelicProbeResult & { coveredIds: string[] },
  eventProbe: EventProbeResult & { coveredChoiceIds: string[] },
): CoverageSummary {
  const characterIds = charactersData.map((character) => character.id);
  const coveredCharacters = new Set(buildRuns.map((run) => run.characterId));
  const allRouteBuilds = characterIds.flatMap((characterId) => getKnownRouteTagsForCharacter(characterId).map((routeTag) => `${characterId}:${routeTag}`));
  const coveredRouteBuilds = new Set(buildRuns.filter((run) => run.encounters.length > 0).map((run) => `${run.characterId}:${run.routeTag}`));
  const eventChoiceIds = STORY_EVENTS.flatMap((eventDef) => eventDef.options.map((choice) => `${eventDef.id}:${choice.id}`));
  return {
    characters: {
      covered: coveredCharacters.size,
      total: characterIds.length,
      missing: characterIds.filter((id) => !coveredCharacters.has(id)),
    },
    routeBuilds: {
      covered: coveredRouteBuilds.size,
      total: allRouteBuilds.length,
      missing: allRouteBuilds.filter((id) => !coveredRouteBuilds.has(id)),
    },
    cards: {
      covered: cardProbe.coveredIds.length,
      total: cardsData.length,
      missing: cardsData.map((card) => card.id).filter((id) => !cardProbe.coveredIds.includes(id)),
    },
    relics: {
      covered: relicProbe.coveredIds.length,
      total: relicsData.length,
      missing: relicsData.map((relic) => relic.id).filter((id) => !relicProbe.coveredIds.includes(id)),
    },
    events: {
      covered: eventProbe.coveredChoiceIds.length,
      total: eventChoiceIds.length,
      missing: eventChoiceIds.filter((id) => !eventProbe.coveredChoiceIds.includes(id)),
    },
  };
}

function buildFindings(
  coverage: CoverageSummary,
  buildSummaries: LongformReport['buildSummaries'],
  cardProbe: CardProbeResult,
  relicProbe: RelicProbeResult,
  eventProbe: EventProbeResult,
): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  for (const [area, entry] of Object.entries(coverage) as Array<[keyof CoverageSummary, { covered: number; total: number; missing: string[] }]>) {
    if (entry.missing.length > 0) {
      findings.push({
        severity: 'high',
        area: 'coverage',
        id: area,
        message: `${area} coverage incomplete: ${entry.covered}/${entry.total}; missing ${entry.missing.slice(0, 12).join(', ')}`,
      });
    }
  }
  for (const summary of buildSummaries) {
    if (summary.survivalRate < MIN_BUILD_SURVIVAL || summary.avgFinalHpRatio < MIN_AVG_FINAL_HP_RATIO) {
      findings.push({
        severity: 'high',
        area: 'build',
        id: summary.routeTag,
        message: `${summary.characterId} ${summary.routeTag} under target: survival=${summary.survivalRate}, avgHp=${summary.avgFinalHpRatio}, avgTurns=${summary.avgTurns}`,
      });
    } else if (summary.avgFinalHpRatio > MAX_AVG_FINAL_HP_RATIO && summary.avgTurns < 5) {
      findings.push({
        severity: 'medium',
        area: 'build',
        id: summary.routeTag,
        message: `${summary.characterId} ${summary.routeTag} may be too safe: avgHp=${summary.avgFinalHpRatio}, avgTurns=${summary.avgTurns}`,
      });
    } else if (summary.avgTurns > MAX_AVG_TURNS) {
      findings.push({
        severity: 'medium',
        area: 'build',
        id: summary.routeTag,
        message: `${summary.characterId} ${summary.routeTag} is slow: avgTurns=${summary.avgTurns}`,
      });
    }
  }
  for (const failure of cardProbe.failed.slice(0, 12)) {
    findings.push({ severity: 'high', area: 'card', id: failure.cardId, message: `Card probe failed for ${failure.characterId}: ${failure.reason}` });
  }
  for (const failure of relicProbe.failed.slice(0, 12)) {
    findings.push({ severity: 'high', area: 'relic', id: failure.relicId, message: `Relic probe failed for ${failure.characterId}: ${failure.reason}` });
  }
  for (const failure of eventProbe.unresolved.slice(0, 12)) {
    findings.push({ severity: 'high', area: 'event', id: `${failure.eventId}:${failure.choiceId}`, message: failure.reason });
  }
  return findings;
}

async function main(): Promise<void> {
  const pass = parseNumberArg('pass', 1);
  const runsPerBuild = parseNumberArg('runs-per-build', DEFAULT_RUNS_PER_BUILD);
  const outputDir = parseStringArg('out-dir', path.join('reports', 'balance'));
  const buildRuns: BuildRunSummary[] = [];

  for (const character of charactersData) {
    for (const routeTag of getKnownRouteTagsForCharacter(character.id)) {
      for (let runIndex = 0; runIndex < runsPerBuild; runIndex += 1) {
        const seed = pass * 100_000 + character.id.length * 1_000 + routeTag.length * 100 + runIndex;
        buildRuns.push(await runBuildScenario(character.id, routeTag, seed));
      }
    }
  }

  const cardProbe = await runCardProbes();
  const relicProbe = await runRelicProbes();
  const eventProbe = await runEventProbes();
  const coverage = buildCoverage(buildRuns, cardProbe, relicProbe, eventProbe);
  const buildSummaries = summarizeBuildRuns(buildRuns);
  const findings = buildFindings(coverage, buildSummaries, cardProbe, relicProbe, eventProbe);
  const report: LongformReport = {
    generatedAt: new Date().toISOString(),
    pass,
    runsPerBuild,
    thresholds: {
      minBuildSurvival: MIN_BUILD_SURVIVAL,
      maxBuildSurvival: MAX_BUILD_SURVIVAL,
      minAverageFinalHpRatio: MIN_AVG_FINAL_HP_RATIO,
      maxAverageFinalHpRatio: MAX_AVG_FINAL_HP_RATIO,
      maxAverageTurns: MAX_AVG_TURNS,
    },
    coverage,
    buildSummaries,
    probes: {
      cards: {
        total: cardProbe.total,
        passed: cardProbe.passed,
        failed: cardProbe.failed,
      },
      relics: {
        total: relicProbe.total,
        passed: relicProbe.passed,
        failed: relicProbe.failed,
      },
      events: {
        totalOptions: eventProbe.totalOptions,
        resolved: eventProbe.resolved,
        unresolved: eventProbe.unresolved,
      },
    },
    buildRuns,
    findings,
  };

  mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `longform-balance-pass-${pass}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    reportPath,
    pass,
    runsPerBuild,
    coverage,
    buildCount: buildSummaries.length,
    findingCount: findings.length,
    topFindings: findings.slice(0, 10),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
