import fs from 'fs';

const cards = JSON.parse(fs.readFileSync('./src/content/cards.json', 'utf8'));

const newCards = [
  // Chronomancer Cards
  {
    "id": "time_bomb",
    "name": "Time Bomb",
    "rarity": "Starter",
    "cost": 1,
    "type": "Skill",
    "targeting": "Enemy",
    "tags": ["delay"],
    "text": "Delay 2: Deal 12 damage.",
    "actions": [
      { "type": "Delay", "turns": 2, "actions": [{ "type": "DealDamage", "amount": 12, "target": "Enemy" }] }
    ],
    "art_prompt": "A glowing magical clock ticking down, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "time_warp",
    "name": "Time Warp",
    "rarity": "Starter",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Trigger a delayed card immediately.",
    "actions": [
      { "type": "TriggerDelay" }
    ],
    "art_prompt": "A distorted clock face melting into a portal, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "deja_vu",
    "name": "Deja Vu",
    "rarity": "Common",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Return the last played card to your hand. It costs 0 this turn.",
    "actions": [
      { "type": "ReturnLastCard", "costModifier": 0 }
    ],
    "art_prompt": "A ghostly echo of a warrior repeating a strike, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "borrowed_time",
    "name": "Borrowed Time",
    "rarity": "Rare",
    "cost": 2,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Gain 3 Energy. Draw 2 cards. Skip your next draw phase.",
    "actions": [
      { "type": "GainEnergy", "amount": 3 },
      { "type": "Draw", "amount": 2 },
      { "type": "ApplyStatus", "status": "SkipDraw", "amount": 1, "target": "Self" }
    ],
    "art_prompt": "A glowing hourglass being shattered, releasing intense energy, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "stasis_field",
    "name": "Stasis Field",
    "rarity": "Uncommon",
    "cost": 1,
    "type": "Power",
    "targeting": "Self",
    "tags": [],
    "text": "At the start of your turn, if you have 2+ delayed cards, gain 5 Block.",
    "actions": [
      { "type": "ApplyStatus", "status": "StasisField", "amount": 1, "target": "Self" }
    ],
    "art_prompt": "A protective bubble of frozen time, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "temporal_backtrack",
    "name": "Temporal Backtrack",
    "rarity": "Rare",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Revive a dead friendly unit.",
    "actions": [
      { "type": "Revive" }
    ],
    "art_prompt": "A fallen warrior rising backwards in time, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "chronos_rift",
    "name": "Chronos Rift",
    "rarity": "Uncommon",
    "cost": 2,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": ["delay"],
    "text": "Deal 8 damage. Delay 3: Deal 8 damage.",
    "actions": [
      { "type": "DealDamage", "amount": 8, "target": "Enemy" },
      { "type": "Delay", "turns": 3, "actions": [{ "type": "DealDamage", "amount": 8, "target": "Enemy" }] }
    ],
    "art_prompt": "A tear in reality showing a past and future strike, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "grandfather_paradox",
    "name": "Grandfather Paradox",
    "rarity": "Rare",
    "cost": 3,
    "type": "Attack",
    "targeting": "AllEnemies",
    "tags": [],
    "text": "Deal 5 damage to ALL enemies. Deals 3 more damage for each delayed card.",
    "actions": [
      { "type": "DealDamage", "amount": 5, "target": "AllEnemies", "scaling": { "type": "DelayedCards", "multiplier": 3 } }
    ],
    "art_prompt": "A chaotic swirl of conflicting timelines destroying everything, fantasy art style",
    "character": "chronomancer"
  },
  {
    "id": "memory_fragment",
    "name": "Memory Fragment",
    "rarity": "Common",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Draw 3 cards. The next Attack you play this turn costs 1 less.",
    "actions": [
      { "type": "Draw", "amount": 3 },
      { "type": "ApplyStatus", "status": "NextAttackDiscount", "amount": 1, "target": "Self" }
    ],
    "art_prompt": "A glowing crystal containing a memory of a battle, fantasy art style",
    "character": "chronomancer"
  },

  // Puppeteer Cards
  {
    "id": "scrap_golem",
    "name": "Scrap Golem",
    "rarity": "Starter",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": ["summon"],
    "text": "Summon a Scrap Golem (15 HP, 2 ATK, Taunt).",
    "actions": [
      { "type": "Summon", "unit": "scrap_golem" }
    ],
    "art_prompt": "A crude golem made of gears and scrap metal, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "wire_guard",
    "name": "Wire Guard",
    "rarity": "Starter",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Gain 5 Block. If you have a Construct, gain 3 more.",
    "actions": [
      { "type": "GainBlock", "amount": 5, "target": "Self" },
      { "type": "Conditional", "condition": { "type": "HasConstruct" }, "trueActions": [{ "type": "GainBlock", "amount": 3, "target": "Self" }] }
    ],
    "art_prompt": "Magical glowing wires forming a protective barrier, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "spark_shock",
    "name": "Spark Shock",
    "rarity": "Starter",
    "cost": 1,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": [],
    "text": "Deal 5 damage. Constructs gain 1 ATK this turn.",
    "actions": [
      { "type": "DealDamage", "amount": 5, "target": "Enemy" },
      { "type": "BuffConstructs", "amount": 1 }
    ],
    "art_prompt": "A spark of electricity jumping between mechanical parts, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "overdrive",
    "name": "Overdrive",
    "rarity": "Uncommon",
    "cost": 2,
    "type": "Attack",
    "targeting": "AllEnemies",
    "tags": [],
    "text": "All Constructs deal their ATK as damage, then are destroyed.",
    "actions": [
      { "type": "ConstructOverdrive" }
    ],
    "art_prompt": "A mechanical golem glowing red hot before exploding, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "soul_link",
    "name": "Soul Link",
    "rarity": "Power",
    "cost": 1,
    "type": "Power",
    "targeting": "Self",
    "tags": [],
    "text": "50% of damage you take is redirected to your nearest Construct.",
    "actions": [
      { "type": "ApplyStatus", "status": "SoulLink", "amount": 1, "target": "Self" }
    ],
    "art_prompt": "A glowing ethereal tether connecting a person to a puppet, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "wire_acrobatics",
    "name": "Wire Acrobatics",
    "rarity": "Common",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Draw 1 card. If you have a Construct, draw 1 more.",
    "actions": [
      { "type": "Draw", "amount": 1 },
      { "type": "Conditional", "condition": { "type": "HasConstruct" }, "trueActions": [{ "type": "Draw", "amount": 1 }] }
    ],
    "art_prompt": "A puppet performing a nimble flip on magical strings, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "gear_storm",
    "name": "Gear Storm",
    "rarity": "Uncommon",
    "cost": 2,
    "type": "Attack",
    "targeting": "AllEnemies",
    "tags": [],
    "text": "Deal 6 damage to ALL enemies. Deals 2 more for each Construct.",
    "actions": [
      { "type": "DealDamage", "amount": 6, "target": "AllEnemies", "scaling": { "type": "Constructs", "multiplier": 2 } }
    ],
    "art_prompt": "A whirlwind of sharp gears and metal scraps, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "core_rebuild",
    "name": "Core Rebuild",
    "rarity": "Uncommon",
    "cost": 2,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Fully heal a Construct and remove its debuffs.",
    "actions": [
      { "type": "HealConstruct" }
    ],
    "art_prompt": "A glowing mechanical heart being inserted into a golem, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "proxied_war",
    "name": "Proxied War",
    "rarity": "Common",
    "cost": 1,
    "type": "Attack",
    "targeting": "RandomEnemy",
    "tags": [],
    "text": "Force a random enemy to attack another random enemy.",
    "actions": [
      { "type": "ForceEnemyAttack" }
    ],
    "art_prompt": "Magical strings controlling an enemy monster like a puppet, fantasy art style",
    "character": "puppeteer"
  },
  {
    "id": "mega_fusion",
    "name": "Mega Fusion",
    "rarity": "Rare",
    "cost": 3,
    "type": "Skill",
    "targeting": "Self",
    "tags": ["summon"],
    "text": "Destroy all Constructs. Summon a Mega Construct (50 HP, 10 ATK).",
    "actions": [
      { "type": "SummonMegaConstruct" }
    ],
    "art_prompt": "Multiple golems combining into a massive mechanical titan, fantasy art style",
    "character": "puppeteer"
  },

  // Alchemist Cards
  {
    "id": "element_spark",
    "name": "Element Spark",
    "rarity": "Starter",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Add 1 random Element to your Element Pool.",
    "actions": [
      { "type": "AddRandomElement", "amount": 1 }
    ],
    "art_prompt": "A chaotic spark of multi-colored magical energy, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "fire_arrow",
    "name": "Fire Arrow",
    "rarity": "Starter",
    "cost": 1,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": ["fire"],
    "text": "Deal 5 damage. Add Fire to Element Pool.",
    "actions": [
      { "type": "DealDamage", "amount": 5, "target": "Enemy" },
      { "type": "AddElement", "element": "Fire" }
    ],
    "art_prompt": "A flaming magical arrow, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "frost_armor",
    "name": "Frost Armor",
    "rarity": "Starter",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": ["frost"],
    "text": "Gain 5 Block. Add Frost to Element Pool.",
    "actions": [
      { "type": "GainBlock", "amount": 5, "target": "Self" },
      { "type": "AddElement", "element": "Frost" }
    ],
    "art_prompt": "A shield made of solid ice, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "element_siphon",
    "name": "Element Siphon",
    "rarity": "Common",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Gain 1 random Element.",
    "actions": [
      { "type": "AddRandomElement", "amount": 1 }
    ],
    "art_prompt": "Magical energy being drawn from the environment into a vial, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "fire_bomb",
    "name": "Fire Bomb",
    "rarity": "Common",
    "cost": 1,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": ["fire"],
    "text": "Deal 4 damage. Apply 3 Burn. Add Fire.",
    "actions": [
      { "type": "DealDamage", "amount": 4, "target": "Enemy" },
      { "type": "ApplyStatus", "status": "Burn", "amount": 3, "target": "Enemy" },
      { "type": "AddElement", "element": "Fire" }
    ],
    "art_prompt": "A glass flask exploding with intense fire, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "acid_spray",
    "name": "Acid Spray",
    "rarity": "Common",
    "cost": 1,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": ["acid"],
    "text": "Deal 3 damage. Add Acid.",
    "actions": [
      { "type": "DealDamage", "amount": 3, "target": "Enemy" },
      { "type": "AddElement", "element": "Acid" }
    ],
    "art_prompt": "Corrosive green liquid spraying from a nozzle, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "chain_reaction",
    "name": "Chain Reaction",
    "rarity": "Rare",
    "cost": 2,
    "type": "Skill",
    "targeting": "AllEnemies",
    "tags": [],
    "text": "Trigger all Element reactions in your pool.",
    "actions": [
      { "type": "TriggerReactions" }
    ],
    "art_prompt": "A massive explosion of mixed magical elements, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "elemental_overload",
    "name": "Elemental Overload",
    "rarity": "Rare",
    "cost": 3,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": [],
    "text": "Deal 15 damage. If you have 3+ different Elements, deal double damage.",
    "actions": [
      { "type": "ElementalOverloadDamage", "amount": 15, "target": "Enemy" }
    ],
    "art_prompt": "A beam of pure, multi-colored elemental energy, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "alchemical_transmute",
    "name": "Alchemical Transmute",
    "rarity": "Uncommon",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Consume all Elements. Heal 2 HP per Element.",
    "actions": [
      { "type": "TransmuteElements" }
    ],
    "art_prompt": "A glowing golden liquid being poured from a flask, fantasy art style",
    "character": "alchemist"
  },
  {
    "id": "universal_solvent",
    "name": "Universal Solvent",
    "rarity": "Uncommon",
    "cost": 2,
    "type": "Attack",
    "targeting": "AllEnemies",
    "tags": ["acid"],
    "text": "Deal 3 damage to ALL enemies. Deals 2 extra damage per Block they have. Add Acid.",
    "actions": [
      { "type": "SolventDamage", "amount": 3, "target": "AllEnemies" },
      { "type": "AddElement", "element": "Acid" }
    ],
    "art_prompt": "A bubbling vial of clear liquid dissolving a metal shield, fantasy art style",
    "character": "alchemist"
  },

  // General Cards
  {
    "id": "turn_the_tables",
    "name": "Turn the Tables",
    "rarity": "Uncommon",
    "cost": 2,
    "type": "Skill",
    "targeting": "Enemy",
    "tags": [],
    "text": "Redirect an enemy's intent to another random enemy.",
    "actions": [
      { "type": "RedirectIntent" }
    ],
    "art_prompt": "A magical mirror reflecting an attack back at a monster, fantasy art style",
    "character": "All"
  },
  {
    "id": "temp_worker",
    "name": "Temp Worker",
    "rarity": "Common",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": ["summon"],
    "text": "Summon a Temp Guard (5 HP, Taunt) that vanishes in 3 turns.",
    "actions": [
      { "type": "Summon", "unit": "temp_guard" }
    ],
    "art_prompt": "A nervous-looking peasant holding a wooden shield, fantasy art style",
    "character": "All"
  },
  {
    "id": "precision_throw",
    "name": "Precision Throw",
    "rarity": "Common",
    "cost": 1,
    "type": "Attack",
    "targeting": "Enemy",
    "tags": [],
    "text": "Deal 6 damage. If the enemy has Block, deal 9 instead.",
    "actions": [
      { "type": "PrecisionThrowDamage", "amount": 6, "bonus": 9, "target": "Enemy" }
    ],
    "art_prompt": "A throwing knife perfectly hitting a gap in armor, fantasy art style",
    "character": "All"
  },
  {
    "id": "adrenaline",
    "name": "Adrenaline",
    "rarity": "Rare",
    "cost": 0,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Gain 1 Energy. Skip your next draw phase.",
    "actions": [
      { "type": "GainEnergy", "amount": 1 },
      { "type": "ApplyStatus", "status": "SkipDraw", "amount": 1, "target": "Self" }
    ],
    "art_prompt": "A glowing red aura surrounding a warrior, fantasy art style",
    "character": "All"
  },
  {
    "id": "full_scan",
    "name": "Full Scan",
    "rarity": "Uncommon",
    "cost": 1,
    "type": "Skill",
    "targeting": "AllEnemies",
    "tags": [],
    "text": "Reveal all enemy intents for 1 turn.",
    "actions": [
      { "type": "ApplyStatus", "status": "Revealed", "amount": 1, "target": "AllEnemies" }
    ],
    "art_prompt": "A magical radar sweeping over a dark battlefield, fantasy art style",
    "character": "All"
  },
  {
    "id": "emergency_measure",
    "name": "Emergency Measure",
    "rarity": "Common",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Gain 10 Block. If HP < 30%, gain 15 instead.",
    "actions": [
      { "type": "EmergencyBlock", "amount": 10, "bonus": 15, "target": "Self" }
    ],
    "art_prompt": "A desperate magical shield blocking a lethal blow, fantasy art style",
    "character": "All"
  },
  {
    "id": "double_down",
    "name": "Double Down",
    "rarity": "Rare",
    "cost": 2,
    "type": "Skill",
    "targeting": "Self",
    "tags": [],
    "text": "Your next Attack this turn deals double damage.",
    "actions": [
      { "type": "ApplyStatus", "status": "DoubleDamageNextAttack", "amount": 1, "target": "Self" }
    ],
    "art_prompt": "A warrior glowing with intense power, preparing a massive strike, fantasy art style",
    "character": "All"
  },
  {
    "id": "jamming_signal",
    "name": "Jamming Signal",
    "rarity": "Uncommon",
    "cost": 1,
    "type": "Skill",
    "targeting": "AllEnemies",
    "tags": [],
    "text": "Enemies cannot gain Block this turn.",
    "actions": [
      { "type": "ApplyStatus", "status": "BlockBlocked", "amount": 1, "target": "AllEnemies" }
    ],
    "art_prompt": "Magical static disrupting an enemy's shield spell, fantasy art style",
    "character": "All"
  }
];

const existingIds = new Set(cards.map(c => c.id));
for (const c of newCards) {
  if (!existingIds.has(c.id)) {
    cards.push(c);
  }
}

fs.writeFileSync('./src/content/cards.json', JSON.stringify(cards, null, 2));
console.log("Updated cards.json");
