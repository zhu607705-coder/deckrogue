/**
 * @file relicSystem.ts
 * @description 遗物系统 - 管理遗物效果、触发逻辑与获取机制
 *
 * 主要职责:
 * - 定义遗物效果接口和触发条件
 * - 监听战斗事件并执行对应遗物效果
 * - 处理遗物获取、状态追踪和效果应用
 */
import {
  ActionFactoryV2 as ActionFactory,
  GameEvent,
  GameState,
  combatSystem,
  getActionManager,
  globalEventBus
} from '@/core';
import { relicsData } from '@/content/narrative/numericSystem';
import { cardsData } from '@/content/narrative/numericSystem';
import { stateRandomChoice, stateRandomId, stateRandomInt } from '@/infrastructure/rng/stateRandom';

export interface RelicEffect {
  trigger: string;
  condition?: (state: GameState) => boolean;
  action: (state: GameState, event: GameEvent, enqueueUrgent: any) => void;
}

type RelicDefinition = (typeof relicsData)[number] & {
  priority?: number;
  trigger?: string;
  condition?: any;
  effect?: any;
};

type RelicEnqueue = (actionOrSpec: any, context: any) => void;
type GenericActionSpec = Record<string, any>;

const GENERIC_RELIC_TRIGGER_MAP: Record<string, string> = {
  StartCombat: 'CombatStart',
  EndCombat: 'CombatEnd',
  CombatStart: 'CombatStart',
  CombatEnd: 'CombatEnd',
  StartTurn: 'TurnStart',
  EndTurn: 'TurnEnd',
  StartOfTurn: 'TurnStart',
  EndOfTurn: 'TurnEnd',
  TurnStart: 'TurnStart',
  TurnEnd: 'TurnEnd',
  CardPlayed: 'CardPlayed',
  OnCardPlayed: 'CardPlayed',
  OnPlayCard: 'CardPlayed',
  DamageReceived: 'DamageReceived',
  OnTakeDamage: 'DamageReceived',
  TriggerOnDamageTaken: 'DamageReceived',
  RouteResourceGained: 'RouteResourceGained',
  OnResourceGain: 'RouteResourceGained',
  TriggerOnResourceGain: 'RouteResourceGained',
  OnGainResource: 'RouteResourceGained',
  RouteResourceSpent: 'RouteResourceSpent',
  OnResourceSpent: 'RouteResourceSpent',
  OnSpendResource: 'RouteResourceSpent',
  OnFirstResourceSpend: 'RouteResourceSpent',
  RelicAcquired: 'RelicAcquired',
};

export class RelicSystem {
  private relicEffects: Map<string, RelicEffect[]> = new Map();
  private getState: () => GameState;
  private eventDisposables: Array<() => void> = [];

  constructor(getStateTracker: () => GameState) {
    this.getState = getStateTracker;
    this.initializeRelicEffects();
  }

  public bindStateTracker(getStateTracker: () => GameState): void {
    this.getState = getStateTracker;
    this.setupEventListeners();
  }

  public dispose(): void {
    this.eventDisposables.splice(0).forEach((dispose) => dispose());
  }

  private initializeRelicEffects() {
    this.relicEffects.set('ruined_reactor', [
      {
        trigger: 'TurnStart',
        action: (state, event, enqueueUrgent) => {
          if (!state.combat || !(event as any).playerTurn) return;
          
          const st = (state.player.relicStates['ruined_reactor'] ||= { level: 0, progress: 0, corrupted: true });
          st.progress = (st.progress || 0) + 1;

          const gainEnergy = ActionFactory.createAction({ type: 'GainEnergy', amount: 1 });
          enqueueUrgent(gainEnergy, { source: 'relic_ruined_reactor' });

          if ((st.progress || 0) % 3 === 0) {
            const selfDamage = ActionFactory.createAction({ 
              type: 'DealDamage', 
              amount: 8, 
              target: 'Self',
              trueDamage: true 
            });
            enqueueUrgent(selfDamage, { source: 'relic_ruined_reactor' });
          }
        }
      }
    ]);

    this.relicEffects.set('corrupted_tome', [
      {
        trigger: 'CombatStart',
        action: (state, event, enqueueUrgent) => {
          if (!state.combat) return;
          
          const curses = state.player.deck.filter(c => (c.tags || []).includes('Curse')).length;
          if (curses > 0) {
            const gainEnergy = ActionFactory.createAction({ type: 'GainEnergy', amount: curses });
            enqueueUrgent(gainEnergy, { source: 'relic_corrupted_tome' });

            const applyStrength = ActionFactory.createAction({ 
              type: 'ApplyStatus', 
              status: 'Strength', 
              amount: curses,
              target: 'Self'
            });
            enqueueUrgent(applyStrength, { source: 'relic_corrupted_tome' });
          }
        }
      }
    ]);

    this.relicEffects.set('corrupted_relic', [
      {
        trigger: 'TurnStart',
        action: (state, event, enqueueUrgent) => {
          if (!state.combat || !(event as any).playerTurn) return;

          const applyStrength = ActionFactory.createAction({ 
            type: 'ApplyStatus', 
            status: 'Strength', 
            amount: 2,
            target: 'Self'
          });
          enqueueUrgent(applyStrength, { source: 'relic_corrupted_relic' });

          const gainCorruption = ActionFactory.createAction({ 
            type: 'GainCorruptionAxis', 
            amount: 10,
            target: 'Self'
          });
          enqueueUrgent(gainCorruption, { source: 'relic_corrupted_relic' });
        }
      }
    ]);

    this.relicEffects.set('martyrs_censer', [
      {
        trigger: 'TurnStart',
        action: (state, event, enqueueUrgent) => {
          if (!state.combat || !(event as any).playerTurn) return;
          
          const p = state.combat.player;
          if (p.hp <= p.maxHp * 0.5) {
            const gainDevotion = ActionFactory.createAction({ 
              type: 'GainDevotion', 
              amount: 8,
              target: 'Self'
            });
            enqueueUrgent(gainDevotion, { source: 'relic_martyrs_censer' });

            const removeFear = ActionFactory.createAction({ 
              type: 'ApplyStatus', 
              status: 'Fear', 
              amount: -1,
              target: 'Self'
            });
            enqueueUrgent(removeFear, { source: 'relic_martyrs_censer' });
          }
        }
      }
    ]);

    this.relicEffects.set('burning_blood', [
      {
        trigger: 'CombatEnd',
        action: (state, event, enqueueUrgent) => {
          if (!(event as any).victory) return;
          
          const heal = ActionFactory.createAction({ 
            type: 'Heal', 
            amount: 6,
            target: 'Self'
          });
          enqueueUrgent(heal, { source: 'relic_burning_blood' });
        }
      }
    ]);

    this.relicEffects.set('thorns_armor', [
      {
        trigger: 'DamageReceived',
        action: (state, event, enqueueUrgent) => {
          if ((event as any).sourceType === 'self') return;
          
          const reflectDamage = ActionFactory.createAction({ 
            type: 'DealDamage', 
            amount: 3,
            target: 'AllEnemies'
          });
          enqueueUrgent(reflectDamage, { source: 'relic_thorns_armor' });
        }
      }
    ]);

    this.relicEffects.set('entropy_sanctum_relic', [
      {
        trigger: 'CardPlayed',
        action: (state) => {
          const combat = state.combat;
          if (!combat) return;
          const alive = combat.enemies.filter(e => e.hp > 0);
          const target = stateRandomChoice(state, alive);
          if (!target) return;
          const damage = 2 + stateRandomInt(state, 5); // 2-6
          combatSystem.applyDamage(state, {
            amount: damage,
            sourceType: 'system',
            sourceId: 'entropy_sanctum_relic',
            targetType: 'enemy',
            targetId: target.id,
            modifiers: [],
            isTrueDamage: false,
            ignoreBlock: false
          });
          combat.warpPulse = {
            text: `熵变圣物迸发：随机造成 ${damage} 点伤害`,
            tone: 'warp'
          };
        }
      }
    ]);

    this.relicEffects.set('mortuary_warrant', [
      {
        trigger: 'CombatStart',
        action: (_state, _event, enqueueUrgent) => {
          enqueueUrgent(ActionFactory.createAction({ type: 'GainResource', resource: 'verdict', amount: 1 }), {
            source: 'relic_mortuary_warrant'
          });
        }
      }
    ]);

    this.relicEffects.set('confessor_sigil', [
      {
        trigger: 'CardPlayed',
        action: (_state, event, enqueueUrgent) => {
          const card = cardsData.find((entry) => entry.id === (event as any).cardId);
          if (!card || !(card.tags || []).includes('verdict')) return;
          enqueueUrgent(ActionFactory.createAction({ type: 'GainBlock', amount: 2, target: 'Self' }), {
            source: 'relic_confessor_sigil'
          });
        }
      }
    ]);

    this.relicEffects.set('blackened_gavel', [
      {
        trigger: 'RouteResourceSpent',
        action: (state, event, enqueueUrgent) => {
          if (!state.combat || String((event as any).resource || '') !== 'verdict') return;
          if (!state.combat.enemies.some(enemy => enemy.hp > 0)) return;
          const amount = Math.max(1, Number((event as any).amount || 1)) * 3;
          enqueueUrgent(ActionFactory.createAction({
            type: 'DealDamage',
            amount,
            target: 'RandomEnemy'
          }), {
            source: 'relic_blackened_gavel'
          });
        }
      }
    ]);

    this.relicEffects.set('void_anchor_litany', [
      {
        trigger: 'CombatStart',
        action: (state, _event, enqueueUrgent) => {
          enqueueUrgent(ActionFactory.createAction({ type: 'GainResource', resource: 'seal', amount: 1 }), {
            source: 'relic_void_anchor_litany'
          });
          const target = state.combat ? stateRandomChoice(state, state.combat.enemies.filter(enemy => enemy.hp > 0)) : null;
          if (!target) return;
          combatSystem.applyStatus(state, 'enemy', target.id, 'Weak', 1);
        }
      }
    ]);

    this.relicEffects.set('nullglass_lens', [
      {
        trigger: 'RouteResourceGained',
        action: (_state, event, enqueueUrgent) => {
          if (String((event as any).resource || '') !== 'seal') return;
          const amount = Math.max(1, Number((event as any).amount || 1)) * 2;
          enqueueUrgent(ActionFactory.createAction({ type: 'GainBlock', amount, target: 'Self' }), {
            source: 'relic_nullglass_lens'
          });
        }
      }
    ]);

    this.relicEffects.set('cage_bell_clapper', [
      {
        trigger: 'RouteResourceSpent',
        action: (state, event) => {
          if (!state.combat || String((event as any).resource || '') !== 'seal') return;
          for (const enemy of state.combat.enemies.filter(entry => entry.hp > 0)) {
            combatSystem.applyStatus(state, 'enemy', enemy.id, 'Weak', 1);
          }
        }
      }
    ]);
  }

  private getRelicDefinition(relicId: string): RelicDefinition | undefined {
    return relicsData.find(r => r.id === relicId) as RelicDefinition | undefined;
  }

  private getRelicRegistrationIndex(relicId: string): number {
    const index = relicsData.findIndex(r => r.id === relicId);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  private getRelicPriority(relicId: string): number {
    return Math.floor(Number(this.getRelicDefinition(relicId)?.priority || 0));
  }

  private getOrderedRelicIds(relicIds: string[]): string[] {
    return [...relicIds].sort((left, right) => {
      const priorityDelta = this.getRelicPriority(right) - this.getRelicPriority(left);
      if (priorityDelta !== 0) return priorityDelta;

      const registrationDelta = this.getRelicRegistrationIndex(left) - this.getRelicRegistrationIndex(right);
      if (registrationDelta !== 0) return registrationDelta;

      return left.localeCompare(right);
    });
  }

  private normalizeGenericTrigger(relic: RelicDefinition): string | null {
    const explicitTrigger = String(relic.trigger || '');
    if (explicitTrigger && explicitTrigger !== 'Passive') {
      return GENERIC_RELIC_TRIGGER_MAP[explicitTrigger] || explicitTrigger;
    }

    const effectType = String(relic.effect?.type || '');
    if (!effectType) return null;
    return GENERIC_RELIC_TRIGGER_MAP[effectType] || null;
  }

  private normalizeGenericActionSpec(effect: any): any | null {
    if (!effect || !effect.type || effect.type === 'Passive' || effect.type === 'Seal') return null;

    if (effect.type === 'OnCardPlayed' || effect.type === 'OnPlayCard') {
      return this.normalizeGenericActionSpec(effect.effect);
    }

    if (
      effect.type === 'TriggerOnResourceGain' ||
      effect.type === 'OnResourceGain' ||
      effect.type === 'OnResourceSpent' ||
      effect.type === 'OnSpendResource' ||
      effect.type === 'OnFirstResourceSpend' ||
      effect.type === 'TriggerOnDamageTaken' ||
      effect.type === 'OnTakeDamage'
    ) {
      return this.normalizeGenericActionSpec(effect.effect);
    }

    const spec = { ...effect };
    if (spec.type === 'DrawCards') spec.type = 'Draw';
    if (spec.type === 'GainBlockAndRemoveDebuff') {
      return [
        { type: 'GainBlock', amount: Math.max(1, Number(spec.blockAmount || spec.amount || 1)), target: 'Self' },
        { type: 'RemoveAnyDebuff', amount: Math.max(1, Number(spec.debuffAmount || 1)), target: 'Self' },
      ];
    }
    if (!ActionFactory.getRegisteredTypes().includes(String(spec.type))) return null;
    return spec;
  }

  private markGenericRelicOncePerTurn(state: GameState, relicId: string, key: string): boolean {
    const turn = Number(state.combat?.turn || 0);
    if (turn <= 0) return false;
    const relicState = (state.player.relicStates[relicId] ||= { level: 0, progress: 0 });
    const marker = `${key}Turn`;
    if (Number((relicState as any)[marker] || 0) === turn) return false;
    (relicState as any)[marker] = turn;
    return true;
  }

  private genericEffectMatchesEvent(state: GameState, relic: RelicDefinition, event: GameEvent): boolean {
    const effect = relic.effect || {};

    if ((event as any).type === 'RelicAcquired' && (event as any).relicId !== relic.id) {
      return false;
    }

    if ((effect.type === 'OnCardPlayed' || effect.type === 'OnPlayCard') && effect.tag) {
      const card = cardsData.find((entry) => entry.id === (event as any).cardId);
      if (!card || !(card.tags || []).includes(String(effect.tag))) return false;
    }

    if ((effect.type === 'OnCardPlayed' || effect.type === 'OnPlayCard') && Number(effect.count || 0) > 0) {
      const played = Number(state.combat?.player.cardsPlayedThisTurn || 0);
      if (played !== Number(effect.count)) return false;
    }

    if (
      effect.type === 'TriggerOnResourceGain' ||
      effect.type === 'OnResourceGain' ||
      effect.type === 'OnResourceSpent' ||
      effect.type === 'OnSpendResource' ||
      effect.type === 'OnFirstResourceSpend'
    ) {
      const resource = String(effect.resource || '');
      if (resource && resource !== String((event as any).resource || '')) return false;
    }

    if (effect.type === 'OnFirstResourceSpend') {
      if ((event as any).type !== 'RouteResourceSpent') return false;
      if (!this.markGenericRelicOncePerTurn(state, relic.id, 'firstResourceSpend')) return false;
    }

    if ((effect.type === 'TriggerOnDamageTaken' || effect.type === 'OnTakeDamage') && Number(effect.threshold || 0) > 0) {
      if (Number((event as any).amount || 0) < Number(effect.threshold)) return false;
    }

    const condition = relic.condition || effect.condition;
    if (condition?.type === 'FirstSpendThisTurn') {
      if ((event as any).type !== 'RouteResourceSpent') return false;
      return this.markGenericRelicOncePerTurn(state, relic.id, 'firstResourceSpend');
    }

    if (condition?.type === 'CardCountThisTurn') {
      return Number(state.combat?.player.cardsPlayedThisTurn || 0) === Number(condition.count || 0);
    }

    if (condition?.type === 'ResourceAmount' || condition?.type === 'HasResource') {
      const resource = String(condition.resource || '');
      const required = Number(condition.amount ?? 1);
      const player = state.player as typeof state.player & { secondaryResources?: Record<string, number> } & Record<string, any>;
      const value = Number(player.secondaryResources?.[resource] ?? player[resource] ?? 0);
      return value >= required;
    }

    return true;
  }

  private enqueueGenericRelicEffect(
    relicId: string,
    trigger: string,
    event: GameEvent,
    state: GameState,
    enqueue: RelicEnqueue
  ): boolean {
    const relic = this.getRelicDefinition(relicId);
    if (!relic || !relic.effect) return false;
    if (this.normalizeGenericTrigger(relic) !== trigger) return false;
    if (!this.genericEffectMatchesEvent(state, relic, event)) return false;

    const specOrSpecs = this.normalizeGenericActionSpec(relic.effect);
    if (!specOrSpecs) return false;

    const specs = (Array.isArray(specOrSpecs) ? specOrSpecs : [specOrSpecs]) as GenericActionSpec[];
    for (const spec of specs) {
      enqueue(spec, {
        source: 'player',
        sourceId: 'player',
        targetId: spec.target === 'Self' ? 'player' : (event as any).targetId,
      });
    }
    return true;
  }

  private setupEventListeners() {
    this.dispose();
    this.eventDisposables.push(
      globalEventBus.subscribe('CardPlayed', (event) => this.handleEvent('CardPlayed', event)),
      globalEventBus.subscribe('DamageReceived', (event) => this.handleEvent('DamageReceived', event)),
      globalEventBus.subscribe('RelicAcquired', (event) => this.handleEvent('RelicAcquired', event)),
      globalEventBus.subscribe('RouteResourceGained', (event: any) => this.handleEvent('RouteResourceGained', event)),
      globalEventBus.subscribe('RouteResourceSpent', (event: any) => this.handleEvent('RouteResourceSpent', event))
    );
  }

  private handleEvent(trigger: string, event: GameEvent): void {
    const state = this.getState();
    if (!state || !(state as any).player || !(state as any).player.relics) return;
    let manager: ReturnType<typeof getActionManager>;
    try {
      manager = getActionManager();
    } catch {
      return;
    }
    if (!manager) return;
    let queuedAction = false;

    const enqueueUrgent = (action: any, context: any) => {
      const relicContext = {
        ...context,
        source: 'player',
        sourceId: context?.sourceId ?? context?.source
      };
      if (action && typeof action.execute === 'function') {
        manager.enqueueUrgentAction(action, relicContext, 'relic');
      } else {
        manager.enqueueUrgent(action, relicContext, 'relic');
      }
      queuedAction = true;
    };

    for (const relicId of this.getOrderedRelicIds(state.player.relics)) {
      const effects = this.relicEffects.get(relicId);
      if (effects) {
        for (const effect of effects) {
          if (effect.trigger === trigger) {
            if (!effect.condition || effect.condition(state)) {
              try {
                effect.action(state, event, enqueueUrgent);
              } catch (error) {
                console.error('[RelicSystem] Relic effect failed:', relicId, trigger, error instanceof Error ? error.message : error);
              }
            }
          }
        }
      }

      if (!this.relicEffects.has(relicId)) {
        try {
          this.enqueueGenericRelicEffect(relicId, trigger, event, state, enqueueUrgent);
        } catch (error) {
          console.error('[RelicSystem] Generic relic effect failed:', relicId, trigger, error instanceof Error ? error.message : error);
        }
      }
    }
    if (queuedAction && !manager.isProcessing()) {
      manager.executeAll();
    }
  }

  public getRelicDescription(relicId: string): string {
    const relic = relicsData.find(r => r.id === relicId);
    return relic?.description || 'Unknown relic';
  }

  public getRelicPrice(relicId: string): number {
    const relic = relicsData.find(r => r.id === relicId);
    return relic?.price || 100;
  }

  public hasRelic(state: GameState, relicId: string): boolean {
    return state.player.relics.includes(relicId);
  }

  public addRelic(state: GameState, relicId: string): boolean {
    if (state.player.relics.includes(relicId)) return false;
    const relic = relicsData.find(r => r.id === relicId);
    if (!relic) return false;
    
    state.player.relics.push(relicId);
    state.player.relicStates[relicId] ||= { level: 0, progress: 0, corrupted: !!relic.corrupted };
    
    if (relic.corrupted) {
      state.player.corruption += 1;
      if (relic.effect?.maxHpPenalty) {
        state.player.maxHp = Math.max(1, state.player.maxHp - relic.effect.maxHpPenalty);
        state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      }
      if (relic.effect?.addCurseOnPickup) {
        const cursePool = cardsData.filter(c => (c.tags || []).includes('Curse'));
        if (cursePool.length > 0) {
          for (let i = 0; i < relic.effect.addCurseOnPickup; i++) {
            const curse = stateRandomChoice(state, cursePool);
            if (curse) {
              state.player.deck.push({ ...(curse as any), instanceId: stateRandomId(state, 'curse') } as any);
            }
          }
        }
      }
    }
    
    globalEventBus.publish({ type: 'RelicAcquired', relicId });
    return true;
  }

  // Backward-compatible imperative trigger API used by GameEngine.
  public trigger(
    trigger: 'StartTurn' | 'EndTurn' | 'CombatStart' | 'CombatEnd',
    state: GameState,
    enqueue: (actionOrSpec: any, context: any) => void,
    eventOverrides: Partial<GameEvent> = {}
  ): void {
    const eventTypeMap: Record<string, GameEvent['type']> = {
      StartTurn: 'TurnStart',
      EndTurn: 'TurnEnd',
      CombatStart: 'CombatStart',
      CombatEnd: 'CombatEnd'
    };
    const eventType = eventTypeMap[trigger];
    if (!eventType) return;

    const baseEvent: GameEvent =
      eventType === 'TurnStart' || eventType === 'TurnEnd'
        ? { type: eventType, playerTurn: true }
        : eventType === 'CombatEnd'
          ? { type: 'CombatEnd', victory: Boolean((eventOverrides as any).victory) }
          : { type: 'CombatStart' };

    const event = { ...baseEvent, ...eventOverrides } as GameEvent;

    for (const relicId of this.getOrderedRelicIds(state.player.relics)) {
      const effects = this.relicEffects.get(relicId);
      if (!effects) continue;
      for (const effect of effects) {
        if (effect.trigger !== eventType) continue;
        if (effect.condition && !effect.condition(state)) continue;
        try {
          effect.action(state, event, enqueue);
        } catch (error) {
          console.error('[RelicSystem] Relic effect failed:', relicId, eventType, error instanceof Error ? error.message : error);
        }
      }
    }

    // Generic JSON-defined relic effects (e.g. Anchor, Vajra, Lantern, Bag of Prep).
    for (const relicId of this.getOrderedRelicIds(state.player.relics)) {
      if (this.relicEffects.has(relicId)) continue;
      try {
        this.enqueueGenericRelicEffect(relicId, eventType, event, state, enqueue);
      } catch (error) {
        console.error('[RelicSystem] Generic relic effect failed:', relicId, eventType, error instanceof Error ? error.message : error);
      }
    }
  }
}

let globalRelicSystem: RelicSystem | null = null;
let defaultRelicSystem: RelicSystem | null = null;

export const createRelicSystem = (getState: () => GameState): RelicSystem => {
  globalRelicSystem?.dispose();
  globalRelicSystem = new RelicSystem(getState);
  globalRelicSystem.bindStateTracker(getState);
  return globalRelicSystem;
};

export const getRelicSystem = (): RelicSystem | null => {
  return globalRelicSystem;
};

const getDefaultRelicSystem = (): RelicSystem => {
  if (!defaultRelicSystem) {
    defaultRelicSystem = new RelicSystem(() => ({} as GameState));
  }
  return defaultRelicSystem;
};

export const relicSystem: RelicSystem = new Proxy({} as RelicSystem, {
  get(_target, prop, receiver) {
    const instance = getDefaultRelicSystem();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getDefaultRelicSystem(), prop, value, receiver);
  },
}) as RelicSystem;
