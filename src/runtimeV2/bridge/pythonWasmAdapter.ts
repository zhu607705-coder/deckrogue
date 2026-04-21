import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';

interface PyodideInterface {
  globals: {
    set(name: string, value: unknown): void;
  };
  runPythonAsync(code: string): Promise<{
    toJs(): unknown;
  }>;
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

const PYTHON_RUNTIME_CODE = `
from __future__ import annotations

from copy import deepcopy
import json
import math
from random import Random
from typing import Any


def _int32(value: int) -> int:
    value &= 0xFFFFFFFF
    return value if value < 0x80000000 else value - 0x100000000


def _imul(a: int, b: int) -> int:
    return _int32((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF))


class RuleRuntime:
    def __init__(self, content_bundle: dict[str, Any], seed: int = 0):
        self._content_bundle = deepcopy(content_bundle)
        self._seed = int(seed)
        self._runtime_rng_state = 0
        self._replay: list[dict[str, Any]] = []
        self._snapshot = self._create_initial_snapshot(self._seed)

    def dispatch(self, command: dict[str, Any]) -> dict[str, Any]:
        command_type = command["type"]
        if command_type == "start_run":
            self._seed = int(command.get("seed", self._seed))
            self._runtime_rng_state = 0
            self._snapshot = self._create_initial_snapshot(self._seed)
        elif command_type == "select_character":
            self._apply_select_character(str(command["character_id"]))
        elif command_type == "enter_node":
            self._apply_enter_node(str(command["node_id"]))
        elif command_type == "leave_room":
            self._apply_leave_room()
        elif command_type == "complete_combat":
            self._apply_complete_combat()
        elif command_type == "take_reward":
            self._apply_take_reward(command.get("card_id"))
        elif command_type == "skip_reward":
            self._apply_skip_reward()
        elif command_type == "choose_event_option":
            self._apply_choose_event_option(str(command.get("choice_id", "continue")))
        elif command_type == "rest":
            self._apply_rest()
        elif command_type == "upgrade_card":
            self._apply_upgrade_card(command.get("card_instance_id"))
        elif command_type == "remove_card":
            self._apply_remove_card(command.get("card_instance_id"))
        elif command_type == "load_snapshot":
            self.load(command["snapshot"])
            return {"snapshot": self.snapshot(), "events": [{"type": "runtime.load_snapshot"}]}
        else:
            raise ValueError(f"Unsupported command: {command_type}")

        self._replay.append(deepcopy(command))
        self._snapshot["meta"]["replay_length"] = len(self._replay)
        return {
            "snapshot": self.snapshot(),
            "events": [{"type": f"runtime.{command_type}"}],
        }

    def snapshot(self) -> dict[str, Any]:
        return deepcopy(self._snapshot)

    def load(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        self._snapshot = deepcopy(snapshot)
        self._seed = int(self._snapshot["seed"])
        self._runtime_rng_state = 0
        return self.snapshot()

    def _apply_select_character(self, character_id: str) -> None:
        character = next(
            (entry for entry in self._content_bundle.get("characters", []) if entry["id"] == character_id),
            None,
        )
        if character is None:
            raise ValueError(f"Unknown character: {character_id}")

        self._snapshot["player"] = {
            "character_id": character_id,
            "hp": int(character["max_hp"]),
            "max_hp": int(character["max_hp"]),
            "gold": int(character.get("starting_gold", 99)),
            "intel": 0,
            "devotion": 0,
            "corruption": 0,
            "deck": list(character.get("starting_deck", [])),
            "relic_ids": [],
            "potion_ids": [],
        }
        for _ in self._snapshot["player"]["deck"]:
            self._consume_runtime_id()
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }
        self._snapshot["map"] = {
            "current_node_id": None,
            "nodes": self._generate_map(self._seed),
        }
        self._snapshot["combat"] = None
        self._snapshot["reward"] = None
        self._snapshot["active_event"] = None

    def _apply_enter_node(self, node_id: str) -> None:
        if self._snapshot["lifecycle"]["phase"] != "map":
            raise ValueError("enter_node is only valid during map phase")

        nodes = self._snapshot["map"]["nodes"]
        node = next((entry for entry in nodes if entry["id"] == node_id), None)
        if node is None:
            raise ValueError(f"Unknown node: {node_id}")

        current_node_id = self._snapshot["map"]["current_node_id"]
        if current_node_id is None and int(node["y"]) != 0:
            raise ValueError(f"Cannot enter non-starting node: {node_id}")
        if current_node_id is not None:
            current_node = next((entry for entry in nodes if entry["id"] == current_node_id), None)
            if current_node is None or node_id not in current_node["next"]:
                raise ValueError(f"Node is not reachable: {node_id}")

        self._snapshot["map"]["current_node_id"] = node_id
        node["revealed"] = True
        for next_node_id in node.get("next", []):
            next_node = next((entry for entry in nodes if entry["id"] == next_node_id), None)
            if next_node is not None:
                next_node["revealed"] = True

        node_type = str(node["type"])
        if node_type in {"Combat", "Elite", "Boss"}:
            self._start_combat(node_type)
            return

        phase = node_type.lower()
        screen = "Rest" if node_type == "Rest" else node_type
        self._snapshot["combat"] = None
        self._snapshot["reward"] = None
        self._snapshot["active_event"] = None
        self._snapshot["lifecycle"] = {
            "screen": screen,
            "phase": phase,
            "pending_node_resolution": True,
        }

        if node_type == "Event":
            self._start_event()

    def _start_event(self) -> None:
        events = self._content_bundle.get("events", [])
        if not events:
            events = [{"id": "mysterious_shrine"}, {"id": "heretic_altar"}]
        selected_event = events[int(self._next_runtime_random() * len(events))]
        self._snapshot["active_event"] = {
            "id": str(selected_event["id"]),
            "stage": None,
            "data": {},
        }

    def _apply_choose_event_option(self, choice_id: str) -> None:
        if self._snapshot["lifecycle"]["phase"] != "event":
            raise ValueError("choose_event_option is only valid during event phase")

        event = self._snapshot.get("active_event")
        if event:
            event["data"] = {**(event.get("data") or {}), "last_choice_id": choice_id}

        self._snapshot["active_event"] = None
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }

    def _apply_rest(self) -> None:
        if self._snapshot["lifecycle"]["phase"] != "rest":
            raise ValueError("rest is only valid during rest phase")
        max_hp = int(self._snapshot["player"]["max_hp"])
        heal_amount = max(1, int(max_hp * 0.3))
        self._snapshot["player"]["hp"] = min(max_hp, int(self._snapshot["player"]["hp"]) + heal_amount)

    def _apply_upgrade_card(self, _card_instance_id: Any) -> None:
        pass

    def _apply_remove_card(self, card_instance_id: Any) -> None:
        if card_instance_id is not None and self._snapshot["player"]["deck"]:
            self._snapshot["player"]["deck"].pop(0)

    def _start_combat(self, node_type: str) -> None:
        floor = int(self._get_current_node()["y"]) + 1 if self._get_current_node() is not None else 1
        encounter_key = "normal"
        if node_type == "Elite":
            encounter_key = "elite"
        elif node_type == "Boss":
            encounter_key = "boss"

        encounter_pool = list(self._content_bundle.get("map", {}).get("encounters", {}).get(encounter_key, []))
        if not encounter_pool:
            raise ValueError(f"No encounters configured for {encounter_key}")

        hp_multiplier = self._calculate_enemy_hp_multiplier(floor)
        enemy_count = 1 if node_type == "Boss" else 2 if node_type == "Elite" else 1 + int(self._next_runtime_random() * 2)
        enemies_by_id = {
            str(entry["id"]): entry
            for entry in self._content_bundle.get("enemies", [])
            if "id" in entry
        }
        enemy_ids: list[str] = []
        enemy_states: list[dict[str, Any]] = []
        for _ in range(enemy_count):
            selected_enemy_id = encounter_pool[int(self._next_runtime_random() * len(encounter_pool))]
            enemy_ids.append(str(selected_enemy_id))
            enemy_def = enemies_by_id.get(str(selected_enemy_id))
            rolled_hp = 1
            if enemy_def is not None:
                min_hp = int(enemy_def.get("hp_range", [1, 1])[0])
                max_hp = int(enemy_def.get("hp_range", [min_hp, min_hp])[1])
                hp_span = max(0, max_hp - min_hp)
                rolled_hp = min_hp + int(self._next_runtime_random() * (hp_span + 1))
                rolled_hp = self._apply_enemy_hp_tuning(rolled_hp, floor, node_type, hp_multiplier)
            else:
                self._next_runtime_random()
            enemy_runtime_id = self._consume_runtime_id()
            next_intent = self._roll_enemy_intent(enemy_def)
            enemy_states.append(
                {
                    "id": enemy_runtime_id,
                    "def_id": str(selected_enemy_id),
                    "hp": rolled_hp,
                    "max_hp": rolled_hp,
                    "block": 0,
                    "next_intent": next_intent,
                }
            )

        deck = self._shuffle_with_runtime_rng(list(self._snapshot["player"]["deck"]))
        opening_hand: list[str] = []
        for _ in range(min(5, len(deck))):
            opening_hand.append(deck.pop())
        draw_pile_count = len(deck)
        character = next(
            (entry for entry in self._content_bundle.get("characters", []) if entry.get("id") == self._snapshot["player"]["character_id"]),
            {},
        )

        self._snapshot["combat"] = {
            "turn": 1,
            "is_player_turn": True,
            "player_block": 0,
            "player_energy": int(character.get("max_energy", 3)),
            "enemy_ids": enemy_ids,
            "enemies": enemy_states,
            "hand": opening_hand,
            "draw_pile_count": draw_pile_count,
            "discard_pile_count": 0,
        }
        self._apply_single_slime_room_boost(node_type, floor)
        self._snapshot["lifecycle"] = {
            "screen": "Combat",
            "phase": "combat",
            "pending_node_resolution": True,
        }
        self._snapshot["reward"] = None
        self._snapshot["active_event"] = None

    def _apply_leave_room(self) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase == "map":
            raise ValueError("leave_room is only valid after entering a room")
        if phase == "combat":
            raise ValueError("leave_room cannot exit combat directly")

        self._snapshot["combat"] = None
        self._snapshot["active_event"] = None
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }

    def _apply_complete_combat(self) -> None:
        if str(self._snapshot["lifecycle"]["phase"]) != "combat":
            raise ValueError("complete_combat is only valid during combat phase")

        current_node = self._get_current_node()
        floor = int(current_node["y"]) + 1 if current_node is not None else 1
        node_type = str(current_node["type"]) if current_node is not None else "Combat"
        self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) + self._calculate_gold_reward(
            floor=floor,
            node_type=node_type,
        )
        self._snapshot["combat"] = None
        self._snapshot["reward"] = {
            "card_ids": self._generate_reward_cards(),
            "source": "combat",
        }
        self._snapshot["active_event"] = None
        self._snapshot["lifecycle"] = {
            "screen": "Reward",
            "phase": "reward",
            "pending_node_resolution": True,
        }

    def _apply_take_reward(self, card_id: Any) -> None:
        if str(self._snapshot["lifecycle"]["phase"]) != "reward":
            raise ValueError("take_reward is only valid during reward phase")

        reward = self._snapshot.get("reward")
        if reward is None:
            raise ValueError("No reward is available")

        selected_card_id = str(card_id) if card_id is not None else None
        if selected_card_id is None and reward["card_ids"]:
            selected_card_id = str(reward["card_ids"][0])
        if selected_card_id:
            if selected_card_id not in reward["card_ids"]:
                raise ValueError(f"Reward card is not offered: {selected_card_id}")
            self._snapshot["player"]["deck"].append(selected_card_id)

        self._snapshot["reward"] = None
        self._snapshot["active_event"] = None
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }

    def _apply_skip_reward(self) -> None:
        if str(self._snapshot["lifecycle"]["phase"]) != "reward":
            raise ValueError("skip_reward is only valid during reward phase")
        self._snapshot["reward"] = None
        self._snapshot["active_event"] = None
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }

    def _generate_reward_cards(self) -> list[str]:
        character_id = self._snapshot["player"]["character_id"]
        character = next(
            (entry for entry in self._content_bundle.get("characters", []) if entry.get("id") == character_id),
            {},
        )
        extended_pool = set(str(card_id) for card_id in character.get("extended_pool", []))
        rewards: list[str] = []

        for _ in range(3):
            rarity_roll = self._next_runtime_random()
            rarity = "Common"
            if rarity_roll > 0.85:
                rarity = "Rare"
            elif rarity_roll > 0.55:
                rarity = "Uncommon"

            valid_cards = [
                entry
                for entry in self._content_bundle.get("cards", [])
                if str(entry.get("rarity", "Common")) == rarity
                and str(entry.get("character", "All")) in {"All", str(character_id)}
            ]
            extended_cards = [
                entry
                for entry in self._content_bundle.get("cards", [])
                if str(entry.get("id")) in extended_pool and str(entry.get("rarity", "Common")) == rarity
            ]
            if extended_cards and self._next_runtime_random() < 0.35:
                valid_cards = [*valid_cards, *extended_cards]

            fallback_cards = [
                entry
                for entry in self._content_bundle.get("cards", [])
                if str(entry.get("rarity", "Common")) == rarity and str(entry.get("character", "All")) == "All"
            ]
            pool = valid_cards if valid_cards else fallback_cards
            if not pool:
                continue

            chosen_card = pool[int(self._next_runtime_random() * len(pool))]
            rewards.append(str(chosen_card["id"]))
            self._consume_runtime_id()

        return rewards

    def _calculate_gold_reward(self, floor: int, node_type: str) -> int:
        base_gold = 16 + max(0, floor - 1) * 3
        if node_type == "Boss":
            return base_gold * 3
        if node_type == "Elite":
            return base_gold * 2
        return base_gold

    def _get_current_node(self) -> dict[str, Any] | None:
        current_node_id = self._snapshot["map"]["current_node_id"]
        if current_node_id is None:
            return None
        return next((entry for entry in self._snapshot["map"]["nodes"] if entry["id"] == current_node_id), None)

    def _next_runtime_random(self) -> float:
        state = _int32(self._runtime_rng_state)
        state = _int32(state + 0x6D2B79F5)
        self._runtime_rng_state = state
        t = _imul(state ^ ((state & 0xFFFFFFFF) >> 15), 1 | state)
        t = _int32(t + _imul(t ^ ((t & 0xFFFFFFFF) >> 7), 61 | t) ^ t)
        return ((t ^ ((t & 0xFFFFFFFF) >> 14)) & 0xFFFFFFFF) / 4294967296.0

    def _roll_enemy_intent(self, enemy_def: dict[str, Any] | None) -> str:
        if not enemy_def:
            self._next_runtime_random()
            return "Attack"

        policies = list(enemy_def.get("intent_policy", []))
        if not policies:
            self._next_runtime_random()
            return "Attack"

        weights = [max(0, int(policy.get("weight", 0))) for policy in policies]
        total_weight = sum(weights)
        if total_weight <= 0:
            self._next_runtime_random()
            return str(policies[0].get("intent", "Attack"))

        roll = self._next_runtime_random() * total_weight
        cumulative = 0.0
        for policy, weight in zip(policies, weights):
            cumulative += weight
            if roll <= cumulative:
                return str(policy.get("intent", "Attack"))
        return str(policies[0].get("intent", "Attack"))

    def _calculate_enemy_hp_multiplier(self, floor: int) -> float:
        safe_floor = max(1, int(floor))
        logarithmic_dampening = math.log10(1 + safe_floor / 10)
        return 1 + (safe_floor - 1) * 0.15 * logarithmic_dampening

    def _apply_enemy_hp_tuning(self, base_hp: int, floor: int, node_type: str, hp_multiplier: float) -> int:
        raw = max(1, math.floor(base_hp * hp_multiplier))
        if node_type == "Boss":
            return raw

        if node_type == "Elite":
            soft_cap = 88 if floor <= 3 else 112 if floor <= 6 else float('inf')
        else:
            soft_cap = 30 if floor <= 2 else 40 if floor <= 4 else 52 if floor <= 6 else float('inf')
        return max(1, min(raw, int(soft_cap) if math.isfinite(soft_cap) else raw))

    def _apply_single_slime_room_boost(self, node_type: str, floor: int) -> None:
        combat = self._snapshot.get("combat")
        if not combat:
            return
        enemies = combat.get("enemies", [])
        if (
            node_type != "Combat"
            or floor > 4
            or len(enemies) != 1
            or str(enemies[0].get("def_id")) != "slime_small"
        ):
            return

        hp_bonus = max(3, math.floor(int(enemies[0]["max_hp"]) * 0.60))
        enemies[0]["max_hp"] = int(enemies[0]["max_hp"]) + hp_bonus
        enemies[0]["hp"] = int(enemies[0]["hp"]) + hp_bonus

    def _consume_runtime_id(self) -> str:
        return f"id_{str(self._next_runtime_random())[2:]}"

    def _shuffle_with_runtime_rng(self, items: list[str]) -> list[str]:
        shuffled = list(items)
        for index in range(len(shuffled) - 1, 0, -1):
            swap_index = int(self._next_runtime_random() * (index + 1))
            shuffled[index], shuffled[swap_index] = shuffled[swap_index], shuffled[index]
        return shuffled

    def _generate_map(self, seed: int) -> list[dict[str, Any]]:
        prebuilt_nodes = self._content_bundle.get("map", {}).get("prebuilt_nodes", [])
        if prebuilt_nodes:
            return deepcopy(list(prebuilt_nodes))

        configured_node_types = self._content_bundle.get("map", {}).get("node_types", [])
        if configured_node_types:
            return self._generate_simple_map(seed, configured_node_types)

        return self._generate_legacy_map(seed)

    def _generate_simple_map(self, seed: int, node_types: list[str]) -> list[dict[str, Any]]:
        rng = Random(seed)
        total_floors = int(self._content_bundle.get("map", {}).get("floors", 6))
        branching = max(1, int(self._content_bundle.get("map", {}).get("branching", 2)))
        nodes: list[dict[str, Any]] = []
        for floor in range(total_floors):
            for lane in range(branching):
                floor_number = floor + 1
                node_id = f"floor_{floor_number}_node_{lane}"
                node_type = node_types[(floor + lane + rng.randint(0, len(node_types) - 1)) % len(node_types)]
                next_nodes = []
                if floor < total_floors - 1:
                    next_floor_number = floor_number + 1
                    next_nodes.append(f"floor_{next_floor_number}_node_{lane % branching}")
                    if branching > 1:
                        next_nodes.append(f"floor_{next_floor_number}_node_{(lane + 1) % branching}")
                nodes.append(
                    {
                        "id": node_id,
                        "type": node_type,
                        "x": round((lane + 1) / (branching + 1), 4),
                        "y": floor,
                        "revealed": floor == 0,
                        "next": next_nodes,
                    }
                )
        return nodes

    def _generate_legacy_map(self, seed: int) -> list[dict[str, Any]]:
        map_config = self._content_bundle.get("map", {})
        total_floors = int(map_config.get("floors", 10))
        nodes_per_floor = 4
        branch_factor = max(1, int(map_config.get("branching", 3)))
        rng = self._create_map_rng(seed)
        generated_nodes: list[list[dict[str, Any]]] = []

        for floor in range(1, total_floors + 1):
            node_count = self._get_legacy_node_count_for_floor(floor, total_floors, nodes_per_floor, rng)
            floor_nodes: list[dict[str, Any]] = []
            for index in range(node_count):
                floor_nodes.append(
                    {
                        "id": f"floor_{floor}_node_{index}",
                        "type": self._determine_legacy_node_type(floor, total_floors, rng),
                        "revealed": floor == 1,
                        "next": [],
                        "x": (index + 1) / (node_count + 1),
                        "y": floor - 1,
                    }
                )
            generated_nodes.append(floor_nodes)

        for floor_index in range(len(generated_nodes) - 1):
            current_floor = generated_nodes[floor_index]
            next_floor = generated_nodes[floor_index + 1]
            inbound_count = {node["id"]: 0 for node in next_floor}

            for node in current_floor:
                reachable_nodes = [next_node for next_node in next_floor if abs(float(next_node["x"]) - float(node["x"])) <= 0.66]
                pool = reachable_nodes if reachable_nodes else next_floor
                shuffled = self._legacy_random_sort(pool, rng)
                desired = min(len(shuffled), max(1, 1 + int(rng() * branch_factor)))
                chosen = shuffled[:desired]
                unique_ids = list(dict.fromkeys(str(next_node["id"]) for next_node in chosen))
                node["next"].extend(unique_ids)
                for next_node_id in unique_ids:
                    inbound_count[next_node_id] = inbound_count.get(next_node_id, 0) + 1

            for next_node in next_floor:
                if inbound_count.get(str(next_node["id"]), 0) > 0:
                    continue
                closest = sorted(current_floor, key=lambda node: abs(float(node["x"]) - float(next_node["x"])))[0]
                if str(next_node["id"]) not in closest["next"]:
                    closest["next"].append(str(next_node["id"]))

        return [node for floor in generated_nodes for node in floor]

    def _create_map_rng(self, seed: int):
        state = int(seed)

        def next_random() -> float:
            nonlocal state
            state = int(float(state) * 1103515245 + 12345) & 0x7FFFFFFF
            return state / 0x7FFFFFFF

        return next_random

    def _legacy_random_sort(self, items: list[dict[str, Any]], rng) -> list[dict[str, Any]]:
        sorted_items = list(items)
        if len(sorted_items) < 2:
            return sorted_items

        run_end = 2
        descending = (rng() - 0.5) < 0
        while run_end < len(sorted_items):
            comparator = rng() - 0.5
            if descending:
                if comparator >= 0:
                    break
            elif comparator < 0:
                break
            run_end += 1

        if descending:
            sorted_items[:run_end] = reversed(sorted_items[:run_end])

        for index in range(run_end, len(sorted_items)):
            current_item = sorted_items[index]
            low = 0
            high = index
            while low < high:
                mid = (low + high) // 2
                if (rng() - 0.5) < 0:
                    high = mid
                else:
                    low = mid + 1

            cursor = index
            while cursor > low:
                sorted_items[cursor] = sorted_items[cursor - 1]
                cursor -= 1
            sorted_items[low] = current_item
        return sorted_items

    def _get_legacy_node_count_for_floor(
        self,
        floor: int,
        total_floors: int,
        nodes_per_floor: int,
        rng,
    ) -> int:
        if floor == total_floors:
            return 1
        if floor == total_floors - 1:
            return 2
        if floor == 1:
            return 3 + (1 if rng() < 0.5 else 0)
        if floor <= 3:
            return 4

        variance_roll = rng()
        variance = -1 if variance_roll < 0.25 else 1 if variance_roll > 0.8 else 0
        return max(3, min(5, nodes_per_floor + variance))

    def _determine_legacy_node_type(self, floor: int, total_floors: int, rng) -> str:
        roll = rng()
        if floor == total_floors:
            return "Boss"
        if floor == total_floors - 1:
            return "Rest"

        depth = floor / max(1, total_floors)
        elite_threshold = 0.06 + depth * 0.18
        event_threshold = elite_threshold + 0.18
        shop_threshold = event_threshold + 0.14
        rest_threshold = shop_threshold + 0.12

        if roll < elite_threshold:
            selected_type = "Elite"
        elif roll < event_threshold:
            selected_type = "Event"
        elif roll < shop_threshold:
            selected_type = "Shop"
        elif roll < rest_threshold:
            selected_type = "Rest"
        else:
            selected_type = "Combat"

        if not hasattr(self, '_last_node_type'):
            self._last_node_type = ''
            self._consecutive_same_count = 0

        special_rooms = {"Event", "Shop", "Rest"}
        
        if selected_type == self._last_node_type:
            self._consecutive_same_count += 1
        else:
            self._consecutive_same_count = 1
            self._last_node_type = selected_type

        if self._consecutive_same_count > 2:
            if selected_type in special_rooms and floor < total_floors - 1:
                fallback_types = []
                if selected_type != "Event":
                    fallback_types.append("Event")
                if selected_type != "Shop":
                    fallback_types.append("Shop")
                if selected_type != "Rest":
                    fallback_types.append("Rest")
                
                if fallback_types:
                    if rng() < 0.6:
                        selected_type = "Combat"
                    else:
                        selected_type = fallback_types[int(rng() * len(fallback_types))]
                    self._consecutive_same_count = 1
                    self._last_node_type = selected_type

        if selected_type == "Elite" and floor <= 2:
            selected_type = "Combat"
            self._consecutive_same_count = 1
            self._last_node_type = selected_type

        return selected_type

    def _create_initial_snapshot(self, seed: int) -> dict[str, Any]:
        return {
            "schema_version": 2,
            "engine_version": "rules-core-draft",
            "seed": int(seed),
            "lifecycle": {
                "screen": "CharacterSelect",
                "phase": "character_select",
                "pending_node_resolution": False,
            },
            "player": {
                "character_id": None,
                "hp": 0,
                "max_hp": 0,
                "gold": 0,
                "intel": 0,
                "devotion": 0,
                "corruption": 0,
                "deck": [],
                "relic_ids": [],
                "potion_ids": [],
            },
            "map": {
                "current_node_id": None,
                "nodes": [],
            },
            "combat": None,
            "reward": None,
            "active_event": None,
            "meta": {
                "replay_length": 0,
            },
        }


_runtime_instance: RuleRuntime | None = None

def init_runtime(content_bundle: dict[str, Any], seed: int = 0) -> dict[str, Any]:
    global _runtime_instance
    _runtime_instance = RuleRuntime(content_bundle, seed)
    return _runtime_instance.snapshot()

def dispatch_command(command: dict[str, Any]) -> dict[str, Any]:
    global _runtime_instance
    if _runtime_instance is None:
        raise RuntimeError("Runtime not initialized")
    result = _runtime_instance.dispatch(command)
    return result

def get_snapshot() -> dict[str, Any] | None:
    global _runtime_instance
    if _runtime_instance is None:
        return None
    return _runtime_instance.snapshot()
`;

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, chr: string) => chr.toUpperCase());
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (chr) => `_${chr.toLowerCase()}`);
}

function convertKeys(value: unknown, keyMapper: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => convertKeys(entry, keyMapper));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[keyMapper(key)] = convertKeys(entry, keyMapper);
  }
  return result;
}

export function unwrapPythonSnapshotEnvelope(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Python runtime payload');
  }

  const record = value as Record<string, unknown>;
  const nestedSnapshot = record.snapshot;
  if (nestedSnapshot && typeof nestedSnapshot === 'object' && !Array.isArray(nestedSnapshot)) {
    return nestedSnapshot as Record<string, unknown>;
  }

  return record;
}

function normalizePythonSnapshot(snapshot: Record<string, unknown>): RuleSnapshot {
  const converted = convertKeys(snapshot, snakeToCamelKey) as Partial<RuleSnapshot>;
  const player = converted.player ?? ({} as RuleSnapshot['player']);
  const map = converted.map ?? { currentNodeId: null, nodes: [] };
  const combat = converted.combat ?? null;
  const reward = converted.reward ?? null;
  const activeEvent = converted.activeEvent ?? null;
  const meta = converted.meta ?? ({} as RuleSnapshot['meta']);

  return {
    schemaVersion: converted.schemaVersion ?? 2,
    engineVersion: converted.engineVersion ?? 'rules-core-draft',
    seed: converted.seed ?? 0,
    lifecycle: converted.lifecycle ?? {
      screen: 'CharacterSelect',
      phase: 'character_select',
      pendingNodeResolution: false,
    },
    player: {
      characterId: player.characterId ?? null,
      hp: player.hp ?? 0,
      maxHp: player.maxHp ?? 0,
      gold: player.gold ?? 0,
      intel: player.intel ?? 0,
      devotion: player.devotion ?? 0,
      corruption: player.corruption ?? 0,
      deck: player.deck ?? [],
      relicIds: player.relicIds ?? [],
      potionIds: player.potionIds ?? [],
    },
    map: {
      currentNodeId: map.currentNodeId ?? null,
      nodes: map.nodes ?? [],
    },
    combat: combat
      ? {
          turn: combat.turn ?? 0,
          isPlayerTurn: combat.isPlayerTurn ?? false,
          playerBlock: combat.playerBlock ?? 0,
          playerEnergy: combat.playerEnergy ?? 0,
          enemyIds: combat.enemyIds ?? [],
          enemies: combat.enemies ?? [],
          hand: combat.hand ?? [],
          drawPileCount: combat.drawPileCount ?? 0,
          discardPileCount: combat.discardPileCount ?? 0,
        }
      : null,
    reward: reward
      ? {
          cardIds: reward.cardIds ?? [],
          source: reward.source ?? 'combat',
        }
      : null,
    activeEvent: activeEvent
      ? {
          id: activeEvent.id ?? '',
          stage: activeEvent.stage,
          data: activeEvent.data,
        }
      : null,
    meta: {
      runId: meta.runId ?? null,
      replayLength: meta.replayLength ?? 0,
      generatedAt: meta.generatedAt ?? new Date().toISOString(),
      adapter: 'python-wasm',
    },
  };
}

export class PythonWasmAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private pyodide: PyodideInterface | null = null;
  private snapshot: RuleSnapshot | null = null;
  private initPromise: Promise<void> | null = null;

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    if (!this.pyodide) {
      await this.ensurePyodide();
    }

    if (!this.pyodide) {
      throw new Error('Failed to initialize Pyodide');
    }

    const contentBundle = buildRuntimeV2ContentBundle();
    const snakeBundle = convertKeys(contentBundle, camelToSnakeKey) as Record<string, unknown>;
    this.pyodide.globals.set('__deckrogue_content_bundle_json', JSON.stringify(snakeBundle));
    const result = await this.pyodide.runPythonAsync(
      `init_runtime(json.loads(__deckrogue_content_bundle_json), ${options.seed ?? 0})`
    );

    this.snapshot = normalizePythonSnapshot(unwrapPythonSnapshotEnvelope(result.toJs()));
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.pyodide) {
      await this.ensurePyodide();
    }

    if (!this.pyodide) {
      throw new Error('Pyodide not initialized');
    }

    const snakeCommand = convertKeys(command, camelToSnakeKey) as Record<string, unknown>;
    this.pyodide.globals.set('__deckrogue_command_json', JSON.stringify(snakeCommand));
    const result = await this.pyodide.runPythonAsync(
      `dispatch_command(json.loads(__deckrogue_command_json))`
    );

    this.snapshot = normalizePythonSnapshot(unwrapPythonSnapshotEnvelope(result.toJs()));
    return this.snapshot;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    this.snapshot = null;
    this.pyodide = null;
    this.initPromise = null;
  }

  private async ensurePyodide(): Promise<void> {
    if (this.pyodide) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadPyodide();
    await this.initPromise;
  }

  private async loadPyodide(): Promise<void> {
    const loadPyodide = await this.resolveLoadPyodide();

    if (!loadPyodide) {
      throw new Error('Could not load Pyodide');
    }

    this.pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });

    await this.pyodide.runPythonAsync(PYTHON_RUNTIME_CODE);
  }

  private async resolveLoadPyodide(): Promise<((config: { indexURL: string }) => Promise<PyodideInterface>) | undefined> {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (window.loadPyodide) {
      return window.loadPyodide;
    }

    await this.injectPyodideScript();
    return window.loadPyodide;
  }

  private async injectPyodideScript(): Promise<void> {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-pyodide-loader="true"]');
    if (existingScript) {
      if (window.loadPyodide) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Pyodide loader script')), { once: true });
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PYODIDE_SCRIPT_URL;
      script.async = true;
      script.dataset.pyodideLoader = 'true';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('Failed to load Pyodide loader script')), { once: true });
      document.head.appendChild(script);
    });
  }
}

export function createPythonWasmAdapter(): PythonWasmAdapter {
  return new PythonWasmAdapter();
}
