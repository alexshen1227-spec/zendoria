---
paths: []
---

# Engine Code Rules

> **Status: Disabled for this project.**
> This rule was written for projects with a dedicated engine framework layer
> under `src/core/`. Zendoria is a vanilla-JS browser game — the browser is
> the engine, and core framework code (`game.js`, `world.js`, `camera.js`,
> `assets.js`) lives alongside gameplay code in flat `js/`. The rules in
> `gameplay-code.md` cover those files. Re-enable by restoring a path
> (e.g., `js/**` if you want a separate framework lane) if the project
> grows a real engine layer.


- ZERO allocations in hot paths (update loops, rendering, physics) — pre-allocate, pool, reuse
- All engine APIs must be thread-safe OR explicitly documented as single-thread-only
- Profile before AND after every optimization — document the measured numbers
- Engine code must NEVER depend on gameplay code (strict dependency direction: engine <- gameplay)
- Every public API must have usage examples in its doc comment
- Changes to public interfaces require a deprecation period and migration guide
- Use RAII / deterministic cleanup for all resources
- All engine systems must support graceful degradation
- Before writing engine API code, consult `docs/engine-reference/` for the current engine version and verify APIs against the reference docs

## Examples

**Correct** (zero-alloc hot path):

```gdscript
# Pre-allocated array reused each frame
var _nearby_cache: Array[Node3D] = []

func _physics_process(delta: float) -> void:
    _nearby_cache.clear()  # Reuse, don't reallocate
    _spatial_grid.query_radius(position, radius, _nearby_cache)
```

**Incorrect** (allocating in hot path):

```gdscript
func _physics_process(delta: float) -> void:
    var nearby: Array[Node3D] = []  # VIOLATION: allocates every frame
    nearby = get_tree().get_nodes_in_group("enemies")  # VIOLATION: tree query every frame
```
