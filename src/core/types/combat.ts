import type { ActiveEventState, MapNode } from '@/core/types/events';
import type { CardDef, CharacterDef, RunCardInstance } from '@/core/types/actions';
import type { AdaptationProfile } from '@/core/ai';

export interface PlayerState {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  block?: number;
  gold: number;
  intel: number;
  deck: RunCardInstance[];
  relics: string[];
  potions: string[];
  corruption: number;
  devotion?: number;
  relicStates: Record<string, { level?: number; progress?: number; corrupted?: boolean }>;
  runEffects?: {
    warpDebuffCombatsRemaining?: number;
    enemyHuntBonusPct?: number;
    pendingWarpTideBonus?: number;
    skipNextNode?: boolean;
    eliteTrapWeakStacks?: number;
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
    delayedCards: { card: RunCardInstance; turns: number; targetId?: string }[];
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
    lastPlayedCard?: RunCardInstance;
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
    lastUsedIntent: string | null;
    intentCooldowns: Record<string, number>;
    nonAttackIntentStreak?: number;
    summoned?: boolean;
    deathProcessed?: boolean;
    devotion: number;
    corruptionAxis: number;
    axisDisposition: 'devotion' | 'corruption' | 'balanced';
    autonomyState?: 'Normal' | 'Martyr' | 'ChaosEgg';
    autonomyTurns?: number;
  }[];
  drawPile: RunCardInstance[];
  hand: RunCardInstance[];
  discardPile: RunCardInstance[];
  exhaustPile: RunCardInstance[];
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
    currentPlayerTurnCards: RunCardInstance[];
    previousPlayerTurnCards: RunCardInstance[];
    flags?: Record<string, number | boolean | string>;
    adaptationProfile?: AdaptationProfile;
    adaptationEnabled?: boolean;
  };
}


export interface EnchantContext {
  source: 'Event' | 'Rest' | 'Shop';
  enchantmentId: string;
  title?: string;
  description?: string;
  price?: number;
  returnScreen?: 'Event' | 'Rest' | 'Shop';
}

export type RouteCommitSource = 'reward' | 'shop' | 'event' | 'rest' | 'upgrade' | 'enchant' | 'relic_upgrade';

export interface RouteCommit {
  tag: string;
  source: RouteCommitSource;
  floor: number;
  weight: number;
}

export interface RouteState {
  primaryTag: string | null;
  secondaryTag: string | null;
  confidence: number;
  stage: 'forming' | 'committed' | 'pivoting';
  recentCommits: RouteCommit[];
}

export interface SurfaceContext {
  upgradeReturnScreen?: 'Rest' | 'Shop';
  relicUpgradeReturnScreen?: 'Rest' | 'Shop';
  enchantReturnScreen?: 'Event' | 'Rest' | 'Shop';
  enchantContext?: EnchantContext | null;
  campfireChoiceLocked?: boolean;
  isEventFreeCardRemovalMode?: boolean;
  pendingUpgradeRefund?: boolean;
}

export type RoomOwnerKind = 'combat' | 'event' | 'shop' | 'rest';
export type RoomResolutionKind = 'combat' | 'reward' | 'event' | 'shop' | 'rest';
export type RoomSurface = RoomResolutionKind | 'upgrade' | 'remove_card' | 'enchant' | 'relic_upgrade';

export interface RoomSession {
  token: string;
  nodeId: string | null;
  ownerKind: RoomOwnerKind;
  resolverKind: RoomResolutionKind;
  surfaceStack: RoomSurface[];
  status: 'active' | 'resolving';
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
  routeState?: RouteState | null;
  surfaceContext?: SurfaceContext | null;
  roomSession?: RoomSession | null;
  roomResolutionToken?: string | null;
  roomResolutionKind?: RoomResolutionKind | null;
  activeEvent?: ActiveEventState | null;
  rewardCards: RunCardInstance[];
  shopCards: RunCardInstance[];
  shopRelics: string[];
  shopPotions: string[];
  cardRemovalCost: number;
  screen: 'Launcher' | 'CharacterSelect' | 'Map' | 'Combat' | 'Reward' | 'Event' | 'Shop' | 'Rest' | 'Upgrade' | 'RemoveCard' | 'Enchant' | 'RelicUpgrade' | 'GameOver' | 'Victory';
  upgradeReturnScreen?: 'Rest' | 'Shop';
  relicUpgradeReturnScreen?: 'Rest' | 'Shop';
  pendingNodeResolution?: boolean;
  campfireChoiceLocked?: boolean;
  enchantContext?: EnchantContext | null;
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
    ascensionIntentAggroBias?: number;
    ascensionMapWeightDelta?: {
      elite?: number;
      event?: number;
      shop?: number;
      rest?: number;
    };
  };
  combatVoxLog?: string[];
  lastCombatVoxLog?: string[];
  lastDeathVoxLog?: string[];
  mirrorZoneVisited?: boolean;
  branchCardsTaken?: string[];
  combatRestartCheckpoint?: {
    nodeId: string;
    nodeType: 'Combat' | 'Elite' | 'Boss';
    stateSnapshot: Partial<GameState>;
    rngState: number;
    pendingNodeResolution?: boolean;
  };
  secondaryResourcePeak?: number;
}
