const fs = require('fs');
const path = require('path');

const root = process.cwd();
const p = (...s) => path.join(root, ...s);

function readJson(file) {
  return JSON.parse(fs.readFileSync(p(file), 'utf8'));
}
function writeJson(file, data) {
  fs.writeFileSync(p(file), JSON.stringify(data, null, 2) + '\n');
}

const cards = readJson('src/content/cards.json');
const enemies = readJson('src/content/enemies.json');
const characters = readJson('src/content/characters.json');
const potions = readJson('src/content/potions.json');
const relics = readJson('src/content/relics.json');

const changes = { cards: [], enemies: [], characters: [], potions: [], relics: [] };

function patchCard(id, patch) {
  const card = cards.find(c => c.id === id);
  if (!card) throw new Error(`card not found: ${id}`);
  for (const [k, v] of Object.entries(patch)) {
    const before = card[k];
    if (before !== v) {
      card[k] = v;
      changes.cards.push(`${id}.${k}: ${JSON.stringify(before)} -> ${JSON.stringify(v)}`);
    }
  }
}

function patchEnemy(id, mutator) {
  const enemy = enemies.find(e => e.id === id);
  if (!enemy) throw new Error(`enemy not found: ${id}`);
  mutator(enemy, (msg) => changes.enemies.push(`${id}: ${msg}`));
}

function patchCharacter(id, patch) {
  const c = characters.find(x => x.id === id);
  if (!c) throw new Error(`character not found: ${id}`);
  for (const [k, v] of Object.entries(patch)) {
    const before = c[k];
    if (before !== v) {
      c[k] = v;
      changes.characters.push(`${id}.${k}: ${JSON.stringify(before)} -> ${JSON.stringify(v)}`);
    }
  }
}

function patchPotion(id, patch) {
  const item = potions.find(x => x.id === id);
  if (!item) throw new Error(`potion not found: ${id}`);
  for (const [k, v] of Object.entries(patch)) {
    const before = item[k];
    if (before !== v) {
      item[k] = v;
      changes.potions.push(`${id}.${k}: ${JSON.stringify(before)} -> ${JSON.stringify(v)}`);
    }
  }
}

function patchRelic(id, patch) {
  const item = relics.find(x => x.id === id);
  if (!item) throw new Error(`relic not found: ${id}`);
  for (const [k, v] of Object.entries(patch)) {
    const before = item[k];
    if (before !== v) {
      item[k] = v;
      changes.relics.push(`${id}.${k}: ${JSON.stringify(before)} -> ${JSON.stringify(v)}`);
    }
  }
}

// Card rebalance (framework-driven: normalize V_i by cost first, preserve text consistency)
[
  ['acrobatics', { cost: 2 }],
  ['bouncing_flask', { cost: 3 }],
  ['borrowed_time', { cost: 3 }],
  ['temporal_backtrack', { cost: 1 }],
  ['adrenaline', { cost: 1 }],
  ['wire_acrobatics', { cost: 1 }],
  ['temp_worker', { cost: 1 }],
  ['memory_fragment', { cost: 2 }],
  ['go_dark', { cost: 0 }],
  ['double_down', { cost: 1 }],
  ['full_scan', { cost: 0 }],
  ['jamming_signal', { cost: 0 }],
  ['core_rebuild', { cost: 1 }],
  ['chain_reaction', { cost: 1 }],
  ['chronos_rift', { cost: 1 }],
  ['grandfather_paradox', { cost: 2 }],
  ['body_slam', { cost: 0 }],
  ['gear_storm', { cost: 1 }],
  ['turn_the_tables', { cost: 1 }],
  ['soul_link', { rarity: 'Rare' }]
].forEach(([id, patch]) => patchCard(id, patch));

// Character baseline parity (DP anchor normalization via survivability)
patchCharacter('informant', { maxHp: 55 });
patchCharacter('tactician', { maxHp: 62 });
patchCharacter('chronomancer', { maxHp: 68 });
patchCharacter('puppeteer', { maxHp: 60 });

// Potion economy (EUV-aligned pricing)
patchPotion('healing_potion', { price: 45 });
patchPotion('block_potion', { price: 45 });
patchPotion('strength_potion', { price: 60 });
patchPotion('weak_potion', { price: 60 });
patchPotion('energy_potion', { price: 75 });
// New potions (skills.md: rare-card-equivalent EV, toxicity surcharge, variance discount)
patchPotion('combo_brew', { price: 95 });
patchPotion('sacrificial_elixir', { price: 105 });
patchPotion('dice_water', { price: 90 });
patchPotion('liquid_lightning', { price: 100 });
patchPotion('purifying_tears', { price: 110 });
patchPotion('mutagenic_draft', { price: 115 });

// Relic economy (long-run expected value differentiation)
patchRelic('burning_blood', { price: 140 });
patchRelic('anchor', { price: 145 });
patchRelic('vajra', { price: 165 });
patchRelic('lantern', { price: 175 });
patchRelic('bag_of_prep', { price: 190 });
// New relics (skills.md: ΔDP / corruption premium / consistency premium)
patchRelic('zealots_chain', { price: 190 });
patchRelic('heretics_metronome', { price: 200 });
patchRelic('warp_distorter', { price: 225 });
patchRelic('ruined_reactor', { price: 235 });
patchRelic('corrupted_tome', { price: 255 });
patchRelic('mark_of_chaos', { price: 260 });

// Enemy threat budget pass (shift some spike damage into durability/utility; enforce gentler peaks)
patchEnemy('slime_small', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [11, 15]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.tackle[0].amount = 5; log('tackle damage 4 -> 5');
});
patchEnemy('goblin', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [22, 28]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.attack[0].amount = 7; log('attack damage 6 -> 7');
  e.moves.block[0].amount = 6; log('block 5 -> 6');
});
patchEnemy('cultist', (e, log) => {
  e.moves.dark_strike[0].amount = 7; log('dark_strike damage 6 -> 7');
});
patchEnemy('jaw_worm', (e, log) => {
  e.moves.chomp[0].amount = 10; log('chomp damage 11 -> 10');
  e.moves.thrash[0].amount = 6; log('thrash damage 7 -> 6');
  e.moves.thrash[1].amount = 6; log('thrash block 5 -> 6');
  e.moves.bellow[1].amount = 2; log('bellow strength 3 -> 2');
});
patchEnemy('gremlin_nob', (e, log) => {
  e.moves.rush[0].amount = 13; log('rush damage 14 -> 13');
  e.moves.skull_bash[0].amount = 7; log('skull_bash damage 6 -> 7');
});
patchEnemy('lagavulin', (e, log) => {
  e.moves.attack[0].amount = 16; log('attack damage 18 -> 16');
});
patchEnemy('slime_boss', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [150, 165]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.slam[0].amount = 16; log('slam damage 18 -> 16');
  e.moves.prep[0].amount = 18; log('prep block 15 -> 18');
});
patchEnemy('predictor', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [34, 40]; log(`hp_range ${before} -> ${e.hp_range}`);
});
patchEnemy('fission', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [42, 48]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.pulse[0].amount = 7; log('pulse damage 8 -> 7');
});
patchEnemy('barrier', (e, log) => {
  e.moves.shield_bash[0].amount = 6; log('shield_bash damage 5 -> 6');
  e.moves.fortify[0].amount = 14; log('fortify block 12 -> 14');
});
patchEnemy('alchemy_master', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [210, 230]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.brew_acid[0].amount = 4; log('brew_acid poison 3 -> 4');
  e.moves.throw_concoction[0].amount = 14; log('throw_concoction damage 15 -> 14');
});
patchEnemy('time_guardian', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [250, 275]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.time_strike[0].amount = 16; log('time_strike damage 18 -> 16');
  e.moves.rewind[0].amount = 24; log('rewind heal 20 -> 24');
});
patchEnemy('puppet_queen', (e, log) => {
  const before = [...e.hp_range]; e.hp_range = [190, 215]; log(`hp_range ${before} -> ${e.hp_range}`);
  e.moves.command[0].amount = 3; log('command buff 2 -> 3');
});

writeJson('src/content/cards.json', cards);
writeJson('src/content/enemies.json', enemies);
writeJson('src/content/characters.json', characters);
writeJson('src/content/potions.json', potions);
writeJson('src/content/relics.json', relics);

const report = [];
report.push('# Balance Pass Report (skills.md framework)');
report.push('');
report.push('Date: 2026-02-24');
report.push('');
report.push('Method: cost-first card normalization (preserve text sync), role-based threat budget pass for enemies, DP baseline HP alignment for characters, EUV-based economy repricing for potions/relics. Second pass adds toxicity surcharge (potions), corruption premium/discount (relics), and variance discount for chaos items, following skills.md.');
for (const key of ['cards','enemies','characters','potions','relics']) {
  report.push('');
  report.push(`## ${key}`);
  if (changes[key].length === 0) report.push('- no changes');
  else for (const line of changes[key]) report.push(`- ${line}`);
}
fs.writeFileSync(p('balance_report.md'), report.join('\n') + '\n');

console.log('Rebalanced content.');
for (const k of Object.keys(changes)) console.log(k, changes[k].length);
