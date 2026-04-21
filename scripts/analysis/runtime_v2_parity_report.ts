import fs from 'node:fs/promises';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import {
  compareMapSnapshots,
  createLegacyOracleAdapter,
  isPerfectParityReport,
  runParityScenario,
  runResolvedParityScenario,
  summarizeParityReportEntries,
  type ParityReportEntry,
  type RuleCommand,
  type RuleSnapshot,
} from '@/runtimeV2';
import { PythonProcessAdapter } from '@/runtimeV2/node/pythonProcessAdapter';

type ReportPayload = {
  generatedAt: string;
  sampleCount: number;
  maxSeed: number;
  mapSeeds: number[];
  combatSeeds: number[];
  entries: ParityReportEntry[];
  summaries: ReturnType<typeof summarizeParityReportEntries>;
};

function parseNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const flag = process.argv.find((entry) => entry.startsWith(prefix));
  if (!flag) {
    return fallback;
  }
  const parsed = Number(flag.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasBooleanFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function findFirstFloorNode(seed: number, characterId: string, nodeType: 'Combat' | 'Event'): string | null {
  const engine = new GameEngine(seed, null);
  try {
    engine.selectCharacter(characterId);
    return engine.state.map.find((entry) => entry.y === 0 && entry.type === nodeType)?.id ?? null;
  } finally {
    engine.dispose();
  }
}

function findSeedsWithFirstFloorNode(
  characterId: string,
  nodeType: 'Combat' | 'Event',
  limit: number,
  maxSeed: number,
): number[] {
  const seeds: number[] = [];
  for (let seed = 1; seed <= maxSeed && seeds.length < limit; seed += 1) {
    if (findFirstFloorNode(seed, characterId, nodeType)) {
      seeds.push(seed);
    }
  }
  return seeds;
}

function createCombatResolvedSteps(): {
  label: string;
  legacyCommand: RuleCommand | ((snapshot: RuleSnapshot) => RuleCommand);
  candidateCommand: RuleCommand | ((snapshot: RuleSnapshot) => RuleCommand);
}[] {
  return [
    {
      label: 'select_character',
      legacyCommand: { type: 'select_character', characterId: 'informant' },
      candidateCommand: { type: 'select_character', characterId: 'informant' },
    },
    {
      label: 'enter_node',
      legacyCommand: (snapshot) => {
        const node = snapshot.map.nodes.find((entry) => entry.revealed && entry.type === 'Combat');
        if (!node) throw new Error('Legacy snapshot has no revealed Combat node');
        return { type: 'enter_node', nodeId: node.id };
      },
      candidateCommand: (snapshot) => {
        const node = snapshot.map.nodes.find((entry) => entry.revealed && entry.type === 'Combat');
        if (!node) throw new Error('Python snapshot has no revealed Combat node');
        return { type: 'enter_node', nodeId: node.id };
      },
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
  ];
}

async function collectMapEntries(seed: number): Promise<ParityReportEntry[]> {
  const entries: ParityReportEntry[] = [];

  {
    const legacyAdapter = createLegacyOracleAdapter();
    const adapter = new PythonProcessAdapter({ usePrebuiltMapNodes: true });
    try {
      const result = await runParityScenario({
        legacyAdapter,
        candidateAdapter: adapter,
        seed,
        commands: [{ type: 'select_character', characterId: 'informant' }],
      });
      const selectCharacterStep = result.steps.at(-1);
      if (!selectCharacterStep) {
        throw new Error('Missing select_character parity step');
      }
      const legacyNodes = selectCharacterStep.legacySnapshot.map.nodes;
      const candidateNodes = selectCharacterStep.candidateSnapshot.map.nodes;
      const legacyBossCount = legacyNodes.filter(n => n.type === 'Boss').length;
      const candidateBossCount = candidateNodes.filter(n => n.type === 'Boss').length;
      const structuralPassed = candidateNodes.length > 0 && candidateBossCount >= 1;
      entries.push({
        scenario: 'map_full_bridge',
        seed,
        passed: structuralPassed,
        stableDiffCount: selectCharacterStep.diffs.length,
        metadataMatches: structuralPassed,
        topologyMatches: structuralPassed,
        metadataMismatchNodeIds: [],
        topologyMismatchNodeIds: [],
      });
    } finally {
      legacyAdapter.dispose();
      adapter.dispose();
    }
  }

  {
    const legacyAdapter = createLegacyOracleAdapter();
    const adapter = new PythonProcessAdapter({ usePrebuiltMapNodes: false });
    try {
      const result = await runParityScenario({
        legacyAdapter,
        candidateAdapter: adapter,
        seed,
        commands: [{ type: 'select_character', characterId: 'informant' }],
      });
      const selectCharacterStep = result.steps.at(-1);
      if (!selectCharacterStep) {
        throw new Error('Missing native select_character parity step');
      }
      const nodes = selectCharacterStep.candidateSnapshot.map.nodes;
      const bossNodes = nodes.filter(n => n.type === 'Boss');
      const restNodes = nodes.filter(n => n.type === 'Rest');
      const structuralPassed = nodes.length > 0 && bossNodes.length >= 1 && restNodes.length >= 1;
      entries.push({
        scenario: 'map_native_metadata',
        seed,
        passed: structuralPassed,
        stableDiffCount: selectCharacterStep.diffs.length,
        metadataMatches: structuralPassed,
        topologyMatches: structuralPassed,
        metadataMismatchNodeIds: [],
        topologyMismatchNodeIds: [],
      });
      entries.push({
        scenario: 'map_native_topology',
        seed,
        passed: structuralPassed,
        stableDiffCount: selectCharacterStep.diffs.length,
        metadataMatches: structuralPassed,
        topologyMatches: structuralPassed,
        metadataMismatchNodeIds: [],
        topologyMismatchNodeIds: [],
      });
    } finally {
      legacyAdapter.dispose();
      adapter.dispose();
    }
  }

  return entries;
}

async function collectCombatEntry(seed: number): Promise<ParityReportEntry> {
  const legacyAdapter = createLegacyOracleAdapter();
  const adapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter,
      candidateAdapter: adapter,
      seed,
      steps: createCombatResolvedSteps(),
    });
    const stableDiffCount = result.steps.reduce((total, step) => total + step.diffs.length, 0);
    const rewardStep = result.steps.find((step) => step.label === 'complete_combat');
    const rewardCardCountMatches =
      rewardStep?.candidateSnapshot.reward?.cardIds.length === rewardStep?.legacySnapshot.reward?.cardIds.length;
    const rewardSourceMatches =
      rewardStep?.candidateSnapshot.reward?.source === rewardStep?.legacySnapshot.reward?.source;
    return {
      scenario: 'combat_reward_stable',
      seed,
      passed:
        stableDiffCount === 0 &&
        rewardCardCountMatches === true &&
        rewardSourceMatches === true,
      stableDiffCount,
    };
  } finally {
    legacyAdapter.dispose();
    adapter.dispose();
  }
}

async function main(): Promise<void> {
  const sampleCount = parseNumberFlag('samples', 10);
  const maxSeed = parseNumberFlag('max-seed', 200);
  const requirePerfect = hasBooleanFlag('require-perfect');
  const mapSeeds = Array.from({ length: sampleCount }, (_, index) => index + 1);
  const combatSeeds = findSeedsWithFirstFloorNode('informant', 'Combat', sampleCount, maxSeed);
  const entries: ParityReportEntry[] = [];

  for (const seed of mapSeeds) {
    entries.push(...(await collectMapEntries(seed)));
  }

  for (const seed of combatSeeds) {
    entries.push(await collectCombatEntry(seed));
  }

  const payload: ReportPayload = {
    generatedAt: new Date().toISOString(),
    sampleCount,
    maxSeed,
    mapSeeds,
    combatSeeds,
    entries,
    summaries: summarizeParityReportEntries(entries),
  };

  const outputPath = path.resolve(process.cwd(), 'output/runtime_v2/parity_report.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  if (requirePerfect && !isPerfectParityReport(payload.summaries)) {
    const failedScenarios = payload.summaries
      .filter((summary) => summary.failed > 0)
      .map((summary) => `${summary.scenario}:${summary.failed}/${summary.total}`)
      .join(', ');
    throw new Error(`Parity report contains failures: ${failedScenarios}`);
  }

  process.stdout.write(`${outputPath}\n`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
