"""
runtime.py - 规则引擎的核心运行时实现，提供确定性状态机与存档/回放功能

主要职责:
- RuleRuntime 类：管理游戏状态、事件分派、快照生成
- 存档序列化 (create_save_game_v2) 与反序列化 (restore_snapshot_from_save_game)
- 战斗日志回放 (replay_log, create_replay_log_v1)
"""

from __future__ import annotations

from copy import deepcopy
import json
import math
from random import Random
from typing import Any

SECONDARY_RESOURCES = ("evidence", "rage", "command", "verdict", "seal")
SPECIAL_RESOURCES = ("time_layer", "thread", "concoction")


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
        elif command_type == "cancel_surface":
            self._apply_cancel_surface()
        elif command_type == "buy_shop_card":
            self._apply_buy_shop_card(str(command["card_id"]))
        elif command_type == "buy_shop_relic":
            self._apply_buy_shop_relic(str(command["relic_id"]))
        elif command_type == "buy_shop_potion":
            self._apply_buy_shop_potion(str(command["potion_id"]))
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
        elif command_type == "enter_enchant":
            self._apply_enter_enchant()
        elif command_type == "apply_enchantment":
            self._apply_apply_enchantment(command.get("card_instance_id"))
        elif command_type == "enter_relic_upgrade":
            self._apply_enter_relic_upgrade()
        elif command_type == "upgrade_relic":
            self._apply_upgrade_relic(str(command["relic_id"]))
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
        self._snapshot.setdefault("meta", {})["runtime_rng_state"] = int(self._runtime_rng_state)
        return deepcopy(self._snapshot)

    def load(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        self._snapshot = deepcopy(snapshot)
        self._seed = int(self._snapshot["seed"])
        self._runtime_rng_state = int(self._snapshot.get("meta", {}).get("runtime_rng_state", 0))
        self._snapshot.setdefault("meta", {})["runtime_rng_state"] = int(self._runtime_rng_state)
        return self.snapshot()

    def _apply_select_character(self, character_id: str) -> None:
        character = next(
            (entry for entry in self._content_bundle.get("characters", []) if entry["id"] == character_id),
            None,
        )
        if character is None:
            raise ValueError(f"Unknown character: {character_id}")

        secondary_resources = {resource: 0 for resource in SECONDARY_RESOURCES}
        self._snapshot["player"] = {
            "character_id": character_id,
            "hp": int(character["max_hp"]),
            "max_hp": int(character["max_hp"]),
            "gold": int(character.get("starting_gold", 99)),
            "intel": 0,
            "devotion": 0,
            "corruption": 0,
            "secondary_resources": secondary_resources,
            **secondary_resources,
            **{resource: 0 for resource in SPECIAL_RESOURCES},
            "deck": list(character.get("starting_deck", [])),
            "relic_ids": [],
            "potion_ids": [],
            "relic_states": {},
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
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._snapshot["room_session"] = None
        self._snapshot["route_state"] = self._derive_route_state_from_deck(None)

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
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._snapshot["room_session"] = None
        self._snapshot["lifecycle"] = {
            "screen": screen,
            "phase": phase,
            "pending_node_resolution": True,
        }

        if node_type == "Event":
            self._start_event()
        elif node_type == "Shop":
            self._start_shop()
        elif node_type == "Rest":
            self._set_room_session("rest", "rest", ["rest"])

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
        self._set_room_session("event", "event", ["event"])

    def _apply_choose_event_option(self, choice_id: str) -> None:
        if self._snapshot["lifecycle"]["phase"] != "event":
            raise ValueError("choose_event_option is only valid during event phase")

        event = self._snapshot.get("active_event")
        if event:
            event["data"] = {**(event.get("data") or {}), "last_choice_id": choice_id}

        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._clear_room_session()
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
        self._snapshot["combat"] = None
        self._snapshot["reward"] = None
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._clear_room_session()
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }

    def _parse_card_selector(self, selector: Any) -> tuple[int, str] | None:
        if selector is None:
            return None
        raw_selector = str(selector)
        if ":" not in raw_selector:
            return None
        index_part, card_id = raw_selector.split(":", 1)
        try:
            index = int(index_part)
        except ValueError:
            return None
        return index, card_id

    def _current_floor(self) -> int:
        current_node = self._get_current_node()
        return int(current_node["y"]) + 1 if current_node is not None else 1

    def _card_route_signal(self, card_id: str) -> dict[str, Any] | None:
        card = next((entry for entry in self._content_bundle.get("cards", []) if str(entry.get("id")) == str(card_id)), None)
        if not card:
            return None
        route_tags = [str(tag) for tag in card.get("route_tags", []) if tag]
        if not route_tags:
            return None
        try:
            route_signal_strength = int(card.get("route_signal_strength", 1))
        except (TypeError, ValueError):
            route_signal_strength = 1
        return {
            "route_tags": route_tags,
            "route_signal_strength": route_signal_strength,
        }

    def _known_route_tags_for_character(self, character_id: str | None) -> list[str]:
        if not character_id:
            return []
        tags: list[str] = []
        for card in self._content_bundle.get("cards", []):
            if str(card.get("character", "All")) != str(character_id):
                continue
            for tag in card.get("route_tags", []) or []:
                tag = str(tag)
                if tag not in tags:
                    tags.append(tag)
        return tags

    def _derive_route_state_from_deck(self, existing_route_state: dict[str, Any] | None) -> dict[str, Any] | None:
        character_id = self._snapshot.get("player", {}).get("character_id")
        known_tags = self._known_route_tags_for_character(str(character_id) if character_id else None)
        if not known_tags:
            return None

        score_by_tag: dict[str, int] = {}
        deck = [str(card_id) for card_id in self._snapshot.get("player", {}).get("deck", [])]
        for card_id in deck:
            signal = self._card_route_signal(card_id)
            if not signal:
                continue
            for tag in signal["route_tags"]:
                if tag in known_tags:
                    score_by_tag[tag] = score_by_tag.get(tag, 0) + int(signal["route_signal_strength"])

        recent_card_weights = [24, 18, 12, 8, 5]
        for index, card_id in enumerate(reversed(deck[-len(recent_card_weights):])):
            signal = self._card_route_signal(card_id)
            if not signal:
                continue
            for tag in signal["route_tags"]:
                if tag in known_tags:
                    score_by_tag[tag] = score_by_tag.get(tag, 0) + recent_card_weights[index] + int(signal["route_signal_strength"]) * 3

        existing = existing_route_state or self._snapshot.get("route_state") or {}
        recent_commits = list(existing.get("recent_commits") or [])[-6:]
        commit_decay = [1, 0.8, 0.64, 0.5, 0.4, 0.32]
        for index, commit in enumerate(reversed(recent_commits)):
            tag = str(commit.get("tag") or "")
            if tag in known_tags:
                decay = commit_decay[index] if index < len(commit_decay) else commit_decay[-1]
                score_by_tag[tag] = score_by_tag.get(tag, 0) + max(1, round(int(commit.get("weight") or 1) * decay))

        latest_commit_tag = str(recent_commits[-1].get("tag")) if recent_commits else None
        consecutive_latest_commit_count = 0
        if latest_commit_tag in known_tags:
            for commit in reversed(recent_commits):
                if str(commit.get("tag")) != latest_commit_tag:
                    break
                consecutive_latest_commit_count += 1
            score_by_tag[latest_commit_tag] = score_by_tag.get(latest_commit_tag, 0) + 18 + consecutive_latest_commit_count * 12

        existing_primary = existing.get("primary_tag")
        existing_secondary = existing.get("secondary_tag")
        existing_confidence = int(existing.get("confidence") or 0)
        if existing_primary in known_tags:
            score_by_tag[str(existing_primary)] = score_by_tag.get(str(existing_primary), 0) + max(10, round(existing_confidence * 0.55))
        if existing_secondary in known_tags:
            score_by_tag[str(existing_secondary)] = score_by_tag.get(str(existing_secondary), 0) + max(4, round(existing_confidence * 0.22))

        sorted_tags = sorted(
            [(tag, score) for tag, score in score_by_tag.items() if tag in known_tags],
            key=lambda item: (-item[1], item[0]),
        )
        existing_primary_has_authority = bool(existing_primary and existing_primary in known_tags and latest_commit_tag == existing_primary)
        repeated_commit_primary_tag = latest_commit_tag if latest_commit_tag in known_tags and consecutive_latest_commit_count >= 2 else None
        primary_tag = repeated_commit_primary_tag or (str(existing_primary) if existing_primary_has_authority else (sorted_tags[0][0] if sorted_tags else None))
        secondary_tag = next((tag for tag, _score in sorted_tags if tag != primary_tag), None)
        top_score = score_by_tag.get(primary_tag, 0) if primary_tag else 0
        second_score = score_by_tag.get(secondary_tag, 0) if secondary_tag else 0
        confidence = max(0, min(100, round(min(70, top_score) + min(30, max(0, top_score - second_score) * 2)))) if primary_tag else 0
        stage = "forming"
        if primary_tag:
            if existing_primary and existing_primary != primary_tag and confidence >= 35:
                stage = "pivoting"
            elif confidence >= 60:
                stage = "committed"

        return {
            "primary_tag": primary_tag,
            "secondary_tag": secondary_tag,
            "confidence": confidence,
            "stage": stage,
            "recent_commits": recent_commits,
        }

    def _stable_hash(self, value: str) -> int:
        hash_value = 2166136261
        for char in value:
            hash_value ^= ord(char)
            hash_value = (hash_value * 16777619) & 0xFFFFFFFF
        return hash_value

    def _choose_unique_seeded(self, pool: list[dict[str, Any]], chosen_ids: set[str], seed_key: str, label: str) -> dict[str, Any] | None:
        filtered = [card for card in pool if str(card.get("id")) not in chosen_ids]
        if not filtered:
            return None
        ids = "|".join(str(card.get("id")) for card in filtered)
        pick = filtered[self._stable_hash(f"{seed_key}:{label}:{ids}") % len(filtered)]
        chosen_ids.add(str(pick.get("id")))
        return pick

    def _generate_planned_reward_cards(self, character_id: str, card_pool: list[dict[str, Any]]) -> list[str]:
        floor = self._current_floor()
        if floor > 2:
            return []
        route_state = self._snapshot.get("route_state") or self._derive_route_state_from_deck(None)
        known_tags = self._known_route_tags_for_character(character_id)
        if not known_tags:
            return []
        dominant_tag = route_state.get("primary_tag") if route_state else None
        seed_key = f"{self._seed}:{character_id}:combat:{floor}:{dominant_tag or 'none'}"
        sampled_tag = known_tags[self._stable_hash(f"{seed_key}:primary-route") % len(known_tags)]
        has_explicit_commit = bool(route_state and route_state.get("recent_commits"))
        starter_route_is_soft = (
            floor <= 1
            and bool(dominant_tag)
            and not has_explicit_commit
            and (route_state or {}).get("stage") != "pivoting"
        )
        primary_tag = sampled_tag if starter_route_is_soft else (dominant_tag or sampled_tag)
        chosen_ids: set[str] = set()

        def by_role(roles: set[str], route_tag: str | None = None, prefer_different_route: bool = False) -> list[dict[str, Any]]:
            result: list[dict[str, Any]] = []
            for card in card_pool:
                card_tags = [str(tag) for tag in card.get("route_tags", []) or []]
                role = str(card.get("early_game_role") or "")
                if role not in roles:
                    continue
                if route_tag and route_tag not in card_tags:
                    continue
                if prefer_different_route and route_tag and route_tag in card_tags:
                    continue
                result.append(card)
            return result

        neutral_pool = [card for card in card_pool if not card.get("route_tags")]
        result: list[dict[str, Any]] = []
        first = self._choose_unique_seeded(by_role({"route_confirm"}, primary_tag), chosen_ids, seed_key, "reward-first")
        if first:
            result.append(first)
        second = self._choose_unique_seeded(neutral_pool, chosen_ids, seed_key, "reward-second-neutral")
        if second:
            result.append(second)
        alt_route_tag = next((tag for tag in known_tags if tag != primary_tag), None)
        third = None
        if dominant_tag:
            third = self._choose_unique_seeded(by_role({"route_payoff"}, primary_tag), chosen_ids, seed_key, "reward-third-primary-payoff")
        elif alt_route_tag:
            third = self._choose_unique_seeded(by_role({"route_confirm", "route_payoff"}, alt_route_tag), chosen_ids, seed_key, "reward-third-alt-route")
        if third is None:
            third = self._choose_unique_seeded(by_role({"route_payoff"}, primary_tag), chosen_ids, seed_key, "reward-third-primary")
        if third is None:
            third = self._choose_unique_seeded(by_role({"route_confirm", "route_payoff"}, primary_tag, True), chosen_ids, seed_key, "reward-third-different")
        if third is None:
            third = self._choose_unique_seeded(neutral_pool, chosen_ids, seed_key, "reward-third-generic")
        if third:
            result.append(third)
        return [str(card["id"]) for card in result[:3]]

    def _record_route_commit(self, source: str, weight: int, tag: str | None = None) -> None:
        route_state = self._snapshot.get("route_state")
        if not route_state:
            route_state = self._derive_route_state_from_deck(None) or {
                "primary_tag": None,
                "secondary_tag": None,
                "confidence": 0,
                "stage": "forming",
                "recent_commits": [],
            }
            self._snapshot["route_state"] = route_state
        tag = tag or route_state.get("primary_tag")
        if not tag:
            return
        recent_commits = list(route_state.get("recent_commits") or [])
        recent_commits.append({
            "tag": tag,
            "source": source,
            "floor": self._current_floor(),
            "weight": weight,
        })
        route_state["recent_commits"] = recent_commits[-5:]

    def _set_room_session(self, owner_kind: str, resolver_kind: str, surface_stack: list[str] | None = None, status: str = "active") -> None:
        current_node = self._get_current_node()
        node_id = current_node.get("id") if current_node else self._snapshot.get("map", {}).get("current_node_id")
        token = f'legacy:{node_id or resolver_kind}'
        self._snapshot["room_session"] = {
            "token": token,
            "node_id": node_id,
            "owner_kind": owner_kind,
            "resolver_kind": resolver_kind,
            "surface_stack": surface_stack or [owner_kind],
            "status": status,
        }

    def _clear_room_session(self) -> None:
        self._snapshot["room_session"] = None

    def _clean_surface_context(self) -> None:
        surface_context = self._snapshot.get("surface_context")
        if not surface_context:
            self._snapshot["surface_context"] = None
            return
        compact = {key: value for key, value in surface_context.items() if value not in (None, False)}
        self._snapshot["surface_context"] = compact or None

    def _get_relic_upgrade_cost(self, relic_id: str, current_level: int) -> int:
        upgrade_costs = {
            "burning_blood": {1: 120, 2: 180},
            "bag_of_prep": {1: 150, 2: 220},
            "vajra": {1: 140, 2: 200},
            "anchor": {1: 130, 2: 190},
            "lantern": {1: 145, 2: 210},
            "ruined_reactor": {1: 180, 2: 250},
            "martyrs_censer": {1: 150, 2: 220},
            "thorns_armor": {1: 130, 2: 190},
            "entropy_sanctum_relic": {1: 200, 2: 280},
        }
        return int(upgrade_costs.get(relic_id, {}).get(current_level, 0))

    def _start_shop(self) -> None:
        character_id = self._snapshot["player"]["character_id"]
        card_pool = [
            entry for entry in self._content_bundle.get("cards", [])
            if entry.get("character") in {character_id, "All"}
        ]
        if not card_pool:
            card_pool = list(self._content_bundle.get("cards", []))
        relic_pool = list(self._content_bundle.get("relics", []))
        potion_pool = list(self._content_bundle.get("potions", []))
        affordable_potion_pool = [
            entry for entry in potion_pool
            if int(entry.get("price", 65)) <= int(self._snapshot["player"]["gold"])
        ]

        cards: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        while len(cards) < 3 and card_pool:
            selected = card_pool[int(self._next_runtime_random() * len(card_pool))]
            card_id = str(selected["id"])
            if card_id in seen_ids:
                continue
            seen_ids.add(card_id)
            rarity = str(selected.get("rarity", "Common"))
            price = 150 if rarity == "Rare" else 75 if rarity == "Uncommon" else 50
            cards.append({"id": card_id, "price": price})

        relics: list[dict[str, Any]] = []
        seen_relic_ids: set[str] = set()
        while len(relics) < 2 and relic_pool:
            selected = relic_pool[int(self._next_runtime_random() * len(relic_pool))]
            relic_id = str(selected["id"])
            if relic_id in seen_relic_ids:
                continue
            seen_relic_ids.add(relic_id)
            relics.append({
                "id": relic_id,
                "price": max(1, int(selected.get("price", 150))),
            })

        potions: list[dict[str, Any]] = []
        seen_potion_ids: set[str] = set()
        prioritized_potion_pool = affordable_potion_pool if affordable_potion_pool else potion_pool
        while len(potions) < min(3, len(prioritized_potion_pool)) and prioritized_potion_pool:
            selected = prioritized_potion_pool[int(self._next_runtime_random() * len(prioritized_potion_pool))]
            potion_id = str(selected["id"])
            if potion_id in seen_potion_ids:
                continue
            seen_potion_ids.add(potion_id)
            potions.append({
                "id": potion_id,
                "price": max(1, int(selected.get("price", 65))),
            })
        while len(potions) < 3 and potion_pool:
            selected = potion_pool[int(self._next_runtime_random() * len(potion_pool))]
            potion_id = str(selected["id"])
            if potion_id in seen_potion_ids:
                continue
            seen_potion_ids.add(potion_id)
            potions.append({
                "id": potion_id,
                "price": max(1, int(selected.get("price", 65))),
            })

        self._snapshot["shop"] = {
            "cards": cards,
            "relics": relics,
            "potions": potions,
            "card_removal_cost": 75,
        }
        self._set_room_session("shop", "shop", ["shop"])

    def _apply_buy_shop_card(self, card_id: str) -> None:
        if self._snapshot["lifecycle"]["phase"] != "shop":
            raise ValueError("buy_shop_card is only valid during shop phase")

        shop = self._snapshot.get("shop")
        if shop is None:
            raise ValueError("No shop payload is available")

        offers = shop.get("cards") or []
        selected_offer = next((entry for entry in offers if str(entry.get("id")) == card_id), None)
        if selected_offer is None:
            raise ValueError(f"Shop card is not offered: {card_id}")

        price = int(selected_offer.get("price", 50))
        if int(self._snapshot["player"]["gold"]) < price:
            raise ValueError(f"Not enough gold for shop card: {card_id}")

        self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - price
        self._snapshot["player"]["deck"].append(card_id)
        shop["cards"] = [entry for entry in offers if str(entry.get("id")) != card_id]

        character_id = str(self._snapshot["player"].get("character_id") or "")
        selected_card = next(
            (entry for entry in self._content_bundle.get("cards", []) if str(entry.get("id")) == card_id),
            None,
        )
        signal = self._card_route_signal(card_id) if selected_card and str(selected_card.get("character")) == character_id else None
        known_tags = self._known_route_tags_for_character(character_id)
        commit_tag = next((tag for tag in (signal or {}).get("route_tags", []) if tag in known_tags), None)
        if commit_tag:
            self._record_route_commit("shop", 12, commit_tag)

    def _apply_buy_shop_relic(self, relic_id: str) -> None:
        if self._snapshot["lifecycle"]["phase"] != "shop":
            raise ValueError("buy_shop_relic is only valid during shop phase")

        shop = self._snapshot.get("shop")
        if shop is None:
            raise ValueError("No shop payload is available")

        offers = shop.get("relics") or []
        selected_offer = next((entry for entry in offers if str(entry.get("id")) == relic_id), None)
        if selected_offer is None:
            raise ValueError(f"Shop relic is not offered: {relic_id}")

        price = int(selected_offer.get("price", 150))
        if int(self._snapshot["player"]["gold"]) < price:
            raise ValueError(f"Not enough gold for shop relic: {relic_id}")

        if relic_id in self._snapshot["player"]["relic_ids"]:
            raise ValueError(f"Relic already owned: {relic_id}")

        self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - price
        self._snapshot["player"]["relic_ids"].append(relic_id)
        relic_def = next((entry for entry in self._content_bundle.get("relics", []) if str(entry.get("id")) == relic_id), {})
        self._snapshot["player"].setdefault("relic_states", {})[relic_id] = {
            "level": 1,
            "progress": 0,
            "corrupted": bool(relic_def.get("corrupted", False)),
        }
        shop["relics"] = [entry for entry in offers if str(entry.get("id")) != relic_id]

    def _apply_buy_shop_potion(self, potion_id: str) -> None:
        if self._snapshot["lifecycle"]["phase"] != "shop":
            raise ValueError("buy_shop_potion is only valid during shop phase")

        shop = self._snapshot.get("shop")
        if shop is None:
            raise ValueError("No shop payload is available")

        offers = shop.get("potions") or []
        selected_offer = next((entry for entry in offers if str(entry.get("id")) == potion_id), None)
        if selected_offer is None:
            raise ValueError(f"Shop potion is not offered: {potion_id}")

        price = int(selected_offer.get("price", 65))
        if int(self._snapshot["player"]["gold"]) < price:
            raise ValueError(f"Not enough gold for shop potion: {potion_id}")

        if len(self._snapshot["player"]["potion_ids"]) >= 3:
            raise ValueError("Potion slots are full")

        self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - price
        self._snapshot["player"]["potion_ids"].append(potion_id)
        shop["potions"] = [entry for entry in offers if str(entry.get("id")) != potion_id]

    def _apply_enter_enchant(self) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase not in {"rest", "shop"}:
            raise ValueError("enter_enchant is only valid during rest or shop phase")
        surface_context = self._snapshot.get("surface_context") or {}
        if phase == "shop":
            surface_context["enchant_context"] = {
                "source": "Shop",
                "enchantment_id": "swift_sigil",
                "title": "黑市附魔",
                "description": "支付信用筹码，为一张攻击或技能牌烙下永久附魔。",
                "price": 75,
                "return_screen": "Shop",
            }
        else:
            surface_context["enchant_context"] = {
                "source": "Rest",
                "enchantment_id": "blood_rune",
                "title": "营火刻印",
                "description": "从一张攻击或技能牌上刻下稳定的永久附魔。",
                "return_screen": "Rest",
            }
            surface_context["campfire_choice_locked"] = True
        surface_context["enchant_return_screen"] = surface_context["enchant_context"]["return_screen"]
        self._snapshot["surface_context"] = surface_context
        self._set_room_session(phase, phase, [phase, "enchant"])
        self._snapshot["lifecycle"] = {
            "screen": "Enchant",
            "phase": "enchant",
            "pending_node_resolution": True,
        }

    def _apply_apply_enchantment(self, card_instance_id: Any) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase != "enchant":
            raise ValueError("apply_enchantment is only valid during enchant phase")
        parsed_selector = self._parse_card_selector(card_instance_id)
        if parsed_selector is None:
            raise ValueError("apply_enchantment requires an index-prefixed card selector")
        index, card_id = parsed_selector
        deck = self._snapshot["player"]["deck"]
        if index < 0 or index >= len(deck):
            raise ValueError("apply_enchantment selector index is out of range")
        if str(deck[index]) != card_id:
            raise ValueError("apply_enchantment selector does not match the current deck entry")
        surface_context = self._snapshot.get("surface_context") or {}
        enchant_context = surface_context.get("enchant_context") or {}
        if str(enchant_context.get("source", "Rest")) == "Shop":
            price = int(enchant_context.get("price", 75))
            if int(self._snapshot["player"]["gold"]) < price:
                raise ValueError("Not enough gold to apply shop enchantment")
            self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - price
        if not str(deck[index]).endswith("*"):
            deck[index] = f"{deck[index]}*"
        return_screen = str(enchant_context.get("return_screen") or enchant_context.get("source") or "Map")
        surface_context["enchant_context"] = None
        surface_context.pop("enchant_return_screen", None)
        if return_screen == "Rest":
            surface_context["campfire_choice_locked"] = False
        self._snapshot["surface_context"] = surface_context
        self._clean_surface_context()
        self._snapshot["lifecycle"] = {
            "screen": "Map" if return_screen == "Rest" else return_screen,
            "phase": "map" if return_screen == "Rest" else return_screen.lower(),
            "pending_node_resolution": False if return_screen == "Rest" else return_screen != "Map",
        }
        if return_screen == "Rest":
            self._clear_room_session()
        elif return_screen in {"Event", "Shop"}:
            self._set_room_session(return_screen.lower(), return_screen.lower(), [return_screen.lower()])

    def _apply_enter_relic_upgrade(self) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase != "rest":
            raise ValueError("enter_relic_upgrade is only valid during rest phase")
        relic_states = self._snapshot["player"].get("relic_states") or {}
        has_corrupted_relic = any(
            str(relic_id) in self._snapshot["player"]["relic_ids"] and bool(state.get("corrupted", False))
            for relic_id, state in relic_states.items()
        )
        if not has_corrupted_relic:
            raise ValueError("No corrupted relic is available for relic upgrade")
        surface_context = self._snapshot.get("surface_context") or {}
        surface_context["relic_upgrade_return_screen"] = "Rest"
        surface_context["campfire_choice_locked"] = True
        self._snapshot["surface_context"] = surface_context
        self._set_room_session("rest", "rest", ["rest", "relic_upgrade"])
        self._snapshot["lifecycle"] = {
            "screen": "RelicUpgrade",
            "phase": "relic_upgrade",
            "pending_node_resolution": True,
        }

    def _apply_upgrade_relic(self, relic_id: str) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase != "relic_upgrade":
            raise ValueError("upgrade_relic is only valid during relic_upgrade phase")
        relic_states = self._snapshot["player"].setdefault("relic_states", {})
        relic_state = relic_states.get(relic_id)
        if relic_state is None:
            raise ValueError(f"Relic is not available for upgrade: {relic_id}")
        if not bool(relic_state.get("corrupted", False)):
            raise ValueError(f"Relic is not corrupted and cannot use the runtime-v2 relic upgrade flow: {relic_id}")
        current_level = int(relic_state.get("level", 1))
        upgrade_cost = self._get_relic_upgrade_cost(relic_id, current_level)
        if int(self._snapshot["player"]["gold"]) < upgrade_cost:
            raise ValueError("Not enough gold to upgrade relic")
        self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - upgrade_cost
        relic_state["level"] = current_level + 1
        relic_state["corrupted"] = False
        self._snapshot["surface_context"] = self._snapshot.get("surface_context") or {}
        self._set_room_session("rest", "rest", ["rest", "relic_upgrade"])
        self._snapshot["lifecycle"] = {
            "screen": "RelicUpgrade",
            "phase": "relic_upgrade",
            "pending_node_resolution": True,
        }

    def _apply_upgrade_card(self, card_instance_id: Any) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if card_instance_id is None:
            if phase not in {"rest", "shop"}:
                raise ValueError("upgrade_card without card selector is only valid during rest or shop phase")
            return_screen = "Shop" if phase == "shop" else "Rest"
            surface_context = self._snapshot.get("surface_context") or {}
            surface_context["upgrade_return_screen"] = return_screen
            if return_screen == "Rest":
                surface_context["campfire_choice_locked"] = True
            if phase == "shop":
                if int(self._snapshot["player"]["gold"]) < 50:
                    raise ValueError("Not enough gold to enter upgrade from shop")
                self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - 50
                surface_context["pending_upgrade_refund"] = True
            self._snapshot["surface_context"] = surface_context
            self._set_room_session(phase, phase, [phase, "upgrade"])
            self._snapshot["lifecycle"] = {
                "screen": "Upgrade",
                "phase": "upgrade",
                "pending_node_resolution": True,
            }
            return

        if phase != "upgrade":
            raise ValueError("upgrade_card with card selector is only valid during upgrade phase")
        parsed_selector = self._parse_card_selector(card_instance_id)
        if parsed_selector is None:
            raise ValueError("upgrade_card requires an index-prefixed card selector")
        index, card_id = parsed_selector
        deck = self._snapshot["player"]["deck"]
        if index < 0 or index >= len(deck):
            raise ValueError("upgrade_card selector index is out of range")
        if str(deck[index]) != card_id:
            raise ValueError("upgrade_card selector does not match the current deck entry")
        if not str(deck[index]).endswith("+"):
            deck[index] = f"{deck[index]}+"

        surface_context = self._snapshot.get("surface_context") or {}
        return_screen = str(surface_context.get("upgrade_return_screen", "Map"))
        if "pending_upgrade_refund" in surface_context:
            surface_context["pending_upgrade_refund"] = False
        self._snapshot["surface_context"] = surface_context
        if return_screen == "Rest":
            surface_context["campfire_choice_locked"] = False
        self._clean_surface_context()
        self._snapshot["lifecycle"] = {
            "screen": "Map" if return_screen == "Rest" else return_screen,
            "phase": "map" if return_screen == "Rest" else return_screen.lower(),
            "pending_node_resolution": False if return_screen == "Rest" else return_screen != "Map",
        }
        if return_screen == "Rest":
            self._clear_room_session()
        elif return_screen == "Shop":
            self._set_room_session("shop", "shop", ["shop"])

    def _apply_remove_card(self, card_instance_id: Any) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if card_instance_id is None:
            if phase not in {"rest", "shop", "event"}:
                raise ValueError("remove_card without card selector is only valid during rest, shop, or event phase")
            surface_context = self._snapshot.get("surface_context") or {}
            if phase in {"rest", "shop"}:
                surface_context["upgrade_return_screen"] = "Shop" if phase == "shop" else "Rest"
                if phase == "rest":
                    surface_context["campfire_choice_locked"] = True
            if phase == "event":
                surface_context["is_event_free_card_removal_mode"] = True
            self._snapshot["surface_context"] = surface_context
            self._set_room_session(phase if phase != "event" else "event", phase if phase != "event" else "event", [phase if phase != "event" else "event", "remove_card"])
            self._snapshot["lifecycle"] = {
                "screen": "RemoveCard",
                "phase": "remove_card",
                "pending_node_resolution": True,
            }
            return

        if phase != "remove_card":
            raise ValueError("remove_card with card selector is only valid during remove_card phase")
        parsed_selector = self._parse_card_selector(card_instance_id)
        if parsed_selector is None:
            raise ValueError("remove_card requires an index-prefixed card selector")
        index, card_id = parsed_selector
        surface_context = self._snapshot.get("surface_context") or {}
        deck = self._snapshot["player"]["deck"]
        if index < 0 or index >= len(deck):
            raise ValueError("remove_card selector index is out of range")
        if str(deck[index]) != card_id:
            raise ValueError("remove_card selector does not match the current deck entry")
        if (not surface_context.get("is_event_free_card_removal_mode")) and str(surface_context.get("upgrade_return_screen", "Map")) == "Shop":
            removal_cost = int((self._snapshot.get("shop") or {}).get("card_removal_cost", 75))
            if int(self._snapshot["player"]["gold"]) < removal_cost:
                raise ValueError("Not enough gold for shop remove_card")
            self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) - removal_cost
        deck.pop(index)

        if surface_context.get("is_event_free_card_removal_mode"):
            return_screen = "Map"
            self._snapshot["active_event"] = None
        else:
            return_screen = str(surface_context.get("upgrade_return_screen", "Map"))
        surface_context["is_event_free_card_removal_mode"] = False
        if return_screen == "Rest":
            surface_context["campfire_choice_locked"] = False
        if return_screen == "Map":
            surface_context.pop("upgrade_return_screen", None)
        self._snapshot["lifecycle"] = {
            "screen": return_screen,
            "phase": return_screen.lower(),
            "pending_node_resolution": return_screen != "Map",
        }
        self._snapshot["surface_context"] = surface_context
        self._clean_surface_context()
        if return_screen == "Event":
            self._set_room_session("event", "event", ["event"])
        elif return_screen == "Rest":
            self._set_room_session("rest", "rest", ["rest"])
        elif return_screen == "Shop":
            self._set_room_session("shop", "shop", ["shop"])
        else:
            self._clear_room_session()

    def _apply_cancel_surface(self) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase not in {"upgrade", "remove_card", "enchant", "relic_upgrade"}:
            raise ValueError("cancel_surface is only valid during upgrade, remove_card, enchant, or relic_upgrade phase")
        surface_context = self._snapshot.get("surface_context") or {}
        if phase == "remove_card" and surface_context.get("is_event_free_card_removal_mode"):
            return_screen = "Event"
        elif phase == "enchant":
            enchant_context = surface_context.get("enchant_context") or {}
            return_screen = str(enchant_context.get("return_screen") or enchant_context.get("source") or "Map")
            surface_context["enchant_context"] = None
        elif phase == "relic_upgrade":
            return_screen = str(surface_context.get("relic_upgrade_return_screen", "Rest"))
            if return_screen == "Rest":
                surface_context.pop("relic_upgrade_return_screen", None)
        else:
            return_screen = str(surface_context.get("upgrade_return_screen", "Map"))
            if return_screen in {"Map", "Rest"}:
                surface_context.pop("upgrade_return_screen", None)
        if phase == "upgrade" and surface_context.get("pending_upgrade_refund"):
            self._snapshot["player"]["gold"] = int(self._snapshot["player"]["gold"]) + 50
            surface_context["pending_upgrade_refund"] = False
        if phase == "remove_card":
            surface_context["is_event_free_card_removal_mode"] = False
            if return_screen == "Map":
                surface_context.pop("upgrade_return_screen", None)
        if return_screen == "Rest":
            surface_context["campfire_choice_locked"] = False
        self._snapshot["surface_context"] = surface_context
        self._clean_surface_context()
        self._snapshot["lifecycle"] = {
            "screen": return_screen,
            "phase": return_screen.lower(),
            "pending_node_resolution": return_screen != "Map",
        }
        if return_screen == "Event":
            self._set_room_session("event", "event", ["event"])
        elif return_screen == "Rest":
            self._set_room_session("rest", "rest", ["rest"])
        elif return_screen == "Shop":
            self._set_room_session("shop", "shop", ["shop"])
        else:
            self._clear_room_session()

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
        encounter_pool = self._prioritize_encounter_pool(encounter_pool, enemies_by_id, floor, node_type)
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
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._set_room_session("combat", "combat", ["combat"])

    def _apply_leave_room(self) -> None:
        phase = str(self._snapshot["lifecycle"]["phase"])
        if phase == "map":
            raise ValueError("leave_room is only valid after entering a room")
        if phase == "combat":
            raise ValueError("leave_room cannot exit combat directly")

        self._snapshot["combat"] = None
        self._snapshot["reward"] = None
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._clear_room_session()
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
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._set_room_session("combat", "reward", ["combat", "reward"], "resolving")
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
            signal = self._card_route_signal(selected_card_id)
            commit_tag = signal["route_tags"][0] if signal else None
            if commit_tag:
                self._record_route_commit("reward", 16, commit_tag)
            self._snapshot["route_state"] = self._derive_route_state_from_deck(self._snapshot.get("route_state"))

        self._snapshot["reward"] = None
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._clear_room_session()
        self._snapshot["lifecycle"] = {
            "screen": "Map",
            "phase": "map",
            "pending_node_resolution": False,
        }

    def _apply_skip_reward(self) -> None:
        if str(self._snapshot["lifecycle"]["phase"]) != "reward":
            raise ValueError("skip_reward is only valid during reward phase")
        self._snapshot["reward"] = None
        self._snapshot["shop"] = None
        self._snapshot["active_event"] = None
        self._snapshot["surface_context"] = None
        self._clear_room_session()
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
        card_pool_for_character = [
            entry
            for entry in self._content_bundle.get("cards", [])
            if str(entry.get("character", "All")) in {"All", str(character_id)}
        ]
        planned_rewards = self._generate_planned_reward_cards(str(character_id), card_pool_for_character)
        if planned_rewards:
            return planned_rewards

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
        base_gold = 30 + max(0, floor - 1) * 5
        if node_type == "Boss":
            return int(base_gold * 3.5)
        if node_type == "Elite":
            return int(base_gold * 2.5)
        return int(base_gold)

    def _get_current_node(self) -> dict[str, Any] | None:
        current_node_id = self._snapshot["map"]["current_node_id"]
        if current_node_id is None:
            return None
        return next((entry for entry in self._snapshot["map"]["nodes"] if entry["id"] == current_node_id), None)

    def _is_enemy_eligible_for_floor(self, enemy_def: dict[str, Any] | None, floor: int, node_type: str) -> bool:
        if not enemy_def:
            return False

        hp_range = enemy_def.get("hp_range", [enemy_def.get("minHp", 0), enemy_def.get("maxHp", 0)])
        max_hp = int(hp_range[1] if len(hp_range) > 1 else hp_range[0] if hp_range else 0)
        keywords = list(enemy_def.get("keywords", []))

        if node_type == "Boss":
            return True

        if node_type == "Elite":
            if floor <= 3:
                return max_hp <= 95
            if floor <= 6:
                return max_hp <= 115
            return True

        if str(enemy_def.get("id")) == "fission_small" and floor < 5:
            return False
        if "symbiote" in keywords and floor < 7:
            return False

        if floor <= 2:
            return max_hp <= 32 and not ("splits" in keywords and floor < 3)
        if floor <= 4:
            return max_hp <= 42
        if floor <= 6:
            return max_hp <= 50
        return True

    def _prioritize_encounter_pool(
        self,
        encounter_pool: list[str],
        enemies_by_id: dict[str, dict[str, Any]],
        floor: int,
        node_type: str,
    ) -> list[str]:
        eligible = [
            enemy_id
            for enemy_id in encounter_pool
            if self._is_enemy_eligible_for_floor(enemies_by_id.get(str(enemy_id)), floor, node_type)
        ]
        pool = eligible if eligible else list(encounter_pool)
        if node_type != "Combat" or floor > 3:
            return pool

        showcase_tag = f"showcase_floor_{floor}"
        exact = [
            enemy_id
            for enemy_id in pool
            if showcase_tag in list(enemies_by_id.get(str(enemy_id), {}).get("keywords", []))
        ]
        if exact:
            return exact

        early_variants = [
            enemy_id
            for enemy_id in pool
            if "variant" in list(enemies_by_id.get(str(enemy_id), {}).get("keywords", []))
            and "early_variant" in list(enemies_by_id.get(str(enemy_id), {}).get("keywords", []))
        ]
        return early_variants if early_variants else pool

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
            self._apply_floor_constraints(floor_nodes, floor, total_floors, rng)
            generated_nodes.append(floor_nodes)

        for floor_index in range(len(generated_nodes) - 1):
            current_floor = generated_nodes[floor_index]
            next_floor = generated_nodes[floor_index + 1]
            inbound_count = {node["id"]: 0 for node in next_floor}

            for node in current_floor:
                reachable_nodes = [next_node for next_node in next_floor if abs(float(next_node["x"]) - float(node["x"])) <= 0.66]
                pool = reachable_nodes if reachable_nodes else next_floor
                shuffled = self._legacy_random_sort(pool, rng)
                max_branches_cfg = dict(self._get_map_runtime_strategy().get("opening_route_expectation", {}).get("max_branches_per_floor", {}))
                max_branches_for_floor = int(max_branches_cfg.get(f"floor_{floor_index + 1}", branch_factor if floor_index > 1 else 2))
                desired = min(len(shuffled), max(1, 1 + int(rng() * max_branches_for_floor)))
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

        self._constrain_opening_route_expectations(generated_nodes)
        return [node for floor in generated_nodes for node in floor]

    def _create_map_rng(self, seed: int):
        state = int(seed)

        def next_random() -> float:
            nonlocal state
            state = int(float(state) * 1103515245 + 12345) & 0x7FFFFFFF
            return state / 0x7FFFFFFF

        return next_random

    def _get_map_runtime_strategy(self) -> dict[str, Any]:
        return dict(self._content_bundle.get("map", {}).get("runtime_strategy", {}))

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

    def _apply_floor_constraints(self, nodes: list[dict[str, Any]], floor: int, total_floors: int, rng) -> None:
        self._enforce_per_floor_caps(nodes, floor, total_floors, rng)
        self._enforce_opening_route_contrast(nodes, floor)

    def _enforce_per_floor_caps(self, nodes: list[dict[str, Any]], floor: int, total_floors: int, rng) -> None:
        strategy = self._get_map_runtime_strategy()
        type_caps = dict(strategy.get("floor_type_caps", {"Event": 1, "Shop": 1, "Rest": 1, "Elite": 1}))
        for room_type, cap in type_caps.items():
            indexes = [index for index, node in enumerate(nodes) if str(node["type"]) == room_type]
            while len(indexes) > cap:
                replace_index = indexes.pop()
                if replace_index is None:
                    break
                nodes[replace_index]["type"] = self._pick_replacement_type(floor, total_floors, nodes, room_type, rng)

    def _enforce_opening_route_contrast(self, nodes: list[dict[str, Any]], floor: int) -> None:
        strategy = self._get_map_runtime_strategy()
        contrast = dict(strategy.get("opening_route_contrast", {}))
        max_floor = int(contrast.get("max_floor", 3))
        utility_types = [str(entry) for entry in contrast.get("utility_types", ["Event", "Shop", "Rest"])]
        require_third_flavor = bool(contrast.get("require_third_flavor_on_floor_1", True))

        if floor > max_floor or len(nodes) < 2:
            return

        def ensure_type(preferred: str, fallback_index: int) -> None:
            if any(str(node["type"]) == preferred for node in nodes):
                return
            replace_index = next((index for index, node in enumerate(nodes) if index != fallback_index and str(node["type"]) == "Combat"), fallback_index)
            nodes[replace_index]["type"] = preferred

        ensure_type("Combat", 0)
        if not any(str(node["type"]) in set(utility_types) for node in nodes):
            fallback_type = utility_types[0] if floor == 1 else (utility_types[1] if floor % 2 == 0 and len(utility_types) > 1 else utility_types[min(2, len(utility_types) - 1)])
            ensure_type(fallback_type, len(nodes) - 1)

        unique_types = {str(node["type"]) for node in nodes}
        if floor == 1 and require_third_flavor and len(nodes) >= 4 and len(unique_types) < 3:
            target_index = next((index for index, node in enumerate(nodes) if str(node["type"]) == "Combat"), -1)
            if target_index >= 0:
                candidate = utility_types[1] if utility_types[0] in unique_types and len(utility_types) > 1 else utility_types[0]
                if candidate in unique_types:
                    candidate = utility_types[min(2, len(utility_types) - 1)]
                nodes[target_index]["type"] = candidate

    def _pick_replacement_type(
        self,
        floor: int,
        total_floors: int,
        nodes: list[dict[str, Any]],
        removed_type: str,
        rng,
    ) -> str:
        chapter_weights = self._get_chapter_weights(self._get_chapter_index(floor), self._get_depth_in_chapter(floor, total_floors))
        weighted_candidates = [
            {"type": "Combat", "weight": max(0.2, 1 - (chapter_weights["elite"] + chapter_weights["event"] + chapter_weights["shop"] + chapter_weights["rest"]))},
            {"type": "Event", "weight": chapter_weights["event"]},
            {"type": "Shop", "weight": chapter_weights["shop"]},
            {"type": "Rest", "weight": chapter_weights["rest"]},
            {"type": "Elite", "weight": chapter_weights["elite"]},
        ]
        weighted_candidates = [candidate for candidate in weighted_candidates if candidate["type"] != removed_type]

        if floor <= 3:
            for candidate in weighted_candidates:
                if candidate["type"] == "Elite":
                    candidate["weight"] = 0

        strategy = self._get_map_runtime_strategy()
        type_caps = dict(strategy.get("floor_type_caps", {"Event": 1, "Shop": 1, "Rest": 1, "Elite": 1}))
        for candidate in weighted_candidates:
            cap = type_caps.get(candidate["type"])
            if cap is not None:
                current_count = sum(1 for node in nodes if str(node["type"]) == candidate["type"])
                if current_count >= cap:
                    candidate["weight"] = 0

        total_weight = sum(max(0.0, float(candidate["weight"])) for candidate in weighted_candidates)
        if total_weight <= 0:
            return "Combat"

        roll = rng() * total_weight
        for candidate in weighted_candidates:
            roll -= max(0.0, float(candidate["weight"]))
            if roll <= 0:
                return str(candidate["type"])
        return "Combat"

    def _constrain_opening_route_expectations(self, generated_nodes: list[list[dict[str, Any]]]) -> None:
        opening_floor = generated_nodes[0] if generated_nodes else []
        if len(opening_floor) < 2:
            return
        strategy = self._get_map_runtime_strategy()
        expectation = dict(strategy.get("opening_route_expectation", {}))
        max_spread = int(expectation.get("max_spread", 15))
        traversal_depth = int(expectation.get("traversal_depth", 3))

        for _ in range(8):
            scored = [
                {"node": node, "score": self._calculate_route_expectation(generated_nodes, str(node["id"]), traversal_depth)}
                for node in opening_floor
                if node.get("next")
            ]
            if len(scored) < 2:
                return
            scores = [entry["score"] for entry in scored]
            if max(scores) - min(scores) <= max_spread:
                return
            highest = max(scored, key=lambda entry: entry["score"])
            lowest = min(scored, key=lambda entry: entry["score"])
            if not self._trim_highest_opening_route_branch(generated_nodes, highest["node"]) and not self._boost_lowest_opening_route_branch(generated_nodes, lowest["node"]):
                return

    def _trim_highest_opening_route_branch(self, generated_nodes: list[list[dict[str, Any]]], node: dict[str, Any]) -> bool:
        next_ids = list(node.get("next", []))
        if len(next_ids) <= 1:
            return False

        floor_two = generated_nodes[1] if len(generated_nodes) > 1 else []
        inbound_count = {str(entry["id"]): 0 for entry in floor_two}
        for start in generated_nodes[0] if generated_nodes else []:
            for next_id in start.get("next", []):
                inbound_count[str(next_id)] = inbound_count.get(str(next_id), 0) + 1

        removable = [
            {"nextId": str(next_id), "score": self._calculate_route_expectation(generated_nodes, str(next_id), int(self._get_map_runtime_strategy().get("opening_route_expectation", {}).get("traversal_depth", 3)))}
            for next_id in next_ids
            if inbound_count.get(str(next_id), 0) > 1
        ]
        removable.sort(key=lambda entry: entry["score"], reverse=True)
        if not removable:
            return False

        target = removable[0]["nextId"]
        node["next"] = [next_id for next_id in next_ids if str(next_id) != target]
        return True

    def _boost_lowest_opening_route_branch(self, generated_nodes: list[list[dict[str, Any]]], node: dict[str, Any]) -> bool:
        next_ids = {str(next_id) for next_id in node.get("next", [])}
        floor_two = generated_nodes[1] if len(generated_nodes) > 1 else []
        candidates = [
            {"nextId": str(next_node["id"]), "score": self._calculate_route_expectation(generated_nodes, str(next_node["id"]), int(self._get_map_runtime_strategy().get("opening_route_expectation", {}).get("traversal_depth", 3)))}
            for next_node in floor_two
            if str(next_node["id"]) not in next_ids and abs(float(next_node["x"]) - float(node["x"])) <= 0.66
        ]
        candidates.sort(key=lambda entry: entry["score"], reverse=True)
        if not candidates:
            return False

        node.setdefault("next", []).append(candidates[0]["nextId"])
        return True

    def _calculate_route_expectation(self, generated_nodes: list[list[dict[str, Any]]], start_node_id: str, depth: int = 3) -> int:
        weights = dict(self._get_map_runtime_strategy().get("opening_route_expectation", {}).get("weights", {"Combat": 2, "Elite": 5, "Boss": 0, "Event": 2, "Shop": 1, "Rest": 1}))
        all_nodes = [node for floor in generated_nodes for node in floor]
        start = next((node for node in all_nodes if str(node["id"]) == start_node_id), None)
        if start is None:
            return 0

        total = weights.get(str(start["type"]), 0)
        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(start_node_id, 0)]

        while queue:
            current_id, current_depth = queue.pop(0)
            if current_depth >= depth:
                continue
            current_node = next((node for node in all_nodes if str(node["id"]) == current_id), None)
            if current_node is None:
                continue
            for next_id in current_node.get("next", []):
                next_id_str = str(next_id)
                if next_id_str in visited:
                    continue
                visited.add(next_id_str)
                next_node = next((node for node in all_nodes if str(node["id"]) == next_id_str), None)
                if next_node is None:
                    continue
                total += weights.get(str(next_node["type"]), 0)
                queue.append((next_id_str, current_depth + 1))

        return total

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

    def _get_chapter_index(self, floor: int) -> int:
        if floor <= 10:
            return 1
        elif floor <= 18:
            return 2
        else:
            return 3

    def _get_depth_in_chapter(self, floor: int, total_floors: int) -> float:
        chapter_index = self._get_chapter_index(floor)
        if chapter_index == 1:
            return floor / 10
        elif chapter_index == 2:
            return (floor - 10) / 8
        else:
            return (floor - 18) / max(1, total_floors - 18)

    def _get_chapter_weights(self, chapter_index: int, depth: float) -> dict[str, float]:
        if chapter_index == 1:
            return {"elite": 0.24, "event": 0.18, "shop": 0.14, "rest": 0.12}
        elif chapter_index == 2:
            return {
                "elite": 0.14 + 0.03 * (1 - 1 / 8),
                "event": 0.18 - 0.02 * (1 - 1 / 8),
                "shop": 0.08,
                "rest": 0.08,
            }
        return {
            "elite": 0.16 + 0.08 * depth,
            "event": 0.20 - 0.02 * depth,
            "shop": 0.08,
            "rest": 0.08 - 0.04 * depth,
        }

    def _determine_legacy_node_type(self, floor: int, total_floors: int, rng) -> str:
        roll = rng()
        if floor == total_floors:
            return "Boss"
        if floor == total_floors - 1:
            return "Rest"

        chapter_index = self._get_chapter_index(floor)
        depth = self._get_depth_in_chapter(floor, total_floors)
        weights = self._get_chapter_weights(chapter_index, depth)
        elite_threshold = weights.get("elite", 0.06 + depth * 0.18)
        event_threshold = elite_threshold + weights.get("event", 0.18)
        shop_threshold = event_threshold + weights.get("shop", 0.14)
        rest_threshold = shop_threshold + weights.get("rest", 0.12)

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
                "secondary_resources": {resource: 0 for resource in SECONDARY_RESOURCES},
                **{resource: 0 for resource in SECONDARY_RESOURCES},
                **{resource: 0 for resource in SPECIAL_RESOURCES},
                "deck": [],
                "relic_ids": [],
                "potion_ids": [],
                "relic_states": {},
            },
            "map": {
                "current_node_id": None,
                "nodes": [],
            },
            "combat": None,
            "reward": None,
            "shop": None,
            "active_event": None,
            "meta": {
                "replay_length": 0,
                "runtime_rng_state": 0,
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


def boot(content_bundle: dict[str, Any], seed: int = 0) -> RuleRuntime:
    return RuleRuntime(content_bundle=content_bundle, seed=seed)


def create_save_game_v2(snapshot: dict[str, Any], host_platform: str, saved_at: str | None = None) -> dict[str, Any]:
    return {
        "schema_version": 2,
        "snapshot": deepcopy(snapshot),
        "saved_at": saved_at or "1970-01-01T00:00:00.000Z",
        "host_platform": host_platform,
    }


def restore_snapshot_from_save_game(save_game: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(save_game["snapshot"])


def create_replay_log_v1(seed: int, commands: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "seed": int(seed),
        "commands": deepcopy(commands or []),
    }


def replay_log(content_bundle: dict[str, Any], replay: dict[str, Any]) -> dict[str, Any]:
    runtime = boot(content_bundle, seed=int(replay["seed"]))
    snapshot = runtime.snapshot()
    for command in replay.get("commands", []):
        snapshot = runtime.dispatch(command)["snapshot"]
    return snapshot
