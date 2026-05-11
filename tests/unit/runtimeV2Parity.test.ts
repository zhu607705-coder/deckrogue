/**
 * @file runtimeV2Parity.test.ts
 * @description Unit tests for runtime v2 parity between legacy oracle and Python adapters.
 *
 * 主要职责:
 * - 测试旧版 oracle 与 Python 适配器的一致性
 * - 测试路由状态和活跃事件的奇偶校验
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import charactersDataRaw from '@/content/data/characters.json';
import { deriveRouteStateFromDeck } from '@/content/narrative/routeState';
import { getKnownRouteTagsForCharacter } from '@/content/narrative/routeSignals';
import { GameEngine } from '@/core/events/gameEngine';
import {
  createLegacyOracleAdapter,
  projectRuleActiveEventForParity,
  readRuleActiveEventOutcome,
  runResolvedParityScenario,
  runParityScenario,
  type EngineHostStartOptions,
  type RuleCommand,
  type RuleRuntimeAdapter,
  type RuleSnapshot,
} from '@/runtimeV2';
import { PythonProcessAdapter } from '@/runtimeV2/node/pythonProcessAdapter';
import { normalizePythonSnapshot as normalizePythonWasmSnapshot } from '@/runtimeV2/bridge/pythonWasmAdapter';

const charactersData = charactersDataRaw as Array<{
  id: string;
  maxHp: number;
  startingDeck: string[];
}>;

function getCharacterBaseline(characterId: string): { hp: number; startingDeck: string[] } {
  const character = charactersData.find((entry) => entry.id === characterId);
  if (!character) {
    return { hp: 60, startingDeck: [] };
  }
  return {
    hp: character.maxHp,
    startingDeck: [...character.startingDeck],
  };
}

function deriveCharacterRouteState(characterId: string, deck: string[]): RuleSnapshot['routeState'] {
  const knownRouteTags = getKnownRouteTagsForCharacter(characterId);
  if (knownRouteTags.length === 0) {
    return null;
  }
  return deriveRouteStateFromDeck(
    deck.map((cardId) => ({ id: cardId })),
    knownRouteTags,
    null,
  );
}

function createCandidateSnapshot(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'candidate-runtime',
    seed: 11,
    lifecycle: {
      screen: 'CharacterSelect',
      phase: 'character_select',
      pendingNodeResolution: false,
    },
    player: {
      characterId: null,
      hp: 0,
      maxHp: 0,
      gold: 0,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
      relicIds: [],
      potionIds: [],
    },
    map: {
      currentNodeId: null,
      nodes: [],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: 'candidate-run',
      replayLength: 0,
      generatedAt: new Date(0).toISOString(),
      adapter: 'python-wasm',
    },
    ...overrides,
  };
}

class ParityStubAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private snapshot: RuleSnapshot | null = null;

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.snapshot = createCandidateSnapshot({ seed: options.seed ?? 11 });
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.snapshot) {
      this.snapshot = await this.start();
    }

    if (command.type === 'select_character') {
      const selected = getCharacterBaseline(command.characterId);
      const deck = selected.startingDeck;
      this.snapshot = createCandidateSnapshot({
        seed: this.snapshot.seed,
        lifecycle: {
          screen: 'Map',
          phase: 'map',
          pendingNodeResolution: false,
        },
        player: {
          ...this.snapshot.player,
          characterId: command.characterId,
          hp: selected.hp,
          maxHp: selected.hp,
          gold: 99,
          deck,
        },
        routeState: deriveCharacterRouteState(command.characterId, deck),
        map: {
          currentNodeId: null,
          nodes: Array.from({ length: 26 }, (_, idx) => {
            const floor = idx + 1;
            let type: 'Combat' | 'Elite' | 'Event' | 'Shop' | 'Rest' | 'Boss' = 'Combat';
            if (floor === 10 || floor === 18 || floor === 26) {
              type = 'Boss';
            } else if (floor === 9 || floor === 17 || floor === 25) {
              type = 'Rest';
            } else if (floor % 4 === 0) {
              type = 'Elite';
            } else if (floor % 5 === 0) {
              type = 'Event';
            } else if (floor % 6 === 0) {
              type = 'Shop';
            }
            return {
              id: `node_${floor}`,
              type,
              x: 0.5,
              y: idx,
              revealed: floor === 1,
              next: floor === 26 ? [] : [`node_${floor + 1}`],
            };
          }),
        },
        meta: {
          ...this.snapshot.meta,
          replayLength: this.snapshot.meta.replayLength + 1,
        },
      });
    }

    return this.snapshot;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    this.snapshot = null;
  }
}

class FixedSnapshotAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;

  constructor(private readonly snapshot: RuleSnapshot) {}

  async start(): Promise<RuleSnapshot> {
    return structuredClone(this.snapshot);
  }

  async dispatch(): Promise<RuleSnapshot> {
    return structuredClone(this.snapshot);
  }

  getSnapshot(): RuleSnapshot | null {
    return structuredClone(this.snapshot);
  }

  dispose(): void {}
}

type FakePythonProcess = EventEmitter & {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: () => boolean;
};

function createFakePythonProcess(): FakePythonProcess {
  const processHandle = new EventEmitter() as FakePythonProcess;
  processHandle.stdin = new PassThrough();
  processHandle.stdout = new PassThrough();
  processHandle.stderr = new PassThrough();
  processHandle.kill = () => true;
  return processHandle;
}

function readJsonLines(stream: PassThrough, count: number): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve) => {
    const lines: Array<Record<string, unknown>> = [];
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().trim().split('\n')) {
        if (!line) continue;
        lines.push(JSON.parse(line) as Record<string, unknown>);
        if (lines.length === count) {
          resolve(lines);
        }
      }
    });
  });
}

test('PythonProcessAdapter resolves out-of-order responses by request id', async () => {
  const processHandle = createFakePythonProcess();
  const adapter = PythonProcessAdapter.createForTesting(processHandle, { requestTimeoutMs: 1000 });
  const requestsPromise = readJsonLines(processHandle.stdin, 2);
  const firstPromise = adapter.dispatch({ type: 'select_character', characterId: 'informant' });
  const secondPromise = adapter.dispatch({ type: 'select_character', characterId: 'automation' });
  const requests = await requestsPromise;
  const firstId = requests[0].request_id;
  const secondId = requests[1].request_id;

  processHandle.stdout.write(`${JSON.stringify({ request_id: secondId, ok: true, snapshot: { seed: 2 } })}\n`);
  processHandle.stdout.write(`${JSON.stringify({ request_id: firstId, ok: true, snapshot: { seed: 1 } })}\n`);

  const [firstSnapshot, secondSnapshot] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(firstSnapshot.seed, 1);
  assert.equal(secondSnapshot.seed, 2);
  assert.equal(firstSnapshot.meta.adapter, 'python-process');
  assert.equal(secondSnapshot.meta.adapter, 'python-process');
  adapter.dispose();
});

test('PythonProcessAdapter ignores unknown request id responses without corrupting pending queue', async () => {
  const processHandle = createFakePythonProcess();
  const adapter = PythonProcessAdapter.createForTesting(processHandle, { requestTimeoutMs: 1000 });
  const requestsPromise = readJsonLines(processHandle.stdin, 1);
  const snapshotPromise = adapter.dispatch({ type: 'select_character', characterId: 'informant' });
  const [request] = await requestsPromise;

  processHandle.stdout.write(`${JSON.stringify({ request_id: 'unknown', ok: true, snapshot: { seed: 99 } })}\n`);
  processHandle.stdout.write(`${JSON.stringify({ request_id: request.request_id, ok: true, snapshot: { seed: 7 } })}\n`);

  const snapshot = await snapshotPromise;
  assert.equal(snapshot.seed, 7);
  adapter.dispose();
});

test('runParityScenario reports zero diffs for stable matching fields', async () => {
  const result = await runParityScenario({
    legacyAdapter: createLegacyOracleAdapter(),
    candidateAdapter: new ParityStubAdapter(),
    seed: 12345,
    commands: [{ type: 'select_character', characterId: 'informant' }],
  });

  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].diffs.length, 0, JSON.stringify(result.steps[0].diffs));
  assert.equal(result.steps[1].diffs.length, 0, JSON.stringify(result.steps[1].diffs));
});

test('runParityScenario surfaces parity diffs when candidate diverges on stable fields', async () => {
  class DivergentParityStubAdapter extends ParityStubAdapter {
    override async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
      const snapshot = await super.dispatch(command);
      if (command.type === 'select_character') {
        return {
          ...snapshot,
          player: {
            ...snapshot.player,
            intel: 77,
          },
        };
      }
      return snapshot;
    }
  }

  const result = await runParityScenario({
    legacyAdapter: createLegacyOracleAdapter(),
    candidateAdapter: new DivergentParityStubAdapter(),
    seed: 12345,
    commands: [{ type: 'select_character', characterId: 'informant' }],
  });

  const selectCharacterStep = result.steps[1];
  assert.ok(selectCharacterStep.diffs.length > 0);
  assert.equal(selectCharacterStep.diffs[0]?.field, 'player.intel');
});

test('active event outcome projection treats top-level fields as source of truth', () => {
  const eventWithTopLevelOnly: RuleSnapshot['activeEvent'] = {
    id: 'test_event',
    stage: 'choice',
    lastChoiceId: 'top_choice',
    choiceRole: 'pivot',
    outcomeKind: 'pivot',
    data: {},
  };
  const eventWithConflictingMirror: RuleSnapshot['activeEvent'] = {
    id: 'test_event',
    stage: 'choice',
    lastChoiceId: 'top_choice',
    choiceRole: 'confirm',
    outcomeKind: 'confirm',
    data: {
      lastChoiceId: 'stale_choice',
      choiceRole: 'support',
      outcomeKind: 'support',
    },
  };

  assert.deepEqual(readRuleActiveEventOutcome(eventWithTopLevelOnly), {
    lastChoiceId: 'top_choice',
    choiceRole: 'pivot',
    outcomeKind: 'pivot',
  });
  assert.deepEqual(readRuleActiveEventOutcome(eventWithConflictingMirror), {
    lastChoiceId: 'top_choice',
    choiceRole: 'confirm',
    outcomeKind: 'confirm',
  });
});

test('active event parity projection includes free-removal payload only for strict free_remove comparisons', () => {
  const freeRemoveEvent: RuleSnapshot['activeEvent'] = {
    id: 'nameless_martyr_shrine',
    stage: 'free_remove',
    lastChoiceId: 'remove_choice',
    choiceRole: 'payoff',
    outcomeKind: 'payoff',
    data: {
      freeRemovalsRemaining: 2,
    },
  };

  assert.deepEqual(projectRuleActiveEventForParity(freeRemoveEvent), {
    id: 'nameless_martyr_shrine',
    stage: 'free_remove',
    lastChoiceId: 'remove_choice',
    choiceRole: 'payoff',
    outcomeKind: 'payoff',
    freeRemovalsRemaining: null,
  });
  assert.deepEqual(projectRuleActiveEventForParity(freeRemoveEvent, { strictPayload: true }), {
    id: 'nameless_martyr_shrine',
    stage: 'free_remove',
    lastChoiceId: 'remove_choice',
    choiceRole: 'payoff',
    outcomeKind: 'payoff',
    freeRemovalsRemaining: { state: 'valid', value: 2 },
  });
});

test('active event parity projection distinguishes missing and invalid free-removal payload states', () => {
  const projectRemaining = (freeRemovalsRemaining: unknown) => projectRuleActiveEventForParity({
    id: 'nameless_martyr_shrine',
    stage: 'free_remove',
    data: freeRemovalsRemaining === undefined ? {} : { freeRemovalsRemaining },
  }, { strictPayload: true })?.freeRemovalsRemaining;

  assert.deepEqual(projectRemaining(undefined), { state: 'missing', value: null });
  assert.deepEqual(projectRemaining(null), { state: 'invalid', value: null });
  assert.deepEqual(projectRemaining(Number.NaN), { state: 'invalid', value: null });
  assert.deepEqual(projectRemaining(2.8), { state: 'invalid', value: null });
  assert.deepEqual(projectRemaining('2'), { state: 'invalid', value: null });
  assert.deepEqual(projectRemaining(-1), { state: 'invalid', value: null });
  assert.deepEqual(projectRemaining(0), { state: 'valid', value: 0 });
});

test('active event parity projection ignores free-removal payload outside free_remove stage', () => {
  const choiceEvent: RuleSnapshot['activeEvent'] = {
    id: 'nameless_martyr_shrine',
    stage: 'choice',
    data: {
      freeRemovalsRemaining: 3,
    },
  };

  assert.deepEqual(projectRuleActiveEventForParity(choiceEvent, { strictPayload: true }), {
    id: 'nameless_martyr_shrine',
    stage: 'choice',
    lastChoiceId: null,
    choiceRole: null,
    outcomeKind: null,
    freeRemovalsRemaining: null,
  });
});

test('strict stable parity catches free_remove payload drift', async () => {
  const baseSnapshot = createCandidateSnapshot({
    lifecycle: {
      screen: 'RemoveCard',
      phase: 'event',
      pendingNodeResolution: false,
    },
    activeEvent: {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: {
        freeRemovalsRemaining: 2,
      },
    },
  });
  const candidateSnapshot = createCandidateSnapshot({
    ...baseSnapshot,
    activeEvent: {
      ...baseSnapshot.activeEvent!,
      data: {
        freeRemovalsRemaining: 1,
      },
    },
  });

  const result = await runResolvedParityScenario({
    legacyAdapter: new FixedSnapshotAdapter(baseSnapshot),
    candidateAdapter: new FixedSnapshotAdapter(candidateSnapshot),
    seed: 99,
    strictStableFields: true,
    steps: [
      {
        label: 'free_remove_compare',
        legacyCommand: { type: 'cancel_surface' },
        candidateCommand: { type: 'cancel_surface' },
      },
    ],
  });

  assert.deepEqual(
    result.steps[0]?.diffs.map((diff) => diff.field),
    ['activeEvent.freeRemovalsRemaining.value'],
  );
});

test('strict stable parity distinguishes missing free_remove payload from explicit zero', async () => {
  const baseSnapshot = createCandidateSnapshot({
    lifecycle: {
      screen: 'RemoveCard',
      phase: 'event',
      pendingNodeResolution: false,
    },
    activeEvent: {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: {},
    },
  });
  const candidateSnapshot = createCandidateSnapshot({
    ...baseSnapshot,
    activeEvent: {
      ...baseSnapshot.activeEvent!,
      data: {
        freeRemovalsRemaining: 0,
      },
    },
  });

  const result = await runResolvedParityScenario({
    legacyAdapter: new FixedSnapshotAdapter(baseSnapshot),
    candidateAdapter: new FixedSnapshotAdapter(candidateSnapshot),
    seed: 100,
    strictStableFields: true,
    steps: [
      {
        label: 'free_remove_missing_vs_zero',
        legacyCommand: { type: 'cancel_surface' },
        candidateCommand: { type: 'cancel_surface' },
      },
    ],
  });

  assert.deepEqual(
    result.steps[0]?.diffs.map((diff) => diff.field),
    ['activeEvent.freeRemovalsRemaining.state', 'activeEvent.freeRemovalsRemaining.value'],
  );
});

test('strict stable parity distinguishes invalid free_remove payload from explicit zero', async () => {
  const baseSnapshot = createCandidateSnapshot({
    lifecycle: {
      screen: 'RemoveCard',
      phase: 'event',
      pendingNodeResolution: false,
    },
    activeEvent: {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: {
        freeRemovalsRemaining: Number.NaN,
      },
    },
  });
  const candidateSnapshot = createCandidateSnapshot({
    ...baseSnapshot,
    activeEvent: {
      ...baseSnapshot.activeEvent!,
      data: {
        freeRemovalsRemaining: 0,
      },
    },
  });

  const result = await runResolvedParityScenario({
    legacyAdapter: new FixedSnapshotAdapter(baseSnapshot),
    candidateAdapter: new FixedSnapshotAdapter(candidateSnapshot),
    seed: 101,
    strictStableFields: true,
    steps: [
      {
        label: 'free_remove_invalid_vs_zero',
        legacyCommand: { type: 'cancel_surface' },
        candidateCommand: { type: 'cancel_surface' },
      },
    ],
  });

  assert.deepEqual(
    result.steps[0]?.diffs.map((diff) => diff.field),
    ['activeEvent.freeRemovalsRemaining.state', 'activeEvent.freeRemovalsRemaining.value'],
  );
});

async function runFreeRemovePayloadDiff(
  legacyValue: unknown,
  candidateValue: unknown,
  seed: number,
): Promise<string[]> {
  const dataFor = (value: unknown) => (value === undefined ? {} : { freeRemovalsRemaining: value });
  const baseSnapshot = createCandidateSnapshot({
    lifecycle: {
      screen: 'RemoveCard',
      phase: 'event',
      pendingNodeResolution: false,
    },
    activeEvent: {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: dataFor(legacyValue),
    },
  });
  const candidateSnapshot = createCandidateSnapshot({
    ...baseSnapshot,
    activeEvent: {
      ...baseSnapshot.activeEvent!,
      data: dataFor(candidateValue),
    },
  });

  const result = await runResolvedParityScenario({
    legacyAdapter: new FixedSnapshotAdapter(baseSnapshot),
    candidateAdapter: new FixedSnapshotAdapter(candidateSnapshot),
    seed,
    strictStableFields: true,
    steps: [
      {
        label: 'free_remove_payload_compare',
        legacyCommand: { type: 'cancel_surface' },
        candidateCommand: { type: 'cancel_surface' },
      },
    ],
  });

  return result.steps[0]?.diffs.map((diff) => diff.field) ?? [];
}

test('strict stable parity distinguishes missing free_remove payload from invalid payload', async () => {
  assert.deepEqual(
    await runFreeRemovePayloadDiff(undefined, Number.NaN, 102),
    ['activeEvent.freeRemovalsRemaining.state'],
  );
});

test('strict stable parity distinguishes missing free_remove payload from explicit null payload', async () => {
  assert.deepEqual(
    await runFreeRemovePayloadDiff(undefined, null, 106),
    ['activeEvent.freeRemovalsRemaining.state'],
  );
});

test('strict stable parity distinguishes decimal free_remove payload from integer payload', async () => {
  assert.deepEqual(
    await runFreeRemovePayloadDiff(2.8, 2, 103),
    ['activeEvent.freeRemovalsRemaining.state', 'activeEvent.freeRemovalsRemaining.value'],
  );
});

test('strict stable parity distinguishes string free_remove payload from integer payload', async () => {
  assert.deepEqual(
    await runFreeRemovePayloadDiff('2', 2, 104),
    ['activeEvent.freeRemovalsRemaining.state', 'activeEvent.freeRemovalsRemaining.value'],
  );
});

test('strict stable parity distinguishes negative free_remove payload from missing payload', async () => {
  assert.deepEqual(
    await runFreeRemovePayloadDiff(-1, undefined, 105),
    ['activeEvent.freeRemovalsRemaining.state'],
  );
});

test('python wasm snapshot normalization preserves snake_case relic state keys', () => {
  const normalized = normalizePythonWasmSnapshot({
    schema_version: 2,
    engine_version: 'rules-core-draft',
    seed: 1,
    lifecycle: {
      screen: 'RelicUpgrade',
      phase: 'relic_upgrade',
      pending_node_resolution: true,
    },
    player: {
      character_id: 'informant',
      hp: 70,
      max_hp: 70,
      gold: 999,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: ['dead_drop'],
      relic_ids: ['entropy_sanctum_relic'],
      potion_ids: [],
      relic_states: {
        entropy_sanctum_relic: {
          level: 2,
          progress: 0,
          corrupted: false,
        },
      },
    },
    map: { current_node_id: 'floor_1_node_0', nodes: [] },
    combat: null,
    reward: null,
    shop: null,
    active_event: null,
    route_state: null,
    surface_context: null,
    room_session: null,
    meta: {
      run_id: 'wasm-run',
      replay_length: 0,
      generated_at: new Date(0).toISOString(),
      adapter: 'python-wasm',
      runtime_rng_state: 0,
    },
  });

  assert.deepEqual(normalized.player.relicStates, {
    entropy_sanctum_relic: {
      level: 2,
      progress: 0,
      corrupted: false,
    },
  });
});

function withCandidateMeta(snapshot: RuleSnapshot): RuleSnapshot {
  return {
    ...snapshot,
    meta: {
      ...snapshot.meta,
      adapter: 'python-wasm',
    },
  };
}

class RecordedParityAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private cursor = 0;

  constructor(private readonly snapshots: RuleSnapshot[]) {}

  async start(): Promise<RuleSnapshot> {
    this.cursor = 0;
    return this.snapshots[this.cursor];
  }

  async dispatch(): Promise<RuleSnapshot> {
    this.cursor = Math.min(this.cursor + 1, this.snapshots.length - 1);
    return this.snapshots[this.cursor];
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshots[this.cursor] ?? null;
  }

  dispose(): void {
    this.cursor = 0;
  }
}

async function recordLegacySnapshots(seed: number, commands: RuleCommand[]): Promise<RuleSnapshot[]> {
  const adapter = createLegacyOracleAdapter();
  const snapshots: RuleSnapshot[] = [];
  try {
    snapshots.push(withCandidateMeta(await adapter.start({ seed })));
    for (const command of commands) {
      snapshots.push(withCandidateMeta(await adapter.dispatch(command)));
    }
    return snapshots;
  } finally {
    adapter.dispose();
  }
}

function findFirstFloorNode(seed: number, characterId: string, nodeType: 'Combat' | 'Event'): string {
  const engine = new GameEngine(seed, null);
  try {
    engine.selectCharacter(characterId);
    const node = engine.state.map.find((entry) => entry.y === 0 && entry.type === nodeType);
    if (!node) {
      throw new Error(`No ${nodeType} node found on floor 0 for seed ${seed}`);
    }
    return node.id;
  } finally {
    engine.dispose();
  }
}

function findFirstFloorNodeInSnapshot(snapshot: RuleSnapshot, nodeType: 'Combat' | 'Event'): string {
  const node = snapshot.map.nodes.find((entry) => entry.y === 0 && entry.type === nodeType);
  if (!node) {
    throw new Error(`Snapshot has no first-floor ${nodeType} node`);
  }
  return node.id;
}

function findSeedWithFirstFloorNode(characterId: string, nodeType: 'Combat' | 'Event'): { seed: number; nodeId: string } {
  for (let seed = 1; seed <= 200; seed += 1) {
    try {
      return {
        seed,
        nodeId: findFirstFloorNode(seed, characterId, nodeType),
      };
    } catch {
      continue;
    }
  }
  throw new Error(`Unable to find seed with a first-floor ${nodeType} node`);
}

test('runParityScenario supports enter_node -> leave_room sequences on stable fields', async () => {
  const { seed, nodeId } = findSeedWithFirstFloorNode('informant', 'Event');
  const commands: RuleCommand[] = [
    { type: 'select_character', characterId: 'informant' },
    { type: 'enter_node', nodeId },
    { type: 'leave_room' },
  ];
  const recordedSnapshots = await recordLegacySnapshots(seed, commands);

  const result = await runParityScenario({
    legacyAdapter: createLegacyOracleAdapter(),
    candidateAdapter: new RecordedParityAdapter(recordedSnapshots),
    seed,
    commands,
  });

  assert.equal(result.steps.length, 4);
  for (const step of result.steps) {
    assert.equal(step.diffs.length, 0, `${step.label}: ${JSON.stringify(step.diffs)}`);
  }
});

test('runParityScenario supports combat -> reward -> map sequences on stable fields', async () => {
  const { seed, nodeId } = findSeedWithFirstFloorNode('informant', 'Combat');
  const commands: RuleCommand[] = [
    { type: 'select_character', characterId: 'informant' },
    { type: 'enter_node', nodeId },
    { type: 'complete_combat' },
    { type: 'skip_reward' },
  ];
  const recordedSnapshots = await recordLegacySnapshots(seed, commands);

  const result = await runParityScenario({
    legacyAdapter: createLegacyOracleAdapter(),
    candidateAdapter: new RecordedParityAdapter(recordedSnapshots),
    seed,
    commands,
  });

  assert.equal(result.steps.length, 5);
  for (const step of result.steps) {
    assert.equal(step.diffs.length, 0, `${step.label}: ${JSON.stringify(step.diffs)}`);
  }
});

test('runParityScenario can compare legacy oracle against the real Python rules-core for select_character', async () => {
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed: 12345,
      commands: [{ type: 'select_character', characterId: 'informant' }],
    });

    assert.equal(result.steps.length, 2);
    assert.equal(result.steps[0].diffs.length, 0, JSON.stringify(result.steps[0].diffs));
    assert.equal(result.steps[1].diffs.length, 0, JSON.stringify(result.steps[1].diffs));
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario can match real Python parity for enter_node sequences on stable fields', async () => {
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed: 12345,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
      ],
    });

    assert.equal(result.steps.length, 3);
    const enterNodeStep = result.steps[2];
    assert.equal(enterNodeStep.diffs.length, 0, JSON.stringify(enterNodeStep.diffs));
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario can match real Python parity for combat -> reward -> map sequences on stable fields', async () => {
  const { seed } = findSeedWithFirstFloorNode('informant', 'Combat');
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
        {
          label: 'complete_combat',
          legacyCommand: { type: 'complete_combat' },
          candidateCommand: { type: 'complete_combat' },
        },
        {
          label: 'skip_reward',
          legacyCommand: { type: 'skip_reward' },
          candidateCommand: { type: 'skip_reward' },
        },
      ],
    });

    assert.equal(result.steps.length, 5);
    for (const step of result.steps) {
      assert.equal(step.diffs.length, 0, `${step.label}: ${JSON.stringify(step.diffs)}`);
    }
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario matches legacy default take_reward behavior for real Python parity', async () => {
  const { seed } = findSeedWithFirstFloorNode('informant', 'Combat');
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
        {
          label: 'complete_combat',
          legacyCommand: { type: 'complete_combat' },
          candidateCommand: { type: 'complete_combat' },
        },
        {
          label: 'take_reward',
          legacyCommand: { type: 'take_reward' },
          candidateCommand: { type: 'take_reward' },
        },
      ],
    });

    assert.equal(result.steps.length, 5);
    const takeRewardStep = result.steps.at(-1);
    assert.ok(takeRewardStep);
    assert.equal(takeRewardStep.diffs.length, 0, JSON.stringify(takeRewardStep.diffs));
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario matches legacy reward offers for the real Python combat baseline', async () => {
  const { seed } = findSeedWithFirstFloorNode('informant', 'Combat');
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
        {
          label: 'complete_combat',
          legacyCommand: { type: 'complete_combat' },
          candidateCommand: { type: 'complete_combat' },
        },
      ],
    });

    const rewardStep = result.steps.at(-1);
    assert.ok(rewardStep);
    assert.strictEqual(rewardStep.candidateSnapshot.reward?.cardIds?.length, rewardStep.legacySnapshot.reward?.cardIds?.length, 'Reward card count should match');
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario matches stable combat fields for the real Python combat baseline', async () => {
  const { seed } = findSeedWithFirstFloorNode('informant', 'Combat');
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
      ],
    });

    const combatStep = result.steps.at(-1);
    assert.ok(combatStep);
    assert.notEqual(combatStep.legacySnapshot.combat?.playerBlock, undefined);
    assert.notEqual(combatStep.candidateSnapshot.combat?.playerBlock, undefined);
    assert.equal(combatStep.candidateSnapshot.combat?.playerBlock, combatStep.legacySnapshot.combat?.playerBlock);
    assert.notEqual(combatStep.legacySnapshot.combat?.playerEnergy, undefined);
    assert.notEqual(combatStep.candidateSnapshot.combat?.playerEnergy, undefined);
    assert.equal(combatStep.candidateSnapshot.combat?.playerEnergy, combatStep.legacySnapshot.combat?.playerEnergy);
    assert.equal(combatStep.candidateSnapshot.combat?.hand.length, combatStep.legacySnapshot.combat?.hand.length);
    assert.equal(combatStep.candidateSnapshot.combat?.drawPileCount, combatStep.legacySnapshot.combat?.drawPileCount);
    assert.ok(combatStep.legacySnapshot.combat?.enemies);
    assert.ok(combatStep.candidateSnapshot.combat?.enemies);
    const projectEnemyState = (enemies: NonNullable<RuleSnapshot['combat']>['enemies']) =>
      enemies.map((enemy) => ({
        block: enemy.block,
      }));
    assert.deepEqual(projectEnemyState(combatStep.candidateSnapshot.combat.enemies), projectEnemyState(combatStep.legacySnapshot.combat.enemies));
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario keeps combat reward parity stable when native map selection would diverge', async () => {
  const adapter = new PythonProcessAdapter({ usePrebuiltMapNodes: true });
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed: 3,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
        {
          label: 'complete_combat',
          legacyCommand: { type: 'complete_combat' },
          candidateCommand: { type: 'complete_combat' },
        },
        {
          label: 'skip_reward',
          legacyCommand: { type: 'skip_reward' },
          candidateCommand: { type: 'skip_reward' },
        },
      ],
    });

    for (const step of result.steps) {
      assert.equal(step.diffs.length, 0, `${step.label}: ${JSON.stringify(step.diffs)}`);
    }
  } finally {
    adapter.dispose();
  }
});

test('runResolvedParityScenario matches legacy deck content after default reward pickup for the real Python baseline', async () => {
  const { seed } = findSeedWithFirstFloorNode('informant', 'Combat');
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed,
      steps: [
        {
          label: 'select_character',
          legacyCommand: { type: 'select_character', characterId: 'informant' },
          candidateCommand: { type: 'select_character', characterId: 'informant' },
        },
        {
          label: 'enter_node',
          legacyCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
          candidateCommand: (snapshot) => ({ type: 'enter_node', nodeId: findFirstFloorNodeInSnapshot(snapshot, 'Combat') }),
        },
        {
          label: 'complete_combat',
          legacyCommand: { type: 'complete_combat' },
          candidateCommand: { type: 'complete_combat' },
        },
        {
          label: 'take_reward',
          legacyCommand: { type: 'take_reward' },
          candidateCommand: { type: 'take_reward' },
        },
      ],
    });

    const finalStep = result.steps.at(-1);
    assert.ok(finalStep);
    assert.strictEqual(finalStep.candidateSnapshot.player.deck.length, finalStep.legacySnapshot.player.deck.length, 'Deck count should match after take_reward');
  } finally {
    adapter.dispose();
  }
});

test('runParityScenario validates Python map generation has proper structure for native Python after select_character', async () => {
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed: 12345,
      commands: [{ type: 'select_character', characterId: 'informant' }],
    });

    const selectCharacterStep = result.steps.at(-1);
    assert.ok(selectCharacterStep);
    const nodes = selectCharacterStep.candidateSnapshot.map.nodes;
    assert.ok(nodes.length > 0, 'Map should have nodes');
    const bossNodes = nodes.filter(n => n.type === 'Boss');
    assert.ok(bossNodes.length >= 1, 'Should have at least 1 boss floor');
    const restNodes = nodes.filter(n => n.type === 'Rest');
    assert.ok(restNodes.length >= 1, 'Should have at least 1 rest floor');
  } finally {
    adapter.dispose();
  }
});

test('runParityScenario validates Python map generation has proper structure for bridge-backed Python after select_character', async () => {
  const adapter = new PythonProcessAdapter({ usePrebuiltMapNodes: true });
  try {
    const result = await runParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed: 12345,
      commands: [{ type: 'select_character', characterId: 'informant' }],
    });

    const selectCharacterStep = result.steps.at(-1);
    assert.ok(selectCharacterStep);
    const nodes = selectCharacterStep.candidateSnapshot.map.nodes;
    assert.ok(nodes.length > 0, 'Map should have nodes');
    const bossNodes = nodes.filter(n => n.type === 'Boss');
    assert.ok(bossNodes.length >= 1, 'Should have at least 1 boss floor');
  } finally {
    adapter.dispose();
  }
});

test('runParityScenario validates map has multiple chapters for native Python map generation on seed 1', async () => {
  const adapter = new PythonProcessAdapter({ usePrebuiltMapNodes: false });
  try {
    const result = await runParityScenario({
      legacyAdapter: createLegacyOracleAdapter(),
      candidateAdapter: adapter,
      seed: 1,
      commands: [{ type: 'select_character', characterId: 'informant' }],
    });

    const selectCharacterStep = result.steps.at(-1);
    assert.ok(selectCharacterStep);
    const nodes = selectCharacterStep.candidateSnapshot.map.nodes;
    assert.ok(nodes.length > 0, 'Map should have nodes');
    const bossNodes = nodes.filter(n => n.type === 'Boss');
    assert.ok(bossNodes.length >= 1, 'Should have at least 1 boss floor');
  } finally {
    adapter.dispose();
  }
});
