/**
 * @file uiModel.ts
 * @description UI 模型类型定义，描述游戏运行时 UI 层所需的全部数据结构
 *
 * 主要职责:
 * - 定义 ScreenId / RoomKind 屏幕与房间类型枚举
 * - 定义玩家、地图、房间、战斗、奖励、事件等子模型接口
 * - 定义 UIModel 统一 UI 模型结构
 * - 定义通知、房间选择等辅助类型
 */
export type ScreenId =
  | 'Launcher'
  | 'CharacterSelect'
  | 'Map'
  | 'Combat'
  | 'Reward'
  | 'Rest'
  | 'Shop'
  | 'Event'
  | 'Upgrade'
  | 'Enchant'
  | 'RelicUpgrade'
  | 'RemoveCard'
  | 'GameOver'
  | 'Victory';

export type RoomKind =
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

export type CardType = 'Attack' | 'Skill' | 'Power' | 'Curse' | 'Status';

export type CardRarity = 'Starter' | 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type CharacterId = string;

export interface UICard {
  id: string;
  name: string;
  cost: number;
  rarity: CardRarity | string;
  type: CardType | string;
  description: string;
  flavorText?: string;
  imageUrl?: string;
  isUpgraded?: boolean;
  tags?: string[];
  targeting?: string;
}

export interface UIStatusEffect {
  id: string;
  name: string;
  description: string;
  stacks: number;
  duration: number;
  icon: string;
}

export interface UIPlayerModel {
  characterId: string | null;
  hp: number;
  maxHp: number;
  gold: number;
  intel: number;
  devotion: number;
  corruption: number;
  deckCount: number;
  relicCount: number;
  potionCount: number;
  healthRatio: number;
  statusEffects: UIStatusEffect[];
}

export interface UIMapNode {
  id: string;
  type: string;
  x: number;
  y: number;
  revealed: boolean;
  next: string[];
}

export interface UIMapModel {
  currentNodeId: string | null;
  currentFloor: number | null;
  nodes: UIMapNode[];
  revealedNodeIds: string[];
  availableNodeIds: string[];
  pathProgress: number;
}

export interface UIRoomChoice {
  id: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface UIRoomModel {
  kind: RoomKind;
  title: string;
  body: string;
  choices: UIRoomChoice[];
  metadata: Record<string, unknown>;
}

export interface UICombatEnemy {
  id: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  nextIntent: string | null;
}

export interface UICombatPlayer {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
}

export interface UICombatModel {
  turn: number;
  isPlayerTurn: boolean;
  player: UICombatPlayer;
  enemies: UICombatEnemy[];
  hand: UICard[];
  drawPileCount: number;
  discardPileCount: number;
}

export interface UIRewardModel {
  cards: UICard[];
  gold: number;
  relics: UIItem[];
  potions: UIItem[];
  source: string;
}

export interface UIItem {
  id: string;
  name: string;
  description?: string;
  rarity?: string;
}

export interface UIEventModel {
  id: string;
  stage?: string;
  data?: Record<string, unknown>;
}

export interface UINotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: number;
  duration?: number;
}

export interface UIModel {
  screen: ScreenId | string;
  player: UIPlayerModel;
  map: UIMapModel;
  room: UIRoomModel | null;
  combat: UICombatModel | null;
  reward: UIRewardModel | null;
  activeEvent: UIEventModel | null;
  notifications: UINotification[];
}
