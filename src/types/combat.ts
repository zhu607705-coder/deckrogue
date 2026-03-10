/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 战斗系统严格类型定义 (Combat System Strict Types)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Phase 4: 类型强化 - 消除 `as any` 断言
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 基础类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 唯一标识符 */
export type EntityId = string;

/** 资源类型 */
export type ResourceType = 'hp' | 'maxHp' | 'block' | 'energy' | 'intel' | 'corruption' | 'toxicity';

/** 元素类型 */
export type ElementType = 'Fire' | 'Frost' | 'Lightning' | 'Acid' | 'Void';

/** 伤害类型 */
export type DamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'acid' | 'void' | 'true';

/** 目标类型 */
export type TargetType = 'Enemy' | 'AllEnemies' | 'Self' | 'RandomEnemy' | 'Frontline';

/** 卡牌稀有度 */
export type CardRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

/** 卡牌类型 */
export type CardType = 'Attack' | 'Skill' | 'Power' | 'Status' | 'Curse';

/** 敌人意图类型 */
export type IntentType = 'attack' | 'block' | 'status' | 'hybrid' | 'neutral' | 'unknown';

/** 亚空间潮汐等级 */
export type WarpTideLevel = 'calm' | 'stirring' | 'restless' | 'turbulent' | 'storm';

// ═══════════════════════════════════════════════════════════════════════════════
// 状态效果类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 状态效果定义 */
export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  icon: string;
  isDebuff: boolean;
  stackable: boolean;
  maxStacks?: number;
}

/** 运行时状态效果实例 */
export interface StatusInstance {
  statusId: string;
  amount: number;
  duration?: number;
  source?: EntityId;
}

/** 敌人状态映射 */
export type EnemyStatuses = Record<string, number>;

// ═══════════════════════════════════════════════════════════════════════════════
// 卡牌类型定义
// ═══════════════════════════════════════════════════════════════════════════════

/** 卡牌效果定义 */
export interface CardEffect {
  type: string;
  value: number | number[];
  target?: TargetType;
  damageType?: DamageType;
  status?: string;
  statusAmount?: number;
  scaling?: {
    stat: string;
    multiplier: number;
  };
}

/** 卡牌定义 (静态数据) */
export interface CardDef {
  id: string;
  name: string;
  description: string;
  flavorText?: string;
  cost: number;
  type: CardType;
  rarity: CardRarity;
  target: TargetType;
  effects: CardEffect[];
  tags: string[];
  image?: string;
  upgradeId?: string;
  isUnplayable?: boolean;
  isExhaust?: boolean;
  isEthereal?: boolean;
  retain?: boolean;
}

/** 卡牌运行时实例 */
export interface CardInstance {
  instanceId: EntityId;
  defId: string;
  name: string;
  description: string;
  cost: number;
  type: CardType;
  target: TargetType;
  effects: CardEffect[];
  tags: string[];
  isUpgraded: boolean;
  temporaryModifiers?: {
    costDelta?: number;
    damageDelta?: number;
    blockDelta?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 敌人类型定义
// ═══════════════════════════════════════════════════════════════════════════════

/** 敌人行为模式 */
export interface EnemyBehavior {
  pattern: 'random' | 'sequence' | 'conditional';
  moves: EnemyMove[];
  conditions?: {
    hpThreshold?: number;
    turnThreshold?: number;
    statusRequired?: string;
  };
}

/** 敌人行动 */
export interface EnemyMove {
  id: string;
  name: string;
  intent: IntentType;
  icon: string;
  effects: CardEffect[];
  weight?: number;
  cooldown?: number;
}

/** 敌人定义 (静态数据) */
export interface EnemyDef {
  id: string;
  name: string;
  description?: string;
  maxHp: number;
  behaviors: EnemyBehavior[];
  aiHints?: {
    preferredTarget?: TargetType;
    aggressionLevel?: number;
  };
  image: string;
  elite: boolean;
  boss: boolean;
  minFloor: number;
  maxFloor?: number;
  tags: string[];
  immunities?: string[];
  resistances?: Record<DamageType, number>;
}

/** 敌人运行时实例 */
export interface EnemyInstance {
  id: EntityId;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: EnemyStatuses;
  nextMove?: EnemyMove;
  moveHistory: string[];
  autonomyState?: 'Normal' | 'ChaosEgg' | 'Martyr';
  image: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 玩家类型定义
// ═══════════════════════════════════════════════════════════════════════════════

/** 玩家职业 */
export type CharacterClass = 'chronomancer' | 'puppeteer' | 'alchemist' | 'warrior' | 'rogue';

/** 玩家定义 */
export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  startingHp: number;
  startingEnergy: number;
  startingDeck: string[];
  startingRelic: string;
  specialMechanic: string;
  image: string;
  complexity?: 'low' | 'medium' | 'high';
  archetype?: string[];
  extendedPool?: string[];
  specialResource?: 'timeLayer' | 'thread' | 'concoction';
}

/** 玩家运行时状态 */
export interface PlayerState {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
  intel: number;
  corruption: number;
  potionToxicity: number;
  statuses: EnemyStatuses;
  elements: ElementType[];
  constructs?: ConstructInstance[];
  delayedCards?: DelayedCard[];
  // 职业特殊资源
  timeLayer?: number;
  thread?: number;
  concoction?: number;
}

/** 前线构造体 */
export interface ConstructInstance {
  id: EntityId;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  taunt: boolean;
  damageSharePct?: number;
  duration?: number;
}

/** 延迟卡牌 */
export interface DelayedCard {
  card: CardInstance;
  turns: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 遗物类型定义
// ═══════════════════════════════════════════════════════════════════════════════

/** 遗物定义 */
export interface RelicDef {
  id: string;
  name: string;
  description: string;
  flavorText?: string;
  rarity: CardRarity;
  tags: string[];
  resonanceGroup?: string;
  image: string;
  effects: RelicEffect[];
  counter?: number;
}

/** 遗物效果 */
export interface RelicEffect {
  trigger: 'onCombatStart' | 'onTurnStart' | 'onTurnEnd' | 'onCardPlay' | 'onDamageDealt' | 'onDamageTaken' | 'onKill';
  action: string;
  value: number;
  condition?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 炼金剂类型定义
// ═══════════════════════════════════════════════════════════════════════════════

/** 炼金剂效果 */
export interface PotionEffect {
  type: 'Heal' | 'GainEnergy' | 'GainBlock' | 'ApplyStatus' | 'DrawCards' | 'RemoveDebuff';
  value: number;
  target?: TargetType;
}

/** 炼金剂定义 */
export interface PotionDef {
  id: string;
  name: string;
  description: string;
  rarity: CardRarity;
  toxicity: number;
  effect: PotionEffect;
  image: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 战斗状态类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 亚空间裂隙状态 */
export interface WarpRiftState {
  active: boolean;
  turnsRemaining: number;
  corruptionPerTurn: number;
  alphaMultiplier: number;
  perilFloor: number;
}

/** 战斗状态 */
export interface CombatState {
  turn: number;
  isPlayerTurn: boolean;
  player: PlayerState;
  enemies: EnemyInstance[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  warpTide: number;
  warpRift?: WarpRiftState;
  turnHistory: TurnRecord[];
}

/** 回合记录 */
export interface TurnRecord {
  turn: number;
  playerActions: PlayerAction[];
  enemyActions: EnemyAction[];
}

/** 玩家行动记录 */
export interface PlayerAction {
  type: 'playCard' | 'usePotion' | 'endTurn';
  cardId?: string;
  potionIndex?: number;
  target?: EntityId;
}

/** 敌人行动记录 */
export interface EnemyAction {
  enemyId: EntityId;
  moveId: string;
  damageDealt: number;
  effectsApplied: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 意图显示类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 意图分解详情 */
export interface IntentBreakdown {
  totalDamage: number;
  hits: number[];
  block: number;
  statuses: Array<{
    status: string;
    amount: number;
    target: 'self' | 'player';
  }>;
  extras: string[];
}

/** 意图显示 */
export interface IntentDisplay {
  icon: string;
  text: string;
  tone: IntentType;
  breakdown: IntentBreakdown;
  isWarpMasquerade?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 意图遥测类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 意图遥测数据 */
export interface IntentTelemetry {
  enemyId: EntityId;
  laneY: number;
  enemyX: number;
  mode: 'direct' | 'taunt' | 'cover';
  frontlineAbsorb: number;
  frontlineLabel: string;
  playerDamage: number;
  frontlineOverflow: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 游戏引擎类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 游戏状态 */
export interface GameState {
  combat: CombatState | null;
  player: {
    deck: CardDef[];
    relics: string[];
    potions: (string | null)[];
    intel: number;
    maxEnergy: number;
    corruption: number;
  };
  character?: CharacterDef;
  floor: number;
}

/** 游戏引擎接口 */
export interface GameEngine {
  state: GameState;
  endTurn: () => void;
  usePotion: (index: number) => void;
  playCard: (cardId: string, targetId?: string) => boolean;
  getCorruptionDamageBonusMultiplier: () => number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 类型守卫函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 检查是否为有效的卡牌实例
 */
export function isCardInstance(obj: unknown): obj is CardInstance {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'instanceId' in obj &&
    'defId' in obj &&
    'name' in obj &&
    'cost' in obj &&
    'type' in obj
  );
}

/**
 * 检查是否为有效的敌人实例
 */
export function isEnemyInstance(obj: unknown): obj is EnemyInstance {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'defId' in obj &&
    'name' in obj &&
    'hp' in obj &&
    'maxHp' in obj
  );
}

/**
 * 检查是否为有效的意图显示
 */
export function isIntentDisplay(obj: unknown): obj is IntentDisplay {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'icon' in obj &&
    'text' in obj &&
    'tone' in obj &&
    'breakdown' in obj
  );
}

/**
 * 检查是否为有效的意图遥测
 */
export function isIntentTelemetry(obj: unknown): obj is IntentTelemetry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'enemyId' in obj &&
    'laneY' in obj &&
    'enemyX' in obj &&
    'mode' in obj
  );
}

/**
 * 检查是否为有效的构造体实例
 */
export function isConstructInstance(obj: unknown): obj is ConstructInstance {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'hp' in obj &&
    'maxHp' in obj &&
    'atk' in obj
  );
}

/**
 * 检查是否为有效的延迟卡牌
 */
export function isDelayedCard(obj: unknown): obj is DelayedCard {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'card' in obj &&
    'turns' in obj &&
    typeof (obj as DelayedCard).turns === 'number'
  );
}

/**
 * 获取亚空间潮汐等级
 */
export function getWarpTideLevel(warpTide: number): WarpTideLevel {
  if (warpTide >= 90) return 'storm';
  if (warpTide >= 70) return 'turbulent';
  if (warpTide >= 50) return 'restless';
  if (warpTide >= 30) return 'stirring';
  return 'calm';
}

/**
 * 检查是否应该触发意图伪装
 */
export function shouldTriggerMasquerade(warpTide: number): boolean {
  return warpTide >= 70;
}

/**
 * 计算意图伪装概率
 */
export function getMasqueradeChance(warpTide: number): number {
  if (warpTide < 70) return 0;
  return Math.min(0.8, (warpTide - 70) / 50);
}
