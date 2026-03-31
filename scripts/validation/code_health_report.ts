#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface VulnerabilitySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<string, number>;
  bySubCategory: Record<string, number>;
}

interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  subCategory: string;
  file: string;
  line: number;
  column: number;
  description: string;
  code: string;
  recommendation: string;
}

interface VulnerabilityReport {
  timestamp: string;
  summary: VulnerabilitySummary;
  baseline: Record<string, number>;
  vulnerabilities: Vulnerability[];
}

interface CodeHealthReport {
  timestamp: string;
  vulnerabilityScan: {
    status: 'pass' | 'fail' | 'warning';
    summary: VulnerabilitySummary;
    baseline: Record<string, number>;
  };
  mediumRiskProgress: {
    arrayBoundsRisk: {
      total: number;
      byDirectory: Record<string, number>;
    };
    nullableAccessRisk: {
      total: number;
      byDirectory: Record<string, number>;
    };
  };
  lowRiskProgress: {
    unexpectedDebugCode: {
      total: number;
      byDirectory: Record<string, number>;
    };
    explicitAny: {
      total: number;
      byDirectory: Record<string, number>;
    };
  };
  overallStatus: 'healthy' | 'needs-attention' | 'critical';
  recommendations: string[];
}

function getLatestVulnerabilityReport(): VulnerabilityReport | null {
  const latestPath = resolve('reports/vulnerability/vulnerability-scan.json');
  if (!existsSync(latestPath)) return null;
  try {
    const content = readFileSync(latestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function groupByDirectory(vulnerabilities: Vulnerability[]): Record<string, number> {
  const byDir: Record<string, number> = {};
  
  for (const vuln of vulnerabilities) {
    const relativePath = vuln.file.replace(resolve('src'), 'src');
    const dir = relativePath.split('/').slice(0, 3).join('/');
    byDir[dir] = (byDir[dir] || 0) + 1;
  }
  
  return Object.fromEntries(
    Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 10)
  );
}

function generateCodeHealthReport(): CodeHealthReport {
  const vulnReport = getLatestVulnerabilityReport();
  
  if (!vulnReport) {
    return {
      timestamp: new Date().toISOString(),
      vulnerabilityScan: {
        status: 'fail',
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, byCategory: {}, bySubCategory: {} },
        baseline: {}
      },
      mediumRiskProgress: {
        arrayBoundsRisk: { total: 0, byDirectory: {} },
        nullableAccessRisk: { total: 0, byDirectory: {} }
      },
      lowRiskProgress: {
        unexpectedDebugCode: { total: 0, byDirectory: {} },
        explicitAny: { total: 0, byDirectory: {} }
      },
      overallStatus: 'critical',
      recommendations: ['运行漏洞扫描: npm run check:vulnerability-scan']
    };
  }
  
  const arrayBoundsVulns = vulnReport.vulnerabilities.filter(v => v.subCategory === 'array-bounds-risk');
  const nullableAccessVulns = vulnReport.vulnerabilities.filter(v => v.subCategory === 'nullable-access-risk');
  const debugCodeVulns = vulnReport.vulnerabilities.filter(v => v.subCategory === 'unexpected-debug-code');
  const explicitAnyVulns = vulnReport.vulnerabilities.filter(v => v.subCategory === 'explicit-any');
  
  const hasHighOrCritical = vulnReport.summary.critical > 0 || vulnReport.summary.high > 0;
  const hasUnprotectedJsonParse = (vulnReport.baseline['unprotected-json-parse'] || 0) > 0;
  
  let vulnerabilityStatus: 'pass' | 'fail' | 'warning';
  if (hasHighOrCritical || hasUnprotectedJsonParse) {
    vulnerabilityStatus = 'fail';
  } else if (vulnReport.summary.medium > 100) {
    vulnerabilityStatus = 'warning';
  } else {
    vulnerabilityStatus = 'pass';
  }
  
  let overallStatus: 'healthy' | 'needs-attention' | 'critical';
  if (vulnerabilityStatus === 'fail') {
    overallStatus = 'critical';
  } else if (vulnerabilityStatus === 'warning' || vulnReport.summary.medium > 1000) {
    overallStatus = 'needs-attention';
  } else {
    overallStatus = 'healthy';
  }
  
  const recommendations: string[] = [];
  
  if (arrayBoundsVulns.length > 0) {
    recommendations.push(`处理数组越界风险: ${arrayBoundsVulns.length} 个问题`);
  }
  if (nullableAccessVulns.length > 0) {
    recommendations.push(`处理空值访问风险: ${nullableAccessVulns.length} 个问题`);
  }
  if (debugCodeVulns.length > 0) {
    recommendations.push(`清理调试代码: ${debugCodeVulns.length} 个问题`);
  }
  if (explicitAnyVulns.length > 0) {
    recommendations.push(`替换 any 类型: ${explicitAnyVulns.length} 个问题`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    vulnerabilityScan: {
      status: vulnerabilityStatus,
      summary: vulnReport.summary,
      baseline: vulnReport.baseline
    },
    mediumRiskProgress: {
      arrayBoundsRisk: {
        total: arrayBoundsVulns.length,
        byDirectory: groupByDirectory(arrayBoundsVulns)
      },
      nullableAccessRisk: {
        total: nullableAccessVulns.length,
        byDirectory: groupByDirectory(nullableAccessVulns)
      }
    },
    lowRiskProgress: {
      unexpectedDebugCode: {
        total: debugCodeVulns.length,
        byDirectory: groupByDirectory(debugCodeVulns)
      },
      explicitAny: {
        total: explicitAnyVulns.length,
        byDirectory: groupByDirectory(explicitAnyVulns)
      }
    },
    overallStatus,
    recommendations
  };
}

function main() {
  console.log('=== 代码健康报告 ===\n');
  
  const report = generateCodeHealthReport();
  
  console.log('## 漏洞扫描状态\n');
  console.log(`状态: ${report.vulnerabilityScan.status.toUpperCase()}`);
  console.log(`总计: ${report.vulnerabilityScan.summary.total} 个问题`);
  console.log(`- 严重: ${report.vulnerabilityScan.summary.critical}`);
  console.log(`- 高危: ${report.vulnerabilityScan.summary.high}`);
  console.log(`- 中危: ${report.vulnerabilityScan.summary.medium}`);
  console.log(`- 低危: ${report.vulnerabilityScan.summary.low}\n`);
  
  console.log('## 中危问题进度\n');
  console.log('### 数组越界风险\n');
  console.log(`总计: ${report.mediumRiskProgress.arrayBoundsRisk.total}`);
  console.log('按目录分布:');
  for (const [dir, count] of Object.entries(report.mediumRiskProgress.arrayBoundsRisk.byDirectory)) {
    console.log(`  - ${dir}: ${count}`);
  }
  console.log('');
  
  console.log('### 空值访问风险\n');
  console.log(`总计: ${report.mediumRiskProgress.nullableAccessRisk.total}`);
  console.log('按目录分布:');
  for (const [dir, count] of Object.entries(report.mediumRiskProgress.nullableAccessRisk.byDirectory)) {
    console.log(`  - ${dir}: ${count}`);
  }
  console.log('');
  
  console.log('## 低危问题进度\n');
  console.log('### 意外调试代码\n');
  console.log(`总计: ${report.lowRiskProgress.unexpectedDebugCode.total}`);
  console.log('按目录分布:');
  for (const [dir, count] of Object.entries(report.lowRiskProgress.unexpectedDebugCode.byDirectory)) {
    console.log(`  - ${dir}: ${count}`);
  }
  console.log('');
  
  console.log('### 显式 any 类型\n');
  console.log(`总计: ${report.lowRiskProgress.explicitAny.total}`);
  console.log('');
  
  console.log('## 总体状态\n');
  console.log(`状态: ${report.overallStatus.toUpperCase()}\n`);
  
  if (report.recommendations.length > 0) {
    console.log('## 建议\n');
    for (const rec of report.recommendations) {
      console.log(`- ${rec}`);
    }
    console.log('');
  }
  
  const statusEmoji = report.overallStatus === 'healthy' ? '✅' : 
                      report.overallStatus === 'needs-attention' ? '⚠️' : '❌';
  console.log(`${statusEmoji} 代码健康状态: ${report.overallStatus}`);
}

main();
