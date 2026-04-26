# Session Handoff — 2026-04-26

**Session focus**: Configure Claude Code Game Studios for the actual stack (vanilla
JS browser game, not a fresh project) and fix a destructive NPC sprite bug.
**Next session venue**: Claude Code desktop app.

---

## 1. What was done today

### Studio configuration for the real stack
The `/start` flow had been run yesterday but the project-stage-report wasn't saved
and the studio config still pointed at the default Godot/Unity/Unreal templates.
Today's work corrected that:

- `CLAUDE.md` Technology Stack section rewritten to describe HTML5 Canvas 2D +
  vanilla JS (ES2022+) + `localStorage`. Engine-version import retargeted to
  `docs/engine-reference/web/VERSION.md`.
- `.claude/docs/technical-preferences.md` fully populated: Zendoria's naming
  conventions, performance budgets, forbidden patterns, and a routing table
  that sends `js/*.js` files to general programmer specialists
  (`gameplay-programmer` / `engine-programmer` / `ai-programmer` /
  `ui-programmer` / `technical-artist` / `lead-programmer`). The `godot-*` /
  `unity-*` / `ue-*` engine specialists are explicitly marked NOT applicable.
- `docs/engine-reference/web/VERSION.md` created as the engine-version anchor
  the import points to.
- Did NOT invoke the `/setup-engine` skill itself — it's hardcoded for
  Godot/Unity/Unreal and would have forced a guided engine-selection flow.
  The equivalent work was done by direct edits.

### Path-scoped rules retargeted to the real layout
The studio's default rules expected a `src/gameplay/`, `src/ui/`, `src/ai/`,
`src/networking/` layout. Zendoria has flat `js/` instead. Per user instruction
("update the rules so they apply to /js/ as a whole" — no restructure), the rules
were edited:

- `.claude/rules/gameplay-code.md` — retargeted from `src/gameplay/**` to
  `js/**`. Examples rewritten in vanilla JS. Includes a "Lean-mode adaptations"
  section noting which heavy-team conventions are intentionally relaxed.
- Disabled (`paths: []` + a "Status: Disabled" header explaining why; rule body
  preserved for future re-enable):
  `engine-code.md`, `ui-code.md`, `ai-code.md`, `network-code.md`,
  `shader-code.md`, `design-docs.md`, `narrative.md`.
- Left as-is (their paths don't exist yet but will activate naturally when
  those dirs appear): `test-standards.md`, `data-files.md`, `prototype-code.md`.

### Project stage report
- `production/project-stage-report.md` written. Verdict: **mid-Production**, not
  a fresh start. Covers stack, code surface (20 modules in `js/`), what's
  working, what's intentionally absent for Lean mode, what's actually rough,
  and the studio config changes made today.

### NPC sprite bug fixed
- `js/assets.js` — `prepareGeneratedNpcSprite()` no longer runs the dark-matte
  flood. See section 2 below for full root-cause analysis.
- `js/main.js` — assets.js cache-buster bumped from `?v=20260425-sidequests` to
  `?v=20260426-npc-matte-fix` so the browser reloads the fixed module.

---

## 2. The NPC sprite bug — root cause and fix

### Symptoms reported
"Codex previously edited some NPC code/positioning and messed up their avatars
— they're now distorted or in wrong places." Elara and the Boatman were noted
as rendering correctly.

### Root cause
A single line in `js/assets.js`, function `prepareGeneratedNpcSprite()` (was
line 547):

```javascript
const cleaned = trimTransparentBounds(removeEdgeMatte(image, { mode: 'dark', threshold: 88 }), 1);
```

`removeEdgeMatte` flood-fills inward from the image corners through any pixel
that is either `alpha === 0` OR has all of `R<88, G<88, B<88`. The 18 generated
NPC PNGs already have **transparent backgrounds** (corner alpha is 0), so the
flood proceeds inward through the entire transparent border, then continues
into any connected pixel that's "dark enough" — destroying hair, shadows, dark
clothing, dark armor, and the outline edges of every figure. Then
`fitSpriteToBox` shrinks the hollowed-out figure into a 32×40 box, finishing
the destruction.

### Damage measurement (Python simulation of the exact flood)
Pixel loss percentages, all 18 NPCs:

```
kael-burnt-guide          79.7%   (worst — figure was almost entirely dark)
fenn-moon-ferrier         68.3%
eamon-wreck-diver         68.0%
orra-watch-captain        67.0%
cadrin-lantern-keeper     66.4%
tamas-cinder-runner       64.3%
neve-root-singer          59.1%
tovin-tide-cartographer   59.4%
bronn-road-smith          55.5%
nyra-wayfinder            55.4%
ila-herbalist             52.0%
dax-canyon-lookout        50.7%
suri-stone-reader         46.1%
luma-shell-courier        40.6%
qira-salt-glasswright     38.8%
halden-starherd           38.6%
mira-tide-medic           30.3%
veya-salt-scribe          28.3%   (least bad)
```

### Why Elara and Boatman were fine
Different pipelines. Elara goes through `extractFramesFromStrip` (plain strip
slice, no matte cleanup). Boatman goes through `extractBoatmanFrames` which
uses `extractSpriteGridDetailed` with a white-cutoff (because boatman art has
a light background). Neither runs the dark-matte flood that's destroying the
generated NPCs.

### Position investigation
The 18 NPC `npcSpawns` definitions were ALL added by Codex in commit `2b0ef66`
("Open-world expansion") as new content — there is no prior version of those
positions to regress against. Coordinates appear intentional: each NPC's
location aligns with the biome its dialog references (e.g.,
`qira-salt-glasswright` at x=24 lands in the salt flats `col<=33`;
`ila-herbalist` at y=64 lands in the tropics basin; `kael-burnt-guide` at
x=147 lands in the burnt plain `col>=130`). The `_spawnAmbientNpc` callsite
runs `world.findOpenEntityPosition` which can shift each NPC by up to 48px to
avoid walls/colliders — that's a reasonable fallback.

So position errors are NOT confirmed. If specific NPCs still look mis-placed
once their sprites render correctly, audit them individually.

### The fix (applied)
`prepareGeneratedNpcSprite` now skips `removeEdgeMatte` entirely and just
trims to visible bounds:

```javascript
function prepareGeneratedNpcSprite(image) {
    if (!image) return null;
    // Source PNGs already have transparent backgrounds (alpha=0 corners).
    // Running the dark-matte flood here would ... (full comment in code)
    const cleaned = trimTransparentBounds(image, 1);
    return {
        family: 'unique',
        w: 32,
        h: 40,
        frames: [fitSpriteToBox(cleaned, 32, 40)],
        portrait: cleaned,
        ...
    };
}
```

Confidence: HIGH. The fix path is mechanically certain — no more flood-fill
means no more pixel destruction. Risk: very low. Elara and Boatman pipelines
are untouched.

---

## 3. Verified vs NOT verified

### Verified
- The matte flood-fill destroys 28–80% of every generated NPC PNG. Confirmed
  by replicating the JS algorithm in Python on each of the 18 source files.
- `removeEdgeMatte` is invoked only by `prepareGeneratedNpcSprite` for the
  generated-NPC pipeline; Elara and Boatman do not pass through it.
- The fix removes that call and preserves the full figure.
- The `prepareGeneratedNpcSprite` change only affects the 18 ambient NPCs
  that have generated PNGs — fallback variants (tinted Elara/Boatman base for
  NPCs without a generated PNG) are unaffected because they go through
  `buildNpcVariant` instead.

### NOT verified (deferred to desktop app)
- The fix has NOT been run in a browser. The matte simulation was Python-side.
  The actual fix lives in JavaScript code that has not executed since the
  edit.
- No screenshot exists of NPCs rendering correctly with the fix applied.
- The cache-buster bump (`?v=20260426-npc-matte-fix`) has not been confirmed
  to cause the browser to reload the new `assets.js` (it should — the meta
  cache-control on `index.html` already says `no-cache, no-store,
  must-revalidate`, and the URL change is a hard signal).
- Position correctness of any individual NPC has NOT been verified visually.
  This is the secondary concern that can only be assessed once sprites
  render correctly.

---

## 4. Next steps in the desktop app

Recommended order:

1. **Launch the game**. Start a new game so spawning runs cleanly. Resume an
   existing save also works if one exists.
2. **Walk through Driftmere** (the starting realm) and visit all 8 ambient
   NPCs. They appear as data-driven `AmbientNpc` actors — distinct from
   Elara (who is at Starfall Camp on the western island) and the Boatman.
   Driftmere NPC IDs and approximate tile coords:
   - `mira-tide-medic` — 51, 59
   - `cadrin-lantern-keeper` — 75, 46
   - `nyra-wayfinder` — 61, 30
   - `eamon-wreck-diver` — 83, 38
   - `suri-stone-reader` — 33, 55
   - `tovin-tide-cartographer` — 67, 31
   - `luma-shell-courier` — 57, 57
   - `fenn-moon-ferrier` — 89, 37
3. **Pass through the portal to the Suncleft Frontier** (the desert/canyon
   realm — used to be called Index) and visit all 10 ambient NPCs there:
   - `dax-canyon-lookout` — 81, 19
   - `veya-salt-scribe` — 26, 49
   - `ila-herbalist` — 69, 64
   - `bronn-road-smith` — 99, 104
   - `orra-watch-captain` — 160, 60
   - `kael-burnt-guide` — 147, 43
   - `qira-salt-glasswright` — 24, 63
   - `tamas-cinder-runner` — 144, 54
   - `neve-root-singer` — 57, 70
   - `halden-starherd` — 84, 103
4. **Verify each NPC**:
   - Sprite renders as a recognizable figure (not a hollowed-out ghost)
   - Dialog opens cleanly when pressing E in range
   - The NPC stands on walkable terrain, not buried in a wall or floating
   - Position roughly matches the biome the dialog talks about
5. **If everything looks right**: the matte fix worked. Position concern is
   resolved by exclusion.
6. **If a specific NPC is still wrong**: capture which one, what's wrong
   (still distorted? in a wall? wrong biome?), and we can re-audit. Most
   likely candidates for residual issues:
   - An NPC whose source PNG has an unusual halo or bright corners — would
     need a different cleanup, not the dark-matte flood
   - An NPC whose definition coords land in a prop/wall and `findOpenEntityPosition`
     dumps them in an unexpected spot
7. **Tip for verification**: the admin panel toggle is the backtick (`` ` ``)
   key. It includes "Teleport To Next NPC" which cycles through ambient NPCs.

---

## 5. Open threads to revisit later

- **`serve.py` deletion**: shows as `D serve.py` in `git status`. The
  `AI_CONTEXT_ZENDORIA.md.txt` "Known Glitches" section still references
  `serve.py` as the no-cache local server. `launch.bat` is the current
  launcher. If `serve.py` deletion was intentional, update `AI_CONTEXT` to
  remove the reference. If accidental, restore from git history
  (`git checkout HEAD -- serve.py`). NOT addressed today.
- **Codex's other uncommitted work**: today's commit is intentionally narrow
  (studio config + matte fix + reports). Several other files are still
  modified in the working tree from prior Codex sessions: `js/npc.js`,
  `js/world.js`, `js/game.js`, `js/enemy.js`, `js/input.js`, `js/player.js`,
  `css/style.css`, `index.html`, `launch.bat`, plus untracked enemy / biome
  sprite PNGs under `assets/sprites/`. The matte fix DEPENDS on the
  uncommitted `npc.js` (`AmbientNpc` class) and `world.js` (`npcSpawns`) and
  `game.js` (`_spawnAmbientNpc`) — those files are present in the working
  tree so the desktop app will render correctly, but `HEAD` after this commit
  references NPC variant data that isn't fully realized in the committed
  history. Decide in a future session whether to commit those Codex
  modifications as a follow-up or leave them as ongoing dev work.
- **`AI_Ready_Assets/`**: untracked directory at project root, contents not
  inspected today. Confirm purpose and decide whether to track.
- **Index → Suncleft Frontier rename**: `world.js` calls the second realm
  `frontier` / `SUNCLEFT FRONTIER`, but `AI_CONTEXT_ZENDORIA.md.txt` still
  refers to it as `INDEX` ("placeholder desert realm"). The rename is more
  recent than the AI_CONTEXT entry. Update AI_CONTEXT or treat both names
  as aliases.
- **Tombstone animation strip TODO**: still flagged in `AI_CONTEXT` —
  current runtime asset is a single still; the source is a strip needing
  frame extraction + alpha cleanup.
- **`EXPLORE DESERT` placeholder**: still flagged in `AI_CONTEXT` for the
  Index/Frontier objective text.
- **Player up/down sprite**: known compromise — side-view art mirrored for
  east/west; up/down reuses the body, only slash FX rotates. Flagged in
  `AI_CONTEXT` and the project-stage-report.

---

## 6. Files touched today

Studio config:
- `CLAUDE.md`
- `.claude/docs/technical-preferences.md`
- `docs/engine-reference/web/VERSION.md` (new)

Rules (all under `.claude/rules/`):
- `gameplay-code.md` (retargeted to `js/**`)
- `engine-code.md`, `ui-code.md`, `ai-code.md`, `network-code.md`,
  `shader-code.md`, `design-docs.md`, `narrative.md` (disabled)
- Untouched (left to activate naturally): `test-standards.md`,
  `data-files.md`, `prototype-code.md`

Code:
- `js/assets.js` — `prepareGeneratedNpcSprite` matte fix
- `js/main.js` — assets.js cache-buster bump

Reports:
- `production/project-stage-report.md` (new)
- `production/session-handoff-2026-04-26.md` (this file)
