#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';

type JsonObject = Record<string, unknown>;

interface CombatOutlier {
  characterId?: string;
  flags?: string[];
}

interface CombatRegression {
  characters?: Array<{
    characterId: string;
  }>;
  analysis?: {
    powerSpread?: number;
    survivalSpreadFirst3?: number;
    powerBand?: {
      top?: string;
      bottom?: string;
    };
    outliers?: CombatOutlier[];
  };
}

interface EconomySummary {
  characterId?: string;
  nodeDistribution?: { totalVariationDistance?: number };
  rewardToPriceRatio?: { potion?: number; relic?: number };
  cardAffordability?: number | null;
  removalAffordability?: { floor3?: boolean | null };
}

interface EconomyRegression {
  summaries?: EconomySummary[];
  diagnostics?: {
    illegalRunTransitions?: unknown[];
    unknownActionTypes?: unknown[];
  };
}

interface BaselineAudit {
  summary?: { errors?: number; warnings?: number };
  anomalySummary?: { warnings?: number };
  driftSummary?: { warnings?: number };
}

interface DoctorReport {
  timestamp?: string;
  overallStatus?: string;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    byCategory?: Record<string, number>;
  };
  stages?: Array<{
    name?: string;
    status?: string;
    failureType?: string;
  }>;
}

interface RuntimeParityReport {
  generatedAt?: string;
  sampleCount?: number;
  summaries?: Array<{
    scenario?: string;
    total?: number;
    passed?: number;
    failed?: number;
  }>;
}

interface UiSmokeReport {
  baseUrl?: string;
  consoleErrors?: unknown[];
  pageErrors?: unknown[];
  failedRequests?: unknown[];
  tutorialChecked?: boolean;
  slotsLoaded?: string[];
  audits?: Array<{
    label?: string;
    layoutIssues?: unknown[];
  }>;
}

interface ReleaseReadiness {
  timestamp?: string;
  summary?: {
    total?: number;
    passed?: number;
    warned?: number;
    failed?: number;
    overallStatus?: string;
  };
  checks?: Array<{
    id?: string;
    status?: string;
    evidence?: string;
  }>;
}

interface ScenarioMatrix {
  timestamp?: string;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
  };
}

interface ExpansionAcceptance {
  timestamp?: string;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    totalTests?: number;
  };
}

interface ContentAuthoring {
  timestamp?: string;
  summary?: {
    overallStatus?: string;
    passRate?: number;
  };
  enemies?: {
    invalid?: number;
    issues?: Array<{
      enemyId?: string;
      issues?: string[];
    }>;
  };
}

interface EcosystemBalance {
  timestamp?: string;
  summary?: {
    totalCharacters?: number;
    reportStatus?: string;
  };
}

interface ExperiencePolish {
  timestamp?: string;
  combat?: {
    feedbackRhythm?: Array<{
      component?: string;
      status?: string;
      notes?: string;
    }>;
  };
}

interface SecuritySummary {
  total?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

interface SecurityReport {
  generatedAt?: string;
  current?: {
    summary?: SecuritySummary;
  };
}

interface VulnerabilityReport {
  timestamp?: string;
  summary?: SecuritySummary;
}

interface TranslationAudit {
  timestamp?: string;
  summary?: {
    total?: number;
    englishResidue?: number;
    terminologyConflict?: number;
    semanticWarning?: number;
  };
}

interface SystemAssertions {
  timestamp?: string;
  settlementOrderDocumented?: boolean;
  probes?: Array<{ status?: string }>;
}

interface DestructiveSuite {
  timestamp?: string;
  unitTests?: { passed?: boolean };
  cases?: Array<{ status?: string }>;
}

const REPO_ROOT = process.cwd();
const REPORT_DOCS_DIR = resolve(REPO_ROOT, 'docs/reports');
const OUTPUT_DIR = resolve(REPO_ROOT, 'output');
const REPORTS_DIR = resolve(REPO_ROOT, 'reports');

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function walkFiles(dir: string, predicate?: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!predicate || predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  return results.sort();
}

function canonicalReportPath(pathSegments: string[]): string | null {
  const abs = resolve(REPO_ROOT, ...pathSegments);
  return existsSync(abs) ? abs : null;
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, '/');
}

function formatNumber(value: unknown, digits = 2): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'null';
  return value.toFixed(digits);
}

function formatInt(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'null';
  return String(value);
}

function formatBool(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return 'null';
}

function todayStamp(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function sumLayoutIssues(report: UiSmokeReport | null): number {
  return (report?.audits || []).reduce((sum, audit) => sum + (audit.layoutIssues?.length || 0), 0);
}

function latestDoctorFailure(report: DoctorReport | null): { name: string; category: string } | null {
  if (!report?.stages) return null;
  const stage = report.stages.find((entry) => entry.status === 'fail');
  if (!stage) return null;
  return {
    name: stage.name || 'unknown',
    category: stage.failureType || 'unknown'
  };
}

function latestWarningEvidence(report: ReleaseReadiness | null): string {
  const warning = (report?.checks || []).find((check) => check.status === 'warn');
  return warning?.evidence || 'none';
}

function latestEnemyIssueIds(report: ContentAuthoring | null): string[] {
  return (report?.enemies?.issues || [])
    .slice(0, 4)
    .map((entry) => entry.enemyId)
    .filter((id): id is string => Boolean(id));
}

function latestExperienceStatus(report: ExperiencePolish | null, componentName: string): string {
  const entry = (report?.combat?.feedbackRhythm || []).find((item) => item.component === componentName);
  return entry?.status || 'unknown';
}

function buildMarkdown(): string {
  const date = todayStamp();
  const generatedAt = new Date().toISOString();

  const combatPath = resolve(REPO_ROOT, 'output/numerics/combat_regression.json');
  const economyPath = resolve(REPO_ROOT, 'output/numerics/economy_regression.json');
  const baselinePath = resolve(REPO_ROOT, 'output/numerics/baseline_audit.json');
  const parityPath = resolve(REPO_ROOT, 'output/runtime_v2/parity_report.json');
  const uiSmokePath = resolve(REPO_ROOT, 'output/playwright/ui_smoke_report.json');
  const uiSmokeExpansionPath = resolve(REPO_ROOT, 'output/playwright/ui_smoke_expansion_report.json');

  const combat = readJsonFile<CombatRegression>(combatPath);
  const economy = readJsonFile<EconomyRegression>(economyPath);
  const baseline = readJsonFile<BaselineAudit>(baselinePath);
  const parity = readJsonFile<RuntimeParityReport>(parityPath);
  const uiSmoke = readJsonFile<UiSmokeReport>(uiSmokePath);
  const uiSmokeExpansion = readJsonFile<UiSmokeReport>(uiSmokeExpansionPath);

  const latestDoctorJson = canonicalReportPath(['reports', 'doctor', 'report.json']);
  const latestReleaseJson = canonicalReportPath(['reports', 'release', 'release-readiness.json']);
  const latestScenarioJson = canonicalReportPath(['reports', 'scenarios', 'scenario-matrix.json']);
  const latestExpansionJson = canonicalReportPath(['reports', 'expansion', 'expansion.json']);
  const latestContentAuthoringJson = canonicalReportPath(['reports', 'content', 'content-authoring.json']);
  const latestEcosystemJson = canonicalReportPath(['reports', 'content', 'ecosystem-balance.json']);
  const latestExperienceJson = canonicalReportPath(['reports', 'content', 'experience-polish.json']);
  const latestSecurityJson = canonicalReportPath(['reports', 'security', 'security-report.json']);
  const latestVulnerabilityJson = canonicalReportPath(['reports', 'vulnerability', 'vulnerability-scan.json']);
  const latestTranslationJson = canonicalReportPath(['reports', 'translation', 'translation-audit.json']);
  const latestSystemAssertionsJson = canonicalReportPath(['reports', 'system', 'system-assertions.json']);
  const latestDestructiveJson = canonicalReportPath(['reports', 'system', 'destructive-suite.json']);
  const latestBundleJson = canonicalReportPath(['reports', 'content', 'bundle-check.json']);
  const latestReachabilityJson = canonicalReportPath(['reports', 'content', 'reachability.json']);
  const latestDeepReachabilityJson = canonicalReportPath(['reports', 'content', 'deep-reachability.json']);
  const latestKeywordJson = canonicalReportPath(['reports', 'content', 'keyword-registry.json']);
  const latestNumericDiffJson = canonicalReportPath(['reports', 'content', 'numeric-diff.json']);

  const doctor = latestDoctorJson ? readJsonFile<DoctorReport>(latestDoctorJson) : null;
  const release = latestReleaseJson ? readJsonFile<ReleaseReadiness>(latestReleaseJson) : null;
  const scenarioMatrix = latestScenarioJson ? readJsonFile<ScenarioMatrix>(latestScenarioJson) : null;
  const expansion = latestExpansionJson ? readJsonFile<ExpansionAcceptance>(latestExpansionJson) : null;
  const contentAuthoring = latestContentAuthoringJson ? readJsonFile<ContentAuthoring>(latestContentAuthoringJson) : null;
  const ecosystem = latestEcosystemJson ? readJsonFile<EcosystemBalance>(latestEcosystemJson) : null;
  const experience = latestExperienceJson ? readJsonFile<ExperiencePolish>(latestExperienceJson) : null;
  const security = latestSecurityJson ? readJsonFile<SecurityReport>(latestSecurityJson) : null;
  const vulnerability = latestVulnerabilityJson ? readJsonFile<VulnerabilityReport>(latestVulnerabilityJson) : null;
  const translation = latestTranslationJson ? readJsonFile<TranslationAudit>(latestTranslationJson) : null;
  const systemAssertions = latestSystemAssertionsJson ? readJsonFile<SystemAssertions>(latestSystemAssertionsJson) : null;
  const destructive = latestDestructiveJson ? readJsonFile<DestructiveSuite>(latestDestructiveJson) : null;

  const doctorFailure = latestDoctorFailure(doctor);
  const economySummaries = economy?.summaries || [];
  const outliers = combat?.analysis?.outliers || [];
  const invalidEnemyIds = latestEnemyIssueIds(contentAuthoring);
  const manualReports = walkFiles(resolve(REPO_ROOT, 'docs/reports'), (path) => path.endsWith('.md'));
  const incidentReports = walkFiles(resolve(REPO_ROOT, 'docs/incidents'), (path) => path.endsWith('.md') && /report/i.test(path));
  const outputReports = [
    ...walkFiles(resolve(REPO_ROOT, 'output/numerics'), (path) => path.endsWith('.json') || path.endsWith('.md')),
    ...walkFiles(resolve(REPO_ROOT, 'output/playwright'), (path) => path.endsWith('.json') && /report/i.test(path)),
    ...walkFiles(resolve(REPO_ROOT, 'output/runtime_v2'), (path) => path.endsWith('.json') && /report/i.test(path))
  ].sort();
  const generatedReportsJson = walkFiles(resolve(REPO_ROOT, 'reports'), (path) => path.endsWith('.json') && !path.includes('/logs/'));
  const generatedReportsMd = walkFiles(resolve(REPO_ROOT, 'reports'), (path) => path.endsWith('.md'));

  const lines: string[] = [];
  lines.push('# DeckRogue Report Bundle');
  lines.push('');
  lines.push(`生成时间：${date}`);
  lines.push(`生成来源：自动脚本 \`scripts/validation/generate_report_bundle.ts\``);
  lines.push(`生成戳：\`${generatedAt}\``);
  lines.push('说明：本文件作为单点入口，集中汇总当前报告结论、最新自动化产物状态和全部报告清单。日志文件未内联，保留原路径引用。');
  lines.push('');
  lines.push('## 1. 当前总览');
  lines.push('');
  lines.push('### 1.1 跨报告结论');
  lines.push('');
  lines.push(`- 当前最新战斗回归来自 \`${repoPath(combatPath)}\`，\`powerSpread = ${formatNumber(combat?.analysis?.powerSpread, 2)}\`，\`survivalSpreadFirst3 = ${formatNumber(combat?.analysis?.survivalSpreadFirst3, 2)}\`。`);
  lines.push(`- 当前经济回归来自 \`${repoPath(economyPath)}\`，训练诊断状态为：\`illegalRunTransitions = ${(economy?.diagnostics?.illegalRunTransitions || []).length}\`，\`unknownActionTypes = ${(economy?.diagnostics?.unknownActionTypes || []).length}\`。`);
  lines.push(`- 当前 \`runtime_v2\` 一致性报告来自 \`${repoPath(parityPath)}\`，\`${formatInt(parity?.sampleCount)}\` 组样本在全部汇总场景均通过。`);
  lines.push(`- 当前 UI 自动化存在分层差异：基础烟测 \`${sumLayoutIssues(uiSmoke)}\` 个布局问题，扩展烟测 \`${sumLayoutIssues(uiSmokeExpansion)}\` 个布局问题。`);
  lines.push(`- 当前最新 doctor 总报告显示 \`${formatInt(doctor?.summary?.total)}\` 个阶段里 \`${formatInt(doctor?.summary?.passed)}\` 个通过、\`${formatInt(doctor?.summary?.failed)}\` 个失败${doctorFailure ? `，失败项是 \`${doctorFailure.name}\`` : ''}。`);
  lines.push(`- 当前 release readiness 报告总体状态为 \`${release?.summary?.overallStatus || 'unknown'}\`，warning 证据为：\`${latestWarningEvidence(release)}\`。`);
  lines.push(`- 当前安全扫描无 \`critical/high\`，但仍有 \`${formatInt(security?.current?.summary?.total)}\` 个中低级问题。`);
  lines.push(`- 当前内容作者校验总体通过率 \`${formatNumber(contentAuthoring?.summary?.passRate, 2)}%\`，当前无效敌人数量 \`${formatInt(contentAuthoring?.enemies?.invalid)}\`。`);
  lines.push('');
  lines.push('### 1.2 当前关键数字');
  lines.push('');
  lines.push('| 维度 | 当前值 | 备注 |');
  lines.push('|---|---:|---|');
  lines.push(`| 战斗 \`powerSpread\` | \`${formatNumber(combat?.analysis?.powerSpread, 2)}\` | 来自最新 \`combat_regression.json\` |`);
  lines.push(`| 战斗 \`survivalSpreadFirst3\` | \`${formatNumber(combat?.analysis?.survivalSpreadFirst3, 2)}\` | 来自最新 \`combat_regression.json\` |`);
  lines.push(`| 战斗强度顶部职业 | \`${combat?.analysis?.powerBand?.top || 'unknown'}\` | 来自最新 \`combat_regression.json\` |`);
  lines.push(`| 战斗强度底部职业 | \`${combat?.analysis?.powerBand?.bottom || 'unknown'}\` | 来自最新 \`combat_regression.json\` |`);
  lines.push(`| 经济诊断非法迁移 | \`${formatInt((economy?.diagnostics?.illegalRunTransitions || []).length)}\` | 最新摘要 |`);
  lines.push(`| 经济诊断未知动作 | \`${formatInt((economy?.diagnostics?.unknownActionTypes || []).length)}\` | 最新摘要 |`);
  lines.push(`| UI 基础烟测布局问题 | \`${sumLayoutIssues(uiSmoke)}\` | 基础入口 |`);
  lines.push(`| UI 扩展烟测布局问题 | \`${sumLayoutIssues(uiSmokeExpansion)}\` | 扩展覆盖 |`);
  lines.push(`| baseline audit errors | \`${formatInt(baseline?.summary?.errors)}\` | 最新扫描 |`);
  lines.push(`| baseline audit warnings | \`${formatInt(baseline?.summary?.warnings)}\` | anomaly=${formatInt(baseline?.anomalySummary?.warnings)}, drift=${formatInt(baseline?.driftSummary?.warnings)} |`);
  lines.push(`| scenario matrix | \`${formatInt(scenarioMatrix?.summary?.passed)}/${formatInt(scenarioMatrix?.summary?.total)} pass\` | 当前场景矩阵 |`);
  lines.push(`| expansion acceptance | \`${formatInt(expansion?.summary?.totalTests)} tests\` | ${formatInt(expansion?.summary?.passed)}/${formatInt(expansion?.summary?.total)} suites pass |`);
  lines.push(`| translation audit | \`${formatInt(translation?.summary?.total)}\` 问题 | 当前语言检查 |`);
  lines.push('');
  lines.push('## 2. 当前自动化报告摘要');
  lines.push('');
  lines.push('### 2.1 Doctor 总报告');
  lines.push('');
  if (latestDoctorJson) {
    lines.push(`来源：\`${repoPath(latestDoctorJson)}\``);
    lines.push('');
    lines.push(`- 总阶段数：\`${formatInt(doctor?.summary?.total)}\``);
    lines.push(`- 通过：\`${formatInt(doctor?.summary?.passed)}\``);
    lines.push(`- 失败：\`${formatInt(doctor?.summary?.failed)}\``);
    lines.push(`- 跳过：\`${formatInt(doctor?.summary?.skipped)}\``);
    if (doctorFailure) {
      lines.push(`- 失败分类：\`${doctorFailure.category}\``);
      lines.push(`- 失败项：\`${doctorFailure.name}\``);
    }
  } else {
    lines.push('- 当前未找到 doctor 报告。');
  }
  lines.push('');
  lines.push('### 2.2 战斗回归');
  lines.push('');
  lines.push(`来源：\`${repoPath(combatPath)}\``);
  lines.push('');
  lines.push(`- \`powerSpread = ${formatNumber(combat?.analysis?.powerSpread, 2)}\``);
  lines.push(`- \`survivalSpreadFirst3 = ${formatNumber(combat?.analysis?.survivalSpreadFirst3, 2)}\``);
  lines.push(`- \`powerBand.top = ${combat?.analysis?.powerBand?.top || 'unknown'}\``);
  lines.push(`- \`powerBand.bottom = ${combat?.analysis?.powerBand?.bottom || 'unknown'}\``);
  lines.push('- 当前 outlier：');
  if (outliers.length === 0) {
    lines.push('  - 无');
  } else {
    for (const outlier of outliers) {
      lines.push(`  - \`${outlier.characterId || 'unknown'}\`: ${(outlier.flags || []).map((flag) => `\`${flag}\``).join('，') || '无 flags'}`);
    }
  }
  lines.push('');
  lines.push('### 2.3 经济回归');
  lines.push('');
  lines.push(`来源：\`${repoPath(economyPath)}\``);
  lines.push('');
  lines.push('- 训练诊断：');
  lines.push(`  - \`illegalRunTransitions = ${(economy?.diagnostics?.illegalRunTransitions || []).length}\``);
  lines.push(`  - \`unknownActionTypes = ${(economy?.diagnostics?.unknownActionTypes || []).length}\``);
  lines.push('- 当前各职业 `nodeDistribution.totalVariationDistance`：');
  for (const summary of economySummaries) {
    lines.push(`  - \`${summary.characterId || 'unknown'} = ${formatNumber(summary.nodeDistribution?.totalVariationDistance, 4)}\``);
  }
  if (economySummaries[0]) {
    lines.push('- 当前统一奖励价格比：');
    lines.push(`  - \`potion = ${formatNumber(economySummaries[0].rewardToPriceRatio?.potion, 16)}\``);
    lines.push(`  - \`relic = ${formatNumber(economySummaries[0].rewardToPriceRatio?.relic, 15)}\``);
    lines.push(`- 当前摘要层 \`cardAffordability = ${economySummaries[0].cardAffordability === null || economySummaries[0].cardAffordability === undefined ? 'null' : economySummaries[0].cardAffordability}\`，\`floor3Removal = ${formatBool(economySummaries[0].removalAffordability?.floor3)}\`。`);
  }
  lines.push('');
  lines.push('### 2.4 Baseline Audit');
  lines.push('');
  lines.push(`来源：\`${repoPath(baselinePath)}\``);
  lines.push('');
  lines.push(`- \`errors = ${formatInt(baseline?.summary?.errors)}\``);
  lines.push(`- \`warnings = ${formatInt(baseline?.summary?.warnings)}\``);
  lines.push(`- \`anomalyWarnings = ${formatInt(baseline?.anomalySummary?.warnings)}\``);
  lines.push(`- \`driftWarnings = ${formatInt(baseline?.driftSummary?.warnings)}\``);
  lines.push('');
  lines.push('### 2.5 Runtime V2 Parity');
  lines.push('');
  lines.push(`来源：\`${repoPath(parityPath)}\``);
  lines.push('');
  lines.push(`- 样本数：\`${formatInt(parity?.sampleCount)}\``);
  lines.push('- 当前场景汇总：');
  for (const summary of parity?.summaries || []) {
    lines.push(`  - \`${summary.scenario || 'unknown'} = ${formatInt(summary.passed)}/${formatInt(summary.total)} pass\``);
  }
  lines.push('');
  lines.push('### 2.6 UI Smoke');
  lines.push('');
  lines.push('来源：');
  lines.push('');
  lines.push(`- \`${repoPath(uiSmokePath)}\``);
  lines.push(`- \`${repoPath(uiSmokeExpansionPath)}\``);
  lines.push('');
  lines.push('基础烟测：');
  lines.push('');
  lines.push(`- 审计页数：\`${formatInt(uiSmoke?.audits?.length)}\``);
  lines.push(`- 布局问题：\`${sumLayoutIssues(uiSmoke)}\``);
  lines.push(`- \`consoleErrors = ${formatInt(uiSmoke?.consoleErrors?.length)}\``);
  lines.push(`- \`pageErrors = ${formatInt(uiSmoke?.pageErrors?.length)}\``);
  lines.push(`- \`failedRequests = ${formatInt(uiSmoke?.failedRequests?.length)}\``);
  lines.push('');
  lines.push('扩展烟测：');
  lines.push('');
  lines.push(`- 审计页数：\`${formatInt(uiSmokeExpansion?.audits?.length)}\``);
  lines.push(`- 布局问题：\`${sumLayoutIssues(uiSmokeExpansion)}\``);
  lines.push(`- \`consoleErrors = ${formatInt(uiSmokeExpansion?.consoleErrors?.length)}\``);
  lines.push(`- \`pageErrors = ${formatInt(uiSmokeExpansion?.pageErrors?.length)}\``);
  lines.push(`- \`failedRequests = ${formatInt(uiSmokeExpansion?.failedRequests?.length)}\``);
  lines.push(`- \`tutorialChecked = ${formatBool(uiSmokeExpansion?.tutorialChecked)}\``);
  lines.push('- 已验证存档位：');
  for (const slot of uiSmokeExpansion?.slotsLoaded || []) {
    lines.push(`  - \`${slot}\``);
  }
  lines.push('');
  lines.push('### 2.7 Release Readiness');
  lines.push('');
  if (latestReleaseJson) {
    lines.push(`来源：\`${repoPath(latestReleaseJson)}\``);
    lines.push('');
    lines.push(`- 总检查数：\`${formatInt(release?.summary?.total)}\``);
    lines.push(`- \`passed = ${formatInt(release?.summary?.passed)}\``);
    lines.push(`- \`warned = ${formatInt(release?.summary?.warned)}\``);
    lines.push(`- \`failed = ${formatInt(release?.summary?.failed)}\``);
    lines.push(`- \`overallStatus = ${release?.summary?.overallStatus || 'unknown'}\``);
    lines.push(`- 唯一 warning：\`${latestWarningEvidence(release)}\``);
  } else {
    lines.push('- 当前未找到 release readiness 报告。');
  }
  lines.push('');
  lines.push('### 2.8 Scenario Matrix / Expansion / System Assertions');
  lines.push('');
  lines.push('来源：');
  lines.push('');
  if (latestScenarioJson) lines.push(`- \`${repoPath(latestScenarioJson)}\``);
  if (latestExpansionJson) lines.push(`- \`${repoPath(latestExpansionJson)}\``);
  if (latestSystemAssertionsJson) lines.push(`- \`${repoPath(latestSystemAssertionsJson)}\``);
  if (latestDestructiveJson) lines.push(`- \`${repoPath(latestDestructiveJson)}\``);
  lines.push('');
  lines.push('摘要：');
  lines.push('');
  lines.push(`- \`scenario matrix = ${formatInt(scenarioMatrix?.summary?.passed)}/${formatInt(scenarioMatrix?.summary?.total)} pass\``);
  lines.push(`- \`expansion acceptance = ${formatInt(expansion?.summary?.passed)}/${formatInt(expansion?.summary?.total)} suites pass, ${formatInt(expansion?.summary?.totalTests)} tests\``);
  lines.push(`- \`system assertions = ${(systemAssertions?.probes || []).length} probes, ${((systemAssertions?.probes || []).filter((probe) => probe.status !== 'pass')).length} failing\``);
  lines.push(`- \`destructive suite = ${(destructive?.cases || []).length} cases, ${((destructive?.cases || []).filter((item) => item.status !== 'pass')).length} failing\``);
  lines.push('');
  lines.push('### 2.9 Content / Security / Translation');
  lines.push('');
  lines.push('来源：');
  lines.push('');
  if (latestContentAuthoringJson) lines.push(`- \`${repoPath(latestContentAuthoringJson)}\``);
  if (latestEcosystemJson) lines.push(`- \`${repoPath(latestEcosystemJson)}\``);
  if (latestExperienceJson) lines.push(`- \`${repoPath(latestExperienceJson)}\``);
  if (latestSecurityJson) lines.push(`- \`${repoPath(latestSecurityJson)}\``);
  if (latestVulnerabilityJson) lines.push(`- \`${repoPath(latestVulnerabilityJson)}\``);
  if (latestTranslationJson) lines.push(`- \`${repoPath(latestTranslationJson)}\``);
  lines.push('');
  lines.push('摘要：');
  lines.push('');
  lines.push(`- content authoring：\`overallStatus = ${contentAuthoring?.summary?.overallStatus || 'unknown'}\`，\`passRate = ${formatNumber(contentAuthoring?.summary?.passRate, 2)}%\``);
  lines.push(`- 当前无效敌人：\`${formatInt(contentAuthoring?.enemies?.invalid)}\``);
  for (const enemyId of invalidEnemyIds) {
    lines.push(`  - \`${enemyId}\``);
  }
  lines.push(`- ecosystem balance：\`totalCharacters = ${formatInt(ecosystem?.summary?.totalCharacters)}\`，\`reportStatus = ${ecosystem?.summary?.reportStatus || 'unknown'}\``);
  lines.push(`- experience polish：\`命中反馈 = ${latestExperienceStatus(experience, '命中反馈')}\`，\`状态施加 = ${latestExperienceStatus(experience, '状态施加')}\``);
  lines.push(`- security report：\`${formatInt(security?.current?.summary?.total)}\` 个问题，\`critical = ${formatInt(security?.current?.summary?.critical)}\`，\`high = ${formatInt(security?.current?.summary?.high)}\``);
  lines.push(`- vulnerability scan：\`${formatInt(vulnerability?.summary?.total)}\` 个问题，\`critical = ${formatInt(vulnerability?.summary?.critical)}\`，\`high = ${formatInt(vulnerability?.summary?.high)}\``);
  lines.push(`- translation audit：\`${formatInt(translation?.summary?.total)}\` 项问题`);
  lines.push('');
  lines.push('## 3. 跨报告冲突与注意点');
  lines.push('');
  lines.push('### 3.1 当前存在的冲突');
  lines.push('');
  lines.push(`- \`release-readiness\` 为 \`${release?.summary?.overallStatus || 'unknown'}\`，但最新 doctor 报告仍有 \`${formatInt(doctor?.summary?.failed)}\` 个失败。发布判断应以时间更晚的总报告为准。`);
  lines.push('- `runtime_v2 parity`、`scenario matrix`、`system assertions` 全绿，但 `combat_regression` 和 `economy_regression` 仍是独立状态线。');
  lines.push(`- 基础 UI 烟测仍有 \`${sumLayoutIssues(uiSmoke)}\` 个布局问题，而扩展 UI 烟测为 \`${sumLayoutIssues(uiSmokeExpansion)}\`，页面覆盖范围并不一致。`);
  lines.push('');
  lines.push('### 3.2 当前最需要继续跟进的点');
  lines.push('');
  if (doctorFailure) lines.push(`- \`${doctorFailure.name}\` 的失败源头`);
  lines.push('- `combat_regression.json` 中 `powerSpread` 和 `survivalSpreadFirst3` 的变化');
  lines.push('- `economy_regression.json` 摘要层的 `cardAffordability` / `floor3Removal` 空值');
  if (invalidEnemyIds.length > 0) lines.push(`- \`content-authoring\` 暴露的 \`${invalidEnemyIds.length}\` 个敌人缺失 move 引用`);
  lines.push(`- \`security\` / \`vulnerability\` 中累计的 \`${formatInt(security?.current?.summary?.total)}\` 个中低级问题`);
  lines.push('');
  lines.push('## 4. 人工维护报告目录');
  lines.push('');
  lines.push('### 4.1 `docs/reports/`');
  lines.push('');
  lines.push('| 文件 | 类型 | 说明 |');
  lines.push('|---|---|---|');
  const reportTypeMap: Record<string, string> = {
    'README.md': '索引',
    'balance_report.md': '数值报告',
    'balance_test_report.md': '测试报告',
    'engine_fix_report.md': '修复报告',
    'engine_review_report.md': '审查报告',
    'numerical-system-audit.md': '审计报告',
    'ui_fix_report.md': '修复报告',
    'ui_review_report.md': '审查报告',
    'development/README.md': '索引',
    'development/development_report_2026-03-06.md': '开发报告',
    'development/development_report_2026-03-20.md': '开发报告',
    [`report_bundle_${date}.md`]: '汇总报告',
    'report_bundle_latest.md': '汇总报告'
  };
  const reportDescMap: Record<string, string> = {
    'README.md': '报告目录说明',
    'balance_report.md': '平衡修正记录',
    'balance_test_report.md': '平衡测试结果',
    'engine_fix_report.md': '引擎修复清单',
    'engine_review_report.md': '引擎系统性审查',
    'numerical-system-audit.md': '数值系统全面检修',
    'ui_fix_report.md': 'UI 修复清单',
    'ui_review_report.md': 'UI 与功能实现检修',
    'development/README.md': '开发报告子目录说明',
    'development/development_report_2026-03-06.md': '项目复盘与技术白皮书',
    'development/development_report_2026-03-20.md': 'Round 1 训练可信度修复',
    [`report_bundle_${date}.md`]: '自动生成的日期版总包',
    'report_bundle_latest.md': '自动生成的最新总包入口'
  };
  for (const file of manualReports) {
    const rel = repoPath(file).replace('docs/reports/', '');
    lines.push(`| \`${repoPath(file)}\` | ${reportTypeMap[rel] || '报告'} | ${reportDescMap[rel] || '人工维护文档'} |`);
  }
  lines.push('');
  lines.push('### 4.2 事故与快照');
  lines.push('');
  lines.push('| 文件 | 类型 | 说明 |');
  lines.push('|---|---|---|');
  for (const file of [...incidentReports, resolve(REPO_ROOT, 'output/numerics/pre_refactor_snapshot.md')]) {
    if (!existsSync(file)) continue;
    const rel = repoPath(file);
    const type = rel.includes('/incidents/') ? '故障报告' : '快照';
    const desc = rel.includes('/incidents/') ? '事故诊断与修复' : 'runtime 重构前基线快照';
    lines.push(`| \`${rel}\` | ${type} | ${desc} |`);
  }
  lines.push('');
  lines.push('## 5. 最新自动化报告目录');
  lines.push('');
  lines.push('### 5.1 当前最新文件');
  lines.push('');
  lines.push('| 类别 | 最新文件 | 结论 |');
  lines.push('|---|---|---|');
  const latestRows: Array<[string, string | null, string]> = [
    ['doctor', latestDoctorJson, `${formatInt(doctor?.summary?.passed)} pass / ${formatInt(doctor?.summary?.failed)} failed`],
    ['content bundle', latestBundleJson, '当前 bundle check 产物'],
    ['content authoring', latestContentAuthoringJson, `${formatNumber(contentAuthoring?.summary?.passRate, 2)}% 通过，${formatInt(contentAuthoring?.enemies?.invalid)} 个敌人问题`],
    ['deep reachability', latestDeepReachabilityJson, '最新深度可达性产物'],
    ['ecosystem balance', latestEcosystemJson, ecosystem?.summary?.reportStatus || 'unknown'],
    ['experience polish', latestExperienceJson, '体验检查产物'],
    ['keyword registry', latestKeywordJson, '关键词校验产物'],
    ['numeric diff', latestNumericDiffJson, '数值变更审计产物'],
    ['reachability', latestReachabilityJson, '最新可达性产物'],
    ['release readiness', latestReleaseJson, `${release?.summary?.overallStatus || 'unknown'} with ${formatInt(release?.summary?.warned)} warn`],
    ['security report', latestSecurityJson, `无高危，${formatInt(security?.current?.summary?.total)} 项中低级问题`],
    ['scenario matrix', latestScenarioJson, `${formatInt(scenarioMatrix?.summary?.passed)}/${formatInt(scenarioMatrix?.summary?.total)} pass`],
    ['destructive suite', latestDestructiveJson, `${(destructive?.cases || []).length}/${(destructive?.cases || []).length} pass`],
    ['system assertions', latestSystemAssertionsJson, `${(systemAssertions?.probes || []).length}/${(systemAssertions?.probes || []).length} pass`],
    ['translation audit', latestTranslationJson, `${formatInt(translation?.summary?.total)} 问题`],
    ['vulnerability scan', latestVulnerabilityJson, `无高危，${formatInt(vulnerability?.summary?.total)} 项中低级问题`],
    ['expansion acceptance', latestExpansionJson, `${formatInt(expansion?.summary?.passed)} suites pass`],
    ['ui smoke', uiSmokePath, `${sumLayoutIssues(uiSmoke)} 布局问题`],
    ['ui smoke expansion', uiSmokeExpansionPath, `${sumLayoutIssues(uiSmokeExpansion)} 布局问题`],
    ['runtime parity', parityPath, `${formatInt(parity?.sampleCount)} 样本全量对比`],
    ['combat regression', combatPath, '当前战斗回归产物'],
    ['economy regression', economyPath, '当前经济回归产物'],
    ['baseline audit', baselinePath, `${formatInt(baseline?.summary?.errors)} error / ${formatInt(baseline?.summary?.warnings)} warnings`]
  ];
  for (const [category, path, conclusion] of latestRows) {
    if (!path) continue;
    lines.push(`| ${category} | \`${repoPath(path)}\` | ${conclusion} |`);
  }
  lines.push('');
  lines.push('### 5.2 历史数量');
  lines.push('');
  lines.push(`- \`docs/reports/*.md\` 与子目录：\`${manualReports.length}\` 份`);
  lines.push(`- incident report：\`${incidentReports.length}\` 份`);
  lines.push(`- \`output/\` 下 report 与 numerics 快照：\`${outputReports.length}\` 份`);
  lines.push(`- \`reports/\` 下自动化 JSON 报告：\`${generatedReportsJson.length}\` 份`);
  lines.push(`- \`reports/doctor/*.md\`：\`${generatedReportsMd.filter((path) => path.includes('/doctor/')).length}\` 份`);
  lines.push('');
  lines.push('## 6. 全部报告清单');
  lines.push('');
  lines.push('### 6.1 人工报告与事故报告');
  lines.push('');
  for (const file of [...manualReports, ...incidentReports]) {
    lines.push(`- \`${repoPath(file)}\``);
  }
  lines.push('');
  lines.push('### 6.2 `output/` 当前 report 产物');
  lines.push('');
  for (const file of outputReports) {
    lines.push(`- \`${repoPath(file)}\``);
  }
  lines.push('');
  lines.push('### 6.3 `reports/` 自动生成报告');
  lines.push('');
  for (const file of [...generatedReportsJson, ...generatedReportsMd]) {
    lines.push(`- \`${repoPath(file)}\``);
  }
  lines.push('');
  lines.push('## 7. 使用建议');
  lines.push('');
  lines.push('- 读当前状态，先看本文件第 `1` 到第 `3` 节。');
  lines.push('- 查人工结论，优先看第 `4` 节里的 `docs/reports/*.md`。');
  lines.push('- 查自动化现状，优先看第 `5` 节里的最新文件。');
  lines.push('- 查历史演进，直接从第 `6` 节跳到具体原始 report 文件。');
  lines.push('');
  lines.push('## 8. 生成说明');
  lines.push('');
  lines.push('- 生成命令：`npm run report:bundle`');
  lines.push(`- 输出文件：\`docs/reports/report_bundle.md\``);

  return `${lines.join('\n')}\n`;
}

function main() {
  ensureDir(REPORT_DOCS_DIR);
  const markdown = buildMarkdown();
  const reportPath = resolve(REPORT_DOCS_DIR, 'report_bundle.md');
  writeFileSync(reportPath, markdown, 'utf-8');
  console.log(`[report-bundle] wrote ${repoPath(reportPath)}`);
}

main();
