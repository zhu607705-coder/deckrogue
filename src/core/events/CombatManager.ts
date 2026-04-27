/**
 * @file CombatManager.ts
 * @description 战斗事件管理器 - 处理战斗相关的游戏逻辑
 *
 * 主要职责:
 * - 管理战斗回合流程 (玩家回合 / 敌人回合)
 * - 处理卡牌打出和效果计算
 * - 管理玩家和敌人的状态 (HP、格挡、能量等)
 * - 处理敌人意图的计算和显示
 * - 管理战斗中的抽牌、弃牌、消耗堆
 * - 与动作系统集成处理战斗动作
 *
 * 战斗流程:
 * 1. 战斗开始 -> 初始化敌人、玩家状态、手牌
 * 2. 玩家回合 -> 打出卡牌、计算伤害/效果
 * 3. 敌人回合 -> 敌人行动、意图计算
 * 4. 回合结束 -> 清理状态、准备下一回合
 */
import { GameState, CardDef, RunCardInstance, ActionSpec } from '@/core/types';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import {
  applyCombatAfflictionToInstance,
  deriveRunCardInstance,
  normalizeRunCardInstance,
} from '@/core/combat/runCardInstance';
import { economySystem } from '@/features/progression/economySystem';
import { relicSystem } from '@/features/relics/relicSystem';
import { globalEventBus } from '@/core/events/eventBus';
import { metricsTracker } from '@/core/events/metricsTracker';
import { getBossPhaseEncounter, getBossPhaseForHpPct } from '@/core/events/bossPhaseSystem';
import { BossPhaseManager } from '@/core/combat/BossPhaseManager';
import { cooldownsReducer, intentTagger, selectEnemyIntentForCombat } from '@/core/ai';
import {
  enemiesData,
  getSingleSlimeRoomBoostConfig,
  getCardEnchantmentDefById,
  applyEnemyHpTuningByNumericRules,
  rollEnemyBaseHp,
} from '@/content/narrative/numericSystem';
import { unlockCodexEntry } from '@/core/persistence/codexStore';
import { safeArrayAccess } from '@/core/utils/safeArray';
import { COMBAT_NUMBERS } from '@/core/balance/numericConstants';
import { clampEnemyCountForEncounter, prioritizeEnemyPoolForEncounter } from '@/core/combat/enemySelection';
import type { IActionContext } from '@/core/actions/actionQueue';
import type { ActionManager } from '@/core/actions/actionManager';

export interface CombatManagerDeps {
  getState: () => GameState;
  rng: () => number;
  generateId: () => string;
  createRuntimeCard: (card: CardDef, instanceId?: string) => RunCardInstance;
  shuffleDeck: <T>(deck: T[]) => T[];
  syncRngState: () => void;
  appendVoxLog: (message: string) => void;
  notify: () => void;
  getCurrentFloorNumber: () => number;
  applyRunTransition: (action: { type: string; phase?: string }) => void;
  syncPlayerStateFromCombat: () => void;
  clearCombatAfflictionsForRunCards: () => void;
  generateCardRewards: (count: number, options?: { source?: 'combat' | 'shop' }) => RunCardInstance[];
  tryDelegatedCompleteCombat: () => boolean;
  ensureRunEffects: () => Record<string, unknown>;
}

export class CombatManager {
  private combatVictoryInProgress = false;
  private playerDeathInProgress = false;
  private readonly disposables: Array<() => void> = [];
  private readonly bossPhaseManager: BossPhaseManager;
  private deferStoredEffectFlushDepth = 0;

  constructor(private deps: CombatManagerDeps, private actionManager: ActionManager) {
    relicSystem.bindStateTracker(() => this.deps.getState());
    this.bossPhaseManager = new BossPhaseManager({
      getState: () => this.deps.getState(),
      rng: () => this.deps.rng(),
      generateId: () => this.deps.generateId(),
      appendVoxLog: (message) => this.deps.appendVoxLog(message),
      notify: () => this.deps.notify(),
      applyEnemyHpTuning: (baseHp, floor, nodeType) => {
        const state = this.deps.getState();
        const hpMultiplier = economySystem.calculateHpMultiplier(floor) * Math.max(1, Number(state.metaRuntime?.ascensionEnemyHpMultiplier || 1));
        return applyEnemyHpTuningByNumericRules(baseHp, floor, nodeType as 'Combat' | 'Elite' | 'Boss', hpMultiplier);
      },
      getCurrentFloorNumber: () => this.deps.getCurrentFloorNumber(),
    });
    this.disposables.push(
      globalEventBus.subscribe('EnemyDeath', (event: any) => {
        if (!event?.enemyId) return;
        this.handleEnemyDefeated(event.enemyId);
      }),
      globalEventBus.subscribe('CardDrawn', (event: any) => {
        const card = event?.card;
        if (!card || Math.max(0, Number(card.tempCost ?? card.cost ?? 0)) !== 0) return;
        this.triggerStartOfTurnEffects('DrawZeroCostCard', { card });
      }),
      globalEventBus.subscribe('BlockGained', (event: any) => {
        if (event?.targetType && event.targetType !== 'player') return;
        if (event?.targetId && event.targetId !== 'player') return;
        this.triggerStartOfTurnEffects('GainBlockThreshold', { amount: Number(event?.amount || 0) });
      }),
      globalEventBus.subscribe('ConstructCreated', () => {
        this.triggerStartOfTurnEffects('FirstSummon');
      }),
      globalEventBus.subscribe('RouteResourceGained', (event: any) => {
        this.triggerStartOfTurnEffects('GainResource', {
          resource: String(event?.resource || ''),
          amount: Number(event?.amount || 0),
        });
      }),
      globalEventBus.subscribe('RouteResourceSpent', (event: any) => {
        this.triggerStartOfTurnEffects('SpendResource', {
          resource: String(event?.resource || ''),
          amount: Number(event?.amount || 0),
        });
      }),
    );
  }

  dispose(): void {
    this.disposables.splice(0).forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        console.error('[CombatManager] Failed to dispose subscription:', error);
      }
    });
  }

  private enqueueRelicAction(actionOrSpec: any, ctx: IActionContext): void {
    if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
      this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
    } else {
      this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
    }
  }

  startCombat(nodeType: 'Combat' | 'Elite' | 'Boss'): void {
    const state = this.deps.getState();
    const nodeId = state.currentNodeId || '';
    this.deps.syncRngState();
    const stateSnapshot = this.cloneGameStateSnapshot({
      ...state,
      combat: null,
      combatRestartCheckpoint: undefined,
    });

    state.combatRestartCheckpoint = {
      nodeId,
      nodeType,
      stateSnapshot,
      rngState: state.rngState,
      pendingNodeResolution: state.pendingNodeResolution
    };

    const floor = this.deps.getCurrentFloorNumber();
    const hpMultiplier = economySystem.calculateHpMultiplier(floor) * Math.max(1, Number(state.metaRuntime?.ascensionEnemyHpMultiplier || 1));

    const enemyCount = nodeType === 'Boss' ? 1 : nodeType === 'Elite' ? 2 : 1 + Math.floor(this.deps.rng() * 2);
    const enemies = this.generateEnemies(enemyCount, nodeType, floor, hpMultiplier);

    state.combat = {
      player: {
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        block: 0,
        energy: state.player.maxEnergy,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0,
        attacksPlayedThisTurn: 0,
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
        intel: state.player.intel,
        devotion: state.player.devotion || 0,
        corruptionAxis: Math.min(100, Math.max(0, state.player.corruption || 0)),
        axisDisposition: (state.player.corruption || 0) > 0 ? 'corruption' : 'balanced',
        timeLayer: state.character?.specialResource === 'timeLayer' ? 1 : undefined,
        thread: state.character?.specialResource === 'thread' ? 2 : undefined,
        concoction: state.character?.specialResource === 'concoction' ? 1 : undefined
      },
      enemies,
      drawPile: this.deps.shuffleDeck([...state.player.deck]),
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: Math.min(
        100,
        Math.floor((state.player.corruption || 0) * 0.6) + Math.max(0, state.player.runEffects?.pendingWarpTideBonus || 0)
      ),
      warpAlpha: 0.5 + Math.min(0.25, (state.player.corruption || 0) * 0.0025),
      warpPerilK: 0.05
    };
    this.initializeBossPhaseRuntime();
    this.applyRunEffectCombatModifiers();

    state.screen = 'Combat';
    metricsTracker.recordCombatStart?.();
    globalEventBus.publish({ type: 'CombatStart' } as any);
    relicSystem.trigger('CombatStart', state, (actionOrSpec: any, ctx: IActionContext) => this.enqueueRelicAction(actionOrSpec, ctx));
    if ((state.player.corruption || 0) > 0) {
      state.combat.warpPulse = {
        text: `Corruption stirs the warp: Tide ${state.combat.warpTide} · DMG x${this.getCorruptionDamageBonusMultiplier().toFixed(2)}`,
        tone: (state.combat.warpTide || 0) >= 50 ? 'danger' : 'warp'
      };
    }
    this.startPlayerTurn();
  }

  private cloneGameStateSnapshot<T>(snapshot: T): T {
    try {
      return JSON.parse(JSON.stringify(snapshot)) as T;
    } catch (error) {
      console.error('Failed to clone game state snapshot:', error);
      return snapshot;
    }
  }

  private applyRunEffectCombatModifiers(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;
    const runEffects = this.deps.ensureRunEffects() as Record<string, number>;

    const enemyHuntBonusPct = Math.max(0, Number(runEffects.enemyHuntBonusPct || 0));
    if (enemyHuntBonusPct > 0) {
      const bonusStrength = Math.max(1, Math.round(enemyHuntBonusPct * 10));
      for (const enemy of combat.enemies) {
        const hpBonus = Math.max(1, Math.floor(enemy.maxHp * enemyHuntBonusPct));
        enemy.maxHp += hpBonus;
        enemy.hp += hpBonus;
        enemy.statuses['Strength'] = (enemy.statuses['Strength'] || 0) + bonusStrength;
      }
      combat.warpPulse = {
        text: `Inquisitorial pursuit empowers the enemy (+${Math.round(enemyHuntBonusPct * 100)}%)`,
        tone: 'danger'
      };
    }

    const pendingWarpTideBonus = Number(runEffects.pendingWarpTideBonus || 0);
    if (pendingWarpTideBonus > 0) {
      runEffects.pendingWarpTideBonus = 0;
    }

    const warpDebuffCombatsRemaining = Number(runEffects.warpDebuffCombatsRemaining || 0);
    if (warpDebuffCombatsRemaining > 0) {
      combat.player.statuses['Fear'] = Math.max(combat.player.statuses['Fear'] || 0, 2);
      combat.player.statuses['Vulnerable'] = Math.max(combat.player.statuses['Vulnerable'] || 0, 2);
      runEffects.warpDebuffCombatsRemaining = Math.max(0, warpDebuffCombatsRemaining - 1);
      combat.warpPulse = {
        text: `Warp aftershocks: Fear + Vulnerable (${runEffects.warpDebuffCombatsRemaining} fights remain)`,
        tone: 'danger'
      };
    }

    const nodeType = state.combatRestartCheckpoint?.nodeType;
    if (nodeType === 'Elite') {
      const eliteTrapWeakStacks = Math.max(0, Number(runEffects.eliteTrapWeakStacks || 0));
      if (eliteTrapWeakStacks > 0) {
        for (const enemy of combat.enemies) {
          enemy.statuses['Weak'] = (enemy.statuses['Weak'] || 0) + eliteTrapWeakStacks;
        }
        combat.warpPulse = {
          text: `陷阱伏击：敌人获得 ${eliteTrapWeakStacks} 层虚弱`,
          tone: 'neutral'
        };
        runEffects.eliteTrapWeakStacks = 0;
      }
    }
  }

  private getCorruptionDamageBonusMultiplier(): number {
    const state = this.deps.getState();
    const corruption = Math.max(
      COMBAT_NUMBERS.corruption.min,
      Math.min(COMBAT_NUMBERS.corruption.max, state.player.corruption || 0)
    );
    return 1 + Math.min(COMBAT_NUMBERS.corruption.damageBonusCap, corruption * COMBAT_NUMBERS.corruption.bonusPerPoint);
  }

  private initializeBossPhaseRuntime(): void {
    this.bossPhaseManager.initializeBossPhaseRuntime();
  }

  private generateEnemies(
    count: number,
    nodeType: 'Combat' | 'Elite' | 'Boss',
    floor: number,
    hpMultiplier: number
  ): any[] {
    const state = this.deps.getState();
    const enemyPool = prioritizeEnemyPoolForEncounter(enemiesData as any[], floor, nodeType);
    const effectiveCount = clampEnemyCountForEncounter(count, floor, nodeType, enemyPool);

    return Array.from({ length: effectiveCount }, (_, i) => {
      const def = safeArrayAccess(enemyPool, Math.floor(this.deps.rng() * enemyPool.length));
      if (!def) {
        return null;
      }
      if (def?.id) {
        const eliteLike = !!def.keywords?.includes('elite') || !!def.keywords?.includes('boss');
        unlockCodexEntry(eliteLike ? 'elites' : 'enemies', def.id);
      }
      const baseHp = rollEnemyBaseHp(def, this.deps.rng);
      const scaledHp = applyEnemyHpTuningByNumericRules(baseHp, floor, nodeType, hpMultiplier);

      return {
        id: `enemy_${i}_${this.deps.generateId()}`,
        defId: def.id,
        name: def.name,
        hp: scaledHp,
        maxHp: scaledHp,
        block: 0,
        statuses: {},
        nextIntent: selectEnemyIntentForCombat(
          state,
          def,
        {
          id: `enemy_${i}_preview`,
          hp: scaledHp,
          maxHp: scaledHp,
          block: 0,
          statuses: {},
          lastUsedIntent: null,
          nonAttackIntentStreak: 0,
        },
          1,
          this.deps.rng,
          {},
        ),
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
        ,
        nonAttackIntentStreak: 0
      };
    }).filter((enemy): enemy is NonNullable<typeof enemy> => enemy !== null).map((enemy) => {
      const slimeBoost = getSingleSlimeRoomBoostConfig();
      if (
        slimeBoost.enabled &&
        nodeType === 'Combat' &&
        effectiveCount === 1 &&
        floor <= slimeBoost.maxFloor &&
        enemy.defId === 'slime_small'
      ) {
        const hpBonus = Math.max(slimeBoost.minHpBonus, Math.floor(enemy.maxHp * slimeBoost.hpBonusRatio));
        enemy.maxHp += hpBonus;
        enemy.hp += hpBonus;
        if (slimeBoost.strengthBonus > 0) {
          enemy.statuses['Strength'] = (enemy.statuses['Strength'] || 0) + slimeBoost.strengthBonus;
        }
        if (slimeBoost.innateStatus && typeof slimeBoost.innateStatus === 'object') {
          for (const [status, amount] of Object.entries(slimeBoost.innateStatus)) {
            const stacks = Math.max(0, Math.floor(Number(amount) || 0));
            if (stacks <= 0) continue;
            enemy.statuses[status] = Math.max(enemy.statuses[status] || 0, stacks);
          }
        }
      }
      return enemy;
    });
  }

  startPlayerTurn(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    combat.isPlayerTurn = true;
    this.deps.appendVoxLog(`玩家阶段开始。能量回填至 ${state.player.maxEnergy}。`);
    combat.player.damageTakenLastTurn = Math.max(0, Math.floor(combat.player.damageTakenThisTurn || 0));
    combat.player.damageTakenThisTurn = 0;
    combat.player.energy = state.player.maxEnergy;
    const delayedEnergy = Math.max(0, Math.floor(Number(combat.player.statuses.DelayedEnergy || 0)));
    if (delayedEnergy > 0) {
      combat.player.energy += delayedEnergy;
      delete combat.player.statuses.DelayedEnergy;
    }
    if (combat.turn > 1) {
      combat.player.block = 0;
    }
    combat.player.cardsPlayedThisTurn = 0;
    combat.player.attacksPlayedThisTurn = 0;
    combat.player.blockGainedThisTurn = 0;
    combat.player.potionsUsedThisTurn = 0;
    const playerTurnFlags = combat.player as typeof combat.player & {
      resourceSpentThisTurn?: number;
      elementsAddedThisTurn?: number;
      resourceRefundPending?: number;
      resourceRefundUsedThisTurn?: number;
    };
    playerTurnFlags.resourceSpentThisTurn = 0;
    playerTurnFlags.elementsAddedThisTurn = 0;
    playerTurnFlags.resourceRefundPending = 0;
    playerTurnFlags.resourceRefundUsedThisTurn = 0;

    if (this.processTurnStartDots('player', 'player')) {
      this.deps.notify();
      return;
    }

    this.executeConstructAttacks();

    let skipDrawThisTurn = false;
    if ((combat.player.statuses['SkipDraw'] || 0) > 0) {
      skipDrawThisTurn = true;
      combat.player.statuses['SkipDraw'] = Math.max(0, (combat.player.statuses['SkipDraw'] || 0) - 1);
      if (combat.player.statuses['SkipDraw'] <= 0) delete combat.player.statuses['SkipDraw'];
      combat.warpPulse = { text: '时序债务生效：本回合跳过抽牌阶段', tone: 'warp' };
    }
    this.processStatusDecay(combat.player.statuses);
    this.deferStoredEffectFlushDepth += 1;
    try {
      this.tickDelayedCards();
      if (!skipDrawThisTurn) {
        const drawPenalty = Math.max(0, Math.floor(Number(combat.player.statuses.DrawPenaltyNextTurn || 0)));
        if (drawPenalty > 0) delete combat.player.statuses.DrawPenaltyNextTurn;
        this.drawCards(Math.max(0, 5 - drawPenalty));
      }
    } finally {
      this.deferStoredEffectFlushDepth = Math.max(0, this.deferStoredEffectFlushDepth - 1);
    }

    this.actionManager.updateState(state);
    relicSystem.trigger('StartTurn', state, (actionOrSpec: any, ctx: IActionContext) => this.enqueueRelicAction(actionOrSpec, ctx), {
      playerTurn: true,
    });
    this.actionManager.executeAll();
    this.deps.notify();
  }

  private executeConstructAttacks(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const constructs = combat.player.constructs || [];
    if (constructs.length === 0) return;

    for (const construct of constructs) {
      if (construct.hp <= 0) continue;

      const atk = Math.max(0, construct.atk || 0);
      if (atk <= 0) continue;

      const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
      if (aliveEnemies.length === 0) return;

      const target = safeArrayAccess(aliveEnemies, Math.floor(this.deps.rng() * aliveEnemies.length));
      if (!target) continue;

      const damage = combatSystem.applyDamage(state, {
        amount: atk,
        sourceType: 'player',
        sourceId: construct.id,
        targetType: 'enemy',
        targetId: target.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false,
      });

      combat.warpPulse = {
        text: `${construct.name} 对 ${target.name} 造成 ${damage} 点伤害`,
        tone: 'faith'
      };
    }
  }

  private processStatusDecay(statuses: Record<string, number>): void {
    const decayStatuses = ['Vulnerable', 'Weak', 'Frail', 'Fear', 'Stealth', 'Regen', 'Energized', 'Berserk', 'Intangible', 'BlockBlocked'];
    decayStatuses.forEach(status => {
      if (statuses[status] !== undefined && statuses[status] > 0) {
        statuses[status]--;
        if (statuses[status] <= 0) {
          delete statuses[status];
        }
      }
    });
  }

  drawCards(amount: number): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    for (let i = 0; i < amount; i++) {
      if (combat.drawPile.length === 0) {
        if (combat.discardPile.length === 0) break;
        combat.drawPile = this.deps.shuffleDeck(combat.discardPile);
        combat.discardPile = [];

        globalEventBus.publish({ type: 'DeckShuffled' } as any);
      }

      if (combat.drawPile.length > 0) {
        const card = combat.drawPile.pop()!;
        combat.hand.push(card);
        globalEventBus.publish({ type: 'CardDrawn', cardId: card.id, cardInstanceId: card.instanceId, card } as any);
      }
    }
  }

  private consumePendingCostDiscount(card: RunCardInstance): RunCardInstance {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return card;

    const statuses = combat.player.statuses;
    let discount = Math.max(0, Math.floor(Number(statuses.NextCardCostDown || 0)));
    if (discount > 0) delete statuses.NextCardCostDown;

    if (card.type === 'Attack') {
      const attackDiscount = Math.max(0, Math.floor(Number(statuses.NextAttackCostDown || 0)));
      if (attackDiscount > 0) {
        discount += attackDiscount;
        delete statuses.NextAttackCostDown;
      }
    }

    if (discount <= 0) return card;
    const normalized = normalizeRunCardInstance(card, () => this.deps.generateId());
    const currentCost = Math.max(0, Math.floor(Number(normalized.tempCost ?? normalized.cost ?? 0)));
    return deriveRunCardInstance({
      ...normalized,
      tempCost: Math.max(0, currentCost - discount),
    });
  }

  private scaleActionSpecForReplay(action: ActionSpec, percent: number): ActionSpec {
    const ratio = Math.max(1, Math.min(100, Math.floor(percent))) / 100;
    const next = { ...action } as ActionSpec & Record<string, unknown>;
    for (const key of ['amount', 'bonus', 'stacks', 'damage', 'block', 'attack', 'hp', 'atk']) {
      if (typeof next[key] === 'number' && (next[key] as number) > 0) {
        next[key] = Math.max(1, Math.floor((next[key] as number) * ratio));
      }
    }
    if (next.actions) next.actions = next.actions.map(child => this.scaleActionSpecForReplay(child, percent));
    if (next.trueActions) next.trueActions = next.trueActions.map(child => this.scaleActionSpecForReplay(child, percent));
    if (next.falseActions) next.falseActions = next.falseActions.map(child => this.scaleActionSpecForReplay(child, percent));
    return next;
  }

  private queueDelayedReplayForNextTurn(card: RunCardInstance, percent: number, targetId?: string): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const normalized = normalizeRunCardInstance(card, () => this.deps.generateId());
    const delayedActions = normalized.actions
      .filter(action => action.type !== 'Delay' && action.type !== 'DelayNextCardEffect')
      .map(action => this.scaleActionSpecForReplay(action, percent));
    if (delayedActions.length === 0) return;

    const runtimeBase = {
      ...normalized.runtimeBase,
      id: `${normalized.baseCardId || normalized.id}_delayed_replay`,
      name: `${normalized.name} Replay`,
      cost: 0,
      actions: [{
        type: 'Delay',
        turns: 1,
        actions: delayedActions,
      } as ActionSpec],
    };

    const delayedCard = deriveRunCardInstance({
      ...normalized,
      instanceId: this.deps.generateId(),
      baseCardId: runtimeBase.id,
      runtimeBase,
      tempCost: 0,
    });
    combat.player.delayedCards.push({ card: delayedCard, turns: 1, targetId });
  }

  private consumeDelayNextCardEffect(card: RunCardInstance, targetId?: string): void {
    const combat = this.deps.getState().combat;
    if (!combat) return;
    const percent = Math.max(0, Math.floor(Number(combat.player.statuses.DelayNextCardEffectPercent || 0)));
    if (percent <= 0) return;
    delete combat.player.statuses.DelayNextCardEffectPercent;
    this.queueDelayedReplayForNextTurn(card, percent, targetId);
  }

  private executeStoredCombatEffects(
    key: 'endOfTurnEffects' | 'endOfCombatEffects',
    combatResult?: 'victory' | 'defeat'
  ): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;
    const player = combat.player as typeof combat.player & {
      combatResult?: 'victory' | 'defeat';
      endOfTurnEffects?: Array<{ actions: ActionSpec[] }>;
      endOfCombatEffects?: Array<{ actions: ActionSpec[] }>;
    };
    const entries = player[key] || [];
    if (entries.length === 0) return;
    delete player[key];
    if (combatResult) player.combatResult = combatResult;

    for (const entry of entries) {
      if (!entry.actions?.length) continue;
      this.actionManager.enqueueAll(entry.actions, {
        source: 'player',
        sourceId: 'player',
        targetId: 'player',
      }, 0, 'system');
    }
    this.actionManager.executeAll();
    if (combatResult) delete player.combatResult;
  }

  private triggerMatchesStoredEffect(trigger: unknown, triggerType: string, payload: Record<string, unknown>): boolean {
    const triggerDef = trigger as { type?: string; threshold?: number; resource?: string; amount?: number } | undefined;
    if (!triggerDef?.type || triggerDef.type !== triggerType) return false;

    if (typeof triggerDef.resource === 'string' && triggerDef.resource.length > 0) {
      if (String(payload.resource || '') !== triggerDef.resource) return false;
    }

    if (triggerType === 'GainBlockThreshold') {
      return Number(payload.amount || 0) >= Math.max(1, Number(triggerDef.threshold || 1));
    }

    if (typeof triggerDef.amount === 'number') {
      return Number(payload.amount || 0) >= Math.max(1, Number(triggerDef.amount || 1));
    }

    return true;
  }

  private triggerStartOfTurnEffects(triggerType: string, payload: Record<string, unknown> = {}): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const player = combat.player as typeof combat.player & {
      startOfTurnEffects?: Array<{ actions: ActionSpec[]; trigger?: unknown; usedTurn?: number }>;
    };
    const entries = player.startOfTurnEffects || [];
    if (entries.length === 0) return;

    let queued = false;
    for (const entry of entries) {
      if (entry.usedTurn === combat.turn) continue;
      if (!this.triggerMatchesStoredEffect(entry.trigger, triggerType, payload)) continue;
      if (!entry.actions?.length) continue;

      entry.usedTurn = combat.turn;
      this.actionManager.enqueueAll(entry.actions, {
        source: 'player',
        sourceId: 'player',
        targetId: 'player',
      }, 0, 'system');
      queued = true;
    }

    if (queued && this.deferStoredEffectFlushDepth === 0 && !this.actionManager.isProcessing()) {
      this.actionManager.executeAll();
    }
  }

  async playCard(cardInstanceId: string, targetId?: string): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;

    if (!combat || !combat.isPlayerTurn) {
      return;
    }

    const cardIndex = combat.hand.findIndex(c => c.instanceId === cardInstanceId);

    if (cardIndex === -1) {
      return;
    }

    let card = combat.hand[cardIndex];

    if (card.targeting === 'Enemy') {
      const target = targetId ? combat.enemies.find(e => e.id === targetId) : null;
      if (!target || target.hp <= 0) {
        if (!combat.enemies.some(e => e.hp > 0)) {
          globalEventBus.publish({ type: 'CombatVictory' } as any);
        }
        return;
      }
    }

    card = this.consumePendingCostDiscount(card);
    combat.hand[cardIndex] = card;

    unlockCodexEntry('cards', card.id);

    if (combat.player.energy < card.cost) {
      return;
    }

    combat.player.energy -= card.cost;
    combat.hand.splice(cardIndex, 1);
    combat.discardPile.push(card);
    combat.player.cardsPlayedThisTurn++;
    if (card.type === 'Attack') {
      combat.player.attacksPlayedThisTurn = Math.max(0, Number(combat.player.attacksPlayedThisTurn || 0)) + 1;
    }
    combat.player.lastPlayedCard = card;
    this.consumeDelayNextCardEffect(card, targetId);

    this.bossPhaseManager.recordBossPhasePlayedCard(card);

    const context = {
      source: 'player' as const,
      sourceId: 'player',
      targetId,
      cardId: card.id,
      cardInstanceId: card.instanceId,
      card
    };

    this.actionManager.enqueueAll(card.actions, context, 0, 'card');
    await this.actionManager.executeAll();

    globalEventBus.publish({
      type: 'CardPlayed',
      cardId: card.id,
      cardType: card.type,
      cardInstanceId: card.instanceId,
      targetId
    } as any);

    this.deps.notify();
  }

  async endTurn(): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    combat.isPlayerTurn = false;
    this.deps.appendVoxLog('玩家结束阶段。敌方即将行动。');

    this.bossPhaseManager.snapshotPlayerTurnForBossPhase();

    this.executeStoredCombatEffects('endOfTurnEffects');
    delete combat.player.statuses.DoubleDamageThisTurn;
    delete combat.player.statuses.NextCardCostDown;
    delete combat.player.statuses.NextAttackCostDown;

    this.discardHandRespectingRetain();

    await this.executeEnemyTurn();

    combat.turn++;
    this.startPlayerTurn();
  }

  discardHand(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    this.discardHandRespectingRetain();
  }

  private discardHandRespectingRetain(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const retainCount = Math.max(0, Math.floor(combat.player.statuses['RetainCard'] || 0));
    if (retainCount <= 0) {
      combat.discardPile.push(...combat.hand);
      combat.hand = [];
      return;
    }

    const retained = combat.hand.slice(0, retainCount);
    const discarded = combat.hand.slice(retainCount);
    combat.discardPile.push(...discarded);
    combat.hand = retained;
    delete combat.player.statuses['RetainCard'];
  }

  private evaluateEnemyActionCondition(condition: Record<string, any> | undefined, enemy?: any): boolean {
    if (!condition) return false;

    switch (condition.type) {
      case 'PlayerHasDebuffConsecutiveTurns': {
        const state = this.deps.getState();
        const combat = state.combat;
        if (!combat) return false;
        const requiredStatuses = Array.isArray(condition.statuses) ? condition.statuses : [];
        if (requiredStatuses.length === 0) return false;
        return requiredStatuses.every((status) => Number(combat.player.statuses?.[status] || 0) > 0);
      }
      case 'PlayerPlayed3CardsThisTurn': {
        const combat = this.deps.getState().combat;
        return Number(combat?.player.cardsPlayedThisTurn || 0) >= 3;
      }
      case 'SurvivedNConsecutiveTurns': {
        const combat = this.deps.getState().combat;
        return Number(combat?.turn || 1) >= Math.max(1, Number(condition.turns || 1));
      }
      case 'TwinAlive': {
        const combat = this.deps.getState().combat;
        const twinId = String(condition.twinId || '');
        return !!combat?.enemies.some(entry => (entry.id === twinId || entry.defId === twinId) && entry.hp > 0);
      }
      case 'TwinDied': {
        const combat = this.deps.getState().combat;
        const twinId = String(condition.twinId || '');
        return !!combat && !combat.enemies.some(entry => (entry.id === twinId || entry.defId === twinId) && entry.hp > 0);
      }
      case 'TotalAllyPoisonThreshold': {
        const combat = this.deps.getState().combat;
        const totalPoison = (combat?.enemies || [])
          .filter(entry => !enemy || entry.id !== enemy.id)
          .reduce((sum, entry) => sum + Math.max(0, Number(entry.statuses?.Poison || 0)), 0);
        return totalPoison >= Math.max(1, Number(condition.threshold || 1));
      }
      default:
        return false;
    }
  }

  private resolveEnemySideTargets(enemy: any, target: unknown, fallback: 'self' | 'player' = 'self'): any[] {
    const combat = this.deps.getState().combat;
    if (!combat) return [];

    const targetKey = String(target || (fallback === 'self' ? 'Self' : 'Enemy'));
    if (targetKey === 'Self') {
      return enemy?.hp > 0 ? [enemy] : [];
    }
    if (targetKey === 'AllEnemies') {
      return combat.enemies.filter(entry => entry.hp > 0);
    }
    if (targetKey === 'AllAllies') {
      return combat.enemies.filter(entry => entry.hp > 0 && entry.id !== enemy?.id);
    }

    const explicitEnemy = combat.enemies.find(entry => entry.id === targetKey || entry.defId === targetKey);
    return explicitEnemy && explicitEnemy.hp > 0 ? [explicitEnemy] : [];
  }

  private applyEnemyActionStatus(enemy: any, actionSpec: Record<string, any>, status: string, amount: number): boolean {
    const state = this.deps.getState();
    if (!state.combat || !status || amount <= 0) return false;

    const targetKey = String(actionSpec.target || 'Enemy');
    if (targetKey !== 'Enemy' && targetKey !== 'Player') {
      const targets = this.resolveEnemySideTargets(enemy, targetKey, 'self');
      if (targets.length === 0) return false;
      for (const target of targets) {
        combatSystem.applyStatus(state, 'enemy', target.id, status, amount);
      }
      return true;
    }

    combatSystem.applyStatus(state, 'player', 'player', status, amount);
    return true;
  }

  private executeEnemyActionSpec(enemy: any, actionSpec: Record<string, any>): boolean {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return false;

    switch (actionSpec.type) {
      case 'DealDamage': {
        const amount = Number(actionSpec.amount || 0);
        if (amount <= 0) return false;
        const actualDamage = combatSystem.applyDamage(state, {
          amount,
          sourceType: 'enemy',
          sourceId: enemy.id,
          targetType: 'player',
          targetId: 'player',
          modifiers: [],
          isTrueDamage: false,
          ignoreBlock: false,
        });
        this.deps.appendVoxLog(`${enemy.name} 对玩家造成 ${actualDamage} 点伤害。`);
        return actualDamage > 0;
      }
      case 'ConditionalDamage': {
        const passed = this.evaluateEnemyActionCondition(actionSpec.condition, enemy);
        const amount = Number(passed ? actionSpec.trueDamage : actionSpec.falseDamage);
        if (amount <= 0) return false;
        const actualDamage = combatSystem.applyDamage(state, {
          amount,
          sourceType: 'enemy',
          sourceId: enemy.id,
          targetType: 'player',
          targetId: 'player',
          modifiers: [],
          isTrueDamage: Boolean(actionSpec.isTrueDamage),
          ignoreBlock: false,
        });
        this.deps.appendVoxLog(
          passed
            ? `${enemy.name} 抓住破绽，对玩家造成 ${actualDamage} 点伤害。`
            : `${enemy.name} 的条件攻击未完全成形，仍造成 ${actualDamage} 点伤害。`
        );
        return actualDamage > 0;
      }
      case 'GainBlock': {
        const amount = Number(actionSpec.amount || 0);
        if (amount <= 0) return false;
        const targets = this.resolveEnemySideTargets(enemy, actionSpec.target, 'self');
        if (targets.length === 0) return false;
        for (const targetEnemy of targets) {
          combatSystem.gainBlock(state, 'enemy', targetEnemy.id, amount);
        }
        this.deps.appendVoxLog(`${enemy.name} 获得 ${amount} 点护盾。`);
        return true;
      }
      case 'ApplyStatus': {
        const status = String(actionSpec.status || '');
        const amount = Number(actionSpec.amount || 0);
        if (!status || amount <= 0) return false;
        const targetKey = String(actionSpec.target || 'Enemy');
        const targetType = targetKey !== 'Enemy' && targetKey !== 'Player' ? 'enemy' : 'player';
        const applied = this.applyEnemyActionStatus(enemy, actionSpec, status, amount);
        this.deps.appendVoxLog(
          targetType === 'enemy'
            ? `${enemy.name} 获得 ${amount} 层 ${status}。`
            : `${enemy.name} 对玩家施加 ${amount} 层 ${status}。`
        );
        return applied;
      }
      case 'ConditionalApply': {
        const passed = this.evaluateEnemyActionCondition(actionSpec.condition, enemy);
        const status = String(actionSpec.applyStatus || actionSpec.status || '');
        const amount = Number(actionSpec.amount || 0);
        if (!passed || !status || amount <= 0) return false;
        const targetKey = String(actionSpec.target || 'Enemy');
        const targetType = targetKey !== 'Enemy' && targetKey !== 'Player' ? 'enemy' : 'player';
        const applied = this.applyEnemyActionStatus(enemy, actionSpec, status, amount);
        this.deps.appendVoxLog(
          targetType === 'enemy'
            ? `${enemy.name} 在条件成立时获得 ${amount} 层 ${status}。`
            : `${enemy.name} 在条件成立时对玩家施加 ${amount} 层 ${status}。`
        );
        return applied;
      }
      case 'RemoveStatus': {
        const amount = Math.max(1, Number(actionSpec.amount || 1));
        const statuses = Array.isArray(actionSpec.status)
          ? actionSpec.status.map(String)
          : [String(actionSpec.status || '')].filter(Boolean);
        if (statuses.length === 0) return false;
        let remaining = amount;
        let removed = 0;
        for (const status of statuses) {
          if (remaining <= 0) break;
          const current = Math.max(0, Number(enemy.statuses[status] || 0));
          const delta = Math.min(current, remaining);
          if (delta <= 0) continue;
          const next = current - delta;
          if (next > 0) enemy.statuses[status] = next;
          else delete enemy.statuses[status];
          remaining -= delta;
          removed += delta;
        }
        return removed > 0;
      }
      case 'RemoveAnyDebuff': {
        const amount = Math.max(1, Number(actionSpec.amount || 1));
        const debuffs = ['Weak', 'Vulnerable', 'Poison', 'Burn', 'Frail', 'Fear'];
        let remaining = amount;
        let removed = 0;
        for (const status of debuffs) {
          if (remaining <= 0) break;
          const current = Math.max(0, Number(enemy.statuses[status] || 0));
          const delta = Math.min(current, remaining);
          if (delta <= 0) continue;
          const next = current - delta;
          if (next > 0) enemy.statuses[status] = next;
          else delete enemy.statuses[status];
          remaining -= delta;
          removed += delta;
        }
        return removed > 0;
      }
      case 'DamageBoost': {
        const amount = Number(actionSpec.amount || 0);
        if (amount <= 0) return false;
        combatSystem.applyStatus(state, 'enemy', enemy.id, 'Strength', amount);
        this.deps.appendVoxLog(`${enemy.name} damage boost +${amount}.`);
        return true;
      }
      case 'HealSelf': {
        const amount = Number(actionSpec.amount || 0);
        if (amount <= 0) return false;
        const before = enemy.hp;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
        this.deps.appendVoxLog(`${enemy.name} restores ${enemy.hp - before} HP.`);
        return enemy.hp > before;
      }
      case 'SummonEnemy': {
        const unit = String(actionSpec.unit || actionSpec.enemyId || '');
        const def = enemiesData.find(entry => entry.id === unit);
        if (!def || combat.enemies.length >= 5) return false;
        const baseHp = rollEnemyBaseHp(def, this.deps.rng);
        combat.enemies.push({
          id: `enemy_summon_${this.deps.generateId()}`,
          defId: def.id,
          name: def.name,
          hp: baseHp,
          maxHp: baseHp,
          block: 0,
          statuses: {},
          nextIntent: selectEnemyIntentForCombat(
            state,
            def,
            {
              id: 'enemy_summon_preview',
              hp: baseHp,
              maxHp: baseHp,
              block: 0,
              statuses: {},
              lastUsedIntent: null,
              nonAttackIntentStreak: 0,
            },
            combat.turn,
            this.deps.rng,
            {},
          ),
          lastUsedIntent: null,
          intentCooldowns: {},
          nonAttackIntentStreak: 0,
          summoned: true,
          devotion: 0,
          corruptionAxis: 0,
          axisDisposition: 'balanced',
        } as any);
        this.deps.appendVoxLog(`${enemy.name} summons ${def.name}.`);
        return true;
      }
      case 'Summon': {
        return this.executeEnemyActionSpec(enemy, { ...actionSpec, type: 'SummonEnemy', unit: actionSpec.enemyId || actionSpec.unit });
      }
      case 'Conditional': {
        if (!this.evaluateEnemyActionCondition(actionSpec.condition, enemy)) return false;
        let executed = false;
        for (const nested of actionSpec.trueActions || []) {
          executed = this.executeEnemyActionSpec(enemy, nested) || executed;
        }
        return executed;
      }
      case 'PredictorAction': {
        enemy.statuses.Predictor = Math.max(0, Number(enemy.statuses.Predictor || 0)) + 1;
        return true;
      }
      case 'Heal': {
        const amount = Number(actionSpec.amount || 0);
        if (amount <= 0) return false;
        const targets = this.resolveEnemySideTargets(enemy, actionSpec.target, 'self');
        for (const target of targets) {
          target.hp = Math.min(target.maxHp, target.hp + amount);
        }
        return targets.length > 0;
      }
      case 'LoseHP':
      case 'LoseHp': {
        const amount = Number(actionSpec.amount || 0);
        if (amount <= 0) return false;
        enemy.hp = Math.max(0, enemy.hp - amount);
        if (enemy.hp <= 0) {
          globalEventBus.publish({ type: 'EnemyDeath', enemyId: enemy.id } as any);
        }
        return true;
      }
      case 'PlayerDrawLess': {
        const amount = Math.max(1, Number(actionSpec.amount || 1));
        combat.player.statuses.DrawPenaltyNextTurn = Math.max(0, Number(combat.player.statuses.DrawPenaltyNextTurn || 0)) + amount;
        this.deps.appendVoxLog(`${enemy.name} reduces next draw by ${amount}.`);
        return true;
      }
      case 'RandomCardCostIncrease': {
        const amount = Math.max(1, Number(actionSpec.amount || 1));
        if (combat.hand.length === 0) return false;
        const index = Math.floor(this.deps.rng() * combat.hand.length);
        const card = normalizeRunCardInstance(combat.hand[index], () => this.deps.generateId());
        const currentCost = Math.max(0, Math.floor(Number(card.tempCost ?? card.cost ?? 0)));
        combat.hand[index] = deriveRunCardInstance({ ...card, tempCost: currentCost + amount });
        this.deps.appendVoxLog(`${enemy.name} increases a hand card cost by ${amount}.`);
        return true;
      }
      case 'OnDeath': {
        const effects = Array.isArray(actionSpec.effects)
          ? actionSpec.effects
          : actionSpec.effect
            ? [actionSpec.effect]
            : [];
        if (effects.length === 0) return false;
        (enemy as any).onDeathEffects = [...((enemy as any).onDeathEffects || []), ...effects];
        return true;
      }
      case 'RevealHand': {
        const amount = Math.max(1, Number(actionSpec.amount || 1));
        combat.player.statuses.HandRevealed = Math.max(0, Number(combat.player.statuses.HandRevealed || 0)) + amount;
        return true;
      }
      case 'SwapCards': {
        const amount = Math.max(1, Number(actionSpec.amount || 1));
        let swapped = 0;
        for (let i = 0; i < amount; i += 1) {
          if (combat.hand.length === 0) break;
          const handIndex = Math.floor(this.deps.rng() * combat.hand.length);
          const [removed] = combat.hand.splice(handIndex, 1);
          if (removed) combat.discardPile.push(removed);
          if (combat.drawPile.length === 0 && combat.discardPile.length > 0) {
            combat.drawPile = this.deps.shuffleDeck(combat.discardPile);
            combat.discardPile = [];
          }
          const replacement = combat.drawPile.pop();
          if (replacement) combat.hand.push(replacement);
          swapped += 1;
        }
        return swapped > 0;
      }
      case 'BuffAllEnemies': {
        const status = String(actionSpec.status || 'Strength');
        const amount = Number(actionSpec.amount || 0);
        if (!status || amount <= 0) return false;
        for (const ally of combat.enemies.filter((entry) => entry.hp > 0)) {
          combatSystem.applyStatus(state, 'enemy', ally.id, status, amount);
        }
        this.deps.appendVoxLog(`${enemy.name} 为敌方全体施加 ${amount} 层 ${status}。`);
        return true;
      }
      default:
        return false;
    }
  }

  async executeEnemyTurn(): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);

    for (const enemy of aliveEnemies) {
      if (enemy.hp <= 0) continue;
      enemy.block = 0;
      this.bossPhaseManager.refreshBossPhaseState();
      await this.bossPhaseManager.applyBossPhaseEnemyPrelude(enemy as any);
      if (!state.combat || state.screen !== 'Combat') return;
      if (this.processTurnStartDots('enemy', enemy.id)) {
        if (!state.combat || state.screen !== 'Combat') return;
        continue;
      }
      this.processStatusDecay(enemy.statuses);
      const platedArmor = Math.max(0, Math.floor(enemy.statuses['PlatedArmor'] || 0));
      if (platedArmor > 0) {
        enemy.block = Math.max(0, (enemy.block || 0) + platedArmor);
      }

      const enemyDef = enemiesData.find(e => e.id === enemy.defId);
      if (!enemyDef) continue;

      const intent = enemy.nextIntent || 'Attack';
      const move = enemyDef.moves?.[intent];

      if (move && Array.isArray(move)) {
        for (const actionSpec of move) {
          this.executeEnemyActionSpec(enemy, actionSpec);
          if (!state.combat || state.screen !== 'Combat') return;
          if (state.combat.player.hp <= 0) {
            this.handleCombatDefeat();
            return;
          }
        }
      }

      enemy.lastUsedIntent = intent;
      enemy.intentCooldowns = cooldownsReducer(enemy.intentCooldowns || {}, intent);
      enemy.nonAttackIntentStreak = intentTagger.isCategory(intent, 'attack')
        ? 0
        : Math.max(0, (enemy.nonAttackIntentStreak || 0) + 1);
      enemy.nextIntent = selectEnemyIntentForCombat(
        state,
        enemyDef,
        enemy,
        combat.turn,
        this.deps.rng,
        enemy.intentCooldowns,
      );
    }

    relicSystem.trigger('EndTurn', state, (actionOrSpec: any, ctx: IActionContext) => this.enqueueRelicAction(actionOrSpec, ctx));

    await this.actionManager.executeAll();
  }

  handleEnemyDefeated(enemyId: string): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const enemy = combat.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

    const onDeathEffects = (enemy as any).onDeathEffects;
    if (Array.isArray(onDeathEffects) && onDeathEffects.length > 0 && !(enemy as any).deathProcessed) {
      (enemy as any).deathProcessed = true;
      this.actionManager.enqueueAll(onDeathEffects, {
        source: enemy.id,
        sourceId: enemy.id,
        targetId: 'player',
      }, 0, 'system');
      this.actionManager.executeAll();
    }

    metricsTracker.recordEnemyDefeated(enemy.defId);

    const allEnemiesDefeated = combat.enemies.every(e => e.hp <= 0);
    if (allEnemiesDefeated && state.screen !== 'GameOver') {
      globalEventBus.publish({ type: 'CombatVictory' } as any);
    }
  }

  handleCombatVictory(): void {
    if (this.combatVictoryInProgress) return;
    const state = this.deps.getState();
    if (!state.combat) return;

    this.combatVictoryInProgress = true;
    try {
      this.executeStoredCombatEffects('endOfCombatEffects', 'victory');
      this.deps.syncPlayerStateFromCombat();

      const floor = this.deps.getCurrentFloorNumber();
      const rewards = (economySystem as any).calculateCombatRewards?.(floor, state.player.relics, 'Combat') ??
        { gold: economySystem.calculateGoldReward(floor, false, false), cardCount: 1 };

      metricsTracker.recordCombatVictory(floor);
      this.deps.clearCombatAfflictionsForRunCards();

      if (this.deps.tryDelegatedCompleteCombat()) {
        this.deps.notify();
        return;
      }

      state.player.gold += rewards.gold;
      state.rewardCards = this.deps.generateCardRewards(3);
      state.combat = null;
      state.combatRestartCheckpoint = undefined;
      this.deps.applyRunTransition({ type: 'COMBAT_WON' });
      this.deps.notify();
    } finally {
      this.combatVictoryInProgress = false;
    }
  }

  handleCombatDefeat(): void {
    if (this.playerDeathInProgress) return;
    const state = this.deps.getState();
    if (state.screen === 'GameOver') return;

    this.playerDeathInProgress = true;
    try {
      this.executeStoredCombatEffects('endOfCombatEffects', 'defeat');
      this.deps.clearCombatAfflictionsForRunCards();
      state.combatRestartCheckpoint = undefined;
      metricsTracker.recordRunEnd(false, this.deps.getCurrentFloorNumber());
      this.deps.applyRunTransition({ type: 'PLAYER_DIED' });
      globalEventBus.publish({
        type: 'PlayerDefeated',
        timestamp: Date.now()
      });
      this.deps.notify();
    } finally {
      this.playerDeathInProgress = false;
    }
  }

  processTurnStartDots(targetType: 'player' | 'enemy', targetId: string): boolean {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return false;
    const target = targetType === 'player'
      ? combat.player
      : combat.enemies.find(e => e.id === targetId);
    if (!target || target.hp <= 0) return false;

    const damageOverTimeStatuses = [
      { status: 'Poison', sourceId: 'poison' },
      { status: 'Burn', sourceId: 'burn' },
    ];

    for (const dot of damageOverTimeStatuses) {
      const stacks = Math.max(0, Math.floor(target.statuses[dot.status] || 0));
      if (stacks <= 0) continue;

      const damageContext: DamageContext = {
        amount: stacks,
        sourceType: 'system',
        sourceId: dot.sourceId,
        targetType,
        targetId,
        modifiers: [],
        isTrueDamage: true,
        ignoreBlock: true
      };
      combatSystem.applyDamage(state, damageContext);

      const nextStacks = Math.max(0, stacks - 1);
      if (nextStacks > 0) {
        target.statuses[dot.status] = nextStacks;
      } else {
        delete target.statuses[dot.status];
      }

      if (!state.combat || target.hp <= 0) return true;
    }

    return false;
  }

  tickDelayedCards(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || combat.player.delayedCards.length === 0) return;

    const ready: typeof combat.player.delayedCards = [];
    const pending: typeof combat.player.delayedCards = [];
    for (const delayed of combat.player.delayedCards) {
      const nextTurns = (delayed.turns ?? 0) - 1;
      if (nextTurns <= 0) ready.push({ ...delayed, turns: 0 });
      else pending.push({ ...delayed, turns: nextTurns });
    }
    combat.player.delayedCards = pending;

    for (const delayed of ready) {
      const delayAction = delayed.card?.actions?.find((a: any) => a.type === 'Delay');
      if (!delayAction?.actions?.length) continue;

      let targetId = delayed.targetId;
      if (targetId) {
        const target = combat.enemies.find(e => e.id === targetId && e.hp > 0);
        if (!target) {
          const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
          const randomEnemy = safeArrayAccess(aliveEnemies, Math.floor(this.deps.rng() * aliveEnemies.length));
          if (randomEnemy) {
            targetId = randomEnemy.id;
          } else {
            targetId = undefined;
          }
        }
      }

      for (const spec of delayAction.actions) {
        this.actionManager.enqueueUrgent(
          spec,
          {
            source: 'player',
            sourceId: 'player',
            targetId: targetId,
            card: delayed.card,
            cardId: delayed.card?.id,
            cardInstanceId: delayed.card?.instanceId
          },
          'system'
        );
      }
    }

    if (ready.length > 0) {
      this.triggerStartOfTurnEffects('DelayEffectTrigger', { amount: ready.length });
      combat.warpPulse = {
        text: `${ready.length > 1 ? `${ready.length} delayed effects` : (ready[0]?.card?.name || 'Delayed effect')} triggers`,
        tone: 'warp'
      };
    }
  }
}
