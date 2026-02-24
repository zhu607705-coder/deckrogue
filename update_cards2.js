import fs from 'fs';

const cards = JSON.parse(fs.readFileSync('./src/content/cards.json', 'utf8'));

const newCards = [
  {
    "id": "go_dark",
    "name": "Go Dark",
    "rarity": "Uncommon",
    "cost": 1,
    "type": "Skill",
    "targeting": "Self",
    "tags": ["intel"],
    "text": "Spend 3 Intel. Gain 1 Stealth.",
    "actions": [
      { "type": "Conditional", "condition": { "type": "HasIntel", "amount": 3 }, "trueActions": [
        { "type": "SpendIntel", "amount": 3 },
        { "type": "ApplyStatus", "status": "Stealth", "amount": 1, "target": "Self" }
      ]}
    ],
    "art_prompt": "A rogue blending completely into the shadows, fantasy art style",
    "character": "informant"
  }
];

const existingIds = new Set(cards.map(c => c.id));
for (const c of newCards) {
  if (!existingIds.has(c.id)) {
    cards.push(c);
  }
}

fs.writeFileSync('./src/content/cards.json', JSON.stringify(cards, null, 2));
console.log("Updated cards.json with Go Dark");
