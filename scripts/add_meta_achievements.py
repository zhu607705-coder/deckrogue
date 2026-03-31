import json

with open('src/content/data/achievements.json', 'r') as f:
    achievements = json.load(f)

new_achievements = [
  {
    "id": "chapter1_clear",
    "title": "第一章征服者",
    "description": "击败第一章 Boss。",
    "conditions": {
      "chapterReached": 1,
      "requireVictory": False
    },
    "rewards": {
      "unlockedPoolIds": ["chapter1_bonus_pool"]
    }
  },
  {
    "id": "chapter2_clear",
    "title": "第二章征服者",
    "description": "击败第二章 Boss。",
    "conditions": {
      "chapterReached": 2,
      "requireVictory": False
    },
    "rewards": {
      "unlockedPoolIds": ["chapter2_bonus_pool"],
      "startingRelics": ["field_compass"]
    }
  },
  {
    "id": "chapter3_clear",
    "title": "第三章征服者",
    "description": "击败第三章 Boss。",
    "conditions": {
      "chapterReached": 3,
      "requireVictory": True
    },
    "rewards": {
      "unlockedPoolIds": ["chapter3_bonus_pool"],
      "startingRelics": ["codex_chip"],
      "backgrounds": ["bg_void_observatory"]
    }
  },
  {
    "id": "poison_master",
    "title": "毒素大师",
    "description": "单局中 Poison 贡献超过 40% 总伤害。",
    "conditions": {
      "poisonContribution": 0.4
    },
    "rewards": {
      "startingRelics": ["silent_beads"]
    }
  },
  {
    "id": "control_master",
    "title": "控制大师",
    "description": "单局中控制时间超过 60% 战斗回合。",
    "conditions": {
      "controlUptime": 0.6
    },
    "rewards": {
      "unlockedPoolIds": ["control_bonus_pool"]
    }
  },
  {
    "id": "attrition_master",
    "title": "消耗大师",
    "description": "单局中平均战斗回合数超过 12 回合。",
    "conditions": {
      "avgCombatTurns": 12
    },
    "rewards": {
      "startingRelics": ["coolant_phial"]
    }
  },
  {
    "id": "glass_cannon",
    "title": "玻璃大炮",
    "description": "单局中受到的总伤害不超过最大生命值的 200%。",
    "conditions": {
      "totalDamageTakenRatio": 2.0
    },
    "rewards": {
      "startingRelics": ["ember_pin"]
    }
  },
  {
    "id": "doctrine_master",
    "title": "教义大师",
    "description": "使用所有 6 种 Doctrine 各通关一次。",
    "conditions": {
      "allDoctrinesCleared": True
    },
    "rewards": {
      "backgrounds": ["bg_martyr_shrine"]
    }
  },
  {
    "id": "upgrade_collector",
    "title": "升级收藏家",
    "description": "单局中激活 5 个以上 Upgrade。",
    "conditions": {
      "activeUpgradesCount": 5
    },
    "rewards": {
      "unlockedPoolIds": ["upgrade_bonus_pool"]
    }
  },
  {
    "id": "pact_survivor",
    "title": "契约幸存者",
    "description": "单局中激活 3 个以上 Pact 并通关。",
    "conditions": {
      "activePactsCount": 3,
      "requireVictory": True
    },
    "rewards": {
      "startingRelics": ["grave_oil"]
    }
  },
  {
    "id": "meta_initiate",
    "title": "Meta 初学者",
    "description": "完成 10 局游戏。",
    "conditions": {
      "totalRunsCompleted": 10
    },
    "rewards": {
      "startingRelics": ["surgical_thread"]
    }
  },
  {
    "id": "meta_veteran",
    "title": "Meta 老兵",
    "description": "完成 50 局游戏。",
    "conditions": {
      "totalRunsCompleted": 50
    },
    "rewards": {
      "startingRelics": ["martyr_coin"],
      "backgrounds": ["bg_forgotten_foundry"]
    }
  }
]

achievements.extend(new_achievements)

with open('src/content/data/achievements.json', 'w') as f:
    json.dump(achievements, f, indent=2, ensure_ascii=False)

print(f'Added {len(new_achievements)} achievements. Total: {len(achievements)}')
