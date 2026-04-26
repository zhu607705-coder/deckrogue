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
import { GameState, CardDef, RunCardInstance } from '@/core/types';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import {
  applyCombatAfflictionToInstance,
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

  constructor(private deps: CombatManagerDeps, private actionManager: ActionManager) {
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
    relicSystem.trigger('CombatStart', state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });
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
    if (combat.turn > 1) {
      combat.player.block = 0;
    }
    combat.player.cardsPlayedThisTurn = 0;
    combat.player.potionsUsedThisTurn = 0;
    const playerTurnFlags = combat.player as typeof combat.player & { resourceSpentThisTurn?: number; elementsAddedThisTurn?: number };
    playerTurnFlags.resourceSpentThisTurn = 0;
    playerTurnFlags.elementsAddedThisTurn = 0;

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
    this.tickDelayedCards();
    if (!skipDrawThisTurn) {
      this.drawCards(5);
    }

    this.actionManager.updateState(state);
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
      }
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

    const card = combat.hand[cardIndex];

    unlockCodexEntry('cards', card.id);

    if (combat.player.energy < card.cost) {
      return;
    }

    combat.player.energy -= card.cost;
    combat.hand.splice(cardIndex, 1);
    combat.discardPile.push(card);
    combat.player.cardsPlayedThisTurn++;
    combat.player.lastPlayedCard = card;

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

  private evaluateEnemyActionCondition(condition: Record<string, any> | undefined): boolean {
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
      default:
        return false;
    }
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
        const passed = this.evaluateEnemyActionCondition(actionSpec.condition);
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
        combatSystem.gainBlock(state, 'enemy', enemy.id, amount);
        this.deps.appendVoxLog(`${enemy.name} 获得 ${amount} 点护盾。`);
        return true;
      }
      case 'ApplyStatus': {
        const status = String(actionSpec.status || '');
        const amount = Number(actionSpec.amount || 0);
        if (!status || amount <= 0) return false;
        const targetType = actionSpec.target === 'Self' ? 'enemy' : 'player';
        const targetId = targetType === 'enemy' ? enemy.id : 'player';
        combatSystem.applyStatus(state, targetType, targetId, status, amount);
        this.deps.appendVoxLog(
          targetType === 'enemy'
            ? `${enemy.name} 获得 ${amount} 层 ${status}。`
            : `${enemy.name} 对玩家施加 ${amount} 层 ${status}。`
        );
        return true;
      }
      case 'ConditionalApply': {
        const passed = this.evaluateEnemyActionCondition(actionSpec.condition);
        const status = String(actionSpec.applyStatus || actionSpec.status || '');
        const amount = Number(actionSpec.amount || 0);
        if (!passed || !status || amount <= 0) return false;
        const targetType = actionSpec.target === 'Self' ? 'enemy' : 'player';
        const targetId = targetType === 'enemy' ? enemy.id : 'player';
        combatSystem.applyStatus(state, targetType, targetId, status, amount);
        this.deps.appendVoxLog(
          targetType === 'enemy'
            ? `${enemy.name} 在条件成立时获得 ${amount} 层 ${status}。`
            : `${enemy.name} 在条件成立时对玩家施加 ${amount} 层 ${status}。`
        );
        return true;
      }
      case 'BuffAllEnemies': {
        const status = String(actionSpec.status || '');
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

    relicSystem.trigger('EndTurn', state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });

    await this.actionManager.executeAll();
  }

  handleEnemyDefeated(enemyId: string): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const enemy = combat.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

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
      combat.warpPulse = {
        text: `${ready.length > 1 ? `${ready.length} delayed effects` : (ready[0]?.card?.name || 'Delayed effect')} triggers`,
        tone: 'warp'
      };
    }
  }
}
