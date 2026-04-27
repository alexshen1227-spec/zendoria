# NPC Sprite Audit -- 2026-04-26

**Scope:** All 18 generated NPC PNGs under `assets/sprites/npcs/generated/`.
**Goal:** Confirm or rule out the matte-fill destruction bug from
commit `0c7c5d4` ("Configure Game Studios for web stack + fix NPC sprite
matte destruction") for each NPC.

**Method:** Programmatic audit via `scripts/audit_npc_sprites.py` -- counts
opaque pixels, fill ratio inside the tight bounding box, and the proportion
of opaque pixels that are dark (R/G/B all < 60). Heuristic thresholds:

| Status | Rule |
|---|---|
| **DAMAGED** | bbox fill < 35% OR dark-pixel ratio < 1% (severe outline loss) |
| **SUSPICIOUS** | bbox fill < 50% OR dark-pixel ratio < 4% (worth eyeballing) |
| **CLEAN** | otherwise |

> Note: this worktree does not contain the actual generated NPC PNGs
> (they live in the parent project tree at
> `C:/Dev/Zendoria/assets/sprites/npcs/generated/`). The audit was run
> against the parent's copy.

---

## Headline result

**DAMAGED = 0, SUSPICIOUS = 3, CLEAN = 15.**

The matte-fill regression from `0c7c5d4` is **not present** in any of the
18 NPC source PNGs. The `prepareGeneratedNpcSprite()` function in
`js/assets.js:545` already deliberately skips the dark-matte flood
(see the inline comment) and just trims to visible bounds. Source files
on disk look healthy.

The 3 SUSPICIOUS rows (luma-shell-courier, neve-root-singer,
tamas-cinder-runner) are flagged because they have wider/taller poses with
more spread (45-50% bbox fill, vs. ~60-70% on the cleaner sprites). This
is a **pose / silhouette** characteristic, not pixel destruction --
the dark-pixel ratios are still healthy (25-44%), which means outlines and
shadows are intact.

---

## Why TAMAS still looks broken in-game

Alex's playtest report said TAMAS's pixels are missing. The audit shows the
source PNG is intact, so the visible damage is happening **at runtime**,
not in the source asset. The most likely cause:

`fitSpriteToBox` in `js/assets.js:530` resizes every NPC into a 32x40 game
sprite. For tamas-cinder-runner the source is 244x457:

```
scale = min(32/244, 40/457) = 0.0875
targetW = round(244 * 0.0875) = 21
targetH = 40
```

That is an ~12x downsample with `imageSmoothingEnabled = false` (nearest
neighbor). At that ratio you keep one out of every ~12 source pixels, so
fine detail (1-2 px outlines, eyes, accessories) is randomly preserved or
dropped depending on which source row/column survives the sampling. The
result reads as "missing pixels" / "destroyed".

The bigger source PNGs are hit hardest:

| NPC | source W | downsample W | loss |
|---|---|---|---|
| neve-root-singer | 307 | 27 | 91% |
| luma-shell-courier | 302 | 28 | 91% |
| tovin-tide-cartographer | 278 | 24 | 91% |
| cadrin-lantern-keeper | 267 | 27 | 90% |
| eamon-wreck-diver | 267 | 28 | 90% |
| tamas-cinder-runner | 244 | 21 | 91% |
| fenn-moon-ferrier | 248 | 22 | 91% |
| halden-starherd | 259 | 22 | 91% |
| qira-salt-glasswright | 199 | 14 | 93% |

Compare to the cleaner-feeling NPCs:

| NPC | source W | downsample W | loss |
|---|---|---|---|
| mira-tide-medic | 194 | 16 | 92% |
| suri-stone-reader | 192 | 16 | 92% |
| dax-canyon-lookout | 195 | 17 | 91% |

Loss is similar across the board, but the *visible* artifact severity
varies based on what details existed in the source. NPCs whose outlines
are 1px wide are more likely to look broken because nearest-neighbor
sampling drops any single pixel that sits on an unsampled column.

**This is not in the GREEN/YELLOW scope to fix.** Three options exist
for when the user is back, ranked easiest to hardest:

1. **Pre-bake** all 18 source PNGs to 32x40 (or 64x80) once with a quality
   pixel-art downscaler offline, commit the result, skip the runtime
   `fitSpriteToBox` for them. One-shot art pass.
2. **Bilinear downsample** in `fitSpriteToBox` (set `imageSmoothingEnabled = true`)
   for source ratios > 4x, accept slight blur in trade for retained shape.
3. **Custom pixel-art downscale** (e.g., box-filter + threshold) in JS to
   keep silhouette while preserving sub-pixel features.

---

## Per-NPC raw audit

```
NAME                                 SIZE       BBOX   OPQ%  FILL%  DARK%  STATUS
------------------------------------------------------------------------------------------
bronn-road-smith                  216x374    216x366  71.1  72.6  42.6  CLEAN
cadrin-lantern-keeper             267x395    267x387  57.2  58.4  47.0  CLEAN
dax-canyon-lookout                195x387    191x379  66.7  69.5  40.1  CLEAN
eamon-wreck-diver                 267x384    267x376  58.5  59.8  54.7  CLEAN
fenn-moon-ferrier                 248x469    232x453  45.4  50.2  41.1  CLEAN
halden-starherd                   259x464    248x448  50.4  54.5  24.7  CLEAN
ila-herbalist                     216x377    212x369  63.7  66.3  40.9  CLEAN
kael-burnt-guide                  216x373    212x365  62.3  64.9  72.2  CLEAN
luma-shell-courier                302x434    294x418  39.6  42.2  25.6  SUSPICIOUS
mira-tide-medic                   194x384    190x376  68.3  71.3  17.3  CLEAN
neve-root-singer                  307x458    299x442  38.5  41.0  38.8  SUSPICIOUS
nyra-wayfinder                    256x377    250x369  61.0  63.8  42.0  CLEAN
orra-watch-captain                216x378    216x370  64.3  65.7  55.2  CLEAN
qira-salt-glasswright             199x456    183x440  51.4  57.9  25.6  CLEAN
suri-stone-reader                 192x380    188x372  76.8  80.1  26.4  CLEAN
tamas-cinder-runner               244x457    228x441  39.9  44.2  43.8  SUSPICIOUS
tovin-tide-cartographer           278x454    270x438  49.4  52.7  40.7  CLEAN
veya-salt-scribe                  216x377    216x369  57.7  59.0  20.5  CLEAN
```

**OPQ%** = opaque pixels / total canvas pixels.
**FILL%** = opaque pixels / bbox area.
**DARK%** = pixels with R/G/B all < 60 / opaque pixels.

---

## Recommendation for YELLOW-13

The user's instructions for YELLOW-13 said: "for each NPC flagged as
damaged in audit #4, regenerate or fix the sprite". Since the audit
shows **0 damaged** (only 3 suspicious, all attributable to pose /
silhouette spread, not pixel destruction), **no sprite-regeneration
work is performed in this autonomous batch.**

The TAMAS visible-damage symptom needs the runtime downscale fix
(option 1, 2, or 3 above) which is a design judgment call about pixel-art
quality vs. pipeline complexity -- I left this for when the user returns.
