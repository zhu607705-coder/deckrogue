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
  campfireChoiceLocked: boolean;
}

export function projectRuleSnapshotToLegacyState(snapshot: RuleSnapshot): LegacyStateProjection {
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
    pendingNodeResolution: !!snapshot.lifecycle.pendingNodeResolution,
    campfireChoiceLocked: false,
  };
}
