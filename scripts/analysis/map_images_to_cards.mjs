#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cardsPath = path.join(__dirname, '..', '..', 'src', 'content', 'data', 'cards.json')
const cardsDir = path.join(__dirname, '..', '..', 'public', 'assets', 'cards')
const images2Dir = path.join(__dirname, '..', '..', 'images 2')
const outputPath = path.join(__dirname, '..', '..', 'output', 'image_mapping.json')

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'))

const imageFiles = fs.readdirSync(images2Dir)
  .filter(f => !f.includes('.DS_Store') && !f.includes('images ') && !f.includes('images/') && !f.includes('Gemini'))
  .sort()

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
]

const mapping = {}

console.log(`Found ${imageFiles.length} images in images 2 folder`)
console.log(`Need to map to ${cardIds.length} cards\n`)

for (let i = 0; i < Math.min(imageFiles.length, cardIds.length); i++) {
  mapping[cardIds[i]] = imageFiles[i]
  console.log(`${imageFiles[i]} -> ${cardIds[i]}`)
}

if (imageFiles.length > cardIds.length) {
  console.log(`\nWarning: ${imageFiles.length - cardIds.length} images left unmapped`)
} else if (cardIds.length > imageFiles.length) {
  console.log(`\nWarning: ${cardIds.length - imageFiles.length} cards without images`)
}

fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2))
console.log(`\nMapping saved to ${outputPath}`)
