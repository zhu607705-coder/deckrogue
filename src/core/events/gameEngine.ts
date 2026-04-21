/**
 * @deprecated Compatibility implementation.
 * Prefer importing runtime entrypoints from '@/core/persistence/setup' and domain modules under '@/core/*' and '@/features/*'.
 */
import { GameState, ActionSpec, CardDef, RunCardInstance, MapNode, ActiveEventState, MetaProfile, CharacterDef } from '@/core/types';
import { createRNG } from '@/infrastructure/rng/rng';
import { globalEventBus } from '@/core/events/eventBus';
import { relicSystem } from '@/features/relics/relicSystem';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import {
  applyCombatAfflictionToInstance,
  applyPersistentEnchantmentToInstance,
  clearCombatAfflictionsFromInstance,
  createRunCardInstance,
  deriveRunCardInstance,
  isRunCardInstance,
  normalizeRunCardInstance
} from '@/core/combat/runCardInstance';
import { balanceSystem } from '@/core/balance/balanceSystem';
import { evaluationSystem } from '@/core/balance/evaluationSystem';
import { synergySystem } from '@/features/synergies/synergySystem';
import { economySystem } from '@/features/progression/economySystem';
import { runGenerator } from '@/core/events/runGenerator';
import { metricsTracker } from '@/core/events/metricsTracker';
import { COMBAT_NUMBERS } from '@/core/balance/numericConstants';
import { bindStateRng } from '@/infrastructure/rng/stateRandom';
import { applyMetaProfileToNewRunState } from '@/core/persistence/metaInjection';
import { getMetaUnlockedWeightBonus } from '@/core/balance/metaBalance';
import { unlockCodexEntry, unlockManyCodexEntries } from '@/core/persistence/codexStore';
import { ActionManager, createActionManager } from '@/core/actions/actionManager';
import { setupActionManager } from '@/core/actions/v2/ActionFactory';
import { TargetingService } from '@/core/combat/targetingService';
import { getBossPhaseEncounter, getBossPhaseForHpPct } from '@/core/events/bossPhaseSystem';
import {
  STORY_EVENTS,
  applyEnemyHpTuningByNumericRules,
  calculateStoryEventNumbers,
  cardsData,
  enemiesData,
  getSingleSlimeRoomBoostConfig,
  getCardEnchantmentDefById,
  getPotionRuntimeConfig,
  getStoryEventDef,
  getStoryEventSelectionWeight,
  isEnemyEligibleForFloorByNumericRules,
  potionsData,
  relicsData,
  rollEnemyBaseHp
} from '@/content/narrative/numericSystem';
import type { IActionContext } from '@/core/actions/actionQueue';
import charactersDataRaw from '@/content/data/characters.json';
const charactersData = charactersDataRaw as CharacterDef[];
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import { RuntimeEventType } from '@/core/events/eventContract';
import { deriveRunTransitionState, runPhaseToScreen, transitionRunState, type RunAction } from '@/core/events/runStateMachine';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import { projectRuleSnapshotToLegacyState } from '@/runtimeV2/legacyStateProjector';
import type { RuleSnapshot } from '@/runtimeV2/contracts';
import { GameFlowOrchestrator } from '@/core/runtimeKernel/gameFlowOrchestrator';
import {
  CombatRoomBridge,
  createRoomBridgeRegistry,
  EventRoomBridge,
  RestRoomBridge,
  RewardRoomBridge,
  ShopRoomBridge,
  type RoomBridgeContext,
  type RoomBridgeSelectionContext,
} from '@/core/runtimeKernel/roomBridge';
import {
  createDefaultGameEngineRuntimeDelegate,
  type GameEngineRuntimeDelegate,
  type GameEngineRuntimeDelegateDiagnostics,
  type GameEngineRuntimeDelegateOptions,
} from '@/core/events/runtimeDelegation';

export type {
  GameEngineRuntimeDelegate,
  GameEngineRuntimeDelegateDiagnostics,
  GameEngineRuntimeDelegateOptions,
} from '@/core/events/runtimeDelegation';

export class GameEngine {
  state: GameState;
  rng: () => number;
  listeners: (() => void)[] = [];
  private globalDisposables: Array<() => void> = [];
  private actionManager: ActionManager;
  private readonly metaProfileForRun: MetaProfile | null;
  private runtimeDelegate: GameEngineRuntimeDelegate | null;
  private readonly runtimeDelegateDiagnostics: GameEngineRuntimeDelegateDiagnostics;
  private readonly roomBridgeRegistry = createRoomBridgeRegistry([
    new CombatRoomBridge(),
    new EventRoomBridge(),
    new RestRoomBridge(),
    new ShopRoomBridge(),
    new RewardRoomBridge(),
  ]);
  private readonly gameFlowOrchestrator: GameFlowOrchestrator;
  private disposed = false;

  constructor(seed?: number, metaProfile?: MetaProfile | null, options: GameEngineRuntimeDelegateOptions = {}) {
    this.state = this.createInitialState(seed);
    this.metaProfileForRun = metaProfile || null;
    this.rng = createRNG(this.state.seed, this.state.rngState);
    bindStateRng(this.state, this.rng);
    economySystem.setRandomGenerator(this.rng);
    this.actionManager = createActionManager(this.state, {
      enableLogging: process.env.NODE_ENV === 'development',
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
    this.gameFlowOrchestrator = new GameFlowOrchestrator({
      selectCharacter: (characterId) => this.tryDelegatedSelectCharacter(characterId),
      selectCharacterLegacy: (characterId) => this.selectCharacterLegacy(characterId),
      syncRuntimeFromLegacyState: (reason) => this.syncRuntimeDelegateFromLegacyState(reason),
      moveToNode: (nodeId) => this.tryDelegatedMoveToNode(nodeId),
      moveToNodeLegacy: (nodeId) => this.moveToNodeLegacy(nodeId),
      canMoveToNode: (nodeId) => {
        if (this.state.pendingNodeResolution) return false;
        const node = this.state.map.find((entry) => entry.id === nodeId);
        if (!node) return false;
        if (!this.state.currentNodeId && node.y !== 0) return false;
        const currentNode = this.state.map.find((entry) => entry.id === this.state.currentNodeId);
        return !currentNode || currentNode.next.includes(nodeId);
      },
      getNode: (nodeId) => this.state.map.find((entry) => entry.id === nodeId) ?? null,
      resolveNodeEntry: (node) => this.resolveCurrentNodeEntry(node),
      recordFallback: (reason) => this.recordDelegationFallback(reason),
    });
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

  private subscribeToGlobalEvent(eventType: string, listener: (event: any) => void): void {
    const unsubscribe = globalEventBus.subscribe(eventType, listener as any);
    this.globalDisposables.push(unsubscribe);
  }

  private setupEventListeners(): void {
    this.subscribeToGlobalEvent(RuntimeEventType.CombatStart, () => {
      this.resetCombatVoxLog();
      this.appendVoxLog('战区频道接入。鸟卜仪开始记录。');
    });

    this.subscribeToGlobalEvent('CardPlayed', (event: any) => {
      const cardId = String(event?.cardId || '');
      const card = (cardsData as any[]).find((c) => c.id === cardId);
      const cardName = card?.name || cardId || '未知指令';
      this.appendVoxLog(`执行指令：${cardName}。`);
    });

    this.subscribeToGlobalEvent('DamageDealt', (event: any) => {
      const amount = Math.max(0, Math.floor(Number(event?.amount) || 0));
      if (amount <= 0) return;
      const targetType = String(event?.targetType || '');
      this.appendVoxLog(targetType === 'player'
        ? `装甲告警：肉体承载力下降 ${amount}。`
        : `命中确认：目标遭受 ${amount} 点打击。`);
    });

    this.subscribeToGlobalEvent('BlockGained', (event: any) => {
      const amount = Math.max(0, Math.floor(Number(event?.amount) || 0));
      if (amount <= 0) return;
      this.appendVoxLog(`防护层重构：护甲读数 +${amount}。`);
    });

    this.subscribeToGlobalEvent('StatusApplied', (event: any) => {
      const status = String(event?.status || 'Unknown');
      const amount = Math.max(0, Math.floor(Number(event?.amount) || 0));
      const targetType = event?.targetType === 'player' ? '本机' : '目标';
      this.appendVoxLog(`状态注入：${targetType} ${status}${amount > 0 ? ` +${amount}` : ''}。`);
    });

    this.subscribeToGlobalEvent('DeckShuffled', () => {
      this.appendVoxLog('战术缓存重排完成。');
    });

    this.subscribeToGlobalEvent('EnemyDeath', (event: any) => {
      const enemy = this.state.combat?.enemies?.find((e) => e.id === event?.enemyId);
      if (enemy) {
        this.appendVoxLog(`目标沉默：${enemy.name} 信号消失。`);
      }
      this.handleEnemyDefeated(event.enemyId);
    });

    this.subscribeToGlobalEvent(RuntimeEventType.CombatVictory, () => {
      this.appendVoxLog('战区清空。回收小队可推进。');
      this.snapshotCombatVoxLog();
      this.handleCombatVictory();
    });

    this.subscribeToGlobalEvent(RuntimeEventType.PlayerDeath, () => {
      this.appendVoxLog('生命体征归零。频道转入殉道归档。');
      this.snapshotDeathVoxLog();
      this.handlePlayerDefeated();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
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

  private illegalTransitions: Array<{ action: string; fromPhase: string; error: string; timestamp: number }> = [];
  private combatVictoryInProgress = false;
  private playerDeathInProgress = false;

  private applyRunTransition(action: RunAction): void {
    try {
      const next = transitionRunState(deriveRunTransitionState(this.state), action);
      this.state.screen = runPhaseToScreen(next.phase);
      this.state.pendingNodeResolution = next.pendingNodeResolution;
    } catch (error: any) {
      this.illegalTransitions.push({
        action: action.type,
        fromPhase: this.state.screen,
        error: error.message || String(error),
        timestamp: Date.now()
      });
      console.error('[GameEngine] Illegal run transition:', {
        action: action.type,
        fromPhase: this.state.screen,
        error: error.message
      });
    }
  }

  getIllegalTransitions(): Array<{ action: string; fromPhase: string; error: string; timestamp: number }> {
    return [...this.illegalTransitions];
  }

  clearIllegalTransitions(): void {
    this.illegalTransitions = [];
  }

  getRuntimeDelegationDiagnostics(): GameEngineRuntimeDelegateDiagnostics {
    return {
      ...this.runtimeDelegateDiagnostics,
      delegatedSlices: [...this.runtimeDelegateDiagnostics.delegatedSlices],
    };
  }

  private supportsBootAndMapDelegation(): boolean {
    return !!this.runtimeDelegate && this.runtimeDelegateDiagnostics.enabled && this.runtimeDelegateDiagnostics.delegatedSlices.includes('boot_and_map');
  }

  private recordDelegationFallback(reason: unknown): void {
    const detail = reason instanceof Error ? reason.message : String(reason);
    this.runtimeDelegateDiagnostics.fallbackCount += 1;
    this.runtimeDelegateDiagnostics.lastFallbackReason = detail;
  }

  private getRoomBridgeSelectionContext(): RoomBridgeSelectionContext {
    return {
      activeEventId: this.state.activeEvent?.id ?? null,
      upgradeReturnScreen: this.state.upgradeReturnScreen,
    };
  }

  private createRoomBridgeContext(): RoomBridgeContext {
    return {
      screen: this.state.screen,
      ...this.getRoomBridgeSelectionContext(),
      canDelegate: () => this.supportsBootAndMapDelegation(),
      loadDelegatedSnapshot: () => {
        this.runtimeDelegate!.loadSnapshot(normalizeLegacyGameState(this.state));
      },
      delegateCompleteCombat: () => this.runtimeDelegate!.completeCombat(),
      delegateTakeReward: (cardId) => this.runtimeDelegate!.takeReward(cardId),
      delegateSkipReward: () => this.runtimeDelegate!.skipReward(),
      delegateChooseEventOption: (choiceId) => this.runtimeDelegate!.chooseEventOption(choiceId),
      delegateRest: () => this.runtimeDelegate!.rest(),
      delegateUpgradeCard: (cardInstanceId) => this.runtimeDelegate!.upgradeCard(cardInstanceId),
      delegateRemoveCard: (cardInstanceId) => this.runtimeDelegate!.removeCard(cardInstanceId),
      delegateLeaveRoom: () => this.runtimeDelegate!.leaveRoom(),
      applyCombatVictorySnapshot: (snapshot) => {
        const projected = projectRuleSnapshotToLegacyState(snapshot);
        this.state.player.hp = projected.player.hp;
        this.state.player.maxHp = projected.player.maxHp;
        this.state.player.gold = projected.player.gold;
        this.state.player.intel = projected.player.intel;
        this.state.player.devotion = projected.player.devotion;
        this.state.player.corruption = projected.player.corruption;
        this.state.rewardCards = (snapshot.reward?.cardIds ?? []).map((cardId) => {
          const def = (cardsData as CardDef[]).find((entry) => entry.id === cardId);
          if (!def) {
            throw new Error(`Unable to project delegated reward card into legacy state: ${cardId}`);
          }
          return this.createRuntimeCard(def);
        });
        this.state.combat = null;
        this.state.screen = projected.screen;
        this.state.pendingNodeResolution = projected.pendingNodeResolution;
        this.state.currentNodeId = projected.currentNodeId;
        this.state.map = projected.map;
        this.actionManager.updateState(this.state);
      },
      applyRewardResolutionSnapshot: (snapshot) => {
        const projected = projectRuleSnapshotToLegacyState(snapshot);
        const addedRewardCardId = this.findDelegatedRewardCardDelta(snapshot);
        if (addedRewardCardId) {
          const def = (cardsData as CardDef[]).find((entry) => entry.id === addedRewardCardId);
          if (!def) {
            throw new Error(`Unable to project delegated selected reward card into legacy state: ${addedRewardCardId}`);
          }
          this.state.player.deck.push(this.createRuntimeCard(def));
          metricsTracker.recordCardAcquired();
        }
        this.state.player.hp = projected.player.hp;
        this.state.player.maxHp = projected.player.maxHp;
        this.state.player.gold = projected.player.gold;
        this.state.player.intel = projected.player.intel;
        this.state.player.devotion = projected.player.devotion;
        this.state.player.corruption = projected.player.corruption;
        this.state.rewardCards = [];
        this.actionManager.updateState(this.state);
      },
      applyRestSnapshot: (snapshot) => {
        const projected = projectRuleSnapshotToLegacyState(snapshot);
        this.state.player.hp = projected.player.hp;
        this.state.player.maxHp = projected.player.maxHp;
        this.actionManager.updateState(this.state);
      },
      applyLeaveRoomSnapshot: (snapshot) => {
        this.state.screen = projectRuleSnapshotToLegacyState(snapshot).screen;
        this.state.pendingNodeResolution = !!snapshot.lifecycle.pendingNodeResolution;
        this.state.currentNodeId = snapshot.map.currentNodeId;
        this.state.map = snapshot.map.nodes.map((node) => ({
          id: node.id,
          type: node.type as GameState['map'][number]['type'],
          x: node.x,
          y: node.y,
          revealed: !!node.revealed,
          next: [...node.next],
        }));
        this.state.campfireChoiceLocked = false;
        this.actionManager.updateState(this.state);
      },
      syncFromLegacyState: (reason) => this.syncRuntimeDelegateFromLegacyState(reason),
      recordFallback: (reason) => this.recordDelegationFallback(reason),
    };
  }

  private getActiveRoomBridge() {
    return this.roomBridgeRegistry.getBridge(this.state.screen, this.getRoomBridgeSelectionContext());
  }

  private syncActiveRoomBridgeAfterLegacyAction(actionType: 'buy_shop_card' | 'buy_shop_relic' | 'buy_shop_potion' | 'take_reward' | 'skip_reward'): void {
    const bridge = this.getActiveRoomBridge();
    bridge?.syncAfterLegacyAction?.(this.createRoomBridgeContext(), actionType);
  }

  private findDelegatedRewardCardDelta(snapshot: RuleSnapshot): string | null {
    const previousCounts = new Map<string, number>();
    for (const card of this.state.player.deck) {
      previousCounts.set(card.id, (previousCounts.get(card.id) ?? 0) + 1);
    }
    for (const cardId of snapshot.player.deck) {
      const nextCount = (previousCounts.get(cardId) ?? 0) - 1;
      if (nextCount < 0) {
        return cardId;
      }
      previousCounts.set(cardId, nextCount);
    }
    return null;
  }

  private buildRuntimeDeckFromIds(cardIds: string[]): RunCardInstance[] {
    return cardIds.map((cardId) => {
      const def = (cardsData as CardDef[]).find((entry) => entry.id === cardId);
      if (!def) {
        throw new Error(`Unable to project delegated card into legacy deck: ${cardId}`);
      }
      return this.createRuntimeCard(def);
    });
  }

  private applyDelegatedSnapshotToLegacyState(snapshot: RuleSnapshot, mode: 'select_character' | 'move_to_node'): void {
    const projected = projectRuleSnapshotToLegacyState(snapshot);
    const character = projected.characterId
      ? charactersData.find((entry) => entry.id === projected.characterId) ?? null
      : null;

    if (mode === 'select_character') {
      if (!character) {
        throw new Error('Delegated select_character snapshot is missing a valid character');
      }
      this.state.character = character;
      this.state.player.maxHp = projected.player.maxHp;
      this.state.player.hp = projected.player.hp;
      this.state.player.maxEnergy = character.maxEnergy;
      this.state.player.energy = character.maxEnergy;
      this.state.player.gold = projected.player.gold;
      this.state.player.intel = projected.player.intel;
      this.state.player.devotion = projected.player.devotion;
      this.state.player.corruption = projected.player.corruption;
      this.state.player.deck = this.buildRuntimeDeckFromIds(projected.player.deckIds);
      this.state.player.relics = [...projected.player.relicIds];
      this.state.player.potions = [...projected.player.potionIds];
      this.state.combat = null;
      this.state.activeEvent = null;
      this.state.rewardCards = [];
      this.state.shopCards = [];
      this.state.shopRelics = [];
      this.state.shopPotions = [];
      this.state.enchantContext = null;
      this.state.upgradeReturnScreen = undefined;
      this.state.pendingUpgradeRefund = false;
      this.state.cardRemovalCost = 75;
    }

    this.state.map = projected.map;
    this.state.currentNodeId = projected.currentNodeId;
    this.state.screen = projected.screen;
    this.state.pendingNodeResolution = projected.pendingNodeResolution;
    this.state.campfireChoiceLocked = projected.campfireChoiceLocked;
    this.actionManager.updateState(this.state);
  }

  private syncRuntimeDelegateFromLegacyState(command: string): void {
    if (!this.supportsBootAndMapDelegation()) return;
    try {
      this.runtimeDelegate!.loadSnapshot(normalizeLegacyGameState(this.state));
      this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'load_snapshot';
    } catch (error) {
      this.recordDelegationFallback(error);
      this.runtimeDelegate = null;
      this.runtimeDelegateDiagnostics.enabled = false;
      this.runtimeDelegateDiagnostics.source = null;
      console.warn(`[GameEngine] Disabled runtime delegation after ${command}:`, error);
    }
  }

  private tryDelegatedSelectCharacter(characterId: string): boolean {
    if (!this.supportsBootAndMapDelegation()) return false;
    try {
      const snapshot = this.runtimeDelegate!.selectCharacter(characterId);
      this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'select_character';
      this.applyDelegatedSnapshotToLegacyState(snapshot, 'select_character');
      unlockManyCodexEntries('cards', this.state.player.deck.map((card) => card.id));
      applyMetaProfileToNewRunState(this.state, this.metaProfileForRun, {
        rng: this.rng,
        generateId: () => this.generateId(),
      });
      this.applyAscensionMapModifiers();
      metricsTracker.startRun(this.state.seed, characterId);
      return true;
    } catch (error) {
      this.recordDelegationFallback(error);
      return false;
    }
  }

  private tryDelegatedMoveToNode(nodeId: string): boolean {
    if (!this.supportsBootAndMapDelegation()) return false;
    try {
      const snapshot = this.runtimeDelegate!.enterNode(nodeId);
      this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'enter_node';
      this.applyDelegatedSnapshotToLegacyState(snapshot, 'move_to_node');
      return true;
    } catch (error) {
      this.recordDelegationFallback(error);
      return false;
    }
  }

  private tryDelegatedCompleteCombat(): boolean {
    if (this.state.screen !== 'Combat') return false;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'complete_combat' }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'complete_combat';
    return handled;
  }

  private tryDelegatedChooseEventOption(choiceId: string): boolean {
    if (this.state.screen !== 'Event' || !this.state.activeEvent) return false;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'choose_event_option', choiceId }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'choose_event_option';
    return handled;
  }

  private tryDelegatedRest(): boolean {
    if (this.state.screen !== 'Rest') return false;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'rest' }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'rest';
    return handled;
  }

  private tryDelegatedUpgradeCard(cardInstanceId?: string): boolean {
    if (this.state.screen !== 'Upgrade') return false;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'upgrade_card', cardInstanceId }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'upgrade_card';
    return handled;
  }

  private tryDelegatedRemoveCard(cardInstanceId?: string): boolean {
    if (this.state.screen !== 'RemoveCard') return false;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'remove_card', cardInstanceId }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'remove_card';
    return handled;
  }

  private tryDelegatedLeaveRoom(): boolean {
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.leaveToMap?.(this.createRoomBridgeContext()) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'leave_room';
    return handled;
  }

  private tryDelegatedTakeReward(cardInstanceId?: string): boolean {
    if (this.state.screen !== 'Reward') return false;
    const selectedCardId = cardInstanceId
      ? this.state.rewardCards.find((card) => card.instanceId === cardInstanceId)?.id
      : undefined;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'take_reward', cardId: selectedCardId }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'take_reward';
    return handled;
  }

  private tryDelegatedSkipReward(): boolean {
    if (this.state.screen !== 'Reward') return false;
    const bridge = this.getActiveRoomBridge();
    const handled = bridge?.performAction?.(this.createRoomBridgeContext(), { type: 'skip_reward' }) ?? false;
    if (handled) this.runtimeDelegateDiagnostics.lastDelegatedCommand = 'skip_reward';
    return handled;
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

  private createRuntimeCard(card: CardDef, instanceId = this.generateId()) {
    return normalizeRunCardInstance(card, () => instanceId);
  }

  private normalizeDeckCards() {
    this.state.player.deck = this.state.player.deck.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
  }

  private normalizeCombatCards(): void {
    if (!this.state.combat) return;
    this.state.combat.drawPile = this.state.combat.drawPile.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    this.state.combat.hand = this.state.combat.hand.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    this.state.combat.discardPile = this.state.combat.discardPile.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    this.state.combat.exhaustPile = this.state.combat.exhaustPile.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    this.state.combat.player.delayedCards = this.state.combat.player.delayedCards.map((entry) => ({
      ...entry,
      card: normalizeRunCardInstance(entry.card, () => this.generateId())
    }));
    if (this.state.combat.player.lastPlayedCard) {
      this.state.combat.player.lastPlayedCard = normalizeRunCardInstance(this.state.combat.player.lastPlayedCard, () => this.generateId());
    }
    if (this.state.combat.bossPhase) {
      this.state.combat.bossPhase.currentPlayerTurnCards = this.state.combat.bossPhase.currentPlayerTurnCards.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
      this.state.combat.bossPhase.previousPlayerTurnCards = this.state.combat.bossPhase.previousPlayerTurnCards.map((card) => normalizeRunCardInstance(card, () => this.generateId()));
    }
  }

  private replaceRunCardInstance(updatedCard: CardDef): void {
    const replace = <T extends CardDef>(cards: T[]): T[] => cards.map((card) => (card.instanceId && card.instanceId === updatedCard.instanceId ? updatedCard as T : card));

    this.state.player.deck = replace(this.state.player.deck);
    this.state.rewardCards = replace(this.state.rewardCards);
    this.state.shopCards = replace(this.state.shopCards);

    if (this.state.combat) {
      this.state.combat.drawPile = replace(this.state.combat.drawPile);
      this.state.combat.hand = replace(this.state.combat.hand);
      this.state.combat.discardPile = replace(this.state.combat.discardPile);
      this.state.combat.exhaustPile = replace(this.state.combat.exhaustPile);
      this.state.combat.player.delayedCards = this.state.combat.player.delayedCards.map((entry) => (
        entry.card.instanceId === updatedCard.instanceId ? { ...entry, card: updatedCard as any } : entry
      ));
      if (this.state.combat.player.lastPlayedCard?.instanceId === updatedCard.instanceId) {
        this.state.combat.player.lastPlayedCard = updatedCard as any;
      }
      if (this.state.combat.bossPhase) {
        this.state.combat.bossPhase.currentPlayerTurnCards = replace(this.state.combat.bossPhase.currentPlayerTurnCards);
        this.state.combat.bossPhase.previousPlayerTurnCards = replace(this.state.combat.bossPhase.previousPlayerTurnCards);
      }
    }
  }

  private getEnchantableCards(): CardDef[] {
    return this.state.player.deck.filter((card) => {
      const runCard = normalizeRunCardInstance(card, () => this.generateId());
      return (runCard.type === 'Attack' || runCard.type === 'Skill') && runCard.persistentEnchantments.length === 0;
    });
  }

  private enterEnchant(
    source: 'Event' | 'Rest' | 'Shop',
    enchantmentId: string,
    options: { title?: string; description?: string; price?: number; returnScreen?: 'Event' | 'Rest' | 'Shop' } = {}
  ): boolean {
    const enchantment = getCardEnchantmentDefById(enchantmentId);
    if (!enchantment || enchantment.scope !== 'persistent') return false;
    const candidates = this.getEnchantableCards();
    if (candidates.length === 0) return false;
    this.state.enchantContext = {
      source,
      enchantmentId,
      title: options.title || enchantment.name,
      description: options.description || enchantment.description,
      price: options.price,
      returnScreen: options.returnScreen || source
    };
    this.state.screen = 'Enchant';
    this.notify();
    return true;
  }

  restEnchant(): void {
    if (this.state.screen !== 'Rest' || this.state.campfireChoiceLocked) return;
    this.state.campfireChoiceLocked = true;
    if (!this.enterEnchant('Rest', 'blood_rune', {
      title: '锻台刻印',
      description: '选择一张攻击或技能牌，刻下血色铭文。',
      returnScreen: 'Rest'
    })) {
      this.state.campfireChoiceLocked = false;
    }
  }

  enterShopEnchant(): void {
    if (this.state.screen !== 'Shop') return;
    const price = this.getAdjustedShopPrice(65);
    if (!this.enterEnchant('Shop', 'swift_sigil', {
      title: '附魔服务',
      description: '支付信用筹码，为一张牌刻下迅捷刻印。',
      price,
      returnScreen: 'Shop'
    })) return;
  }

  applyEnchantment(cardInstanceId: string): boolean {
    const context = this.state.enchantContext;
    if (!context) return false;
    const target = this.state.player.deck.find((card) => card.instanceId === cardInstanceId);
    if (!target) return false;
    const runCard = normalizeRunCardInstance(target, () => this.generateId());
    if (runCard.persistentEnchantments.length > 0) return false;
    const enchantment = getCardEnchantmentDefById(context.enchantmentId);
    if (!enchantment || enchantment.scope !== 'persistent') return false;
    if (context.source === 'Shop') {
      const price = Math.max(0, Number(context.price || 0));
      if (this.state.player.gold < price) return false;
      this.state.player.gold -= price;
      metricsTracker.recordGoldSpent(price);
    }
    const updated = applyPersistentEnchantmentToInstance(runCard, enchantment);
    this.replaceRunCardInstance(updated);
    const returnScreen = context.returnScreen || context.source;
    this.state.enchantContext = null;
    if (returnScreen === 'Rest') {
      this.leaveCurrentRoomToMap();
      return true;
    }
    this.state.screen = returnScreen;
    this.notify();
    return true;
  }

  cancelEnchant(): void {
    const context = this.state.enchantContext;
    if (!context) return;
    const returnScreen = context.returnScreen || context.source;
    this.state.enchantContext = null;
    if (returnScreen === 'Rest') {
      this.state.campfireChoiceLocked = false;
    }
    this.state.screen = returnScreen;
    this.notify();
  }

  private applyEnemyCardAffliction(enemyId: string): void {
    const combat = this.state.combat;
    if (!combat) return;
    const enemy = combat.enemies.find((entry) => entry.id === enemyId);
    if (!enemy || enemy.hp <= 0) return;
    const targetPool = combat.hand.length > 0 ? combat.hand : combat.drawPile;
    if (targetPool.length === 0) return;
    const defId = enemy.defId;
    const afflictionId = defId === 'hexaghost'
      ? 'dampened_edge'
      : defId === 'lagavulin'
        ? 'sundered_guard'
        : defId === 'cultist'
          ? 'hex_tax'
          : null;
    if (!afflictionId) return;
    const affliction = getCardEnchantmentDefById(afflictionId);
    if (!affliction || affliction.scope !== 'combat') return;
    const target = targetPool[Math.floor(this.rng() * targetPool.length)];
    if (!target?.instanceId) return;
    const updated = applyCombatAfflictionToInstance(normalizeRunCardInstance(target, () => this.generateId()), affliction);
    this.replaceRunCardInstance(updated);
    this.appendVoxLog(`${enemy.name} 污染了 ${updated.name}。`);
  }

  private clearCombatAfflictionsForRunCards(): void {
    this.state.player.deck = this.state.player.deck.map((card) => clearCombatAfflictionsFromInstance(normalizeRunCardInstance(card, () => this.generateId())));
    if (!this.state.combat) return;
    this.state.combat.drawPile = this.state.combat.drawPile.map((card) => clearCombatAfflictionsFromInstance(normalizeRunCardInstance(card, () => this.generateId())));
    this.state.combat.hand = this.state.combat.hand.map((card) => clearCombatAfflictionsFromInstance(normalizeRunCardInstance(card, () => this.generateId())));
    this.state.combat.discardPile = this.state.combat.discardPile.map((card) => clearCombatAfflictionsFromInstance(normalizeRunCardInstance(card, () => this.generateId())));
    this.state.combat.exhaustPile = this.state.combat.exhaustPile.map((card) => clearCombatAfflictionsFromInstance(normalizeRunCardInstance(card, () => this.generateId())));
  }

  // ==================== Character Selection ====================

  private selectCharacterLegacy(characterId: string): boolean {
    const charDef = charactersData.find(c => c.id === characterId);
    if (!charDef) return false;

    this.state.character = charDef;
    this.state.player.maxHp = charDef.maxHp;
    this.state.player.hp = charDef.maxHp;
    this.state.player.maxEnergy = charDef.maxEnergy;
    this.state.player.energy = charDef.maxEnergy;
    this.state.player.gold = 99;
    this.state.player.deck = charDef.startingDeck.map(cardId => {
      const def = cardsData.find(c => c.id === cardId);
      return def ? this.createRuntimeCard(def) : null;
    }).filter(Boolean) as any;
    unlockManyCodexEntries('cards', this.state.player.deck.map(c => c.id));
    applyMetaProfileToNewRunState(this.state, this.metaProfileForRun, {
      rng: this.rng,
      generateId: () => this.generateId()
    });

    this.state.map = runGenerator.generateMap(this.state.seed, 10);
    this.applyAscensionMapModifiers();
    // Start before floor 1 so the player chooses the first room instead of auto-consuming it.
    this.state.currentNodeId = null;
    this.state.screen = 'Map';

    metricsTracker.startRun(this.state.seed, characterId);
    return true;
  }

  selectCharacter(characterId: string): void {
    if (!this.gameFlowOrchestrator.selectCharacter(characterId)) return;
    this.notify();
  }

  startGame(): void {
    if (this.state.screen !== 'CharacterSelect') return;
    const selectedId = this.state.character?.id;
    if (selectedId) {
      this.selectCharacter(selectedId);
    }
  }

  // ==================== Map Navigation ====================

  private resolveCurrentNodeEntry(node: MapNode): void {
    this.state.campfireChoiceLocked = false;
    switch (node.type) {
      case 'Combat':
      case 'Elite':
      case 'Boss':
        this.startCombat(node.type);
        break;
      case 'Event':
        this.startEvent();
        break;
      case 'Shop':
        this.enterShop();
        break;
      case 'Rest':
        this.state.campfireChoiceLocked = false;
        this.state.screen = 'Rest';
        break;
    }
  }

  private moveToNodeLegacy(nodeId: string): boolean {
    if (this.state.pendingNodeResolution) return false;
    const node = this.state.map.find(n => n.id === nodeId);
    if (!node) return false;

    if (!this.state.currentNodeId && node.y !== 0) return false;
    const currentNode = this.state.map.find(n => n.id === this.state.currentNodeId);
    if (currentNode && !currentNode.next.includes(nodeId)) return false;

    this.state.currentNodeId = nodeId;
    node.revealed = true;
    this.state.pendingNodeResolution = true;
    this.resolveCurrentNodeEntry(node);
    return true;
  }

  moveToNode(nodeId: string): void {
    if (!this.gameFlowOrchestrator.moveToNode(nodeId)) return;
    this.notify();
  }

  // ==================== Combat System ====================

  private startCombat(nodeType: 'Combat' | 'Elite' | 'Boss'): void {
    const floor = this.getCurrentFloorNumber();
    const hpMultiplier = economySystem.calculateHpMultiplier(floor) * Math.max(1, Number(this.state.metaRuntime?.ascensionEnemyHpMultiplier || 1));
    const damageMultiplier = economySystem.calculateDamageMultiplier(floor) * Math.max(1, Number(this.state.metaRuntime?.ascensionEnemyDamageMultiplier || 1));

    const enemyCount = nodeType === 'Boss' ? 1 : nodeType === 'Elite' ? 2 : 1 + Math.floor(this.rng() * 2);
    const enemies = this.generateEnemies(enemyCount, nodeType, floor, hpMultiplier, damageMultiplier);

    this.state.combat = {
      player: {
        hp: this.state.player.hp,
        maxHp: this.state.player.maxHp,
        block: 0,
        energy: this.state.player.maxEnergy,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0,
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
        intel: this.state.player.intel,
        devotion: this.state.player.devotion || 0,
        corruptionAxis: Math.min(100, Math.max(0, this.state.player.corruption || 0)),
        axisDisposition: (this.state.player.corruption || 0) > 0 ? 'corruption' : 'balanced',
        timeLayer: this.state.character?.specialResource === 'timeLayer' ? 1 : undefined,
        thread: this.state.character?.specialResource === 'thread' ? 2 : undefined,
        concoction: this.state.character?.specialResource === 'concoction' ? 1 : undefined
      },
      enemies,
      drawPile: this.shuffleDeck([...this.state.player.deck]),
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: Math.min(
        100,
        Math.floor((this.state.player.corruption || 0) * 0.6) + Math.max(0, this.state.player.runEffects?.pendingWarpTideBonus || 0)
      ),
      warpAlpha: 0.5 + Math.min(0.25, (this.state.player.corruption || 0) * 0.0025),
      warpPerilK: 0.05
    };
    this.initializeBossPhaseRuntime();
    this.applyRunEffectCombatModifiers();

    this.state.screen = 'Combat';
    metricsTracker.recordCombatStart?.();
    globalEventBus.publish({ type: 'CombatStart' } as any);
    relicSystem.trigger('CombatStart', this.state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });
    if ((this.state.player.corruption || 0) > 0) {
      this.state.combat.warpPulse = {
        text: `Corruption stirs the warp: Tide ${this.state.combat.warpTide} · DMG x${this.getCorruptionDamageBonusMultiplier().toFixed(2)}`,
        tone: (this.state.combat.warpTide || 0) >= 50 ? 'danger' : 'warp'
      };
    }
    this.startTurn();
  }

  private applyAscensionMapModifiers(): void {
    const chance = Math.max(0, Math.min(0.9, Number(this.state.metaRuntime?.ascensionEliteUpgradeChance || 0)));
    if (!chance || !Array.isArray(this.state.map) || this.state.map.length === 0) return;
    for (const node of this.state.map) {
      if (!node || node.type !== 'Combat') continue;
      if (node.y <= 0) continue; // keep first pick readable and fair
      if (this.rng() < chance) {
        node.type = 'Elite';
      }
    }
  }

  private initializeBossPhaseRuntime(): void {
    const combat = this.state.combat;
    if (!combat) return;
    const bossEnemy = combat.enemies.find((e) => {
      const def = enemiesData.find((d) => d.id === e.defId);
      return !!def?.keywords?.includes('boss');
    });
    if (!bossEnemy) return;
    const encounter = getBossPhaseEncounter(bossEnemy.defId);
    if (!encounter) return;
    const initial = getBossPhaseForHpPct(bossEnemy.defId, bossEnemy.maxHp > 0 ? bossEnemy.hp / bossEnemy.maxHp : 1);
    if (!initial) return;
    combat.bossPhase = {
      enemyId: bossEnemy.id,
      bossDefId: bossEnemy.defId,
      phaseIndex: initial.phaseIndex,
      phaseId: initial.phase.id,
      phaseName: initial.phase.name,
      phaseHint: initial.phase.hint,
      enteredTurn: combat.turn || 1,
      currentPlayerTurnCards: [],
      previousPlayerTurnCards: [],
      flags: {}
    };
    if (initial.phase.onEnter?.warpPulse) {
      combat.warpPulse = { text: initial.phase.onEnter.warpPulse, tone: 'warp' };
    }
  }

  private refreshBossPhaseState(): void {
    const combat = this.state.combat;
    if (!combat || !combat.bossPhase) return;
    const boss = combat.enemies.find((e) => e.id === combat.bossPhase!.enemyId);
    if (!boss || boss.hp <= 0) return;
    const next = getBossPhaseForHpPct(boss.defId, boss.maxHp > 0 ? boss.hp / boss.maxHp : 0);
    if (!next) return;
    if (next.phaseIndex <= combat.bossPhase.phaseIndex) return;
    this.enterBossPhase(next.phaseIndex, next.phase);
  }

  private enterBossPhase(phaseIndex: number, phase: any): void {
    const combat = this.state.combat;
    if (!combat || !combat.bossPhase) return;
    const boss = combat.enemies.find((e) => e.id === combat.bossPhase!.enemyId);
    if (!boss) return;

    combat.bossPhase.phaseIndex = phaseIndex;
    combat.bossPhase.phaseId = phase.id;
    combat.bossPhase.phaseName = phase.name;
    combat.bossPhase.phaseHint = phase.hint;
    combat.bossPhase.enteredTurn = combat.turn || 1;
    combat.bossPhase.flags = {};

    const onEnter = phase.onEnter || {};
    if (typeof onEnter.gainBlock === 'number' && onEnter.gainBlock > 0) {
      boss.block = Math.max(0, boss.block + Math.floor(onEnter.gainBlock));
    }
    if (onEnter.gainStatuses && typeof onEnter.gainStatuses === 'object') {
      for (const [status, amount] of Object.entries(onEnter.gainStatuses)) {
        const delta = Math.floor(Number(amount) || 0);
        if (!delta) continue;
        boss.statuses[status] = Math.max(0, (boss.statuses[status] || 0) + delta);
        if (boss.statuses[status] <= 0) delete boss.statuses[status];
      }
    }
    if (Array.isArray(onEnter.summons)) {
      for (const summon of onEnter.summons) {
        const count = Math.max(1, Math.floor(Number((summon as any).count) || 1));
        for (let i = 0; i < count; i++) {
          this.summonBossAdd(
            String((summon as any).unitId || ''),
            String((summon as any).nameOverride || ''),
            Number((summon as any).hpScale) || 1
          );
        }
      }
    }

    const pulseText = typeof onEnter.warpPulse === 'string' && onEnter.warpPulse.trim().length > 0
      ? onEnter.warpPulse
      : `${boss.name} enters ${phase.name}`;
    combat.warpPulse = { text: pulseText, tone: 'danger' };

    const bossDef = enemiesData.find((e) => e.id === boss.defId);
    if (bossDef) {
      boss.nextIntent = this.selectIntent(bossDef);
    }
  }

  private summonBossAdd(unitId: string, nameOverride?: string, hpScale = 1): void {
    const combat = this.state.combat;
    if (!combat || !unitId) return;
    if (combat.enemies.filter((e) => e.hp > 0).length >= 5) return;
    const def: any = enemiesData.find((e) => e.id === unitId);
    if (!def) return;
    const floor = this.getCurrentFloorNumber();
    const hpMultiplier = economySystem.calculateHpMultiplier(floor);
    const baseHp = rollEnemyBaseHp(def, this.rng);
    const scaledHp = Math.max(1, Math.floor(baseHp * hpMultiplier * Math.max(0.3, hpScale)));
    combat.enemies.push({
      id: `enemy_add_${this.generateId()}`,
      defId: def.id,
      name: nameOverride && nameOverride.trim() ? nameOverride : def.name,
      hp: scaledHp,
      maxHp: scaledHp,
      block: 0,
      statuses: {},
      nextIntent: this.selectIntent(def),
      summoned: true,
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced'
    });
  }

  private snapshotPlayerTurnForBossPhase(): void {
    const combat = this.state.combat;
    if (!combat?.bossPhase) return;
    combat.bossPhase.previousPlayerTurnCards = [...(combat.bossPhase.currentPlayerTurnCards || [])];
    combat.bossPhase.currentPlayerTurnCards = [];
  }

  private recordBossPhasePlayedCard(card: RunCardInstance): void {
    const combat = this.state.combat;
    if (!combat?.bossPhase || !card) return;
    combat.bossPhase.currentPlayerTurnCards.push(card);
    if (combat.bossPhase.currentPlayerTurnCards.length > 12) {
      combat.bossPhase.currentPlayerTurnCards = combat.bossPhase.currentPlayerTurnCards.slice(-12);
    }
  }

  private estimateEchoDamageFromCard(card: RunCardInstance): number {
    const combat = this.state.combat;
    if (!combat || !card?.actions?.length) return 0;
    let total = 0;
    for (const action of card.actions as any[]) {
      if (action.type === 'DealDamage' && typeof action.amount === 'number') {
        total += Math.max(0, Math.floor(action.amount));
      }
      if (action.type === 'DealWarpDamage' && typeof action.amount === 'number') {
        const alpha = this.getWarpEffectiveAlpha(typeof action.alpha === 'number' ? action.alpha : undefined);
        const scaled = Math.max(0, Math.floor(action.amount * this.getWarpPowerMultiplier(combat.warpTide, alpha)));
        total += scaled;
      }
    }
    return total;
  }

  private async applyBossPhaseEnemyPrelude(enemy: any): Promise<void> {
    const combat = this.state.combat;
    if (!combat?.bossPhase) return;
    if (enemy.id !== combat.bossPhase.enemyId) return;
    const bossPhase = combat.bossPhase;
    const active = getBossPhaseForHpPct(enemy.defId, enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0);
    if (!active) return;
    const mechanics = active.phase.mechanics || {};
    bossPhase.flags ||= {};

    const periodicSummon = (mechanics as any).periodicSummon;
    if (periodicSummon && Number(periodicSummon.everyEnemyTurns) > 0) {
      const every = Math.max(1, Math.floor(Number(periodicSummon.everyEnemyTurns)));
      const activeAdds = combat.enemies.filter((e) => e.hp > 0 && e.summoned && e.name === (periodicSummon.nameOverride || e.name)).length;
      const maxActive = Number.isFinite(Number(periodicSummon.maxActive)) ? Math.max(1, Math.floor(Number(periodicSummon.maxActive))) : 99;
      const lastTurn = Number(bossPhase.flags['periodicSummonLastTurn'] || 0);
      if (combat.turn - lastTurn >= every && activeAdds < maxActive) {
        this.summonBossAdd(
          String(periodicSummon.unitId || ''),
          String(periodicSummon.nameOverride || ''),
          Number(periodicSummon.hpScale) || 1
        );
        bossPhase.flags['periodicSummonLastTurn'] = combat.turn;
        combat.warpPulse = { text: `${enemy.name} tears open another shade.`, tone: 'warp' };
      }
    }

    const buffSummonedAllies = (mechanics as any).buffSummonedAllies;
    if (buffSummonedAllies && Number(buffSummonedAllies.everyEnemyTurns) > 0) {
      const every = Math.max(1, Math.floor(Number(buffSummonedAllies.everyEnemyTurns)));
      const lastTurn = Number(bossPhase.flags['buffSummonedAlliesLastTurn'] || 0);
      if (combat.turn - lastTurn >= every) {
        const candidates = combat.enemies
          .filter((e) => e.hp > 0 && e.id !== enemy.id && e.summoned)
          .slice(0, Math.max(1, Math.floor(Number(buffSummonedAllies.maxTargets) || 99)));
        if (candidates.length > 0) {
          const strGain = Math.max(0, Math.floor(Number(buffSummonedAllies.strength) || 0));
          const blockGain = Math.max(0, Math.floor(Number(buffSummonedAllies.block) || 0));
          for (const ally of candidates) {
            if (strGain > 0) ally.statuses['Strength'] = (ally.statuses['Strength'] || 0) + strGain;
            if (blockGain > 0) ally.block = Math.max(0, ally.block + blockGain);
          }
          bossPhase.flags['buffSummonedAlliesLastTurn'] = combat.turn;
          combat.warpPulse = { text: `${enemy.name} tightens the strings on ${candidates.length} puppet(s).`, tone: 'danger' };
        }
      }
    }

    const hijackHand = (mechanics as any).hijackHand;
    if (hijackHand && Number(hijackHand.everyEnemyTurns) > 0) {
      const every = Math.max(1, Math.floor(Number(hijackHand.everyEnemyTurns)));
      const lastTurn = Number(bossPhase.flags['hijackHandLastTurn'] || 0);
      if (combat.turn - lastTurn >= every) {
        const discardCount = Math.max(1, Math.floor(Number(hijackHand.discardCount) || 1));
        if (combat.hand.length > 0) {
          const hijackedNames: string[] = [];
          for (let i = 0; i < discardCount && combat.hand.length > 0; i++) {
            const index = Math.floor(this.rng() * combat.hand.length);
            const [card] = combat.hand.splice(index, 1);
            if (card) {
              combat.discardPile.push(card);
              hijackedNames.push(card.name || card.id);
            }
          }
          if (hijackedNames.length > 0) {
            bossPhase.flags['hijackHandLastTurn'] = combat.turn;
            combat.warpPulse = {
              text: `${enemy.name} hijacks ${hijackedNames.join(', ')} into the discard pile.`,
              tone: 'danger'
            };
          }
        } else if (hijackHand.fallbackStatuses && typeof hijackHand.fallbackStatuses === 'object') {
          for (const [status, amount] of Object.entries(hijackHand.fallbackStatuses)) {
            const delta = Math.max(0, Math.floor(Number(amount) || 0));
            if (delta > 0) {
              combat.player.statuses[status] = (combat.player.statuses[status] || 0) + delta;
            }
          }
          bossPhase.flags['hijackHandLastTurn'] = combat.turn;
          combat.warpPulse = { text: `${enemy.name} finds no strings to pull and instead cripples your stance.`, tone: 'danger' };
        }
      }
    }

    const playerPulse = (mechanics as any).playerPulse;
    if (playerPulse && Number(playerPulse.everyEnemyTurns) > 0) {
      const every = Math.max(1, Math.floor(Number(playerPulse.everyEnemyTurns)));
      const lastTurn = Number(bossPhase.flags['playerPulseLastTurn'] || 0);
      if (combat.turn - lastTurn >= every) {
        const pulseDamage = Math.max(0, Math.floor(Number(playerPulse.damage) || 0));
        if (pulseDamage > 0) {
          if (playerPulse.trueDamage) {
            combatSystem.applyDamage(this.state, {
              amount: pulseDamage,
              sourceType: 'enemy',
              sourceId: enemy.id,
              targetType: 'player',
              targetId: 'player',
              modifiers: [],
              isTrueDamage: true,
              ignoreBlock: true
            });
            if (!this.state.combat || this.state.screen !== 'Combat') return;
          } else {
            this.actionManager.enqueueUrgent(
              { type: 'DealDamage', amount: pulseDamage, target: 'Enemy' } as any,
              { source: enemy.id, sourceId: enemy.id, targetId: 'player' },
              'system'
            );
            await this.actionManager.executeAll();
            if (!this.state.combat || this.state.screen !== 'Combat') return;
          }
        }
        if (playerPulse.statuses && typeof playerPulse.statuses === 'object') {
          for (const [status, amount] of Object.entries(playerPulse.statuses)) {
            const delta = Math.max(0, Math.floor(Number(amount) || 0));
            if (delta > 0) {
              combat.player.statuses[status] = (combat.player.statuses[status] || 0) + delta;
            }
          }
        }
        bossPhase.flags['playerPulseLastTurn'] = combat.turn;
        combat.warpPulse = {
          text: typeof playerPulse.text === 'string' && playerPulse.text.trim() ? playerPulse.text : `${enemy.name} unleashes a phase pulse.`,
          tone: pulseDamage > 0 ? 'danger' : 'warp'
        };
      }
    }

    const echo = (mechanics as any).echoLastPlayerAttack;
    if (echo) {
      const previous = bossPhase.previousPlayerTurnCards || [];
      const candidate = [...previous].reverse().find((card) => this.estimateEchoDamageFromCard(card) > 0);
      const echoedThisTurn = Number(bossPhase.flags['echoLastTurnAppliedAt'] || 0);
      if (candidate && echoedThisTurn !== combat.turn) {
        const base = this.estimateEchoDamageFromCard(candidate);
        const scaled = Math.floor(base * Math.max(0, Number(echo.damageScale) || 0));
        const minDamage = Math.max(0, Math.floor(Number(echo.minDamage) || 0));
        const maxDamage = Math.max(minDamage, Math.floor(Number(echo.maxDamage) || 999));
        const amount = Math.max(minDamage, Math.min(maxDamage, scaled));
        if (amount > 0) {
          this.actionManager.enqueueUrgent(
            { type: 'DealDamage', amount, target: 'Enemy' } as any,
            { source: enemy.id, sourceId: enemy.id, targetId: 'player' },
            'system'
          );
          await this.actionManager.executeAll();
          if (!this.state.combat || this.state.screen !== 'Combat') return;
          bossPhase.flags['echoLastTurnAppliedAt'] = combat.turn;
          combat.warpPulse = { text: `${enemy.name} echoes ${candidate.name} (${amount})`, tone: 'danger' };
        }
      }
    }
  }

  private generateEnemies(
    count: number,
    nodeType: 'Combat' | 'Elite' | 'Boss',
    floor: number,
    hpMultiplier: number,
    damageMultiplier: number
  ): any[] {
    const validEnemies = enemiesData.filter(e => {
      if (nodeType === 'Boss') return e.keywords?.includes('boss');
      if (nodeType === 'Elite') return e.keywords?.includes('elite');
      return !e.keywords?.includes('boss') && !e.keywords?.includes('elite');
    });
    const stagedEnemies = validEnemies.filter(e => this.isEnemyEligibleForFloor(e as any, floor, nodeType));
    const enemyPool = stagedEnemies.length > 0 ? stagedEnemies : validEnemies;

    return Array.from({ length: count }, (_, i) => {
      const def = enemyPool[Math.floor(this.rng() * enemyPool.length)];
      if (def?.id) {
        const eliteLike = !!def.keywords?.includes('elite') || !!def.keywords?.includes('boss');
        unlockCodexEntry(eliteLike ? 'elites' : 'enemies', def.id);
      }
      const baseHp = rollEnemyBaseHp(def, this.rng);
      const scaledHp = this.applyEnemyHpTuning(baseHp, floor, nodeType, hpMultiplier);

      return {
        id: `enemy_${i}_${this.generateId()}`,
        defId: def.id,
        name: def.name,
        hp: scaledHp,
        maxHp: scaledHp,
        block: 0,
        statuses: {},
        nextIntent: this.selectIntent(def),
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      };
    }).map((enemy) => {
      // Single small slime rooms can feel like free turns; add a light bump.
      const slimeBoost = getSingleSlimeRoomBoostConfig();
      if (
        slimeBoost.enabled &&
        nodeType === 'Combat' &&
        count === 1 &&
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

  private selectIntent(enemyDef: any): string {
    const weights = Array.isArray(enemyDef.intent_policy)
      ? enemyDef.intent_policy.map((p: any) => Math.max(0, Number(p.weight) || 0))
      : [];
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) {
      return enemyDef.intent_policy?.[0]?.intent || 'Attack';
    }
    const roll = this.rng() * totalWeight;
    let cumulative = 0;
    for (const policy of enemyDef.intent_policy) {
      cumulative += Math.max(0, Number(policy.weight) || 0);
      if (roll <= cumulative) return policy.intent;
    }
    return enemyDef.intent_policy[0]?.intent || 'Attack';
  }

  private getCurrentNode(): MapNode | undefined {
    if (!this.state.currentNodeId) return undefined;
    return this.state.map.find(n => n.id === this.state.currentNodeId);
  }

  private getCurrentFloorNumber(): number {
    return (this.getCurrentNode()?.y ?? 0) + 1;
  }

  private ensureRunEffects(): NonNullable<GameState['player']['runEffects']> {
    if (!this.state.player.runEffects) {
      this.state.player.runEffects = {};
    }
    return this.state.player.runEffects;
  }

  private applyRunEffectCombatModifiers(): void {
    const combat = this.state.combat;
    if (!combat) return;
    const runEffects = this.ensureRunEffects();

    const enemyHuntBonusPct = Math.max(0, runEffects.enemyHuntBonusPct || 0);
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

    if ((runEffects.pendingWarpTideBonus || 0) > 0) {
      runEffects.pendingWarpTideBonus = 0;
    }

    if ((runEffects.warpDebuffCombatsRemaining || 0) > 0) {
      combat.player.statuses['Fear'] = Math.max(combat.player.statuses['Fear'] || 0, 2);
      combat.player.statuses['Vulnerable'] = Math.max(combat.player.statuses['Vulnerable'] || 0, 2);
      runEffects.warpDebuffCombatsRemaining = Math.max(0, (runEffects.warpDebuffCombatsRemaining || 0) - 1);
      combat.warpPulse = {
        text: `Warp aftershocks: Fear + Vulnerable (${runEffects.warpDebuffCombatsRemaining} fights remain)`,
        tone: 'danger'
      };
    }
  }

  private isEnemyEligibleForFloor(
    enemyDef: { id: string; hp_range: [number, number]; keywords?: string[] },
    floor: number,
    nodeType: 'Combat' | 'Elite' | 'Boss'
  ): boolean {
    return isEnemyEligibleForFloorByNumericRules(enemyDef, floor, nodeType);
  }

  private applyEnemyHpTuning(
    baseHp: number,
    floor: number,
    nodeType: 'Combat' | 'Elite' | 'Boss',
    hpMultiplier: number
  ): number {
    return applyEnemyHpTuningByNumericRules(baseHp, floor, nodeType, hpMultiplier);
  }

  private shuffleDeck<T extends CardDef>(deck: T[]): T[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ==================== Turn Management ====================

  private startTurn(): void {
    const combat = this.state.combat;
    if (!combat) return;

    combat.isPlayerTurn = true;
    this.appendVoxLog(`玩家阶段开始。能量回填至 ${this.state.player.maxEnergy}。`);
    combat.player.damageTakenLastTurn = Math.max(0, Math.floor(combat.player.damageTakenThisTurn || 0));
    combat.player.damageTakenThisTurn = 0;
    combat.player.energy = this.state.player.maxEnergy;
    if (combat.turn > 1) {
      combat.player.block = 0;
    }
    combat.player.cardsPlayedThisTurn = 0;
    combat.player.potionsUsedThisTurn = 0;

    if (this.processTurnStartDots('player', 'player')) {
      this.notify();
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

    this.actionManager.updateState(this.state);

    relicSystem.trigger('StartTurn', this.state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });

    this.actionManager.executeAll().then(() => this.notify());
  }
  
  private executeConstructAttacks(): void {
    const combat = this.state.combat;
    if (!combat) return;
    
    const constructs = combat.player.constructs || [];
    if (constructs.length === 0) return;
    
    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) return;
    
    for (const construct of constructs) {
      if (construct.hp <= 0) continue;
      
      const atk = Math.max(0, construct.atk || 0);
      if (atk <= 0) continue;
      
      const target = aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)];
      if (!target) continue;
      
      const damage = this.calculateDamage(atk, {}, target.statuses || {}, 'player');
      target.hp = Math.max(0, target.hp - damage);
      
      combat.warpPulse = {
        text: `${construct.name} 对 ${target.name} 造成 ${damage} 点伤害`,
        tone: 'faith'
      };
      
      if (target.hp <= 0) {
        this.handleEnemyDefeated(target.id);
      }
    }
  }

  private processStatusDecay(statuses: Record<string, number>): void {
    const decayStatuses = ['Vulnerable', 'Weak', 'Frail', 'Fear', 'Stealth', 'Regen', 'Energized', 'Berserk', 'Intangible', 'BlockBlocked'];
    const noDecayStatuses = ['Strength', 'Dexterity', 'Corruption', 'Zeal', 'Intel'];
    
    decayStatuses.forEach(status => {
      if (statuses[status] !== undefined && statuses[status] > 0) {
        statuses[status]--;
        if (statuses[status] <= 0) {
          delete statuses[status];
        }
      }
    });
  }

  private drawCards(amount: number): void {
    const combat = this.state.combat;
    if (!combat) return;

    for (let i = 0; i < amount; i++) {
      if (combat.drawPile.length === 0) {
        if (combat.discardPile.length === 0) break;
        combat.drawPile = this.shuffleDeck(combat.discardPile);
        combat.discardPile = [];

        globalEventBus.publish({ type: 'DeckShuffled' } as any);
      }

      if (combat.drawPile.length > 0) {
        const card = combat.drawPile.pop()!;
        combat.hand.push(card);
      }
    }
  }

  // ==================== Card Playing ====================

  public async playCard(cardInstanceId: string, targetId?: string): Promise<void> {
    const combat = this.state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    const cardIndex = combat.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return;

    const card = combat.hand[cardIndex];
    unlockCodexEntry('cards', card.id);

    if (combat.player.energy < card.cost) return;

    combat.player.energy -= card.cost;
    combat.hand.splice(cardIndex, 1);
    combat.discardPile.push(card);
    combat.player.cardsPlayedThisTurn++;
    combat.player.lastPlayedCard = card;
    this.recordBossPhasePlayedCard(card);

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
    this.refreshBossPhaseState();

    globalEventBus.publish({
      type: 'CardPlayed',
      cardId: card.id,
      cardType: card.type,
      cardInstanceId: card.instanceId,
      targetId
    } as any);

    this.notify();
  }

  // ==================== Enemy Turn ====================

  public async endTurn(): Promise<void> {
    const combat = this.state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    combat.isPlayerTurn = false;
    this.appendVoxLog('玩家结束阶段。敌方即将行动。');
    this.snapshotPlayerTurnForBossPhase();

    this.discardHand();

    await this.executeEnemyTurn();

    combat.turn++;
    this.startTurn();
  }

  private discardHand(): void {
    const combat = this.state.combat;
    if (!combat) return;

    combat.discardPile.push(...combat.hand);
    combat.hand = [];
  }

  private async executeEnemyTurn(): Promise<void> {
    const combat = this.state.combat;
    if (!combat) return;

    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);

    for (const enemy of aliveEnemies) {
      if (enemy.hp <= 0) continue;
      if (this.processTurnStartDots('enemy', enemy.id)) {
        if (!this.state.combat || this.state.screen !== 'Combat') return;
        continue;
      }
      this.processStatusDecay(enemy.statuses);
      const platedArmor = Math.max(0, Math.floor(enemy.statuses['PlatedArmor'] || 0));
      if (platedArmor > 0) {
        enemy.block = Math.max(0, (enemy.block || 0) + platedArmor);
      }

      const enemyDef = enemiesData.find(e => e.id === enemy.defId);
      if (!enemyDef) continue;
      this.refreshBossPhaseState();
      await this.applyBossPhaseEnemyPrelude(enemy);
      if (!this.state.combat || this.state.screen !== 'Combat') return;

      const intentActions = enemyDef.moves[enemy.nextIntent];
      if (!intentActions) continue;
      let actionsToExecute = intentActions;
      const playerStealth = Math.max(0, combat.player.statuses['Stealth'] || 0);
      const moveHasDamage = intentActions.some((a: any) => a.type === 'DealDamage' || a.type === 'DealWarpDamage');
      if (playerStealth > 0 && moveHasDamage) {
        actionsToExecute = intentActions.filter((a: any) => a.type !== 'DealDamage' && a.type !== 'DealWarpDamage');
        const nextStealth = playerStealth - 1;
        if (nextStealth > 0) combat.player.statuses['Stealth'] = nextStealth;
        else delete combat.player.statuses['Stealth'];
        combat.warpPulse = { text: `${enemy.name} misses into Stealth`, tone: 'neutral' };
      }

      const context = {
        source: enemy.id as string,
        sourceId: enemy.id,
        targetId: 'player'
      };

      this.actionManager.enqueueAll(actionsToExecute, context, 0, 'system');

      await this.actionManager.executeAll();
      if (!this.state.combat || this.state.screen !== 'Combat') return;
      this.applyEnemyCardAffliction(enemy.id);
      this.refreshBossPhaseState();

      enemy.nextIntent = this.selectIntent(enemyDef);
    }

    relicSystem.trigger('EndTurn', this.state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });

    await this.actionManager.executeAll();
  }

  // ==================== Event Handlers ====================

  private handleEnemyDefeated(enemyId: string): void {
    const combat = this.state.combat;
    if (!combat) return;

    const enemy = combat.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

    metricsTracker.recordEnemyDefeated(enemy.defId);

    const allEnemiesDefeated = combat.enemies.every(e => e.hp <= 0);
    if (allEnemiesDefeated && this.state.screen !== 'GameOver') {
      globalEventBus.publish({ type: 'CombatVictory' } as any);
    }
  }

  private handleCombatVictory(): void {
    if (this.combatVictoryInProgress) return;
    const combat = this.state.combat;
    if (!combat) return;

    this.combatVictoryInProgress = true;
    try {
      this.snapshotCombatVoxLog();

      this.syncPlayerStateFromCombat();

      const floor = this.getCurrentFloorNumber();
      const currentNode = this.state.map.find(n => n.id === this.state.currentNodeId);
      const nodeType = currentNode?.type === 'Elite' || currentNode?.type === 'Boss' ? currentNode.type : 'Combat';
      const rewards = (economySystem as any).calculateCombatRewards?.(floor, this.state.player.relics, nodeType) ??
        { gold: economySystem.calculateGoldReward(floor, nodeType === 'Elite', nodeType === 'Boss'), cardCount: 1 };

      metricsTracker.recordCombatVictory(floor);
      this.clearCombatAfflictionsForRunCards();

      if (this.tryDelegatedCompleteCombat()) {
        this.notify();
        return;
      }

      this.state.player.gold += rewards.gold;
      this.state.rewardCards = this.generateCardRewards(3);
      this.state.combat = null;
      this.applyRunTransition({ type: 'COMBAT_WON' });
      this.notify();
    } finally {
      this.combatVictoryInProgress = false;
    }
  }

  private handlePlayerDefeated(): void {
    if (this.playerDeathInProgress) return;
    if (this.state.screen === 'GameOver') return;

    this.playerDeathInProgress = true;
    try {
      if (!this.state.lastDeathVoxLog?.length) {
        this.snapshotDeathVoxLog();
      }
      this.clearCombatAfflictionsForRunCards();
      metricsTracker.recordRunEnd(false, this.getCurrentFloorNumber());
      this.applyRunTransition({ type: 'PLAYER_DIED' });
      globalEventBus.publish({
        type: RuntimeEventType.PlayerDefeated,
        timestamp: Date.now()
      });
      this.notify();
    } finally {
      this.playerDeathInProgress = false;
    }
  }

  private processTurnStartDots(targetType: 'player' | 'enemy', targetId: string): boolean {
    const combat = this.state.combat;
    if (!combat) return false;
    const target = targetType === 'player'
      ? combat.player
      : combat.enemies.find(e => e.id === targetId);
    if (!target || target.hp <= 0) return false;

    const poison = Math.max(0, Math.floor(target.statuses['Poison'] || 0));
    if (poison <= 0) return false;

    const damageContext: DamageContext = {
      amount: poison,
      sourceType: 'system',
      sourceId: 'poison',
      targetType,
      targetId,
      modifiers: [],
      isTrueDamage: true,
      ignoreBlock: true
    };
    combatSystem.applyDamage(this.state, damageContext);

    const nextPoison = Math.max(0, poison - 1);
    if (nextPoison > 0) {
      target.statuses['Poison'] = nextPoison;
    } else {
      delete target.statuses['Poison'];
    }

    return !this.state.combat || target.hp <= 0;
  }

  private tickDelayedCards(): void {
    const combat = this.state.combat;
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
      const delayAction = delayed.card?.actions?.find((a: ActionSpec) => a.type === 'Delay');
      if (!delayAction?.actions?.length) continue;
      
      let targetId = delayed.targetId;
      if (targetId) {
        const target = combat.enemies.find(e => e.id === targetId && e.hp > 0);
        if (!target) {
          const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
          if (aliveEnemies.length > 0) {
            targetId = aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)].id;
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

  private generateCardRewards(count: number): RunCardInstance[] {
    const rewards: RunCardInstance[] = [];
    const characterId = this.state.character?.id;
    const characterDef = charactersData.find(c => c.id === characterId);
    const extendedPool = characterDef?.extendedPool || [];
    const unlockedIds = new Set(this.state.metaRuntime?.unlockedPoolIds || []);
    const unlockedWeightBonus = getMetaUnlockedWeightBonus();
    
    for (let i = 0; i < count; i++) {
      const rarityRoll = this.rng();
      let rarity: 'Common' | 'Uncommon' | 'Rare' = 'Common';
      if (rarityRoll > 0.85) rarity = 'Rare';
      else if (rarityRoll > 0.55) rarity = 'Uncommon';

      let validCards = cardsData.filter(c =>
        c.rarity === rarity &&
        (((c as any).character ?? 'All') === 'All' || (c as any).character === characterId)
      );
      
      const extendedCards = extendedPool.length > 0 
        ? cardsData.filter(c => extendedPool.includes(c.id) && c.rarity === rarity)
        : [];
      
      if (extendedCards.length > 0 && this.rng() < 0.35) {
        validCards = [...validCards, ...extendedCards];
      }
      
      const fallbackCards = cardsData.filter(c => c.rarity === rarity && (((c as any).character ?? 'All') === 'All'));
      const pool = validCards.length > 0 ? validCards : fallbackCards;
      
      let card: any = null;
      if (pool.length > 0) {
        const weightedPool: any[] = [];
        for (const candidate of pool) {
          weightedPool.push(candidate);
          if (unlockedIds.has((candidate as any).id)) {
            for (let j = 0; j < unlockedWeightBonus; j++) weightedPool.push(candidate);
          }
        }
        const pickPool = weightedPool.length > 0 ? weightedPool : pool;
        card = pickPool[Math.floor(this.rng() * pickPool.length)];
      }
      if (card) {
        rewards.push(this.createRuntimeCard(card as CardDef));
      }
    }
    unlockManyCodexEntries('cards', rewards.map(c => c.id));
    return rewards;
  }

  // ==================== Event System ====================

  private startEvent(): void {
    const floor = this.getCurrentFloorNumber();
    const eligibleStoryEvents = STORY_EVENTS.filter(e => floor >= e.floorMin && floor <= e.floorMax);
    if (eligibleStoryEvents.length > 0) {
      const totalWeight = eligibleStoryEvents.reduce((sum, e) => sum + getStoryEventSelectionWeight(e.id), 0);
      let roll = this.rng() * totalWeight;
      let picked = eligibleStoryEvents[0];
      for (const eventDef of eligibleStoryEvents) {
        roll -= getStoryEventSelectionWeight(eventDef.id);
        if (roll <= 0) {
          picked = eventDef;
          break;
        }
      }
      this.state.activeEvent = { id: picked.id, data: {} };
      unlockCodexEntry('events', picked.id);
      this.state.screen = 'Event';
      return;
    }

    const events: ActiveEventState['id'][] = ['mysterious_shrine', 'heretic_altar'];
    const eventId = events[Math.floor(this.rng() * events.length)];

    this.state.activeEvent = { id: eventId };
    unlockCodexEntry('events', eventId);

    if (eventId === 'mysterious_shrine') {
      const relics = relicsData.filter(r => !r.corrupted);
      this.state.activeEvent.offeredRelicId = relics[Math.floor(this.rng() * relics.length)]?.id;
      if (this.state.activeEvent.offeredRelicId) unlockCodexEntry('relics', this.state.activeEvent.offeredRelicId);
    }

    this.state.screen = 'Event';
  }

  makeEventChoice(choice: 'accept' | 'decline'): void {
    const event = this.state.activeEvent;
    if (!event) return;
    if (getStoryEventDef(event.id)) {
      this.resolveStoryEventChoice(choice);
      return;
    }

    if (event.id === 'mysterious_shrine' && choice === 'accept') {
      if (event.offeredRelicId) {
        this.addRelicToPlayerInventory(event.offeredRelicId);
      }
    } else if (event.id === 'heretic_altar') {
      if (choice === 'accept') {
        this.state.player.corruption += 20;
        this.state.player.gold += 100;
      }
    }

    this.state.activeEvent = null;
    this.leaveCurrentRoomToMap();
  }

  private resolveStoryEventChoice(choice: string): void {
    const event = this.state.activeEvent;
    if (!event) return;
    event.data = { ...(event.data || {}), lastChoiceId: choice };
    const runEffects = this.ensureRunEffects();

    switch (event.id) {
      case 'rusting_medicae': {
        const n = calculateStoryEventNumbers('rusting_medicae', this.state) as any;
        if (event.stage === 'salvage_aftermath') {
          if (choice === 'medicae_salvage_fight') {
            this.state.activeEvent = null;
            this.startCombat('Elite');
            if (this.state.combat) {
              this.state.combat.warpPulse = { text: '暴走的医疗伺服扑向你！', tone: 'danger' };
            }
            this.notify();
            return;
          }
          if (choice === 'medicae_salvage_flee') {
            this.state.player.hp = Math.max(0, this.state.player.hp - (n.salvageFleeTrueDamage ?? 15));
            if (this.state.player.hp <= 0) {
              this.handlePlayerDefeated();
              return;
            }
            this.state.activeEvent = null;
            this.leaveCurrentRoomToMap();
            return;
          }
        }

        if (choice === 'medicae_implant') {
          const hpLoss = Math.max(1, Number(n.implantCurrentHpLoss ?? 1));
          this.state.player.hp = Math.max(1, this.state.player.hp - hpLoss);
          this.state.player.maxHp += Math.max(0, Number(n.implantMaxHpGain ?? 10));
          this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp);
          this.grantRelicDirect('rust_implants');
          this.addCardByIdToDeck('rejection_response');
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }

        if (choice === 'medicae_extract') {
          this.state.player.maxHp = Math.max(1, this.state.player.maxHp - Math.max(0, Number(n.extractMaxHpLoss ?? 5)));
          const heal = Math.max(1, Math.floor(this.state.player.maxHp * Math.max(0, Number(n.extractHealMaxHpRatio ?? 0.3))));
          this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
          this.state.player.corruption = Math.min(100, (this.state.player.corruption || 0) + Math.max(0, Number(n.extractCorruptionGain ?? 20)));
          this.grantRandomPotions(Math.max(0, Number(n.extractPotionCount ?? 2)), !!n.extractStrongPotionsOnly);
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }

        if (choice === 'medicae_salvage') {
          this.state.player.gold += Math.max(0, Number(n.salvageGoldGain ?? 100));
          this.grantRandomRelic({ normalOnly: n.salvageNormalRelicOnly !== false });
          event.stage = 'salvage_aftermath';
          event.data = { ...(event.data || {}), salvageRewardsClaimed: true };
          this.notify();
          return;
        }
        break;
      }
      case 'nameless_martyr_shrine': {
        const n = calculateStoryEventNumbers('nameless_martyr_shrine', this.state) as any;
        if (event.stage === 'free_remove') {
          if (choice === 'martyr_continue_remove') {
            this.state.screen = 'RemoveCard';
            this.notify();
          }
          return;
        }
        if (choice === 'martyr_offer_blood') {
          const maxHpLoss = Math.max(1, Number(n.offerBloodMaxHpLoss ?? 1));
          this.state.player.maxHp = Math.max(1, this.state.player.maxHp - maxHpLoss);
          this.state.player.hp = Math.min(this.state.player.hp, this.state.player.maxHp);
          this.grantRelicDirect('martyrs_mark');
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'martyr_offer_wealth') {
          const goldBefore = this.state.player.gold;
          this.state.player.gold = 0;
          if (goldBefore < Math.max(0, Number(n.offerWealthCurseGoldThreshold ?? 50))) {
            this.addCardByIdToDeck('greed_sin');
            this.state.activeEvent = null;
            this.leaveCurrentRoomToMap();
            return;
          }
          event.stage = 'free_remove';
          event.data = { ...(event.data || {}), freeRemovalsRemaining: Math.max(1, Number(n.offerWealthFreeRemovals ?? 2)) };
          this.state.screen = 'RemoveCard';
          this.notify();
          return;
        }
        if (choice === 'martyr_desecrate') {
          this.addCardByIdToDeck('execution_slash');
          this.state.player.devotion = Math.max(0, Number(n.desecrateDevotionSetTo ?? 0));
          runEffects.pendingWarpTideBonus = Math.max(runEffects.pendingWarpTideBonus || 0, Math.max(0, Number(n.desecrateWarpTideBonus ?? 30)));
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'martyr_inscribe_oath') {
          const hpLoss = Math.max(1, Number(n.inscribeHpLoss ?? 6));
          this.state.player.hp = Math.max(1, this.state.player.hp - hpLoss);
          this.enterEnchant('Event', 'blood_rune', {
            title: '殉道誓印',
            description: '在圣骨前为一张牌刻下血色铭文。',
            returnScreen: 'Event'
          });
          return;
        }
        break;
      }
      case 'warp_tear_whispers': {
        const n = calculateStoryEventNumbers('warp_tear_whispers', this.state) as any;
        if (choice === 'tear_embrace') {
          this.transformBaseCardsIntoWarped();
          this.state.player.corruption = Math.max(0, Math.min(100, Number(n.embraceCorruptionSetTo ?? 100)));
          runEffects.warpDebuffCombatsRemaining = Math.max(0, Number(n.embraceWarpDebuffCombats ?? 3));
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'tear_bargain') {
          this.grantRandomRelic({ corruptedOnly: true, warpBiased: true });
          this.destroyRandomNonBasicCard();
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'tear_seal') {
          this.state.player.devotion = (this.state.player.devotion || 0) + Math.max(0, Number(n.sealDevotionGain ?? 50));
          if (n.sealClearPendingWarpTideBonus !== false) {
            runEffects.pendingWarpTideBonus = 0;
          }
          this.addCardByIdToDeck('psychic_backlash');
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        break;
      }
      case 'inquisitor_legacy': {
        const n = calculateStoryEventNumbers('inquisitor_legacy', this.state) as any;
        if (choice === 'legacy_inscribe_sigil') {
          this.enterEnchant('Event', 'swift_sigil', {
            title: '审判官刻印',
            description: '为一张牌烙下迅捷印记。',
            returnScreen: 'Event'
          });
          return;
        }
        if (choice === 'legacy_open_casket') {
          this.state.player.hp = Math.max(1, this.state.player.hp - Math.max(1, Number(n.openCasketCurrentHpLoss ?? 1)));
          runEffects.enemyHuntBonusPct = Math.max(runEffects.enemyHuntBonusPct || 0, Math.max(0, Number(n.openCasketEnemyHuntBonusPct ?? 0.1)));
          this.grantRelicDirect('chaos_sanctum_relic');
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'legacy_read_codex') {
          this.state.player.intel += Math.max(0, Number(n.readCodexIntelGain ?? 30));
          if (n.readCodexRevealAllMapNodes !== false) {
            this.state.map.forEach(node => { node.revealed = true; });
          }
          this.state.player.maxHp = Math.max(1, this.state.player.maxHp - Math.max(0, Number(n.readCodexMaxHpLoss ?? 10)));
          this.state.player.hp = Math.min(this.state.player.hp, this.state.player.maxHp);
          this.addCardByIdToDeck('paranoia');
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'legacy_take_rosary') {
          this.grantRelicDirect('inquisitor_rosary');
          this.state.player.hp = Math.max(1, this.state.player.hp - Math.max(0, Number(n.takeRosarySelfDamage ?? 10)));
          this.state.activeEvent = null;
          this.leaveCurrentRoomToMap();
          return;
        }
        break;
      }
    }
  }

  private addCardByIdToDeck(cardId: string): void {
    const card = (cardsData as any[]).find(c => c.id === cardId);
    if (!card) return;
    unlockCodexEntry('cards', card.id);
    this.state.player.deck.push(this.createRuntimeCard(card as CardDef));
  }

  private addRelicToPlayerInventory(relicId: string, options: { corruptedOverride?: boolean } = {}): boolean {
    if (!relicId || this.state.player.relics.includes(relicId)) return false;
    const relic = (relicsData as any[]).find(r => r.id === relicId);
    if (!relic) return false;
    unlockCodexEntry('relics', relicId);

    const isCorrupted = typeof options.corruptedOverride === 'boolean' ? options.corruptedOverride : !!relic.corrupted;
    this.state.player.relics.push(relicId);
    this.state.player.relicStates[relicId] = { level: 1, progress: 0, corrupted: isCorrupted };

    if (this.state.combat) {
      this.state.combat.player.corruptionAxis = Math.min(100, Math.max(0, this.state.player.corruption || 0));
      this.state.combat.player.devotion = this.state.player.devotion || 0;
      this.state.combat.warpPulse = {
        text: `获得遗物：${relic.name}`,
        tone: isCorrupted ? 'warp' : 'faith'
      };
    }

    globalEventBus.publish({ type: 'RelicAcquired', relicId } as any);
    return true;
  }

  private grantRelicDirect(relicId: string): void {
    this.addRelicToPlayerInventory(relicId);
  }

  private grantRandomPotions(count: number, strongOnly = false): void {
    const potionSlotLimit = getPotionRuntimeConfig().slotLimit;
    const unlockedIds = new Set(this.state.metaRuntime?.unlockedPoolIds || []);
    const weightBonus = getMetaUnlockedWeightBonus();
    const pool = (potionsData as any[]).filter(p => !strongOnly || (p.price ?? 0) >= 130);
    for (let i = 0; i < count; i++) {
      if (this.state.player.potions.length >= potionSlotLimit) return;
      const pickPool = pool.length > 0 ? pool : (potionsData as any[]);
      const weighted: any[] = [];
      for (const p of pickPool) {
        weighted.push(p);
        if (unlockedIds.has(p.id)) {
          for (let j = 0; j < weightBonus; j++) weighted.push(p);
        }
      }
      const potion = (weighted.length > 0 ? weighted : pickPool)[Math.floor(this.rng() * (weighted.length > 0 ? weighted.length : pickPool.length))];
      if (potion) {
        unlockCodexEntry('potions', potion.id);
        this.state.player.potions.push(potion.id);
      }
    }
  }

  private grantRandomRelic(options: { normalOnly?: boolean; corruptedOnly?: boolean; warpBiased?: boolean } = {}): void {
    const unlockedIds = new Set(this.state.metaRuntime?.unlockedPoolIds || []);
    const weightBonus = getMetaUnlockedWeightBonus();
    let pool = (relicsData as any[]).filter(r => !this.state.player.relics.includes(r.id));
    if (options.normalOnly) {
      pool = pool.filter(r => !r.corrupted && (r.price ?? 0) <= 220);
    }
    if (options.corruptedOnly) {
      pool = pool.filter(r => !!r.corrupted || String(r.id).includes('warp') || String(r.id).includes('chaos'));
    }
    if (options.warpBiased) {
      const warpPool = pool.filter(r => String(r.id).includes('warp') || !!r.corrupted || String(r.name || '').toLowerCase().includes('chaos'));
      if (warpPool.length > 0) pool = warpPool;
    }
    const weighted: any[] = [];
    for (const r of pool) {
      weighted.push(r);
      if (unlockedIds.has(r.id)) {
        for (let j = 0; j < weightBonus; j++) weighted.push(r);
      }
    }
    const sourcePool = weighted.length > 0 ? weighted : pool;
    const relic = sourcePool[Math.floor(this.rng() * Math.max(1, sourcePool.length))];
    if (relic?.id) this.grantRelicDirect(relic.id);
  }

  private destroyRandomNonBasicCard(): void {
    const candidates = this.state.player.deck.filter(c => !['strike', 'defend'].includes(c.id));
    if (candidates.length === 0) return;
    const doomed = candidates[Math.floor(this.rng() * candidates.length)];
    if (!doomed?.instanceId) return;
    this.state.player.deck = this.state.player.deck.filter(c => c.instanceId !== doomed.instanceId);
  }

  private transformBaseCardsIntoWarped(): void {
    const characterId = this.state.character?.id;
    const pool = (cardsData as any[]).filter(c =>
      (c.rarity === 'Uncommon' || c.rarity === 'Rare') &&
      c.id !== 'strike' && c.id !== 'defend' &&
      ((((c as any).character ?? 'All') === 'All') || (c as any).character === characterId)
    );
    if (pool.length === 0) return;
    this.state.player.deck = this.state.player.deck.map(card => {
      if (!['strike', 'defend'].includes(card.id)) return card;
      const replacement = pool[Math.floor(this.rng() * pool.length)];
      if (!replacement) return card;
      return this.createRuntimeCard(replacement as CardDef, card.instanceId || this.generateId());
    });
  }

  // ==================== Shop System ====================

  private enterShop(): void {
    const unlockedIds = new Set(this.state.metaRuntime?.unlockedPoolIds || []);
    const weightBonus = getMetaUnlockedWeightBonus();
    const weightedShufflePick = <T extends { id: string }>(pool: T[], count: number): T[] => {
      return [...pool]
        .map(item => ({
          item,
          score: this.rng() + (unlockedIds.has(item.id) ? weightBonus * 0.35 : 0)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(x => x.item);
    };
    this.state.shopCards = this.generateCardRewards(6);

    const relics = relicsData.filter(r => !this.state.player.relics.includes(r.id));
    this.state.shopRelics = weightedShufflePick(relics as any[], 3)
      .map(r => r.id);
    unlockManyCodexEntries('relics', this.state.shopRelics);

    const potions = potionsData as any[];
    this.state.shopPotions = weightedShufflePick(potions as any[], 3)
      .map(p => p.id);
    unlockManyCodexEntries('potions', this.state.shopPotions);

    this.state.screen = 'Shop';
  }

  buyCard(cardInstanceId: string): void {
    const card = this.state.shopCards.find(c => c.instanceId === cardInstanceId);
    if (!card) return;

    const price = (balanceSystem as any).getCardPrice?.(card.rarity) ?? (card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50);
    if (this.state.player.gold < price) return;

    this.state.player.gold -= price;
    this.state.player.deck.push(this.createRuntimeCard(card));
    this.state.shopCards = this.state.shopCards.filter(c => c.instanceId !== cardInstanceId);
    this.notify();
  }

  buyRelic(relicId: string): void {
    const relic = relicsData.find(r => r.id === relicId);
    if (!relic || this.state.player.relics.includes(relicId)) return;

    if (this.state.player.gold < relic.price) return;

    this.state.player.gold -= relic.price;
    this.addRelicToPlayerInventory(relicId);
    this.state.shopRelics = this.state.shopRelics.filter(id => id !== relicId);
    this.notify();
  }

  buyPotion(potionId: string): void {
    const potion = (potionsData as any[]).find(p => p.id === potionId);
    if (!potion) return;
    unlockCodexEntry('potions', potionId);

    if (this.state.player.gold < potion.price) return;
    if (this.state.player.potions.length >= getPotionRuntimeConfig().slotLimit) return;

    this.state.player.gold -= potion.price;
    this.state.player.potions.push(potionId);
    this.state.shopPotions = this.state.shopPotions.filter(id => id !== potionId);
    this.notify();
  }

  removeCard(cardInstanceId: string): void {
    const card = this.state.player.deck.find(c => c.instanceId === cardInstanceId);
    if (!card) return;
    this.tryDelegatedRemoveCard(cardInstanceId);

    const freeEventRemoval = this.isEventFreeCardRemovalMode();
    const removeCost = freeEventRemoval ? 0 : this.getCardRemovalCostForCard(card);
    if (!freeEventRemoval && this.state.player.gold < removeCost) return;

    if (!freeEventRemoval) {
      this.state.player.gold -= removeCost;
    }
    this.state.player.deck = this.state.player.deck.filter(c => c.instanceId !== cardInstanceId);

    if (freeEventRemoval) {
      const eventData = this.state.activeEvent?.data || {};
      eventData.freeRemovalsRemaining = Math.max(0, Number(eventData.freeRemovalsRemaining || 0) - 1);
      if (this.state.activeEvent) this.state.activeEvent.data = eventData;
      if ((eventData.freeRemovalsRemaining || 0) > 0) {
        this.notify();
        return;
      }
      this.state.activeEvent = null;
      this.leaveCurrentRoomToMap();
      return;
    }

    this.state.cardRemovalCost += 25;
    this.state.screen = 'Shop';
    this.notify();
  }

  // ==================== Rest System ====================

  restHeal(): void {
    if (this.state.campfireChoiceLocked) return;
    this.state.campfireChoiceLocked = true;
    if (!this.tryDelegatedRest()) {
      const healAmount = Math.floor(this.state.player.maxHp * 0.3);
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmount);
    }
    this.leaveCurrentRoomToMap();
  }

  restUpgrade(): void {
    this.state.upgradeReturnScreen = 'Rest';
    this.state.screen = 'Upgrade';
    this.notify();
  }

  upgradeCard(cardInstanceId: string): void {
    const cardIndex = this.state.player.deck.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return;
    this.tryDelegatedUpgradeCard(cardInstanceId);

    const card = normalizeRunCardInstance(this.state.player.deck[cardIndex], () => this.generateId());
    if (!card.upgrade || card.isUpgraded) return;

    const upgradedBase = {
      ...card.runtimeBase,
      ...card.upgrade,
      id: card.id,
      isUpgraded: true
    } as CardDef;
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
    this.notify();
  }

  // ==================== Reward System ====================

  takeReward(cardInstanceId?: string): void {
    if (this.tryDelegatedTakeReward(cardInstanceId)) {
      this.leaveCurrentRoomToMap();
      return;
    }

    if (cardInstanceId) {
      const card = this.state.rewardCards.find(c => c.instanceId === cardInstanceId);
      if (card) {
        this.state.player.deck.push(this.createRuntimeCard(card as CardDef));
        metricsTracker.recordCardAcquired();
      }
    }

    this.state.rewardCards = [];
    this.syncActiveRoomBridgeAfterLegacyAction('take_reward');
    this.leaveCurrentRoomToMap();
  }

  skipReward(): void {
    if (this.tryDelegatedSkipReward()) {
      this.leaveCurrentRoomToMap();
      return;
    }

    this.state.rewardCards = [];
    this.syncActiveRoomBridgeAfterLegacyAction('skip_reward');
    this.leaveCurrentRoomToMap();
  }

  // ==================== Utility ====================

  private generateId(): string {
    return `${Date.now()}_${this.rng().toString(36).slice(2, 11)}`;
  }

  private syncPlayerStateFromCombat(): void {
    const combat = this.state.combat;
    if (!combat) return;
    this.state.player.hp = combat.player.hp;
    this.state.player.maxHp = combat.player.maxHp;
    this.state.player.intel = combat.player.intel ?? this.state.player.intel;
    this.state.player.devotion = combat.player.devotion ?? this.state.player.devotion;
  }

  // ==================== Save/Load ====================

  getSaveData(): object {
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
    }
    this.syncRuntimeDelegateFromLegacyState('load_snapshot');
    this.notify();
  }

  // ==================== UI Compatibility Layer ====================

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

  resolveEventChoice(choice: string): void {
    const event = this.state.activeEvent;
    if (!event) return;
    this.tryDelegatedChooseEventOption(choice);
    event.data = { ...(event.data || {}), lastChoiceId: choice };
    if (getStoryEventDef(event.id)) {
      this.resolveStoryEventChoice(choice);
      return;
    }

    if (event.id === 'mysterious_shrine') {
      if (choice === 'pray') {
        this.state.player.maxHp += 10;
        this.state.player.hp += 10;
      }
      this.state.activeEvent = null;
      this.leaveCurrentRoomToMap();
      return;
    }

    if (event.id === 'heretic_altar') {
      if (choice === 'accept_corruption') {
        if (event.offeredRelicId) {
          this.addRelicToPlayerInventory(event.offeredRelicId, { corruptedOverride: true });
        }
        this.state.player.corruption += 10;
      }
      this.state.activeEvent = null;
      this.leaveCurrentRoomToMap();
      return;
    }

    this.makeEventChoice('decline');
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
    this.notify();
  }

  cancelUpgrade(): void {
    if (this.state.pendingUpgradeRefund) {
      this.state.player.gold += 50;
      this.state.pendingUpgradeRefund = false;
    }
    if (this.state.upgradeReturnScreen === 'Rest' && this.state.campfireChoiceLocked) {
      this.state.upgradeReturnScreen = undefined;
      this.leaveCurrentRoomToMap();
      return;
    }
    this.state.screen = this.state.upgradeReturnScreen || 'Map';
    this.state.upgradeReturnScreen = undefined;
    this.notify();
  }

  enterCardRemoval(): void {
    this.state.screen = 'RemoveCard';
    this.notify();
  }

  cancelCardRemoval(): void {
    if (this.isEventFreeCardRemovalMode()) {
      this.state.screen = 'Event';
      this.notify();
      return;
    }
    this.state.screen = 'Shop';
    this.notify();
  }

  isEventFreeCardRemovalMode(): boolean {
    return this.state.screen === 'RemoveCard' &&
      !!this.state.activeEvent &&
      this.state.activeEvent.stage === 'free_remove' &&
      Number(this.state.activeEvent.data?.freeRemovalsRemaining || 0) > 0;
  }

  getEventFreeRemovalsRemaining(): number {
    if (!this.isEventFreeCardRemovalMode()) return 0;
    return Math.max(0, Number(this.state.activeEvent?.data?.freeRemovalsRemaining || 0));
  }

  getCardRemovalCostForCard(card: CardDef | { tags?: string[] }): number {
    const doubleCost = Array.isArray(card.tags) && card.tags.includes('DoubleRemoveCost');
    return this.state.cardRemovalCost * (doubleCost ? 2 : 1);
  }

  pickRewardCard(cardInstanceId: string): void {
    this.takeReward(cardInstanceId);
  }

  getAdjustedShopPrice(basePrice: number): number {
    let multiplier = 1;
    if (this.state.player.relics.includes('lantern')) multiplier *= 0.95;
    return Math.max(1, Math.round(basePrice * multiplier));
  }

  buyShopCard(cardInstanceId: string, basePrice?: number): void {
    if (typeof basePrice !== 'number') {
      this.buyCard(cardInstanceId);
      return;
    }
    const card = this.state.shopCards.find(c => c.instanceId === cardInstanceId);
    if (!card) return;
    const price = this.getAdjustedShopPrice(basePrice);
    if (this.state.player.gold < price) return;
    this.state.player.gold -= price;
    this.state.player.deck.push(this.createRuntimeCard(card));
    this.state.shopCards = this.state.shopCards.filter(c => c.instanceId !== cardInstanceId);
    metricsTracker.recordGoldSpent(price);
    metricsTracker.recordCardAcquired();
    this.syncActiveRoomBridgeAfterLegacyAction('buy_shop_card');
    this.notify();
  }

  buyShopRelic(relicId: string, basePrice?: number): void {
    const relic = (relicsData as any[]).find(r => r.id === relicId);
    if (!relic || this.state.player.relics.includes(relicId)) return;
    const price = this.getAdjustedShopPrice(basePrice ?? relic.price);
    if (this.state.player.gold < price) return;
    this.state.player.gold -= price;
    this.addRelicToPlayerInventory(relicId);
    this.state.shopRelics = this.state.shopRelics.filter(id => id !== relicId);
    metricsTracker.recordGoldSpent(price);
    metricsTracker.recordRelicAcquired();
    this.syncActiveRoomBridgeAfterLegacyAction('buy_shop_relic');
    this.notify();
  }

  buyShopPotion(potionId: string, basePrice?: number, index?: number): void {
    if (this.state.player.potions.length >= getPotionRuntimeConfig().slotLimit) return;
    const potion = (potionsData as any[]).find(p => p.id === potionId);
    if (!potion) return;
    unlockCodexEntry('potions', potionId);
    const price = this.getAdjustedShopPrice(basePrice ?? potion.price);
    if (this.state.player.gold < price) return;
    this.state.player.gold -= price;
    this.state.player.potions.push(potionId);
    if (typeof index === 'number' && this.state.shopPotions[index] === potionId) {
      this.state.shopPotions.splice(index, 1);
    } else {
      this.state.shopPotions = this.state.shopPotions.filter(id => id !== potionId);
    }
    metricsTracker.recordGoldSpent(price);
    this.syncActiveRoomBridgeAfterLegacyAction('buy_shop_potion');
    this.notify();
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
    const context = this.state.enchantContext;
    if (!context) return null;
    const card = this.state.player.deck.find((entry) => entry.instanceId === cardInstanceId);
    if (!card) return null;
    const enchantment = getCardEnchantmentDefById(context.enchantmentId);
    if (!enchantment || enchantment.scope !== 'persistent') return null;
    return applyPersistentEnchantmentToInstance(normalizeRunCardInstance(card, () => this.generateId()), enchantment);
  }

  usePotion(index: number): void {
    const combat = this.state.combat;
    const potionId = this.state.player.potions[index];
    if (!combat || potionId == null) return;
    unlockCodexEntry('potions', potionId);

    const potion = (potionsData as any[]).find(p => p.id === potionId) as any;
    if (!potion) return;

    const toxicity = potion.toxicity ?? 1;
    combat.player.potionToxicity = (combat.player.potionToxicity || 0) + toxicity;
    combat.player.potionsUsedThisTurn = (combat.player.potionsUsedThisTurn || 0) + 1;

    const applyStatusToEnemy = (status: string, amount: number) => {
      const target = combat.enemies.find(e => e.hp > 0);
      if (!target) return;
      target.statuses[status] = (target.statuses[status] || 0) + amount;
    };
    const applyStatusToAllEnemies = (status: string, amount: number) => {
      combat.enemies.filter(e => e.hp > 0).forEach(e => {
        e.statuses[status] = (e.statuses[status] || 0) + amount;
      });
    };

    const effect = potion.effect || {};
    switch (effect.type) {
      case 'Heal':
        combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + Math.round(combat.player.maxHp * (effect.amount ?? 0)));
        this.state.player.hp = combat.player.hp;
        break;
      case 'GainBlock':
        combat.player.block += effect.amount ?? 0;
        break;
      case 'GainEnergy':
        combat.player.energy += effect.amount ?? 0;
        break;
      case 'ApplyStatus':
        if (effect.target === 'Self') {
          combat.player.statuses[effect.status] = (combat.player.statuses[effect.status] || 0) + (effect.amount ?? 0);
        } else if (effect.target === 'AllEnemies') {
          applyStatusToAllEnemies(effect.status, effect.amount ?? 0);
        } else {
          applyStatusToEnemy(effect.status, effect.amount ?? 0);
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
        this.drawCards(Math.max(0, 7 - roll));
        break;
      }
      case 'LiquidLightning':
        combat.player.energy += 3;
        combat.player.statuses['Electrified'] = 1;
        break;
      case 'PurifyingTears': {
        const purgeable = combat.hand.filter(c => (c.tags || []).includes('Curse') || (c.tags || []).includes('Status'));
        const count = purgeable.length;
        if (count > 0) {
          combat.exhaustPile.push(...purgeable);
          combat.hand = combat.hand.filter(c => !purgeable.includes(c));
          const target = [...combat.enemies].filter(e => e.hp > 0).sort((a, b) => b.hp - a.hp)[0];
          if (target) {
            const dmg = count * 15;
            const dealt = Math.max(0, dmg - (target.block || 0));
            target.block = Math.max(0, (target.block || 0) - dmg);
            target.hp = Math.max(0, target.hp - dealt);
            if (target.hp <= 0) {
              globalEventBus.publish({ type: 'EnemyDeath', enemyId: target.id } as any);
            }
          }
        }
        break;
      }
      case 'MutagenicDraft':
        combat.player.energy += 2;
        combat.player.block += 8;
        combat.player.statuses['Strength'] = (combat.player.statuses['Strength'] || 0) + 2;
        combat.player.statuses['Poison'] = (combat.player.statuses['Poison'] || 0) + 2;
        break;
      case 'HexagrammaticWards':
        combat.player.statuses['HexWard'] = Math.max(combat.player.statuses['HexWard'] || 0, 3);
        combat.warpTide = Math.max(0, (combat.warpTide || 0) - 10);
        break;
      default:
        // Fallback: do nothing besides consuming the potion.
        break;
    }

    this.state.player.potions.splice(index, 1);
    metricsTracker.recordPotionUsed();
    this.notify();
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

  loadCharacterPortrait(): string {
    const id = this.state.character?.id || 'informant';
    const url = `/assets/characters/${id}.png`;
    this.state.player.portraitUrl = url;
    return url;
  }

  leaveCurrentRoomToMap(): void {
    const currentNode = this.state.currentNodeId
      ? this.state.map.find((n) => n.id === this.state.currentNodeId)
      : null;
    const isFinalBossNode = currentNode?.type === 'Boss' && (!currentNode.next || currentNode.next.length === 0);

    this.state.activeEvent = null;
    this.state.enchantContext = null;
    this.clearCombatAfflictionsForRunCards();
    if (isFinalBossNode) {
      metricsTracker.recordRunEnd(true, this.getCurrentFloorNumber());
      this.applyRunTransition({ type: 'RUN_ENDED', phase: 'victory' });
      globalEventBus.publish({ type: RuntimeEventType.RunVictory, timestamp: Date.now() } as any);
    } else {
      const delegated = this.tryDelegatedLeaveRoom();
      if (!delegated) {
        const actionByScreen: Partial<Record<GameState['screen'], RunAction>> = {
          Reward: { type: 'REWARD_TAKEN' },
          Event: { type: 'EVENT_RESOLVED' },
          Shop: { type: 'SHOP_LEFT' },
          Upgrade: { type: 'SHOP_LEFT' },
          RemoveCard: { type: 'SHOP_LEFT' },
          Rest: { type: 'REST_COMPLETED' }
        };
        const action = actionByScreen[this.state.screen] ?? { type: 'EVENT_RESOLVED' };
        this.applyRunTransition(action);
      }
    }
    globalEventBus.publish({
      type: RuntimeEventType.NodeCompleted,
      nodeId: this.state.currentNodeId,
      screen: this.state.screen,
      timestamp: Date.now()
    } as any);
    this.syncRuntimeDelegateFromLegacyState('leave_room');
    this.notify();
  }
}
