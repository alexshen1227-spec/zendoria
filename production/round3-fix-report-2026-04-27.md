# Round 3 fix report -- 2026-04-27

**Goal:** address findings from the 3-friends playtest panel (Victor, Emmett,
Cheese) plus reconfirmations from earlier testers. Five new fixes (3 P0 + 2 P1)
plus a verification audit.

**Final HEAD on main:** `07cb8f2` -- "audit: round 2 fix verification on live build"

**Pushed to GitHub Pages:** `4225263` (P0-1 typewriter volume) -- the only
auto-pushable item per the brief. Everything else is committed locally
awaiting Alex's review.

**Working tree:** clean except for older `production/playtest-2026-04-26/...`
deletions you had staged before the session (left untouched).

---

## Commit hashes (5 fixes + 1 audit)

| Hash | Subject | Status |
|---|---|---|
| `4225263` | fix: lower NPC dialog typewriter volume by 71% (Cheese ear fatigue) | **PUSHED** |
| `eca0485` | fix: increase title menu hit areas + hover states for trackpad players | local |
| `1853a1b` | fix: pulse OBJECTIVE panel when objective text changes | local |
| `1971fde` | feat: auto-checkpoint on sandworm defeat (Victor died-and-forgot-to-save) | local |
| `a979547` | feat: respawn grace period (2.5s invuln on checkpoint reload) | local |
| `07cb8f2` | audit: round 2 fix verification on live build | local |

P0-1 was pushed immediately per your authorization (active risk to current
testers, single-number change, can't break anything else). The other four
fixes plus the audit are committed locally; **ask me before pushing** when
you're ready.

---

## What got fixed

### P0-1: Typewriter volume (PUSHED)
`textSound.volume` dropped from `0.35` to `0.10` (71% reduction). Cheese
should no longer have headphones-on-3/4-volume ear fatigue. Frequency,
pitch, character of the sound all preserved -- only volume changed.

### P0-2: Title screen trackpad nav
- CSS: `.title-pointer-overlay` width expanded from `3.6%` to `22%` so
  click targets cover the actual menu labels. `pointer-events: auto` on
  rows; subtle hover ring (translucent amber); `cursor: pointer`.
- JS: each `.title-pointer-row` gets `mouseenter` (sets selection +
  soft beep) and `click` (sets selection + activates) listeners.
- Verified: hovering 'load' row transfers selection from 'new-game'.

### P0-3: Persistent objective indicator
The OBJECTIVE panel was already always-rendered; the issue was that
players didn't notice when objective text changed. Added an
`objectivePulseTimer` (set to 2.5s any time `_currentObjectiveText()`
returns a different value than the previous frame). While > 0:
- Bright amber border around the panel
- Header + body text alternate between baseline and high-contrast
  highlight on a sine pulse
- Fades naturally as timer ticks down

Verified: setting `hasTalkedToElara=true` mid-frame triggered
`pulseTimer = 2.5` and `lastObjectiveText` updated from "TALK TO ELARA"
to "ENTER THE AMBERWAKE GATE".

### P1-2: Auto-checkpoint on sandworm defeat (yellow-light)
Victor's "died and forgot to save". The existing autosave (1s interval)
overwrites itself and the death screen reads from manual checkpoints
only. Added one extra `_createCheckpoint('Sandworm Felled')` call right
where `bossDefeated.sandworm = true` is set in the boss-death path.
Now if the player dies post-boss without saving manually, they have a
fresh checkpoint to reload from.

Conservative scope per the brief: ONE additional trigger only. Picked
the highest-value milestone. Doesn't touch the manual save shrine
system, the death UI, or the autosave cadence.

### P1-3: Respawn grace period (yellow-light)
Cheese's "brother taking over and dies immediately". On checkpoint
reload, set `player.invulnTimer = 2.5` so the new player can orient
before taking another hit. Existing `invulnTimer` field already drives
blink-flash rendering -- visual feedback comes for free. Updated the
reload toast to mention the brief invulnerability so it's not a hidden
mechanic: "RELOADED · CHECKPOINT_NAME · BRIEF INVULNERABILITY".

---

## What I skipped from YELLOW-LIGHT and why

Nothing skipped. Both P1-2 and P1-3 had a clean conservative-scope path,
so I implemented them.

---

## Smoke test results (local build, all Round 2 + Round 3 changes)

All checks via JavaScript eval against the local server. **No console
errors** across the entire session.

| Check | Result |
|---|---|
| Game boots, title loads | PASS |
| `cssHref: ?v=20260427-title-trackpad` | PASS |
| `mainSrc: ?v=20260427-respawn-grace` | PASS |
| `__zendoriaGame` hidden without `?dev=1` | PASS |
| `__zendoriaGame` exposed with `?dev=1` | PASS |
| Admin panel hidden by default | PASS |
| Player spawn 115 px from Elara | PASS |
| Pause open: `display: flex`, `paused: true`, latches `hasOpenedPauseMenu` | PASS |
| Pause close: `display: none` (no ghost) | PASS |
| Esc with map open: closes map, doesn't open pause | PASS |
| Settings Enter on Sound row: doesn't toggle | PASS |
| `_drawPortalProximityBadge` exists + is wired | PASS |
| `importantToast`/`importantToastTimer` accept values | PASS |
| `textSound.volume === 0.10` (P0-1) | **PASS** |
| `objectivePulseTimer` ticks to 2.5s on objective change (P0-3) | **PASS** |
| `lastObjectiveText` updates as objectives transition | PASS |
| Title row hover transfers selection (P0-2) | **PASS** |
| `.title-pointer-overlay` width 80.4 px (was tiny strip) | PASS |
| `.title-pointer-row` `pointer-events: auto`, `cursor: pointer` | PASS |
| All snapshot fields present + restorable from save | PASS |

---

## Things that need human eyeballs

These are visual-quality items I can't smoke-test via eval:

1. **Typewriter volume on actual headphones.** Subjective. Cheese will
   feel the difference (or not). My value (0.10) is a guess based on
   "drop 60-70%". Adjust the constant at `js/game.js` line ~146 if it
   feels wrong (too quiet -> 0.15; just right at 0.10; even quieter
   needed -> 0.05).

2. **Title menu trackpad feel.** The hover ring's intensity might be
   too subtle or too loud -- check if it reads as clickable on real
   trackpad without being noisy in keyboard mode. Tunable in
   `css/style.css` `.title-pointer-row:hover` rule.

3. **Objective pulse intensity.** The amber border + sine flash might
   be too aggressive (epilepsy concern? annoying after the 5th
   transition?) or too subtle. Check during a transition like talking
   to Elara, see if it actually catches the eye. Tunable knobs:
   `pulseStrength` formula and `Math.sin(this.gameTime * 8)` frequency.

4. **Auto-checkpoint label.** "Sandworm Felled" is the new checkpoint
   name. If Alex prefers a different label (e.g., "Boss Defeated",
   "After Sandworm"), it's a one-string change at the
   `_createCheckpoint(...)` call site.

5. **Respawn grace -- 2.5s vs feels-different.** Long enough to read
   the screen, short enough not to trivialize fights. If it feels
   wrong, change `2.5` at `_finalizeDeathTransition`. The toast also
   mentions the grace; if you don't want that disclosed, drop the
   "BRIEF INVULNERABILITY" suffix.

---

## Open questions for Alex

1. **Push approval needed for:**
   - `eca0485` (title trackpad)
   - `1853a1b` (objective pulse)
   - `1971fde` (auto-checkpoint)
   - `a979547` (respawn grace)
   - `07cb8f2` (audit doc -- could push or skip)

   Run `git push` after reviewing if all good. Or revert any
   individually with `git revert <hash>` first.

2. **Boatman dialog (Round 2 P1-1) visual quality unverified.**
   The page-mode rendering hasn't been seen by you yet. If it looks
   off, `git revert f06804c` brings back the original baked-image
   panels. Doing this now would also re-expose the panel-3 white
   pixels you fixed in Round 2 P0-3, so think about both together.

3. **GitHub Pages deploy still propagating.** Live URL might still
   show `?v=20260427-round2` for a couple more minutes; the
   typewriter volume fix lands once the CDN catches up. Should be
   live by the time you read this.

---

## Round 3 -> Round 4 follow-ups (not addressed this batch)

Carryover items still open from earlier rounds:
- Tamas burnt-foes counter unverified (Round 1 quest-functionality audit)
- QIRA collider possibly blocks her own interact rect (Round 1 audit)
- Tropics props' visible matte (Round 1 tropics audit)
- Cross-realm dev teleport (Round 2 npc-spawn-investigation)
- Boatman pages-mode visual review (Round 2 P1-1)

None of these came up in the new playtest data, so they remain
deprioritized.

---

GO ENJOY YOUR DAY, ALEX.
