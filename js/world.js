import { TILE } from './constants.js?v=20260416-realm-split';

const SOLID = new Set([0, 1, 6, 7, 8]);
const SOLID_BOAT = new Set([2, 3, 4, 5, 6, 7, 8]);

const BIOMES = Object.freeze({
    driftmere: {
        key: 'driftmere',
        label: 'DRIFTMERE ISLE',
        hudLabel: 'DRIFTMERE',
        accent: '#8effec',
    },
    desert: {
        key: 'desert',
        label: 'AMBERWAKE DESERT',
        hudLabel: 'AMBERWAKE',
        accent: '#ffd27b',
    },
    canyon: {
        key: 'canyon',
        label: 'RUST-ROCK CANYONS',
        hudLabel: 'RUST-ROCK',
        accent: '#ff9a70',
    },
    salt: {
        key: 'salt',
        label: 'SHIMMERING SALT FLATS',
        hudLabel: 'SALT FLATS',
        accent: '#dff6ff',
    },
    tropics: {
        key: 'tropics',
        label: 'SUNKEN TROPICS',
        hudLabel: 'TROPICS',
        accent: '#6fffd5',
    },
    burnt: {
        key: 'burnt',
        label: 'BURNT PLAINS',
        hudLabel: 'BURNT PLAINS',
        accent: '#ff7a4a',
    },
    steppe: {
        key: 'steppe',
        label: 'DUSTSTEPPE WILDS',
        hudLabel: 'DUSTSTEPPE',
        accent: '#c8b06a',
    },
});

function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

function pointInEllipse(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
}

function ellipseDistance(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return Math.sqrt(dx * dx + dy * dy);
}

export class World {
    constructor(assets, realmId = 'driftmere') {
        this.assets = assets;
        this.entityColliders = [];
        this.realmId = realmId === 'frontier' ? 'frontier' : 'driftmere';

        if (this.realmId === 'frontier') {
            this._setupFrontier();
        } else {
            this._setupDriftmere();
        }

        this.pixelW = this.cols * TILE;
        this.pixelH = this.rows * TILE;

        this.map = this._buildMap();
        this.decorProps = this._buildDecorProps();
        this.structures = this._buildStructures();
        this.propColliders = this._buildPropColliders();

        this.noise = [];
        for (let row = 0; row < this.rows; row++) {
            this.noise[row] = [];
            for (let col = 0; col < this.cols; col++) {
                this.noise[row][col] = this._hash(col, row);
            }
        }
    }

    _setupDriftmere() {
        this.realmLabel = 'DRIFTMERE ISLE';
        this.mapTitle = 'DRIFTMERE ISLE';

        this.rows = 72;
        this.cols = 104;

        this.arrivalPoints = {
            start: { x: 24 * TILE, y: 34 * TILE },
            fromFrontier: { x: 58 * TILE, y: 32 * TILE },
        };
        this.playerSpawn = { ...this.arrivalPoints.start };
        this.elaraSpawn = { x: 28 * TILE, y: 32 * TILE };
        this.boatmanSpawn = { x: 46 * TILE, y: 59 * TILE };
        this.boatSpawn = { x: 44 * TILE, y: 63 * TILE };
        this.tombstoneSpawn = { x: 22 * TILE, y: 36 * TILE };
        this.treasureChestSpawn = null;
        this.pillarSpawns = [];
        this.sandwormSpawn = null;

        this.bridgeFocus = { x: 65 * TILE + 8, y: 32 * TILE + 8 };
        this.scoutFocus = { x: 24 * TILE + 8, y: 34 * TILE + 8 };
        this.portalDefs = [
            {
                id: 'amberwake-gate',
                x: 65 * TILE + 8,
                y: 32 * TILE + 14,
                targetRealmId: 'frontier',
                arrivalKey: 'fromDriftmere',
                prompt: 'E: ENTER AMBERWAKE GATE',
                markerType: 'portal',
            },
        ];
        this.portalFocus = { x: 65 * TILE + 8, y: 32 * TILE + 8 };
        this.eastIsleThreshold = Number.POSITIVE_INFINITY;

        this.landmarks = {
            camp: { x: 24 * TILE + 8, y: 34 * TILE + 8, label: 'STARFALL CAMP' },
            portal: { x: 65 * TILE + 8, y: 32 * TILE + 8, label: 'AMBERWAKE GATE' },
            lighthouse: { x: 78 * TILE + 8, y: 46 * TILE + 8, label: 'DRIFT LANTERN' },
            southCamp: { x: 48 * TILE + 8, y: 60 * TILE + 8, label: 'TIDEBREAK CAMP' },
            wreck: { x: 86 * TILE + 8, y: 36 * TILE + 8, label: 'NORTHWIND WRECK' },
        };

        this.fixedEnemySpawns = [
            { kind: 'blightworm', x: 43 * TILE + 2, y: 21 * TILE + 2 },
            { kind: 'blightworm', x: 48 * TILE + 2, y: 42 * TILE + 2 },
            { kind: 'blightworm', x: 62 * TILE + 2, y: 24 * TILE + 2 },
            { kind: 'blightworm', x: 65 * TILE + 2, y: 37 * TILE + 2 },
        ];

        this.enemySpawnNodes = [
            { kind: 'blightworm', x: 47 * TILE + 8, y: 22 * TILE + 8, interval: 11, maxAlive: 3, leashRadius: 80, activationRadius: 260 },
            { kind: 'blightworm', x: 62 * TILE + 8, y: 38 * TILE + 8, interval: 10, maxAlive: 3, leashRadius: 80, activationRadius: 260 },
            { kind: 'blightworm', x: 36 * TILE + 8, y: 18 * TILE + 8, interval: 12, maxAlive: 2, leashRadius: 72, activationRadius: 240 },
            { kind: 'blightworm', x: 52 * TILE + 8, y: 46 * TILE + 8, interval: 12, maxAlive: 2, leashRadius: 72, activationRadius: 240 },
            // Southern peninsula wilds
            { kind: 'blightworm', x: 30 * TILE + 8, y: 58 * TILE + 8, interval: 12, maxAlive: 2, leashRadius: 76, activationRadius: 250 },
            { kind: 'blightworm', x: 52 * TILE + 8, y: 62 * TILE + 8, interval: 11, maxAlive: 3, leashRadius: 80, activationRadius: 260 },
            // Eastern archipelago stragglers
            { kind: 'blightworm', x: 82 * TILE + 8, y: 40 * TILE + 8, interval: 14, maxAlive: 2, leashRadius: 72, activationRadius: 240 },
        ];

        this.loreStoneSpawns = [
            { id: 'lore-driftmere-01', x: 18 * TILE + 8, y: 28 * TILE + 14, title: 'WEATHERED STELE', body: 'FIRST KEEPERS LIT THE DRIFT LANTERNS HERE. THE ISLE REMEMBERS EVERY LOSS.' },
            { id: 'lore-driftmere-02', x: 36 * TILE + 8, y: 17 * TILE + 14, title: 'MOSSY STONE', body: 'ELARA WAS BORN BENEATH STARFALL SKY. SHE SAW THE AMBERWAKE RISE AS A CHILD.' },
            { id: 'lore-driftmere-03', x: 51 * TILE + 8, y: 19 * TILE + 14, title: 'CRACKED RUNE', body: 'WHERE THE SEA MEETS THE SAND, OLD MAGIC STILL WALKS. TREAD QUIET OR BE SEEN.' },
            { id: 'lore-driftmere-04', x: 72 * TILE + 8, y: 24 * TILE + 14, title: 'WORN MARKER', body: 'THE SANDWORM WAS ONCE A GUARDIAN. NOW IT HUNGERS FOR THE LIGHT IT LOST.' },
            { id: 'lore-driftmere-05', x: 50 * TILE + 8, y: 46 * TILE + 14, title: 'SALT-BLEACHED SHARD', body: 'A PILGRIM FELL HERE. THEIR BLADE BECAME YOUR INHERITANCE.' },
            { id: 'lore-driftmere-06', x: 32 * TILE + 8, y: 56 * TILE + 14, title: 'CIRCLE STONE', body: 'THE OLD KEEPERS DANCED HERE BY STAR-LIGHT. THE TIDE REMEMBERS THEIR STEPS.' },
            { id: 'lore-driftmere-07', x: 86 * TILE + 8, y: 36 * TILE + 14, title: 'WRECKED HULL PLANK', body: 'HER NAME WAS THE NORTHWIND. SHE CARRIED TWELVE SOULS AND ONE STARFIRE LANTERN.' },
            { id: 'lore-driftmere-08', x: 62 * TILE + 8, y: 56 * TILE + 14, title: 'BROKEN FINGER PILLAR', body: 'SOUTH OF HERE THE ISLE DROPS INTO UNMAPPED DEPTHS. FEW RETURN FROM BELOW.' },
        ];

        this.shrineSpawns = [
            { id: 'shrine-driftmere-might', kind: 'might', x: 28 * TILE + 8, y: 30 * TILE + 14 },
            { id: 'shrine-driftmere-swift', kind: 'swift', x: 58 * TILE + 8, y: 34 * TILE + 14 },
            { id: 'shrine-driftmere-ward', kind: 'ward', x: 48 * TILE + 8, y: 58 * TILE + 14 },
        ];

        // Aether Font — a crystalline tide-shrine. Visible from spawn, placed
        // just east of Starfall Camp so the player bumps into it on the way
        // to everything else.
        this.aetherFontSpawns = [
            { id: 'aether-font-drift-01', x: 32 * TILE + 8, y: 30 * TILE + 14 },
        ];

        // Mnemoforge — a Zen'Korah respec altar. Tucked into the southern
        // beach where the existing Shardfang path naturally leads, so no new
        // traversal route is required.
        this.mnemoforgeSpawns = [
            { id: 'mnemoforge-drift-01', x: 24 * TILE + 8, y: 54 * TILE + 14 },
        ];

        this.crystalSpawns = [
            { id: 'crystal-drift-01', kind: 'tidestone', x: 14 * TILE + 8, y: 22 * TILE + 14 },
            { id: 'crystal-drift-02', kind: 'tidestone', x: 69 * TILE + 8, y: 41 * TILE + 14 },
            { id: 'crystal-drift-03', kind: 'tidestone', x: 17 * TILE + 8, y: 41 * TILE + 14 },
            { id: 'crystal-drift-04', kind: 'tidestone', x: 44 * TILE + 8, y: 60 * TILE + 14 },
            { id: 'crystal-drift-05', kind: 'tidestone', x: 58 * TILE + 8, y: 58 * TILE + 14 },
        ];

        this.npcSpawns = [
            {
                id: 'mira-tide-medic',
                name: 'Mira',
                title: 'Tide Medic',
                promptLabel: 'MIRA',
                variant: 'tide-medic',
                x: 51 * TILE,
                y: 59 * TILE,
                effect: { type: 'heal', cooldown: 42, toast: 'TIDE MEDIC PATCHED YOU UP' },
                dialog: {
                    ready: [
                        'Sit still. Driftmere salt keeps wounds honest, but I can keep them closed.',
                        'Breathe deep. I will stitch the worst of it and send you back out standing.',
                    ],
                    cooldown: [
                        'I already burned through my sea-thread on you. Give me {cooldown} seconds and I will be ready again.',
                    ],
                },
            },
            {
                id: 'cadrin-lantern-keeper',
                name: 'Cadrin',
                title: 'Lantern Keeper',
                promptLabel: 'CADRIN',
                variant: 'lantern-keeper',
                x: 75 * TILE,
                y: 46 * TILE,
                effect: {
                    type: 'buff',
                    buffId: 'ward',
                    buffName: 'LANTERN WARD',
                    duration: 55,
                    cooldown: 70,
                },
                dialog: {
                    ready: [
                        'The lighthouse is not just for ships. I feed it old ward-fire so the dark looks elsewhere.',
                        'Stand in the glow a moment. It will take the edge off the next hard hit.',
                    ],
                    cooldown: [
                        'The ward-flame is still gathering itself. Come back in {cooldown} seconds.',
                    ],
                },
            },
            {
                id: 'nyra-wayfinder',
                name: 'Nyra',
                title: 'Wayfinder',
                promptLabel: 'NYRA',
                variant: 'ember-guide',
                x: 61 * TILE,
                y: 30 * TILE,
                effect: {
                    type: 'buff',
                    buffId: 'swift',
                    buffName: 'WAYFINDER STEP',
                    duration: 45,
                    cooldown: 64,
                },
                dialog: {
                    ready: [
                        'The old courier road still snakes past this gate even if the sand pretends otherwise.',
                        'Take this wind-mark. It lightens your step when the dunes start lying.',
                    ],
                    cooldown: [
                        'Keep the pace I gave you. I can freshen it again in {cooldown} seconds.',
                    ],
                },
            },
            {
                id: 'eamon-wreck-diver',
                name: 'Eamon',
                title: 'Wreck Diver',
                promptLabel: 'EAMON',
                variant: 'moss-fisher',
                x: 83 * TILE,
                y: 38 * TILE,
                effect: {
                    type: 'xp',
                    amount: 40,
                    toast: 'NORTHWIND NOTES SHARED',
                    once: true,
                    requireAbility: true,
                },
                dialog: {
                    ready: [
                        'Pulled these route notes from the Northwind wreck. Currents, shoals, ambush coves.',
                        'Take them. Knowing where not to drown is worth more than coin out here.',
                    ],
                    locked: [
                        'I can give you the notes, but they will only matter once the relic wakes your memory for them.',
                    ],
                    used: [
                        'Already gave you every note that was not rotten. The rest belongs to the sea.',
                    ],
                },
            },
            {
                id: 'suri-stone-reader',
                name: 'Suri',
                title: 'Stone Reader',
                promptLabel: 'SURI',
                variant: 'glow-warden',
                x: 33 * TILE,
                y: 55 * TILE,
                effect: {
                    type: 'buff',
                    buffId: 'might',
                    buffName: 'KEEPER RHYTHM',
                    duration: 45,
                    cooldown: 64,
                },
                dialog: {
                    ready: [
                        'These stones remember the keepers battle-hymns.',
                        'Touch the circle and let the old rhythm harden your swing.',
                    ],
                    cooldown: [
                        'The circle is still ringing through your arms. Return in {cooldown} seconds.',
                    ],
                },
            },
            {
                id: 'tovin-tide-cartographer',
                name: 'Tovin',
                title: 'Tide Cartographer',
                promptLabel: 'TOVIN',
                variant: 'drift-scout',
                x: 67 * TILE,
                y: 31 * TILE,
                effect: {
                    type: 'quest',
                    once: true,
                    require: {
                        flags: { hasMap: 'ELARAS MAP' },
                    },
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
                    active: [
                        'I can mark the tide-road around this gate, but I need Elaras map first.',
                        'Bring me a real chart and I will ink a safer route through the spray.',
                    ],
                    repeat: [
                        'No map yet. Find Elara at Starfall Camp, then bring her chart here.',
                    ],
                    ready: [
                        'There it is. Elara keeps cleaner lines than any sailor I know.',
                        'Hold still while I stitch a route ward into the edge of your map.',
                    ],
                    used: [
                        'Your map carries my tide marks now. If the road bends, the ink will know first.',
                    ],
                },
            },
            {
                id: 'luma-shell-courier',
                name: 'Luma',
                title: 'Shell Courier',
                promptLabel: 'LUMA',
                variant: 'glow-warden',
                x: 57 * TILE,
                y: 57 * TILE,
                effect: {
                    type: 'quest',
                    once: true,
                    require: {
                        crystals: { kind: 'tidestone', count: 3, label: 'TIDESTONES' },
                    },
                    reward: {
                        buffId: 'swift',
                        buffName: 'COURIER STEP',
                        duration: 58,
                        heal: 1,
                        color: '#f6a7ff',
                    },
                    toast: 'SHELL COURIER ROUTE OPENED',
                    progressToast: 'LUMA LISTENS FOR THREE TIDESTONES',
                },
                dialog: {
                    active: [
                        'My shell-bag only sings when tidestones crack open nearby.',
                        'Break three of them around Driftmere. I will hear the route wake up. Progress: {progress}.',
                    ],
                    repeat: [
                        'The shells are still quiet. I have heard {progress}. Three will be enough.',
                    ],
                    ready: [
                        'There. The bag is humming like stormwater in a cave.',
                        'Take the courier step. It is quick, light, and a little rude to gravity.',
                    ],
                    used: [
                        'Route is open and the shells are pleased. Try not to outrun your own boots.',
                    ],
                },
            },
            {
                id: 'fenn-moon-ferrier',
                name: 'Fenn',
                title: 'Moon Ferrier',
                promptLabel: 'FENN',
                variant: 'moss-fisher',
                x: 89 * TILE,
                y: 37 * TILE,
                effect: {
                    type: 'quest',
                    once: true,
                    require: {
                        requireAbility: true,
                        flags: { hasBoat: 'ROWBOAT' },
                    },
                    reward: {
                        xp: 90,
                        skillPoints: 1,
                        color: '#dff6ff',
                    },
                    toast: 'MOON FERRY ROUTE REMEMBERED',
                    progressToast: 'FENN WAITS FOR A PROPER BOAT',
                },
                dialog: {
                    active: [
                        'The Northwind wreck still pulls at the moon-tide. I need a rowboat before I can read it.',
                        'Earn one from the Boatman, then come back when the relic in you can remember the route.',
                    ],
                    repeat: [
                        'No boat, no moon-route. Defeat the worm, speak with the Boatman, and return.',
                    ],
                    ready: [
                        'Good. You smell of oarwood and impossible water.',
                        'I ferried dreams by these reefs once. Take the memory before the tide eats it.',
                    ],
                    used: [
                        'You carry the moon-route now. The wreck will not fool you twice.',
                    ],
                },
            },
        ];

        this.mapMarkers = [
            { type: 'camp', x: this.landmarks.camp.x, y: this.landmarks.camp.y, label: this.landmarks.camp.label },
            { type: 'portal', x: this.landmarks.portal.x, y: this.landmarks.portal.y, label: this.landmarks.portal.label },
            { type: 'lighthouse', x: this.landmarks.lighthouse.x, y: this.landmarks.lighthouse.y, label: this.landmarks.lighthouse.label },
            { type: 'camp', x: this.landmarks.southCamp.x, y: this.landmarks.southCamp.y, label: this.landmarks.southCamp.label },
            { type: 'wreck', x: this.landmarks.wreck.x, y: this.landmarks.wreck.y, label: this.landmarks.wreck.label },
        ];
    }

    _setupFrontier() {
        this.realmLabel = 'SUNCLEFT FRONTIER';
        this.mapTitle = 'SUNCLEFT FRONTIER';

        this.rows = 124;
        this.cols = 180;

        this.arrivalPoints = {
            start: { x: 88 * TILE, y: 46 * TILE },
            fromDriftmere: { x: 92 * TILE, y: 46 * TILE },
        };
        this.playerSpawn = { ...this.arrivalPoints.start };
        this.elaraSpawn = null;
        this.boatmanSpawn = null;
        this.boatSpawn = null;
        this.tombstoneSpawn = { x: 91 * TILE, y: 50 * TILE };
        this.treasureChestSpawn = {
            id: 'sunken-relic-chest',
            x: 63 * TILE + 8,
            y: 74 * TILE + 14,
            prompt: 'E: CLAIM RELIC',
        };

        this.bridgeFocus = { x: 79 * TILE + 8, y: 18 * TILE + 8 };
        this.scoutFocus = { x: 24 * TILE + 8, y: 50 * TILE + 8 };
        this.portalDefs = [
            {
                id: 'driftmere-return-gate',
                x: 92 * TILE + 8,
                y: 45 * TILE + 14,
                targetRealmId: 'driftmere',
                arrivalKey: 'fromFrontier',
                prompt: 'E: RETURN TO DRIFTMERE',
                markerType: 'portal',
            },
        ];
        this.portalFocus = {
            x: this.treasureChestSpawn.x,
            y: this.treasureChestSpawn.y - 10,
        };

        this.pillarSpawns = [
            {
                id: 'pillar-canyon',
                biome: 'canyon',
                x: 90 * TILE + 8,
                y: 21 * TILE + 14,
                accent: '#ff9a70',
            },
            {
                id: 'pillar-salt',
                biome: 'salt',
                x: 25 * TILE + 8,
                y: 53 * TILE + 14,
                accent: '#dff6ff',
            },
            {
                id: 'pillar-tropics',
                biome: 'tropics',
                x: 67 * TILE + 8,
                y: 67 * TILE + 14,
                accent: '#6fffd5',
            },
        ];

        this.sandwormSpawn = {
            x: 88 * TILE + 8,
            y: 46 * TILE + 8,
        };
        this.eastIsleThreshold = Number.POSITIVE_INFINITY;

        this.landmarks = {
            camp: { x: 88 * TILE + 8, y: 47 * TILE + 8, label: 'DUSTWAKE CAMP' },
            portal: { x: 92 * TILE + 8, y: 45 * TILE + 8, label: 'DRIFTMERE GATE' },
            canyons: { x: 79 * TILE + 8, y: 18 * TILE + 8, label: BIOMES.canyon.label },
            salt: { x: 24 * TILE + 8, y: 50 * TILE + 8, label: BIOMES.salt.label },
            tropics: { x: 72 * TILE + 8, y: 63 * TILE + 8, label: BIOMES.tropics.label },
            relic: { x: 63 * TILE + 8, y: 74 * TILE + 8, label: 'SUBMERGED RUINS' },
            burntPlain: { x: 150 * TILE + 8, y: 44 * TILE + 8, label: BIOMES.burnt.label },
            watchtower: { x: 162 * TILE + 8, y: 62 * TILE + 8, label: 'LAST WATCHTOWER' },
            stoneCircle: { x: 148 * TILE + 8, y: 22 * TILE + 8, label: 'PILGRIM STONES' },
            steppe: { x: 85 * TILE + 8, y: 105 * TILE + 8, label: BIOMES.steppe.label },
            southCamp: { x: 98 * TILE + 8, y: 105 * TILE + 8, label: 'ROADEND CAMP' },
            wreck: { x: 36 * TILE + 8, y: 92 * TILE + 8, label: 'SALT-WRECK' },
            brokenArch: { x: 135 * TILE + 8, y: 95 * TILE + 8, label: 'BROKEN ARCH' },
        };

        this.fixedEnemySpawns = [
            // Original desert-base enemies (kept as ambient threats)
            { kind: 'blightworm', x: 69 * TILE + 2, y: 42 * TILE + 2 },
            { kind: 'duneWarden', x: 59 * TILE + 2, y: 34 * TILE + 2 },
            { kind: 'duneWarden', x: 101 * TILE + 2, y: 32 * TILE + 2 },
            { kind: 'sunscarab', x: 26 * TILE + 2, y: 50 * TILE + 2 },
            { kind: 'sunscarab', x: 70 * TILE + 2, y: 21 * TILE + 2 },
            { kind: 'duneWarden', x: 88 * TILE + 2, y: 20 * TILE + 2 },
            { kind: 'blightworm', x: 83 * TILE + 2, y: 66 * TILE + 2 },

            // Rushers — canyon biome (rocky/cave)
            { kind: 'rusher', x: 78 * TILE + 2, y: 18 * TILE + 2 },
            { kind: 'rusher', x: 84 * TILE + 2, y: 22 * TILE + 2 },
            { kind: 'rusher', x: 92 * TILE + 2, y: 16 * TILE + 2 },
            { kind: 'rusher', x: 100 * TILE + 2, y: 24 * TILE + 2 },

            // Tactical Archers — salt flats (open sightlines for ranged)
            { kind: 'tacticalArcher', x: 22 * TILE + 2, y: 48 * TILE + 2 },
            { kind: 'tacticalArcher', x: 28 * TILE + 2, y: 56 * TILE + 2 },
            { kind: 'tacticalArcher', x: 18 * TILE + 2, y: 60 * TILE + 2 },

            // Goliath — tropics ruins (heavy boss-tier near submerged ruins)
            { kind: 'goliath', x: 70 * TILE + 2, y: 64 * TILE + 2 },
            { kind: 'goliath', x: 64 * TILE + 2, y: 70 * TILE + 2 },
        ];

        this.enemySpawnNodes = [
            // Original — tightened for livelier desert traffic
            { kind: 'sunscarab', x: 30 * TILE + 8, y: 58 * TILE + 8, interval: 10, maxAlive: 3, leashRadius: 80, activationRadius: 280 },
            { kind: 'duneWarden', x: 94 * TILE + 8, y: 22 * TILE + 8, interval: 14, maxAlive: 2, leashRadius: 86, activationRadius: 280 },
            { kind: 'blightworm', x: 82 * TILE + 8, y: 63 * TILE + 8, interval: 10, maxAlive: 3, leashRadius: 82, activationRadius: 280 },
            { kind: 'sunscarab', x: 68 * TILE + 8, y: 44 * TILE + 8, interval: 11, maxAlive: 3, leashRadius: 84, activationRadius: 280 },
            { kind: 'duneWarden', x: 58 * TILE + 8, y: 36 * TILE + 8, interval: 15, maxAlive: 2, leashRadius: 80, activationRadius: 260 },

            // Rusher swarms in the canyons — fast, low HP, frequent
            { kind: 'rusher', x: 86 * TILE + 8, y: 20 * TILE + 8, interval: 7, maxAlive: 4, leashRadius: 96, activationRadius: 280 },
            { kind: 'rusher', x: 96 * TILE + 8, y: 18 * TILE + 8, interval: 7, maxAlive: 4, leashRadius: 96, activationRadius: 280 },
            { kind: 'rusher', x: 78 * TILE + 8, y: 22 * TILE + 8, interval: 9, maxAlive: 3, leashRadius: 90, activationRadius: 260 },

            // Archer pickets in the salt flats
            { kind: 'tacticalArcher', x: 25 * TILE + 8, y: 52 * TILE + 8, interval: 15, maxAlive: 2, leashRadius: 108, activationRadius: 320 },
            { kind: 'tacticalArcher', x: 32 * TILE + 8, y: 60 * TILE + 8, interval: 16, maxAlive: 2, leashRadius: 108, activationRadius: 320 },
            { kind: 'tacticalArcher', x: 20 * TILE + 8, y: 45 * TILE + 8, interval: 18, maxAlive: 2, leashRadius: 104, activationRadius: 320 },

            // Goliath in the tropics ruins (rare, slow respawn)
            { kind: 'goliath', x: 72 * TILE + 8, y: 66 * TILE + 8, interval: 40, maxAlive: 1, leashRadius: 120, activationRadius: 280 },

            // Expanded frontier — eastern wasteland
            { kind: 'duneWarden', x: 140 * TILE + 8, y: 40 * TILE + 8, interval: 13, maxAlive: 2, leashRadius: 96, activationRadius: 300 },
            { kind: 'sunscarab', x: 152 * TILE + 8, y: 50 * TILE + 8, interval: 10, maxAlive: 3, leashRadius: 90, activationRadius: 280 },
            { kind: 'rusher', x: 148 * TILE + 8, y: 22 * TILE + 8, interval: 8, maxAlive: 3, leashRadius: 96, activationRadius: 260 },
            { kind: 'blightworm', x: 160 * TILE + 8, y: 68 * TILE + 8, interval: 12, maxAlive: 2, leashRadius: 80, activationRadius: 260 },
            { kind: 'tacticalArcher', x: 162 * TILE + 8, y: 62 * TILE + 8, interval: 18, maxAlive: 2, leashRadius: 120, activationRadius: 340 },

            // Expanded frontier — deep-south wildlands
            { kind: 'blightworm', x: 80 * TILE + 8, y: 100 * TILE + 8, interval: 11, maxAlive: 3, leashRadius: 84, activationRadius: 280 },
            { kind: 'duneWarden', x: 98 * TILE + 8, y: 108 * TILE + 8, interval: 15, maxAlive: 2, leashRadius: 86, activationRadius: 280 },
            { kind: 'sunscarab', x: 58 * TILE + 8, y: 102 * TILE + 8, interval: 11, maxAlive: 3, leashRadius: 88, activationRadius: 280 },
            { kind: 'rusher', x: 130 * TILE + 8, y: 95 * TILE + 8, interval: 9, maxAlive: 3, leashRadius: 90, activationRadius: 260 },
            { kind: 'goliath', x: 115 * TILE + 8, y: 88 * TILE + 8, interval: 45, maxAlive: 1, leashRadius: 120, activationRadius: 280 },

            // Salt flats southern extension
            { kind: 'tacticalArcher', x: 28 * TILE + 8, y: 90 * TILE + 8, interval: 17, maxAlive: 2, leashRadius: 108, activationRadius: 320 },
        ];

        this.loreStoneSpawns = [
            { id: 'lore-frontier-01', x: 78 * TILE + 8, y: 45 * TILE + 14, title: 'DUSTWAKE MARKER', body: 'THE FRONTIER WAS FARMLAND ONCE. THE AMBERWAKE SWALLOWED IT IN A SINGLE DUSK.' },
            { id: 'lore-frontier-02', x: 90 * TILE + 8, y: 19 * TILE + 14, title: 'RUST-ROCK OBELISK', body: 'CANYONS WERE CARVED BY A RIVER THAT REFUSED TO DIE. IT STILL WHISPERS AT NIGHT.' },
            { id: 'lore-frontier-03', x: 28 * TILE + 8, y: 56 * TILE + 14, title: 'SALT-ETCHED PLINTH', body: 'CROSS THE FLATS IN SILENCE. THE CRYSTALS LISTEN FOR FOOTSTEPS.' },
            { id: 'lore-frontier-04', x: 66 * TILE + 8, y: 68 * TILE + 14, title: 'SUNKEN RELIQUARY', body: 'THE TROPICS WERE A CITADEL. NOW ITS GUARDIANS STAND AS GOLEMS IN GREEN WATER.' },
            { id: 'lore-frontier-05', x: 50 * TILE + 8, y: 50 * TILE + 14, title: 'CROSSROADS STELE', body: 'FOUR WINDS MEET HERE. EACH CARRIES A DIFFERENT END.' },
            { id: 'lore-frontier-06', x: 101 * TILE + 8, y: 34 * TILE + 14, title: 'DUNE-BLED CAIRN', body: 'A SCOUT DIED MAPPING THIS ROUTE. HIS COMPASS STILL POINTS TRUE.' },
            // Expanded frontier lore
            { id: 'lore-frontier-07', x: 140 * TILE + 8, y: 42 * TILE + 14, title: 'BURNT-PLAIN CAIRN', body: 'EASTWARD LIES THE BURNT PLAIN. SUN SETS TWICE HERE — ONCE AT DUSK, ONCE BENEATH THE SAND.' },
            { id: 'lore-frontier-08', x: 158 * TILE + 8, y: 48 * TILE + 14, title: 'OBELISK OF CRACKED SKY', body: 'THE SIXTH PILLAR STOOD HERE. IT FELL WHEN THE WORM WOKE.' },
            { id: 'lore-frontier-09', x: 148 * TILE + 8, y: 24 * TILE + 14, title: 'STONE CIRCLE MARKER', body: 'PILGRIMS LEFT OFFERINGS AT EACH STONE. TIME TOOK ALL BUT THE STONES.' },
            { id: 'lore-frontier-10', x: 162 * TILE + 8, y: 60 * TILE + 14, title: 'WATCHTOWER STELE', body: 'THE LAST WATCHER SAW THREE BANNERS ADVANCE. HE RANG THE BELL ANYWAY.' },
            { id: 'lore-frontier-11', x: 98 * TILE + 8, y: 104 * TILE + 14, title: 'TRAVELER\'S STONE', body: 'SOUTH OF DUSTWAKE, ROADS FORGET THEMSELVES. TRAVELER, REMEMBER YOURS.' },
            { id: 'lore-frontier-12', x: 80 * TILE + 8, y: 98 * TILE + 14, title: 'WELL-STONE EPITAPH', body: 'THIS WELL WAS DRY BEFORE I WAS BORN. IT STILL DRINKS WHAT FALLS INTO IT.' },
            { id: 'lore-frontier-13', x: 135 * TILE + 8, y: 93 * TILE + 14, title: 'BROKEN-ARCH RUNE', body: 'WHERE THE GATE STOOD, NO GATEKEEPERS REMAIN. THE WAY IS OPEN. WALK IT KNOWING.' },
            { id: 'lore-frontier-14', x: 36 * TILE + 8, y: 90 * TILE + 14, title: 'SALT-WRECK EPITAPH', body: 'THIS SHIP SAILED SAND, NOT SEA. ITS CREW BELIEVED THE DUNES WOULD CARRY THEM HOME.' },
        ];

        this.shrineSpawns = [
            { id: 'shrine-frontier-might', kind: 'might', x: 60 * TILE + 8, y: 30 * TILE + 14 },
            { id: 'shrine-frontier-swift', kind: 'swift', x: 36 * TILE + 8, y: 54 * TILE + 14 },
            { id: 'shrine-frontier-ward', kind: 'ward', x: 75 * TILE + 8, y: 60 * TILE + 14 },
            { id: 'shrine-frontier-might-east', kind: 'might', x: 148 * TILE + 8, y: 44 * TILE + 14 },
            { id: 'shrine-frontier-swift-south', kind: 'swift', x: 98 * TILE + 8, y: 102 * TILE + 14 },
            { id: 'shrine-frontier-ward-east', kind: 'ward', x: 162 * TILE + 8, y: 66 * TILE + 14 },
        ];

        // Frontier has no Aether Font yet — reserved for future expansion.
        this.aetherFontSpawns = [];
        this.mnemoforgeSpawns = [];

        this.crystalSpawns = [
            { id: 'crystal-front-01', kind: 'salt', x: 22 * TILE + 8, y: 58 * TILE + 14 },
            { id: 'crystal-front-02', kind: 'salt', x: 30 * TILE + 8, y: 42 * TILE + 14 },
            { id: 'crystal-front-03', kind: 'amber', x: 55 * TILE + 8, y: 42 * TILE + 14 },
            { id: 'crystal-front-04', kind: 'amber', x: 77 * TILE + 8, y: 52 * TILE + 14 },
            { id: 'crystal-front-05', kind: 'rust', x: 92 * TILE + 8, y: 26 * TILE + 14 },
            // Expanded frontier crystals
            { id: 'crystal-front-06', kind: 'rust', x: 150 * TILE + 8, y: 24 * TILE + 14 },
            { id: 'crystal-front-07', kind: 'amber', x: 156 * TILE + 8, y: 52 * TILE + 14 },
            { id: 'crystal-front-08', kind: 'amber', x: 142 * TILE + 8, y: 68 * TILE + 14 },
            { id: 'crystal-front-09', kind: 'salt', x: 28 * TILE + 8, y: 86 * TILE + 14 },
            { id: 'crystal-front-10', kind: 'rust', x: 118 * TILE + 8, y: 90 * TILE + 14 },
            { id: 'crystal-front-11', kind: 'amber', x: 82 * TILE + 8, y: 104 * TILE + 14 },
        ];

        this.npcSpawns = [
            {
                id: 'dax-canyon-lookout',
                name: 'Dax',
                title: 'Canyon Lookout',
                promptLabel: 'DAX',
                variant: 'dusk-guard',
                x: 81 * TILE,
                y: 19 * TILE,
                effect: {
                    type: 'buff',
                    buffId: 'swift',
                    buffName: 'SCOUT PACE',
                    duration: 50,
                    cooldown: 64,
                },
                dialog: {
                    ready: [
                        'The canyons reward speed. Stop moving and the rushers will make a door out of your ribs.',
                        'Take a scouts pace. Cover ground before they can box you in.',
                    ],
                    cooldown: [
                        'Keep moving. I can sharpen your pace again in {cooldown} seconds.',
                    ],
                },
            },
            {
                id: 'veya-salt-scribe',
                name: 'Veya',
                title: 'Salt Scribe',
                promptLabel: 'VEYA',
                variant: 'salt-scribe',
                x: 26 * TILE,
                y: 49 * TILE,
                effect: {
                    type: 'xp',
                    amount: 60,
                    toast: 'SALT CHARTS STUDIED',
                    once: true,
                    requireAbility: true,
                },
                dialog: {
                    ready: [
                        'I map the flats by echo and glint.',
                        'Keep these bearings. They will save you three wrong turns and one ugly death.',
                    ],
                    locked: [
                        'Take the charts after the relic wakes your memory. Before that they are only pretty scratches.',
                    ],
                    used: [
                        'My cleanest routes are already in your hands. The rest change with every storm.',
                    ],
                },
            },
            {
                id: 'ila-herbalist',
                name: 'Ila',
                title: 'Tropic Herbalist',
                promptLabel: 'ILA',
                variant: 'glow-warden',
                x: 69 * TILE,
                y: 64 * TILE,
                effect: { type: 'heal', cooldown: 46, toast: 'HERBAL DRAUGHT RESTORED YOU' },
                dialog: {
                    ready: [
                        'The tropics grow a leaf for every poison in the Frontier.',
                        'Hold still. This brew stings first and heals second.',
                    ],
                    cooldown: [
                        'The kettle is still steeping. Return in {cooldown} seconds and I will patch you up again.',
                    ],
                },
            },
            {
                id: 'bronn-road-smith',
                name: 'Bronn',
                title: 'Road Smith',
                promptLabel: 'BRONN',
                variant: 'road-smith',
                x: 99 * TILE,
                y: 104 * TILE,
                effect: {
                    type: 'buff',
                    buffId: 'might',
                    buffName: 'ROADEND TEMPER',
                    duration: 50,
                    cooldown: 68,
                },
                dialog: {
                    ready: [
                        'I hammer cracked salvage into something meaner.',
                        'Lift your blade. I will ring it true for a while.',
                    ],
                    cooldown: [
                        'That edge is still hot. Come back in {cooldown} seconds for another tempering.',
                    ],
                },
            },
            {
                id: 'orra-watch-captain',
                name: 'Orra',
                title: 'Watch Captain',
                promptLabel: 'ORRA',
                variant: 'salt-quartermaster',
                x: 160 * TILE,
                y: 60 * TILE,
                effect: {
                    type: 'buff',
                    buffId: 'ward',
                    buffName: 'CAPTAINS WARD',
                    duration: 60,
                    cooldown: 72,
                },
                dialog: {
                    ready: [
                        'When the watchtower lantern burns cold, the worm stirs.',
                        'Borrow a captains ward before you go breaking more pillars.',
                    ],
                    cooldown: [
                        'My ward is still on you. Hold the line and return in {cooldown} seconds.',
                    ],
                },
            },
            {
                id: 'kael-burnt-guide',
                name: 'Kael',
                title: 'Burnt Guide',
                promptLabel: 'KAEL',
                variant: 'moss-fisher',
                x: 147 * TILE,
                y: 43 * TILE,
                effect: {
                    type: 'xp',
                    amount: 80,
                    toast: 'BLACKGLASS ROUTE MEMORIZED',
                    once: true,
                    requireAbility: true,
                },
                dialog: {
                    ready: [
                        'The burnt plain cooks fools who wander blind.',
                        'Follow the black-glass ridges. Start with this route and the plain might let you leave alive.',
                    ],
                    locked: [
                        'I can show you the black-glass route after the relic wakes your memory for hard lessons.',
                    ],
                    used: [
                        'You already carry my cleanest route. From here on, trust your own legs.',
                    ],
                },
            },
            {
                id: 'qira-salt-glasswright',
                name: 'Qira',
                title: 'Salt Glasswright',
                promptLabel: 'QIRA',
                variant: 'salt-scribe',
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
                dialog: {
                    active: [
                        'Salt glass only tells truth after it breaks.',
                        'Shatter three bright clusters in the flats, then bring me the echo. Progress: {progress}.',
                    ],
                    repeat: [
                        'I have heard {progress}. Keep your ears covered when the next shard screams.',
                    ],
                    ready: [
                        'Sharp, clean, and loud. That is good salt.',
                        'I cut a ward from the sound. Wear it before the archers draw a line through you.',
                    ],
                    used: [
                        'The glass has gone quiet. Your ward holds the loudest piece.',
                    ],
                },
            },
            {
                id: 'tamas-cinder-runner',
                name: 'Tamas',
                title: 'Cinder Runner',
                promptLabel: 'TAMAS',
                variant: 'ember-guide',
                x: 144 * TILE,
                y: 54 * TILE,
                effect: {
                    type: 'quest',
                    once: true,
                    require: {
                        requireAbility: true,
                        enemyKills: { biome: 'burnt', count: 3, label: 'BURNT FOES' },
                    },
                    reward: {
                        xp: 85,
                        buffId: 'swift',
                        buffName: 'CINDER RUN',
                        duration: 65,
                        color: '#ff7a4a',
                    },
                    toast: 'CINDER RUN LEARNED',
                    progressToast: 'TAMAS WANTS THREE BURNT FOES DROPPED',
                },
                dialog: {
                    active: [
                        'The burnt plain respects speed and proof.',
                        'Drop three threats out here without letting the ash swallow your feet. Progress: {progress}.',
                    ],
                    repeat: [
                        'You have {progress}. Keep moving or the plain will count you instead.',
                    ],
                    ready: [
                        'Now your boots understand the ash.',
                        'I will show you the cinder run. It is ugly, fast, and usually enough.',
                    ],
                    used: [
                        'You run the ash-road clean now. Do not stop where the ground glows red.',
                    ],
                },
            },
            {
                id: 'neve-root-singer',
                name: 'Neve',
                title: 'Root Singer',
                promptLabel: 'NEVE',
                variant: 'glow-warden',
                x: 57 * TILE,
                y: 70 * TILE,
                effect: {
                    type: 'quest',
                    once: true,
                    require: {
                        requireAbility: true,
                        enemyKills: { kind: 'goliath', count: 1, label: 'GOLIATH' },
                    },
                    reward: {
                        xp: 110,
                        buffId: 'might',
                        buffName: 'ROOTSONG MIGHT',
                        duration: 60,
                        heal: 2,
                        color: '#6fffd5',
                    },
                    toast: 'ROOTSONG ANSWERED',
                    progressToast: 'NEVE WAITS FOR ONE GOLIATH TO FALL',
                },
                dialog: {
                    active: [
                        'The roots are afraid of the heavy beetles. Their footsteps bruise the lagoon.',
                        'Bring one goliath down, and I will teach your blade to listen. Progress: {progress}.',
                    ],
                    repeat: [
                        'The roots still flinch. One goliath must fall before the song opens.',
                    ],
                    ready: [
                        'I felt it through the mud. The lagoon is breathing again.',
                        'Take the rootsong. It makes the next swing remember the whole forest.',
                    ],
                    used: [
                        'The roots know your name now. Walk gently unless you need them angry.',
                    ],
                },
            },
            {
                id: 'halden-starherd',
                name: 'Halden',
                title: 'Steppe Starherd',
                promptLabel: 'HALDEN',
                variant: 'dusk-guard',
                x: 84 * TILE,
                y: 103 * TILE,
                effect: {
                    type: 'quest',
                    once: true,
                    require: {
                        flags: { hasLevelUpAbility: 'SUNKEN RELIC' },
                        loreRead: { count: 3, label: 'MARKERS' },
                    },
                    reward: {
                        xp: 120,
                        skillPoints: 1,
                        color: '#c8b06a',
                    },
                    toast: 'STARHERD CONSTELLATION FIXED',
                    progressToast: 'HALDEN NEEDS THREE OLD MARKERS READ',
                },
                dialog: {
                    active: [
                        'I herd stars by old stone names, and half the names have gone missing.',
                        'Read three markers in the Frontier after the relic wakes. Then I can fix the sky. Progress: {progress}.',
                    ],
                    repeat: [
                        'Still counting stones. I have {progress}, and the herd keeps drifting.',
                    ],
                    ready: [
                        'There. Three names, three lights, one road through the dark.',
                        'Take this spare point of sky. Spend it on the part of you that keeps surviving.',
                    ],
                    used: [
                        'The constellation holds. If the stars scatter again, I will blame the worm.',
                    ],
                },
            },
        ];

        this.mapMarkers = [
            { type: 'camp', x: this.landmarks.camp.x, y: this.landmarks.camp.y, label: this.landmarks.camp.label },
            { type: 'portal', x: this.landmarks.portal.x, y: this.landmarks.portal.y, label: this.landmarks.portal.label },
            { type: 'canyon', x: this.landmarks.canyons.x, y: this.landmarks.canyons.y, label: this.landmarks.canyons.label },
            { type: 'salt', x: this.landmarks.salt.x, y: this.landmarks.salt.y, label: this.landmarks.salt.label },
            { type: 'tropics', x: this.landmarks.tropics.x, y: this.landmarks.tropics.y, label: this.landmarks.tropics.label },
            { type: 'relic', x: this.landmarks.relic.x, y: this.landmarks.relic.y, label: this.landmarks.relic.label },
            { type: 'burnt', x: this.landmarks.burntPlain.x, y: this.landmarks.burntPlain.y, label: this.landmarks.burntPlain.label },
            { type: 'watchtower', x: this.landmarks.watchtower.x, y: this.landmarks.watchtower.y, label: this.landmarks.watchtower.label },
            { type: 'stones', x: this.landmarks.stoneCircle.x, y: this.landmarks.stoneCircle.y, label: this.landmarks.stoneCircle.label },
            { type: 'steppe', x: this.landmarks.steppe.x, y: this.landmarks.steppe.y, label: this.landmarks.steppe.label },
            { type: 'camp', x: this.landmarks.southCamp.x, y: this.landmarks.southCamp.y, label: this.landmarks.southCamp.label },
            { type: 'wreck', x: this.landmarks.wreck.x, y: this.landmarks.wreck.y, label: this.landmarks.wreck.label },
            { type: 'ruins', x: this.landmarks.brokenArch.x, y: this.landmarks.brokenArch.y, label: this.landmarks.brokenArch.label },
        ];
    }

    getArrivalPoint(key = 'start') {
        return this.arrivalPoints[key] || this.arrivalPoints.start || this.playerSpawn;
    }

    getMapMarkers() {
        return this.mapMarkers.slice();
    }

    getLandmark(id) {
        return this.landmarks[id] || null;
    }

    getBiomeInfoAtWorld(x, y) {
        return BIOMES[this.getBiomeKeyAt(Math.floor(x / TILE), Math.floor(y / TILE))] || BIOMES.driftmere;
    }

    getBiomeLabelAtWorld(x, y) {
        return this.getBiomeInfoAtWorld(x, y).label;
    }

    getBiomeKeyAt(col, row) {
        if (this.realmId !== 'frontier') return 'driftmere';
        if (this._isInTropicsBasin(col, row)) return 'tropics';
        if (this._isInCanyonBand(col, row)) return 'canyon';
        if (col <= 33) return 'salt';
        if (this._isInBurntPlains(col, row)) return 'burnt';
        if (this._isInDustSteppe(col, row)) return 'steppe';
        return 'desert';
    }

    _isInBurntPlains(col, row) {
        // Eastern wasteland, south of the canyon band
        return col >= 130 && row >= 28 && row <= 85;
    }

    _isInDustSteppe(col, row) {
        // Deep south wildlands
        return row >= 86 && col >= 34;
    }

    _isInCanyonBand(col, row) {
        // Canyon band across the top of the map; extends with map width/height.
        if (col < 34) return false;
        const canyonRowMax = Math.max(25, Math.round(this.rows * 0.27));
        const canyonColMax = Math.max(116, this.cols - 10);
        return row <= canyonRowMax && col <= canyonColMax;
    }

    _isInTropicsBasin(col, row) {
        return this.realmId === 'frontier' && pointInEllipse(col + 0.5, row + 0.5, 70.5, 66.5, 18.5, 13.5);
    }

    _buildMap() {
        return this.realmId === 'frontier'
            ? this._buildFrontierMap()
            : this._buildDriftmereMap();
    }

    _buildDriftmereMap() {
        const height = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));

        this._addLandMass(height, 27, 34, 20, 14, 1.2);
        this._addLandMass(height, 46, 32, 24, 16, 1.15);
        this._addLandMass(height, 65, 31, 16, 10, 0.82);
        this._addLandMass(height, 18, 28, 10, 9, 0.56);
        this._addLandMass(height, 36, 18, 12, 8, 0.44);
        this._addLandMass(height, 52, 43, 12, 8, 0.4);

        // Expanded Driftmere: southern peninsula + eastern archipelago
        this._addLandMass(height, 30, 58, 14, 10, 0.88);
        this._addLandMass(height, 48, 60, 16, 12, 0.95);
        this._addLandMass(height, 64, 56, 12, 9, 0.6);
        // Offshore isles — reachable only by rowboat.
        this._addLandMass(height, 78, 50, 7, 6, 0.78);
        this._addLandMass(height, 88, 42, 8, 7, 0.82);
        this._addLandMass(height, 96, 54, 7, 6, 0.74);
        this._addLandMass(height, 12, 62, 7, 6, 0.72);
        this._addLandMass(height, 72, 66, 9, 7, 0.8);
        this._addLandMass(height, 90, 64, 8, 6, 0.7);
        this._addLandMass(height, 22, 16, 6, 5, 0.58);


        const map = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const h = height[row][col];
                if (h < 0.1) map[row][col] = 0;
                else if (h < 0.18) map[row][col] = 1;
                else if (h < 0.44) map[row][col] = 2;
                else if (h < 0.8) map[row][col] = 3;
                else map[row][col] = 4;
            }
        }

        this._paintPathLine(map, 24, 34, 28, 32, 1.2);
        this._paintPathLine(map, 28, 32, 44, 32, 1.15);
        this._paintPathLine(map, 44, 32, 65, 32, 1.25);
        this._paintPatch(map, 24, 34, 3.0, 2.2, 5);
        this._paintPatch(map, 28, 32, 2.2, 1.8, 5);
        this._paintPatch(map, 65, 32, 2.6, 2.0, 5);

        // Paths down to the southern peninsula
        this._paintPathLine(map, 28, 36, 28, 46, 1.6, true);
        this._paintPathLine(map, 28, 46, 32, 56, 1.6, true);
        this._paintPathLine(map, 32, 56, 48, 60, 1.6, true);
        this._paintPathLine(map, 48, 60, 62, 56, 1.6, true);
        this._paintPatch(map, 32, 56, 2.4, 1.9, 5);
        this._paintPatch(map, 48, 60, 3.0, 2.2, 5);
        this._paintPatch(map, 62, 56, 2.4, 1.9, 5);

        for (const [cx, cy, rx, ry] of [
            [14, 22, 1.7, 1.7],
            [36, 17, 1.8, 1.8],
            [51, 19, 1.9, 1.9],
            [72, 24, 2.0, 2.0],
            [69, 41, 1.8, 1.8],
            [50, 46, 1.9, 1.9],
            [17, 41, 1.7, 1.7],
        ]) {
            this._paintPatch(map, cx, cy, rx, ry, 7);
        }

        // Sandbar bridges connecting the smaller isles to the main island.
        this._paintPathLine(map, 65, 33, 78, 50, 1.8, true);
        this._paintPathLine(map, 78, 50, 88, 42, 1.8, true);
        this._paintPathLine(map, 63, 56, 72, 66, 1.8, true);
        this._paintPathLine(map, 72, 66, 90, 64, 1.8, true);
        this._paintPathLine(map, 22, 34, 14, 48, 1.8, true);
        this._paintPathLine(map, 14, 48, 12, 62, 1.8, true);
        this._paintPathLine(map, 22, 28, 22, 16, 1.8, true);
        this._paintPathLine(map, 90, 64, 96, 54, 1.8, true);

        const waterPick = this._findNearestWater(map, 46, 62, 12);
        if (waterPick) {
            this.boatSpawn = { x: waterPick.col * TILE, y: waterPick.row * TILE };
        }

        return map;
    }

    _findNearestWater(map, startCol, startRow, maxRadius = 10) {
        const inBounds = (c, r) => c >= 0 && r >= 0 && c < this.cols && r < this.rows;
        const isWater = (c, r) => inBounds(c, r) && (map[r][c] === 0 || map[r][c] === 1);
        const isBoatBlock = (c, r) => (
            isWater(c, r) && isWater(c + 1, r) && isWater(c + 2, r)
            && isWater(c, r + 1) && isWater(c + 1, r + 1) && isWater(c + 2, r + 1)
        );
        for (let radius = 0; radius <= maxRadius; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                    const c = startCol + dc;
                    const r = startRow + dr;
                    if (isBoatBlock(c, r)) return { col: c, row: r };
                }
            }
        }
        return null;
    }

    _buildFrontierMap() {
        const height = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));

        this._addLandMass(height, 79, 46, 45, 34, 1.18);
        this._addLandMass(height, 48, 49, 30, 26, 1.02);
        this._addLandMass(height, 91, 23, 31, 14, 0.92);
        this._addLandMass(height, 108, 56, 18, 24, 0.56);
        this._addLandMass(height, 24, 49, 13, 22, 0.5);

        // Expanded Frontier: far-east wasteland, deep-south wildlands, canyon extensions
        this._addLandMass(height, 150, 40, 26, 30, 1.05);
        this._addLandMass(height, 160, 70, 20, 24, 0.92);
        this._addLandMass(height, 140, 95, 22, 20, 0.85);
        this._addLandMass(height, 92, 105, 28, 22, 0.95);
        this._addLandMass(height, 56, 100, 22, 20, 0.82);
        this._addLandMass(height, 24, 95, 16, 18, 0.58);
        this._addLandMass(height, 140, 18, 22, 12, 0.75);
        this._addLandMass(height, 165, 22, 14, 10, 0.55);
        this._addLandMass(height, 115, 85, 18, 14, 0.7);

        // Bridging landmass so expansion regions are reachable on foot.
        // East corridor: Dustwake -> Burnt Plains across the Amberwake strait
        this._addLandMass(height, 118, 44, 12, 8, 0.85);
        this._addLandMass(height, 128, 42, 10, 8, 0.8);
        // South corridor: tropics/desert -> Duststeppe
        this._addLandMass(height, 72, 82, 14, 10, 0.82);
        this._addLandMass(height, 86, 92, 16, 10, 0.88);
        this._addLandMass(height, 108, 96, 16, 10, 0.85);
        // West corridor: salt flats -> Duststeppe
        this._addLandMass(height, 30, 80, 12, 12, 0.75);
        this._addLandMass(height, 44, 94, 14, 10, 0.8);
        // North canyon extension bridge
        this._addLandMass(height, 120, 20, 14, 10, 0.75);

        const map = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const h = height[row][col];
                const biome = this.getBiomeKeyAt(col, row);

                if (h < 0.1) {
                    map[row][col] = 0;
                } else if (h < 0.18) {
                    map[row][col] = 1;
                } else if (biome === 'salt') {
                    map[row][col] = h < 0.44 ? 2 : (h < 0.76 ? 3 : 4);
                } else if (biome === 'canyon') {
                    map[row][col] = h < 0.34 ? 2 : (h < 0.6 ? 3 : 4);
                } else if (biome === 'tropics') {
                    map[row][col] = h < 0.36 ? 2 : (h < 0.72 ? 3 : 4);
                } else if (biome === 'burnt') {
                    map[row][col] = h < 0.4 ? 2 : (h < 0.72 ? 3 : 4);
                } else if (biome === 'steppe') {
                    map[row][col] = h < 0.4 ? 2 : (h < 0.78 ? 3 : 4);
                } else {
                    map[row][col] = h < 0.42 ? 2 : (h < 0.8 ? 3 : 4);
                }
            }
        }

        this._paintPathLine(map, 88, 46, 76, 46, 1.35);
        this._paintPathLine(map, 76, 46, 58, 48, 1.25);
        this._paintPathLine(map, 58, 48, 38, 50, 1.2);
        this._paintPathLine(map, 38, 50, 24, 50, 1.25);

        // Eastern caravan road — Dustwake to the far-east wasteland (crosses shallows)
        this._paintPathLine(map, 100, 46, 120, 42, 1.4, true);
        this._paintPathLine(map, 120, 42, 140, 40, 1.4, true);
        this._paintPathLine(map, 140, 40, 158, 44, 1.25);
        this._paintPathLine(map, 158, 44, 162, 62, 1.2);
        this._paintPathLine(map, 162, 62, 150, 78, 1.2);
        this._paintPatch(map, 120, 44, 3.0, 2.2, 5, true);
        this._paintPatch(map, 128, 42, 3.0, 2.2, 5, true);
        this._paintPatch(map, 140, 40, 3.0, 2.4, 5);
        this._paintPatch(map, 158, 44, 2.8, 2.2, 5);
        this._paintPatch(map, 162, 62, 2.6, 2.0, 5);

        // Southbound road — tropics to deep-south wildlands (crosses shallows)
        this._paintPathLine(map, 63, 76, 68, 82, 1.3, true);
        this._paintPathLine(map, 68, 82, 80, 90, 1.3, true);
        this._paintPathLine(map, 80, 90, 92, 100, 1.25, true);
        this._paintPathLine(map, 92, 100, 108, 100, 1.2);
        this._paintPathLine(map, 108, 100, 124, 96, 1.15);
        this._paintPathLine(map, 124, 96, 138, 94, 1.15);
        this._paintPatch(map, 72, 82, 2.8, 2.0, 5, true);
        this._paintPatch(map, 86, 92, 3.0, 2.2, 5, true);
        this._paintPatch(map, 98, 100, 3.2, 2.4, 5);
        this._paintPatch(map, 135, 95, 2.4, 2.0, 5);

        // Western route — salt flats down to southern basin (crosses shallows)
        this._paintPathLine(map, 24, 60, 28, 78, 1.3, true);
        this._paintPathLine(map, 28, 78, 40, 92, 1.25, true);
        this._paintPathLine(map, 40, 92, 56, 100, 1.2, true);
        this._paintPatch(map, 30, 80, 2.4, 2.0, 5, true);
        this._paintPatch(map, 44, 94, 2.6, 2.0, 5, true);
        this._paintPatch(map, 56, 100, 2.6, 2.0, 5);

        // Canyon extension eastward (crosses shallows at the bridge)
        this._paintPathLine(map, 108, 20, 128, 22, 1.2, true);
        this._paintPathLine(map, 128, 22, 148, 20, 1.15);
        this._paintPathLine(map, 148, 20, 164, 24, 1.1);
        this._paintPatch(map, 120, 20, 2.6, 2.0, 5, true);

        this._paintPathLine(map, 88, 46, 86, 38, 1.15);
        this._paintPathLine(map, 86, 38, 83, 29, 1.1);
        this._paintPathLine(map, 83, 29, 79, 18, 1.0);

        this._paintPathLine(map, 88, 46, 84, 52, 1.15);
        this._paintPathLine(map, 84, 52, 79, 58, 1.05);
        this._paintPathLine(map, 79, 58, 74, 62, 1.0);
        this._paintPathLine(map, 74, 62, 69, 67, 0.9);
        this._paintPathLine(map, 69, 67, 64, 72, 0.95);
        this._paintPatch(map, 63, 74, 2.4, 1.9, 5);
        this._paintPatch(map, 70, 72, 2.2, 1.7, 5);

        this._paintPatch(map, 88, 46, 2.8, 2.2, 5);
        this._paintPatch(map, 91, 50, 1.8, 1.8, 5);
        this._paintPatch(map, 84, 46, 1.8, 1.8, 5);
        this._paintPatch(map, 92, 45, 2.2, 1.8, 5);

        for (const [cx, cy, rx, ry] of [
            [48, 15, 2.4, 7.2],
            [60, 14, 2.6, 6.1],
            [72, 18, 2.4, 7.6],
            [88, 15, 2.8, 6.8],
            [101, 18, 2.5, 7.3],
        ]) {
            this._paintPatch(map, cx, cy, rx, ry, 7);
        }

        for (const [cx, cy, rx, ry] of [
            [44, 21, 2.0, 2.0],
            [95, 12, 2.3, 2.3],
            [106, 19, 2.2, 2.2],
            [56, 20, 2.0, 2.0],
        ]) {
            this._paintPatch(map, cx, cy, rx, ry, 7);
        }

        for (const [cx, cy, rx, ry] of [
            [19, 44, 1.7, 1.7],
            [28, 57, 1.6, 1.6],
            [31, 37, 1.6, 1.6],
            [14, 61, 1.4, 1.4],
            [24, 63, 1.3, 1.3],
        ]) {
            this._paintPatch(map, cx, cy, rx, ry, 8);
        }

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this._isInTropicsBasin(col, row) || map[row][col] === 0) continue;
                const dist = ellipseDistance(col + 0.5, row + 0.5, 70.5, 66.5, 18.5, 13.5);
                if (dist < 0.56) map[row][col] = 0;
                else if (dist < 0.67) map[row][col] = 1;
                else if (dist < 0.8) map[row][col] = 2;
                else if (dist < 0.95) map[row][col] = 4;
            }
        }

        this._paintPatch(map, 58.8, 73.8, 4.2, 2.6, 5);
        this._paintPatch(map, 70.8, 72.2, 4.0, 2.2, 5);
        this._paintPatch(map, 75.2, 61.5, 2.3, 1.7, 5);
        this._paintPatch(map, 68.4, 67.1, 2.1, 1.7, 5);
        this._paintPatch(map, 63.8, 71.8, 1.8, 1.5, 5);

        // Repaint the tropics descent after the basin water pass so the
        // lily-pad route and relic platform remain traversable.
        this._paintPathLine(map, 76, 57, 75, 59, 0.95, true);
        this._paintPathLine(map, 75, 59, 74, 62, 1.0, true);
        this._paintPathLine(map, 74, 62, 72, 63, 1.05, true);
        this._paintPatch(map, 75, 59, 1.8, 1.6, 5, true);
        this._paintPathLine(map, 72, 63, 69, 67, 1.0, true);
        this._paintPathLine(map, 69, 67, 66, 70, 1.0, true);
        this._paintPathLine(map, 66, 70, 63, 74, 1.1, true);
        this._paintPatch(map, 72, 63, 2.2, 1.8, 5, true);
        this._paintPatch(map, 69, 67, 2.3, 1.9, 5, true);
        this._paintPatch(map, 66, 70, 2.6, 1.9, 5, true);
        this._paintPatch(map, 63, 74, 3.0, 2.3, 5, true);
        this._paintPatch(map, 58.8, 73.8, 4.2, 2.6, 5, true);
        this._paintPatch(map, 70.8, 72.2, 4.0, 2.2, 5, true);
        this._paintPatch(map, 75.2, 61.5, 2.3, 1.7, 5, true);
        this._paintPatch(map, 68.4, 67.1, 2.1, 1.7, 5, true);
        this._paintPatch(map, 63.8, 71.8, 1.8, 1.5, 5, true);

        return map;
    }

    _buildDecorProps() {
        if (!this.assets?.environmentProps) return [];

        const props = [];
        const pushProp = (key, tileX, tileY, options = {}) => {
            const image = this.assets.environmentProps[key];
            if (!image) return;

            const scale = options.scale ?? 1;
            const anchorX = options.anchorX ?? 0.5;
            const anchorY = options.anchorY ?? 1;
            const baseX = tileX * TILE + (options.offsetX ?? 8);
            const baseY = tileY * TILE + (options.offsetY ?? 14);
            const w = Math.round(image.width * scale);
            const h = Math.round(image.height * scale);
            const footprintW = options.footprintW ?? Math.max(10, Math.round(w * 0.24));
            const footprintH = options.footprintH ?? Math.max(6, Math.round(h * 0.12));
            const drawX = Math.round(baseX - w * anchorX);
            const drawY = Math.round(baseY - h * anchorY);

            props.push({
                key,
                image,
                x: drawX,
                y: drawY,
                w,
                h,
                baseX: Math.round(baseX),
                baseY: Math.round(baseY),
                sortY: options.sortY ?? Math.round(baseY),
                alpha: options.alpha ?? 1,
                blocking: options.blocking ?? false,
                footprintW,
                footprintH,
            });
        };

        if (this.realmId === 'frontier') {
            pushProp('deadTree', 64.4, 41.5, { scale: 0.9, blocking: true, footprintW: 12, footprintH: 6 });
            pushProp('deadTree', 101.0, 35.6, { scale: 0.84, blocking: true, footprintW: 12, footprintH: 6 });

            pushProp('canyonMesa', 80.0, 16.0, { scale: 0.18 });
            pushProp('canyonCave', 66.4, 21.4, { scale: 0.18 });
            pushProp('canyonCave', 98.2, 18.0, { scale: 0.18 });

            pushProp('saltCrystalCluster', 18.0, 44.4, { scale: 0.14 });
            pushProp('saltCrystalTall', 24.4, 59.9, { scale: 0.14 });
            pushProp('saltCrystalTall', 28.4, 56.4, { scale: 0.13 });
            pushProp('saltCrystalSpire', 30.2, 37.2, { scale: 0.12 });
            pushProp('saltCrystalSpire', 21.4, 57.4, { scale: 0.11 });
            pushProp('saltCrystalCluster', 25.4, 49.0, { scale: 0.12 });

            pushProp('tropicsRuins', 58.8, 74.6, { scale: 0.16, sortY: 75 * TILE + 8 });
            pushProp('tropicsRuinWall', 71.5, 72.5, { scale: 0.18, sortY: 73 * TILE + 8 });
            pushProp('tropicsLilyCluster', 69.5, 66.5, { scale: 0.12, sortY: 67 * TILE + 4 });
            pushProp('tropicsLilyCluster', 63.5, 71.0, { scale: 0.1, sortY: 72 * TILE + 4 });
            pushProp('tropicsPalmGlow', 57.8, 59.2, { scale: 0.14, blocking: true, footprintW: 14, footprintH: 6 });
            pushProp('tropicsPalmGlow', 84.0, 61.2, { scale: 0.14, blocking: true, footprintW: 14, footprintH: 6 });
            pushProp('tropicsPalmGlow', 82.4, 71.9, { scale: 0.13, blocking: true, footprintW: 14, footprintH: 6 });
            pushProp('tropicsVines', 70.0, 55.2, {
                scale: 0.17,
                anchorY: 0,
                offsetY: 0,
                sortY: 53 * TILE,
            });
        } else {
            pushProp('pineTall', 15.5, 26.2, { scale: 0.72, blocking: true, footprintW: 12, footprintH: 6 });
            pushProp('pineMid', 20.0, 22.8, { scale: 0.72, blocking: true, footprintW: 12, footprintH: 6 });
            pushProp('oakLarge', 34.5, 22.8, { scale: 0.68, blocking: true, footprintW: 14, footprintH: 6 });
            pushProp('pineSlim', 42.8, 18.9, { scale: 0.74, blocking: true, footprintW: 12, footprintH: 6 });
            pushProp('goldTree', 50.6, 21.2, { scale: 0.74, blocking: true, footprintW: 14, footprintH: 6 });
            pushProp('lanternTree', 60.4, 37.6, { scale: 0.78, blocking: true, footprintW: 14, footprintH: 6 });
            pushProp('birch', 72.4, 27.8, { scale: 0.78, blocking: true, footprintW: 12, footprintH: 6 });
            pushProp('pineTall', 67.6, 35.1, { scale: 0.68, blocking: true, footprintW: 12, footprintH: 6 });

            pushProp('roundBush', 24.1, 31.8, { scale: 0.9 });
            pushProp('flowerBush', 32.6, 35.6, { scale: 0.86 });
            pushProp('berryBush', 34.4, 29.6, { scale: 0.84 });
            pushProp('blueBush', 56.2, 34.8, { scale: 0.82 });
            pushProp('glowBush', 58.4, 29.2, { scale: 0.84 });
            pushProp('reeds', 71.4, 34.4, { scale: 0.88 });
            pushProp('reeds', 69.0, 29.4, { scale: 0.84 });

            const aiDecor = this.assets?.aiDecorProps || [];
            const pushAi = (index, tileX, tileY, opts = {}) => {
                const image = aiDecor[index % aiDecor.length];
                if (!image) return;
                const scale = opts.scale ?? 1;
                const baseX = tileX * TILE + 8;
                const baseY = tileY * TILE + 14;
                const w = Math.round(image.width * scale);
                const h = Math.round(image.height * scale);
                props.push({
                    key: `ai_${index}`,
                    image,
                    x: Math.round(baseX - w / 2),
                    y: Math.round(baseY - h),
                    w, h,
                    baseX: Math.round(baseX),
                    baseY: Math.round(baseY),
                    sortY: opts.sortY ?? Math.round(baseY),
                    alpha: 1,
                    blocking: opts.blocking ?? false,
                    footprintW: opts.footprintW ?? 10,
                    footprintH: opts.footprintH ?? 5,
                });
            };

            // Scatter a curated mix of AI sheet props across the new isles.
            pushAi(0, 78.0, 50.0, { blocking: true });
            pushAi(3, 79.5, 49.0);
            pushAi(7, 88.0, 42.5, { blocking: true });
            pushAi(11, 90.0, 41.5);
            pushAi(15, 96.0, 54.5, { blocking: true });
            pushAi(18, 97.2, 53.5);
            pushAi(21, 12.5, 62.0, { blocking: true });
            pushAi(24, 13.8, 61.0);
            pushAi(5, 72.5, 66.0, { blocking: true });
            pushAi(9, 74.0, 65.0);
            pushAi(12, 90.0, 64.0, { blocking: true });
            pushAi(17, 91.5, 63.0);
            pushAi(22, 22.0, 16.5, { blocking: true });

            // Sprinkle around the southern peninsula so the boatman's home feels populated.
            pushAi(2, 42.0, 58.0);
            pushAi(4, 54.0, 60.0, { blocking: true });
            pushAi(6, 36.0, 60.0);
            pushAi(8, 60.0, 62.0);
            pushAi(13, 50.5, 58.5);
            pushAi(19, 30.5, 57.5);

            // A couple around Elara's starting camp so the expansion is visible from the get-go.
            pushAi(1, 27.5, 38.5);
            pushAi(14, 33.5, 27.5);
            pushAi(20, 45.5, 36.5);
        }

        return props.sort((a, b) => a.sortY - b.sortY);
    }

    _buildPropColliders() {
        const propColliders = this.decorProps
            .filter((prop) => prop.blocking)
            .map((prop) => {
                const trunkW = Math.max(6, Math.min(prop.footprintW, 12));
                const trunkH = 4;
                return {
                    x: Math.round(prop.baseX - trunkW / 2),
                    y: Math.round(prop.baseY - trunkH),
                    w: trunkW,
                    h: trunkH,
                };
            });
        for (const structure of this.structures) {
            if (structure.collider) propColliders.push(structure.collider);
            if (structure.collider2) propColliders.push(structure.collider2);
        }
        return propColliders;
    }

    _buildStructures() {
        const structs = [];
        if (this.realmId === 'frontier') {
            structs.push(this._makeCampfire(88 * TILE + 8, 47 * TILE + 7));
            structs.push(this._makeSignpost(78 * TILE + 7, 45 * TILE + 6));
            structs.push(this._makeSignpost(84 * TILE + 7, 33 * TILE + 6));
            structs.push(this._makeSignpost(79 * TILE + 7, 57 * TILE + 6));
            structs.push(this._makeSaltMonolith(24 * TILE + 8, 50 * TILE + 8));
            structs.push(this._makeSignalFire(79 * TILE + 8, 18 * TILE + 8));
            // Portal-adjacent beacon: shifted off the portal so it doesn't overlap the gateway sprite.
            structs.push(this._makeSignalFire(94 * TILE + 8, 46 * TILE + 10));

            // Expanded-frontier landmarks
            structs.push(this._makeObelisk(140 * TILE + 8, 40 * TILE + 6, '#ff9a70'));
            structs.push(this._makeObelisk(158 * TILE + 8, 46 * TILE + 6, '#ffd27b'));
            structs.push(this._makeWatchtower(162 * TILE + 8, 62 * TILE + 4));
            structs.push(this._makeStandingStones(148 * TILE + 8, 22 * TILE + 6, '#c69c6a'));
            structs.push(this._makeSignpost(120 * TILE + 7, 42 * TILE + 6));
            structs.push(this._makeSignpost(98 * TILE + 7, 105 * TILE + 6));
            structs.push(this._makeAncientWell(80 * TILE + 8, 100 * TILE + 8));
            structs.push(this._makeCampfire(98 * TILE + 8, 105 * TILE + 7));
            structs.push(this._makeWindmill(56 * TILE + 8, 100 * TILE + 2));
            structs.push(this._makeBrokenArch(135 * TILE + 8, 95 * TILE + 4));
            structs.push(this._makeSignalFire(150 * TILE + 8, 78 * TILE + 10));
            structs.push(this._makeShipwreck(36 * TILE + 8, 92 * TILE + 6));
            structs.push(this._makeStandingStones(115 * TILE + 8, 85 * TILE + 6, '#8ea0a8'));
        } else {
            structs.push(this._makeCampfire(24 * TILE + 8, 34 * TILE + 7));
            structs.push(this._makeSignpost(30 * TILE + 7, 33 * TILE + 6));
            structs.push(this._makeSignpost(59 * TILE + 7, 31 * TILE + 6));
            // Portal-adjacent beacon for Amberwake Gate, shifted south-east of the portal.
            structs.push(this._makeSignalFire(67 * TILE + 4, 33 * TILE + 10));

            // Expanded Driftmere: southern peninsula + eastern archipelago
            structs.push(this._makeLighthouse(78 * TILE + 8, 46 * TILE + 2));
            structs.push(this._makeShipwreck(86 * TILE + 8, 36 * TILE + 6));
            structs.push(this._makeAncientWell(48 * TILE + 8, 60 * TILE + 8));
            structs.push(this._makeStandingStones(32 * TILE + 8, 56 * TILE + 6, '#8effec'));
            structs.push(this._makeSignpost(32 * TILE + 7, 46 * TILE + 6));
            structs.push(this._makeObelisk(62 * TILE + 8, 56 * TILE + 6, '#8effec'));
            structs.push(this._makeCampfire(48 * TILE + 8, 60 * TILE + 7));
        }
        return structs;
    }

    _makeCampfire(x, y) {
        return {
            type: 'campfire',
            x,
            y,
            sortY: y + 4,
            collider: null,
            draw: (ctx, time) => this._drawCampfire(ctx, x, y, time),
        };
    }

    _makeSignpost(x, y) {
        return {
            type: 'signpost',
            x,
            y,
            sortY: y + 10,
            collider: { x: x - 1, y: y + 6, w: 4, h: 4 },
            draw: (ctx) => this._drawSignpost(ctx, x, y),
        };
    }

    _makeSignalFire(x, y) {
        return {
            type: 'signalFire',
            x,
            y,
            sortY: y + 8,
            collider: { x: x - 3, y: y + 4, w: 6, h: 4 },
            draw: (ctx, time) => this._drawSignalFire(ctx, x, y, time),
        };
    }

    _makeSaltMonolith(x, y) {
        return {
            type: 'saltMonolith',
            x,
            y,
            sortY: y + 4,
            collider: { x: x - 5, y: y - 2, w: 10, h: 6 },
            draw: (ctx, time) => this._drawSaltMonolith(ctx, x, y, time),
        };
    }

    _makeObelisk(x, y, accent = '#ffd27b') {
        return {
            type: 'obelisk',
            x,
            y,
            sortY: y + 6,
            collider: { x: x - 4, y: y - 2, w: 8, h: 8 },
            draw: (ctx, time) => this._drawObelisk(ctx, x, y, time, accent),
        };
    }

    _makeLighthouse(x, y) {
        return {
            type: 'lighthouse',
            x,
            y,
            sortY: y + 10,
            collider: { x: x - 5, y: y - 2, w: 10, h: 10 },
            draw: (ctx, time) => this._drawLighthouse(ctx, x, y, time),
        };
    }

    _makeWatchtower(x, y) {
        return {
            type: 'watchtower',
            x,
            y,
            sortY: y + 10,
            collider: { x: x - 5, y: y + 2, w: 10, h: 8 },
            draw: (ctx, time) => this._drawWatchtower(ctx, x, y, time),
        };
    }

    _makeStandingStones(x, y, accent = '#bba67a') {
        return {
            type: 'standingStones',
            x,
            y,
            sortY: y + 6,
            collider: null,
            draw: (ctx, time) => this._drawStandingStones(ctx, x, y, time, accent),
        };
    }

    _makeAncientWell(x, y) {
        return {
            type: 'ancientWell',
            x,
            y,
            sortY: y + 6,
            collider: { x: x - 4, y: y, w: 8, h: 6 },
            draw: (ctx, time) => this._drawAncientWell(ctx, x, y, time),
        };
    }

    _makeWindmill(x, y) {
        return {
            type: 'windmill',
            x,
            y,
            sortY: y + 10,
            collider: { x: x - 5, y: y + 4, w: 10, h: 8 },
            draw: (ctx, time) => this._drawWindmill(ctx, x, y, time),
        };
    }

    _makeShipwreck(x, y) {
        return {
            type: 'shipwreck',
            x,
            y,
            sortY: y + 6,
            collider: { x: x - 9, y: y - 2, w: 18, h: 8 },
            draw: (ctx, time) => this._drawShipwreck(ctx, x, y, time),
        };
    }

    _makeBrokenArch(x, y) {
        return {
            type: 'brokenArch',
            x,
            y,
            sortY: y + 8,
            collider: { x: x - 8, y: y + 4, w: 4, h: 4 },
            collider2: { x: x + 4, y: y + 4, w: 4, h: 4 },
            draw: (ctx, time) => this._drawBrokenArch(ctx, x, y, time),
        };
    }

    getVisibleStructures(camX, camY, viewW, viewH) {
        return this.structures.filter((s) => (
            s.x + 20 >= camX &&
            s.y + 20 >= camY - 24 &&
            s.x - 20 <= camX + viewW &&
            s.y - 20 <= camY + viewH + 24
        ));
    }

    setEntityColliders(list) {
        this.entityColliders = list || [];
    }

    _isGroundTile(col, row) {
        const tile = this.tileAt(col, row);
        return tile !== 0 && tile !== 1;
    }

    findOpenEntityPosition(entityX, entityY, hitboxOffsetX, hitboxOffsetY, hitboxW, hitboxH, maxRadius = 64, step = 6) {
        const hitboxX = entityX + hitboxOffsetX;
        const hitboxY = entityY + hitboxOffsetY;

        if (!this.collides(hitboxX, hitboxY, hitboxW, hitboxH)) return { x: entityX, y: entityY };

        for (let radius = step; radius <= maxRadius; radius += step) {
            for (let dy = -radius; dy <= radius; dy += step) {
                for (let dx = -radius; dx <= radius; dx += step) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                    if (!this.collides(hitboxX + dx, hitboxY + dy, hitboxW, hitboxH)) {
                        return { x: entityX + dx, y: entityY + dy };
                    }
                }
            }
        }

        return { x: entityX, y: entityY };
    }

    _addLandMass(height, cx, cy, rx, ry, strength) {
        const minCol = Math.max(0, Math.floor(cx - rx - 1));
        const maxCol = Math.min(this.cols - 1, Math.ceil(cx + rx + 1));
        const minRow = Math.max(0, Math.floor(cy - ry - 1));
        const maxRow = Math.min(this.rows - 1, Math.ceil(cy + ry + 1));

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const dx = (col + 0.5 - cx) / rx;
                const dy = (row + 0.5 - cy) / ry;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 1) {
                    height[row][col] += Math.pow(1 - dist, 1.55) * strength;
                }
            }
        }
    }

    _paintPathLine(map, x0, y0, x1, y1, radius, allowWater = false) {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3;
        for (let step = 0; step <= steps; step++) {
            const t = step / Math.max(1, steps);
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            this._paintPatch(map, x, y, radius, radius * 0.9, 5, allowWater);
        }
    }

    _paintPatch(map, cx, cy, rx, ry, tile, allowWater = false) {
        const minCol = Math.max(0, Math.floor(cx - rx - 1));
        const maxCol = Math.min(this.cols - 1, Math.ceil(cx + rx + 1));
        const minRow = Math.max(0, Math.floor(cy - ry - 1));
        const maxRow = Math.min(this.rows - 1, Math.ceil(cy + ry + 1));

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const dx = (col + 0.5 - cx) / Math.max(0.01, rx);
                const dy = (row + 0.5 - cy) / Math.max(0.01, ry);
                if (dx * dx + dy * dy <= 1 && (allowWater || map[row][col] > 1)) {
                    map[row][col] = tile;
                }
            }
        }
    }

    _hash(x, y) {
        let h = (x * 374761393 + y * 668265263) | 0;
        h = (h ^ (h >> 13)) * 1274126177;
        return (h ^ (h >> 16)) >>> 0;
    }

    tileAt(col, row) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return 0;
        return this.map[row][col];
    }

    isOnEastIsle() {
        return false;
    }

    collides(x, y, w, h, mode = 'walker') {
        const c0 = Math.floor(x / TILE);
        const r0 = Math.floor(y / TILE);
        const c1 = Math.floor((x + w - 1) / TILE);
        const r1 = Math.floor((y + h - 1) / TILE);

        const solidSet = mode === 'boat' ? SOLID_BOAT : SOLID;
        for (let row = r0; row <= r1; row++) {
            for (let col = c0; col <= c1; col++) {
                if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
                if (solidSet.has(this.tileAt(col, row))) return true;
            }
        }

        const rect = { x, y, w, h };
        for (const collider of this.propColliders) {
            if (rectsOverlap(rect, collider)) return true;
        }
        for (const collider of this.entityColliders) {
            if (rectsOverlap(rect, collider)) return true;
        }
        return false;
    }

    setBoatMode(enabled) {
        this.boatMode = !!enabled;
    }

    isWaterTile(col, row) {
        const t = this.tileAt(col, row);
        return t === 0 || t === 1;
    }

    drawGround(ctx, camX, camY, viewW, viewH, time) {
        const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
        const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
        const c1 = Math.min(this.cols - 1, Math.floor((camX + viewW) / TILE) + 1);
        const r1 = Math.min(this.rows - 1, Math.floor((camY + viewH) / TILE) + 1);

        for (let row = r0; row <= r1; row++) {
            for (let col = c0; col <= c1; col++) {
                const tile = this.map[row][col];
                const x = col * TILE;
                const y = row * TILE;
                const n = this.noise[row][col];
                const biomeKey = this.getBiomeKeyAt(col, row);
                const inLagoon = this._isInTropicsBasin(col, row);

                if (tile === 0 || tile === 1) {
                    if (inLagoon) this._drawLagoonWater(ctx, x, y, row, col, time, tile === 1);
                    else this._drawOceanWater(ctx, x, y, row, col, time, tile === 1, biomeKey);
                    continue;
                }

                if (tile === 2) {
                    if (biomeKey === 'driftmere') this._drawDriftmereGround(ctx, x, y, n, false, time);
                    else if (biomeKey === 'canyon') this._drawCanyonGround(ctx, x, y, n, false);
                    else if (biomeKey === 'salt') this._drawSaltGround(ctx, x, y, n, 0);
                    else if (biomeKey === 'tropics') this._drawTropicsGround(ctx, x, y, n, false, time);
                    else if (biomeKey === 'burnt') this._drawBurntGround(ctx, x, y, n, false, time);
                    else if (biomeKey === 'steppe') this._drawSteppeGround(ctx, x, y, n, false);
                    else this._drawDesertSand(ctx, x, y, row, col, n);
                } else if (tile === 3 || tile === 4) {
                    if (biomeKey === 'driftmere') this._drawDriftmereGround(ctx, x, y, n, tile === 4, time);
                    else if (biomeKey === 'canyon') this._drawCanyonGround(ctx, x, y, n, tile === 4);
                    else if (biomeKey === 'salt') this._drawSaltGround(ctx, x, y, n, tile === 4 ? 2 : 1);
                    else if (biomeKey === 'tropics') this._drawTropicsGround(ctx, x, y, n, tile === 4, time);
                    else if (biomeKey === 'burnt') this._drawBurntGround(ctx, x, y, n, tile === 4, time);
                    else if (biomeKey === 'steppe') this._drawSteppeGround(ctx, x, y, n, tile === 4);
                    else this._drawDesertDune(ctx, x, y, n, tile === 4, time);
                } else if (tile === 5) {
                    if (biomeKey === 'driftmere') this._drawDriftmerePath(ctx, x, y, n, time);
                    else if (biomeKey === 'canyon') this._drawCanyonPath(ctx, x, y, n);
                    else if (biomeKey === 'salt') this._drawSaltPath(ctx, x, y, n, time);
                    else if (biomeKey === 'tropics' && inLagoon) this._drawLilyPadTile(ctx, x, y, n, time);
                    else if (biomeKey === 'tropics') this._drawTropicsPath(ctx, x, y, n);
                    else if (biomeKey === 'burnt') this._drawBurntPath(ctx, x, y, n);
                    else if (biomeKey === 'steppe') this._drawSteppePath(ctx, x, y, n);
                    else this._drawDesertPath(ctx, x, y, n);
                } else if (tile === 7) {
                    this._drawBiomeRock(ctx, x, y, n, biomeKey);
                } else if (tile === 8) {
                    if (biomeKey === 'salt') this._drawSaltCrystal(ctx, x, y, time);
                    else this._drawBiomeRock(ctx, x, y, n, biomeKey);
                }

                if (this._isShoreTile(col, row)) this._drawFoam(ctx, x, y, row, col, time, biomeKey);
                if (!SOLID.has(tile) && n % 29 === 0) {
                    if (biomeKey === 'salt') this._drawSaltSpark(ctx, x, y, n, time);
                    else if (biomeKey === 'tropics') this._drawTropicsGlow(ctx, x, y, n, time);
                    else if (biomeKey === 'driftmere') this._drawDriftmereGlow(ctx, x, y, n, time);
                    else this._drawDustSpark(ctx, x, y, n, time);
                }
            }
        }
    }

    drawLandmarks(ctx, time) {
        // Structures (campfires, signposts, signal fires, salt monolith)
        // are now drawn in the y-sorted entity pass so they depth-sort
        // correctly with mobs and the player. This hook is kept for any
        // future ambient effects that should render behind entities.
    }

    drawStructure(ctx, structure, time) {
        if (!structure || typeof structure.draw !== 'function') return;
        structure.draw(ctx, time);
    }

    getVisibleProps(camX, camY, viewW, viewH) {
        return this.decorProps.filter((prop) => (
            prop.x + prop.w >= camX - 20 &&
            prop.y + prop.h >= camY - 20 &&
            prop.x <= camX + viewW + 20 &&
            prop.y <= camY + viewH + 20
        ));
    }

    drawProp(ctx, prop) {
        ctx.save();
        ctx.globalAlpha *= prop.alpha;
        ctx.drawImage(prop.image, prop.x, prop.y, prop.w, prop.h);
        ctx.restore();
    }

    _isShoreTile(col, row) {
        const tile = this.tileAt(col, row);
        if (tile <= 1 || tile === 7 || tile === 8) return false;
        return this.tileAt(col - 1, row) <= 1 || this.tileAt(col + 1, row) <= 1 || this.tileAt(col, row - 1) <= 1 || this.tileAt(col, row + 1) <= 1;
    }

    _drawOceanWater(ctx, x, y, row, col, time, shallow, biomeKey) {
        const wave = Math.sin(time * (shallow ? 2.1 : 1.5) + col * 0.82 + row * 0.37) * 0.5 + 0.5;
        const base = biomeKey === 'salt'
            ? (shallow ? '#3d90c2' : '#173b67')
            : biomeKey === 'driftmere'
                ? (shallow ? '#2f7ea2' : '#10233f')
                : (shallow ? '#2b6f9e' : '#102848');
        const shimmer = biomeKey === 'salt'
            ? `rgba(220, 248, 255, ${0.08 + wave * 0.16})`
            : biomeKey === 'driftmere'
                ? `rgba(150, 255, 228, ${0.06 + wave * 0.12})`
                : `rgba(122, 220, 255, ${0.06 + wave * 0.1})`;
        ctx.fillStyle = base;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = shimmer;
        ctx.fillRect(x + 1, y + 4 + Math.round(wave * 2), TILE - 2, 2);
        ctx.fillRect(x + 3, y + 10 + Math.round(wave), TILE - 6, 1);
    }

    _drawLagoonWater(ctx, x, y, row, col, time, shallow) {
        const wave = Math.sin(time * 2.6 + col * 0.7 + row * 0.36) * 0.5 + 0.5;
        ctx.fillStyle = shallow ? '#18a7af' : '#0b6f82';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = `rgba(127, 255, 238, ${0.1 + wave * 0.16})`;
        ctx.fillRect(x + 1, y + 3 + Math.round(wave * 2), TILE - 2, 2);
        ctx.fillRect(x + 3, y + 9, TILE - 6, 1);
    }

    _drawDriftmereGround(ctx, x, y, noise, dark, time) {
        const glint = Math.sin(time * 1.8 + x * 0.05 + y * 0.03) * 0.5 + 0.5;
        ctx.fillStyle = dark ? '#43745a' : '#5daa73';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = dark ? '#28463a' : '#35654b';
        ctx.fillRect(x, y + 10, TILE, 6);
        if (noise % 2 === 0) {
            ctx.fillStyle = dark ? '#6aa57d' : '#92d69f';
            ctx.fillRect(x + (noise % 11) + 1, y + ((noise >> 2) % 8) + 4, 1, 3);
        }
        ctx.fillStyle = `rgba(195, 255, 214, ${0.08 + glint * 0.08})`;
        ctx.fillRect(x + 2, y + 3, TILE - 5, 1);
    }

    _drawDesertSand(ctx, x, y, row, col, noise) {
        ctx.fillStyle = '#e4d399';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#c8b16f';
        ctx.fillRect(x, y + 9, TILE, 7);
        if (noise % 3 === 0) ctx.fillRect(x + ((noise >> 1) % 10) + 2, y + ((noise >> 5) % 10) + 2, 2, 1);
        if ((row + col) % 4 === 0) {
            ctx.fillStyle = '#b38e51';
            ctx.fillRect(x + (noise % 12) + 1, y + ((noise >> 3) % 10) + 4, 1, 1);
        }
    }

    _drawDesertDune(ctx, x, y, noise, dark, time) {
        const crest = Math.sin(time * 1.7 + x * 0.06 + y * 0.03) * 0.5 + 0.5;
        ctx.fillStyle = dark ? '#b0844b' : '#d4ab66';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = dark ? '#8a6738' : '#c5974f';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = `rgba(248, 223, 162, ${0.12 + crest * 0.1})`;
        ctx.fillRect(x + 1, y + 3 + (noise % 3), TILE - 4, 1);
    }

    _drawCanyonGround(ctx, x, y, noise, dark) {
        ctx.fillStyle = dark ? '#8d4b34' : '#c26c49';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = dark ? '#412446' : '#6a3256';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = dark ? '#f0a162' : '#ffbb73';
        ctx.fillRect(x + 1, y + 3, TILE - 3, 1);
        if (noise % 17 === 0) {
            ctx.fillStyle = 'rgba(36, 18, 49, 0.25)';
            ctx.fillRect(x + 2, y + 5, 2, 7);
        }
    }

    _drawSaltGround(ctx, x, y, noise, variant) {
        const top = variant === 0 ? '#f7fbff' : (variant === 1 ? '#d9f2ff' : '#f3ece1');
        const low = variant === 0 ? '#d4dae9' : (variant === 1 ? '#9bcfff' : '#ddb17a');
        ctx.fillStyle = top;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = low;
        ctx.fillRect(x, y + 11, TILE, 5);
        ctx.fillStyle = variant === 2 ? 'rgba(255, 214, 160, 0.28)' : 'rgba(215, 243, 255, 0.28)';
        ctx.fillRect(x + 1, y + 3, TILE - 2, 1);
        if (noise % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.fillRect(x + (noise % 9) + 1, y + ((noise >> 2) % 6) + 2, 3, 1);
        }
    }

    _drawTropicsGround(ctx, x, y, noise, dark, time) {
        ctx.fillStyle = dark ? '#2b7645' : '#4fb767';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = dark ? '#1c5235' : '#2d7d49';
        ctx.fillRect(x, y + 10, TILE, 6);
        if (noise % 2 === 0) {
            ctx.fillStyle = dark ? '#3e9657' : '#86e07b';
            ctx.fillRect(x + (noise % 11) + 1, y + ((noise >> 2) % 8) + 4, 1, 3);
        }
        if (noise % 23 === 0) {
            const glow = Math.sin(time * 2.8 + noise) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(111, 255, 213, ${0.08 + glow * 0.14})`;
            ctx.fillRect(x + 4, y + 5, 5, 5);
        }
    }

    _drawDriftmerePath(ctx, x, y, noise, time) {
        const shimmer = Math.sin(time * 1.9 + x * 0.03 + y * 0.02) * 0.5 + 0.5;
        ctx.fillStyle = '#8d7c63';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#5b4c3d';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = `rgba(212, 201, 170, ${0.14 + shimmer * 0.08})`;
        ctx.fillRect(x + 1, y + 3, TILE - 2, 1);
        if (noise % 3 === 0) ctx.fillRect(x + 4, y + 7, TILE - 7, 1);
    }

    _drawDesertPath(ctx, x, y, noise) {
        ctx.fillStyle = '#9f7c5b';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#7a573d';
        ctx.fillRect(x, y + 9, TILE, 7);
        if (noise % 2 === 0) {
            ctx.fillStyle = '#c59a76';
            ctx.fillRect(x + (noise % 9) + 1, y + ((noise >> 2) % 7) + 2, 2, 1);
        }
    }

    _drawBurntGround(ctx, x, y, noise, dark, time) {
        const ember = Math.sin(time * 2.6 + x * 0.05 + y * 0.04) * 0.5 + 0.5;
        ctx.fillStyle = dark ? '#4a1d14' : '#8c3a22';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = dark ? '#2a0e08' : '#5a2016';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = dark ? '#b8482a' : '#ff7a4a';
        ctx.fillRect(x + 1, y + 3, TILE - 3, 1);
        if (noise % 11 === 0) {
            ctx.fillStyle = `rgba(255, 120, 50, ${0.25 + ember * 0.35})`;
            ctx.fillRect(x + (noise % 10) + 2, y + ((noise >> 3) % 10) + 2, 2, 2);
        }
        if (noise % 7 === 0) {
            ctx.fillStyle = '#1d0906';
            ctx.fillRect(x + (noise % 12) + 1, y + ((noise >> 4) % 10) + 4, 1, 1);
        }
    }

    _drawBurntPath(ctx, x, y, noise) {
        ctx.fillStyle = '#5a2a1c';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3a1a10';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = '#c25538';
        ctx.fillRect(x + 2, y + 3, TILE - 5, 1);
        if (noise % 3 === 0) {
            ctx.fillStyle = '#ffaa6a';
            ctx.fillRect(x + (noise % 9) + 1, y + ((noise >> 2) % 6) + 4, 1, 1);
        }
    }

    _drawSteppeGround(ctx, x, y, noise, dark) {
        ctx.fillStyle = dark ? '#6e6240' : '#a69864';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = dark ? '#4c4530' : '#7e734a';
        ctx.fillRect(x, y + 10, TILE, 6);
        // sparse scrub grass
        if (noise % 4 === 0) {
            ctx.fillStyle = dark ? '#5a6230' : '#7a8a3a';
            ctx.fillRect(x + (noise % 10) + 2, y + ((noise >> 3) % 9) + 3, 1, 2);
        }
        if (noise % 9 === 0) {
            ctx.fillStyle = '#c9b87a';
            ctx.fillRect(x + (noise % 11) + 1, y + ((noise >> 4) % 9) + 2, 2, 1);
        }
    }

    _drawSteppePath(ctx, x, y, noise) {
        ctx.fillStyle = '#8a7748';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#5e4f30';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = '#b9a668';
        ctx.fillRect(x + 2, y + 3, TILE - 5, 1);
        if (noise % 2 === 0) {
            ctx.fillStyle = '#d8c784';
            ctx.fillRect(x + (noise % 9) + 1, y + ((noise >> 2) % 7) + 2, 2, 1);
        }
    }

    _drawCanyonPath(ctx, x, y) {
        ctx.fillStyle = '#cb7a51';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#8d4e34';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = '#f7b879';
        ctx.fillRect(x + 2, y + 3, TILE - 5, 1);
    }

    _drawSaltPath(ctx, x, y, noise, time) {
        const pulse = Math.sin(time * 2.2 + x * 0.05 + y * 0.03) * 0.5 + 0.5;
        ctx.fillStyle = '#ebf7ff';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#a9d6ff';
        ctx.fillRect(x, y + 11, TILE, 5);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + pulse * 0.24})`;
        ctx.fillRect(x + 1, y + 2, TILE - 2, 2);
        if (noise % 3 === 0) ctx.fillRect(x + 3, y + 7, TILE - 6, 1);
    }

    _drawTropicsPath(ctx, x, y) {
        ctx.fillStyle = '#789b70';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#536c54';
        ctx.fillRect(x, y + 10, TILE, 6);
        ctx.fillStyle = '#a5c29f';
        ctx.fillRect(x + 1, y + 2, TILE - 3, 1);
    }

    _drawLilyPadTile(ctx, x, y, noise, time) {
        const bob = Math.sin(time * 3 + noise * 0.2) * 0.5 + 0.5;
        ctx.fillStyle = '#0f7b86';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#2e9f52';
        ctx.fillRect(x + 1, y + 2, TILE - 3, TILE - 5);
        ctx.fillStyle = '#ff69cb';
        ctx.fillRect(x + 2, y + TILE - 5, TILE - 6, 2);
        ctx.fillStyle = '#76d96d';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + bob * 0.08})`;
        ctx.fillRect(x + 3, y + 4, 4, 1);
    }

    _drawBiomeRock(ctx, x, y, noise, biomeKey) {
        if (biomeKey === 'canyon') {
            ctx.fillStyle = '#5d2e38';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#b05b3f';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#ffb073';
            ctx.fillRect(x + 6, y + 6, 4, 3);
        } else if (biomeKey === 'salt') {
            ctx.fillStyle = '#ccd6e5';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#f7fbff';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#8fbfe8';
            ctx.fillRect(x + 6, y + 6, 4, 3);
        } else if (biomeKey === 'tropics') {
            ctx.fillStyle = '#466554';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#7f9381';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#9edc74';
            ctx.fillRect(x + 4, y + 4, 3, 1);
        } else if (biomeKey === 'driftmere') {
            ctx.fillStyle = '#3b5960';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#6c8790';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#8fd59c';
            ctx.fillRect(x + 5, y + 4, 4, 1);
        } else if (biomeKey === 'burnt') {
            ctx.fillStyle = '#3a1a14';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#6a2f22';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#ff7a4a';
            ctx.fillRect(x + 6, y + 6, 4, 3);
        } else if (biomeKey === 'steppe') {
            ctx.fillStyle = '#3e3a2a';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#6a6245';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#b9a86a';
            ctx.fillRect(x + 6, y + 6, 4, 3);
        } else {
            ctx.fillStyle = '#5b4b40';
            ctx.fillRect(x + 2, y + 4, 12, 10);
            ctx.fillStyle = '#8b7055';
            ctx.fillRect(x + 3, y + 5, 10, 7);
            ctx.fillStyle = '#d2b186';
            ctx.fillRect(x + 6, y + 6, 4, 3);
        }
        if (noise % 4 === 0) {
            ctx.fillStyle = biomeKey === 'tropics'
                ? '#87cf78'
                : biomeKey === 'driftmere'
                    ? '#c2fff1'
                    : '#ffffff33';
            ctx.fillRect(x + 4, y + 4, 3, 1);
        }
    }

    _drawSaltCrystal(ctx, x, y, time) {
        const glow = Math.sin(time * 3.6 + x * 0.05 + y * 0.03) * 0.5 + 0.5;
        ctx.fillStyle = '#edf7ff';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#c2d8ef';
        ctx.fillRect(x + 5, y + 2, 2, 11);
        ctx.fillRect(x + 8, y + 4, 2, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y + 3, 1, 8);
        ctx.fillRect(x + 9, y + 5, 1, 6);
        ctx.fillStyle = `rgba(191, 241, 255, ${0.12 + glow * 0.14})`;
        ctx.fillRect(x - 3, y - 3, TILE + 6, TILE + 6);
    }

    _drawFoam(ctx, x, y, row, col, time, biomeKey) {
        const pulse = Math.sin(time * 2 + row + col) * 0.5 + 0.5;
        ctx.fillStyle = biomeKey === 'tropics'
            ? `rgba(180, 255, 244, ${0.16 + pulse * 0.1})`
            : biomeKey === 'driftmere'
                ? `rgba(196, 255, 240, ${0.14 + pulse * 0.1})`
                : `rgba(240, 248, 255, ${0.16 + pulse * 0.1})`;
        if (this.tileAt(col, row - 1) <= 1) ctx.fillRect(x + 1, y + 1, TILE - 2, 2);
        if (this.tileAt(col, row + 1) <= 1) ctx.fillRect(x + 1, y + TILE - 3, TILE - 2, 2);
        if (this.tileAt(col - 1, row) <= 1) ctx.fillRect(x + 1, y + 1, 2, TILE - 2);
        if (this.tileAt(col + 1, row) <= 1) ctx.fillRect(x + TILE - 3, y + 1, 2, TILE - 2);
    }

    _drawDriftmereGlow(ctx, x, y, noise, time) {
        const pulse = Math.sin(time * 2.8 + noise * 0.4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(143, 255, 236, ${0.08 + pulse * 0.16})`;
        ctx.fillRect(x + 5, y + 5, 4, 4);
        ctx.fillStyle = `rgba(165, 206, 255, ${0.06 + pulse * 0.12})`;
        ctx.fillRect(x + 7, y + 6, 2, 2);
    }

    _drawDustSpark(ctx, x, y, noise, time) {
        const pulse = Math.sin(time * 1.8 + noise * 0.4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 225, 167, ${0.05 + pulse * 0.1})`;
        ctx.fillRect(x + 5, y + 6, 3, 2);
        ctx.fillRect(x + 9, y + 8, 2, 1);
    }

    _drawSaltSpark(ctx, x, y, noise, time) {
        const pulse = Math.sin(time * 2.5 + noise * 0.35) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + pulse * 0.18})`;
        ctx.fillRect(x + 6, y + 5, 3, 3);
        ctx.fillStyle = `rgba(180, 233, 255, ${0.14 + pulse * 0.2})`;
        ctx.fillRect(x + 7, y + 4, 1, 5);
    }

    _drawTropicsGlow(ctx, x, y, noise, time) {
        const pulse = Math.sin(time * 3 + noise * 0.4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(111, 255, 213, ${0.1 + pulse * 0.18})`;
        ctx.fillRect(x + 5, y + 5, 4, 4);
        ctx.fillStyle = `rgba(255, 132, 211, ${0.08 + pulse * 0.12})`;
        ctx.fillRect(x + 7, y + 7, 2, 2);
    }

    _drawCampfire(ctx, x, y, time) {
        const flicker = Math.sin(time * 14) * 0.5 + 0.5;
        ctx.fillStyle = '#51433a';
        ctx.fillRect(x - 6, y + 2, 4, 2);
        ctx.fillRect(x + 2, y + 2, 4, 2);
        ctx.fillStyle = '#ffbb4a';
        ctx.fillRect(x - 2, y - 4, 5, 7);
        ctx.fillStyle = '#fff2a1';
        ctx.fillRect(x, y - 3, 1, 3);
        ctx.fillStyle = `rgba(255, 180, 82, ${0.12 + flicker * 0.18})`;
        ctx.fillRect(x - 8, y - 9, 16, 16);
    }

    _drawSignalFire(ctx, x, y, time) {
        const flicker = Math.sin(time * 11 + x * 0.02) * 0.5 + 0.5;
        ctx.fillStyle = '#a56b41';
        ctx.fillRect(x - 3, y - 2, 6, 10);
        ctx.fillStyle = '#ffb672';
        ctx.fillRect(x - 2, y - 8, 5, 7);
        ctx.fillStyle = `rgba(255, 174, 99, ${0.1 + flicker * 0.16})`;
        ctx.fillRect(x - 9, y - 12, 18, 18);
    }

    _drawSaltMonolith(ctx, x, y, time) {
        const glow = Math.sin(time * 2.8 + x * 0.03) * 0.5 + 0.5;
        ctx.fillStyle = '#a8bdd0';
        ctx.fillRect(x - 5, y - 12, 10, 16);
        ctx.fillStyle = '#eef7ff';
        ctx.fillRect(x - 3, y - 10, 6, 11);
        ctx.fillStyle = `rgba(190, 243, 255, ${0.08 + glow * 0.12})`;
        ctx.fillRect(x - 6, y - 16, 12, 18);
    }

    _drawSignpost(ctx, x, y) {
        ctx.fillStyle = '#4e331d';
        ctx.fillRect(x, y, 2, 10);
        ctx.fillStyle = '#b98a54';
        ctx.fillRect(x - 5, y + 1, 10, 4);
    }

    _drawObelisk(ctx, x, y, time, accent = '#ffd27b') {
        const glow = Math.sin(time * 1.8 + x * 0.02) * 0.5 + 0.5;
        ctx.fillStyle = '#5a4a38';
        ctx.fillRect(x - 4, y + 4, 8, 4);
        ctx.fillStyle = '#7a6148';
        ctx.fillRect(x - 3, y - 14, 6, 20);
        ctx.fillStyle = '#a58463';
        ctx.fillRect(x - 2, y - 13, 4, 18);
        ctx.fillStyle = accent;
        ctx.fillRect(x - 1, y - 8, 2, 2);
        ctx.fillRect(x - 1, y - 2, 2, 2);
        ctx.fillStyle = `rgba(255, 210, 123, ${0.06 + glow * 0.12})`;
        ctx.fillRect(x - 7, y - 18, 14, 24);
    }

    _drawLighthouse(ctx, x, y, time) {
        const pulse = (Math.sin(time * 2.2) * 0.5 + 0.5);
        // Rocky base
        ctx.fillStyle = '#5f6066';
        ctx.fillRect(x - 6, y + 4, 12, 6);
        // Tower body (white-and-red stripes)
        ctx.fillStyle = '#f6f2e6';
        ctx.fillRect(x - 4, y - 14, 8, 18);
        ctx.fillStyle = '#c84b3a';
        ctx.fillRect(x - 4, y - 10, 8, 3);
        ctx.fillRect(x - 4, y - 2, 8, 3);
        // Top rail
        ctx.fillStyle = '#2c2c33';
        ctx.fillRect(x - 5, y - 16, 10, 2);
        // Lantern room
        ctx.fillStyle = `rgba(255, 232, 140, ${0.6 + pulse * 0.4})`;
        ctx.fillRect(x - 3, y - 22, 6, 5);
        // Cap
        ctx.fillStyle = '#3a2d28';
        ctx.fillRect(x - 4, y - 24, 8, 2);
        ctx.fillRect(x - 1, y - 26, 2, 2);
        // Light beam
        ctx.fillStyle = `rgba(255, 242, 180, ${0.08 + pulse * 0.2})`;
        ctx.fillRect(x - 14, y - 22, 28, 4);
    }

    _drawWatchtower(ctx, x, y, time) {
        const flicker = Math.sin(time * 6 + x * 0.04) * 0.5 + 0.5;
        // Base
        ctx.fillStyle = '#3f342a';
        ctx.fillRect(x - 5, y + 6, 10, 4);
        // Stone legs
        ctx.fillStyle = '#6b5641';
        ctx.fillRect(x - 4, y - 4, 3, 10);
        ctx.fillRect(x + 1, y - 4, 3, 10);
        // Platform
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x - 6, y - 6, 12, 3);
        // Watch hut
        ctx.fillStyle = '#8a6b48';
        ctx.fillRect(x - 4, y - 14, 8, 8);
        // Roof
        ctx.fillStyle = '#3a2820';
        ctx.fillRect(x - 5, y - 16, 10, 2);
        // Window with torch glow
        ctx.fillStyle = `rgba(255, 180, 90, ${0.5 + flicker * 0.4})`;
        ctx.fillRect(x - 1, y - 12, 2, 3);
    }

    _drawStandingStones(ctx, x, y, time, accent = '#bba67a') {
        const glow = Math.sin(time * 1.4 + x * 0.03) * 0.5 + 0.5;
        // Four stones in a rough circle
        const positions = [
            [-8, 2, 3, 9],
            [8, 2, 3, 8],
            [-3, -4, 3, 7],
            [4, -3, 3, 8],
        ];
        for (const [ox, oy, w, h] of positions) {
            ctx.fillStyle = '#4a4338';
            ctx.fillRect(x + ox - 1, y + oy + h - 1, w + 2, 2);
            ctx.fillStyle = '#6f6456';
            ctx.fillRect(x + ox, y + oy, w, h);
            ctx.fillStyle = '#8c7f6d';
            ctx.fillRect(x + ox, y + oy, 1, h);
        }
        ctx.fillStyle = `rgba(${this._hexToRgb(accent)}, ${0.06 + glow * 0.1})`;
        ctx.fillRect(x - 10, y - 6, 20, 16);
    }

    _drawAncientWell(ctx, x, y, time) {
        const shimmer = Math.sin(time * 2.6 + x * 0.02) * 0.5 + 0.5;
        // Stone rim
        ctx.fillStyle = '#4e4439';
        ctx.fillRect(x - 5, y + 3, 10, 3);
        ctx.fillStyle = '#7a6c5a';
        ctx.fillRect(x - 4, y - 1, 8, 5);
        ctx.fillStyle = '#5a4d3f';
        ctx.fillRect(x - 4, y + 1, 8, 1);
        // Water surface
        ctx.fillStyle = `rgba(90, 160, 180, ${0.55 + shimmer * 0.25})`;
        ctx.fillRect(x - 3, y, 6, 2);
        // Posts and beam
        ctx.fillStyle = '#4e3320';
        ctx.fillRect(x - 5, y - 8, 2, 8);
        ctx.fillRect(x + 3, y - 8, 2, 8);
        ctx.fillRect(x - 5, y - 9, 10, 2);
        // Rope + bucket
        ctx.fillStyle = '#d8c79a';
        ctx.fillRect(x - 1, y - 7, 1, 5);
        ctx.fillStyle = '#6d4a28';
        ctx.fillRect(x - 2, y - 2, 3, 2);
    }

    _drawWindmill(ctx, x, y, time) {
        const spin = time * 1.4;
        // Stone base
        ctx.fillStyle = '#4a4035';
        ctx.fillRect(x - 5, y + 8, 10, 4);
        ctx.fillStyle = '#7a6d5a';
        ctx.fillRect(x - 4, y - 6, 8, 14);
        // Door
        ctx.fillStyle = '#3a2820';
        ctx.fillRect(x - 1, y + 4, 3, 5);
        // Roof
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(x - 5, y - 9, 10, 3);
        ctx.fillRect(x - 3, y - 11, 6, 2);
        // Axle
        ctx.fillStyle = '#2c2419';
        ctx.fillRect(x - 1, y - 7, 2, 2);
        // Rotating blades — two crossed rectangles rotated by spin
        const bladeColor = '#e4d5a2';
        const bladeShadow = '#a89768';
        const hubX = x;
        const hubY = y - 6;
        for (let i = 0; i < 4; i++) {
            const ang = spin + (i * Math.PI) / 2;
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            // Blade from hub outward
            ctx.fillStyle = bladeShadow;
            for (let step = 0; step < 10; step++) {
                const px = Math.round(hubX + dx * step);
                const py = Math.round(hubY + dy * step);
                ctx.fillRect(px, py, 1, 1);
            }
            ctx.fillStyle = bladeColor;
            const tipX = Math.round(hubX + dx * 9 - dy * 2);
            const tipY = Math.round(hubY + dy * 9 + dx * 2);
            ctx.fillRect(tipX, tipY, 2, 2);
        }
        // Hub
        ctx.fillStyle = '#d8c27a';
        ctx.fillRect(hubX - 1, hubY - 1, 2, 2);
    }

    _drawShipwreck(ctx, x, y, time) {
        const sway = Math.sin(time * 1.2 + x * 0.01) * 0.5;
        // Hull shadow
        ctx.fillStyle = '#2a1e18';
        ctx.fillRect(x - 11, y + 4, 22, 3);
        // Broken hull (long, tilted look via offset rows)
        ctx.fillStyle = '#5a3a28';
        ctx.fillRect(x - 10, y, 20, 4);
        ctx.fillStyle = '#7a5238';
        ctx.fillRect(x - 9, y + 1, 18, 2);
        ctx.fillStyle = '#3a2518';
        ctx.fillRect(x - 10, y + 3, 20, 1);
        // Snapped mast leaning
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(x - 1, y - 8, 2, 8);
        ctx.fillRect(x - 2, y - 10, 3, 2);
        // Torn sail fragment
        ctx.fillStyle = `rgba(220, 210, 180, ${0.65 + sway * 0.1})`;
        ctx.fillRect(x + 1, y - 7, 4, 3);
        // Plank debris
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(x - 13, y + 5, 4, 1);
        ctx.fillRect(x + 10, y + 5, 3, 1);
    }

    _drawBrokenArch(ctx, x, y, time) {
        const glow = Math.sin(time * 1.6 + x * 0.01) * 0.5 + 0.5;
        // Left pillar
        ctx.fillStyle = '#564a3e';
        ctx.fillRect(x - 9, y + 3, 5, 10);
        ctx.fillStyle = '#7e6f5e';
        ctx.fillRect(x - 8, y + 4, 3, 9);
        // Right pillar
        ctx.fillStyle = '#564a3e';
        ctx.fillRect(x + 4, y + 3, 5, 10);
        ctx.fillStyle = '#7e6f5e';
        ctx.fillRect(x + 5, y + 4, 3, 9);
        // Left capital (broken off at top)
        ctx.fillStyle = '#3e362c';
        ctx.fillRect(x - 10, y + 1, 7, 2);
        // Right capital with partial arch stub
        ctx.fillStyle = '#3e362c';
        ctx.fillRect(x + 3, y + 1, 7, 2);
        ctx.fillRect(x + 4, y - 1, 5, 2);
        // Rubble on ground
        ctx.fillStyle = '#4a4034';
        ctx.fillRect(x - 3, y + 11, 6, 2);
        // Faint magical shimmer between pillars
        ctx.fillStyle = `rgba(142, 255, 236, ${0.05 + glow * 0.08})`;
        ctx.fillRect(x - 3, y + 2, 6, 10);
    }

    _hexToRgb(hex) {
        const h = hex.replace('#', '');
        const n = parseInt(h, 16);
        return `${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}`;
    }
}
