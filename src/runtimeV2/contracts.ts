/**
 * @file contracts.ts
 * @description 定义 RuntimeV2 的核心数据契约，包括内容包、快照、命令、渲染模型等类型
 *
 * 主要职责:
 * - 定义 ContentBundle 内容包结构（角色、卡牌、遗物、药水、敌人）
 * - 定义 RuleSnapshot 游戏规则状态快照
 * - 定义 RuleCommand / RuleRuntimeAdapter 运行时命令与适配器接口
 * - 定义 RenderModel 渲染模型及房间选择类型
 * - 定义 SaveGameV2 / ReplayLogV1 存档与回放日志格式
 */
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

export interface ContentBundleRelic {
  id: string;
  price: number;
  rarity?: string;
}

export interface ContentBundlePotion {
  id: string;
  price: number;
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
  runtime_strategy?: {
    floor_type_caps?: Record<string, number>;
    opening_route_expectation?: {
      max_spread?: number;
      traversal_depth?: number;
      weights?: Record<string, number>;
      max_branches_per_floor?: Record<string, number>;
    };
    opening_route_contrast?: {
      max_floor?: number;
      require_third_flavor_on_floor_1?: boolean;
      utility_types?: string[];
    };
  };
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
  relics?: ContentBundleRelic[];
  potions?: ContentBundlePotion[];
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

export type RuleSnapshotRoomOwnerKind = 'combat' | 'event' | 'shop' | 'rest';
export type RuleSnapshotRoomResolverKind = 'combat' | 'reward' | 'event' | 'shop' | 'rest';
export type RuleSnapshotRoomSurface = RuleSnapshotRoomResolverKind | 'upgrade' | 'remove_card' | 'enchant' | 'relic_upgrade';

export interface RuleSnapshotRoomSession {
  token: string;
  nodeId: string | null;
  ownerKind: RuleSnapshotRoomOwnerKind;
  resolverKind: RuleSnapshotRoomResolverKind;
  surfaceStack: RuleSnapshotRoomSurface[];
  status: 'active' | 'resolving';
}

export interface RuleSnapshotRouteCommit {
  tag: string;
  source: 'reward' | 'shop' | 'event' | 'rest' | 'upgrade' | 'enchant' | 'relic_upgrade';
  floor: number;
  weight: number;
}

export interface RuleSnapshotRouteState {
  primaryTag: string | null;
  secondaryTag: string | null;
  confidence: number;
  stage: 'forming' | 'committed' | 'pivoting';
  recentCommits: RuleSnapshotRouteCommit[];
}

export interface RuleSnapshotSurfaceContext {
  upgradeReturnScreen?: 'Rest' | 'Shop';
  relicUpgradeReturnScreen?: 'Rest' | 'Shop';
  enchantReturnScreen?: 'Event' | 'Rest' | 'Shop';
  enchantContext?: {
    source: 'Event' | 'Rest' | 'Shop';
    enchantmentId: string;
    title?: string;
    description?: string;
    price?: number;
    returnScreen?: 'Event' | 'Rest' | 'Shop';
  } | null;
  campfireChoiceLocked?: boolean;
  isEventFreeCardRemovalMode?: boolean;
  pendingUpgradeRefund?: boolean;
}

export interface RuleSnapshotRelicState {
  level: number;
  progress?: number;
  corrupted?: boolean;
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
    relicStates?: Record<string, RuleSnapshotRelicState>;
  };
  map: {
    currentNodeId: string | null;
    nodes: RuleSnapshotNode[];
  };
  routeState?: RuleSnapshotRouteState | null;
  surfaceContext?: RuleSnapshotSurfaceContext | null;
  roomSession?: RuleSnapshotRoomSession | null;
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
  shop?: null | {
    cards: Array<{
      id: string;
      price: number;
    }>;
    relics: Array<{
      id: string;
      price: number;
    }>;
    potions: Array<{
      id: string;
      price: number;
    }>;
    cardRemovalCost: number;
  };
  activeEvent: null | {
    id: string;
    stage?: string;
    lastChoiceId?: string | null;
    choiceRole?: 'confirm' | 'payoff' | 'pivot' | 'support' | null;
    outcomeKind?: 'confirm' | 'payoff' | 'pivot' | 'support' | 'neutral' | null;
    data?: Record<string, unknown>;
  };
  meta: {
    runId: string | null;
    replayLength: number;
    generatedAt: string;
    adapter: 'legacy-oracle' | 'python-wasm';
    runtimeRngState?: number;
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
  | { type: 'cancel_surface' }
  | { type: 'buy_shop_card'; cardId: string }
  | { type: 'buy_shop_relic'; relicId: string }
  | { type: 'buy_shop_potion'; potionId: string }
  | { type: 'complete_combat' }
  | { type: 'take_reward'; cardId?: string }
  | { type: 'skip_reward' }
  | { type: 'choose_event_option'; choiceId: string }
  | { type: 'rest' }
  | { type: 'enter_enchant' }
  | { type: 'apply_enchantment'; cardInstanceId: string }
  | { type: 'enter_relic_upgrade' }
  | { type: 'upgrade_relic'; relicId: string }
  | { type: 'upgrade_card'; cardInstanceId?: string }
  | { type: 'remove_card'; cardInstanceId?: string }
  | { type: 'load_snapshot'; snapshot: RuleSnapshot };

export interface RenderModelRoomChoice {
  id: string;
  label: string;
  disabled?: boolean;
  description?: string;
  routeRole?: 'confirm' | 'payoff' | 'pivot' | 'support';
  routeLabel?: string;
  routeReason?: string;
}

export interface RenderModelShopOffer {
  id: string;
  name: string;
  price: number;
  rarity?: string;
  type?: string;
  description?: string;
  routeLabel?: string;
  routeReason?: string;
  recommended?: boolean;
}

export interface RenderModelDecisionGuidance {
  routeTag: string | null;
  routeLabel: string | null;
  headline: string;
  reason: string;
  recommendedActionId?: string | null;
  recommendedTargetId?: string | null;
}

export interface RenderModelRoom {
  kind:
    | 'shop'
    | 'rest'
    | 'reward'
    | 'event'
    | 'combat'
    | 'character_select'
    | 'launcher'
    | 'upgrade'
    | 'enchant'
    | 'relic_upgrade'
    | 'remove_card'
    | 'game_over'
    | 'victory';
  title?: string;
  body?: string;
  guidance?: RenderModelDecisionGuidance | null;
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
  canRelicUpgrade?: boolean;
  offerCount?: number;
  cards?: RenderModelShopOffer[];
  relics?: RenderModelShopOffer[];
  potions?: RenderModelShopOffer[];
  serviceHints?: Record<string, RenderModelDecisionGuidance>;
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
  shop?: RuleSnapshot['shop'];
  routeState?: RuleSnapshot['routeState'];
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
