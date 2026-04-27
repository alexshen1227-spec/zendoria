"""Audit Tropics realm assets + dialog panels for unremoved white backgrounds.

Detects PNGs whose corner pixels are predominantly white *and* opaque,
which is the signature of an unremoved matte that the runtime
`removeEdgeMatte` would normally strip. Source PNGs in this project are
expected to have transparent corners; fully-opaque white corners mean
either the matte was never removed at build time and isn't being removed
at runtime either.

Usage:
    python scripts/audit_white_backgrounds.py [path...]

Each path can be a file or a directory.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def corner_samples(img: Image.Image, inset: int = 2) -> list[tuple[int, int, int, int]]:
    """Sample 5x5 patches at each of the four corners (inset by `inset` px)."""
    w, h = img.size
    pixels = img.load()
    samples = []
    coords = [
        (inset, inset),
        (w - 1 - inset, inset),
        (inset, h - 1 - inset),
        (w - 1 - inset, h - 1 - inset),
    ]
    for cx, cy in coords:
        rs = gs = bs = a_s = 0
        n = 0
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                x = max(0, min(w - 1, cx + dx))
                y = max(0, min(h - 1, cy + dy))
                p = pixels[x, y]
                if len(p) == 4:
                    r, g, b, a = p
                else:
                    r, g, b = p
                    a = 255
                rs += r
                gs += g
                bs += b
                a_s += a
                n += 1
        samples.append((rs // n, gs // n, bs // n, a_s // n))
    return samples


def audit_image(path: Path) -> tuple[str, str]:
    img = Image.open(path).convert("RGBA")
    samples = corner_samples(img)

    bright_opaque = 0
    transparent = 0
    total = len(samples)
    for r, g, b, a in samples:
        if a < 24:
            transparent += 1
        elif r > 230 and g > 230 and b > 230:
            bright_opaque += 1

    detail = ", ".join(
        f"({r:>3},{g:>3},{b:>3},a={a:>3})" for r, g, b, a in samples
    )

    if bright_opaque >= 3:
        return "WHITE-BG", detail
    if bright_opaque >= 2 and transparent <= 1:
        return "MOSTLY-WHITE", detail
    if transparent >= 3:
        return "CLEAN", detail
    return "MIXED", detail


def collect_targets(args: list[str]) -> list[Path]:
    targets = []
    for arg in args:
        path = Path(arg)
        if path.is_file():
            targets.append(path)
        elif path.is_dir():
            targets.extend(sorted(path.glob("*.png")))
        else:
            print(f"WARN: not found: {path}", file=sys.stderr)
    return targets


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    paths = collect_targets(sys.argv[1:])
    if not paths:
        return 2

    print(f"# White-background audit\n")
    print(f"{'STATUS':<14} {'PATH'}")
    print("-" * 100)
    counts = {}
    for p in paths:
        try:
            status, detail = audit_image(p)
        except Exception as exc:
            status = "ERROR"
            detail = str(exc)
        counts[status] = counts.get(status, 0) + 1
        print(f"{status:<14} {p}")
        if status in ("WHITE-BG", "MOSTLY-WHITE", "ERROR"):
            print(f"{'':<14}   corners: {detail}")

    print()
    print("Summary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
