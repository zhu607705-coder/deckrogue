import type { GameState, MapNode, CardDef, RunCardInstance, RelicDef, PotionDef } from '@/core/types';
import { deriveRunTransitionState, runPhaseToScreen, transitionRunState, type RunAction } from '@/core/events/runStateMachine';
import { runGenerator } from '@/core/events/runGenerator';
import { metricsTracker } from '@/core/events/metricsTracker';
import { unlockManyCodexEntries } from '@/core/persistence/codexStore';
import { globalEventBus } from '@/core/events/eventBus';
import { RuntimeEventType } from '@/core/events/eventContract';
import {
  createRoomSessionForNode,
  setRoomSession,
  syncRoomSessionFromLegacyState,
  syncRoomSessionFromTransition,
} from '@/core/events/roomSession';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import {
  analyzeRouteSignals,
  cardsData,
  getCardEnchantmentDefById,
  getKnownRouteTagsForCharacter,
  getPreferredRouteTagFromState,
  getRelicRouteTags,
  maybeRecordRouteCommit,
  getPotionRuntimeConfig,
  getRouteSupportRelicIds,
  potionsData,
  relicsData,
  resolvePreferredRouteTag,
  resolveShopOfferPrice,
  syncRouteStateFromLegacyState,
} from '@/content/narrative/numericSystem';
import { balanceSystem } from '@/core/balance/balanceSystem';
import { normalizeRunCardInstance, deriveRunCardInstance } from '@/core/combat/runCardInstance';
import charactersDataRaw from '@/content/data/characters.json';
import type { CharacterDef } from '@/core/types';

const charactersData = charactersDataRaw as CharacterDef[];

function resolveCurrentRouteTag(
  deck: RunCardInstance[],
  routeTagsForCharacter: string[],
  routeState: GameState['routeState'],
): string | null {
  const statePreferredTag = getPreferredRouteTagFromState(deck, routeTagsForCharacter, routeState ?? null);
  const latestCardPreferredTag = resolvePreferredRouteTag(deck, routeTagsForCharacter, 1);
  const hasExplicitRecentCommit = (routeState?.recentCommits?.length ?? 0) > 0;
  if (latestCardPreferredTag && latestCardPreferredTag !== statePreferredTag && !hasExplicitRecentCommit) {
    return latestCardPreferredTag;
  }
  return statePreferredTag ?? latestCardPreferredTag;
}

export interface RunFlowManagerDeps {
  getState: () => GameState;
  setState: (updater: (state: GameState) => void) => void;
  rng: () => number;
  generateId: () => string;
  notify: () => void;
  shuffleDeck: <T>(deck: T[]) => T[];
  getCurrentFloorNumber: () => number;
  applyAscensionMapModifiers: () => void;
  selectCharacterLegacy: (characterId: string) => boolean;
  syncRuntimeFromLegacyState: (reason: string) => void;
  recordDelegationFallback: (reason: unknown) => void;
  moveToNodeLegacy: (nodeId: string) => boolean;
  canMoveToNode: (nodeId: string) => boolean;
  getNode: (nodeId: string) => MapNode | null;
  resolveNodeEntry: (node: MapNode) => void;
  leaveCurrentRoomToMap: () => void;
  enterCombat: (nodeType: 'Combat' | 'Elite' | 'Boss') => void;
  enterShop: () => void;
  enterRest: () => void;
  enterEvent: () => void;
  createRuntimeCard: (card: CardDef, instanceId?: string) => RunCardInstance;
  getAdjustedShopPrice: (basePrice: number) => number;
  appendVoxLog: (message: string) => void;
  generateCardRewards: (count: number, options?: { source?: 'combat' | 'shop' }) => RunCardInstance[];
  isEventFreeCardRemovalMode: () => boolean;
  getEventFreeRemovalsRemaining: () => number;
}

export class RunFlowManager {
  constructor(private deps: RunFlowManagerDeps) {}

  applyRunTransition(action: RunAction): void {
    const state = this.deps.getState();
    try {
      const next = transitionRunState(deriveRunTransitionState(state), action);
      state.screen = runPhaseToScreen(next.phase);
      syncRoomSessionFromTransition(state, next);
    } catch (error: any) {
      console.error('[RunFlowManager] Illegal run transition:', {
        action: action.type,
        fromPhase: state.screen,
        error: error.message
      });
    }
  }

  selectCharacterLegacy(characterId: string): boolean {
    const state = this.deps.getState();
    const charDef = charactersData.find(c => c.id === characterId);
    if (!charDef) return false;

    state.character = charDef;
    state.player.maxHp = charDef.maxHp;
    state.player.hp = charDef.maxHp;
    state.player.maxEnergy = charDef.maxEnergy;
    state.player.energy = charDef.maxEnergy;
    state.player.gold = 99;
    state.player.deck = charDef.startingDeck.map(cardId => {
      const def = cardsData.find(c => c.id === cardId);
      return def ? this.deps.createRuntimeCard(def, this.deps.generateId()) : null;
    }).filter(Boolean);
    unlockManyCodexEntries('cards', state.player.deck.map((c: any) => c.id));

    state.map = runGenerator.generateMap(state.seed, 10);
    this.deps.applyAscensionMapModifiers();
    state.currentNodeId = null;
    state.screen = 'Map';
    state.surfaceContext = null;
    syncRouteStateFromLegacyState(state);

    metricsTracker.startRun(state.seed, characterId);
    return true;
  }

  resolveCurrentNodeEntry(node: MapNode): void {
    const state = this.deps.getState();
    const runEffects = state.player.runEffects;
    const skipNextNode = runEffects?.skipNextNode;
    if (skipNextNode) {
      state.player.runEffects = { ...runEffects, skipNextNode: false };
      const roomResolutionToken = state.roomResolutionToken ?? `room_${node.id}_${this.deps.generateId()}`;
      state.roomResolutionToken = roomResolutionToken;
      this.applyRunTransition({ type: 'EVENT_RESOLVED', roomResolutionToken });
      this.deps.syncRuntimeFromLegacyState('skip_node');
      this.deps.notify();
      return;
    }

    state.campfireChoiceLocked = false;
    switch (node.type) {
      case 'Combat':
      case 'Elite':
      case 'Boss':
        this.deps.enterCombat(node.type);
        break;
      case 'Event':
        this.deps.enterEvent();
        break;
      case 'Shop':
        this.deps.enterShop();
        break;
      case 'Rest':
        state.campfireChoiceLocked = false;
        state.screen = 'Rest';
        break;
    }
  }

  moveToNodeLegacy(nodeId: string): boolean {
    const state = this.deps.getState();
    if (state.pendingNodeResolution) return false;
    const node = state.map.find(n => n.id === nodeId);
    if (!node) return false;

    if (!state.currentNodeId && node.y !== 0) return false;
    const currentNode = state.map.find(n => n.id === state.currentNodeId);
    if (currentNode && !currentNode.next.includes(nodeId)) return false;

    state.currentNodeId = nodeId;
    node.revealed = true;
    const ownerKind =
      node.type === 'Combat' || node.type === 'Elite' || node.type === 'Boss'
        ? 'combat'
        : node.type === 'Event'
          ? 'event'
          : node.type === 'Shop'
            ? 'shop'
            : 'rest';
    setRoomSession(state, createRoomSessionForNode({
      token: `room_${nodeId}_${this.deps.generateId()}`,
      nodeId,
      ownerKind,
    }));
    this.resolveCurrentNodeEntry(node);
    return true;
  }

  handleCombatVictory(): void {
    const state = this.deps.getState();
    state.combat = null;
    state.combatRestartCheckpoint = undefined;
    this.applyRunTransition({ type: 'COMBAT_WON', roomResolutionToken: state.roomResolutionToken ?? undefined });
    this.deps.notify();
  }

  handlePlayerDefeated(): void {
    const state = this.deps.getState();
    state.combatRestartCheckpoint = undefined;
    metricsTracker.recordRunEnd(false, this.deps.getCurrentFloorNumber());
    this.applyRunTransition({ type: 'PLAYER_DIED' });
    globalEventBus.publish({
      type: RuntimeEventType.PlayerDefeated,
      timestamp: Date.now()
    });
    this.deps.notify();
  }

  handleRunVictory(): void {
    const state = this.deps.getState();
    metricsTracker.recordRunEnd(true, this.deps.getCurrentFloorNumber());
    this.applyRunTransition({ type: 'RUN_ENDED', phase: 'victory' });
    globalEventBus.publish({ type: RuntimeEventType.RunVictory, timestamp: Date.now() });
    this.deps.notify();
  }

  leaveCurrentRoomToMap(): void {
    const state = this.deps.getState();
    const currentNode = state.currentNodeId
      ? state.map.find((n) => n.id === state.currentNodeId)
      : null;
    const isFinalBossNode = currentNode?.type === 'Boss' && (!currentNode.next || currentNode.next.length === 0);
    state.activeEvent = null;
    state.enchantContext = null;
    const roomSession = syncRoomSessionFromLegacyState(state, {
      isEventFreeCardRemovalMode: this.deps.isEventFreeCardRemovalMode(),
    });
    const roomResolutionToken = roomSession?.token ?? null;
    const roomResolutionKind = roomSession?.resolverKind ?? null;

    if (isFinalBossNode) {
      this.handleRunVictory();
    } else {
      const actionByKind: Partial<Record<NonNullable<GameState['roomResolutionKind']>, RunAction>> = {
        reward: { type: 'REWARD_TAKEN', roomResolutionToken },
        event: { type: 'EVENT_RESOLVED', roomResolutionToken },
        shop: { type: 'SHOP_LEFT', roomResolutionToken },
        rest: { type: 'REST_COMPLETED', roomResolutionToken }
      };
      const action = (roomResolutionKind ? actionByKind[roomResolutionKind] : null) ?? { type: 'EVENT_RESOLVED', roomResolutionToken };
      this.applyRunTransition(action);
    }

    globalEventBus.publish({
      type: RuntimeEventType.NodeCompleted,
      nodeId: state.currentNodeId,
      data: { nodeId: state.currentNodeId },
      timestamp: Date.now()
    });

    this.deps.syncRuntimeFromLegacyState('leave_room');
    this.deps.notify();
  }

  moveToNode(nodeId: string): boolean {
    if (!this.deps.canMoveToNode(nodeId)) return false;
    const node = this.deps.getNode(nodeId);
    if (!node) return false;

    if (!this.deps.moveToNodeLegacy(nodeId)) return false;
    this.deps.syncRuntimeFromLegacyState('move_to_node');
    return true;
  }

  enterShop(): void {
    const state = this.deps.getState();
    const unlockedIds = new Set(state.metaRuntime?.unlockedPoolIds || []);
    const weightBonus = 0;
    const floor = this.deps.getCurrentFloorNumber();
    const routeProfile = analyzeRouteSignals(state.player.deck);
    const routeTagsForCharacter = state.character?.id ? getKnownRouteTagsForCharacter(state.character.id) : [];
    syncRouteStateFromLegacyState(state);
    const preferredRouteTag = resolveCurrentRouteTag(state.player.deck, routeTagsForCharacter, state.routeState ?? null);

    const weightedShufflePick = <T extends { id: string }>(pool: T[], count: number): T[] => {
      return [...pool]
        .map(item => ({
          item,
          score: this.deps.rng() + (unlockedIds.has(item.id) ? weightBonus * 0.35 : 0)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(x => x.item);
    };

    state.shopCards = this.deps.generateCardRewards(6, { source: 'shop' });
    const availableRelics = relicsData.filter(r => !state.player.relics.includes(r.id)) as RelicDef[];
    const activeRouteTag = preferredRouteTag ?? routeProfile.dominantTag;
    const alignedRelicPool =
      floor >= 3 && activeRouteTag
        ? availableRelics.filter((relic) => getRouteSupportRelicIds(activeRouteTag).includes(relic.id))
        : [];
    const chosenRelics: RelicDef[] = [];
    if (alignedRelicPool.length > 0) {
      chosenRelics.push(...weightedShufflePick(alignedRelicPool, 1));
    }
    const remainingRelics = availableRelics.filter((relic) => !chosenRelics.some((chosen) => chosen.id === relic.id));
    chosenRelics.push(...weightedShufflePick(remainingRelics, Math.max(0, 3 - chosenRelics.length)));
    state.shopRelics = chosenRelics.slice(0, 3).map(r => r.id);
    unlockManyCodexEntries('relics', state.shopRelics);

    state.shopPotions = weightedShufflePick(potionsData as PotionDef[], 3).map(p => p.id);
    unlockManyCodexEntries('potions', state.shopPotions);

    state.screen = 'Shop';
  }

  buyCard(cardInstanceId: string, priceOverride?: number): void {
    const state = this.deps.getState();
    const card = state.shopCards.find(c => c.instanceId === cardInstanceId);
    if (!card) return;

    const price = resolveShopOfferPrice(
      'card',
      priceOverride ?? ((balanceSystem as any).getCardPrice?.(card.rarity) ?? (card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50)),
    );
    if (state.player.gold < price) return;

    state.player.gold -= price;
    state.player.deck.push(this.deps.createRuntimeCard(card));
    state.shopCards = state.shopCards.filter(c => c.instanceId !== cardInstanceId);
    const committedTag = card.character === state.character?.id ? getPreferredRouteTagFromState([card], getKnownRouteTagsForCharacter(state.character?.id ?? ''), null, 1) : null;
    maybeRecordRouteCommit(state, committedTag, 'shop', this.deps.getCurrentFloorNumber(), 12);
    syncRouteStateFromLegacyState(state);
    this.deps.notify();
  }

  buyRelic(relicId: string, priceOverride?: number): void {
    const state = this.deps.getState();
    const relic = relicsData.find(r => r.id === relicId);
    if (!relic || state.player.relics.includes(relicId)) return;

    const price = resolveShopOfferPrice('relic', priceOverride ?? relic.price);
    if (state.player.gold < price) return;

    state.player.gold -= price;
    state.player.relics.push(relicId);
    state.player.relicStates[relicId] = { level: 1, progress: 0, corrupted: !!relic.corrupted };
    state.shopRelics = state.shopRelics.filter(id => id !== relicId);
    const committedTag =
      getRelicRouteTags(relicId).find((tag) => tag === state.routeState?.primaryTag)
      ?? getRelicRouteTags(relicId).find((tag) => tag === state.routeState?.secondaryTag)
      ?? getRelicRouteTags(relicId)[0]
      ?? null;
    maybeRecordRouteCommit(state, committedTag, 'shop', this.deps.getCurrentFloorNumber(), 10);
    syncRouteStateFromLegacyState(state);
    this.deps.notify();
  }

  buyPotion(potionId: string, priceOverride?: number): void {
    const state = this.deps.getState();
    const potion = (potionsData as PotionDef[]).find(p => p.id === potionId);
    if (!potion) return;

    const price = resolveShopOfferPrice('potion', priceOverride ?? potion.price);
    if (state.player.gold < price) return;
    if (state.player.potions.length >= getPotionRuntimeConfig().slotLimit) return;

    state.player.gold -= price;
    state.player.potions.push(potionId);
    state.shopPotions = state.shopPotions.filter(id => id !== potionId);
    this.deps.notify();
  }

  shopPurify(relicId: string): boolean {
    const state = this.deps.getState();
    const purifyCost = 75;
    const playerGold = state.player.gold;

    if (playerGold < purifyCost) {
      return false;
    }

    const relicIndex = state.player.relics.indexOf(relicId);
    if (relicIndex === -1) {
      return false;
    }

    const relic = relicsData.find(r => r.id === relicId) as any;
    if (!relic?.corrupted) {
      return false;
    }

    state.player.gold -= purifyCost;
    state.player.relics.splice(relicIndex, 1);
    delete state.player.relicStates[relicId];

    if (relic.effect?.maxHpPenalty) {
      state.player.maxHp += relic.effect.maxHpPenalty;
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    }

    this.deps.notify();
    return true;
  }

  restHeal(): void {
    const state = this.deps.getState();
    if (state.screen !== 'Rest' || state.campfireChoiceLocked) return;
    const healAmount = Math.floor(state.player.maxHp * 0.3);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    state.campfireChoiceLocked = true;
    this.deps.appendVoxLog(`生命体征修复：+${healAmount}。`);
    this.leaveCurrentRoomToMap();
  }

  restUpgrade(): void {
    const state = this.deps.getState();
    if (state.screen !== 'Rest' || state.campfireChoiceLocked) return;
    state.campfireChoiceLocked = true;
    state.upgradeReturnScreen = 'Rest';
    state.screen = 'Upgrade';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  restDisperse(): void {
    const state = this.deps.getState();
    if (state.screen !== 'Rest' || state.campfireChoiceLocked) return;
    state.campfireChoiceLocked = true;
    state.screen = 'RemoveCard';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  restUpgradeRelic(): void {
    const state = this.deps.getState();
    if (state.screen !== 'Rest' || state.campfireChoiceLocked) return;
    const hasCorruptedRelic = state.player.relics.some(r => {
      const relic = relicsData.find(rel => rel.id === r);
      return relic?.corrupted;
    });
    if (!hasCorruptedRelic) return;
    state.campfireChoiceLocked = true;
    state.relicUpgradeReturnScreen = 'Rest';
    state.screen = 'RelicUpgrade';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  handleRemoveCardComplete(cardInstanceId: string): void {
    const state = this.deps.getState();
    if (state.screen === 'RemoveCard' || state.screen === 'Event') {
      const cardIndex = state.player.deck.findIndex(c => c.instanceId === cardInstanceId);
      if (cardIndex !== -1) {
        state.player.deck.splice(cardIndex, 1);
        syncRouteStateFromLegacyState(state);
      }
    }
    this.deps.notify();
  }

  takeReward(cardInstanceId?: string): void {
    const state = this.deps.getState();
    if (cardInstanceId) {
      const card = state.rewardCards.find(c => c.instanceId === cardInstanceId);
      if (card) {
        state.player.deck.push(this.deps.createRuntimeCard(card as CardDef));
        const committedTag = getPreferredRouteTagFromState([card], getKnownRouteTagsForCharacter(state.character?.id ?? ''), null, 1);
        maybeRecordRouteCommit(state, committedTag, 'reward', this.deps.getCurrentFloorNumber(), 16);
        syncRouteStateFromLegacyState(state);
      }
    }

    state.rewardCards = [];
    this.leaveCurrentRoomToMap();
  }

  skipReward(): void {
    const state = this.deps.getState();
    state.rewardCards = [];
    this.leaveCurrentRoomToMap();
  }

  upgradeCard(cardInstanceId: string): void {
    const state = this.deps.getState();
    const cardIndex = state.player.deck.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return;

    const card = normalizeRunCardInstance(state.player.deck[cardIndex], () => this.deps.generateId());
    if (!card.upgrade || card.isUpgraded) return;

    const upgradedBase = {
      ...card.runtimeBase,
      ...card.upgrade,
      id: card.id,
      isUpgraded: true
    } as CardDef;

    state.player.deck[cardIndex] = deriveRunCardInstance({
      ...card,
      isUpgraded: true,
      runtimeBase: upgradedBase
    });
    const committedTag = getPreferredRouteTagFromState([state.player.deck[cardIndex]], getKnownRouteTagsForCharacter(state.character?.id ?? ''), null, 1);
    maybeRecordRouteCommit(state, committedTag, 'upgrade', this.deps.getCurrentFloorNumber(), 10);
    syncRouteStateFromLegacyState(state);

    const fromRest = state.upgradeReturnScreen === 'Rest';
    state.screen = state.upgradeReturnScreen || 'Map';
    state.upgradeReturnScreen = undefined;
    if (fromRest) {
      this.leaveCurrentRoomToMap();
      return;
    }
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  enterUpgrade(returnScreen?: 'Rest' | 'Shop'): void {
    const state = this.deps.getState();
    if (state.screen === 'Rest') {
      if (state.campfireChoiceLocked) return;
      state.campfireChoiceLocked = true;
    }
    if (returnScreen) {
      state.upgradeReturnScreen = returnScreen;
    } else if (!state.upgradeReturnScreen) {
      state.upgradeReturnScreen = state.screen === 'Shop' ? 'Shop' : 'Rest';
    }

    if (state.screen === 'Shop') {
      if (state.player.gold < 50) return;
      state.player.gold -= 50;
      state.pendingUpgradeRefund = true;
    }

    state.screen = 'Upgrade';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  cancelUpgrade(): void {
    const state = this.deps.getState();
    if (state.pendingUpgradeRefund) {
      state.player.gold += 50;
      state.pendingUpgradeRefund = false;
    }
    if (state.upgradeReturnScreen === 'Rest') {
      state.campfireChoiceLocked = false;
    }
    state.screen = state.upgradeReturnScreen || 'Map';
    state.upgradeReturnScreen = undefined;
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  enterCardRemoval(): void {
    const state = this.deps.getState();
    if (!this.deps.isEventFreeCardRemovalMode()) {
      if (state.screen === 'Shop') {
        state.upgradeReturnScreen = 'Shop';
      } else if (state.screen === 'Rest') {
        state.upgradeReturnScreen = 'Rest';
      }
    }
    state.screen = 'RemoveCard';
    syncRoomSessionFromLegacyState(state, {
      isEventFreeCardRemovalMode: this.deps.isEventFreeCardRemovalMode(),
    });
    syncSurfaceContextFromLegacyState(state, {
      isEventFreeCardRemovalMode: this.deps.isEventFreeCardRemovalMode(),
    });
    this.deps.notify();
  }

  cancelCardRemoval(): void {
    const state = this.deps.getState();
    if (this.deps.isEventFreeCardRemovalMode()) {
      state.screen = 'Event';
      syncRoomSessionFromLegacyState(state, {
        isEventFreeCardRemovalMode: true,
      });
      syncSurfaceContextFromLegacyState(state, {
        isEventFreeCardRemovalMode: true,
      });
      this.deps.notify();
      return;
    }
    state.screen = state.campfireChoiceLocked ? 'Rest' : 'Shop';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  getEventFreeRemovalsRemaining(): number {
    return this.deps.getEventFreeRemovalsRemaining();
  }

  restEnchant(): void {
    const state = this.deps.getState();
    if (state.screen !== 'Rest' || state.campfireChoiceLocked) return;
    state.campfireChoiceLocked = true;
    state.enchantContext = {
      source: 'Rest',
      enchantmentId: 'blood_rune',
      title: '营火刻印',
      description: '从一张攻击或技能牌上刻下稳定的永久附魔。',
      returnScreen: 'Rest',
    };
    state.screen = 'Enchant';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  enterShopEnchant(): void {
    const state = this.deps.getState();
    if (state.screen !== 'Shop') return;
    state.enchantContext = {
      source: 'Shop',
      enchantmentId: 'swift_sigil',
      title: '黑市附魔',
      description: '支付信用筹码，为一张攻击或技能牌烙下永久附魔。',
      price: this.deps.getAdjustedShopPrice(75),
      returnScreen: 'Shop',
    };
    state.screen = 'Enchant';
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  applyEnchantment(cardInstanceId: string): boolean {
    const state = this.deps.getState();
    const context = state.enchantContext;
    if (!context) return false;
    const target = state.player.deck.find((card) => card.instanceId === cardInstanceId);
    if (!target) return false;
    const runCard = normalizeRunCardInstance(target, () => this.deps.generateId());
    if (runCard.persistentEnchantments.length > 0) return false;
    const enchantment = getCardEnchantmentDefById(context.enchantmentId);
    if (!enchantment || enchantment.scope !== 'persistent') return false;
    if (context.source === 'Shop') {
      const price = Math.max(0, Number(context.price || 0));
      if (state.player.gold < price) return false;
      state.player.gold -= price;
    }
    const committedTag = getPreferredRouteTagFromState([target], getKnownRouteTagsForCharacter(state.character?.id ?? ''), null, 1);
    maybeRecordRouteCommit(state, committedTag, 'enchant', this.deps.getCurrentFloorNumber(), 10);
    syncRouteStateFromLegacyState(state);
    state.enchantContext = null;
    const returnScreen = context.returnScreen || context.source;
    if (returnScreen === 'Rest') {
      this.leaveCurrentRoomToMap();
      return true;
    }
    state.screen = returnScreen;
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
    return true;
  }

  cancelEnchant(): void {
    const state = this.deps.getState();
    const context = state.enchantContext;
    if (!context) return;
    const returnScreen = context.returnScreen || context.source;
    state.enchantContext = null;
    if (returnScreen === 'Rest') {
      state.campfireChoiceLocked = false;
    }
    state.screen = returnScreen;
    syncRoomSessionFromLegacyState(state);
    syncSurfaceContextFromLegacyState(state);
    this.deps.notify();
  }

  getEnchantPreview(cardInstanceId: string): CardDef | null {
    const state = this.deps.getState();
    const context = state.enchantContext;
    if (!context) return null;
    const card = state.player.deck.find((entry) => entry.instanceId === cardInstanceId);
    if (!card) return null;
    const enchantment = getCardEnchantmentDefById(context.enchantmentId);
    if (!enchantment || enchantment.scope !== 'persistent') return null;
    return normalizeRunCardInstance(card, () => this.deps.generateId());
  }
}
