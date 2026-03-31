export interface MetaCurrencies {
  requisition: number;
  warpEchoes: number;
}

export interface MetaUnlocks {
  characters: string[];
  cardSkins: string[];
  startingRelics: string[];
  backgrounds: string[];
}

export interface MetaAchievementsState {
  unlockedIds: string[];
  unlockedAt: Record<string, number>;
  lastUnlockedIds: string[];
}

export interface MetaPreferences {
  selectedStartingRelicId: string | null;
  selectedBackgroundId: string | null;
  selectedAscension: number;
  selectedDoctrineId: string | null;
  animationSpeed: 'fast' | 'normal' | 'reduced';
  animationQuality: 'high' | 'balanced' | 'reduced';
}

export interface MetaProgressionState {
  ascensionUnlockedLevel: number;
  ascensionUnlockedLevelByCharacter: Record<string, number>;
}

export interface MartyrRelic {
  id: string;
  sourceRunId: string;
  epitaph: string;
  inheritedCardId?: string;
  inheritedRelicId?: string;
  voxLogTail?: string[];
}

export interface RunPreset {
  doctrineId: string | null;
  startingRelicId: string | null;
  backgroundId: string | null;
}

export interface RunSummary {
  runId: string;
  reachedFloor: number;
  causeOfDeath: string;
  finalDeckSize: number;
  earnedRequisition: number;
  earnedWarpEchoes: number;
  isVictory: boolean;
  voxLogTail?: string[];
  chapterReached: number;
  bossKilledIds: string[];
  endingArchetype: string;
  topResourceUsed: string;
  controlUptime: number;
  poisonContribution: number;
  runPreset: RunPreset;
  mirrorZoneVisited: boolean;
  branchCardsTaken: string[];
  secondaryResourcePeak: number;
}

export interface MetaProfile {
  currencies: MetaCurrencies;
  unlockedPools: string[];
  activeUpgrades: string[];
  activePacts: string[];
  martyrLegacy: MartyrRelic | null;
  runHistory: RunSummary[];
  unlocks: MetaUnlocks;
  achievements: MetaAchievementsState;
  preferences: MetaPreferences;
  progression: MetaProgressionState;
  unlockedDoctrines: string[];
  branchCodexProgress: Record<string, number>;
  branchAchievementCounts: Record<string, number>;
}
