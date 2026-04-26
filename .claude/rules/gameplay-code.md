---
paths:
  - "js/**"
---

# Gameplay Code Rules

This is a flat-structure browser game. All gameplay, AI, UI logic, and core
framework live together in `js/*.js`. These rules apply to every JavaScript
file in `js/`.

- Use **delta time** for all time-dependent calculations (movement, animation
  timers, cooldowns, fades). The game's update loop receives `dt` in seconds —
  use it consistently. Frame-rate independence is non-negotiable.
- **Prefer named constants over magic numbers.** Top-level `const` declarations
  belong in `js/constants.js` or near the top of the owning module, in
  `UPPER_SNAKE_CASE`. Tuning values (combat damage, enemy speeds, XP curves,
  fade durations) must be named and easy to find.
- **Module pattern**: each major entity / system gets its own file (`player.js`,
  `enemy.js`, `npc.js`, etc.) and exports a class. Cross-module communication
  goes through method calls on the `Game` orchestrator, not through globals.
- **No hidden globals**. The single permitted runtime global is
  `window.__zendoriaGame` (used by the admin/debug panel). Everything else
  must be imported or passed as a constructor argument.
- **Asset access goes through `js/assets.js`.** Don't `new Image()` ad-hoc
  inside gameplay code — load through the asset module so the loading screen
  can wait on it.
- **Persistence keys use the `zendoria-<system>-v<N>` convention** in
  `localStorage`. Bump the version when the schema changes; handle legacy
  shapes when reading.
- **Y-sort entities by their bottom edge** when drawing in the world (see
  `Game._drawEntitiesSorted`). New on-screen entities must integrate into
  the y-sort path so they overlap props correctly.
- **Cache-busting**: when you make a meaningful change to a `js/` file,
  bump the `?v=YYYYMMDD-tag` import suffix in callers (or in
  `js/main.js` and `index.html` for top-level files) so the browser
  reloads instead of serving stale modules.
- **Document non-obvious decisions** at the top of the function or near
  the affected line — the WHY, not the WHAT. Examples worth commenting:
  edge-case fallbacks, performance tradeoffs, intentional asymmetries
  with other systems.

## Lean-mode adaptations

This project is in Lean review mode (a 13-year-old solo dev's project).
The following heavy-team conventions are **not required** here, but recommended
when scope grows:

- Strict separation of UI / gameplay / engine layers — current code is
  intentionally flat in `js/`. Keep it readable; don't over-abstract.
- Dependency injection over direct construction — the `Game` constructor
  is the de-facto composition root; that is fine.
- Unit tests for every system — see `tests/` rules for when tests are added.

## Examples

**Correct** (delta time, named constants, module-scoped):

```javascript
// js/player.js
const PLAYER_MAX_SPEED = 96;        // pixels per second
const ATTACK_COOLDOWN = 0.45;       // seconds

export class Player {
    update(dt, input, world) {
        if (this._attackTimer > 0) this._attackTimer -= dt;
        const speedX = input.moveX() * PLAYER_MAX_SPEED * dt;
        this.x += speedX;
    }
}
```

**Incorrect** (magic numbers, frame-rate dependent, hidden globals):

```javascript
// VIOLATION: hardcoded value, no name, no scale by dt, mutates a global
function updatePlayer() {
    window.player.x += 5;            // VIOLATION 1: global, 2: hardcoded, 3: per-frame
    if (window.player.attack) {
        window.player.attack -= 0.016;  // VIOLATION: assumes 60 fps fixed
    }
}
```
