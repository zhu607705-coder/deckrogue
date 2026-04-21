#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VALID_EXT = new Set(['.ts', '.tsx']);
const SCAN_DIRS = ['src', 'scripts', 'tests'].map((dir) => path.join(ROOT, dir));
const GAMEPLAY_DATA_IMPORTS = new Set([
  '@/content/data/cards.json',
  '@/content/data/enemies.json',
  '@/content/data/relics.json',
  '@/content/data/potions.json',
  '@/content/data/numericConfig.json',
  '@/content/data/cardEnchantments.json',
]);
const ALLOWED_RAW_GAMEPLAY_IMPORTERS = new Set([
  'src/content/narrative/numericSystem.ts',
  'src/runtimeV2/content/buildContentBundle.ts',
  'src/runtimeV2/content/contentService.ts',
  'scripts/validation/translation_audit.ts',
  'tests/unit/alchemistStarterLoop.test.ts',
  'tests/unit/informantStarterLoop.test.ts',
  'tests/unit/starterBalanceDetection.test.ts',
  'tests/unit/runtimeV2ContentBundle.test.ts',
]);

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
  const files = SCAN_DIRS.flatMap((dir) => walk(dir));
  const violations: Violation[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const specs = getImportSpecifiers(content);
    const isContentFile = rel.startsWith('src/content/');
    const isNumericSystem = rel === 'src/content/narrative/numericSystem.ts';

    for (const spec of specs) {
      if (GAMEPLAY_DATA_IMPORTS.has(spec) && !ALLOWED_RAW_GAMEPLAY_IMPORTERS.has(rel)) {
        violations.push({
          file: rel,
          specifier: spec,
          reason: 'Gameplay raw JSON must be consumed through numericSystem or approved content adapters.',
        });
      }

      if (isContentFile && !isNumericSystem) {
        const forbiddenPrefixes = [
          '@/ui/',
          '@/features/',
          '@/runtimeV2/',
          '@/core/actions/',
          '@/core/combat/',
          '@/core/events/',
          '@/core/persistence/',
        ];
        if (forbiddenPrefixes.some((prefix) => spec.startsWith(prefix))) {
          violations.push({
            file: rel,
            specifier: spec,
            reason: 'Content contract layer must not depend on UI, features, runtime, combat, event, or persistence implementations.',
          });
        }
      }

      if (isNumericSystem) {
        const allowedPrefixes = [
          '@/content/',
          '@/core/types',
        ];
        if (spec.startsWith('@/') && !allowedPrefixes.some((prefix) => spec.startsWith(prefix))) {
          violations.push({
            file: rel,
            specifier: spec,
            reason: 'numericSystem should stay inside the content contract layer and only depend on shared types.',
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_content_contract_layer] Found ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation.file}: '${violation.specifier}' -> ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log('[check_content_contract_layer] OK');
}

main();
