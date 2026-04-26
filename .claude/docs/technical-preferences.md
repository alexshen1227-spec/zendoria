# Technical Preferences

<!-- Populated for the Zendoria project: HTML5 Canvas + vanilla JS + localStorage. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: HTML5 Canvas 2D (no commercial game engine)
- **Language**: JavaScript (ES2022+, native ES modules)
- **Rendering**: Canvas 2D context, pixel-perfect (`imageSmoothingEnabled = false`); native resolution upscaled via CSS
- **Physics**: Custom AABB collision in `js/world.js` and per-entity colliders; no third-party physics engine

## Input & Platform

- **Target Platforms**: Web (desktop browser)
- **Input Methods**: Keyboard + Mouse
- **Primary Input**: Keyboard (WASD / Arrows for move, Space / J / Left Click for attack, Shift / F for dash, E for interact, M for map, K for skill tree, Esc for pause)
- **Gamepad Support**: None
- **Touch Support**: None
- **Platform Notes**: Audio playback requires a user gesture (`Game._setupGestureUnlock`). Cache-busting on imports is manual via `?v=` query strings on every `import` in `js/`.

## Naming Conventions

- **Classes**: PascalCase (e.g., `Game`, `Player`, `Tombstone`, `LoreStone`) — declared with `export class` in their own file
- **Variables / functions**: camelCase (e.g., `moveSpeed`, `wasLeftClicked`, `_drawEntitiesSorted`)
- **Private/internal members**: `_camelCase` prefix (e.g., `_resetRunUnlocks`, `_drawWorldMap`)
- **Constants**: UPPER_SNAKE_CASE at module top level (e.g., `NATIVE_WIDTH`, `TILE`, `MAX_CHECKPOINTS`, `DEATH_FADE_DURATION`)
- **Files**: camelCase matching primary export when possible (e.g., `treasureChest.js`, `aetherFont.js`); single-class modules name the file after the class lowercase-first
- **Asset paths**: lowercase-with-underscores under `assets/` (e.g., `driftwalker_walk_strip.png`, `dune_warden_strip.png`)
- **Storage keys**: `zendoria-<system>-v<N>` (e.g., `zendoria-save-v1`, `zendoria-checkpoints-v1`, `zendoria-settings-v1`) — bump `vN` on schema changes

## Performance Budgets

- **Target Framerate**: 60 fps in modern desktop browser
- **Frame Budget**: 16.6 ms per frame total
- **Draw Calls**: N/A in Canvas 2D — instead, watch sprite blits per frame. Pre-render static prop layers to an offscreen canvas if any single frame draws more than ~500 sprites (per `AI_CONTEXT_ZENDORIA` improvement note).
- **Memory Ceiling**: localStorage budget per origin is ~5 MB; current saves are JSON snapshots well under 100 KB each, with a max of 6 checkpoints retained.

## Testing

- **Framework**: None configured (project is in pre-formal-test phase per Lean review mode)
- **Minimum Coverage**: N/A
- **Required Tests**: When tests are added, prioritize: combat damage formulas, save/load round-trip, level-up XP curve, AI state transitions, realm portal persistence
- **Manual verification**: For UI / visual / feel changes, the loop is `launch.bat` → browser eyeball test. Any agent that touches rendering or feel must say so explicitly rather than claim "verified."

## Forbidden Patterns

- Hardcoded asset paths inside gameplay logic — load all assets through `js/assets.js`
- Direct manipulation of game state from DOM event handlers — route through `js/input.js` or the `Game` class
- Synchronous `XMLHttpRequest` or `alert()` / `prompt()` / `confirm()` blocking calls
- New `localStorage` keys without the `zendoria-<system>-v<N>` versioning convention

## Allowed Libraries / Addons

- None. The project is intentionally zero-dependency. Adding any third-party library (CDN or otherwise) requires user approval and an ADR.

## Architecture Decisions Log

- No formal ADRs yet — Lean review mode. Significant implicit decisions are recorded in `AI_CONTEXT_ZENDORIA.md.txt`. Promote to ADRs on demand via `/architecture-decision`.

## Engine Specialists

<!-- This project does NOT use Godot, Unity, or Unreal. The studio's engine specialists -->
<!-- (godot-*, unity-*, ue-*) are NOT applicable. Route to general programmer specialists. -->

- **Primary**: `lead-programmer` (cross-cutting code review, architecture in vanilla JS)
- **Language/Code Specialist**: None — JavaScript is handled by the general programmer agents below
- **Shader Specialist**: None — Canvas 2D, no shaders. `technical-artist` handles canvas-level visual effects (gradients, composite ops, offscreen pre-render)
- **UI Specialist**: `ui-programmer` for HUD / menus / dialog overlays / DOM panels
- **Additional Specialists**: `gameplay-programmer` (player, combat, world systems), `ai-programmer` (enemy AI in `js/enemy.js`), `engine-programmer` (core systems like `Game`, `Camera`, `World` framework), `audio-director` / `sound-designer` for the audio system
- **Routing Notes**: Invoke `lead-programmer` for any change spanning >2 files in `js/`. Invoke `gameplay-programmer` for player / combat / world tweaks. Invoke `ai-programmer` for enemy behavior changes. Invoke `ui-programmer` for HUD / menu / dialog changes (touches `js/`, `index.html`, and `css/`). Invoke `technical-artist` for Canvas 2D visual effects and offscreen render optimization. Do not spawn engine-specific specialists (godot-*, unity-*, ue-*) — they are not applicable to this stack.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (`.js` files in `js/`) | `gameplay-programmer` (default) — escalate to `lead-programmer` for cross-system changes |
| Enemy / AI code (`js/enemy.js`, AI state machines) | `ai-programmer` |
| Player / combat code (`js/player.js`) | `gameplay-programmer` |
| Core framework (`js/game.js`, `js/world.js`, `js/camera.js`, `js/input.js`, `js/assets.js`, `js/main.js`, `js/constants.js`) | `engine-programmer` |
| HUD / menu / dialog (`js/pixelText.js`, `js/aetherFont.js`, in-game UI inside `js/game.js`, `index.html`, `css/style.css`) | `ui-programmer` |
| Canvas 2D visual effects (slash FX, particle-like loops, vignettes, post-process via composite ops) | `technical-artist` |
| Asset loading / sprite sheet wiring (`js/assets.js`) | `engine-programmer` |
| HTML / CSS (`index.html`, `css/`) | `ui-programmer` |
| Save / load / settings persistence (localStorage code) | `engine-programmer` |
| General architecture review | `lead-programmer` |
| Shader files | N/A — project has no shaders |
| Scene / prefab / level files | N/A — content is procedural in `js/world.js` and authored data in `js/exploration.js`, `js/npc.js`, etc. |
