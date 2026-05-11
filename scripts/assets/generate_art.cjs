#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const cardsDir = path.join(baseDir, 'assets', 'cards');
const relicsDir = path.join(baseDir, 'assets', 'relics');
const mapDir = path.join(baseDir, 'assets', 'map');
const eventsDir = path.join(baseDir, 'assets', 'events');
const shopDir = path.join(baseDir, 'assets', 'shop');
const backgroundsDir = path.join(baseDir, 'assets', 'backgrounds');
const restDir = path.join(baseDir, 'assets', 'rest');
const rewardDir = path.join(baseDir, 'assets', 'reward');
const charSelectDir = path.join(baseDir, 'assets', 'char_select');
const upgradeDir = path.join(baseDir, 'assets', 'upgrade');

// 确保目录存在
[cardsDir, relicsDir, mapDir, eventsDir, shopDir, backgroundsDir, restDir, rewardDir, charSelectDir, upgradeDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// SVG 模板生成函数
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

// 战斗背景生成函数
function generateBattleBackground(name, primaryColor, secondaryColor, accentColor, style) {
  const patterns = {
    'gothic': `
      <defs>
        <pattern id="gothicPattern" patternUnits="userSpaceOnUse" width="40" height="40">
          <path d="M0 20 L20 0 L40 20 L20 40 Z" fill="none" stroke="${secondaryColor}" stroke-width="1" opacity="0.2"/>
        </pattern>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.8"/>
          <stop offset="50%" style="stop-color:#0a0a0f;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:0.6"/>
        </linearGradient>
        <filter id="bloodDrip">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5"/>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#bgGrad)"/>
      <rect width="1024" height="768" fill="url(#gothicPattern)"/>
      <circle cx="100" cy="100" r="30" fill="${accentColor}" opacity="0.1"/>
      <circle cx="900" cy="650" r="50" fill="${accentColor}" opacity="0.08"/>
      <path d="M0 700 Q256 650 512 700 T1024 700 L1024 768 L0 768 Z" fill="${secondaryColor}" opacity="0.3"/>
    `,
    'chaos': `
      <defs>
        <radialGradient id="chaosGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.4"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </radialGradient>
        <filter id="warp">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="#0a0a0f"/>
      <rect width="1024" height="768" fill="url(#chaosGrad)" filter="url(#warp)"/>
      <circle cx="512" cy="384" r="150" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.2"/>
      <circle cx="512" cy="384" r="200" fill="none" stroke="${accentColor}" stroke-width="1" opacity="0.1" stroke-dasharray="10 5"/>
    `,
    'forge': `
      <defs>
        <linearGradient id="forgeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.9"/>
          <stop offset="40%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#forgeGrad)"/>
      <rect x="0" y="600" width="1024" height="168" fill="${secondaryColor}" opacity="0.4"/>
      <circle cx="512" cy="700" r="80" fill="${accentColor}" opacity="0.6"/>
      <circle cx="512" cy="700" r="50" fill="${accentColor}" opacity="0.8"/>
    `,
    'void': `
      <defs>
        <radialGradient id="voidGrad" cx="20%" cy="20%" r="80%">
          <stop offset="0%" style="stop-color:${secondaryColor};stop-opacity:0.2"/>
          <stop offset="100%" style="stop-color:#000000;stop-opacity:1"/>
        </radialGradient>
        <filter id="starfield">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" result="noise"/>
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.1 0"/>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="#000000"/>
      <rect width="1024" height="768" fill="url(#voidGrad)"/>
      <rect width="1024" height="768" fill="#ffffff" filter="url(#starfield)" opacity="0.3"/>
      <circle cx="150" cy="200" r="3" fill="${accentColor}" opacity="0.8"/>
      <circle cx="800" cy="150" r="2" fill="${accentColor}" opacity="0.6"/>
      <circle cx="900" cy="500" r="4" fill="${accentColor}" opacity="0.7"/>
      <circle cx="200" cy="600" r="2" fill="${accentColor}" opacity="0.5"/>
    `,
    'temple': `
      <defs>
        <linearGradient id="templeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.4"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#templeGrad)"/>
      <path d="M100 768 L100 400 L200 300 L300 400 L300 768 Z" fill="${secondaryColor}" opacity="0.2"/>
      <path d="M724 768 L724 400 L824 300 L924 400 L924 768 Z" fill="${secondaryColor}" opacity="0.2"/>
      <path d="M350 768 L450 350 L574 350 L674 768 Z" fill="${secondaryColor}" opacity="0.3"/>
      <rect x="0" y="700" width="1024" height="68" fill="${secondaryColor}" opacity="0.4"/>
    `,
    'plague_reliquary': `
      <defs>
        <radialGradient id="plague_reliquaryGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="768" fill="#0a0a0f"/>
      <rect width="1024" height="768" fill="url(#plague_reliquaryGrad)"/>
      <circle cx="200" cy="500" r="40" fill="${primaryColor}" opacity="0.3"/>
      <circle cx="800" cy="400" r="60" fill="${primaryColor}" opacity="0.25"/>
      <circle cx="500" cy="600" r="50" fill="${primaryColor}" opacity="0.35"/>
      <circle cx="150" cy="250" r="25" fill="${accentColor}" opacity="0.4"/>
      <circle cx="850" cy="650" r="35" fill="${accentColor}" opacity="0.3"/>
    `,
    'oathbound': `
      <defs>
        <linearGradient id="oathboundGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.6"/>
          <stop offset="50%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:0.5"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#oathboundGrad)"/>
      <path d="M512 100 L532 180 L620 180 L550 230 L575 310 L512 260 L449 310 L474 230 L404 180 L492 180 Z" fill="${accentColor}" opacity="0.15"/>
      <rect x="0" y="680" width="1024" height="88" fill="${secondaryColor}" opacity="0.25"/>
    `,
    'necron': `
      <defs>
        <linearGradient id="necronGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#0a0a0f;stop-opacity:1"/>
          <stop offset="50%" style="stop-color:${secondaryColor};stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#necronGrad)"/>
      <line x1="0" y1="200" x2="1024" y2="200" stroke="${accentColor}" stroke-width="1" opacity="0.3"/>
      <line x1="0" y1="350" x2="1024" y2="350" stroke="${accentColor}" stroke-width="1" opacity="0.2"/>
      <line x1="0" y1="500" x2="1024" y2="500" stroke="${accentColor}" stroke-width="1" opacity="0.3"/>
      <rect x="0" y="0" width="2" height="768" fill="${accentColor}" opacity="0.2" x="100"/>
      <rect x="200" y="0" width="2" height="768" fill="${accentColor}" opacity="0.2"/>
      <rect x="400" y="0" width="2" height="768" fill="${accentColor}" opacity="0.2"/>
      <rect x="600" y="0" width="2" height="768" fill="${accentColor}" opacity="0.2"/>
      <rect x="800" y="0" width="2" height="768" fill="${accentColor}" opacity="0.2"/>
      <rect x="1000" y="0" width="2" height="768" fill="${accentColor}" opacity="0.2"/>
    `
  };
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
    ${patterns[style] || patterns['gothic']}
  </svg>`;
}

// 商店背景生成函数
function generateShopBackground(name, style) {
  const styles = {
    'forge': `
      <defs>
        <linearGradient id="shopGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:#78350f;stop-opacity:0.8"/>
          <stop offset="50%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
        <filter id="forgeGlow">
          <feGaussianBlur stdDeviation="3" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#shopGrad)"/>
      <rect x="50" y="200" width="150" height="400" fill="#1a1a1a" opacity="0.6" rx="10"/>
      <rect x="824" y="200" width="150" height="400" fill="#1a1a1a" opacity="0.6" rx="10"/>
      <circle cx="512" cy="650" r="100" fill="#f59e0b" opacity="0.3" filter="url(#forgeGlow)"/>
      <rect x="0" y="700" width="1024" height="68" fill="#78350f" opacity="0.4"/>
      <text x="512" y="100" text-anchor="middle" font-family="serif" font-size="48" fill="#f59e0b" opacity="0.3">⚙</text>
    `,
    'trade': `
      <defs>
        <linearGradient id="tradeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="50%" style="stop-color:#1e3a5f;stop-opacity:0.8"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#tradeGrad)"/>
      <rect x="100" y="150" width="200" height="300" fill="#1a1a1a" opacity="0.5" rx="15"/>
      <rect x="724" y="150" width="200" height="300" fill="#1a1a1a" opacity="0.5" rx="15"/>
      <rect x="0" y="680" width="1024" height="88" fill="#b45309" opacity="0.3"/>
      <circle cx="512" cy="384" r="80" fill="#fbbf24" opacity="0.1"/>
      <text x="512" y="80" text-anchor="middle" font-family="serif" font-size="36" fill="#fbbf24" opacity="0.4">🏛</text>
    `,
    'black': `
      <defs>
        <radialGradient id="blackGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:#2d1a3d;stop-opacity:0.6"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </radialGradient>
        <filter id="shadowGlow">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#blackGrad)"/>
      <circle cx="200" cy="300" r="60" fill="#7c3aed" opacity="0.15" filter="url(#shadowGlow)"/>
      <circle cx="800" cy="400" r="80" fill="#a855f7" opacity="0.1" filter="url(#shadowGlow)"/>
      <rect x="0" y="700" width="1024" height="68" fill="#1a1a2e" opacity="0.5"/>
      <text x="512" y="100" text-anchor="middle" font-family="serif" font-size="42" fill="#a855f7" opacity="0.3">👁</text>
    `
  };
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
    ${styles[style] || styles['trade']}
  </svg>`;
}

// 篝火背景生成函数
function generateRestBackground(name, style) {
  const styles = {
    'camp': `
      <defs>
        <linearGradient id="campGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:#7c2d12;stop-opacity:0.6"/>
          <stop offset="40%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
        <filter id="fireGlow">
          <feGaussianBlur stdDeviation="8" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#campGrad)"/>
      <circle cx="512" cy="550" r="120" fill="#f97316" opacity="0.4" filter="url(#fireGlow)"/>
      <circle cx="512" cy="550" r="80" fill="#fbbf24" opacity="0.5" filter="url(#fireGlow)"/>
      <circle cx="512" cy="550" r="40" fill="#fef3c7" opacity="0.6"/>
      <rect x="0" y="650" width="1024" height="118" fill="#1a1a1a" opacity="0.4"/>
      <path d="M100 768 L100 550 L200 450 L300 550 L300 768 Z" fill="#1a1a1a" opacity="0.3"/>
      <path d="M724 768 L724 550 L824 450 L924 550 L924 768 Z" fill="#1a1a1a" opacity="0.3"/>
    `,
    'wasteland': `
      <defs>
        <linearGradient id="wasteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a0a0a;stop-opacity:1"/>
          <stop offset="50%" style="stop-color:#2d1a1a;stop-opacity:0.9"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
        <filter id="chaosFire">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#wasteGrad)"/>
      <circle cx="512" cy="500" r="100" fill="#dc2626" opacity="0.3" filter="url(#chaosFire)"/>
      <circle cx="512" cy="500" r="60" fill="#a855f7" opacity="0.4" filter="url(#chaosFire)"/>
      <path d="M0 600 Q256 550 512 600 T1024 600 L1024 768 L0 768 Z" fill="#1a0a0a" opacity="0.5"/>
      <circle cx="200" cy="200" r="30" fill="#7c3aed" opacity="0.2"/>
      <circle cx="800" cy="300" r="40" fill="#a855f7" opacity="0.15"/>
    `,
    'station': `
      <defs>
        <linearGradient id="stationGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:#78350f;stop-opacity:0.7"/>
          <stop offset="50%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
        <filter id="techGlow">
          <feGaussianBlur stdDeviation="4" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#stationGrad)"/>
      <circle cx="512" cy="500" r="100" fill="#f59e0b" opacity="0.4" filter="url(#techGlow)"/>
      <circle cx="512" cy="500" r="60" fill="#fbbf24" opacity="0.5" filter="url(#techGlow)"/>
      <line x1="0" y1="200" x2="1024" y2="200" stroke="#f59e0b" stroke-width="1" opacity="0.2"/>
      <line x1="0" y1="400" x2="1024" y2="400" stroke="#f59e0b" stroke-width="1" opacity="0.15"/>
      <rect x="0" y="650" width="1024" height="118" fill="#1a1a1a" opacity="0.5"/>
      <text x="512" y="100" text-anchor="middle" font-family="serif" font-size="48" fill="#f59e0b" opacity="0.2">⚙</text>
    `
  };
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
    ${styles[style] || styles['camp']}
  </svg>`;
}

// 奖励背景生成函数
function generateRewardBackground(name, style) {
  const styles = {
    'loot': `
      <defs>
        <linearGradient id="lootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="50%" style="stop-color:#2d2d1a;stop-opacity:0.9"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
        <filter id="goldShine">
          <feGaussianBlur stdDeviation="3" result="shine"/>
          <feMerge><feMergeNode in="shine"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#lootGrad)"/>
      <circle cx="300" cy="400" r="50" fill="#fbbf24" opacity="0.2" filter="url(#goldShine)"/>
      <circle cx="700" cy="350" r="40" fill="#fbbf24" opacity="0.15" filter="url(#goldShine)"/>
      <circle cx="500" cy="500" r="60" fill="#f59e0b" opacity="0.25" filter="url(#goldShine)"/>
      <rect x="0" y="700" width="1024" height="68" fill="#1a1a1a" opacity="0.4"/>
      <text x="512" y="150" text-anchor="middle" font-family="serif" font-size="64" fill="#fbbf24" opacity="0.3">💎</text>
    `,
    'vault': `
      <defs>
        <linearGradient id="vaultGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
        <filter id="vaultGlow">
          <feGaussianBlur stdDeviation="5" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="768" fill="url(#vaultGrad)"/>
      <rect x="200" y="200" width="624" height="400" fill="#1a1a1a" opacity="0.4" rx="20"/>
      <rect x="220" y="220" width="584" height="360" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.3" rx="15"/>
      <circle cx="512" cy="400" r="80" fill="#fbbf24" opacity="0.15" filter="url(#vaultGlow)"/>
      <rect x="0" y="700" width="1024" height="68" fill="#1a1a1a" opacity="0.5"/>
      <text x="512" y="150" text-anchor="middle" font-family="serif" font-size="48" fill="#fbbf24" opacity="0.3">🏛</text>
    `
  };
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
    ${styles[style] || styles['loot']}
  </svg>`;
}

// 角色选择背景生成函数
function generateCharSelectBackground(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
    <defs>
      <linearGradient id="hallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1"/>
        <stop offset="50%" style="stop-color:#2d1a3d;stop-opacity:0.9"/>
        <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
      </linearGradient>
      <filter id="hallGlow">
        <feGaussianBlur stdDeviation="4" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="1024" height="768" fill="url(#hallGrad)"/>
    <path d="M100 768 L100 300 L200 200 L300 300 L300 768 Z" fill="#1a1a1a" opacity="0.3"/>
    <path d="M724 768 L724 300 L824 200 L924 300 L924 768 Z" fill="#1a1a1a" opacity="0.3"/>
    <path d="M350 768 L450 250 L574 250 L674 768 Z" fill="#1a1a1a" opacity="0.25"/>
    <circle cx="512" cy="200" r="100" fill="#fbbf24" opacity="0.1" filter="url(#hallGlow)"/>
    <rect x="0" y="700" width="1024" height="68" fill="#1a1a1a" opacity="0.4"/>
    <text x="512" y="100" text-anchor="middle" font-family="serif" font-size="56" fill="#fbbf24" opacity="0.3">⚔</text>
    <text x="200" y="500" text-anchor="middle" font-family="serif" font-size="36" fill="#a855f7" opacity="0.2">🛡</text>
    <text x="824" y="500" text-anchor="middle" font-family="serif" font-size="36" fill="#22c55e" opacity="0.2">⚗</text>
  </svg>`;
}

// 升级背景生成函数
function generateUpgradeBackground(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
    <defs>
      <linearGradient id="upgradeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" style="stop-color:#78350f;stop-opacity:0.8"/>
        <stop offset="40%" style="stop-color:#1a1a2e;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        </linearGradient>
      <filter id="forgeGlow">
        <feGaussianBlur stdDeviation="6" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="1024" height="768" fill="url(#upgradeGrad)"/>
    <rect x="350" y="400" width="324" height="200" fill="#1a1a1a" opacity="0.5" rx="10"/>
    <rect x="370" y="420" width="284" height="160" fill="none" stroke="#f59e0b" stroke-width="2" opacity="0.4" rx="8"/>
    <circle cx="512" cy="500" r="60" fill="#f59e0b" opacity="0.3" filter="url(#forgeGlow)"/>
    <circle cx="512" cy="500" r="30" fill="#fbbf24" opacity="0.5" filter="url(#forgeGlow)"/>
    <rect x="0" y="700" width="1024" height="68" fill="#1a1a1a" opacity="0.5"/>
    <text x="512" y="150" text-anchor="middle" font-family="serif" font-size="56" fill="#f59e0b" opacity="0.3">⚒</text>
    <text x="200" y="300" text-anchor="middle" font-family="serif" font-size="32" fill="#f59e0b" opacity="0.2">⚙</text>
    <text x="824" y="300" text-anchor="middle" font-family="serif" font-size="32" fill="#f59e0b" opacity="0.2">⚙</text>
  </svg>`;
}

// 地图节点图标配置
const mapConfigs = [
  { name: 'map_combat', color: '#dc2626', icon: '⚔', subtitle: 'Combat', dir: mapDir },
  { name: 'map_elite', color: '#f59e0b', icon: '💀', subtitle: 'Elite', dir: mapDir },
  { name: 'map_event', color: '#a855f7', icon: '📜', subtitle: 'Event', dir: mapDir },
  { name: 'map_shop', color: '#eab308', icon: '💰', subtitle: 'Merchant', dir: mapDir },
  { name: 'map_rest', color: '#f97316', icon: '🔥', subtitle: 'Rest Site', dir: mapDir },
  { name: 'map_boss', color: '#b91c1c', icon: '👑', subtitle: 'Boss', dir: mapDir },
];

// 事件场景配置
const eventConfigs = [
  { name: 'event_heretic_altar', color: '#7c3aed', icon: '⛩', subtitle: 'Heretic Altar', dir: eventsDir },
  { name: 'event_shrine', color: '#3b82f6', icon: '⛩', subtitle: 'Mysterious Shrine', dir: eventsDir },
  { name: 'event_void_gate', color: '#a855f7', icon: '🌀', subtitle: 'Void Gate', dir: eventsDir },
  { name: 'event_forge', color: '#f59e0b', icon: '⚒', subtitle: 'The Forge', dir: eventsDir },
  { name: 'event_trial', color: '#dc2626', icon: '⚖', subtitle: 'Trial of Faith', dir: eventsDir },
  { name: 'event_warp', color: '#7c3aed', icon: '👁', subtitle: 'Warp Event', dir: eventsDir },
];

// 商店场景配置
const shopConfigs = [
  { name: 'shop_merchant', color: '#eab308', icon: '🏪', subtitle: 'Merchant', dir: shopDir },
];

// 新商店背景配置
const shopBgConfigs = [
  { name: 'shop_forge', style: 'forge', dir: shopDir },
  { name: 'shop_trade', style: 'trade', dir: shopDir },
  { name: 'shop_black', style: 'black', dir: shopDir },
];

// 篝火背景配置
const restConfigs = [
  { name: 'rest_camp', style: 'camp', dir: restDir },
  { name: 'rest_wasteland', style: 'wasteland', dir: restDir },
  { name: 'rest_station', style: 'station', dir: restDir },
];

// 奖励背景配置
const rewardConfigs = [
  { name: 'reward_loot', style: 'loot', dir: rewardDir },
  { name: 'reward_vault', style: 'vault', dir: rewardDir },
];

// 角色选择背景配置
const charSelectConfigs = [
  { name: 'char_select_hall', dir: charSelectDir },
];

// 升级背景配置
const upgradeConfigs = [
  { name: 'upgrade_forge', dir: upgradeDir },
];

// 战斗背景配置
const backgroundConfigs = [
  { name: 'bg_gothic_battlefield', primary: '#1a1a2e', secondary: '#b91c1c', accent: '#dc2626', style: 'gothic', dir: backgroundsDir },
  { name: 'bg_void_breach', primary: '#1a0a2e', secondary: '#4b0082', accent: '#a855f7', style: 'chaos', dir: backgroundsDir },
  { name: 'bg_iron_chapel_forge', primary: '#2d2d1a', secondary: '#78716c', accent: '#f59e0b', style: 'forge', dir: backgroundsDir },
  { name: 'bg_ancient_machine_tomb', primary: '#0a1a0a', secondary: '#3d4f3d', accent: '#22c55e', style: 'necron', dir: backgroundsDir },
  { name: 'bg_plague_garden', primary: '#0a1a0a', secondary: '#1a3d1a', accent: '#22c55e', style: 'plague_reliquary', dir: backgroundsDir },
  { name: 'bg_oathbound_palace', primary: '#1a1a2e', secondary: '#b45309', accent: '#fbbf24', style: 'oathbound', dir: backgroundsDir },
  { name: 'bg_starless_archive', primary: '#0a0a1a', secondary: '#1e3a5f', accent: '#60a5fa', style: 'void', dir: backgroundsDir },
  { name: 'bg_martyr_chapel', primary: '#1a1a1a', secondary: '#b91c1c', accent: '#fbbf24', style: 'temple', dir: backgroundsDir },
];

// 卡牌立绘配置
const cardConfigs = [
  { name: 'gaze_of_the_abyss', color: '#a855f7', icon: '👁', subtitle: 'Warp Corruption', dir: cardsDir },
  { name: 'flesh_tentacle', color: '#dc2626', icon: '🐙', subtitle: 'Entropy Mutation', dir: cardsDir },
  { name: 'chainsword_sweep', color: '#ef4444', icon: '⚔', subtitle: 'Astartes Weapon', dir: cardsDir },
  { name: 'awaken_machine_chorus', color: '#f59e0b', icon: '⚙', subtitle: 'Machine Canticle Power', dir: cardsDir },
  { name: 'overheat', color: '#ef4444', icon: '🔥', subtitle: 'Machine Status', dir: cardsDir },
  { name: 'oathbound_wrath', color: '#fbbf24', icon: '⚡', subtitle: 'Faith Attack', dir: cardsDir },
  { name: 'trial_of_heretics', color: '#dc2626', icon: '⚖', subtitle: 'Inquisition', dir: cardsDir },
];

// 遗物立绘配置
const relicConfigs = [
  { name: 'rot_reliquary_blessing', color: '#22c55e', icon: '🦠', subtitle: 'Rot Reliquary', dir: relicsDir },
  { name: 'machine_canticle_coolant', color: '#3b82f6', icon: '❄', subtitle: 'Machine Canticle', dir: relicsDir },
  { name: 'seal_of_martyrdom', color: '#dc2626', icon: '📜', subtitle: 'Purity Seal', dir: relicsDir },
  { name: 'seal_of_final_purge', color: '#1f2937', icon: '💀', subtitle: 'Purity Seal', dir: relicsDir },
  { name: 'seal_of_defiance', color: '#fbbf24', icon: '🛡', subtitle: 'Purity Seal', dir: relicsDir },
  { name: 'seal_of_machine_vow', color: '#f59e0b', icon: '⚙', subtitle: 'Purity Seal', dir: relicsDir },
];

// 生成函数
function generateAssets(configs, isMapOrEvent = false) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateSVG(
        config.name, 
        config.color, 
        config.icon, 
        config.subtitle,
        isMapOrEvent ? 128 : 256
      );
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

// 战斗背景生成函数
function generateBackgrounds(configs) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateBattleBackground(
        config.name, 
        config.primary, 
        config.secondary, 
        config.accent,
        config.style
      );
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

// 商店背景生成函数
function generateShopBackgrounds(configs) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateShopBackground(config.name, config.style);
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

// 篝火背景生成函数
function generateRestBackgrounds(configs) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateRestBackground(config.name, config.style);
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

// 奖励背景生成函数
function generateRewardBackgrounds(configs) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateRewardBackground(config.name, config.style);
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

// 角色选择背景生成函数
function generateCharSelectBackgrounds(configs) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateCharSelectBackground(config.name);
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

// 升级背景生成函数
function generateUpgradeBackgrounds(configs) {
  let created = 0;
  let skipped = 0;
  
  for (const config of configs) {
    const filepath = path.join(config.dir, `${config.name}.png`);
    if (!fs.existsSync(filepath)) {
      const svg = generateUpgradeBackground(config.name);
      fs.writeFileSync(filepath, svg);
      console.log(`  Created: ${config.name}.png`);
      created++;
    } else {
      skipped++;
    }
  }
  
  return { created, skipped };
}

console.log('=== Generating Map Node Icons ===');
const mapResult = generateAssets(mapConfigs, true);
console.log(`  Created: ${mapResult.created}, Skipped: ${mapResult.skipped}\n`);

console.log('=== Generating Event Backgrounds ===');
const eventResult = generateAssets(eventConfigs, true);
console.log(`  Created: ${eventResult.created}, Skipped: ${eventResult.skipped}\n`);

console.log('=== Generating Shop Backgrounds ===');
const shopResult = generateAssets(shopConfigs, true);
console.log(`  Created: ${shopResult.created}, Skipped: ${shopResult.skipped}\n`);

console.log('=== Generating New Shop Backgrounds ===');
const shopBgResult = generateShopBackgrounds(shopBgConfigs);
console.log(`  Created: ${shopBgResult.created}, Skipped: ${shopBgResult.skipped}\n`);

console.log('=== Generating Rest Backgrounds ===');
const restResult = generateRestBackgrounds(restConfigs);
console.log(`  Created: ${restResult.created}, Skipped: ${restResult.skipped}\n`);

console.log('=== Generating Reward Backgrounds ===');
const rewardResult = generateRewardBackgrounds(rewardConfigs);
console.log(`  Created: ${rewardResult.created}, Skipped: ${rewardResult.skipped}\n`);

console.log('=== Generating Character Select Backgrounds ===');
const charSelectResult = generateCharSelectBackgrounds(charSelectConfigs);
console.log(`  Created: ${charSelectResult.created}, Skipped: ${charSelectResult.skipped}\n`);

console.log('=== Generating Upgrade Backgrounds ===');
const upgradeResult = generateUpgradeBackgrounds(upgradeConfigs);
console.log(`  Created: ${upgradeResult.created}, Skipped: ${upgradeResult.skipped}\n`);

console.log('=== Generating Battle Backgrounds ===');
const bgResult = generateBackgrounds(backgroundConfigs);
console.log(`  Created: ${bgResult.created}, Skipped: ${bgResult.skipped}\n`);

console.log('=== Generating Card Art ===');
const cardResult = generateAssets(cardConfigs);
console.log(`  Created: ${cardResult.created}, Skipped: ${cardResult.skipped}\n`);

console.log('=== Generating Relic Art ===');
const relicResult = generateAssets(relicConfigs);
console.log(`  Created: ${relicResult.created}, Skipped: ${relicResult.skipped}\n`);

const total = mapResult.created + eventResult.created + shopResult.created + shopBgResult.created + restResult.created + rewardResult.created + charSelectResult.created + upgradeResult.created + bgResult.created + cardResult.created + relicResult.created;
console.log(`=== Total: ${total} new assets generated ===`);
