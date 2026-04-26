/**
 * @file actions.ts
 * @description 动作类型定义 - 定义卡牌动作、卡牌定义和卡牌实例的类型系统
 *
 * 主要职责:
 * - 定义 CardType、CardTarget、Rarity 等卡牌基础类型
 * - 定义 ActionSpec 接口，描述卡牌动作的执行规范
 * - 定义 CardDef 接口，描述不可变的卡牌定义数据
 * - 定义 RunCardInstance 接口，描述运行时的卡牌实例数据
 * - 定义 CardEnchantmentDef、CardAfflictionDef 等卡牌修饰类型
 */
import type { EnemyAiProfile } from '@/core/types/enemyAI';

export type CardType = 'Attack' | 'Skill' | 'Power';
export type CardTarget = 'Enemy' | 'Self' | 'AllEnemies' | 'RandomEnemy' | 'None';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Starter';
export type EarlyGameRole = 'route_confirm' | 'route_payoff' | 'generic_power' | 'generic_fallback';

export type ActionCondition =
  | { type: 'HasIntel'; amount: number }
  | { type: 'TargetHasStatus'; status: string }
  | { type: 'TargetHasPoison' }
  | { type: 'TargetHasDebuff' }
  | { type: 'TargetHasAnyDebuff'; debuffs?: string[] }
  | { type: 'TargetHasBothDebuffs'; debuffs: string[] }
  | { type: 'TargetHasBlock' }
  | { type: 'TargetFullHp' }
  | { type: 'TargetBelowHP'; percent: number }
  | { type: 'EnemyHasStatus'; status: string }
  | { type: 'EnemyWillAttack' }
  | { type: 'TookDamageThisTurn' }
  | { type: 'CombatResult' }
  | { type: 'HasConstruct' }
  | { type: 'ControlsPuppets' }
  | { type: 'HasCorruption'; amount: number }
  | { type: 'HasTimeLayer'; amount: number }
  | { type: 'HasThread'; amount: number }
  | { type: 'HasConcoction'; amount: number }
  | { type: 'HasResource'; resource: string; amount?: number }
  | { type: 'ResourceThreshold'; resource: string; threshold: number }
  | { type: 'ResourceSpent' }
  | { type: 'SpendResource'; resource: string; amount: number }
  | { type: 'Kill' }
  | { type: 'AddedElementThisTurn' }
  | { type: 'HasTwoElements' }
  | { type: 'NoAttackYet' }
  | { type: 'GainedBlockThisTurn' }
  | { type: 'HasPlayerStatus'; status: string };

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
    | 'GainResource'
    | 'SpendResourceEffect'
    | 'SpendAllResourceEffect'
    | 'SpendResourceUpTo'
    | 'BonusNextDebuff'
    | 'BuffNextDebuff'
    | 'ConditionalApply'
    | 'ConditionalBonusBlock'
    | 'ConditionalBonusDamage'
    | 'ConditionalDelayedDamage'
    | 'ConditionalDraw'
    | 'ConditionalHeal'
    | 'ConditionalDamage'
    | 'ConditionalRefund'
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
    | 'ConditionalSummonBonus'
    | 'HealConstruct'
    | 'PuppetAttack'
    | 'PuppetBuff'
    | 'SacrificeAllPuppets'
    | 'TriggerOnPuppetDeath'
    | 'ForceEnemyAttack'
    | 'SummonMegaConstruct'
    | 'AddRandomElement'
    | 'AddElement'
    | 'TriggerReactions'
    | 'TriggerAllReactions'
    | 'TriggerRandomElementReaction'
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
    | 'SpendConcoction'
    | 'TriggerPoisonOnTarget'
    | 'TriggerPoisonAllEnemies'
    | 'DealDamagePiercing'
    | 'IgnoreBlock'
    | 'ExtendDuration'
    | 'RemoveStatus'
    | 'RemoveAnyDebuff'
    | 'RemovePoisonAndDealDamage'
    | 'ReplayLastCard'
    | 'Scry'
    | 'CopyLeftmostSkill'
    | 'DelayedEnergy'
    | 'RemoveSelfDebuff'
    | 'ResourceRefund'
    | 'StartOfTurnEffect'
    | 'ConditionalResourceGain'
    | 'NextAttackCostDown'
    | 'ConditionalEffect'
    | 'NextCardCostDown'
    | 'DelayNextCardEffect'
    | 'EndOfTurnDrawPenalty'
    | 'SelectCardForReplay'
    | 'ModifyNextCardCost'
    | 'EndOfCombatEffect'
    | 'EndOfTurnEffect'
    | 'MultiplyDamage'
    | 'DelayedDraw'
    | 'LoseHp'
    | 'LoseHP'
    | 'RetainCard';
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
  effects?: ActionSpec[];
  costModifier?: number;
  costReduction?: number;
  armorIgnore?: number;
  maxPoisonRemoval?: number;
  damagePerPoison?: number;
  effectPercent?: number;
  percent?: number;
  trigger?: { type: string; threshold?: number; resource?: string };
  debuffs?: string[];
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
  id?: string;
  attack?: number;
  block?: number;
  damage?: number;
  taunt?: boolean;
  hpBonus?: number;
  atkBonus?: number;
  times?: number;
  resource?: string;
  effect?: ActionSpec | { type: string; amount?: number; status?: string; stacks?: number; target?: CardTarget };
  stacks?: number;
  perDebuff?: number;
  ifTrue?: ActionSpec;
  ifFalse?: ActionSpec;
}

export type CardModifierEffect =
  | { type: 'damage'; amount: number }
  | { type: 'block'; amount: number }
  | { type: 'cost'; amount: number }
  | { type: 'draw'; amount: number }
  | { type: 'professionResource'; amount: number; resource: 'intel' | 'timeLayer' | 'thread' | 'concoction' };

export interface CardModifierDef {
  id: string;
  name: string;
  scope: 'persistent' | 'combat';
  effect: CardModifierEffect;
  description: string;
  tone?: 'blessing' | 'ward' | 'warp' | 'hex';
  icon?: string;
  applicableTo?: ('Attack' | 'Skill')[];
}

export interface CardEnchantmentDef extends CardModifierDef {
  scope: 'persistent';
}

export interface CardAfflictionDef extends CardModifierDef {
  scope: 'combat';
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
  routeTags?: string[];
  routeSignalStrength?: number;
  earlyGameRole?: EarlyGameRole;
}

export interface RunCardInstance extends CardDef {
  instanceId: string;
  baseCardId: string;
  runtimeBase: CardDef;
  persistentEnchantments: CardEnchantmentDef[];
  combatAfflictions: CardAfflictionDef[];
  tempCost?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp_range: [number, number];
  intent_policy: { intent: string; weight: number }[];
  intentPolicy?: { intent: string; weight: number }[];
  moves: Record<string, ActionSpec[]>;
  keywords: string[];
  ai_profile?: EnemyAiProfile;
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
  secondaryResource?: 'evidence' | 'rage' | 'command';
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
