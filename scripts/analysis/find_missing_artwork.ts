#!/usr/bin/env node
/**
 * @file find_missing_artwork.ts
 * @description Scans cards.json against existing card art files to find missing artwork.
 *
 * 主要职责:
 * - 读取卡牌数据与现有美术资源
 * - 报告缺失的卡牌美术文件
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..', '..');
const cardsDataPath = path.join(projectRoot, 'src', 'content', 'data', 'cards.json');
const cardsAssetsPath = path.join(projectRoot, 'public', 'assets', 'cards');
const outputPath = path.join(projectRoot, 'output', 'missing_artwork.json');

console.log('Reading cards data...');
const cardsData = JSON.parse(readFileSync(cardsDataPath, 'utf-8'));
console.log(`Found ${cardsData.length} cards in cards.json`);

console.log('\nReading existing card art...');
const existingFiles = readdirSync(cardsAssetsPath)
  .filter(file => file.endsWith('.png'))
  .map(file => file.replace('.png', ''));
console.log(`Found ${existingFiles.length} existing card art files`);

console.log('\nAnalyzing missing artwork...');
const missingArtwork = [];
const byCharacter = {
  informant: [],
  brute: [],
  tactician: [],
  puppeteer: [],
  chronomancer: [],
  alchemist: [],
  all: []
};

for (const card of cardsData) {
  const hasArtwork = existingFiles.includes(card.id);
  if (!hasArtwork) {
    missingArtwork.push({
      id: card.id,
      name: card.name,
      rarity: card.rarity,
      character: card.character || 'all',
      type: card.type,
      art_prompt: card.art_prompt || null
    });
    
    const charKey = card.character || 'all';
    if (byCharacter[charKey]) {
      byCharacter[charKey].push(card.id);
    } else {
      byCharacter.all.push(card.id);
    }
  }
}

console.log(`\nFound ${missingArtwork.length} cards without artwork`);

console.log('\nBy character:');
for (const [char, ids] of Object.entries(byCharacter)) {
  console.log(`  ${char}: ${ids.length} cards`);
}

if (missingArtwork.length > 0) {
  console.log('\nMissing artwork details (first 20):');
  for (let i = 0; i < Math.min(20, missingArtwork.length); i++) {
    const card = missingArtwork[i];
    console.log(`  ${card.id} - ${card.name} (${card.rarity})`);
  }
  if (missingArtwork.length > 20) {
    console.log(`  ... and ${missingArtwork.length - 20} more`);
  }
}

if (!existsSync(path.dirname(outputPath))) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
}

writeFileSync(outputPath, JSON.stringify({
  totalMissing: missingArtwork.length,
  byCharacter,
  missingArtwork
}, null, 2));

console.log(`\nOutput written to ${outputPath}`);
