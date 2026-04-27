"""Diagnose why boatman dialogue panel 3 still shows a white background
in-game, even though removeEdgeMatte() runs on it with mode='light'.

Samples a 5x5 grid of pixels across each panel + flood-fills from corners
to see how much of the white area is actually reachable from the edge.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image


def grid_sample(img: Image.Image, w: int, h: int) -> str:
    px = img.load()
    rows = []
    for sy in [0, h // 4, h // 2, 3 * h // 4, h - 1]:
        cols = []
        for sx in [0, w // 4, w // 2, 3 * w // 4, w - 1]:
            r, g, b, a = px[sx, sy]
            if a < 24:
                tag = "T"
            elif a == 255 and r > 230 and g > 230 and b > 230:
                tag = "W"
            else:
                tag = "C"
            cols.append(f"{tag}({r:3},{g:3},{b:3},a={a:3})")
        rows.append("  " + "  ".join(cols))
    return "\n".join(rows)


def flood_metric(img: Image.Image, threshold: int = 28) -> tuple[int, int, int]:
    """Replicate removeEdgeMatte's flood logic to count:
    - matte_total: total pixels matching the matte rule
    - matte_reached: pixels the edge flood-fill actually reaches
    - matte_isolated: matte pixels that survived (matte but unreachable)
    """
    w, h = img.size
    px = img.load()

    def matches(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        return r > 255 - threshold and g > 255 - threshold and b > 255 - threshold

    matte_total = 0
    for y in range(h):
        for x in range(w):
            if matches(x, y):
                matte_total += 1

    visited = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        if x < 0 or x >= w or y < 0 or y >= h:
            return
        idx = y * w + x
        if visited[idx]:
            return
        if not matches(x, y):
            return
        visited[idx] = 1
        queue.append((x, y))

    for x in range(w):
        enqueue(x, 0)
        enqueue(x, h - 1)
    for y in range(h):
        enqueue(0, y)
        enqueue(w - 1, y)

    while queue:
        x, y = queue.popleft()
        enqueue(x - 1, y)
        enqueue(x + 1, y)
        enqueue(x, y - 1)
        enqueue(x, y + 1)

    reached = sum(visited)
    return matte_total, reached, matte_total - reached


def main() -> int:
    target_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "C:/Dev/Zendoria/assets/ui/dialog"
    )
    files = sorted(target_dir.glob("boatman_dialogue_*.png"))
    if not files:
        print(f"no panels in {target_dir}", file=sys.stderr)
        return 2
    for path in files:
        img = Image.open(path).convert("RGBA")
        w, h = img.size
        print(f"\n=== {path.name} ({w}x{h}) ===")
        print(grid_sample(img, w, h))
        total, reached, isolated = flood_metric(img)
        pct_reached = 100.0 * reached / total if total else 0.0
        pct_isolated_of_total = 100.0 * isolated / (w * h) if w * h else 0.0
        print(
            f"\nmatte_total={total}  edge_reached={reached} ({pct_reached:.1f}%)  "
            f"isolated={isolated} ({pct_isolated_of_total:.2f}% of canvas)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
