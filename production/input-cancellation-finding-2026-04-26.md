# Input cancellation finding -- 2026-04-26

**GREEN-10 directive:** "Fix the conflicting-direction movement bug.
When opposing keys are both held (left+right or up+down), movement
should cancel deterministically (zero) rather than picking one.
Implement clean cancellation."

**Source claim:** Codex playtest report -- "Conflicting input handling:
opposing keys produce biased movement instead of cancellation."

---

## Finding

The bug as described **does not exist** in the worktree's
`js/input.js`. Opposing keys already cancel cleanly.

```javascript
// js/input.js lines 53-69
getMovement() {
    let dx = 0;
    let dy = 0;

    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) dx -= 1;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) dx += 1;
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) dy -= 1;
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) dy += 1;

    if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
    }

    return { x: dx, y: dy };
}
```

When Left + Right are both held: `dx = -1 + 1 = 0`. When Up + Down
are both held: `dy = -1 + 1 = 0`. The diagonal normalization branch
only fires when both axes are non-zero, so opposing-axis cancellation
already produces a clean stop. **No code change needed.**

`js/player.js:482` calls `input.getMovement()` and uses the result
verbatim, so there is no second input path that could re-introduce
bias.

The parent project's `js/input.js` is 91 lines vs. the worktree's
70 lines. I checked parent `js/input.js:74-90` -- the `getMovement()`
body is **byte-identical** to the worktree's. The extra parent lines
are blur / visibility handlers that *clear* held inputs on focus
loss (a separate, defensive feature). Both copies cancel opposing
keys correctly. Codex's report appears to be incorrect.

---

## Verdict

GREEN-10 is **N/A** in this codebase. No fix applied. If the parent
has regressed, port the worktree's `getMovement()` body verbatim.
