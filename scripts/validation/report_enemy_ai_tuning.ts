#!/usr/bin/env node

/**
 * @file report_enemy_ai_tuning.ts
 * @description 运行敌人 AI 调整模拟并生成调优建议报告。
 *
 * 主要职责:
 * - 执行多角色多轮次模拟
 * - 收集生存率和战斗轮次数据
 * - 生成平衡调优建议
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

type CharacterSimulationSummary = {
  characterId: string;
  runs: number;
  survivalRateFirst3: number;
  avgCombatTurns: number;
  avgCombatsPerRun: number;
};

type EconomyRegressionReport = {
  summaries: CharacterSimulationSummary[];
  diagnostics?: {
    illegalRunTransitions?: unknown[];
    unknownActionTypes?: unknown[];
  };
};

type TuningRecommendation = {
  characterId: string;
  status: 'within_target' | 'below_target' | 'above_target';
  survivalRateFirst3: number;
  note: string;
};

const REPORT_DIR = resolve('reports/ai');
const REPORT_PATH = resolve(REPORT_DIR, 'enemy-ai-tuning.json');
const ECONOMY_REPORT_DIR = resolve(REPORT_DIR, '.enemy-ai-tuning-source');
const ECONOMY_REPORT_PATH = resolve(ECONOMY_REPORT_DIR, 'economy_regression.json');
const TARGET_MIN = 0.55;
const TARGET_MAX = 0.92;
const require = createRequire(import.meta.url);
const TSX_CLI = require.resolve('tsx/cli');

function parseRuns(): number {
  const flag = process.argv.find((arg) => arg.startsWith('--runs='));
  const raw = flag?.split('=')[1];
  const value = raw ? Number(raw) : 3;
  return Math.max(1, Math.min(50, Number.isFinite(value) ? value : 3));
}

function runSimulation(runs: number): void {
  execFileSync(process.execPath, [
    TSX_CLI,
    'scripts/analysis/simulate_early_balance.ts',
    `--runs=${runs}`,
    `--output-dir=${ECONOMY_REPORT_DIR}`,
  ], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
}

function buildRecommendation(summary: CharacterSimulationSummary): TuningRecommendation {
  const rate = summary.survivalRateFirst3;
  if (rate < TARGET_MIN) {
    return {
      characterId: summary.characterId,
      status: 'below_target',
      survivalRateFirst3: rate,
      note: '早期生存率低于目标区间。下一轮优先降低普通怪攻击型 ai_profile 乘区，或提高该角色早期防御/资源稳定性。',
    };
  }
  if (rate > TARGET_MAX) {
    return {
      characterId: summary.characterId,
      status: 'above_target',
      survivalRateFirst3: rate,
      note: '早期生存率高于目标区间。下一轮优先检查该角色起始牌组输出与普通怪 anti-stall 压力。',
    };
  }
  return {
    characterId: summary.characterId,
    status: 'within_target',
    survivalRateFirst3: rate,
    note: '早期生存率处于当前目标区间，暂不建议按小样本调参。',
  };
}

function main(): void {
  const runsPerClass = parseRuns();
  runSimulation(runsPerClass);

  if (!existsSync(ECONOMY_REPORT_PATH)) {
    throw new Error(`missing simulation output: ${ECONOMY_REPORT_PATH}`);
  }

  const economyReport = JSON.parse(readFileSync(ECONOMY_REPORT_PATH, 'utf8')) as EconomyRegressionReport;
  const recommendations = economyReport.summaries.map(buildRecommendation);
  const illegalRunTransitions = economyReport.diagnostics?.illegalRunTransitions?.length || 0;
  const unknownActionTypes = economyReport.diagnostics?.unknownActionTypes?.length || 0;
  const needsTuning = recommendations.filter((entry) => entry.status !== 'within_target');

  const report = {
    timestamp: new Date().toISOString(),
    source: ECONOMY_REPORT_PATH,
    runsPerClass,
    target: {
      first3SurvivalMin: TARGET_MIN,
      first3SurvivalMax: TARGET_MAX,
    },
    diagnostics: {
      illegalRunTransitions,
      unknownActionTypes,
    },
    recommendations,
    summary: {
      totalCharacters: recommendations.length,
      withinTarget: recommendations.filter((entry) => entry.status === 'within_target').length,
      belowTarget: recommendations.filter((entry) => entry.status === 'below_target').length,
      aboveTarget: recommendations.filter((entry) => entry.status === 'above_target').length,
      overallStatus: illegalRunTransitions === 0 && unknownActionTypes === 0 ? 'pass_with_tuning_notes' : 'fail',
    },
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`[enemy-ai-tuning] report: ${REPORT_PATH}`);
  console.log(`[enemy-ai-tuning] runsPerClass=${runsPerClass}`);
  console.log(`[enemy-ai-tuning] tuningNotes=${needsTuning.length}`);
  for (const entry of needsTuning) {
    console.log(`- ${entry.characterId}: ${entry.status} ${(entry.survivalRateFirst3 * 100).toFixed(0)}%`);
  }

  process.exit(report.summary.overallStatus === 'fail' ? 1 : 0);
}

main();
