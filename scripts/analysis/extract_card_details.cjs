#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cardsPath = path.join(__dirname, '..', '..', 'src', 'content', 'data', 'cards.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));

const cardIds = [
  'execution_slash', 'rejection_response', 'greed_sin', 'psychic_backlash', 'paranoia',
  'intel_network', 'weak_point_analysis', 'execute_protocol', 'warp_tap',
  'rage_slam', 'armor_break', 'crushing_blow', 'blood_fury',
  'poison_dart', 'toxic_cloud', 'poison_blade', 'lingering_toxin', 'venom_strike', 'execute_target',
  'temporal_acceleration', 'layer_strike', 'temporal_mastery', 'warp_recall', 'temporal_shield',
  'thread_weave', 'reinforced_golem', 'thread_lash', 'construct_army', 'reposition',
  'concoct', 'transmute_life', 'grand_experiment', 'volatile_mixture',
  'intel_surge', 'predictive_strike', 'shadow_meld', 'information_broker', 'deadly_secrets',
  'crushing_blow_all', 'thick_skin', 'berserker_rage', 'last_stand_all', 'unbreakable',
  'fortify_position', 'calculated_risk', 'tactical_superiority', 'perfect_defense', 'checkmate',
  'temporal_stasis', 'paradox_wave', 'future_sight_all', 'eternal_return',
  'marionette_dance', 'soul_binding', 'clockwork_soldier', 'puppet_mastery', 'grand_design',
  'elemental_fusion_all', 'philosopher_stone', 'grand_transmutation', 'catalyst_overload'
];

const characterNames = {
  'informant': '情报者 (Informant)',
  'brute': '蛮人 (Brute)',
  'tactician': '战术家 (Tactician)',
  'chronomancer': '时间法师 (Chronomancer)',
  'puppeteer': '傀儡师 (Puppeteer)',
  'alchemist': '炼金术士 (Alchemist)',
  'All': '通用 (All)'
};

const rarityNames = {
  'Starter': '起始',
  'Common': '普通',
  'Uncommon': '稀有',
  'Rare': '史诗',
  'Special': '特殊'
};

const typeNames = {
  'Attack': '攻击',
  'Skill': '技能',
  'Power': '能力',
  'Status': '状态'
};

console.log('# DeckRogue 卡牌立绘补齐文档\n');
console.log('---');
console.log('');

let currentChar = '';
for (const cardId of cardIds) {
  const card = cards.find(c => c.id === cardId);
  if (!card) continue;

  if (card.character !== currentChar) {
    currentChar = card.character;
    console.log(`## ${characterNames[currentChar] || currentChar}\n`);
  }

  console.log(`### ${card.name} (${card.id})`);
  console.log(`- **类型**: ${typeNames[card.type] || card.type}`);
  console.log(`- **稀有度**: ${rarityNames[card.rarity] || card.rarity}`);
  console.log(`- **费用**: ${card.cost}`);
  if (card.text) {
    console.log(`- **效果**: ${card.text.replace(/\n/g, ' ')}`);
  }
  if (card.tags && card.tags.length > 0) {
    console.log(`- **标签**: ${card.tags.join(', ')}`);
  }
  console.log('');
}
