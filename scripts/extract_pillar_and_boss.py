"""Extract pillar stages and sand worm boss frames from the AI-ready sheets.

Both source sheets are 1536x1024 RGB with a near-white background. I use an
edge-seeded flood-fill (8-connectivity) to strip the background while keeping
interior light-gray highlights intact, then split by connected components and
bin by spatial layout into the final sprite sheets.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_SRC = os.path.join(ROOT, 'AI_Ready_Assets')
OUT_DIR = os.path.join(ROOT, 'assets', 'sprites', 'pillars')
BOSS_OUT_DIR = os.path.join(ROOT, 'assets', 'sprites', 'boss')


def edge_seeded_bg_mask(arr):
    """Return a boolean mask of 'background' pixels, reached from the image edges
    via 8-connected BFS through bg-like (near-white) pixels only. Interior
    light pixels surrounded by colored pixels are preserved.
    """
    h, w = arr.shape[:2]
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    # bg: near-white and very desaturated
    bg_like = (mx > 235) & (sat < 14)

    filled = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if bg_like[0, x]:
            filled[0, x] = True
            q.append((0, x))
        if bg_like[h - 1, x]:
            filled[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if bg_like[y, 0]:
            filled[y, 0] = True
            q.append((y, 0))
        if bg_like[y, w - 1]:
            filled[y, w - 1] = True
            q.append((y, w - 1))

    DIRS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    while q:
        y, x = q.popleft()
        for dy, dx in DIRS:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not filled[ny, nx] and bg_like[ny, nx]:
                filled[ny, nx] = True
                q.append((ny, nx))

    return filled


def make_rgba(arr, bg_mask):
    h, w = arr.shape[:2]
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., :3] = arr
    out[..., 3] = np.where(bg_mask, 0, 255)
    return out


def label_components(alpha):
    """Return (labels, bboxes) for 4-connected components of opaque pixels."""
    h, w = alpha.shape
    labels = np.zeros((h, w), dtype=np.int32)
    bboxes = []
    nid = 0
    for y in range(h):
        row = labels[y]
        for x in range(w):
            if alpha[y, x] and row[x] == 0:
                nid += 1
                x0, y0, x1, y1 = x, y, x, y
                q = deque([(y, x)])
                row[x] = nid
                while q:
                    cy, cx = q.popleft()
                    if cy < y0:
                        y0 = cy
                    if cy > y1:
                        y1 = cy
                    if cx < x0:
                        x0 = cx
                    if cx > x1:
                        x1 = cx
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = nid
                            q.append((ny, nx))
                bboxes.append((nid, x0, y0, x1, y1))
    return labels, bboxes


def merge_overlapping(bboxes, pad=6):
    """Merge bboxes whose padded rects overlap. Returns merged list."""
    items = [list(b) for b in bboxes]
    merged_any = True
    while merged_any:
        merged_any = False
        out = []
        used = [False] * len(items)
        for i in range(len(items)):
            if used[i]:
                continue
            _id, ax0, ay0, ax1, ay1 = items[i]
            for j in range(i + 1, len(items)):
                if used[j]:
                    continue
                _jd, bx0, by0, bx1, by1 = items[j]
                if (ax0 - pad <= bx1 and bx0 - pad <= ax1 and
                        ay0 - pad <= by1 and by0 - pad <= ay1):
                    ax0 = min(ax0, bx0)
                    ay0 = min(ay0, by0)
                    ax1 = max(ax1, bx1)
                    ay1 = max(ay1, by1)
                    used[j] = True
                    merged_any = True
            out.append([i, ax0, ay0, ax1, ay1])
            used[i] = True
        items = out
    return items


def extract_blob(rgba, labels, comp_ids, bbox):
    _id, x0, y0, x1, y1 = bbox
    # union mask of all labels in comp_ids
    if not isinstance(comp_ids, (list, tuple, set)):
        comp_ids = {comp_ids}
    comp_ids = set(comp_ids)
    sub_labels = labels[y0:y1 + 1, x0:x1 + 1]
    mask = np.isin(sub_labels, list(comp_ids))
    sub = rgba[y0:y1 + 1, x0:x1 + 1].copy()
    sub[..., 3] = np.where(mask, sub[..., 3], 0)
    # trim to content bbox
    opaque = sub[..., 3] > 0
    if not opaque.any():
        return None
    ys, xs = np.where(opaque)
    return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def downscale(im, target_h):
    """Downscale a cropped PIL image so that its height matches target_h,
    preserving aspect. Nearest-neighbor preserves pixel-art crunchiness.
    """
    if target_h is None or im.height <= target_h:
        return im
    ratio = target_h / im.height
    target_w = max(1, int(round(im.width * ratio)))
    return im.resize((target_w, target_h), Image.NEAREST)


def pack_uniform_row(frames, frame_w, frame_h):
    sheet = Image.new('RGBA', (frame_w * len(frames), frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        fx = i * frame_w + (frame_w - f.width) // 2
        fy = frame_h - f.height  # bottom-align so bases line up
        sheet.paste(f, (fx, fy), f)
    return sheet


def pack_uniform_grid(frames_by_row, frame_w, frame_h):
    rows = len(frames_by_row)
    cols = max(len(r) for r in frames_by_row)
    sheet = Image.new('RGBA', (frame_w * cols, frame_h * rows), (0, 0, 0, 0))
    for ry, row in enumerate(frames_by_row):
        for cx, f in enumerate(row):
            fx = cx * frame_w + (frame_w - f.width) // 2
            fy = ry * frame_h + (frame_h - f.height) // 2
            sheet.paste(f, (fx, fy), f)
    return sheet


def extract_pillar():
    src = os.path.join(ASSETS_SRC, 'magic_pillar_sheet_ai_ready_transparent.png')
    arr = np.array(Image.open(src).convert('RGB'))
    print('pillar source:', arr.shape)
    bg = edge_seeded_bg_mask(arr)
    rgba = make_rgba(arr, bg)
    alpha = rgba[..., 3] > 0
    labels, bboxes = label_components(alpha)
    # filter tiny specks
    keep = [b for b in bboxes if (b[3] - b[1]) * (b[4] - b[2]) > 400]
    # merge overlapping parts of each pillar (ball + body can be near each other)
    merged = merge_overlapping(keep, pad=12)
    # sort by x, keep the 3 biggest by area
    merged_with_area = sorted(merged, key=lambda m: (m[3] - m[1]) * (m[4] - m[2]), reverse=True)[:3]
    merged_sorted = sorted(merged_with_area, key=lambda m: m[1])

    print(f'[PILLAR] merged blobs: {len(merged)}, using top-3 left-to-right')

    crops = []
    for i, m in enumerate(merged_sorted):
        _id, x0, y0, x1, y1 = m
        # We merged labels — to collect them, find which original labels fall inside
        comp_ids = set()
        for b in keep:
            bid, bx0, by0, bx1, by1 = b
            if bx0 >= x0 and by0 >= y0 and bx1 <= x1 and by1 <= y1:
                comp_ids.add(bid)
        crop = extract_blob(rgba, labels, comp_ids, (None, x0, y0, x1, y1))
        if crop is None:
            continue
        im = Image.fromarray(crop, 'RGBA')
        # Downscale to 48 px tall (fits game scale — player is ~32 px)
        im = downscale(im, 48)
        crops.append(im)
        print(f'  stage {i}: {im.size}')

    if len(crops) != 3:
        raise RuntimeError(f'expected 3 pillar stages, got {len(crops)}')

    # Uniform frame: biggest width/height among the 3
    fw = max(c.width for c in crops)
    fh = max(c.height for c in crops)
    sheet = pack_uniform_row(crops, fw, fh)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, 'pillar_sheet.png')
    sheet.save(out)
    print(f'-> {out} {sheet.size}  frame={fw}x{fh}')
    return fw, fh


def extract_boss():
    """Extract a few key boss frames: idle, bite, hurt, dying/dead.

    The source sheet is a dense mix of worm poses + FX + UI pickups. Strategy:
    - Edge-seed flood-fill the bg.
    - Label connected components.
    - Merge components whose bboxes are close (body + mouth + sand puff can
      separate).
    - Filter to large (>160x120) blobs — drops pickups, coins, crystals.
    - Sort by reading order (row, then column).
    - Pick curated frames for the desired animations.
    """
    src = os.path.join(ASSETS_SRC, 'sand_worm_boss_sheet_ai_ready_transparent.png')
    arr = np.array(Image.open(src).convert('RGB'))
    print('boss source:', arr.shape)
    bg = edge_seeded_bg_mask(arr)
    rgba = make_rgba(arr, bg)
    alpha = rgba[..., 3] > 0
    labels, bboxes = label_components(alpha)

    # filter specks
    keep = [b for b in bboxes if (b[3] - b[1]) > 30 and (b[4] - b[2]) > 30]
    # Small pad so body+mouth+sand-puff of ONE worm stay together but
    # adjacent worms in a row don't merge. Worms sit ~40px apart at source.
    merged = merge_overlapping(keep, pad=4)
    # Keep only large ones — drop UI icons, coins, crystals
    big = [m for m in merged if (m[3] - m[1]) >= 140 and (m[4] - m[2]) >= 100]
    # Sort by (row, col) using row bucketing
    def row_key(b):
        cy = (b[2] + b[4]) // 2
        return cy // 120
    big.sort(key=lambda b: (row_key(b), b[1]))

    print(f'[BOSS] large blobs: {len(big)}')
    for idx, m in enumerate(big):
        _id, x0, y0, x1, y1 = m
        print(f'  {idx}: x={x0}-{x1} y={y0}-{y1} w={x1-x0} h={y1-y0}')

    # Extract crops
    crops = []
    for m in big:
        _id, x0, y0, x1, y1 = m
        comp_ids = set()
        for b in keep:
            bid, bx0, by0, bx1, by1 = b
            if bx0 >= x0 and by0 >= y0 and bx1 <= x1 and by1 <= y1:
                comp_ids.add(bid)
        crop = extract_blob(rgba, labels, comp_ids, (None, x0, y0, x1, y1))
        if crop is None:
            continue
        im = Image.fromarray(crop, 'RGBA')
        crops.append(im)

    # Curated selection: we want idle, bite (mouth open), hurt, dying.
    # Without AI-analysis of frames, pick deterministically by grid row then col:
    # - idle: row 0, col 0 (closed mouth, neutral)
    # - bite: row 0, col 4 (mouth open roar pose)
    # - hurt: row 1, col 1 (mid-row, body)
    # - dying: last frame (smallest/slumped)
    # Adjust indices based on actual extraction results.
    if len(crops) < 8:
        raise RuntimeError(f'not enough boss frames extracted: {len(crops)}')

    # Downscale to 96px tall for game scale
    scaled = [downscale(c, 96) for c in crops]
    # Uniform frame size
    fw = max(s.width for s in scaled)
    fh = max(s.height for s in scaled)

    # Pick frames — fall back to boundary-safe indices
    def safe(idx):
        return scaled[min(idx, len(scaled) - 1)]

    idle = safe(0)
    bite = safe(4)   # the roar pose
    hurt = safe(9) if len(scaled) > 9 else safe(len(scaled) // 2)
    dying = scaled[-1]

    # Pack into a simple 4-frame row: [idle, bite, hurt, dying]
    frames = [idle, bite, hurt, dying]
    sheet = pack_uniform_row(frames, fw, fh)
    os.makedirs(BOSS_OUT_DIR, exist_ok=True)
    out = os.path.join(BOSS_OUT_DIR, 'sandworm_sheet.png')
    sheet.save(out)
    print(f'-> {out} {sheet.size} frame={fw}x{fh}')

    return fw, fh


if __name__ == '__main__':
    pw, ph = extract_pillar()
    bw, bh = extract_boss()
    print(f'\nPILLAR frame: {pw}x{ph}')
    print(f'BOSS   frame: {bw}x{bh}')
