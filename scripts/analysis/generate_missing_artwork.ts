#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cardsPath = path.join(__dirname, '..', '..', 'src', 'content', 'data', 'cards.json')
const cardsDir = path.join(__dirname, '..', '..', 'public', 'assets', 'cards')
const missingArtworkPath = path.join(__dirname, '..', '..', 'output', 'missing_artwork.json')

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'))
const missingArtwork = JSON.parse(fs.readFileSync(missingArtworkPath, 'utf-8'))

const artPrompts: Record<string, string> = {
  'execution_slash': 'A glowing executioner blade striking down, dramatic fantasy art style',
  'rejection_response': 'A magical shield rejecting an incoming attack, defensive fantasy art style',
  'greed_sin': 'Golden coins and treasure swirling around, temptation fantasy art style',
  'psychic_backlash': 'A psychic attack rebounding back at the caster, magical feedback fantasy art style',
  'paranoia': 'Shadowy figures watching from the corners, paranoid dark fantasy art style',
  'intel_network': 'A network of glowing blue data lines connecting multiple nodes, information fantasy tech style',
  'weak_point_analysis': 'A tactical hologram highlighting enemy weak points, analytical fantasy tech style',
  'execute_protocol': 'A robotic arm executing a termination protocol, sci-fi fantasy art style',
  'warp_tap': 'A hand reaching into a glowing warp portal to steal something, space fantasy art style',
  'rage_slam': 'A furious warrior slamming a weapon into the ground, rage fantasy art style',
  'armor_break': 'A heavy weapon shattering enemy armor, breaking fantasy art style',
  'crushing_blow': 'A massive warhammer delivering a devastating blow, heavy fantasy art style',
  'blood_fury': 'A warrior consumed by bloodlust, eyes glowing red, dark fantasy art style',
  'poison_dart': 'A poisoned dart flying through the air, toxic fantasy art style',
  'toxic_cloud': 'A thick green toxic cloud spreading across the battlefield, poison fantasy art style',
  'poison_blade': 'A dagger dripping with green poison, toxic fantasy art style',
  'lingering_toxin': 'Residual poison glowing on a surface, persistent toxic fantasy art style',
  'venom_strike': 'A venomous snake striking, toxic fantasy art style',
  'execute_target': 'A crosshair locking onto a target for execution, tactical fantasy art style',
  'temporal_acceleration': 'Clock hands spinning rapidly, time speeding up, temporal fantasy art style',
  'layer_strike': 'Multiple overlapping strikes hitting at once, layered fantasy art style',
  'temporal_mastery': 'A wizard controlling multiple clock faces, time magic fantasy art style',
  'warp_recall': 'A figure being pulled back through a warp portal, time recall fantasy art style',
  'temporal_shield': 'A shield made of frozen time, protective temporal fantasy art style',
  'thread_weave': 'Magical threads being woven together, puppet master fantasy art style',
  'reinforced_golem': 'A heavily armored golem with glowing eyes, reinforced fantasy art style',
  'thread_lash': 'Magical threads lashing out like a whip, puppet attack fantasy art style',
  'construct_army': 'An army of mechanical constructs marching, puppet army fantasy art style',
  'reposition': 'Puppet strings rearranging constructs on the battlefield, tactical fantasy art style',
  'concoct': 'An alchemist mixing colorful potions, brewing fantasy art style',
  'transmute_life': 'Life energy being transformed, alchemical fantasy art style',
  'grand_experiment': 'A massive alchemical experiment in progress, chaotic fantasy art style',
  'volatile_mixture': 'A potion bottle about to explode, volatile fantasy art style'
}

for (const card of missingArtwork.missingArtwork) {
  if (!card.art_prompt && artPrompts[card.id]) {
    const cardIndex = cards.findIndex((c: any) => c.id === card.id)
    if (cardIndex !== -1) {
      cards[cardIndex].art_prompt = artPrompts[card.id]
      console.log(`Added art_prompt for ${card.id}`)
    }
  }
}

fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2))
console.log('Updated cards.json with art_prompts')
