import { PixelFont } from './pixelText.js?v=20260414-no-bridge-pass2';
import { loadImage, SpriteSheet } from './sprite.js?v=20260414-no-bridge-pass2';
import { ENEMY_CONFIGS } from './enemy.js?v=20260416-frontier-rusher-archer-goliath';

const ENVIRONMENT_PROP_FILES = {
    pineTall: 'assets/sprites/environment/foliage_prop_00.png',
    oakLarge: 'assets/sprites/environment/foliage_prop_01.png',
    pineMid: 'assets/sprites/environment/foliage_prop_02.png',
    goldTree: 'assets/sprites/environment/foliage_prop_03.png',
    birch: 'assets/sprites/environment/foliage_prop_04.png',
    pineSlim: 'assets/sprites/environment/foliage_prop_05.png',
    lanternTree: 'assets/sprites/environment/foliage_prop_06.png',
    snowPineTall: 'assets/sprites/environment/foliage_prop_07.png',
    autumnOak: 'assets/sprites/environment/foliage_prop_08.png',
    autumnMaple: 'assets/sprites/environment/foliage_prop_09.png',
    snowPineMid: 'assets/sprites/environment/foliage_prop_10.png',
    deadTree: 'assets/sprites/environment/foliage_prop_11.png',
    snowPineSlim: 'assets/sprites/environment/foliage_prop_12.png',
    crystalCluster: 'assets/sprites/environment/foliage_prop_13.png',
    reeds: 'assets/sprites/environment/foliage_prop_14.png',
    roundBush: 'assets/sprites/environment/foliage_prop_15.png',
    berryBush: 'assets/sprites/environment/foliage_prop_16.png',
    flowerBush: 'assets/sprites/environment/foliage_prop_17.png',
    blueBush: 'assets/sprites/environment/foliage_prop_18.png',
    glowBush: 'assets/sprites/environment/foliage_prop_19.png',
    canyonMesa: 'assets/sprites/biomes/canyon_mesa.png',
    canyonCave: 'assets/sprites/biomes/canyon_cave.png',
    saltCrystalCluster: 'assets/sprites/biomes/salt_crystal_cluster.png',
    saltCrystalTall: 'assets/sprites/biomes/salt_crystal_tall.png',
    saltCrystalSpire: 'assets/sprites/biomes/salt_crystal_spire.png',
    tropicsVines: 'assets/sprites/biomes/tropics_vines.png',
    tropicsLilyCluster: 'assets/sprites/biomes/tropics_lily_cluster.png',
    tropicsRuins: 'assets/sprites/biomes/tropics_ruins.png',
    tropicsRuinWall: 'assets/sprites/biomes/tropics_ruin_wall.png',
    tropicsPalmGlow: 'assets/sprites/biomes/tropics_palm_glow.png',
};

const NPC_VARIANT_CONFIGS = {
    'drift-scout': {
        base: 'elara',
        tint: '#6fd3ff',
        accent: '#dffbff',
        tintStrength: 0.16,
    },
    'tide-medic': {
        base: 'elara',
        tint: '#57d7c3',
        accent: '#f2ffcc',
        tintStrength: 0.18,
        flipX: true,
    },
    'ember-guide': {
        base: 'elara',
        tint: '#ffb169',
        accent: '#fff0bf',
        tintStrength: 0.16,
    },
    'salt-scribe': {
        base: 'elara',
        tint: '#b8d9ff',
        accent: '#ffffff',
        tintStrength: 0.18,
        flipX: true,
    },
    'glow-warden': {
        base: 'elara',
        tint: '#8bed91',
        accent: '#f8ffd4',
        tintStrength: 0.16,
    },
    'lantern-keeper': {
        base: 'boatman',
        tint: '#ffb56f',
        accent: '#fff0ab',
        tintStrength: 0.14,
    },
    'dusk-guard': {
        base: 'boatman',
        tint: '#96a7ff',
        accent: '#edf0ff',
        tintStrength: 0.14,
        flipX: true,
    },
    'road-smith': {
        base: 'boatman',
        tint: '#d6a05f',
        accent: '#fff0c5',
        tintStrength: 0.12,
    },
    'moss-fisher': {
        base: 'boatman',
        tint: '#76c79f',
        accent: '#e4fff0',
        tintStrength: 0.12,
        flipX: true,
    },
    'salt-quartermaster': {
        base: 'boatman',
        tint: '#8fd8ff',
        accent: '#ffffff',
        tintStrength: 0.12,
    },
};

const GENERATED_NPC_FILES = {
    'mira-tide-medic': 'assets/sprites/npcs/generated/mira-tide-medic.png',
    'cadrin-lantern-keeper': 'assets/sprites/npcs/generated/cadrin-lantern-keeper.png',
    'nyra-wayfinder': 'assets/sprites/npcs/generated/nyra-wayfinder.png',
    'eamon-wreck-diver': 'assets/sprites/npcs/generated/eamon-wreck-diver.png',
    'suri-stone-reader': 'assets/sprites/npcs/generated/suri-stone-reader.png',
    'dax-canyon-lookout': 'assets/sprites/npcs/generated/dax-canyon-lookout.png',
    'veya-salt-scribe': 'assets/sprites/npcs/generated/veya-salt-scribe.png',
    'ila-herbalist': 'assets/sprites/npcs/generated/ila-herbalist.png',
    'bronn-road-smith': 'assets/sprites/npcs/generated/bronn-road-smith.png',
    'orra-watch-captain': 'assets/sprites/npcs/generated/orra-watch-captain.png',
    'kael-burnt-guide': 'assets/sprites/npcs/generated/kael-burnt-guide.png',
    'tovin-tide-cartographer': 'assets/sprites/npcs/generated/tovin-tide-cartographer.png',
    'luma-shell-courier': 'assets/sprites/npcs/generated/luma-shell-courier.png',
    'fenn-moon-ferrier': 'assets/sprites/npcs/generated/fenn-moon-ferrier.png',
    'qira-salt-glasswright': 'assets/sprites/npcs/generated/qira-salt-glasswright.png',
    'tamas-cinder-runner': 'assets/sprites/npcs/generated/tamas-cinder-runner.png',
    'neve-root-singer': 'assets/sprites/npcs/generated/neve-root-singer.png',
    'halden-starherd': 'assets/sprites/npcs/generated/halden-starherd.png',
};

function removeEdgeMatte(image, options = {}) {
    const { mode = 'auto', threshold = 32 } = options;

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let resolvedMode = mode;
    if (resolvedMode === 'auto') {
        const corners = [
            [0, 0],
            [width - 1, 0],
            [0, height - 1],
            [width - 1, height - 1],
        ];
        let bright = 0;
        for (const [cx, cy] of corners) {
            const i = (cy * width + cx) * 4;
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (avg > 180) bright += 1;
        }
        resolvedMode = bright >= 2 ? 'light' : 'dark';
    }

    const matches = (i) => {
        if (data[i + 3] === 0) return true;
        if (resolvedMode === 'light') {
            return (
                data[i] > 255 - threshold &&
                data[i + 1] > 255 - threshold &&
                data[i + 2] > 255 - threshold
            );
        }
        return (
            data[i] < threshold &&
            data[i + 1] < threshold &&
            data[i + 2] < threshold
        );
    };

    const visited = new Uint8Array(width * height);
    const queue = [];

    const enqueue = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;

        const pixelIndex = y * width + x;
        if (visited[pixelIndex]) return;

        const i = pixelIndex * 4;
        if (!matches(i)) return;

        visited[pixelIndex] = 1;
        queue.push(pixelIndex);
    };

    for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
    }

    while (queue.length > 0) {
        const pixelIndex = queue.pop();
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const i = pixelIndex * 4;

        data[i + 3] = 0;

        enqueue(x - 1, y);
        enqueue(x + 1, y);
        enqueue(x, y - 1);
        enqueue(x, y + 1);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function removeEdgeBlackMatte(image, threshold = 20) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    const visited = new Uint8Array(width * height);
    const queue = [];

    const enqueue = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;

        const pixelIndex = y * width + x;
        if (visited[pixelIndex]) return;

        const i = pixelIndex * 4;
        if (
            data[i + 3] === 0 ||
            data[i] > threshold ||
            data[i + 1] > threshold ||
            data[i + 2] > threshold
        ) {
            return;
        }

        visited[pixelIndex] = 1;
        queue.push(pixelIndex);
    };

    for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
    }

    for (let y = 0; y < height; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
    }

    while (queue.length > 0) {
        const pixelIndex = queue.pop();
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const i = pixelIndex * 4;

        data[i + 3] = 0;

        enqueue(x - 1, y);
        enqueue(x + 1, y);
        enqueue(x, y - 1);
        enqueue(x, y + 1);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function extractLeftmostSprite(image, { gap = 6, matteMode = 'light', matteThreshold = 36 } = {}) {
    const mattedCanvas = removeEdgeMatte(image, { mode: matteMode, threshold: matteThreshold });
    const trimmed = trimTransparentBounds(mattedCanvas, 0);
    const srcCanvas = trimmed.getContext ? trimmed : (() => { const c = document.createElement('canvas'); c.width = trimmed.width; c.height = trimmed.height; c.getContext('2d').drawImage(trimmed, 0, 0); return c; })();
    const ctx = srcCanvas.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const colHasAlpha = new Uint8Array(width);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 24) {
                colHasAlpha[x] = 1;
            }
        }
    }
    let start = 0;
    while (start < width && !colHasAlpha[start]) start++;
    let end = start;
    let consecutiveGap = 0;
    while (end < width) {
        if (colHasAlpha[end]) {
            consecutiveGap = 0;
            end++;
        } else {
            consecutiveGap++;
            if (consecutiveGap >= gap) break;
            end++;
        }
    }
    end -= consecutiveGap;
    const sliceW = Math.max(1, end - start);
    const slice = document.createElement('canvas');
    slice.width = sliceW;
    slice.height = height;
    const sliceCtx = slice.getContext('2d');
    sliceCtx.imageSmoothingEnabled = false;
    sliceCtx.drawImage(srcCanvas, start, 0, sliceW, height, 0, 0, sliceW, height);
    return trimTransparentBounds(slice, 0);
}

function cloneToCanvas(source) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    return canvas;
}

function extractFramesFromStrip(image, frameW, frameH, row = 0) {
    const cols = Math.max(1, Math.floor(image.width / frameW));
    const frames = [];
    for (let col = 0; col < cols; col++) {
        const frame = document.createElement('canvas');
        frame.width = frameW;
        frame.height = frameH;
        const ctx = frame.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            image,
            col * frameW,
            row * frameH,
            frameW,
            frameH,
            0,
            0,
            frameW,
            frameH,
        );
        frames.push(frame);
    }
    return frames;
}

function flipSprite(source) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0);
    return canvas;
}

function tintSprite(source, color, opacity = 0.16) {
    const canvas = cloneToCanvas(source);
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = opacity * 0.35;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    return canvas;
}

function addNpcAccentMarks(source, accent, family = 'elara') {
    const canvas = cloneToCanvas(source);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = accent;

    if (family === 'boatman') {
        ctx.fillRect(Math.max(1, Math.floor(canvas.width * 0.34)), Math.floor(canvas.height * 0.34), 3, 2);
        ctx.fillRect(Math.max(1, Math.floor(canvas.width * 0.47)), Math.floor(canvas.height * 0.72), 4, 1);
    } else {
        ctx.fillRect(Math.max(1, Math.floor(canvas.width * 0.56)), Math.floor(canvas.height * 0.42), 2, 2);
        ctx.fillRect(Math.max(1, Math.floor(canvas.width * 0.38)), Math.floor(canvas.height * 0.66), 3, 1);
    }
    return canvas;
}

function buildNpcVariant(baseFrames, {
    base = 'elara',
    tint = null,
    accent = '#8effec',
    tintStrength = 0.16,
    flipX: shouldFlip = false,
} = {}) {
    const family = base === 'boatman' ? 'boatman' : 'elara';
    const frames = baseFrames.map((frame) => {
        let next = cloneToCanvas(frame);
        if (tint) next = tintSprite(next, tint, tintStrength);
        next = addNpcAccentMarks(next, accent, family);
        if (shouldFlip) next = flipSprite(next);
        return next;
    });
    return {
        family,
        accent,
        frameDuration: family === 'boatman' ? 0.42 : 0.22,
        floatAmplitude: family === 'boatman' ? 0.6 : 0.3,
        floatSpeed: family === 'boatman' ? 1.6 : 2.1,
        frames,
    };
}

function extractSpriteGridDetailed(image, {
    whiteCutoff = 220,
    minSpriteW = 24,
    minSpriteH = 24,
    minSize = 200,
    maxSpriteW = 160,
    maxSpriteH = 200,
} = {}) {
    const width = image.width;
    const height = image.height;
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    const total = width * height;
    const mask = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
        const p = i * 4;
        if (data[p + 3] === 0) continue;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        if (r >= whiteCutoff && g >= whiteCutoff && b >= whiteCutoff) {
            data[p + 3] = 0;
            continue;
        }
        mask[i] = 1;
    }
    ctx.putImageData(imageData, 0, 0);

    const comp = new Int32Array(total);
    const stack = [];
    const bboxes = [];
    let compId = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (!mask[idx] || comp[idx]) continue;
            compId++;
            comp[idx] = compId;
            stack.push(idx);
            let minX = x, minY = y, maxX = x, maxY = y, size = 0;
            while (stack.length) {
                const k = stack.pop();
                const kx = k % width;
                const ky = (k - kx) / width;
                size++;
                if (kx < minX) minX = kx;
                if (kx > maxX) maxX = kx;
                if (ky < minY) minY = ky;
                if (ky > maxY) maxY = ky;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dy && !dx) continue;
                        const nx = kx + dx;
                        const ny = ky + dy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const nk = ny * width + nx;
                        if (mask[nk] && !comp[nk]) {
                            comp[nk] = compId;
                            stack.push(nk);
                        }
                    }
                }
            }
            bboxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, size });
        }
    }

    const sprites = [];
    for (const b of bboxes) {
        if (b.size < minSize) continue;
        if (b.w < minSpriteW || b.h < minSpriteH) continue;
        if (b.w > maxSpriteW || b.h > maxSpriteH) continue;
        const cell = document.createElement('canvas');
        cell.width = b.w;
        cell.height = b.h;
        const cellCtx = cell.getContext('2d');
        cellCtx.imageSmoothingEnabled = false;
        cellCtx.drawImage(source, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
        sprites.push({
            ...b,
            canvas: trimTransparentBounds(cell, 0),
        });
    }
    return sprites;
}

function extractSpriteGrid(image, options = {}) {
    return extractSpriteGridDetailed(image, options).map((entry) => entry.canvas);
}

function extractBoatmanFrames(image) {
    const sprites = extractSpriteGridDetailed(image, {
        whiteCutoff: 238,
        minSpriteW: 120,
        minSpriteH: 220,
        minSize: 8000,
        maxSpriteW: 640,
        maxSpriteH: 900,
    });
    const figures = sprites
        .sort((a, b) => (b.w * b.h) - (a.w * a.h))
        .slice(0, 2)
        .sort((a, b) => a.x - b.x)
        .map((entry) => fitSpriteToBox(entry.canvas, 32, 40));
    return figures.length ? figures : [fitSpriteToBox(extractLeftmostSprite(image), 32, 40)];
}

function fitSpriteToBox(source, boxW, boxH) {
    const scale = Math.min(boxW / source.width, boxH / source.height);
    const targetW = Math.max(1, Math.round(source.width * scale));
    const targetH = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = boxW;
    canvas.height = boxH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const dx = Math.floor((boxW - targetW) / 2);
    const dy = boxH - targetH;
    ctx.drawImage(source, 0, 0, source.width, source.height, dx, dy, targetW, targetH);
    return canvas;
}

function prepareGeneratedNpcSprite(image) {
    if (!image) return null;
    // Source PNGs already have transparent backgrounds (alpha=0 corners).
    // Running the dark-matte flood here would fill inward through the
    // transparent border and erase any opaque pixel where R/G/B are all
    // below the threshold — i.e. the figure's hair, shadows, dark clothing,
    // and outline edges. That destroyed 28-80% of every NPC's pixels.
    // Just trim to visible bounds and let fitSpriteToBox do the rest.
    const cleaned = trimTransparentBounds(image, 1);
    return {
        family: 'unique',
        w: 32,
        h: 40,
        frames: [fitSpriteToBox(cleaned, 32, 40)],
        portrait: cleaned,
        frameDuration: 0.34,
        floatAmplitude: 0.18,
        floatSpeed: 1.8,
    };
}

function trimTransparentBounds(image, padding = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha === 0) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < minX || maxY < minY) {
        return image;
    }

    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const trimmed = document.createElement('canvas');
    trimmed.width = maxX - minX + 1;
    trimmed.height = maxY - minY + 1;

    const trimmedCtx = trimmed.getContext('2d');
    trimmedCtx.drawImage(
        canvas,
        minX,
        minY,
        trimmed.width,
        trimmed.height,
        0,
        0,
        trimmed.width,
        trimmed.height,
    );
    return trimmed;
}

export async function loadGameAssets() {
    const environmentEntries = Object.entries(ENVIRONMENT_PROP_FILES);
    const enemyEntries = Object.entries(ENEMY_CONFIGS);
    const generatedNpcEntries = Object.entries(GENERATED_NPC_FILES);
    const [
        playerImage,
        swordImage,
        slashImage,
        fontImage,
        settingsBanner,
        menuBase,
        menuNewGame,
        menuLoad,
        menuOptions,
        menuExit,
        titlePointer,
        elaraIdleImage,
        elaraDialog1,
        elaraDialog2,
        boatmanIdleImage,
        boatmanDialog1,
        boatmanDialog2,
        boatmanDialog3,
        rowboatSheetImage,
        aiSheet1Image,
        aiSheet2Image,
        mapScrollImage,
        treasureChestClosedImage,
        treasureChestOpenImage,
        levelUpAbilityImage,
        portalImage,
        tombstoneRaw,
        deathQuitRaw,
        deathReloadRaw,
        worldMapImage,
        pillarSheetImage,
        sandwormSheetImage,
        ...runtimeImages
    ] = await Promise.all([
        loadImage('assets/sprites/player/driftwalker_walk_strip.png'),
        loadImage('assets/sprites/weapons/shardfang_icon.png'),
        loadImage('assets/sprites/weapons/shardfang_slash_strip.png'),
        loadImage('assets/ui/fonts/pixel-font.png'),
        loadImage('assets/ui/panels/settings-banner.png'),
        loadImage('assets/ui/menu_states/title-menu-base.png'),
        loadImage('assets/ui/menu_states/title-menu-new-game.png'),
        loadImage('assets/ui/menu_states/title-menu-load.png'),
        loadImage('assets/ui/menu_states/title-menu-options.png'),
        loadImage('assets/ui/menu_states/title-menu-exit.png'),
        loadImage('assets/ui/title_menu/pointer.png'),
        loadImage('assets/sprites/npcs/elara_idle_strip.png'),
        loadImage('assets/ui/dialog/elara_dialogue_1.png'),
        loadImage('assets/ui/dialog/elara_dialogue_2.png'),
        loadImage('assets/sprites/npcs/boatman_idle.png'),
        loadImage('assets/ui/dialog/boatman_dialogue_1.png'),
        loadImage('assets/ui/dialog/boatman_dialogue_2.png'),
        loadImage('assets/ui/dialog/boatman_dialogue_3.png'),
        loadImage('assets/sprites/environment/rowboat_sheet.png'),
        loadImage('assets/sprites/environment/ai_sheet_1.png'),
        loadImage('assets/sprites/environment/ai_sheet_2.png'),
        loadImage('assets/ui/map/map_scroll.png'),
        loadImage('assets/sprites/environment/treasure-chest-closed.png'),
        loadImage('assets/sprites/environment/treasure-chest-open.png'),
        loadImage('assets/ui/rewards/level-up-ability.png'),
        loadImage('assets/sprites/environment/index_portal.png'),
        loadImage('assets/sprites/environment/tombstone_idle_strip.png'),
        loadImage('assets/reference/provided_pixel_art/You_Died%20(Quit).png'),
        loadImage('assets/reference/provided_pixel_art/You_Died%20(Reload).png'),
        loadImage('assets/reference/provided_pixel_art/Map.jpg'),
        loadImage('assets/sprites/pillars/pillar_sheet.png'),
        loadImage('assets/sprites/boss/sandworm_sheet.png'),
        ...enemyEntries.map(([, config]) => loadImage(config.src)),
        ...generatedNpcEntries.map(([id, src]) => loadImage(src).catch((error) => {
            console.warn(`Zendoria: optional generated NPC art failed for ${id}`, error);
            return null;
        })),
        ...environmentEntries.map(([, src]) => loadImage(src)),
    ]);

    const enemyImages = runtimeImages.slice(0, enemyEntries.length);
    const generatedNpcImages = runtimeImages.slice(enemyEntries.length, enemyEntries.length + generatedNpcEntries.length);
    const environmentImages = runtimeImages.slice(enemyEntries.length + generatedNpcEntries.length);
    const enemySheets = Object.fromEntries(
        enemyEntries.map(([kind, config], index) => [
            kind,
            new SpriteSheet(enemyImages[index], config.frameW, config.frameH),
        ]),
    );
    const npcGeneratedVariants = Object.fromEntries(
        generatedNpcEntries.map(([id], index) => [id, prepareGeneratedNpcSprite(generatedNpcImages[index])]),
    );
    const environmentProps = Object.fromEntries(
        environmentEntries.map(([key], index) => [key, environmentImages[index]]),
    );
    const trimmedPortalImage = trimTransparentBounds(portalImage, 6);

    const tombstoneSheet = new SpriteSheet(
        tombstoneRaw,
        Math.floor(tombstoneRaw.width / 2),
        tombstoneRaw.height,
    );
    const elaraIdleFrames = extractFramesFromStrip(elaraIdleImage, 24, 32);
    const boatmanIdleFrames = extractBoatmanFrames(boatmanIdleImage);
    const npcVariantBases = {
        elara: elaraIdleFrames,
        boatman: boatmanIdleFrames,
    };
    const npcVariants = Object.fromEntries(
        Object.entries(NPC_VARIANT_CONFIGS).map(([key, config]) => [
            key,
            buildNpcVariant(npcVariantBases[config.base] || elaraIdleFrames, config),
        ]),
    );

    return {
        playerSheet: new SpriteSheet(playerImage, 32, 40),
        enemySheets,
        blightwormSheet: enemySheets.blightworm,
        swordIcon: swordImage,
        slashSheet: new SpriteSheet(slashImage, 48, 48),
        pixelFont: new PixelFont(fontImage),
        elaraIdleSheet: new SpriteSheet(elaraIdleImage, 24, 32),
        elaraIdleFrames,
        elaraDialog1: removeEdgeBlackMatte(elaraDialog1),
        elaraDialog2: removeEdgeBlackMatte(elaraDialog2),
        boatmanSprite: boatmanIdleFrames[0],
        boatmanIdleFrames,
        boatmanDialog1: removeEdgeMatte(boatmanDialog1, { mode: 'light', threshold: 28 }),
        boatmanDialog2: removeEdgeMatte(boatmanDialog2, { mode: 'light', threshold: 28 }),
        boatmanDialog3: removeEdgeMatte(boatmanDialog3, { mode: 'light', threshold: 28 }),
        npcGeneratedVariants,
        npcVariants,
        rowboatSprite: fitSpriteToBox(
            extractSpriteGrid(rowboatSheetImage, { minSpriteW: 40, minSpriteH: 20, maxSpriteW: 400, maxSpriteH: 400, minSize: 500 })
                .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] ?? rowboatSheetImage,
            28, 20,
        ),
        aiDecorProps: [
            ...extractSpriteGrid(aiSheet1Image).map((sprite) => fitSpriteToBox(sprite, 28, 28)),
            ...extractSpriteGrid(aiSheet2Image).map((sprite) => fitSpriteToBox(sprite, 28, 28)),
        ],
        environmentProps,
        mapScrollImage: trimTransparentBounds(removeEdgeMatte(mapScrollImage, { mode: 'auto', threshold: 48 }), 2),
        treasureChestClosedImage: trimTransparentBounds(treasureChestClosedImage, 2),
        treasureChestOpenImage: trimTransparentBounds(treasureChestOpenImage, 2),
        levelUpAbilityImage: trimTransparentBounds(levelUpAbilityImage, 2),
        portalImage: trimmedPortalImage,
        tombstoneSheet,
        deathQuitImage: deathQuitRaw,
        deathReloadImage: deathReloadRaw,
        worldMapImage,
        pillarSheet: new SpriteSheet(pillarSheetImage, 47, 48),
        sandwormSheet: new SpriteSheet(sandwormSheetImage, 182, 96),
        titleVoiceSrc: 'assets/audio/voice/title-intro-cornelius.mp3',
        gameMusicSrc: 'assets/audio/music/driftmere-battle-loop.mp3',
        titleMusicSrc: 'assets/audio/music/View_from_the_World_Map.mp3',
        textSoundSrc: 'assets/audio/voice/text-sound.mp3',
        deathSoundSrc: 'assets/audio/music/Death screen sound.mp3',
        desertMusicSrc: 'assets/audio/music/Desert sound track.mp3',
        swordSlashSoundSrc: 'assets/audio/music/Sword_Slashing.mp3',
        uiPreload: {
            settingsBanner,
            titlePointer,
            menuStates: {
                base: menuBase,
                'new-game': menuNewGame,
                load: menuLoad,
                options: menuOptions,
                exit: menuExit,
            },
        },
    };
}
