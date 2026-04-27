# Codex Stress / Edge-Case Playtest Report

Date: 2026-04-26
Tester role: stress / edge-case tester
Build launched via `launch.bat` URL: `http://127.0.0.1:8765/?v=20260425-sidequests`

Constraints followed: I did not read `js/` or `assets/` source files, and I did not read the other AI reports. Screenshots and raw run logs are in `production/playtest-2026-04-26/screenshots/codex/`.

## 1. CRASHES / HARD FAILURES - the game stopped working

No full game crash was reproduced. Invalid JSON in `localStorage.zendoria-save-v1` produced console warnings and the Load Game flow fell back to "No saved journey exists yet" instead of crashing.

Evidence:
- `screenshots/codex/codex-s3-08-invalid-json-after-load.png`
- `screenshots/codex/session3-save-corruption-log.json`

Notes:
- No P0 XSS/code execution found. A save with `currentRealmId` set to an HTML/onerror payload did not execute the payload and was sanitized/fell back to a normal Driftmere start.
- Console did repeatedly log `Zendoria title voice play failed: AbortError...` during rapid title/reload flows, plus a generic 404 resource error. These did not stop gameplay.

## 2. SOFTLOCKS - game runs but player is stuck

No permanent softlock was confirmed.

Near misses:
- Pressing `M` opens the map. Pressing `Esc` from the map opens Settings rather than closing the map; choosing Resume returns to the map. The player can still escape with `Space`, so this is confusing but not a hard softlock.
- Invalid JSON save data leaves the user at a Load Game modal saying no save exists. `Space`, `Enter`, or `Esc` returns to the title, so recovery exists.

Evidence:
- `screenshots/codex/codex-s1-17-map-after-elara.png`
- `screenshots/codex/codex-s1-19-map-close-attempt.png`
- `screenshots/codex/codex-map-close-Space.png`

## 3. STATE CORRUPTION - saves got weird, values broke, ghost entities

### P1 - Wrong-type save flags grant progression

Repro:
1. Start a fresh save.
2. Set `localStorage.zendoria-save-v1` to a JSON object where progression booleans are strings, e.g. `hasTalkedToElara: "yes"` and `hasMap: "yes"`.
3. Reload and choose Load Game.

Result:
- The player loads at the starting area, but the objective advances to `ENTER THE AMBERWAKE GATE`.
- The malformed save is rewritten, but not before truthy string flags are accepted as progression.
- A wrong-type health value produced a rewritten save with `health:null` before later normalization.

Evidence:
- `screenshots/codex/codex-s3-08-wrong-types-after-load.png`
- `screenshots/codex/session3-save-corruption-log.json`

Expected:
- Save loading should validate exact types. Non-boolean progression flags should be rejected or migrated to safe defaults before any objective/progression logic runs.

### P1 - Death/title overlays can remain composited behind gameplay

Repro:
1. Die in a hostile area.
2. Reload/return through title/load flows.
3. Enter/transition toward the Blightworn area again.

Result:
- A previous `YOU DIED` or title overlay can be visible behind active gameplay/HUD, creating a ghosted render state.

Evidence:
- `screenshots/codex/codex-s1-24-gate-north-edge.png`
- `screenshots/codex/codex-s2-00-after-death-to-title.png`
- `screenshots/codex/codex-s3-03-reload-mid-movement.png`

Expected:
- Title, death, and gameplay scenes should clear their visual layers completely when changing state.

### P2 - Multiple tabs collide on the same autosave

Repro:
1. Open two browser tabs on the same origin.
2. Load/start the game in both.
3. Move the player differently in each tab.
4. Inspect `localStorage.zendoria-save-v1`.

Result:
- Both tabs write the same single autosave key. The last active writer wins with no tab ownership, timestamp warning, or conflict handling.

Evidence:
- `screenshots/codex/codex-s3-05-tab-a-after-tab-b-moved.png`
- `screenshots/codex/codex-s3-06-tab-b-shared-save.png`
- `screenshots/codex/session3-save-corruption-log.json`

Expected:
- Either block multiple live writers, add save timestamps/conflict detection, or make title/load flows warn when another tab is active.

### P2 - Clearing localStorage mid-game is undone by the running tab

Repro:
1. Start a fresh run.
2. Clear localStorage while gameplay is running.
3. Wait for autosave.

Result:
- The active game rewrites a full save from memory. This is not a crash, but it means a user/dev trying to clear the save while the tab is open can have the old state resurrected.

Evidence:
- `screenshots/codex/codex-s3-04-clear-localstorage-mid-game.png`
- `screenshots/codex/session3-save-corruption-log.json`

## 4. SEQUENCE BREAKS - playable but unintended progression paths

### P1 - Tutorial/NPC objective does not gate dangerous exploration

Repro:
1. New Game.
2. Do not talk to Elara.
3. Move away from spawn toward the map edges / east-north routes.

Result:
- The objective remains `TALK TO ELARA`, but the player can roam far enough to reach active enemy territory and die under the tutorial objective.

Evidence:
- `screenshots/codex/codex-s1-03-skip-npc-southwest-attempt.png`
- `screenshots/codex/codex-s1-06-east-edge-without-elara.png`
- `screenshots/codex/codex-s1-07-reattach-after-timeout.png`

Expected:
- Either hard-gate exits/hazard zones until Elara/map flags are set, or update the tutorial objective once the player leaves the intended zone.

### P2 - Underleveled entry to Blightworn/hostile route

Repro:
1. Talk to Elara and get the map.
2. Head toward the Amberwake/Blightworn route immediately.
3. Keep pushing north/east without leveling or equipping anything.

Result:
- The game allows transition into a hostile Blightworn area at level 1 with starting stats, and death can occur almost immediately.

Evidence:
- `screenshots/codex/codex-s1-24-gate-north-edge.png`
- `screenshots/codex/codex-s1-25-gate-northeast-edge.png`
- `screenshots/codex/codex-s4-05-transition-menu-spam.png`

Expected:
- If this is intended, the objective/hints should prepare the player. If not intended, add a progression gate or safer landing zone.

### P1 - Save flag editing skips Elara/map progression

Repro:
1. Set save flags to truthy strings, e.g. `hasTalkedToElara: "yes"` and `hasMap: "yes"`.
2. Load the game.

Result:
- Objective advances to Amberwake Gate even though the player is back at the start.

Evidence:
- `screenshots/codex/codex-s3-08-wrong-types-after-load.png`

## 5. SILENT FAILURES - things that did not crash but went wrong

### Input fuzzing opens/queues UI unexpectedly

Repro:
1. Fresh game.
2. Send an all-keys chord including movement, `Space`, `Enter`, `Esc`, `E`, `M`, attack-ish keys, and modifiers.

Result:
- Settings opens reliably. Subsequent queued inputs can resume, open map/dialogue, or interact with nearby objects depending on position.
- No crash, but the game does not appear to drain/normalize input state when overlays open.

Evidence:
- `screenshots/codex/codex-s2-04-all-keys-chord.png`
- `screenshots/codex/codex-s2-05-after-clear-all-keys.png`

### Conflicting directions produce biased movement

Repro:
1. Fresh game.
2. Rapidly alternate or chord left+right and up+down inputs.

Result:
- The player moved substantially away from spawn rather than canceling movement.

Evidence:
- `screenshots/codex/codex-s2-07-conflicting-directions.png`

Expected:
- Opposite directions should either cancel deterministically or follow a documented priority. Current behavior lets fuzzed controls drift the player into unintended areas.

### Repeated interact spam near world objects creates noisy duplicate banners

Repro:
1. Stand near Elara/aether font area.
2. Spam `E`, `Space`, click, and attack-like keys repeatedly.

Result:
- `AETHER FONT DORMANT 20S` banners were shown in multiple screen positions while the objective still said `TALK TO ELARA`.
- No crash, but the feedback is confusing and easy to spam.

Evidence:
- `screenshots/codex/codex-s4-03-after-30-elara-triggers.png`

### Browser-level inputs

Observed:
- `F12` produced no visible game issue in the automated browser.
- Focus changes / `Alt+Tab` produced no visible game issue.
- Browser reload during gameplay returns to title and can expose the ghosted live-world background behind the title card.

Evidence:
- `screenshots/codex/codex-s2-10-after-f12.png`
- `screenshots/codex/codex-s2-11-after-alt-tab.png`
- `screenshots/codex/codex-s3-03-reload-mid-movement.png`

## 6. SUGGESTED PRIORITY - top 3 stability fixes before publishing

1. **Harden save loading with a strict schema.** Validate exact types, realm IDs, health ranges, arrays, and progression flags before applying state. Reject or migrate bad data atomically. This fixes the wrong-type progression skip and reduces corruption risk.

2. **Gate or clearly handle early hazardous routes.** The player can ignore Elara and reach danger while the objective still says `TALK TO ELARA`; after Elara, level-1 Blightworn entry can kill immediately. Add gates, safer spawn/landing placement, or objective updates.

3. **Reset render/input layers on state changes.** Death, title, map, settings, and gameplay need hard visual/input cleanup when transitioning. This should address ghosted overlays, queued all-key behavior, and confusing map/settings closure.

