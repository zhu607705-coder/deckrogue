"""Generate deterministic polished Wave II art assets.

This script is intentionally local and dependency-light: it uses Pillow, which is
already used by the repository asset tools, and writes directly to public assets.
The output avoids text in the artwork and gives every Wave II card, relic, and
route-pressure enemy a distinct hashable visual identity.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
CARDS_PATH = ROOT / "src" / "content" / "data" / "cards.json"
RELICS_PATH = ROOT / "src" / "content" / "data" / "relics.json"
ENEMIES_PATH = ROOT / "src" / "content" / "data" / "enemies.json"
CARDS_DIR = ROOT / "public" / "assets" / "cards"
RELICS_DIR = ROOT / "public" / "assets" / "relics"
ENEMIES_DIR = ROOT / "public" / "assets" / "enemies"
MANIFEST_PATH = ROOT / "output" / "assets" / "wave2_visual_polish_manifest.json"

WAVE_II_CARD_IDS = [
    "cipher_dead_drop",
    "shadow_ledger_route",
    "witness_box_trap",
    "sainted_sinew",
    "nailwall_stance",
    "redline_bellow",
    "venom_grid",
    "command_canticle",
    "bastion_geometry",
    "choir_thread",
    "reliquary_golem",
    "severance_pact",
    "minute_tax",
    "delayed_funeral",
    "warp_notary",
    "ember_distillate",
    "acidic_catechism",
    "choir_reagent",
    "docket_of_bones",
    "execution_hour",
    "compelled_confession",
    "seal_of_stillwater",
    "suppression_field",
    "rift_liability",
]

WAVE_II_RELIC_IDS = [
    "cipher_lantern",
    "iron_votive",
    "command_seal",
    "marionette_reliquary",
    "minute_censer",
    "crucible_choir",
    "verdict_thurible",
    "null_chalice",
]

WAVE_II_ENEMY_IDS = [
    "cipher_surgeon",
    "redline_penitent",
    "banner_tax_collector",
    "reliquary_string_host",
    "morgue_timekeeper",
    "crucible_deacon",
    "catacomb_bailiff",
    "null_cup_bearer",
]

PALETTES = {
    "informant": ("#1a2438", "#64d2ff", "#d9f6ff", "#0a0e16"),
    "brute": ("#351117", "#ff4f45", "#ffc58f", "#12070a"),
    "tactician": ("#172638", "#6ee7b7", "#e7fff5", "#081016"),
    "puppeteer": ("#24183a", "#c084fc", "#f5e8ff", "#0e0918"),
    "chronomancer": ("#12233c", "#38bdf8", "#f6e58d", "#060c17"),
    "alchemist": ("#1c2b18", "#a3e635", "#ffd166", "#080f08"),
    "penitent_judge": ("#28141a", "#d4af37", "#fff0c2", "#11070b"),
    "void_sanctioner": ("#0a1327", "#93c5fd", "#e0f2fe", "#02040b"),
}

ENEMY_PALETTES = {
    "cipher_surgeon": PALETTES["informant"],
    "redline_penitent": PALETTES["brute"],
    "banner_tax_collector": PALETTES["tactician"],
    "reliquary_string_host": PALETTES["puppeteer"],
    "morgue_timekeeper": PALETTES["chronomancer"],
    "crucible_deacon": PALETTES["alchemist"],
    "catacomb_bailiff": PALETTES["penitent_judge"],
    "null_cup_bearer": PALETTES["void_sanctioner"],
}


def load_json(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def by_id(items: Iterable[dict]) -> dict[str, dict]:
    return {str(item["id"]): item for item in items}


def rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    return (*rgb(hex_color), alpha)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def stable_rng(seed_text: str) -> random.Random:
    seed = int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:16], 16)
    return random.Random(seed)


def gradient(size: tuple[int, int], top: str, bottom: str, accent: str) -> Image.Image:
    width, height = size
    top_rgb = rgb(top)
    bottom_rgb = rgb(bottom)
    accent_rgb = rgb(accent)
    image = Image.new("RGBA", size)
    px = image.load()
    for y in range(height):
        t = y / max(1, height - 1)
        base = mix(top_rgb, bottom_rgb, t)
        for x in range(width):
            dx = (x / width) - 0.5
            dy = (y / height) - 0.42
            glow = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy) * 2.25) ** 2
            col = mix(base, accent_rgb, glow * 0.34)
            px[x, y] = (*col, 255)
    return image


def regular_polygon(cx: float, cy: float, radius: float, points: int, rotation: float = 0) -> list[tuple[float, float]]:
    return [
        (
            cx + math.cos(rotation + math.tau * i / points) * radius,
            cy + math.sin(rotation + math.tau * i / points) * radius,
        )
        for i in range(points)
    ]


def draw_noise(draw: ImageDraw.ImageDraw, rng: random.Random, size: tuple[int, int], color: str, count: int) -> None:
    width, height = size
    for _ in range(count):
        x = rng.randrange(width)
        y = rng.randrange(height)
        length = rng.randrange(8, max(9, width // 8))
        angle = rng.random() * math.tau
        end = (x + math.cos(angle) * length, y + math.sin(angle) * length)
        draw.line((x, y, end[0], end[1]), fill=rgba(color, rng.randrange(14, 44)), width=rng.randrange(1, 4))


def draw_cathedral_frame(draw: ImageDraw.ImageDraw, size: tuple[int, int], accent: str, light: str, inset: int) -> None:
    width, height = size
    draw.rounded_rectangle((inset, inset, width - inset, height - inset), radius=inset // 2, outline=rgba(light, 118), width=max(3, inset // 7))
    draw.rounded_rectangle((inset * 2, inset * 2, width - inset * 2, height - inset * 2), radius=inset // 3, outline=rgba(accent, 96), width=max(2, inset // 9))
    arch_top = height * 0.13
    arch_bottom = height * 0.82
    draw.arc((width * 0.21, arch_top, width * 0.79, height * 0.6), 180, 360, fill=rgba(light, 88), width=max(4, inset // 6))
    draw.line((width * 0.21, height * 0.36, width * 0.21, arch_bottom), fill=rgba(light, 70), width=max(3, inset // 8))
    draw.line((width * 0.79, height * 0.36, width * 0.79, arch_bottom), fill=rgba(light, 70), width=max(3, inset // 8))


def draw_card(record: dict) -> Image.Image:
    palette = PALETTES.get(record.get("character"), PALETTES["void_sanctioner"])
    base, accent, light, dark = palette
    rng = stable_rng(record["id"])
    image = gradient((768, 1024), base, dark, accent)
    draw = ImageDraw.Draw(image, "RGBA")
    draw_noise(draw, rng, image.size, light, 115)
    draw_cathedral_frame(draw, image.size, accent, light, 46)

    cx, cy = 384, 492
    rarity_points = {"Common": 4, "Uncommon": 5, "Rare": 7}.get(record.get("rarity"), 6)
    tags = set(record.get("tags", []))

    halo = Image.new("RGBA", image.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo, "RGBA")
    for radius, alpha in [(250, 34), (180, 48), (104, 72)]:
        hd.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=rgba(accent, alpha), width=10)
    halo = halo.filter(ImageFilter.GaussianBlur(2.5))
    image.alpha_composite(halo)

    draw = ImageDraw.Draw(image, "RGBA")
    motif_radius = 162
    draw.polygon(regular_polygon(cx, cy, motif_radius, rarity_points, -math.pi / 2), fill=rgba(accent, 84), outline=rgba(light, 190))
    draw.polygon(regular_polygon(cx, cy, motif_radius * 0.62, max(3, rarity_points - 1), math.pi / 8), fill=rgba(dark, 122), outline=rgba(light, 144))

    if record.get("type") == "Attack":
        for offset in (-32, 0, 32):
            draw.arc((cx - 210, cy - 145 + offset, cx + 210, cy + 145 + offset), 206, 337, fill=rgba(light, 206), width=16)
        draw.line((cx - 128, cy + 138, cx + 130, cy - 126), fill=rgba(light, 198), width=13)
    else:
        draw.rounded_rectangle((cx - 134, cy - 142, cx + 134, cy + 156), radius=42, fill=rgba(dark, 120), outline=rgba(light, 170), width=8)
        for i in range(5):
            y = cy - 88 + i * 44
            draw.line((cx - 95, y, cx + 95, y), fill=rgba(accent, 145), width=5)

    if "draw" in tags or any(action.get("type") == "Draw" for action in record.get("actions", [])):
        for i in range(5):
            angle = -0.95 + i * 0.48
            draw.arc((cx - 250, cy - 260, cx + 250, cy + 260), 240 + angle * 40, 250 + angle * 40, fill=rgba(light, 165), width=9)
    if {"risk", "rage", "fire"} & tags:
        for i in range(7):
            x = cx - 168 + i * 56
            draw.polygon([(x, cy + 258), (x + 26, cy + 190 - rng.randrange(0, 45)), (x + 52, cy + 258)], fill=rgba(accent, 125))
    if {"seal", "suppression", "verdict"} & tags:
        draw.line((cx - 170, cy, cx + 170, cy), fill=rgba(light, 196), width=9)
        draw.line((cx, cy - 170, cx, cy + 170), fill=rgba(light, 196), width=9)
    if {"poison", "acid", "concoction"} & tags:
        for i in range(7):
            draw.ellipse((cx - 160 + i * 46, cy + 120 - i % 2 * 48, cx - 118 + i * 46, cy + 162 - i % 2 * 48), fill=rgba(accent, 136), outline=rgba(light, 100), width=3)
    if {"thread", "threads"} & tags:
        for x in range(168, 601, 72):
            draw.line((x, 196, cx + rng.randrange(-90, 91), cy + rng.randrange(-80, 121)), fill=rgba(light, 128), width=4)
    if {"layer", "echo", "rift"} & tags:
        for radius in (70, 112, 154):
            draw.arc((cx - radius, cy - radius, cx + radius, cy + radius), 28, 316, fill=rgba(light, 130), width=6)

    draw.rounded_rectangle((94, 826, 674, 895), radius=22, fill=rgba(dark, 176), outline=rgba(accent, 112), width=3)
    for i, tag in enumerate(record.get("tags", [])[:3]):
        x = 134 + i * 180
        draw.rounded_rectangle((x, 846, x + 122, 876), radius=12, fill=rgba(accent, 72), outline=rgba(light, 70), width=2)
    return image.convert("RGB")


def draw_relic(record: dict) -> Image.Image:
    character = next((tag for tag in record.get("tags", []) if tag in PALETTES), "void_sanctioner")
    base, accent, light, dark = PALETTES[character]
    rng = stable_rng(record["id"])
    image = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    for radius, alpha in [(118, 42), (86, 70), (54, 100)]:
        gd.ellipse((128 - radius, 128 - radius, 128 + radius, 128 + radius), fill=rgba(accent, alpha))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((24, 24, 232, 232), fill=rgba(dark, 226), outline=rgba(light, 170), width=5)
    draw.ellipse((45, 45, 211, 211), outline=rgba(accent, 170), width=4)
    points = 6 + rng.randrange(0, 3)
    draw.polygon(regular_polygon(128, 128, 72, points, rng.random() * math.tau), fill=rgba(base, 210), outline=rgba(light, 190))
    draw.polygon(regular_polygon(128, 128, 44, max(3, points - 2), -math.pi / 2), fill=rgba(accent, 160), outline=rgba(light, 210))
    for i in range(points):
        a = math.tau * i / points + rng.random() * 0.08
        draw.line((128, 128, 128 + math.cos(a) * 96, 128 + math.sin(a) * 96), fill=rgba(light, 120), width=3)
    draw.arc((78, 78, 178, 178), 18, 342, fill=rgba("#ffffff", 70), width=4)
    draw.rounded_rectangle((91, 116, 165, 140), radius=10, fill=rgba(light, 105))
    return image


def draw_enemy(record: dict) -> Image.Image:
    base, accent, light, dark = ENEMY_PALETTES[record["id"]]
    rng = stable_rng(record["id"])
    image = gradient((512, 512), dark, base, accent)
    draw = ImageDraw.Draw(image, "RGBA")
    draw_noise(draw, rng, image.size, light, 75)
    draw.rounded_rectangle((22, 22, 490, 490), radius=28, outline=rgba(light, 82), width=4)
    draw.ellipse((80, 300, 432, 472), fill=rgba("#000000", 95))

    cx = 256
    height = 235 + rng.randrange(-16, 30)
    shoulder = 76 + rng.randrange(-10, 22)
    waist = 45 + rng.randrange(-8, 12)
    top = 126 + rng.randrange(-18, 18)
    bottom = top + height
    body = [(cx - shoulder, top + 80), (cx - waist, bottom), (cx + waist, bottom), (cx + shoulder, top + 80), (cx + 42, top + 25), (cx, top), (cx - 42, top + 25)]
    draw.polygon(body, fill=rgba(base, 225), outline=rgba(light, 170))
    draw.ellipse((cx - 48, top - 10, cx + 48, top + 86), fill=rgba(dark, 235), outline=rgba(light, 146), width=5)
    draw.ellipse((cx - 25, top + 30, cx - 7, top + 48), fill=rgba(accent, 220))
    draw.ellipse((cx + 7, top + 30, cx + 25, top + 48), fill=rgba(accent, 220))
    draw.line((cx - 28, top + 69, cx + 28, top + 69), fill=rgba(light, 160), width=5)

    for i in range(5):
        y = top + 118 + i * 24
        draw.line((cx - shoulder + 12, y, cx + shoulder - 12, y + rng.randrange(-8, 9)), fill=rgba(accent, 115), width=5)

    for side in (-1, 1):
        arm_x = cx + side * (shoulder + 28)
        draw.line((cx + side * shoulder, top + 108, arm_x, top + 222), fill=rgba(light, 130), width=16)
        draw.ellipse((arm_x - 17, top + 211, arm_x + 17, top + 245), fill=rgba(accent, 170))

    motif = record["id"].split("_")[0]
    if motif in {"cipher", "banner"}:
        for i in range(4):
            y = 112 + i * 52
            draw.line((88, y, 424, y + rng.randrange(-22, 23)), fill=rgba(accent, 94), width=5)
    elif motif in {"redline", "catacomb"}:
        draw.arc((86, 70, 426, 410), 205, 336, fill=rgba(light, 150), width=16)
        draw.line((132, 390, 382, 96), fill=rgba(accent, 145), width=12)
    elif motif in {"reliquary", "morgue"}:
        for x in range(134, 407, 54):
            draw.line((x, 64, cx + rng.randrange(-86, 87), bottom - 40), fill=rgba(light, 105), width=4)
    elif motif in {"crucible", "null"}:
        for radius in (58, 95, 132):
            draw.ellipse((cx - radius, top + 124 - radius, cx + radius, top + 124 + radius), outline=rgba(accent, 108), width=6)

    image = image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=115, threshold=3))
    return image.convert("RGBA")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_card(record: dict) -> dict:
    path = CARDS_DIR / f"{record['id']}.webp"
    if path.exists():
        return {"id": record["id"], "path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
    draw_card(record).save(path, "WEBP", quality=88, method=6)
    return {"id": record["id"], "path": str(path.relative_to(ROOT)), "sha256": sha256(path)}


def save_relic(record: dict) -> dict:
    path = RELICS_DIR / f"{record['id']}.png"
    if path.exists():
        return {"id": record["id"], "path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
    draw_relic(record).save(path, "PNG", optimize=True)
    return {"id": record["id"], "path": str(path.relative_to(ROOT)), "sha256": sha256(path)}


def save_enemy(record: dict) -> dict:
    path = ENEMIES_DIR / f"{record['id']}.png"
    draw_enemy(record).save(path, "PNG", optimize=True)
    return {"id": record["id"], "path": str(path.relative_to(ROOT)), "sha256": sha256(path)}


def assert_unique(entries: list[dict], label: str) -> None:
    hashes = [entry["sha256"] for entry in entries]
    if len(hashes) != len(set(hashes)):
        raise SystemExit(f"{label} contains duplicate asset hashes")


def main() -> None:
    cards = by_id(load_json(CARDS_PATH))
    relics = by_id(load_json(RELICS_PATH))
    enemies = by_id(load_json(ENEMIES_PATH))
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    card_entries = [save_card(cards[item_id]) for item_id in WAVE_II_CARD_IDS]
    relic_entries = [save_relic(relics[item_id]) for item_id in WAVE_II_RELIC_IDS]
    enemy_entries = [save_enemy(enemies[item_id]) for item_id in WAVE_II_ENEMY_IDS]

    assert_unique(card_entries, "cards")
    assert_unique(relic_entries, "relics")
    assert_unique(enemy_entries, "enemies")

    manifest = {
        "cards": card_entries,
        "relics": relic_entries,
        "enemies": enemy_entries,
        "totals": {
            "cards": len(card_entries),
            "relics": len(relic_entries),
            "enemies": len(enemy_entries),
            "all": len(card_entries) + len(relic_entries) + len(enemy_entries),
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(
        "Generated Wave II polished assets: "
        f"{manifest['totals']['cards']} cards, "
        f"{manifest['totals']['relics']} relics, "
        f"{manifest['totals']['enemies']} enemies."
    )
    print(f"Manifest: {MANIFEST_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
