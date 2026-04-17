import { TILE } from './constants.js?v=20260416-realm-split';

const SOLID = new Set([0, 1, 6, 7, 8]);

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

        this.rows = 60;
        this.cols = 88;

        this.arrivalPoints = {
            start: { x: 24 * TILE, y: 34 * TILE },
            fromFrontier: { x: 58 * TILE, y: 32 * TILE },
        };
        this.playerSpawn = { ...this.arrivalPoints.start };
        this.elaraSpawn = { x: 28 * TILE, y: 32 * TILE };
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
        };

        this.fixedEnemySpawns = [
            { kind: 'blightworm', x: 43 * TILE + 2, y: 21 * TILE + 2 },
            { kind: 'blightworm', x: 48 * TILE + 2, y: 42 * TILE + 2 },
            { kind: 'blightworm', x: 62 * TILE + 2, y: 24 * TILE + 2 },
            { kind: 'blightworm', x: 65 * TILE + 2, y: 37 * TILE + 2 },
        ];

        this.enemySpawnNodes = [
            { kind: 'blightworm', x: 47 * TILE + 8, y: 22 * TILE + 8, interval: 16, maxAlive: 2, leashRadius: 66, activationRadius: 220 },
            { kind: 'blightworm', x: 62 * TILE + 8, y: 38 * TILE + 8, interval: 15, maxAlive: 2, leashRadius: 66, activationRadius: 220 },
        ];

        this.mapMarkers = [
            { type: 'camp', x: this.landmarks.camp.x, y: this.landmarks.camp.y, label: this.landmarks.camp.label },
            { type: 'portal', x: this.landmarks.portal.x, y: this.landmarks.portal.y, label: this.landmarks.portal.label },
        ];
    }

    _setupFrontier() {
        this.realmLabel = 'SUNCLEFT FRONTIER';
        this.mapTitle = 'SUNCLEFT FRONTIER';

        this.rows = 92;
        this.cols = 132;

        this.arrivalPoints = {
            start: { x: 88 * TILE, y: 46 * TILE },
            fromDriftmere: { x: 92 * TILE, y: 46 * TILE },
        };
        this.playerSpawn = { ...this.arrivalPoints.start };
        this.elaraSpawn = null;
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
            // Original
            { kind: 'sunscarab', x: 30 * TILE + 8, y: 58 * TILE + 8, interval: 14, maxAlive: 3, leashRadius: 72, activationRadius: 260 },
            { kind: 'duneWarden', x: 94 * TILE + 8, y: 22 * TILE + 8, interval: 18, maxAlive: 2, leashRadius: 80, activationRadius: 260 },
            { kind: 'blightworm', x: 82 * TILE + 8, y: 63 * TILE + 8, interval: 13, maxAlive: 3, leashRadius: 78, activationRadius: 260 },

            // Rusher swarms in the canyons — fast, low HP, frequent
            { kind: 'rusher', x: 86 * TILE + 8, y: 20 * TILE + 8, interval: 8, maxAlive: 4, leashRadius: 90, activationRadius: 260 },
            { kind: 'rusher', x: 96 * TILE + 8, y: 18 * TILE + 8, interval: 9, maxAlive: 3, leashRadius: 90, activationRadius: 260 },

            // Archer pickets in the salt flats
            { kind: 'tacticalArcher', x: 25 * TILE + 8, y: 52 * TILE + 8, interval: 18, maxAlive: 2, leashRadius: 100, activationRadius: 320 },
            { kind: 'tacticalArcher', x: 32 * TILE + 8, y: 60 * TILE + 8, interval: 20, maxAlive: 2, leashRadius: 100, activationRadius: 320 },

            // Goliath in the tropics ruins (rare, slow respawn)
            { kind: 'goliath', x: 72 * TILE + 8, y: 66 * TILE + 8, interval: 45, maxAlive: 1, leashRadius: 120, activationRadius: 280 },
        ];

        this.mapMarkers = [
            { type: 'camp', x: this.landmarks.camp.x, y: this.landmarks.camp.y, label: this.landmarks.camp.label },
            { type: 'portal', x: this.landmarks.portal.x, y: this.landmarks.portal.y, label: this.landmarks.portal.label },
            { type: 'canyon', x: this.landmarks.canyons.x, y: this.landmarks.canyons.y, label: this.landmarks.canyons.label },
            { type: 'salt', x: this.landmarks.salt.x, y: this.landmarks.salt.y, label: this.landmarks.salt.label },
            { type: 'tropics', x: this.landmarks.tropics.x, y: this.landmarks.tropics.y, label: this.landmarks.tropics.label },
            { type: 'relic', x: this.landmarks.relic.x, y: this.landmarks.relic.y, label: this.landmarks.relic.label },
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
        if (row <= 25 && col >= 34 && col <= 116) return 'canyon';
        if (col <= 33) return 'salt';
        return 'desert';
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

        return map;
    }

    _buildFrontierMap() {
        const height = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));

        this._addLandMass(height, 79, 46, 45, 34, 1.18);
        this._addLandMass(height, 48, 49, 30, 26, 1.02);
        this._addLandMass(height, 91, 23, 31, 14, 0.92);
        this._addLandMass(height, 108, 56, 18, 24, 0.56);
        this._addLandMass(height, 24, 49, 13, 22, 0.5);

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
                } else {
                    map[row][col] = h < 0.42 ? 2 : (h < 0.8 ? 3 : 4);
                }
            }
        }

        this._paintPathLine(map, 88, 46, 76, 46, 1.35);
        this._paintPathLine(map, 76, 46, 58, 48, 1.25);
        this._paintPathLine(map, 58, 48, 38, 50, 1.2);
        this._paintPathLine(map, 38, 50, 24, 50, 1.25);

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
        } else {
            structs.push(this._makeCampfire(24 * TILE + 8, 34 * TILE + 7));
            structs.push(this._makeSignpost(30 * TILE + 7, 33 * TILE + 6));
            structs.push(this._makeSignpost(59 * TILE + 7, 31 * TILE + 6));
            // Portal-adjacent beacon for Amberwake Gate, shifted south-east of the portal.
            structs.push(this._makeSignalFire(67 * TILE + 4, 33 * TILE + 10));
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

    collides(x, y, w, h) {
        const c0 = Math.floor(x / TILE);
        const r0 = Math.floor(y / TILE);
        const c1 = Math.floor((x + w - 1) / TILE);
        const r1 = Math.floor((y + h - 1) / TILE);

        for (let row = r0; row <= r1; row++) {
            for (let col = c0; col <= c1; col++) {
                if (SOLID.has(this.tileAt(col, row))) return true;
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
                    else this._drawDesertSand(ctx, x, y, row, col, n);
                } else if (tile === 3 || tile === 4) {
                    if (biomeKey === 'driftmere') this._drawDriftmereGround(ctx, x, y, n, tile === 4, time);
                    else if (biomeKey === 'canyon') this._drawCanyonGround(ctx, x, y, n, tile === 4);
                    else if (biomeKey === 'salt') this._drawSaltGround(ctx, x, y, n, tile === 4 ? 2 : 1);
                    else if (biomeKey === 'tropics') this._drawTropicsGround(ctx, x, y, n, tile === 4, time);
                    else this._drawDesertDune(ctx, x, y, n, tile === 4, time);
                } else if (tile === 5) {
                    if (biomeKey === 'driftmere') this._drawDriftmerePath(ctx, x, y, n, time);
                    else if (biomeKey === 'canyon') this._drawCanyonPath(ctx, x, y, n);
                    else if (biomeKey === 'salt') this._drawSaltPath(ctx, x, y, n, time);
                    else if (biomeKey === 'tropics' && inLagoon) this._drawLilyPadTile(ctx, x, y, n, time);
                    else if (biomeKey === 'tropics') this._drawTropicsPath(ctx, x, y, n);
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
}
