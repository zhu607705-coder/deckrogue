export type CardType = 'Attack' | 'Skill' | 'Power';
export type CardTarget = 'Enemy' | 'Self' | 'AllEnemies' | 'RandomEnemy' | 'None';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Starter';

export type ActionCondition =
  | { type: 'HasIntel'; amount: number }
  | { type: 'TargetHasStatus'; status: string }
  | { type: 'HasConstruct' }
  | { type: 'HasCorruption'; amount: number }
  | { type: 'HasTimeLayer'; amount: number }
  | { type: 'HasThread'; amount: number }
  | { type: 'HasConcoction'; amount: number };

export type ActionScaling =
  | { type: 'DelayedCards'; multiplier?: number }
  | { type: 'Constructs'; multiplier?: number }
  | { type: 'Corruption'; multiplier?: number };

export interface ActionSpec {
  type:
    | 'DealDamage'
    | 'GainBlock'
    | 'ApplyStatus'
    | 'Draw'
    | 'Discard'
    | 'GainIntel'
    | 'SpendIntel'
    | 'ConditionalKill'
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
    | 'GainEnergy'
    | 'GainCorruption'
    | 'ModifyWarpTide'
    | 'DealWarpDamage'
    | 'CheckWarpPeril'
    | 'CreateWarpRift'
    | 'MutateCard'
    | 'PurgeFearAndCorruption'
    | 'GainDevotion'
    | 'GainCorruptionAxis'
    | 'EmperorMercy'
    | 'PurgeEnemyBuffs'
    | 'GainTimeLayer'
    | 'SpendTimeLayer'
    | 'GainThread'
    | 'SpendThread'
    | 'GainConcoction'
    | 'SpendConcoction';
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
  alpha?: number;
  sensitivity?: number;
  chanceReduction?: number;
  trueDamage?: boolean;
  zealPerBuff?: number;
  multiplier?: number;
  baseHp?: number;
  baseAtk?: number;
  hpPerConstruct?: number;
  atkPerConstruct?: number;
  emptyPenaltyTrueDamage?: number;
  failureConstructHp?: number;
  failureConstructAtk?: number;
  consumeOtherConstructs?: number;
  constructAtkBonus?: number;
  name?: string;
  hp?: number;
  atk?: number;
  taunt?: boolean;
  hpBonus?: number;
  atkBonus?: number;
  times?: number;
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
  lastWords?: string;
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
  complexity?: 'low' | 'medium' | 'high';
  archetype?: string[];
  extendedPool?: string[];
  specialResource?: 'timeLayer' | 'thread' | 'concoction';
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
  inscription?: string;
  flavorText?: string;
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
