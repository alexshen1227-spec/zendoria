---
paths: []
---

# Design Document Rules

> **Status: Disabled for this project.**
> Zendoria is in Lean review mode and has no formal `design/gdd/` directory.
> Design intent and ongoing context live in `AI_CONTEXT_ZENDORIA.md.txt` at
> the project root, which acts as an informal living spec / handoff log.
> The 8-section GDD discipline is overkill for a solo 13-year-old build.
> Re-enable if and when `/design-system` is run to author proper per-system
> GDDs (e.g., before a public release or significant scope expansion).


- Every design document MUST contain these 8 sections: Overview, Player Fantasy, Detailed Rules, Formulas, Edge Cases, Dependencies, Tuning Knobs, Acceptance Criteria
- Formulas must include variable definitions, expected value ranges, and example calculations
- Edge cases must explicitly state what happens, not just "handle gracefully"
- Dependencies must be bidirectional — if system A depends on B, B's doc must mention A
- Tuning knobs must specify safe ranges and what gameplay aspect they affect
- Acceptance criteria must be testable — a QA tester must be able to verify pass/fail
- No hand-waving: "the system should feel good" is not a valid specification
- Balance values must link to their source formula or rationale
- Design documents MUST be written incrementally: create skeleton first, then fill
  each section one at a time with user approval between sections. Write each
  approved section to the file immediately to persist decisions and manage context
