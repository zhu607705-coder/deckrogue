#!/usr/bin/env node

/**
 * @file playwright_real_ui_30_rounds.ts
 * @description 使用 Playwright 运行真实 UI 的 30 回合压力测试。
 *
 * 主要职责:
 * - 启动开发服务器并运行浏览器
 * - 模拟 30 回合游戏操作
 * - 验证 UI 稳定性和性能
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

interface RealUiRoundsReport {
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
const DEFAULT_ROUND_COUNT = 30;
const require = createRequire(import.meta.url);
const TSX_CLI = require.resolve('tsx/cli');

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

const STRESS_REPEAT_SCENARIOS = [
  'ui-smoke-expansion',
  'reward-flow-smoke',
  'shop-flow-smoke',
  'event-flow-smoke',
  'boss-phase-flow-smoke',
];

function parseRoundCount(argv: string[]): number {
  const roundsArg = argv.find((arg) => arg.startsWith('--rounds='));
  if (!roundsArg) return DEFAULT_ROUND_COUNT;

  const parsed = Number.parseInt(roundsArg.slice('--rounds='.length), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid --rounds value: ${roundsArg}`);
  }
  return parsed;
}

function resolveScenarioList(names: string[]): ScenarioConfig[] {
  return names.map((name) => {
    const scenario = SCENARIOS.find((entry) => entry.name === name);
    if (!scenario) {
      throw new Error(`Unknown stress scenario: ${name}`);
    }
    return scenario;
  });
}

function buildRoundPlan(roundCount: number): PlannedRound[] {
  const stressRepeats = resolveScenarioList(STRESS_REPEAT_SCENARIOS);
  const sequence: ScenarioConfig[] = [];

  while (sequence.length < roundCount) {
    sequence.push(...SCENARIOS);
    if (sequence.length >= roundCount) break;
    sequence.push(...stressRepeats);
  }

  const selectedScenarios = sequence.slice(0, roundCount);
  const plan: PlannedRound[] = [];
  selectedScenarios.forEach((scenario, index) => {
    plan.push({
      round: index + 1,
      cycle: Math.floor(index / SCENARIOS.length) + 1,
      scenario,
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
  const args = [TSX_CLI, plannedRound.scenario.script];
  if (plannedRound.scenario.supportsUrlArg) {
    args.push(`--url=${BASE_URL}`);
  }

  try {
    execFileSync(process.execPath, args, {
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

function buildCoverageSummary(roundPlan: PlannedRound[], rounds: RoundResult[]): CoverageEntry[] {
  const expectedRuns = new Map<string, number>();
  const completedRuns = new Map<string, number>();
  const passedRuns = new Map<string, number>();
  const failedRuns = new Map<string, number>();

  for (const plannedRound of roundPlan) {
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
  const requestedRoundCount = parseRoundCount(process.argv.slice(2));
  const reportName = `real-ui-${requestedRoundCount}-rounds`;
  const reportPath = path.join(process.cwd(), 'reports', 'flows', `${reportName}.json`);
  ensureDir(path.dirname(reportPath));

  const startedAt = new Date().toISOString();
  const rounds: RoundResult[] = [];
  const roundPlan = buildRoundPlan(requestedRoundCount);

  let devServer: ReturnType<typeof spawnDevServer> | null = null;
  const ownsDevServer = !checkServer(BASE_URL);
  if (ownsDevServer) {
    devServer = spawnDevServer(BASE_URL);
    await waitForServer(BASE_URL);
  }

  try {
    for (const plannedRound of roundPlan) {
      console.log(
        `[${reportName}] round ${plannedRound.round}/${roundPlan.length} cycle=${plannedRound.cycle} scenario=${plannedRound.scenario.name}`
      );
      const result = runRound(plannedRound);
      rounds.push(result);
      console.log(
        `[${reportName}] round ${plannedRound.round} ${result.status} (${result.durationMs}ms) report=${result.reportGenerated ? 'yes' : 'no'}`
      );
      if (result.status === 'fail') {
        break;
      }
    }
  } finally {
    const coverageSummary = buildCoverageSummary(roundPlan, rounds);
    const report: RealUiRoundsReport = {
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

  if (rounds.length !== requestedRoundCount) {
    throw new Error(`Expected ${requestedRoundCount} completed rounds, got ${rounds.length}`);
  }

  const coverageSummary = buildCoverageSummary(roundPlan, rounds);
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
