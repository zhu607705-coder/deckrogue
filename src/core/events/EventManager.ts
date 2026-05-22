/**
 * @file EventManager.ts
 * @description 事件管理器 - 处理游戏内随机事件和奖励生成
 *
 * 主要职责:
 * - 管理游戏内随机事件的触发和解析
 * - 生成卡牌奖励 (战斗后、事件中等)
 * - 处理事件选项的选择和结果应用
 * - 管理免费移除卡牌的事件逻辑
 * - 与经济系统、平衡系统集成
 *
 * 事件流程:
 * 1. 进入事件节点 -> EventManager 初始化事件
 * 2. 玩家选择选项 -> EventManager 应用结果
 * 3. 结果应用 -> 更新玩家状态 (HP/金币/卡牌/遗物等)
 */
import type { GameState, RunCardInstance, CardDef, ActiveEventState, RelicDef, PotionDef, EventOption } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';
import { metricsTracker } from '@/core/events/metricsTracker';
import { economySystem } from '@/features/progression/economySystem';
import { balanceSystem } from '@/core/balance/balanceSystem';
import { safeArrayAccess } from '@/core/utils/safeArray';
import {
  analyzeRouteSignals,
  STORY_EVENTS,
  getStoryEventDef,
  getStoryEventSelectionWeight,
  calculateStoryEventNumbers,
  cardsData,
  getCardRouteAffinityTags,
  getCardRouteSignal,
  getEventRouteSignal,
  getGenericPowerIdsForCharacter,
  getKnownRouteTagsForCharacter,
  getPreferredRouteTagFromState,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  maybeRecordRouteCommit,
  relicsData,
  potionsData,
  getPotionRuntimeConfig,
  getCardEnchantmentDefById,
  resolvePreferredRouteTag,
  syncRouteStateFromLegacyState,
} from '@/content/narrative/numericSystem';
import { unlockCodexEntry, unlockManyCodexEntries } from '@/core/persistence/codexStore';
import { getMetaUnlockedWeightBonus } from '@/core/balance/metaBalance';
import { syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { getEventChoiceRouteCommitWeight } from '@/content/narrative/routeSignals';
import { getEventChoiceCommitTags, getEventChoiceRouteRole } from '@/content/narrative/routeSignals';

export interface EventManagerDeps {
  getState: () => GameState;
  setState: (updater: (state: GameState) => void) => void;
  rng: () => number;
  generateId: () => string;
  createRuntimeCard: (card: CardDef, instanceId?: string) => RunCardInstance;
  ensureRunEffects: () => NonNullable<GameState['player']['runEffects']>;
  getCurrentFloorNumber: () => number;
  leaveCurrentRoomToMap: () => void;
  getAdjustedShopPrice: (basePrice: number) => number;
  notify: () => void;
  appendVoxLog: (message: string) => void;
}

interface RewardGenerationOptions {
  source?: 'combat' | 'shop';
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function stablePickBySeed<T>(items: T[], key: string): T | undefined {
  if (!items.length) return undefined;
  return items[stableHash(key) % items.length];
}

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

export class EventManager {
  constructor(private deps: EventManagerDeps) {}

  startEvent(): void {
    const state = this.deps.getState();
    const floor = this.deps.getCurrentFloorNumber();
    syncRouteStateFromLegacyState(state);
    const eligibleStoryEvents = STORY_EVENTS.filter(e => floor >= e.floorMin && floor <= e.floorMax);
    if (eligibleStoryEvents.length > 0) {
      const routeTagsForCharacter = state.character?.id ? getKnownRouteTagsForCharacter(state.character.id) : [];
      const dominantTag = resolveCurrentRouteTag(state.player.deck, routeTagsForCharacter, state.routeState ?? null);
      if (dominantTag) {
        const matchedEvents = eligibleStoryEvents.filter((eventDef) => getEventRouteSignal(eventDef.id)?.routeTags.includes(dominantTag));
        const directMatch =
          floor <= 3
            ? stablePickBySeed(matchedEvents, `${state.seed}:${dominantTag}:event:${floor}`)
            : null;
        if (directMatch && floor <= 3) {
          state.activeEvent = { id: directMatch.id, data: {} };
          unlockCodexEntry('events', directMatch.id);
          state.screen = 'Event';
          return;
        }
      }
      const weightedEligible = eligibleStoryEvents.map((eventDef) => {
        const signal = dominantTag ? getEventRouteSignal(eventDef.id) : null;
        const matchesRoute = !!(signal && dominantTag && signal.routeTags.includes(dominantTag));
        const confidence = state.routeState?.confidence ?? 0;
        const preferredChoiceRoles = signal?.preferredChoiceRoles ? Object.values(signal.preferredChoiceRoles) : [];
        const desiredChoiceMultiplier =
          state.routeState?.stage === 'pivoting'
            ? (preferredChoiceRoles.includes('pivot') ? 2.15 : 1.2)
            : confidence < 55
              ? (preferredChoiceRoles.includes('confirm') ? 2.35 : 1.2)
              : (preferredChoiceRoles.includes('payoff') ? 2.2 : 1.2);
        const reinforcementMultiplier =
          signal?.reinforcement === 'confirm'
            ? confidence < 55 ? 2.35 : 1.25
            : signal?.reinforcement === 'payoff'
              ? confidence >= 55 ? 2.2 : 1.15
              : 1.55;
        const routeChoiceMultiplier = signal?.preferredChoiceRoles ? Math.max(reinforcementMultiplier, desiredChoiceMultiplier) : reinforcementMultiplier;
        const supportMultiplier = matchesRoute
          ? floor <= 3
            ? 2.5
            : floor <= 6
              ? routeChoiceMultiplier
              : 1.35
          : 1;
        return {
          eventDef,
          weight: getStoryEventSelectionWeight(eventDef.id) * supportMultiplier,
        };
      });
      const totalWeight = weightedEligible.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = this.deps.rng() * totalWeight;
      let picked = weightedEligible[0]?.eventDef ?? eligibleStoryEvents[0];
      for (const entry of weightedEligible) {
        roll -= entry.weight;
        if (roll <= 0) {
          picked = entry.eventDef;
          break;
        }
      }
      state.activeEvent = { id: picked.id, data: {} };
      unlockCodexEntry('events', picked.id);
      state.screen = 'Event';
      return;
    }

    const events: ActiveEventState['id'][] = ['mysterious_shrine', 'heretic_altar'];
    const eventId = safeArrayAccess(events, Math.floor(this.deps.rng() * events.length)) ?? 'mysterious_shrine';

    state.activeEvent = { id: eventId };
    unlockCodexEntry('events', eventId);

    if (eventId === 'mysterious_shrine') {
      const relics = relicsData.filter(r => !r.corrupted);
      const relic = safeArrayAccess(relics, Math.floor(this.deps.rng() * relics.length));
      state.activeEvent.offeredRelicId = relic?.id;
      if (state.activeEvent.offeredRelicId) unlockCodexEntry('relics', state.activeEvent.offeredRelicId);
    }

    state.screen = 'Event';
  }

  makeEventChoice(choice: 'accept' | 'decline'): void {
    const state = this.deps.getState();
    const event = state.activeEvent;
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
        state.player.corruption += 20;
        state.player.gold += 100;
      }
    }

    state.activeEvent = null;
    this.deps.leaveCurrentRoomToMap();
  }

  resolveEventChoice(choice: string): void {
    const state = this.deps.getState();
    const event = state.activeEvent;
    if (!event) return;
    event.data = { ...(event.data || {}), lastChoiceId: choice };
    if (getStoryEventDef(event.id)) {
      this.resolveStoryEventChoice(choice);
      return;
    }

    if (event.id === 'mysterious_shrine') {
      if (choice === 'pray') {
        state.player.maxHp += 10;
        state.player.hp += 10;
      }
      state.activeEvent = null;
      this.deps.leaveCurrentRoomToMap();
      return;
    }

    if (event.id === 'heretic_altar') {
      if (choice === 'accept_corruption') {
        if (event.offeredRelicId) {
          this.addRelicToPlayerInventory(event.offeredRelicId, { corruptedOverride: true });
        }
        state.player.corruption += 10;
      }
      state.activeEvent = null;
      this.deps.leaveCurrentRoomToMap();
      return;
    }

    this.makeEventChoice('decline');
  }

  private resolveStoryEventChoice(choice: string): void {
    const state = this.deps.getState();
    const event = state.activeEvent;
    if (!event) return;

    if (event.stage === 'generic_relic_choice') {
      this.resolveGenericRelicChoice(choice);
      return;
    }

    const routeSignal = getEventRouteSignal(event.id);
    const routeCommitWeight = getEventChoiceRouteCommitWeight(event.id, choice);
    const choiceRole = getEventChoiceRouteRole(event.id, choice);
    event.data = {
      ...(event.data || {}),
      lastChoiceId: choice,
      choiceRole,
      outcomeKind: choiceRole ?? 'neutral',
    };
    event.lastChoiceId = choice;
    event.choiceRole = choiceRole ?? null;
    event.outcomeKind = choiceRole ?? 'neutral';
    if (routeSignal && routeCommitWeight !== null) {
      const commitTags = getEventChoiceCommitTags(event.id, choice);
      const committedTag = getPreferredRouteTagFromState(
        state.player.deck,
        commitTags.length ? commitTags : routeSignal.routeTags,
        state.routeState ?? null,
        3,
      ) ?? (
        choiceRole === 'pivot'
          ? commitTags.find((tag) => tag !== state.routeState?.primaryTag)
          : null
      ) ?? commitTags[0] ?? routeSignal.routeTags[0] ?? null;
      maybeRecordRouteCommit(
        state,
        committedTag,
        'event',
        this.deps.getCurrentFloorNumber(),
        routeCommitWeight,
      );
    }
    const runEffects = this.deps.ensureRunEffects();

    switch (event.id) {
      case 'rusting_medicae': {
        const n = calculateStoryEventNumbers('rusting_medicae', state) as Record<string, unknown>;
        if (event.stage === 'salvage_aftermath') {
          if (choice === 'medicae_salvage_fight') {
            state.activeEvent = null;
            this.deps.notify();
            return;
          }
          if (choice === 'medicae_salvage_flee') {
            state.player.hp = Math.max(0, state.player.hp - Number(n.salvageFleeTrueDamage ?? 15));
            state.activeEvent = null;
            this.deps.leaveCurrentRoomToMap();
            return;
          }
        }

        if (choice === 'medicae_implant') {
          const hpLoss = Math.max(1, Number(n.implantCurrentHpLoss ?? 1));
          state.player.hp = Math.max(1, state.player.hp - hpLoss);
          state.player.maxHp += Math.max(0, Number(n.implantMaxHpGain ?? 10));
          state.player.hp = Math.min(state.player.maxHp, state.player.hp);
          this.grantRelicDirect('rust_implants');
          this.addCardByIdToDeck('rejection_response');
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }

        if (choice === 'medicae_extract') {
          state.player.maxHp = Math.max(1, state.player.maxHp - Math.max(0, Number(n.extractMaxHpLoss ?? 5)));
          const heal = Math.max(1, Math.floor(state.player.maxHp * Math.max(0, Number(n.extractHealMaxHpRatio ?? 0.3))));
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
          state.player.corruption = Math.min(100, (state.player.corruption || 0) + Math.max(0, Number(n.extractCorruptionGain ?? 20)));
          this.grantRandomPotions(Math.max(0, Number(n.extractPotionCount ?? 2)), !!n.extractStrongPotionsOnly);
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }

        if (choice === 'medicae_salvage') {
          state.player.gold += Math.max(0, Number(n.salvageGoldGain ?? 100));
          this.grantRandomRelic({ normalOnly: n.salvageNormalRelicOnly !== false });
          event.stage = 'salvage_aftermath';
          event.data = { ...(event.data || {}), salvageRewardsClaimed: true };
          this.deps.notify();
          return;
        }
        break;
      }
      case 'nameless_martyr_shrine': {
        const n = calculateStoryEventNumbers('nameless_martyr_shrine', state) as Record<string, unknown>;
        if (event.stage === 'free_remove') {
          if (choice === 'martyr_continue_remove') {
            state.screen = 'RemoveCard';
            this.deps.notify();
          }
          return;
        }
        if (choice === 'martyr_offer_blood') {
          const maxHpLoss = Math.max(1, Number(n.offerBloodMaxHpLoss ?? 1));
          state.player.maxHp = Math.max(1, state.player.maxHp - maxHpLoss);
          state.player.hp = Math.min(state.player.hp, state.player.maxHp);
          this.grantRelicDirect('martyrs_mark');
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'martyr_offer_wealth') {
          const goldBefore = state.player.gold;
          state.player.gold = 0;
          if (goldBefore < Math.max(0, Number(n.offerWealthCurseGoldThreshold ?? 50))) {
            this.addCardByIdToDeck('greed_sin');
            state.activeEvent = null;
            this.deps.leaveCurrentRoomToMap();
            return;
          }
          event.stage = 'free_remove';
          event.data = { ...(event.data || {}), freeRemovalsRemaining: Math.max(1, Number(n.offerWealthFreeRemovals ?? 2)) };
          state.screen = 'RemoveCard';
          syncRoomSessionFromLegacyState(state, { isEventFreeCardRemovalMode: true });
          this.deps.notify();
          return;
        }
        if (choice === 'martyr_desecrate') {
          this.addCardByIdToDeck('execution_slash');
          state.player.devotion = Math.max(0, Number(n.desecrateDevotionSetTo ?? 0));
          runEffects.pendingWarpTideBonus = Math.max(runEffects.pendingWarpTideBonus || 0, Math.max(0, Number(n.desecrateWarpTideBonus ?? 30)));
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'martyr_inscribe_oath') {
          const hpLoss = Math.max(1, Number(n.inscribeHpLoss ?? 6));
          state.player.hp = Math.max(1, state.player.hp - hpLoss);
          state.enchantContext = {
            source: 'Event',
            enchantmentId: 'blood_rune',
            title: '殉道誓刻',
            description: '以鲜血为代价，将血纹铭入一张可用的牌。',
            returnScreen: 'Event',
          };
          state.screen = 'Enchant';
          syncRoomSessionFromLegacyState(state);
          this.deps.notify();
          return;
        }
        break;
      }
      case 'warp_tear_whispers': {
        const n = calculateStoryEventNumbers('warp_tear_whispers', state) as Record<string, unknown>;
        if (choice === 'tear_embrace') {
          this.transformBaseCardsIntoWarped();
          state.player.corruption = Math.max(0, Math.min(100, Number(n.embraceCorruptionSetTo ?? 100)));
          runEffects.warpDebuffCombatsRemaining = Math.max(0, Number(n.embraceWarpDebuffCombats ?? 3));
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'tear_bargain') {
          this.grantRandomRelic({ corruptedOnly: true, warpBiased: true });
          this.destroyRandomNonBasicCard();
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'tear_seal') {
          state.player.devotion = (state.player.devotion || 0) + Math.max(0, Number(n.sealDevotionGain ?? 50));
          if (n.sealClearPendingWarpTideBonus !== false) {
            runEffects.pendingWarpTideBonus = 0;
          }
          this.addCardByIdToDeck('psychic_backlash');
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        break;
      }
      case 'inquisitor_legacy': {
        const n = calculateStoryEventNumbers('inquisitor_legacy', state) as Record<string, unknown>;
        if (choice === 'legacy_inscribe_sigil') {
          state.enchantContext = {
            source: 'Event',
            enchantmentId: 'swift_sigil',
            title: '旧印再铭',
            description: '将旧日的迅捷印记重新刻入一张攻击或技能牌。',
            returnScreen: 'Event',
          };
          state.screen = 'Enchant';
          syncRoomSessionFromLegacyState(state);
          this.deps.notify();
          return;
        }
        if (choice === 'legacy_open_casket') {
          state.player.hp = Math.max(1, state.player.hp - Math.max(1, Number(n.openCasketCurrentHpLoss ?? 1)));
          runEffects.enemyHuntBonusPct = Math.max(runEffects.enemyHuntBonusPct || 0, Math.max(0, Number(n.openCasketEnemyHuntBonusPct ?? 0.1)));
          this.grantRelicDirect('entropy_sanctum_relic');
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'legacy_read_codex') {
          state.player.intel += Math.max(0, Number(n.readCodexIntelGain ?? 30));
          if (n.readCodexRevealAllMapNodes !== false) {
            state.map.forEach(node => { node.revealed = true; });
          }
          state.player.maxHp = Math.max(1, state.player.maxHp - Math.max(0, Number(n.readCodexMaxHpLoss ?? 10)));
          state.player.hp = Math.min(state.player.hp, state.player.maxHp);
          this.addCardByIdToDeck('paranoia');
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'legacy_take_rosary') {
          this.grantRelicDirect('inquisitor_rosary');
          state.player.hp = Math.max(1, state.player.hp - Math.max(0, Number(n.takeRosarySelfDamage ?? 10)));
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        break;
      }
      case 'secret_passage': {
        if (choice === 'secret_passage_explore') {
          if (this.deps.rng() < 0.5) {
            this.grantRandomRelic({ normalOnly: true });
          } else {
            state.player.gold += 120;
          }
          runEffects.skipNextNode = true;
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'secret_passage_guard') {
          runEffects.eliteTrapWeakStacks = Math.max(runEffects.eliteTrapWeakStacks || 0, 2);
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        if (choice === 'secret_passage_ignore') {
          state.activeEvent = null;
          this.deps.leaveCurrentRoomToMap();
          return;
        }
        break;
      }
    }

    const storyEventDef = getStoryEventDef(event.id);
    const option = storyEventDef?.options.find((entry) => entry.id === choice);
    if (option) {
      this.resolveGenericStoryEventChoice(option);
    }
  }

  private resolveGenericStoryEventChoice(option: EventOption): void {
    const state = this.deps.getState();
    const event = state.activeEvent;
    if (!event) return;

    const gainText = [...(option.gains ?? []), option.description ?? '', option.id].join(' ');
    const costText = [...(option.costs ?? []), option.description ?? '', option.id].join(' ');
    const allText = `${gainText} ${costText}`.toLowerCase();
    const runEffects = this.deps.ensureRunEffects();

    if (this.openGenericChoiceSurface(option, allText)) {
      return;
    }

    const dangerHpLossRatio = option.danger === 'high' ? 0.18 : option.danger === 'medium' ? 0.1 : 0.04;
    const explicitMaxHpLoss = this.extractNumber(costText, /(?:-|loss|lose)\s*(\d+)\s*(?:max hp|最大生命|maxHp)/i)
      ?? this.extractNumber(costText, /(?:max hp|最大生命|maxHp)\s*(?:-|loss|lose)\s*(\d+)/i);
    if (explicitMaxHpLoss !== null) {
      state.player.maxHp = Math.max(1, state.player.maxHp - explicitMaxHpLoss);
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    }

    const explicitHpLoss = this.extractNumber(costText, /(?:lose|loss|失去|受到)\s*(\d+)\s*(?:hp|current|生命)/i)
      ?? this.extractNumber(costText, /(\d+)\s*(?:hp|current hp|当前生命)/i);
    const shouldApplyDangerDamage =
      option.danger !== 'low' &&
      (allText.includes('steal') ||
        allText.includes('fight') ||
        allText.includes('sacrifice') ||
        allText.includes('enter') ||
        allText.includes('drink') ||
        allText.includes('inhale') ||
        allText.includes('join') ||
        allText.includes('accept') ||
        allText.includes('plunder'));
    const hpLoss = explicitHpLoss ?? (shouldApplyDangerDamage ? Math.max(3, Math.floor(state.player.maxHp * dangerHpLossRatio)) : 0);
    if (hpLoss > 0) {
      state.player.hp = Math.max(1, state.player.hp - hpLoss);
    }

    if (allText.includes('curse') || allText.includes('诅咒')) {
      const curseId = allText.includes('perjury') ? 'perjury_stigma' : allText.includes('paranoia') ? 'paranoia' : 'greed_sin';
      this.addCardByIdToDeck(cardsData.some((card) => card.id === curseId) ? curseId : 'greed_sin');
    }

    const explicitCorruption = this.extractNumber(costText, /(?:corruption|腐化)\s*(?:\+|gain)?\s*(\d+)/i)
      ?? this.extractNumber(gainText, /(?:corruption|腐化)\s*(?:\+|gain)?\s*(\d+)/i);
    if (explicitCorruption !== null || allText.includes('warp') || allText.includes('corruption')) {
      state.player.corruption = Math.min(100, (state.player.corruption || 0) + (explicitCorruption ?? (option.danger === 'high' ? 18 : 8)));
    }

    const goldGain = this.extractNumber(gainText, /(\d+)\s*(?:gold|金币|金)/i);
    if (goldGain !== null) {
      state.player.gold += goldGain;
    }

    const healPercent = this.extractNumber(gainText, /(?:heal|恢复)\s*(\d+)%/i);
    if (healPercent !== null) {
      const heal = Math.max(1, Math.floor(state.player.maxHp * (healPercent / 100)));
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    } else if (allText.includes('heal') || allText.includes('purify') || allText.includes('reignite')) {
      const heal = Math.max(2, Math.floor(state.player.maxHp * 0.16));
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    }

    const maxHpGain = this.extractNumber(gainText, /(?:\+|gain)?\s*(\d+)\s*(?:max hp|最大生命|maxHp)/i);
    if (maxHpGain !== null && !costText.toLowerCase().includes('max hp')) {
      state.player.maxHp += maxHpGain;
      state.player.hp += maxHpGain;
    }

    const explicitRelicId = (relicsData as RelicDef[]).find((relic) => allText.includes(String(relic.id).toLowerCase()))?.id;
    if (explicitRelicId) {
      this.grantRelicDirect(explicitRelicId);
    } else if (allText.includes('relic') || allText.includes('遗物')) {
      this.grantRandomRelic({ normalOnly: option.danger !== 'high', warpBiased: allText.includes('warp') || allText.includes('corruption') });
    }

    if (allText.includes('potion') || allText.includes('药水')) {
      this.grantRandomPotions(option.danger === 'high' ? 2 : 1, option.danger !== 'low');
    }

    if (allText.includes('remove 1 card') || allText.includes('remove 1') || allText.includes('移除')) {
      this.removeFirstBasicOrCurseCard();
    }

    if (allText.includes('card') || allText.includes('牌')) {
      if (!allText.includes('remove 1 card') && !allText.includes('移除')) {
        this.grantRouteBiasedCard();
      }
    }

    if (allText.includes('intel') || allText.includes('consult') || allText.includes('interrogate') || allText.includes('copy')) {
      state.player.intel += option.danger === 'high' ? 18 : 10;
    }

    if (allText.includes('devotion') || allText.includes('pray') || allText.includes('seal') || allText.includes('purify') || allText.includes('reject')) {
      state.player.devotion = (state.player.devotion || 0) + (option.danger === 'high' ? 16 : 10);
    }

    if (allText.includes('frail') || allText.includes('weak')) {
      runEffects.warpDebuffCombatsRemaining = Math.max(runEffects.warpDebuffCombatsRemaining || 0, 1);
    }
    if (allText.includes('fight')) {
      runEffects.eliteTrapWeakStacks = Math.max(runEffects.eliteTrapWeakStacks || 0, 1);
    }

    event.data = {
      ...(event.data || {}),
      genericResolved: true,
      resolvedChoiceId: option.id,
      danger: option.danger ?? 'medium',
    };
    state.activeEvent = null;
    this.deps.leaveCurrentRoomToMap();
  }

  private openGenericChoiceSurface(option: EventOption, allText: string): boolean {
    const isChooseThree = /choose\s+1\s+of\s+3/.test(allText) || allText.includes('三选一');
    if (!isChooseThree) return false;

    const state = this.deps.getState();
    const event = state.activeEvent;
    if (!event) return false;

    if (allText.includes('relic') || allText.includes('遗物')) {
      const offeredRelicIds = this.generateRelicChoiceIds(3, {
        normalOnly: option.danger !== 'high',
        warpBiased: allText.includes('warp') || allText.includes('corruption'),
      });
      if (offeredRelicIds.length === 0) return false;
      event.stage = 'generic_relic_choice';
      event.data = {
        ...(event.data || {}),
        genericChoiceSourceId: option.id,
        offeredRelicIds,
      };
      state.screen = 'Event';
      this.deps.notify();
      return true;
    }

    if (allText.includes('card') || allText.includes('cards') || allText.includes('牌')) {
      state.rewardCards = this.generateCardRewards(3, { source: 'combat' });
      event.data = {
        ...(event.data || {}),
        genericChoiceSourceId: option.id,
        offeredCardIds: state.rewardCards.map((card) => card.id),
      };
      state.activeEvent = null;
      state.screen = 'Reward';
      this.deps.notify();
      return true;
    }

    return false;
  }

  private generateRelicChoiceIds(
    count: number,
    options: { normalOnly?: boolean; corruptedOnly?: boolean; warpBiased?: boolean } = {},
  ): string[] {
    const state = this.deps.getState();
    const eventId = state.activeEvent?.id ?? 'event';
    let pool = (relicsData as RelicDef[]).filter((relic) => !state.player.relics.includes(relic.id));
    if (options.normalOnly) {
      pool = pool.filter((relic) => !relic.corrupted && (relic.price ?? 0) <= 220);
    }
    if (options.corruptedOnly) {
      pool = pool.filter((relic) => !!relic.corrupted || String(relic.id).includes('warp') || String(relic.id).includes('chaos'));
    }
    if (options.warpBiased) {
      const warpPool = pool.filter((relic) => String(relic.id).includes('warp') || !!relic.corrupted || String(relic.name || '').toLowerCase().includes('chaos'));
      if (warpPool.length > 0) pool = warpPool;
    }

    const routeTagsForCharacter = state.character?.id ? getKnownRouteTagsForCharacter(state.character.id) : [];
    const preferredRouteTag = resolveCurrentRouteTag(state.player.deck, routeTagsForCharacter, state.routeState ?? null);
    const supportRelicIds = new Set(preferredRouteTag ? getRouteSupportRelicIds(preferredRouteTag) : []);
    const routePool = pool.filter((relic) => supportRelicIds.has(relic.id));
    const sourcePool = routePool.length > 0 ? [...routePool, ...pool.filter((relic) => !supportRelicIds.has(relic.id))] : pool;
    const chosen: string[] = [];

    for (let i = 0; i < count; i += 1) {
      const available = sourcePool.filter((relic) => !chosen.includes(relic.id));
      if (available.length === 0) break;
      const key = `${state.seed}:${eventId}:relic-choice:${this.deps.getCurrentFloorNumber()}:${i}:${available.map((relic) => relic.id).join('|')}`;
      const relic = available[stableHash(key) % available.length];
      if (relic?.id) chosen.push(relic.id);
    }

    return chosen;
  }

  private resolveGenericRelicChoice(choice: string): void {
    const state = this.deps.getState();
    const event = state.activeEvent;
    if (!event) return;

    const offeredRelicIds = Array.isArray(event.data?.offeredRelicIds)
      ? event.data.offeredRelicIds.map(String)
      : [];
    const relicId = choice.startsWith('generic_relic:') ? choice.slice('generic_relic:'.length) : choice;
    if (!offeredRelicIds.includes(relicId)) return;

    event.data = {
      ...(event.data || {}),
      lastChoiceId: choice,
      resolvedRelicId: relicId,
    };
    this.addRelicToPlayerInventory(relicId);
    state.activeEvent = null;
    this.deps.leaveCurrentRoomToMap();
  }

  private extractNumber(text: string, pattern: RegExp): number | null {
    const match = pattern.exec(text);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  }

  private removeFirstBasicOrCurseCard(): void {
    const state = this.deps.getState();
    const index = state.player.deck.findIndex((card) =>
      ['strike', 'defend', 'greed_sin', 'paranoia', 'perjury_stigma', 'psychic_backlash'].includes(card.id)
    );
    if (index >= 0) {
      state.player.deck.splice(index, 1);
    }
  }

  private grantRouteBiasedCard(): void {
    const state = this.deps.getState();
    const characterId = state.character?.id;
    const routeTagsForCharacter = characterId ? getKnownRouteTagsForCharacter(characterId) : [];
    const preferredRouteTag = resolveCurrentRouteTag(state.player.deck, routeTagsForCharacter, state.routeState ?? null);
    const pool = cardsData.filter((card) =>
      card.rarity !== 'Starter' &&
      ((card.character ?? 'All') === 'All' || card.character === characterId) &&
      (!preferredRouteTag || getCardRouteAffinityTags(card).includes(preferredRouteTag) || getCardRouteAffinityTags(card).length === 0)
    );
    const fallback = cardsData.filter((card) => card.rarity !== 'Starter' && ((card.character ?? 'All') === 'All' || card.character === characterId));
    const sourcePool = pool.length > 0 ? pool : fallback;
    const card = safeArrayAccess(sourcePool, Math.floor(this.deps.rng() * Math.max(1, sourcePool.length)));
    if (card) {
      this.addCardByIdToDeck(card.id);
    }
  }

  private addCardByIdToDeck(cardId: string): void {
    const state = this.deps.getState();
    const card = cardsData.find(c => c.id === cardId);
    if (!card) return;
    unlockCodexEntry('cards', card.id);
    state.player.deck.push(this.deps.createRuntimeCard(card));
    const committedTag = getPreferredRouteTagFromState([card], getKnownRouteTagsForCharacter(state.character?.id ?? ''), null, 1);
    maybeRecordRouteCommit(state, committedTag, 'event', this.deps.getCurrentFloorNumber(), 10);
    syncRouteStateFromLegacyState(state);
  }

  private addRelicToPlayerInventory(relicId: string, options: { corruptedOverride?: boolean } = {}): boolean {
    const state = this.deps.getState();
    if (!relicId || state.player.relics.includes(relicId)) return false;
    const relic = (relicsData as RelicDef[]).find(r => r.id === relicId);
    if (!relic) return false;
    unlockCodexEntry('relics', relicId);

    const isCorrupted = typeof options.corruptedOverride === 'boolean' ? options.corruptedOverride : !!relic.corrupted;
    state.player.relics.push(relicId);
    state.player.relicStates[relicId] = { level: 1, progress: 0, corrupted: isCorrupted };

    if (state.combat) {
      state.combat.player.corruptionAxis = Math.min(100, Math.max(0, state.player.corruption || 0));
      state.combat.player.devotion = state.player.devotion || 0;
      state.combat.warpPulse = {
        text: `获得遗物：${relic.name}`,
        tone: isCorrupted ? 'warp' : 'faith'
      };
    }

    globalEventBus.publish({ type: 'RelicAcquired', relicId, data: { relicId } });
    const relicRouteTag =
      getRelicRouteTags(relicId).find((tag) => tag === state.routeState?.primaryTag)
      ?? getRelicRouteTags(relicId).find((tag) => tag === state.routeState?.secondaryTag)
      ?? getRelicRouteTags(relicId)[0]
      ?? null;
    maybeRecordRouteCommit(state, relicRouteTag, 'event', this.deps.getCurrentFloorNumber(), 10);
    return true;
  }

  private grantRelicDirect(relicId: string): void {
    this.addRelicToPlayerInventory(relicId);
  }

  private grantRandomPotions(count: number, strongOnly = false): void {
    const state = this.deps.getState();
    const potionSlotLimit = getPotionRuntimeConfig().slotLimit;
    const pool = (potionsData as PotionDef[]).filter(p => !strongOnly || (p.price ?? 0) >= 130);
    const unlockedIds = new Set(state.metaRuntime?.unlockedPoolIds || []);
    const weightBonus = getMetaUnlockedWeightBonus();
    for (let i = 0; i < count; i++) {
      if (state.player.potions.length >= potionSlotLimit) return;
      const pickPool = pool.length > 0 ? pool : (potionsData as PotionDef[]);
      const weighted: PotionDef[] = [];
      for (const p of pickPool) {
        weighted.push(p);
        if (unlockedIds.has(p.id)) {
          for (let j = 0; j < weightBonus; j++) weighted.push(p);
        }
      }
      const potion = (weighted.length > 0 ? weighted : pickPool)[Math.floor(this.deps.rng() * (weighted.length > 0 ? weighted.length : pickPool.length))];
      if (potion) {
        unlockCodexEntry('potions', potion.id);
        state.player.potions.push(potion.id);
      }
    }
  }

  private grantRandomRelic(options: { normalOnly?: boolean; corruptedOnly?: boolean; warpBiased?: boolean } = {}): void {
    const state = this.deps.getState();
    let pool = (relicsData as RelicDef[]).filter(r => !state.player.relics.includes(r.id));
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
    const routeTagsForCharacter = state.character?.id ? getKnownRouteTagsForCharacter(state.character.id) : [];
    const preferredRouteTag = resolveCurrentRouteTag(state.player.deck, routeTagsForCharacter, state.routeState ?? null);
    const supportRelicIds = new Set(preferredRouteTag ? getRouteSupportRelicIds(preferredRouteTag) : []);
    const routePool = pool.filter((relic) => supportRelicIds.has(relic.id));
    const sourcePool = routePool.length > 0 ? routePool : pool;
    const relic = safeArrayAccess(sourcePool, Math.floor(this.deps.rng() * Math.max(1, sourcePool.length)));
    if (relic?.id) this.grantRelicDirect(relic.id);
  }

  private destroyRandomNonBasicCard(): void {
    const state = this.deps.getState();
    const candidates = state.player.deck.filter(c => !['strike', 'defend'].includes(c.id));
    if (candidates.length === 0) return;
    const doomed = safeArrayAccess(candidates, Math.floor(this.deps.rng() * candidates.length));
    if (!doomed?.instanceId) return;
    state.player.deck = state.player.deck.filter(c => c.instanceId !== doomed.instanceId);
  }

  private transformBaseCardsIntoWarped(): void {
    const state = this.deps.getState();
    const characterId = state.character?.id;
    const pool = cardsData.filter(c =>
      (c.rarity === 'Uncommon' || c.rarity === 'Rare') &&
      c.id !== 'strike' && c.id !== 'defend' &&
      ((c.character ?? 'All') === 'All' || c.character === characterId)
    );
    if (pool.length === 0) return;
    state.player.deck = state.player.deck.map(card => {
      if (!['strike', 'defend'].includes(card.id)) return card;
      const replacement = safeArrayAccess(pool, Math.floor(this.deps.rng() * pool.length));
      if (!replacement) return card;
      return this.deps.createRuntimeCard(replacement, card.instanceId || this.deps.generateId());
    });
  }

  generateCardRewards(count: number, options: RewardGenerationOptions = {}): RunCardInstance[] {
    const state = this.deps.getState();
    const source = options.source ?? 'combat';
    const rewards: RunCardInstance[] = [];
    syncRouteStateFromLegacyState(state);
    const characterId = state.character?.id;
    const unlockedIds = new Set(state.metaRuntime?.unlockedPoolIds || []);
    const unlockedWeightBonus = 0;
    const floor = this.deps.getCurrentFloorNumber();
    const routeProfile = analyzeRouteSignals(state.player.deck);
    const routeTagsForCharacter = characterId ? getKnownRouteTagsForCharacter(characterId) : [];
    const dominantTag = resolveCurrentRouteTag(state.player.deck, routeTagsForCharacter, state.routeState ?? null);

    const cardPool = cardsData.filter((card) =>
      ((card.character ?? 'All') === 'All' || card.character === characterId)
    );
    const chosenIds = new Set<string>();
    const seedKey = `${state.seed}:${characterId ?? 'all'}:${source}:${floor}:${dominantTag ?? 'none'}`;

    const chooseUniqueSeeded = (pool: CardDef[], label: string): CardDef | null => {
      const filtered = pool.filter((card) => !chosenIds.has(card.id));
      if (filtered.length === 0) return null;
      const index = stableHash(`${seedKey}:${label}:${filtered.map((card) => card.id).join('|')}`) % filtered.length;
      const pick = filtered[index] ?? null;
      if (pick) chosenIds.add(pick.id);
      return pick;
    };

    const genericPowerIds = new Set(characterId ? getGenericPowerIdsForCharacter(characterId) : []);

    const pickEarlyRewardCards = (): CardDef[] => {
      const result: CardDef[] = [];
      const availableRouteTags = routeTagsForCharacter.length > 0 ? routeTagsForCharacter : routeProfile.activeTags;
      const sampledRouteTag = safeArrayAccess(
        availableRouteTags,
        availableRouteTags.length > 0 ? stableHash(`${seedKey}:primary-route`) % availableRouteTags.length : 0
      ) ?? null;
      const hasExplicitRouteCommit = (state.routeState?.recentCommits?.length ?? 0) > 0;
      const starterRouteIsOnlySoftSignal =
        source === 'combat' &&
        floor <= 1 &&
        !!dominantTag &&
        !hasExplicitRouteCommit &&
        state.routeState?.stage !== 'pivoting';
      const primaryTag = starterRouteIsOnlySoftSignal
        ? (sampledRouteTag ?? dominantTag)
        : (dominantTag ?? sampledRouteTag);

      const byRole = (roles: string[], routeTag?: string | null, preferDifferentRoute = false) =>
        cardPool.filter((card) => {
          const signal = getCardRouteSignal(card);
          if (!signal || !roles.includes(signal.earlyGameRole)) return false;
          if (routeTag && !signal.routeTags.includes(routeTag)) return false;
          if (preferDifferentRoute && routeTag && signal.routeTags.includes(routeTag)) return false;
          return true;
        });

      const neutralCounterweightPool = cardPool.filter((card) => getCardRouteAffinityTags(card).length === 0);
      const genericPowerPool = cardPool.filter((card) => genericPowerIds.has(card.id) && getCardRouteAffinityTags(card).length === 0);
      const genericFallbackPool = cardPool.filter((card) => {
        const signal = getCardRouteSignal(card);
        return (
          getCardRouteAffinityTags(card).length === 0 &&
          (!signal || signal.earlyGameRole === 'generic_fallback' || signal.earlyGameRole === 'generic_power')
        );
      });

      const first = primaryTag
        ? chooseUniqueSeeded(byRole(['route_confirm'], primaryTag), 'reward-first')
        : chooseUniqueSeeded(cardPool.filter((card) => {
            const signal = getCardRouteSignal(card);
            return signal?.earlyGameRole === 'route_confirm';
          }), 'reward-first-fallback');
      if (first) result.push(first);

      const second =
        chooseUniqueSeeded(neutralCounterweightPool, 'reward-second-neutral') ??
        chooseUniqueSeeded(genericPowerPool, 'reward-second-generic') ??
        chooseUniqueSeeded(genericFallbackPool, 'reward-second-fallback');
      if (second) result.push(second);

      const altRouteTag = availableRouteTags.find((tag) => tag !== primaryTag) ?? null;
      const third =
        (dominantTag
          ? (primaryTag ? chooseUniqueSeeded(byRole(['route_payoff'], primaryTag), 'reward-third-primary-payoff') : null)
          : (altRouteTag ? chooseUniqueSeeded(byRole(['route_confirm', 'route_payoff'], altRouteTag), 'reward-third-alt-route') : null)) ??
        (primaryTag ? chooseUniqueSeeded(byRole(['route_payoff'], primaryTag), 'reward-third-primary') : null) ??
        (primaryTag ? chooseUniqueSeeded(byRole(['route_confirm', 'route_payoff'], primaryTag, true), 'reward-third-different') : null) ??
        chooseUniqueSeeded(genericFallbackPool, 'reward-third-generic');
      if (third) result.push(third);

      return result.slice(0, count);
    };

    const pickEarlyShopCards = (): CardDef[] => {
      const result: CardDef[] = [];
      const earlyShopTag = dominantTag ?? routeTagsForCharacter[0] ?? null;
      const alignedPool = cardPool.filter((card) => !!(earlyShopTag && getCardRouteAffinityTags(card).includes(earlyShopTag)));
      const alignedPayoffPool = alignedPool.filter((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_payoff');
      const alignedConfirmPool = alignedPool.filter((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_confirm');
      const pivotTemptationPool = cardPool.filter((card) => {
        const tags = getCardRouteAffinityTags(card);
        return tags.length > 0 && !!earlyShopTag && !tags.includes(earlyShopTag);
      });
      const genericPool = cardPool.filter((card) => genericPowerIds.has(card.id) && getCardRouteAffinityTags(card).length === 0);

      const first =
        chooseUniqueSeeded(alignedPayoffPool, 'shop-first-payoff') ??
        chooseUniqueSeeded(alignedConfirmPool, 'shop-first-confirm') ??
        chooseUniqueSeeded(alignedPool, 'shop-first-aligned') ??
        chooseUniqueSeeded(genericPool, 'shop-first-generic');
      const second = chooseUniqueSeeded(genericPool, 'shop-second-generic') ?? chooseUniqueSeeded(alignedPool, 'shop-second-aligned');
      const third =
        chooseUniqueSeeded(alignedConfirmPool, 'shop-third-confirm') ??
        chooseUniqueSeeded(alignedPayoffPool, 'shop-third-payoff') ??
        chooseUniqueSeeded(alignedPool, 'shop-third-aligned');
      const fourth =
        chooseUniqueSeeded(pivotTemptationPool, 'shop-fourth-pivot') ??
        chooseUniqueSeeded(genericPool, 'shop-fourth-generic');
      if (first) result.push(first);
      if (second) result.push(second);
      if (third) result.push(third);
      if (fourth) result.push(fourth);

      while (result.length < count) {
        const fallback = chooseUniqueSeeded(cardPool, `shop-fallback-${result.length}`);
        if (!fallback) break;
        result.push(fallback);
      }
      return result;
    };

    const pickMidgameRewardCards = (): CardDef[] => {
      const result: CardDef[] = [];
      if (!dominantTag) return result;

      const alignedAffinityPool = cardPool.filter((card) => getCardRouteAffinityTags(card).includes(dominantTag));
      const alignedPayoffPool = alignedAffinityPool.filter((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_payoff');
      const alignedConfirmPool = alignedAffinityPool.filter((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_confirm');
      const neutralCounterweightPool = cardPool.filter((card) => getCardRouteAffinityTags(card).length === 0);
      const pivotTemptationPool = cardPool.filter((card) => {
        const tags = getCardRouteAffinityTags(card);
        return tags.length > 0 && !tags.includes(dominantTag);
      });

      const first =
        chooseUniqueSeeded(alignedPayoffPool, 'mid-reward-first-payoff') ??
        chooseUniqueSeeded(alignedConfirmPool, 'mid-reward-first-confirm') ??
        chooseUniqueSeeded(alignedAffinityPool, 'mid-reward-first-aligned');
      if (first) result.push(first);

      const second =
        chooseUniqueSeeded(neutralCounterweightPool, 'mid-reward-second-neutral') ??
        chooseUniqueSeeded(pivotTemptationPool, 'mid-reward-second-pivot');
      if (second) result.push(second);

      const third =
        chooseUniqueSeeded(alignedPayoffPool, 'mid-reward-third-payoff') ??
        chooseUniqueSeeded(pivotTemptationPool, 'mid-reward-third-pivot') ??
        chooseUniqueSeeded(neutralCounterweightPool, 'mid-reward-third-neutral') ??
        chooseUniqueSeeded(cardPool, 'mid-reward-third-fallback');
      if (third) result.push(third);

      return result.slice(0, count);
    };

    const pickMidgameShopCards = (): CardDef[] => {
      const result: CardDef[] = [];
      if (!dominantTag) return result;

      const alignedAffinityPool = cardPool.filter((card) => getCardRouteAffinityTags(card).includes(dominantTag));
      const alignedPayoffPool = alignedAffinityPool.filter((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_payoff');
      const alignedConfirmPool = alignedAffinityPool.filter((card) => getCardRouteSignal(card)?.earlyGameRole === 'route_confirm');
      const pivotTemptationPool = cardPool.filter((card) => {
        const tags = getCardRouteAffinityTags(card);
        return tags.length > 0 && !tags.includes(dominantTag);
      });
      const neutralCounterweightPool = cardPool.filter((card) => getCardRouteAffinityTags(card).length === 0);

      const first =
        chooseUniqueSeeded(alignedPayoffPool, 'mid-shop-first-payoff') ??
        chooseUniqueSeeded(alignedConfirmPool, 'mid-shop-first-confirm') ??
        chooseUniqueSeeded(alignedAffinityPool, 'mid-shop-first-aligned') ??
        chooseUniqueSeeded(pivotTemptationPool, 'mid-shop-first-pivot');
      const second =
        chooseUniqueSeeded(alignedConfirmPool, 'mid-shop-second-confirm') ??
        chooseUniqueSeeded(alignedPayoffPool, 'mid-shop-second-payoff') ??
        chooseUniqueSeeded(alignedAffinityPool, 'mid-shop-second-aligned') ??
        chooseUniqueSeeded(neutralCounterweightPool, 'mid-shop-second-neutral');
      const third =
        chooseUniqueSeeded(neutralCounterweightPool, 'mid-shop-third-neutral') ??
        chooseUniqueSeeded(pivotTemptationPool, 'mid-shop-third-pivot') ??
        chooseUniqueSeeded(cardPool, 'mid-shop-third-fallback');
      const fourth =
        chooseUniqueSeeded(alignedAffinityPool, 'mid-shop-fourth-aligned') ??
        chooseUniqueSeeded(pivotTemptationPool, 'mid-shop-fourth-pivot') ??
        chooseUniqueSeeded(neutralCounterweightPool, 'mid-shop-fourth-neutral') ??
        chooseUniqueSeeded(cardPool, 'mid-shop-fourth-fallback');

      if (first) result.push(first);
      if (second) result.push(second);
      if (third) result.push(third);
      if (fourth) result.push(fourth);

      while (result.length < count) {
        const fallback = chooseUniqueSeeded(cardPool, `mid-shop-fallback-${result.length}`);
        if (!fallback) break;
        result.push(fallback);
      }
      return result.slice(0, count);
    };

    const shouldUseEarlyRewardPlan = source === 'combat' && floor <= 2;
    const shouldUseEarlyShopPlan = source === 'shop' && floor <= 3;
    const shouldUseMidgameRewardPlan = source === 'combat' && floor > 2 && floor <= 6 && !!dominantTag;
    const shouldUseMidgameShopPlan = source === 'shop' && floor > 3 && floor <= 6 && !!dominantTag;
    const plannedCards = shouldUseEarlyRewardPlan
      ? pickEarlyRewardCards()
      : shouldUseEarlyShopPlan
        ? pickEarlyShopCards()
        : shouldUseMidgameRewardPlan
          ? pickMidgameRewardCards()
          : shouldUseMidgameShopPlan
            ? pickMidgameShopCards()
            : [];

    for (const card of plannedCards) {
      rewards.push(this.deps.createRuntimeCard(card));
    }

    for (let i = rewards.length; i < count; i++) {
      const rarityRoll = this.deps.rng();
      let rarity: 'Common' | 'Uncommon' | 'Rare' = 'Common';
      if (rarityRoll > 0.85) rarity = 'Rare';
      else if (rarityRoll > 0.55) rarity = 'Uncommon';

      let validCards = cardsData.filter(c =>
        c.rarity === rarity &&
        ((c.character ?? 'All') === 'All' || c.character === characterId)
      );

      const pool = validCards.length > 0 ? validCards : cardsData.filter(c => c.rarity === rarity && ((c.character ?? 'All') === 'All'));

      let card: CardDef | null = null;
      if (pool.length > 0) {
        const weightedPool: any[] = [];
        for (const candidate of pool) {
          if (chosenIds.has(candidate.id)) continue;
          weightedPool.push(candidate);
          const signal = dominantTag ? getCardRouteSignal(candidate) : null;
          const alignsToRoute = !!(signal && dominantTag && signal.routeTags.includes(dominantTag));
          if (alignsToRoute) {
            const sustainWeight =
              source === 'shop'
                ? floor <= 6 ? 4 : 2
                : floor <= 4 ? 2 : 1;
            for (let j = 0; j < sustainWeight; j += 1) {
              weightedPool.push(candidate);
            }
          }
          if (unlockedIds.has((candidate as any).id)) {
            for (let j = 0; j < unlockedWeightBonus; j++) weightedPool.push(candidate);
          }
        }
        const pickPool = weightedPool.length > 0 ? weightedPool : pool;
        card = safeArrayAccess(pickPool, Math.floor(this.deps.rng() * pickPool.length));
      }
      if (card) {
        chosenIds.add(card.id);
        rewards.push(this.deps.createRuntimeCard(card));
      }
    }
    unlockManyCodexEntries('cards', rewards.map(c => c.id));
    return rewards;
  }

  getEnchantableCards(): CardDef[] {
    const state = this.deps.getState();
    return state.player.deck.filter((card) => {
      const runCard = this.deps.createRuntimeCard(card, this.deps.generateId());
      return (runCard.type === 'Attack' || runCard.type === 'Skill') && runCard.persistentEnchantments.length === 0;
    });
  }

  getCardRemovalCostForCard(card: CardDef | { tags?: string[] }): number {
    const state = this.deps.getState();
    const doubleCost = Array.isArray(card.tags) && card.tags.includes('DoubleRemoveCost');
    return state.cardRemovalCost * (doubleCost ? 2 : 1);
  }

  isEventFreeCardRemovalMode(): boolean {
    const state = this.deps.getState();
    return state.screen === 'RemoveCard' &&
      !!state.activeEvent &&
      state.activeEvent.stage === 'free_remove' &&
      Number(state.activeEvent.data?.freeRemovalsRemaining || 0) > 0;
  }

  getEventFreeRemovalsRemaining(): number {
    const state = this.deps.getState();
    if (!this.isEventFreeCardRemovalMode()) return 0;
    return Math.max(0, Number(state.activeEvent?.data?.freeRemovalsRemaining || 0));
  }
}
