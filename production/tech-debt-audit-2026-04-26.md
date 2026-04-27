# Tech-debt audit -- 2026-04-26

**Scope:** GREEN-12. Document magic numbers and tech-debt patterns
encountered while doing the playtest fixes. Per the user: don't
refactor them all -- just note them.

> All line numbers are in this **worktree branch** unless explicitly
> tagged `(parent)`. The worktree's `js/game.js` is at 5042 lines;
> the parent's working tree is at 6837 lines (1795 lines of
> uncommitted side-quest work).

---

## 1. Hot magic numbers I touched or read

### `js/game.js`

| Line | Code | What it means | Suggested name |
|---|---|---|---|
| 3902 | `dx * dx + dy * dy <= 88 * 88` | "enemy is nearby" radius for the bottom hint suppression and combat coaching gate | `ENEMY_NEARBY_RADIUS = 88` |
| 3954 | `if (dx * dx + dy * dy > 88 * 88) continue;` | Same radius again, for enemy nameplates | (same) |
| 3900 | `this.gameTime < 10` | First-hint banner duration in seconds | `FIRST_HINT_DURATION = 10` |
| 3901 | `this.gameTime < 7 ? 1 : 1 - (this.gameTime - 7) / 3` | Hint banner fade window: hold for 7s, fade for 3s | `FIRST_HINT_FADE_START = 7`, `FIRST_HINT_FADE_DURATION = 3` |
| 3903-3905 | `42`, `174`, `18`, `48`, `21`, `12` | Hint banner pixel layout (x, w, h, label x, label y1, label y2). Now slightly more complex after the GREEN-9 fix added a `showCombatLine` branch. | Consider `HINT_BANNER_X`, `HINT_BANNER_W`, etc. or pull into a named struct. Low priority -- this draws once. |
| 476-477 | `Math.abs(e.x - spawn.x) < 32 && Math.abs(e.y - spawn.y) < 32` | "Already an enemy at this spawn" dedup radius (1 tile each side, since `TILE = 16` and `2 * TILE = 32`) | `SPAWN_DEDUP_RADIUS = 2 * TILE` |
| 4332 | `const globalCap = this.currentRealmId === 'frontier' ? 16 : 10;` | Per-realm enemy population cap | `MAX_ENEMIES_FRONTIER = 16`, `MAX_ENEMIES_DRIFTMERE = 10` |
| 21-25 (top of file) | `DIALOG_SOUND_DURATION = 1.8`, `MAX_CHECKPOINTS = 6`, `DEATH_FADE_DURATION = 2.4`, `DEATH_OUTFADE_DURATION = 0.8` | These ARE named constants -- example of the right pattern. Magic numbers below should follow this style. |

### `js/world.js` (worktree)

| Line | Code | What it means |
|---|---|---|
| 354 | `pointInEllipse(col + 0.5, row + 0.5, 70.5, 66.5, 18.5, 13.5)` | Tropics basin ellipse: center (70.5, 66.5), radii (18.5, 13.5). Suggest `TROPICS_BASIN = { cx: 70.5, cy: 66.5, rx: 18.5, ry: 13.5 }`. |
| 432 | `h < 0.36 ? 2 : (h < 0.72 ? 3 : 4)` | Tropics tile-height thresholds. Each biome has its own thresholds (lines 425-435). Could be a per-biome `tileThresholds` table. |
| 567-588 | Many `pushProp(name, x, y, { scale, ... })` lines with hardcoded coordinates. | Level data. Treating these as data is fine -- they're inherently per-position. **Not** magic numbers in the bad sense. |

### `js/player.js`

107 usages of numeric literals in this 793-line file. Most are
dt-scaled coefficients (animation timers, knockback strengths,
combo windows). Many are well-commented but lack named constants.

Examples I'd refactor first:

| Line (approx) | What it likely controls |
|---|---|
| Combat I-frame durations | Probably 0.08-0.45 -- name as `IFRAME_DURATION_BASE`, etc. |
| Dash speed multiplier | Likely a single number -- `DASH_SPEED_MULTIPLIER`. |
| Combo timer window | -- `COMBO_GRACE_WINDOW`. |

I did not exhaustively map them in this audit -- the user explicitly
said "don't refactor them all".

### `js/enemy.js`

71 numeric literals, most in `ENEMY_CONFIGS`. The configs ARE the
named-constant table -- this is the data-driven shape rules in the
gameplay-code rule encourage. Not bad debt.

---

## 2. Structural debt encountered

### A. `_npcQuestFlagMet` is a hand-written switch (parent only)

Parent `js/game.js:2181-2192` -- adding a new flag-based quest
requires editing this switch. Easy to forget and silently break a
quest. Suggested: replace with a registry like

```javascript
const QUEST_FLAGS = {
    hasMap: (game) => game.hasMap,
    hasBoat: (game) => game.hasBoat,
    // ...
};
```

so adding a new flag is one line in a data table. Low priority.

### B. NPC variant base resolution chain (parent `js/npc.js:138-141`)

```javascript
const variant = assets.npcGeneratedVariants?.[definition.id]
    || assets.npcVariants?.[definition.variant]
    || assets.npcVariants?.['drift-scout']
    || null;
```

Fine in isolation. The risk: if `definition.variant` is misspelled,
the silent fallback to `'drift-scout'` masks the bug. Consider a
warn-on-fallback log in dev mode.

### C. `fitSpriteToBox` is a generic 32x40 nearest-neighbor downsample

Parent + worktree `js/assets.js:530-543`. Discussed in the NPC sprite
audit. Acceptable for small source PNGs, destroys detail on the
large generated NPC art. Three remediation paths in
`production/npc-sprite-audit-2026-04-26.md`.

### D. localStorage save-key versioning is single-version

`zendoria-save-v1` is the only key. The `_loadGame` path includes
some legacy-shape handling (`legacyScoutProgress`, etc.) but no
explicit version field in the save itself. If the schema breaks in
a way the legacy handler doesn't catch, the only escape is
`?resetSave=1`. Suggest adding a `version: 2` field to new saves
and a migration ladder.

### E. Audio gesture-unlock chain (parent + worktree)

Parent `js/game.js` has multiple `_setupGestureUnlock`-style
listeners that all stay registered for the page's lifetime. Low
risk; would clean up to listen-once and then `removeEventListener`.

---

## 3. Things I expected to find but didn't

- **No frame-rate-dependent code.** The dt scaling is clean
  throughout. Good.
- **No hidden globals beyond `window.__zendoriaGame`** (and that's
  now properly gated by `?dev=1` per GREEN-2).
- **No synchronous XHR / `alert` / `prompt`** anywhere.
- **No third-party libraries** -- the project really is zero-dep.

The codebase is reasonably tidy for a solo build. The three highest-
value debt repayments would be:
1. Upgrading the NPC sprite pipeline (NPC sprite audit option 1).
2. Pulling 4-6 commonly used numbers (`88`, `10`, `7`, `3`, `32`,
   `0.45`) into named constants.
3. Adding a version field to the save schema.

None are launch-blocking.
