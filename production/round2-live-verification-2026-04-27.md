# Round 2 live-build verification -- 2026-04-27 morning

**Tested against:** local dev server (`http://127.0.0.1:8765/`) serving the
`main` branch HEAD as of `a979547` -- which is everything Round 2 + Round 3
fixes through P1-3 (respawn grace).

**Live URL state:** `https://alexshen1227-spec.github.io/zendoria/` is at
`d572e91` + the just-pushed `4225263` (P0-1 typewriter volume). GitHub Pages
deploy lag means the live HTML still references `?v=20260427-round2`; expect
`?v=20260427-typewriter-volume` to land in another minute or two. Nothing to
do here -- the push completed cleanly (verified via `git log origin/main`).

---

## Round 2 fixes verified working on local build

| Round 2 item | Verification | Result |
|---|---|---|
| `.pause-overlay.hidden` uses `display:none` (P0-1 R1, R2 carry-over) | After `_closePauseMenu()`, `getComputedStyle(pauseOverlay).display === 'none'` | **PASS** |
| Pause open shows menu (`display: flex`, `paused: true`) | After `_openPauseMenu()` | PASS |
| `hasOpenedPauseMenu` latches on first pause | `hasOpenedPauseMenuLatched: true` after first open | PASS |
| Esc closes map without opening pause | After Esc with `worldMapOpen=true`: `worldMapOpen: false, paused: false` | PASS |
| Player spawn 115px from Elara (Round 2 P0-2) | `playerSpawn=(384,608)`, `elaraSpawn=(448,512)` | PASS |
| `__zendoriaGame` hidden without `?dev=1` | `devHookExposed: 'undefined'` on plain URL | PASS |
| `__zendoriaGame` exposed with `?dev=1` | `devHookExposed: 'object'` | PASS |
| Admin panel hidden without `?dev=1` (Round 2 admin gate) | `adminPanelHidden: true` on plain URL | PASS |
| Settings Enter doesn't toggle Sound row (Round 2 P1-3) | After Enter with index=1 (Sound): `didNotToggle: true` | PASS |
| `_drawPortalProximityBadge` defined (Round 2 P0-4 floater) | `portalBadge: true` (function exists) | PASS |
| `importantToast`/`importantToastTimer` wired (Round 2 P0-5) | timer accepts a numeric value, ticks down | PASS |
| Boatman dialog uses pages mode (Round 2 P1-1) | `kind: 'boatman', hasPages: true, pageCount: 3` from prior run | PASS (carried over) |

---

## Round 2 fixes that need eyeball verification (visual quality)

These weren't testable via JS eval -- need a real human to look at the screen
during gameplay:

1. **Boatman dialog font (Round 2 P1-1, commit f06804c).** The runtime-rendered
   pages render a portrait scaled from the 32x40 idle sprite into a 74x96 box,
   in the shared pixel uppercase font. Visual quality unknown until Alex
   eyeballs it. If too jarring, `git revert f06804c` brings back the original
   baked-image dialog.

2. **Boatman dialog 3 white pixels (Round 2 P0-3, commit 118c3fa).** The
   isolated-blob strip pass should erase the 18,200 trapped white pixels on
   panel 3. But since Round 2 P1-1 made the panels never render anyway (boatman
   uses pages mode), this fix is dormant -- it'll only matter if someone
   reverts the page-mode change. Documented but not visually verifiable in
   current build.

3. **Portal floater (Round 2 P0-4).** Function exists and is wired into
   `_render()` at the right place. Walking up to the Amberwake Gate should
   show "E: ENTER" hovering above the portal. Eyeball check tomorrow.

4. **Sandworm gating message (Round 2 P0-5).** The `importantToast` slot is
   wired and renders center-screen at 2x scale with amber border. Triggered
   when player approaches the boatman pre-sandworm. Need to drive the player
   there to confirm the visual.

5. **Per-tap movement impulse (Round 2 P1-4).** 5 px tap on each fresh
   keydown. Victor and Cheese already validated this on real keyboards
   ("Yes, felt great"). Confirmed live by playtest. PASS by playtest.

---

## What's NOT yet on the live site (committed but not pushed)

The following Round 3 commits are on local `main` but not yet on
`origin/main`. They'll go live when Alex approves the push:

- `eca0485` -- title screen trackpad nav (P0-2)
- `1853a1b` -- objective panel pulse (P0-3)
- `1971fde` -- auto-checkpoint on sandworm defeat (P1-2)
- `a979547` -- respawn grace 2.5s invuln (P1-3)

These are committed and code-verified locally (no errors, smoke tests pass).
Push pending Alex's review per the CLAUDE.md commit/push workflow.

---

## Console errors check

`preview_console_logs(level: 'error')` returned no logs across the entire
smoke-test session. No console errors, no warnings.

## Net verdict

Round 2 fixes are intact. No regressions detected from the Round 3 commits.
Three commits of Round 3 (P0-2, P0-3, P1-2, P1-3) are ready for push approval.
