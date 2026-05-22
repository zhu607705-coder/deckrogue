#!/usr/bin/env node

/**
 * @file check_asset_polish.ts
 * @description Audits runtime-facing visual assets for missing files, invalid image signatures, tiny files, and high-risk legacy naming.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import charactersData from '@/content/data/characters.json';
import battleBackgrounds from '@/content/data/battleBackgrounds.json';
import { localCardArt, localCharacterArt, localEnemyArt } from '@/content/assets/standeeArt';
import { TUANJIE_MODEL_MANIFEST } from '@/content/assets/tuanjieModelManifest';
import { STORY_EVENTS } from '@/content/narrative/storyEvents';
import { cardsData, enemiesData, potionsData, relicsData } from '@/content/narrative/numericSystem';

type Severity = 'error' | 'warning';

interface AssetSource {
  family: string;
  id: string;
  source: string;
}

interface AssetRecord {
  assetPath: string;
  diskPath: string;
  extension: string;
  bytes: number;
  sources: AssetSource[];
  issues: Array<{ severity: Severity; code: string; message: string }>;
}

const REPORT_DIR = path.resolve('reports/assets');
const REPORT_PATH = path.join(REPORT_DIR, 'asset-polish.json');
const RISK_TERMS = [
  'nurgle',
  'omnissiah',
  'exterminatus',
  'emperor',
  'mechanicus',
  'imperium',
  'warhammer',
  'khorne',
  'slaanesh',
  'tzeentch',
];
const RASTER_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg']);
const IMAGE_EXTENSIONS = new Set([...RASTER_EXTENSIONS, '.svg']);

const records = new Map<string, AssetRecord>();

function log(message: string): void {
  console.log(`[asset-polish] ${message}`);
}

function normalizeAssetPath(assetPath: string): string {
  return assetPath.split(/[?#]/)[0].replace(/\\/g, '/');
}

function toDiskPath(assetPath: string): string {
  const normalized = normalizeAssetPath(assetPath);
  if (!normalized.startsWith('/assets/')) {
    return path.resolve(normalized);
  }
  return path.resolve('public', normalized.slice(1));
}

function minBytesFor(assetPath: string): number {
  if (assetPath.includes('/assets/map/')) return 100;
  if (assetPath.includes('/assets/potions/')) return 1000;
  if (assetPath.includes('/assets/relics/')) return 1000;
  return 5000;
}

function addAsset(assetPath: string | undefined, family: string, id: string, source: string): void {
  if (!assetPath) return;
  const normalized = normalizeAssetPath(assetPath);
  if (!normalized.startsWith('/assets/')) return;
  const extension = path.extname(normalized).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return;
  const current = records.get(normalized) ?? {
    assetPath: normalized,
    diskPath: toDiskPath(normalized),
    extension,
    bytes: 0,
    sources: [],
    issues: [],
  };
  current.sources.push({ family, id, source });
  records.set(normalized, current);
}

function walkFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, files);
    else files.push(full);
  }
  return files;
}

function extractAssetPathsFromSource(rootDir: string): void {
  const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json']);
  const pattern = /\/assets\/[A-Za-z0-9_./ -]+\.(?:png|webp|jpg|jpeg|svg)/g;
  for (const file of walkFiles(rootDir)) {
    if (!sourceExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = readFileSync(file, 'utf8');
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      addAsset(match, 'source_literal', path.basename(file), path.relative(process.cwd(), file));
    }
  }
}

function hasValidSignature(record: AssetRecord): boolean {
  if (!existsSync(record.diskPath)) return false;
  const buffer = readFileSync(record.diskPath);
  if (record.extension === '.png') {
    return buffer.length >= 8 && buffer.subarray(0, 4).toString('hex') === '89504e47';
  }
  if (record.extension === '.webp') {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (record.extension === '.jpg' || record.extension === '.jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (record.extension === '.svg') {
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 512)).toLowerCase();
    return text.includes('<svg');
  }
  return true;
}

function addIssue(record: AssetRecord, severity: Severity, code: string, message: string): void {
  record.issues.push({ severity, code, message });
}

function auditRecord(record: AssetRecord): void {
  const lowered = record.assetPath.toLowerCase();
  const riskTerm = RISK_TERMS.find((term) => lowered.includes(term));
  if (riskTerm) {
    addIssue(record, 'error', 'high_risk_legacy_name', `asset path contains high-risk legacy term: ${riskTerm}`);
  }

  if (!existsSync(record.diskPath)) {
    addIssue(record, 'error', 'missing_file', `missing file: ${record.diskPath}`);
    return;
  }

  const stat = statSync(record.diskPath);
  record.bytes = stat.size;
  if (stat.size <= 0) {
    addIssue(record, 'error', 'zero_byte_file', 'file has zero bytes');
    return;
  }
  if (!hasValidSignature(record)) {
    addIssue(record, 'error', 'invalid_signature', `file signature does not match ${record.extension}`);
  }
  if (RASTER_EXTENSIONS.has(record.extension) && stat.size < minBytesFor(record.assetPath)) {
    addIssue(record, 'warning', 'tiny_raster_asset', `raster asset is unusually small: ${stat.size} bytes`);
  }
}

function collectManifestAssets(): void {
  for (const character of charactersData as Array<{ id: string }>) {
    addAsset(localCharacterArt(character.id), 'character', character.id, 'src/content/data/characters.json');
  }
  for (const enemy of enemiesData as Array<{ id: string }>) {
    addAsset(localEnemyArt(enemy.id), 'enemy', enemy.id, 'src/content/data/enemies.json');
  }
  for (const card of cardsData as Array<{ id: string }>) {
    addAsset(localCardArt(card.id), 'card', card.id, 'src/content/data/cards.json');
  }
  for (const relic of relicsData as Array<{ id: string }>) {
    addAsset(`/assets/relics/${relic.id}.png`, 'relic', relic.id, 'src/content/data/relics.json');
  }
  for (const potion of potionsData as Array<{ id: string }>) {
    addAsset(`/assets/potions/${potion.id}.png`, 'potion', potion.id, 'src/content/data/potions.json');
  }
  for (const event of STORY_EVENTS as Array<{ id: string; imagePath?: string }>) {
    addAsset(event.imagePath, 'event', event.id, 'src/content/narrative/storyEvents.ts');
  }
  const themes = (battleBackgrounds as { themes?: Record<string, { image?: string }> }).themes ?? {};
  for (const [id, theme] of Object.entries(themes)) {
    addAsset(theme.image, 'battle_background', id, 'src/content/data/battleBackgrounds.json');
  }
  for (const entry of TUANJIE_MODEL_MANIFEST) {
    addAsset(entry.sourceArt, 'tuanjie_source', entry.modelId, 'src/content/assets/tuanjieModelManifest.ts');
    addAsset(entry.previewArt, 'tuanjie_preview', entry.modelId, 'src/content/assets/tuanjieModelManifest.ts');
    addAsset(entry.fallbackArt, 'tuanjie_fallback', entry.modelId, 'src/content/assets/tuanjieModelManifest.ts');
  }
}

function scanPublicFilenamesForRisk(): AssetRecord[] {
  const risky: AssetRecord[] = [];
  for (const file of walkFiles(path.resolve('public/assets'))) {
    const extension = path.extname(file).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) continue;
    const rel = path.relative(path.resolve('public'), file).replace(/\\/g, '/');
    const assetPath = `/${rel}`;
    const lowered = assetPath.toLowerCase();
    const riskTerm = RISK_TERMS.find((term) => lowered.includes(term));
    if (!riskTerm) continue;
    risky.push({
      assetPath,
      diskPath: file,
      extension,
      bytes: statSync(file).size,
      sources: [{ family: 'public_orphan_scan', id: path.basename(file), source: 'public/assets' }],
      issues: [{ severity: 'error', code: 'high_risk_public_filename', message: `public asset filename contains high-risk legacy term: ${riskTerm}` }],
    });
  }
  return risky;
}

function main(): void {
  log('collecting manifest and source asset references');
  collectManifestAssets();
  extractAssetPathsFromSource(path.resolve('src'));

  for (const record of records.values()) {
    auditRecord(record);
  }

  const referencedRecords = [...records.values()].sort((a, b) => a.assetPath.localeCompare(b.assetPath));
  const publicFilenameRisks = scanPublicFilenamesForRisk();
  const allIssueRecords = [...referencedRecords, ...publicFilenameRisks].filter((record) => record.issues.length > 0);
  const errorCount = allIssueRecords.reduce((sum, record) => sum + record.issues.filter((issue) => issue.severity === 'error').length, 0);
  const warningCount = allIssueRecords.reduce((sum, record) => sum + record.issues.filter((issue) => issue.severity === 'warning').length, 0);
  const familyCounts = referencedRecords.reduce<Record<string, number>>((acc, record) => {
    for (const source of record.sources) {
      acc[source.family] = (acc[source.family] ?? 0) + 1;
    }
    return acc;
  }, {});

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalUniqueReferencedAssets: referencedRecords.length,
      totalReferences: referencedRecords.reduce((sum, record) => sum + record.sources.length, 0),
      errorCount,
      warningCount,
      pass: errorCount === 0,
      familyCounts,
    },
    issues: allIssueRecords.map((record) => ({
      assetPath: record.assetPath,
      diskPath: path.relative(process.cwd(), record.diskPath),
      bytes: record.bytes,
      sources: record.sources,
      issues: record.issues,
    })),
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  log(`referenced assets: ${report.summary.totalUniqueReferencedAssets}`);
  log(`references: ${report.summary.totalReferences}`);
  log(`errors=${errorCount}, warnings=${warningCount}`);
  log(`report: ${path.relative(process.cwd(), REPORT_PATH)}`);
  if (errorCount > 0) {
    for (const issue of report.issues.slice(0, 10)) {
      console.error(`- ${issue.assetPath}: ${issue.issues.map((entry) => `${entry.code}(${entry.severity})`).join(', ')}`);
    }
    process.exit(1);
  }
}

main();
