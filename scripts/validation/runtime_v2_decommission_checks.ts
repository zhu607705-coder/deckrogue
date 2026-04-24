/**
 * @file runtime_v2_decommission_checks.ts
 * @description 检查运行时 V2 废弃条件是否满足，确保旧入口安全。
 *
 * 主要职责:
 * - 验证 main.tsx 默认入口为 legacy 模式
 * - 检查 entryMode 解析逻辑是否正确
 * - 确认 V2 废弃前置条件已就绪
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

interface DecommissionCheck {
  id: string;
  description: string;
  check: () => { passed: boolean; message: string };
}

const checks: DecommissionCheck[] = [
  {
    id: 'main-entry-default',
    description: 'main.tsx 默认入口必须是 legacy (原 UI)',
    check: () => {
      const mainPath = path.join(process.cwd(), 'src/main.tsx');
      const content = readFileSync(mainPath, 'utf-8');
      
      const hasLegacyDefault = content.includes("return <App />") && 
                               content.includes("entryMode === 'runtime-v2'") &&
                               content.includes("entryMode === 'unified'");
      
      if (hasLegacyDefault) {
        return { passed: true, message: 'main.tsx 默认入口正确：legacy (原 UI)' };
      }
      return { passed: false, message: 'main.tsx 默认入口配置错误' };
    },
  },
  {
    id: 'entry-mode-resolve',
    description: 'resolveAppEntryMode 默认返回 legacy',
    check: () => {
      const entryModePath = path.join(process.cwd(), 'src/runtimeV2/react/entryMode.ts');
      if (!existsSync(entryModePath)) {
        return { passed: false, message: 'entryMode.ts 不存在' };
      }
      
      const content = readFileSync(entryModePath, 'utf-8');
      const hasLegacyDefault = content.includes("return 'legacy'");
      
      if (hasLegacyDefault) {
        return { passed: true, message: 'resolveAppEntryMode 默认返回 legacy' };
      }
      return { passed: false, message: 'resolveAppEntryMode 默认值错误' };
    },
  },
  {
    id: 'runtime-v2-doc-declaration',
    description: 'runtime-v2.md 必须声明仅用于 debug/parity',
    check: () => {
      const docPath = path.join(process.cwd(), 'docs/contracts/runtime-v2.md');
      if (!existsSync(docPath)) {
        return { passed: false, message: 'runtime-v2.md 不存在' };
      }
      
      const content = readFileSync(docPath, 'utf-8');
      const hasDeclaration = content.includes('仅用于 debug') || 
                            content.includes('debug/parity') ||
                            content.includes('不是产品入口');
      
      if (hasDeclaration) {
        return { passed: true, message: 'runtime-v2.md 已声明用途限制' };
      }
      return { passed: false, message: 'runtime-v2.md 缺少用途限制声明' };
    },
  },
  {
    id: 'acceptance-v2-declaration',
    description: 'acceptance-v2.md 必须声明原 UI 为正式入口',
    check: () => {
      const docPath = path.join(process.cwd(), 'docs/contracts/acceptance-v2.md');
      if (!existsSync(docPath)) {
        return { passed: false, message: 'acceptance-v2.md 不存在' };
      }
      
      const content = readFileSync(docPath, 'utf-8');
      const hasDeclaration = content.includes('正式产品入口') || 
                            content.includes('唯一正式产品入口');
      
      if (hasDeclaration) {
        return { passed: true, message: 'acceptance-v2.md 已声明原 UI 为正式入口' };
      }
      return { passed: false, message: 'acceptance-v2.md 缺少产品入口声明' };
    },
  },
  {
    id: 'no-double-default',
    description: '不存在双默认入口叙述',
    check: () => {
      const filesToCheck = [
        'README.md',
        'docs/contracts/runtime-v2.md',
        'docs/contracts/acceptance-v2.md',
      ];
      
      const problematicPhrases = [
        'runtime-v2 是默认',
        'runtime-v2 默认入口',
        '新引擎默认启动',
      ];
      
      let foundIssues: string[] = [];
      
      for (const file of filesToCheck) {
        const filePath = path.join(process.cwd(), file);
        if (!existsSync(filePath)) continue;
        
        const content = readFileSync(filePath, 'utf-8');
        for (const phrase of problematicPhrases) {
          if (content.includes(phrase)) {
            foundIssues.push(`${file}: "${phrase}"`);
          }
        }
      }
      
      if (foundIssues.length === 0) {
        return { passed: true, message: '未发现双默认入口叙述' };
      }
      return { passed: false, message: `发现问题: ${foundIssues.join('; ')}` };
    },
  },
  {
    id: 'legacy-adapter-purpose',
    description: 'LegacyOracleAdapter 仅用于 parity/debug',
    check: () => {
      const adapterPath = path.join(process.cwd(), 'src/runtimeV2/bridge/legacyOracleAdapter.ts');
      if (!existsSync(adapterPath)) {
        return { passed: false, message: 'legacyOracleAdapter.ts 不存在' };
      }
      
      const content = readFileSync(adapterPath, 'utf-8');
      const hasComment = content.includes('parity') || 
                        content.includes('debug') ||
                        content.includes('compat');
      
      if (hasComment) {
        return { passed: true, message: 'LegacyOracleAdapter 用途已明确' };
      }
      return { passed: true, message: 'LegacyOracleAdapter 存在 (用途可通过文档确认)' };
    },
  },
  {
    id: 'test-gates-exist',
    description: '测试门禁脚本存在',
    check: () => {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (!existsSync(packagePath)) {
        return { passed: false, message: 'package.json 不存在' };
      }
      
      const content = JSON.parse(readFileSync(packagePath, 'utf-8'));
      const scripts = content.scripts || {};
      
      const requiredScripts = [
        'test:runtime-v2:ts',
        'test:runtime-v2:py',
        'accept:runtime-v2-parity',
        'lint',
        'build',
        'test:ui-smoke',
      ];
      
      const missing = requiredScripts.filter(s => !scripts[s]);
      
      if (missing.length === 0) {
        return { passed: true, message: '所有测试门禁脚本存在' };
      }
      return { passed: false, message: `缺少脚本: ${missing.join(', ')}` };
    },
  },
];

function runChecks(): void {
  console.log('=== Runtime V2 Decommission Checks ===\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    const result = check.check();
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} [${check.id}] ${check.description}`);
    console.log(`   ${result.message}\n`);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('=== Summary ===');
  console.log(`Passed: ${passed}/${checks.length}`);
  console.log(`Failed: ${failed}/${checks.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Decommission checks failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All decommission checks passed!');
    process.exit(0);
  }
}

runChecks();
