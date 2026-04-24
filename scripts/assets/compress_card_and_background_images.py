"""
compress_card_and_background_images.py - 压缩卡牌和背景图片资源

主要职责:
- 扫描卡牌和背景图片目录
- 使用 PIL 压缩图片至目标大小
- 生成压缩报告（JSON 和 Markdown）
"""

from __future__ import annotations

import io
import json
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, asdict
from pathlib import Path

from PIL import Image, UnidentifiedImageError

TARGET_BYTES = 1_000_000
ROOT = Path('/Users/zhuhangcheng/Downloads/好玩/deckrogue')
TARGET_DIRS = [ROOT / 'public' / 'assets' / 'cards', ROOT / 'public' / 'assets' / 'backgrounds']
REPORT_JSON = ROOT / 'output' / 'image_compression_report.json'
REPORT_MD = ROOT / 'output' / 'image_compression_report.md'


@dataclass
class Entry:
    path: str
    category: str
    original_bytes: int
    final_bytes: int
    original_dimensions: str
    final_dimensions: str
    original_mode: str
    final_mode: str
    changed: bool
    status: str


def iter_images() -> list[Path]:
    paths: list[Path] = []
    for base in TARGET_DIRS:
        for path in sorted(base.rglob('*')):
            if path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}:
                paths.append(path)
    return paths


def resize_by_limit(img: Image.Image, category: str) -> Image.Image:
    limit_w, limit_h = (1344, 1800) if category == 'cards' else (1920, 1080)
    ratio = min(limit_w / img.width, limit_h / img.height, 1.0)
    if ratio >= 1.0:
        return img
    return img.resize((max(1, int(img.width * ratio)), max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)


def save_png(img: Image.Image, colors: int) -> bytes:
    if 'A' in img.getbands():
        work = img.convert('RGBA').quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    else:
        work = img.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    buf = io.BytesIO()
    work.save(buf, format='PNG', optimize=True, compress_level=9)
    return buf.getvalue()


def save_jpeg(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.convert('RGB').save(buf, format='JPEG', optimize=True, progressive=True, quality=quality, subsampling='4:2:0')
    return buf.getvalue()


def save_webp(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format='WEBP', method=6, quality=quality)
    return buf.getvalue()


def encode_best(img: Image.Image, suffix: str, category: str) -> tuple[bytes, str, str]:
    suffix = suffix.lower()
    attempts = []
    if suffix == '.png':
        plans = [192, 128, 96] if category == 'backgrounds' else [160, 128, 96, 64]
        current = img
        for scale in (1.0, 0.82, 0.7):
            if scale != 1.0:
                current = img.resize((max(320, int(img.width * scale)), max(320, int(img.height * scale))), Image.Resampling.LANCZOS)
            for colors in plans + [48, 32]:
                data = save_png(current, colors)
                attempts.append((data, current, f'png-{colors}'))
                if len(data) <= TARGET_BYTES:
                    return data, f'{current.width}x{current.height}', current.mode
        data, current, _ = min(attempts, key=lambda x: len(x[0]))
        return data, f'{current.width}x{current.height}', current.mode
    if suffix in {'.jpg', '.jpeg'}:
        current = img
        attempts = []
        for scale in (1.0, 0.82, 0.7):
            if scale != 1.0:
                current = img.resize((max(320, int(img.width * scale)), max(320, int(img.height * scale))), Image.Resampling.LANCZOS)
            for q in (82, 72, 62, 52, 42, 32):
                data = save_jpeg(current, q)
                attempts.append((data, current, f'jpeg-{q}'))
                if len(data) <= TARGET_BYTES:
                    return data, f'{current.width}x{current.height}', current.mode
        data, current, _ = min(attempts, key=lambda x: len(x[0]))
        return data, f'{current.width}x{current.height}', current.mode
    if suffix == '.webp':
        current = img
        attempts = []
        for scale in (1.0, 0.82, 0.7):
            if scale != 1.0:
                current = img.resize((max(320, int(img.width * scale)), max(320, int(img.height * scale))), Image.Resampling.LANCZOS)
            for q in (82, 72, 62, 52, 42, 32):
                data = save_webp(current, q)
                attempts.append((data, current, f'webp-{q}'))
                if len(data) <= TARGET_BYTES:
                    return data, f'{current.width}x{current.height}', current.mode
        data, current, _ = min(attempts, key=lambda x: len(x[0]))
        return data, f'{current.width}x{current.height}', current.mode
    raise ValueError(suffix)


def process_one(path_str: str) -> Entry:
    path = Path(path_str)
    rel = str(path.relative_to(ROOT))
    category = path.parent.name
    original_bytes_blob = path.read_bytes()
    original_bytes = len(original_bytes_blob)
    try:
        with Image.open(io.BytesIO(original_bytes_blob)) as img:
            img.load()
            original_mode = img.mode
            original_dimensions = f'{img.width}x{img.height}'
            if original_bytes <= TARGET_BYTES:
                return Entry(rel, category, original_bytes, original_bytes, original_dimensions, original_dimensions, original_mode, original_mode, False, 'ok')
            base = resize_by_limit(img, category)
            data, final_dimensions, final_mode = encode_best(base, path.suffix, category)
            path.write_bytes(data)
            return Entry(rel, category, original_bytes, len(data), original_dimensions, final_dimensions, original_mode, final_mode, True, 'ok' if len(data) <= TARGET_BYTES else 'over_limit')
    except UnidentifiedImageError:
        status = 'ok' if original_bytes <= TARGET_BYTES else 'unsupported_over_limit'
        return Entry(rel, category, original_bytes, original_bytes, '-', '-', 'unsupported', 'unsupported', False, status)


def human(n: int) -> str:
    return f'{n / 1024:.1f} KB'


def main() -> None:
    paths = [str(p) for p in iter_images()]
    with ProcessPoolExecutor(max_workers=8) as pool:
        entries = list(pool.map(process_one, paths))
    entries.sort(key=lambda e: e.path)
    total_before = sum(e.original_bytes for e in entries)
    total_after = sum(e.final_bytes for e in entries)
    over_limit = [e.path for e in entries if e.final_bytes > TARGET_BYTES]
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps({
        'target_bytes': TARGET_BYTES,
        'total_files': len(entries),
        'total_before_bytes': total_before,
        'total_after_bytes': total_after,
        'over_limit': over_limit,
        'entries': [asdict(e) for e in entries],
    }, ensure_ascii=False, indent=2))
    lines = [
        '# 图像压缩报告',
        '',
        f'- 目标上限: {TARGET_BYTES} bytes ({human(TARGET_BYTES)})',
        f'- 处理文件数: {len(entries)}',
        f'- 压缩前总大小: {human(total_before)}',
        f'- 压缩后总大小: {human(total_after)}',
        f'- 节省空间: {human(total_before - total_after)}',
        f'- 超限文件数: {len(over_limit)}',
        '',
        '| 文件 | 分类 | 处理前 | 处理后 | 尺寸变化 | 状态 |',
        '|---|---|---:|---:|---|---|',
    ]
    for e in entries:
        lines.append(f'| `{e.path}` | {e.category} | {human(e.original_bytes)} | {human(e.final_bytes)} | {e.original_dimensions} -> {e.final_dimensions} | {e.status} |')
    REPORT_MD.write_text('\n'.join(lines))
    print(f'report_json={REPORT_JSON}')
    print(f'report_md={REPORT_MD}')
    print(f'over_limit={len(over_limit)}')


if __name__ == '__main__':
    main()
