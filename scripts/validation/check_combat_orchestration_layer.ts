#!/usr/bin/env node

/**
 * @file check_combat_orchestration_layer.ts
 * @description 检查战斗编排层的导入边界，确保核心战斗逻辑不被 UI 层直接调用。
 *
 * 主要职责:
 * - 扫描源码、脚本和测试目录的 import 语句
 * - 检测是否从非战斗编排模块直接导入战斗核心模块
 * - 报告分层违规
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VALID_EXT = new Set(['.ts', '.tsx']);
const SCAN_DIRS = ['src', 'scripts', 'tests'].map((dir) => path.join(ROOT, dir));

interface Violation {
  file: string;
  specifier: string;
  reason: string;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (VALID_EXT.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function getImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) specs.push(match[1]);
  return specs;
}

function main(): void {
  const files = SCAN_DIRS.flatMap((dir) => walk(dir));
  const violations: Violation[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const specs = getImportSpecifiers(fs.readFileSync(file, 'utf8'));
    for (const spec of specs) {
      if (spec === '@/core/combat/CombatManager') {
        violations.push({
          file: rel,
          specifier: spec,
          reason: 'Legacy combat manager is downgraded; import the active orchestrator from "@/core/events/CombatManager" or stay inside src/core/combat/ only.',
        });
      }
    }
  }

  const legacyPath = path.join(ROOT, 'src/core/combat/CombatManager.ts');
  const legacyContent = fs.readFileSync(legacyPath, 'utf8');
  if (!legacyContent.includes('@deprecated') && !legacyContent.includes('experimental')) {
    violations.push({
      file: 'src/core/combat/CombatManager.ts',
      specifier: '@deprecated',
      reason: 'Legacy combat manager should be explicitly marked as deprecated/experimental.',
    });
  }

  if (violations.length > 0) {
    console.error(`\n[check_combat_orchestration_layer] Found ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation.file}: '${violation.specifier}' -> ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log('[check_combat_orchestration_layer] OK');
}

main();
