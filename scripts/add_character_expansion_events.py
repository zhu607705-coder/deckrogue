import json

# 主线章节插入事件 8 个
main_chapter_events = [
    {
        "id": "mirror_invitation",
        "name": "Mirror Invitation",
        "chapter": "any",
        "description": "A mysterious reflection beckons you toward the Mirror Palace.",
        "options": [
            {
                "text": "Accept the invitation",
                "effects": [
                    {"type": "EnterMirrorZone"}
                ],
                "danger": "low"
            },
            {
                "text": "Decline politely",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "borrowed_name",
        "name": "Borrowed Name",
        "chapter": "any",
        "description": "A shadow offers to exchange your name for power.",
        "options": [
            {
                "text": "Lose 10 HP for 1 Branch Uncommon card",
                "effects": [
                    {"type": "LoseHP", "amount": 10},
                    {"type": "AddCardToDeck", "rarity": "Uncommon", "tags": ["branch"]}
                ],
                "danger": "medium"
            },
            {
                "text": "Decline",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "silver_confessional",
        "name": "Silver Confessional",
        "chapter": "any",
        "description": "A silver booth offers absolution or reward.",
        "options": [
            {
                "text": "Remove 1 card from deck",
                "effects": [
                    {"type": "RemoveCard", "cost": 0}
                ],
                "danger": "low"
            },
            {
                "text": "Gain 1 Mirror relic",
                "effects": [
                    {"type": "GainRelic", "pool": "mirror"}
                ],
                "danger": "low"
            },
            {
                "text": "Leave",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "hallway_of_echoes",
        "name": "Hallway of Echoes",
        "chapter": "any",
        "description": "Voices in the corridor whisper of duplication.",
        "options": [
            {
                "text": "Copy 1 Common card and add a curse",
                "effects": [
                    {"type": "AddCardToDeck", "rarity": "Common"},
                    {"type": "AddCardToDeck", "id": "paranoia"}
                ],
                "danger": "medium"
            },
            {
                "text": "Leave",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "fractured_rehearsal",
        "name": "Fractured Rehearsal",
        "chapter": "any",
        "description": "A cracked mirror shows your potential.",
        "options": [
            {
                "text": "Upgrade 1 Skill. Start next 2 combats with 1 Weak.",
                "effects": [
                    {"type": "UpgradeCard", "type": "Skill"},
                    {"type": "AddTemporaryCurse", "id": "weak_start"}
                ],
                "danger": "high"
            },
            {
                "text": "Leave",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "masked_auction",
        "name": "Masked Auction",
        "chapter": "any",
        "description": "Masked figures auction unknown treasures.",
        "options": [
            {
                "text": "Pay 70 Gold for 1 of 3 Branch cards",
                "effects": [
                    {"type": "SpendGold", "amount": 70},
                    {"type": "ChooseCardFromPool", "count": 3, "rarity": "branch"}
                ],
                "danger": "medium"
            },
            {
                "text": "Leave empty-handed",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "palace_wager",
        "name": "Palace Wager",
        "chapter": "any",
        "description": "A golden wager with high stakes.",
        "options": [
            {
                "text": "Combat for a Rare relic. Failure costs 15 HP.",
                "effects": [
                    {"type": "CombatChallenge", "rewards": {"relic": "Rare"}, "penalty": {"type": "LoseHP", "amount": 15}}
                ],
                "danger": "high"
            },
            {
                "text": "Decline",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "shattered_archive",
        "name": "Shattered Archive",
        "chapter": "any",
        "description": "A library of broken mirrors reveals paths unseen.",
        "options": [
            {
                "text": "Reveal the rest of the map and gain resources equal to your Intel",
                "effects": [
                    {"type": "RevealMap"},
                    {"type": "GainResourceEqualTo", "resource": "intel"}
                ],
                "danger": "low"
            },
            {
                "text": "Leave",
                "effects": [],
                "danger": "none"
            }
        ]
    }
]

# 镜宫内事件 6 个
mirror_zone_events = [
    {
        "id": "court_of_copies",
        "name": "Court of Copies",
        "chapter": "mirror",
        "description": "Mirrors show cards that match your deck.",
        "options": [
            {
                "text": "Choose 1 of 3 mirror cards related to your deck",
                "effects": [
                    {"type": "ChooseCardFromPool", "count": 3, "pool": "mirrorRelated"}
                ],
                "danger": "low"
            },
            {
                "text": "Leave without choosing",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "silent_corridor",
        "name": "Silent Corridor",
        "chapter": "mirror",
        "description": "A quiet path offers restoration.",
        "options": [
            {
                "text": "Heal 18% of max HP",
                "effects": [
                    {"type": "HealPercent", "percent": 18}
                ],
                "danger": "none"
            },
            {
                "text": "Remove 1 card from deck",
                "effects": [
                    {"type": "RemoveCard", "cost": 0}
                ],
                "danger": "low"
            },
            {
                "text": "Continue without resting",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "broken_throne",
        "name": "Broken Throne",
        "chapter": "mirror",
        "description": "A shattered throne offers one gift.",
        "options": [
            {
                "text": "Gain 1 High-Value Mirror relic (adds a curse)",
                "effects": [
                    {"type": "GainRelic", "pool": "mirrorHighValue"},
                    {"type": "AddCardToDeck", "id": "paranoia"}
                ],
                "danger": "medium"
            },
            {
                "text": "Leave empty-handed",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "rehearsal_pit",
        "name": "Rehearsal Pit",
        "chapter": "mirror",
        "description": "A combat arena for practice.",
        "options": [
            {
                "text": "Fight an enhanced enemy. Victory upgrades 2 cards.",
                "effects": [
                    {"type": "CombatChallenge", "rewards": {"upgrade": 2}}
                ],
                "danger": "high"
            },
            {
                "text": "Back away",
                "effects": [],
                "danger": "none"
            }
        ]
    },
    {
        "id": "one_true_face",
        "name": "One True Face",
        "chapter": "mirror",
        "description": "A mirror shows two possible selves.",
        "options": [
            {
                "text": "Gain +1 Branch Resource engine",
                "effects": [
                    {"type": "GainResource", "resource": "branchEngine", "amount": 1}
                ],
                "danger": "none"
            },
            {
                "text": "Gain 40 Gold",
                "effects": [
                    {"type": "GainGold", "amount": 40}
                ],
                "danger": "none"
            }
        ]
    },
    {
        "id": "mirror_exit",
        "name": "Mirror Exit",
        "chapter": "mirror",
        "description": "The exit offers three treasures.",
        "options": [
            {
                "text": "Choose: Branch card",
                "effects": [
                    {"type": "ChooseCardFromPool", "count": 1, "pool": "branch"}
                ],
                "danger": "none"
            },
            {
                "text": "Choose: Mirror relic",
                "effects": [
                    {"type": "GainRelic", "pool": "mirror"}
                ],
                "danger": "none"
            },
            {
                "text": "Choose: Heal 25% HP",
                "effects": [
                    {"type": "HealPercent", "percent": 25}
                ],
                "danger": "none"
            }
        ]
    }
]

# 所有新事件
all_new_events = main_chapter_events + mirror_zone_events

# 写入新文件
with open('src/content/data/mirror_events.json', 'w') as f:
    json.dump(all_new_events, f, indent=2, ensure_ascii=False)

print(f'Created mirror_events.json with {len(all_new_events)} events:')
print(f'  Main chapter events: {len(main_chapter_events)}')
print(f'  Mirror zone events: {len(mirror_zone_events)}')
