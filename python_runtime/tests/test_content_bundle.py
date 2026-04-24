"""
test_content_bundle.py - 内容包构建与校验的单元测试

主要职责:
- 提供测试用的 build_content_bundle 工厂函数
- 验证内容包的版本、角色、敌人、卡牌、地图等结构完整性
"""

import unittest

from deckrogue_rules_core import boot


def build_content_bundle():
    return {
        "version": "runtime-v2-test",
        "characters": [
            {
                "id": "informant",
                "max_hp": 70,
                "max_energy": 3,
                "starting_gold": 99,
                "starting_deck": ["strike", "strike", "defend", "gather_intel"],
            }
        ],
        "enemies": [
            {"id": "slime_small", "hp_range": [11, 15], "keywords": [], "intent_policy": [{"intent": "tackle", "weight": 1}]},
            {"id": "gremlin_nob", "hp_range": [80, 85], "keywords": ["elite"], "intent_policy": [{"intent": "rush", "weight": 1}]},
            {"id": "slime_boss", "hp_range": [150, 165], "keywords": ["boss"], "intent_policy": [{"intent": "split", "weight": 1}]},
        ],
        "cards": [
            {"id": "strike", "rarity": "Starter", "character": "All"},
            {"id": "gather_intel", "rarity": "Common", "character": "informant"},
            {"id": "precision_strike", "rarity": "Uncommon", "character": "informant"},
            {"id": "surveillance", "rarity": "Common", "character": "informant"},
        ],
        "map": {
            "floors": 4,
            "branching": 2,
            "node_types": ["Combat"],
            "encounters": {
                "normal": ["slime_small"],
                "elite": ["gremlin_nob"],
                "boss": ["slime_boss"],
            },
        },
    }


class RuleRuntimeNodeEntryTests(unittest.TestCase):
    def test_enter_node_starts_combat_for_combat_rooms(self):
        runtime = boot(build_content_bundle(), seed=12345)
        runtime.dispatch({"type": "select_character", "character_id": "informant"})
        combat_node = next(node for node in runtime.snapshot()["map"]["nodes"] if node["type"] == "Combat" and node["y"] == 0)
        result = runtime.dispatch({"type": "enter_node", "node_id": combat_node["id"]})

        self.assertEqual(result["snapshot"]["lifecycle"]["screen"], "Combat")
        self.assertEqual(result["snapshot"]["lifecycle"]["phase"], "combat")
        self.assertEqual(result["snapshot"]["map"]["current_node_id"], combat_node["id"])
        self.assertIsNotNone(result["snapshot"]["combat"])
        self.assertGreaterEqual(len(result["snapshot"]["combat"]["enemy_ids"]), 1)
        self.assertLessEqual(len(result["snapshot"]["combat"]["enemy_ids"]), 2)
        self.assertTrue(all(enemy_id == "slime_small" for enemy_id in result["snapshot"]["combat"]["enemy_ids"]))
        self.assertEqual(result["snapshot"]["combat"]["player_energy"], 3)
        self.assertEqual(result["snapshot"]["combat"]["player_block"], 0)
        self.assertEqual(len(result["snapshot"]["combat"]["enemies"]), len(result["snapshot"]["combat"]["enemy_ids"]))
        self.assertTrue(all(enemy["next_intent"] == "tackle" for enemy in result["snapshot"]["combat"]["enemies"]))
        self.assertEqual(result["snapshot"]["meta"]["replay_length"], 2)

    def test_event_room_can_return_to_map(self):
        bundle = build_content_bundle()
        bundle["map"]["node_types"] = ["Event"]

        runtime = boot(bundle, seed=12345)
        runtime.dispatch({"type": "select_character", "character_id": "informant"})
        event_node = next(node for node in runtime.snapshot()["map"]["nodes"] if node["type"] == "Event" and node["y"] == 0)

        entered = runtime.dispatch({"type": "enter_node", "node_id": event_node["id"]})
        self.assertEqual(entered["snapshot"]["lifecycle"]["screen"], "Event")
        self.assertEqual(entered["snapshot"]["lifecycle"]["phase"], "event")
        self.assertTrue(entered["snapshot"]["lifecycle"]["pending_node_resolution"])
        self.assertIsNone(entered["snapshot"]["combat"])

        left = runtime.dispatch({"type": "leave_room"})
        self.assertEqual(left["snapshot"]["lifecycle"]["screen"], "Map")
        self.assertEqual(left["snapshot"]["lifecycle"]["phase"], "map")
        self.assertFalse(left["snapshot"]["lifecycle"]["pending_node_resolution"])
        self.assertEqual(left["snapshot"]["map"]["current_node_id"], event_node["id"])
        self.assertEqual(left["snapshot"]["meta"]["replay_length"], 3)

    def test_complete_combat_transitions_to_reward_and_take_reward_adds_card(self):
        runtime = boot(build_content_bundle(), seed=12345)
        runtime.dispatch({"type": "select_character", "character_id": "informant"})
        combat_node = next(node for node in runtime.snapshot()["map"]["nodes"] if node["type"] == "Combat" and node["y"] == 0)
        runtime.dispatch({"type": "enter_node", "node_id": combat_node["id"]})

        reward = runtime.dispatch({"type": "complete_combat"})
        self.assertEqual(reward["snapshot"]["lifecycle"]["screen"], "Reward")
        self.assertEqual(reward["snapshot"]["lifecycle"]["phase"], "reward")
        self.assertIsNone(reward["snapshot"]["combat"])
        self.assertEqual(reward["snapshot"]["reward"]["source"], "combat")
        self.assertGreaterEqual(len(reward["snapshot"]["reward"]["card_ids"]), 1)
        self.assertLessEqual(len(reward["snapshot"]["reward"]["card_ids"]), 3)

        selected_card_id = reward["snapshot"]["reward"]["card_ids"][0]
        taken = runtime.dispatch({"type": "take_reward", "card_id": selected_card_id})
        self.assertEqual(taken["snapshot"]["lifecycle"]["screen"], "Map")
        self.assertEqual(taken["snapshot"]["lifecycle"]["phase"], "map")
        self.assertIsNone(taken["snapshot"]["reward"])
        self.assertIn(selected_card_id, taken["snapshot"]["player"]["deck"])

    def test_take_reward_without_card_id_defaults_to_first_offer(self):
        runtime = boot(build_content_bundle(), seed=12345)
        runtime.dispatch({"type": "select_character", "character_id": "informant"})
        combat_node = next(node for node in runtime.snapshot()["map"]["nodes"] if node["type"] == "Combat" and node["y"] == 0)
        runtime.dispatch({"type": "enter_node", "node_id": combat_node["id"]})

        reward = runtime.dispatch({"type": "complete_combat"})
        first_offer = reward["snapshot"]["reward"]["card_ids"][0]
        taken = runtime.dispatch({"type": "take_reward"})

        self.assertIn(first_offer, taken["snapshot"]["player"]["deck"])
        self.assertIsNone(taken["snapshot"]["reward"])
        self.assertEqual(taken["snapshot"]["lifecycle"]["phase"], "map")


if __name__ == "__main__":
    unittest.main()
