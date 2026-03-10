#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', '..');
const cardsPath = path.join(baseDir, 'src', 'content', 'data', 'cards.json');
const cardsDir = path.join(baseDir, 'public', 'assets', 'cards');
const missingArtworkPath = path.join(baseDir, 'output', 'missing_artwork.json');

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));
const missingArtwork = JSON.parse(fs.readFileSync(missingArtworkPath, 'utf-8'));

const characterColors = {
  'informant': '#3b82f6',
  'brute': '#ef4444',
  'tactician': '#22c55e',
  'chronomancer': '#8b5cf6',
  'puppeteer': '#f59e0b',
  'alchemist': '#ec4899',
  'all': '#94a3b8'
};

const typeIcons = {
  'Attack': '⚔',
  'Skill': '✨',
  'Power': '💎',
  'Status': '📜'
};

function generateSVG(name, color, icon, subtitle, size = 256) {
  const safeName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.4"/>
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:0.9"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size/16}"/>
  <rect x="${size/32}" y="${size/32}" width="${size - size/16}" height="${size - size/16}" fill="none" stroke="${color}" stroke-width="2" rx="${size/24}" opacity="0.6"/>
  <text x="${size/2}" y="${size/2 - 10}" text-anchor="middle" font-family="serif" font-size="${size/4}" fill="${color}" filter="url(#glow)">${icon}</text>
  <text x="${size/2}" y="${size/2 + size/5}" text-anchor="middle" font-family="sans-serif" font-size="${size/18}" fill="#a0a0a0">${safeName}</text>
  <text x="${size/2}" y="${size/2 + size/3}" text-anchor="middle" font-family="sans-serif" font-size="${size/24}" fill="#666">${subtitle}</text>
</svg>`;
}

let created = 0;
let skipped = 0;

for (const card of missingArtwork.missingArtwork) {
  const filepath = path.join(cardsDir, `${card.id}.png`);
  if (!fs.existsSync(filepath)) {
    const fullCard = cards.find(c => c.id === card.id);
    const color = characterColors[card.character.toLowerCase()] || characterColors['all'];
    const icon = typeIcons[card.type] || '🎴';
    const subtitle = card.rarity || 'Card';
    
    const svg = generateSVG(card.id, color, icon, subtitle);
    fs.writeFileSync(filepath, svg);
    console.log(`Created: ${card.id}.png (${card.name})`);
    created++;
  } else {
    console.log(`Skipped: ${card.id}.png (already exists)`);
    skipped++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Created: ${created} new card art files`);
console.log(`Skipped: ${skipped} existing card art files`);
