#!/usr/bin/env node

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

interface VulnerabilityReport {
  timestamp: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<string, number>;
    bySubCategory: Record<string, number>;
  };
  baseline: Record<string, number>;
}

interface TrendData {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface SecurityReport {
  generatedAt: string;
  period: { start: string; end: string };
  current: { summary: VulnerabilityReport['summary']; baseline: Record<string, number> };
  trend: { daily: TrendData[]; weekly: TrendData[]; monthly: TrendData[] };
  analysis: {
    overallStatus: 'healthy' | 'needs-attention' | 'critical';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    trendDirection: 'improving' | 'stable' | 'worsening';
    keyFindings: string[];
    recommendations: string[];
  };
  metrics: { vulnerabilityDensity: number; codeHealthScore: number; securityDebt: number };
}

function getLatestVulnerabilityReport(): VulnerabilityReport | null {
  const latestPath = resolve('reports/vulnerability/vulnerability-scan.json');
  if (!existsSync(latestPath)) return null;

  try {
    return JSON.parse(readFileSync(latestPath, 'utf-8'));
  } catch {
    return null;
  }
}

function getHistoricalReports(): VulnerabilityReport[] {
  const latestReport = getLatestVulnerabilityReport();
  return latestReport ? [latestReport] : [];
}

function calculateTrend(reports: VulnerabilityReport[]): TrendData[] {
  return reports.map(r => ({
    date: r.timestamp.split('T')[0],
    total: r.summary.total,
    critical: r.summary.critical,
    high: r.summary.high,
    medium: r.summary.medium,
    low: r.summary.low
  }));
}

function analyzeTrendDirection(trend: TrendData[]): 'improving' | 'stable' | 'worsening' {
  if (trend.length < 2) return 'stable';
  const recentAvg = trend.slice(0, 5).reduce((s, t) => s + t.total, 0) / 5;
  const olderAvg = trend.slice(5, 10).reduce((s, t) => s + t.total, 0) / Math.min(5, trend.length - 5);
  if (olderAvg === 0) return 'stable';
  const change = (recentAvg - olderAvg) / olderAvg;
  return change < -0.05 ? 'improving' : change > 0.05 ? 'worsening' : 'stable';
}

function calculateRiskLevel(report: VulnerabilityReport): 'low' | 'medium' | 'high' | 'critical' {
  if (report.summary.critical > 0) return 'critical';
  if (report.summary.high > 0) return 'high';
  if (report.summary.medium > 500) return 'medium';
  return 'low';
}

function calculateOverallStatus(report: VulnerabilityReport): 'healthy' | 'needs-attention' | 'critical' {
  if (report.summary.critical > 0 || report.summary.high > 0) return 'critical';
  if (report.summary.medium > 1000) return 'needs-attention';
  return 'healthy';
}

function generateKeyFindings(report: VulnerabilityReport): string[] {
  const findings: string[] = [];
  
  // 高危态势
  if (report.summary.critical > 0) {
    findings.push(`[高危] 发现 ${report.summary.critical} 个严重问题，需立即处理`);
  }
  if (report.summary.high > 0) {
    findings.push(`[高危] 发现 ${report.summary.high} 个高危问题，需立即处理`);
  }
  if (report.baseline['unprotected-json-parse'] > 0) {
    findings.push(`[高危] 发现 ${report.baseline['unprotected-json-parse']} 个未保护的 JSON.parse 调用`);
  }
  
  // 稳定性/健康态势
  if (report.baseline['array-bounds-risk'] > 100) {
    findings.push(`[稳定性] 数组越界风险较高: ${report.baseline['array-bounds-risk']} 个潜在问题`);
  }
  if (report.baseline['nullable-access-risk'] > 1000) {
    findings.push(`[稳定性] 空值访问风险显著: ${report.baseline['nullable-access-risk']} 个潜在问题`);
  }
  if (report.baseline['unexpected-debug-code'] > 10) {
    findings.push(`[稳定性] 调试代码需要清理: ${report.baseline['unexpected-debug-code']} 个问题`);
  }
  
  // 治理优先级
  if (report.summary.critical === 0 && report.summary.high === 0) {
    if (report.summary.medium > 1000) {
      findings.push(`[治理优先级] 无高危问题，但中危问题量级较大 (${report.summary.medium})，需分批治理`);
    } else if (report.summary.medium > 100) {
      findings.push(`[治理优先级] 无高危问题，中危问题可控 (${report.summary.medium})，建议持续治理`);
    } else {
      findings.push(`[治理优先级] 安全态势良好，建议保持监控`);
    }
  }
  
  return findings;
}

function generateRecommendations(report: VulnerabilityReport): string[] {
  const recs: string[] = [];
  if (report.baseline['unprotected-json-parse'] > 0) recs.push('立即修复未保护的 JSON.parse 调用');
  if (report.baseline['array-bounds-risk'] > 50) recs.push('优先处理核心模块的数组越界问题');
  if (report.baseline['nullable-access-risk'] > 1000) recs.push('逐步重构高风险代码路径，使用安全工具库');
  if (report.baseline['unexpected-debug-code'] > 10) recs.push('清理生产代码中的调试语句');
  recs.push('定期运行安全扫描，持续监控安全态势');
  recs.push('在 PR 审查中严格执行安全检查流程');
  return recs;
}

function generateSecurityReport(): SecurityReport {
  const latestReport = getLatestVulnerabilityReport();
  const historicalReports = getHistoricalReports();
  
  if (!latestReport) {
    return {
      generatedAt: new Date().toISOString(),
      period: { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
      current: { summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, byCategory: {}, bySubCategory: {} }, baseline: {} },
      trend: { daily: [], weekly: [], monthly: [] },
      analysis: { overallStatus: 'critical', riskLevel: 'critical', trendDirection: 'stable', keyFindings: ['无法获取漏洞扫描报告'], recommendations: ['运行 npm run check:vulnerability-scan'] },
      metrics: { vulnerabilityDensity: 0, codeHealthScore: 0, securityDebt: 0 }
    };
  }
  
  const trend = calculateTrend(historicalReports);
  const vulnerabilityDensity = latestReport.summary.total / 1000;
  const codeHealthScore = Math.max(0, 100 - (latestReport.summary.critical * 20 + latestReport.summary.high * 10 + latestReport.summary.medium * 0.1 + latestReport.summary.low * 0.01));
  const securityDebt = latestReport.summary.critical * 8 + latestReport.summary.high * 4 + latestReport.summary.medium * 1 + latestReport.summary.low * 0.5;
  
  return {
    generatedAt: new Date().toISOString(),
    period: { start: trend.length > 0 ? trend[trend.length - 1].date : latestReport.timestamp.split('T')[0], end: latestReport.timestamp.split('T')[0] },
    current: { summary: latestReport.summary, baseline: latestReport.baseline },
    trend: { daily: trend.slice(0, 7), weekly: trend.filter((_, i) => i % 7 === 0).slice(0, 4), monthly: trend.filter((_, i) => i % 30 === 0).slice(0, 12) },
    analysis: {
      overallStatus: calculateOverallStatus(latestReport),
      riskLevel: calculateRiskLevel(latestReport),
      trendDirection: analyzeTrendDirection(trend),
      keyFindings: generateKeyFindings(latestReport),
      recommendations: generateRecommendations(latestReport)
    },
    metrics: { vulnerabilityDensity: Math.round(vulnerabilityDensity * 100) / 100, codeHealthScore: Math.round(codeHealthScore * 100) / 100, securityDebt: Math.round(securityDebt * 100) / 100 }
  };
}

function main() {
  console.log('=== 安全态势分析报告 ===\n');
  const report = generateSecurityReport();
  
  const reportsDir = resolve('reports/security');
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, 'security-report.json'), JSON.stringify(report, null, 2));
  
  console.log('## 报告概述\n');
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`统计周期: ${report.period.start} 至 ${report.period.end}\n`);
  console.log('## 当前安全状态\n');
  console.log(`总体状态: ${report.analysis.overallStatus.toUpperCase()}`);
  console.log(`风险等级: ${report.analysis.riskLevel.toUpperCase()}`);
  console.log(`趋势方向: ${report.analysis.trendDirection.toUpperCase()}\n`);
  console.log('## 漏洞统计\n');
  console.log(`总计: ${report.current.summary.total}`);
  console.log(`- 严重: ${report.current.summary.critical}`);
  console.log(`- 高危: ${report.current.summary.high}`);
  console.log(`- 中危: ${report.current.summary.medium}`);
  console.log(`- 低危: ${report.current.summary.low}\n`);
  console.log('## 基线指标\n');
  Object.entries(report.current.baseline).forEach(([k, v]) => console.log(`- ${k}: ${v}`));
  console.log('\n## 安全指标\n');
  console.log(`漏洞密度: ${report.metrics.vulnerabilityDensity}`);
  console.log(`代码健康分数: ${report.metrics.codeHealthScore}/100`);
  console.log(`安全债务: ${report.metrics.securityDebt} 小时\n`);
  console.log('## 关键发现\n');
  report.analysis.keyFindings.forEach(f => console.log(`- ${f}`));
  console.log('\n## 改进建议\n');
  report.analysis.recommendations.forEach(r => console.log(`- ${r}`));
  
  const emoji = report.analysis.overallStatus === 'healthy' ? '✅' : report.analysis.overallStatus === 'needs-attention' ? '⚠️' : '❌';
  console.log(`\n${emoji} 安全态势: ${report.analysis.overallStatus}`);
}

main();
