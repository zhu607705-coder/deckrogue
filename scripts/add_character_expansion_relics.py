import json

# 读取现有的 relics.json
with open('src/content/data/relics.json', 'r') as f:
    relics = json.load(f)

# 职业分支 signpost relic 6 个
branch_signpost_relics = [
    {
        "id": "ledger_mask",
        "name": "Ledger Mask",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "The first time you apply Weak or Vulnerable each turn, gain 1 Evidence.",
        "effect": {
            "type": "TriggerOnDebuffApply",
            "statuses": ["Weak", "Vulnerable"],
            "effect": {"type": "GainResource", "resource": "evidence", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Every accusation leaves a mark."
    },
    {
        "id": "blood_ram",
        "name": "Blood Ram",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "The first time you take 8+ damage each turn, gain 1 Rage.",
        "effect": {
            "type": "TriggerOnDamageTaken",
            "threshold": 8,
            "effect": {"type": "GainResource", "resource": "rage", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Pain fuels the fire within."
    },
    {
        "id": "command_pin",
        "name": "Command Pin",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "The first time you end your turn with 12+ Block each turn, gain 1 Command.",
        "effect": {
            "type": "TriggerOnBlockThreshold",
            "threshold": 12,
            "effect": {"type": "GainResource", "resource": "command", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Order is the ultimate weapon."
    },
    {
        "id": "silver_threads",
        "name": "Silver Threads",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "The first summoned creature each turn gains +1 Attack.",
        "effect": {
            "type": "TriggerOnFirstSummon",
            "effect": {"type": "SummonBuff", "attack": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Every puppet needs a guiding hand."
    },
    {
        "id": "cracked_hourglass",
        "name": "Cracked Hourglass",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "The first time a delay effect triggers each turn, draw 1.",
        "effect": {
            "type": "TriggerOnDelayEffect",
            "effect": {"type": "Draw", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Time breaks, but echoes remain."
    },
    {
        "id": "prism_crucible",
        "name": "Prism Crucible",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "The first time you gain Concoction each turn, randomly add 1 element.",
        "effect": {
            "type": "TriggerOnResourceGain",
            "resource": "concoction",
            "effect": {"type": "AddRandomElement"}
        },
        "isStartingRelic": False,
        "flavorText": "Elements fuse in the crucible of battle."
    }
]

# 镜宫共享 relic 8 个
mirror_shared_relics = [
    {
        "id": "mirror_ink",
        "name": "Mirror Ink",
        "rarity": "Uncommon",
        "trigger": "Passive",
        "description": "Deal 2追加 damage when attacking an enemy with any debuff.",
        "effect": {
            "type": "OnAttackDebuffedEnemy",
            "bonus": 2
        },
        "isStartingRelic": False,
        "flavorText": "Ink that marks the marked."
    },
    {
        "id": "echo_buckle",
        "name": "Echo Buckle",
        "rarity": "Uncommon",
        "trigger": "Passive",
        "description": "After playing your 4th card each turn, gain 4 Block.",
        "effect": {
            "type": "OnCardPlayed",
            "count": 4,
            "effect": {"type": "GainBlock", "amount": 4}
        },
        "isStartingRelic": False,
        "flavorText": "Every action echoes in defense."
    },
    {
        "id": "borrowed_crown",
        "name": "Borrowed Crown",
        "rarity": "Uncommon",
        "trigger": "StartRun",
        "description": "The first event of each chapter has 1 additional high-risk option.",
        "effect": {
            "type": "ExtraEventOption",
            "optionType": "highRisk",
            "frequency": "perChapterFirst"
        },
        "isStartingRelic": False,
        "flavorText": "A crown borrowed from tomorrow."
    },
    {
        "id": "silent_mirror",
        "name": "Silent Mirror",
        "rarity": "Uncommon",
        "trigger": "Passive",
        "description": "The first time you remove a debuff from yourself each combat, draw 1.",
        "effect": {
            "type": "OnRemoveSelfDebuff",
            "effect": {"type": "Draw", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Reflection speaks only in silence."
    },
    {
        "id": "fracture_lens",
        "name": "Fracture Lens",
        "rarity": "Uncommon",
        "trigger": "Passive",
        "description": "The first attack that hits a debuffed enemy each turn deals +3 damage.",
        "effect": {
            "type": "OnFirstAttackDebuffed",
            "bonus": 3
        },
        "isStartingRelic": False,
        "flavorText": "Cracks reveal the truth within."
    },
    {
        "id": "palace_abacus",
        "name": "Palace Abacus",
        "rarity": "Uncommon",
        "trigger": "Passive",
        "description": "The first time you spend a resource each turn, gain 3 Block.",
        "effect": {
            "type": "OnFirstResourceSpend",
            "effect": {"type": "GainBlock", "amount": 3}
        },
        "isStartingRelic": False,
        "flavorText": "Every resource counted in defense."
    },
    {
        "id": "shard_lantern",
        "name": "Shard Lantern",
        "rarity": "Uncommon",
        "trigger": "StartCombat",
        "description": "Apply 1 Weak to a random enemy at the start of combat.",
        "effect": {
            "type": "StartCombatEffect",
            "effect": {"type": "ApplyStatus", "status": "Weak", "stacks": 1, "target": "RandomEnemy"}
        },
        "isStartingRelic": False,
        "flavorText": "Light reveals what shadow hides."
    },
    {
        "id": "dream_sheath",
        "name": "Dream Sheath",
        "rarity": "Uncommon",
        "trigger": "Passive",
        "description": "If you took no damage this turn, gain 1 temporary resource at end of turn.",
        "effect": {
            "type": "EndOfTurnEffect",
            "condition": {"type": "TookNoDamageThisTurn"},
            "effect": {"type": "GainResource", "resource": "random", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "Dreams fuel the unwounded."
    }
]

# 镜宫高价值 relic 4 个
mirror_highvalue_relics = [
    {
        "id": "regent_seal",
        "name": "Regent Seal",
        "rarity": "Rare",
        "trigger": "EndCombat",
        "description": "After the first elite combat of each chapter, choose 1 from 3 relics.",
        "effect": {
            "type": "PostEliteChoice",
            "count": 3,
            "frequency": "perChapterFirst"
        },
        "isStartingRelic": False,
        "flavorText": "The regent's authority extends even to rewards."
    },
    {
        "id": "court_tax",
        "name": "Court Tax",
        "rarity": "Rare",
        "trigger": "StartCombat",
        "description": "Gain 1 Energy at start of combat. Lose 5 HP every 3 turns.",
        "effect": {
            "type": "StartCombatEffect",
            "effect": {"type": "GainEnergy", "amount": 1}
        },
        "isStartingRelic": False,
        "flavorText": "The court extracts its due."
    },
    {
        "id": "mirror_taxonomy",
        "name": "Mirror Taxonomy",
        "rarity": "Rare",
        "trigger": "EnterMirrorZone",
        "description": "When entering the Mirror Zone, gain an additional choice from 3 branch cards.",
        "effect": {
            "type": "MirrorZoneEffect",
            "effect": {"type": "ExtraBranchChoice", "count": 3}
        },
        "isStartingRelic": False,
        "flavorText": "Classification reveals paths unseen."
    },
    {
        "id": "fatal_index",
        "name": "Fatal Index",
        "rarity": "Rare",
        "trigger": "Passive",
        "description": "Deal 4 True Damage when attacking an enemy with both Weak and Poison.",
        "effect": {
            "type": "OnAttackDoubleDebuffed",
            "debuffs": ["Weak", "Poison"],
            "trueDamage": 4
        },
        "isStartingRelic": False,
        "flavorText": "The index marks those marked for death."
    }
]

# 添加所有新遗物
all_new_relics = branch_signpost_relics + mirror_shared_relics + mirror_highvalue_relics
relics.extend(all_new_relics)

# 写回 relics.json
with open('src/content/data/relics.json', 'w') as f:
    json.dump(relics, f, indent=2, ensure_ascii=False)

print(f'Added {len(all_new_relics)} new relics:')
print(f'  Branch signpost: {len(branch_signpost_relics)}')
print(f'  Mirror shared: {len(mirror_shared_relics)}')
print(f'  Mirror high-value: {len(mirror_highvalue_relics)}')
print(f'Total relics: {len(relics)}')
