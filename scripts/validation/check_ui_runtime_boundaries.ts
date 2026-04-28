#!/usr/bin/env node

/**
 * @file check_ui_runtime_boundaries.ts
 * @description 检查 UI 运行时边界，确保 UI 层不直接访问全局事件总线等受限模块。
 *
 * 主要职责:
 * - 定义允许访问全局事件总线的白名单
 * - 扫描所有 import 语句检测违规
 * - 报告 UI 层对运行时模块的违规访问
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const VALID_EXT = new Set(['.ts', '.tsx']);

interface Violation {
  file: string;
  specifier: string;
  reason: string;
}

const GLOBAL_EVENT_BUS_ALLOWLIST = new Set([
  'src/ui/motion/motionSystem.ts',
  'src/ui/hooks/useCombatFeedback.ts',
  'src/ui/overlays/AchievementOverlay.tsx',
  'src/ui/views/CharacterSelectView.tsx',
  'src/ui/views/AppShell.tsx',
]);

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

function importsGlobalEventBusFromCore(content: string): boolean {
  const re = /import\s*{([\s\S]*?)}\s*from\s*['"]@\/core['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const bindings = match[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (bindings.some((entry) => entry.includes('globalEventBus'))) {
      return true;
    }
  }
  return false;
}

function main(): void {
  const files = walk(path.join(SRC_ROOT, 'ui'));
  const violations: Violation[] = [];
  const forbiddenPrefixes = [
    '@/content/data/',
    '@/core/ai/',
    '@/core/actions/',
    '@/core/combat/CombatManager',
    '@/core/combat/combatSystem',
    '@/core/events/CombatManager',
    '@/core/events/EventManager',
    '@/core/events/eventBus',
    '@/core/events/RunFlowManager',
    '@/core/events/runStateMachine',
  ];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const isUiContentFacade = rel.startsWith('src/ui/content/');
    const content = fs.readFileSync(file, 'utf8');
    const specs = getImportSpecifiers(content);
    for (const spec of specs) {
      if (isUiContentFacade && spec.startsWith('@/content/data/')) {
        continue;
      }
      if (forbiddenPrefixes.some((prefix) => spec.startsWith(prefix))) {
        violations.push({
          file: rel,
          specifier: spec,
          reason: 'UI-runtime layer should only consume GameEngine / RenderModel / view models, not deep rule or manager implementations.',
        });
      }
    }

    if (importsGlobalEventBusFromCore(content) && !GLOBAL_EVENT_BUS_ALLOWLIST.has(rel)) {
      violations.push({
        file: rel,
        specifier: '@/core -> globalEventBus',
        reason: 'UI-runtime layer should only consume globalEventBus through the reviewed allowlist.',
      });
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_ui_runtime_boundaries] Found ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation.file}: '${violation.specifier}' -> ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log('[check_ui_runtime_boundaries] OK');
}

main();
