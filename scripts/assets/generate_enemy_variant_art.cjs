#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const outDir = path.join(rootDir, 'public', 'assets', 'enemies');
const sourceDir = path.join(outDir, 'source');
const manifestPath = path.join(sourceDir, 'enemy_variant_phase1_manifest.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const variants = [
  {
    id: 'slime_small_glass',
    name: 'Glass Slime',
    prompt: 'A crystalline slime with stained-glass shards, cyan core glow, grimdark fantasy enemy portrait, dark cavern backdrop, card game standee art',
    render: () => `
      <path d="M120 360 C110 250 180 150 256 148 C350 146 404 220 392 350 C388 400 348 438 256 438 C168 438 126 408 120 360 Z" fill="url(#bodyGlow)" stroke="#84f6ff" stroke-width="8"/>
      <path d="M198 138 L228 72 L270 138 Z" fill="#b6f6ff" opacity="0.88"/>
      <path d="M246 132 L300 54 L338 160 Z" fill="#6ef1ff" opacity="0.8"/>
      <path d="M154 188 L196 106 L222 220 Z" fill="#8ef8ff" opacity="0.72"/>
      <circle cx="214" cy="260" r="14" fill="#09111f"/>
      <circle cx="304" cy="252" r="16" fill="#09111f"/>
      <path d="M210 324 Q254 350 316 316" fill="none" stroke="#e8ffff" stroke-width="12" stroke-linecap="round"/>
      <path d="M140 390 C176 420 340 436 380 382" fill="none" stroke="#c2f9ff" stroke-width="10" opacity="0.45"/>
    `,
    defs: `
      <radialGradient id="bodyGlow" cx="50%" cy="32%" r="72%">
        <stop offset="0%" stop-color="#96feff"/>
        <stop offset="54%" stop-color="#3dc5ff"/>
        <stop offset="100%" stop-color="#10304b"/>
      </radialGradient>
    `,
  },
  {
    id: 'slime_small_rot',
    name: 'Rot-Bloom Slime',
    prompt: 'A diseased slime blooming with toxic spores and bone fragments, sickly green glow, grimdark fantasy enemy portrait, swamp haze, card game standee art',
    render: () => `
      <path d="M110 354 C118 254 176 146 256 144 C348 142 412 214 406 348 C402 412 342 446 250 446 C160 446 102 414 110 354 Z" fill="url(#rotBody)" stroke="#d7ff74" stroke-width="8"/>
      <circle cx="174" cy="176" r="34" fill="#b6db35" opacity="0.45"/>
      <circle cx="332" cy="210" r="28" fill="#8eb318" opacity="0.52"/>
      <circle cx="216" cy="272" r="16" fill="#0f1907"/>
      <circle cx="304" cy="264" r="18" fill="#0f1907"/>
      <path d="M194 330 Q256 372 326 324" fill="none" stroke="#f7ffd1" stroke-width="11" stroke-linecap="round"/>
      <path d="M132 386 C176 418 330 440 386 390" fill="none" stroke="#efffb2" stroke-width="10" opacity="0.4"/>
      <path d="M132 292 L176 250 L194 338 Z" fill="#cbbd9d" opacity="0.8"/>
      <circle cx="350" cy="150" r="22" fill="#d8ff6c" opacity="0.24"/>
      <circle cx="386" cy="198" r="12" fill="#d8ff6c" opacity="0.24"/>
    `,
    defs: `
      <radialGradient id="rotBody" cx="45%" cy="28%" r="74%">
        <stop offset="0%" stop-color="#c4ff72"/>
        <stop offset="52%" stop-color="#5f8a16"/>
        <stop offset="100%" stop-color="#17250a"/>
      </radialGradient>
    `,
  },
  {
    id: 'goblin_trapper',
    name: 'Goblin Wirebinder',
    prompt: 'A hooded goblin trapper with a snare launcher and taut wire loops, orange torchlight, grimdark mine portrait, card game standee art',
    render: () => `
      <path d="M132 420 L170 172 L252 108 L334 160 L384 420 Z" fill="#34211a" stroke="#f38b3f" stroke-width="8"/>
      <path d="M170 180 Q250 52 336 178 L300 232 Q250 196 196 236 Z" fill="#4d2f24"/>
      <path d="M208 256 C226 224 282 222 306 256 C330 290 322 344 252 372 C184 342 186 288 208 256 Z" fill="#6c8d4e" stroke="#e2f6b0" stroke-width="6"/>
      <circle cx="230" cy="284" r="12" fill="#0b0d08"/>
      <circle cx="278" cy="280" r="12" fill="#0b0d08"/>
      <path d="M216 326 Q252 346 290 320" fill="none" stroke="#fef5d1" stroke-width="8" stroke-linecap="round"/>
      <path d="M92 206 L172 244" stroke="#d8c08f" stroke-width="9" stroke-linecap="round"/>
      <path d="M100 198 L108 130 L164 184 Z" fill="#7a5a43"/>
      <circle cx="110" cy="188" r="44" fill="none" stroke="#b8ccb0" stroke-width="7" opacity="0.82"/>
      <path d="M328 222 L430 262" stroke="#d0b27b" stroke-width="9" stroke-linecap="round"/>
      <circle cx="404" cy="250" r="28" fill="none" stroke="#d0b27b" stroke-width="6" opacity="0.7"/>
    `,
    defs: '',
  },
  {
    id: 'barrier_redeemer',
    name: 'Redeemer Bulwark',
    prompt: 'A red-cloaked shield sentinel carrying a lantern and redemption sigils, heavy plate armor, grimdark mechanized chapel portrait, card game standee art',
    render: () => `
      <path d="M166 428 L196 176 L256 112 L318 172 L348 428 Z" fill="#3a4554" stroke="#c8d9f4" stroke-width="8"/>
      <path d="M220 116 L256 74 L292 116" fill="none" stroke="#f5d07a" stroke-width="10" stroke-linecap="round"/>
      <path d="M136 190 L90 428 L204 428 L230 188 Z" fill="#7d1f1d" stroke="#ff9b7d" stroke-width="7"/>
      <path d="M326 172 C374 194 416 258 404 334 C392 408 334 438 292 434 L304 188 Z" fill="#596370" stroke="#dce9f9" stroke-width="8"/>
      <path d="M332 232 C364 208 396 224 398 280 C398 338 364 392 322 402 Z" fill="#a5b7c7" opacity="0.92"/>
      <circle cx="248" cy="236" r="18" fill="#0d1017"/>
      <circle cx="286" cy="236" r="18" fill="#0d1017"/>
      <path d="M234 294 Q266 312 304 294" fill="none" stroke="#ecf1ff" stroke-width="8" stroke-linecap="round"/>
      <path d="M118 198 L98 254 L136 298 L174 254 Z" fill="#f4b94a" stroke="#fff1b3" stroke-width="6"/>
      <circle cx="136" cy="254" r="18" fill="#fff2a8" opacity="0.78"/>
    `,
    defs: '',
  },
  {
    id: 'cultist_herald',
    name: 'Ashen Herald',
    prompt: 'A masked cult herald swinging a burning censer, purple ash halo, occult grimdark portrait, ritual altar lighting, card game standee art',
    render: () => `
      <path d="M158 430 L194 176 L256 98 L320 176 L356 430 Z" fill="#2d1636" stroke="#e178ff" stroke-width="8"/>
      <path d="M188 182 Q254 64 326 182 L300 230 Q256 204 214 230 Z" fill="#4f1d65"/>
      <path d="M204 238 C224 208 284 206 308 238 C332 270 324 338 256 372 C188 340 184 272 204 238 Z" fill="#5b4357" stroke="#f9d8ff" stroke-width="6"/>
      <circle cx="232" cy="274" r="12" fill="#0c0711"/>
      <circle cx="284" cy="272" r="12" fill="#0c0711"/>
      <path d="M220 322 Q256 340 294 320" fill="none" stroke="#f9e1ff" stroke-width="8" stroke-linecap="round"/>
      <circle cx="256" cy="116" r="94" fill="none" stroke="#a53dff" stroke-width="10" opacity="0.22"/>
      <path d="M332 256 L404 210" stroke="#d2b8a7" stroke-width="8" stroke-linecap="round"/>
      <path d="M390 186 C418 208 420 250 394 276 C370 252 366 208 390 186 Z" fill="#f29131" stroke="#ffe29d" stroke-width="6"/>
      <circle cx="390" cy="204" r="14" fill="#fff2a8" opacity="0.86"/>
    `,
    defs: '',
  },
  {
    id: 'jaw_worm_burrower',
    name: 'Burrow Maw',
    prompt: 'A sand-burrowing jaw worm erupting with a bone maw and ridge spines, dusty cavern palette, grimdark beast portrait, card game standee art',
    render: () => `
      <path d="M106 354 C132 220 224 122 320 116 C390 110 426 160 406 248 C390 322 334 430 224 448 C146 460 88 418 106 354 Z" fill="#7a5a3b" stroke="#dcc7a3" stroke-width="8"/>
      <path d="M220 244 C248 192 314 184 346 214 C378 244 366 318 306 356 C236 356 194 304 220 244 Z" fill="#321711" stroke="#efdbc5" stroke-width="6"/>
      <path d="M232 236 L216 296 L252 340" fill="none" stroke="#f8e2c9" stroke-width="10" stroke-linecap="round"/>
      <path d="M332 232 L348 296 L308 340" fill="none" stroke="#f8e2c9" stroke-width="10" stroke-linecap="round"/>
      <circle cx="246" cy="226" r="10" fill="#0f0905"/>
      <circle cx="320" cy="220" r="11" fill="#0f0905"/>
      <path d="M170 184 L216 108 L238 190 Z" fill="#c7b090" opacity="0.9"/>
      <path d="M260 98 L296 44 L320 136 Z" fill="#d5c4a1" opacity="0.86"/>
      <path d="M326 120 L368 70 L378 168 Z" fill="#bda888" opacity="0.86"/>
      <circle cx="126" cy="386" r="36" fill="#c4935b" opacity="0.25"/>
      <circle cx="160" cy="410" r="22" fill="#c4935b" opacity="0.25"/>
    `,
    defs: '',
  },
];

function wrapSvg({ name, defs, render }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f16"/>
      <stop offset="58%" stop-color="#1a1f2d"/>
      <stop offset="100%" stop-color="#08090f"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    ${defs}
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="240" r="208" fill="#111827" opacity="0.4"/>
  <circle cx="256" cy="210" r="170" fill="#1a2332" opacity="0.45"/>
  <g filter="url(#shadow)">
    ${render()}
  </g>
  <rect x="0" y="0" width="512" height="512" fill="url(#vignette)"/>
  <rect x="24" y="24" width="464" height="464" rx="24" fill="none" stroke="#d5b98b" stroke-opacity="0.18" stroke-width="3"/>
  <path d="M54 446 Q256 478 458 446" fill="none" stroke="#b78a5a" stroke-opacity="0.2" stroke-width="8"/>
</svg>`;
}

function main() {
  ensureDir(outDir);
  ensureDir(sourceDir);

  const manifest = [];
  for (const variant of variants) {
    const svgPath = path.join(sourceDir, `${variant.id}.svg`);
    const pngPath = path.join(outDir, `${variant.id}.png`);
    fs.writeFileSync(svgPath, wrapSvg(variant), 'utf8');
    execFileSync('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath], { stdio: 'ignore' });
    manifest.push({
      id: variant.id,
      name: variant.name,
      prompt: variant.prompt,
      svg: path.relative(rootDir, svgPath),
      png: path.relative(rootDir, pngPath),
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), variants: manifest }, null, 2));
  console.log(`Generated ${variants.length} enemy variant art assets.`);
}

main();
