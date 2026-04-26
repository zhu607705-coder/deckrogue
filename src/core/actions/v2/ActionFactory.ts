/**
 * @file ActionFactory.ts
 * @description 动作工厂 - 根据 ActionSpec 创建具体的动作实例
 *
 * 主要职责:
 * - 解析 ActionSpec 定义，创建对应的 IAction 实例
 * - 注册 DamageActions、WarpActions、SpecialActions 等动作类型
 * - 配置动作的上下文信息 (source, target, cardId 等)
 * - 提供动作管理器的初始化和设置接口
 */
import { ActionSpec, GameState } from '@/core/types';
import { IAction, IActionContext, ActionQueue } from '@/core/actions/actionQueue';
import { ActionManager } from '@/core/actions/actionManager';

import {
  DealDamageAction,
  ApplyStatusAction,
  DrawCardsAction,
  DiscardCardsAction,
  GainBlockAction,
  GainEnergyAction,
  HealAction,
  ModifyEnergyAction,
  LoseHpAction
} from '@/core/actions/v2/DamageActions';

import {
  DelayAction,
  BonusNextDebuffAction,
  BuffNextDebuffAction,
  ConditionalBonusBlockAction,
  ConditionalAction,
  ConditionalApplyAction,
  ConditionalBonusDamageAction,
  ConditionalDelayedDamageAction,
  ConditionalDamageAction,
  ConditionalDrawAction,
  ConditionalHealAction,
  ConditionalKillAction,
  ConditionalRefundAction,
  TriggerDelayAction,
  SummonConstructAction,
  SummonMegaConstructAction,
  BuffConstructsAction,
  ConstructOverdriveAction,
  ConditionalSummonBonusAction,
  HealConstructAction,
  AddRandomElementAction,
  AddElementAction,
  TriggerReactionsAction,
  TransmuteElementsAction,
  EmergencyBlockAction,
  ReviveAction,
  RetainCardAction,
  ReturnLastCardAction,
  DoubleStatusAction,
  GainDevotionAction,
  GainCorruptionAction,
  GainCorruptionAxisAction,
  GainResourceAction,
  PurgeFearAndCorruptionAction,
  GainIntelAction,
  SpendIntelAction,
  PredictorAction,
  EmperorMercyAction,
  PurgeEnemyBuffsAction,
  PrecisionThrowDamageAction,
  ForceEnemyAttackAction,
  SolventDamageAction,
  RedirectIntentAction,
  MutateCardAction,
  GainTimeLayerAction,
  SpendTimeLayerAction,
  GainThreadAction,
  SpendThreadAction,
  GainConcoctionAction,
  SpendConcoctionAction,
  SpendAllResourceEffectAction,
  SpendResourceUpToAction,
  SpendResourceEffectAction,
  PuppetAttackAction,
  PuppetBuffAction,
  SacrificeAllPuppetsAction,
  TriggerOnPuppetDeathAction,
  SpendAllIntelAction,
  SpendAllConcoctionAction,
  RewindCombatStateAction,
  BindEnemySoulAction,
  CreateConstructAction,
  BuffAllConstructsAction,
  TriggerAllReactionsAction,
  TriggerRandomElementReactionAction,
  DelayedDrawAction,
  ElementalOverloadDamageAction,
  TransformHandToRareAction,
  TriggerPoisonOnTargetAction,
  TriggerPoisonAllEnemiesAction,
  DealDamagePiercingAction,
  IgnoreBlockAction,
  ExtendDurationAction,
  RemoveStatusAction,
  RemoveAnyDebuffAction,
  RemovePoisonAndDealDamageAction,
  ReplayLastCardAction,
  ScryAction,
  CopyLeftmostSkillAction,
  DelayedEnergyAction,
  RemoveSelfDebuffAction,
  ResourceRefundAction,
  StartOfTurnEffectAction,
  ConditionalResourceGainAction,
  NextAttackCostDownAction,
  ConditionalEffectAction,
  NextCardCostDownAction,
  DelayNextCardEffectAction,
  EndOfTurnDrawPenaltyAction,
  SelectCardForReplayAction,
  ModifyNextCardCostAction,
  EndOfCombatEffectAction,
  EndOfTurnEffectAction,
  MultiplyDamageAction
} from '@/core/actions/v2/SpecialActions';

import {
  DealWarpDamageAction,
  ModifyWarpTideAction,
  CheckWarpPerilAction,
  CreateWarpRiftAction
} from '@/core/actions/v2/WarpActions';

export class ActionFactoryV2 {
  private static actionMapEntries: Array<[string, new (spec: ActionSpec) => IAction]> = [
    ['DealDamage', DealDamageAction],
    ['ApplyStatus', ApplyStatusAction],
    ['Draw', DrawCardsAction],
    ['Discard', DiscardCardsAction],
    ['GainBlock', GainBlockAction],
    ['GainEnergy', GainEnergyAction],
    ['Heal', HealAction],
    ['ModifyEnergy', ModifyEnergyAction],
    ['Delay', DelayAction],
    ['BonusNextDebuff', BonusNextDebuffAction],
    ['BuffNextDebuff', BuffNextDebuffAction],
    ['Conditional', ConditionalAction],
    ['ConditionalApply', ConditionalApplyAction],
    ['ConditionalBonusBlock', ConditionalBonusBlockAction],
    ['ConditionalBonusDamage', ConditionalBonusDamageAction],
    ['ConditionalDelayedDamage', ConditionalDelayedDamageAction],
    ['ConditionalDamage', ConditionalDamageAction],
    ['ConditionalDraw', ConditionalDrawAction],
    ['ConditionalHeal', ConditionalHealAction],
    ['ConditionalKill', ConditionalKillAction],
    ['ConditionalRefund', ConditionalRefundAction],
    ['TriggerDelay', TriggerDelayAction],
    ['Summon', SummonConstructAction],
    ['SummonMegaConstruct', SummonMegaConstructAction],
    ['BuffConstructs', BuffConstructsAction],
    ['ConstructOverdrive', ConstructOverdriveAction],
    ['ConditionalSummonBonus', ConditionalSummonBonusAction],
    ['HealConstruct', HealConstructAction],
    ['AddRandomElement', AddRandomElementAction],
    ['AddElement', AddElementAction],
    ['TriggerReactions', TriggerReactionsAction],
    ['TransmuteElements', TransmuteElementsAction],
    ['EmergencyBlock', EmergencyBlockAction],
    ['Revive', ReviveAction],
    ['ReturnLastCard', ReturnLastCardAction],
    ['DoubleStatus', DoubleStatusAction],
    ['GainDevotion', GainDevotionAction],
    ['GainCorruption', GainCorruptionAction],
    ['GainCorruptionAxis', GainCorruptionAxisAction],
    ['PurgeFearAndCorruption', PurgeFearAndCorruptionAction],
    ['GainIntel', GainIntelAction],
    ['GainResource', GainResourceAction],
    ['SpendIntel', SpendIntelAction],
    ['SpendAllResourceEffect', SpendAllResourceEffectAction],
    ['SpendResourceUpTo', SpendResourceUpToAction],
    ['SpendResourceEffect', SpendResourceEffectAction],
    ['PuppetAttack', PuppetAttackAction],
    ['PuppetBuff', PuppetBuffAction],
    ['SacrificeAllPuppets', SacrificeAllPuppetsAction],
    ['TriggerOnPuppetDeath', TriggerOnPuppetDeathAction],
    ['PredictorAction', PredictorAction],
    ['EmperorMercy', EmperorMercyAction],
    ['PurgeEnemyBuffs', PurgeEnemyBuffsAction],
    ['PrecisionThrowDamage', PrecisionThrowDamageAction],
    ['ForceEnemyAttack', ForceEnemyAttackAction],
    ['SolventDamage', SolventDamageAction],
    ['RedirectIntent', RedirectIntentAction],
    ['MutateCard', MutateCardAction],
    ['DealWarpDamage', DealWarpDamageAction],
    ['ModifyWarpTide', ModifyWarpTideAction],
    ['CheckWarpPeril', CheckWarpPerilAction],
    ['CreateWarpRift', CreateWarpRiftAction],
    ['GainTimeLayer', GainTimeLayerAction],
    ['SpendTimeLayer', SpendTimeLayerAction],
    ['GainThread', GainThreadAction],
    ['SpendThread', SpendThreadAction],
    ['GainConcoction', GainConcoctionAction],
    ['SpendConcoction', SpendConcoctionAction],
    ['SpendAllIntel', SpendAllIntelAction],
    ['SpendAllConcoction', SpendAllConcoctionAction],
    ['RewindCombatState', RewindCombatStateAction],
    ['BindEnemySoul', BindEnemySoulAction],
    ['CreateConstruct', CreateConstructAction],
    ['BuffAllConstructs', BuffAllConstructsAction],
    ['TriggerAllReactions', TriggerAllReactionsAction],
    ['TriggerRandomElementReaction', TriggerRandomElementReactionAction],
    ['DelayedDraw', DelayedDrawAction],
    ['ElementalOverloadDamage', ElementalOverloadDamageAction],
    ['TransformHandToRare', TransformHandToRareAction],
    ['TriggerPoisonOnTarget', TriggerPoisonOnTargetAction],
    ['TriggerPoisonAllEnemies', TriggerPoisonAllEnemiesAction],
    ['DealDamagePiercing', DealDamagePiercingAction],
    ['IgnoreBlock', IgnoreBlockAction],
    ['ExtendDuration', ExtendDurationAction],
    ['RemoveStatus', RemoveStatusAction],
    ['RemoveAnyDebuff', RemoveAnyDebuffAction],
    ['RemovePoisonAndDealDamage', RemovePoisonAndDealDamageAction],
    ['ReplayLastCard', ReplayLastCardAction],
    ['Scry', ScryAction],
    ['CopyLeftmostSkill', CopyLeftmostSkillAction],
    ['DelayedEnergy', DelayedEnergyAction],
    ['RemoveSelfDebuff', RemoveSelfDebuffAction],
    ['ResourceRefund', ResourceRefundAction],
    ['StartOfTurnEffect', StartOfTurnEffectAction],
    ['ConditionalResourceGain', ConditionalResourceGainAction],
    ['NextAttackCostDown', NextAttackCostDownAction],
    ['ConditionalEffect', ConditionalEffectAction],
    ['NextCardCostDown', NextCardCostDownAction],
    ['DelayNextCardEffect', DelayNextCardEffectAction],
    ['EndOfTurnDrawPenalty', EndOfTurnDrawPenaltyAction],
    ['SelectCardForReplay', SelectCardForReplayAction],
    ['ModifyNextCardCost', ModifyNextCardCostAction],
    ['EndOfCombatEffect', EndOfCombatEffectAction],
    ['EndOfTurnEffect', EndOfTurnEffectAction],
    ['MultiplyDamage', MultiplyDamageAction],
    ['LoseHp', LoseHpAction],
    ['LoseHP', LoseHpAction],
    ['RetainCard', RetainCardAction],
  ];

  private static actionMap: Map<string, new (spec: ActionSpec) => IAction> = new Map(this.actionMapEntries);

  static createAction(spec: ActionSpec): IAction {
    const ActionClass = this.actionMap.get(spec.type);
    if (!ActionClass) {
      console.warn(`ActionFactoryV2: Unknown action type: ${spec.type}`);
      return new NullAction(spec);
    }
    return new ActionClass(spec);
  }

  static createActions(specs: ActionSpec[]): IAction[] {
    return specs.map(spec => this.createAction(spec));
  }

  static registerAction(type: string, actionClass: new (spec: ActionSpec) => IAction): void {
    this.actionMap.set(type, actionClass);
  }

  static getRegisteredTypes(): string[] {
    return Array.from(this.actionMap.keys());
  }
}

class NullAction implements IAction {
  readonly type = 'Null';

  constructor(private spec: ActionSpec) {}

  execute(): void {
    console.warn(`NullAction executed for unknown type: ${this.spec.type}`);
  }
}

export function setupActionManager(manager: ActionManager): void {
  ActionFactoryV2.getRegisteredTypes().forEach(type => {
    const ActionClass = ActionFactoryV2['actionMap'].get(type);
    if (ActionClass) {
      manager.registerAction(type, ActionClass);
    }
  });
}

export const actionFactoryV2 = ActionFactoryV2;
