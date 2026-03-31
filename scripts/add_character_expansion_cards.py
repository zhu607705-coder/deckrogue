import json

# 读取现有的 cards.json
with open('src/content/data/cards.json', 'r') as f:
    cards = json.load(f)

# 共享镜宫卡 12 张
mirror_shared_cards = [
    {
        "id": "mirror_probe",
        "name": "Mirror Probe",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Enemy",
        "tags": ["mirror", "probe"],
        "text": "Draw 1 card if target has any debuffs.",
        "actions": [
            {
                "type": "ConditionalDraw",
                "condition": {"type": "TargetHasDebuff"},
                "amount": 1
            }
        ],
        "character": "All"
    },
    {
        "id": "silver_guard",
        "name": "Silver Guard",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["mirror", "defense"],
        "text": "Gain 9 Block. Gain 3 more if you spent a resource this turn.",
        "actions": [
            {"type": "GainBlock", "amount": 9, "target": "Self"},
            {"type": "ConditionalBonusBlock", "condition": {"type": "ResourceSpent"}, "bonus": 3}
        ],
        "character": "All"
    },
    {
        "id": "fracture_strike",
        "name": "Fracture Strike",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["mirror", "attack"],
        "text": "Deal 8 damage. Deal 5 more if target has Weak, Vulnerable, or Poison.",
        "actions": [
            {"type": "DealDamage", "amount": 8, "target": "Enemy"},
            {"type": "ConditionalDamage", "condition": {"type": "TargetHasAnyDebuff", "debuffs": ["Weak", "Vulnerable", "Poison"]}, "bonus": 5}
        ],
        "character": "All"
    },
    {
        "id": "borrowed_pattern",
        "name": "Borrowed Pattern",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["mirror", "utility"],
        "text": "Copy the leftmost Skill in your hand at 50% effect value.",
        "actions": [
            {"type": "CopyLeftmostSkill", "target": "Self", "effectPercent": 50}
        ],
        "character": "All"
    },
    {
        "id": "refraction_dart",
        "name": "Refraction Dart",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["mirror", "attack"],
        "text": "Deal 6 damage. Draw 1 if this hits a debuffed enemy.",
        "actions": [
            {"type": "DealDamage", "amount": 6, "target": "Enemy"},
            {"type": "ConditionalDraw", "condition": {"type": "TargetHasDebuff"}, "amount": 1}
        ],
        "character": "All"
    },
    {
        "id": "hush_field",
        "name": "Hush Field",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "AllEnemies",
        "tags": ["mirror", "control"],
        "text": "Apply 1 Weak to all enemies.",
        "actions": [
            {"type": "ApplyStatus", "status": "Weak", "stacks": 1, "target": "AllEnemies"}
        ],
        "character": "All"
    },
    {
        "id": "echo_step",
        "name": "Echo Step",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["mirror", "energy"],
        "text": "Gain 1 Energy at the start of your next turn.",
        "actions": [
            {"type": "DelayedEnergy", "amount": 1, "target": "Self"}
        ],
        "character": "All"
    },
    {
        "id": "glass_molt",
        "name": "Glass Molt",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["mirror", "purify"],
        "text": "Remove 1 debuff from yourself and draw 1 card.",
        "actions": [
            {"type": "RemoveSelfDebuff", "stacks": 1},
            {"type": "Draw", "amount": 1, "target": "Self"}
        ],
        "character": "All"
    },
    {
        "id": "mirror_tax",
        "name": "Mirror Tax",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["mirror", "attack"],
        "text": "Deal 14 damage. Deal 8 more if target has Block.",
        "actions": [
            {"type": "DealDamage", "amount": 14, "target": "Enemy"},
            {"type": "ConditionalDamage", "condition": {"type": "TargetHasBlock"}, "bonus": 8}
        ],
        "character": "All"
    },
    {
        "id": "soft_reset",
        "name": "Soft Reset",
        "rarity": "Uncommon",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["mirror", "utility"],
        "text": "The first time you spend a resource this turn, refund 1.",
        "actions": [
            {"type": "ResourceRefund", "amount": 1, "target": "Self"}
        ],
        "character": "All"
    },
    {
        "id": "palace_signal",
        "name": "Palace Signal",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Power",
        "targeting": "Self",
        "tags": ["mirror", "defense"],
        "text": "Whenever you draw a 0-cost card for the first time each turn, gain 3 Block.",
        "actions": [
            {"type": "StartOfTurnEffect", "trigger": {"type": "DrawZeroCostCard"}, "effect": {"type": "GainBlock", "amount": 3}}
        ],
        "character": "All"
    },
    {
        "id": "shard_harvest",
        "name": "Shard Harvest",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["mirror", "attack"],
        "text": "Deal 12 damage. If this kills, gain 1 random resource.",
        "actions": [
            {"type": "DealDamage", "amount": 12, "target": "Enemy"},
            {"type": "ConditionalResourceGain", "condition": {"type": "Kill"}, "resource": "random", "amount": 1}
        ],
        "character": "All"
    }
]

# Informant 分支卡 8 张
informant_cards = [
    {
        "id": "planted_witness",
        "name": "Planted Witness",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Enemy",
        "tags": ["informant", "evidence"],
        "text": "Gain 1 Evidence. Draw 1 if target already has a debuff.",
        "actions": [
            {"type": "GainResource", "resource": "evidence", "amount": 1},
            {"type": "ConditionalDraw", "condition": {"type": "TargetHasDebuff"}, "amount": 1}
        ],
        "character": "informant"
    },
    {
        "id": "mirror_tail",
        "name": "Mirror Tail",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["informant", "defense"],
        "text": "Gain 7 Block. Apply 2 Weak. Gain 1 Evidence if enemy will attack this turn.",
        "actions": [
            {"type": "GainBlock", "amount": 7, "target": "Self"},
            {"type": "ApplyStatus", "status": "Weak", "stacks": 2, "target": "Enemy"},
            {"type": "ConditionalResourceGain", "condition": {"type": "EnemyWillAttack"}, "resource": "evidence", "amount": 1}
        ],
        "character": "informant"
    },
    {
        "id": "sealed_testimony",
        "name": "Sealed Testimony",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["informant", "attack"],
        "text": "Deal 7 damage. If you have Evidence, spend 1 to ignore 8 Block.",
        "actions": [
            {"type": "DealDamage", "amount": 7, "target": "Enemy"},
            {"type": "SpendResourceEffect", "resource": "evidence", "amount": 1, "effect": {"type": "IgnoreBlock", "amount": 8}}
        ],
        "character": "informant"
    },
    {
        "id": "false_identity",
        "name": "False Identity",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["informant", "control"],
        "text": "The first Weak you apply this turn gains +1 stack. Draw 1.",
        "actions": [
            {"type": "BonusNextDebuff", "status": "Weak", "bonus": 1},
            {"type": "Draw", "amount": 1, "target": "Self"}
        ],
        "character": "informant"
    },
    {
        "id": "cross_examiner",
        "name": "Cross Examiner",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["informant", "attack"],
        "text": "Deal 10 damage. If target has both Weak and Vulnerable, deal 12 more.",
        "actions": [
            {"type": "DealDamage", "amount": 10, "target": "Enemy"},
            {"type": "ConditionalDamage", "condition": {"type": "TargetHasBothDebuffs", "debuffs": ["Weak", "Vulnerable"]}, "bonus": 12}
        ],
        "character": "informant"
    },
    {
        "id": "evidence_laundering",
        "name": "Evidence Laundering",
        "rarity": "Uncommon",
        "cost": 1,
        "type": "Skill",
        "targeting": "AllEnemies",
        "tags": ["informant", "control"],
        "text": "Spend up to 2 Evidence. For each, apply 1 Weak to all enemies and draw 1.",
        "actions": [
            {"type": "SpendResourceUpTo", "resource": "evidence", "maxAmount": 2, "effect": [
                {"type": "ApplyStatus", "status": "Weak", "stacks": 1, "target": "AllEnemies"},
                {"type": "Draw", "amount": 1, "target": "Self"}
            ]}
        ],
        "character": "informant"
    },
    {
        "id": "sudden_confession",
        "name": "Sudden Confession",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "Enemy",
        "tags": ["informant", "control"],
        "text": "Apply 3 Vulnerable to target. If you spend 1 Evidence, draw 1 on first hit this turn.",
        "actions": [
            {"type": "ApplyStatus", "status": "Vulnerable", "stacks": 3, "target": "Enemy"},
            {"type": "ConditionalDraw", "condition": {"type": "SpendResource", "resource": "evidence", "amount": 1}, "amount": 1}
        ],
        "character": "informant"
    },
    {
        "id": "terminal_verdict",
        "name": "Terminal Verdict",
        "rarity": "Rare",
        "cost": 3,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["informant", "attack"],
        "text": "Deal 14 damage. Spend all Evidence, deal 8 damage per. If target dies, refund 1 Energy.",
        "actions": [
            {"type": "DealDamage", "amount": 14, "target": "Enemy"},
            {"type": "SpendAllResourceEffect", "resource": "evidence", "effect": {"type": "DealDamage", "amount": 8}},
            {"type": "ConditionalRefund", "condition": {"type": "Kill"}, "resource": "energy", "amount": 1}
        ],
        "character": "informant"
    }
]

# Brute 分支卡 8 张
brute_cards = [
    {
        "id": "bloody_grin",
        "name": "Bloody Grin",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["brute", "rage"],
        "text": "Lose 3 HP. Gain 1 Rage. Draw 1.",
        "actions": [
            {"type": "LoseHP", "amount": 3},
            {"type": "GainResource", "resource": "rage", "amount": 1},
            {"type": "Draw", "amount": 1, "target": "Self"}
        ],
        "character": "brute"
    },
    {
        "id": "skull_crack",
        "name": "Skull Crack",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["brute", "attack"],
        "text": "Deal 9 damage. If you have Rage, spend 1 to apply 1 Vulnerable.",
        "actions": [
            {"type": "DealDamage", "amount": 9, "target": "Enemy"},
            {"type": "SpendResourceEffect", "resource": "rage", "amount": 1, "effect": {"type": "ApplyStatus", "status": "Vulnerable", "stacks": 1}}
        ],
        "character": "brute"
    },
    {
        "id": "meat_shield",
        "name": "Meat Shield",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["brute", "defense"],
        "text": "Gain 9 Block. If you took damage this turn, gain 1 Rage.",
        "actions": [
            {"type": "GainBlock", "amount": 9, "target": "Self"},
            {"type": "ConditionalResourceGain", "condition": {"type": "TookDamageThisTurn"}, "resource": "rage", "amount": 1}
        ],
        "character": "brute"
    },
    {
        "id": "chain_maul",
        "name": "Chain Maul",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["brute", "attack"],
        "text": "Deal 6x2 damage. If target HP below 50%, second hit deals 3 more.",
        "actions": [
            {"type": "DealDamage", "amount": 6, "hits": 2, "target": "Enemy"},
            {"type": "ConditionalBonusDamage", "condition": {"type": "TargetBelowHP", "percent": 50}, "bonus": 3}
        ],
        "character": "brute"
    },
    {
        "id": "war_feast",
        "name": "War Feast",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["brute", "rage"],
        "text": "Lose 6 HP. Heal 10 HP. Gain 2 Rage.",
        "actions": [
            {"type": "LoseHP", "amount": 6},
            {"type": "Heal", "amount": 10, "target": "Self"},
            {"type": "GainResource", "resource": "rage", "amount": 2}
        ],
        "character": "brute"
    },
    {
        "id": "berserk_step",
        "name": "Berserk Step",
        "rarity": "Uncommon",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["brute", "defense"],
        "text": "Gain 6 Block. The next Attack card this turn costs 1 less.",
        "actions": [
            {"type": "GainBlock", "amount": 6, "target": "Self"},
            {"type": "NextAttackCostDown", "amount": 1}
        ],
        "character": "brute"
    },
    {
        "id": "pit_execution",
        "name": "Pit Execution",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["brute", "attack"],
        "text": "Deal 16 damage. If this kills, heal 6 HP and gain 1 Rage.",
        "actions": [
            {"type": "DealDamage", "amount": 16, "target": "Enemy"},
            {"type": "ConditionalEffect", "condition": {"type": "Kill"}, "effects": [
                {"type": "Heal", "amount": 6, "target": "Self"},
                {"type": "GainResource", "resource": "rage", "amount": 1}
            ]}
        ],
        "character": "brute"
    },
    {
        "id": "red_howl",
        "name": "Red Howl",
        "rarity": "Rare",
        "cost": 3,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["brute", "attack"],
        "text": "Spend all Rage. Deal 12 base damage, +7 per Rage spent. Gain Block equal to half Rage spent.",
        "actions": [
            {"type": "SpendAllResourceEffect", "resource": "rage", "effect": {"type": "DealDamage", "amount": 7}},
            {"type": "DealDamage", "amount": 12, "target": "Enemy"},
            {"type": "GainBlock", "amount": 3, "target": "Self"}
        ],
        "character": "brute"
    }
]

# Tactician 分支卡 8 张
tactician_cards = [
    {
        "id": "briefing_order",
        "name": "Briefing Order",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["tactician", "command"],
        "text": "Gain 1 Command. Draw 1 if you haven't attacked yet this turn.",
        "actions": [
            {"type": "GainResource", "resource": "command", "amount": 1},
            {"type": "ConditionalDraw", "condition": {"type": "NoAttackYet"}, "amount": 1}
        ],
        "character": "tactician"
    },
    {
        "id": "shield_signal",
        "name": "Shield Signal",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["tactician", "defense"],
        "text": "Gain 10 Block. If you have Command, gain 2 more.",
        "actions": [
            {"type": "GainBlock", "amount": 10, "target": "Self"},
            {"type": "ConditionalBonusBlock", "condition": {"type": "HasResource", "resource": "command"}, "bonus": 2}
        ],
        "character": "tactician"
    },
    {
        "id": "precise_rotation",
        "name": "Precise Rotation",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["tactician", "draw"],
        "text": "Spend 1 Command. Draw 2, discard 1.",
        "actions": [
            {"type": "SpendResourceEffect", "resource": "command", "amount": 1, "effect": {"type": "Draw", "amount": 2}},
            {"type": "Discard", "amount": 1}
        ],
        "character": "tactician"
    },
    {
        "id": "formation_break",
        "name": "Formation Break",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["tactician", "attack"],
        "text": "Deal 8 damage. Deal 5 more if you gained Block this turn.",
        "actions": [
            {"type": "DealDamage", "amount": 8, "target": "Enemy"},
            {"type": "ConditionalDamage", "condition": {"type": "GainedBlockThisTurn"}, "bonus": 5}
        ],
        "character": "tactician"
    },
    {
        "id": "line_adjustment",
        "name": "Line Adjustment",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["tactician", "utility"],
        "text": "The next card this turn costs 1 less. If you have Command, draw 1 instead.",
        "actions": [
            {"type": "NextCardCostDown", "amount": 1},
            {"type": "ConditionalDraw", "condition": {"type": "HasResource", "resource": "command"}, "amount": 1}
        ],
        "character": "tactician"
    },
    {
        "id": "reserve_line",
        "name": "Reserve Line",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["tactician", "defense"],
        "text": "Gain 14 Block. Retain 1 card at end of turn.",
        "actions": [
            {"type": "GainBlock", "amount": 14, "target": "Self"},
            {"type": "RetainCard", "amount": 1}
        ],
        "character": "tactician"
    },
    {
        "id": "coordinated_breach",
        "name": "Coordinated Breach",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["tactician", "attack"],
        "text": "Deal 12 damage. Spend 1 Command to also apply 2 Weak.",
        "actions": [
            {"type": "DealDamage", "amount": 12, "target": "Enemy"},
            {"type": "SpendResourceEffect", "resource": "command", "amount": 1, "effect": {"type": "ApplyStatus", "status": "Weak", "stacks": 2}}
        ],
        "character": "tactician"
    },
    {
        "id": "grand_doctrine",
        "name": "Grand Doctrine",
        "rarity": "Rare",
        "cost": 3,
        "type": "Power",
        "targeting": "Self",
        "tags": ["tactician", "power"],
        "text": "Whenever you first gain 12+ Block each turn, gain 1 Command. Whenever you first spend Command each turn, draw 1.",
        "actions": [
            {"type": "StartOfTurnEffect", "trigger": {"type": "GainBlockThreshold", "threshold": 12}, "effect": {"type": "GainResource", "resource": "command", "amount": 1}},
            {"type": "StartOfTurnEffect", "trigger": {"type": "SpendResource", "resource": "command"}, "effect": {"type": "Draw", "amount": 1}}
        ],
        "character": "tactician"
    }
]

# Puppeteer 分支卡 8 张
puppeteer_cards = [
    {
        "id": "glass_marionette",
        "name": "Glass Marionette",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["puppeteer", "summon"],
        "text": "Summon a 3/1 Mirror Puppet. If you have Thread, it gains +2 Attack.",
        "actions": [
            {"type": "Summon", "id": "mirror_puppet", "attack": 3, "hp": 1},
            {"type": "ConditionalSummonBonus", "condition": {"type": "HasResource", "resource": "thread"}, "attack": 2}
        ],
        "character": "puppeteer"
    },
    {
        "id": "echo_string",
        "name": "Echo String",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["puppeteer", "thread"],
        "text": "Gain 1 Thread. Draw 1 if you control any puppets.",
        "actions": [
            {"type": "GainResource", "resource": "thread", "amount": 1},
            {"type": "ConditionalDraw", "condition": {"type": "ControlsPuppets"}, "amount": 1}
        ],
        "character": "puppeteer"
    },
    {
        "id": "shard_dance",
        "name": "Shard Dance",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["puppeteer", "attack"],
        "text": "Deal 5 damage and have all puppets deal 3 damage.",
        "actions": [
            {"type": "DealDamage", "amount": 5, "target": "Enemy"},
            {"type": "PuppetAttack", "amount": 3}
        ],
        "character": "puppeteer"
    },
    {
        "id": "borrowed_face",
        "name": "Borrowed Face",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["puppeteer", "utility"],
        "text": "The next time a puppet dies this turn, draw 2 cards.",
        "actions": [
            {"type": "TriggerOnPuppetDeath", "effect": {"type": "Draw", "amount": 2}}
        ],
        "character": "puppeteer"
    },
    {
        "id": "silver_curtain",
        "name": "Silver Curtain",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["puppeteer", "defense"],
        "text": "All puppets gain 4 Block and deal +2 attack.",
        "actions": [
            {"type": "PuppetBuff", "block": 4, "attack": 2}
        ],
        "character": "puppeteer"
    },
    {
        "id": "reflected_stage",
        "name": "Reflected Stage",
        "rarity": "Uncommon",
        "cost": 1,
        "type": "Power",
        "targeting": "Self",
        "tags": ["puppeteer", "power"],
        "text": "The first summoned creature each turn gains +1 turn duration.",
        "actions": [
            {"type": "StartOfTurnEffect", "trigger": {"type": "FirstSummon"}, "effect": {"type": "ExtendDuration", "amount": 1}}
        ],
        "character": "puppeteer"
    },
    {
        "id": "cut_the_strings",
        "name": "Cut the Strings",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["puppeteer", "attack"],
        "text": "Sacrifice all puppets. Each one deals 7 damage.",
        "actions": [
            {"type": "SacrificeAllPuppets", "damage": 7}
        ],
        "character": "puppeteer"
    },
    {
        "id": "palace_of_doubles",
        "name": "Palace of Doubles",
        "rarity": "Rare",
        "cost": 3,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["puppeteer", "summon"],
        "text": "Immediately summon 2 Mirror Puppets. For each Thread you have, one gains +1/+1.",
        "actions": [
            {"type": "Summon", "id": "mirror_puppet", "attack": 3, "hp": 1},
            {"type": "Summon", "id": "mirror_puppet", "attack": 3, "hp": 1},
            {"type": "ConditionalSummonBonus", "condition": {"type": "HasResource", "resource": "thread"}, "attack": 1, "hp": 1}
        ],
        "character": "puppeteer"
    }
]

# Chronomancer 分支卡 8 张
chronomancer_cards = [
    {
        "id": "afterimage_tick",
        "name": "Afterimage Tick",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["chronomancer", "timelayer"],
        "text": "Gain 1 TimeLayer. Draw 1 at the start of next turn.",
        "actions": [
            {"type": "GainResource", "resource": "timeLayer", "amount": 1},
            {"type": "DelayedDraw", "amount": 1, "turns": 1}
        ],
        "character": "chronomancer"
    },
    {
        "id": "delay_refraction",
        "name": "Delay Refraction",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["chronomancer", "defense"],
        "text": "Gain 7 Block. The next card this turn triggers again at 50% value next turn.",
        "actions": [
            {"type": "GainBlock", "amount": 7, "target": "Self"},
            {"type": "DelayNextCardEffect", "percent": 50}
        ],
        "character": "chronomancer"
    },
    {
        "id": "split_second",
        "name": "Split Second",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["chronomancer", "attack"],
        "text": "Deal 8 damage. If you have TimeLayer, deal 4 again next turn.",
        "actions": [
            {"type": "DealDamage", "amount": 8, "target": "Enemy"},
            {"type": "ConditionalDelayedDamage", "condition": {"type": "HasResource", "resource": "timeLayer"}, "amount": 4, "turns": 1}
        ],
        "character": "chronomancer"
    },
    {
        "id": "borrow_tomorrow",
        "name": "Borrow Tomorrow",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["chronomancer", "energy"],
        "text": "Gain 1 Energy next turn. Draw 1 less at end of this turn.",
        "actions": [
            {"type": "DelayedEnergy", "amount": 1, "turns": 1},
            {"type": "EndOfTurnDrawPenalty", "amount": 1}
        ],
        "character": "chronomancer"
    },
    {
        "id": "stolen_window",
        "name": "Stolen Window",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["chronomancer", "timelayer"],
        "text": "Gain 2 TimeLayer. If you have 3+ TimeLayer, draw 2.",
        "actions": [
            {"type": "GainResource", "resource": "timeLayer", "amount": 2},
            {"type": "ConditionalDraw", "condition": {"type": "ResourceThreshold", "resource": "timeLayer", "threshold": 3}, "amount": 2}
        ],
        "character": "chronomancer"
    },
    {
        "id": "echo_punishment",
        "name": "Echo Punishment",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["chronomancer", "attack"],
        "text": "Deal 10 damage. Deal 2 for each debuff on target.",
        "actions": [
            {"type": "DealDamage", "amount": 10, "target": "Enemy"},
            {"type": "ConditionalDamage", "condition": {"type": "TargetDebuffCount"}, "perDebuff": 2}
        ],
        "character": "chronomancer"
    },
    {
        "id": "fractured_hour",
        "name": "Fractured Hour",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Power",
        "targeting": "Self",
        "tags": ["chronomancer", "power"],
        "text": "The first time a delay effect triggers each turn, gain 3 Block.",
        "actions": [
            {"type": "StartOfTurnEffect", "trigger": {"type": "DelayEffectTrigger"}, "effect": {"type": "GainBlock", "amount": 3}}
        ],
        "character": "chronomancer"
    },
    {
        "id": "palimpsest_loop",
        "name": "Palimpsest Loop",
        "rarity": "Rare",
        "cost": 3,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["chronomancer", "power"],
        "text": "Choose a card played this turn. At start of next turn, replay it at no cost once.",
        "actions": [
            {"type": "SelectCardForReplay", "turns": 1, "costReduction": 99}
        ],
        "character": "chronomancer"
    }
]

# Alchemist 分支卡 8 张
alchemist_cards = [
    {
        "id": "prism_seed",
        "name": "Prism Seed",
        "rarity": "Common",
        "cost": 0,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["alchemist", "concoction"],
        "text": "Gain 1 Concoction and add 1 random element.",
        "actions": [
            {"type": "GainResource", "resource": "concoction", "amount": 1},
            {"type": "AddRandomElement", "amount": 1}
        ],
        "character": "alchemist"
    },
    {
        "id": "caustic_glass",
        "name": "Caustic Glass",
        "rarity": "Common",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["alchemist", "attack"],
        "text": "Deal 6 damage. Apply 3 Poison. If you added an element this turn, apply 1 Weak.",
        "actions": [
            {"type": "DealDamage", "amount": 6, "target": "Enemy"},
            {"type": "ApplyStatus", "status": "Poison", "stacks": 3, "target": "Enemy"},
            {"type": "ConditionalApply", "condition": {"type": "AddedElementThisTurn"}, "status": "Weak", "stacks": 1}
        ],
        "character": "alchemist"
    },
    {
        "id": "distill_barrier",
        "name": "Distill Barrier",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["alchemist", "defense"],
        "text": "Gain 8 Block. If you have 2 different elements, heal 3.",
        "actions": [
            {"type": "GainBlock", "amount": 8, "target": "Self"},
            {"type": "ConditionalHeal", "condition": {"type": "HasTwoElements"}, "amount": 3}
        ],
        "character": "alchemist"
    },
    {
        "id": "chromatic_bath",
        "name": "Chromatic Bath",
        "rarity": "Common",
        "cost": 1,
        "type": "Skill",
        "targeting": "Self",
        "tags": ["alchemist", "concoction"],
        "text": "Trigger a random element reaction. If you have Concoction, draw 1.",
        "actions": [
            {"type": "TriggerRandomElementReaction"},
            {"type": "ConditionalDraw", "condition": {"type": "HasResource", "resource": "concoction"}, "amount": 1}
        ],
        "character": "alchemist"
    },
    {
        "id": "mercury_lace",
        "name": "Mercury Lace",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Skill",
        "targeting": "AllEnemies",
        "tags": ["alchemist", "attack"],
        "text": "Spend 1 Concoction. Apply 2 Poison to all enemies. Gain 10 Block.",
        "actions": [
            {"type": "SpendResourceEffect", "resource": "concoction", "amount": 1, "effect": {"type": "ApplyStatus", "status": "Poison", "stacks": 2}},
            {"type": "GainBlock", "amount": 10, "target": "Self"}
        ],
        "character": "alchemist"
    },
    {
        "id": "vitriol_prism",
        "name": "Vitriol Prism",
        "rarity": "Uncommon",
        "cost": 1,
        "type": "Attack",
        "targeting": "Enemy",
        "tags": ["alchemist", "attack"],
        "text": "Deal 7 damage. If target has Poison, deal 7 again.",
        "actions": [
            {"type": "DealDamage", "amount": 7, "target": "Enemy"},
            {"type": "ConditionalDamage", "condition": {"type": "TargetHasStatus", "status": "Poison"}, "bonus": 7}
        ],
        "character": "alchemist"
    },
    {
        "id": "refined_chamber",
        "name": "Refined Chamber",
        "rarity": "Uncommon",
        "cost": 2,
        "type": "Power",
        "targeting": "Self",
        "tags": ["alchemist", "power"],
        "text": "The first time you gain Concoction each turn, heal 2 HP.",
        "actions": [
            {"type": "StartOfTurnEffect", "trigger": {"type": "GainResource", "resource": "concoction"}, "effect": {"type": "Heal", "amount": 2}}
        ],
        "character": "alchemist"
    },
    {
        "id": "perfect_solvent",
        "name": "Perfect Solvent",
        "rarity": "Rare",
        "cost": 3,
        "type": "Skill",
        "targeting": "AllEnemies",
        "tags": ["alchemist", "attack"],
        "text": "Spend all Concoction. For each, trigger an element reaction and apply 2 Poison to all enemies.",
        "actions": [
            {"type": "SpendAllResourceEffect", "resource": "concoction", "effect": [
                {"type": "TriggerRandomElementReaction"},
                {"type": "ApplyStatus", "status": "Poison", "stacks": 2, "target": "AllEnemies"}
            ]}
        ],
        "character": "alchemist"
    }
]

# 添加所有新卡
all_new_cards = mirror_shared_cards + informant_cards + brute_cards + tactician_cards + puppeteer_cards + chronomancer_cards + alchemist_cards
cards.extend(all_new_cards)

# 写回 cards.json
with open('src/content/data/cards.json', 'w') as f:
    json.dump(cards, f, indent=2, ensure_ascii=False)

print(f'Added {len(all_new_cards)} new cards:')
print(f'  Mirror shared: {len(mirror_shared_cards)}')
print(f'  Informant: {len(informant_cards)}')
print(f'  Brute: {len(brute_cards)}')
print(f'  Tactician: {len(tactician_cards)}')
print(f'  Puppeteer: {len(puppeteer_cards)}')
print(f'  Chronomancer: {len(chronomancer_cards)}')
print(f'  Alchemist: {len(alchemist_cards)}')
print(f'Total cards: {len(cards)}')
