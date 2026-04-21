import unittest

from deckrogue_rules_core import boot


def build_content_bundle():
    return {
        "characters": [
            {
                "id": "informant",
                "max_hp": 70,
                "starting_gold": 99,
                "starting_deck": ["strike", "strike", "defend", "gather_intel"],
            },
            {
                "id": "brute",
                "max_hp": 80,
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


if __name__ == "__main__":
    unittest.main()
