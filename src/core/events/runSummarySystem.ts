import type { GameState, RunSummary } from '@/core/types';
import { cardsData } from '@/content/narrative/numericSystem';
import { relicsData } from '@/content/narrative/numericSystem';
import { metaBalance } from '@/core/balance/metaBalance';

const cardById = new Map(cardsData.map((c) => [c.id, c]));
const relicById = new Map(relicsData.map((r) => [r.id, r]));

function getReachedFloor(state: GameState): number {
  const current = state.currentNodeId ? state.map.find((n) => n.id === state.currentNodeId) : null;
  if (current) return current.y + 1;
  const revealedFloors = state.map.filter((n) => n.revealed).map((n) => n.y);
  return (revealedFloors.length > 0 ? Math.max(...revealedFloors) : 0) + 1;
}

function getCauseOfDeath(state: GameState): string {
  if (state.screen === 'Victory') return 'Victory';
  const aliveEnemy = state.combat?.enemies?.find((e) => e.hp > 0);
  if (aliveEnemy) return `Killed by ${aliveEnemy.name}`;
  if ((state.player.hp || 0) <= 0) return 'Fatal wounds';
  return 'Unknown';
}

export function computeRunSummary(state: GameState): RunSummary {
  const cfg = metaBalance.currencyConversion;
  const reachedFloor = Math.max(1, getReachedFloor(state));
  const finalDeckSize = state.player.deck.length;
  const isVictory = state.screen === 'Victory';

  let earnedRequisition = Math.floor((state.player.gold || 0) / Math.max(1, cfg.goldPerRequisition));
  let earnedWarpEchoes = 0;

  for (const card of state.player.deck) {
    const def = cardById.get(card.id) || (card as any);
    const rarity = String(def?.rarity || card.rarity || 'Common');
    if (rarity === 'Rare') {
      earnedRequisition += cfg.rareCardSalvageRequisition || 0;
      earnedWarpEchoes += cfg.rareCardWarpEchoes || 0;
    } else if (rarity === 'Uncommon') {
      earnedRequisition += cfg.uncommonCardSalvageRequisition || 0;
    } else if (rarity === 'Common') {
      earnedRequisition += cfg.commonCardSalvageRequisition || 0;
    }
  }

  for (const relicId of state.player.relics || []) {
    const relic = relicById.get(relicId) as any;
    earnedRequisition += cfg.relicSalvageRequisition || 0;
    if (relic?.corrupted) {
      earnedWarpEchoes += cfg.corruptedRelicWarpEchoes || 0;
    }
  }

  const corruption = Math.max(0, Number(state.player.corruption || 0));
  earnedWarpEchoes += Math.floor(corruption / 50) * (cfg.highCorruptionPer50WarpEchoes || 0);

  if (isVictory) {
    earnedWarpEchoes += cfg.bossVictoryWarpEchoes || 0;
  }

  earnedRequisition = Math.max(0, Math.floor(earnedRequisition));
  earnedWarpEchoes = Math.max(0, Math.floor(earnedWarpEchoes));

  return {
    runId: state.runId || `run_${state.seed}_${reachedFloor}_${finalDeckSize}`,
    reachedFloor,
    causeOfDeath: getCauseOfDeath(state),
    finalDeckSize,
    earnedRequisition,
    earnedWarpEchoes,
    isVictory,
    voxLogTail: [...(state.lastDeathVoxLog || state.lastCombatVoxLog || state.combatVoxLog || [])].slice(-5),
    chapterReached: Math.ceil(reachedFloor / 8),
    bossKilledIds: [],
    endingArchetype: 'unknown',
    topResourceUsed: 'gold',
    controlUptime: 0,
    poisonContribution: 0,
    runPreset: {
      doctrineId: null,
      startingRelicId: null,
      backgroundId: null
    },
    mirrorZoneVisited: state.mirrorZoneVisited ?? false,
    branchCardsTaken: state.branchCardsTaken ?? [],
    secondaryResourcePeak: state.secondaryResourcePeak ?? 0
  };
}
