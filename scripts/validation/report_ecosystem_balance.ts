#!/usr/bin/env node

/**
 * @file report_ecosystem_balance.ts
 * @description 生成生态系统平衡报告，分析各角色原型的健康度。
 *
 * 主要职责:
 * - 聚合角色回归数据
 * - 按原型分类分析健康度
 * - 识别过强或过弱的角色
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/ecosystem-balance.json`;

interface RegressionCharacter {
  characterId: string;
  survivalRateFirst3: number;
  survivalRateAll5: number;
  avgCombatTurns: number;
  overallScore: number;
  powerIndex: number;
}

interface RegressionPayload {
  characters?: RegressionCharacter[];
  analysis?: {
    overallScoreSpread?: number;
    powerSpread?: number;
    outliers?: Array<{ characterId: string; flags: string[] }>;
  };
}

interface CharacterMeta {
  id: string;
  archetype?: string[];
  specialResource?: string;
  secondaryResource?: string;
}

interface EcosystemReport {
  timestamp: string;
  source: string;
  archetypeHealth: Array<{
    characterId: string;
    archetype: string[];
    powerIndex: number;
    overallScore: number;
    earlySurvival: number;
    fiveFightSurvival: number;
  }>;
  dominanceReview: {
    overallScoreSpread: number;
    powerSpread: number;
    flaggedOutliers: Array<{ characterId: string; flags: string[] }>;
    verdict: 'stable' | 'watch' | 'dominant_path_risk';
  };
  dataGaps: string[];
  summary: {
    totalCharacters: number;
    reportStatus: 'pass' | 'warn';
  };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function main() {
  const regressionPath = 'output/numerics/combat_regression.json';
  const charactersPath = 'src/content/data/characters.json';

  if (!existsSync(regressionPath)) {
    console.error('[ecosystem-balance] missing output/numerics/combat_regression.json');
    process.exit(1);
  }

  const regression = loadJson<RegressionPayload>(regressionPath);
  const characters = loadJson<CharacterMeta[]>(charactersPath);
  const characterMap = new Map(characters.map((character) => [character.id, character]));

  const archetypeHealth = (regression.characters || []).map((entry) => {
    const character = characterMap.get(entry.characterId);
    return {
      characterId: entry.characterId,
      archetype: character?.archetype || [],
      powerIndex: entry.powerIndex,
      overallScore: entry.overallScore,
      earlySurvival: entry.survivalRateFirst3,
      fiveFightSurvival: entry.survivalRateAll5
    };
  });

  const overallScoreSpread = Number(regression.analysis?.overallScoreSpread || 0);
  const powerSpread = Number(regression.analysis?.powerSpread || 0);
  const flaggedOutliers = regression.analysis?.outliers || [];
  const verdict: EcosystemReport['dominanceReview']['verdict'] =
    overallScoreSpread > 25 || powerSpread > 10 ? 'dominant_path_risk' :
    overallScoreSpread > 15 || powerSpread > 5 ? 'watch' :
    'stable';

  const dataGaps = [
    'cardPickRate unavailable in current regression payload',
    'relicPickRate unavailable in current regression payload',
    'nodeAvoidance unavailable in current regression payload',
    'failureExplainability buckets unavailable in current regression payload'
  ];

  const report: EcosystemReport = {
    timestamp: new Date().toISOString(),
    source: regressionPath,
    archetypeHealth,
    dominanceReview: {
      overallScoreSpread,
      powerSpread,
      flaggedOutliers,
      verdict
    },
    dataGaps,
    summary: {
      totalCharacters: archetypeHealth.length,
      reportStatus: dataGaps.length > 0 ? 'warn' : 'pass'
    }
  };

  ensureDir(REPORT_DIR);
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`[ecosystem-balance] report: ${REPORT_PATH}`);
  console.log(`[ecosystem-balance] verdict: ${verdict}`);
  console.log(`[ecosystem-balance] data gaps: ${dataGaps.length}`);
}

main();
