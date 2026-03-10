import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'scripts', 'tests'].map((d) => path.join(ROOT, d));
const VALID_EXT = new Set(['.ts', '.tsx']);

interface Hit {
  file: string;
  specifier: string;
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

function isAllowed(fileRel: string): boolean {
  const normalized = fileRel.replace(/\\/g, '/');
  return (
    normalized.startsWith('src/engine/') ||
    normalized === 'src/App.tsx'
  );
}

function isDeprecatedPath(spec: string): boolean {
  return spec === '@/engine' || spec.startsWith('@/engine/');
}

function main(): void {
  const files = SCAN_DIRS.flatMap((dir) => walk(dir));
  const hits: Hit[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const specs = getImportSpecifiers(fs.readFileSync(file, 'utf8'));
    for (const spec of specs) {
      if (!isDeprecatedPath(spec)) continue;
      if (isAllowed(rel)) continue;
      hits.push({ file: rel, specifier: spec });
    }
  }

  if (hits.length > 0) {
    console.error(`\n[check_deprecated_imports] Found ${hits.length} deprecated import(s):`);
    for (const hit of hits) {
      console.error(`- ${hit.file}: '${hit.specifier}'`);
    }
    process.exit(1);
  }

  console.log('[check_deprecated_imports] OK');
}

main();
