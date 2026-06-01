/**
 * @file normalizeLegacyGameState.ts
 * @description 旧版游戏状态规范化器，将 GameState 转换为 RuleSnapshot 格式
 *
 * 主要职责:
 * - 将旧版 GameState 深度克隆为 RuleSnapshot 结构
 * - 转换路线状态、表面上下文等嵌套字段
 * - 集成内容服务解析遗物、药水等定义
 */
import type { GameState } from '@/core/types';
import { screenToRunPhase } from '@/core/events/runStateMachine';
import { deriveSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import type { RuleSnapshot } from '@/runtimeV2/contracts';
import { deriveRouteStateFromDeck } from '@/content/narrative/routeState';
import { getKnownRouteTagsForCharacter } from '@/content/narrative/routeSignals';
import { getPotionDefById, getRelicDefById, resolveShopOfferPrice } from '@/content/narrative/numericSystem';
import { readLegacyActiveEventOutcome } from '@/runtimeV2/activeEventOutcome';

function cloneRouteState(routeState: GameState['routeState']): RuleSnapshot['routeState'] {
  if (!routeState) return null;
  return {
    primaryTag: routeState.primaryTag,
    secondaryTag: routeState.secondaryTag,
    confidence: routeState.confidence,
    stage: routeState.stage,
    recentCommits: routeState.recentCommits.map((commit) => ({ ...commit })),
  };
}

function cloneSurfaceContext(surfaceContext: GameState['surfaceContext']): RuleSnapshot['surfaceContext'] {
  if (!surfaceContext) return null;
  return {
    upgradeReturnScreen: surfaceContext.upgradeReturnScreen,
    relicUpgradeReturnScreen: surfaceContext.relicUpgradeReturnScreen,
    enchantReturnScreen: surfaceContext.enchantReturnScreen,
    enchantContext: surfaceContext.enchantContext ? { ...surfaceContext.enchantContext } : null,
    campfireChoiceLocked: surfaceContext.campfireChoiceLocked,
    isEventFreeCardRemovalMode: surfaceContext.isEventFreeCardRemovalMode,
    pendingUpgradeRefund: surfaceContext.pendingUpgradeRefund,
  };
}

function deriveLegacyShopSnapshot(state: GameState): RuleSnapshot['shop'] {
  const isShopSurface =
    state.screen === 'Shop' ||
    (
      state.screen === 'RemoveCard' &&
      (state.upgradeReturnScreen === 'Shop' || state.surfaceContext?.upgradeReturnScreen === 'Shop')
    );
  if (!isShopSurface) return null;
  const adjustShopPrice = (basePrice: number) => {
    let multiplier = 1;
    if (state.player.relics.includes('lantern')) multiplier *= 0.95;
    return Math.max(1, Math.round(basePrice * multiplier));
  };

  return {
    cards: state.shopCards.map((card) => ({
      id: card.id,
      price: adjustShopPrice(resolveShopOfferPrice('card', card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50)),
    })),
    relics: state.shopRelics.map((id) => ({ id, price: adjustShopPrice(resolveShopOfferPrice('relic', getRelicDefById(id)?.price)) })),
    potions: state.shopPotions.map((id) => ({ id, price: adjustShopPrice(resolveShopOfferPrice('potion', getPotionDefById(id)?.price)) })),
    cardRemovalCost: state.cardRemovalCost ?? 75,
  };
}

export function normalizeLegacyGameState(state: GameState, legacySaveData?: object): RuleSnapshot {
  const lifecyclePhase = screenToRunPhase(state.screen);
  const knownRouteTags = state.character?.id ? getKnownRouteTagsForCharacter(state.character.id) : [];
  const routeState = state.routeState ?? (
    knownRouteTags.length > 0 ? deriveRouteStateFromDeck(state.player.deck, knownRouteTags, null) : null
  );
  const surfaceContext = state.surfaceContext ?? deriveSurfaceContextFromLegacyState(state, {
    isEventFreeCardRemovalMode:
      state.screen === 'RemoveCard' &&
      !!state.activeEvent &&
      state.activeEvent.stage === 'free_remove' &&
      Number(state.activeEvent.data?.freeRemovalsRemaining || 0) > 0,
  });
  const hasActiveRoomSession =
    !!state.roomSession &&
    (state.pendingNodeResolution || lifecyclePhase !== 'map');
  const activeEventOutcome = readLegacyActiveEventOutcome(state.activeEvent);
  const combatPlayer = state.combat?.player;
  return {
    schemaVersion: 2,
    engineVersion: 'runtime-v2-draft',
    seed: state.seed,
    lifecycle: {
      screen: state.screen,
      phase: lifecyclePhase,
      pendingNodeResolution: !!(state.pendingNodeResolution || hasActiveRoomSession)
    },
    player: {
      characterId: state.character?.id || null,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      gold: state.player.gold,
      intel: state.player.intel || 0,
      devotion: state.player.devotion || 0,
      corruption: state.player.corruption || 0,
      timeLayer: Math.max(0, Math.floor(Number(combatPlayer?.timeLayer ?? 0))),
      thread: Math.max(0, Math.floor(Number(combatPlayer?.thread ?? 0))),
      concoction: Math.max(0, Math.floor(Number(combatPlayer?.concoction ?? 0))),
      deck: state.player.deck.map((card) => card.id),
      relicIds: [...state.player.relics],
      potionIds: [...state.player.potions],
      relicStates: Object.fromEntries(
        Object.entries(state.player.relicStates || {}).map(([relicId, relicState]) => [
          relicId,
          {
            level: relicState.level ?? 1,
            progress: relicState.progress ?? 0,
            corrupted: relicState.corrupted,
          },
        ])
      ),
    },
    map: {
      currentNodeId: state.currentNodeId || null,
      nodes: state.map.map((node) => ({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        revealed: !!node.revealed,
        next: [...node.next]
      }))
    },
    routeState: cloneRouteState(routeState),
    surfaceContext: cloneSurfaceContext(surfaceContext),
    roomSession: hasActiveRoomSession && state.roomSession
      ? {
          token: state.roomSession.token,
          nodeId: state.roomSession.nodeId,
          ownerKind: state.roomSession.ownerKind,
          resolverKind: state.roomSession.resolverKind,
          surfaceStack: [...state.roomSession.surfaceStack],
          status: state.roomSession.status,
        }
      : null,
    combat: state.combat
      ? {
          turn: state.combat.turn,
          isPlayerTurn: !!state.combat.isPlayerTurn,
          playerBlock: state.combat.player.block,
          playerEnergy: state.combat.player.energy,
          enemyIds: state.combat.enemies.map((enemy) => enemy.defId),
          enemies: state.combat.enemies.map((enemy) => ({
            id: enemy.id,
            defId: enemy.defId,
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            block: enemy.block,
            nextIntent: enemy.nextIntent,
          })),
          hand: state.combat.hand.map((card) => card.id),
          drawPileCount: state.combat.drawPile.length,
          discardPileCount: state.combat.discardPile.length
        }
      : null,
    reward: state.rewardCards.length > 0
      ? {
          cardIds: state.rewardCards.map((card) => card.id),
          source: 'combat'
        }
      : null,
    shop: deriveLegacyShopSnapshot(state),
    activeEvent: state.activeEvent
      ? {
          id: state.activeEvent.id,
          stage: state.activeEvent.stage,
          lastChoiceId: activeEventOutcome.lastChoiceId,
          choiceRole: activeEventOutcome.choiceRole,
          outcomeKind: activeEventOutcome.outcomeKind,
          data: state.activeEvent.data
        }
      : null,
    meta: {
      runId: state.runId || null,
      replayLength: 0,
      generatedAt: new Date().toISOString(),
      adapter: 'legacy-oracle',
      runtimeRngState: state.rngState ?? 0,
    },
    compat: legacySaveData
      ? {
          legacySaveData
        }
      : undefined
  };
}
