export type CardType = 'Attack' | 'Skill' | 'Power';
export type CardTarget = 'Enemy' | 'Self' | 'AllEnemies' | 'RandomEnemy' | 'None';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Starter';

export type ActionCondition =
  | { type: 'HasIntel'; amount: number }
  | { type: 'TargetHasStatus'; status: string }
  | { type: 'HasConstruct' };

export type ActionScaling =
  | { type: 'DelayedCards'; multiplier?: number }
  | { type: 'Constructs'; multiplier?: number };

export interface ActionSpec {
  type:
    | 'DealDamage'
    | 'GainBlock'
    | 'ApplyStatus'
    | 'Draw'
    | 'Discard'
    | 'GainIntel'
    | 'SpendIntel'
    | 'ModifyEnergy'
    | 'Conditional'
    | 'DoubleStatus'
    | 'Delay'
    | 'TriggerDelay'
    | 'ReturnLastCard'
    | 'Revive'
    | 'Summon'
    | 'BuffConstructs'
    | 'ConstructOverdrive'
    | 'HealConstruct'
    | 'ForceEnemyAttack'
    | 'SummonMegaConstruct'
    | 'AddRandomElement'
    | 'AddElement'
    | 'TriggerReactions'
    | 'ElementalOverloadDamage'
    | 'TransmuteElements'
    | 'SolventDamage'
    | 'RedirectIntent'
    | 'PrecisionThrowDamage'
    | 'EmergencyBlock'
    | 'PredictorAction'
    | 'HealSelf'
    | 'SummonEnemy'
    | 'BuffAllEnemies'
    | 'Heal'
    | 'GainEnergy';
  amount?: number;
  bonus?: number;
  status?: string;
  target?: CardTarget;
  condition?: ActionCondition;
  trueActions?: ActionSpec[];
  falseActions?: ActionSpec[];
  scaling?: ActionScaling;
  turns?: number;
  actions?: ActionSpec[];
  costModifier?: number;
  unit?: string;
  element?: string;
}

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  type: CardType;
  targeting: CardTarget;
  tags: string[];
  text: string;
  actions: ActionSpec[];
  upgrade?: Partial<Omit<CardDef, 'id' | 'upgrade'>>;
  isUpgraded?: boolean;
  instanceId?: string;
  art_prompt?: string;
  artUrl?: string;
  character?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp_range: [number, number];
  intent_policy: { intent: string; weight: number }[];
  moves: Record<string, ActionSpec[]>;
  keywords: string[];
}

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  maxEnergy: number;
  startingDeck: string[];
  portraitPrompt: string;
}

export interface MapNode {
  id: string;
  type: 'Combat' | 'Elite' | 'Event' | 'Shop' | 'Boss' | 'Rest';
  revealed: boolean;
  next: string[];
  x: number;
  y: number;
}

export interface PotionDef {
  id: string;
  name: string;
  description: string;
  price: number;
  toxicity?: number;
  tags?: string[];
  effect: any;
}

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  price: number;
  trigger: 'StartCombat' | 'EndCombat' | 'StartTurn' | 'EndTurn' | 'Passive';
  tags?: string[];
  corrupted?: boolean;
  resonanceGroup?: string;
  evolve?: {
    track?: 'EliteKill' | 'CombatWin' | 'Shuffle';
    thresholds?: number[];
  };
  effect: any;
}

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
  relicStates: Record<string, { level?: number; progress?: number; corrupted?: boolean }>;
  portraitUrl?: string;
}

export interface CombatState {
  player: {
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    statuses: Record<string, number>;
    delayedCards: { card: CardDef, turns: number, targetId?: string }[];
    constructs: { id: string, name: string, hp: number, maxHp: number, atk: number, taunt: boolean }[];
    elements: string[];
    potionToxicity: number;
    potionsUsedThisTurn: number;
    cardsPlayedThisTurn: number;
    lastPlayedCard?: CardDef;
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
  }[];
  drawPile: CardDef[];
  hand: CardDef[];
  discardPile: CardDef[];
  exhaustPile: CardDef[];
  turn: number;
  isPlayerTurn: boolean;
}

export interface ActiveEventState {
  id: 'mysterious_shrine' | 'heretic_altar';
  offeredRelicId?: string;
  seedRoll?: number;
}

export interface GameState {
  seed: number;
  rngState: number;
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
}
