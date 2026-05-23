"""
test_runtime.py - RuleRuntime 核心运行时的单元测试

主要职责:
- 验证角色选择、地图导航、战斗流程等核心游戏逻辑
- 验证事件分派与快照状态转换的正确性
"""

import unittest

from deckrogue_rules_core import boot


def build_content_bundle():
    return {
        "characters": [
            {
                "id": "informant",
                "max_hp": 70,
                "secondary_resource": "evidence",
                "starting_gold": 99,
                "starting_deck": ["strike", "strike", "defend", "gather_intel"],
            },
            {
                "id": "brute",
                "max_hp": 80,
                "secondary_resource": "rage",
                "starting_gold": 99,
                "starting_deck": ["strike", "strike", "defend", "bash"],
            },
        ],
        "map": {
            "floors": 6,
            "branching": 2,
        },
    }


class RuleRuntimeTests(unittest.TestCase):
    def test_select_character_moves_runtime_to_map_and_records_replay(self):
        runtime = boot(build_content_bundle(), seed=12345)

        result = runtime.dispatch({"type": "select_character", "character_id": "informant"})

        self.assertEqual(result["snapshot"]["player"]["character_id"], "informant")
        self.assertEqual(result["snapshot"]["player"]["secondary_resources"]["evidence"], 0)
        self.assertEqual(result["snapshot"]["player"]["evidence"], 0)
        self.assertEqual(result["snapshot"]["lifecycle"]["screen"], "Map")
        self.assertGreater(len(result["snapshot"]["player"]["deck"]), 0)
        self.assertGreater(len(result["snapshot"]["map"]["nodes"]), 0)
        self.assertEqual(result["snapshot"]["meta"]["replay_length"], 1)

    def test_load_restores_snapshot_without_mutating_seed(self):
        runtime = boot(build_content_bundle(), seed=54321)
        selected = runtime.dispatch({"type": "select_character", "character_id": "brute"})["snapshot"]

        another = boot(build_content_bundle(), seed=1)
        loaded = another.load(selected)

        self.assertEqual(loaded["player"]["character_id"], "brute")
        self.assertEqual(loaded["seed"], 54321)
        self.assertEqual(loaded["player"]["deck"], selected["player"]["deck"])
        self.assertEqual(loaded["map"]["nodes"], selected["map"]["nodes"])

    def test_zero_route_signal_strength_remains_zero_when_deriving_route_state(self):
        bundle = build_content_bundle()
        bundle["characters"][0]["starting_deck"] = ["zero_signal"]
        bundle["cards"] = [
            {
                "id": "zero_signal",
                "character": "informant",
                "route_tags": ["informant:evidence"],
                "route_signal_strength": 0,
            }
        ]
        runtime = boot(bundle, seed=12345)

        selected = runtime.dispatch({"type": "select_character", "character_id": "informant"})["snapshot"]

        self.assertEqual(selected["route_state"]["primary_tag"], "informant:evidence")
        self.assertEqual(selected["route_state"]["confidence"], 54)


if __name__ == "__main__":
    unittest.main()
