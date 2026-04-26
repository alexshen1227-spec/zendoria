---
paths: []
---

# AI Code Rules

> **Status: Disabled for this project.**
> Enemy / NPC AI lives in `js/enemy.js` and `js/npc.js` alongside other
> gameplay code in flat `js/`. The general rules in `gameplay-code.md`
> apply. The strict 2 ms AI budget, behavior-tree-or-utility mandate, and
> network-validation requirements here are sized for a larger team.
> Re-enable when AI grows past simple state machines (e.g., adopting a
> formal behavior-tree library or splitting AI into its own subdirectory).


- AI update budget: 2ms per frame maximum — profile to verify
- All AI parameters must be tunable from data files (behavior tree weights, perception ranges, timers)
- AI must be debuggable: implement visualization hooks for all AI state (paths, perception cones, decision trees)
- AI should telegraph intentions — players need time to read and react
- Prefer utility-based or behavior tree approaches over hard-coded if/else chains
- Group AI must support formation, flanking, and role assignment from data
- All AI state machines must log transitions for debugging
- Never trust AI input from the network without validation
