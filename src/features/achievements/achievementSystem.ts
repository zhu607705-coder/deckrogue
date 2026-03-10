import achievementsData from '@/content/data/achievements.json';
import type { GameState, MetaProfile, RunSummary } from '@/core';

export interface AchievementRewardDef {
  unlockedPoolIds?: string[];
  characters?: string[];
  cardSkins?: string[];
  startingRelics?: string[];
  backgrounds?: string[];
}

export interface AchievementConditions {
  requireVictory?: boolean;
  characterId?: string;
  minReachedFloor?: number;
  minCorruption?: number;
  minDevotion?: number;
  minRelicCount?: number;
  maxDeckSize?: number;
  minEarnedRequisition?: number;
  minEarnedWarpEchoes?: number;
  maxCurrentHpPctAtEnd?: number;
  requiresMartyrLegacyCreated?: boolean;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  hidden?: boolean;
  conditions: AchievementConditions;
  rewards?: AchievementRewardDef;
}

export interface AchievementEvaluationContext {
  state: GameState;
  summary: RunSummary;
  martyrLegacyCreated?: boolean;
}

export interface AchievementEvaluationResult {
  newlyUnlockedAchievementIds: string[];
  unlockedRewards: {
    unlockedPoolIds: string[];
    characters: string[];
    cardSkins: string[];
    startingRelics: string[];
    backgrounds: string[];
  };
}

export type AchievementLinkCategory = 'cards' | 'relics' | 'backgrounds';

const ACHIEVEMENTS = (achievementsData as AchievementDef[]).filter((a) => a && typeof a.id === 'string');

export function getAchievementDefs(): AchievementDef[] {
  return ACHIEVEMENTS;
}

export function getAchievementDefById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

function passesConditions(def: AchievementDef, ctx: AchievementEvaluationContext): boolean {
  const c = def.conditions || {};
  const { state, summary } = ctx;
  const characterId = state.character?.id || '';
  const currentHp = Math.max(0, Number(state.player.hp) || 0);
  const maxHp = Math.max(1, Number(state.player.maxHp) || 1);
  const hpPct = currentHp / maxHp;

  if (c.requireVictory && !summary.isVictory) return false;
  if (c.characterId && c.characterId !== characterId) return false;
  if (typeof c.minReachedFloor === 'number' && summary.reachedFloor < c.minReachedFloor) return false;
  if (typeof c.minCorruption === 'number' && (Number(state.player.corruption) || 0) < c.minCorruption) return false;
  if (typeof c.minDevotion === 'number' && (Number(state.player.devotion) || 0) < c.minDevotion) return false;
  if (typeof c.minRelicCount === 'number' && (state.player.relics?.length || 0) < c.minRelicCount) return false;
  if (typeof c.maxDeckSize === 'number' && summary.finalDeckSize > c.maxDeckSize) return false;
  if (typeof c.minEarnedRequisition === 'number' && summary.earnedRequisition < c.minEarnedRequisition) return false;
  if (typeof c.minEarnedWarpEchoes === 'number' && summary.earnedWarpEchoes < c.minEarnedWarpEchoes) return false;
  if (typeof c.maxCurrentHpPctAtEnd === 'number' && hpPct > c.maxCurrentHpPctAtEnd) return false;
  if (c.requiresMartyrLegacyCreated && !ctx.martyrLegacyCreated) return false;

  return true;
}

function pushUniqueAll(target: string[], values: unknown): void {
  if (!Array.isArray(values)) return;
  for (const v of values) {
    if (typeof v !== 'string' || !v.trim()) continue;
    if (!target.includes(v)) target.push(v);
  }
}

export function evaluateRunAchievements(
  profile: MetaProfile,
  ctx: AchievementEvaluationContext
): AchievementEvaluationResult {
  const unlocked = new Set(profile.achievements?.unlockedIds || []);
  const newlyUnlockedAchievementIds: string[] = [];
  const unlockedRewards = {
    unlockedPoolIds: [] as string[],
    characters: [] as string[],
    cardSkins: [] as string[],
    startingRelics: [] as string[],
    backgrounds: [] as string[],
  };

  for (const def of ACHIEVEMENTS) {
    if (!def?.id || unlocked.has(def.id)) continue;
    if (!passesConditions(def, ctx)) continue;
    unlocked.add(def.id);
    newlyUnlockedAchievementIds.push(def.id);
    const rewards = def.rewards || {};
    pushUniqueAll(unlockedRewards.unlockedPoolIds, rewards.unlockedPoolIds);
    pushUniqueAll(unlockedRewards.characters, rewards.characters);
    pushUniqueAll(unlockedRewards.cardSkins, rewards.cardSkins);
    pushUniqueAll(unlockedRewards.startingRelics, rewards.startingRelics);
    pushUniqueAll(unlockedRewards.backgrounds, rewards.backgrounds);
  }

  return { newlyUnlockedAchievementIds, unlockedRewards };
}

export function getAchievementUnlockedCount(profile: MetaProfile | null | undefined): number {
  return profile?.achievements?.unlockedIds?.length || 0;
}

export function getAchievementTotalCount(): number {
  return ACHIEVEMENTS.length;
}

export function getAchievementsLinkedToEntity(category: AchievementLinkCategory, id: string): AchievementDef[] {
  if (!id) return [];
  return ACHIEVEMENTS.filter((a) => {
    const rewards = a.rewards || {};
    if (category === 'cards') return (rewards.unlockedPoolIds || []).includes(id);
    if (category === 'relics') return (rewards.startingRelics || []).includes(id) || (rewards.unlockedPoolIds || []).includes(id);
    if (category === 'backgrounds') return (rewards.backgrounds || []).includes(id);
    return false;
  });
}
