import fs from 'fs';

const enemies = JSON.parse(fs.readFileSync('./src/content/enemies.json', 'utf8'));

const newEnemies = [
  {
    "id": "predictor",
    "name": "Predictor",
    "hp_range": [30, 35],
    "intent_policy": [
      { "intent": "adapt", "weight": 1 }
    ],
    "moves": {
      "adapt": [{ "type": "PredictorAction" }]
    },
    "keywords": []
  },
  {
    "id": "fission",
    "name": "Fission Core",
    "hp_range": [40, 45],
    "intent_policy": [
      { "intent": "pulse", "weight": 1 }
    ],
    "moves": {
      "pulse": [{ "type": "DealDamage", "amount": 8, "target": "Enemy" }]
    },
    "keywords": ["splits"]
  },
  {
    "id": "fission_small",
    "name": "Fission Shard",
    "hp_range": [15, 20],
    "intent_policy": [
      { "intent": "zap", "weight": 1 }
    ],
    "moves": {
      "zap": [{ "type": "DealDamage", "amount": 4, "target": "Enemy" }]
    },
    "keywords": []
  },
  {
    "id": "barrier",
    "name": "Barrier Guard",
    "hp_range": [25, 30],
    "intent_policy": [
      { "intent": "shield_bash", "weight": 1 },
      { "intent": "fortify", "weight": 1 }
    ],
    "moves": {
      "shield_bash": [{ "type": "DealDamage", "amount": 5, "target": "Enemy" }],
      "fortify": [{ "type": "GainBlock", "amount": 12, "target": "Self" }]
    },
    "keywords": ["starts_with_block"]
  },
  {
    "id": "symbiote_a",
    "name": "Symbiote Alpha",
    "hp_range": [50, 50],
    "intent_policy": [
      { "intent": "strike", "weight": 1 }
    ],
    "moves": {
      "strike": [{ "type": "DealDamage", "amount": 7, "target": "Enemy" }]
    },
    "keywords": ["symbiote"]
  },
  {
    "id": "symbiote_b",
    "name": "Symbiote Beta",
    "hp_range": [50, 50],
    "intent_policy": [
      { "intent": "strike", "weight": 1 }
    ],
    "moves": {
      "strike": [{ "type": "DealDamage", "amount": 7, "target": "Enemy" }]
    },
    "keywords": ["symbiote"]
  },
  {
    "id": "intelligence_officer",
    "name": "Intelligence Officer",
    "hp_range": [90, 100],
    "intent_policy": [
      { "intent": "analyze", "weight": 1 },
      { "intent": "copy_strike", "weight": 2 }
    ],
    "moves": {
      "analyze": [{ "type": "ApplyStatus", "status": "Vulnerable", "amount": 2, "target": "Enemy" }],
      "copy_strike": [{ "type": "DealDamage", "amount": 12, "target": "Enemy" }]
    },
    "keywords": ["elite"]
  },
  {
    "id": "alchemy_master",
    "name": "Alchemy Master",
    "hp_range": [200, 220],
    "intent_policy": [
      { "intent": "brew_fire", "weight": 1 },
      { "intent": "brew_acid", "weight": 1 },
      { "intent": "throw_concoction", "weight": 2 }
    ],
    "moves": {
      "brew_fire": [{ "type": "ApplyStatus", "status": "Strength", "amount": 2, "target": "Self" }],
      "brew_acid": [{ "type": "ApplyStatus", "status": "Poison", "amount": 3, "target": "Enemy" }],
      "throw_concoction": [{ "type": "DealDamage", "amount": 15, "target": "Enemy" }]
    },
    "keywords": ["boss"]
  },
  {
    "id": "time_guardian",
    "name": "Time Guardian",
    "hp_range": [240, 260],
    "intent_policy": [
      { "intent": "time_strike", "weight": 2 },
      { "intent": "rewind", "weight": 1 }
    ],
    "moves": {
      "time_strike": [{ "type": "DealDamage", "amount": 18, "target": "Enemy" }],
      "rewind": [{ "type": "HealSelf", "amount": 20 }]
    },
    "keywords": ["boss"]
  },
  {
    "id": "puppet_queen",
    "name": "Puppet Queen",
    "hp_range": [180, 200],
    "intent_policy": [
      { "intent": "summon_puppet", "weight": 2 },
      { "intent": "command", "weight": 1 }
    ],
    "moves": {
      "summon_puppet": [{ "type": "SummonEnemy", "unit": "fission_small" }],
      "command": [{ "type": "BuffAllEnemies", "amount": 2 }]
    },
    "keywords": ["boss"]
  }
];

const existingIds = new Set(enemies.map(e => e.id));
for (const e of newEnemies) {
  if (!existingIds.has(e.id)) {
    enemies.push(e);
  }
}

fs.writeFileSync('./src/content/enemies.json', JSON.stringify(enemies, null, 2));
console.log("Updated enemies.json");
