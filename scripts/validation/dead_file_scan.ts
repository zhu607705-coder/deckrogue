/**
 * @file dead_file_scan.ts
 * @description 扫描项目中未被引用的死文件，包括源代码、公共资源和脚本。
 *
 * 主要职责:
 * - 扫描源代码目录找出孤立文件
 * - 扫描公共资源找出未使用文件
 * - 扫描脚本目录找出未使用脚本
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface DeadFileReport {
  source: {
    entrypoints: string[];
    totalSourceFiles: number;
    reachableSourceFiles: number;
    orphanSourceFiles: string[];
    ignoredOrphanSourceFiles: string[];
  };
  publicAssets: {
    totalFiles: number;
    exactReferenced: number;
    dynamicDirReferenced: number;
    likelyUnused: string[];
  };
  scripts: {
    totalFiles: number;
    documentedLegacy: string[];
    referencedByPackageJson: string[];
    referencedByRepo: string[];
    likelyUnused: string[];
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.cjs', '.mjs', '.jsx',
  '.json', '.css', '.html', '.md', '.txt', '.toml', '.yml', '.yaml', '.svg'
]);
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.playwright-cli', '.minimax', '.trae', 'coverage'
]);

const SOURCE_ENTRYPOINTS = ['src/main.tsx'];
const SOURCE_ORPHAN_ALLOWLIST = new Set([
  'src/engine/index.ts',
]);

const LEGACY_SCRIPT_ALLOWLIST = new Set([
  'scripts/generate-map-icons.js',
  'scripts/generate_art.cjs',
  'scripts/rebalance_from_skills.cjs',
  'scripts/setup_map_icons.py',
]);

const DYNAMIC_PUBLIC_PREFIXES = [
  '/assets/cards/',
  '/assets/characters/',
  '/assets/enemies/',
  '/assets/relics/',
  '/assets/potions/',
  '/assets/map/',
  '/assets/backgrounds/',
  '/assets/events/',
  '/assets/shop/',
  '/assets/reward/',
  '/assets/rest/',
  '/assets/upgrade/',
];

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join('/');
}

function walkFiles(absDir: string): string[] {
  if (!fs.existsSync(absDir)) return [];
  const out: string[] = [];
  const stack = [absDir];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

function readTextIfSupported(absPath: string): string | null {
  const ext = path.extname(absPath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return null;
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function resolveImport(fromFileAbs: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFileAbs), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const rel = toPosix(path.relative(ROOT, candidate));
      if (rel.startsWith('src/')) return rel;
      return null;
    }
  }
  return null;
}

function extractSourceDeps(relPath: string, sourceText: string): string[] {
  const abs = path.join(ROOT, relPath);
  const deps = new Set<string>();
  const patterns = [
    /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(sourceText))) {
      const spec = m[1];
      if (!spec) continue;
      const resolved = resolveImport(abs, spec);
      if (resolved) deps.add(resolved);
    }
  }
  return [...deps];
}

function buildSourceGraphReport(allSourceFiles: string[]): DeadFileReport['source'] {
  const sourceFilesSet = new Set(allSourceFiles);
  const reachable = new Set<string>();
  const queue = SOURCE_ENTRYPOINTS.filter((p) => sourceFilesSet.has(p));
  while (queue.length) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const text = readTextIfSupported(path.join(ROOT, current));
    if (!text) continue;
    for (const dep of extractSourceDeps(current, text)) {
      if (sourceFilesSet.has(dep) && !reachable.has(dep)) queue.push(dep);
    }
  }
  const orphanSourceFiles = allSourceFiles
    .filter((file) => !reachable.has(file))
    .filter((file) => !SOURCE_ORPHAN_ALLOWLIST.has(file))
    .sort();
  const ignoredOrphanSourceFiles = allSourceFiles
    .filter((file) => !reachable.has(file))
    .filter((file) => SOURCE_ORPHAN_ALLOWLIST.has(file))
    .sort();

  return {
    entrypoints: [...SOURCE_ENTRYPOINTS],
    totalSourceFiles: allSourceFiles.length,
    reachableSourceFiles: reachable.size,
    orphanSourceFiles,
    ignoredOrphanSourceFiles,
  };
}

function collectRepoTextCorpus(): Map<string, string> {
  const files = walkFiles(ROOT);
  const corpus = new Map<string, string>();
  for (const abs of files) {
    const rel = toPosix(path.relative(ROOT, abs));
    const text = readTextIfSupported(abs);
    if (text == null) continue;
    corpus.set(rel, text);
  }
  return corpus;
}

function buildPublicAssetReport(corpus: Map<string, string>): DeadFileReport['publicAssets'] {
  const publicRoot = path.join(ROOT, 'public');
  const publicFiles = walkFiles(publicRoot)
    .filter((abs) => fs.statSync(abs).isFile())
    .map((abs) => toPosix(path.relative(ROOT, abs)))
    .sort();

  const combinedText = [...corpus.values()].join('\n');
  const exactRefs = new Set<string>();
  const dynamicPrefixHits = new Set<string>();

  const exactPathRegex = /\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = exactPathRegex.exec(combinedText))) {
    const webPath = m[0];
    const rel = webPath.startsWith('/') ? webPath.slice(1) : webPath;
    if (rel.startsWith('public/')) {
      exactRefs.add(rel);
    } else if (rel.length > 0) {
      exactRefs.add(rel);
    }
  }

  for (const prefix of DYNAMIC_PUBLIC_PREFIXES) {
    if (combinedText.includes(prefix)) {
      dynamicPrefixHits.add(prefix.replace(/^\//, ''));
    }
  }

  const likelyUnused: string[] = [];
  let exactReferenced = 0;
  let dynamicDirReferenced = 0;

  for (const rel of publicFiles) {
    const publicRelative = rel.replace(/^public\//, '');
    if (exactRefs.has(publicRelative) || exactRefs.has(rel)) {
      exactReferenced++;
      continue;
    }
    if (dynamicPrefixHits.size > 0) {
      const matchedDynamic = [...dynamicPrefixHits].some((prefix) => publicRelative.startsWith(prefix));
      if (matchedDynamic) {
        dynamicDirReferenced++;
        continue;
      }
    }
    likelyUnused.push(rel);
  }

  return {
    totalFiles: publicFiles.length,
    exactReferenced,
    dynamicDirReferenced,
    likelyUnused,
  };
}

function buildScriptsReport(corpus: Map<string, string>): DeadFileReport['scripts'] {
  const scriptsRoot = path.join(ROOT, 'scripts');
  const scriptFiles = walkFiles(scriptsRoot)
    .filter((abs) => fs.statSync(abs).isFile())
    .map((abs) => toPosix(path.relative(ROOT, abs)))
    .sort();

  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  const pkgScripts: Record<string, string> = pkg.scripts || {};
  const pkgScriptValues = Object.values(pkgScripts).join('\n');

  const documentedLegacy: string[] = [];
  const referencedByPackageJson: string[] = [];
  const referencedByRepo: string[] = [];
  const likelyUnused: string[] = [];

  for (const rel of scriptFiles) {
    if (LEGACY_SCRIPT_ALLOWLIST.has(rel)) {
      documentedLegacy.push(rel);
      continue;
    }
    const base = path.basename(rel);
    const packageRef = pkgScriptValues.includes(rel) || pkgScriptValues.includes(base);
    if (packageRef) {
      referencedByPackageJson.push(rel);
      continue;
    }

    let repoRef = false;
    for (const [file, text] of corpus.entries()) {
      if (file === rel) continue;
      if (text.includes(rel) || text.includes(base)) {
        repoRef = true;
        break;
      }
    }
    if (repoRef) {
      referencedByRepo.push(rel);
      continue;
    }
    likelyUnused.push(rel);
  }

  return {
    totalFiles: scriptFiles.length,
    documentedLegacy: documentedLegacy.sort(),
    referencedByPackageJson: referencedByPackageJson.sort(),
    referencedByRepo: referencedByRepo.sort(),
    likelyUnused: likelyUnused.sort(),
  };
}

function buildReport(): DeadFileReport {
  const allSourceFiles = walkFiles(path.join(ROOT, 'src'))
    .map((abs) => toPosix(path.relative(ROOT, abs)))
    .filter((rel) => SOURCE_EXTENSIONS.has(path.extname(rel)))
    .sort();

  const corpus = collectRepoTextCorpus();

  return {
    source: buildSourceGraphReport(allSourceFiles),
    publicAssets: buildPublicAssetReport(corpus),
    scripts: buildScriptsReport(corpus),
  };
}

function printHuman(report: DeadFileReport): void {
  console.log('== Dead File Scan ==');
  console.log(`Source files: ${report.source.reachableSourceFiles}/${report.source.totalSourceFiles} reachable from ${report.source.entrypoints.join(', ')}`);
  if (report.source.ignoredOrphanSourceFiles.length) {
    console.log(`Allowed source orphans: ${report.source.ignoredOrphanSourceFiles.join(', ')}`);
  }
  if (report.source.orphanSourceFiles.length) {
    console.log('Source orphan files:');
    for (const file of report.source.orphanSourceFiles) console.log(`  - ${file}`);
  } else {
    console.log('Source orphan files: none');
  }

  console.log('');
  console.log(`Public assets: total=${report.publicAssets.totalFiles}, exact=${report.publicAssets.exactReferenced}, dynamic-dir=${report.publicAssets.dynamicDirReferenced}`);
  if (report.publicAssets.likelyUnused.length) {
    console.log('Likely unused public assets (heuristic):');
    for (const file of report.publicAssets.likelyUnused.slice(0, 200)) console.log(`  - ${file}`);
    if (report.publicAssets.likelyUnused.length > 200) {
      console.log(`  ... and ${report.publicAssets.likelyUnused.length - 200} more`);
    }
  } else {
    console.log('Likely unused public assets (heuristic): none');
  }

  console.log('');
  console.log(`Scripts: total=${report.scripts.totalFiles}`);
  console.log(`Documented legacy tools: ${report.scripts.documentedLegacy.length}`);
  console.log(`Referenced by package.json: ${report.scripts.referencedByPackageJson.length}`);
  console.log(`Referenced elsewhere in repo: ${report.scripts.referencedByRepo.length}`);
  if (report.scripts.documentedLegacy.length) {
    console.log('Documented legacy scripts (intentional):');
    for (const file of report.scripts.documentedLegacy) console.log(`  - ${file}`);
  }
  if (report.scripts.likelyUnused.length) {
    console.log('Likely unused scripts (heuristic):');
    for (const file of report.scripts.likelyUnused) console.log(`  - ${file}`);
  } else {
    console.log('Likely unused scripts (heuristic): none');
  }
}

function main(): void {
  const args = new Set(process.argv.slice(2));
  const report = buildReport();
  if (args.has('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
  if (args.has('--ci') && report.source.orphanSourceFiles.length > 0) {
    console.error(`\n[dead-file-scan] CI failure: ${report.source.orphanSourceFiles.length} source orphan file(s) found.`);
    process.exit(1);
  }
}

main();
