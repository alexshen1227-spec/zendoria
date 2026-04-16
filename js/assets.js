import { PixelFont } from './pixelText.js?v=20260414-no-bridge-pass2';
import { loadImage, SpriteSheet } from './sprite.js?v=20260414-no-bridge-pass2';
import { ENEMY_CONFIGS } from './enemy.js?v=20260414-desert-enemies';

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
        mapScrollImage,
        treasureChestClosedImage,
        treasureChestOpenImage,
        levelUpAbilityImage,
        portalImage,
        tombstoneRaw,
        deathQuitRaw,
        deathReloadRaw,
        worldMapImage,
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
        loadImage('assets/ui/map/map_scroll.png'),
        loadImage('assets/sprites/environment/treasure-chest-closed.png'),
        loadImage('assets/sprites/environment/treasure-chest-open.png'),
        loadImage('assets/ui/rewards/level-up-ability.png'),
        loadImage('assets/sprites/environment/index_portal.png'),
        loadImage('assets/sprites/environment/tombstone_idle_strip.png'),
        loadImage('assets/reference/provided_pixel_art/You_Died%20(Quit).png'),
        loadImage('assets/reference/provided_pixel_art/You_Died%20(Reload).png'),
        loadImage('assets/reference/provided_pixel_art/Map.jpg'),
        ...enemyEntries.map(([, config]) => loadImage(config.src)),
        ...environmentEntries.map(([, src]) => loadImage(src)),
    ]);

    const enemyImages = runtimeImages.slice(0, enemyEntries.length);
    const environmentImages = runtimeImages.slice(enemyEntries.length);
    const enemySheets = Object.fromEntries(
        enemyEntries.map(([kind, config], index) => [
            kind,
            new SpriteSheet(enemyImages[index], config.frameW, config.frameH),
        ]),
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

    return {
        playerSheet: new SpriteSheet(playerImage, 32, 40),
        enemySheets,
        blightwormSheet: enemySheets.blightworm,
        swordIcon: swordImage,
        slashSheet: new SpriteSheet(slashImage, 48, 48),
        pixelFont: new PixelFont(fontImage),
        elaraIdleSheet: new SpriteSheet(elaraIdleImage, 24, 32),
        elaraDialog1: removeEdgeBlackMatte(elaraDialog1),
        elaraDialog2: removeEdgeBlackMatte(elaraDialog2),
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
        titleVoiceSrc: 'assets/audio/voice/title-intro-cornelius.mp3',
        gameMusicSrc: 'assets/audio/music/driftmere-battle-loop.mp3',
        titleMusicSrc: 'assets/audio/music/View_from_the_World_Map.mp3',
        textSoundSrc: 'assets/audio/voice/text-sound.mp3',
        deathSoundSrc: 'assets/audio/music/Death screen sound.mp3',
        desertMusicSrc: 'assets/audio/music/Desert sound track.mp3',
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
