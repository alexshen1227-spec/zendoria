"""Audit NPC sprite PNGs for the matte-fill destruction bug.

The matte-fill bug from commit 0c7c5d4 ran a flood-fill from the canvas
edges that erased any pixel whose RGB values were all below a small
threshold. On NPCs with dark hair, dark clothing, or dark outlines, this
hollowed out 28-80% of their figure pixels.

This script measures, per file:
- Total pixels and opaque pixels (alpha > 0)
- Opaque-pixel ratio (suspicious if << 30% of bbox area)
- Dark-pixel ratio of opaque pixels (suspicious if very low -- means
  dark pixels were stripped out, leaving only midtones / highlights)
- Tight bounding box dimensions

Usage: python scripts/audit_npc_sprites.py [path-to-generated-dir]
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def audit(path: Path) -> dict:
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    total = w * h
    opaque = 0
    dark = 0
    min_x, min_y, max_x, max_y = w, h, -1, -1

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            opaque += 1
            if x < min_x:
                min_x = x
            if y < min_y:
                min_y = y
            if x > max_x:
                max_x = x
            if y > max_y:
                max_y = y
            if r < 60 and g < 60 and b < 60:
                dark += 1

    if max_x < min_x or max_y < min_y:
        bbox_w = bbox_h = 0
        bbox_area = 0
        fill_ratio = 0.0
    else:
        bbox_w = max_x - min_x + 1
        bbox_h = max_y - min_y + 1
        bbox_area = bbox_w * bbox_h
        fill_ratio = opaque / bbox_area if bbox_area else 0.0

    dark_ratio = dark / opaque if opaque else 0.0

    return {
        "name": path.stem,
        "size": (w, h),
        "bbox": (bbox_w, bbox_h),
        "opaque_pct": 100.0 * opaque / total if total else 0.0,
        "fill_ratio_in_bbox": 100.0 * fill_ratio,
        "dark_pixel_ratio": 100.0 * dark_ratio,
    }


def classify(report: dict) -> str:
    """Return 'CLEAN', 'SUSPICIOUS', or 'DAMAGED' for the audit row.

    Rules of thumb (calibrated for figures fitted into ~256x320 source PNGs):
    - DAMAGED: fill_ratio_in_bbox < 35% (large internal holes) OR
               dark_pixel_ratio < 1% (almost no dark pixels left -- the
               flood-fill clearly stripped outlines/hair/shadows)
    - SUSPICIOUS: fill_ratio_in_bbox < 50% OR dark_pixel_ratio < 4%
    - CLEAN: otherwise
    """
    fill = report["fill_ratio_in_bbox"]
    dark = report["dark_pixel_ratio"]
    if fill < 35.0 or dark < 1.0:
        return "DAMAGED"
    if fill < 50.0 or dark < 4.0:
        return "SUSPICIOUS"
    return "CLEAN"


def main() -> int:
    if len(sys.argv) >= 2:
        target = Path(sys.argv[1])
    else:
        target = Path("assets/sprites/npcs/generated")

    if not target.exists():
        print(f"ERROR: directory not found: {target}", file=sys.stderr)
        return 2

    pngs = sorted(target.glob("*.png"))
    if not pngs:
        print(f"ERROR: no PNG files in {target}", file=sys.stderr)
        return 2

    rows = [audit(p) for p in pngs]
    rows_with_status = [(classify(r), r) for r in rows]

    print(f"# NPC sprite audit -- {target}\n")
    print(f"{'NAME':<30} {'SIZE':>10} {'BBOX':>10} {'OPQ%':>6} {'FILL%':>6} {'DARK%':>6}  STATUS")
    print("-" * 90)
    for status, r in rows_with_status:
        size = f"{r['size'][0]}x{r['size'][1]}"
        bbox = f"{r['bbox'][0]}x{r['bbox'][1]}"
        print(
            f"{r['name']:<30} {size:>10} {bbox:>10} "
            f"{r['opaque_pct']:>5.1f} {r['fill_ratio_in_bbox']:>5.1f} "
            f"{r['dark_pixel_ratio']:>5.1f}  {status}"
        )

    print()
    counts = {}
    for status, _ in rows_with_status:
        counts[status] = counts.get(status, 0) + 1
    print("Summary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))

    return 0


if __name__ == "__main__":
    sys.exit(main())
