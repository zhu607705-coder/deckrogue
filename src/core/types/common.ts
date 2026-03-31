export type CardId = string;
export type EnemyId = string;
export type RelicId = string;
export type EventId = string;
export type InstanceId = string;

export interface CardAction {
  type: string;
  target?: string;
  value?: number;
  amount?: number;
  status?: string;
  stacks?: number;
  damage?: number;
  block?: number;
  times?: number;
  cardId?: CardId;
  enemyId?: EnemyId;
  [key: string]: unknown;
}

export interface CardSpec {
  id: CardId;
  name: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Curse' | 'Special' | 'Starter' | 'Basic';
  cost: number;
  type: 'Attack' | 'Skill' | 'Power' | 'Curse' | 'Status';
  targeting?: 'Self' | 'Enemy' | 'AllEnemies' | 'None';
  tags?: string[];
  text?: string;
  actions?: CardAction[];
  upgrade?: Partial<CardSpec>;
  character?: string;
  damage?: number;
  block?: number;
  exhausts?: boolean;
  ethereal?: boolean;
  innate?: boolean;
}

export interface CardInstance extends CardSpec {
  instanceId: InstanceId;
  isUpgraded?: boolean;
  temporary?: boolean;
}

export interface EnemyIntent {
  icon: string;
  text: string;
  type: 'attack' | 'defend' | 'buff' | 'debuff' | 'special';
  damage?: number;
  isWarpMasquerade?: boolean;
  breakdown?: {
    baseDamage: number;
    totalDamage: number;
    strengthBonus: number;
    weakPenalty: number;
  };
}

export interface EnemyMove {
  id: string;
  intent: string;
  damage?: number;
  block?: number;
  status?: string;
  stacks?: number;
  effect?: string;
  weight?: number;
}

export interface EnemySpec {
  id: EnemyId;
  name: string;
  hp_range?: [number, number];
  minHp?: number;
  maxHp?: number;
  intent_policy?: Array<{ intent?: string; weight?: number }>;
  intentPolicy?: Array<{ intent?: string; weight?: number }>;
  moves?: Record<string, EnemyMove>;
  keywords?: string[];
  type?: 'normal' | 'elite' | 'boss';
}

export interface EnemyInstance extends EnemySpec {
  instanceId: InstanceId;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Record<string, number>;
  currentMove?: EnemyMove;
  intent?: EnemyIntent;
}

export interface RelicSpec {
  id: RelicId;
  name: string;
  description: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | 'Boss';
  character?: string;
  effect?: string;
  triggers?: string[];
}

export interface EventOption {
  text: string;
  effect?: string;
  danger?: 'low' | 'medium' | 'high';
  gains?: string[];
  costs?: string[];
  requires?: string[];
}

export interface EventSpec {
  id: EventId;
  name: string;
  text: string;
  options: EventOption[];
  background?: string;
  character?: string;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  block: number;
  deck: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  drawPile: CardInstance[];
  relics: RelicId[];
  gold: number;
  statuses: Record<string, number>;
  characterResource?: {
    label: string;
    value: number;
    maxValue: number;
    tone: string;
  };
}

export interface CombatState {
  turn: number;
  isPlayerTurn: boolean;
  enemies: EnemyInstance[];
  player: PlayerState;
  combatLog: string[];
}

export interface MapNode {
  id: string;
  type: 'Combat' | 'Elite' | 'Boss' | 'Event' | 'Shop' | 'Rest' | 'Unknown';
  floor: number;
  x: number;
  y: number;
  connections: string[];
  visited?: boolean;
  cleared?: boolean;
}

export interface GameState {
  player: PlayerState;
  combat: CombatState | null;
  map: MapNode[];
  currentNodeId: string | null;
  floor: number;
  act: number;
  screen: string;
  isRunning: boolean;
  isPaused: boolean;
  rngState: number;
  rewardCards: CardInstance[];
  metaRuntime?: {
    ascension: number;
    ascensionEliteUpgradeChance?: number;
    ascensionMapWeightDelta?: Record<string, number>;
  };
  combatRestartCheckpoint?: {
    nodeId: string;
    nodeType: 'Combat' | 'Elite' | 'Boss';
    stateSnapshot: unknown;
    rngState: number;
    pendingNodeResolution: boolean;
  };
}

export type GameEventType = 
  | 'card_played'
  | 'card_drawn'
  | 'card_discarded'
  | 'card_exhausted'
  | 'damage_dealt'
  | 'damage_taken'
  | 'block_gained'
  | 'status_applied'
  | 'status_removed'
  | 'enemy_spawned'
  | 'enemy_killed'
  | 'turn_started'
  | 'turn_ended'
  | 'combat_started'
  | 'combat_ended';

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type UnknownRecord = Record<string, unknown>;
export type UnknownArray = unknown[];
