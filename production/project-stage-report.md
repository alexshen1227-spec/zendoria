# Zendoria — Project Stage Report

**Generated**: 2026-04-26
**Branch**: `main`
**Review Mode**: Lean (`production/review-mode.txt`)
**Last commit**: `2b0ef66` — "Open-world expansion: lore stones, shrines, crystals, livelier spawns"

---

## TL;DR

**Stage: Production (mid).** Zendoria is well past prototype. There is a
playable, multi-realm, multi-system game with a polished opening slice, a
boss fight, a skill tree, a save / checkpoint system, multiple enemy types,
NPC dialog, an admin/debug panel, and an active iteration cadence visible in
the recent git history. The codebase is intentionally flat (no `src/`
subdivision), uses no engine, and has no formal docs structure — that is by
design for a 13-year-old solo developer in Lean review mode.

The studio agent system is now configured to that reality: stack pinned in
`CLAUDE.md`, routing tables in `technical-preferences.md` point to general
programmer specialists rather than engine-specific ones, and path-scoped
rules either target `js/**` or are explicitly disabled.

---

## 1. Stack (now registered)

| Layer | Choice |
|-------|--------|
| Engine | None — HTML5 Canvas 2D, vanilla JavaScript |
| Language | JavaScript (ES2022+, native ES modules) |
| Rendering | Canvas 2D context, pixel-perfect, native upscaled via CSS |
| Storage | `localStorage` (`zendoria-save-v1`, `zendoria-checkpoints-v1`, `zendoria-settings-v1`) |
| Audio | Web Audio API + `HTMLAudioElement` |
| Build | None — direct file serve via `launch.bat` opening `index.html` |
| Asset pipeline | Manual — drop into `assets/`, register in `js/assets.js`, bump `?v=` cache-buster |
| Version control | Git on `main` |

Reference: `docs/engine-reference/web/VERSION.md`

---

## 2. Code surface

`js/` contains **20 modules**, flat (no subdirectories):

| Module | Purpose |
|--------|---------|
| `main.js` | Entry point. Loads assets, bootstraps `Game`, exposes `window.__zendoriaGame` for debug. |
| `game.js` | Orchestrator. Owns the loop, title menu, pause menu, dialog, death flow, checkpoint UI, admin panel, fullscreen map, etc. |
| `constants.js` | `NATIVE_WIDTH`, `NATIVE_HEIGHT`, `SCALE`, `TILE`, etc. |
| `input.js` | Keyboard + mouse. Exposes `wasLeftClicked()`, `isLeftHeld()`, etc. |
| `assets.js` | Async asset loader. Edge-matte cleanup helper for sprites lifted from concept art. |
| `camera.js` | World-space → screen-space. |
| `world.js` | Procedural terrain, prop placement, prop colliders, dynamic entity colliders, multiple realms (Driftmere Isle, Index desert). |
| `player.js` | Player controller, combat, dash (Driftstep), level-up + XP, skill tree definitions and effects. |
| `enemy.js` | Enemy state machines. Multiple kinds (`blightworm`, `sunscarab`, `dune_warden`, archer / goliath / rusher per spritesheet inventory). |
| `npc.js` | Elara, Boatman, AmbientNpc. |
| `boat.js` | Rowboat traversal. |
| `tombstone.js` | Checkpoint stone (press `E` to save). |
| `treasureChest.js` | Loot. |
| `portal.js` | Realm transitions (Driftmere ↔ Index). |
| `pillar.js` | Destructible biome pillars (per commit `3efc0fa`). |
| `exploration.js` | Lore stones, buff shrines, crystal clusters (per commit `2b0ef66`). |
| `aetherFont.js` | Aether Font interactable. |
| `mnemoforge.js` | Mnemoforge interactable. |
| `pixelText.js` | Bitmap font text rendering for HUD. |
| `sprite.js` | Sprite-sheet helper. |

User-stated LOC: ~14k.

**Asset surface** (sampled from `git status`): well over 100 sprite files,
multiple enemy strips (archer, goliath, rusher, blightworm, sunscarab, dune
warden), audio (title voice, battle loop), title menu state images,
environment props, plus untracked `AI_Ready_Assets/`.

---

## 3. What's working

- Polished opening slice (Driftmere Isle): campfire, Elara, signpost, quest
  beacon, first-fight Blightworm, eastward causeway, eastern island with nest
  spawns, decorated foliage, custom HUD with bitmap font, minimap +
  fullscreen world map.
- Realm system: portal between Driftmere and Index (desert), with realm-aware
  HUD / minimap / save / checkpoint / objective state.
- Combat: Shardfang dagger with directional slash FX, melee hitbox,
  knockback, hit-stun, death frames; bound to Space / J / Left Click; combo
  system added recently (`b84727b`).
- Persistence: rolling 6-checkpoint ring buffer with timestamp + label,
  full snapshot restore. Resume from death via in-game checkpoint picker.
- Boss fights: Sand Worm (per commit `3efc0fa`).
- Progression: skill tree (`K` to open) with redesigned columns, XP curve,
  level-up rewards (per commit `4a8ea3a`).
- Active dev tooling: `launch.bat` no-cache server hint, admin panel
  (` ` ` toggle) with grants for max level, skill points, relic, map,
  boat, sandworm-defeat, full heal, kill-all, teleports, and
  GRANT-EVERYTHING.
- Audio: gesture-unlock for browser autoplay, title voice that plays once
  per page load, looping in-game music with fade in/out.
- UI shell: title menu, settings (sound + hints), pause menu (resume / sound
  / hints / controls / return-to-title), controls reference, dialog overlay,
  death screen with quit-or-reload toggle.
- Iteration discipline: every code change bumps the `?v=` import suffix to
  beat browser cache.
- `AI_CONTEXT_ZENDORIA.md.txt` is an excellent solo-dev artifact — it
  explains the world, the conventions, the known glitches, the recent passes,
  and queues a TODO list for the next AI session.

## 4. What is intentionally absent

These are not gaps to fix today — they are conscious omissions for Lean mode:

- No `/src/` reorganization. Code is flat in `js/`.
- No formal GDDs in `design/gdd/`. The living spec is `AI_CONTEXT_ZENDORIA.md.txt`.
- No formal ADRs in `docs/architecture/`.
- No tests in `tests/` (user explicitly deferred).
- No sprint plans in `production/sprints/`.
- No prototypes in `prototypes/` (the entire build is one large evolving prototype).
- No localization, no gamepad / touch input, no accessibility passes.
- No build tool (Vite, esbuild, etc.) — direct serve only.

## 5. What's actually missing (or rough)

- **Engine reference doc** — created today at `docs/engine-reference/web/VERSION.md`.
- **Player up/down sprite mismatch** — known in `AI_CONTEXT`. Side-view art
  is mirrored for east/west; up/down reuses the body and rotates only the
  slash FX. Surfacing here so it doesn't get lost.
- **Index objective placeholder** — the desert realm's objective text is
  literally `EXPLORE DESERT`. Flagged in `AI_CONTEXT` as awaiting a real
  quest hook.
- **Tombstone animation strip** — current runtime asset is a single still;
  the source is a strip that needs frame extraction + alpha cleanup. Flagged
  in `AI_CONTEXT`.
- **`serve.py`** — currently shows as deleted in `git status`. The launcher
  still works (it just opens `index.html`), but the no-cache server flow
  referenced in `AI_CONTEXT` is gone. Double-check whether that was
  intentional or whether it should come back.

## 6. Studio configuration changes made today

- `CLAUDE.md` — Technology Stack section now describes the actual vanilla-JS
  / Canvas / localStorage stack. Engine Version Reference import points to
  `docs/engine-reference/web/VERSION.md`.
- `.claude/docs/technical-preferences.md` — fully populated with Zendoria's
  naming conventions, performance budgets, forbidden patterns, and a
  routing table that maps `js/*.js` files to general programmer specialists
  (`gameplay-programmer`, `engine-programmer`, `ai-programmer`,
  `ui-programmer`, `technical-artist`, `lead-programmer`). Engine-specific
  agents (godot-*, unity-*, ue-*) are explicitly NOT applicable.
- `.claude/rules/gameplay-code.md` — retargeted from `src/gameplay/**` to
  `js/**`, examples rewritten in vanilla JS, GDScript references removed.
- `.claude/rules/engine-code.md`, `ui-code.md`, `ai-code.md`,
  `network-code.md`, `shader-code.md`, `design-docs.md`, `narrative.md`
  — disabled (`paths: []`) with a note explaining why and how to
  re-enable. The rule bodies are preserved.
- `.claude/rules/test-standards.md`, `data-files.md`, `prototype-code.md`
  — left unchanged. Their paths (`tests/**`, `assets/data/**`,
  `prototypes/**`) don't currently exist in the project, so the rules are
  naturally inactive. They will activate automatically if those directories
  are ever populated.
- `docs/engine-reference/web/VERSION.md` — created.

## 7. Recommended next moves (only if you want them)

These are options, not a roadmap:

| Option | When to pick it |
|--------|-----------------|
| Replace placeholder `EXPLORE DESERT` objective with a real Index quest hook | When you next feel like authoring desert content |
| Extract tombstone animation strip frames into `tombstone_idle_strip.png` | Visual polish pass |
| Top-down player sprite frames (north / south facing) | Combat-feel pass |
| Convert eastern-island enemy nests from infinite spawners to destroyable progression objectives | Adding meta-progression |
| `/quick-design [system]` for any new system you build | When you want a 1-page design capture without a full GDD |
| `/architecture-decision [topic]` | When you make a binding tech choice you want to remember (e.g., "no build tool", "no third-party libs") |
| `/test-setup` + first unit tests | Once iteration speed becomes the bottleneck instead of design exploration |

## 8. Notes for future-AI sessions

- Read `AI_CONTEXT_ZENDORIA.md.txt` first — it is the project's true memory.
- The `?v=YYYYMMDD-tag` suffix on every JS import is the cache-busting
  convention. When you change a file, bump it in the importing modules
  (top-level: `js/main.js` and `index.html`).
- `assets/reference/provided_pixel_art/` and `provided_audio/` hold
  user-supplied source material; cleaned runtime versions are produced
  from those references and live under `assets/sprites/` and `assets/audio/`.
- `ReadMeForContext1 (DO NOT UPDATE THIS).txt` and the `2` variant are
  large user-supplied lore dumps — do not modify them.
- `launch.bat` is the dev-loop entry. The previous `serve.py` no-cache
  server is currently deleted from the working tree; verify before
  removing references.
- Do not invent new engine-specialist agents. The routing table in
  `technical-preferences.md` is canonical.
