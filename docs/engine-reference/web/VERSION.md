# Web Platform — Version Reference

| Field | Value |
|-------|-------|
| **Stack** | HTML5 Canvas 2D + vanilla JavaScript + localStorage |
| **Engine** | None (no commercial game engine) |
| **Language** | JavaScript (ES2022+, native ES modules) |
| **Project Pinned** | 2026-04-26 |
| **LLM Knowledge Cutoff** | January 2026 |
| **Risk Level** | LOW — no engine SDK to track; the platform is the open web |

## Platform Targets

- **Browsers**: Latest stable Chromium (Chrome, Edge), Firefox, Safari on desktop.
- **Form factor**: Desktop only for now. No mobile/touch support has been implemented.
- **Mode of delivery**: Static files served from `index.html` + `js/` + `assets/`. No bundler, no transpiler, no node build step.

## Browser APIs in use

| API | Where it lives |
|-----|----------------|
| Canvas 2D Context (`canvas.getContext('2d')`) | `js/game.js`, all rendering |
| `requestAnimationFrame` | `js/game.js` (`game.run()` loop) |
| ES Modules (`import` / `export`) | All files in `js/` |
| `localStorage` | `js/game.js` (saves, checkpoints, settings) — keys: `zendoria-save-v1`, `zendoria-checkpoints-v1`, `zendoria-settings-v1` |
| Web Audio API (`AudioContext`) | Title intro voice + battle music gesture-unlock in `js/game.js` |
| `HTMLAudioElement` | Music + SFX playback |
| `Image` | Sprite/texture loading in `js/assets.js` |
| `URLSearchParams` | `?resetSave=1` debug param in `js/main.js` |
| Pointer + Keyboard events | `js/input.js` |

## What this means for agents

- Treat the **browser** as the runtime and `index.html` as the entry point — there is no `*.tscn`, `*.prefab`, or `*.umap` equivalent. Everything is JS classes + Canvas drawing + DOM overlays.
- `Canvas 2D` is the rendering target. There are no GPU shaders. Visual effects are achieved with sprite swaps, alpha compositing, `globalCompositeOperation`, gradients, and offscreen canvases.
- `localStorage` is synchronous and limited to ~5 MB per origin. Don't store binary blobs there. Save data is JSON.
- There is no asset bundler. Adding a new sprite means dropping the file into `assets/` and importing it in `js/assets.js`.
- Cache-busting is manual: every import in `js/main.js` and downstream files uses `?v=YYYYMMDD-tag`. When code changes meaningfully, bump that tag.
- All code currently runs on the main thread. There are no Web Workers, no `OffscreenCanvas`, no SharedArrayBuffer.

## Knowledge gaps to flag

The vanilla web platform is well within the LLM's training data — no special knowledge gap exists. The only project-specific knowledge any agent needs is in `js/` itself.

## How to refresh this reference

If the project later adopts a build tool (Vite, esbuild), a framework (React, Svelte, Phaser), or new browser APIs (`OffscreenCanvas`, WebGPU, Web Workers), update this file by hand — there is no `/setup-engine refresh` path for vanilla web.
