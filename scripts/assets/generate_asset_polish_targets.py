"""Generate deterministic art polish targets for referenced runtime assets.

The script creates only project-owned, abstract gothic sci-fi visuals. It avoids
text, logos, copied compositions, and external sources so generated files remain
safe to hash and audit.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
CARDS_DIR = ROOT / "public" / "assets" / "cards"
EVENTS_DIR = ROOT / "public" / "assets" / "events"
REPORT_PATH = ROOT / "reports" / "assets" / "asset-polish-generated.json"

CARD_TARGETS = {
    "awaken_machine_chorus": {
        "palette": ("#22170b", "#f59e0b", "#ffe7a3", "#070503"),
        "motif": "machine",
    },
}

EVENT_TARGETS = {
    "coolant_crypt": ("#0b1f26", "#7dd3fc", "#dff8ff", "#03090d", "crypt"),
    "logic_tribunal": ("#111827", "#60a5fa", "#dbeafe", "#020617", "tribunal"),
    "servo_reliquary": ("#1f1a12", "#f59e0b", "#fff7d6", "#090603", "relic"),
    "reactor_chapel": ("#25160d", "#f97316", "#fff1c2", "#090403", "reactor"),
    "machine_psalm_archive": ("#121826", "#a3e635", "#ecfccb", "#030712", "archive"),
    "flesh_replacement_cradle": ("#2a1014", "#fb7185", "#ffe4e6", "#090304", "cradle"),
    "sacred_overclock": ("#1f1609", "#facc15", "#fef9c3", "#080503", "overclock"),
    "cooling_vault_breach": ("#0d1822", "#38bdf8", "#e0f2fe", "#020617", "vault"),
    "abbot_confession": ("#21131b", "#c084fc", "#f5e8ff", "#08030d", "confession"),
    "terminal_silence": ("#07111f", "#93c5fd", "#e0f2fe", "#010409", "terminal"),
    "spore_cathedral": ("#102114", "#84cc16", "#ecfccb", "#030803", "spore"),
    "blood_mill": ("#2a0d0d", "#ef4444", "#fee2e2", "#080202", "mill"),
    "husk_orphanage": ("#211827", "#a78bfa", "#ede9fe", "#07040d", "orphanage"),
    "septic_archive": ("#1b1f12", "#a3e635", "#f7fee7", "#050703", "septic"),
    "mire_wedding": ("#161d12", "#d9f99d", "#fefce8", "#040603", "wedding"),
    "blessing_of_flies": ("#151f0e", "#bef264", "#f7fee7", "#030601", "flies"),
    "rotted_operatory": ("#231316", "#f43f5e", "#ffe4e6", "#070204", "operatory"),
    "grave_choir": ("#101827", "#94a3b8", "#f1f5f9", "#020617", "choir"),
    "larval_pit": ("#22160e", "#fb923c", "#ffedd5", "#080403", "larval"),
    "eaten_sanctum": ("#21130c", "#f97316", "#ffedd5", "#080302", "sanctum"),
    "corruption_well": ("#1b1025", "#a855f7", "#f3e8ff", "#050208", "well"),
    "silent_plague": ("#101b12", "#86efac", "#dcfce7", "#020602", "plague"),
}


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
            dx = x / width - 0.5
            dy = y / height - 0.46
            glow = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy) * 2.15) ** 2
            col = mix(base, accent_rgb, glow * 0.38)
            px[x, y] = (*col, 255)
    return image


def polygon(cx: float, cy: float, radius: float, points: int, rotation: float) -> list[tuple[float, float]]:
    return [
        (
            cx + math.cos(rotation + math.tau * i / points) * radius,
            cy + math.sin(rotation + math.tau * i / points) * radius,
        )
        for i in range(points)
    ]


def draw_noise(draw: ImageDraw.ImageDraw, rng: random.Random, size: tuple[int, int], light: str, count: int) -> None:
    width, height = size
    for _ in range(count):
        x = rng.randrange(width)
        y = rng.randrange(height)
        length = rng.randrange(20, max(21, width // 5))
        angle = rng.random() * math.tau
        draw.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length), fill=rgba(light, rng.randrange(10, 34)), width=rng.randrange(1, 4))


def draw_event(target_id: str, spec: tuple[str, str, str, str, str]) -> Image.Image:
    base, accent, light, dark, motif = spec
    rng = stable_rng(target_id)
    image = gradient((1280, 720), base, dark, accent)
    draw = ImageDraw.Draw(image, "RGBA")
    draw_noise(draw, rng, image.size, light, 130)

    cx, cy = 640, 370
    draw.rectangle((0, 0, 1280, 720), outline=rgba(light, 88), width=8)
    draw.rounded_rectangle((70, 56, 1210, 664), radius=26, outline=rgba(accent, 92), width=5)
    draw.arc((330, 90, 950, 710), 184, 356, fill=rgba(light, 95), width=8)
    draw.line((330, 400, 330, 662), fill=rgba(light, 62), width=7)
    draw.line((950, 400, 950, 662), fill=rgba(light, 62), width=7)

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    for radius, alpha in ((245, 32), (170, 48), (92, 72)):
        gd.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=rgba(accent, alpha))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(26)))
    draw = ImageDraw.Draw(image, "RGBA")

    if motif in {"tribunal", "confession", "choir"}:
        for offset in (-180, -90, 0, 90, 180):
            draw.line((cx + offset, 132, cx + offset * 0.35, 620), fill=rgba(light, 80), width=5)
        draw.polygon(polygon(cx, cy, 130, 6, -math.pi / 2), fill=rgba(accent, 95), outline=rgba(light, 160))
        draw.line((cx - 150, cy, cx + 150, cy), fill=rgba(light, 140), width=8)
    elif motif in {"crypt", "vault", "terminal", "archive", "septic"}:
        for i in range(7):
            x = 265 + i * 118
            draw.rounded_rectangle((x, 180, x + 68, 594), radius=18, fill=rgba(dark, 130), outline=rgba(light, 78), width=3)
        draw.ellipse((cx - 105, cy - 105, cx + 105, cy + 105), outline=rgba(accent, 170), width=10)
        draw.arc((cx - 165, cy - 165, cx + 165, cy + 165), 20, 340, fill=rgba(light, 116), width=7)
    elif motif in {"reactor", "overclock", "mill"}:
        for radius in (74, 128, 190):
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=rgba(accent, 150), width=8)
        for i in range(12):
            angle = math.tau * i / 12
            draw.line((cx, cy, cx + math.cos(angle) * 260, cy + math.sin(angle) * 210), fill=rgba(light, 70), width=5)
    elif motif in {"spore", "flies", "plague", "larval"}:
        for _ in range(44):
            x = rng.randrange(180, 1100)
            y = rng.randrange(140, 620)
            r = rng.randrange(12, 42)
            draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(accent, rng.randrange(38, 96)), outline=rgba(light, 55), width=2)
        draw.polygon(polygon(cx, cy, 155, 9, rng.random() * math.tau), fill=rgba(dark, 120), outline=rgba(light, 130))
    else:
        points = 5 + rng.randrange(0, 4)
        draw.polygon(polygon(cx, cy, 170, points, -math.pi / 2), fill=rgba(accent, 92), outline=rgba(light, 150))
        draw.polygon(polygon(cx, cy, 96, max(3, points - 2), math.pi / 5), fill=rgba(dark, 130), outline=rgba(light, 120))
        for i in range(points):
            angle = math.tau * i / points
            draw.line((cx, cy, cx + math.cos(angle) * 260, cy + math.sin(angle) * 210), fill=rgba(light, 60), width=5)

    image = image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=3))
    return image.convert("RGB")


def draw_card(target_id: str, spec: dict[str, object]) -> Image.Image:
    base, accent, light, dark = spec["palette"]  # type: ignore[misc]
    rng = stable_rng(target_id)
    image = gradient((768, 1024), str(base), str(dark), str(accent))
    draw = ImageDraw.Draw(image, "RGBA")
    draw_noise(draw, rng, image.size, str(light), 120)
    draw.rounded_rectangle((44, 44, 724, 980), radius=36, outline=rgba(str(light), 120), width=7)
    draw.rounded_rectangle((80, 82, 688, 942), radius=24, outline=rgba(str(accent), 100), width=5)

    cx, cy = 384, 492
    for radius, alpha in ((245, 36), (168, 60), (92, 86)):
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=rgba(str(accent), alpha), width=12)
    for i in range(12):
        angle = math.tau * i / 12
        draw.line((cx, cy, cx + math.cos(angle) * 240, cy + math.sin(angle) * 240), fill=rgba(str(light), 70), width=6)
    draw.polygon(polygon(cx, cy, 170, 8, math.pi / 8), fill=rgba(str(accent), 92), outline=rgba(str(light), 170))
    draw.polygon(polygon(cx, cy, 88, 6, -math.pi / 2), fill=rgba(str(dark), 132), outline=rgba(str(light), 140))
    for radius in (52, 88, 126):
        draw.arc((cx - radius, cy - radius, cx + radius, cy + radius), 28, 334, fill=rgba(str(light), 150), width=8)
    draw.rounded_rectangle((118, 820, 650, 896), radius=22, fill=rgba(str(dark), 170), outline=rgba(str(accent), 115), width=4)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=115, threshold=3))
    return image.convert("RGB")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_webp(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        image.save(path, "WEBP", quality=88, method=6)


def main() -> None:
    entries = []
    for target_id, spec in CARD_TARGETS.items():
        path = CARDS_DIR / f"{target_id}.webp"
        save_webp(path, draw_card(target_id, spec))
        entries.append({"kind": "card", "id": target_id, "path": str(path.relative_to(ROOT)), "sha256": sha256(path)})

    for target_id, spec in EVENT_TARGETS.items():
        path = EVENTS_DIR / f"{target_id}.webp"
        save_webp(path, draw_event(target_id, spec))
        entries.append({"kind": "event", "id": target_id, "path": str(path.relative_to(ROOT)), "sha256": sha256(path)})

    hashes = [entry["sha256"] for entry in entries]
    if len(hashes) != len(set(hashes)):
        raise SystemExit("Generated asset hashes are not unique")

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps({"count": len(entries), "assets": entries}, indent=2), encoding="utf-8")
    print(f"Generated or verified {len(entries)} art polish targets.")
    print(f"Manifest: {REPORT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
