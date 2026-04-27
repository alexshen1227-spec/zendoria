# NPC reachability investigation -- 2026-04-26

**Source:** P1-5 from playtest meta-analysis. Checklist Claude reported the
dev-menu's "Teleport to Next NPC" only cycles 8 NPCs (Mira, Cadrin, Nyra,
Eamon, Suri, Tovin, Luma, Fenn) and the other ~10 appear missing.

**TL;DR:** All 18 NPCs DO spawn -- the 8 vs 10 split is by realm. The
dev-menu correctly cycles only the *current realm's* NPCs because that's
what `this.npcs` is populated with. Cross-realm dev teleport is a feature
request, not a bug.

**No code change applied.** This is a content/UX call for Alex.

---

## What's actually happening

`game.js _runAdminAction.teleportNextNpc` cycles `this.npcs[i]` modulo
`this.npcs.length`. `this.npcs` is rebuilt every time the realm changes
(`game.js:1084-1090`) from `this.world.npcSpawns`, which is set in
`world.js`:

- **Driftmere realm** (`world.js:203-451`, `npcSpawns` array, 8 entries):
  Mira (tide-medic), Cadrin (lantern-keeper), Nyra (wayfinder), Eamon
  (wreck-diver), Suri (stone-reader), Tovin (tide-cartographer), Luma
  (shell-courier), Fenn (moon-ferrier).

- **Frontier realm** (`world.js:656-963`, `npcSpawns` array, 10 entries):
  Dax (canyon-lookout), Veya (salt-scribe), Ila (herbalist), Bronn
  (road-smith), Orra (watch-captain), Kael (burnt-guide), Qira
  (salt-glasswright), Tamas (cinder-runner), Neve (root-singer), Halden
  (starherd).

When the player is in Driftmere, the dev menu only sees the 8 Driftmere
NPCs. Switching realms via the Amberwake Gate (or `dev` admin's
`teleportBoat` -> ride to gate) repopulates `this.npcs` with the 10
Frontier NPCs, and the dev cycle then walks through those.

This isn't a missing-content bug. The Checklist Claude tester appears
to have only tested in Driftmere.

## Why I didn't expand the cycle to span both realms

Cross-realm dev teleport would require:

1. Detecting that the target NPC lives in a different realm
2. Calling `_switchRealm(targetRealm, arrivalKey)` to swap the world
3. Reinitializing entities (enemies, structures, NPCs)
4. Placing the player near the target NPC after the realm load completes

`_switchRealm` already exists, but it triggers cutscenes (camera
transitions, music changes, save snapshots) that are intended for
in-world portal use. Reusing it from a dev menu can race with the
realm-load promise and create weird save state if the player teleports
mid-transition.

The user explicitly told me in this round's brief: "Don't fix it tonight,
that's a content question." I'm respecting that.

## What Alex can do tomorrow

Two reasonable options:

1. **Document the current behavior** in the admin panel HTML (e.g.,
   "Teleport To Next NPC (current realm)") so testers know to switch
   realms manually to access the others.

2. **Add a separate admin button** like "Teleport To Next NPC (any realm)"
   that handles the cross-realm path. The implementation would walk a
   global NPC ID list, look up which realm hosts each ID, and call
   `_switchRealm` with a callback to place the player after load.
   Estimate: 30-60 minutes including testing the realm-load races.

Either is fine. Neither is launch-critical -- the dev menu still works,
it just only sees the realm you're currently in.

## Side note: ID list verification

I confirmed the 18 NPC definitions actually exist in `world.js`:

```
Driftmere: 8
- mira-tide-medic              line 210
- cadrin-lantern-keeper         line 229
- nyra-wayfinder                line 254
- eamon-wreck-diver             line 279
- suri-stone-reader             line 307
- tovin-tide-cartographer       line 332
- luma-shell-courier            line 372
- fenn-moon-ferrier             line 413

Frontier: 10
- dax-canyon-lookout            line 663
- veya-salt-scribe              line 688
- ila-herbalist                 line 716
- bronn-road-smith              line 735
- orra-watch-captain            line 760
- kael-burnt-guide              line 785
- qira-salt-glasswright         line 813
- tamas-cinder-runner           line 855
- neve-root-singer              line 897
- halden-starherd               line 940
```

All accounted for. None are commented out. None of their dialog/effect
specs are obviously broken. The Round 1 audit
(`production/quest-functionality-audit-2026-04-26.md`) flagged Tamas's
`enemyKillCounts.biomes['burnt']` write path as needing verification --
that issue is unrelated to spawning and is still open.
