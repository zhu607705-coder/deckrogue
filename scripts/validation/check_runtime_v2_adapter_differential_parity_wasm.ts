#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

import {
  createLegacyOracleAdapter,
  runResolvedParityScenario,
  summarizeParityReportEntries,
  type EngineHostStartOptions,
  type ParityReportEntry,
  type RuleCommandSemanticCode,
  type RuleCommand,
  type RuleRuntimeAdapter,
  type RuleSnapshot,
} from '@/runtimeV2';
import { buildRuntimeV2AdapterParityScenarioCatalog } from './runtime_v2_adapter_parity_cases';
import {
  cloneResolvedSteps,
  classifyNegativeParity,
  collectStableDiffFields,
  collectStableDiffSamples,
} from './runtime_v2_adapter_parity_utils';

function parseArgs() {
  const options = {
    url: 'http://127.0.0.1:3000',
  };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1]!;
    }
  }
  return options;
}

function appendQuery(url: string, query: string) {
  const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${normalized}/${query.startsWith('?') ? query : `?${query}`}`;
}

class BrowserPythonWasmAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;

  private browser: Browser | null = null;
  private page: Page | null = null;
  private snapshot: RuleSnapshot | null = null;

  constructor(private readonly baseUrl: string) {}

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    await this.dispose();
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    const url = appendQuery(
      this.baseUrl,
      `runtimeV2=1&adapter=python-wasm&renderer=dom&seed=${options.seed ?? 0}`,
    );
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.page.waitForFunction(
      () => typeof window !== 'undefined' && !!window.__deckrogueRuntimeV2,
      undefined,
      { timeout: 60_000 },
    );
    await this.page.evaluate(async ({ seed }) => {
      if (!window.__deckrogueRuntimeV2?.startRun) {
        throw new Error('runtime-v2 debug bridge does not expose startRun');
      }
      await window.__deckrogueRuntimeV2.startRun(seed);
    }, { seed: options.seed ?? 0 });
    await this.page.locator('[data-screen="CharacterSelect"]').waitFor({ timeout: 60_000 });
    this.snapshot = await this.getSnapshotFromPage();
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.page) {
      await this.start();
    }
    if (!this.page) {
      throw new Error('Browser PythonWasmAdapter failed to initialize page');
    }
    const previousSnapshot = JSON.stringify(this.snapshot);
    try {
      await this.page.evaluate(
        async ({ nextCommand }) => {
          if (!window.__deckrogueRuntimeV2) {
            throw new Error('runtime-v2 debug bridge is unavailable');
          }
          await window.__deckrogueRuntimeV2.dispatch(nextCommand as RuleCommand, { recordReplay: false });
        },
        { nextCommand: command },
      );
    } catch (error) {
      this.snapshot = await this.getLiveSnapshot().catch(() => this.snapshot);
      throw error;
    }
    await this.page.waitForFunction(
      ({ beforeSnapshot }) => {
        const nextSnapshot = window.__deckrogueRuntimeV2?.getSnapshot();
        return JSON.stringify(nextSnapshot) !== beforeSnapshot;
      },
      { beforeSnapshot: previousSnapshot },
      { timeout: 10_000 },
    ).catch(() => undefined);
    this.snapshot = await this.getSnapshotFromPage();
    return this.snapshot;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  async getLiveSnapshot(): Promise<RuleSnapshot | null> {
    if (!this.page) {
      return null;
    }
    return this.getSnapshotFromPage();
  }

  async dispose(): Promise<void> {
    this.snapshot = null;
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private async getSnapshotFromPage(): Promise<RuleSnapshot> {
    if (!this.page) {
      throw new Error('Browser PythonWasmAdapter has no page');
    }
    await this.page.waitForFunction(
      () => typeof window !== 'undefined' && !!window.__deckrogueRuntimeV2?.getSnapshot(),
      undefined,
      { timeout: 30_000 },
    );
    const snapshot = await this.page.evaluate(() => {
      const nextSnapshot = window.__deckrogueRuntimeV2?.getSnapshot();
      if (!nextSnapshot) {
        throw new Error('runtime-v2 debug bridge did not return a snapshot');
      }
      return nextSnapshot;
    });
    return snapshot;
  }
}

async function runScenario(
  baseUrl: string,
  scenario: string,
  seed: number,
  steps: Parameters<typeof runResolvedParityScenario>[0]['steps'],
): Promise<ParityReportEntry> {
  const legacyAdapter = createLegacyOracleAdapter();
  const candidateAdapter = new BrowserPythonWasmAdapter(baseUrl);
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
    await candidateAdapter.dispose();
  }
}

async function runSyntheticScenario(
  baseUrl: string,
  scenario: string,
  seed: number,
  label: string,
  snapshot: RuleSnapshot,
  followupSteps: Parameters<typeof runResolvedParityScenario>[0]['steps'],
): Promise<ParityReportEntry> {
  return runScenario(baseUrl, scenario, seed, [
    {
      label: `${label}_load`,
      legacyCommand: { type: 'load_snapshot', snapshot: structuredClone(snapshot) },
      candidateCommand: { type: 'load_snapshot', snapshot: structuredClone(snapshot) },
    },
    ...followupSteps,
  ]);
}

async function runNegativeParity(
  baseUrl: string,
  scenario: string,
  seed: number,
  expectedSemanticCode: RuleCommandSemanticCode,
  bootSteps: Parameters<typeof runResolvedParityScenario>[0]['steps'],
  invalidLegacyCommand: (snapshot: RuleSnapshot) => RuleCommand,
  invalidCandidateCommand: (snapshot: RuleSnapshot) => RuleCommand,
): Promise<ParityReportEntry> {
  const legacyAdapter = createLegacyOracleAdapter();
  const candidateAdapter = new BrowserPythonWasmAdapter(baseUrl);
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
      await legacyAdapter.dispatch(invalidLegacyCommand(legacySnapshot));
    } catch (error) {
      legacyError = error;
    }

    try {
      await candidateAdapter.dispatch(invalidCandidateCommand(candidateSnapshot));
    } catch (error) {
      candidateError = error;
    }

    const legacyAfter = legacyAdapter.getSnapshot();
    let liveSnapshotObservedAfterError = false;
    let candidateAfter: RuleSnapshot | null = null;
    try {
      candidateAfter = await candidateAdapter.getLiveSnapshot();
      liveSnapshotObservedAfterError = candidateAfter !== null;
    } catch {
      candidateAfter = candidateAdapter.getSnapshot();
    }
    const negativeClassification = classifyNegativeParity({
      legacyError,
      candidateError,
      legacyBefore,
      candidateBefore,
      legacyAfter,
      candidateAfter,
    });
    negativeClassification.errorClassification.liveSnapshotObservedAfterError = liveSnapshotObservedAfterError;
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
      && negativeClassification.errorClassification.postErrorSnapshotStable
      && negativeClassification.errorClassification.liveSnapshotObservedAfterError;

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
    await candidateAdapter.dispose();
  }
}

async function main() {
  const { url } = parseArgs();
  const entries: ParityReportEntry[] = [];
  for (const scenario of buildRuntimeV2AdapterParityScenarioCatalog()) {
    if (scenario.kind === 'synthetic') {
      entries.push(await runSyntheticScenario(
        url,
        scenario.scenario,
        scenario.seed,
        scenario.label,
        scenario.snapshot,
        scenario.followupSteps,
      ));
      continue;
    }

    entries.push(await runNegativeParity(
      url,
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
    adapterLane: 'python-wasm-browser',
    totalCases: entries.length,
    passCount,
    pass: passCount === entries.length,
    entries,
    summaries,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'runtime_v2', 'adapter-differential-parity-wasm.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_runtime_v2_adapter_differential_parity_wasm] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_runtime_v2_adapter_differential_parity_wasm] passCount: ${passCount}/${entries.length}`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

void main();
