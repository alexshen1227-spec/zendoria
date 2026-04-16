import { NATIVE_WIDTH, NATIVE_HEIGHT, SCALE } from './constants.js?v=20260414-no-bridge-pass2';
import { Input } from './input.js?v=20260414-no-bridge-pass2';
import { Player } from './player.js?v=20260415-skilltree-ui';
import { Camera } from './camera.js?v=20260414-no-bridge-pass2';
import { World } from './world.js?v=20260416-realm-split';
import { createEnemy, normalizeEnemyKind } from './enemy.js?v=20260414-desert-enemies';
import { Elara } from './npc.js?v=20260414-no-bridge-pass2';
import { Tombstone } from './tombstone.js?v=20260414-tombstone-anim';
import { Portal } from './portal.js?v=20260414-desert-enemies';
import { TreasureChest } from './treasureChest.js?v=20260415-level-up-chest';
import {
    MAX_PLAYER_LEVEL,
    SKILLS,
    SKILL_BY_ID,
    SKILL_COLUMNS,
    xpToNextLevel,
} from './player.js?v=20260415-skilltree-ui';

const DIALOG_SOUND_DURATION = 1.8; // seconds of text sound per line
const CHECKPOINTS_KEY = 'zendoria-checkpoints-v1';
const MAX_CHECKPOINTS = 6;
const DEATH_FADE_DURATION = 2.4; // seconds of slow fade in to "YOU DIED"
const DEATH_OUTFADE_DURATION = 0.8;
const DEATH_OPTIONS = ['quit', 'reload'];

const TITLE_MENU_STATE_SOURCES = {
    'new-game': 'assets/ui/menu_states/title-menu-new-game.png',
    load: 'assets/ui/menu_states/title-menu-load.png',
    options: 'assets/ui/menu_states/title-menu-options.png',
    exit: 'assets/ui/menu_states/title-menu-exit.png',
};

const TITLE_OPTION_KEYS = ['sound', 'hints'];
const PAUSE_MENU_KEYS = ['resume', 'sound', 'hints', 'controls', 'return-title'];

function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

export class Game {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assets = assets;

        canvas.width = NATIVE_WIDTH;
        canvas.height = NATIVE_HEIGHT;
        canvas.style.width = `${NATIVE_WIDTH * SCALE}px`;
        canvas.style.height = `${NATIVE_HEIGHT * SCALE}px`;

        this.ctx.imageSmoothingEnabled = false;

        this.input = new Input();
        this.camera = new Camera();

        this.saveKey = 'zendoria-save-v1';
        this.settingsKey = 'zendoria-settings-v1';
        this.settings = this._loadSettings();
        this._resetRunUnlocks();

        this.overlay = document.getElementById('game-overlay');
        this.titleHelp = document.querySelector('[data-loading-label]');
        this.titleModal = document.querySelector('[data-title-modal]');
        this.titleModalBanner = document.querySelector('[data-title-modal-banner]');
        this.titleModalTitle = document.querySelector('[data-title-modal-title]');
        this.titleModalBody = document.querySelector('[data-title-modal-body]');
        this.titleModalFoot = document.querySelector('[data-title-modal-foot]');
        this.titleSettingsPanel = document.querySelector('[data-title-settings]');

        this.titleMenuItems = [
            { action: 'new-game', key: 'new-game', help: 'NEW GAME: START A FRESH RUN ON DRIFTMERE ISLE.' },
            { action: 'load', key: 'load', help: 'LOAD GAME: RESTORE THE LATEST AUTOSAVE.' },
            { action: 'options', key: 'options', help: 'OPTIONS: TOGGLE SOUND AND OPENING HINTS.' },
            { action: 'exit', key: 'exit', help: 'EXIT: OPEN THE BROWSER-SAFE EXIT PANEL.' },
        ];

        this.titleMenuImage = document.querySelector('[data-title-menu-image]');
        this.titlePointerRows = {};
        for (const item of this.titleMenuItems) {
            this.titlePointerRows[item.key] = document.querySelector(`[data-title-row="${item.key}"]`);
        }

        this.titleOptionRows = {};
        this.titleOptionValues = {};

        for (const key of TITLE_OPTION_KEYS) {
            this.titleOptionRows[key] = document.querySelector(`[data-title-setting-row="${key}"]`);
            this.titleOptionValues[key] = document.querySelector(`[data-title-setting-value="${key}"]`);
        }

        this.deathOverlay = document.getElementById('death-overlay');
        this.deathImageQuit = document.querySelector('[data-death-image-quit]');
        this.deathImageReload = document.querySelector('[data-death-image-reload]');
        this.deathCheckpointsPanel = document.querySelector('[data-death-checkpoints]');
        this.deathCheckpointsList = document.querySelector('[data-death-checkpoints-list]');

        this.pauseOverlay = document.getElementById('pause-overlay');
        this.dialogOverlay = document.getElementById('dialog-overlay');
        this.dialogCanvas = document.querySelector('[data-dialog-canvas]');
        this.dialogContinue = document.querySelector('[data-dialog-continue]');
        this.dialogCanvasCtx = this.dialogCanvas ? this.dialogCanvas.getContext('2d') : null;
        this.dialogCanvasImage = null;

        if (this.dialogCanvasCtx) {
            this.dialogCanvasCtx.imageSmoothingEnabled = false;
        }

        this.pauseRows = {};
        this.pauseValues = {};
        this.pauseHelp = document.querySelector('[data-pause-help]');
        this.controlsPanel = document.querySelector('[data-controls-panel]');
        this.pauseSettingsPanel = document.querySelector('[data-pause-settings]');
        this.controlsOpen = false;

        for (const key of PAUSE_MENU_KEYS) {
            this.pauseRows[key] = document.querySelector(`[data-pause-row="${key}"]`);
            this.pauseValues[key] = document.querySelector(`[data-pause-value="${key}"]`);
        }

        this.audioCtx = null;
        this.audioFadeHandles = {
            titleVoice: 0,
            gameMusic: 0,
            titleMusic: 0,
            desertMusic: 0,
            deathSound: 0,
        };

        this.titleVoice = this._createAudio(this.assets.titleVoiceSrc, false);
        this.gameMusic = this._createAudio(this.assets.gameMusicSrc, true);
        this.titleMusic = this._createAudio(this.assets.titleMusicSrc, true);
        this.textSound = this._createAudio(this.assets.textSoundSrc, true);
        this.desertMusic = this._createAudio(this.assets.desertMusicSrc, true);
        this.deathSound = this._createAudio(this.assets.deathSoundSrc, false);
        if (this.deathSound) this.deathSound.volume = 1;
        if (this.textSound) this.textSound.volume = 0.35;
        this.swordSlashSound = this._createAudio(this.assets.swordSlashSoundSrc, false);
        if (this.swordSlashSound) this.swordSlashSound.volume = 0.75;
        this.titleMusicStarted = false;
        this.titleMusicFullVolume = 0.38;
        this.titleMusicDuckedVolume = 0.1;

        this.titleVoiceAttemptedAutoplay = false;
        this.titleVoiceNeedsGesture = false;
        this.titleVoiceGestureRetried = false;
        this.titleVoicePlayedThisPage = false;
        this.titleVoiceCanAttempt = this.settings.soundEnabled;
        this.titleVoiceStarted = false;

        if (this.titleVoice) {
            this.titleVoice.addEventListener('ended', () => {
                this.titleVoiceStarted = false;
                this.titleVoiceCanAttempt = false;
                this._unduckTitleMusic();
            });
            this.titleVoice.addEventListener('error', () => {
                console.warn('Zendoria title voice failed to load.');
                this.titleVoiceStarted = false;
                this.titleVoiceNeedsGesture = false;
                this.titleVoiceCanAttempt = false;
                this._unduckTitleMusic();
            });
        }

        if (this.gameMusic) {
            this.gameMusic.addEventListener('error', () => {
                console.warn('Zendoria game music failed to load.');
            });
        }

        if (this.titleMusic) {
            this.titleMusic.addEventListener('error', () => {
                console.warn('Zendoria title music failed to load.');
            });
        }

        if (this.desertMusic) {
            this.desertMusic.addEventListener('error', () => {
                console.warn('Zendoria desert music failed to load.');
            });
        }

        if (this.deathSound) {
            this.deathSound.addEventListener('error', () => {
                console.warn('Zendoria death sound failed to load.');
            });
        }

        if (this.swordSlashSound) {
            this.swordSlashSound.addEventListener('error', () => {
                console.warn('Zendoria sword slash sound failed to load.');
            });
        }

        this.titleMenuIndex = 0;
        this.titleDialog = null;
        this.titleOptionIndex = 0;
        this.pauseMenuIndex = 0;

        this.started = false;
        this.paused = false;
        this.lastTime = 0;
        this.saveTimer = 0;

        this._resetSession();
        this._syncTitleMenu();
        this._syncPauseMenu();
        this._setupGestureUnlock();
    }

    run() {
        this.lastTime = performance.now();
        this._attemptTitleVoiceAutoplay();
        requestAnimationFrame((time) => this._loop(time));
    }

    _setupGestureUnlock() {
        const unlock = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            if (!this.started && this.settings.soundEnabled) {
                this._startTitleMusic();
            }
            if (
                !this.started &&
                !this.titleVoicePlayedThisPage &&
                this.titleVoiceCanAttempt &&
                this.settings.soundEnabled
            ) {
                this._startTitleVoice(true);
            }
        };
        window.addEventListener('keydown', unlock);
        window.addEventListener('pointerdown', unlock);

        this.titleDebug = document.querySelector('[data-title-debug]');
        window.addEventListener('keydown', (event) => {
            if (this.titleDebug) {
                this.titleDebug.textContent = `v6 key=${event.code}`;
            }
            if (this.started || this.titleDialog) return;

            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    event.preventDefault();
                    this._moveTitleSelection(-1);
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    event.preventDefault();
                    this._moveTitleSelection(1);
                    break;
                case 'Enter':
                case 'Space':
                    event.preventDefault();
                    this._activateTitleSelection();
                    break;
                default:
                    break;
            }
        });
    }

    _loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        if (!this.started) {
            this._updateTitleInput();
            this.input.endFrame();
            this._render();
            requestAnimationFrame((time) => this._loop(time));
            return;
        }

        if (this.deathState) {
            this._updateDeathState(dt);
            this.input.endFrame();
            this._render();
            requestAnimationFrame((time) => this._loop(time));
            return;
        }

        if (!this.paused && this.input.wasPressed('Escape')) {
            this._openPauseMenu();
            this.input.endFrame();
            this._render();
            requestAnimationFrame((time) => this._loop(time));
            return;
        }

        if (this.paused) {
            this._updatePauseInput();
            this.input.endFrame();
            this._render();
            requestAnimationFrame((time) => this._loop(time));
            return;
        }

        if (this.worldMapOpen) {
            this._updateWorldMap();
            this.input.endFrame();
            this._render();
            requestAnimationFrame((time) => this._loop(time));
            return;
        }

        if (this.skillTreeOpen) {
            this.gameTime += dt;
            this._updateSkillTree(dt);
            this.input.endFrame();
            this._render();
            requestAnimationFrame((time) => this._loop(time));
            return;
        }

        this.gameTime += dt;
        this._update(dt);
        this._render();

        this.input.endFrame();
        requestAnimationFrame((time) => this._loop(time));
    }

    _resetSession() {
        this.currentRealmId = 'driftmere';
        this.realmStates = {};
        this.world = null;
        this.player = null;
        this.portals = [];
        this.enemies = [];
        this.enemySpawnNodes = [];
        this.elara = null;
        this.tombstone = null;
        this.treasureChest = null;
        this.gameTime = 0;
        this.screenShake = 0;
        this.objectiveTimer = 8;
        this.toast = '';
        this.toastTimer = 0;
        this.hasReachedCanyons = false;
        this.hasReachedSaltFlats = false;
        this.hasReachedTropics = false;
        this.saveTimer = 0;

        this.hasMap = false;
        this.hasTalkedToElara = false;
        this.dialog = null;
        this.rewardPopup = null;

        this.worldMapCache = null;
        this.worldMapOpen = false;
        this.deathState = null;

        this.xpPopups = [];
        this.particles = [];
        this.hitStopTimer = 0;
        this.levelUpAnim = null;
        this.levelUpFlash = 0;
        this.expBarPulse = 0;
        this.skillTreeOpen = false;
        this.skillTreeSelection = { column: 1, row: 0 };
        this.skillSpendFlash = 0;
        this.skillUpgradeShines = {};
        this.skillTreeIntro = 0;
        this.skillHintPulse = 0;
        this.firstPointNotified = false;

        this._syncAbilityLockedRows();
        this._loadRealm('driftmere', 'start', { createPlayer: true, forceFresh: true });
    }

    _syncAbilityLockedRows() {
        const row = document.querySelector('[data-controls-row="ability-skilltree"]');
        if (row) row.classList.toggle('ability-locked', !this.hasLevelUpAbility);
    }

    _refreshEntityColliders() {
        const colliders = [];
        if (this.elara) colliders.push(this.elara.getCollider());
        if (this.tombstone) colliders.push(this.tombstone.getCollider());
        if (this.treasureChest) colliders.push(this.treasureChest.getCollider());
        if (this.portals) {
            for (const portal of this.portals) {
                if (portal.getCollider) colliders.push(portal.getCollider());
            }
        }
        this.world.setEntityColliders(colliders);
    }

    _createEnemies(savedEnemies = null) {
        if (!savedEnemies) {
            return this.world.fixedEnemySpawns.map((spawn) => this._spawnEnemy(spawn));
        }

        return savedEnemies
            .filter((enemy) => enemy && enemy.alive && enemy.health > 0)
            .map((enemy) => {
                const instance = createEnemy(
                    normalizeEnemyKind(enemy.kind),
                    enemy.x,
                    enemy.y,
                    this.assets.enemySheets,
                );
                instance.health = Math.max(1, Math.min(instance.maxHealth, enemy.health));
                instance.facingLeft = !!enemy.facingLeft;
                return instance;
            });
    }

    _createSpawnNodesState() {
        return this.world.enemySpawnNodes.map((node, index) => ({
            ...node,
            timer: 7 + index * 3,
        }));
    }

    _spawnEnemy(spawnDef) {
        const enemy = createEnemy(
            normalizeEnemyKind(spawnDef?.kind),
            spawnDef?.x ?? 0,
            spawnDef?.y ?? 0,
            this.assets.enemySheets,
        );
        const hitbox = enemy.config.hitbox;
        const search = enemy.config.spawnSearch;
        const resolved = this.world.findOpenEntityPosition(
            enemy.x,
            enemy.y,
            hitbox.x,
            hitbox.y,
            hitbox.w,
            hitbox.h,
            search.maxRadius,
            search.step,
        );
        enemy.x = resolved.x;
        enemy.y = resolved.y;
        enemy.homeX = resolved.x;
        enemy.homeY = resolved.y;
        return enemy;
    }

    _serializeEnemies(enemies = this.enemies) {
        return enemies.map((enemy) => ({
            kind: enemy.kind,
            alive: enemy.isAlive(),
            x: enemy.x,
            y: enemy.y,
            health: enemy.health,
            facingLeft: enemy.facingLeft,
        }));
    }

    _serializeSpawnNodes() {
        return this.enemySpawnNodes.map((node) => ({ ...node }));
    }

    _storeCurrentRealmState() {
        if (!this.currentRealmId) return;

        this.realmStates[this.currentRealmId] = {
            enemies: this._serializeEnemies(),
            enemySpawnNodes: this._serializeSpawnNodes(),
        };
    }

    _loadRealm(realmId, arrivalKey = 'start', options = {}) {
        const {
            createPlayer = false,
            forceFresh = false,
            playerOverride = null,
            skipStoreCurrent = false,
        } = options;

        if (!skipStoreCurrent && !forceFresh && this.world && this.currentRealmId) {
            this._storeCurrentRealmState();
        }

        this.world = new World(this.assets, realmId);
        this.currentRealmId = this.world.realmId;
        this.worldMapCache = null;

        const arrival = playerOverride || this.world.getArrivalPoint(arrivalKey);
        if (!this.player || createPlayer) {
            this.player = new Player(arrival.x, arrival.y, this.assets);
        } else {
            this.player.x = arrival.x;
            this.player.y = arrival.y;
        }

        this.portals = this.world.portalDefs.map((definition) => new Portal(definition, this.assets.portalImage));
        this.elara = this.world.elaraSpawn
            ? new Elara(this.world.elaraSpawn.x, this.world.elaraSpawn.y, this.assets)
            : null;
        this.tombstone = this.world.tombstoneSpawn
            ? new Tombstone(this.world.tombstoneSpawn.x, this.world.tombstoneSpawn.y, this.assets.tombstoneSheet)
            : null;
        this.treasureChest = this.world.treasureChestSpawn
            ? new TreasureChest(
                this.world.treasureChestSpawn,
                {
                    closed: this.assets.treasureChestClosedImage,
                    open: this.assets.treasureChestOpenImage,
                },
                this.hasLevelUpAbility,
            )
            : null;

        const savedRealmState = forceFresh ? null : this.realmStates[this.currentRealmId];
        const savedEnemies = savedRealmState?.enemies;
        const savedSpawnNodes = savedRealmState?.enemySpawnNodes;

        this.enemies = this._createEnemies(savedEnemies ?? null);
        if (Array.isArray(savedSpawnNodes) && savedSpawnNodes.length === this.world.enemySpawnNodes.length) {
            this.enemySpawnNodes = savedSpawnNodes.map((node) => ({ ...node }));
        } else {
            this.enemySpawnNodes = this._createSpawnNodesState();
        }

        this._refreshEntityColliders();
        this.camera.follow(this.player, this.world.pixelW, this.world.pixelH);
    }

    _switchRealm(targetRealmId, arrivalKey) {
        this._loadRealm(targetRealmId, arrivalKey);
        this.toast = `${this.world.realmLabel} REACHED`;
        this.toastTimer = 1.8;
        this.objectiveTimer = 5;
        this._playBeep(720, 0.12, 'triangle', 0.16);
        this._startRealmMusic();
        this._saveGame();
    }

    _updateTitleInput() {
        if (this.titleDialog) {
            this._updateTitleDialogInput();
            return;
        }
        // Title menu nav runs off a direct keydown listener in _setupGestureUnlock
        // so visual response is instant and cannot be swallowed by a stuck game loop.
    }

    _updateTitleDialogInput() {
        if (this.titleDialog === 'options') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.titleOptionIndex = (this.titleOptionIndex + TITLE_OPTION_KEYS.length - 1) % TITLE_OPTION_KEYS.length;
                this._playBeep(620, 0.05, 'square', 0.08);
                this._syncTitleOptionRows();
            }

            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.titleOptionIndex = (this.titleOptionIndex + 1) % TITLE_OPTION_KEYS.length;
                this._playBeep(520, 0.05, 'square', 0.08);
                this._syncTitleOptionRows();
            }

            if (
                this.input.wasPressed('ArrowLeft') ||
                this.input.wasPressed('ArrowRight') ||
                this.input.wasPressed('KeyA') ||
                this.input.wasPressed('KeyD') ||
                this.input.wasPressed('Enter') ||
                this.input.wasPressed('Space')
            ) {
                this._toggleTitleOptionValue();
            }

            if (this.input.wasPressed('Escape') || this.input.wasPressed('Backspace')) {
                this._closeTitleDialog();
            }

            return;
        }

        if (
            this.input.wasPressed('Enter') ||
            this.input.wasPressed('Space') ||
            this.input.wasPressed('Escape') ||
            this.input.wasPressed('Backspace')
        ) {
            this._closeTitleDialog();
        }
    }

    _moveTitleSelection(delta) {
        const count = this.titleMenuItems.length;
        const previous = this.titleMenuIndex;
        this.titleMenuIndex = (this.titleMenuIndex + delta + count) % count;

        if (this.titleMenuIndex !== previous) {
            this._playBeep(delta > 0 ? 520 : 680, 0.05, 'square', 0.12);
            if (this.titleVoiceNeedsGesture && !this.titleVoiceGestureRetried) {
                this.titleVoiceGestureRetried = true;
                this._startTitleVoice(true);
            }
        }

        this._syncTitleMenu();
    }

    _activateTitleSelection() {
        const selected = this.titleMenuItems[this.titleMenuIndex];
        if (!selected) return;

        this._playBeep(880, 0.09, 'triangle', 0.14);

        if (selected.action !== 'exit') {
            this.titleVoiceCanAttempt = false;
            this.titleVoiceNeedsGesture = false;
            this._fadeOutTitleVoice();
        }

        switch (selected.action) {
            case 'new-game':
                this._startNewGame();
                break;
            case 'load':
                this._loadFromMenu();
                break;
            case 'options':
                this._openTitleDialog('options');
                break;
            case 'exit':
                this._openTitleDialog('exit');
                break;
            default:
                break;
        }
    }

    _syncTitleMenu() {
        const selected = this.titleMenuItems[this.titleMenuIndex];
        if (!selected) return;

        if (this.titleMenuImage) {
            const nextSrc = TITLE_MENU_STATE_SOURCES[selected.key];
            if (nextSrc && !this.titleMenuImage.src.endsWith(nextSrc)) {
                this.titleMenuImage.src = nextSrc;
            }
        }

        for (const item of this.titleMenuItems) {
            const row = this.titlePointerRows[item.key];
            if (row) row.classList.toggle('is-selected', item.key === selected.key);
        }

        if (!this.titleDialog) {
            this._setTitleHelp(this._titleHelpText(selected));
        }
    }

    _titleHelpText(selected) {
        const saveExists = !!this._readSaveData();
        if (selected.action === 'load' && !saveExists) {
            return 'W/S OR ARROWS MOVE. SPACE SELECTS. NO SAVE EXISTS YET.';
        }

        return `W/S OR ARROWS MOVE. SPACE SELECTS. ${selected.help}`;
    }

    _openTitleDialog(kind) {
        this.titleDialog = kind;
        if (kind === 'options') {
            this.titleOptionIndex = 0;
        }
        // Clear any still-pressed keys so the Enter/Space that opened the dialog
        // doesn't immediately get consumed by the dialog's first-frame handler.
        this.input.pressed = {};
        this._renderTitleDialog();
    }

    _renderTitleDialog() {
        if (!this.titleModal || !this.titleModalTitle || !this.titleModalBody || !this.titleModalFoot) return;

        let title = '';
        let body = '';
        let foot = 'PRESS SPACE, ENTER, OR ESC TO RETURN.';
        const showOptions = this.titleDialog === 'options';

        if (showOptions) {
            title = 'TITLE SETTINGS';
            body = 'TOGGLE SOUND AND OPENING HINTS FOR THIS BUILD.';
            foot = 'UP OR DOWN CHOOSES. LEFT, RIGHT, ENTER, OR SPACE TOGGLES. ESC RETURNS.';
        } else if (this.titleDialog === 'exit') {
            title = 'EXIT';
            body = 'THIS BROWSER BUILD CANNOT SAFELY CLOSE ITS OWN WINDOW. CLOSE THE TAB OR APP SHELL WHEN YOU ARE READY.';
        } else if (this.titleDialog === 'load-empty') {
            title = 'LOAD GAME';
            body = 'NO SAVED JOURNEY EXISTS YET. START A NEW GAME ONCE AND THE PROTOTYPE WILL CREATE AN AUTOSAVE.';
        } else if (this.titleDialog === 'load-error') {
            title = 'LOAD GAME';
            body = 'THE SAVE DATA COULD NOT BE READ CLEANLY. START A NEW GAME TO REBUILD THE SAVE STATE.';
        }

        this.titleModalTitle.textContent = title;
        this.titleModalBody.textContent = body;
        this.titleModalFoot.textContent = foot;
        this.titleModal.classList.remove('hidden');

        if (this.titleModalBanner) {
            this.titleModalBanner.classList.toggle('hidden', !showOptions);
        }

        if (this.titleSettingsPanel) {
            this.titleSettingsPanel.classList.toggle('hidden', !showOptions);
        }

        if (showOptions) {
            this._syncTitleOptionRows();
        }

        this._setTitleHelp(title || 'OPTIONS');
    }

    _syncTitleOptionRows() {
        for (const key of TITLE_OPTION_KEYS) {
            const row = this.titleOptionRows[key];
            const value = this.titleOptionValues[key];
            if (row) row.classList.toggle('is-selected', TITLE_OPTION_KEYS[this.titleOptionIndex] === key);
            if (value) value.textContent = this._settingTextValue(key);
        }
    }

    _toggleTitleOptionValue() {
        const key = TITLE_OPTION_KEYS[this.titleOptionIndex];
        if (key === 'sound') {
            this._setSoundEnabled(!this.settings.soundEnabled);
        } else if (key === 'hints') {
            this.settings.showHints = !this.settings.showHints;
            this._saveSettings();
        }

        this._playBeep(740, 0.06, 'triangle', 0.1);
        this._syncTitleOptionRows();
    }

    _closeTitleDialog() {
        this.titleDialog = null;
        if (this.titleModal) this.titleModal.classList.add('hidden');
        this._syncTitleMenu();
    }

    _setTitleHelp(text) {
        if (this.titleHelp) this.titleHelp.textContent = text;
    }

    _resetRunUnlocks() {
        this.hasLevelUpAbility = false;
    }

    _startNewGame() {
        this._resetRunUnlocks();
        this._resetSession();
        this._enterGameplay();
        this._saveGame();
    }

    _loadFromMenu() {
        const save = this._readSaveData();
        if (!save) {
            this._openTitleDialog('load-empty');
            return;
        }

        try {
            this._resetSession();
            this._applySaveData(save);
            this._enterGameplay();
            this._saveGame();
        } catch (error) {
            console.error('Zendoria load failed:', error);
            this._openTitleDialog('load-error');
        }
    }

    _enterGameplay() {
        this.started = true;
        this.paused = false;
        if (this.overlay) this.overlay.classList.add('hidden');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        this._stopTitleVoice();
        this._stopTitleMusic();
        this._startRealmMusic();
    }

    _stopTitleVoice() {
        const audio = this.titleVoice;
        this.titleVoiceStarted = false;
        this._cancelAudioFade('titleVoice');
        if (!audio) return;
        try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
        } catch (_) {
            // ignore
        }
    }

    _stopTitleMusic() {
        const audio = this.titleMusic;
        this.titleMusicStarted = false;
        this._cancelAudioFade('titleMusic');
        if (!audio) return;
        try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0;
        } catch (_) {
            // ignore
        }
    }

    _openPauseMenu() {
        if (!this.started) return;
        this.paused = true;
        this.pauseMenuIndex = 0;
        if (this.pauseOverlay) this.pauseOverlay.classList.remove('hidden');
        this._syncPauseMenu();
    }

    _closePauseMenu() {
        this.paused = false;
        this.controlsOpen = false;
        if (this.controlsPanel) this.controlsPanel.classList.add('hidden');
        if (this.pauseSettingsPanel) this.pauseSettingsPanel.classList.remove('hidden');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        this._syncPauseMenu();
    }

    _updatePauseInput() {
        if (this.controlsOpen) {
            if (
                this.input.wasPressed('Escape') ||
                this.input.wasPressed('Enter') ||
                this.input.wasPressed('Space') ||
                this.input.wasPressed('Backspace')
            ) {
                this._closeControlsPanel();
            }
            return;
        }

        if (this.input.wasPressed('Escape')) {
            this._closePauseMenu();
            return;
        }

        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            this.pauseMenuIndex = (this.pauseMenuIndex + PAUSE_MENU_KEYS.length - 1) % PAUSE_MENU_KEYS.length;
            this._playBeep(680, 0.05, 'square', 0.1);
            this._syncPauseMenu();
        }

        if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            this.pauseMenuIndex = (this.pauseMenuIndex + 1) % PAUSE_MENU_KEYS.length;
            this._playBeep(520, 0.05, 'square', 0.1);
            this._syncPauseMenu();
        }

        const selected = PAUSE_MENU_KEYS[this.pauseMenuIndex];

        if (selected === 'sound' || selected === 'hints') {
            if (
                this.input.wasPressed('ArrowLeft') ||
                this.input.wasPressed('ArrowRight') ||
                this.input.wasPressed('KeyA') ||
                this.input.wasPressed('KeyD') ||
                this.input.wasPressed('Enter') ||
                this.input.wasPressed('Space')
            ) {
                this._togglePauseSetting(selected);
            }
            return;
        }

        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
            if (selected === 'resume') {
                this._closePauseMenu();
            } else if (selected === 'controls') {
                this._openControlsPanel();
            } else if (selected === 'return-title') {
                this._closePauseMenu();
                this._returnToTitle();
            }
        }
    }

    _openControlsPanel() {
        this.controlsOpen = true;
        if (this.controlsPanel) this.controlsPanel.classList.remove('hidden');
        if (this.pauseSettingsPanel) this.pauseSettingsPanel.classList.add('hidden');
        if (this.pauseHelp) this.pauseHelp.textContent = 'ESC, ENTER, OR SPACE RETURNS.';
        this._playBeep(820, 0.07, 'triangle', 0.12);
    }

    _closeControlsPanel() {
        this.controlsOpen = false;
        if (this.controlsPanel) this.controlsPanel.classList.add('hidden');
        if (this.pauseSettingsPanel) this.pauseSettingsPanel.classList.remove('hidden');
        this._playBeep(480, 0.05, 'square', 0.1);
        this._syncPauseMenu();
    }

    _togglePauseSetting(key) {
        if (key === 'sound') {
            this._setSoundEnabled(!this.settings.soundEnabled);
        } else if (key === 'hints') {
            this.settings.showHints = !this.settings.showHints;
            this._saveSettings();
        }

        this._playBeep(740, 0.06, 'triangle', 0.1);
        this._syncPauseMenu();
    }

    _syncPauseMenu() {
        for (const key of PAUSE_MENU_KEYS) {
            const row = this.pauseRows[key];
            const value = this.pauseValues[key];
            if (row) row.classList.toggle('is-selected', PAUSE_MENU_KEYS[this.pauseMenuIndex] === key);
            if (value) value.textContent = this._pauseValueText(key);
        }

        if (this.pauseHelp) {
            const selected = PAUSE_MENU_KEYS[this.pauseMenuIndex];
            if (selected === 'sound' || selected === 'hints') {
                this.pauseHelp.textContent = 'LEFT OR RIGHT TO TOGGLE. ENTER ALSO TOGGLES. ESC RESUMES.';
            } else if (selected === 'controls') {
                this.pauseHelp.textContent = 'ENTER OR SPACE OPENS THE CONTROLS LIST.';
            } else if (selected === 'return-title') {
                this.pauseHelp.textContent = 'ENTER RETURNS TO THE TITLE SCREEN. ESC RESUMES PLAY.';
            } else {
                this.pauseHelp.textContent = 'ESC RESUMES. ENTER OR SPACE ACTIVATES THE SELECTED ROW.';
            }
        }
    }

    _pauseValueText(key) {
        switch (key) {
            case 'sound':
                return this._settingTextValue('sound');
            case 'hints':
                return this._settingTextValue('hints');
            case 'resume':
                return 'GO';
            case 'controls':
                return 'VIEW';
            case 'return-title':
                return 'LEAVE';
            default:
                return '';
        }
    }

    _settingTextValue(key) {
        if (key === 'sound') return this.settings.soundEnabled ? 'ON' : 'OFF';
        if (key === 'hints') return this.settings.showHints ? 'ON' : 'OFF';
        return '';
    }

    _returnToTitle() {
        this._saveGame();
        this._resetRunUnlocks();
        this.started = false;
        this.paused = false;
        this.titleDialog = null;
        this.titleMenuIndex = 0;
        this.rewardPopup = null;
        if (this.titleModal) this.titleModal.classList.add('hidden');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        if (this.overlay) this.overlay.classList.remove('hidden');
        this._fadeOutGameMusic();
        this._fadeOutDesertMusic();
        if (this.settings.soundEnabled) this._startTitleMusic();
        this._syncTitleMenu();
    }

    _applySaveData(save) {
        if (save.settings) {
            if (typeof save.settings.showHints === 'boolean') {
                this.settings.showHints = save.settings.showHints;
            }
            if (typeof save.settings.soundEnabled === 'boolean') {
                this.settings.soundEnabled = save.settings.soundEnabled;
            }
            this._saveSettings();
        }

        this.gameTime = Math.max(0, save.gameTime ?? 0);
        this.currentRealmId = save.currentRealmId === 'frontier' || (
            !save.currentRealmId &&
            (!!save.hasReachedCanyons || !!save.hasReachedSaltFlats || !!save.hasReachedTropics || !!save.hasLevelUpAbility)
        ) ? 'frontier' : 'driftmere';
        const legacyScoutProgress = !!save.hasReachedEastIsle || !!save.encounterCleared;
        const legacyDesertProgress = !!save.hasEnteredIndex || legacyScoutProgress;
        this.hasReachedCanyons = !!save.hasReachedCanyons || legacyDesertProgress || !!save.hasLevelUpAbility;
        this.hasReachedSaltFlats = !!save.hasReachedSaltFlats || legacyScoutProgress || !!save.hasLevelUpAbility;
        this.hasReachedTropics = !!save.hasReachedTropics || !!save.hasLevelUpAbility;
        this.hasTalkedToElara = !!save.hasTalkedToElara;
        this.hasMap = !!save.hasMap;
        this.hasLevelUpAbility = !!save.hasLevelUpAbility;
        this.realmStates = {};
        if (save.realmStates && typeof save.realmStates === 'object') {
            const driftmereState = save.realmStates.driftmere;
            const frontierState = save.realmStates.frontier || save.realmStates.index;
            if (driftmereState) {
                this.realmStates.driftmere = {
                    enemies: Array.isArray(driftmereState.enemies) ? driftmereState.enemies : [],
                    enemySpawnNodes: Array.isArray(driftmereState.enemySpawnNodes) ? driftmereState.enemySpawnNodes : [],
                };
            }
            if (frontierState) {
                this.realmStates.frontier = {
                    enemies: Array.isArray(frontierState.enemies) ? frontierState.enemies : [],
                    enemySpawnNodes: Array.isArray(frontierState.enemySpawnNodes) ? frontierState.enemySpawnNodes : [],
                };
            }
        }
        if (!this.realmStates[this.currentRealmId] && Array.isArray(save.enemies)) {
            this.realmStates[this.currentRealmId] = {
                enemies: save.enemies,
                enemySpawnNodes: [],
            };
        }

        const playerState = save.player || {};
        const playerOverride = (
            typeof playerState.x === 'number' &&
            typeof playerState.y === 'number'
        ) ? {
            x: playerState.x,
            y: playerState.y,
        } : null;
        this._loadRealm(this.currentRealmId, 'start', {
            playerOverride,
            skipStoreCurrent: true,
        });
        if (typeof playerState.level === 'number') this.player.level = Math.max(1, Math.min(MAX_PLAYER_LEVEL, playerState.level));
        if (typeof playerState.xp === 'number') this.player.xp = Math.max(0, playerState.xp);
        this.player.xpToNext = this.player.level >= MAX_PLAYER_LEVEL ? 1 : xpToNextLevel(this.player.level);

        // Skills have to be restored before stats, because applySkillEffects derives
        // max health / damage / speed from them.
        if (playerState.skills && typeof playerState.skills === 'object') {
            this.player.skills = {};
            for (const skill of SKILLS) {
                const rank = playerState.skills[skill.id];
                if (typeof rank === 'number' && rank > 0) {
                    this.player.skills[skill.id] = Math.min(skill.maxRank, Math.max(0, Math.floor(rank)));
                }
            }
        }
        if (typeof playerState.skillPoints === 'number') {
            this.player.skillPoints = Math.max(0, Math.floor(playerState.skillPoints));
        }
        this.player.applySkillEffects();

        if (typeof playerState.maxHealth === 'number') {
            this.player.maxHealth = Math.max(this.player.maxHealth, playerState.maxHealth);
        }
        if (typeof playerState.attackDamage === 'number') {
            this.player.attackDamage = Math.max(this.player.attackDamage, playerState.attackDamage);
        }
        this.player.health = Math.max(1, Math.min(this.player.maxHealth, playerState.health ?? this.player.maxHealth));
        if (typeof playerState.direction === 'number') this.player.direction = playerState.direction;
        this.player.facingLeft = !!playerState.facingLeft;

        this._syncAbilityLockedRows();

        this.toast = this.hasLevelUpAbility ? `${this.world.realmLabel} RESTORED` : '';
        this.toastTimer = 0;
        this.objectiveTimer = 0;

        this.camera.follow(this.player, this.world.pixelW, this.world.pixelH);
    }

    _update(dt) {
        if (this.elara) this.elara.update(dt);
        for (const portal of this.portals) portal.update(dt);
        if (this.treasureChest) this.treasureChest.update(dt);

        // Dialog / reward popup freezes the world
        if (this.rewardPopup) {
            this._updateRewardPopup(dt);
            return;
        }

        if (this.dialog) {
            this._updateDialog(dt);
            return;
        }

        // Brief hit-stop: freeze entity simulation for a few frames after a solid hit
        // so each strike lands with weight. Particles still update so sparks feel alive.
        if (this.hitStopTimer > 0) {
            this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
            this._updateParticles(dt);
            this.toastTimer = Math.max(0, this.toastTimer - dt);
            return;
        }

        this.player.update(dt, this.input, this.world);
        if (this.tombstone) this.tombstone.update(dt);

        // Play the sword slash SFX the moment the player starts a swing.
        if (this.player._attackJustStarted) {
            this.player._attackJustStarted = false;
            this._playSwordSlash();
        }

        // Emit dash particles right after a dash starts (player sets _dashJustStarted).
        if (this.player._dashJustStarted) {
            this.player._dashJustStarted = false;
            const px = this.player.cx;
            const py = this.player.cy + 8;
            const ang = this._directionToAngle(this.player.direction) + Math.PI; // back-spray
            this._spawnParticles(px, py, {
                count: 14,
                angle: ang,
                spread: Math.PI * 0.5,
                minSpeed: 40,
                maxSpeed: 120,
                friction: 0.82,
                gravity: 40,
                life: 0.42,
                colors: ['#bde4ff', '#8fffe1', '#ffffff', '#6fc3ff'],
                size: 2,
            });
            this.screenShake = Math.max(this.screenShake, 0.45);
            this._playBeep(620, 0.07, 'sawtooth', 0.1);
            this._playBeep(960, 0.06, 'triangle', 0.08);
        }

        // Ambient dust when moving (adds life to motion).
        if (this.player.moving && Math.random() < dt * 6) {
            this._spawnParticles(
                this.player.cx + (Math.random() - 0.5) * 6,
                this.player.y + this.player.h - 4,
                {
                    count: 1,
                    angle: -Math.PI / 2,
                    spread: Math.PI * 0.35,
                    minSpeed: 4,
                    maxSpeed: 14,
                    friction: 0.92,
                    gravity: -8,
                    life: 0.45,
                    colors: ['rgba(200, 220, 230, 0.55)', 'rgba(160, 200, 220, 0.4)'],
                    size: 1,
                    shrink: true,
                },
            );
        }

        for (const enemy of this.enemies) {
            enemy.update(dt, this.player, this.world);
        }

        this.enemies = this.enemies.filter((enemy) => enemy.state !== 'dead');
        this._updateEnemySpawners(dt);
        this._resolveCombat();
        this._updateObjectiveState(dt);
        this._updateNpcInteraction();
        this._updateHudInput();
        this._updateParticles(dt);
        this.camera.follow(this.player, this.world.pixelW, this.world.pixelH);

        if (this.player.health <= 0 && !this.deathState) {
            this._triggerDeath();
            return;
        }

        this.screenShake = Math.max(0, this.screenShake - dt * 8);
        this.toastTimer = Math.max(0, this.toastTimer - dt);
        this._updateLevelProgressFx(dt);

        this.saveTimer += dt;
        if (this.saveTimer >= 1.0) {
            this.saveTimer = 0;
            this._saveGame();
        }
    }

    _playerNearElara() {
        if (!this.elara) return false;
        const r = this.elara.getInteractRect();
        const pr = this.player.getHitbox();
        return rectsOverlap(pr, r);
    }

    _playerNearTombstone() {
        if (!this.tombstone) return false;
        return rectsOverlap(this.player.getHitbox(), this.tombstone.getInteractRect());
    }

    _playerNearTreasureChest() {
        if (!this.treasureChest) return false;
        return rectsOverlap(this.player.getHitbox(), this.treasureChest.getInteractRect());
    }

    _getNearbyPortal() {
        const hitbox = this.player.getHitbox();
        return this.portals.find((portal) => rectsOverlap(hitbox, portal.getInteractRect())) || null;
    }

    _updateNpcInteraction() {
        if (this._playerNearElara() && this.input.wasPressed('KeyE')) {
            this._openElaraDialog();
            return;
        }
        if (this._playerNearTombstone() && this.input.wasPressed('KeyE')) {
            this._activateTombstoneSave();
            return;
        }
        if (this._playerNearTreasureChest() && this.input.wasPressed('KeyE')) {
            this._activateTreasureChest();
            return;
        }

        const portal = this._getNearbyPortal();
        if (portal && this.input.wasPressed('KeyE')) {
            this._activatePortal(portal);
        }
    }

    _updateHudInput() {
        if (this.input.wasPressed('KeyM')) {
            if (this.hasMap) {
                this._openWorldMap();
            } else {
                this.toast = 'FIND ELARA TO EARN THE MAP';
                this.toastTimer = 1.8;
                this._playBeep(300, 0.08, 'square', 0.08);
            }
        }

        if (this.input.wasPressed('KeyK')) {
            if (this.hasLevelUpAbility) {
                this._openSkillTree();
            } else {
                this.toast = 'CLAIM THE SUNKEN RELIC TO UNLOCK SKILLS';
                this.toastTimer = 2.0;
                this._playBeep(300, 0.08, 'square', 0.08);
            }
        }
    }

    _activateTombstoneSave() {
        // AAA-style checkpoint: named save plus full HP restore.
        this.player.health = this.player.maxHealth;
        if (this.tombstone) this.tombstone.activate();
        const checkpoint = this._createCheckpoint(this.world?.getLandmark('camp')?.label || 'Camp');
        this._saveGame();
        this._playBeep(960, 0.14, 'triangle', 0.18);
        this._playBeep(1280, 0.2, 'sine', 0.12);
        this.toast = `CHECKPOINT SAVED · ${checkpoint.label.toUpperCase()}`;
        this.toastTimer = 2.8;
    }

    _activateTreasureChest() {
        if (!this.treasureChest || this.hasLevelUpAbility) return;

        this.hasLevelUpAbility = true;
        this.treasureChest.setOpened(true);
        this._syncAbilityLockedRows();
        this.toast = 'SUNKEN RELIC CLAIMED';
        this.toastTimer = 2.8;
        this._playBeep(900, 0.12, 'triangle', 0.16);
        this._playBeep(1280, 0.2, 'sine', 0.12);
        this._openRewardPopup(
            'THE SUNKEN RELIC',
            this.assets.levelUpAbilityImage,
            [
                'ANCIENT RUNES ANSWER YOUR CALL.',
                'SLAY FOES TO GAIN XP.',
                'LEVELS GIVE SKILL POINTS.',
                'PRESS K FOR THE SKILL TREE.',
            ],
        );
    }

    _activatePortal(portal) {
        if (!portal) return;
        this._switchRealm(portal.targetRealmId, portal.arrivalKey);
    }

    _openWorldMap() {
        this.worldMapOpen = true;
        this._playBeep(720, 0.08, 'triangle', 0.12);
    }

    _closeWorldMap() {
        this.worldMapOpen = false;
        this._playBeep(520, 0.05, 'square', 0.1);
    }

    _updateWorldMap() {
        if (
            this.input.wasPressed('KeyM') ||
            this.input.wasPressed('Escape') ||
            this.input.wasPressed('Space') ||
            this.input.wasPressed('Enter') ||
            this.input.wasPressed('Backspace')
        ) {
            this._closeWorldMap();
        }
    }

    _openElaraDialog() {
        // First talk: show dialog 1, grant map, show dialog 2. Later: show only dialog 2.
        const images = this.hasTalkedToElara
            ? [this.assets.elaraDialog2]
            : [this.assets.elaraDialog1, this.assets.elaraDialog2];
        this.dialog = {
            images,
            index: 0,
            soundTimer: DIALOG_SOUND_DURATION,
            grantMapAfter: this.hasTalkedToElara ? -1 : 0,
        };
        this._playBeep(620, 0.08, 'triangle', 0.12);
        this._startTextSound();
    }

    _updateDialog(dt) {
        const d = this.dialog;
        if (!d) return;

        if (d.soundTimer > 0) {
            d.soundTimer -= dt;
            if (d.soundTimer <= 0) {
                this._stopTextSound();
            }
        }

        if (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
            this._stopTextSound();

            if (d.index === d.grantMapAfter) {
                this.hasMap = true;
                this._openRewardPopup('YOU GOT THE MAP!', this.assets.mapScrollImage);
                // advance index so next click after popup shows dialog 2
                d.index += 1;
                d.soundTimer = DIALOG_SOUND_DURATION;
                return;
            }

            if (d.index + 1 < d.images.length) {
                d.index += 1;
                d.soundTimer = DIALOG_SOUND_DURATION;
                this._startTextSound();
            } else {
                this.hasTalkedToElara = true;
                this.dialog = null;
                this._saveGame();
            }
        }
    }

    _openRewardPopup(title, image, body = []) {
        this.rewardPopup = {
            title,
            image,
            body,
        };
        this._playBeep(880, 0.14, 'triangle', 0.16);
    }

    _updateRewardPopup() {
        if (
            this.input.wasPressed('Space') ||
            this.input.wasPressed('Enter') ||
            this.input.wasPressed('KeyE') ||
            this.input.wasPressed('Escape')
        ) {
            this.rewardPopup = null;
            this._playBeep(740, 0.06, 'triangle', 0.1);
            // Resume dialog text sound if we're about to show the next line
            if (this.dialog && this.dialog.soundTimer > 0) {
                this._startTextSound();
            }
        }
    }

    _wrapPixelText(text, maxWidth, scale = 1) {
        const font = this.assets?.pixelFont;
        const normalized = String(text || '').trim().replace(/\s+/g, ' ').toUpperCase();
        if (!font || !normalized) return [];

        const pushClampedWord = (word, lines) => {
            let remaining = word;
            while (remaining && font.measure(remaining, scale) > maxWidth) {
                let slice = remaining.length - 1;
                while (slice > 1 && font.measure(remaining.slice(0, slice), scale) > maxWidth) {
                    slice -= 1;
                }
                lines.push(remaining.slice(0, slice));
                remaining = remaining.slice(slice);
            }
            if (remaining) lines.push(remaining);
        };

        const words = normalized.split(' ');
        const lines = [];
        let current = '';

        for (const word of words) {
            if (!word) continue;
            if (!current) {
                if (font.measure(word, scale) <= maxWidth) {
                    current = word;
                } else {
                    pushClampedWord(word, lines);
                }
                continue;
            }

            const candidate = `${current} ${word}`;
            if (font.measure(candidate, scale) <= maxWidth) {
                current = candidate;
            } else {
                lines.push(current);
                if (font.measure(word, scale) <= maxWidth) {
                    current = word;
                } else {
                    pushClampedWord(word, lines);
                    current = '';
                }
            }
        }

        if (current) lines.push(current);
        return lines;
    }

    _startTextSound() {
        if (!this.textSound || !this.settings.soundEnabled) return;
        try {
            this.textSound.currentTime = 0;
            const p = this.textSound.play();
            if (p && p.catch) p.catch(() => {});
        } catch (_) { /* ignore */ }
    }

    _stopTextSound() {
        if (!this.textSound) return;
        try {
            this.textSound.pause();
            this.textSound.currentTime = 0;
        } catch (_) { /* ignore */ }
    }

    _playSwordSlash() {
        if (!this.swordSlashSound || !this.settings.soundEnabled) return;
        try {
            // Clone so rapid swings overlap instead of stomping each other.
            const clip = this.swordSlashSound.cloneNode(true);
            clip.volume = this.swordSlashSound.volume;
            const p = clip.play();
            if (p && p.catch) p.catch(() => {});
        } catch (_) { /* ignore */ }
    }

    _resolveCombat() {
        const attackRect = this.player.getAttackRect();
        if (!attackRect) return;

        for (const enemy of this.enemies) {
            if (!enemy.isTargetable() || !this.player.canHitEnemy(enemy.id)) continue;
            if (!rectsOverlap(attackRect, enemy.getHitbox())) continue;

            if (enemy.takeHit(this.player.attackDirection, this.player.attackDamage)) {
                this.player.registerAttackHit(enemy.id);
                this.screenShake = Math.max(this.screenShake, 0.55);
                const slain = enemy.health <= 0;
                this.toast = slain
                    ? `${enemy.toastLabel} PURGED`
                    : `${enemy.toastLabel} STAGGERED`;
                this.toastTimer = 1.2;

                // Juicy hit feedback: spark particles on hit, bigger burst on kill,
                // plus a brief hit-stop to make each strike feel weighty.
                const hb = enemy.getHitbox();
                const hitX = hb.x + hb.w / 2;
                const hitY = hb.y + hb.h / 2;
                const hitAngle = this._directionToAngle(this.player.attackDirection);
                this._spawnParticles(hitX, hitY, {
                    count: 8,
                    angle: hitAngle,
                    spread: Math.PI * 0.55,
                    minSpeed: 50,
                    maxSpeed: 130,
                    friction: 0.86,
                    gravity: 60,
                    life: 0.32,
                    colors: ['#ffffff', '#ffe78a', '#a6ffcb'],
                    size: 2,
                });
                this.hitStopTimer = Math.max(this.hitStopTimer, 0.035);

                if (slain) {
                    this._spawnParticles(hitX, hitY, {
                        count: 18,
                        spread: Math.PI * 2,
                        minSpeed: 30,
                        maxSpeed: 140,
                        friction: 0.9,
                        gravity: 80,
                        life: 0.65,
                        colors: ['#8f52e0', '#ff6ec7', '#ffe78a', '#ffffff'],
                        size: 2,
                    });
                    this._spawnParticles(hitX, hitY + 6, {
                        count: 6,
                        angle: -Math.PI / 2,
                        spread: Math.PI * 0.4,
                        minSpeed: 10,
                        maxSpeed: 30,
                        friction: 0.9,
                        gravity: -20,
                        life: 0.9,
                        colors: ['rgba(180, 110, 210, 0.65)', 'rgba(140, 80, 180, 0.55)'],
                        size: 3,
                    });
                    this.screenShake = Math.max(this.screenShake, 0.95);
                    this.hitStopTimer = Math.max(this.hitStopTimer, 0.06);
                }

                if (slain && this.hasLevelUpAbility) {
                    this._awardXp(enemy.xpReward || 1, enemy.cx, enemy.y + 4);
                }
            }
        }
    }

    _directionToAngle(direction) {
        // 0 = RIGHT, 1 = LEFT, 2 = RIGHT, 3 = UP per constants.js DIR enum
        // DIR.DOWN=0, LEFT=1, RIGHT=2, UP=3
        switch (direction) {
            case 1: return Math.PI;          // LEFT
            case 2: return 0;                // RIGHT
            case 3: return -Math.PI / 2;     // UP
            default: return Math.PI / 2;     // DOWN
        }
    }

    _spawnParticles(x, y, opts = {}) {
        const count = opts.count || 6;
        const baseAngle = opts.angle;
        const spread = opts.spread != null ? opts.spread : Math.PI * 2;
        const minSpeed = opts.minSpeed != null ? opts.minSpeed : 20;
        const maxSpeed = opts.maxSpeed != null ? opts.maxSpeed : 80;
        const life = opts.life != null ? opts.life : 0.5;
        const gravity = opts.gravity != null ? opts.gravity : 0;
        const friction = opts.friction != null ? opts.friction : 0.88;
        const colors = opts.colors || [opts.color || '#ffe78a'];
        const size = opts.size != null ? opts.size : 2;
        const shrink = opts.shrink !== false;

        for (let i = 0; i < count; i++) {
            const angle = baseAngle != null
                ? baseAngle + (Math.random() - 0.5) * spread
                : Math.random() * Math.PI * 2;
            const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            const jitter = life * (0.7 + Math.random() * 0.55);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity,
                friction,
                life: jitter,
                maxLife: jitter,
                color: colors[(Math.random() * colors.length) | 0],
                size: size + (Math.random() < 0.25 ? 1 : 0),
                shrink,
            });
        }
    }

    _updateParticles(dt) {
        if (!this.particles || this.particles.length === 0) return;
        const decay = Math.pow(0.95, dt * 60);
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const f = Math.pow(p.friction, dt * 60);
            p.vx *= f;
            p.vy *= f;
            p.vy += p.gravity * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        void decay;
    }

    _drawParticles(ctx) {
        if (!this.particles || this.particles.length === 0) return;
        for (const p of this.particles) {
            const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
            const size = p.shrink ? Math.max(1, Math.ceil(p.size * alpha)) : p.size;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(
                Math.round(p.x - size / 2),
                Math.round(p.y - size / 2),
                size,
                size,
            );
        }
        ctx.globalAlpha = 1;
    }

    _awardXp(amount, worldX, worldY) {
        if (!amount) return;
        const boosted = Math.max(1, Math.round(amount * (this.player.xpMultiplier || 1)));
        this.xpPopups.push({
            x: worldX,
            y: worldY,
            vy: -22,
            text: `${boosted} XP`,
            timer: 0.9,
            maxTimer: 0.9,
        });
        this.expBarPulse = 1;
        this._playBeep(780, 0.05, 'triangle', 0.08);

        const { levelsGained } = this.player.gainXp(boosted);
        if (levelsGained > 0) {
            this._triggerLevelUp(this.player.level, levelsGained);
        }
        if (this.player.skillPoints > 0) {
            this.skillHintPulse = 1;
            if (!this.firstPointNotified) {
                this.firstPointNotified = true;
            }
        }
    }

    _triggerLevelUp(newLevel, chainCount) {
        const bonus = chainCount > 1
            ? `/${chainCount} SKILL POINTS  /  FULL HEAL`
            : 'NEW SKILL POINT  /  FULL HEAL';

        this.levelUpAnim = {
            timer: 2.2,
            maxTimer: 2.2,
            level: newLevel,
            bonusText: bonus,
            chainCount,
            hint: 'PRESS K TO SPEND',
        };
        this.levelUpFlash = 1;
        this.screenShake = Math.max(this.screenShake, 1.1);
        this.toast = `LEVEL ${newLevel}!`;
        this.toastTimer = 2.4;

        // Triumphant chord.
        this._playBeep(523, 0.18, 'triangle', 0.18);
        this._playBeep(659, 0.22, 'triangle', 0.16);
        this._playBeep(784, 0.28, 'sine', 0.18);
        this._playBeep(1047, 0.36, 'sine', 0.14);
    }

    _updateLevelProgressFx(dt) {
        if (this.xpPopups && this.xpPopups.length) {
            for (let i = this.xpPopups.length - 1; i >= 0; i--) {
                const p = this.xpPopups[i];
                p.timer -= dt;
                p.y += p.vy * dt;
                p.vy += 14 * dt;
                if (p.timer <= 0) this.xpPopups.splice(i, 1);
            }
        }

        if (this.levelUpAnim) {
            this.levelUpAnim.timer -= dt;
            if (this.levelUpAnim.timer <= 0) this.levelUpAnim = null;
        }

        this.levelUpFlash = Math.max(0, this.levelUpFlash - dt * 2.8);
        this.expBarPulse = Math.max(0, this.expBarPulse - dt * 2.2);
        this.skillHintPulse = Math.max(0, this.skillHintPulse - dt * 1.2);
        this.skillSpendFlash = Math.max(0, this.skillSpendFlash - dt * 2.8);
        for (const skillId of Object.keys(this.skillUpgradeShines)) {
            const next = Math.max(0, this.skillUpgradeShines[skillId] - dt * 2.8);
            if (next > 0) {
                this.skillUpgradeShines[skillId] = next;
            } else {
                delete this.skillUpgradeShines[skillId];
            }
        }
    }

    _updateObjectiveState(dt) {
        this.objectiveTimer = Math.max(0, this.objectiveTimer - dt);

        if (this.currentRealmId !== 'frontier') return;

        if (this.hasTalkedToElara && !this.hasReachedCanyons && this._isNearLandmark('canyons', 72)) {
            this.hasReachedCanyons = true;
            this.toast = 'RUST-ROCK CANYONS REACHED';
            this.toastTimer = 2.4;
            this.objectiveTimer = 5;
            this._saveGame();
        }

        if (this.hasTalkedToElara && !this.hasReachedSaltFlats && this._isNearLandmark('salt', 72)) {
            this.hasReachedSaltFlats = true;
            this.toast = 'SHIMMERING SALT FLATS REACHED';
            this.toastTimer = 2.4;
            this.objectiveTimer = 5;
            this._saveGame();
        }

        if (this.hasTalkedToElara && !this.hasReachedTropics && this._isNearLandmark('tropics', 76)) {
            this.hasReachedTropics = true;
            this.toast = 'SUNKEN TROPICS REACHED';
            this.toastTimer = 2.4;
            this.objectiveTimer = 5;
            this._saveGame();
        }
    }

    _isNearLandmark(id, radius = 64) {
        const landmark = this.world?.getLandmark(id);
        if (!landmark || !this.player) return false;
        const dx = this.player.cx - landmark.x;
        const dy = this.player.cy - landmark.y;
        return dx * dx + dy * dy <= radius * radius;
    }

    _currentQuestFocus() {
        if (!this.hasTalkedToElara && this.elara) {
            return { x: this.elara.cx, y: this.elara.y - 6 };
        }
        if (!this.hasTalkedToElara) {
            return this.world?.getLandmark('portal') || null;
        }
        if (this.currentRealmId !== 'frontier') {
            if (!this.hasReachedCanyons || !this.hasReachedSaltFlats || !this.hasReachedTropics || !this.hasLevelUpAbility) {
                return this.world?.getLandmark('portal') || null;
            }
            return null;
        }
        if (!this.hasReachedCanyons) return this.world?.getLandmark('canyons') || null;
        if (!this.hasReachedSaltFlats) return this.world?.getLandmark('salt') || null;
        if (!this.hasReachedTropics) return this.world?.getLandmark('tropics') || null;
        if (!this.hasLevelUpAbility) return this.world?.getLandmark('relic') || null;
        return null;
    }

    _currentObjectiveText() {
        if (!this.hasTalkedToElara) {
            return this.currentRealmId === 'driftmere'
                ? 'TALK TO ELARA'
                : 'RETURN TO DRIFTMERE AND FIND ELARA';
        }
        if (this.currentRealmId !== 'frontier' && (!this.hasReachedCanyons || !this.hasReachedSaltFlats || !this.hasReachedTropics || !this.hasLevelUpAbility)) {
            return 'ENTER THE AMBERWAKE GATE';
        }
        if (!this.hasReachedCanyons) return 'SCOUT THE RUST-ROCK CANYONS';
        if (!this.hasReachedSaltFlats) return 'CROSS THE SHIMMERING SALT FLATS';
        if (!this.hasReachedTropics) return 'DESCEND INTO THE SUNKEN TROPICS';
        if (!this.hasLevelUpAbility) return 'CLAIM THE SUNKEN RELIC';
        return 'EXPLORE THE SUNCLEFT FRONTIER';
    }

    _render() {
        const ctx = this.ctx;

        ctx.fillStyle = '#050814';
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

        const shakeX = this.screenShake > 0 ? Math.round((Math.random() * 2 - 1) * this.screenShake * 2) : 0;
        const shakeY = this.screenShake > 0 ? Math.round((Math.random() * 2 - 1) * this.screenShake * 2) : 0;

        this.camera.begin(ctx, shakeX, shakeY);
        this.world.drawGround(ctx, this.camera.x, this.camera.y, NATIVE_WIDTH, NATIVE_HEIGHT, this.gameTime);
        this.world.drawLandmarks(ctx, this.gameTime);

        const questFocus = this._currentQuestFocus();
        if (questFocus) {
            this._drawQuestBeacon(ctx, questFocus.x, questFocus.y);
        }

        this._drawEntitiesSorted(ctx);

        if (this.elara && !this.hasTalkedToElara) this._drawElaraMarker(ctx);
        this._drawParticles(ctx);
        this._drawXpPopups(ctx);
        this.camera.end(ctx);

        if (this.started) this._drawHUD(ctx);
        if (this.started && this.levelUpFlash > 0) {
            ctx.fillStyle = `rgba(255, 244, 184, ${this.levelUpFlash * 0.55})`;
            ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
        }
        if (this.started && this.levelUpAnim) this._drawLevelUpBanner(ctx);
        if (this.started && !this.dialog && !this.rewardPopup && !this.worldMapOpen && !this.deathState) {
            if (this._playerNearElara()) {
                this._drawInteractPrompt(ctx, 'E: TALK TO ELARA');
            } else if (this._playerNearTombstone()) {
                this._drawInteractPrompt(ctx, 'E: SAVE · RESTORE HP');
            }
        }
        if (
            this.started &&
            !this.dialog &&
            !this.rewardPopup &&
            !this.worldMapOpen &&
            !this.deathState &&
            !this._playerNearElara() &&
            !this._playerNearTombstone() &&
            this._playerNearTreasureChest() &&
            !this.hasLevelUpAbility
        ) {
            this._drawInteractPrompt(ctx, this.treasureChest?.prompt || 'E: OPEN TREASURE');
        }
        if (
            this.started &&
            !this.dialog &&
            !this.rewardPopup &&
            !this.worldMapOpen &&
            !this.deathState &&
            !this._playerNearElara() &&
            !this._playerNearTombstone() &&
            !this._playerNearTreasureChest()
        ) {
            const portal = this._getNearbyPortal();
            if (portal) this._drawInteractPrompt(ctx, portal.prompt);
        }
        if (this.dialog && !this.rewardPopup) {
            this._drawDialog(ctx);
        } else {
            this._hideDialogOverlay();
        }
        if (this.rewardPopup) this._drawRewardPopup(ctx);
        if (this.worldMapOpen) this._drawWorldMap(ctx);
        if (this.skillTreeOpen) this._drawSkillTree(ctx);
        if (this.deathState) this._drawDeathScreen(ctx);
        this._drawFrame(ctx);
    }

    _drawEntitiesSorted(ctx) {
        const camX = this.camera.x;
        const camY = this.camera.y;
        const viewW = NATIVE_WIDTH;
        const viewH = NATIVE_HEIGHT;

        const drawables = [];

        for (const prop of this.world.getVisibleProps(camX, camY, viewW, viewH)) {
            drawables.push({
                sortY: prop.sortY,
                draw: () => this.world.drawProp(ctx, prop),
            });
        }

        for (const structure of this.world.getVisibleStructures(camX, camY, viewW, viewH)) {
            drawables.push({
                sortY: structure.sortY,
                draw: () => this.world.drawStructure(ctx, structure, this.gameTime),
            });
        }

        for (const enemy of this.enemies) {
            if (enemy.state === 'dead') continue;
            drawables.push({
                sortY: enemy.y + enemy.h,
                draw: () => enemy.draw(ctx),
            });
        }

        if (this.elara) {
            drawables.push({
                sortY: this.elara.y + this.elara.h,
                draw: () => this.elara.draw(ctx, this.gameTime),
            });
        }

        if (this.tombstone) {
            drawables.push({
                sortY: this.tombstone.sortY,
                draw: () => this.tombstone.draw(ctx),
            });
        }

        if (this.treasureChest) {
            drawables.push({
                sortY: this.treasureChest.sortY,
                draw: () => this.treasureChest.draw(ctx),
            });
        }

        for (const portal of this.portals) {
            drawables.push({
                sortY: portal.sortY,
                draw: () => portal.draw(ctx),
            });
        }

        drawables.push({
            sortY: this.player.y + this.player.h,
            draw: () => this.player.draw(ctx),
        });

        drawables.sort((a, b) => a.sortY - b.sortY);
        for (const entry of drawables) entry.draw();
    }

    _drawInteractPrompt(ctx, label = 'E: INTERACT') {
        const font = this.assets.pixelFont;
        const w = font.measure(label, 1) + 10;
        const x = Math.round((NATIVE_WIDTH - w) / 2);
        const y = NATIVE_HEIGHT - 40;
        const pulse = Math.sin(this.gameTime * 6) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(7, 11, 19, ${0.78 + pulse * 0.1})`;
        ctx.fillRect(x, y, w, 12);
        ctx.strokeStyle = `rgba(142, 255, 236, ${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 11);
        font.draw(ctx, label, x + 5, y + 3, { color: '#8effec' });
    }

    _drawDialog(ctx) {
        const d = this.dialog;
        if (!d) return;
        const img = d.images[d.index];
        if (!img) return;

        // dim backdrop
        ctx.fillStyle = 'rgba(4, 6, 14, 0.55)';
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

        this._syncDialogOverlay(img);
    }

    _syncDialogOverlay(img) {
        if (!this.dialogOverlay || !this.dialogCanvas || !this.dialogCanvasCtx || !img) return;

        this.dialogOverlay.classList.remove('hidden');

        if (this.dialogCanvas.width !== img.width || this.dialogCanvas.height !== img.height) {
            this.dialogCanvas.width = img.width;
            this.dialogCanvas.height = img.height;
            this.dialogCanvasCtx.imageSmoothingEnabled = false;
            this.dialogCanvasImage = null;
        }

        if (this.dialogCanvasImage !== img) {
            this.dialogCanvasCtx.clearRect(0, 0, this.dialogCanvas.width, this.dialogCanvas.height);
            this.dialogCanvasCtx.drawImage(img, 0, 0);
            this.dialogCanvasImage = img;
        }

        if (this.dialogContinue) {
            this.dialogContinue.classList.toggle('hidden', Math.floor(this.gameTime * 3) % 2 === 0);
        }
    }

    _hideDialogOverlay() {
        if (this.dialogOverlay) this.dialogOverlay.classList.add('hidden');
        if (this.dialogContinue) this.dialogContinue.classList.add('hidden');
        this.dialogCanvasImage = null;
    }

    _drawRewardPopup(ctx) {
        const reward = this.rewardPopup;
        if (!reward) return;

        const font = this.assets.pixelFont;
        const panelX = 16;
        const panelY = 14;
        const panelW = NATIVE_WIDTH - 32;
        const panelH = NATIVE_HEIGHT - 28;

        // dim background
        ctx.fillStyle = 'rgba(4, 6, 14, 0.78)';
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

        const foot = 'PRESS SPACE TO CLOSE';
        const titleLines = this._wrapPixelText(reward.title || 'NEW ITEM', panelW - 18);
        const bodyLines = (reward.body || [])
            .flatMap((line) => this._wrapPixelText(line, panelW - 24));
        const titleBlockH = titleLines.length * 10;
        const footerY = panelY + panelH - 14;
        const bodyLineH = 9;
        const bodyBlockH = bodyLines.length > 0 ? (bodyLines.length * bodyLineH + 8) : 0;
        const bodyBoxY = bodyLines.length > 0 ? footerY - bodyBlockH - 6 : 0;
        const imageTop = panelY + 10 + titleBlockH + 4;
        const imageBottom = bodyLines.length > 0 ? bodyBoxY - 6 : footerY - 6;

        ctx.fillStyle = 'rgba(9, 10, 19, 0.9)';
        ctx.fillRect(panelX - 3, panelY - 3, panelW + 6, panelH + 6);
        ctx.fillStyle = '#3b2d20';
        ctx.fillRect(panelX - 2, panelY - 2, panelW + 4, panelH + 4);
        ctx.fillStyle = '#8a6a44';
        ctx.fillRect(panelX - 1, panelY - 1, panelW + 2, panelH + 2);
        ctx.fillStyle = 'rgba(7, 11, 19, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        for (let i = 0; i < titleLines.length; i++) {
            font.draw(ctx, titleLines[i], panelX + Math.round(panelW / 2), panelY + 8 + i * 10, {
                color: '#ffe78a',
                align: 'center',
            });
        }

        const img = reward.image;
        if (img) {
            const maxW = panelW - 28;
            const maxH = Math.max(44, imageBottom - imageTop);
            const ratio = Math.min(maxW / img.width, maxH / img.height);
            const drawW = Math.max(1, Math.round(img.width * ratio));
            const drawH = Math.max(1, Math.round(img.height * ratio));
            const drawX = panelX + Math.round((panelW - drawW) / 2);
            const drawY = imageTop + Math.max(0, Math.round((maxH - drawH) / 2));
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }

        if (bodyLines.length > 0) {
            ctx.fillStyle = 'rgba(11, 18, 29, 0.82)';
            ctx.fillRect(panelX + 10, bodyBoxY, panelW - 20, bodyBlockH);
            ctx.strokeStyle = 'rgba(255, 231, 138, 0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(panelX + 10.5, bodyBoxY + 0.5, panelW - 21, bodyBlockH - 1);
            for (let i = 0; i < bodyLines.length; i++) {
                font.draw(ctx, bodyLines[i], panelX + Math.round(panelW / 2), bodyBoxY + 4 + i * bodyLineH, {
                    color: i === bodyLines.length - 1 ? '#a6ffcb' : '#eef6ff',
                    align: 'center',
                });
            }
        }

        if (Math.floor(this.gameTime * 3) % 2) {
            const fw = font.measure(foot, 1);
            font.draw(ctx, foot, panelX + Math.round((panelW - fw) / 2), footerY, { color: '#ffe78a' });
        }
    }

    _skillsByColumn(columnKey) {
        return SKILLS
            .filter((s) => s.column === columnKey)
            .sort((a, b) => a.row - b.row);
    }

    _clampSkillSelection() {
        const col = Math.max(0, Math.min(SKILL_COLUMNS.length - 1, this.skillTreeSelection.column));
        const colSkills = this._skillsByColumn(SKILL_COLUMNS[col]);
        const rows = Math.max(1, colSkills.length);
        const row = Math.max(0, Math.min(rows - 1, this.skillTreeSelection.row));
        this.skillTreeSelection = { column: col, row };
    }

    _currentSkillDef() {
        this._clampSkillSelection();
        const col = SKILL_COLUMNS[this.skillTreeSelection.column];
        const colSkills = this._skillsByColumn(col);
        return colSkills[this.skillTreeSelection.row] || null;
    }

    _openSkillTree() {
        if (this.skillTreeOpen) return;
        this.skillTreeOpen = true;
        this.skillTreeIntro = 0;
        this._clampSkillSelection();
        this._playBeep(720, 0.08, 'triangle', 0.14);
        this._playBeep(940, 0.12, 'sine', 0.1);
    }

    _closeSkillTree() {
        if (!this.skillTreeOpen) return;
        this.skillTreeOpen = false;
        this._playBeep(520, 0.06, 'square', 0.1);
        this._saveGame();
    }

    _updateSkillTree(dt) {
        this.skillTreeIntro = Math.min(1, this.skillTreeIntro + dt * 4.8);

        if (
            this.input.wasPressed('KeyK') ||
            this.input.wasPressed('Escape') ||
            this.input.wasPressed('Backspace')
        ) {
            this._closeSkillTree();
            return;
        }

        let moved = false;
        if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
            this.skillTreeSelection.column =
                (this.skillTreeSelection.column + SKILL_COLUMNS.length - 1) % SKILL_COLUMNS.length;
            moved = true;
        } else if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
            this.skillTreeSelection.column =
                (this.skillTreeSelection.column + 1) % SKILL_COLUMNS.length;
            moved = true;
        }

        const colSkills = this._skillsByColumn(SKILL_COLUMNS[this.skillTreeSelection.column]);
        const rowCount = Math.max(1, colSkills.length);

        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            this.skillTreeSelection.row = (this.skillTreeSelection.row + rowCount - 1) % rowCount;
            moved = true;
        } else if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            this.skillTreeSelection.row = (this.skillTreeSelection.row + 1) % rowCount;
            moved = true;
        }

        this._clampSkillSelection();

        if (moved) this._playBeep(640, 0.04, 'square', 0.09);

        if (this.input.wasPressed('Space') || this.input.wasPressed('Enter')) {
            const def = this._currentSkillDef();
            if (def && this.player.canSpend(def.id)) {
                if (this.player.spendSkillPoint(def.id)) {
                    this.skillSpendFlash = 1;
                    this.skillUpgradeShines[def.id] = 1;
                    this.skillHintPulse = 0;
                    this._playBeep(880, 0.09, 'triangle', 0.16);
                    this._playBeep(1320, 0.14, 'sine', 0.1);
                }
            } else {
                this._playBeep(220, 0.08, 'square', 0.08);
            }
        }
    }

    _drawSkillTree(ctx) {
        const font = this.assets.pixelFont;
        const intro = this.skillTreeIntro;
        const ease = 1 - (1 - intro) * (1 - intro);

        ctx.fillStyle = 'rgba(2, 4, 10, 0.92)';
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

        // starfield backdrop
        const t = this.gameTime;
        for (let i = 0; i < 40; i++) {
            const sx = ((i * 53) % NATIVE_WIDTH);
            const sy = ((i * 37 + Math.floor(t * 4)) % NATIVE_HEIGHT);
            const twinkle = (Math.sin(t * 2 + i) + 1) / 2;
            ctx.fillStyle = `rgba(180, 220, 255, ${0.08 + twinkle * 0.12})`;
            ctx.fillRect(sx, sy, 1, 1);
        }

        // outer frame
        const frameX = 6;
        const frameY = 6;
        const frameW = NATIVE_WIDTH - 12;
        const frameH = NATIVE_HEIGHT - 12;
        ctx.fillStyle = 'rgba(12, 18, 32, 0.92)';
        ctx.fillRect(frameX, frameY, frameW, frameH);
        ctx.strokeStyle = `rgba(168, 227, 255, ${0.35 + ease * 0.35})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(frameX + 0.5, frameY + 0.5, frameW - 1, frameH - 1);

        // corner gilding
        ctx.fillStyle = '#a8e3ff';
        for (const [cx, cy] of [
            [frameX, frameY],
            [frameX + frameW - 3, frameY],
            [frameX, frameY + frameH - 3],
            [frameX + frameW - 3, frameY + frameH - 3],
        ]) {
            ctx.fillRect(cx, cy, 3, 3);
        }

        // title
        const title = 'SKILL TREE';
        const titleW = font.measure(title, 2);
        const pulse = Math.sin(this.gameTime * 3.4) * 0.5 + 0.5;
        const introY = Math.round((1 - ease) * -8);
        font.draw(ctx, title, Math.round((NATIVE_WIDTH - titleW) / 2), 12 + introY, {
            color: '#ffe78a',
            scale: 2,
        });

        // subtitle: level / points
        const atCap = this.player.level >= MAX_PLAYER_LEVEL;
        const lvText = atCap
            ? 'MAX LEVEL'
            : `LEVEL ${this.player.level}  /  ${this.player.xp}/${this.player.xpToNext} XP`;
        const ptsText = `POINTS ${this.player.skillPoints}`;
        const subW = font.measure(lvText, 1) + 10 + font.measure(ptsText, 1);
        const subStartX = Math.round((NATIVE_WIDTH - subW) / 2);
        font.draw(ctx, lvText, subStartX, 30, { color: '#d6e9ff' });
        const pointsColor = this.player.skillPoints > 0
            ? (Math.floor(this.gameTime * 4) % 2 ? '#fff1b5' : '#ffd27b')
            : '#6a7a94';
        font.draw(ctx, ptsText, subStartX + font.measure(lvText, 1) + 10, 30, { color: pointsColor });

        // columns
        const columnWidth = 76;
        const columnGap = 4;
        const totalColsW = columnWidth * SKILL_COLUMNS.length + columnGap * (SKILL_COLUMNS.length - 1);
        const colsStartX = Math.round((NATIVE_WIDTH - totalColsW) / 2);
        const colsY = 44;
        const colsH = 116;

        for (let c = 0; c < SKILL_COLUMNS.length; c++) {
            const columnKey = SKILL_COLUMNS[c];
            const x = colsStartX + c * (columnWidth + columnGap);
            this._drawSkillColumn(ctx, columnKey, x, colsY, columnWidth, colsH);
        }

        // description panel
        const def = this._currentSkillDef();
        const panelX = frameX + 4;
        const panelY = colsY + colsH + 6;
        const panelW = frameW - 8;
        const panelH = 32;
        ctx.fillStyle = 'rgba(6, 10, 20, 0.88)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = `rgba(168, 227, 255, ${0.4 + pulse * 0.25})`;
        ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

        if (def) {
            const rank = this.player.getSkillRank(def.id);
            const atMax = rank >= def.maxRank;
            const headline = atMax
                ? `${def.name}  -  MAX`
                : `${def.name}  -  RANK ${rank}/${def.maxRank}`;
            font.draw(ctx, headline, panelX + 6, panelY + 4, {
                color: atMax ? '#ffe78a' : '#a6ffcb',
            });
            font.draw(ctx, def.desc, panelX + 6, panelY + 14, { color: '#d6e9ff' });
            const nextText = atMax
                ? 'NO MORE RANKS - SKILL MASTERED'
                : `NEXT: ${def.effectText(rank + 1)}`;
            font.draw(ctx, nextText, panelX + 6, panelY + 22, {
                color: atMax ? '#a8e3ff' : '#ffd27b',
            });
        }

        // footer hints
        const footY = NATIVE_HEIGHT - 14;
        const hintLeft = 'ARROWS MOVE';
        const hintMid = this.player.skillPoints > 0 ? 'SPACE SPENDS' : 'NO POINTS YET';
        const hintRight = 'K CLOSES';
        font.draw(ctx, hintLeft, frameX + 6, footY, { color: '#8fffe1' });
        const midW = font.measure(hintMid, 1);
        font.draw(ctx, hintMid, Math.round((NATIVE_WIDTH - midW) / 2), footY, {
            color: this.player.skillPoints > 0 ? '#ffe78a' : '#6a7a94',
        });
        const rightW = font.measure(hintRight, 1);
        font.draw(ctx, hintRight, NATIVE_WIDTH - frameX - 6 - rightW, footY, { color: '#8fffe1' });

        // spend flash
        const spendFlashVisible =
            this.skillSpendFlash > 0 && Math.floor((1 - this.skillSpendFlash) * 6) % 2 === 0;
        if (spendFlashVisible) {
            ctx.fillStyle = 'rgba(255, 244, 184, 0.24)';
            ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
        }
    }

    _skillColumnTheme(columnKey) {
        switch (columnKey) {
            case 'body':
                return { label: 'BODY', accent: '#ff9e9e', glow: 'rgba(255, 110, 110, 0.28)' };
            case 'blade':
                return { label: 'BLADE', accent: '#ffd27b', glow: 'rgba(255, 188, 90, 0.28)' };
            case 'spirit':
                return { label: 'SPIRIT', accent: '#a8e3ff', glow: 'rgba(120, 200, 255, 0.28)' };
            default:
                return { label: columnKey.toUpperCase(), accent: '#d6e9ff', glow: 'rgba(180, 200, 240, 0.2)' };
        }
    }

    _drawSkillColumn(ctx, columnKey, x, y, w, h) {
        const font = this.assets.pixelFont;
        const theme = this._skillColumnTheme(columnKey);
        const pulse = Math.sin(this.gameTime * 2.6) * 0.5 + 0.5;

        // panel
        ctx.fillStyle = 'rgba(8, 14, 26, 0.86)';
        ctx.fillRect(x, y, w, h);

        // top accent strip
        ctx.fillStyle = theme.glow;
        ctx.fillRect(x, y, w, 12);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        const headerW = font.measure(theme.label, 1);
        font.draw(ctx, theme.label, x + Math.round((w - headerW) / 2), y + 2, {
            color: theme.accent,
        });

        const skills = this._skillsByColumn(columnKey);
        if (!skills.length) {
            const empty = 'SOON';
            const ew = font.measure(empty, 1);
            font.draw(ctx, empty, x + Math.round((w - ew) / 2), y + 40, { color: '#5a6c84' });
            return;
        }

        const cellTop = y + 14;
        const cellH = Math.floor((h - 14) / skills.length);

        for (let i = 0; i < skills.length; i++) {
            const def = skills[i];
            const selected =
                SKILL_COLUMNS[this.skillTreeSelection.column] === columnKey &&
                this.skillTreeSelection.row === i;
            this._drawSkillCell(ctx, def, theme, x + 4, cellTop + i * cellH, w - 8, cellH - 3, selected, pulse);
        }
    }

    _drawSkillCell(ctx, def, theme, x, y, w, h, selected, pulse) {
        const font = this.assets.pixelFont;
        const rank = this.player.getSkillRank(def.id);
        const canSpend = this.player.canSpend(def.id);
        const atMax = rank >= def.maxRank;
        const upgradeShine = this.skillUpgradeShines[def.id] || 0;
        const upgradeFlashVisible =
            upgradeShine > 0 && Math.floor((1 - upgradeShine) * 6) % 2 === 0;

        // selection glow
        if (selected) {
            const glow = 0.35 + pulse * 0.35;
            ctx.fillStyle = `rgba(255, 244, 184, ${glow * 0.18})`;
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        }

        if (upgradeFlashVisible) {
            ctx.fillStyle = 'rgba(255, 231, 138, 0.22)';
            ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        }

        ctx.fillStyle = rank > 0 ? 'rgba(16, 26, 48, 0.95)' : 'rgba(10, 16, 30, 0.92)';
        ctx.fillRect(x, y, w, h);

        if (upgradeFlashVisible) {
            ctx.fillStyle = 'rgba(255, 244, 184, 0.14)';
            ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        }

        ctx.strokeStyle = upgradeFlashVisible
            ? 'rgba(255, 240, 170, 0.78)'
            : (selected
                ? `rgba(255, 244, 184, ${0.6 + pulse * 0.35})`
                : (atMax ? theme.accent : 'rgba(168, 227, 255, 0.28)'));
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // inner accent for ranks
        if (rank > 0) {
            const accentRgb = upgradeFlashVisible
                ? '255, 231, 138'
                : (atMax ? '255, 231, 138' : '166, 255, 203');
            const accentAlpha = upgradeFlashVisible ? 0.16 : 0.1;
            ctx.fillStyle = `rgba(${accentRgb}, ${accentAlpha})`;
            ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        }

        // icon
        const iconSize = 16;
        const iconX = x + Math.round((w - iconSize) / 2);
        const iconY = y + 4;
        const iconColor = upgradeFlashVisible ? '#ffe78a' : theme.accent;
        this._drawSkillIcon(ctx, def.icon, iconX, iconY, iconSize, iconColor, rank > 0);

        // name
        const nameW = font.measure(def.name, 1);
        const nameColor = upgradeFlashVisible
            ? '#fff4bf'
            : (canSpend
                ? '#fff1b5'
                : (atMax ? theme.accent : (rank > 0 ? '#d6e9ff' : '#97a8c4')));
        font.draw(ctx, def.name, x + Math.round((w - nameW) / 2), iconY + iconSize + 2, {
            color: nameColor,
        });

        // rank pips
        const pipSize = 4;
        const pipGap = 2;
        const pipsW = def.maxRank * pipSize + (def.maxRank - 1) * pipGap;
        const pipsX = x + Math.round((w - pipsW) / 2);
        const pipsY = iconY + iconSize + 12;
        for (let i = 0; i < def.maxRank; i++) {
            const px = pipsX + i * (pipSize + pipGap);
            if (i < rank) {
                ctx.fillStyle = upgradeFlashVisible ? '#ffe78a' : theme.accent;
                ctx.fillRect(px, pipsY, pipSize, pipSize);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(px, pipsY, pipSize, 1);
            } else {
                ctx.fillStyle = 'rgba(12, 18, 34, 0.95)';
                ctx.fillRect(px, pipsY, pipSize, pipSize);
                ctx.strokeStyle = 'rgba(168, 227, 255, 0.45)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 0.5, pipsY + 0.5, pipSize - 1, pipSize - 1);
            }
        }

        // "NEW" or "MAX" badge
        if (canSpend) {
            const flicker = Math.floor(this.gameTime * 5) % 2;
            if (flicker) {
                const tag = 'K!';
                const tw = font.measure(tag, 1);
                ctx.fillStyle = 'rgba(255, 231, 138, 0.95)';
                ctx.fillRect(x + w - tw - 5, y + 2, tw + 3, 9);
                font.draw(ctx, tag, x + w - tw - 4, y + 3, { color: '#2a1d06' });
            }
        } else if (atMax) {
            const tag = 'MAX';
            const tw = font.measure(tag, 1);
            ctx.fillStyle = theme.accent;
            ctx.fillRect(x + w - tw - 5, y + 2, tw + 3, 9);
            font.draw(ctx, tag, x + w - tw - 4, y + 3, { color: '#0a1020' });
        }
    }

    _drawSkillIcon(ctx, kind, x, y, size, accent, owned) {
        // 16x16 pixel-art icons drawn procedurally so no new assets are needed.
        ctx.save();
        const dim = owned ? accent : 'rgba(168, 180, 210, 0.65)';
        const glow = owned ? accent : 'rgba(168, 180, 210, 0.35)';
        ctx.fillStyle = 'rgba(6, 10, 20, 0.7)';
        ctx.fillRect(x, y, size, size);

        const put = (px, py, color = dim) => {
            ctx.fillStyle = color;
            ctx.fillRect(x + px, y + py, 1, 1);
        };
        const rect = (px, py, w, h, color = dim) => {
            ctx.fillStyle = color;
            ctx.fillRect(x + px, y + py, w, h);
        };

        switch (kind) {
            case 'heart': {
                // classic pixel heart
                const hcolor = owned ? '#ff8d8d' : '#7c8ba6';
                const hglow = owned ? '#ffd5d5' : '#aab2c2';
                rect(4, 5, 2, 2, hcolor);
                rect(10, 5, 2, 2, hcolor);
                rect(3, 6, 4, 3, hcolor);
                rect(9, 6, 4, 3, hcolor);
                rect(3, 8, 10, 3, hcolor);
                rect(4, 11, 8, 1, hcolor);
                rect(5, 12, 6, 1, hcolor);
                rect(6, 13, 4, 1, hcolor);
                rect(7, 14, 2, 1, hcolor);
                put(5, 6, hglow);
                put(4, 7, hglow);
                break;
            }
            case 'regen': {
                const leaf = owned ? '#a6ffcb' : '#7a8e9c';
                const stem = owned ? '#5bd28a' : '#5c6f7c';
                rect(7, 3, 2, 10, stem);
                rect(4, 5, 3, 3, leaf);
                rect(9, 5, 3, 3, leaf);
                rect(3, 6, 2, 2, leaf);
                rect(11, 6, 2, 2, leaf);
                rect(5, 8, 2, 2, leaf);
                rect(9, 8, 2, 2, leaf);
                put(8, 4, '#eaffea');
                // cross sparkle
                const sparkle = owned ? '#fff5c8' : '#b0c4d8';
                rect(12, 11, 3, 1, sparkle);
                rect(13, 10, 1, 3, sparkle);
                break;
            }
            case 'edge': {
                const blade = owned ? '#d6e9ff' : '#8391a8';
                const hilt = owned ? '#ffd27b' : '#8a7e5a';
                rect(7, 2, 2, 9, blade);
                rect(6, 3, 1, 7, blade);
                rect(9, 3, 1, 7, blade);
                rect(8, 11, 0, 0, blade);
                rect(5, 11, 6, 1, hilt);
                rect(7, 12, 2, 3, hilt);
                put(8, 3, '#ffffff');
                break;
            }
            case 'bolt': {
                const bolt = owned ? '#fff1b5' : '#8b8a6f';
                rect(9, 2, 2, 4, bolt);
                rect(7, 4, 3, 2, bolt);
                rect(5, 6, 5, 2, bolt);
                rect(7, 8, 4, 2, bolt);
                rect(5, 10, 4, 2, bolt);
                rect(4, 12, 3, 2, bolt);
                put(8, 3, '#ffffff');
                break;
            }
            case 'link': {
                const ring = owned ? '#a8e3ff' : '#7d8ea6';
                const core = owned ? '#dff6ff' : '#9eaec8';
                rect(5, 5, 5, 1, ring);
                rect(5, 9, 5, 1, ring);
                rect(4, 6, 1, 3, ring);
                rect(10, 6, 1, 3, ring);
                rect(6, 6, 3, 3, core);
                rect(9, 8, 5, 1, ring);
                rect(9, 12, 5, 1, ring);
                rect(8, 9, 1, 3, ring);
                rect(14, 9, 1, 3, ring);
                rect(10, 9, 3, 3, core);
                break;
            }
            case 'wing': {
                const feather = owned ? '#a8e3ff' : '#7d8ea6';
                const accent2 = owned ? '#dff6ff' : '#a3b2c9';
                rect(4, 8, 10, 1, feather);
                rect(5, 7, 8, 1, feather);
                rect(6, 6, 6, 1, feather);
                rect(7, 5, 4, 1, feather);
                rect(8, 4, 2, 1, feather);
                rect(3, 9, 12, 1, accent2);
                rect(5, 10, 8, 1, feather);
                rect(7, 11, 4, 1, feather);
                break;
            }
            default: {
                rect(4, 4, 8, 8, dim);
                rect(6, 6, 4, 4, glow);
            }
        }

        ctx.restore();
    }

    _drawExpBar(ctx, x, y, w) {
        const player = this.player;
        const atCap = player.level >= MAX_PLAYER_LEVEL;
        const ratio = atCap ? 1 : Math.max(0, Math.min(1, player.xp / player.xpToNext));
        const pulse = Math.sin(this.gameTime * 4.2) * 0.5 + 0.5;
        const surge = this.expBarPulse;

        ctx.fillStyle = '#0f2433';
        ctx.fillRect(x, y, w, 5);

        ctx.fillStyle = '#19435c';
        ctx.fillRect(x, y, w, 1);

        const fillW = Math.max(0, Math.round((w - 2) * ratio));
        if (fillW > 0) {
            ctx.fillStyle = atCap ? '#ffe083' : '#6df4c8';
            ctx.fillRect(x + 1, y + 1, fillW, 3);
            ctx.fillStyle = atCap
                ? `rgba(255, 255, 210, ${0.35 + pulse * 0.35 + surge * 0.3})`
                : `rgba(214, 255, 240, ${0.25 + pulse * 0.18 + surge * 0.55})`;
            ctx.fillRect(x + 1, y + 1, fillW, 1);
        }

        if (surge > 0) {
            ctx.fillStyle = `rgba(255, 255, 210, ${surge * 0.35})`;
            ctx.fillRect(x - 1, y - 1, w + 2, 7);
        }

        const font = this.assets.pixelFont;
        const label = atCap ? 'MAX' : `LV${player.level}`;
        font.draw(ctx, label, 91, y - 2, { color: atCap ? '#ffe083' : '#a6ffcb' });
    }

    _drawSkillPointBeacon(ctx) {
        const font = this.assets.pixelFont;
        const pts = this.player.skillPoints;
        const pulse = Math.sin(this.gameTime * 5.2) * 0.5 + 0.5;
        const text = pts > 1 ? `K  /${pts} POINTS` : 'K  /  SKILL POINT';
        const textW = font.measure(text, 1);
        const w = textW + 12;
        const h = 12;
        const x = 12;
        const y = 54;

        ctx.fillStyle = `rgba(41, 25, 10, ${0.75 + pulse * 0.15})`;
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = `rgba(255, 231, 138, ${0.35 + pulse * 0.45})`;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(7, 11, 19, 0.85)';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.strokeStyle = `rgba(255, 231, 138, ${0.7 + pulse * 0.3})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        font.draw(ctx, text, x + 6, y + 2, { color: '#ffe78a' });
    }

    _drawXpPopups(ctx) {
        if (!this.xpPopups || this.xpPopups.length === 0) return;
        const font = this.assets.pixelFont;
        for (const p of this.xpPopups) {
            const t = 1 - Math.max(0, p.timer / p.maxTimer);
            const alpha = p.timer > 0.25 ? 1 : Math.max(0, p.timer / 0.25);
            const yOff = Math.round(p.y - t * 4);
            const xOff = Math.round(p.x - font.measure(p.text, 1) / 2);
            font.draw(ctx, p.text, xOff + 1, yOff + 1, { color: 'rgba(5, 10, 20, 0.75)', alpha });
            font.draw(ctx, p.text, xOff, yOff, { color: '#a6ffcb', alpha });
        }
    }

    _drawLevelUpBanner(ctx) {
        const anim = this.levelUpAnim;
        if (!anim) return;
        const font = this.assets.pixelFont;

        const life = 1 - anim.timer / anim.maxTimer;
        const intro = Math.min(1, life / 0.18);
        const outro = anim.timer < 0.45 ? anim.timer / 0.45 : 1;
        const alpha = Math.max(0, Math.min(1, intro * outro));
        const pulse = Math.sin(this.gameTime * 9) * 0.5 + 0.5;

        const title = `LEVEL ${anim.level}!`;
        const bonus = anim.bonusText;
        const titleW = font.measure(title, 2);
        const bonusW = font.measure(bonus, 1);
        const boxW = Math.max(titleW, bonusW) + 28;
        const boxH = 38;
        const boxX = Math.round((NATIVE_WIDTH - boxW) / 2);
        const yOffset = Math.round((1 - intro) * -10);
        const boxY = Math.round(NATIVE_HEIGHT / 2 - boxH / 2 - 10) + yOffset;

        // aura glow behind banner
        const auraAlpha = alpha * (0.3 + pulse * 0.2);
        const grad = ctx.createRadialGradient(
            boxX + boxW / 2,
            boxY + boxH / 2,
            4,
            boxX + boxW / 2,
            boxY + boxH / 2,
            Math.max(boxW, boxH),
        );
        grad.addColorStop(0, `rgba(255, 236, 164, ${auraAlpha})`);
        grad.addColorStop(1, 'rgba(255, 236, 164, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, boxY - 24, NATIVE_WIDTH, boxH + 48);

        ctx.fillStyle = `rgba(7, 11, 19, ${0.82 * alpha})`;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = `rgba(255, 231, 138, ${(0.6 + pulse * 0.4) * alpha})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

        font.draw(ctx, title, boxX + Math.round((boxW - titleW) / 2), boxY + 6, {
            color: '#ffe78a',
            scale: 2,
            alpha,
        });
        font.draw(ctx, bonus, boxX + Math.round((boxW - bonusW) / 2), boxY + 26, {
            color: '#a6ffcb',
            alpha,
        });

        if (anim.chainCount > 1) {
            const chainText = `x${anim.chainCount}`;
            const cw = font.measure(chainText, 1);
            font.draw(ctx, chainText, boxX + boxW - cw - 4, boxY + 4, {
                color: '#ffd1a4',
                alpha,
            });
        }
    }

    _drawQuestBeacon(ctx, x, y) {
        const pulse = Math.sin(this.gameTime * 4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(152, 255, 226, ${0.14 + pulse * 0.16})`;
        ctx.fillRect(x - 10, y - 28, 20, 20);
        ctx.fillStyle = '#f7f4b2';
        ctx.fillRect(x - 1, y - 24, 2, 10);
        ctx.fillRect(x - 4, y - 21, 8, 2);
    }

    _drawElaraMarker(ctx) {
        const font = this.assets.pixelFont;
        const label = 'ELARA';
        const textW = font.measure(label, 1);
        const boxW = textW + 10;
        const boxX = Math.round(this.elara.cx - boxW / 2);
        const boxY = Math.round(this.elara.y - 16);
        const pulse = Math.sin(this.gameTime * 5.5) * 0.5 + 0.5;

        ctx.fillStyle = `rgba(7, 11, 19, ${0.72 + pulse * 0.08})`;
        ctx.fillRect(boxX, boxY, boxW, 10);
        ctx.strokeStyle = `rgba(255, 231, 138, ${0.4 + pulse * 0.35})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, 9);
        font.draw(ctx, label, boxX + 5, boxY + 2, { color: '#ffe78a' });
    }

    _drawHUD(ctx) {
        const font = this.assets.pixelFont;
        const biomeInfo = this.world.getBiomeInfoAtWorld(this.player.cx, this.player.cy);
        const regionLabel = biomeInfo.hudLabel || this.world.realmLabel;

        // Left panel: title + sword icon on right side, HP below
        const panelH = this.hasLevelUpAbility ? 46 : 36;
        ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
        ctx.fillRect(6, 6, 104, panelH);
        font.draw(ctx, regionLabel, 12, 10, { color: biomeInfo.accent || '#98ffe0' });
        font.draw(ctx, 'SHARDFANG', 12, 20, { color: '#d6e9ff' });
        ctx.drawImage(this.assets.swordIcon, 90, 10, 16, 16);

        const barX = 12;
        const barY = 31;
        const barW = 78;
        ctx.fillStyle = '#211923';
        ctx.fillRect(barX, barY, barW, 5);
        ctx.fillStyle = '#ef7d57';
        ctx.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * (this.player.health / this.player.maxHealth)), 3);
        font.draw(ctx, 'HP', 93, 29, { color: '#fff6d3' });

        if (this.hasLevelUpAbility) this._drawExpBar(ctx, barX, barY + 8, barW);

        const objectiveLines = this._wrapPixelText(this._currentObjectiveText(), 122);
        const actionRows = ['ESC MENU'];
        const unlockedRows = [];
        if (this.hasMap) unlockedRows.push('M MAP');
        if (this.hasLevelUpAbility) unlockedRows.push('K SKILLS');
        if (unlockedRows.length) actionRows.push(unlockedRows.join(' / '));
        const objectiveStartY = 19;
        const objectiveLineH = 9;
        const actionStartY = objectiveStartY + objectiveLines.length * objectiveLineH + 1;
        const actionLineH = 8;
        const rightPanelH = Math.max(34, actionStartY - 6 + actionRows.length * actionLineH + 4);

        ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
        ctx.fillRect(116, 6, 134, rightPanelH);
        font.draw(ctx, 'OBJECTIVE', 122, 10, { color: '#fff1b5' });
        objectiveLines.forEach((line, index) => {
            font.draw(ctx, line, 122, objectiveStartY + index * objectiveLineH, { color: '#f1f5ff' });
        });
        actionRows.forEach((line, index) => {
            font.draw(ctx, line, 122, actionStartY + index * actionLineH, {
                color: index === actionRows.length - 1 && unlockedRows.length ? '#8effec' : '#97b6cf',
            });
        });

        if (this.hasLevelUpAbility && this.player.skillPoints > 0) {
            this._drawSkillPointBeacon(ctx);
        }

        // Hide the bottom hint when any other bottom-of-screen element could overlap it:
        // the enemy nameplate (bottom-right) or an interact prompt (y = NATIVE_HEIGHT - 40).
        const enemyNearby = this.enemies.some((enemy) => {
            if (!enemy.isAlive()) return false;
            const dx = enemy.cx - this.player.cx;
            const dy = enemy.cy - this.player.cy;
            return dx * dx + dy * dy <= 88 * 88;
        });
        const interactPromptActive = !this.dialog && !this.rewardPopup && !this.worldMapOpen && !this.deathState && (
            this._playerNearElara() || this._playerNearTombstone() || (this._playerNearTreasureChest() && !this.hasLevelUpAbility)
        );
        if (this.settings.showHints && this.gameTime < 10 && !enemyNearby && !interactPromptActive) {
            const alpha = this.gameTime < 7 ? 1 : 1 - (this.gameTime - 7) / 3;
            ctx.fillStyle = `rgba(7, 11, 19, ${0.78 * alpha})`;
            ctx.fillRect(42, NATIVE_HEIGHT - 24, 174, 18);
            font.draw(ctx, 'MOVE WITH WASD OR ARROWS.', 48, NATIVE_HEIGHT - 21, { color: '#eef6ff', alpha });
            font.draw(ctx, 'STEP IN, STRIKE, BACK OFF.', 48, NATIVE_HEIGHT - 12, { color: '#97b6cf', alpha });
        }

        if (this.toastTimer > 0 && this.toast) {
            const toastWidth = Math.max(90, font.measure(this.toast, 1) + 12);
            const toastX = Math.round((NATIVE_WIDTH - toastWidth) / 2);
            const beaconActive = this.hasLevelUpAbility && this.player.skillPoints > 0;
            const toastY = beaconActive ? 72 : (this.hasLevelUpAbility ? 56 : 42);
            ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
            ctx.fillRect(toastX, toastY, toastWidth, 12);
            font.draw(ctx, this.toast, toastX + 6, toastY + 2, { color: '#8df7d2' });
        }

        for (const enemy of this.enemies) {
            if (!enemy.isAlive()) continue;
            const dx = enemy.cx - this.player.cx;
            const dy = enemy.cy - this.player.cy;
            if (dx * dx + dy * dy > 88 * 88) continue;

            const label = enemy.hudLabel || 'ENEMY';
            const panelW = Math.max(112, font.measure(label, 1) + 27);
            const panelX = NATIVE_WIDTH - panelW - 6;
            const barW = panelW - 24;

            ctx.fillStyle = 'rgba(7, 11, 19, 0.88)';
            ctx.fillRect(panelX, NATIVE_HEIGHT - 26, panelW, 18);
            font.draw(ctx, label, panelX + 6, NATIVE_HEIGHT - 24, { color: '#a6ffcb' });
            ctx.fillStyle = '#2b1a24';
            ctx.fillRect(panelX + 6, NATIVE_HEIGHT - 12, barW, 5);
            ctx.fillStyle = '#79ff9b';
            ctx.fillRect(panelX + 7, NATIVE_HEIGHT - 11, Math.max(0, (barW - 2) * (enemy.health / enemy.maxHealth)), 3);
            break;
        }
    }

    _getMapMarkers() {
        const markers = this.world.getMapMarkers()
            .filter((marker) => marker.type !== 'relic' || !this.hasLevelUpAbility)
            .map((marker) => ({ ...marker }));
        if (this.tombstone) {
            markers.push({
                type: 'tombstone',
                x: this.tombstone.cx,
                y: this.tombstone.cy,
            });
        }
        return markers;
    }

    _drawMinimap(ctx, x, y, w, h) {
        // Parchment-style thumbnail + interior crescents hinting at both islands.
        ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = '#3b5a74';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        // water
        ctx.fillStyle = '#12476a';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        const worldW = this.world.pixelW;
        const worldH = this.world.pixelH;
        const innerW = w - 4;
        const innerH = h - 4;

        // Sample the terrain map into the minimap for a real silhouette.
        const colsPerPx = this.world.cols / innerW;
        const rowsPerPx = this.world.rows / innerH;
        for (let py = 0; py < innerH; py++) {
            const row = Math.min(this.world.rows - 1, Math.floor(py * rowsPerPx));
            for (let px = 0; px < innerW; px++) {
                const col = Math.min(this.world.cols - 1, Math.floor(px * colsPerPx));
                const tile = this.world.map[row][col];
                if (tile === 0 || tile === 1) continue;
                const biomeKey = this.world.getBiomeKeyAt(col, row);
                if (biomeKey === 'canyon') {
                    ctx.fillStyle = tile === 2
                        ? '#e88f66'
                        : tile === 5
                            ? '#c86f4c'
                            : (tile === 4 ? '#5d2e38' : '#9f523e');
                } else if (biomeKey === 'driftmere') {
                    ctx.fillStyle = tile === 2
                        ? '#6cb483'
                        : tile === 5
                            ? '#9b8764'
                            : (tile === 4 ? '#315845' : '#4c8d63');
                } else if (biomeKey === 'salt') {
                    ctx.fillStyle = tile === 2
                        ? '#f3fbff'
                        : tile === 5
                            ? '#b9dfff'
                            : (tile === 4 ? '#d9c39d' : '#dce8f3');
                } else if (biomeKey === 'tropics') {
                    ctx.fillStyle = tile === 2
                        ? '#53bf73'
                        : tile === 5
                            ? '#7cb484'
                            : (tile === 4 ? '#1f6941' : '#319160');
                } else {
                    ctx.fillStyle = tile === 2
                        ? '#d9c28a'
                        : tile === 5
                            ? '#b08a62'
                            : (tile === 4 ? '#9f7846' : '#c99d5a');
                }
                ctx.fillRect(x + 2 + px, y + 2 + py, 1, 1);
            }
        }

        for (const marker of this._getMapMarkers()) {
            const tx = x + 2 + Math.round((marker.x / worldW) * innerW);
            const ty = y + 2 + Math.round((marker.y / worldH) * innerH);
            ctx.fillStyle = marker.type === 'camp'
                ? '#ffe29b'
                : marker.type === 'portal'
                    ? '#8fe0ff'
                : marker.type === 'canyon'
                    ? '#ff9b75'
                    : marker.type === 'salt'
                        ? '#d9f6ff'
                        : marker.type === 'tropics'
                            ? '#6fffd5'
                            : '#f6a7ff';
            ctx.fillRect(tx - 1, ty - 1, 3, 3);
            ctx.fillStyle = '#101726';
            ctx.fillRect(tx, ty, 1, 1);
        }

        // Player marker (pulses)
        const pulse = Math.sin(this.gameTime * 5) * 0.5 + 0.5;
        const mx = x + 2 + Math.round((this.player.cx / worldW) * innerW);
        const my = y + 2 + Math.round((this.player.cy / worldH) * innerH);
        ctx.fillStyle = `rgba(255, 255, 140, ${0.55 + pulse * 0.45})`;
        ctx.fillRect(mx - 1, my - 1, 3, 3);
        ctx.fillStyle = '#ffffd5';
        ctx.fillRect(mx, my, 1, 1);

        ctx.strokeStyle = 'rgba(255, 224, 156, 0.65)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // "MAP / M" label strip at the bottom so the player learns the hotkey.
        const font = this.assets.pixelFont;
        const label = 'M';
        const lw = font.measure(label, 1);
        ctx.fillStyle = 'rgba(7, 11, 19, 0.72)';
        ctx.fillRect(x + w - lw - 4, y + h - 9, lw + 3, 8);
        font.draw(ctx, label, x + w - lw - 2, y + h - 8, { color: '#ffe78a' });
    }

    _getWorldMapCache() {
        if (this.worldMapCache) return this.worldMapCache;
        const canvas = document.createElement('canvas');
        canvas.width = this.world.pixelW;
        canvas.height = this.world.pixelH;
        const offCtx = canvas.getContext('2d');
        offCtx.imageSmoothingEnabled = false;
        // Render the whole world at native resolution so it reads exactly
        // like the outside view — just bigger, since the map shows the
        // entire island instead of a camera slice.
        this.world.drawGround(offCtx, 0, 0, this.world.pixelW, this.world.pixelH, 0);
        for (const prop of this.world.decorProps) {
            this.world.drawProp(offCtx, prop);
        }
        for (const structure of this.world.structures) {
            this.world.drawStructure(offCtx, structure, 0);
        }
        this.world.drawLandmarks(offCtx, 0);
        this.worldMapCache = canvas;
        return canvas;
    }

    _drawWorldMap(ctx) {
        const font = this.assets.pixelFont;
        const biomeInfo = this.world.getBiomeInfoAtWorld(this.player.cx, this.player.cy);

        ctx.fillStyle = 'rgba(3, 5, 10, 0.92)';
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

        const padX = 10;
        const topPad = 20;
        const bottomPad = 18;
        const frameX = padX;
        const frameY = topPad;
        const frameW = NATIVE_WIDTH - padX * 2;
        const frameH = NATIVE_HEIGHT - topPad - bottomPad;

        // Parchment frame.
        ctx.fillStyle = '#1d1624';
        ctx.fillRect(frameX - 3, frameY - 3, frameW + 6, frameH + 6);
        ctx.fillStyle = '#3e2d1c';
        ctx.fillRect(frameX - 2, frameY - 2, frameW + 4, frameH + 4);
        ctx.fillStyle = '#8a6a44';
        ctx.fillRect(frameX - 1, frameY - 1, frameW + 2, frameH + 2);
        ctx.fillStyle = '#1a2332';
        ctx.fillRect(frameX, frameY, frameW, frameH);

        const cache = this._getWorldMapCache();
        const sourceW = Math.min(cache.width, 34 * 16);
        const sourceH = Math.min(cache.height, 26 * 16);
        const srcX = Math.max(0, Math.min(cache.width - sourceW, Math.round(this.player.cx - sourceW / 2)));
        const srcY = Math.max(0, Math.min(cache.height - sourceH, Math.round(this.player.cy - sourceH / 2)));
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cache, srcX, srcY, sourceW, sourceH, frameX, frameY, frameW, frameH);
        ctx.imageSmoothingEnabled = prevSmoothing;

        for (let gx = 1; gx < 4; gx++) {
            const lineX = frameX + Math.round((frameW * gx) / 4);
            ctx.fillStyle = 'rgba(223, 246, 255, 0.08)';
            ctx.fillRect(lineX, frameY + 1, 1, frameH - 2);
        }
        for (let gy = 1; gy < 3; gy++) {
            const lineY = frameY + Math.round((frameH * gy) / 3);
            ctx.fillStyle = 'rgba(223, 246, 255, 0.08)';
            ctx.fillRect(frameX + 1, lineY, frameW - 2, 1);
        }

        ctx.fillStyle = '#e3bc6d';
        ctx.fillRect(frameX - 2, frameY - 2, 4, 4);
        ctx.fillRect(frameX + frameW - 2, frameY - 2, 4, 4);
        ctx.fillRect(frameX - 2, frameY + frameH - 2, 4, 4);
        ctx.fillRect(frameX + frameW - 2, frameY + frameH - 2, 4, 4);

        const markerStyles = {
            camp: '#8fffe1',
            portal: '#8fe0ff',
            canyon: '#ff9a70',
            salt: '#dff6ff',
            tropics: '#6fffd5',
            relic: '#ffe78a',
            tombstone: '#d8e2ff',
        };
        for (const marker of this._getMapMarkers()) {
            if (marker.x < srcX || marker.x > srcX + sourceW || marker.y < srcY || marker.y > srcY + sourceH) continue;
            const tx = frameX + Math.round(((marker.x - srcX) / sourceW) * frameW);
            const ty = frameY + Math.round(((marker.y - srcY) / sourceH) * frameH);
            ctx.fillStyle = markerStyles[marker.type] || '#eaf2ff';
            ctx.fillRect(tx - 2, ty - 2, 4, 4);
            ctx.fillStyle = '#0a1020';
            ctx.fillRect(tx - 1, ty - 1, 2, 2);
        }

        const pulse = Math.sin(this.gameTime * 6) * 0.5 + 0.5;
        const px = frameX + Math.round(((this.player.cx - srcX) / sourceW) * frameW);
        const py = frameY + Math.round(((this.player.cy - srcY) / sourceH) * frameH);
        ctx.fillStyle = `rgba(255, 248, 154, ${0.32 + pulse * 0.38})`;
        ctx.fillRect(px - 4, py - 4, 9, 9);
        ctx.fillStyle = '#ffea77';
        ctx.fillRect(px - 2, py - 2, 5, 5);
        ctx.fillStyle = '#5c2a0c';
        ctx.fillRect(px - 1, py - 1, 3, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, py, 1, 1);

        const title = this.world.mapTitle;
        const tw = font.measure(title, 1);
        ctx.fillStyle = 'rgba(7, 11, 19, 0.9)';
        ctx.fillRect(Math.round((NATIVE_WIDTH - tw) / 2) - 4, 6, tw + 8, 12);
        font.draw(ctx, title, Math.round((NATIVE_WIDTH - tw) / 2), 8, { color: '#ffe78a' });

        const subtitle = `LOCAL SCOUT MAP · ${biomeInfo.label}`;
        const sw = font.measure(subtitle, 1);
        font.draw(ctx, subtitle, Math.round((NATIVE_WIDTH - sw) / 2), 18, { color: biomeInfo.accent || '#dff6ff' });

        const foot = 'PRESS M OR ESC TO CLOSE';
        if (Math.floor(this.gameTime * 3) % 2) {
            const fw = font.measure(foot, 1);
            font.draw(ctx, foot, Math.round((NATIVE_WIDTH - fw) / 2), NATIVE_HEIGHT - 12, { color: '#ffe78a' });
        }

        const objective = this._currentObjectiveText();
        const ow = font.measure(objective, 1);
        ctx.fillStyle = 'rgba(7, 11, 19, 0.76)';
        ctx.fillRect(frameX + 4, NATIVE_HEIGHT - 24, Math.min(frameW - 8, ow + 8), 10);
        font.draw(ctx, objective, frameX + 8, NATIVE_HEIGHT - 22, { color: '#dff6ff' });

        const here = 'YOU ARE HERE';
        const hw = font.measure(here, 1);
        const labelX = Math.min(frameX + frameW - hw - 6, Math.max(frameX + 6, px - Math.round(hw / 2)));
        const labelY = Math.max(frameY + 4, py - 14);
        ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
        ctx.fillRect(labelX - 2, labelY - 1, hw + 4, 9);
        font.draw(ctx, here, labelX, labelY, { color: '#fff6d3' });
    }

    _drawDeathScreen() {
        // Rendering is handled by the HTML death overlay for full-resolution
        // crispness. The canvas just keeps drawing the last frame beneath.
    }

    _drawCheckpointList(ctx, d) {
        const font = this.assets.pixelFont;

        const panelW = 196;
        const panelH = 132;
        const panelX = Math.round((NATIVE_WIDTH - panelW) / 2);
        const panelY = Math.round((NATIVE_HEIGHT - panelH) / 2);

        ctx.fillStyle = 'rgba(4, 3, 6, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = 'rgba(210, 170, 140, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

        const title = 'SELECT CHECKPOINT';
        const tw = font.measure(title, 1);
        font.draw(ctx, title, panelX + Math.round((panelW - tw) / 2), panelY + 6, { color: '#ffe0a8' });

        const entries = d.checkpoints || [];
        if (!entries.length) {
            const msg = 'NO CHECKPOINTS FOUND.';
            const mw = font.measure(msg, 1);
            font.draw(ctx, msg, panelX + Math.round((panelW - mw) / 2), panelY + 52, { color: '#f1d0d0' });
            const foot = 'ESC RETURNS';
            const fw = font.measure(foot, 1);
            font.draw(ctx, foot, panelX + Math.round((panelW - fw) / 2), panelY + panelH - 14, { color: '#c49b9b' });
            return;
        }

        let yCursor = panelY + 22;
        entries.forEach((entry, idx) => {
            const selected = idx === d.reloadIndex;
            if (selected) {
                ctx.fillStyle = 'rgba(190, 90, 70, 0.35)';
                ctx.fillRect(panelX + 6, yCursor - 1, panelW - 12, 12);
                ctx.fillStyle = '#ffc07a';
                ctx.fillRect(panelX + 8, yCursor + 2, 3, 5);
            }
            const prefix = selected ? '>' : ' ';
            const label = `${prefix} ${entry.label || 'WAYFARER STONE'}`;
            font.draw(ctx, label.toUpperCase(), panelX + 14, yCursor, { color: selected ? '#fff6d3' : '#d6c7b2' });

            const when = this._formatTimestamp(entry.timestamp);
            const ww = font.measure(when, 1);
            font.draw(ctx, when, panelX + panelW - ww - 8, yCursor, { color: selected ? '#ffe0a8' : '#a39076' });

            yCursor += 14;
        });

        const foot = 'UP/DOWN TO PICK · ENTER LOADS · ESC BACK';
        const fw = font.measure(foot, 1);
        font.draw(ctx, foot, panelX + Math.round((panelW - fw) / 2), panelY + panelH - 12, { color: '#ffe78a' });
    }

    _formatTimestamp(ts) {
        if (!ts) return '---';
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return '---';
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hh}:${mm}`;
    }

    _drawFrame(ctx) {
        ctx.strokeStyle = 'rgba(140, 244, 219, 0.18)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, NATIVE_WIDTH - 2, NATIVE_HEIGHT - 2);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(0, 0, NATIVE_WIDTH, 4);
        ctx.fillRect(0, NATIVE_HEIGHT - 4, NATIVE_WIDTH, 4);
    }

    _snapshotGame() {
        this._storeCurrentRealmState();

        return {
            currentRealmId: this.currentRealmId,
            player: {
                x: this.player.x,
                y: this.player.y,
                health: this.player.health,
                maxHealth: this.player.maxHealth,
                attackDamage: this.player.attackDamage,
                level: this.player.level,
                xp: this.player.xp,
                direction: this.player.direction,
                facingLeft: this.player.facingLeft,
                skills: { ...this.player.skills },
                skillPoints: this.player.skillPoints,
            },
            enemies: this._serializeEnemies(),
            realmStates: this.realmStates,
            hasReachedCanyons: this.hasReachedCanyons,
            hasReachedSaltFlats: this.hasReachedSaltFlats,
            hasReachedTropics: this.hasReachedTropics,
            hasTalkedToElara: this.hasTalkedToElara,
            hasMap: this.hasMap,
            hasLevelUpAbility: this.hasLevelUpAbility,
            gameTime: this.gameTime,
            settings: {
                showHints: this.settings.showHints,
                soundEnabled: this.settings.soundEnabled,
            },
        };
    }

    _updateEnemySpawners(dt) {
        if (!this.hasTalkedToElara || !this.enemySpawnNodes.length) return;

        const aliveEnemies = this.enemies.filter((enemy) => enemy.isAlive());
        if (aliveEnemies.length >= 8) return;

        for (const node of this.enemySpawnNodes) {
            node.timer -= dt;
            if (node.timer > 0) continue;
            node.timer = node.interval;

            const dx = node.x - this.player.cx;
            const dy = node.y - this.player.cy;
            if (dx * dx + dy * dy > node.activationRadius * node.activationRadius) continue;

            const aliveNearNode = aliveEnemies.filter((enemy) => {
                const nx = enemy.cx - node.x;
                const ny = enemy.cy - node.y;
                return nx * nx + ny * ny <= node.leashRadius * node.leashRadius;
            }).length;

            if (aliveNearNode >= node.maxAlive) continue;

            const spawn = this._spawnEnemy({
                kind: node.kind,
                x: node.x + (Math.random() * 10 - 5),
                y: node.y + (Math.random() * 8 - 4),
            });
            this.enemies.push(spawn);
            aliveEnemies.push(spawn);
            if (aliveEnemies.length >= 8) break;

            if (dx * dx + dy * dy <= 110 * 110) {
                this.toast = 'VOID NEST STIRS';
                this.toastTimer = 1.5;
            }
        }
    }

    _saveGame() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this._snapshotGame()));
        } catch (error) {
            console.warn('Zendoria save skipped:', error);
        }
    }

    _createCheckpoint(label = 'Wayfarer Stone') {
        const existing = this._readCheckpoints();
        const now = Date.now();
        const entry = {
            id: `cp-${now}`,
            label,
            timestamp: now,
            snapshot: this._snapshotGame(),
        };

        existing.unshift(entry);
        if (existing.length > MAX_CHECKPOINTS) existing.length = MAX_CHECKPOINTS;

        try {
            localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(existing));
        } catch (error) {
            console.warn('Zendoria checkpoint write failed:', error);
        }

        return entry;
    }

    _readCheckpoints() {
        try {
            const raw = localStorage.getItem(CHECKPOINTS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Zendoria checkpoint read failed:', error);
            return [];
        }
    }

    _triggerDeath() {
        this.player.health = 0;
        this.deathState = {
            phase: 'fade-in',
            timer: 0,
            selection: 0,
            showReloadList: false,
            reloadIndex: 0,
            checkpoints: this._readCheckpoints(),
            transitionTimer: 0,
            transitionTarget: null,
        };
        this._fadeOutGameMusic();
        this._fadeOutDesertMusic();
        this._playDeathSound();
        this._showDeathOverlay();
        this._playBeep(120, 0.8, 'sawtooth', 0.16);
    }

    _showDeathOverlay() {
        if (!this.deathOverlay) return;
        this.deathOverlay.classList.remove('hidden');
        // force reflow so the browser actually animates the opacity transition
        void this.deathOverlay.offsetWidth;
        this.deathOverlay.classList.add('visible');
        this._syncDeathOverlay();
    }

    _hideDeathOverlay() {
        if (!this.deathOverlay) return;
        this.deathOverlay.classList.remove('visible');
        this.deathOverlay.classList.add('hidden');
        if (this.deathCheckpointsPanel) this.deathCheckpointsPanel.classList.add('hidden');
    }

    _syncDeathOverlay() {
        const d = this.deathState;
        if (!d) return;

        const selected = DEATH_OPTIONS[d.selection];
        const showQuit = selected === 'quit' && !d.showReloadList;
        const showReload = selected === 'reload' && !d.showReloadList;

        if (this.deathImageQuit) {
            this.deathImageQuit.classList.toggle('is-active', showQuit);
            this.deathImageQuit.style.opacity = showQuit ? '1' : '0';
        }
        if (this.deathImageReload) {
            this.deathImageReload.classList.toggle('is-active', showReload);
            this.deathImageReload.style.opacity = showReload ? '1' : '0';
        }

        if (this.deathCheckpointsPanel) {
            this.deathCheckpointsPanel.classList.toggle('hidden', !d.showReloadList);
        }
        if (d.showReloadList) this._renderCheckpointList();
    }

    _renderCheckpointList() {
        if (!this.deathCheckpointsList || !this.deathState) return;
        const entries = this.deathState.checkpoints || [];
        this.deathCheckpointsList.innerHTML = '';

        if (!entries.length) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = 'No checkpoints saved yet. Visit the tombstone first.';
            this.deathCheckpointsList.appendChild(empty);
            return;
        }

        entries.forEach((entry, idx) => {
            const li = document.createElement('li');
            if (idx === this.deathState.reloadIndex) li.classList.add('is-selected');
            const label = document.createElement('span');
            label.textContent = entry.label || 'Wayfarer Stone';
            const when = document.createElement('span');
            when.textContent = this._formatTimestamp(entry.timestamp);
            li.appendChild(label);
            li.appendChild(when);
            this.deathCheckpointsList.appendChild(li);
        });
    }

    _updateDeathState(dt) {
        const d = this.deathState;
        if (!d) return;

        if (d.phase === 'fade-in') {
            d.timer = Math.min(DEATH_FADE_DURATION, d.timer + dt);
            if (d.timer >= DEATH_FADE_DURATION) d.phase = 'idle';
        }

        if (d.phase === 'fade-out') {
            d.transitionTimer = Math.min(DEATH_OUTFADE_DURATION, d.transitionTimer + dt);
            this._applyDeathFadeOutOpacity();
            if (d.transitionTimer >= DEATH_OUTFADE_DURATION) {
                this._finalizeDeathTransition();
            }
            return;
        }

        if (d.showReloadList) {
            this._updateDeathReloadInput();
            this._syncDeathOverlay();
            return;
        }

        // Let the player toggle the pick even during the slow fade-in so the
        // screen feels responsive. The actual activation still waits for idle.
        if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
            d.selection = (d.selection + DEATH_OPTIONS.length - 1) % DEATH_OPTIONS.length;
            this._playBeep(620, 0.05, 'square', 0.1);
        }
        if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
            d.selection = (d.selection + 1) % DEATH_OPTIONS.length;
            this._playBeep(520, 0.05, 'square', 0.1);
        }

        if (d.phase === 'idle') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                const choice = DEATH_OPTIONS[d.selection];
                if (choice === 'quit') {
                    this._beginDeathTransition('quit');
                } else {
                    d.checkpoints = this._readCheckpoints();
                    d.reloadIndex = 0;
                    d.showReloadList = true;
                    this._playBeep(820, 0.1, 'triangle', 0.14);
                }
            }

            if (this.input.wasPressed('Escape')) {
                this._beginDeathTransition('quit');
            }
        }

        this._syncDeathOverlay();
    }

    _applyDeathFadeOutOpacity() {
        if (!this.deathOverlay || !this.deathState) return;
        const d = this.deathState;
        const t = Math.min(1, d.transitionTimer / DEATH_OUTFADE_DURATION);
        this.deathOverlay.style.opacity = String(1 - t);
    }

    _updateDeathReloadInput() {
        const d = this.deathState;
        const entries = d.checkpoints;

        if (this.input.wasPressed('Escape') || this.input.wasPressed('Backspace')) {
            d.showReloadList = false;
            this._playBeep(480, 0.05, 'square', 0.08);
            this._syncDeathOverlay();
            return;
        }

        if (!entries.length) {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                d.showReloadList = false;
            }
            return;
        }

        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            d.reloadIndex = (d.reloadIndex + entries.length - 1) % entries.length;
            this._playBeep(640, 0.04, 'square', 0.1);
        }
        if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            d.reloadIndex = (d.reloadIndex + 1) % entries.length;
            this._playBeep(520, 0.04, 'square', 0.1);
        }

        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
            this._beginDeathTransition('reload', entries[d.reloadIndex]);
        }
    }

    _beginDeathTransition(target, payload = null) {
        const d = this.deathState;
        if (!d) return;
        d.phase = 'fade-out';
        d.transitionTimer = 0;
        d.transitionTarget = { kind: target, payload };
        this._playBeep(380, 0.2, 'triangle', 0.14);
    }

    _finalizeDeathTransition() {
        const d = this.deathState;
        if (!d || !d.transitionTarget) {
            this.deathState = null;
            this._hideDeathOverlay();
            this._stopDeathSound();
            if (this.deathOverlay) this.deathOverlay.style.opacity = '';
            return;
        }

        const { kind, payload } = d.transitionTarget;
        this.deathState = null;
        this._hideDeathOverlay();
        this._stopDeathSound();
        if (this.deathOverlay) this.deathOverlay.style.opacity = '';

        if (kind === 'quit') {
            this._resetSession();
            this._returnToTitle();
            return;
        }

        if (kind === 'reload' && payload && payload.snapshot) {
            this._resetSession();
            this._applySaveData(payload.snapshot);
            this.player.health = this.player.maxHealth;
            this._saveGame();
            this._enterGameplay();
            this.toast = `RELOADED · ${payload.label.toUpperCase()}`;
            this.toastTimer = 2.4;
            return;
        }

        // Fallback: fresh start.
        this._resetSession();
        this._enterGameplay();
    }

    _readSaveData() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Zendoria save read failed:', error);
            return null;
        }
    }

    _loadSettings() {
        try {
            const raw = localStorage.getItem(this.settingsKey);
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                showHints: parsed.showHints !== false,
                soundEnabled: parsed.soundEnabled !== false,
            };
        } catch (error) {
            console.warn('Zendoria settings read failed:', error);
            return {
                showHints: true,
                soundEnabled: true,
            };
        }
    }

    _saveSettings() {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Zendoria settings save failed:', error);
        }
    }

    _setSoundEnabled(enabled) {
        if (this.settings.soundEnabled === enabled) return;

        this.settings.soundEnabled = enabled;
        this._saveSettings();

        if (!enabled) {
            this.titleVoiceCanAttempt = false;
            this.titleVoiceNeedsGesture = false;
            this._fadeOutTitleVoice();
            this._fadeOutTitleMusic();
            this._fadeOutGameMusic();
            this._fadeOutDesertMusic();
        } else if (this.started) {
            this._startRealmMusic();
        } else {
            this._startTitleMusic();
        }

        if (this.titleDialog === 'options') {
            this._syncTitleOptionRows();
        }

        this._syncPauseMenu();
        this._syncTitleMenu();
    }

    _playBeep(freq = 600, duration = 0.06, type = 'square', gain = 0.1) {
        if (!this.settings.soundEnabled) return;

        try {
            if (!this.audioCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                this.audioCtx = new Ctx();
            }
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const amp = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            amp.gain.setValueAtTime(0, ctx.currentTime);
            amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
            amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(amp).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration + 0.02);
        } catch (_) {
            // Audio is best-effort in the browser shell.
        }
    }

    _createAudio(src, loop = false) {
        if (!src) return null;

        try {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.loop = loop;
            audio.volume = loop ? 0 : 1;
            return audio;
        } catch (error) {
            console.warn(`Zendoria audio init failed for ${src}:`, error);
            return null;
        }
    }

    _attemptTitleVoiceAutoplay() {
        if (!this.titleVoice || !this.titleVoiceCanAttempt || !this.settings.soundEnabled || this.titleVoiceAttemptedAutoplay) {
            return;
        }

        this.titleVoiceAttemptedAutoplay = true;
        this._startTitleVoice(false);
    }

    _startTitleVoice(fromGesture) {
        if (
            !this.titleVoice ||
            !this.titleVoiceCanAttempt ||
            !this.settings.soundEnabled ||
            this.titleVoicePlayedThisPage
        ) {
            return;
        }

        try {
            this._cancelAudioFade('titleVoice');
            this.titleVoice.pause();
            this.titleVoice.currentTime = 0;
            this.titleVoice.volume = 1;

            const playResult = this.titleVoice.play();
            if (playResult && typeof playResult.then === 'function') {
                playResult
                    .then(() => {
                        this.titleVoiceStarted = true;
                        this.titleVoicePlayedThisPage = true;
                        this.titleVoiceNeedsGesture = false;
                        this._duckTitleMusic();
                    })
                    .catch((error) => {
                        if (!fromGesture) {
                            this.titleVoiceNeedsGesture = true;
                            return;
                        }

                        console.warn('Zendoria title voice play failed:', error);
                        this.titleVoiceNeedsGesture = false;
                        this.titleVoiceCanAttempt = false;
                    });
            } else {
                this.titleVoiceStarted = true;
                this.titleVoicePlayedThisPage = true;
                this.titleVoiceNeedsGesture = false;
                this._duckTitleMusic();
            }
        } catch (error) {
            if (!fromGesture) {
                this.titleVoiceNeedsGesture = true;
            } else {
                console.warn('Zendoria title voice play failed:', error);
                this.titleVoiceCanAttempt = false;
            }
        }
    }

    _fadeOutTitleVoice() {
        const audio = this.titleVoice;
        if (!audio) return;

        this.titleVoiceStarted = false;
        this._unduckTitleMusic();

        if (audio.paused || audio.ended || audio.currentTime <= 0) {
            audio.pause();
            try { audio.currentTime = 0; } catch (_) { /* ignore */ }
            audio.volume = 1;
            return;
        }

        this._fadeAudio('titleVoice', audio, 0, 300, {
            pauseOnComplete: true,
            resetOnComplete: true,
            restoreVolume: 1,
        });
    }

    _startGameMusic() {
        const audio = this.gameMusic;
        if (!audio || !this.settings.soundEnabled) return;

        audio.muted = false;
        this._cancelAudioFade('gameMusic');

        if (!audio.paused && audio.currentTime > 0.05) {
            audio.volume = 0.48;
            return;
        }

        try {
            audio.volume = 0.48;
            const playResult = audio.play();
            if (playResult && typeof playResult.then === 'function') {
                playResult.catch((error) => {
                    console.warn('Zendoria game music play failed:', error);
                });
            }
        } catch (error) {
            console.warn('Zendoria game music play failed:', error);
        }
    }

    _startTitleMusic() {
        const audio = this.titleMusic;
        if (!audio || !this.settings.soundEnabled) return;

        const target = this.titleVoiceStarted ? this.titleMusicDuckedVolume : this.titleMusicFullVolume;

        this._cancelAudioFade('titleMusic');

        if (!audio.paused || this.titleMusicStarted) {
            this._fadeAudio('titleMusic', audio, target, 400, { restoreVolume: target });
            return;
        }

        try {
            audio.volume = 0;
            const playResult = audio.play();
            const ramp = () => {
                this.titleMusicStarted = true;
                this._fadeAudio('titleMusic', audio, target, 1200, { restoreVolume: target });
            };
            if (playResult && typeof playResult.then === 'function') {
                playResult.then(ramp).catch(() => {});
            } else {
                ramp();
            }
        } catch (error) {
            console.warn('Zendoria title music play failed:', error);
        }
    }

    _duckTitleMusic() {
        const audio = this.titleMusic;
        if (!audio || audio.paused) return;
        this._fadeAudio('titleMusic', audio, this.titleMusicDuckedVolume, 400, {
            restoreVolume: this.titleMusicDuckedVolume,
        });
    }

    _unduckTitleMusic() {
        const audio = this.titleMusic;
        if (!audio || audio.paused) return;
        if (this.started) return;
        this._fadeAudio('titleMusic', audio, this.titleMusicFullVolume, 600, {
            restoreVolume: this.titleMusicFullVolume,
        });
    }

    _fadeOutTitleMusic() {
        const audio = this.titleMusic;
        if (!audio) return;

        if (audio.paused) {
            audio.volume = 0;
            return;
        }

        this._fadeAudio('titleMusic', audio, 0, 500, {
            pauseOnComplete: true,
            resetOnComplete: true,
            restoreVolume: 0,
        });
        this.titleMusicStarted = false;
    }

    _fadeOutGameMusic() {
        const audio = this.gameMusic;
        if (!audio) return;

        if (audio.paused || audio.currentTime <= 0) {
            audio.pause();
            try { audio.currentTime = 0; } catch (_) { /* ignore */ }
            audio.volume = 0;
            return;
        }

        this._fadeAudio('gameMusic', audio, 0, 500, {
            pauseOnComplete: true,
            resetOnComplete: true,
            restoreVolume: 0,
        });
    }

    _startRealmMusic() {
        if (this.currentRealmId === 'frontier') {
            this._fadeOutGameMusic();
            this._startDesertMusic();
        } else {
            this._fadeOutDesertMusic();
            this._startGameMusic();
        }
    }

    _startDesertMusic() {
        const audio = this.desertMusic;
        if (!audio || !this.settings.soundEnabled) return;

        audio.muted = false;
        this._cancelAudioFade('desertMusic');

        if (!audio.paused && audio.currentTime > 0.05) {
            audio.volume = 0.48;
            return;
        }

        try {
            audio.volume = 0.48;
            const playResult = audio.play();
            if (playResult && typeof playResult.then === 'function') {
                playResult.catch((error) => {
                    console.warn('Zendoria desert music play failed:', error);
                });
            }
        } catch (error) {
            console.warn('Zendoria desert music play failed:', error);
        }
    }

    _fadeOutDesertMusic() {
        const audio = this.desertMusic;
        if (!audio) return;

        if (audio.paused || audio.currentTime <= 0) {
            audio.pause();
            try { audio.currentTime = 0; } catch (_) { /* ignore */ }
            audio.volume = 0;
            return;
        }

        this._fadeAudio('desertMusic', audio, 0, 500, {
            pauseOnComplete: true,
            resetOnComplete: true,
            restoreVolume: 0,
        });
    }

    _playDeathSound() {
        const audio = this.deathSound;
        if (!audio || !this.settings.soundEnabled) return;

        this._cancelAudioFade('deathSound');
        try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
            const playResult = audio.play();
            if (playResult && typeof playResult.then === 'function') {
                playResult.catch((error) => {
                    console.warn('Zendoria death sound play failed:', error);
                });
            }
        } catch (error) {
            console.warn('Zendoria death sound play failed:', error);
        }
    }

    _stopDeathSound() {
        const audio = this.deathSound;
        if (!audio) return;
        this._cancelAudioFade('deathSound');
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (_) { /* ignore */ }
    }

    _fadeAudio(key, audio, target, duration, options = {}) {
        this._cancelAudioFade(key);

        const startVolume = audio.volume;
        const startTime = performance.now();

        const finish = () => {
            audio.volume = target;
            if (options.pauseOnComplete) audio.pause();
            if (options.resetOnComplete) {
                try { audio.currentTime = 0; } catch (_) { /* ignore */ }
            }
            if (typeof options.restoreVolume === 'number') {
                audio.volume = options.restoreVolume;
            }
            this.audioFadeHandles[key] = 0;
        };

        if (duration <= 0 || Math.abs(startVolume - target) < 0.001) {
            finish();
            return;
        }

        const tick = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            audio.volume = startVolume + (target - startVolume) * t;

            if (t >= 1) {
                finish();
                return;
            }

            this.audioFadeHandles[key] = requestAnimationFrame(tick);
        };

        this.audioFadeHandles[key] = requestAnimationFrame(tick);
    }

    _cancelAudioFade(key) {
        if (this.audioFadeHandles[key]) {
            cancelAnimationFrame(this.audioFadeHandles[key]);
            this.audioFadeHandles[key] = 0;
        }
    }
}
