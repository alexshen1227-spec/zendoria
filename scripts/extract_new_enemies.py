"""
Extract clean per-pose sprites from the AI-generated enemy reference sheet.

Background removal:
  - The original sheet has a gray cell background and gray cell-border lines.
  - These are TOPOLOGICALLY connected to the image edges (or to each other),
    so we run an EDGE-SEEDED flood fill against "background-like" pixels.
  - This preserves any gray armor *inside* the enemy because it's surrounded
    by colored pixels and never reached from the edges.

Then per-section we find connected sprite blobs, bin them into cells (each
cell = one labeled pose, often 2 frames), downscale to game-pixel size,
and build sprite-sheet grids in the format the game expects.
"""

from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'reference' / 'provided_pixel_art' / 'new_enemies_source.png'
OUT = ROOT / 'assets' / 'sprites' / 'enemies'
OUT.mkdir(parents=True, exist_ok=True)


def load_source():
    return np.array(Image.open(SRC).convert('RGBA'))


def is_bg_like(rgb):
    """Boolean mask of pixels that *could* be background (low-saturation
    gray in the cell-fill / cell-border range). We only flag them; we do
    NOT remove them yet — the edge-seeded flood does that."""
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    # Cell fill (~205,210,215) and cell border (~155,165,170) are both
    # very low saturation in the 140..235 brightness range.
    return ((sat <= 16) & (mx >= 140) & (mx <= 235))


def is_label_like(rgb):
    """Near-black header text + near-white labels."""
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    near_black = mx < 60
    near_white = (mx >= 245) & (sat <= 6)
    return near_black | near_white


def edge_seeded_bg_mask(arr):
    """Return uint8 mask: 1 = sprite content (keep), 0 = background.

    Algorithm: BFS flood fill from all edge pixels, expanding through
    background-like pixels only. Anything not reached stays in the sprite.
    """
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(int)
    bg_like = is_bg_like(rgb)
    label_like = is_label_like(rgb)

    bg_filled = np.zeros((h, w), dtype=bool)
    q = deque()
    # Seed from all edge pixels that look bg-like
    for x in range(w):
        if bg_like[0, x]:
            bg_filled[0, x] = True; q.append((0, x))
        if bg_like[h - 1, x]:
            bg_filled[h - 1, x] = True; q.append((h - 1, x))
    for y in range(h):
        if bg_like[y, 0]:
            bg_filled[y, 0] = True; q.append((y, 0))
        if bg_like[y, w - 1]:
            bg_filled[y, w - 1] = True; q.append((y, w - 1))

    # 8-connected flood through bg-like pixels (8-conn keeps us slipping
    # through 1-pixel diagonal gaps in the cell border lines)
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not bg_filled[ny, nx] and bg_like[ny, nx]:
                    bg_filled[ny, nx] = True
                    q.append((ny, nx))

    # Final mask: drop everything reached by the flood, AND drop label text
    # (which often is freestanding inside cells and would otherwise survive).
    keep = ~(bg_filled | label_like)
    return keep.astype(np.uint8)


def flood_components(mask, min_area=400):
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    comps = []
    for sy in range(h):
        row = mask[sy]
        for sx in range(w):
            if row[sx] == 0 or visited[sy, sx]:
                continue
            q = deque([(sy, sx)])
            visited[sy, sx] = True
            ymin = ymax = sy
            xmin = xmax = sx
            area = 0
            while q:
                y, x = q.popleft()
                area += 1
                if y < ymin: ymin = y
                if y > ymax: ymax = y
                if x < xmin: xmin = x
                if x > xmax: xmax = x
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and mask[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
            if area >= min_area:
                comps.append((ymin, ymax, xmin, xmax, area))
    return comps


def merge_overlapping(boxes, x_pad, y_pad):
    boxes = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        out = []
        used = [False] * len(boxes)
        for i in range(len(boxes)):
            if used[i]:
                continue
            y0, y1, x0, x1, a = boxes[i]
            ey0, ey1, ex0, ex1 = y0 - y_pad, y1 + y_pad, x0 - x_pad, x1 + x_pad
            merged = (y0, y1, x0, x1, a)
            for j in range(i + 1, len(boxes)):
                if used[j]:
                    continue
                y0b, y1b, x0b, x1b, ab = boxes[j]
                if not (x1b < ex0 or x0b > ex1 or y1b < ey0 or y0b > ey1):
                    used[j] = True
                    merged = (
                        min(merged[0], y0b), max(merged[1], y1b),
                        min(merged[2], x0b), max(merged[3], x1b),
                        merged[4] + ab,
                    )
                    changed = True
            used[i] = True
            out.append(merged)
        boxes = [list(b) for b in out]
    return [tuple(b) for b in boxes]


def extract_blob(arr, mask, box, pad=2):
    y0, y1, x0, x1, _ = box
    y0 = max(0, y0 - pad); x0 = max(0, x0 - pad)
    y1 = min(arr.shape[0] - 1, y1 + pad); x1 = min(arr.shape[1] - 1, x1 + pad)
    region = arr[y0:y1+1, x0:x1+1].copy()
    region[:, :, 3] = (mask[y0:y1+1, x0:x1+1] * 255).astype(np.uint8)
    return region


def collect_blobs(arr, mask, y0, y1, label, min_area=400, x_pad=4, y_pad=30):
    section_mask = mask[y0:y1].copy()
    comps = flood_components(section_mask, min_area=min_area)
    comps = [(c[0] + y0, c[1] + y0, c[2], c[3], c[4]) for c in comps]
    merged = merge_overlapping(comps, x_pad=x_pad, y_pad=y_pad)
    img_w = arr.shape[1]
    merged = [b for b in merged if b[2] > 8 and b[3] < img_w - 8]
    def aspect_ok(b):
        w = b[3] - b[2] + 1; h = b[1] - b[0] + 1
        return not (w < 12 or h < 12 or w / max(1, h) > 6 or h / max(1, w) > 6)
    merged = [b for b in merged if aspect_ok(b)]
    merged.sort(key=lambda b: (b[2] + b[3]) / 2)
    print(f'\n[{label}] {len(merged)} blobs')
    return merged


def bin_blobs_to_cells(blobs, n_cells, x_start, x_end):
    cells = [[] for _ in range(n_cells)]
    cell_w = (x_end - x_start) / n_cells
    for b in blobs:
        cx = (b[2] + b[3]) / 2
        idx = int((cx - x_start) / cell_w)
        idx = max(0, min(n_cells - 1, idx))
        cells[idx].append(b)
    return cells


def downscale_pixel_art(rgba, target_h):
    h, w = rgba.shape[:2]
    if h <= target_h:
        return rgba
    scale = target_h / h
    new_w = max(1, int(round(w * scale)))
    img = Image.fromarray(rgba).resize((new_w, target_h), Image.NEAREST)
    return np.array(img)


def pack_grid(rows_of_frames, cell_w, cell_h, anchor='bottom', pad=1):
    n_cols = max(len(r) for r in rows_of_frames)
    n_rows = len(rows_of_frames)
    sheet = np.zeros((cell_h * n_rows, cell_w * n_cols, 4), dtype=np.uint8)
    for ri, frames in enumerate(rows_of_frames):
        for ci, f in enumerate(frames):
            if f is None:
                continue
            h, w = f.shape[:2]
            if w > cell_w:
                f = f[:, :cell_w]; w = cell_w
            if h > cell_h:
                f = f[:cell_h]; h = cell_h
            ox = ci * cell_w + (cell_w - w) // 2
            if anchor == 'bottom':
                oy = ri * cell_h + (cell_h - h - pad)
                if oy < ri * cell_h:
                    oy = ri * cell_h
            else:
                oy = ri * cell_h + (cell_h - h) // 2
            sheet[oy:oy+h, ox:ox+w] = f
    return sheet


def save_png(arr_rgba, path):
    if arr_rgba is None:
        return
    Image.fromarray(arr_rgba).save(path)
    print(f'  -> {path.name} {arr_rgba.shape[1]}x{arr_rgba.shape[0]}')


def main():
    arr = load_source()
    mask = edge_seeded_bg_mask(arr)
    print(f'source {arr.shape}, kept {mask.sum():,} px after edge-seeded bg removal')

    # ============ RUSHERS ============
    rusher_blobs = collect_blobs(arr, mask, 160, 415, 'RUSHERS', min_area=600, x_pad=4, y_pad=40)
    rusher_cells = bin_blobs_to_cells(rusher_blobs, n_cells=7, x_start=40, x_end=2810)
    rusher_frames_per_cell = []
    for ci, cell_blobs in enumerate(rusher_cells):
        crops = [extract_blob(arr, mask, b) for b in cell_blobs]
        scaled = [downscale_pixel_art(c, 24) for c in crops]
        rusher_frames_per_cell.append(scaled)
        print(f'  cell {ci}: {len(scaled)} frame(s)')

    def pad2(frames, h=24, w=24):
        if not frames: return [np.zeros((h, w, 4), dtype=np.uint8)] * 2
        if len(frames) == 1: return [frames[0], frames[0]]
        return frames[:2]

    rusher_grid_rows = [
        pad2(rusher_frames_per_cell[0]),
        pad2(rusher_frames_per_cell[1]),
        pad2(rusher_frames_per_cell[2]),
        pad2(rusher_frames_per_cell[3]),
        pad2(rusher_frames_per_cell[4]),
        pad2(rusher_frames_per_cell[5] or rusher_frames_per_cell[6]),
    ]
    rusher_sheet = pack_grid(rusher_grid_rows, cell_w=28, cell_h=28, anchor='bottom', pad=1)
    save_png(rusher_sheet, OUT / 'rusher_sheet.png')

    # ============ ARCHERS ============
    archer_blobs = collect_blobs(arr, mask, 560, 770, 'ARCHERS', min_area=300, x_pad=4, y_pad=30)
    archer_cells = bin_blobs_to_cells(archer_blobs, n_cells=7, x_start=40, x_end=2810)
    archer_frames_per_cell = []
    for ci, cell_blobs in enumerate(archer_cells):
        crops = [extract_blob(arr, mask, b) for b in cell_blobs]
        scaled = [downscale_pixel_art(c, 28) for c in crops]
        archer_frames_per_cell.append(scaled)
        print(f'  archer cell {ci}: {len(scaled)} frame(s)')

    def pad2_archer(frames):
        return pad2(frames, h=28, w=18)

    archer_grid_rows = [
        pad2_archer(archer_frames_per_cell[0]),
        pad2_archer(archer_frames_per_cell[1]),
        pad2_archer(archer_frames_per_cell[2]),
        pad2_archer(archer_frames_per_cell[4]),
        pad2_archer(archer_frames_per_cell[5] or archer_frames_per_cell[6]),
    ]
    archer_sheet = pack_grid(archer_grid_rows, cell_w=22, cell_h=32, anchor='bottom', pad=1)
    save_png(archer_sheet, OUT / 'archer_sheet.png')

    # ============ GOLIATH ============
    g1_blobs = collect_blobs(arr, mask, 940, 1180, 'GOLIATH_R1', min_area=1500, x_pad=8, y_pad=40)
    g1_cells = bin_blobs_to_cells(g1_blobs, n_cells=4, x_start=40, x_end=2810)
    g2_blobs = collect_blobs(arr, mask, 1200, 1530, 'GOLIATH_R2', min_area=1500, x_pad=8, y_pad=40)
    g2_cells = bin_blobs_to_cells(g2_blobs, n_cells=4, x_start=40, x_end=2810)

    def goliath_frames(cell_blobs, h=48):
        return [downscale_pixel_art(extract_blob(arr, mask, b), h) for b in cell_blobs]

    g1_frames = [goliath_frames(c) for c in g1_cells]
    g2_frames = [goliath_frames(c) for c in g2_cells]

    def pad2_goliath(frames):
        return pad2(frames, h=48, w=64)

    goliath_grid_rows = [
        pad2_goliath(g1_frames[0]),
        pad2_goliath(g1_frames[1]),
        pad2_goliath(g1_frames[2]),
        pad2_goliath(g2_frames[1]),
        pad2_goliath(g1_frames[3]),
        pad2_goliath(g2_frames[3]),
    ]
    goliath_sheet = pack_grid(goliath_grid_rows, cell_w=64, cell_h=56, anchor='bottom', pad=2)
    save_png(goliath_sheet, OUT / 'goliath_sheet.png')

    print('\nAll sheets saved to', OUT)


if __name__ == '__main__':
    main()
