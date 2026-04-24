/**
 * @file check_import_boundaries.ts
 * @description 检查源代码中的跨层导入是否违反分层架构约束。
 *
 * 主要职责:
 * - 扫描所有源文件的 import 语句
 * - 检测 UI 层是否直接导入核心运行时模块
 * - 报告分层违规并生成检查报告
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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!VALID_EXT.has(ext) || entry.name.endsWith('.d.ts')) continue;
    out.push(full);
  }
  return out;
}

function getImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    specs.push(match[1]);
  }
  return specs;
}

function layerOf(fileAbs: string): string {
  const rel = path.relative(SRC_ROOT, fileAbs).replace(/\\/g, '/');
  const [first] = rel.split('/');
  if (['core', 'features', 'content', 'ui', 'infrastructure', 'engine'].includes(first)) return first;
  return 'root';
}

function isAllowedAliasImport(_fileRel: string, layer: string, spec: string): boolean {
  if (!spec.startsWith('@/')) return true;

  if (layer === 'core') return !spec.startsWith('@/ui/');
  if (layer === 'features') return !spec.startsWith('@/ui/');
  if (layer === 'content') return !spec.startsWith('@/ui/') && !spec.startsWith('@/features/');
  if (layer === 'infrastructure') return spec.startsWith('@/infrastructure/') || spec === '@/core/types';
  if (layer === 'ui') return !spec.startsWith('@/engine/');

  return true;
}

function main(): void {
  const files = walk(SRC_ROOT);
  const violations: Violation[] = [];

  for (const file of files) {
    const rel = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
    const layer = layerOf(file);
    const content = fs.readFileSync(file, 'utf8');
    const specs = getImportSpecifiers(content);

    for (const spec of specs) {
      if (spec.startsWith('.')) {
        violations.push({ file: rel, specifier: spec, reason: 'Relative import is not allowed in src; use @/ absolute path.' });
        continue;
      }
      if (!isAllowedAliasImport(rel, layer, spec)) {
        violations.push({ file: rel, specifier: spec, reason: `Import boundary violation for layer '${layer}'.` });
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_import_boundaries] Found ${violations.length} violation(s):`);
    for (const v of violations) {
      console.error(`- ${v.file}: '${v.specifier}' -> ${v.reason}`);
    }
    process.exit(1);
  }

  console.log('[check_import_boundaries] OK');
}

main();
