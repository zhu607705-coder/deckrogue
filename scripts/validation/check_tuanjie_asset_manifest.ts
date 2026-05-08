#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import characters from '@/content/data/characters.json';
import {
  TUANJIE_MODEL_MANIFEST,
  type TuanjieModelEntry,
  type TuanjieModelFormat,
  type TuanjieModelKind,
  type TuanjieModelStatus,
} from '@/content/assets/tuanjieModelManifest';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/tuanjie-asset-manifest.json`;

const VALID_KINDS = new Set<TuanjieModelKind>(['card', 'character', 'enemy', 'event', 'shop', 'relic', 'environment']);
const VALID_FORMATS = new Set<TuanjieModelFormat>(['tuanjie-2d-prefab', 'unity-prefab', 'glb', 'gltf', 'fbx']);
const VALID_STATUSES = new Set<TuanjieModelStatus>(['placeholder', 'ready', 'blocked']);
const REQUIRED_CHARACTER_IDS = new Set((characters as Array<{ id: string }>).map((character) => character.id));

interface ManifestCheckReport {
  timestamp: string;
  total: number;
  passed: boolean;
  errors: string[];
}

function publicAssetExists(assetPath: string): boolean {
  return assetPath.startsWith('/assets/') && existsSync(`public${assetPath}`);
}

function validateEntry(entry: TuanjieModelEntry, index: number): string[] {
  const prefix = `${entry.modelId || `entry_${index}`}`;
  const errors: string[] = [];

  if (!entry.modelId) errors.push(`${prefix}: missing modelId`);
  if (!entry.sourceId) errors.push(`${prefix}: missing sourceId`);
  if (!VALID_KINDS.has(entry.kind)) errors.push(`${prefix}: invalid kind ${entry.kind}`);
  if (!VALID_FORMATS.has(entry.format)) errors.push(`${prefix}: invalid format ${entry.format}`);
  if (!VALID_STATUSES.has(entry.status)) errors.push(`${prefix}: invalid status ${entry.status}`);
  if (!publicAssetExists(entry.sourceArt)) errors.push(`${prefix}: missing sourceArt ${entry.sourceArt}`);
  if (!publicAssetExists(entry.previewArt)) errors.push(`${prefix}: missing previewArt ${entry.previewArt}`);
  if (!publicAssetExists(entry.fallbackArt)) errors.push(`${prefix}: missing fallbackArt ${entry.fallbackArt}`);
  if (entry.status === 'placeholder' && !entry.tuanjieProjectHint.trim()) {
    errors.push(`${prefix}: placeholder missing tuanjieProjectHint`);
  }
  if (entry.kind === 'character' && !REQUIRED_CHARACTER_IDS.has(entry.sourceId)) {
    errors.push(`${prefix}: character sourceId is not in characters.json`);
  }

  return errors;
}

function main(): void {
  const errors: string[] = [];
  const seen = new Set<string>();

  TUANJIE_MODEL_MANIFEST.forEach((entry, index) => {
    if (seen.has(entry.modelId)) {
      errors.push(`${entry.modelId}: duplicate modelId`);
    }
    seen.add(entry.modelId);
    errors.push(...validateEntry(entry, index));
  });

  const manifestCharacterIds = new Set(
    TUANJIE_MODEL_MANIFEST
      .filter((entry) => entry.kind === 'character')
      .map((entry) => entry.sourceId),
  );
  for (const characterId of REQUIRED_CHARACTER_IDS) {
    if (!manifestCharacterIds.has(characterId)) {
      errors.push(`character_${characterId}: missing Tuanjie character placeholder`);
    }
  }

  const report: ManifestCheckReport = {
    timestamp: new Date().toISOString(),
    total: TUANJIE_MODEL_MANIFEST.length,
    passed: errors.length === 0,
    errors,
  };

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`Tuanjie asset manifest entries: ${report.total}`);
  console.log(`Report: ${REPORT_PATH}`);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log('Tuanjie asset manifest check passed');
}

main();
