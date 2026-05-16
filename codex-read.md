# codex-read.md — Final Art Generation Handoff for Zendoria

> **Audience:** Codex / ChatGPT image-generation pipeline (or any human pixel-art
> contributor). Everything else in the game is already implemented, wired, and
> playable. The placeholders fall back to a magenta-and-black checker pattern
> so you can see exactly where each missing sprite lives at runtime.
>
> **Date:** 2026-05-15
> **Build cache-bust tag:** `20260515-a11y-tidereach`

---

## 1. Project context

Zendoria is a vanilla-JavaScript HTML5 Canvas 2D pixel-art adventure RPG. No
build step, no bundler, no commercial engine. The native resolution is
**256 × 224 px** upscaled via CSS `image-rendering: pixelated`. All sprites
must be **opaque pixel art on a fully-transparent PNG background** (no matte,
no anti-aliasing).

Existing reference art lives under `assets/reference/provided_pixel_art/` and
the cleaned runtime versions under `assets/sprites/*/`. Match the lighting,
silhouette weight, and palette of the existing strips — top-down 3⁄4 view,
crisp 1-px outlines where the existing art uses them, and avoid sub-pixel
gradients.

---

## 2. Sprites still required

The game **already runs** with placeholders for every entry below. The
checker pattern you'll see in-game is the missing-sprite signal — replace each
file at the listed path and bump the cache-bust tag (see §5) to ship.

Priority is roughly top-to-bottom; everything is technically optional because
the game never crashes on a missing sprite (`js/assets.js` falls back to
`makePlaceholderImage`).

### 2.1 `assets/sprites/enemies/coral_crawler_sheet.png` — Coral Crawler

- **Frame size:** 32 × 28 px
- **Sheet layout:** 3 rows × 2 columns. Total sheet = **64 × 84 px**.
  - Row 0 (y 0–27): `walk` — 2 frames cycling, low scuttling profile
  - Row 1 (y 28–55): `hurt` — 2 frames, brief recoil
  - Row 2 (y 56–83): `death` — 2 frames, body cracks and crumbles into spurs
- **Concept:** Sea-coral creature with spiny carapace and clawed forelimbs.
  Color palette built around coral pink `#ff8fb8`, deep magenta `#a0335f`,
  and accent cyan `#7fe5ff`. The crawler should read as "reef organism that
  walked out of the lagoon." Compact silhouette, wider than tall.
- **Wired in:** `js/enemy.js` `ENEMY_CONFIGS.coralCrawler` (already lists
  `frameW: 32, frameH: 28` and `animations.walk = [frame(0,0), frame(1,0)]`).
- **In-game placement:** Tidereach lagoon (southern frontier). Fixed
  introduction pair at world tiles `(115, 104)` and `(122, 110)`, plus
  spawn nodes that produce 3 alive max around `(110, 100)` and `(124, 108)`.
- **Existing palette anchors:** see `assets/sprites/biomes/tropics_lily_cluster.png`
  for the pink/teal hue the lagoon uses.

### 2.2 `assets/sprites/enemies/deepveil_specter_sheet.png` — Deepveil Specter

- **Frame size:** 28 × 36 px
- **Sheet layout:** 3 rows × 2 columns. Total sheet = **56 × 108 px**.
  - Row 0 (y 0–35): `drift` — 2 frames, slow rising/falling pose
  - Row 1 (y 36–71): `hurt` — 2 frames, jolt and bleed
  - Row 2 (y 72–107): `death` — 2 frames, fade into mist trail
- **Concept:** Translucent drowned wraith. Trailing hair/cloth that fades to
  alpha 0 at the lower edges. Cool palette: indigo `#3a2a6a`, ghost blue
  `#a0c8ff`, and a single bright lantern eye `#dff6ff`. They drift more than
  walk — the 2 frames are about height bob, not legs.
- **Wired in:** `js/enemy.js` `ENEMY_CONFIGS.deepveilSpecter`.
- **In-game placement:** Tidereach lagoon. Fixed introduction at world tile
  `(122, 110)`; spawn nodes at `(118, 112)` and `(132, 102)`.

### 2.3 *(Optional)* `assets/sprites/player/driftwalker_walk_strip.png` — true 4-directional player

The existing player sprite is a side-view walk strip. The current
compromise mirrors the same body for up/down movement (see the "Known
Glitches" section of `AI_CONTEXT_ZENDORIA.md.txt`). If you can deliver a
proper top-down 4-direction sheet:

- **Frame size:** 32 × 40 px (must match `PLAYER_FRAME_W / PLAYER_FRAME_H`
  in `js/constants.js`).
- **Sheet layout:** 1 row × at least 5 columns. Columns: idle (0),
  walk-1 (1), walk-2 (2), walk-3 (3), walk-4 (4), attack (5+).
- **Multi-direction variant:** if you can author 4 rows (down/left/right/up,
  in `DIR` enum order from `js/constants.js` — DOWN=0, LEFT=1, RIGHT=2,
  UP=3), update `js/player.js` `_currentFrame()` to return `{col, row}`
  instead of just `col`. That's the only code path that needs to change;
  the SpriteSheet helper already supports row-based sampling.

### 2.4 *(Optional)* `assets/sprites/environment/tombstone_idle_strip.png` — multi-frame tombstone

Already loaded as a strip in `js/assets.js`, currently split into 2 frames
by the runtime (sheet width / 2). If you author a richer idle animation
(soft glow flicker, glyph swirl), preserve the **even-column-split** shape
the loader expects.

---

## 3. NPC portraits — already generated, no action required

All 18 generated NPC sprites in `assets/sprites/npcs/generated/*.png` already
exist and are loaded with graceful fallback. The two **new** Tidereach
questgivers (`osric-pearl-keeper`, `sable-coral-warden`) intentionally reuse
existing recolored variant bases (`lantern-keeper` and `glow-warden`
respectively) so they appear in-game today without new art. If you want them
to have unique portraits later, drop:

- `assets/sprites/npcs/generated/osric-pearl-keeper.png` — pearl-fisher,
  lantern at belt, salt-bleached coat (cool palette).
- `assets/sprites/npcs/generated/sable-coral-warden.png` — reef diver, coral
  spear, kelp-trimmed cloak (warm coral/orange palette).

Then add the two filenames to the `GENERATED_NPC_FILES` map at the top of
`js/assets.js`. The runtime already handles missing entries via the
`prepareGeneratedNpcSprite` fallback.

---

## 4. Audio — already wired, no action required

All music and SFX listed in `assets.js` are present on disk:

- `assets/audio/music/View_from_the_World_Map.mp3` — title theme
- `assets/audio/music/driftmere-battle-loop.mp3` — Driftmere gameplay loop
- `assets/audio/music/Desert sound track.mp3` — Frontier gameplay loop
- `assets/audio/music/Sword_Slashing.mp3` — combat SFX (pooled for overlap)
- `assets/audio/music/Death screen sound.mp3` — death stinger
- `assets/audio/voice/title-intro-cornelius.mp3` — one-shot title voice
- `assets/audio/voice/text-sound.mp3` — typewriter

If you can supply a **Tidereach lagoon ambient loop** (~30–60s, lush watery
pads with pearl-bell harmonics, no strong percussion), drop it at
`assets/audio/music/Tidereach_lagoon_loop.mp3` and add it to `js/assets.js`
under `assets.tidereachMusicSrc`. The biome detection in
`World.getBiomeKeyAt` already returns a `'steppe'` value at the lagoon
coordinates; we can wire region-aware music swap once the asset exists.

---

## 5. Drop-in instructions (no code knowledge required)

1. Generate / save each PNG at the **exact path and dimensions** above.
2. Open `js/main.js`. The first two lines read:

   ```js
   import { loadGameAssets } from './assets.js?v=20260515-a11y-tidereach';
   import { Game } from './game.js?v=20260515-a11y-tidereach';
   ```

   Bump the date suffix (e.g. `?v=20260616-art-drop`) so browsers reload
   the modules. Do the same for `index.html`'s `<script type="module">` tag
   and `<link rel="stylesheet">`. Pick a fresh, identical tag for all three.
3. Reload the local server (`launch.bat`). The magenta-checker placeholders
   are now your real sprites. If a sprite still shows the checker pattern,
   the path is wrong — open the browser DevTools console and search for
   `Zendoria: enemy sprite missing` to see the path the loader tried.
4. No rebuild step. No npm install. No bundler. Files served as-is.

---

## 6. Verification checklist for the art handoff

After dropping each sprite in:

- [ ] `coral_crawler_sheet.png` — walk the player south from Dustwake Camp
      into the frontier south wildlands (around world tile `(115, 104)`).
      A coral crawler should be visible and animate with 2-frame walk.
- [ ] `deepveil_specter_sheet.png` — same area, slightly southeast at
      tile `(122, 110)`. A specter should drift in place.
- [ ] No console errors. The `Zendoria: enemy sprite missing for …` warning
      should be gone for both new enemies.
- [ ] Open the pause menu (`Esc`) and confirm the three accessibility
      toggles work: Reduced Motion, Large Text, Colorblind. None of these
      require art — they're purely behavioral.

---

## 7. Files modified in this session (for the curious)

- `js/game.js` — encoding-mojibake fix at line ~2595, accessibility settings
  plumbing (`_loadSettings`, `_applySaveData`, `_snapshotGame`,
  `_togglePauseSetting`, `_pauseValueText`, `_settingTextValue`), reduced-
  motion damping in shake/flash, colorblind palette swaps in damage numbers
  and low-HP vignette, Large-Text 2× scale on the toast banner.
- `js/enemy.js` — added `coralCrawler` and `deepveilSpecter` to `ENEMY_CONFIGS`.
- `js/world.js` — Tidereach lagoon: fixed enemy intros, spawn nodes, 3 new
  lore stones, 2 new questgivers (`osric-pearl-keeper`, `sable-coral-warden`),
  `tidereach` landmark + map marker.
- `js/assets.js` — placeholder safety net for missing enemy sprites
  (`makePlaceholderImage`), enemy load now catches and falls back gracefully.
- `js/main.js` — cache-bust tag bumped to `20260515-a11y-tidereach`.
- `index.html` — 3 new pause-menu accessibility rows, cache-bust tags bumped.

That's it. The game ships now; everything in §2 is upgrade-in-place art.
