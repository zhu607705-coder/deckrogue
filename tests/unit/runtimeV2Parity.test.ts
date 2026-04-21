import test from 'node:test';
import assert from 'node:assert/strict';

import charactersDataRaw from '@/content/data/characters.json';
import { GameEngine } from '@/core/events/gameEngine';
import {
  createLegacyOracleAdapter,
  runResolvedParityScenario,
  runParityScenario,
  type EngineHostStartOptions,
  type RuleCommand,
  type RuleRuntimeAdapter,
  type RuleSnapshot,
} from '@/runtimeV2';
import { PythonProcessAdapter } from '@/runtimeV2/node/pythonProcessAdapter';

const charactersData = charactersDataRaw as Array<{
  id: string;
  maxHp: number;
  startingDeck: string[];
}>;

function getCharacterBaseline(characterId: string): { hp: number; deckSize: number } {
  const character = charactersData.find((entry) => entry.id === characterId);
  if (!character) {
    return { hp: 60, deckSize: 10 };
  }
  return {
    hp: character.maxHp,
    deckSize: character.startingDeck.length,
  };
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
          deck: Array.from({ length: selected.deckSize }, (_, idx) => `card_${idx}`),
        },
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

test('runParityScenario reports zero diffs for stable matching fields', async () => {
  const result = await runParityScenario({
    legacyAdapter: createLegacyOracleAdapter(),
    candidateAdapter: new ParityStubAdapter(),
    seed: 12345,
    commands: [{ type: 'select_character', characterId: 'informant' }],
  });

  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].diffs.length, 0);
  assert.equal(result.steps[1].diffs.length, 0);
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
            gold: 77,
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
  assert.equal(selectCharacterStep.diffs[0]?.field, 'player.gold');
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
    assert.equal(step.diffs.length, 0);
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
    assert.equal(step.diffs.length, 0);
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
    assert.equal(result.steps[0].diffs.length, 0);
    assert.equal(result.steps[1].diffs.length, 0);
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
    assert.equal(enterNodeStep.diffs.length, 0);
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
    assert.equal(takeRewardStep.diffs.length, 0);
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
    assert.deepEqual(rewardStep.candidateSnapshot.reward?.cardIds, rewardStep.legacySnapshot.reward?.cardIds);
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
    assert.deepEqual(combatStep.candidateSnapshot.combat?.hand, combatStep.legacySnapshot.combat?.hand);
    assert.equal(combatStep.candidateSnapshot.combat?.drawPileCount, combatStep.legacySnapshot.combat?.drawPileCount);
    assert.ok(combatStep.legacySnapshot.combat?.enemies);
    assert.ok(combatStep.candidateSnapshot.combat?.enemies);
    const projectEnemyState = (enemies: NonNullable<RuleSnapshot['combat']>['enemies']) =>
      enemies.map((enemy) => ({
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
      }));
    assert.deepEqual(projectEnemyState(combatStep.candidateSnapshot.combat.enemies), projectEnemyState(combatStep.legacySnapshot.combat.enemies));
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
    assert.deepEqual(finalStep.candidateSnapshot.player.deck, finalStep.legacySnapshot.player.deck);
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
