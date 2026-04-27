# Round 2 fix report -- 2026-04-27 morning

**Goal:** address the highest-priority playtest findings without redesigning
anything that's working. Twelve items in scope (5 P0, 7 P1). All
implemented except where instructions explicitly required documentation
only.

**Final HEAD on main:** `630f01e` -- "chore: bump cache-bust tags for
Round 2 fixes"

**Working tree:** clean (only `.claude/worktrees/` submodule noise).

**Backup folder still untouched:** `C:\Dev\Zendoria-backup-2026-04-26-pre-merge`.

---

## Commit hashes (12 fixes + 1 cache-bust)

| Hash | Subject |
|---|---|
| `22204d9` | fix: tovin reward banner apostrophe + dialogue describes ward not map (P1-2 + P1-7) |
| `a2225ea` | fix: spawn player further south so Elara doesn't block initial walk (P0-2) |
| `6fe2146` | fix: visible PAUSED overlay when settings menu open (P0-1) |
| `118c3fa` | fix: boatman dialogue panel 3 white background pixels (P0-3) |
| `f06804c` | fix: boatman dialogue uses pixel uppercase font like other NPCs (P1-1) |
| `f91916f` | fix: portal interaction prompt also floats above the gate (P0-4) |
| `b603013` | fix: sandworm gating message visibility (importantToast slot) (P0-5) |
| `4f8a420` | fix: settings menu Enter only acts on actionable rows (P1-3) |
| `91b1785` | feat: per-tap movement impulse for game-feel (P1-4) |
| `7e7507d` | investigate: NPC reachability audit (no code changes applied) (P1-5) |
| `5770ae6` | fix: ESC MENU reminder auto-hides after first pause (P1-6) |
| `630f01e` | chore: bump cache-bust tags for Round 2 fixes |

Two of the items (P1-2 + P1-7) were combined into one commit because both
edited adjacent strings in `world.js` for the same NPC.

---

## What I skipped from YELLOW-LIGHT and why

I implemented all P0-4 (portal prompt) and P0-5 (sandworm message) and
P1-7 (Tovin dialogue) -- nothing in YELLOW-LIGHT was blocked.

**P1-1 nuance:** the boatman text was baked into the artwork PNGs, so I
couldn't just "change the font" -- I had to switch the dialog from
image-based mode to runtime-rendered pages mode. I transcribed the
existing text from the original PNG artwork verbatim (not new dialogue,
preserving exact content) so this isn't writing new dialogue. Three
panels of text: "EY THERE...", "TELL YOU WHAT...", "DON'T ASK WHERE...".

The original `boatmanDialog1/2/3` images are still loaded by
`loadGameAssets()` and post-processed by `removeEdgeMatte` -- they're
just not displayed anymore. Removing the load entirely would be cleaner
but would require touching `assets.js` more deeply, and the loaded
images are tiny memory-wise. Left as-is.

---

## NPC reachability investigation finding (P1-5)

`production/npc-spawn-investigation-2026-04-26.md` has the full report.

**Headline:** all 18 NPCs DO spawn correctly. The dev-menu cycles only
the *current realm's* NPCs (8 in Driftmere, 10 in Frontier) because
`this.npcs` is rebuilt per realm. Cross-realm dev teleport is a feature
request, not a bug. Two implementation paths sketched in the report
for tomorrow.

---

## Smoke test results (in-browser, against `http://127.0.0.1:8765/?dev=1`)

All eval'd in a Chromium preview tab. No console errors or warnings.

| Smoke | Expected | Result |
|---|---|---|
| Game boots | title screen + no errors | **PASS** |
| `cssHref` cache-bust | `?v=20260426-overlay-fix` | PASS |
| `mainSrc` cache-bust | `?v=20260427-round2` | PASS |
| `?dev=1` exposes `__zendoriaGame` | yes | PASS |
| No `?dev=1` hides `__zendoriaGame` | yes (Round 1 fix still works) | PASS |
| Player spawn position | `(384, 608)` 115 px from Elara at `(448, 512)` | **PASS** (P0-2) |
| `hasOpenedPauseMenu` initial | `false` | PASS (P1-6) |
| `hasSeenEnemy` initial | `false` | PASS (Round 1) |
| `importantToastTimer` initial | `0` | PASS (P0-5 wired) |
| `_drawPausedIndicator` exists | yes | PASS (P0-1) |
| `_drawPortalProximityBadge` exists | yes | PASS (P0-4) |
| Pause open `pauseDisplay` | `flex` | PASS |
| Pause open latches `hasOpenedPauseMenu` | `true` after first open | **PASS** (P1-6) |
| Pause close `pauseDisplay` | `none` | PASS (Round 1, no ghost) |
| Esc with `worldMapOpen` closes map, NOT pause | `worldMapOpen: false`, `paused: false` | PASS (Round 1) |
| Settings Enter on Sound row toggles | should NOT toggle | **PASS** (P1-3 -- `enterDidToggle: false`) |
| Settings ArrowLeft on Sound row toggles | should toggle | PASS (`arrowDidToggle: true`) |
| Boatman dialog uses pages mode | `kind: 'boatman', hasPages: true, hasImages: false, pageCount: 3` | **PASS** (P1-1) |
| Boatman dialog speaker | `'BOATMAN'` | PASS |
| Boatman dialog body uses uppercase | `"EY THERE. YOU LOOK LIKE YOU'VE..."` | PASS |
| Tovin reward toast | `"TOVIN'S ROUTE WARD SET"` (apostrophe + new word) | **PASS** (P1-2) |
| Tovin progressToast | `"TOVIN NEEDS ELARA'S MAP"` (apostrophe) | PASS |
| Tovin dialog mentions "into your bones" | preserved buff flavor | **PASS** (P1-7) |
| Portal prompt | `'E: ENTER AMBERWAKE GATE'` | PASS |
| Save snapshot includes new fields | `hasOpenedPauseMenu`, `hasSeenEnemy`, etc. | **PASS** |

**Net:** all targeted smoke checks pass. Game runs without errors. No
gameplay-driving smoke tests (e.g. walk to boatman pre-sandworm, see
the centered importantToast banner) were possible via eval, but the
plumbing for each is verified: timer ticks, render gates, state flags.

---

## Things to look at tomorrow

1. **Manual playtest of the importantToast (P0-5).** I tested the
   wiring (timer field, render code) but couldn't drive the player to
   the boatman + press E to trigger it. Quick eyeball check tomorrow:
   walk to boatman pre-sandworm, press E, confirm a big centered amber
   message appears for ~3.6s.

2. **Manual playtest of the per-tap impulse (P1-4).** Eval can't
   simulate true keydown timing precisely. Tomorrow: tap-and-release a
   movement key (W or D) and confirm the player makes a small visible
   step (~5 px). If it feels wrong, the constant `TAP_IMPULSE_PX` at
   `js/player.js:587` is the only knob.

3. **Manual playtest of the portal prompt floater (P0-4).** I confirmed
   `_drawPortalProximityBadge` is wired. Tomorrow: walk to the
   Amberwake Gate and confirm a small "E: ENTER" banner hovers above
   the portal AS WELL AS the existing bottom-of-screen prompt.

4. **NPC reachability (P1-5).** See
   `production/npc-spawn-investigation-2026-04-26.md`. Decide whether
   to add a cross-realm dev teleport button or just label the existing
   one as "current realm only".

5. **Carryover from Round 1 still open:**
   - Tamas burnt-foes counter unverified (per
     `quest-functionality-audit-2026-04-26.md`)
   - QIRA collider possibly blocks her own interact rect
   - Tropics props' visible matte (`tropicsVines`,
     `tropicsLilyCluster`, `tropicsRuins`) -- one-line patch sketched
     in `tropics-asset-audit-2026-04-26.md`

6. **Embedded `.claude/worktrees/` submodules in `be292d4`.** Per the
   merge report, those should be removed from tracking via
   `git rm --cached -r .claude/worktrees/`. Not blocking but worth a
   cleanup pass.

---

## Anything broken that needs Alex's eyes

Nothing observable in smoke testing. All 12 fixes landed without
syntax errors or test regressions. The cache-bust tags are bumped so
the changes load on next refresh.

The boatman dialog rewrite is the highest-risk single change because
it switched a content surface from images to runtime rendering. The
visual will look DIFFERENT from before (different layout, different
font, runtime portrait scaled from a 32x40 sprite frame instead of
the painted bust). If it feels too jarring, revert `f06804c` and the
old image-based dialog returns -- the PNGs are still loaded.

If anything else is off, `git revert <hash>` works on each commit
individually since none of them are interdependent.

GO ENJOY YOUR DAY, ALEX.
