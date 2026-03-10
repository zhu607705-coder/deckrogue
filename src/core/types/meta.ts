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
}

export interface MetaProgressionState {
  ascensionUnlockedLevel: number;
}

export interface MartyrRelic {
  id: string;
  sourceRunId: string;
  epitaph: string;
  inheritedCardId?: string;
  inheritedRelicId?: string;
  voxLogTail?: string[];
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
}
