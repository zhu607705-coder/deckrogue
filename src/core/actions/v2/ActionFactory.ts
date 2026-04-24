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
  ConditionalAction,
  ConditionalKillAction,
  TriggerDelayAction,
  SummonConstructAction,
  SummonMegaConstructAction,
  BuffConstructsAction,
  ConstructOverdriveAction,
  HealConstructAction,
  AddRandomElementAction,
  AddElementAction,
  TriggerReactionsAction,
  TransmuteElementsAction,
  EmergencyBlockAction,
  ReviveAction,
  ReturnLastCardAction,
  DoubleStatusAction,
  GainDevotionAction,
  GainCorruptionAction,
  GainCorruptionAxisAction,
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
  SpendAllIntelAction,
  SpendAllConcoctionAction,
  RewindCombatStateAction,
  BindEnemySoulAction,
  CreateConstructAction,
  BuffAllConstructsAction,
  TriggerAllReactionsAction,
  TransformHandToRareAction,
  TriggerPoisonOnTargetAction
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
    ['Conditional', ConditionalAction],
    ['ConditionalKill', ConditionalKillAction],
    ['TriggerDelay', TriggerDelayAction],
    ['Summon', SummonConstructAction],
    ['SummonMegaConstruct', SummonMegaConstructAction],
    ['BuffConstructs', BuffConstructsAction],
    ['ConstructOverdrive', ConstructOverdriveAction],
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
    ['SpendIntel', SpendIntelAction],
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
    ['TransformHandToRare', TransformHandToRareAction],
    ['TriggerPoisonOnTarget', TriggerPoisonOnTargetAction],
    ['LoseHp', LoseHpAction],
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
