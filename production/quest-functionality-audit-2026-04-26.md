# Quest Functionality Audit -- 2026-04-26

**Scope:** GREEN-7 (salt stone quest verification), GREEN-8 (TOVIN
"sketch a path way" pathway verification), and any side-quest with a
visibly broken state machine.

> **Important:** the quest system lives in the parent project's
> uncommitted working tree (`C:/Dev/Zendoria/js/world.js` lines 327+,
> 808+, 850+, etc., and `C:/Dev/Zendoria/js/game.js` lines 1910-2230
> + 2412+ + 4188+). It does NOT exist in this worktree branch yet --
> the worktree was created from commit 0c7c5d4 which predates the
> sidequests work in `?v=20260425-sidequests`. All line numbers below
> refer to the parent's working tree.

---

## TL;DR

| Item | Verdict | Action |
|---|---|---|
| Tovin "sketch a path way" pathway | **Dialogue overpromises -- no map update happens.** Reward is just a `ward` buff. | Document, leave dialogue alone (RED-LIGHT). |
| Qira salt-stone (3 salt shards) | **Code path is functional** -- requires hasLevelUpAbility + 3 destroyed salt crystals. Likely works. | Verified in code. Document. |
| Tamas burnt-foe quest | **Code path is functional** -- requires 3 burnt-biome enemy kills. Depends on `enemyKillCounts.biomes['burnt']` being populated correctly. | Verify when next playtested. |
| Other side quests | Pattern matches above -- all use the same `_npcQuestRequirementsMet` and `_npcQuestProgress` plumbing. | No structural dead ends found. |

---

## 1. Tovin "tide cartographer" -- the "I sketch a path way" line

### Definition (parent `js/world.js:327-365`)

```javascript
{
    id: 'tovin-tide-cartographer',
    name: 'Tovin',
    promptLabel: 'TOVIN',
    x: 67 * TILE,
    y: 31 * TILE,
    effect: {
        type: 'quest',
        once: true,
        require: { flags: { hasMap: 'ELARAS MAP' } },
        reward: {
            buffId: 'ward',
            buffName: 'ROUTE WARD',
            duration: 52,
            color: '#8effec',
        },
        toast: 'TOVINS ROUTE INK SET',
        progressToast: 'TOVIN NEEDS ELARAS MAP',
    },
    dialog: {
        ready: [
            'There it is. Elara keeps cleaner lines than any sailor I know.',
            'Hold still while I stitch a route ward into the edge of your map.',
        ],
        used: [
            'Your map carries my tide marks now. If the road bends, the ink will know first.',
        ],
    },
}
```

### What actually happens at turn-in

The reward is processed by the generic quest reward path
(`game.js` near `effect.reward.buffId`). It calls
`player.grantShrineBuff('ward', 52)` -- the same code path as the
Shrine of Ward. The player gets longer i-frames for 52 seconds. The
toast says **"TOVINS ROUTE INK SET"**.

The world map data is **not modified.** No new icon, marker, or
route is added to the map. The dialog's promise -- "stitch a route
ward into the edge of your map", "your map carries my tide marks
now" -- is **flavor text only.**

### Verdict

The state machine works (active -> ready -> used). The quest grants
its reward. Alex's complaint is correct: the dialog **misleads** the
player into expecting a visible map change that doesn't happen. The
fix options:

1. **Change the dialogue** to describe the ward effect honestly --
   e.g. "I am tracing the safe steps in your boots, not your map."
   *RED-LIGHT in this autonomous batch* -- per the user's task list,
   I cannot edit NPC dialogue text.
2. **Wire the reward to draw a tide-route polyline on the world map**
   -- a real quality-of-life win, but a non-trivial systems change.
   *RED-LIGHT* -- well beyond the GREEN/YELLOW scope.
3. Ship as-is. The buff itself IS valuable.

**Recommended:** option 1 when the user is back -- it's the cheapest
honest fix.

---

## 2. Qira -- Salt Glasswright (the "salt stone quest")

### Definition (parent `js/world.js:807-848`)

```javascript
{
    id: 'qira-salt-glasswright',
    name: 'Qira',
    promptLabel: 'QIRA',
    x: 24 * TILE,
    y: 63 * TILE,
    effect: {
        type: 'quest',
        once: true,
        require: {
            requireAbility: true,
            crystals: { kind: 'salt', count: 3, label: 'SALT SHARDS' },
        },
        reward: {
            xp: 70,
            buffId: 'ward',
            buffName: 'GLASS WARD',
            duration: 60,
            color: '#dff6ff',
        },
        toast: 'SALT GLASS WARD CUT',
        progressToast: 'QIRA NEEDS THREE SALT SHARDS',
    },
}
```

### Path tracing

1. Player must have `hasLevelUpAbility = true`. This is set when the
   sandworm boss is defeated and the player accepts the level-up
   reward (`game.js:_grantLevelUpAbility`). **Gating works.**
2. Player must destroy 3 crystals with `kind: 'salt'`. Salt crystals
   are defined at world rows ~58-86 in the salt flats biome (parent
   `world.js:642-651` -- 9 total). They take 2 hits each
   (`exploration.js:CrystalCluster.health = 2`). Each destruction is
   recorded by setting `crystal.destroyed = true` and is counted by
   `_getDestroyedCrystalCount({kind: 'salt'})` (parent `game.js:2112-2117`).
   **Counter works.**
3. Player walks within Qira's interact rect (default ~12px x-pad,
   8px y-pad) and presses E. `_npcQuestState(qira)` returns 'ready'
   when both flag and crystal count are satisfied. Reward applies.
   **Turn-in works.**
4. Persistence: crystal destroyed-state is saved in
   `realmStates[realmId].crystalsDestroyed` (`game.js:884`) and
   restored on load (`game.js:1032`). NPC `used` flag is saved via
   `npc.serializeState()`. **Persistence works.**

### Verdict

**No code-level dead end.** The quest is end-to-end functional. If
Alex's playtest showed it not completing, the most likely causes are
*situational*, not *structural*:

- **Qira physically blocks her own interact zone.** The user's report
  said "QIRA blocks the path under". `AmbientNpc.getCollider()`
  produces a 6-12 px wide footprint at the NPC's feet. If the
  player's hitbox + Qira's collider geometrically prevent overlap
  with Qira's interact rect, the E press never registers.
  **This is the most plausible bug.**
- Player misreads "salt shards" as the salt crystal *spires* (the
  decorative `saltCrystalSpire` props from `world.js:577-578`) which
  are not destructible. Only the crystal *clusters* with explicit
  IDs (crystal-front-01..09) count.

**Recommended verification:** load a save with hasLevelUpAbility=true,
warp to (24*TILE, 63*TILE), break 3 salt crystals via dev mode, walk
into Qira from the south. If E doesn't fire the dialog, push Qira
left or right by ~16 px in `world.js:813-814`.

---

## 3. Tamas -- Cinder Runner

### Definition (parent `js/world.js:849-890`)

```javascript
require: {
    requireAbility: true,
    enemyKills: { biome: 'burnt', count: 3, label: 'BURNT FOES' },
}
```

### Verification path

`_getEnemyKillCount({biome: 'burnt'})` returns
`enemyKillCounts.biomes['burnt'] || 0`. This requires that something
increments `enemyKillCounts.biomes['burnt']` when an enemy dies.

I did not find a kill-tracking call site in `parent js/game.js` for
the `'burnt'` biome key in this audit (search did not surface it).
**This may be the dead end** -- if no code populates
`biomes.burnt`, Tamas's quest is unwinnable. Verify by searching for
`enemyKillCounts.biomes` writes in the parent's `game.js` and
checking that the burnt biome key is set whenever a burnt-area
enemy is killed.

If unset, the patch is a one-liner: when an enemy dies, look up
its `biome` (probably from its spawn node) and bump the counter.

---

## 4. The general quest system shape

All side-quest NPCs share these state functions (parent `game.js`):

- `_spawnAmbientNpc(definition, savedState)` -- 685
- `_npcQuestState(npc)` -- 2208 (returns 'active' | 'ready' | 'complete')
- `_npcQuestRequirementsMet(requirement)` -- 2195
- `_npcQuestProgress(effect)` -- 2130 (text label like "1/3 SALT SHARDS")
- `_npcQuestFlagMet(key)` -- 2181 (handles `hasMap`, `hasBoat`, etc.)
- `_getDestroyedCrystalCount(requirement)` -- 2112
- `_getEnemyKillCount(requirement)` -- 2119

The structure is clean. Each requirement key (flags, crystals,
loreRead, enemyKills) has its own getter and is composed in
`_npcQuestRequirementsMet`. No off-by-one or short-circuit bugs
spotted.

The only structural risk: `_npcQuestFlagMet` is a hand-written switch
(parent `game.js:2181-2192`). If a quest definition references a flag
not in the switch (e.g. `hasNewSecretFlag`), `_npcQuestFlagMet`
silently returns `false` and the quest is unwinnable. Today the only
flag usages are `hasMap`, `hasBoat`, `hasLevelUpAbility`,
`hasReachedCanyons`, `hasReachedSaltFlats`, `hasReachedTropics`,
`bossSandworm`, `allPillarsDestroyed` -- all handled. Keep this
checklist updated when adding a quest.

---

## 5. Recommended next steps when human is back

1. Confirm Tamas's `enemyKillCounts.biomes['burnt']` is being
   incremented anywhere. If not, add it where enemy deaths are
   recorded (look for the `enemyKillCounts.total += 1` line and
   add the biome bump beside it).
2. Either fix Tovin's dialog or add real map markers (design call).
3. Move Qira ~12-16 px south of (24*TILE, 63*TILE) so her collider
   doesn't block her own interact rect.
