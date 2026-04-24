import { deriveRouteStateFromDeck } from '@/content/narrative/routeState';
import { getKnownRouteTagsForCharacter } from '@/content/narrative/routeSignals';
import { readRuleActiveEventOutcome } from '@/runtimeV2/activeEventOutcome';
import type { RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';

const runtimeV2ContentBundle = buildRuntimeV2ContentBundle();

export function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, chr: string) => chr.toUpperCase());
}

export function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (chr) => `_${chr.toLowerCase()}`);
}

export function convertKeys(value: unknown, keyMapper: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => convertKeys(entry, keyMapper));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[keyMapper(key)] = convertKeys(entry, keyMapper);
  }
  return result;
}

export function unwrapPythonSnapshotEnvelope(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Python runtime payload');
  }

  const record = value as Record<string, unknown>;
  const nestedSnapshot = record.snapshot;
  if (nestedSnapshot && typeof nestedSnapshot === 'object' && !Array.isArray(nestedSnapshot)) {
    return nestedSnapshot as Record<string, unknown>;
  }

  return record;
}

function derivePythonRouteState(
  converted: Partial<RuleSnapshot>,
  player: Partial<RuleSnapshot['player']>,
  map: NonNullable<RuleSnapshot['map']>,
): RuleSnapshot['routeState'] {
  if (converted.routeState) {
    return converted.routeState;
  }

  const characterId = player.characterId ?? null;
  if (!characterId) {
    return null;
  }

  const knownRouteTags = getKnownRouteTagsForCharacter(characterId);
  if (knownRouteTags.length === 0) {
    return null;
  }

  const deckCards = (player.deck ?? []).map((cardId) => ({ id: cardId }));
  const baseRouteState = deriveRouteStateFromDeck(deckCards, knownRouteTags, null);
  const startingDeckSize =
    runtimeV2ContentBundle.characters.find((entry) => entry.id === characterId)?.starting_deck.length ?? deckCards.length;
  if (!baseRouteState.primaryTag || deckCards.length <= startingDeckSize) {
    return baseRouteState;
  }

  const currentNode = (map.nodes ?? []).find((entry) => entry.id === map.currentNodeId);
  const floor = currentNode ? currentNode.y + 1 : 1;
  const source =
    converted.lifecycle?.phase === 'shop'
      ? 'shop'
      : converted.lifecycle?.phase === 'event'
        ? 'event'
        : converted.lifecycle?.phase === 'rest'
          ? 'rest'
          : converted.lifecycle?.phase === 'upgrade'
            ? 'upgrade'
            : converted.lifecycle?.phase === 'enchant'
              ? 'enchant'
              : converted.lifecycle?.phase === 'relic_upgrade'
                ? 'relic_upgrade'
                : 'reward';

  return deriveRouteStateFromDeck(deckCards, knownRouteTags, {
    ...baseRouteState,
    recentCommits: [
      {
        tag: baseRouteState.primaryTag,
        source,
        floor,
        weight: 12,
      },
    ],
  });
}

export function normalizePythonSnapshot(
  snapshot: Record<string, unknown>,
  options: { generatedAtFallback?: () => string } = {},
): RuleSnapshot {
  const converted = convertKeys(snapshot, snakeToCamelKey) as Partial<RuleSnapshot>;
  const player = converted.player ?? ({} as RuleSnapshot['player']);
  const map = converted.map ?? { currentNodeId: null, nodes: [] };
  const combat = converted.combat ?? null;
  const reward = converted.reward ?? null;
  const shop = converted.shop ?? null;
  const activeEvent = converted.activeEvent ?? null;
  const meta = converted.meta ?? ({} as RuleSnapshot['meta']);
  const generatedAtFallback = options.generatedAtFallback ?? (() => new Date().toISOString());
  const rawPlayer = (snapshot.player as Record<string, unknown> | undefined) ?? {};
  const rawRelicStates = (rawPlayer.relic_states as Record<string, unknown> | undefined)
    ?? (rawPlayer.relicStates as Record<string, unknown> | undefined)
    ?? {};
  const normalizedRelicStates = Object.fromEntries(
    Object.entries(rawRelicStates).map(([key, value]) => [key, convertKeys(value, snakeToCamelKey)]),
  ) as RuleSnapshot['player']['relicStates'];
  const activeEventOutcome = readRuleActiveEventOutcome(activeEvent);

  return {
    schemaVersion: converted.schemaVersion ?? 2,
    engineVersion: converted.engineVersion ?? 'rules-core-draft',
    seed: converted.seed ?? 0,
    lifecycle: converted.lifecycle ?? {
      screen: 'CharacterSelect',
      phase: 'character_select',
      pendingNodeResolution: false,
    },
    player: {
      characterId: player.characterId ?? null,
      hp: player.hp ?? 0,
      maxHp: player.maxHp ?? 0,
      gold: player.gold ?? 0,
      intel: player.intel ?? 0,
      devotion: player.devotion ?? 0,
      corruption: player.corruption ?? 0,
      deck: player.deck ?? [],
      relicIds: player.relicIds ?? [],
      potionIds: player.potionIds ?? [],
      relicStates: normalizedRelicStates,
    },
    map: {
      currentNodeId: map.currentNodeId ?? null,
      nodes: map.nodes ?? [],
    },
    combat: combat
      ? {
          turn: combat.turn ?? 0,
          isPlayerTurn: combat.isPlayerTurn ?? false,
          playerBlock: combat.playerBlock ?? 0,
          playerEnergy: combat.playerEnergy ?? 0,
          enemyIds: combat.enemyIds ?? [],
          enemies: combat.enemies ?? [],
          hand: combat.hand ?? [],
          drawPileCount: combat.drawPileCount ?? 0,
          discardPileCount: combat.discardPileCount ?? 0,
        }
      : null,
    reward: reward
      ? {
          cardIds: reward.cardIds ?? [],
          source: reward.source ?? 'combat',
        }
      : null,
    shop: shop
      ? {
          cards: shop.cards ?? [],
          relics: shop.relics ?? [],
          potions: shop.potions ?? [],
          cardRemovalCost: shop.cardRemovalCost ?? 75,
        }
      : null,
    activeEvent: activeEvent
      ? {
          id: typeof activeEvent.id === 'string' ? activeEvent.id : '',
          stage: typeof activeEvent.stage === 'string' ? activeEvent.stage : undefined,
          lastChoiceId: activeEventOutcome.lastChoiceId,
          choiceRole: activeEventOutcome.choiceRole,
          outcomeKind: activeEventOutcome.outcomeKind,
          data: activeEvent.data,
        }
      : null,
    routeState: derivePythonRouteState(converted, player, map),
    surfaceContext: converted.surfaceContext ?? null,
    roomSession: converted.roomSession ?? null,
    meta: {
      runId: meta.runId ?? null,
      replayLength: meta.replayLength ?? 0,
      generatedAt: meta.generatedAt ?? generatedAtFallback(),
      adapter: 'python-wasm',
      runtimeRngState: meta.runtimeRngState ?? 0,
    },
  };
}
