import type { ActiveEventState, MapNode } from '@/core/types/events';
import type { CardDef, CharacterDef } from '@/core/types/actions';

export interface PlayerState {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  intel: number;
  deck: CardDef[];
  relics: string[];
  potions: string[];
  corruption: number;
  devotion?: number;
  relicStates: Record<string, { level?: number; progress?: number; corrupted?: boolean }>;
  runEffects?: {
    warpDebuffCombatsRemaining?: number;
    enemyHuntBonusPct?: number;
    pendingWarpTideBonus?: number;
  };
  portraitUrl?: string;
}

export interface CombatState {
  player: {
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    statuses: Record<string, number>;
    delayedCards: { card: CardDef; turns: number; targetId?: string }[];
    constructs: {
      id: string;
      name: string;
      hp: number;
      maxHp: number;
      atk: number;
      taunt: boolean;
      overflowDamageToPlayer?: boolean;
      damageSharePct?: number;
    }[];
    elements: string[];
    potionToxicity: number;
    potionsUsedThisTurn: number;
    cardsPlayedThisTurn: number;
    damageTakenThisTurn?: number;
    damageTakenLastTurn?: number;
    intel?: number;
    lastPlayedCard?: CardDef;
    devotion: number;
    corruptionAxis: number;
    axisDisposition: 'devotion' | 'corruption' | 'balanced';
    autonomyState?: 'Normal' | 'Martyr' | 'ChaosEgg';
    autonomyTurns?: number;
    timeLayer?: number;
    thread?: number;
    concoction?: number;
  };
  enemies: {
    id: string;
    defId: string;
    name: string;
    hp: number;
    maxHp: number;
    block: number;
    statuses: Record<string, number>;
    nextIntent: string | null;
    summoned?: boolean;
    deathProcessed?: boolean;
    devotion: number;
    corruptionAxis: number;
    axisDisposition: 'devotion' | 'corruption' | 'balanced';
    autonomyState?: 'Normal' | 'Martyr' | 'ChaosEgg';
    autonomyTurns?: number;
  }[];
  drawPile: CardDef[];
  hand: CardDef[];
  discardPile: CardDef[];
  exhaustPile: CardDef[];
  turn: number;
  isPlayerTurn: boolean;
  warpTide: number;
  warpAlpha: number;
  warpPerilK: number;
  warpPulse?: { text: string; tone: 'warp' | 'danger' | 'faith' | 'neutral' };
  warpRiftTurns?: number;
  warpRiftCorruption?: number;
  warpRiftAlphaMultiplier?: number;
  warpRiftPerilFloor?: number;
  bossPhase?: {
    enemyId: string;
    bossDefId: string;
    phaseIndex: number;
    phaseId: string;
    phaseName: string;
    phaseHint?: string;
    enteredTurn: number;
    currentPlayerTurnCards: CardDef[];
    previousPlayerTurnCards: CardDef[];
    flags?: Record<string, number | boolean | string>;
  };
}

export interface GameState {
  seed: number;
  rngState: number;
  runId?: string;
  runStartedAt?: number;
  character: CharacterDef | null;
  player: PlayerState;
  combat: CombatState | null;
  map: MapNode[];
  currentNodeId: string | null;
  activeEvent?: ActiveEventState | null;
  rewardCards: CardDef[];
  shopCards: CardDef[];
  shopRelics: string[];
  shopPotions: string[];
  cardRemovalCost: number;
  screen: 'CharacterSelect' | 'Map' | 'Combat' | 'Reward' | 'Event' | 'Shop' | 'Rest' | 'Upgrade' | 'RemoveCard' | 'GameOver' | 'Victory';
  upgradeReturnScreen?: 'Rest' | 'Shop';
  pendingNodeResolution?: boolean;
  campfireChoiceLocked?: boolean;
  pendingUpgradeRefund?: boolean;
  metaRuntime?: {
    unlockedPoolIds: string[];
    appliedUpgradeIds: string[];
    appliedPactIds: string[];
    appliedMartyrLegacyId?: string;
    ascensionLevel?: number;
    ascensionEnemyHpMultiplier?: number;
    ascensionEnemyDamageMultiplier?: number;
    ascensionEliteUpgradeChance?: number;
    ascensionStartingCurseId?: string;
  };
  combatVoxLog?: string[];
  lastCombatVoxLog?: string[];
  lastDeathVoxLog?: string[];
}
