#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  checkServer,
  ensureDir,
  getDefaultSmokeUrl,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

interface ScenarioConfig {
  name: string;
  script: string;
  reportPath: string;
  supportsUrlArg?: boolean;
}

interface PlannedRound {
  round: number;
  cycle: number;
  scenario: ScenarioConfig;
}

interface RoundResult {
  round: number;
  cycle: number;
  scenario: string;
  script: string;
  durationMs: number;
  status: 'pass' | 'fail';
  reportPath: string;
  reportGenerated: boolean;
  reportSummary?: Record<string, unknown>;
  error?: string;
}

interface CoverageEntry {
  scenario: string;
  script: string;
  expectedRuns: number;
  completedRuns: number;
  passedRuns: number;
  failedRuns: number;
}

interface RealUi30RoundsReport {
  startedAt: string;
  completedAt: string;
  baseUrl: string;
  totalRounds: number;
  expectedScenarioCount: number;
  passedRounds: number;
  failedRounds: number;
  coverageSummary: CoverageEntry[];
  rounds: RoundResult[];
}

const BASE_URL = getDefaultSmokeUrl();

const SCENARIOS: ScenarioConfig[] = [
  {
    name: 'ui-smoke',
    script: 'scripts/validation/playwright_ui_smoke.ts',
    reportPath: path.join(process.cwd(), 'output', 'playwright', 'ui_smoke_report.json'),
    supportsUrlArg: true,
  },
  {
    name: 'ui-smoke-expansion',
    script: 'scripts/validation/playwright_ui_smoke_expansion.ts',
    reportPath: path.join(process.cwd(), 'output', 'playwright', 'ui_smoke_expansion_report.json'),
    supportsUrlArg: true,
  },
  {
    name: 'runtime-v2-entry-smoke',
    script: 'scripts/validation/playwright_runtime_v2_entry_smoke.ts',
    reportPath: path.join(process.cwd(), 'output', 'playwright', 'runtime_v2_entry', 'report.json'),
    supportsUrlArg: true,
  },
  {
    name: 'runtime-v2-flow-smoke',
    script: 'scripts/validation/playwright_runtime_v2_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'output', 'playwright', 'runtime_v2_flow', 'report.json'),
    supportsUrlArg: true,
  },
  {
    name: 'unified-runtime-v2-smoke',
    script: 'scripts/validation/playwright_unified_runtime_v2_smoke.ts',
    reportPath: path.join(process.cwd(), 'output', 'playwright', 'unified_runtime_v2', 'report.json'),
    supportsUrlArg: true,
  },
  {
    name: 'reward-flow-smoke',
    script: 'scripts/validation/playwright_reward_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'reward-flow-smoke.json'),
  },
  {
    name: 'shop-flow-smoke',
    script: 'scripts/validation/playwright_shop_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'shop-flow-smoke.json'),
  },
  {
    name: 'event-flow-smoke',
    script: 'scripts/validation/playwright_event_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'event-flow-smoke.json'),
  },
  {
    name: 'rest-flow-smoke',
    script: 'scripts/validation/playwright_rest_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'rest-flow-smoke.json'),
  },
  {
    name: 'upgrade-flow-smoke',
    script: 'scripts/validation/playwright_upgrade_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'upgrade-flow-smoke.json'),
  },
  {
    name: 'remove-card-flow-smoke',
    script: 'scripts/validation/playwright_remove_card_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'remove-card-flow-smoke.json'),
  },
  {
    name: 'terminal-flow-smoke',
    script: 'scripts/validation/playwright_terminal_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'terminal-flow-smoke.json'),
  },
  {
    name: 'boss-terminal-flow-smoke',
    script: 'scripts/validation/playwright_boss_terminal_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'boss-terminal-flow-smoke.json'),
  },
  {
    name: 'boss-phase-flow-smoke',
    script: 'scripts/validation/playwright_boss_phase_flow_smoke.ts',
    reportPath: path.join(process.cwd(), 'reports', 'flows', 'boss-phase-flow-smoke.json'),
  },
];

const ANCHOR_SCENARIOS = ['ui-smoke-expansion', 'runtime-v2-flow-smoke'];

function buildRoundPlan(): PlannedRound[] {
  const anchors = ANCHOR_SCENARIOS.map((name) => {
    const scenario = SCENARIOS.find((entry) => entry.name === name);
    if (!scenario) {
      throw new Error(`Unknown anchor scenario: ${name}`);
    }
    return scenario;
  });

  const cycles = [SCENARIOS, SCENARIOS, anchors];
  const plan: PlannedRound[] = [];
  let round = 1;
  cycles.forEach((scenarios, index) => {
    scenarios.forEach((scenario) => {
      plan.push({
        round,
        cycle: index + 1,
        scenario,
      });
      round += 1;
    });
  });
  return plan;
}

function summarizeReportPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'baseUrl' || key === 'startedAt' || key === 'completedAt' || key === 'timestamp' || key === 'screenshotPath') {
      continue;
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      summary[key] = value;
      continue;
    }

    if (typeof value === 'string' && value.length <= 120) {
      summary[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      summary[`${key}Count`] = value.length;
      if (value.length > 0 && value.every((entry) => typeof entry === 'string')) {
        summary[`${key}Sample`] = value.slice(0, 4);
      } else if (value.length > 0 && typeof value[0] === 'object' && value[0] && 'label' in (value[0] as Record<string, unknown>)) {
        summary[`${key}Labels`] = value
          .slice(0, 8)
          .map((entry) => String((entry as Record<string, unknown>).label));
      }
      continue;
    }

    if (value && typeof value === 'object' && key === 'route') {
      const route = value as Record<string, unknown>;
      summary.routeSeed = route.seed;
      summary.routeStepCount = Array.isArray(route.path) ? route.path.length : 0;
    }
  }

  return summary;
}

function readScenarioReport(reportPath: string): { reportGenerated: boolean; reportSummary?: Record<string, unknown> } {
  if (!existsSync(reportPath)) {
    return { reportGenerated: false };
  }

  try {
    const payload = JSON.parse(readFileSync(reportPath, 'utf8')) as unknown;
    return {
      reportGenerated: true,
      reportSummary: summarizeReportPayload(payload),
    };
  } catch (error) {
    return {
      reportGenerated: true,
      reportSummary: {
        parseError: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function runRound(plannedRound: PlannedRound): RoundResult {
  const started = Date.now();
  const args = ['tsx', plannedRound.scenario.script];
  if (plannedRound.scenario.supportsUrlArg) {
    args.push(`--url=${BASE_URL}`);
  }

  try {
    execFileSync('npx', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: BASE_URL,
      },
      maxBuffer: 16 * 1024 * 1024,
    });

    const reportData = readScenarioReport(plannedRound.scenario.reportPath);
    return {
      round: plannedRound.round,
      cycle: plannedRound.cycle,
      scenario: plannedRound.scenario.name,
      script: plannedRound.scenario.script,
      durationMs: Date.now() - started,
      status: 'pass',
      reportPath: plannedRound.scenario.reportPath,
      reportGenerated: reportData.reportGenerated,
      reportSummary: reportData.reportSummary,
    };
  } catch (error) {
    const stdout = error instanceof Error && 'stdout' in error ? String((error as { stdout?: string | Buffer }).stdout || '') : '';
    const stderr = error instanceof Error && 'stderr' in error ? String((error as { stderr?: string | Buffer }).stderr || '') : '';
    const reportData = readScenarioReport(plannedRound.scenario.reportPath);
    return {
      round: plannedRound.round,
      cycle: plannedRound.cycle,
      scenario: plannedRound.scenario.name,
      script: plannedRound.scenario.script,
      durationMs: Date.now() - started,
      status: 'fail',
      reportPath: plannedRound.scenario.reportPath,
      reportGenerated: reportData.reportGenerated,
      reportSummary: reportData.reportSummary,
      error: [stdout, stderr].filter(Boolean).join('\n').slice(0, 6000),
    };
  }
}

function buildCoverageSummary(rounds: RoundResult[]): CoverageEntry[] {
  const expectedRuns = new Map<string, number>();
  const completedRuns = new Map<string, number>();
  const passedRuns = new Map<string, number>();
  const failedRuns = new Map<string, number>();

  for (const plannedRound of buildRoundPlan()) {
    expectedRuns.set(plannedRound.scenario.name, (expectedRuns.get(plannedRound.scenario.name) ?? 0) + 1);
  }
  for (const round of rounds) {
    completedRuns.set(round.scenario, (completedRuns.get(round.scenario) ?? 0) + 1);
    if (round.status === 'pass') {
      passedRuns.set(round.scenario, (passedRuns.get(round.scenario) ?? 0) + 1);
    } else {
      failedRuns.set(round.scenario, (failedRuns.get(round.scenario) ?? 0) + 1);
    }
  }

  return SCENARIOS.map((scenario) => ({
    scenario: scenario.name,
    script: scenario.script,
    expectedRuns: expectedRuns.get(scenario.name) ?? 0,
    completedRuns: completedRuns.get(scenario.name) ?? 0,
    passedRuns: passedRuns.get(scenario.name) ?? 0,
    failedRuns: failedRuns.get(scenario.name) ?? 0,
  }));
}

async function main() {
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'real-ui-30-rounds.json');
  ensureDir(path.dirname(reportPath));

  const startedAt = new Date().toISOString();
  const rounds: RoundResult[] = [];
  const roundPlan = buildRoundPlan();

  let devServer: ReturnType<typeof spawnDevServer> | null = null;
  const ownsDevServer = !checkServer(BASE_URL);
  if (ownsDevServer) {
    devServer = spawnDevServer(BASE_URL);
    await waitForServer(BASE_URL);
  }

  try {
    for (const plannedRound of roundPlan) {
      console.log(
        `[real-ui-30-rounds] round ${plannedRound.round}/${roundPlan.length} cycle=${plannedRound.cycle} scenario=${plannedRound.scenario.name}`
      );
      const result = runRound(plannedRound);
      rounds.push(result);
      console.log(
        `[real-ui-30-rounds] round ${plannedRound.round} ${result.status} (${result.durationMs}ms) report=${result.reportGenerated ? 'yes' : 'no'}`
      );
      if (result.status === 'fail') {
        break;
      }
    }
  } finally {
    const coverageSummary = buildCoverageSummary(rounds);
    const report: RealUi30RoundsReport = {
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalRounds: rounds.length,
      expectedScenarioCount: SCENARIOS.length,
      passedRounds: rounds.filter((round) => round.status === 'pass').length,
      failedRounds: rounds.filter((round) => round.status === 'fail').length,
      coverageSummary,
      rounds,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (devServer && ownsDevServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }

  const failedRound = rounds.find((round) => round.status === 'fail');
  if (failedRound) {
    throw new Error(`UI round ${failedRound.round} failed for scenario ${failedRound.scenario}`);
  }

  if (rounds.length !== 30) {
    throw new Error(`Expected 30 completed rounds, got ${rounds.length}`);
  }

  const coverageSummary = buildCoverageSummary(rounds);
  const incompleteScenario = coverageSummary.find((entry) => entry.completedRuns !== entry.expectedRuns);
  if (incompleteScenario) {
    throw new Error(
      `Coverage incomplete for ${incompleteScenario.scenario}: expected ${incompleteScenario.expectedRuns}, got ${incompleteScenario.completedRuns}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
