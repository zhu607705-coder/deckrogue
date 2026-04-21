#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  createLegacyOracleAdapter,
  runResolvedParityScenario,
  summarizeParityReportEntries,
  type ParityReportEntry,
  type RuleCommandSemanticCode,
  type RuleCommand,
  type RuleSnapshot,
} from '@/runtimeV2';
import { PythonProcessAdapter } from '@/runtimeV2/node/pythonProcessAdapter';
import { buildRuntimeV2AdapterParityScenarioCatalog } from './runtime_v2_adapter_parity_cases';
import {
  cloneResolvedSteps,
  classifyNegativeParity,
  collectStableDiffFields,
  collectStableDiffSamples,
} from './runtime_v2_adapter_parity_utils';

async function runScenario(
  scenario: string,
  seed: number,
  steps: Parameters<typeof runResolvedParityScenario>[0]['steps'],
): Promise<ParityReportEntry> {
  const legacyAdapter = createLegacyOracleAdapter();
  const candidateAdapter = new PythonProcessAdapter();
  try {
    const result = await runResolvedParityScenario({
      legacyAdapter,
      candidateAdapter,
      seed,
      steps: cloneResolvedSteps(steps),
      strictStableFields: true,
    });
    const stableDiffCount = result.steps.reduce((total, step) => total + step.diffs.length, 0);
    const stableDiffFields = collectStableDiffFields(result);
    const stableDiffSamples = collectStableDiffSamples(result);
    return {
      scenario,
      seed,
      passed: stableDiffCount === 0,
      stableDiffCount,
      stableDiffFields,
      stableDiffSamples,
    };
  } finally {
    legacyAdapter.dispose();
    candidateAdapter.dispose();
  }
}

async function runSyntheticScenario(
  scenario: string,
  seed: number,
  label: string,
  snapshot: RuleSnapshot,
  followupSteps: Parameters<typeof runResolvedParityScenario>[0]['steps'],
): Promise<ParityReportEntry> {
  return runScenario(scenario, seed, [
    {
      label: `${label}_load`,
      legacyCommand: { type: 'load_snapshot', snapshot: structuredClone(snapshot) },
      candidateCommand: { type: 'load_snapshot', snapshot: structuredClone(snapshot) },
    },
    ...followupSteps,
  ]);
}

async function runNegativeParity(
  scenario: string,
  seed: number,
  expectedSemanticCode: RuleCommandSemanticCode,
  bootSteps: Parameters<typeof runResolvedParityScenario>[0]['steps'],
  invalidLegacyCommand: (snapshot: RuleSnapshot) => RuleCommand,
  invalidCandidateCommand: (snapshot: RuleSnapshot) => RuleCommand,
): Promise<ParityReportEntry> {
  const legacyAdapter = createLegacyOracleAdapter();
  const candidateAdapter = new PythonProcessAdapter();
  try {
    const prepared = await runResolvedParityScenario({
      legacyAdapter,
      candidateAdapter,
      seed,
      steps: cloneResolvedSteps(bootSteps),
      strictStableFields: true,
    });
    const legacySnapshot = prepared.steps.at(-1)?.legacySnapshot;
    const candidateSnapshot = prepared.steps.at(-1)?.candidateSnapshot;
    if (!legacySnapshot || !candidateSnapshot) {
      throw new Error(`Missing prepared snapshots for negative parity scenario: ${scenario}`);
    }

    let legacyError: unknown = null;
    let candidateError: unknown = null;
    const legacyBefore = structuredClone(legacySnapshot);
    const candidateBefore = structuredClone(candidateSnapshot);

    try {
      await legacyAdapter.dispatch(invalidLegacyCommand(legacySnapshot) as any);
    } catch (error) {
      legacyError = error;
    }

    try {
      await candidateAdapter.dispatch(invalidCandidateCommand(candidateSnapshot) as any);
    } catch (error) {
      candidateError = error;
    }

    const legacyAfter = legacyAdapter.getSnapshot();
    const candidateAfter = candidateAdapter.getSnapshot();
    const negativeClassification = classifyNegativeParity({
      legacyError,
      candidateError,
      legacyBefore,
      candidateBefore,
      legacyAfter,
      candidateAfter,
    });
    const passed =
      legacyError instanceof Error
      && candidateError instanceof Error
      && negativeClassification.legacyMessage.length > 0
      && negativeClassification.candidateMessage.length > 0
      && negativeClassification.errorClassification.legacySemanticCode === expectedSemanticCode
      && negativeClassification.errorClassification.candidateSemanticCode === expectedSemanticCode
      && negativeClassification.errorClassification.legacySemanticCode !== 'unknown'
      && negativeClassification.errorClassification.candidateSemanticCode !== 'unknown'
      && !negativeClassification.errorClassification.legacyHasTimeout
      && !negativeClassification.errorClassification.candidateHasTimeout
      && negativeClassification.errorClassification.postErrorSnapshotStable;

    return {
      scenario,
      seed,
      passed,
      stableDiffCount: passed ? 0 : 1,
      stableDiffFields: passed ? [] : ['negative.error-or-rollback'],
      errorMessages: {
        legacy: negativeClassification.legacyMessage,
        candidate: negativeClassification.candidateMessage,
      },
      errorClassification: negativeClassification.errorClassification,
    };
  } finally {
    legacyAdapter.dispose();
    candidateAdapter.dispose();
  }
}

async function main() {
  const entries: ParityReportEntry[] = [];
  for (const scenario of buildRuntimeV2AdapterParityScenarioCatalog()) {
    if (scenario.kind === 'synthetic') {
      entries.push(await runSyntheticScenario(
        scenario.scenario,
        scenario.seed,
        scenario.label,
        scenario.snapshot,
        scenario.followupSteps,
      ));
      continue;
    }

    entries.push(await runNegativeParity(
      scenario.scenario,
      scenario.seed,
      scenario.expectedSemanticCode,
      scenario.bootSteps,
      scenario.invalidLegacyCommand,
      scenario.invalidCandidateCommand,
    ));
  }

  const summaries = summarizeParityReportEntries(entries);
  const passCount = entries.filter((entry) => entry.passed).length;
  const report = {
    generatedAt: new Date().toISOString(),
    adapterLane: 'python-process',
    totalCases: entries.length,
    passCount,
    pass: passCount === entries.length,
    entries,
    summaries,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'runtime_v2', 'adapter-differential-parity.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_runtime_v2_adapter_differential_parity] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_runtime_v2_adapter_differential_parity] passCount: ${passCount}/${entries.length}`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

void main();
