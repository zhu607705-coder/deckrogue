import type { GameState } from '@/core/types';
import { screenToRunPhase } from '@/core/events/runStateMachine';
import { deriveSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import type { RuleSnapshot } from './contracts';
import { deriveRouteStateFromDeck } from '@/content/narrative/routeState';
import { getKnownRouteTagsForCharacter } from '@/content/narrative/routeSignals';

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

export function normalizeLegacyGameState(state: GameState, legacySaveData?: object): RuleSnapshot {
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
  return {
    schemaVersion: 2,
    engineVersion: 'runtime-v2-draft',
    seed: state.seed,
    lifecycle: {
      screen: state.screen,
      phase: screenToRunPhase(state.screen),
      pendingNodeResolution: !!(state.roomSession ?? state.pendingNodeResolution)
    },
    player: {
      characterId: state.character?.id || null,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      gold: state.player.gold,
      intel: state.player.intel || 0,
      devotion: state.player.devotion || 0,
      corruption: state.player.corruption || 0,
      deck: state.player.deck.map((card) => card.id),
      relicIds: [...state.player.relics],
      potionIds: [...state.player.potions]
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
    roomSession: state.roomSession
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
    activeEvent: state.activeEvent
      ? {
          id: state.activeEvent.id,
          stage: state.activeEvent.stage,
          data: state.activeEvent.data
        }
      : null,
    meta: {
      runId: state.runId || null,
      replayLength: 0,
      generatedAt: new Date().toISOString(),
      adapter: 'legacy-oracle'
    },
    compat: legacySaveData
      ? {
          legacySaveData
        }
      : undefined
  };
}
