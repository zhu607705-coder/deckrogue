import type { GameState } from '@/core/types';
import type { RuleSnapshot } from './contracts';

type LegacyScreen = GameState['screen'];

const LEGACY_SCREEN_SET = new Set<LegacyScreen>([
  'Launcher',
  'CharacterSelect',
  'Map',
  'Combat',
  'Reward',
  'Event',
  'Shop',
  'Rest',
  'Upgrade',
  'RemoveCard',
  'Enchant',
  'RelicUpgrade',
  'GameOver',
  'Victory',
]);

function coerceLegacyScreen(screen: string): LegacyScreen {
  if (LEGACY_SCREEN_SET.has(screen as LegacyScreen)) {
    return screen as LegacyScreen;
  }
  throw new Error(`Unsupported legacy screen projection: ${screen}`);
}

export interface LegacyStateProjection {
  characterId: string | null;
  player: {
    hp: number;
    maxHp: number;
    gold: number;
    intel: number;
    devotion: number;
    corruption: number;
    deckIds: string[];
    relicIds: string[];
    potionIds: string[];
  };
  map: GameState['map'];
  currentNodeId: string | null;
  screen: LegacyScreen;
  pendingNodeResolution: boolean;
  routeState: GameState['routeState'];
  surfaceContext: GameState['surfaceContext'];
  roomSession: GameState['roomSession'];
  campfireChoiceLocked: boolean;
}

function cloneRouteState(routeState: GameState['routeState']): GameState['routeState'] {
  if (!routeState) return null;
  return {
    primaryTag: routeState.primaryTag,
    secondaryTag: routeState.secondaryTag,
    confidence: routeState.confidence,
    stage: routeState.stage,
    recentCommits: routeState.recentCommits.map((commit) => ({ ...commit })),
  };
}

function cloneSurfaceContext(surfaceContext: GameState['surfaceContext']): GameState['surfaceContext'] {
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

export function projectRuleSnapshotToLegacyState(snapshot: RuleSnapshot): LegacyStateProjection {
  const surfaceContext = cloneSurfaceContext(snapshot.surfaceContext ?? null);
  return {
    characterId: snapshot.player.characterId,
    player: {
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      gold: snapshot.player.gold,
      intel: snapshot.player.intel,
      devotion: snapshot.player.devotion,
      corruption: snapshot.player.corruption,
      deckIds: [...snapshot.player.deck],
      relicIds: [...snapshot.player.relicIds],
      potionIds: [...snapshot.player.potionIds],
    },
    map: snapshot.map.nodes.map((node) => ({
      id: node.id,
      type: node.type as GameState['map'][number]['type'],
      x: node.x,
      y: node.y,
      revealed: !!node.revealed,
      next: [...node.next],
    })),
    currentNodeId: snapshot.map.currentNodeId,
    screen: coerceLegacyScreen(snapshot.lifecycle.screen),
    pendingNodeResolution: !!(snapshot.roomSession ?? snapshot.lifecycle.pendingNodeResolution),
    routeState: cloneRouteState(snapshot.routeState ?? null),
    surfaceContext,
    roomSession: snapshot.roomSession
      ? {
          token: snapshot.roomSession.token,
          nodeId: snapshot.roomSession.nodeId,
          ownerKind: snapshot.roomSession.ownerKind,
          resolverKind: snapshot.roomSession.resolverKind,
          surfaceStack: [...snapshot.roomSession.surfaceStack],
          status: snapshot.roomSession.status,
        }
      : null,
    campfireChoiceLocked: !!surfaceContext?.campfireChoiceLocked,
  };
}
