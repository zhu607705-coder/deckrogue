/**
 * @file SpecialActions.ts
 * @description 特殊卡牌动作 - 处理非标准伤害/防御的特殊卡牌效果
 *
 * 主要职责:
 * - 注册和执行特殊类型的卡牌动作 (如: 抽牌、施加状态、区域效果、条件触发等)
 * - 与战斗系统集成，处理卡牌打出后的连锁效果
 * - 管理卡牌目标选择和效果应用
 *
 * 动作类型包括:
 * - 抽牌/弃牌动作
 * - 状态效果施加 (中毒、虚弱、易伤等)
 * - 条件触发动作 (基于手牌数、能量数等条件)
 * - 区域效果动作 (对全体敌人/友方生效)
 * - 遗物触发动作
 * - 特殊机制动作 (附魔、升级等)
 */
import { GameState, ActionSpec, RunCardInstance } from '@/core/types';
import { IAction, IActionContext, ActionQueue } from '@/core/actions/actionQueue';
import { TargetingService, CardTarget } from '@/core/combat/targetingService';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import { globalEventBus } from '@/core/events/eventBus';
import { getActionManager } from '@/core/actions/actionManager';
import { getEnemyDefById, getCardDefById } from '@/content/narrative/numericSystem';
import { createRunCardInstance, deriveRunCardInstance, normalizeRunCardInstance } from '@/core/combat/runCardInstance';
import { stateRandomChoice, stateRandomId, stateRandomInt, stateShuffle } from '@/infrastructure/rng/stateRandom';

interface ActionQueuePrivate {
  _currentContext?: IActionContext;
}

export abstract class BaseAction implements IAction {
  protected spec: ActionSpec;
  protected context: IActionContext = { source: 'player' };

  constructor(spec: ActionSpec) {
    this.spec = spec;
  }

  get type(): string {
    return this.spec.type;
  }

  setContext(context: IActionContext): void {
    this.context = context;
  }

  abstract execute(state: GameState, queue: ActionQueue): void;

  protected resolveTargets(state: GameState, targetType: CardTarget) {
    return TargetingService.resolveTargets(state, this.context, targetType);
  }

  protected getContextFromQueue(queue: ActionQueue): IActionContext {
    return (queue as unknown as ActionQueuePrivate)._currentContext || { source: 'player' };
  }
}

const DEBUFF_STATUSES = ['Weak', 'Vulnerable', 'Poison', 'Burn', 'Frail', 'Fear'];
const SPECIAL_RESOURCES = ['timeLayer', 'thread', 'concoction'] as const;
const SECONDARY_RESOURCES = ['evidence', 'rage', 'command', 'verdict', 'seal'] as const;
const ROUTE_RESOURCES = ['intel', ...SPECIAL_RESOURCES, ...SECONDARY_RESOURCES] as const;
const SCALABLE_ACTION_NUMBERS = [
  'amount',
  'bonus',
  'stacks',
  'damage',
  'block',
  'attack',
  'hp',
  'atk',
  'baseHp',
  'baseAtk',
  'hpBonus',
  'atkBonus',
  'constructAtkBonus',
  'damagePerPoison',
] as const;

type SpecialResourceName = typeof SPECIAL_RESOURCES[number];
type SecondaryResourceName = typeof SECONDARY_RESOURCES[number];
type StoredActionListKey = 'startOfTurnEffects' | 'endOfTurnEffects' | 'endOfCombatEffects';

function isSpecialResource(resource: string): resource is SpecialResourceName {
  return (SPECIAL_RESOURCES as readonly string[]).includes(resource);
}

function isSecondaryResource(resource: string): resource is SecondaryResourceName {
  return (SECONDARY_RESOURCES as readonly string[]).includes(resource);
}

function getRouteResource(state: GameState, resource: string): number {
  const combatPlayer = state.combat?.player as Record<string, unknown> | undefined;
  if (resource === 'intel') return Math.max(0, Math.floor(Number(state.player.intel || combatPlayer?.intel || 0)));
  if (isSpecialResource(resource)) return Math.max(0, Math.floor(Number(combatPlayer?.[resource] || 0)));
  if (isSecondaryResource(resource)) {
    const player = state.player as typeof state.player & {
      secondaryResources?: Partial<Record<SecondaryResourceName, number>>;
    } & Partial<Record<SecondaryResourceName, number>>;
    return Math.max(0, Math.floor(Number(player.secondaryResources?.[resource] ?? player[resource] ?? 0)));
  }
  return 0;
}

function setRouteResource(state: GameState, resource: string, amount: number): void {
  const next = Math.max(0, Math.min(10, Math.floor(amount)));
  if (resource === 'intel') {
    state.player.intel = next;
    if (state.combat) state.combat.player.intel = next;
    return;
  }
  if (isSpecialResource(resource)) {
    if (state.combat) {
      state.combat.player[resource] = next;
    }
    return;
  }
  if (isSecondaryResource(resource)) {
    const player = state.player as typeof state.player & {
      secondaryResources?: Partial<Record<SecondaryResourceName, number>>;
    } & Partial<Record<SecondaryResourceName, number>>;
    player[resource] = next;
    player.secondaryResources = {
      ...(player.secondaryResources || {}),
      [resource]: next,
    };
  }
}

function gainRouteResource(state: GameState, resource: string, amount: number): number {
  const current = getRouteResource(state, resource);
  const next = current + Math.max(0, Math.floor(amount));
  setRouteResource(state, resource, next);
  const gained = getRouteResource(state, resource) - current;
  if (gained > 0) {
    globalEventBus.publish({ type: 'RouteResourceGained', resource, amount: gained } as any);
  }
  return gained;
}

function markResourceSpent(state: GameState, resource?: string, amount = 1): void {
  if (!state.combat) return;
  const player = state.combat.player as typeof state.combat.player & {
    resourceSpentThisTurn?: number;
    resourceRefundPending?: number;
    resourceRefundUsedThisTurn?: number;
  };
  const spent = Math.max(0, Math.floor(amount));
  if (spent <= 0) return;
  player.resourceSpentThisTurn = Math.max(0, Math.floor(player.resourceSpentThisTurn || 0)) + spent;
  if (resource) {
    globalEventBus.publish({ type: 'RouteResourceSpent', resource, amount: spent } as any);
  }
  if (!resource || (player.resourceRefundPending || 0) <= 0 || (player.resourceRefundUsedThisTurn || 0) > 0) return;

  const refund = Math.max(0, Math.floor(player.resourceRefundPending || 0));
  if (refund <= 0) return;
  gainRouteResource(state, resource, refund);
  player.resourceRefundUsedThisTurn = 1;
  player.resourceRefundPending = 0;
}

function spendRouteResource(state: GameState, resource: string, amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  const current = getRouteResource(state, resource);
  if (current < cost) return false;
  setRouteResource(state, resource, current - cost);
  if (cost > 0) markResourceSpent(state, resource, cost);
  return true;
}

function getContextTarget(state: GameState, context: IActionContext): { type: 'player' | 'enemy'; id: string; entity: any } | null {
  const combat = state.combat;
  if (!combat) return null;
  if (context.targetId === 'player') {
    return { type: 'player', id: 'player', entity: combat.player };
  }
  const exactEnemy = context.targetId ? combat.enemies.find(e => e.id === context.targetId) : null;
  const enemy = exactEnemy ?? combat.enemies.find(e => e.hp > 0);
  return enemy ? { type: 'enemy', id: enemy.id, entity: enemy } : null;
}

function hasAnyDebuff(statuses: Record<string, number> = {}, debuffs = DEBUFF_STATUSES): boolean {
  return debuffs.some(status => Number(statuses[status] || 0) > 0);
}

function evaluateActionCondition(state: GameState, context: IActionContext, condition: any): boolean {
  if (!condition) return false;
  const combat = state.combat;
  const target = getContextTarget(state, context);
  const targetStatuses = target?.entity?.statuses || {};

  switch (condition.type) {
    case 'HasIntel':
      return getRouteResource(state, 'intel') >= Math.max(0, Number(condition.amount || 0));
    case 'HasConstruct':
    case 'ControlsPuppets':
      return (combat?.player.constructs.length || 0) > 0;
    case 'HasCorruption':
      return (state.player.corruption || 0) >= (condition.amount || 0);
    case 'TargetHasStatus':
    case 'EnemyHasStatus':
      return !!condition.status && Number(targetStatuses[condition.status] || 0) > 0;
    case 'TargetHasPoison':
      return Number(targetStatuses.Poison || 0) > 0;
    case 'TargetHasDebuff':
      return hasAnyDebuff(targetStatuses);
    case 'TargetHasAnyDebuff':
      return hasAnyDebuff(targetStatuses, Array.isArray(condition.debuffs) ? condition.debuffs : DEBUFF_STATUSES);
    case 'TargetHasBothDebuffs':
      return Array.isArray(condition.debuffs) && condition.debuffs.every((status: string) => Number(targetStatuses[status] || 0) > 0);
    case 'TargetHasBlock':
      return Number(target?.entity?.block || 0) > 0;
    case 'TargetBelowHP':
      return !!target?.entity && Number(target.entity.hp || 0) <= Number(target.entity.maxHp || 0) * (Math.max(0, Number(condition.percent || 0)) / 100);
    case 'TargetFullHp':
      return !!target?.entity && Number(target.entity.hp || 0) >= Number(target.entity.maxHp || 0);
    case 'Kill':
      return !!target?.entity && Number(target.entity.hp || 0) <= 0;
    case 'CombatResult':
      return (combat?.player as { combatResult?: string } | undefined)?.combatResult === 'victory'
        || !!combat?.enemies.every(enemy => enemy.hp <= 0);
    case 'EnemyWillAttack':
      return String(target?.entity?.nextIntent || '').toLowerCase().includes('attack');
    case 'TookDamageThisTurn':
      return Number(combat?.player.damageTakenThisTurn || 0) > 0;
    case 'AddedElementThisTurn':
      return Number((combat?.player as { elementsAddedThisTurn?: number } | undefined)?.elementsAddedThisTurn || 0) > 0;
    case 'HasTwoElements':
      return new Set(combat?.player.elements || []).size >= 2;
    case 'HasPlayerStatus':
      return !!condition.status && Number(combat?.player.statuses?.[condition.status] || 0) > 0;
    case 'HasTimeLayer':
      return getRouteResource(state, 'timeLayer') >= Math.max(0, Number(condition.amount || 0));
    case 'HasThread':
      return getRouteResource(state, 'thread') >= Math.max(0, Number(condition.amount || 0));
    case 'HasConcoction':
      return getRouteResource(state, 'concoction') >= Math.max(0, Number(condition.amount || 0));
    case 'HasResource':
      return getRouteResource(state, String(condition.resource || '')) >= Math.max(1, Number(condition.amount || 1));
    case 'NoResource':
      return getRouteResource(state, String(condition.resource || '')) < Math.max(1, Number(condition.amount || 1));
    case 'ResourceThreshold':
      return getRouteResource(state, String(condition.resource || '')) >= Math.max(0, Number(condition.threshold || 0));
    case 'ResourceSpent':
      return Number((combat?.player as { resourceSpentThisTurn?: number } | undefined)?.resourceSpentThisTurn || 0) > 0;
    case 'NoAttackYet': {
      const attacksPlayed = Number((combat?.player as { attacksPlayedThisTurn?: number } | undefined)?.attacksPlayedThisTurn || 0);
      const currentCardIsAttack = context.card?.type === 'Attack';
      return attacksPlayed <= (currentCardIsAttack ? 1 : 0);
    }
    case 'GainedBlockThisTurn':
      return Number((combat?.player as { blockGainedThisTurn?: number } | undefined)?.blockGainedThisTurn || 0) > 0;
    default:
      return false;
  }
}

function queueActionSpecs(queue: ActionQueue, actions: ActionSpec[], context: IActionContext): void {
  for (let i = actions.length - 1; i >= 0; i -= 1) {
    const action = getActionManager().createAction(actions[i]);
    queue.pushFront(action, { ...context }, 0);
  }
}

function toActionList(value: unknown): ActionSpec[] {
  if (!value) return [];
  return Array.isArray(value) ? value as ActionSpec[] : [value as ActionSpec];
}

function collectSpecActions(spec: ActionSpec & Record<string, unknown>, key: 'effect' | 'effects'): ActionSpec[] {
  return toActionList(spec[key]);
}

function scaleNumber(value: number, percent: number): number {
  if (value <= 0) return value;
  return Math.max(1, Math.floor(value * percent / 100));
}

function scaleActionSpec(spec: ActionSpec, percent: number): ActionSpec {
  const next = { ...spec } as ActionSpec & Record<string, unknown>;
  for (const key of SCALABLE_ACTION_NUMBERS) {
    if (typeof next[key] === 'number') {
      next[key] = scaleNumber(next[key] as number, percent);
    }
  }
  if (next.actions) next.actions = toActionList(next.actions).map(action => scaleActionSpec(action, percent));
  if (next.trueActions) next.trueActions = toActionList(next.trueActions).map(action => scaleActionSpec(action, percent));
  if (next.falseActions) next.falseActions = toActionList(next.falseActions).map(action => scaleActionSpec(action, percent));
  if (next.effect && typeof next.effect === 'object') {
    (next as Record<string, unknown>).effect = Array.isArray(next.effect)
      ? (next.effect as ActionSpec[]).map(action => scaleActionSpec(action, percent))
      : scaleActionSpec(next.effect as ActionSpec, percent);
  }
  if (next.effects && typeof next.effects === 'object') {
    next.effects = toActionList(next.effects).map(action => scaleActionSpec(action, percent));
  }
  return next;
}

function scaleActionSpecs(actions: ActionSpec[], percent: number): ActionSpec[] {
  const bounded = Math.max(1, Math.min(200, Math.floor(percent)));
  return actions.map(action => scaleActionSpec(action, bounded));
}

function drawCardsFromPiles(state: GameState, amount: number): number {
  const combat = state.combat;
  if (!combat) return 0;
  let drawn = 0;
  for (let i = 0; i < Math.max(0, Math.floor(amount)); i += 1) {
    if (combat.drawPile.length === 0) {
      if (combat.discardPile.length === 0) break;
      combat.drawPile = stateShuffle(state, combat.discardPile);
      combat.discardPile = [];
    }
    const card = combat.drawPile.pop();
    if (!card) break;
    combat.hand.push(card);
    drawn += 1;
  }
  return drawn;
}

function removeStacksFromStatuses(statuses: Record<string, number>, candidates: string[], amount: number): number {
  let remaining = Math.max(0, Math.floor(amount));
  let removed = 0;
  for (const status of candidates) {
    if (remaining <= 0) break;
    const current = Math.max(0, Math.floor(Number(statuses[status] || 0)));
    if (current <= 0) continue;
    const delta = Math.min(current, remaining);
    const next = current - delta;
    if (next > 0) statuses[status] = next;
    else delete statuses[status];
    remaining -= delta;
    removed += delta;
  }
  return removed;
}

function reduceHandCardCost(
  state: GameState,
  amount: number,
  predicate: (card: RunCardInstance) => boolean
): boolean {
  const combat = state.combat;
  if (!combat) return false;
  const reduction = Math.max(0, Math.floor(amount));
  if (reduction <= 0) return false;
  const index = combat.hand.findIndex(predicate);
  if (index < 0) return false;

  const card = normalizeRunCardInstance(combat.hand[index], () => stateRandomId(state, 'cost_card'));
  const currentCost = Math.max(0, Math.floor(Number(card.tempCost ?? card.cost ?? 0)));
  combat.hand[index] = deriveRunCardInstance({
    ...card,
    tempCost: Math.max(0, currentCost - reduction),
  });
  return true;
}

function createDelayedReplayCard(
  state: GameState,
  sourceCard: RunCardInstance,
  turns: number,
  percent = 100
): RunCardInstance {
  const normalized = normalizeRunCardInstance(sourceCard, () => stateRandomId(state, 'replay_source'));
  const delayedActions = scaleActionSpecs(
    normalized.actions.filter(action => action.type !== 'Delay' && action.type !== 'ReplayLastCard'),
    percent
  );
  const runtimeBase = {
    ...normalized.runtimeBase,
    id: `${normalized.baseCardId || normalized.id}_delayed_replay`,
    name: `${normalized.name} Replay`,
    cost: 0,
    actions: [{
      type: 'Delay',
      turns: Math.max(1, Math.floor(turns)),
      actions: delayedActions,
    } as ActionSpec],
  };

  return deriveRunCardInstance({
    ...normalized,
    instanceId: stateRandomId(state, 'delayed_replay'),
    baseCardId: runtimeBase.id,
    runtimeBase,
    tempCost: 0,
  });
}

function findPreviousPlayedCard(state: GameState, context: IActionContext): RunCardInstance | null {
  const combat = state.combat;
  if (!combat) return null;
  const currentInstanceId = context.cardInstanceId || context.card?.instanceId;
  const discardCandidate = [...combat.discardPile]
    .reverse()
    .find(card => card.instanceId !== currentInstanceId);
  if (discardCandidate) return discardCandidate;
  const lastPlayed = combat.player.lastPlayedCard;
  if (lastPlayed && lastPlayed.instanceId !== currentInstanceId) return lastPlayed;
  return null;
}

function storeActionList(state: GameState, key: StoredActionListKey, actions: ActionSpec[], trigger?: unknown): void {
  const combat = state.combat;
  if (!combat || actions.length === 0) return;
  const player = combat.player as typeof combat.player & Record<StoredActionListKey, Array<{ actions: ActionSpec[]; trigger?: unknown }>>;
  player[key] = [...(player[key] || []), { actions, trigger }];
}

export class DelayAction extends BaseAction {
  private turns: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.turns = spec.turns || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    this.context = this.getContextFromQueue(queue);
    if (!combat || !this.context.card) return;

    combat.player.delayedCards.push({
      card: this.context.card,
      turns: this.turns,
      targetId: this.context.targetId
    });
  }
}

export class ConditionalAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  private evaluateCondition(state: GameState): boolean {
    return evaluateActionCondition(state, this.context, this.spec.condition);
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const actions = this.evaluateCondition(state)
      ? [...(this.spec.trueActions || []), ...(this.spec.ifTrue ? [this.spec.ifTrue] : [])]
      : [...(this.spec.falseActions || []), ...(this.spec.ifFalse ? [this.spec.ifFalse] : [])];
    if (actions.length === 0) return;

    queueActionSpecs(queue, actions, this.context);
  }
}

export class GainResourceAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const resource = String(this.spec.resource || '');
    const amount = Math.max(0, Number(this.spec.amount || 0));
    if (!resource || amount <= 0) return;
    gainRouteResource(state, resource, amount);
    if (state.combat) {
      state.combat.warpPulse = { text: `${resource} +${amount}`, tone: 'faith' };
    }
  }
}

export class SpendResourceEffectAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const resource = String(this.spec.resource || '');
    const amount = Math.max(0, Number(this.spec.amount || 0));
    if (!resource || amount <= 0 || !spendRouteResource(state, resource, amount)) return;

    const effect = (this.spec.effect || {}) as any;
    if (effect.type === 'IgnoreBlock') {
      const target = getContextTarget(state, this.context);
      if (!state.combat || !target || target.type !== 'enemy') return;
      const damage = Math.max(0, Math.floor(Number(effect.amount || 0)));
      if (damage <= 0) return;
      combatSystem.applyDamage(state, {
        amount: damage,
        sourceType: 'player',
        sourceId: 'player',
        targetType: 'enemy',
        targetId: target.id,
        modifiers: [],
        isTrueDamage: true,
        ignoreBlock: true,
      });
      return;
    }

    const target = (effect.target || this.spec.target || this.context.card?.targeting || 'Enemy') as ActionSpec['target'];
    const actionSpec: ActionSpec | null =
      effect.type === 'ApplyStatus'
        ? { type: 'ApplyStatus', status: effect.status, amount: effect.stacks ?? effect.amount ?? 1, target }
        : effect.type === 'Draw'
          ? { type: 'Draw', amount: Math.max(1, Number(effect.amount || 1)), target: 'Self' }
          : effect.type === 'GainBlock'
            ? { type: 'GainBlock', amount: Math.max(1, Number(effect.amount || 1)), target: 'Self' }
            : null;
    if (!actionSpec) return;
    queueActionSpecs(queue, [actionSpec], this.context);
  }
}

export class SpendResourceUpToAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const resource = String(this.spec.resource || '');
    const maxAmount = Math.max(0, Math.floor(Number((this.spec as any).maxAmount ?? this.spec.amount ?? 0)));
    const spent = Math.min(getRouteResource(state, resource), maxAmount);
    if (!resource || spent <= 0 || !spendRouteResource(state, resource, spent)) return;

    const effects = Array.isArray((this.spec as any).effect) ? (this.spec as any).effect : [(this.spec as any).effect];
    for (let i = 0; i < spent; i += 1) {
      queueActionSpecs(queue, effects.filter(Boolean).map((effect: any) => ({
        type: effect.type,
        amount: effect.stacks ?? effect.amount ?? 1,
        status: effect.status,
        target: effect.target ?? this.spec.target ?? this.context.card?.targeting ?? 'Enemy',
      } as ActionSpec)), this.context);
    }
  }
}

export class SpendAllResourceEffectAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const resource = String(this.spec.resource || '');
    const spent = getRouteResource(state, resource);
    if (!resource || spent <= 0 || !spendRouteResource(state, resource, spent)) return;

    const effects = Array.isArray((this.spec as any).effect) ? (this.spec as any).effect : [(this.spec as any).effect];
    for (const effect of effects.filter(Boolean)) {
      if (effect.type === 'DealDamage') {
        queueActionSpecs(queue, [{
          type: 'DealDamage',
          amount: Math.max(0, Number(effect.amount || 0)) * spent,
          target: effect.target ?? this.spec.target ?? this.context.card?.targeting ?? 'Enemy',
        } as ActionSpec], this.context);
        continue;
      }

      for (let i = 0; i < spent; i += 1) {
        queueActionSpecs(queue, [{
          type: effect.type,
          amount: effect.stacks ?? effect.amount ?? 1,
          status: effect.status,
          target: effect.target ?? this.spec.target ?? this.context.card?.targeting ?? 'Enemy',
        } as ActionSpec], this.context);
      }
    }
  }
}

export class ConditionalDrawAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const condition = this.spec.condition as any;
    const passed = condition?.type === 'SpendResource'
      ? spendRouteResource(state, String(condition.resource || ''), Math.max(0, Number(condition.amount || 0)))
      : evaluateActionCondition(state, this.context, condition);
    if (!passed) return;
    queueActionSpecs(queue, [{ type: 'Draw', amount: Math.max(1, Number(this.spec.amount || 1)), target: 'Self' }], this.context);
  }
}

export class ConditionalBonusBlockAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    queueActionSpecs(queue, [{ type: 'GainBlock', amount: Math.max(1, Number(this.spec.bonus || this.spec.amount || 1)), target: 'Self' }], this.context);
  }
}

export class BonusNextDebuffAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat) return;
    const bonus = Math.max(1, Math.floor(Number(this.spec.bonus ?? this.spec.amount ?? 1)));
    const key = this.spec.status ? `BonusNextDebuff:${this.spec.status}` : 'BonusNextDebuff';
    combat.player.statuses[key] = Math.max(0, Math.floor(combat.player.statuses[key] || 0)) + bonus;
  }
}

export class BuffNextDebuffAction extends BonusNextDebuffAction {}

export class RetainCardAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat) return;
    const amount = Math.max(1, Math.floor(Number(this.spec.amount || 1)));
    combat.player.statuses['RetainCard'] = Math.max(0, Math.floor(combat.player.statuses['RetainCard'] || 0)) + amount;
  }
}

export class ConditionalDamageAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const passed = evaluateActionCondition(state, this.context, this.spec.condition);
    if (this.spec.ifTrue || this.spec.ifFalse) {
      const selected = passed ? this.spec.ifTrue : this.spec.ifFalse;
      if (selected) queueActionSpecs(queue, [selected], this.context);
      return;
    }
    if (!passed) return;

    const target = getContextTarget(state, this.context);
    const debuffCount = target
      ? DEBUFF_STATUSES.filter(status => Number(target.entity.statuses?.[status] || 0) > 0).length
      : 0;
    const amount = Math.max(0, Number(this.spec.bonus ?? this.spec.amount ?? 0) + debuffCount * Math.max(0, Number(this.spec.perDebuff || 0)));
    if (amount <= 0) return;
    queueActionSpecs(queue, [{ type: 'DealDamage', amount, target: (this.spec.target || this.context.card?.targeting || 'Enemy') as ActionSpec['target'] }], this.context);
  }
}

export class ConditionalBonusDamageAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    queueActionSpecs(queue, [{
      type: 'DealDamage',
      amount: Math.max(1, Number(this.spec.bonus || this.spec.amount || 1)),
      target: (this.spec.target || this.context.card?.targeting || 'Enemy') as ActionSpec['target'],
    }], this.context);
  }
}

export class ConditionalRefundAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    if (this.spec.resource === 'energy') {
      queueActionSpecs(queue, [{ type: 'GainEnergy', amount: Math.max(1, Number(this.spec.amount || 1)), target: 'Self' }], this.context);
    } else if (this.spec.resource) {
      queueActionSpecs(queue, [{ type: 'GainResource', resource: this.spec.resource, amount: Math.max(1, Number(this.spec.amount || 1)) }], this.context);
    }
  }
}

export class ConditionalApplyAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    queueActionSpecs(queue, [{
      type: 'ApplyStatus',
      status: this.spec.status,
      amount: this.spec.stacks ?? this.spec.amount ?? 1,
      target: (this.spec.target || this.context.card?.targeting || 'Enemy') as ActionSpec['target'],
    }], this.context);
  }
}

export class ConditionalHealAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    queueActionSpecs(queue, [{ type: 'Heal', amount: Math.max(1, Number(this.spec.amount || 1)), target: 'Self' }], this.context);
  }
}

export class ConditionalEnergyGainAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    queueActionSpecs(queue, [{ type: 'GainEnergy', amount: Math.max(1, Number(this.spec.amount || 1)), target: 'Self' }], this.context);
  }
}

export class DrawAndHealAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const spec = this.spec as unknown as Record<string, unknown>;
    const drawAmount = Math.max(0, Number(spec.drawAmount ?? this.spec.amount ?? 0));
    const healAmount = Math.max(0, Number(spec.healAmount ?? 0));
    const actions: ActionSpec[] = [];
    if (drawAmount > 0) actions.push({ type: 'Draw', amount: drawAmount, target: 'Self' });
    if (healAmount > 0) actions.push({ type: 'Heal', amount: healAmount, target: 'Self' });
    queueActionSpecs(queue, actions, this.context);
  }
}

export class ElementalOverloadDamageAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const uniqueElements = new Set(state.combat?.player.elements || []).size;
    const amount = Math.max(1, Number(this.spec.amount || 1)) * (uniqueElements >= 3 ? 2 : 1);
    queueActionSpecs(queue, [{ type: 'DealDamage', amount, target: (this.spec.target || 'Enemy') as ActionSpec['target'] }], this.context);
  }
}

export class TriggerRandomElementReactionAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat) return;
    const aliveEnemies = TargetingService.getAliveEnemies(state);
    if (aliveEnemies.length === 0) return;
    const roll = stateRandomInt(state, 3);
    if (roll === 0) {
      aliveEnemies.forEach((enemy) => combatSystem.applyStatus(state, 'enemy', enemy.id, 'Burn', 4));
    } else if (roll === 1) {
      aliveEnemies.forEach((enemy) => combatSystem.applyStatus(state, 'enemy', enemy.id, 'Weak', 1));
    } else {
      aliveEnemies.forEach((enemy) => combatSystem.applyDamage(state, {
        amount: 8,
        sourceType: 'player',
        sourceId: 'player',
        targetType: 'enemy',
        targetId: enemy.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false,
      }));
    }
    combat.player.elements = [];
  }
}

export class DelayedDrawAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    queueActionSpecs(queue, [{ type: 'Draw', amount: Math.max(1, Number(this.spec.amount || 1)), target: 'Self' }], this.context);
  }
}

export class ConditionalDelayedDamageAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    queueActionSpecs(queue, [{ type: 'DealDamage', amount: Math.max(1, Number(this.spec.amount || 1)), target: (this.spec.target || this.context.card?.targeting || 'Enemy') as ActionSpec['target'] }], this.context);
  }
}

export class ConditionalKillAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    const targetId = this.context.targetId;
    if (!combat || !targetId) return;

    const target = targetId === 'player'
      ? combat.player
      : combat.enemies.find(enemy => enemy.id === targetId);
    if (!target || target.hp > 0) return;

    const actions = this.spec.trueActions || [];
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = getActionManager().createAction(actions[i]);
      queue.pushFront(action, { ...this.context }, 0);
    }
  }
}

export class TriggerDelayAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || combat.player.delayedCards.length === 0) return;

    const delayed = combat.player.delayedCards.shift();
    if (!delayed) return;

    const delayAction = delayed.card.actions.find((a: ActionSpec) => a.type === 'Delay');
    if (delayAction?.actions) {
      const manager = getActionManager();
      if (manager) {
        delayAction.actions.forEach((spec: ActionSpec) => {
          const action = manager.createAction(spec);
          manager.enqueueUrgentAction(action, {
            source: 'player',
            targetId: delayed.targetId,
            card: delayed.card
          }, 'system');
        });
      }
    }
  }
}

export class SummonConstructAction extends BaseAction {
  private unit: string;

  constructor(spec: ActionSpec) {
    super(spec);
    this.unit = spec.unit || '';
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const construct = this.createConstruct(state);
    if (!construct) return;

    if (this.unit === 'mega_construct') {
      combat.player.constructs = [construct];
    } else if (combat.player.constructs.length < 2) {
      combat.player.constructs.push(construct);
    } else {
      return;
    }

    const threadMastery = Math.max(0, Math.floor(combat.player.statuses['ThreadMastery'] || 0));
    if (threadMastery > 0) {
      combat.player.thread = Math.min(10, (combat.player.thread || 0) + threadMastery);
    }

    const durationBonus = Math.max(0, Math.floor(Number(combat.player.statuses.ExtendNextSummonDuration || 0)));
    if (durationBonus > 0) {
      (construct as Record<string, unknown>).duration = Math.max(0, Number((construct as Record<string, unknown>).duration || 0)) + durationBonus;
      delete combat.player.statuses.ExtendNextSummonDuration;
    }

    globalEventBus.publish({
      type: 'ConstructCreated',
      constructId: construct.id,
      name: construct.name
    });
  }

  private createConstruct(state: GameState): { id: string; name: string; hp: number; maxHp: number; atk: number; taunt: boolean; overflowDamageToPlayer?: boolean; damageSharePct?: number } | null {
    const id = stateRandomId(state, 'construct');

    switch (this.unit) {
      case 'scrap_golem':
        return { id, name: 'Scrap Golem', hp: 12, maxHp: 12, atk: 6, taunt: false, damageSharePct: 0.6 };
      case 'temp_guard':
        return { id, name: 'Temp Guard', hp: 5, maxHp: 5, atk: 0, taunt: true, overflowDamageToPlayer: true };
      case 'mega_construct':
        return { id, name: 'Mega Construct', hp: 50, maxHp: 50, atk: 10, taunt: true };
      case 'reinforced_golem':
        return { id, name: 'Reinforced Golem', hp: 16, maxHp: 16, atk: 8, taunt: true };
      case 'reinforced_golem_plus':
        return { id, name: 'Reinforced Golem', hp: 20, maxHp: 20, atk: 9, taunt: true };
      default:
        if ((this.spec as any).id || (this.spec as any).attack || this.spec.hp) {
          const name = String((this.spec as any).id || this.unit || 'puppet');
          const hp = Math.max(1, Math.floor(Number(this.spec.hp || 1)));
          const atk = Math.max(0, Math.floor(Number((this.spec as any).attack ?? this.spec.atk ?? 0)));
          return { id, name, hp, maxHp: hp, atk, taunt: !!this.spec.taunt };
        }
        return null;
    }
  }
}

export class SummonMegaConstructAction extends BaseAction {
  private baseHp: number;
  private baseAtk: number;
  private hpPerConstruct: number;
  private atkPerConstruct: number;
  private emptyPenaltyTrueDamage: number;
  private failureConstructHp: number;
  private failureConstructAtk: number;

  constructor(spec: ActionSpec) {
    super(spec);
    // Defaults chosen so consuming 2 constructs recreates the previous 50 HP / 10 ATK benchmark.
    this.baseHp = spec.baseHp ?? 20;
    this.baseAtk = spec.baseAtk ?? 4;
    this.hpPerConstruct = spec.hpPerConstruct ?? 15;
    this.atkPerConstruct = spec.atkPerConstruct ?? 4;
    this.emptyPenaltyTrueDamage = Math.max(0, Math.floor(spec.emptyPenaltyTrueDamage ?? 15));
    this.failureConstructHp = Math.max(1, Math.floor(spec.failureConstructHp ?? 10));
    this.failureConstructAtk = Math.max(0, Math.floor(spec.failureConstructAtk ?? 0));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const consumed = combat.player.constructs.length;
    if (consumed <= 0) {
      if (this.emptyPenaltyTrueDamage > 0) {
        combatSystem.applyDamage(state, {
          amount: this.emptyPenaltyTrueDamage,
          sourceType: 'system',
          sourceId: 'fusion_backlash',
          targetType: 'player',
          targetId: 'player',
          modifiers: [],
          isTrueDamage: true,
          ignoreBlock: true
        });
      }
      const failedId = stateRandomId(state, 'construct');
      combat.player.constructs = [{
        id: failedId,
        name: 'Malformed Stitchwork',
        hp: this.failureConstructHp,
        maxHp: this.failureConstructHp,
        atk: this.failureConstructAtk,
        taunt: true,
        overflowDamageToPlayer: true
      }];
      combat.warpPulse = {
        text: `巨构熔接失败：血肉补料 ${this.emptyPenaltyTrueDamage}，生成失败品 ${this.failureConstructHp}/${this.failureConstructAtk}`,
        tone: 'danger'
      };
      globalEventBus.publish({
        type: 'ConstructCreated',
        constructId: failedId,
        name: 'Malformed Stitchwork'
      });
      return;
    }

    const hp = Math.max(1, this.baseHp + consumed * this.hpPerConstruct);
    const atk = Math.max(0, this.baseAtk + consumed * this.atkPerConstruct);
    const id = stateRandomId(state, 'construct');

    combat.player.constructs = [{
      id,
      name: 'Mega Construct',
      hp,
      maxHp: hp,
      atk,
      taunt: true
    }];

    combat.warpPulse = {
      text: `巨构熔接：吞并 ${consumed} 构造体，生成 ${hp}/${atk} 巨构体`,
      tone: 'warp'
    };

    globalEventBus.publish({
      type: 'ConstructCreated',
      constructId: id,
      name: 'Mega Construct'
    });
  }
}

export class BuffConstructsAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    combat.player.constructs.forEach(c => {
      c.atk += this.amount;
    });
  }
}

export class ConstructOverdriveAction extends BaseAction {
  private multiplier: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.multiplier = Math.max(1, Math.floor(spec.multiplier || spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const aliveEnemies = TargetingService.getAliveEnemies(state);
    if (aliveEnemies.length === 0) return;

    combat.player.constructs.forEach(c => {
      const target = stateRandomChoice(state, aliveEnemies);
      if (!target) return;

      const damageContext: DamageContext = {
        amount: c.atk * this.multiplier,
        sourceType: 'player',
        sourceId: 'player',
        targetType: 'enemy',
        targetId: target.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false
      };

      combatSystem.applyDamage(state, damageContext);
    });

    combat.player.constructs = [];
  }
}

export class ConditionalSummonBonusAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat || !evaluateActionCondition(state, this.context, this.spec.condition)) return;
    const construct = combat.player.constructs[combat.player.constructs.length - 1];
    if (!construct) return;
    construct.atk += Math.max(0, Math.floor(Number((this.spec as any).attack || this.spec.atk || 0)));
    const hpBonus = Math.max(0, Math.floor(Number(this.spec.hp || 0)));
    if (hpBonus > 0) {
      construct.maxHp += hpBonus;
      construct.hp += hpBonus;
    }
  }
}

export class PuppetAttackAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat || combat.player.constructs.length === 0) return;
    const aliveEnemies = TargetingService.getAliveEnemies(state);
    if (aliveEnemies.length === 0) return;
    const amount = Math.max(1, Math.floor(Number(this.spec.amount || (this.spec as any).damage || 1)));
    for (const puppet of combat.player.constructs) {
      const target = this.context.targetId
        ? aliveEnemies.find((enemy) => enemy.id === this.context.targetId) ?? stateRandomChoice(state, aliveEnemies)
        : stateRandomChoice(state, aliveEnemies);
      if (!target) continue;
      combatSystem.applyDamage(state, {
        amount,
        sourceType: 'player',
        sourceId: puppet.id,
        targetType: 'enemy',
        targetId: target.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false,
      });
    }
  }
}

export class PuppetBuffAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat) return;
    const hpBonus = Math.max(0, Math.floor(Number((this.spec as any).block || this.spec.hp || 0)));
    const attackBonus = Math.max(0, Math.floor(Number((this.spec as any).attack || this.spec.atk || 0)));
    for (const puppet of combat.player.constructs) {
      puppet.maxHp += hpBonus;
      puppet.hp += hpBonus;
      puppet.atk += attackBonus;
    }
  }
}

export class SacrificeAllPuppetsAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat || combat.player.constructs.length === 0) return;
    const aliveEnemies = TargetingService.getAliveEnemies(state);
    if (aliveEnemies.length === 0) return;
    const damage = Math.max(1, Math.floor(Number((this.spec as any).damage || this.spec.amount || 1)));
    for (const puppet of combat.player.constructs) {
      const target = stateRandomChoice(state, aliveEnemies);
      if (!target) continue;
      combatSystem.applyDamage(state, {
        amount: damage,
        sourceType: 'player',
        sourceId: puppet.id,
        targetType: 'enemy',
        targetId: target.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false,
      });
    }
    combat.player.constructs = [];
  }
}

export class TriggerOnPuppetDeathAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const effect = (this.spec as any).effect;
    if (effect?.type === 'Draw') {
      queueActionSpecs(queue, [{ type: 'Draw', amount: Math.max(1, Number(effect.amount || 1)), target: 'Self' }], this.context);
    }
  }
}

export class HealConstructAction extends BaseAction {
  private consumeOtherConstructs: number;
  private constructAtkBonus: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.consumeOtherConstructs = Math.max(0, Math.floor(spec.consumeOtherConstructs || 0));
    this.constructAtkBonus = Math.max(0, Math.floor(spec.constructAtkBonus || 0));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || combat.player.constructs.length === 0) return;

    this.context = this.getContextFromQueue(queue);

    const constructs = combat.player.constructs;
    if (constructs.length === 0) return;
    const targetIndex = constructs.reduce((bestIdx, cur, idx, arr) => {
      if (bestIdx >= arr.length) return idx;
      const best = arr[bestIdx];
      const curMissing = Math.max(0, cur.maxHp - cur.hp);
      const bestMissing = Math.max(0, best.maxHp - best.hp);
      return curMissing > bestMissing ? idx : bestIdx;
    }, 0);
    const target = targetIndex < constructs.length ? constructs[targetIndex] : undefined;
    if (!target) return;

    if (this.consumeOtherConstructs > 0) {
      const availableOthers = constructs.length - 1;
      if (availableOthers < this.consumeOtherConstructs) {
        combat.warpPulse = { text: '核心重构失败：缺少可拆解的其他构造体', tone: 'danger' };
        return;
      }
      let toConsume = this.consumeOtherConstructs;
      for (let i = constructs.length - 1; i >= 0 && toConsume > 0; i -= 1) {
        if (i === targetIndex) continue;
        const [removed] = constructs.splice(i, 1);
        if (removed) {
          globalEventBus.publish({ type: 'ConstructDestroyed', constructId: removed.id, data: { constructId: removed.id } });
          toConsume -= 1;
        }
      }
    }

    target.hp = target.maxHp;
    if (this.constructAtkBonus > 0) {
      target.atk += this.constructAtkBonus;
    }
    const attackSuffix = this.constructAtkBonus > 0 ? `，攻击 +${this.constructAtkBonus}` : '';
    combat.warpPulse = {
      text: `核心重构完成：${target.name} 修复至满值${attackSuffix}`,
      tone: 'faith'
    };
  }
}

export class AddRandomElementAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const elements = ['Fire', 'Frost', 'Lightning', 'Acid', 'Arcane'];
    for (let i = 0; i < this.amount; i++) {
      combat.player.elements.push(elements[stateRandomInt(state, elements.length)]);
    }
    const player = combat.player as typeof combat.player & { elementsAddedThisTurn?: number };
    player.elementsAddedThisTurn = Math.max(0, Math.floor(player.elementsAddedThisTurn || 0)) + this.amount;
  }
}

export class AddElementAction extends BaseAction {
  private element: string;

  constructor(spec: ActionSpec) {
    super(spec);
    this.element = spec.element || '';
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || !this.element) return;

    this.context = this.getContextFromQueue(queue);

    combat.player.elements.push(this.element);
    const player = combat.player as typeof combat.player & { elementsAddedThisTurn?: number };
    player.elementsAddedThisTurn = Math.max(0, Math.floor(player.elementsAddedThisTurn || 0)) + 1;
  }
}

export class TriggerReactionsAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const uniqueElements = new Set(combat.player.elements);
    const aliveEnemies = TargetingService.getAliveEnemies(state);

    if (uniqueElements.has('Fire') && uniqueElements.has('Acid')) {
      aliveEnemies.forEach(e => {
        combatSystem.applyStatus(state, 'enemy', e.id, 'Burn', 6);
      });
    }

    if (uniqueElements.has('Frost') && uniqueElements.has('Lightning')) {
      aliveEnemies.forEach(e => {
        combatSystem.applyStatus(state, 'enemy', e.id, 'Weak', 2);
      });
    }

    if (uniqueElements.has('Fire') && uniqueElements.has('Lightning')) {
      aliveEnemies.forEach(e => {
        const damageContext: DamageContext = {
          amount: 12,
          sourceType: 'player',
          sourceId: 'player',
          targetType: 'enemy',
          targetId: e.id,
          modifiers: [],
          isTrueDamage: false,
          ignoreBlock: false
        };
        combatSystem.applyDamage(state, damageContext);
      });
    }

    combat.player.elements = [];
  }
}

export class TransmuteElementsAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const healPerElement = Math.max(1, this.spec.amount || 2);
    const heal = combat.player.elements.length * healPerElement;
    combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + heal);
    state.player.hp = combat.player.hp;
    combat.player.elements = [];
  }
}

export class EmergencyBlockAction extends BaseAction {
  private bonus: number;
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.bonus = spec.bonus || 0;
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const blockGain = combat.player.hp < combat.player.maxHp * 0.3 ? this.bonus : this.amount;
    combatSystem.gainBlock(state, 'player', 'player', blockGain);
  }
}

export class ReviveAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const healAmount = Math.max(0, Math.floor(combat.player.damageTakenLastTurn || 0));
    if (healAmount <= 0) {
      combat.warpPulse = { text: '时序回溯未捕获到可恢复的伤势', tone: 'neutral' };
      return;
    }
    combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + healAmount);
    state.player.hp = combat.player.hp;
    combat.warpPulse = { text: `时序回溯：恢复上回合损失的 ${healAmount} 点生命`, tone: 'faith' };
  }
}

export class ReturnLastCardAction extends BaseAction {
  private costModifier: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.costModifier = spec.costModifier || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || !combat.player.lastPlayedCard) return;

    this.context = this.getContextFromQueue(queue);

    if (!combat.player.lastPlayedCard) return;
    const returnedCard = deriveRunCardInstance({
      ...normalizeRunCardInstance(combat.player.lastPlayedCard, () => stateRandomId(state, 'returned_card')),
      instanceId: stateRandomId(state, 'returned_card'),
      tempCost: this.costModifier,
    });
    combat.hand.push(returnedCard);
  }
}

export class DoubleStatusAction extends BaseAction {
  private target: CardTarget;
  private status: string;

  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Enemy';
    this.status = spec.status || '';
  }

  execute(state: GameState, queue: ActionQueue): void {
    if (!this.status) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    targets.forEach(targetInfo => {
      if (targetInfo.entity.hp <= 0) return;

      const currentAmount = targetInfo.entity.statuses[this.status] || 0;
      if (currentAmount > 0) {
        combatSystem.applyStatus(
          state,
          targetInfo.type,
          targetInfo.id,
          this.status,
          currentAmount
        );
      }
    });
  }
}

export class GainDevotionAction extends BaseAction {
  private target: CardTarget;
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Self';
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    targets.forEach(targetInfo => {
      targetInfo.entity.devotion = Math.min(100, (targetInfo.entity.devotion || 0) + this.amount);
      globalEventBus.publish({
        type: 'AxisChanged',
        axis: 'devotion',
        amount: this.amount,
        targetType: targetInfo.type,
        targetId: targetInfo.id
      });
    });
  }
}

export class GainCorruptionAxisAction extends BaseAction {
  private target: CardTarget;
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Self';
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    targets.forEach(targetInfo => {
      targetInfo.entity.corruptionAxis = Math.min(100, (targetInfo.entity.corruptionAxis || 0) + this.amount);
      globalEventBus.publish({
        type: 'AxisChanged',
        axis: 'corruption',
        amount: this.amount,
        targetType: targetInfo.type,
        targetId: targetInfo.id
      });
    });
  }
}

export class GainCorruptionAction extends BaseAction {
  private target: CardTarget;
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Self';
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    targets.forEach(targetInfo => {
      if (targetInfo.type === 'player') {
        state.player.corruption = Math.min(100, Math.max(0, (state.player.corruption || 0) + this.amount));
        combat.player.corruptionAxis = Math.min(100, Math.max(0, (combat.player.corruptionAxis || 0) + this.amount));
      } else {
        targetInfo.entity.corruptionAxis = Math.min(100, Math.max(0, (targetInfo.entity.corruptionAxis || 0) + this.amount));
      }
      globalEventBus.publish({
        type: 'AxisChanged',
        axis: 'corruption',
        amount: this.amount,
        targetType: targetInfo.type,
        targetId: targetInfo.id
      });
    });
  }
}

export class PurgeFearAndCorruptionAction extends BaseAction {
  private target: CardTarget;
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Self';
    this.amount = spec.amount || 20;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    targets.forEach(targetInfo => {
      if (targetInfo.entity.statuses['Fear']) {
        combatSystem.applyStatus(state, targetInfo.type, targetInfo.id, 'Fear', -targetInfo.entity.statuses['Fear']);
      }
      targetInfo.entity.corruptionAxis = Math.max(0, (targetInfo.entity.corruptionAxis || 0) - this.amount);
    });
  }
}

export class GainIntelAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    gainRouteResource(state, 'intel', this.amount);
    if (state.combat) {
      state.combat.warpPulse = { text: `情报 +${this.amount}（当前 ${state.player.intel}）`, tone: 'faith' };
    }
  }
}

export class SpendIntelAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const before = state.player.intel;
    state.player.intel = Math.max(0, state.player.intel - this.amount);
    if (before > state.player.intel) markResourceSpent(state, 'intel', before - state.player.intel);
    if (state.combat) {
      state.combat.player.intel = state.player.intel;
      state.combat.warpPulse = { text: `情报 -${this.amount}（当前 ${state.player.intel}）`, tone: 'neutral' };
    }
  }
}

export class PredictorAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);

    const shouldAttack = combat.player.block < 8 && combat.player.hp > 12;
    if (shouldAttack) {
      const ctx: DamageContext = {
        amount: 8,
        sourceType: 'enemy',
        sourceId: this.context.sourceId || this.context.source || 'enemy',
        targetType: 'player',
        targetId: 'player',
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false
      };
      combatSystem.applyDamage(state, ctx);
      return;
    }

    const sourceId = this.context.sourceId || this.context.source;
    if (typeof sourceId === 'string') {
      const selfEnemy = combat.enemies.find(e => e.id === sourceId);
      if (selfEnemy && selfEnemy.hp > 0) {
        combatSystem.gainBlock(state, 'enemy', selfEnemy.id, 10);
      }
    }
  }
}

export class RedirectIntentAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, 'Enemy');
    const targetEnemy = targets.find(t => t.type === 'enemy')?.entity as NonNullable<GameState['combat']>['enemies'][number] | undefined;
    if (!targetEnemy) return;

    const def = getEnemyDefById(targetEnemy.defId);
    const intents = Array.isArray(def?.intent_policy) ? def.intent_policy.map((policy) => policy.intent).filter(Boolean) : [];
    const alternatives = intents.filter((intent) => intent !== targetEnemy.nextIntent);
    const nextIntent = stateRandomChoice(state, alternatives.length > 0 ? alternatives : intents);
    if (!nextIntent) return;

    targetEnemy.nextIntent = nextIntent;
    if (combat) {
      combat.warpPulse = {
        text: `${targetEnemy.name} 的意图被改写为 ${nextIntent}`,
        tone: 'faith'
      };
    }
  }
}

export class MutateCardAction extends BaseAction {
  private mutateTo: string;

  constructor(spec: ActionSpec) {
    super(spec);
    this.mutateTo = String((spec as { mutateTo?: string }).mutateTo || '');
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || !this.mutateTo) return;
    const targetCard = getCardDefById(this.mutateTo);
    if (!targetCard) return;

    const clone: RunCardInstance = createRunCardInstance(targetCard, stateRandomId(state, 'mutate'));
    combat.discardPile.push(clone);
    state.player.deck.push(clone);
    combat.warpPulse = {
      text: `${this.context.card?.name || '一张牌'}蜕变为 ${targetCard.name}`,
      tone: 'warp'
    };
  }
}

export class EmperorMercyAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);

    const player = combat.player;
    if (player.statuses['Fear']) delete player.statuses['Fear'];
    if (player.statuses['Corruption']) delete player.statuses['Corruption'];
    player.hp = Math.min(player.maxHp, player.hp + 5);
    state.player.hp = player.hp;
  }
}

export class PurgeEnemyBuffsAction extends BaseAction {
  private zealPerBuff: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.zealPerBuff = spec.zealPerBuff || 3;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targetId = this.context.targetId;

    if (!targetId) return;

    const target = combat.enemies.find(e => e.id === targetId);
    if (!target || !target.statuses) return;

    const buffStatuses = ['Strength', 'Artifact', 'Regen', 'Barricade', 'Intangible', 'Buffer'];
    let buffsRemoved = 0;

    for (const buff of buffStatuses) {
      if (target.statuses[buff]) {
        delete target.statuses[buff];
        buffsRemoved++;
      }
    }

    if (buffsRemoved > 0) {
      const zealGained = buffsRemoved * this.zealPerBuff;
      if (!combat.player.statuses) combat.player.statuses = {};
      const currentZeal = (combat.player.statuses['Zeal'] as number) || 0;
      combat.player.statuses['Zeal'] = currentZeal + zealGained;
      combat.warpPulse = {
        text: `净除 ${buffsRemoved} 项增益，获得 ${zealGained} 点狂热`,
        tone: 'faith'
      };
    }
  }
}

export class PrecisionThrowDamageAction extends BaseAction {
  private amount: number;
  private bonus: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 6;
    this.bonus = spec.bonus || 9;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targetId = this.context.targetId;

    if (!targetId) return;

    const target = combat.enemies.find(e => e.id === targetId);
    if (!target) return;

    const hasVulnerable = target.statuses && target.statuses['Vulnerable'];
    const damage = hasVulnerable ? this.amount + this.bonus : this.amount;

    const damageContext: DamageContext = {
      amount: damage,
      sourceType: 'player',
      sourceId: 'player',
      targetType: 'enemy',
      targetId: targetId,
      modifiers: [],
      isTrueDamage: false,
      ignoreBlock: false
    };

    combatSystem.applyDamage(state, damageContext);
    combat.warpPulse = {
      text: hasVulnerable ? `精准投掷命中易伤目标，造成 ${damage} 点伤害。` : `精准投掷造成 ${damage} 点伤害。`,
      tone: 'neutral'
    };
  }
}

export class ForceEnemyAttackAction extends BaseAction {
  private damage: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.damage = spec.amount || 5;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length < 2) return;

    const attacker = aliveEnemies[0];
    const target = aliveEnemies[1];

    const damageContext: DamageContext = {
      amount: this.damage,
      sourceType: 'enemy',
      sourceId: attacker.id,
      targetType: 'enemy',
      targetId: target.id,
      modifiers: [],
      isTrueDamage: true,
      ignoreBlock: true
    };

    combatSystem.applyDamage(state, damageContext);
    combat.warpPulse = {
      text: `${attacker.name || attacker.id} 强制攻击 ${target.name || target.id}。`,
      tone: 'danger'
    };
  }
}

export class SolventDamageAction extends BaseAction {
  private amount: number;
  private target: CardTarget;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 3;
    this.target = (spec.target as CardTarget) || 'Enemy';
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    if (this.target === 'AllEnemies') {
      const targets = this.resolveTargets(state, 'AllEnemies').filter((targetInfo) => targetInfo.type === 'enemy');
      targets.forEach((targetInfo) => {
        const block = targetInfo.entity.block || 0;
        combatSystem.applyDamage(state, {
          amount: this.amount + Math.floor(block / 2),
          sourceType: 'player',
          sourceId: 'player',
          targetType: 'enemy',
          targetId: targetInfo.id,
          modifiers: [],
          isTrueDamage: false,
          ignoreBlock: false
        });
      });
      return;
    }

    const targetId = this.context.targetId;

    if (!targetId) return;

    const target = combat.enemies.find(e => e.id === targetId);
    if (!target) return;

    const block = target.block || 0;
    const damage = this.amount + Math.floor(block / 2);

    const damageContext: DamageContext = {
      amount: damage,
      sourceType: 'player',
      sourceId: 'player',
      targetType: 'enemy',
      targetId: targetId,
      modifiers: [],
      isTrueDamage: false,
      ignoreBlock: false
    };

    combatSystem.applyDamage(state, damageContext);
    combat.warpPulse = {
      text: `溶解剂造成 ${damage} 点伤害（护盾转化加成 ${Math.floor(block / 2)}）。`,
      tone: 'neutral'
    };
  }
}

export class TriggerPoisonOnTargetAction extends BaseAction {
  private target: CardTarget;

  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Enemy';
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    for (const targetInfo of targets) {
      const poisonAmount = targetInfo.entity.statuses['Poison'] || 0;

      if (poisonAmount > 0) {
        const damageContext: DamageContext = {
          amount: poisonAmount,
          sourceType: 'system',
          sourceId: 'poison_trigger',
          targetType: targetInfo.type,
          targetId: targetInfo.id,
          modifiers: [],
          isTrueDamage: true,
          ignoreBlock: true
        };
        const actualDamage = combatSystem.applyDamage(state, damageContext);
        targetInfo.entity.statuses['Poison'] = 0;

        combat.warpPulse = {
          text: `毒蚀爆发：造成 ${actualDamage} 点伤害。`,
          tone: 'danger'
        };
      }
    }
  }
}

export class TriggerPoisonAllEnemiesAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, 'AllEnemies');

    for (const targetInfo of targets) {
      const poisonAmount = targetInfo.entity.statuses.Poison || 0;
      if (poisonAmount <= 0) continue;

      combatSystem.applyDamage(state, {
        amount: poisonAmount,
        sourceType: 'system',
        sourceId: 'poison_trigger_all',
        targetType: targetInfo.type,
        targetId: targetInfo.id,
        modifiers: [],
        isTrueDamage: true,
        ignoreBlock: true,
      });
      delete targetInfo.entity.statuses.Poison;
    }
  }
}

export class DealDamagePiercingAction extends BaseAction {
  private amount: number;
  private armorIgnore: number;
  private target: CardTarget;

  constructor(spec: ActionSpec & { armorIgnore?: number }) {
    super(spec);
    this.amount = spec.amount || 0;
    this.armorIgnore = Math.max(0, Number(spec.armorIgnore || spec.amount || 0));
    this.target = (spec.target as CardTarget) || 'Enemy';
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    for (const targetInfo of targets) {
      if (targetInfo.type !== 'enemy' || targetInfo.entity.hp <= 0) continue;
      const piercingAmount = Math.min(this.amount, this.armorIgnore);
      const normalAmount = Math.max(0, this.amount - piercingAmount);

      if (piercingAmount > 0) {
        combatSystem.applyDamage(state, {
          amount: piercingAmount,
          sourceType: 'player',
          sourceId: 'player',
          targetType: 'enemy',
          targetId: targetInfo.id,
          modifiers: [],
          isTrueDamage: false,
          ignoreBlock: true,
        });
      }

      if (normalAmount > 0) {
        combatSystem.applyDamage(state, {
          amount: normalAmount,
          sourceType: 'player',
          sourceId: 'player',
          targetType: 'enemy',
          targetId: targetInfo.id,
          modifiers: [],
          isTrueDamage: false,
          ignoreBlock: false,
        });
      }
    }
  }
}

export class IgnoreBlockAction extends BaseAction {
  private amount: number;
  private target: CardTarget;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(0, Number(spec.amount || 0));
    this.target = (spec.target as CardTarget) || 'Enemy';
  }

  execute(state: GameState, queue: ActionQueue): void {
    if (this.amount <= 0) return;
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);
    for (const targetInfo of targets) {
      if (targetInfo.type !== 'enemy') continue;
      combatSystem.applyDamage(state, {
        amount: this.amount,
        sourceType: 'player',
        sourceId: 'player',
        targetType: 'enemy',
        targetId: targetInfo.id,
        modifiers: [],
        isTrueDamage: true,
        ignoreBlock: true,
      });
    }
  }
}

export class ExtendDurationAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    const newestConstruct = combat.player.constructs[combat.player.constructs.length - 1] as Record<string, unknown> | undefined;
    if (newestConstruct) {
      newestConstruct.duration = Math.max(0, Number(newestConstruct.duration || 0)) + this.amount;
      return;
    }
    combat.player.statuses.ExtendNextSummonDuration = Math.max(0, Number(combat.player.statuses.ExtendNextSummonDuration || 0)) + this.amount;
  }
}

export class RemoveStatusAction extends BaseAction {
  private target: CardTarget;
  private statuses: string[];
  private amount: number;

  constructor(spec: ActionSpec & Record<string, unknown>) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Enemy';
    this.statuses = Array.isArray(spec.status) ? spec.status.map(String) : [String(spec.status || '')].filter(Boolean);
    this.amount = Math.max(1, Number(spec.amount || spec.stacks || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    if (this.statuses.length === 0) return;
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);
    for (const targetInfo of targets) {
      removeStacksFromStatuses(targetInfo.entity.statuses || {}, this.statuses, this.amount);
    }
  }
}

export class RemoveAnyDebuffAction extends BaseAction {
  private target: CardTarget;
  private amount: number;

  constructor(spec: ActionSpec & { debuffs?: string[] }) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Self';
    this.amount = Math.max(1, Number(spec.amount || spec.stacks || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);
    const debuffs = Array.isArray((this.spec as ActionSpec & { debuffs?: string[] }).debuffs)
      ? (this.spec as ActionSpec & { debuffs?: string[] }).debuffs!
      : DEBUFF_STATUSES;
    for (const targetInfo of targets) {
      removeStacksFromStatuses(targetInfo.entity.statuses || {}, debuffs, this.amount);
    }
  }
}

export class RemoveSelfDebuffAction extends RemoveAnyDebuffAction {
  constructor(spec: ActionSpec) {
    super({ ...spec, target: 'Self', amount: spec.amount || spec.stacks || 1 });
  }
}

export class RemovePoisonAndDealDamageAction extends BaseAction {
  private target: CardTarget;
  private maxPoisonRemoval: number;
  private damagePerPoison: number;

  constructor(spec: ActionSpec & { maxPoisonRemoval?: number; damagePerPoison?: number }) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Enemy';
    this.maxPoisonRemoval = Math.max(1, Number(spec.maxPoisonRemoval || spec.amount || 1));
    this.damagePerPoison = Math.max(1, Number(spec.damagePerPoison || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);
    for (const targetInfo of targets) {
      if (targetInfo.type !== 'enemy') continue;
      const poison = Math.max(0, Math.floor(Number(targetInfo.entity.statuses.Poison || 0)));
      const removed = Math.min(poison, this.maxPoisonRemoval);
      if (removed <= 0) continue;
      const nextPoison = poison - removed;
      if (nextPoison > 0) targetInfo.entity.statuses.Poison = nextPoison;
      else delete targetInfo.entity.statuses.Poison;
      combatSystem.applyDamage(state, {
        amount: removed * this.damagePerPoison,
        sourceType: 'player',
        sourceId: 'player',
        targetType: 'enemy',
        targetId: targetInfo.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false,
      });
    }
  }
}

export class ReplayLastCardAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const replayCard = findPreviousPlayedCard(state, this.context);
    if (!replayCard) return;
    const actions = replayCard.actions.filter(action => action.type !== 'ReplayLastCard');
    if (actions.length === 0) return;
    queueActionSpecs(queue, actions, {
      ...this.context,
      card: replayCard,
      cardId: replayCard.id,
      cardInstanceId: replayCard.instanceId,
    });
  }
}

export class ScryAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    const player = combat.player as typeof combat.player & { scryPreview?: string[] };
    player.scryPreview = combat.drawPile.slice(-this.amount).map(card => card.id);
    combat.warpPulse = { text: `Scry ${player.scryPreview.length}`, tone: 'warp' };
  }
}

export class CopyLeftmostSkillAction extends BaseAction {
  private percent: number;

  constructor(spec: ActionSpec & { effectPercent?: number }) {
    super(spec);
    this.percent = Math.max(1, Math.min(100, Number(spec.effectPercent || 50)));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    const currentInstanceId = this.context.cardInstanceId;
    const source = combat.hand.find(card => card.instanceId !== currentInstanceId && card.type === 'Skill');
    if (!source) return;

    const normalized = normalizeRunCardInstance(source, () => stateRandomId(state, 'copied_skill_source'));
    const runtimeBase = {
      ...normalized.runtimeBase,
      actions: scaleActionSpecs(normalized.actions, this.percent),
      text: `${normalized.runtimeBase.text} (${this.percent}% copy)`,
    };
    combat.hand.unshift(deriveRunCardInstance({
      ...normalized,
      instanceId: stateRandomId(state, 'copied_skill'),
      runtimeBase,
      tempCost: normalized.tempCost,
    }));
  }
}

export class DelayedEnergyAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    combat.player.statuses.DelayedEnergy = Math.max(0, Number(combat.player.statuses.DelayedEnergy || 0)) + this.amount;
  }
}

export class ResourceRefundAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    const player = combat.player as typeof combat.player & { resourceRefundPending?: number };
    player.resourceRefundPending = Math.max(player.resourceRefundPending || 0, this.amount);
  }
}

export class ConditionalResourceGainAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;

    const resource = this.spec.resource === 'random'
      ? stateRandomChoice(state, [...ROUTE_RESOURCES])
      : String(this.spec.resource || '');
    const amount = Math.max(1, Number(this.spec.amount || 1));
    if (!resource) return;
    gainRouteResource(state, resource, amount);
  }
}

export class ConditionalEffectAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    if (!evaluateActionCondition(state, this.context, this.spec.condition)) return;
    const actions = collectSpecActions(this.spec as ActionSpec & Record<string, unknown>, 'effects');
    queueActionSpecs(queue, actions, this.context);
  }
}

export class NextAttackCostDownAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    if (reduceHandCardCost(state, this.amount, card => card.type === 'Attack')) return;
    combat.player.statuses.NextAttackCostDown = Math.max(0, Number(combat.player.statuses.NextAttackCostDown || 0)) + this.amount;
  }
}

export class NextCardCostDownAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const combat = state.combat;
    if (!combat) return;
    if (reduceHandCardCost(state, this.amount, () => true)) return;
    combat.player.statuses.NextCardCostDown = Math.max(0, Number(combat.player.statuses.NextCardCostDown || 0)) + this.amount;
  }
}

export class ModifyNextCardCostAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Math.abs(Number(spec.amount || 1)));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    if (reduceHandCardCost(state, this.amount, () => true)) return;
    combat.player.statuses.NextCardCostDown = Math.max(0, Number(combat.player.statuses.NextCardCostDown || 0)) + this.amount;
  }
}

export class DelayNextCardEffectAction extends BaseAction {
  private percent: number;

  constructor(spec: ActionSpec & { percent?: number }) {
    super(spec);
    this.percent = Math.max(1, Math.min(100, Number(spec.percent || 50)));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    combat.player.statuses.DelayNextCardEffectPercent = this.percent;
  }
}

export class EndOfTurnDrawPenaltyAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = Math.max(1, Number(spec.amount || 1));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    combat.player.statuses.DrawPenaltyNextTurn = Math.max(0, Number(combat.player.statuses.DrawPenaltyNextTurn || 0)) + this.amount;
  }
}

export class SelectCardForReplayAction extends BaseAction {
  private turns: number;
  private costReduction: number;

  constructor(spec: ActionSpec & { costReduction?: number }) {
    super(spec);
    this.turns = Math.max(1, Number(spec.turns || 1));
    this.costReduction = Math.max(0, Number(spec.costReduction || 0));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    const replayCard = findPreviousPlayedCard(state, this.context);
    if (!replayCard) return;
    const adjustedCard = this.costReduction > 0
      ? deriveRunCardInstance({ ...normalizeRunCardInstance(replayCard, () => stateRandomId(state, 'selected_replay_source')), tempCost: 0 })
      : replayCard;
    combat.player.delayedCards.push({
      card: createDelayedReplayCard(state, adjustedCard, this.turns, 100),
      turns: this.turns,
      targetId: this.context.targetId,
    });
  }
}

export class StartOfTurnEffectAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const actions = collectSpecActions(this.spec as ActionSpec & Record<string, unknown>, 'effect');
    storeActionList(state, 'startOfTurnEffects', actions, (this.spec as ActionSpec & { trigger?: unknown }).trigger);
    if (state.combat) {
      const triggerType = String((this.spec as ActionSpec & { trigger?: { type?: string } }).trigger?.type || 'StartOfTurnEffect');
      state.combat.player.statuses[`Watcher:${triggerType}`] = 1;
    }
  }
}

export class EndOfTurnEffectAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const actions = collectSpecActions(this.spec as ActionSpec & Record<string, unknown>, 'effect');
    storeActionList(state, 'endOfTurnEffects', actions);
  }
}

export class EndOfCombatEffectAction extends BaseAction {
  execute(state: GameState, queue: ActionQueue): void {
    this.context = this.getContextFromQueue(queue);
    const actions = collectSpecActions(this.spec as ActionSpec & Record<string, unknown>, 'effect');
    storeActionList(state, 'endOfCombatEffects', actions);
  }
}

export class MultiplyDamageAction extends BaseAction {
  private multiplier: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.multiplier = Math.max(1, Number(spec.amount || spec.multiplier || 2));
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;
    this.context = this.getContextFromQueue(queue);
    combat.player.statuses.DoubleDamageThisTurn = Math.max(
      Number(combat.player.statuses.DoubleDamageThisTurn || 1),
      this.multiplier
    );
  }
}

export class GainTimeLayerAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    gainRouteResource(state, 'timeLayer', this.amount);
    combat.warpPulse = { text: `时间层 +${this.amount}（当前 ${combat.player.timeLayer}）`, tone: 'warp' };
  }
}

export class SpendTimeLayerAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const before = combat.player.timeLayer || 0;
    combat.player.timeLayer = Math.max(0, before - this.amount);
    if (before > combat.player.timeLayer) markResourceSpent(state, 'timeLayer', before - combat.player.timeLayer);
    combat.warpPulse = { text: `时间层 -${this.amount}（当前 ${combat.player.timeLayer}）`, tone: 'neutral' };
  }
}

export class GainThreadAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    gainRouteResource(state, 'thread', this.amount);
    combat.warpPulse = { text: `丝线 +${this.amount}（当前 ${combat.player.thread}）`, tone: 'faith' };
  }
}

export class SpendThreadAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const before = combat.player.thread || 0;
    combat.player.thread = Math.max(0, before - this.amount);
    if (before > combat.player.thread) markResourceSpent(state, 'thread', before - combat.player.thread);
    combat.warpPulse = { text: `丝线 -${this.amount}（当前 ${combat.player.thread}）`, tone: 'neutral' };
  }
}

export class GainConcoctionAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    gainRouteResource(state, 'concoction', this.amount);
    combat.warpPulse = { text: `调配 +${this.amount}（当前 ${combat.player.concoction}）`, tone: 'faith' };
  }
}

export class SpendConcoctionAction extends BaseAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const before = combat.player.concoction || 0;
    combat.player.concoction = Math.max(0, before - this.amount);
    if (before > combat.player.concoction) markResourceSpent(state, 'concoction', before - combat.player.concoction);
    combat.warpPulse = { text: `调配 -${this.amount}（当前 ${combat.player.concoction}）`, tone: 'neutral' };
  }
}

export class SpendAllIntelAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const intelSpent = state.player.intel || 0;
    state.player.intel = 0;
    if (intelSpent > 0) markResourceSpent(state, 'intel', intelSpent);
    combat.warpPulse = { text: `情报消耗 ${intelSpent}`, tone: 'neutral' };
  }
}

export class SpendAllConcoctionAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const concoctionSpent = combat.player.concoction || 0;
    combat.player.concoction = 0;
    if (concoctionSpent > 0) markResourceSpent(state, 'concoction', concoctionSpent);
    combat.warpPulse = { text: `调配消耗 ${concoctionSpent}`, tone: 'neutral' };
  }
}

export class RewindCombatStateAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    combat.player.hp = combat.player.maxHp;
    combat.player.block = 0;
    combat.player.statuses = {};
    combat.warpPulse = { text: '时间回溯：状态重置', tone: 'warp' };
  }
}

export class BindEnemySoulAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targetId = this.context.targetId;
    const enemy = combat.enemies.find(e => e.id === targetId);
    if (!enemy || enemy.hp > 0) return;

    const enemyWithBaseDamage = enemy as typeof enemy & { baseDamage?: number };
    const construct = {
      id: `soulbound_${enemy.id}_${Date.now()}`,
      name: `${enemy.name}之魂`,
      hp: Math.floor(enemy.maxHp * 0.5),
      maxHp: Math.floor(enemy.maxHp * 0.5),
      atk: Math.floor(enemyWithBaseDamage.baseDamage || 5),
      taunt: false
    };

    combat.player.constructs = combat.player.constructs || [];
    combat.player.constructs.push(construct);
    combat.warpPulse = { text: `灵魂绑定：${construct.name}`, tone: 'faith' };
  }
}

export class CreateConstructAction extends BaseAction {
  private name: string;
  private hp: number;
  private atk: number;
  private taunt: boolean;

  constructor(spec: ActionSpec) {
    super(spec);
    this.name = spec.name || '构造体';
    this.hp = spec.hp || 10;
    this.atk = spec.atk || 6;
    this.taunt = spec.taunt || false;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const construct = {
      id: `construct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: this.name,
      hp: this.hp,
      maxHp: this.hp,
      atk: this.atk,
      taunt: this.taunt
    };

    combat.player.constructs = combat.player.constructs || [];
    combat.player.constructs.push(construct);
    combat.warpPulse = { text: `创建构造体：${this.name}`, tone: 'faith' };
  }
}

export class BuffAllConstructsAction extends BaseAction {
  private hpBonus: number;
  private atkBonus: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.hpBonus = spec.hpBonus || 0;
    this.atkBonus = spec.atkBonus || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || !combat.player.constructs) return;

    this.context = this.getContextFromQueue(queue);
    combat.player.constructs.forEach(c => {
      c.maxHp += this.hpBonus;
      c.hp = Math.min(c.hp + this.hpBonus, c.maxHp);
      c.atk += this.atkBonus;
    });
    combat.warpPulse = { text: `构造体强化：生命 +${this.hpBonus}，攻击 +${this.atkBonus}`, tone: 'faith' };
  }
}

export class TriggerAllReactionsAction extends BaseAction {
  private times: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.times = spec.times || 1;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const elements = combat.player.elements || [];
    if (elements.length < 2) return;

    const uniqueElements = new Set(elements).size;
    let totalDamage = 0;
    for (let i = 0; i < this.times; i++) {
      totalDamage += elements.length * 4 + Math.max(0, uniqueElements - 1) * 2;
    }

    let totalActualDamage = 0;
    combat.enemies.forEach(enemy => {
      if (enemy.hp > 0) {
        totalActualDamage += combatSystem.applyDamage(state, {
          amount: totalDamage,
          sourceType: 'system',
          sourceId: 'trigger_all_reactions',
          targetType: 'enemy',
          targetId: enemy.id,
          modifiers: [],
          isTrueDamage: false,
          ignoreBlock: false
        });
      }
    });
    combat.warpPulse = { text: `元素反应 ×${this.times}：共造成 ${totalActualDamage} 点伤害`, tone: 'faith' };
  }
}

export class TransformHandToRareAction extends BaseAction {
  constructor(spec: ActionSpec) {
    super(spec);
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    combat.warpPulse = { text: '手牌转化：稀有卡牌', tone: 'warp' };
  }
}
