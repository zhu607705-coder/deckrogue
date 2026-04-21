import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

import { RunGenerator } from '@/core/events/runGenerator';
import { deriveRouteStateFromDeck } from '@/content/narrative/routeState';
import { getKnownRouteTagsForCharacter } from '@/content/narrative/routeSignals';
import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';

type PendingRequest = {
  resolve: (value: RuleSnapshot) => void;
  reject: (error: Error) => void;
};

export interface PythonProcessAdapterOptions {
  usePrebuiltMapNodes?: boolean;
}

type PythonResponse = {
  ok: boolean;
  error?: string;
  snapshot?: Record<string, unknown>;
};

const runtimeV2ContentBundle = buildRuntimeV2ContentBundle();

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, chr: string) => chr.toUpperCase());
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (chr) => `_${chr.toLowerCase()}`);
}

function convertKeys(value: unknown, keyMapper: (key: string) => string): unknown {
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

function normalizePythonSnapshot(snapshot: Record<string, unknown>): RuleSnapshot {
  const converted = convertKeys(snapshot, snakeToCamelKey) as Partial<RuleSnapshot>;
  const player = converted.player ?? ({} as RuleSnapshot['player']);
  const rawPlayer = (snapshot.player as Record<string, unknown> | undefined) ?? {};
  const rawRelicStates = (rawPlayer.relic_states as Record<string, unknown> | undefined)
    ?? (rawPlayer.relicStates as Record<string, unknown> | undefined)
    ?? {};
  const normalizedRelicStates = Object.fromEntries(
    Object.entries(rawRelicStates).map(([key, value]) => [key, convertKeys(value, snakeToCamelKey)]),
  ) as RuleSnapshot['player']['relicStates'];
  const map = converted.map ?? { currentNodeId: null, nodes: [] };
  const combat = converted.combat ?? null;
  const reward = converted.reward ?? null;
  const shop = converted.shop ?? null;
  const meta = converted.meta ?? ({} as RuleSnapshot['meta']);
  const derivedRouteState = (() => {
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
  })();

  const activeEventData = converted.activeEvent?.data as Record<string, unknown> | undefined;

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
    activeEvent: converted.activeEvent
      ? {
          ...converted.activeEvent,
          lastChoiceId: (converted.activeEvent.lastChoiceId as string | undefined) ?? (activeEventData?.lastChoiceId as string | undefined) ?? null,
          choiceRole:
            (converted.activeEvent.choiceRole as 'confirm' | 'payoff' | 'pivot' | 'support' | undefined)
            ?? (activeEventData?.choiceRole as 'confirm' | 'payoff' | 'pivot' | 'support' | undefined)
            ?? null,
          outcomeKind:
            (converted.activeEvent.outcomeKind as 'confirm' | 'payoff' | 'pivot' | 'support' | 'neutral' | undefined)
            ?? (activeEventData?.outcomeKind as 'confirm' | 'payoff' | 'pivot' | 'support' | 'neutral' | undefined)
            ?? null,
        }
      : null,
    routeState: derivedRouteState,
    surfaceContext: converted.surfaceContext ?? null,
    roomSession: converted.roomSession ?? null,
    meta: {
      runId: meta.runId ?? null,
      replayLength: meta.replayLength ?? 0,
      generatedAt: meta.generatedAt ?? new Date(0).toISOString(),
      adapter: 'python-wasm',
      runtimeRngState: meta.runtimeRngState ?? 0,
    },
  };
}

function encodeCommand(command: RuleCommand): Record<string, unknown> {
  return convertKeys(command, camelToSnakeKey) as Record<string, unknown>;
}

export class PythonProcessAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;

  private process: ChildProcessWithoutNullStreams | null = null;
  private lineReader: readline.Interface | null = null;
  private pending: PendingRequest[] = [];
  private stderrBuffer = '';
  private snapshot: RuleSnapshot | null = null;

  constructor(private readonly options: PythonProcessAdapterOptions = {}) {}

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.dispose();

    const pythonPath = process.env.PYTHON_BIN || 'python3';
    const pythonSourcePath = path.resolve(process.cwd(), 'python_runtime/src');
    const env = {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${pythonSourcePath}${path.delimiter}${process.env.PYTHONPATH}`
        : pythonSourcePath,
    };

    this.process = spawn(pythonPath, ['-m', 'deckrogue_rules_core.cli'], {
      cwd: process.cwd(),
      env,
      stdio: 'pipe',
    });

    this.process.stderr.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString();
    });
    this.process.on('exit', (code, signal) => {
      const pending = this.pending.splice(0);
      for (const entry of pending) {
        entry.reject(
          new Error(`Python process exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}): ${this.stderrBuffer}`),
        );
      }
    });

    this.lineReader = readline.createInterface({ input: this.process.stdout });
    this.lineReader.on('line', (line) => {
      const pending = this.pending.shift();
      if (!pending) {
        return;
      }

      try {
        const response = JSON.parse(line) as PythonResponse;
        if (!response.ok || !response.snapshot) {
          pending.reject(new Error(response.error || this.stderrBuffer || 'Python runtime returned an invalid response'));
          return;
        }
        const snapshot = normalizePythonSnapshot(response.snapshot);
        this.snapshot = snapshot;
        pending.resolve(snapshot);
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    const contentBundle = buildRuntimeV2ContentBundle();
    const prebuiltNodes =
      this.options.usePrebuiltMapNodes === true
        ? new RunGenerator(options.seed ?? 0).generateMap(options.seed ?? 0, contentBundle.map.floors).map((node) => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            revealed: !!node.revealed,
            next: [...node.next],
          }))
        : undefined;

    this.snapshot = await this.sendRequest({
      op: 'init',
      seed: options.seed ?? 0,
      content_bundle: {
        ...contentBundle,
        map: {
          ...contentBundle.map,
          ...(prebuiltNodes ? { prebuilt_nodes: prebuiltNodes } : {}),
        },
      },
    });
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.process) {
      await this.start();
    }
    return this.sendRequest({
      op: 'dispatch',
      command: encodeCommand(command),
    });
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    if (this.lineReader) {
      this.lineReader.close();
      this.lineReader = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    const pending = this.pending.splice(0);
    for (const entry of pending) {
      entry.reject(new Error('Python process adapter disposed'));
    }
    this.stderrBuffer = '';
    this.snapshot = null;
  }

  private sendRequest(payload: Record<string, unknown>): Promise<RuleSnapshot> {
    if (!this.process) {
      return Promise.reject(new Error('Python process has not been started'));
    }

    return new Promise<RuleSnapshot>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.process!.stdin.write(JSON.stringify(payload) + '\n', 'utf8');
    });
  }
}
