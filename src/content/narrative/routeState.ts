import type { GameState, RouteCommit, RouteCommitSource, RouteState, RunCardInstance } from '@/core/types';
import { analyzeRouteSignals, getCardRouteAffinity, getKnownRouteTagsForCharacter, resolvePreferredRouteTag } from '@/content/narrative/routeSignals';

const MAX_RECENT_COMMITS = 6;
const RECENT_CARD_WEIGHTS = [24, 18, 12, 8, 5];
const RECENT_COMMIT_DECAY = [1, 0.8, 0.64, 0.5, 0.4, 0.32];

function toCommitList(commits?: RouteCommit[] | null): RouteCommit[] {
  return (commits ?? [])
    .filter((entry) => !!entry?.tag)
    .slice(-MAX_RECENT_COMMITS)
    .map((entry) => ({ ...entry }));
}

export function createEmptyRouteState(): RouteState {
  return {
    primaryTag: null,
    secondaryTag: null,
    confidence: 0,
    stage: 'forming',
    recentCommits: [],
  };
}

export function getPreferredRouteTagFromState(
  deck: Array<Pick<RunCardInstance, 'id'>>,
  knownRouteTags: string[],
  routeState?: RouteState | null,
  maxRecentCards = 3,
): string | null {
  const recentPreferredTag = resolvePreferredRouteTag(deck, knownRouteTags, maxRecentCards);
  if (recentPreferredTag) {
    return recentPreferredTag;
  }
  if (routeState?.primaryTag && knownRouteTags.includes(routeState.primaryTag)) {
    return routeState.primaryTag;
  }
  return null;
}

export function deriveRouteStateFromDeck(
  deck: Array<Pick<RunCardInstance, 'id'>>,
  knownRouteTags: string[],
  existingRouteState?: RouteState | null,
): RouteState {
  if (knownRouteTags.length === 0) {
    return createEmptyRouteState();
  }

  const overall = analyzeRouteSignals(deck);
  const scoreByTag: Record<string, number> = {};
  for (const tag of knownRouteTags) {
    if (overall.scoreByTag[tag]) {
      scoreByTag[tag] = (scoreByTag[tag] || 0) + overall.scoreByTag[tag];
    }
  }

  const recentCards = deck.slice(-RECENT_CARD_WEIGHTS.length).reverse();
  recentCards.forEach((card, index) => {
    const affinity = getCardRouteAffinity(card);
    if (affinity) {
      const bonus = RECENT_CARD_WEIGHTS[index]!;
      affinity.routeTags
        .filter((tag) => knownRouteTags.includes(tag))
        .forEach((tag) => {
          scoreByTag[tag] = (scoreByTag[tag] || 0) + bonus + affinity.affinityStrength * 3;
        });
      return;
    }
    const fallbackTag = resolvePreferredRouteTag([card as RunCardInstance], knownRouteTags, 1);
    if (!fallbackTag) return;
    scoreByTag[fallbackTag] = (scoreByTag[fallbackTag] || 0) + RECENT_CARD_WEIGHTS[index]!;
  });

  const recentCommits = toCommitList(existingRouteState?.recentCommits);
  [...recentCommits].reverse().forEach((commit, index) => {
    const decay = RECENT_COMMIT_DECAY[index] ?? RECENT_COMMIT_DECAY[RECENT_COMMIT_DECAY.length - 1]!;
    scoreByTag[commit.tag] = (scoreByTag[commit.tag] || 0) + Math.max(1, Math.round(commit.weight * decay));
  });

  const sorted = Object.entries(scoreByTag)
    .filter(([tag]) => knownRouteTags.includes(tag))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const primaryTag = sorted[0]?.[0] ?? null;
  const secondaryTag = sorted[1]?.[0] ?? null;
  const topScore = sorted[0]?.[1] ?? 0;
  const secondScore = sorted[1]?.[1] ?? 0;
  const confidence = primaryTag
    ? Math.max(0, Math.min(100, Math.round(Math.min(70, topScore) + Math.min(30, Math.max(0, topScore - secondScore) * 2))))
    : 0;

  let stage: RouteState['stage'] = 'forming';
  if (primaryTag) {
    if (existingRouteState?.primaryTag && existingRouteState.primaryTag !== primaryTag && confidence >= 35) {
      stage = 'pivoting';
    } else if (confidence >= 60) {
      stage = 'committed';
    }
  }

  return {
    primaryTag,
    secondaryTag,
    confidence,
    stage,
    recentCommits,
  };
}

export function syncRouteStateFromLegacyState(
  state: Pick<GameState, 'routeState' | 'player' | 'character'>
): RouteState | null {
  const characterId = state.character?.id;
  if (!characterId) {
    state.routeState = null;
    return null;
  }
  const knownRouteTags = getKnownRouteTagsForCharacter(characterId);
  state.routeState = deriveRouteStateFromDeck(state.player.deck, knownRouteTags, state.routeState ?? null);
  return state.routeState;
}

export function recordRouteCommit(
  state: Pick<GameState, 'routeState' | 'player' | 'character'>,
  commit: RouteCommit
): RouteState | null {
  const characterId = state.character?.id;
  if (!characterId) return null;
  const knownRouteTags = getKnownRouteTagsForCharacter(characterId);
  const nextRouteState: RouteState = {
    ...(state.routeState ?? createEmptyRouteState()),
    recentCommits: [...toCommitList(state.routeState?.recentCommits), commit].slice(-MAX_RECENT_COMMITS),
  };
  state.routeState = deriveRouteStateFromDeck(state.player.deck, knownRouteTags, nextRouteState);
  return state.routeState;
}

export function maybeRecordRouteCommit(
  state: Pick<GameState, 'routeState' | 'player' | 'character'>,
  tag: string | null | undefined,
  source: RouteCommitSource,
  floor: number,
  weight = 12
): RouteState | null {
  if (!tag) return state.routeState ?? null;
  return recordRouteCommit(state, {
    tag,
    source,
    floor,
    weight,
  });
}
