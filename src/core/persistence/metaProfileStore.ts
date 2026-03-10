import type { GameState, MartyrRelic, MetaProfile, RunSummary } from '@/core/types';
import { getAscensionMaxLevel, metaBalance } from '@/core/balance/metaBalance';
import { cardsData } from '@/content/narrative/numericSystem';
import { relicsData } from '@/content/narrative/numericSystem';
import { evaluateRunAchievements } from '@/features/achievements/achievementSystem';

const META_PROFILE_KEY = 'deckrogue_meta_profile_v1';

export function createDefaultMetaProfile(): MetaProfile {
  return {
    currencies: {
      requisition: 0,
      warpEchoes: 0
    },
    unlockedPools: [],
    activeUpgrades: [],
    activePacts: [],
    martyrLegacy: null,
    runHistory: [],
    unlocks: {
      characters: [],
      cardSkins: [],
      startingRelics: [],
      backgrounds: []
    },
    achievements: {
      unlockedIds: [],
      unlockedAt: {},
      lastUnlockedIds: []
    },
    preferences: {
      selectedStartingRelicId: null,
      selectedBackgroundId: null,
      selectedAscension: 0
    },
    progression: {
      ascensionUnlockedLevel: 0
    }
  };
}

function normalizeProfile(raw: any): MetaProfile {
  const base = createDefaultMetaProfile();
  return {
    currencies: {
      requisition: Math.max(0, Math.floor(Number(raw?.currencies?.requisition || 0))),
      warpEchoes: Math.max(0, Math.floor(Number(raw?.currencies?.warpEchoes || 0)))
    },
    unlockedPools: Array.isArray(raw?.unlockedPools) ? raw.unlockedPools.filter((x: any) => typeof x === 'string') : base.unlockedPools,
    activeUpgrades: Array.isArray(raw?.activeUpgrades) ? raw.activeUpgrades.filter((x: any) => typeof x === 'string') : base.activeUpgrades,
    activePacts: Array.isArray(raw?.activePacts) ? raw.activePacts.filter((x: any) => typeof x === 'string') : base.activePacts,
    martyrLegacy: raw?.martyrLegacy && typeof raw.martyrLegacy === 'object' ? raw.martyrLegacy as MartyrRelic : null,
    runHistory: Array.isArray(raw?.runHistory) ? raw.runHistory.filter((x: any) => x && typeof x.runId === 'string') : base.runHistory,
    unlocks: {
      characters: Array.isArray(raw?.unlocks?.characters) ? raw.unlocks.characters.filter((x: any) => typeof x === 'string') : base.unlocks.characters,
      cardSkins: Array.isArray(raw?.unlocks?.cardSkins) ? raw.unlocks.cardSkins.filter((x: any) => typeof x === 'string') : base.unlocks.cardSkins,
      startingRelics: Array.isArray(raw?.unlocks?.startingRelics) ? raw.unlocks.startingRelics.filter((x: any) => typeof x === 'string') : base.unlocks.startingRelics,
      backgrounds: Array.isArray(raw?.unlocks?.backgrounds) ? raw.unlocks.backgrounds.filter((x: any) => typeof x === 'string') : base.unlocks.backgrounds
    },
    achievements: {
      unlockedIds: Array.isArray(raw?.achievements?.unlockedIds) ? raw.achievements.unlockedIds.filter((x: any) => typeof x === 'string') : base.achievements.unlockedIds,
      unlockedAt: raw?.achievements?.unlockedAt && typeof raw.achievements.unlockedAt === 'object'
        ? Object.fromEntries(Object.entries(raw.achievements.unlockedAt).filter(([k, v]) => typeof k === 'string' && Number.isFinite(Number(v))).map(([k, v]) => [k, Math.floor(Number(v))]))
        : base.achievements.unlockedAt,
      lastUnlockedIds: Array.isArray(raw?.achievements?.lastUnlockedIds) ? raw.achievements.lastUnlockedIds.filter((x: any) => typeof x === 'string') : base.achievements.lastUnlockedIds
    },
    preferences: {
      selectedStartingRelicId: typeof raw?.preferences?.selectedStartingRelicId === 'string' ? raw.preferences.selectedStartingRelicId : null,
      selectedBackgroundId: typeof raw?.preferences?.selectedBackgroundId === 'string' ? raw.preferences.selectedBackgroundId : null,
      selectedAscension: Math.max(0, Math.min(20, Math.floor(Number(raw?.preferences?.selectedAscension || 0))))
    },
    progression: {
      ascensionUnlockedLevel: Math.max(0, Math.min(20, Math.floor(Number(raw?.progression?.ascensionUnlockedLevel || 0))))
    }
  };
}

function mergeUniqueStrings(base: string[], extras: string[]): string[] {
  const out = [...base];
  for (const item of extras) {
    if (typeof item !== 'string' || !item.trim()) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function loadMetaProfile(): MetaProfile {
  try {
    const raw = localStorage.getItem(META_PROFILE_KEY);
    if (!raw) return createDefaultMetaProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return createDefaultMetaProfile();
  }
}

export function saveMetaProfile(profile: MetaProfile): boolean {
  try {
    localStorage.setItem(META_PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch (error) {
    console.error('[MetaProfile] Failed to save profile:', error);
    return false;
  }
}

function buildMartyrLegacyFromRun(state: GameState, summary: RunSummary): MartyrRelic | null {
  const cfg = metaBalance.martyrLegacy;
  if (summary.isVictory) return null;
  if (summary.reachedFloor < Math.max(1, Number(cfg.enabledFromFloor || 3))) return null;

  const rareOrUncommon = [...state.player.deck].reverse().find((c) => c.rarity === 'Rare' || c.rarity === 'Uncommon');
  const inheritedCardId = rareOrUncommon?.id;
  const inheritedRelicId = (state.player.relics || []).find((id) => relicsData.some((r: any) => r.id === id));
  if (!inheritedCardId && !inheritedRelicId) return null;

  const enemyName = state.combat?.enemies?.find((e) => e.hp > 0)?.name;
  const cause = enemyName ? `死于第${summary.reachedFloor}层的${enemyName}` : `死于第${summary.reachedFloor}层`;
  const relicName = inheritedRelicId ? ((relicsData as any[]).find(r => r.id === inheritedRelicId)?.name || inheritedRelicId) : '';
  const cardName = inheritedCardId ? ((cardsData as any[]).find(c => c.id === inheritedCardId)?.name || inheritedCardId) : '';
  const epitaph =
    inheritedCardId && inheritedRelicId ? `${cause}，遗下${cardName}与${relicName}` :
    inheritedCardId ? `${cause}，遗下${cardName}` :
    `${cause}，遗下${relicName}`;
  const voxTail = [...(summary.voxLogTail || [])].slice(-5);
  const voxLine = voxTail.length > 0 ? voxTail[voxTail.length - 1]?.replace(/^[A-Z0-9-]+\s*-\s*/, '') : '';
  const finalEpitaph = voxLine ? `${epitaph}。${voxLine}` : epitaph;

  return {
    id: `martyr_${summary.runId}`,
    sourceRunId: summary.runId,
    epitaph: finalEpitaph,
    inheritedCardId,
    inheritedRelicId,
    voxLogTail: voxTail
  };
}

export function applyRunSummaryToMetaProfile(profile: MetaProfile, state: GameState, summary: RunSummary): MetaProfile {
  const now = Date.now();
  const prevMartyrId = profile.martyrLegacy?.id || null;
  const next: MetaProfile = {
    ...profile,
    currencies: {
      requisition: Math.max(0, profile.currencies.requisition + summary.earnedRequisition),
      warpEchoes: Math.max(0, profile.currencies.warpEchoes + summary.earnedWarpEchoes)
    },
    runHistory: [summary, ...(profile.runHistory || [])].slice(0, Math.max(1, metaBalance.runHistoryLimit || 30)),
    unlocks: {
      characters: [...(profile.unlocks?.characters || [])],
      cardSkins: [...(profile.unlocks?.cardSkins || [])],
      startingRelics: [...(profile.unlocks?.startingRelics || [])],
      backgrounds: [...(profile.unlocks?.backgrounds || [])]
    },
    achievements: {
      unlockedIds: [...(profile.achievements?.unlockedIds || [])],
      unlockedAt: { ...(profile.achievements?.unlockedAt || {}) },
      lastUnlockedIds: []
    },
    preferences: {
      selectedStartingRelicId: profile.preferences?.selectedStartingRelicId ?? null,
      selectedBackgroundId: profile.preferences?.selectedBackgroundId ?? null,
      selectedAscension: Math.max(0, Math.floor(profile.preferences?.selectedAscension || 0))
    },
    progression: {
      ascensionUnlockedLevel: Math.max(0, Math.floor(profile.progression?.ascensionUnlockedLevel || 0))
    }
  };

  const martyr = buildMartyrLegacyFromRun(state, summary);
  if (martyr) {
    next.martyrLegacy = martyr;
  }

  const achievementEval = evaluateRunAchievements(next, {
    state,
    summary,
    martyrLegacyCreated: !!martyr && martyr.id !== prevMartyrId
  });
  if (achievementEval.newlyUnlockedAchievementIds.length > 0) {
    next.achievements.unlockedIds = mergeUniqueStrings(next.achievements.unlockedIds, achievementEval.newlyUnlockedAchievementIds);
    next.achievements.lastUnlockedIds = [...achievementEval.newlyUnlockedAchievementIds];
    for (const id of achievementEval.newlyUnlockedAchievementIds) {
      next.achievements.unlockedAt[id] = now;
    }
  } else {
    next.achievements.lastUnlockedIds = [];
  }

  next.unlocks.characters = mergeUniqueStrings(next.unlocks.characters, achievementEval.unlockedRewards.characters);
  next.unlocks.cardSkins = mergeUniqueStrings(next.unlocks.cardSkins, achievementEval.unlockedRewards.cardSkins);
  next.unlocks.startingRelics = mergeUniqueStrings(next.unlocks.startingRelics, achievementEval.unlockedRewards.startingRelics);
  next.unlocks.backgrounds = mergeUniqueStrings(next.unlocks.backgrounds, achievementEval.unlockedRewards.backgrounds);
  next.unlockedPools = mergeUniqueStrings(next.unlockedPools, achievementEval.unlockedRewards.unlockedPoolIds);

  if (summary.isVictory) {
    const maxAsc = getAscensionMaxLevel();
    const selectedAsc = Math.max(0, Math.floor(profile.preferences?.selectedAscension || 0));
    const unlockedAsc = Math.max(0, Math.floor(next.progression?.ascensionUnlockedLevel || 0));
    if (selectedAsc >= unlockedAsc && unlockedAsc < maxAsc) {
      next.progression.ascensionUnlockedLevel = Math.min(maxAsc, unlockedAsc + 1);
      if (next.preferences.selectedAscension > next.progression.ascensionUnlockedLevel) {
        next.preferences.selectedAscension = next.progression.ascensionUnlockedLevel;
      }
    }
  }

  return next;
}

export function getMetaProfileStorageKey(): string {
  return META_PROFILE_KEY;
}
