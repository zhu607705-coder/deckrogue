#!/usr/bin/env node
/**
 * 地图图标生成脚本
 * 生成高质量的 SVG 图标作为 PNG 的临时替代
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const icons = [
  {
    name: 'map_combat',
    color: '#dc2626',
    icon: '⚔️',
    label: 'Combat'
  },
  {
    name: 'map_elite',
    color: '#f59e0b',
    icon: '💀',
    label: 'Elite'
  },
  {
    name: 'map_event',
    color: '#a855f7',
    icon: '📜',
    label: 'Event'
  },
  {
    name: 'map_shop',
    color: '#eab308',
    icon: '💰',
    label: 'Shop'
  },
  {
    name: 'map_rest',
    color: '#f97316',
    icon: '🔥',
    label: 'Rest'
  },
  {
    name: 'map_boss',
    color: '#b91c1c',
    icon: '👑',
    label: 'Boss'
  }
];

const generateSVG = ({ color, icon, label }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg-${label}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:0.95"/>
    </linearGradient>
    <filter id="glow-${label}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="outer-glow-${label}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="blur" in2="SourceGraphic" operator="over"/>
    </filter>
  </defs>
  
  <!-- 背景 -->
  <rect width="128" height="128" fill="url(#bg-${label})" rx="12"/>
  
  <!-- 外边框发光 -->
  <rect x="2" y="2" width="124" height="124" fill="none" stroke="${color}" stroke-width="1" rx="10" opacity="0.3" filter="url(#outer-glow-${label})"/>
  
  <!-- 内边框 -->
  <rect x="4" y="4" width="120" height="120" fill="none" stroke="${color}" stroke-width="2" rx="8" opacity="0.6"/>
  
  <!-- 装饰角标 -->
  <path d="M 8 20 L 8 8 L 20 8" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>
  <path d="M 108 8 L 120 8 L 120 20" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>
  <path d="M 8 108 L 8 120 L 20 120" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>
  <path d="M 108 120 L 120 120 L 120 108" fill="none" stroke="${color}" stroke-width="2" opacity="0.8"/>
  
  <!-- 图标 -->
  <text x="64" y="56" text-anchor="middle" font-family="serif" font-size="40" fill="${color}" filter="url(#glow-${label})">${icon}</text>
  
  <!-- 标签 -->
  <text x="64" y="95" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#a0a0a0" font-weight="500">${label}</text>
</svg>
`;

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'map');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 生成每个图标
icons.forEach(({ name, ...props }) => {
  const svg = generateSVG(props);
  const outputPath = path.join(outputDir, `${name}.svg`);
  fs.writeFileSync(outputPath, svg.trim());
  console.log(`✓ Generated ${name}.svg`);
});

console.log(`\n✅ All map icons generated in ${outputDir}`);
console.log('\nNote: These are SVG placeholders. To generate high-quality PNG images:');
console.log('1. Use the prompts in docs/asset_generation.md');
console.log('2. Generate images with AI tools (Midjourney, DALL-E, etc.)');
console.log('3. Save as PNG in the same directory');
