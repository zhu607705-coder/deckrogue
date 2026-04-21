#!/usr/bin/env node

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
  if (!fs.existsSync(dir)) return out;
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
  while ((match = re.exec(content)) !== null) specs.push(match[1]);
  return specs;
}

function main(): void {
  const files = walk(SRC_ROOT);
  const violations: Violation[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const specs = getImportSpecifiers(content);
    const isAiFile = rel.startsWith('src/core/ai/');

    for (const spec of specs) {
      if (isAiFile) {
        const forbiddenPrefixes = [
          '@/ui/',
          '@/runtimeV2/',
          '@/core/actions/',
          '@/core/events/gameEngine',
          '@/core/events/CombatManager',
          '@/core/persistence/',
          '@/features/',
        ];
        if (forbiddenPrefixes.some((prefix) => spec.startsWith(prefix))) {
          violations.push({
            file: rel,
            specifier: spec,
            reason: 'Enemy AI layer must not depend on UI, runtime, actions, game engine managers, persistence, or feature implementations.',
          });
        }
      } else if (spec.startsWith('@/core/ai/')) {
        violations.push({
          file: rel,
          specifier: spec,
          reason: 'External consumers should import the AI layer through "@/core/ai" instead of deep AI module paths.',
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_enemy_ai_boundaries] Found ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation.file}: '${violation.specifier}' -> ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log('[check_enemy_ai_boundaries] OK');
}

main();
