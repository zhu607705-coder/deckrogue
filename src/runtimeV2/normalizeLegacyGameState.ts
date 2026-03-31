import type { GameState } from '@/core/types';
import { screenToRunPhase } from '@/core/events/runStateMachine';
import type { RuleSnapshot } from './contracts';

export function normalizeLegacyGameState(state: GameState, legacySaveData?: object): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'runtime-v2-draft',
    seed: state.seed,
    lifecycle: {
      screen: state.screen,
      phase: screenToRunPhase(state.screen),
      pendingNodeResolution: !!state.pendingNodeResolution
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
