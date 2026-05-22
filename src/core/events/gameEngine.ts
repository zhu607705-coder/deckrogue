/**
 * @file gameEngine.ts
 * @description 核心游戏引擎 - 管理整个游戏状态和逻辑的中央协调器
 *
 * 主要职责:
 * - 游戏状态初始化和管理 (GameState)
 * - 随机数生成器 (RNG) 管理
 * - 动作处理系统 (ActionManager)
 * - 运行时委托 (RuntimeDelegate) - 将部分逻辑委托给 RuntimeV2 引擎
 * - 事件管理 (EventManager) - 处理游戏内事件
 * - 战斗管理 (CombatManager) - 协调战斗流程
 * - 运行流程管理 (RunFlowManager) - 管理单次运行的流程
 * - 存档/读档逻辑
 * - 角色选择、地图导航、商店、奖励等核心游戏逻辑
 *
 * 架构说明:
 * GameEngine 是旧引擎的核心，它协调多个子系统来处理游戏逻辑。
 * 当 RuntimeV2 委托启用时，部分逻辑（如启动和地图）会被委托给新引擎处理，
 * GameEngine 会同步两个引擎之间的状态。
 */
import { GameState, CardDef, RunCardInstance, MapNode, MetaProfile, CharacterDef } from '@/core/types';
import { createRNG, RNG } from '@/infrastructure/rng/rng';
import { globalEventBus } from '@/core/events/eventBus';
import { economySystem } from '@/features/progression/economySystem';
import { bindStateRng } from '@/infrastructure/rng/stateRandom';
import { unlockCodexEntry, unlockManyCodexEntries } from '@/core/persistence/codexStore';
import { ActionManager, createActionManager } from '@/core/actions/actionManager';
import { setupActionManager } from '@/core/actions/v2/ActionFactory';
import { normalizeRunCardInstance, deriveRunCardInstance, applyCombatAfflictionToInstance, clearCombatAfflictionsFromInstance } from '@/core/combat/runCardInstance';
import {
  cardsData,
  charactersData,
  relicsData,
  potionsData,
  getPotionRuntimeConfig,
  getCardEnchantmentDefById,
  resolveShopOfferPrice,
  syncRouteStateFromLegacyState,
} from '@/content/narrative/numericSystem';
import type { IActionContext } from '@/core/actions/actionQueue';
import { localCharacterArt } from '@/content/assets/standeeArt';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import { RuntimeEventType } from '@/core/events/eventContract';
import { metricsTracker } from '@/core/events/metricsTracker';
import {
  createDefaultGameEngineRuntimeDelegate,
  type GameEngineRuntimeDelegate,
  type GameEngineRuntimeDelegateDiagnostics,
  type GameEngineRuntimeDelegateOptions,
} from '@/core/events/runtimeDelegation';
import { EventManager } from '@/core/events/EventManager';
import { RunFlowManager } from '@/core/events/RunFlowManager';
import { CombatManager, type CombatManagerDeps } from '@/core/events/CombatManager';
import { MusicDispatcher } from '@/core/events/MusicDispatcher';
import { runPhaseToScreen } from '@/core/events/runStateMachine';

import { projectRuleSnapshotToLegacyState, type LegacyStateProjection } from '@/runtimeV2/legacyStateProjector';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import { COMBAT_NUMBERS } from '@/core/balance/numericConstants';
import { combatMemory } from '@/core/ai';
import { calculateRewardRuntime } from '@/core/balance/numericsRuntime';
import { combatSystem } from '@/core/combat/combatSystem';
import { cloneJsonValue } from '@/core/utils/safeJson';
import { relicSystem } from '@/features/relics/relicSystem';
import type { RunPhaseState } from '@/core/events/runStateMachine';
import {
  createRoomSessionForNode,
  setRoomSession,
  syncRoomSessionFromLegacyState,
} from '@/core/events/roomSession';
import { applySurfaceContext, syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import { RELIC_UPGRADE_CONFIGS } from '@/core/relic/RelicUpgrade';

export type {
  GameEngineRuntimeDelegate,
  GameEngineRuntimeDelegateDiagnostics,
  GameEngineRuntimeDelegateOptions,
} from '@/core/events/runtimeDelegation';

export class GameEngine {
  state: GameState;
  rng: RNG;
  listeners: (() => void)[] = [];
  private globalDisposables: Array<() => void> = [];
  private actionManager: ActionManager;
  private runtimeDelegate: GameEngineRuntimeDelegate | null;
  private readonly runtimeDelegateDiagnostics: GameEngineRuntimeDelegateDiagnostics;
  private disposed = false;

  private eventManager: EventManager;
  private runFlowManager: RunFlowManager;
  private combatManager: CombatManager;
  private musicDispatcher: import('@/core/events/MusicDispatcher').MusicDispatcher | null = null;

  constructor(seed?: number, metaProfile?: MetaProfile | null, options: GameEngineRuntimeDelegateOptions = {}) {
    this.state = this.createInitialState(seed);
    this.rng = createRNG(this.state.seed, this.state.rngState);
    bindStateRng(this.state, this.rng);
    economySystem.setRandomGenerator(this.rng);
    this.actionManager = createActionManager(this.state, {
      enableLogging: false,
      enableAnimationDelay: false
    });
    setupActionManager(this.actionManager);

    const delegatedSlices = options.delegatedSlices ?? ['boot_and_map'];
    const delegationEnabled = options.enableRuntimeDelegation !== false && delegatedSlices.includes('boot_and_map');
    this.runtimeDelegate = delegationEnabled ? (options.runtimeDelegate ?? createDefaultGameEngineRuntimeDelegate()) : null;
    this.runtimeDelegateDiagnostics = {
      enabled: delegationEnabled,
      delegatedSlices: delegationEnabled ? [...delegatedSlices] : [],
      source: this.runtimeDelegate ? 'runtime-v2-sync' : null,
      lastDelegatedCommand: null,
      fallbackCount: 0,
      lastFallbackReason: null,
    };
    this.runtimeDelegate?.start(this.state.seed);

    this.eventManager = new EventManager({
      getState: () => this.state,
      setState: (updater) => updater(this.state),
      rng: () => this.rng(),
      generateId: () => this.generateId(),
      createRuntimeCard: (card, instanceId) => this.createRuntimeCard(card, instanceId),
      ensureRunEffects: () => this.ensureRunEffects(),
      getCurrentFloorNumber: () => this.getCurrentFloorNumber(),
      leaveCurrentRoomToMap: () => this.leaveCurrentRoomToMap(),
      getAdjustedShopPrice: (basePrice) => this.getAdjustedShopPrice(basePrice),
      notify: () => this.notify(),
      appendVoxLog: (message) => this.appendVoxLog(message),
    });

    this.runFlowManager = new RunFlowManager({
      getState: () => this.state,
      setState: (updater) => updater(this.state),
      rng: () => this.rng(),
      generateId: () => this.generateId(),
      notify: () => this.notify(),
      shuffleDeck: <T>(deck: T[]): T[] => this.shuffleDeck(deck) as T[],
      getCurrentFloorNumber: () => this.getCurrentFloorNumber(),
      applyAscensionMapModifiers: () => this.applyAscensionMapModifiers(),
      selectCharacterLegacy: (characterId) => this.selectCharacterLegacyInternal(characterId),
      syncRuntimeFromLegacyState: (reason) => this.syncRuntimeDelegateFromLegacyState(reason),
      recordDelegationFallback: (reason) => this.recordDelegationFallback(reason),
      moveToNodeLegacy: (nodeId) => this.moveToNodeLegacyInternal(nodeId),
      canMoveToNode: (nodeId) => this.canMoveToNodeInternal(nodeId),
      getNode: (nodeId) => this.getNodeInternal(nodeId),
      resolveNodeEntry: (node) => this.resolveCurrentNodeEntryInternal(node),
      leaveCurrentRoomToMap: () => this.leaveCurrentRoomToMap(),
      enterCombat: (nodeType) => this.enterCombatInternal(nodeType),
      enterShop: () => this.enterShopInternal(),
      enterRest: () => this.enterRestInternal(),
      enterEvent: () => this.enterEventInternal(),
      createRuntimeCard: (card, instanceId) => this.createRuntimeCard(card, instanceId),
      getAdjustedShopPrice: (basePrice) => this.getAdjustedShopPrice(basePrice),
      appendVoxLog: (message) => this.appendVoxLog(message),
      generateCardRewards: (count, options) => this.eventManager.generateCardRewards(count, options),
      isEventFreeCardRemovalMode: () => this.eventManager.isEventFreeCardRemovalMode(),
      getEventFreeRemovalsRemaining: () => this.eventManager.getEventFreeRemovalsRemaining(),
    });

    const combatDeps: CombatManagerDeps = {
      getState: () => this.state,
      rng: () => this.rng(),
      generateId: () => this.generateId(),
      createRuntimeCard: (card, instanceId) => this.createRuntimeCard(card, instanceId),
      shuffleDeck: <T>(deck: T[]) => this.shuffleDeck(deck),
      syncRngState: () => this.syncRngState(),
      appendVoxLog: (message) => this.appendVoxLog(message),
      notify: () => this.notify(),
      getCurrentFloorNumber: () => this.getCurrentFloorNumber(),
      applyRunTransition: (action) => this.applyRunTransition(action as import('@/core/events/runStateMachine').RunAction),
      syncPlayerStateFromCombat: () => this.syncPlayerStateFromCombat(),
      clearCombatAfflictionsForRunCards: () => this.clearCombatAfflictionsForRunCards(),
      generateCardRewards: (count, options) => this.eventManager.generateCardRewards(count, options),
      tryDelegatedCompleteCombat: () => this.tryDelegatedCompleteCombat(),
      ensureRunEffects: () => this.ensureRunEffects(),
    };
    this.combatManager = new CombatManager(combatDeps, this.actionManager);

    this.musicDispatcher = new MusicDispatcher(this);
    this.setupEventListeners();
  }

  private createInitialState(seed?: number): GameState {
    const actualSeed = seed ?? systemRandomInt(1000000);
    return {
      seed: actualSeed,
      rngState: 0,
      runId: `run_${actualSeed}_${Date.now()}`,
      runStartedAt: Date.now(),
      character: null,
      player: {
        hp: 0,
        maxHp: 0,
        energy: 0,
        maxEnergy: 0,
        gold: 0,
        intel: 0,
        deck: [],
        relics: [],
        potions: [],
        corruption: 0,
        devotion: 0,
        relicStates: {},
        runEffects: {}
      },
      combat: null,
      map: [],
      currentNodeId: null,
      routeState: null,
      surfaceContext: null,
      roomSession: null,
      roomResolutionToken: null,
      roomResolutionKind: null,
      rewardCards: [],
      shopCards: [],
      shopRelics: [],
      shopPotions: [],
      cardRemovalCost: 75,
      screen: 'CharacterSelect',
      pendingNodeResolution: false,
      campfireChoiceLocked: false,
      metaRuntime: {
        unlockedPoolIds: [],
        appliedUpgradeIds: [],
        appliedPactIds: []
      },
      combatVoxLog: [],
      lastCombatVoxLog: [],
      lastDeathVoxLog: []
    };
  }

  private subscribeToGlobalEvent<T extends Record<string, unknown>>(eventType: string, listener: (event: T) => void): void {
    const unsubscribe = globalEventBus.subscribe(eventType, listener as (event: Record<string, unknown>) => void);
    this.globalDisposables.push(unsubscribe);
  }

  private setupEventListeners(): void {
    this.subscribeToGlobalEvent(RuntimeEventType.CombatStart, () => {
      this.resetCombatVoxLog();
      this.appendVoxLog('战区频道接入。鸟卜仪开始记录。');
    });

    this.subscribeToGlobalEvent<{ cardId?: string }>('CardPlayed', (event) => {
      const cardId = String(event?.cardId || '');
      const card = cardsData.find((c) => c.id === cardId);
      const cardName = card?.name || cardId || '未知指令';
      this.appendVoxLog(`执行指令：${cardName}。`);
    });

    this.subscribeToGlobalEvent<{ amount?: number; targetType?: string }>('DamageDealt', (event) => {
      const amount = Math.max(0, Math.floor(Number(event?.amount) || 0));
      if (amount <= 0) return;
      const targetType = String(event?.targetType || '');
      this.appendVoxLog(targetType === 'player'
        ? `装甲告警：生命值下降 ${amount}。`
        : `命中确认：目标遭受 ${amount} 点打击。`);
    });

    this.subscribeToGlobalEvent<{ amount?: number }>('BlockGained', (event) => {
      const amount = Math.max(0, Math.floor(Number(event?.amount) || 0));
      if (amount <= 0) return;
      this.appendVoxLog(`护盾重构：护盾值 +${amount}。`);
    });

    this.subscribeToGlobalEvent<{ status?: string; amount?: number; targetType?: string }>('StatusApplied', (event) => {
      const status = String(event?.status || 'Unknown');
      const amount = Math.max(0, Math.floor(Number(event?.amount) || 0));
      const targetType = event?.targetType === 'player' ? '本机' : '目标';
      const statusZh: Record<string, string> = {
        'Strength': '力量',
        'Weak': '虚弱',
        'Vulnerable': '易伤',
        'Poison': '中毒',
        'Block': '护盾',
        'Fear': '恐惧',
        'MartyrsVigor': '殉道者之力',
        'PlatedArmor': '板甲',
        'NextAttackDiscount': '下击折扣',
        'DoubleCastNextCard': '下牌双发',
        'DoubleDamageNextAttack': '下击双倍',
        'Electrified': '带电',
        'Devotion': '虔敬',
        'Corruption': '腐化'
      };
      const statusName = statusZh[status] || status;
      this.appendVoxLog(`状态注入：${targetType} ${statusName}${amount > 0 ? ` +${amount}` : ''}。`);
    });

    this.subscribeToGlobalEvent('DeckShuffled', () => {
      this.appendVoxLog('战术缓存重排完成。');
    });

    this.subscribeToGlobalEvent<{ enemyId?: string }>('EnemyDeath', (event) => {
      const enemy = this.state.combat?.enemies?.find((e) => e.id === event?.enemyId);
      if (enemy) {
        this.appendVoxLog(`目标沉默：${enemy.name} 信号消失。`);
      }
    });

    this.subscribeToGlobalEvent(RuntimeEventType.CombatVictory, () => {
      if (this.state.screen === 'GameOver' || this.state.screen === 'Victory') return;
      if (this.state.screen !== 'Combat' || !this.state.combat) return;
      this.appendVoxLog('战区清空。回收小队可推进。');
      this.snapshotCombatVoxLog();
      this.handleCombatVictory();
    });

    this.subscribeToGlobalEvent(RuntimeEventType.PlayerDeath, () => {
      this.appendVoxLog('生命体征归零。频道转入殉道归档。');
      this.snapshotDeathVoxLog();
      if (this.state.screen === 'GameOver') return;
      this.runFlowManager.handlePlayerDefeated();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    combatMemory.clear();
    this.combatManager.dispose();
    ActionManager.clearIfCurrent(this.actionManager);
    this.musicDispatcher?.dispose();
    this.musicDispatcher = null;
    this.runtimeDelegate?.dispose();
    this.globalDisposables.splice(0).forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        console.error('[GameEngine] Failed to dispose global subscription:', error);
      }
    });
    this.listeners = [];
    this.actionManager.clearQueue();
  }

  getRuntimeDelegationDiagnostics(): GameEngineRuntimeDelegateDiagnostics {
    return {
      ...this.runtimeDelegateDiagnostics,
      delegatedSlices: [...this.runtimeDelegateDiagnostics.delegatedSlices],
    };
  }

  private enqueueRelicAction(actionOrSpec: any, ctx: IActionContext): void {
    if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
      this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
    } else {
      this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
    }
  }

  private supportsBootAndMapDelegation(): boolean {
    return !!this.runtimeDelegate && this.runtimeDelegateDiagnostics.enabled && this.runtimeDelegateDiagnostics.delegatedSlices.includes('boot_and_map');
  }

  private recordDelegationFallback(reason: unknown): void {
    const detail = reason instanceof Error ? reason.message : String(reason);
    this.runtimeDelegateDiagnostics.fallbackCount += 1;
    this.runtimeDelegateDiagnostics.lastFallbackReason = detail;
  }

  private syncRuntimeDelegateFromLegacyState(command: string): void {
    if (!this.supportsBootAndMapDelegation()) return;
    try {
      const snapshot = normalizeLegacyGameState(this.state, this.getSaveData());
      this.runtimeDelegate!.loadSnapshot(snapshot);
      this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'load_snapshot';
    } catch (error) {
      this.recordDelegationFallback(error);
      this.runtimeDelegate = null;
      this.runtimeDelegateDiagnostics.enabled = false;
      this.runtimeDelegateDiagnostics.source = null;
      console.warn(`[GameEngine] Disabled runtime delegation after ${command}:`, error);
    }
  }

  private syncRuntimeDelegateAfterShopMutation(command: string): void {
    if (!this.supportsBootAndMapDelegation()) return;
    try {
      this.syncRuntimeDelegateFromLegacyState(command);
    } catch (error) {
      this.recordDelegationFallback(error);
    }
  }

  private restoreAuthoritativeStateSlice(snapshot: Partial<GameState>): void {
    const hasExplicitRouteState = 'routeState' in snapshot;
    const hasExplicitSurfaceContext = 'surfaceContext' in snapshot;
    const hasExplicitRoomSession = 'roomSession' in snapshot;
    const isEventFreeCardRemovalMode =
      this.eventManager.isEventFreeCardRemovalMode()
      || (
        snapshot.screen === 'RemoveCard'
        && !!snapshot.activeEvent
        && snapshot.activeEvent.stage === 'free_remove'
        && Number(snapshot.activeEvent.data?.freeRemovalsRemaining || 0) > 0
      );

    if ('pendingNodeResolution' in snapshot && typeof snapshot.pendingNodeResolution === 'boolean') {
      this.state.pendingNodeResolution = snapshot.pendingNodeResolution;
    }
    if ('roomResolutionToken' in snapshot) {
      this.state.roomResolutionToken = snapshot.roomResolutionToken ?? null;
    }
    if ('roomResolutionKind' in snapshot) {
      this.state.roomResolutionKind = snapshot.roomResolutionKind ?? null;
    }
    if ('upgradeReturnScreen' in snapshot) {
      this.state.upgradeReturnScreen = snapshot.upgradeReturnScreen;
    }
    if ('relicUpgradeReturnScreen' in snapshot) {
      this.state.relicUpgradeReturnScreen = snapshot.relicUpgradeReturnScreen;
    }
    if ('campfireChoiceLocked' in snapshot) {
      this.state.campfireChoiceLocked = !!snapshot.campfireChoiceLocked;
    }
    if ('pendingUpgradeRefund' in snapshot) {
      this.state.pendingUpgradeRefund = !!snapshot.pendingUpgradeRefund;
    }
    if ('enchantContext' in snapshot) {
      this.state.enchantContext = cloneJsonValue(snapshot.enchantContext, null as GameState['enchantContext']);
    }

    if (hasExplicitSurfaceContext) {
      applySurfaceContext(this.state, cloneJsonValue(snapshot.surfaceContext, null as GameState['surfaceContext']));
    } else {
      syncSurfaceContextFromLegacyState(this.state, { isEventFreeCardRemovalMode });
    }

    if (hasExplicitRoomSession) {
      setRoomSession(this.state, cloneJsonValue(snapshot.roomSession, null as GameState['roomSession']));
    } else {
      syncRoomSessionFromLegacyState(this.state, { isEventFreeCardRemovalMode });
    }

    if (hasExplicitRouteState) {
      this.state.routeState = cloneJsonValue(snapshot.routeState, null as GameState['routeState']);
    } else {
      syncRouteStateFromLegacyState(this.state);
    }
  }

  private formatVoxTimestamp(): string {
    const combat = this.state.combat;
    if (combat) {
      const turn = Math.max(1, Math.floor(Number(combat.turn || 1)));
      const phase = combat.isPlayerTurn ? 'P' : 'E';
      const seq = ((this.state.combatVoxLog?.length || 0) + 1).toString().padStart(2, '0');
      return `T${turn}${phase}-${seq}`;
    }
    const runSeq = ((this.state.lastCombatVoxLog?.length || 0) + (this.state.combatVoxLog?.length || 0) + 1)
      .toString()
      .padStart(3, '0');
    return `RUN-${runSeq}`;
  }

  private appendVoxLog(message: string): void {
    if (!message || typeof message !== 'string') return;
    const line = `${this.formatVoxTimestamp()} - ${message}`;
    const next = [...(this.state.combatVoxLog || []), line].slice(-80);
    this.state.combatVoxLog = next;
  }

  private resetCombatVoxLog(): void {
    this.state.combatVoxLog = [];
  }

  private snapshotCombatVoxLog(): void {
    this.state.lastCombatVoxLog = [...(this.state.combatVoxLog || [])].slice(-12);
  }

  private snapshotDeathVoxLog(): void {
    const tail = [...(this.state.combatVoxLog || [])].slice(-5);
    this.state.lastDeathVoxLog = tail;
    this.state.lastCombatVoxLog = [...(this.state.combatVoxLog || [])].slice(-12);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public notify(): void {
    if (this.disposed) return;
    this.listeners.forEach(l => l());
  }

  private createRuntimeCard(card: CardDef, instanceId?: string): RunCardInstance {
    return normalizeRunCardInstance(card, () => instanceId ?? this.generateId());
  }

  private normalizeDeckCards(): void {
    this.state.player.deck = this.state.player.deck.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
  }

  private normalizeCombatCards(): void {
    const combat = this.state.combat;
    if (!combat) return;
    combat.drawPile = combat.drawPile.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    combat.hand = combat.hand.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    combat.discardPile = combat.discardPile.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    combat.exhaustPile = combat.exhaustPile.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    combat.player.delayedCards = combat.player.delayedCards.map((entry) => ({
      ...entry,
      card: normalizeRunCardInstance(entry.card, () => this.generateId()),
    }));
    if (combat.player.lastPlayedCard) {
      combat.player.lastPlayedCard = normalizeRunCardInstance(combat.player.lastPlayedCard, () => this.generateId());
    }
    if (combat.bossPhase) {
      combat.bossPhase.currentPlayerTurnCards = combat.bossPhase.currentPlayerTurnCards.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
      combat.bossPhase.previousPlayerTurnCards = combat.bossPhase.previousPlayerTurnCards.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    }
  }

  private shuffleDeck<T>(deck: T[]): T[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private getCurrentNode(): MapNode | undefined {
    if (!this.state.currentNodeId) return undefined;
    return this.state.map.find(n => n.id === this.state.currentNodeId);
  }

  private getCurrentFloorNumber(): number {
    return (this.getCurrentNode()?.y ?? 0) + 1;
  }

  private ensureRunEffects(): Record<string, unknown> {
    if (!this.state.player.runEffects) {
      this.state.player.runEffects = {};
    }
    return this.state.player.runEffects;
  }

  private applyAscensionMapModifiers(): void {
    const meta = this.state.metaRuntime;
    if (!meta) return;

    const chance = Math.max(0, Math.min(0.9, Number(meta.ascensionEliteUpgradeChance || 0)));
    const delta = meta.ascensionMapWeightDelta || {};
    if (!chance && !delta.event && !delta.rest && !delta.elite && !delta.shop) return;
    if (!Array.isArray(this.state.map) || this.state.map.length === 0) return;

    const combatNodes: typeof this.state.map = [];
    const eventNodes: typeof this.state.map = [];
    const restNodes: typeof this.state.map = [];
    const eliteNodes: typeof this.state.map = [];
    const shopNodes: typeof this.state.map = [];

    for (const node of this.state.map) {
      if (!node) continue;
      if (node.type === 'Combat') combatNodes.push(node);
      else if (node.type === 'Event') eventNodes.push(node);
      else if (node.type === 'Rest') restNodes.push(node);
      else if (node.type === 'Elite') eliteNodes.push(node);
      else if (node.type === 'Shop') shopNodes.push(node);
    }

    const upgradeCombatToElite = () => {
      if (combatNodes.length === 0) return false;
      const idx = Math.floor(this.rng() * combatNodes.length);
      if (idx >= 0 && idx < combatNodes.length && combatNodes[idx]) {
        combatNodes[idx].type = 'Elite';
        eliteNodes.push(combatNodes.splice(idx, 1)[0]);
        return true;
      }
      return false;
    };

    const upgradeCombatToEvent = () => {
      if (combatNodes.length === 0) return false;
      const idx = Math.floor(this.rng() * combatNodes.length);
      if (idx >= 0 && idx < combatNodes.length && combatNodes[idx]) {
        combatNodes[idx].type = 'Event';
        eventNodes.push(combatNodes.splice(idx, 1)[0]);
        return true;
      }
      return false;
    };

    const downgradeRestToCombat = () => {
      const eligible = restNodes.filter(n => n.y > 0);
      if (eligible.length === 0) return false;
      const idx = Math.floor(this.rng() * eligible.length);
      const node = eligible[idx];
      if (node) {
        node.type = 'Combat';
        return true;
      }
      return false;
    };

    if (delta.elite > 0 && chance > 0) {
      for (let i = 0; i < Math.floor(delta.elite * 10); i++) {
        if (this.rng() < chance) upgradeCombatToElite();
      }
    }

    if (delta.event > 0) {
      for (let i = 0; i < Math.floor(delta.event * 10); i++) {
        upgradeCombatToEvent();
      }
    }

    if (delta.rest < 0) {
      for (let i = 0; i < Math.floor(-delta.rest * 10); i++) {
        downgradeRestToCombat();
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}_${this.rng().toString(36).slice(2, 11)}`;
  }

  getAdjustedShopPrice(basePrice: number): number {
    let multiplier = 1;
    if (this.state.player.relics.includes('lantern')) multiplier *= 0.95;
    return Math.max(1, Math.round(basePrice * multiplier));
  }

  private syncRngState(): void {
    if (this.rng.getState) {
      this.state.rngState = this.rng.getState();
    }
  }

  private canMoveToNodeInternal(nodeId: string): boolean {
    if (this.state.pendingNodeResolution) return false;
    const node = this.state.map.find((entry) => entry.id === nodeId);
    if (!node) return false;
    if (!this.state.currentNodeId && node.y !== 0) return false;
    const currentNode = this.state.map.find((entry) => entry.id === this.state.currentNodeId);
    return !currentNode || currentNode.next.includes(nodeId);
  }

  private getNodeInternal(nodeId: string): MapNode | null {
    return this.state.map.find((entry) => entry.id === nodeId) ?? null;
  }

  private resolveCurrentNodeEntryInternal(node: MapNode): void {
    this.runFlowManager.resolveCurrentNodeEntry(node);
  }

  private selectCharacterLegacyInternal(characterId: string): boolean {
    return this.runFlowManager.selectCharacterLegacy(characterId);
  }

  private moveToNodeLegacyInternal(nodeId: string): boolean {
    return this.runFlowManager.moveToNodeLegacy(nodeId);
  }

  private enterCombatInternal(nodeType: 'Combat' | 'Elite' | 'Boss'): void {
    this.combatManager.startCombat(nodeType);
  }

  private enterEventInternal(): void {
    this.eventManager.startEvent();
  }

  private enterShopInternal(): void {
    this.runFlowManager.enterShop();
  }

  private enterRestInternal(): void {
    this.state.screen = 'Rest';
  }

  private syncPlayerStateFromCombat(): void {
    const combat = this.state.combat;
    if (!combat) return;
    this.state.player.hp = combat.player.hp;
    this.state.player.block = combat.player.block;
  }

  clearCombatAfflictionsForRunCards(): void {
    const clearInstance = (card: RunCardInstance) => clearCombatAfflictionsFromInstance(normalizeRunCardInstance(card, () => this.generateId()));
    this.state.player.deck = this.state.player.deck.map((card) => clearInstance(card));
    const combat = this.state.combat;
    if (!combat) return;
    combat.drawPile = combat.drawPile.map((card) => clearInstance(card));
    combat.hand = combat.hand.map((card) => clearInstance(card));
    combat.discardPile = combat.discardPile.map((card) => clearInstance(card));
    combat.exhaustPile = combat.exhaustPile.map((card) => clearInstance(card));
  }

  private tryDelegatedCompleteCombat(): boolean {
    return false;
  }

  private reconcileProjectedRoomResolution(
    projection: Pick<LegacyStateProjection, 'screen' | 'pendingNodeResolution' | 'roomSession' | 'routeState' | 'surfaceContext'>
  ): void {
    this.state.routeState = projection.routeState
      ? {
          primaryTag: projection.routeState.primaryTag,
          secondaryTag: projection.routeState.secondaryTag,
          confidence: projection.routeState.confidence,
          stage: projection.routeState.stage,
          recentCommits: projection.routeState.recentCommits.map((commit) => ({ ...commit })),
        }
      : null;
    applySurfaceContext(this.state, projection.surfaceContext ?? null);

    if (!projection.pendingNodeResolution) {
      setRoomSession(this.state, null);
      return;
    }

    if (projection.roomSession) {
      setRoomSession(this.state, projection.roomSession);
      return;
    }

    const fallbackToken =
      this.state.roomSession?.token ??
      this.state.roomResolutionToken ??
      `legacy:${this.state.currentNodeId ?? projection.screen}`;
    setRoomSession(this.state, null);
    this.state.roomResolutionToken = fallbackToken;
    this.state.roomResolutionKind = null;
    this.state.screen = projection.screen;
    syncRoomSessionFromLegacyState(this.state, {
      isEventFreeCardRemovalMode: this.eventManager.isEventFreeCardRemovalMode(),
    });
  }

  private applyRunTransition(action: import('@/core/events/runStateMachine').RunAction): boolean {
    try {
      if (action.type === 'COMBAT_WON' && this.state.screen !== 'Combat') return true;
      return this.runFlowManager.applyRunTransition(action);
    } catch (error) {
      console.error('[GameEngine] Failed to apply run transition:', error);
      return false;
    }
  }

  selectCharacter(characterId: string): void {
    combatMemory.clear();
    if (!this.supportsBootAndMapDelegation()) {
      this.selectCharacterLegacyInternal(characterId);
      this.musicDispatcher?.onCharacterSelected(characterId);
      this.musicDispatcher?.onScreenChange(this.state.screen);
      this.notify();
      return;
    }
    try {
      const snapshot = this.runtimeDelegate!.selectCharacter(characterId);
      this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'select_character';
      const projection = projectRuleSnapshotToLegacyState(snapshot);
      const charDef = charactersData.find(c => c.id === projection.characterId);
      if (charDef) {
        this.state.character = charDef;
        this.state.player.maxEnergy = charDef.maxEnergy;
        this.state.player.energy = charDef.maxEnergy;
      }
      this.state.player.hp = projection.player.hp;
      this.state.player.maxHp = projection.player.maxHp;
      this.state.player.gold = projection.player.gold;
      this.state.player.intel = projection.player.intel;
      this.state.player.devotion = projection.player.devotion;
      this.state.player.corruption = projection.player.corruption;
      this.state.player.deck = projection.player.deckIds.map(cardId => {
        const def = cardsData.find(c => c.id === cardId);
        return def ? {
          ...def,
          instanceId: this.generateId(),
          baseCardId: def.id,
          runtimeBase: def,
          persistentEnchantments: [],
          combatAfflictions: [],
        } : null;
      }).filter(Boolean);
      this.state.player.relics = projection.player.relicIds;
      this.state.player.potions = projection.player.potionIds;
      this.state.map = projection.map;
      this.state.currentNodeId = projection.currentNodeId;
      this.state.screen = projection.screen;
      this.state.routeState = projection.routeState ?? null;
      applySurfaceContext(this.state, projection.surfaceContext ?? null);
      unlockManyCodexEntries('cards', this.state.player.deck.map((card) => card.id));
      this.musicDispatcher?.onCharacterSelected(projection.characterId ?? characterId);
      this.musicDispatcher?.onScreenChange(this.state.screen);
      this.notify();
    } catch (error) {
      this.recordDelegationFallback(error);
      this.selectCharacterLegacyInternal(characterId);
      this.notify();
    }
  }

  startCombat(nodeType: 'Combat' | 'Elite' | 'Boss'): void {
    this.combatManager.startCombat(nodeType);
    this.musicDispatcher?.onScreenChange(this.state.screen);
  }

  startTurn(): void {
    this.combatManager.startPlayerTurn();
  }

  async executeEnemyTurn(): Promise<void> {
    await this.combatManager.executeEnemyTurn();
    this.notify();
  }

  handleEnemyDefeated(enemyId: string): void {
    this.combatManager.handleEnemyDefeated(enemyId);
  }

  generateCardRewards(count: number, options?: { source?: 'combat' | 'shop' }): RunCardInstance[] {
    return this.eventManager.generateCardRewards(count, options);
  }

  startGame(): void {
    if (this.state.screen !== 'CharacterSelect') return;
    const selectedId = this.state.character?.id;
    if (selectedId) {
      this.selectCharacter(selectedId);
    }
  }

  moveToNode(nodeId: string): void {
    if (!this.runFlowManager.moveToNode(nodeId)) return;
    this.notify();
  }

  async playCard(cardInstanceId: string, targetId?: string): Promise<void> {
    await this.combatManager.playCard(cardInstanceId, targetId);
  }

  async endTurn(): Promise<void> {
    await this.combatManager.endTurn();
  }

  enterShop(): void {
    this.runFlowManager.enterShop();
    this.musicDispatcher?.onScreenChange(this.state.screen);
  }

  startEvent(): void {
    this.eventManager.startEvent();
    const eventId = (this.state as any).activeEvent?.id ?? null;
    if (eventId) {
      this.musicDispatcher?.onEventStart(eventId);
    }
    this.musicDispatcher?.onScreenChange(this.state.screen);
    this.notify();
  }

  buyCard(cardInstanceId: string): void {
    this.runFlowManager.buyCard(cardInstanceId);
    this.syncRuntimeDelegateAfterShopMutation('buy_card');
  }

  buyRelic(relicId: string): void {
    this.runFlowManager.buyRelic(relicId);
    this.syncRuntimeDelegateAfterShopMutation('buy_relic');
  }

  buyPotion(potionId: string): void {
    unlockCodexEntry('potions', potionId);
    this.runFlowManager.buyPotion(potionId);
    this.syncRuntimeDelegateAfterShopMutation('buy_potion');
  }

  removeCard(cardInstanceId: string): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        this.runtimeDelegate!.removeCard(cardInstanceId);
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'remove_card';
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    const isEventFreeCardRemovalMode = this.eventManager.isEventFreeCardRemovalMode();
    const nestedRoomRemovalKind = this.state.roomSession?.resolverKind ?? this.state.roomResolutionKind ?? null;
    const returnScreenAfterRemoval = this.state.upgradeReturnScreen;
    const shouldResolveRoomAfterRemoval =
      this.state.screen === 'RemoveCard'
      && (
        isEventFreeCardRemovalMode
        || nestedRoomRemovalKind === 'event'
        || nestedRoomRemovalKind === 'rest'
        || returnScreenAfterRemoval === 'Rest'
        || this.state.campfireChoiceLocked
      );
    const requiresPaidRemoval =
      this.state.screen === 'RemoveCard'
      && this.state.upgradeReturnScreen === 'Shop'
      && !isEventFreeCardRemovalMode;
    if (requiresPaidRemoval) {
      const removalCost = this.state.cardRemovalCost ?? 75;
      if (this.state.player.gold < removalCost) {
        return;
      }
      this.state.player.gold -= removalCost;
    }
    this.state.player.deck = this.state.player.deck.filter(c => c.instanceId !== cardInstanceId);
    syncRouteStateFromLegacyState(this.state);
    if (shouldResolveRoomAfterRemoval) {
      this.leaveCurrentRoomToMap();
      if (this.state.screen === 'Map' && !this.state.pendingNodeResolution) {
        this.state.upgradeReturnScreen = undefined;
      }
      return;
    }
    this.state.screen = returnScreenAfterRemoval || 'Map';
    this.state.upgradeReturnScreen = undefined;
    if (this.state.screen === 'Map') {
      this.leaveCurrentRoomToMap();
      return;
    }
    syncRoomSessionFromLegacyState(this.state, {
      isEventFreeCardRemovalMode,
    });
    this.notify();
  }

  restHeal(): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        this.runtimeDelegate!.rest();
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'rest';
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    const healAmount = Math.floor(this.state.player.maxHp * 0.3);
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmount);
    this.leaveCurrentRoomToMap();
  }

  restUpgrade(): void {
    this.runFlowManager.restUpgrade();
  }

  restDisperse(): void {
    this.runFlowManager.restDisperse();
  }

  restUpgradeRelic(): void {
    this.runFlowManager.restUpgradeRelic();
  }

  cancelRelicUpgrade(): void {
    if (this.state.relicUpgradeReturnScreen === 'Rest') {
      this.state.campfireChoiceLocked = false;
    }
    this.state.screen = this.state.relicUpgradeReturnScreen || 'Rest';
    this.state.relicUpgradeReturnScreen = undefined;
    syncRoomSessionFromLegacyState(this.state);
    syncSurfaceContextFromLegacyState(this.state);
    this.notify();
  }

  upgradeRelic(relicId: string): boolean {
    if (this.state.screen !== 'RelicUpgrade') {
      return false;
    }
    const upgradeInfo = this.getRelicUpgradeInfo(relicId);
    if (!upgradeInfo?.canUpgrade || !upgradeInfo.canAfford) {
      return false;
    }
    this.state.player.gold -= upgradeInfo.nextLevelCost;
    this.state.player.relicStates[relicId] = {
      level: upgradeInfo.currentLevel + 1,
      progress: this.state.player.relicStates[relicId]?.progress ?? 0,
      corrupted: false,
    };
    syncRoomSessionFromLegacyState(this.state);
    syncSurfaceContextFromLegacyState(this.state);
    this.notify();
    return true;
  }

  getRelicUpgradeInfo(relicId: string): any {
    const config = RELIC_UPGRADE_CONFIGS.find((entry) => entry.relicId === relicId);
    const relicState = this.state.player.relicStates[relicId];
    if (!config || !relicState) {
      return null;
    }
    const currentLevel = relicState.level ?? 1;
    const maxLevel = config.levels.at(-1)?.level ?? currentLevel;
    const nextLevel = config.levels.find((level) => level.level === currentLevel + 1) ?? null;
    return {
      currentLevel,
      maxLevel,
      canUpgrade: nextLevel !== null,
      canAfford: nextLevel !== null ? this.state.player.gold >= nextLevel.cost : false,
      nextLevelCost: nextLevel?.cost ?? 0,
      effectDescription: nextLevel
        ? Object.entries(nextLevel.effect.statBoost ?? {})
            .map(([stat, value]) => `${stat}: +${value}`)
            .join(', ') || nextLevel.effect.newAbility || '强化效果'
        : '已达满级',
    };
  }

  shopPurify(relicId: string): boolean {
    const purifyCost = 75;
    const playerGold = this.state.player.gold;

    if (playerGold < purifyCost) {
      return false;
    }

    const relicIndex = this.state.player.relics.indexOf(relicId);
    if (relicIndex === -1) {
      return false;
    }

    const relic = relicsData.find(r => r.id === relicId) as any;
    if (!relic?.corrupted) {
      return false;
    }

    this.state.player.gold -= purifyCost;
    this.state.player.relics.splice(relicIndex, 1);
    delete this.state.player.relicStates[relicId];

    if (relic.effect?.maxHpPenalty) {
      this.state.player.maxHp += relic.effect.maxHpPenalty;
      this.state.player.hp = Math.min(this.state.player.hp, this.state.player.maxHp);
    }

    this.notify();
    return true;
  }

  upgradeCard(cardInstanceId: string): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        this.runtimeDelegate!.upgradeCard(cardInstanceId);
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'upgrade_card';
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    const cardIndex = this.state.player.deck.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return;

    const card = normalizeRunCardInstance(this.state.player.deck[cardIndex], () => this.generateId());
    if (!card.upgrade || card.isUpgraded) return;

    const upgradedBase: CardDef = {
      ...card.runtimeBase,
      ...card.upgrade,
      id: card.id,
      isUpgraded: true
    };

    this.state.player.deck[cardIndex] = deriveRunCardInstance({
      ...card,
      isUpgraded: true,
      runtimeBase: upgradedBase
    });

    const fromRest = this.state.upgradeReturnScreen === 'Rest';
    this.state.screen = this.state.upgradeReturnScreen || 'Map';
    this.state.upgradeReturnScreen = undefined;
    if (fromRest) {
      this.leaveCurrentRoomToMap();
      return;
    }
    syncRoomSessionFromLegacyState(this.state);
    this.notify();
  }

  takeReward(cardInstanceId?: string): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        const card = cardInstanceId ? this.state.rewardCards.find(c => c.instanceId === cardInstanceId) : undefined;
        const cardId = card?.id;
        const snapshot = this.runtimeDelegate!.takeReward(cardId);
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'take_reward';
        const projection = projectRuleSnapshotToLegacyState(snapshot);
        this.state.screen = projection.screen;
        this.reconcileProjectedRoomResolution(projection);
        this.state.rewardCards = [];
        this.notify();
        return;
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    if (cardInstanceId) {
      const card = this.state.rewardCards.find(c => c.instanceId === cardInstanceId);
      if (card) {
        this.state.player.deck.push(this.createRuntimeCard(card));
        syncRouteStateFromLegacyState(this.state);
      }
    }

    this.state.rewardCards = [];
    this.leaveCurrentRoomToMap();
  }

  skipReward(): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        const snapshot = this.runtimeDelegate!.skipReward();
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'skip_reward';
        const projection = projectRuleSnapshotToLegacyState(snapshot);
        this.state.screen = projection.screen;
        this.reconcileProjectedRoomResolution(projection);
        this.state.rewardCards = [];
        this.notify();
        return;
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    this.state.rewardCards = [];
    this.leaveCurrentRoomToMap();
  }

  leaveCurrentRoomToMap(): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        const snapshot = this.runtimeDelegate!.leaveRoom();
        const projection = projectRuleSnapshotToLegacyState(snapshot);
        this.state.map = projection.map;
        this.state.currentNodeId = projection.currentNodeId;
        this.state.screen = projection.screen;
        this.reconcileProjectedRoomResolution(projection);
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'leave_room';
        this.musicDispatcher?.onEventEnd();
        this.musicDispatcher?.onScreenChange(this.state.screen);
        this.notify();
        return;
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    this.musicDispatcher?.onEventEnd();
    this.runFlowManager.leaveCurrentRoomToMap();
    this.musicDispatcher?.onScreenChange(this.state.screen);
  }

  restEnchant(): void {
    this.runFlowManager.restEnchant();
  }

  enterShopEnchant(): void {
    this.runFlowManager.enterShopEnchant();
  }

  applyEnchantment(cardInstanceId: string): boolean {
    const context = this.state.enchantContext;
    const enchantmentId = context?.enchantmentId;
    const applied = this.runFlowManager.applyEnchantment(cardInstanceId);
    if (!applied) return false;
    if (!enchantmentId) return applied;
    const enchantment = getCardEnchantmentDefById(enchantmentId);
    if (!enchantment || enchantment.scope !== 'persistent') return applied;
    this.state.player.deck = this.state.player.deck.map((card) => {
      if (card.instanceId !== cardInstanceId) return card;
      const runCard = normalizeRunCardInstance(card, () => this.generateId());
      return deriveRunCardInstance({
        ...runCard,
        persistentEnchantments: [...runCard.persistentEnchantments, enchantment],
      });
    });
    this.notify();
    return true;
  }

  cancelEnchant(): void {
    this.runFlowManager.cancelEnchant();
  }

  makeEventChoice(choice: 'accept' | 'decline'): void {
    this.eventManager.makeEventChoice(choice);
  }

  resolveEventChoice(choice: string): void {
    if (this.supportsBootAndMapDelegation()) {
      try {
        this.runtimeDelegate!.chooseEventOption(choice);
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'choose_event_option';
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    this.eventManager.resolveEventChoice(choice);
  }

  getSaveData(): object {
    const isEventFreeCardRemovalMode = this.eventManager.isEventFreeCardRemovalMode();
    syncRouteStateFromLegacyState(this.state);
    syncRoomSessionFromLegacyState(this.state, {
      isEventFreeCardRemovalMode,
    });
    return {
      state: this.state,
      rngState: this.state.rngState,
      metrics: (metricsTracker as any).getCurrentRunStats?.() ?? metricsTracker.getCurrentRunMetrics()
    };
  }

  loadSaveData(data: any): void {
    if (data.state) {
      this.state = data.state;
      this.state.runId ||= `run_${this.state.seed}_${Date.now()}`;
      this.state.runStartedAt ||= Date.now();
      this.state.metaRuntime ||= { unlockedPoolIds: [], appliedUpgradeIds: [], appliedPactIds: [] };
      this.rng = createRNG(this.state.seed, this.state.rngState);
      bindStateRng(this.state, this.rng);
      economySystem.setRandomGenerator(this.rng);
      this.normalizeDeckCards();
      this.state.rewardCards = (this.state.rewardCards || []).map((card) => normalizeRunCardInstance(card, () => this.generateId()));
      this.state.shopCards = (this.state.shopCards || []).map((card) => normalizeRunCardInstance(card, () => this.generateId()));
      this.normalizeCombatCards();
      this.actionManager.updateState(this.state);
      this.restoreAuthoritativeStateSlice(this.state);
    }
    this.syncRuntimeDelegateFromLegacyState('load_snapshot');
    this.notify();
  }

  enterNode(nodeId: string): void {
    this.moveToNode(nodeId);
  }

  revealNode(nodeId: string): void {
    if (this.state.player.intel <= 0) return;
    const node = this.state.map.find(n => n.id === nodeId);
    if (!node || node.revealed) return;
    node.revealed = true;
    this.state.player.intel -= 1;
    this.notify();
  }

  enterUpgrade(returnScreen?: 'Rest' | 'Shop'): void {
    if (this.state.screen === 'Rest') {
      if (this.state.campfireChoiceLocked) return;
      this.state.campfireChoiceLocked = true;
    }
    if (returnScreen) {
      this.state.upgradeReturnScreen = returnScreen;
    } else if (!this.state.upgradeReturnScreen) {
      this.state.upgradeReturnScreen = this.state.screen === 'Shop' ? 'Shop' : 'Rest';
    }

    if (this.state.screen === 'Shop') {
      if (this.state.player.gold < 50) return;
      this.state.player.gold -= 50;
      this.state.pendingUpgradeRefund = true;
    }

    this.state.screen = 'Upgrade';
    syncRoomSessionFromLegacyState(this.state);
    this.notify();
  }

  cancelUpgrade(): void {
    if (this.state.pendingUpgradeRefund) {
      this.state.player.gold += 50;
      this.state.pendingUpgradeRefund = false;
    }
    if (this.state.upgradeReturnScreen === 'Rest') {
      this.state.campfireChoiceLocked = false;
    }
    this.state.screen = this.state.upgradeReturnScreen || 'Map';
    this.state.upgradeReturnScreen = undefined;
    syncRoomSessionFromLegacyState(this.state);
    syncSurfaceContextFromLegacyState(this.state);
    this.notify();
  }

  enterCardRemoval(): void {
    if (!this.eventManager.isEventFreeCardRemovalMode()) {
      if (this.state.screen === 'Shop') {
        this.state.upgradeReturnScreen = 'Shop';
      } else if (this.state.screen === 'Rest') {
        this.state.upgradeReturnScreen = 'Rest';
      }
    }
    this.state.screen = 'RemoveCard';
    syncRoomSessionFromLegacyState(this.state, {
      isEventFreeCardRemovalMode: this.eventManager.isEventFreeCardRemovalMode(),
    });
    syncSurfaceContextFromLegacyState(this.state, {
      isEventFreeCardRemovalMode: this.eventManager.isEventFreeCardRemovalMode(),
    });
    this.notify();
  }

  cancelCardRemoval(): void {
    if (this.eventManager.isEventFreeCardRemovalMode()) {
      this.state.screen = 'Event';
      syncRoomSessionFromLegacyState(this.state, { isEventFreeCardRemovalMode: true });
      syncSurfaceContextFromLegacyState(this.state, { isEventFreeCardRemovalMode: true });
      this.notify();
      return;
    }
    this.state.screen = this.state.campfireChoiceLocked ? 'Rest' : 'Shop';
    syncRoomSessionFromLegacyState(this.state);
    syncSurfaceContextFromLegacyState(this.state);
    this.notify();
  }

  getEventFreeRemovalsRemaining(): number {
    return this.eventManager.getEventFreeRemovalsRemaining();
  }

  handleCombatVictory(): void {
    if (this.state.screen !== 'Combat' || !this.state.combat) return;
    if (this.supportsBootAndMapDelegation()) {
      try {
        const snapshot = this.runtimeDelegate!.completeCombat();
        this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'complete_combat';
        const projection = projectRuleSnapshotToLegacyState(snapshot);
        this.state.player.gold = projection.player.gold;
        this.state.screen = projection.screen;
        this.state.pendingNodeResolution = projection.pendingNodeResolution;
        this.state.map = projection.map;
        this.state.currentNodeId = projection.currentNodeId;
        this.reconcileProjectedRoomResolution(projection);
        if (snapshot.reward?.cardIds) {
          this.state.rewardCards = snapshot.reward.cardIds.map(cardId => {
            const def = cardsData.find(c => c.id === cardId);
            return def ? {
              ...def,
              instanceId: this.generateId(),
              baseCardId: def.id,
              runtimeBase: def,
              persistentEnchantments: [],
              combatAfflictions: [],
            } : null;
          }).filter(Boolean);
        }
        this.state.combat = null;
        this.state.combatRestartCheckpoint = undefined;
        this.notify();
        return;
      } catch (error) {
        this.recordDelegationFallback(error);
      }
    }
    relicSystem.trigger('CombatEnd', this.state, (actionOrSpec: any, ctx: IActionContext) => this.enqueueRelicAction(actionOrSpec, ctx), {
      victory: true,
    });
    this.actionManager.executeAll();
    this.state.rewardCards = this.eventManager.generateCardRewards(3, { source: 'combat' });
    const currentNode = this.getCurrentNode();
    const floor = currentNode ? currentNode.y + 1 : 1;
    const nodeType = currentNode?.type ?? 'Combat';
    const reward = calculateRewardRuntime(floor, { isBoss: nodeType === 'Boss', isElite: nodeType === 'Elite' });
    this.state.player.gold += reward.gold;
    if (!this.state.roomSession && this.state.currentNodeId) {
      setRoomSession(this.state, createRoomSessionForNode({
        token: this.state.roomResolutionToken ?? `legacy:${this.state.currentNodeId}`,
        nodeId: this.state.currentNodeId,
        ownerKind: 'combat',
      }));
    }
    this.runFlowManager.handleCombatVictory();
  }

  pickRewardCard(cardInstanceId: string): void {
    this.takeReward(cardInstanceId);
  }

  buyShopCard(cardInstanceId: string, basePrice?: number): void {
    const shopCard = this.state.shopCards.find((card) => card.instanceId === cardInstanceId);
    if (!shopCard) {
      return;
    }

    const resolvedBasePrice = resolveShopOfferPrice(
      'card',
      typeof basePrice === 'number'
        ? basePrice
        : shopCard.rarity === 'Rare'
          ? 150
          : shopCard.rarity === 'Uncommon'
            ? 75
            : 50,
    );
    const price = this.getAdjustedShopPrice(resolvedBasePrice);
    this.runFlowManager.buyCard(cardInstanceId, price);
    this.syncRuntimeDelegateAfterShopMutation('buy_shop_card');
  }

  buyShopRelic(relicId: string, basePrice?: number): void {
    const relic = (relicsData as any[]).find(r => r.id === relicId);
    if (!relic || this.state.player.relics.includes(relicId)) return;
    const price = this.getAdjustedShopPrice(resolveShopOfferPrice('relic', basePrice ?? relic.price));
    this.runFlowManager.buyRelic(relicId, price);
    this.syncRuntimeDelegateAfterShopMutation('buy_shop_relic');
  }

  buyShopPotion(potionId: string, basePrice?: number, _index?: number): void {
    if (this.state.player.potions.length >= getPotionRuntimeConfig().slotLimit) return;
    const potion = (potionsData as any[]).find(p => p.id === potionId);
    if (!potion) return;
    unlockCodexEntry('potions', potionId);
    const price = this.getAdjustedShopPrice(resolveShopOfferPrice('potion', basePrice ?? potion.price));
    this.runFlowManager.buyPotion(potionId, price);
    this.syncRuntimeDelegateAfterShopMutation('buy_shop_potion');
  }

  mixPotions(indexA: number, indexB: number): boolean {
    if (indexA === indexB) return false;
    if (this.state.screen === 'Rest' && this.state.campfireChoiceLocked) return false;
    const ids = this.state.player.potions;
    if (!ids[indexA] || !ids[indexB]) return false;

    const next = ids.filter((_, idx) => idx !== indexA && idx !== indexB);
    const result = (potionsData as any[]).find(p => p.id === 'mutagenic_draft')?.id || 'mutagenic_draft';
    next.push(result);
    this.state.player.potions = next.slice(0, 3);
    if (this.state.screen === 'Rest') {
      this.state.campfireChoiceLocked = true;
      this.leaveCurrentRoomToMap();
    } else {
      this.notify();
    }
    return true;
  }

  getEnchantPreview(cardInstanceId: string): CardDef | null {
    return this.runFlowManager.getEnchantPreview(cardInstanceId);
  }

  usePotion(index: number): void {
    const combat = this.state.combat;
    const potions = this.state.player.potions;
    if (index < 0 || index >= potions.length) return;
    const potionId = potions[index];
    if (!combat || potionId == null) return;
    unlockCodexEntry('potions', potionId);

    const potion = (potionsData as any[]).find(p => p.id === potionId) as any;
    if (!potion) return;

    const toxicity = potion.toxicity ?? 1;
    combat.player.potionToxicity = (combat.player.potionToxicity || 0) + toxicity;
    combat.player.potionsUsedThisTurn = (combat.player.potionsUsedThisTurn || 0) + 1;

    const effect = potion.effect || {};
    switch (effect.type) {
      case 'Heal':
        combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + Math.round(combat.player.maxHp * (effect.amount ?? 0)));
        this.state.player.hp = combat.player.hp;
        break;
      case 'GainBlock':
        combat.player.block += effect.amount ?? 0;
        combat.player.blockGainedThisTurn = Math.max(0, Number(combat.player.blockGainedThisTurn || 0)) + Math.max(0, Number(effect.amount ?? 0));
        if ((effect.amount ?? 0) > 0) {
          globalEventBus.publish({ type: 'BlockGained', targetType: 'player', targetId: 'player', amount: effect.amount ?? 0 } as any);
        }
        break;
      case 'GainEnergy':
        combat.player.energy += effect.amount ?? 0;
        break;
      case 'ApplyStatus':
        if (effect.target === 'Self') {
          combat.player.statuses[effect.status] = (combat.player.statuses[effect.status] || 0) + (effect.amount ?? 0);
        }
        break;
      case 'ComboBrew':
        combat.player.statuses['DoubleCastNextCard'] = 1;
        break;
      case 'SacrificialElixir':
        combat.player.hp = Math.max(1, combat.player.hp - 15);
        this.state.player.hp = combat.player.hp;
        combat.player.energy += 3;
        combat.player.statuses['Strength'] = (combat.player.statuses['Strength'] || 0) + 3;
        break;
      case 'DiceWater': {
        const roll = 1 + Math.floor(this.rng() * 6);
        combat.player.energy += roll;
        this.combatManager.drawCards(Math.max(0, 7 - roll));
        break;
      }
      case 'LiquidLightning':
        combat.player.energy += 3;
        combat.player.statuses['Electrified'] = 1;
        break;
      case 'MutagenicDraft':
        combat.player.energy += 2;
        combat.player.block += 8;
        combat.player.blockGainedThisTurn = Math.max(0, Number(combat.player.blockGainedThisTurn || 0)) + 8;
        globalEventBus.publish({ type: 'BlockGained', targetType: 'player', targetId: 'player', amount: 8 } as any);
        combat.player.statuses['Strength'] = (combat.player.statuses['Strength'] || 0) + 2;
        combat.player.statuses['Poison'] = (combat.player.statuses['Poison'] || 0) + 2;
        break;
      default:
        break;
    }

    this.state.player.potions.splice(index, 1);
    this.notify();
  }

  loadCharacterPortrait(): string {
    const id = this.state.character?.id || 'informant';
    const url = localCharacterArt(id);
    this.state.player.portraitUrl = url;
    return url;
  }

  calculateDamage(
    baseDamage: number,
    sourceStatuses: Record<string, number> = {},
    targetStatuses: Record<string, number> = {},
    sourceType: 'player' | 'enemy' | 'system' = 'player'
  ): number {
    return combatSystem.calculateEffectiveDamage(this.state, baseDamage, sourceStatuses, targetStatuses, sourceType);
  }

  getWarpEffectiveAlpha(alpha?: number): number {
    const combat = this.state.combat;
    const baseAlpha = typeof alpha === 'number' ? alpha : (combat?.warpAlpha ?? 0.5);
    const multiplier = combat?.warpRiftTurns && (combat.warpRiftTurns > 0) ? (combat.warpRiftAlphaMultiplier || 1) : 1;
    return baseAlpha * multiplier;
  }

  getWarpPowerMultiplier(warpTide: number, alpha?: number): number {
    const a = typeof alpha === 'number' ? alpha : this.getWarpEffectiveAlpha();
    const W = Math.max(0, Math.min(100, warpTide));
    return 1 + a * Math.pow(W / 100, 2);
  }

  getWarpPerilChance(warpTide: number, k?: number): number {
    const sensitivity = typeof k === 'number' ? k : (this.state.combat?.warpPerilK ?? 0.05);
    const W = Math.max(0, Math.min(100, warpTide));
    return 1 / (1 + Math.exp(-sensitivity * (W - 50)));
  }

  getCorruptionDamageBonusMultiplier(): number {
    const corruption = Math.max(
      COMBAT_NUMBERS.corruption.min,
      Math.min(COMBAT_NUMBERS.corruption.max, this.state.player.corruption || 0)
    );
    return 1 + Math.min(COMBAT_NUMBERS.corruption.damageBonusCap, corruption * COMBAT_NUMBERS.corruption.bonusPerPoint);
  }

  restartCombatFromCheckpoint(): boolean {
    const checkpoint = this.state.combatRestartCheckpoint;
    if (!checkpoint) return false;
    const snapshot = cloneJsonValue(checkpoint.stateSnapshot, {} as Partial<GameState>);

    this.state.map = snapshot.map ?? this.state.map;
    this.state.currentNodeId = snapshot.currentNodeId ?? checkpoint.nodeId;
    this.state.screen = snapshot.screen ?? 'Map';
    this.state.roomSession = snapshot.roomSession ?? this.state.roomSession ?? null;
    this.state.player = snapshot.player ? { ...this.state.player, ...snapshot.player } : this.state.player;
    this.state.rewardCards = snapshot.rewardCards ?? [];
    this.state.shopCards = snapshot.shopCards ?? [];
    this.state.shopRelics = snapshot.shopRelics ?? [];
    this.state.shopPotions = snapshot.shopPotions ?? [];
    this.state.cardRemovalCost = snapshot.cardRemovalCost ?? this.state.cardRemovalCost;
    this.state.combat = null;
    this.state.rngState = checkpoint.rngState;
    this.rng = createRNG(this.state.seed, this.state.rngState);
    bindStateRng(this.state, this.rng);
    economySystem.setRandomGenerator(this.rng);
    this.restoreAuthoritativeStateSlice(snapshot);
    this.combatManager.startCombat(checkpoint.nodeType);
    return this.state.screen === 'Combat' && !!this.state.combat;
  }

  applyEnemyCardAffliction(enemyId: string): boolean {
    const combat = this.state.combat;
    if (!combat) return false;
    const enemy = combat.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) return false;
    const afflictionId =
      enemy.defId === 'lagavulin' ? 'dampened_edge' :
      enemy.defId === 'cultist' ? 'sundered_guard' :
      'hex_tax';
    const affliction = getCardEnchantmentDefById(afflictionId);
    if (!affliction || affliction.scope !== 'combat') return false;
    const pickTarget = (): RunCardInstance | undefined =>
      combat.hand[0] ?? combat.drawPile[0] ?? combat.discardPile[0] ?? combat.exhaustPile[0];
    const target = pickTarget();
    if (!target?.instanceId) return false;
    const applyToCollection = (cards: RunCardInstance[]) =>
      cards.map((card) => card.instanceId === target.instanceId ? applyCombatAfflictionToInstance(normalizeRunCardInstance(card, () => this.generateId()), affliction) : card);
    this.state.player.deck = applyToCollection(this.state.player.deck);
    combat.hand = applyToCollection(combat.hand);
    combat.drawPile = applyToCollection(combat.drawPile);
    combat.discardPile = applyToCollection(combat.discardPile);
    combat.exhaustPile = applyToCollection(combat.exhaustPile);
    this.notify();
    return true;
  }

  isEventFreeCardRemovalMode(): boolean {
    return this.eventManager.isEventFreeCardRemovalMode();
  }

  getCardRemovalCostForCard(card: CardDef | { tags?: string[] }): number {
    return this.eventManager.getCardRemovalCostForCard(card);
  }
}
