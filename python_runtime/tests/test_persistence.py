"""
test_persistence.py - 存档序列化与回放日志功能的单元测试

主要职责:
- 验证 create_save_game_v2 / restore_snapshot_from_save_game 的往返一致性
- 验证 replay_log 能从日志重建最终快照
"""

import unittest

from deckrogue_rules_core import (
    boot,
    create_replay_log_v1,
    create_save_game_v2,
    replay_log,
    restore_snapshot_from_save_game,
)

from python_runtime.tests.test_content_bundle import build_content_bundle


class RuleRuntimePersistenceTests(unittest.TestCase):
    def test_create_save_game_v2_round_trips_snapshot(self):
        runtime = boot(build_content_bundle(), seed=12345)
        runtime.dispatch({"type": "select_character", "character_id": "informant"})
        snapshot = runtime.snapshot()

        save_game = create_save_game_v2(snapshot, "web", "2026-03-11T10:00:00.000Z")
        restored = restore_snapshot_from_save_game(save_game)

        self.assertEqual(save_game["host_platform"], "web")
        self.assertEqual(save_game["saved_at"], "2026-03-11T10:00:00.000Z")
        self.assertEqual(restored, snapshot)

    def test_replay_log_rebuilds_final_snapshot(self):
        content_bundle = build_content_bundle()
        runtime = boot(content_bundle, seed=12345)
        runtime.dispatch({"type": "select_character", "character_id": "informant"})
        runtime.dispatch({"type": "enter_node", "node_id": "floor_1_node_0"})
        reward = runtime.dispatch({"type": "complete_combat"})["snapshot"]["reward"]
        selected_card_id = reward["card_ids"][0]

        commands = [
            {"type": "select_character", "character_id": "informant"},
            {"type": "enter_node", "node_id": "floor_1_node_0"},
            {"type": "complete_combat"},
            {"type": "take_reward", "card_id": selected_card_id},
        ]

        log = create_replay_log_v1(12345, commands)
        snapshot = replay_log(content_bundle, log)

        self.assertEqual(snapshot["seed"], 12345)
        self.assertEqual(snapshot["lifecycle"]["phase"], "map")
        self.assertIsNone(snapshot["reward"])
        self.assertIn(selected_card_id, snapshot["player"]["deck"])


if __name__ == "__main__":
    unittest.main()
