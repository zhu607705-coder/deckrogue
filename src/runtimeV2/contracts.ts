import type { GameState } from '@/core/types';

export interface ContentBundleCharacter {
  id: string;
  max_hp: number;
  max_energy: number;
  starting_gold: number;
  starting_deck: string[];
  extended_pool?: string[];
  special_resource?: string;
}

export interface ContentBundleCard {
  id: string;
  rarity: string;
  character: string;
}

export interface ContentBundleEnemy {
  id: string;
  hp_range: [number, number];
  keywords: string[];
  intent_policy?: Array<{
    intent: string;
    weight: number;
  }>;
}

export interface ContentBundleMapConfig {
  floors: number;
  branching: number;
  node_types?: string[];
  prebuilt_nodes?: RuleSnapshotNode[];
  encounters: {
    normal: string[];
    elite: string[];
    boss: string[];
  };
}

export interface ContentBundle {
  version: string;
  characters: ContentBundleCharacter[];
  cards: ContentBundleCard[];
  enemies: ContentBundleEnemy[];
  map: ContentBundleMapConfig;
  events?: Array<{ id: string }>;
}

export interface RuleDiff {
  changedPaths: string[];
}

export interface RuleEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export interface RuleSnapshotNode {
  id: string;
  type: string;
  x: number;
  y: number;
  revealed: boolean;
  next: string[];
}

export interface RuleSnapshot {
  schemaVersion: 2;
  engineVersion: string;
  seed: number;
  lifecycle: {
    screen: string;
    phase: string;
    pendingNodeResolution: boolean;
  };
  player: {
    characterId: string | null;
    hp: number;
    maxHp: number;
    gold: number;
    intel: number;
    devotion: number;
    corruption: number;
    deck: string[];
    relicIds: string[];
    potionIds: string[];
  };
  map: {
    currentNodeId: string | null;
    nodes: RuleSnapshotNode[];
  };
  combat: null | {
    turn: number;
    isPlayerTurn: boolean;
    playerBlock: number;
    playerEnergy: number;
    enemyIds: string[];
    enemies: Array<{
      id: string;
      defId: string;
      hp: number;
      maxHp: number;
      block: number;
      nextIntent: string | null;
    }>;
    hand: string[];
    drawPileCount: number;
    discardPileCount: number;
  };
  reward: null | {
    cardIds: string[];
    source: 'combat';
  };
  activeEvent: null | {
    id: string;
    stage?: string;
    data?: Record<string, unknown>;
  };
  meta: {
    runId: string | null;
    replayLength: number;
    generatedAt: string;
    adapter: 'legacy-oracle' | 'python-wasm';
  };
  compat?: {
    legacySaveData?: ReturnType<GameStateAdapter['getSaveData']>;
  };
}

export interface RuleResult {
  snapshot: RuleSnapshot;
  diff: RuleDiff;
  events: RuleEvent[];
  timings: {
    dispatchMs: number;
  };
  source: RuleSnapshot['meta']['adapter'];
}

export type RuleCommand =
  | { type: 'start_run'; seed?: number }
  | { type: 'select_character'; characterId: string }
  | { type: 'enter_node'; nodeId: string }
  | { type: 'leave_room' }
  | { type: 'complete_combat' }
  | { type: 'take_reward'; cardId?: string }
  | { type: 'skip_reward' }
  | { type: 'choose_event_option'; choiceId: string }
  | { type: 'rest' }
  | { type: 'upgrade_card'; cardInstanceId?: string }
  | { type: 'remove_card'; cardInstanceId?: string }
  | { type: 'load_snapshot'; snapshot: RuleSnapshot };

export interface RenderModelRoomChoice {
  id: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface RenderModelRoom {
  kind: 'shop' | 'rest' | 'reward' | 'event' | 'combat' | 'character_select' | 'launcher';
  title?: string;
  body?: string;
  choices?: RenderModelRoomChoice[];
  cardCount?: number;
  relicCount?: number;
  potionStockCount?: number;
  cardRemovalCost?: number;
  canUpgrade?: boolean;
  canRemove?: boolean;
  canMix?: boolean;
  canHeal?: boolean;
  healAmount?: number;
  canEnchant?: boolean;
  offerCount?: number;
}

export interface RenderModelRewardCard {
  id: string;
  name: string;
  cost: number;
  rarity: string;
  type: string;
  description?: string;
}

export interface RenderModel {
  screen: RuleSnapshot['lifecycle']['screen'];
  lifecycle: RuleSnapshot['lifecycle'];
  player: Pick<RuleSnapshot['player'], 'characterId' | 'hp' | 'maxHp' | 'gold' | 'deck' | 'intel' | 'devotion' | 'corruption'> & {
    deckCount: number;
    relicCount: number;
    potionCount: number;
    healthRatio: number;
  };
  map: RuleSnapshot['map'] & {
    currentFloor: number | null;
    revealedNodeIds: string[];
    availableNodeIds: string[];
  };
  combat: (NonNullable<RuleSnapshot['combat']> & {
    enemyCount: number;
  }) | null;
  reward: (NonNullable<RuleSnapshot['reward']> & {
    offerCount: number;
    cards: RenderModelRewardCard[];
  }) | null;
  activeEvent: RuleSnapshot['activeEvent'];
  room: RenderModelRoom | null;
}

export interface SaveGameV2 {
  schemaVersion: 2;
  snapshot: RuleSnapshot;
  savedAt: string;
  hostPlatform: 'web' | 'desktop' | 'mobile';
}

export interface ReplayLogV1 {
  schemaVersion: 1;
  seed: number;
  commands: RuleCommand[];
}

export interface MigrationReport {
  migratedAt: string;
  sourceSchema: string;
  targetSchema: string;
  success: boolean;
  warnings: string[];
}

export interface AssetManifestEntry {
  id: string;
  kind: 'texture' | 'audio' | 'font' | 'data';
  path: string;
  preload?: boolean;
}

export interface AssetManifest {
  version: string;
  entries: AssetManifestEntry[];
}

export interface EngineHostStartOptions {
  seed?: number;
}

export interface GameStateAdapter {
  getSaveData(): object;
}

export interface RuleRuntimeAdapter {
  readonly source: RuleSnapshot['meta']['adapter'];
  start(options?: EngineHostStartOptions): Promise<RuleSnapshot>;
  dispatch(command: RuleCommand): Promise<RuleSnapshot>;
  getSnapshot(): RuleSnapshot | null;
  subscribe?(listener: (snapshot: RuleSnapshot) => void): () => void;
  dispose(): void;
}
