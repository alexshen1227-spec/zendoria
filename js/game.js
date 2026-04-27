import { NATIVE_WIDTH, NATIVE_HEIGHT, SCALE, TILE } from './constants.js?v=20260414-no-bridge-pass2';
import { Input } from './input.js?v=20260418-polish-pass2';
import { Player } from './player.js?v=20260427-tap-impulse';
import { Camera } from './camera.js?v=20260414-no-bridge-pass2';
import { World } from './world.js?v=20260427-spawn-and-tovin';
import { createEnemy, normalizeEnemyKind } from './enemy.js?v=20260418-polish-pass2';
import { Elara, Boatman, AmbientNpc } from './npc.js?v=20260425-sidequests';
import { Boat } from './boat.js?v=20260418-polish-pass2';
import { Tombstone } from './tombstone.js?v=20260414-tombstone-anim';
import { Portal } from './portal.js?v=20260414-desert-enemies';
import { TreasureChest } from './treasureChest.js?v=20260415-level-up-chest';
import { Pillar } from './pillar.js?v=20260416-pillars-boss';
import { LoreStone, BuffShrine, CrystalCluster } from './exploration.js?v=20260416-openworld';
import { AetherFont } from './aetherFont.js?v=20260418-aether-font';
import { Mnemoforge } from './mnemoforge.js?v=20260418-singularity';
import {
    MAX_PLAYER_LEVEL,
    SKILLS,
    SKILL_BY_ID,
    SKILL_COLUMNS,
    xpToNextLevel,
} from './player.js?v=20260418-singularity';

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
        this._setupAdminPanel();
        requestAnimationFrame((time) => this._loop(time));
    }

    _setupAdminPanel() {
        const panel = document.querySelector('[data-admin-panel]');
        if (!panel) return;
        // Gate admin behind ?dev=1 (or zendoria-dev-mode localStorage flag) so
        // itch.io / public players can't open the cheat panel with backtick.
        const params = new URLSearchParams(window.location.search);
        let devEnabled = params.get('dev') === '1';
        try { devEnabled = devEnabled || localStorage.getItem('zendoria-dev-mode') === 'true'; } catch (_) {}
        if (!devEnabled) {
            panel.classList.add('hidden');
            return;
        }
        this.adminPanel = panel;
        const closeBtn = panel.querySelector('[data-admin-close]');
        if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
        const buttons = panel.querySelectorAll('[data-admin-action]');
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-admin-action');
                this._runAdminAction(action);
            });
        });
        window.addEventListener('keydown', (event) => {
            if (event.code === 'Backquote') {
                event.preventDefault();
                panel.classList.toggle('hidden');
            }
        });
    }

    _runAdminAction(action) {
        if (!this.player) return;
        const cheats = {
            maxLevel: () => {
                const target = MAX_PLAYER_LEVEL;
                while (this.player.level < target) {
                    const need = this.player.xpToNext - this.player.xp;
                    this._awardXp(Math.max(1, need), this.player.cx, this.player.cy - 12);
                }
                this.toast = `LEVEL MAX (${target}) GRANTED`;
                this.toastTimer = 2.4;
            },
            addSkillPoints: () => {
                this.player.skillPoints += 10;
                this.toast = '+10 SKILL POINTS';
                this.toastTimer = 1.8;
            },
            grantRelic: () => {
                this.hasLevelUpAbility = true;
                this.goliathsUnlocked = true;
                if (this.player.skillPoints < 1) this.player.skillPoints = Math.max(this.player.skillPoints, 1);
                this.toast = 'SUNKEN RELIC GRANTED';
                this.toastTimer = 1.8;
            },
            grantMap: () => {
                this.hasMap = true;
                this.toast = 'WORLD MAP GRANTED · M TO OPEN';
                this.toastTimer = 1.8;
            },
            defeatSandworm: () => {
                this.bossDefeated.sandworm = true;
                if (this.sandwormBoss) {
                    this.sandwormBoss.health = 0;
                    this.sandwormBoss.state = 'dead';
                }
                this.toast = 'SANDWORM MARKED DEFEATED';
                this.toastTimer = 1.8;
            },
            grantBoat: () => {
                this.bossDefeated.sandworm = true;
                this._grantBoat();
            },
            healFull: () => {
                this.player.health = this.player.maxHealth;
                this.toast = 'FULL HEAL';
                this.toastTimer = 1.4;
            },
            killAllEnemies: () => {
                let n = 0;
                for (const e of this.enemies) {
                    if (e.isAlive && e.isAlive()) {
                        e.health = 0;
                        e.state = 'dead';
                        this._recordEnemySlain(e);
                        n++;
                    }
                }
                this.toast = `KILLED ${n} ENEMIES`;
                this.toastTimer = 1.6;
            },
            teleportBoatman: () => {
                if (!this.boatman) return;
                if (!this._placePlayerNear(this.boatman)) {
                    this.toast = 'NO ROOM NEAR BOATMAN';
                    this.toastTimer = 1.6;
                }
            },
            teleportBoat: () => {
                const target = this.boat || (this.world && this.world.boatSpawn ? { x: this.world.boatSpawn.x, y: this.world.boatSpawn.y, w: 28, h: 20 } : null);
                if (!target) return;
                if (!this._placePlayerNear(target)) {
                    this.toast = 'NO ROOM NEAR BOAT';
                    this.toastTimer = 1.6;
                }
            },
            teleportNextNpc: () => {
                if (!this.npcs || !this.npcs.length) return;
                const current = typeof this.adminNpcTeleportIndex === 'number' ? this.adminNpcTeleportIndex : -1;
                this.adminNpcTeleportIndex = (current + 1) % this.npcs.length;
                const target = this.npcs[this.adminNpcTeleportIndex];
                if (!this._placePlayerNear(target)) {
                    this.toast = `NO ROOM NEAR ${target.name.toUpperCase()}`;
                    this.toastTimer = 1.6;
                    return;
                }
                this.toast = `TELEPORTED TO ${target.name.toUpperCase()}`;
                this.toastTimer = 1.6;
            },
            grantAll: () => {
                this._runAdminAction('defeatSandworm');
                this._runAdminAction('grantRelic');
                this._runAdminAction('grantMap');
                this._runAdminAction('grantBoat');
                this._runAdminAction('addSkillPoints');
                this._runAdminAction('maxLevel');
                this._runAdminAction('healFull');
                this.toast = 'ALL CHEATS APPLIED';
                this.toastTimer = 2.4;
            },
        };
        const fn = cheats[action];
        if (fn) {
            fn();
            this._refreshEntityColliders();
        }
    }

    _setupGestureUnlock() {
        let unlocked = false;
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
            if (!unlocked) {
                unlocked = true;
                // First gesture has fired — unsubscribe so we don't re-trigger
                // title music/voice on every subsequent click or keypress.
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('pointerdown', unlock);
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
        try {
            this._loopInner(now);
        } catch (err) {
            // Surface the failure but keep the rAF chain alive so a single bad
            // frame doesn't black-screen the game.
            console.error('Zendoria: frame error', err);
            this._loopErrorCount = (this._loopErrorCount || 0) + 1;
            if (this._loopErrorCount > 30) {
                console.error('Zendoria: too many frame errors, halting loop.');
                return;
            }
            try { this.input?.endFrame(); } catch (_) { /* ignore */ }
            requestAnimationFrame((time) => this._loop(time));
        }
    }

    _loopInner(now) {
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

        // Esc is context-aware: it should close whatever overlay is currently
        // on top before opening the pause menu. Otherwise pressing Esc while
        // the world map is open stacks Settings on top of the map and
        // resuming leaves the map still open beneath -- confusing UX.
        if (!this.paused && this.input.wasPressed('Escape')) {
            if (this.worldMapOpen) {
                this._closeWorldMap();
                this.input.endFrame();
                this._render();
                requestAnimationFrame((time) => this._loop(time));
                return;
            }
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
        this.boatman = null;
        this.npcs = [];
        this.boat = null;
        this.ridingBoat = false;
        this.hasTalkedToBoatman = false;
        this.hasBoat = false;
        this.tombstone = null;
        this.treasureChest = null;
        this.pillars = [];
        this.loreStones = [];
        this.shrines = [];
        this.aetherFonts = [];
        this.mnemoforges = [];
        this.crystals = [];
        this.activeLoreReadout = null;
        this.sandwormBoss = null;
        this.bossState = 'none';
        this.bossTriggerTimer = 0;
        this.bossHpFlash = 0;
        this.groundShakeTimer = 0;
        this.bossVictoryTimer = 0;
        this.bossDefeated = { sandworm: false };
        this.gameTime = 0;
        this.screenShake = 0;

        // Ouroboros Tremor — ambient world-event. Every ~2–5 minutes the
        // World-Coil Wormp stirs, the ground shudders, and Boneglass shards
        // surface briefly for the player to harvest.
        // Cadence is intentionally loose so players never time it.
        this.ouroborosNextTremor = this._rollOuroborosInterval(90); // first one 1.5–2.5 min in
        this.ouroborosTremorTimer = 0;       // shake duration currently active
        this.ouroborosTremorMax = 1.8;        // seconds the full tremor lasts
        this.boneglassShards = [];            // [{x,y,life,maxLife,vy,phase}]

        this.objectiveTimer = 8;
        this.toast = '';
        this.toastTimer = 0;
        // Important toast: a separate, larger, center-screen banner used
        // for gating messages the player MUST notice (e.g. boatman blocked
        // by sandworm fight). Reserved for must-read prompts so the regular
        // toast slot stays useful for fast feedback.
        // Source: P0-5 from 2026-04-26 playtest meta-analysis.
        this.importantToast = '';
        this.importantToastTimer = 0;
        this.hasReachedCanyons = false;
        this.hasReachedSaltFlats = false;
        this.hasReachedTropics = false;
        this.enemyKillCounts = { total: 0, kinds: {}, biomes: {} };
        this.saveTimer = 0;

        this.hasMap = false;
        this.hasTalkedToElara = false;
        this.hasSeenEnemy = false;
        // Set true the first time the player opens the pause menu. Used
        // by the HUD to drop the redundant 'ESC MENU' reminder line once
        // the player has actually used Esc. Source: P1-6 from playtest meta.
        this.hasOpenedPauseMenu = false;
        this.dialog = null;
        this.rewardPopup = null;

        this.worldMapCache = null;
        this.worldMapOpen = false;
        this.worldMapMode = 'relative';
        this.deathState = null;

        this.xpPopups = [];
        this.particles = [];
        this.projectiles = [];
        this.swingFx = [];
        this.damageNumbers = [];
        this.lowHealthPulse = 0;
        this.hitStopTimer = 0;
        this.levelUpAnim = null;
        this.levelUpFlash = 0;
        this.levelUpRings = [];
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
        if (this.boatman) colliders.push(this.boatman.getCollider());
        for (const npc of (this.npcs || [])) colliders.push(npc.getCollider());
        if (this.boat && !this.ridingBoat) colliders.push(this.boat.getCollider());
        if (this.tombstone) colliders.push(this.tombstone.getCollider());
        if (this.treasureChest) colliders.push(this.treasureChest.getCollider());
        if (this.pillars) {
            for (const pillar of this.pillars) {
                const c = pillar.getCollider();
                if (c) colliders.push(c);
            }
        }
        for (const stone of this.loreStones) colliders.push(stone.getCollider());
        for (const shrine of this.shrines) colliders.push(shrine.getCollider());
        for (const font of (this.aetherFonts || [])) {
            const c = font.getCollider();
            if (c) colliders.push(c);
        }
        for (const altar of (this.mnemoforges || [])) {
            const c = altar.getCollider();
            if (c) colliders.push(c);
        }
        for (const crystal of this.crystals) {
            const c = crystal.getCollider();
            if (c) colliders.push(c);
        }
        if (this.portals) {
            for (const portal of this.portals) {
                if (portal.getCollider) colliders.push(portal.getCollider());
            }
        }
        this.world.setEntityColliders(colliders);
    }

    _createEnemies(savedEnemies = null) {
        if (!savedEnemies) {
            return this.world.fixedEnemySpawns
                .filter((spawn) => spawn.kind !== 'goliath' || this.goliathsUnlocked)
                .map((spawn) => this._spawnEnemy(spawn));
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

    _spawnDeferredGoliaths() {
        if (this.currentRealmId !== 'frontier') return;
        const goliathSpawns = this.world.fixedEnemySpawns.filter((s) => s.kind === 'goliath');
        for (const spawn of goliathSpawns) {
            const already = this.enemies.some((e) =>
                e.kind === 'goliath' &&
                Math.abs(e.x - spawn.x) < 32 &&
                Math.abs(e.y - spawn.y) < 32);
            if (already) continue;
            this.enemies.push(this._spawnEnemy(spawn));
        }
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

    _spawnAmbientNpc(definition, savedState = null) {
        const npc = new AmbientNpc(definition, this.assets, savedState);
        const collider = npc.getCollider();
        const resolved = this.world.findOpenEntityPosition(
            npc.x,
            npc.y,
            collider.x - npc.x,
            collider.y - npc.y,
            collider.w,
            collider.h,
            48,
            8,
        );
        npc.x = resolved.x;
        npc.y = resolved.y;
        return npc;
    }

    _allPillarsDestroyed() {
        return this.pillars.length > 0 && this.pillars.every((p) => p.destroyed);
    }

    _pillarsRemaining() {
        return this.pillars.filter((p) => !p.destroyed).length;
    }

    _updateBossState(dt) {
        // Ground shake during emerge.
        if (this.groundShakeTimer > 0) {
            this.groundShakeTimer = Math.max(0, this.groundShakeTimer - dt);
            const intensity = Math.min(1.8, this.groundShakeTimer * 0.9);
            this.screenShake = Math.max(this.screenShake, intensity);
        }

        if (this.bossState === 'none'
            && this.currentRealmId === 'frontier'
            && this.hasLevelUpAbility
            && this._allPillarsDestroyed()
        ) {
            this.bossState = 'preparing';
            this.bossTriggerTimer = 3.2;
            this.groundShakeTimer = 3.2;
            this.toast = 'THE GROUND SHAKES BENEATH YOUR FEET';
            this.toastTimer = 3.4;
            this._playBeep(120, 0.6, 'sine', 0.25);
            this._playBeep(80, 0.9, 'sine', 0.2);
        }

        if (this.bossState === 'preparing') {
            this.bossTriggerTimer = Math.max(0, this.bossTriggerTimer - dt);
            if (this.bossTriggerTimer === 0) {
                this._spawnSandwormBoss();
                this.bossState = 'fighting';
                this.toast = 'DEFEAT THE SAND WORM';
                this.toastTimer = 2.4;
                this.screenShake = Math.max(this.screenShake, 1.4);
                this._playBeep(180, 0.7, 'sawtooth', 0.24);
                this._playBeep(90, 1.0, 'sine', 0.2);
            }
        }

        if (this.bossState === 'fighting' && this.sandwormBoss) {
            if (this.bossHpFlash > 0) this.bossHpFlash = Math.max(0, this.bossHpFlash - dt);
            if (this.sandwormBoss.state === 'dead' || !this.sandwormBoss.isAlive()) {
                this.bossState = 'defeated';
                this.bossVictoryTimer = 4.0;
                this.toast = 'THE SAND WORM FALLS — AMBER CAPSTONES UNLOCKED';
                this.toastTimer = 3.8;
                this.screenShake = Math.max(this.screenShake, 1.0);
                this._playBeep(960, 0.2, 'triangle', 0.22);
                this._playBeep(1280, 0.3, 'sine', 0.16);
                this.bossDefeated.sandworm = true;
                this._recordEnemySlain(this.sandwormBoss);
                // Big XP payout on kill.
                if (this.hasLevelUpAbility && this.sandwormBoss) {
                    this._awardXp(400, this.sandwormBoss.cx, this.sandwormBoss.cy - 10);
                }
                // Re-read ability rows so locked skills become spendable.
                this._syncAbilityLockedRows?.();
            }
        }

        if (this.bossState === 'defeated') {
            this.bossVictoryTimer = Math.max(0, this.bossVictoryTimer - dt);
        }
    }

    _spawnSandwormBoss() {
        // Prefer the designated spawn point if the world defines one, otherwise
        // emerge near the player so the fight starts immediately.
        const targetX = (this.world.sandwormSpawn?.x ?? this.player.cx);
        const targetY = (this.world.sandwormSpawn?.y ?? this.player.cy) + 4;
        const spawn = this._spawnEnemy({
            kind: 'sandworm',
            x: targetX - 60,
            y: targetY - 30,
        });
        // Clear any lingering trash mobs so the arena is a one-on-one fight.
        for (const enemy of this.enemies) {
            if (enemy === spawn || !enemy.isAlive()) continue;
            this._spawnParticles(enemy.cx, enemy.cy, {
                count: 6,
                spread: Math.PI * 2,
                minSpeed: 20,
                maxSpeed: 80,
                friction: 0.9,
                gravity: 0,
                life: 0.4,
                colors: ['#ffe0a2', '#c89460', '#ffffff'],
                size: 2,
            });
        }
        this.enemies = this.enemies.filter((e) => !e.isAlive() ? false : e === spawn || e.kind === 'sandworm');
        if (!this.enemies.includes(spawn)) this.enemies.push(spawn);
        this.sandwormBoss = spawn;

        // Shove the player out to a safe minimum radius so they aren't stood on.
        const minDist = 64;
        const pdx = this.player.cx - spawn.cx;
        const pdy = this.player.cy - spawn.cy;
        const dist = Math.hypot(pdx, pdy);
        if (dist < minDist) {
            const nx = dist > 0.01 ? pdx / dist : -1;
            const ny = dist > 0.01 ? pdy / dist : 0;
            this.player.x = spawn.cx + nx * minDist - this.player.w / 2;
            this.player.y = spawn.cy + ny * minDist - this.player.h / 2;
            this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.9);
        }
        this._refreshEntityColliders();

        // Big emerge burst of sand particles.
        this._spawnParticles(spawn.cx, spawn.cy + 10, {
            count: 36,
            spread: Math.PI * 2,
            minSpeed: 40,
            maxSpeed: 180,
            friction: 0.88,
            gravity: 80,
            life: 0.9,
            colors: ['#e4c078', '#c89460', '#ffe0a2', '#a77042'],
            size: 2,
        });
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

    _normalizeEnemyKillCounts(source = null) {
        const cleanBucket = (bucket) => {
            const next = {};
            if (!bucket || typeof bucket !== 'object') return next;
            for (const [key, value] of Object.entries(bucket)) {
                const count = Math.max(0, Math.floor(Number(value) || 0));
                if (count > 0) next[key] = count;
            }
            return next;
        };
        return {
            total: Math.max(0, Math.floor(Number(source?.total) || 0)),
            kinds: cleanBucket(source?.kinds),
            biomes: cleanBucket(source?.biomes),
        };
    }

    _recordEnemySlain(enemy) {
        if (!enemy || enemy._questKillRecorded) return;
        enemy._questKillRecorded = true;
        if (!this.enemyKillCounts) this.enemyKillCounts = { total: 0, kinds: {}, biomes: {} };
        const kind = normalizeEnemyKind(enemy.kind || 'unknown');
        this.enemyKillCounts.total = (this.enemyKillCounts.total || 0) + 1;
        this.enemyKillCounts.kinds[kind] = (this.enemyKillCounts.kinds[kind] || 0) + 1;
        if (this.world && Number.isFinite(enemy.cx) && Number.isFinite(enemy.cy)) {
            const biome = this.world.getBiomeKeyAt(Math.floor(enemy.cx / TILE), Math.floor(enemy.cy / TILE));
            this.enemyKillCounts.biomes[biome] = (this.enemyKillCounts.biomes[biome] || 0) + 1;
        }
        this.player?.onEnemySlain?.();
    }

    _storeCurrentRealmState() {
        if (!this.currentRealmId) return;

        this.realmStates[this.currentRealmId] = {
            enemies: this._serializeEnemies(),
            enemySpawnNodes: this._serializeSpawnNodes(),
            pillars: (this.pillars || []).map((p) => p.stage),
            loreRead: (this.loreStones || []).map((s) => s.read),
            npcStates: Object.fromEntries((this.npcs || []).map((npc) => [npc.id, npc.serializeState()])),
            crystalsDestroyed: (this.crystals || []).map((c) => c.destroyed),
            shrineCooldowns: (this.shrines || []).map((s) => s.cooldown),
            aetherFontCooldowns: (this.aetherFonts || []).map((f) => f.cooldown),
            mnemoforgeUsed: (this.mnemoforges || []).map((m) => m.used),
            boat: this.boat ? { x: this.boat.x, y: this.boat.y, ridden: !!(this.ridingBoat || this.boat.ridden) } : null,
            fogMaskPacked: this._encodeFogMask(),
        };
    }

    _savedNpcStateFor(savedStates, definition, index) {
        if (!savedStates || !definition) return null;
        if (!Array.isArray(savedStates) && typeof savedStates === 'object') {
            return savedStates[definition.id] || null;
        }
        const legacy = Array.isArray(savedStates) ? savedStates[index] : null;
        if (!legacy || (legacy.id && legacy.id !== definition.id)) return null;
        return legacy;
    }

    // --- Fog-of-War bitpack helpers (Loop Item #17) -------------------------
    // We keep the mask as a flat Uint8Array (1 byte per tile, 0=unseen, 1=seen)
    // in memory for cheap gradient rendering. For save we bit-pack 8 tiles per
    // byte and base64-encode so the per-realm payload is ~bits/8 bytes.
    _encodeFogMask() {
        const mask = this.fogMask;
        if (!mask || !mask.length) return null;
        const byteLen = Math.ceil(mask.length / 8);
        const packed = new Uint8Array(byteLen);
        for (let i = 0; i < mask.length; i++) {
            if (mask[i]) packed[i >> 3] |= (1 << (i & 7));
        }
        let bin = '';
        for (let i = 0; i < packed.length; i++) bin += String.fromCharCode(packed[i]);
        try { return btoa(bin); } catch (e) { return null; }
    }

    _decodeFogMask(base64, expectedLen) {
        if (!base64 || !expectedLen) return null;
        let bin;
        try { bin = atob(base64); } catch (e) { return null; }
        const mask = new Uint8Array(expectedLen);
        for (let i = 0; i < expectedLen; i++) {
            const byte = bin.charCodeAt(i >> 3) || 0;
            mask[i] = (byte & (1 << (i & 7))) ? 1 : 0;
        }
        return mask;
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

        let arrival = playerOverride || this.world.getArrivalPoint(arrivalKey);
        if (!arrival || typeof arrival.x !== 'number' || typeof arrival.y !== 'number'
            || !Number.isFinite(arrival.x) || !Number.isFinite(arrival.y)) {
            // Bad arrival point — fall back to the realm's player spawn or origin.
            arrival = this.world.playerSpawn || { x: 64, y: 64 };
            console.warn('Zendoria: bad arrival point; falling back to player spawn');
        }
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
        this.boatman = this.world.boatmanSpawn
            ? new Boatman(this.world.boatmanSpawn.x, this.world.boatmanSpawn.y, this.assets)
            : null;
        const savedBoat = forceFresh ? null : this.realmStates[this.currentRealmId]?.boat;
        if (this.hasBoat && this.world.boatSpawn) {
            const bx = savedBoat?.x ?? this.world.boatSpawn.x;
            const by = savedBoat?.y ?? this.world.boatSpawn.y;
            this.boat = new Boat(bx, by, this.assets);
            this.boat.ridden = !!savedBoat?.ridden;
        } else {
            this.boat = null;
        }
        this.ridingBoat = !!this.boat && this.boat.ridden;
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
        const savedPillars = savedRealmState?.pillars;
        const savedNpcStates = savedRealmState?.npcStates;

        this.pillars = (this.world.pillarSpawns || []).map((def, index) => {
            const savedStage = Array.isArray(savedPillars) ? (savedPillars[index] || 0) : 0;
            return new Pillar(def, this.assets.pillarSheet, savedStage);
        });

        const savedLoreRead = savedRealmState?.loreRead;
        const savedCrystalsDestroyed = savedRealmState?.crystalsDestroyed;
        const savedShrineCooldowns = savedRealmState?.shrineCooldowns;
        const savedAetherFontCooldowns = savedRealmState?.aetherFontCooldowns;
        const savedMnemoforgeUsed = savedRealmState?.mnemoforgeUsed;
        this.loreStones = (this.world.loreStoneSpawns || []).map((def, index) => {
            const stone = new LoreStone(def);
            if (Array.isArray(savedLoreRead) && savedLoreRead[index]) stone.setRead(true);
            return stone;
        });
        this.shrines = (this.world.shrineSpawns || []).map((def, index) => {
            const shrine = new BuffShrine(def);
            const saved = Array.isArray(savedShrineCooldowns) ? savedShrineCooldowns[index] : 0;
            if (saved > 0) shrine.cooldown = saved;
            return shrine;
        });
        this.aetherFonts = (this.world.aetherFontSpawns || []).map((def, index) => {
            const font = new AetherFont(def);
            const saved = Array.isArray(savedAetherFontCooldowns) ? savedAetherFontCooldowns[index] : 0;
            if (saved > 0) font.cooldown = saved;
            return font;
        });
        this.mnemoforges = (this.world.mnemoforgeSpawns || []).map((def, index) => {
            const altar = new Mnemoforge(def);
            if (Array.isArray(savedMnemoforgeUsed) && savedMnemoforgeUsed[index]) altar.used = true;
            return altar;
        });
        this.crystals = (this.world.crystalSpawns || []).map((def, index) => {
            const wasDestroyed = Array.isArray(savedCrystalsDestroyed) ? savedCrystalsDestroyed[index] : false;
            return new CrystalCluster(def, wasDestroyed);
        });
        const stagingColliders = [];
        if (this.elara) stagingColliders.push(this.elara.getCollider());
        if (this.boatman) stagingColliders.push(this.boatman.getCollider());
        if (this.boat && !this.ridingBoat) stagingColliders.push(this.boat.getCollider());
        if (this.tombstone) stagingColliders.push(this.tombstone.getCollider());
        if (this.treasureChest) stagingColliders.push(this.treasureChest.getCollider());
        for (const pillar of this.pillars) {
            const c = pillar.getCollider();
            if (c) stagingColliders.push(c);
        }
        for (const stone of this.loreStones) stagingColliders.push(stone.getCollider());
        for (const shrine of this.shrines) stagingColliders.push(shrine.getCollider());
        for (const font of (this.aetherFonts || [])) {
            const c = font.getCollider();
            if (c) stagingColliders.push(c);
        }
        for (const altar of (this.mnemoforges || [])) {
            const c = altar.getCollider();
            if (c) stagingColliders.push(c);
        }
        for (const crystal of this.crystals) {
            const c = crystal.getCollider();
            if (c) stagingColliders.push(c);
        }
        for (const portal of (this.portals || [])) {
            if (portal.getCollider) stagingColliders.push(portal.getCollider());
        }
        this.world.setEntityColliders(stagingColliders);
        this.npcs = (this.world.npcSpawns || []).map((definition, index) => {
            const saved = this._savedNpcStateFor(savedNpcStates, definition, index);
            const npc = this._spawnAmbientNpc(definition, saved);
            stagingColliders.push(npc.getCollider());
            this.world.setEntityColliders(stagingColliders);
            return npc;
        });
        this.activeLoreReadout = null;
        // Boneglass shards are realm-local and ephemeral — drop any leftovers on realm swap.
        this.boneglassShards = [];
        this.ouroborosTremorTimer = 0;
        // Fog-of-War: restore the explored mask for this realm, or start blank.
        const tileCount = this.world.cols * this.world.rows;
        const restoredMask = forceFresh ? null : this._decodeFogMask(savedRealmState?.fogMaskPacked, tileCount);
        this.fogMask = restoredMask || new Uint8Array(tileCount);
        this.fogReveal = new Float32Array(tileCount); // ephemeral pulse on newly-seen tiles
        // Reset interpolation anchor — prevents a reveal-streak from the old realm's
        // last player position on the first frame in the new realm.
        this._fogLastX = null;
        this._fogLastY = null;

        this.enemies = this._createEnemies(savedEnemies ?? null);
        if (Array.isArray(savedSpawnNodes) && savedSpawnNodes.length === this.world.enemySpawnNodes.length) {
            this.enemySpawnNodes = savedSpawnNodes.map((node) => ({ ...node }));
        } else {
            this.enemySpawnNodes = this._createSpawnNodesState();
        }

        // Re-attach the live boss reference if the realm snapshot had one.
        this.sandwormBoss = this.enemies.find((e) => e.kind === 'sandworm') || null;
        if (!this.sandwormBoss && this.bossState === 'fighting' && this.currentRealmId === 'frontier') {
            // Boss was mid-fight but the worm didn't persist — re-spawn it so the
            // player can't cheese the fight by hopping realms.
            this._spawnSandwormBoss();
        }

        this._refreshEntityColliders();
        // If the spawn we computed lands inside terrain or a collider (e.g. on top
        // of a freshly-spawned NPC), spiral outward until we find a free tile.
        if (!this._isPlayerSpotClear(this.player.x, this.player.y, this.ridingBoat)) {
            const safe = { x: this.player.x, y: this.player.y };
            let placed = false;
            for (let r = 1; r <= 12 && !placed; r++) {
                for (let dy = -r; dy <= r && !placed; dy++) {
                    for (let dx = -r; dx <= r && !placed; dx++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const nx = safe.x + dx * 8;
                        const ny = safe.y + dy * 8;
                        if (this._isPlayerSpotClear(nx, ny, this.ridingBoat)) {
                            this.player.x = nx;
                            this.player.y = ny;
                            placed = true;
                        }
                    }
                }
            }
        }
        this.camera.snap(this.player, this.world.pixelW, this.world.pixelH);
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
        this.goliathsUnlocked = false;
        this.goliathUnlockTimer = 0;
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
        // Latch the first-pause flag so the HUD drops the 'ESC MENU' reminder
        // on subsequent play. Persists across save/load. Source: P1-6.
        if (!this.hasOpenedPauseMenu) {
            this.hasOpenedPauseMenu = true;
        }
        if (this.pauseOverlay) this.pauseOverlay.classList.remove('hidden');
        // Drop any inputs in flight so the player doesn't keep walking after pausing.
        if (this.input && typeof this.input.clearAll === 'function') this.input.clearAll();
        this._syncPauseMenu();
    }

    _closePauseMenu() {
        this.paused = false;
        this.controlsOpen = false;
        if (this.controlsPanel) this.controlsPanel.classList.add('hidden');
        if (this.pauseSettingsPanel) this.pauseSettingsPanel.classList.remove('hidden');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        // Same idea: don't fire actions queued during the pause-menu interactions.
        if (this.input && typeof this.input.clearAll === 'function') this.input.clearAll();
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

        // Toggle rows (Sound, Hints) respond to arrow keys only. Drill-in rows
        // (Controls) and action rows (Resume, Return To Title) respond to
        // Enter/Space. Previously Enter also toggled Sound/Hints, which caused
        // Default Sim to accidentally turn them off while navigating down to
        // Controls. Source: P1-3 from 2026-04-26 playtest meta-analysis.
        if (selected === 'sound' || selected === 'hints') {
            if (
                this.input.wasPressed('ArrowLeft') ||
                this.input.wasPressed('ArrowRight') ||
                this.input.wasPressed('KeyA') ||
                this.input.wasPressed('KeyD')
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
        this.hasTalkedToBoatman = !!save.hasTalkedToBoatman;
        this.enemyKillCounts = this._normalizeEnemyKillCounts(save.enemyKillCounts);
        this.hasSeenEnemy = !!save.hasSeenEnemy;
        this.hasOpenedPauseMenu = !!save.hasOpenedPauseMenu;
        this.hasMap = !!save.hasMap;
        // hasBoat MUST be restored BEFORE _loadRealm runs — _loadRealm only
        // constructs the Boat entity when hasBoat is true.
        this.hasBoat = !!save.hasBoat;
        this.hasLevelUpAbility = !!save.hasLevelUpAbility;
        // bossDefeated drives skill-tree gating and the Boatman dialog branch.
        // Losing it means a post-sandworm save reloads into pre-sandworm state.
        this.bossDefeated = (save.bossDefeated && typeof save.bossDefeated === 'object')
            ? { sandworm: !!save.bossDefeated.sandworm }
            : { sandworm: false };
        // If the player had the boat, they must have beaten the worm at some
        // point — fold that implication in for saves made before this fix landed.
        if (this.hasBoat) this.bossDefeated.sandworm = true;
        this.goliathsUnlocked = this.hasLevelUpAbility;
        this.goliathUnlockTimer = 0;
        this.realmStates = {};
        if (save.realmStates && typeof save.realmStates === 'object') {
            const driftmereState = save.realmStates.driftmere;
            const frontierState = save.realmStates.frontier || save.realmStates.index;
            if (driftmereState) {
                this.realmStates.driftmere = {
                    ...driftmereState,
                    enemies: Array.isArray(driftmereState.enemies) ? driftmereState.enemies : [],
                    enemySpawnNodes: Array.isArray(driftmereState.enemySpawnNodes) ? driftmereState.enemySpawnNodes : [],
                    npcStates: (driftmereState.npcStates && typeof driftmereState.npcStates === 'object') ? driftmereState.npcStates : {},
                };
            }
            if (frontierState) {
                this.realmStates.frontier = {
                    ...frontierState,
                    enemies: Array.isArray(frontierState.enemies) ? frontierState.enemies : [],
                    enemySpawnNodes: Array.isArray(frontierState.enemySpawnNodes) ? frontierState.enemySpawnNodes : [],
                    npcStates: (frontierState.npcStates && typeof frontierState.npcStates === 'object') ? frontierState.npcStates : {},
                };
            }
        }
        if (!this.realmStates[this.currentRealmId] && Array.isArray(save.enemies)) {
            this.realmStates[this.currentRealmId] = {
                enemies: save.enemies,
                enemySpawnNodes: [],
                npcStates: [],
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
        this.importantToast = '';
        this.importantToastTimer = 0;
        this.objectiveTimer = 0;

        this.camera.snap(this.player, this.world.pixelW, this.world.pixelH);
    }

    _update(dt) {
        if (this.elara) this.elara.update(dt);
        if (this.boatman) this.boatman.update(dt);
        for (const npc of (this.npcs || [])) npc.update(dt);
        if (this.boat) this.boat.update(dt);
        for (const portal of this.portals) portal.update(dt);
        if (this.treasureChest) this.treasureChest.update(dt);
        for (const pillar of this.pillars) pillar.update(dt);
        for (const stone of this.loreStones) stone.update(dt);
        for (const shrine of this.shrines) shrine.update(dt);
        for (const font of (this.aetherFonts || [])) font.update(dt);
        for (const altar of (this.mnemoforges || [])) altar.update(dt);
        this._updateOuroborosTremor(dt);
        for (const crystal of this.crystals) crystal.update(dt);

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
            this.importantToastTimer = Math.max(0, this.importantToastTimer - dt);
            return;
        }

        this.player.healingBlocked = this.bossState === 'preparing' || this.bossState === 'fighting';
        this.player.collisionMode = this.ridingBoat ? 'boat' : 'walker';
        this.player.update(dt, this.input, this.world);
        this._updateFogOfWar(dt);
        if (this.ridingBoat && this.boat) {
            this.boat.x = this.player.x + 2;
            this.boat.y = this.player.y + 21;
        }
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
            const playerHpBefore = this.player.health;
            enemy.update(dt, this.player, this.world);
            const damageTaken = playerHpBefore - this.player.health;
            if (damageTaken > 0) {
                this._spawnDamageNumber(this.player.cx, this.player.y - 2, damageTaken, { variant: 'player' });
            }
            // Harvest archer arrows
            if (typeof enemy.consumeProjectile === 'function') {
                const proj = enemy.consumeProjectile();
                if (proj) this._spawnEnemyProjectile(proj);
            }
            // Harvest goliath swing FX
            if (typeof enemy.consumeSwingFx === 'function') {
                const fx = enemy.consumeSwingFx();
                if (fx) {
                    this.swingFx.push(fx);
                    this.screenShake = Math.max(this.screenShake, 0.5);
                    this._spawnParticles(fx.x, fx.y, {
                        count: 14,
                        spread: Math.PI * 2,
                        minSpeed: 60,
                        maxSpeed: 150,
                        friction: 0.85,
                        gravity: 40,
                        life: 0.4,
                        colors: ['#caa78a', '#8a6a4a', '#ffe4a8', '#704528'],
                        size: 2,
                    });
                }
            }
        }

        this.enemies = this.enemies.filter((enemy) => enemy.state !== 'dead');
        this._updateEnemySpawners(dt);
        this._updateProjectiles(dt);
        this._updateSwingFx(dt);
        this._resolveCombat();
        this._updateObjectiveState(dt);
        this._updateNpcInteraction();
        this._updateHudInput();
        this._updateParticles(dt);
        this._updateDamageNumbers(dt);

        if (this.goliathUnlockTimer > 0) {
            this.goliathUnlockTimer = Math.max(0, this.goliathUnlockTimer - dt);
            if (this.goliathUnlockTimer === 0 && !this.goliathsUnlocked) {
                this.goliathsUnlocked = true;
                this._spawnDeferredGoliaths();
            }
        }

        this._updateBossState(dt);

        // Low-health pulse: fades in below 30% HP, pulses with sine, fades out above.
        const hpFrac = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 1;
        if (this.player.health > 0 && hpFrac <= 0.3) {
            const target = 0.5 + 0.5 * Math.sin(this.gameTime * 5.5);
            const severity = 1 - hpFrac / 0.3;
            this.lowHealthPulse += ((0.35 + 0.65 * target) * (0.5 + severity * 0.5) - this.lowHealthPulse) * Math.min(1, dt * 6);
        } else {
            this.lowHealthPulse = Math.max(0, this.lowHealthPulse - dt * 2.5);
        }

        this.camera.follow(this.player, this.world.pixelW, this.world.pixelH, dt);

        if (this.player.health <= 0 && !this.deathState) {
            this._triggerDeath();
            return;
        }

        this.screenShake = Math.max(0, this.screenShake - dt * 8);
        this.toastTimer = Math.max(0, this.toastTimer - dt);
        this.importantToastTimer = Math.max(0, this.importantToastTimer - dt);
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

    _playerNearBoatman() {
        if (!this.boatman) return false;
        return rectsOverlap(this.player.getHitbox(), this.boatman.getInteractRect());
    }

    _getNearbyNpc() {
        if (!this.player || !this.npcs || !this.npcs.length) return null;
        const hitbox = this.player.getHitbox();
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const npc of this.npcs) {
            if (!rectsOverlap(hitbox, npc.getInteractRect())) continue;
            const dx = npc.cx - this.player.cx;
            const dy = npc.cy - this.player.cy;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                best = npc;
                bestDist = dist;
            }
        }
        return best;
    }

    _getReadyQuestNpc() {
        if (!this.npcs || !this.npcs.length) return null;
        return this.npcs.find((npc) => this._npcQuestState(npc) === 'ready') || null;
    }

    _getTrackedSideQuestNpc() {
        const ready = this._getReadyQuestNpc();
        if (ready) return ready;
        if (!this.npcs || !this.npcs.length) return null;
        return this.npcs.find((npc) => this._npcQuestState(npc) === 'active' && npc.visits > 0) || null;
    }

    _npcInteractLabel(npc) {
        const questState = this._npcQuestState(npc);
        if (questState === 'ready') return `E: TURN IN TO ${npc.promptLabel}`;
        if (questState === 'active' && npc.visits > 0) {
            const progress = this._npcQuestProgress(npc.effect || {});
            return `E: ${npc.promptLabel} ${progress.text}`;
        }
        return `E: TALK TO ${npc.promptLabel}`;
    }

    _playerNearBoat() {
        if (!this.boat || this.ridingBoat) return false;
        return rectsOverlap(this.player.getHitbox(), this.boat.getInteractRect());
    }

    _tryToggleBoat() {
        if (this.ridingBoat) {
            return this._tryDismountBoat();
        }
        if (this._playerNearBoat()) {
            this._mountBoat();
            return true;
        }
        return false;
    }

    _mountBoat() {
        if (!this.boat) return;
        this.ridingBoat = true;
        this.boat.ridden = true;
        this.player.x = this.boat.x - 2;
        this.player.y = this.boat.y - 21;
        this.toast = 'BOARDED THE ROWBOAT · E TO DISMOUNT';
        this.toastTimer = 2.2;
        this._playBeep(620, 0.08, 'triangle', 0.12);
        this._refreshEntityColliders();
    }

    _tryDismountBoat() {
        if (!this.boat || !this.ridingBoat) return false;
        // Search outward in a spiral for a clear walker-collision tile that is land (tile > 1).
        // IMPORTANT: only accept a landing spot from which the player could re-board —
        // i.e. their hitbox at that spot still overlaps the boat's interact rect.
        // Otherwise the player can step ashore too far out and get stranded on land.
        const TILE_PX = 16;
        const cx = this.boat.x + this.boat.w / 2;
        const cy = this.boat.y + this.boat.h / 2;
        const baseCol = Math.floor(cx / TILE_PX);
        const baseRow = Math.floor(cy / TILE_PX);
        const boardRect = this.boat.getInteractRect();
        const hb = this.player.hitbox;
        for (let radius = 1; radius <= 3; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                    const col = baseCol + dc;
                    const row = baseRow + dr;
                    const tile = this.world.tileAt(col, row);
                    if (tile <= 1) continue; // skip water
                    const px = col * TILE_PX - hb.ox; // center hitbox on tile
                    const py = row * TILE_PX - hb.oy + 3;
                    // Re-board reachability check: the landed hitbox must still
                    // intersect the boat's interact rect so the player isn't stranded.
                    const landedHitbox = {
                        x: px + hb.ox,
                        y: py + hb.oy,
                        w: hb.w,
                        h: hb.h,
                    };
                    if (!rectsOverlap(landedHitbox, boardRect)) continue;
                    if (this._isPlayerSpotClear(px, py, true)) {
                        this.player.x = px;
                        this.player.y = py;
                        this.player.collisionMode = 'walker';
                        this.ridingBoat = false;
                        this.boat.ridden = false;
                        this.toast = 'STEPPED ASHORE';
                        this.toastTimer = 1.6;
                        this._playBeep(520, 0.08, 'triangle', 0.12);
                        this._refreshEntityColliders();
                        return true;
                    }
                }
            }
        }
        this.toast = 'PADDLE CLOSER TO SHORE';
        this.toastTimer = 1.4;
        this._playBeep(280, 0.08, 'square', 0.1);
        return false;
    }

    // Test whether the player's hitbox at (px, py) overlaps any collider/solid tile.
    // When ignoreBoat is true, the boat's collider is excluded (used during dismount).
    _isPlayerSpotClear(px, py, ignoreBoat = false) {
        const ox = 11, oy = 26, w = 10, h = 10;
        const hx = px + ox;
        const hy = py + oy;
        if (this.world.collides(hx, hy, w, h, 'walker')) {
            // collides() checks both tiles AND entity colliders. If ignoreBoat, recheck excluding boat.
            if (!ignoreBoat) return false;
        } else {
            return true;
        }
        // Re-check tiles only.
        const c0 = Math.floor(hx / 16);
        const r0 = Math.floor(hy / 16);
        const c1 = Math.floor((hx + w - 1) / 16);
        const r1 = Math.floor((hy + h - 1) / 16);
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const t = this.world.tileAt(c, r);
                if (t === 0 || t === 1 || t === 6 || t === 7 || t === 8) return false;
            }
        }
        // Check entity colliders, optionally skipping the boat.
        const rect = { x: hx, y: hy, w, h };
        for (const ec of this.world.entityColliders) {
            if (ignoreBoat && this.boat && ec.x === Math.round(this.boat.x + 4) && ec.y === Math.round(this.boat.y + this.boat.h - 6)) continue;
            if (rect.x < ec.x + ec.w && rect.x + rect.w > ec.x && rect.y < ec.y + ec.h && rect.y + rect.h > ec.y) return false;
        }
        for (const pc of this.world.propColliders) {
            if (rect.x < pc.x + pc.w && rect.x + rect.w > pc.x && rect.y < pc.y + pc.h && rect.y + rect.h > pc.y) return false;
        }
        return true;
    }

    // Safely place the player near a target (entity with x,y[,w,h]) by spiraling outward
    // until a hitbox-clear spot is found. Used by admin teleports and dismount fallback.
    _placePlayerNear(target, preferOffsets = null) {
        if (!target) return false;
        const TILE_PX = 16;
        const cx = (target.cx !== undefined) ? target.cx : (target.x + (target.w || 16) / 2);
        const cy = (target.cy !== undefined) ? target.cy : (target.y + (target.h || 16) / 2);
        const tries = preferOffsets || [];
        // Default ring of nearby offsets — try very-close placements first so
        // the teleport drops the player inside the target's interact rect.
        if (!tries.length) {
            for (let radius = 8; radius <= 96; radius += 8) {
                tries.push({ dx: 0, dy: radius });   // south
                tries.push({ dx: -radius, dy: 0 });  // west
                tries.push({ dx: radius, dy: 0 });   // east
                tries.push({ dx: 0, dy: -radius });  // north
                tries.push({ dx: -radius, dy: radius });
                tries.push({ dx: radius, dy: radius });
                tries.push({ dx: -radius, dy: -radius });
                tries.push({ dx: radius, dy: -radius });
            }
        }
        for (const off of tries) {
            const px = Math.round(cx + off.dx - 16); // player width 32 → -16
            const py = Math.round(cy + off.dy - 32); // player height 40, hitbox at oy=26 → roughly center
            if (this._isPlayerSpotClear(px, py)) {
                this.player.x = px;
                this.player.y = py;
                return true;
            }
        }
        return false;
    }

    _openBoatmanDialog() {
        // The original boatman_dialogue_*.png panels had the text BAKED into
        // the artwork in a rounded lowercase font that didn't match every
        // other NPC's pixel uppercase font. Switching to runtime-rendered
        // pages preserves the same dialogue text but renders it via the
        // shared pixel font, fixing the typography inconsistency.
        // Source: P1-1 from 2026-04-26 playtest meta-analysis.
        const portrait = this.assets.boatmanSprite || this.assets.boatmanIdleFrames?.[0] || null;
        const accent = '#ffd58a';
        const lines = [
            "EY THERE. YOU LOOK LIKE YOU'VE GOT PLACES TO BE AND A WHOLE LOT OF WATER IN YOUR WAY.",
            "TELL YOU WHAT. I'VE GOT THIS TRUSTY WOODEN ROWBOAT JUST SITTING HERE COLLECTING MOSS. HOW ABOUT I 'LEND' IT TO YOU? PERMANENTLY.",
            "DON'T ASK WHERE I GOT IT, AND I WON'T ASK WHERE YOU'RE ROWING IT. DEAL?",
        ];
        const pages = lines.flatMap((body) => (
            this._paginateNpcDialogBody(body).map((pageBody) => ({
                speaker: 'BOATMAN',
                title: 'FERRY KEEPER',
                body: pageBody,
                accent,
                portrait,
            }))
        ));
        this.dialog = {
            kind: 'boatman',
            pages,
            index: 0,
            soundTimer: DIALOG_SOUND_DURATION,
            grantMapAfter: -1,
        };
        // Drop the keypress that opened the dialog so it doesn't immediately
        // advance to the next page on the same frame.
        if (this.input) this.input.pressed = {};
        this._playBeep(600, 0.08, 'triangle', 0.12);
        this._startTextSound();
    }

    _grantBoat() {
        if (this.hasBoat) return;
        this.hasBoat = true;
        this.hasTalkedToBoatman = true;
        if (this.world && this.world.boatSpawn) {
            this.boat = new Boat(this.world.boatSpawn.x, this.world.boatSpawn.y, this.assets);
            this.boat.ridden = false;
            this._refreshEntityColliders();
        }
        this.toast = 'ROWBOAT UNLOCKED · E BY THE BOAT TO RIDE';
        this.toastTimer = 3.2;
        this._playBeep(880, 0.14, 'triangle', 0.18);
        this._playBeep(1180, 0.2, 'sine', 0.12);
    }

    _getDestroyedCrystalCount(requirement = {}) {
        return (this.crystals || []).filter((crystal) => (
            crystal.destroyed &&
            (!requirement.kind || crystal.kind === requirement.kind)
        )).length;
    }

    _getEnemyKillCount(requirement = {}) {
        const counts = this.enemyKillCounts || { total: 0, kinds: {}, biomes: {} };
        if (requirement.kind) return counts.kinds?.[normalizeEnemyKind(requirement.kind)] || 0;
        if (requirement.biome) return counts.biomes?.[requirement.biome] || 0;
        return counts.total || 0;
    }

    _getLoreReadCount() {
        return (this.loreStones || []).filter((stone) => stone.read).length;
    }

    _npcQuestProgress(effect = {}) {
        const requirement = effect.require || {};
        const entries = [];
        if (requirement.enemyKills) {
            const needed = requirement.enemyKills.count || 1;
            entries.push({
                current: this._getEnemyKillCount(requirement.enemyKills),
                needed,
                label: requirement.enemyKills.label || 'FOES',
            });
        }
        if (requirement.crystals) {
            const needed = requirement.crystals.count || 1;
            entries.push({
                current: this._getDestroyedCrystalCount(requirement.crystals),
                needed,
                label: requirement.crystals.label || 'CRYSTALS',
            });
        }
        if (requirement.loreRead) {
            const needed = requirement.loreRead.count || 1;
            entries.push({
                current: this._getLoreReadCount(),
                needed,
                label: requirement.loreRead.label || 'MARKERS',
            });
        }
        if (requirement.flags) {
            for (const [key, label] of Object.entries(requirement.flags)) {
                entries.push({
                    current: this._npcQuestFlagMet(key) ? 1 : 0,
                    needed: 1,
                    label: label || key.toUpperCase(),
                });
            }
        }
        const tracked = entries.find((entry) => entry.current < entry.needed) || entries[0] || {
            current: 0,
            needed: 1,
            label: 'TASK',
        };
        const current = Math.min(tracked.current, tracked.needed);
        return {
            current,
            needed: tracked.needed,
            remaining: Math.max(0, tracked.needed - current),
            label: tracked.label,
            text: `${current}/${tracked.needed} ${tracked.label}`,
        };
    }

    _npcQuestFlagMet(key) {
        switch (key) {
            case 'hasMap': return !!this.hasMap;
            case 'hasBoat': return !!this.hasBoat;
            case 'hasLevelUpAbility': return !!this.hasLevelUpAbility;
            case 'hasReachedCanyons': return !!this.hasReachedCanyons;
            case 'hasReachedSaltFlats': return !!this.hasReachedSaltFlats;
            case 'hasReachedTropics': return !!this.hasReachedTropics;
            case 'bossSandworm': return !!this.bossDefeated?.sandworm;
            case 'allPillarsDestroyed': return this._allPillarsDestroyed();
            default: return false;
        }
    }

    _npcQuestRequirementsMet(requirement = {}) {
        if (requirement.requireAbility && !this.hasLevelUpAbility) return false;
        if (requirement.enemyKills && this._getEnemyKillCount(requirement.enemyKills) < (requirement.enemyKills.count || 1)) return false;
        if (requirement.crystals && this._getDestroyedCrystalCount(requirement.crystals) < (requirement.crystals.count || 1)) return false;
        if (requirement.loreRead && this._getLoreReadCount() < (requirement.loreRead.count || 1)) return false;
        if (requirement.flags) {
            for (const key of Object.keys(requirement.flags)) {
                if (!this._npcQuestFlagMet(key)) return false;
            }
        }
        return true;
    }

    _npcQuestState(npc) {
        const effect = npc?.effect;
        if (!effect || effect.type !== 'quest') return null;
        if (effect.once !== false && npc.used) return 'complete';
        return this._npcQuestRequirementsMet(effect.require || {}) ? 'ready' : 'active';
    }

    _formatNpcDialogLines(lines, npc) {
        const progress = this._npcQuestProgress(npc.effect || {});
        const replacements = {
            cooldown: Math.max(1, Math.ceil(npc.cooldown)),
            progress: progress.text,
            current: progress.current,
            needed: progress.needed,
            remaining: progress.remaining,
        };
        return (lines || []).map((line) => {
            let text = String(line || '');
            for (const [key, value] of Object.entries(replacements)) {
                text = text.replaceAll(`{${key}}`, value);
            }
            return text;
        });
    }

    _paginateNpcDialogBody(body) {
        const maxWidth = 202;
        const lines = this._wrapPixelText(body, maxWidth);
        if (lines.length <= 5) return [body];
        const pages = [];
        for (let i = 0; i < lines.length; i += 5) {
            pages.push(lines.slice(i, i + 5).join(' '));
        }
        return pages;
    }

    _buildNpcDialogPages(npc) {
        const spec = npc.definition.dialog || {};
        const effect = npc.effect || {};
        let lines = spec.ready || spec.repeat || ['Stay safe out there.'];

        if (effect.type === 'quest') {
            const questState = this._npcQuestState(npc);
            if (questState === 'complete') {
                lines = spec.used || spec.repeat || spec.ready || lines;
            } else if (questState === 'ready') {
                lines = spec.ready || lines;
            } else if (npc.visits > 0 && spec.repeat) {
                lines = spec.repeat;
            } else {
                lines = spec.active || spec.locked || lines;
            }
        } else if (effect.type === 'xp') {
            if (effect.requireAbility && !this.hasLevelUpAbility) {
                lines = spec.locked || spec.ready || lines;
            } else if (npc.used && effect.once) {
                lines = spec.used || spec.repeat || spec.ready || lines;
            } else {
                lines = spec.ready || lines;
            }
        } else if ((effect.type === 'heal' || effect.type === 'buff') && npc.cooldown > 0) {
            lines = spec.cooldown || spec.repeat || spec.ready || lines;
        } else if (npc.visits > 0 && spec.repeat) {
            lines = spec.repeat;
        }

        return this._formatNpcDialogLines(lines, npc).flatMap((body) => (
            this._paginateNpcDialogBody(body).map((pageBody) => ({
                speaker: npc.name,
                title: npc.title,
                body: pageBody,
                accent: npc.accent,
                portrait: npc.portraitFrame,
            }))
        ));
    }

    _openNpcDialog(npc) {
        if (!npc) return;
        const pages = this._buildNpcDialogPages(npc);
        this.dialog = {
            kind: 'npc',
            npc,
            pages,
            index: 0,
            soundTimer: DIALOG_SOUND_DURATION,
            onFinish: () => {
                npc.markVisited();
                this._resolveNpcEffect(npc);
            },
        };
        if (this.input) this.input.pressed = {};
        this._playBeep(620, 0.08, 'triangle', 0.12);
        this._startTextSound();
    }

    _grantNpcQuestReward(npc, effect) {
        const reward = effect.reward || {};
        const labels = [];

        if (reward.xp > 0) {
            this._awardXp(reward.xp, npc.cx, npc.y - 8);
            labels.push(`+${reward.xp} XP`);
        }

        if (reward.skillPoints > 0 && this.hasLevelUpAbility) {
            this.player.skillPoints += reward.skillPoints;
            this.skillHintPulse = 1;
            labels.push(`+${reward.skillPoints} SKILL`);
        }

        if (reward.heal) {
            const amount = reward.heal === 'full'
                ? this.player.maxHealth - this.player.health
                : Math.max(0, Number(reward.heal) || 0);
            if (amount > 0) {
                this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
                this._spawnDamageNumber(this.player.cx, this.player.y - 2, amount, { variant: 'heal' });
                labels.push(`+${amount} HP`);
            }
        }

        if (reward.buffId) {
            const duration = reward.duration || 45;
            this.player.grantShrineBuff(reward.buffId, duration);
            labels.push(`${reward.buffName || reward.buffId.toUpperCase()} ${duration}S`);
        }

        this.toast = effect.toast || labels.join(' | ') || 'QUEST COMPLETE';
        this.toastTimer = 2.4;
        this._playBeep(760, 0.08, 'triangle', 0.14);
        this._playBeep(1080, 0.14, 'sine', 0.1);
        this._spawnParticles(npc.cx, npc.y + 2, {
            count: 22,
            spread: Math.PI * 2,
            minSpeed: 28,
            maxSpeed: 100,
            friction: 0.9,
            gravity: -14,
            life: 0.75,
            colors: [npc.accent, '#ffffff', reward.color || '#ffe9a8'],
            size: 2,
        });
    }

    _resolveNpcEffect(npc) {
        const effect = npc?.effect;
        if (!effect) return;

        if (effect.type === 'heal') {
            if (this.bossState === 'preparing' || this.bossState === 'fighting') {
                this.toast = 'NO TIME TO PATCH WOUNDS MID-BATTLE';
                this.toastTimer = 1.8;
                this._playBeep(260, 0.08, 'square', 0.08);
                return;
            }
            if (this.player.health >= this.player.maxHealth) {
                this.toast = 'ALREADY AT FULL HEALTH';
                this.toastTimer = 1.4;
                this._playBeep(520, 0.06, 'square', 0.08);
                return;
            }
            this.player.health = this.player.maxHealth;
            npc.setCooldown(effect.cooldown);
            this.toast = effect.toast || 'FULL HEAL';
            this.toastTimer = 2.2;
            this._playBeep(880, 0.12, 'triangle', 0.14);
            this._playBeep(1180, 0.16, 'sine', 0.1);
            this._spawnParticles(this.player.cx, this.player.cy - 6, {
                count: 14,
                spread: Math.PI * 2,
                minSpeed: 24,
                maxSpeed: 78,
                friction: 0.9,
                gravity: -18,
                life: 0.72,
                colors: ['#9ef5ff', '#ffffff', '#dfffcf'],
                size: 2,
            });
            return;
        }

        if (effect.type === 'buff') {
            if (npc.cooldown > 0) return;
            this.player.grantShrineBuff(effect.buffId, effect.duration);
            npc.setCooldown(effect.cooldown);
            this.toast = `${effect.buffName || effect.buffId.toUpperCase()} Â· ${effect.duration}S`;
            this.toastTimer = 2.2;
            this._playBeep(840, 0.1, 'triangle', 0.14);
            this._playBeep(1120, 0.14, 'sine', 0.1);
            const color = effect.buffId === 'might'
                ? '#ffbf7a'
                : effect.buffId === 'ward'
                    ? '#a7d7ff'
                    : '#a3ffd6';
            this._spawnParticles(npc.cx, npc.y + 4, {
                count: 18,
                spread: Math.PI * 2,
                minSpeed: 28,
                maxSpeed: 92,
                friction: 0.9,
                gravity: -10,
                life: 0.7,
                colors: [color, '#ffffff', '#fff7c8'],
                size: 2,
            });
            return;
        }

        if (effect.type === 'quest') {
            if (effect.once !== false && npc.used) return;
            if (!this._npcQuestRequirementsMet(effect.require || {})) {
                const progress = this._npcQuestProgress(effect);
                this.toast = effect.progressToast || `${npc.name.toUpperCase()}: ${progress.text}`;
                this.toastTimer = 2.0;
                this._playBeep(360, 0.08, 'square', 0.08);
                return;
            }
            this._grantNpcQuestReward(npc, effect);
            npc.markUsed();
            return;
        }

        if (effect.type === 'xp') {
            if (effect.requireAbility && !this.hasLevelUpAbility) {
                this.toast = 'CLAIM THE SUNKEN RELIC TO AWAKEN THIS KNOWLEDGE';
                this.toastTimer = 2.2;
                this._playBeep(280, 0.08, 'square', 0.08);
                return;
            }
            if (effect.once && npc.used) return;
            this._awardXp(effect.amount || 0, npc.cx, npc.y - 8);
            npc.markUsed();
            this.toast = effect.toast || `+${effect.amount || 0} XP`;
            this.toastTimer = 2.2;
            this._playBeep(760, 0.08, 'triangle', 0.14);
            this._playBeep(1040, 0.12, 'sine', 0.1);
            this._spawnParticles(npc.cx, npc.y + 2, {
                count: 16,
                spread: Math.PI * 2,
                minSpeed: 26,
                maxSpeed: 90,
                friction: 0.9,
                gravity: -14,
                life: 0.7,
                colors: ['#ffe9a8', '#ffcb6a', '#fff6cc'],
                size: 2,
            });
        }
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
        if (this._playerNearBoatman() && this.input.wasPressed('KeyE')) {
            if (!this.bossDefeated.sandworm) {
                // Use importantToast (center-screen, larger, ~3.6s) so the
                // gate message can't be missed. Mom's playtest had her walk
                // away thinking the boatman was decorative.
                this.importantToast = 'DEFEAT THE SANDWORM FIRST';
                this.importantToastTimer = 3.6;
                this._playBeep(220, 0.1, 'square', 0.1);
                return;
            }
            this._openBoatmanDialog();
            return;
        }
        const nearbyNpc = this._getNearbyNpc();
        if (this.ridingBoat && this.input.wasPressed('KeyE') && this._tryToggleBoat()) {
            return;
        }
        if (this._playerNearTombstone() && this.input.wasPressed('KeyE')) {
            this._activateTombstoneSave();
            return;
        }
        if (nearbyNpc && this.input.wasPressed('KeyE')) {
            this._openNpcDialog(nearbyNpc);
            return;
        }
        if (this.input.wasPressed('KeyE') && this._tryToggleBoat()) {
            return;
        }
        if (this._playerNearTreasureChest() && this.input.wasPressed('KeyE')) {
            this._activateTreasureChest();
            return;
        }

        const nearShrine = this._getNearbyShrine();
        if (nearShrine && this.input.wasPressed('KeyE')) {
            this._activateShrine(nearShrine);
            return;
        }

        const nearFont = this._getNearbyAetherFont();
        if (nearFont && this.input.wasPressed('KeyE')) {
            this._activateAetherFont(nearFont);
            return;
        }

        const nearAltar = this._getNearbyMnemoforge();
        if (nearAltar && this.input.wasPressed('KeyE')) {
            this._activateMnemoforge(nearAltar);
            return;
        }

        const nearLore = this._getNearbyLoreStone();
        if (nearLore && this.input.wasPressed('KeyE')) {
            this._activateLoreStone(nearLore);
            return;
        }

        const portal = this._getNearbyPortal();
        if (portal && this.input.wasPressed('KeyE')) {
            this._activatePortal(portal);
        }
    }

    _getNearbyShrine() {
        const hitbox = this.player.getHitbox();
        return this.shrines.find((s) => rectsOverlap(hitbox, s.getInteractRect())) || null;
    }

    _getNearbyLoreStone() {
        const hitbox = this.player.getHitbox();
        return this.loreStones.find((s) => rectsOverlap(hitbox, s.getInteractRect())) || null;
    }

    _activateShrine(shrine) {
        if (!shrine.ready) {
            const secs = Math.ceil(shrine.cooldown);
            this.toast = `SHRINE RECHARGING · ${secs}S`;
            this.toastTimer = 1.6;
            this._playBeep(280, 0.1, 'square', 0.08);
            return;
        }
        if (!shrine.activate()) return;
        this.player.grantShrineBuff(shrine.buffId, shrine.duration);
        this.toast = `${shrine.buff} · ${shrine.duration}S`;
        this.toastTimer = 2.2;
        this._playBeep(840, 0.1, 'triangle', 0.14);
        this._playBeep(1120, 0.14, 'sine', 0.1);
        this._spawnParticles(shrine.cx, shrine.cy - 4, {
            count: 14,
            spread: Math.PI * 2,
            minSpeed: 28,
            maxSpeed: 90,
            friction: 0.9,
            gravity: -12,
            life: 0.7,
            colors: [shrine.color, '#ffffff', '#fff7c8'],
            size: 2,
        });
    }

    _getNearbyAetherFont() {
        if (!this.aetherFonts || !this.aetherFonts.length) return null;
        const hitbox = this.player.getHitbox();
        return this.aetherFonts.find((f) => rectsOverlap(hitbox, f.getInteractRect())) || null;
    }

    _activateAetherFont(font) {
        if (!font.ready) {
            const secs = Math.ceil(font.cooldown);
            this.toast = `AETHER FONT DORMANT · ${secs}S`;
            this.toastTimer = 1.6;
            this._playBeep(240, 0.1, 'square', 0.08);
            return;
        }
        const surge = font.activate();
        if (!surge) return;

        // --- Gameplay effects ---
        // Heal the player up to maxHealth.
        const healed = Math.min(surge.heal, this.player.maxHealth - this.player.health);
        if (healed > 0) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + healed);
            this._spawnDamageNumber(this.player.cx, this.player.y - 2, healed, { variant: 'heal' });
        }

        // Damage every targetable enemy within surge radius.
        let hits = 0;
        const r2 = surge.radius * surge.radius;
        for (const enemy of this.enemies) {
            if (!enemy.isTargetable()) continue;
            const ex = enemy.cx - surge.cx;
            const ey = enemy.cy - surge.cy;
            if (ex * ex + ey * ey > r2) continue;
            // Use the player's attack direction as a push hint (or down by default).
            if (enemy.takeHit(this.player.attackDirection, surge.damage)) {
                hits += 1;
                this._spawnDamageNumber(enemy.cx, enemy.cy - 6, surge.damage, { crit: false });
                if (enemy === this.sandwormBoss) this.bossHpFlash = 0.3;
                if (enemy.health <= 0 && this.hasLevelUpAbility) {
                    this._awardXp(enemy.xpReward || 1, enemy.cx, enemy.y + 4);
                    this._recordEnemySlain(enemy);
                }
            }
        }

        // --- Feedback ---
        const parts = ['TIDAL SURGE'];
        if (healed > 0) parts.push(`+${healed} HP`);
        if (hits > 0) parts.push(`${hits} STRUCK`);
        this.toast = parts.join(' · ');
        this.toastTimer = 2.2;
        this.screenShake = Math.max(this.screenShake, 0.75);
        this.hitStopTimer = Math.max(this.hitStopTimer, 0.04);
        this._playBeep(620, 0.12, 'sine', 0.14);
        this._playBeep(980, 0.18, 'triangle', 0.1);
        this._playBeep(1340, 0.22, 'sine', 0.08);

        // Outward burst of seafoam motes.
        this._spawnParticles(surge.cx, surge.cy, {
            count: 36,
            spread: Math.PI * 2,
            minSpeed: 60,
            maxSpeed: 190,
            friction: 0.9,
            gravity: -8,
            life: 0.55,
            colors: ['#a6f6ff', '#3cc7e0', '#ffffff', '#e8fbff'],
            size: 2,
        });
        // Upward spray from the core.
        this._spawnParticles(font.cx, font.y + 4, {
            count: 14,
            angle: -Math.PI / 2,
            spread: Math.PI * 0.5,
            minSpeed: 40,
            maxSpeed: 110,
            friction: 0.92,
            gravity: 90,
            life: 0.85,
            colors: ['#a6f6ff', '#e8fbff', '#ffffff'],
            size: 2,
        });
        // Faint healing glow around player.
        this._spawnParticles(this.player.cx, this.player.cy - 6, {
            count: 10,
            spread: Math.PI * 2,
            minSpeed: 18,
            maxSpeed: 48,
            friction: 0.88,
            gravity: -25,
            life: 0.7,
            colors: ['#a6f6ff', '#e8fbff', '#ffffff'],
            size: 2,
        });
    }

    _getNearbyMnemoforge() {
        if (!this.mnemoforges || !this.mnemoforges.length) return null;
        const hitbox = this.player.getHitbox();
        return this.mnemoforges.find((m) => rectsOverlap(hitbox, m.getInteractRect())) || null;
    }

    /**
     * Re-temper the player's skill tree at a Mnemoforge Altar.
     * - First use at a given altar is free ("pilgrim's grace").
     * - Every subsequent use taxes 20% of current-level progress toward next level.
     * - If the player has nothing invested AND no free respec pending, emit a soft
     *   toast and do nothing — no wasted click.
     */
    _activateMnemoforge(altar) {
        const invested = Object.values(this.player.skills).reduce((a, b) => a + (Number(b) || 0), 0);
        if (!this.hasLevelUpAbility) {
            this.toast = 'THE SLAB IS QUIET · NO MEMORIES TO MELT';
            this.toastTimer = 2.0;
            this._playBeep(280, 0.1, 'square', 0.06);
            return;
        }
        if (invested <= 0) {
            this.toast = 'MNEMOFORGE · NOTHING TO UNWEAVE';
            this.toastTimer = 1.8;
            this._playBeep(280, 0.1, 'square', 0.06);
            return;
        }

        const firstUse = !altar.used;
        let taxedXp = 0;
        let taxedPoint = 0;
        if (!firstUse) {
            // Normal tax: 20% of current-level XP-toward-next. Never takes a level away.
            const atMax = this.player.level >= (this.player.maxLevel || 25);
            if (atMax) {
                // At level cap there is no meaningful XP pool, so the slab
                // swallows a refunded rank instead (min-maxer prevention).
                taxedPoint = 1;
            } else {
                taxedXp = Math.max(10, Math.floor((this.player.xpToNext || 0) * 0.2));
                if (taxedXp > 0) this.player.xp = Math.max(0, this.player.xp - taxedXp);
            }
        }
        let refunded = this.player.resetSkills();
        if (taxedPoint > 0 && refunded > 0) {
            // Slab swallows one rank's worth of refund.
            this.player.skillPoints = Math.max(0, this.player.skillPoints - taxedPoint);
            refunded = Math.max(0, refunded - taxedPoint);
        }
        altar.activate();

        // Feedback.
        let costLabel;
        if (firstUse) costLabel = 'FREE';
        else if (taxedPoint > 0) costLabel = `-${taxedPoint} RANK TAX`;
        else costLabel = `-${taxedXp} XP`;
        this.toast = `MNEMOFORGE · ${refunded} RANKS RETURNED · ${costLabel}`;
        this.toastTimer = 2.6;
        this.screenShake = Math.max(this.screenShake, 0.45);
        this.hitStopTimer = Math.max(this.hitStopTimer, 0.03);
        this._playBeep(220, 0.18, 'sawtooth', 0.1);
        this._playBeep(440, 0.14, 'triangle', 0.08);
        this._playBeep(740, 0.22, 'sine', 0.09);

        // Violet implosion from the altar, then a ring of soft motes rising.
        this._spawnParticles(altar.cx, altar.cy, {
            count: 24,
            spread: Math.PI * 2,
            minSpeed: 40,
            maxSpeed: 120,
            friction: 0.9,
            gravity: -10,
            life: 0.55,
            colors: ['#c2b0ff', '#ffb8f5', '#ffffff', '#8a6ab8'],
            size: 2,
        });
        this._spawnParticles(altar.cx, altar.y - 2, {
            count: 12,
            angle: -Math.PI / 2,
            spread: Math.PI * 0.7,
            minSpeed: 25,
            maxSpeed: 70,
            friction: 0.93,
            gravity: 40,
            life: 0.9,
            colors: ['#e8d6ff', '#c2b0ff'],
            size: 2,
        });
    }

    _rollOuroborosInterval(bias = 0) {
        // Base: 120–300s. `bias` shortens first interval (used on boot so a tremor can occur earlier).
        const reduction = Math.max(0, Math.min(Number(bias) || 0, 60));
        const base = 120 - reduction;
        return base + Math.random() * 180;
    }

    _triggerOuroborosTremor() {
        if (!this.world || !this.player) return;
        // Bug OT-1 fix: refuse to stack a tremor on top of an active one.
        if (this.ouroborosTremorTimer > 0) return;
        // Bug OT-4 fix: don't stir the coil while the player is on the rowboat
        //   — shards would spawn on unreachable land and vanish unseen.
        if (this.ridingBoat) {
            this.ouroborosNextTremor = 30 + Math.random() * 40; // retry sooner once disembarked
            return;
        }
        // Bug OT-3 fix: silence the tremor entirely before the XP system is unlocked
        //   so the player can't walk onto shards that give nothing and disappear.
        if (!this.hasLevelUpAbility) {
            this.ouroborosNextTremor = this._rollOuroborosInterval(0);
            return;
        }
        this.ouroborosTremorTimer = this.ouroborosTremorMax;
        this.screenShake = Math.max(this.screenShake, 0.85);
        // deep-earth chord — the World-Coil stirs
        this._playBeep(55, 1.6, 'sine', 0.2);
        this._playBeep(82, 1.2, 'sine', 0.15);
        this._playBeep(38, 1.8, 'sine', 0.16);
        this.toast = 'THE WORLD-COIL STIRS';
        this.toastTimer = 2.2;
        // Dust plume under the player's feet
        const px = this.player.x + this.player.w / 2;
        const py = this.player.y + this.player.h;
        this._spawnParticles(px, py - 1, {
            count: 14,
            angle: -Math.PI / 2,
            spread: Math.PI,
            minSpeed: 14,
            maxSpeed: 46,
            friction: 0.9,
            gravity: 24,
            life: 0.9,
            colors: ['#d8c79a', '#a89372', '#6a5a42'],
            size: 1,
        });
        const placed = this._spawnBoneglassShards();
        // Bug OT-2 fix: if the ground refused all spawn attempts (player boxed in by
        // water/props/map edge), the tremor still plays — but we re-roll the next
        // interval shorter so the Coil gets another chance.
        if (placed <= 0) {
            this.ouroborosNextTremor = 40 + Math.random() * 60;
        }
    }

    _spawnBoneglassShards() {
        if (!this.world || !this.player) return;
        if (!Array.isArray(this.boneglassShards)) this.boneglassShards = [];
        const target = 3 + Math.floor(Math.random() * 4); // 3–6
        const centerX = this.player.x + this.player.w / 2;
        const centerY = this.player.y + this.player.h / 2;
        let placed = 0;
        let attempts = 0;
        while (placed < target && attempts < 80) {
            attempts++;
            const angle = Math.random() * Math.PI * 2;
            const dist = 56 + Math.random() * 104; // ~56–160px from player
            const sx = Math.round(centerX + Math.cos(angle) * dist);
            const sy = Math.round(centerY + Math.sin(angle) * dist);
            // Safety: world bounds + walkable (non-boat) + don't stack on existing shard
            if (this.world.collides(sx - 2, sy - 2, 4, 4, 'walker')) continue;
            let tooClose = false;
            for (const existing of this.boneglassShards) {
                const dx = existing.x - sx;
                const dy = existing.y - sy;
                if (dx * dx + dy * dy < 144) { tooClose = true; break; }
            }
            if (tooClose) continue;
            this.boneglassShards.push({
                x: sx,
                y: sy,
                life: 18,
                maxLife: 18,
                phase: Math.random() * Math.PI * 2,
                spawnPulse: 1,
            });
            // A little ember-glint when it surfaces
            this._spawnParticles(sx, sy, {
                count: 4,
                angle: -Math.PI / 2,
                spread: Math.PI * 0.9,
                minSpeed: 10,
                maxSpeed: 36,
                friction: 0.93,
                gravity: 24,
                life: 0.5,
                colors: ['#ffe9a8', '#ffcb6a'],
                size: 1,
            });
            placed++;
        }
        return placed;
    }

    _updateOuroborosTremor(dt) {
        if (!Array.isArray(this.boneglassShards)) this.boneglassShards = [];

        // Tremor body: keep the camera shaking for the duration, then idle.
        if (this.ouroborosTremorTimer > 0) {
            this.ouroborosTremorTimer = Math.max(0, this.ouroborosTremorTimer - dt);
            const strength = 0.35 + (this.ouroborosTremorTimer / this.ouroborosTremorMax) * 0.5;
            this.screenShake = Math.max(this.screenShake, strength);
        } else {
            // Only tick the countdown during normal play — freeze on pause/dialog/reward/death.
            const locked = this.paused || this.dialog || this.rewardPopup || this.deathState || this.ridingBoat;
            if (!locked && this.player && this.world) {
                if (typeof this.ouroborosNextTremor !== 'number') this.ouroborosNextTremor = this._rollOuroborosInterval(90);
                this.ouroborosNextTremor -= dt;
                if (this.ouroborosNextTremor <= 0) {
                    this._triggerOuroborosTremor();
                    this.ouroborosNextTremor = this._rollOuroborosInterval(0);
                }
            }
        }

        // Shard lifecycle + pickup
        if (!this.player) return;
        const pcx = this.player.x + this.player.w / 2;
        const pcy = this.player.y + this.player.h / 2;
        for (let i = this.boneglassShards.length - 1; i >= 0; i--) {
            const s = this.boneglassShards[i];
            s.life -= dt;
            s.phase += dt * 3;
            if (s.spawnPulse > 0) s.spawnPulse = Math.max(0, s.spawnPulse - dt * 1.6);
            if (s.life <= 0) {
                this.boneglassShards.splice(i, 1);
                continue;
            }
            const dx = s.x - pcx;
            const dy = s.y - pcy;
            if (dx * dx + dy * dy < 72) { // ~8.5px pickup radius
                const amount = 12;
                if (this.hasLevelUpAbility) this._awardXp(amount, s.x, s.y);
                this._playBeep(720, 0.07, 'triangle', 0.14);
                this._playBeep(1020, 0.09, 'sine', 0.1);
                this._spawnParticles(s.x, s.y, {
                    count: 10,
                    angle: -Math.PI / 2,
                    spread: Math.PI * 1.3,
                    minSpeed: 18,
                    maxSpeed: 60,
                    friction: 0.93,
                    gravity: 26,
                    life: 0.6,
                    colors: ['#ffe9a8', '#ffcb6a', '#fff6cc'],
                    size: 1,
                });
                this.boneglassShards.splice(i, 1);
            }
        }
    }

    _updateFogOfWar(dt) {
        if (!this.world || !this.player || !this.fogMask) return;
        // Bug FoW-4 fix: guard against NaN / infinity on player coords (can happen
        // briefly during portal cutscenes or save-state restoration).
        if (!Number.isFinite(this.player.cx) || !Number.isFinite(this.player.cy)) return;
        const TILE_SZ = 16;
        const cols = this.world.cols;
        const rows = this.world.rows;
        const R = 6;
        const R2 = R * R;

        // Bug FoW-2 fix: interpolate between last-frame and this-frame positions
        // so fast dashes, teleports, and frame stalls don't leave unseen seams.
        // We sample every ~4 tiles along the line (half the reveal radius).
        const px = this.player.cx;
        const py = this.player.cy;
        const lpx = Number.isFinite(this._fogLastX) ? this._fogLastX : px;
        const lpy = Number.isFinite(this._fogLastY) ? this._fogLastY : py;
        const dx = px - lpx;
        const dy = py - lpy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = (R * TILE_SZ) * 0.5; // 48px between samples
        const samples = Math.max(1, Math.ceil(dist / step) + 1);
        for (let s = 0; s < samples; s++) {
            const t = samples === 1 ? 1 : s / (samples - 1);
            const sx = lpx + dx * t;
            const sy = lpy + dy * t;
            const pcol = Math.floor(sx / TILE_SZ);
            const prow = Math.floor(sy / TILE_SZ);
            const c0 = Math.max(0, pcol - R);
            const c1 = Math.min(cols - 1, pcol + R);
            const r0 = Math.max(0, prow - R);
            const r1 = Math.min(rows - 1, prow + R);
            for (let r = r0; r <= r1; r++) {
                const rowBase = r * cols;
                const dr = r - prow;
                for (let c = c0; c <= c1; c++) {
                    const dc = c - pcol;
                    if (dc * dc + dr * dr > R2) continue;
                    const idx = rowBase + c;
                    if (!this.fogMask[idx]) {
                        this.fogMask[idx] = 1;
                        this.fogReveal[idx] = 1;
                    }
                }
            }
        }
        this._fogLastX = px;
        this._fogLastY = py;

        // Decay the reveal-pulse buffer so the fade-in only flashes once.
        if (this.fogReveal) {
            const decay = dt * 1.8;
            for (let i = 0; i < this.fogReveal.length; i++) {
                if (this.fogReveal[i] > 0) this.fogReveal[i] = Math.max(0, this.fogReveal[i] - decay);
            }
        }
    }

    _drawFogOverlay(ctx, frameX, frameY, frameW, frameH, srcX, srcY, sourceW, sourceH) {
        if (!this.fogMask || !this.world) return;
        const cols = this.world.cols;
        const rows = this.world.rows;
        const TILE_SZ = 16;
        // Map world-source rect to tile range
        const c0 = Math.max(0, Math.floor(srcX / TILE_SZ));
        const c1 = Math.min(cols - 1, Math.ceil((srcX + sourceW) / TILE_SZ));
        const r0 = Math.max(0, Math.floor(srcY / TILE_SZ));
        const r1 = Math.min(rows - 1, Math.ceil((srcY + sourceH) / TILE_SZ));
        const scaleX = frameW / sourceW;
        const scaleY = frameH / sourceH;
        for (let r = r0; r <= r1; r++) {
            const rowBase = r * cols;
            for (let c = c0; c <= c1; c++) {
                const idx = rowBase + c;
                const seen = this.fogMask[idx];
                if (seen) continue;
                const tx = frameX + Math.round(((c * TILE_SZ) - srcX) * scaleX);
                const ty = frameY + Math.round(((r * TILE_SZ) - srcY) * scaleY);
                const tw = Math.max(1, Math.ceil(TILE_SZ * scaleX));
                const th = Math.max(1, Math.ceil(TILE_SZ * scaleY));
                ctx.fillStyle = 'rgba(8, 6, 14, 0.92)';
                ctx.fillRect(tx, ty, tw, th);
            }
        }
        // Ink-bloom glow on recently-revealed tiles
        for (let r = r0; r <= r1; r++) {
            const rowBase = r * cols;
            for (let c = c0; c <= c1; c++) {
                const idx = rowBase + c;
                const pulse = this.fogReveal ? this.fogReveal[idx] : 0;
                if (pulse <= 0) continue;
                const tx = frameX + Math.round(((c * TILE_SZ) - srcX) * scaleX);
                const ty = frameY + Math.round(((r * TILE_SZ) - srcY) * scaleY);
                const tw = Math.max(1, Math.ceil(TILE_SZ * scaleX));
                const th = Math.max(1, Math.ceil(TILE_SZ * scaleY));
                ctx.fillStyle = `rgba(255, 232, 138, ${0.24 * pulse})`;
                ctx.fillRect(tx, ty, tw, th);
            }
        }
    }

    _drawBoneglassShard(ctx, s) {
        const pulse = 0.6 + Math.sin(s.phase) * 0.4;
        const fadeIn = Math.min(1, 1 - s.spawnPulse);
        const fadeOut = Math.min(1, Math.max(0, s.life) / 4); // last 4s tapers
        const alpha = fadeIn * fadeOut * (0.7 + pulse * 0.3);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Amber glow halo
        ctx.fillStyle = 'rgba(255, 206, 120, 0.22)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        // Shard body — jagged amber splinter
        const sx = Math.round(s.x);
        const sy = Math.round(s.y);
        ctx.fillStyle = '#fff1b8';
        ctx.fillRect(sx - 1, sy - 3, 2, 6);
        ctx.fillStyle = '#f5b85a';
        ctx.fillRect(sx - 2, sy, 1, 1);
        ctx.fillRect(sx + 1, sy - 1, 1, 1);
        ctx.fillStyle = '#fffbe0';
        ctx.fillRect(sx, sy - 2, 1, 1);
        ctx.restore();
    }

    _activateLoreStone(stone) {
        if (!stone.read) {
            stone.setRead(true);
            if (this.hasLevelUpAbility) this._awardXp(15, stone.cx, stone.cy - 10);
            this._playBeep(680, 0.1, 'triangle', 0.12);
            this._playBeep(980, 0.16, 'sine', 0.09);
        } else {
            this._playBeep(520, 0.06, 'square', 0.08);
        }
        this.activeLoreReadout = {
            title: stone.title,
            body: stone.body,
            timer: 5.0,
        };
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
        if (this.bossState === 'preparing' || this.bossState === 'fighting') {
            this.toast = 'CANNOT HEAL DURING THE BOSS BATTLE';
            this.toastTimer = 2.2;
            this._playBeep(280, 0.12, 'square', 0.1);
            return;
        }
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
        // Goliaths in the tropics blocked the path TO the relic — give the
        // player a 5s grace window after claiming it before they spawn.
        this.goliathsUnlocked = false;
        this.goliathUnlockTimer = 5;
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
        const midBoss = this.bossState === 'preparing' || this.bossState === 'fighting';
        if (midBoss && portal.targetRealmId !== this.currentRealmId) {
            this.toast = 'THE AMBERWAKE WILL NOT RELEASE YOU';
            this.toastTimer = 1.8;
            this._playBeep(220, 0.12, 'square', 0.14);
            return;
        }
        this._switchRealm(portal.targetRealmId, portal.arrivalKey);
    }

    _openWorldMap() {
        this.worldMapOpen = true;
        this.worldMapMode = 'relative';
        this._playBeep(720, 0.08, 'triangle', 0.12);
    }

    _closeWorldMap() {
        this.worldMapOpen = false;
        this._playBeep(520, 0.05, 'square', 0.1);
    }

    _updateWorldMap() {
        if (this.input.wasPressed('KeyM')) {
            this.worldMapMode = this.worldMapMode === 'relative' ? 'world' : 'relative';
            this._playBeep(840, 0.08, 'triangle', 0.12);
            return;
        }
        if (
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
        if (this.input) this.input.pressed = {};
        this._playBeep(620, 0.08, 'triangle', 0.12);
        this._startTextSound();
    }

    _updateDialog(dt) {
        const d = this.dialog;
        if (!d) return;
        const pageCount = d.images?.length || d.pages?.length || 0;

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

            if (d.index + 1 < pageCount) {
                d.index += 1;
                d.soundTimer = DIALOG_SOUND_DURATION;
                this._startTextSound();
            } else {
                if (typeof d.onFinish === 'function') {
                    d.onFinish();
                } else if (d.kind === 'boatman') {
                    this._grantBoat();
                } else {
                    this.hasTalkedToElara = true;
                }
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
        if (this.input) this.input.pressed = {};
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

    _renderRuntimeDialogPage(page) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const font = this.assets.pixelFont;
        const accent = page.accent || '#8effec';
        const portrait = page.portrait;
        const portraitX = 12;
        const portraitY = 36;
        const portraitW = 74;
        const portraitH = 96;
        const panelX = 82;
        const panelY = 20;
        const panelW = 226;
        const panelH = 112;

        ctx.fillStyle = 'rgba(22, 26, 48, 0.96)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
        ctx.strokeStyle = '#5f7fb1';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 3.5, panelY + 3.5, panelW - 7, panelH - 7);

        ctx.fillStyle = 'rgba(13, 18, 34, 0.98)';
        ctx.fillRect(portraitX, portraitY, portraitW, portraitH);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(portraitX + 0.5, portraitY + 0.5, portraitW - 1, portraitH - 1);
        ctx.fillStyle = `${accent}22`;
        ctx.fillRect(portraitX + 4, portraitY + 4, portraitW - 8, portraitH - 8);

        if (portrait) {
            const scale = Math.min((portraitW - 12) / portrait.width, (portraitH - 12) / portrait.height);
            const drawW = Math.max(1, Math.round(portrait.width * scale));
            const drawH = Math.max(1, Math.round(portrait.height * scale));
            const drawX = portraitX + Math.floor((portraitW - drawW) / 2);
            const drawY = portraitY + portraitH - drawH - 4;
            ctx.drawImage(portrait, drawX, drawY, drawW, drawH);
        }

        font.draw(ctx, this._clampPixelText(page.speaker || 'WANDERER', panelW - 24), panelX + 12, panelY + 10, { color: accent });
        if (page.title) {
            font.draw(ctx, this._clampPixelText(page.title, panelW - 24), panelX + 12, panelY + 20, { color: '#fff2b3' });
        }
        const lines = this._wrapPixelText(page.body || '', panelW - 24);
        lines.slice(0, 5).forEach((line, index) => {
            font.draw(ctx, line, panelX + 12, panelY + 38 + index * 10, { color: '#f1f5ff' });
        });

        return canvas;
    }

    _getCurrentDialogImage() {
        const d = this.dialog;
        if (!d) return null;
        if (d.images) return d.images[d.index];
        if (d.pages) {
            if (!d.renderedPages) d.renderedPages = [];
            if (!d.renderedPages[d.index]) {
                d.renderedPages[d.index] = this._renderRuntimeDialogPage(d.pages[d.index]);
            }
            return d.renderedPages[d.index];
        }
        return null;
    }

    _clampPixelText(text, maxWidth, scale = 1) {
        const font = this.assets?.pixelFont;
        const normalized = String(text || '').trim().replace(/\s+/g, ' ').toUpperCase();
        if (!font || font.measure(normalized, scale) <= maxWidth) return normalized;
        let clipped = normalized;
        while (clipped.length > 1 && font.measure(`${clipped}...`, scale) > maxWidth) {
            clipped = clipped.slice(0, -1);
        }
        return `${clipped}...`;
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
            // Pool of pre-cloned clips so rapid swings overlap cleanly without
            // unbounded allocation or audio congestion.
            if (!this._swordSlashPool) {
                this._swordSlashPool = [];
                this._swordSlashPoolIndex = 0;
                for (let i = 0; i < 4; i++) {
                    const clip = this.swordSlashSound.cloneNode(true);
                    clip.volume = this.swordSlashSound.volume;
                    this._swordSlashPool.push(clip);
                }
            }
            const clip = this._swordSlashPool[this._swordSlashPoolIndex];
            this._swordSlashPoolIndex = (this._swordSlashPoolIndex + 1) % this._swordSlashPool.length;
            try { clip.currentTime = 0; } catch (_) { /* ignore */ }
            const p = clip.play();
            if (p && p.catch) p.catch(() => {});
        } catch (_) { /* ignore */ }
    }

    _resolveCombat() {
        const attackRect = this.player.getAttackRect();
        if (!attackRect) return;

        // Pillar hits: each swing chips through the stage progression.
        for (const pillar of this.pillars) {
            if (pillar.destroyed || !this.player.canHitEnemy(`pillar-${pillar.id}`)) continue;
            const interact = pillar.getInteractRect();
            if (!interact || !rectsOverlap(attackRect, interact)) continue;

            const prevStage = pillar.stage;
            const result = pillar.takeHit(this.player.attackDamage || 1);
            if (!result.landed) continue;
            this.player.registerAttackHit(`pillar-${pillar.id}`);
            this.screenShake = Math.max(this.screenShake, 0.45);
            this.hitStopTimer = Math.max(this.hitStopTimer, 0.03);
            this._spawnParticles(pillar.cx, pillar.cy, {
                count: result.destroyed ? 22 : 8,
                spread: Math.PI * 2,
                minSpeed: 30,
                maxSpeed: 120,
                friction: 0.88,
                gravity: 60,
                life: 0.5,
                colors: ['#d0a5ff', '#ffffff', '#a0ffdd', '#caa7ff'],
                size: 2,
            });
            this._spawnDamageNumber(pillar.cx, pillar.cy - 8, this.player.attackDamage || 1, {
                crit: result.destroyed,
            });
            if (result.stageChanged) {
                this.toast = result.destroyed
                    ? `PILLAR SHATTERED · ${this._pillarsRemaining()} LEFT`
                    : 'PILLAR CRACKED';
                this.toastTimer = 1.8;
                this._playBeep(result.destroyed ? 720 : 520, 0.12, 'triangle', 0.14);
                if (result.destroyed) {
                    this._playBeep(960, 0.18, 'sine', 0.12);
                    this._refreshEntityColliders();
                    this.screenShake = Math.max(this.screenShake, 0.9);
                    if (this.hasLevelUpAbility) {
                        this._awardXp(18, pillar.cx, pillar.cy - 10);
                    }
                }
            } else {
                this._playBeep(380, 0.08, 'square', 0.08);
            }
        }

        // Crystal clusters: chip and shatter on overlap — each shatter drops XP + sparks.
        for (const crystal of this.crystals) {
            if (crystal.destroyed || !this.player.canHitEnemy(`crystal-${crystal.id}`)) continue;
            const interact = crystal.getInteractRect();
            if (!interact || !rectsOverlap(attackRect, interact)) continue;

            const result = crystal.takeHit(this.player.attackDamage || 1);
            if (!result.landed) continue;
            this.player.registerAttackHit(`crystal-${crystal.id}`);
            this.screenShake = Math.max(this.screenShake, result.destroyed ? 0.5 : 0.3);
            this.hitStopTimer = Math.max(this.hitStopTimer, 0.02);
            this._spawnParticles(crystal.cx, crystal.cy, {
                count: result.destroyed ? 18 : 6,
                spread: Math.PI * 2,
                minSpeed: 30,
                maxSpeed: 110,
                friction: 0.88,
                gravity: 60,
                life: 0.45,
                colors: [crystal.colorA, crystal.colorB, '#ffffff'],
                size: 2,
            });
            if (result.destroyed) {
                this._refreshEntityColliders();
                this._playBeep(880, 0.1, 'triangle', 0.12);
                this._playBeep(1240, 0.14, 'sine', 0.08);
                if (this.hasLevelUpAbility) {
                    this._awardXp(crystal.xp, crystal.cx, crystal.cy - 8);
                }
            } else {
                this._playBeep(720, 0.05, 'square', 0.08);
            }
        }

        // Amberwake cleave (every 5th swing): apply a 360° hit around the player
        // before the normal swing loop, so the swing still lands its directional hit.
        if (this.player.pendingAmberwakeCleave) {
            this.player.pendingAmberwakeCleave = false;
            this._fireAmberwakeCleave();
        }

        for (const enemy of this.enemies) {
            if (!enemy.isTargetable() || !this.player.canHitEnemy(enemy.id)) continue;
            if (!rectsOverlap(attackRect, enemy.getHitbox())) continue;

            // Damage calc: crit roll, combo multiplier. Each lands as integer damage.
            const isCrit = Math.random() < (this.player.critChance || 0);
            const critMult = isCrit ? 2 : 1;
            const comboMult = this.player.comboDamageMult ? this.player.comboDamageMult() : 1;
            const dmg = Math.max(1, Math.round(this.player.attackDamage * critMult * comboMult));

            if (enemy.takeHit(this.player.attackDirection, dmg)) {
                this.player.registerAttackHit(enemy.id);
                const newTier = this.player.registerComboHit();
                if (newTier > 0) this._onComboTierReached(newTier, enemy.cx, enemy.y);
                this.screenShake = Math.max(this.screenShake, isCrit ? 0.85 : 0.55);
                if (enemy === this.sandwormBoss) this.bossHpFlash = 0.3;
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
                    count: isCrit ? 14 : 8,
                    angle: hitAngle,
                    spread: Math.PI * 0.55,
                    minSpeed: 50,
                    maxSpeed: isCrit ? 170 : 130,
                    friction: 0.86,
                    gravity: 60,
                    life: 0.32,
                    colors: isCrit ? ['#ffffff', '#ffe78a', '#ff9f4a'] : ['#ffffff', '#ffe78a', '#a6ffcb'],
                    size: 2,
                });
                this.hitStopTimer = Math.max(this.hitStopTimer, isCrit ? 0.06 : 0.035);
                this._spawnDamageNumber(hitX, hitY - 4, dmg, {
                    crit: isCrit || (slain && dmg > 1),
                });

                if (slain) {
                    // Lifesteal / amber-echo haste hooks fire on any kill.
                    if (Math.random() < (this.player.lifestealChance || 0)) {
                        this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
                        this._spawnParticles(this.player.cx, this.player.cy - 6, {
                            count: 6, spread: Math.PI * 2, minSpeed: 20, maxSpeed: 55,
                            friction: 0.9, gravity: -20, life: 0.5,
                            colors: ['#ff8fae', '#ff5577', '#ffffff'], size: 2,
                        });
                    }
                    this._recordEnemySlain(enemy);

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

    _fireAmberwakeCleave() {
        const px = this.player.cx;
        const py = this.player.cy;
        const radius = 56;
        // Cleave should respect the player's combo bonus so it stays relevant
        // late-game; earlier it was capped at flat attack+1 and felt anemic.
        const comboMult = this.player.comboDamageMult ? this.player.comboDamageMult() : 1;
        const dmg = Math.max(2, Math.round((this.player.attackDamage + 1) * comboMult));

        this.screenShake = Math.max(this.screenShake, 1.0);
        this.hitStopTimer = Math.max(this.hitStopTimer, 0.05);
        this._playBeep(640, 0.14, 'triangle', 0.2);
        this._playBeep(980, 0.18, 'sine', 0.14);

        // Amber ring burst
        this._spawnParticles(px, py, {
            count: 42,
            spread: Math.PI * 2,
            minSpeed: 80,
            maxSpeed: 180,
            friction: 0.92,
            gravity: 0,
            life: 0.55,
            colors: ['#ffd98a', '#ffa24e', '#ff6ec7', '#ffffff'],
            size: 2,
        });

        for (const enemy of this.enemies) {
            if (!enemy.isTargetable()) continue;
            const ecx = enemy.cx;
            const ecy = enemy.cy;
            const dx = ecx - px;
            const dy = ecy - py;
            if (dx * dx + dy * dy > radius * radius) continue;

            // Cleave ignores the swing's per-enemy lockout.
            if (enemy.takeHit(this.player.attackDirection, dmg)) {
                if (enemy === this.sandwormBoss) this.bossHpFlash = 0.35;
                this._spawnDamageNumber(ecx, ecy - 6, dmg, { crit: true });
                const slain = enemy.health <= 0;
                if (slain && this.hasLevelUpAbility) {
                    this._awardXp(enemy.xpReward || 1, enemy.cx, enemy.y + 4);
                    this._recordEnemySlain(enemy);
                }
            }
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

    _spawnEnemyProjectile(proj) {
        // proj = { originX, originY, dirX, dirY, speed, damage }
        const angle = Math.atan2(proj.dirY, proj.dirX);
        this.projectiles.push({
            x: proj.originX,
            y: proj.originY,
            vx: proj.dirX * proj.speed,
            vy: proj.dirY * proj.speed,
            angle,
            damage: proj.damage,
            life: 1.6,
            maxLife: 1.6,
        });
    }

    _updateProjectiles(dt) {
        if (!this.projectiles || this.projectiles.length === 0) return;
        const playerHb = this.player.getHitbox();
        // Arrow has a generous hitbox so glancing shots still land
        const arrowR = 5;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            // Trail
            if (Math.random() < 0.5) {
                this.particles.push({
                    x: p.x, y: p.y,
                    vx: 0, vy: 0,
                    gravity: 0, friction: 0.9,
                    life: 0.18, maxLife: 0.18,
                    color: 'rgba(220, 200, 140, 0.6)',
                    size: 1, shrink: true,
                });
            }
            // Player hit (AABB with arrow radius pad)
            if (
                p.x + arrowR >= playerHb.x && p.x - arrowR <= playerHb.x + playerHb.w &&
                p.y + arrowR >= playerHb.y && p.y - arrowR <= playerHb.y + playerHb.h
            ) {
                const landed = this.player.takeDamage(p.damage, {
                    x: Math.cos(p.angle) * 18,
                    y: Math.sin(p.angle) * 14,
                });
                if (landed) {
                    this._spawnDamageNumber(this.player.cx, this.player.y - 2, p.damage, { variant: 'player' });
                }
                this._spawnParticles(p.x, p.y, {
                    count: 6,
                    spread: Math.PI * 2,
                    minSpeed: 30,
                    maxSpeed: 90,
                    friction: 0.86,
                    gravity: 50,
                    life: 0.32,
                    colors: ['#ffd773', '#a16030', '#ffffff'],
                    size: 1,
                });
                this.screenShake = Math.max(this.screenShake, 0.4);
                this.projectiles.splice(i, 1);
                continue;
            }
            // World collision
            if (this.world.collides(p.x, p.y, 1, 1)) {
                this._spawnParticles(p.x, p.y, {
                    count: 4,
                    spread: Math.PI * 2,
                    minSpeed: 10,
                    maxSpeed: 60,
                    friction: 0.84,
                    life: 0.25,
                    colors: ['#a18060', '#ffd773'],
                    size: 1,
                });
                this.projectiles.splice(i, 1);
                continue;
            }
            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    _updateSwingFx(dt) {
        if (!this.swingFx || this.swingFx.length === 0) return;
        for (let i = this.swingFx.length - 1; i >= 0; i--) {
            const fx = this.swingFx[i];
            fx.timer -= dt;
            if (fx.timer <= 0) this.swingFx.splice(i, 1);
        }
    }

    _drawProjectiles(ctx) {
        if (!this.projectiles || this.projectiles.length === 0) return;
        ctx.save();
        for (const p of this.projectiles) {
            ctx.translate(Math.round(p.x), Math.round(p.y));
            ctx.rotate(p.angle);
            // shaft
            ctx.fillStyle = '#a07040';
            ctx.fillRect(-5, -1, 10, 2);
            // head
            ctx.fillStyle = '#e8c870';
            ctx.fillRect(4, -1, 3, 2);
            // fletch
            ctx.fillStyle = '#5a3a20';
            ctx.fillRect(-6, -2, 2, 1);
            ctx.fillRect(-6, 1, 2, 1);
            ctx.rotate(-p.angle);
            ctx.translate(-Math.round(p.x), -Math.round(p.y));
        }
        ctx.restore();
    }

    _drawSwingFx(ctx) {
        if (!this.swingFx || this.swingFx.length === 0) return;
        for (const fx of this.swingFx) {
            const t = 1 - (fx.timer / fx.total);
            const radius = 14 + t * 44;
            const alpha = (1 - t) * 0.55;
            ctx.save();
            ctx.translate(Math.round(fx.x), Math.round(fx.y));
            // crescent ring
            ctx.strokeStyle = `rgba(255, 220, 130, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, radius, -Math.PI * 0.7, -Math.PI * 0.3);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255, 240, 200, ${alpha * 0.6})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, radius + 2, -Math.PI * 0.75, -Math.PI * 0.25);
            ctx.stroke();
            ctx.restore();
        }
    }

    _spawnDamageNumber(x, y, amount, opts = {}) {
        if (!amount || amount <= 0) return;
        const variant = opts.variant || 'enemy';
        const crit = !!opts.crit;
        // Slight horizontal jitter so stacked hits don't perfectly overlap.
        const jx = (Math.random() - 0.5) * 6;
        let text;
        if (variant === 'heal') text = `+${amount}`;
        else if (crit) text = `${amount}!`;
        else text = `${amount}`;
        this.damageNumbers.push({
            x: x + jx,
            y: y - 2,
            vy: -42 - Math.random() * 14,
            vx: jx * 1.4,
            text,
            variant,
            crit,
            timer: 0.7,
            maxTimer: 0.7,
            scale: crit ? 2 : 1,
        });
    }

    _updateDamageNumbers(dt) {
        if (!this.damageNumbers || this.damageNumbers.length === 0) return;
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.vy += 110 * dt;
            d.vx *= Math.pow(0.86, dt * 60);
            d.timer -= dt;
            if (d.timer <= 0) this.damageNumbers.splice(i, 1);
        }
    }

    _drawDamageNumbers(ctx) {
        if (!this.damageNumbers || this.damageNumbers.length === 0) return;
        const font = this.assets.pixelFont;
        for (const d of this.damageNumbers) {
            const t = 1 - d.timer / d.maxTimer;
            const alpha = d.timer > 0.18 ? 1 : Math.max(0, d.timer / 0.18);
            const popScale = t < 0.18 ? d.scale * (0.6 + (t / 0.18) * 0.4) : d.scale;
            const color = d.variant === 'player'
                ? '#ff6b6b'
                : d.variant === 'heal'
                    ? '#8dffc2'
                    : d.crit ? '#ffec80' : '#ffffff';
            const w = font.measure(d.text, popScale);
            const xOff = Math.round(d.x - w / 2);
            const yOff = Math.round(d.y);
            font.draw(ctx, d.text, xOff + 1, yOff + 1, { color: 'rgba(5, 8, 15, 0.85)', alpha, scale: popScale });
            font.draw(ctx, d.text, xOff, yOff, { color, alpha, scale: popScale });
        }
    }

    _drawLowHealthVignette(ctx) {
        if (this.lowHealthPulse <= 0) return;
        const intensity = this.lowHealthPulse;
        ctx.save();
        const grad = ctx.createRadialGradient(
            NATIVE_WIDTH / 2,
            NATIVE_HEIGHT / 2,
            Math.min(NATIVE_WIDTH, NATIVE_HEIGHT) * 0.22,
            NATIVE_WIDTH / 2,
            NATIVE_HEIGHT / 2,
            Math.max(NATIVE_WIDTH, NATIVE_HEIGHT) * 0.62,
        );
        grad.addColorStop(0, 'rgba(180, 30, 30, 0)');
        grad.addColorStop(1, `rgba(180, 30, 30, ${0.55 * intensity})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
        ctx.restore();
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

    _onComboTierReached(tier, worldX, worldY) {
        const tierNames = ['', 'GOOD!', 'GREAT!', 'LEGEND!'];
        const bonusXp = [0, 12, 30, 60][tier] || 0;
        const tierLabel = tierNames[tier] || '';
        this.toast = `COMBO ${tierLabel}`;
        this.toastTimer = 1.4;
        this.screenShake = Math.max(this.screenShake, 0.6 + tier * 0.25);
        this._playBeep(440 + tier * 160, 0.12, 'triangle', 0.12);
        this._playBeep(660 + tier * 180, 0.18, 'sine', 0.10);
        if (bonusXp > 0) this._awardXp(bonusXp, worldX, worldY - 12);
        // Legend tier also restores 1 HP as the headline payoff.
        if (tier >= 3 && this.player.health < this.player.maxHealth) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
        }
    }

    _awardXp(amount, worldX, worldY) {
        if (!amount) return;
        const xpMult = this.player.xpMultiplier || 1;
        const comboMult = this.player.comboXpMult ? this.player.comboXpMult() : 1;
        const boosted = Math.max(1, Math.round(amount * xpMult * comboMult));
        const comboBonus = comboMult > 1;
        this.xpPopups.push({
            x: worldX,
            y: worldY,
            vy: -22,
            text: comboBonus ? `+${boosted} XP!` : `${boosted} XP`,
            timer: comboBonus ? 1.1 : 0.9,
            maxTimer: comboBonus ? 1.1 : 0.9,
            isCombo: comboBonus,
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

        // Expanding golden ring pulses outward from the player as a fanfare.
        this.levelUpRings = [
            { x: this.player.cx, y: this.player.cy - 8, t: 0, maxT: 0.9 },
            { x: this.player.cx, y: this.player.cy - 8, t: -0.12, maxT: 0.9 },
            { x: this.player.cx, y: this.player.cy - 8, t: -0.24, maxT: 0.9 },
        ];
        // Confetti-style sparkle burst around the player.
        this._spawnParticles(this.player.cx, this.player.cy - 6, {
            count: 32,
            angle: -Math.PI / 2,
            spread: Math.PI * 2,
            minSpeed: 60,
            maxSpeed: 160,
            life: 0.9,
            color: '#ffe78a',
            size: 2,
        });

        // Triumphant chord.
        this._playBeep(523, 0.18, 'triangle', 0.18);
        this._playBeep(659, 0.22, 'triangle', 0.16);
        this._playBeep(784, 0.28, 'sine', 0.18);
        this._playBeep(1047, 0.36, 'sine', 0.14);
    }

    _updateLevelProgressFx(dt) {
        if (this.xpPopups && this.xpPopups.length) {
            const magnetR = this.player?.pickupRadius || 0;
            const pcx = this.player?.cx ?? 0;
            const pcy = this.player?.cy ?? 0;
            for (let i = this.xpPopups.length - 1; i >= 0; i--) {
                const p = this.xpPopups[i];
                p.timer -= dt;
                // Soul Magnet: popups past base radius drift toward the player.
                if (magnetR > 32) {
                    const dx = pcx - p.x;
                    const dy = pcy - p.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    if (dist < magnetR * 1.6) {
                        const pull = 130 * dt;
                        p.x += (dx / dist) * pull;
                        p.y += (dy / dist) * pull;
                    } else {
                        p.y += p.vy * dt;
                        p.vy += 14 * dt;
                    }
                } else {
                    p.y += p.vy * dt;
                    p.vy += 14 * dt;
                }
                if (p.timer <= 0) this.xpPopups.splice(i, 1);
            }
        }

        if (this.levelUpAnim) {
            this.levelUpAnim.timer -= dt;
            if (this.levelUpAnim.timer <= 0) this.levelUpAnim = null;
        }

        this.levelUpFlash = Math.max(0, this.levelUpFlash - dt * 2.8);
        if (this.levelUpRings && this.levelUpRings.length) {
            for (let i = this.levelUpRings.length - 1; i >= 0; i--) {
                this.levelUpRings[i].t += dt;
                if (this.levelUpRings[i].t >= this.levelUpRings[i].maxT) {
                    this.levelUpRings.splice(i, 1);
                }
            }
        }
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
        if (this.bossDefeated?.sandworm && !this.hasBoat) {
            if (this.currentRealmId === 'driftmere' && this.boatman) {
                return { x: this.boatman.cx, y: this.boatman.y - 8 };
            }
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
        const sideQuestNpc = this._getTrackedSideQuestNpc();
        if (sideQuestNpc) return { x: sideQuestNpc.cx, y: sideQuestNpc.y - 10 };
        return null;
    }

    _currentObjectiveText() {
        if (!this.hasTalkedToElara) {
            return this.currentRealmId === 'driftmere'
                ? 'TALK TO ELARA'
                : 'RETURN TO DRIFTMERE AND FIND ELARA';
        }
        if (this.bossDefeated?.sandworm && !this.hasBoat) {
            return this.currentRealmId === 'driftmere'
                ? 'SPEAK TO THE BOATMAN AT TIDEBREAK CAMP'
                : 'RETURN TO DRIFTMERE AND SPEAK TO THE BOATMAN';
        }
        if (this.currentRealmId !== 'frontier' && (!this.hasReachedCanyons || !this.hasReachedSaltFlats || !this.hasReachedTropics || !this.hasLevelUpAbility)) {
            return 'ENTER THE AMBERWAKE GATE';
        }
        if (this.bossState === 'preparing') return 'THE GROUND SHAKES BENEATH YOUR FEET';
        if (this.bossState === 'fighting') return 'DEFEAT THE SAND WORM';
        if (this.bossState === 'defeated') return 'THE AMBERWAKE IS FREE';
        if (!this.hasLevelUpAbility) return 'EXPLORE THE AREA AND OPEN THE TREASURE CHEST TO UNLOCK LEVELING UP';
        if (this.pillars.length > 0 && !this._allPillarsDestroyed()) {
            const done = this.pillars.length - this._pillarsRemaining();
            return `DESTROY THE MAGICAL PILLARS ${done}/${this.pillars.length}`;
        }
        const readyNpc = this._getReadyQuestNpc();
        if (readyNpc) return `SIDE QUEST READY: ${readyNpc.name.toUpperCase()}`;
        const activeNpc = this._getTrackedSideQuestNpc();
        if (activeNpc) {
            const progress = this._npcQuestProgress(activeNpc.effect || {});
            return `${activeNpc.name.toUpperCase()}: ${progress.text}`;
        }
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
        this._drawNpcQuestMarkers(ctx);

        if (this.elara && !this.hasTalkedToElara) this._drawElaraMarker(ctx);
        this._drawProjectiles(ctx);
        this._drawSwingFx(ctx);
        this._drawParticles(ctx);
        this._drawLevelUpRings(ctx);
        this._drawXpPopups(ctx);
        this._drawDamageNumbers(ctx);
        this.camera.end(ctx);

        if (this.started) this._drawLowHealthVignette(ctx);
        if (this.started) this._drawHUD(ctx);
        if (this.started && this.levelUpFlash > 0) {
            ctx.fillStyle = `rgba(255, 244, 184, ${this.levelUpFlash * 0.55})`;
            ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
        }
        if (this.started && this.levelUpAnim) this._drawLevelUpBanner(ctx);
        const nearbyNpc = this._getNearbyNpc();
        if (this.started && !this.dialog && !this.rewardPopup && !this.worldMapOpen && !this.deathState) {
            if (this._playerNearElara()) {
                this._drawInteractPrompt(ctx, 'E: TALK TO ELARA');
            } else if (this._playerNearTombstone()) {
                this._drawInteractPrompt(ctx, 'E: SAVE · RESTORE HP');
            } else if (this._playerNearBoatman()) {
                const label = this.bossDefeated.sandworm
                    ? 'E: TALK TO BOATMAN'
                    : 'E: TALK · DEFEAT SANDWORM FIRST';
                this._drawInteractPrompt(ctx, label);
            } else if (nearbyNpc) {
                this._drawInteractPrompt(ctx, this._npcInteractLabel(nearbyNpc));
            } else if (this.ridingBoat) {
                this._drawInteractPrompt(ctx, 'E: STEP ASHORE');
            } else if (this._playerNearBoat()) {
                this._drawInteractPrompt(ctx, 'E: BOARD ROWBOAT');
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
            !nearbyNpc &&
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
            !nearbyNpc &&
            !this._playerNearTreasureChest()
        ) {
            const shrine = this._getNearbyShrine();
            const nearFont = this._getNearbyAetherFont();
            if (shrine) {
                const label = shrine.ready ? shrine.prompt : `${shrine.label} · ${Math.ceil(shrine.cooldown)}S`;
                this._drawInteractPrompt(ctx, label);
            } else if (nearFont) {
                const label = nearFont.ready
                    ? nearFont.prompt
                    : `AETHER FONT · ${Math.ceil(nearFont.cooldown)}S`;
                this._drawInteractPrompt(ctx, label);
            } else {
                const altar = this._getNearbyMnemoforge();
                if (altar) {
                    const label = altar.used ? 'E: RE-TEMPER · -20% NEXT-LEVEL XP' : altar.prompt;
                    this._drawInteractPrompt(ctx, label);
                } else {
                    const stone = this._getNearbyLoreStone();
                    if (stone) this._drawInteractPrompt(ctx, stone.read ? 'E: RE-READ MARKER' : stone.prompt);
                }
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
            !nearbyNpc &&
            !this._playerNearTreasureChest()
        ) {
            const portal = this._getNearbyPortal();
            if (portal) {
                this._drawInteractPrompt(ctx, portal.prompt);
                // Also float a smaller "E: ENTER" banner directly above the
                // portal so the player sees the prompt connect to the gate
                // they're standing in front of -- the bottom-of-screen prompt
                // alone wasn't drawing the eye for first-time players.
                // Source: P0-4 from 2026-04-26 playtest meta-analysis.
                this._drawPortalProximityBadge(ctx, portal);
            }
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
        // PAUSED indicator on the canvas itself, drawn behind the DOM
        // pause-overlay (which sits at z-index 6 and dims the page).
        // Without this, the canvas just freezes silently and players think
        // the game has hung. Source: P0-1 from 2026-04-26 playtest meta.
        if (this.paused && this.started) this._drawPausedIndicator(ctx);
        this._drawFrame(ctx);
    }

    _drawPausedIndicator(ctx) {
        const font = this.assets?.pixelFont;
        if (!font) return;
        // Soft dim under the text so it reads against busy backgrounds.
        ctx.fillStyle = 'rgba(4, 7, 16, 0.42)';
        ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

        const label = 'PAUSED';
        const scale = 3;
        const lw = font.measure(label, scale);
        const x = Math.round((NATIVE_WIDTH - lw) / 2);
        const y = Math.round(NATIVE_HEIGHT / 2 - 18);
        // Drop shadow then bright body so the word reads even with the
        // settings panel overlay covering most of the page.
        font.draw(ctx, label, x + 1, y + 1, { color: 'rgba(0, 0, 0, 0.7)', scale });
        font.draw(ctx, label, x, y, { color: '#ffe78a', scale });
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

        if (this.boatman) {
            drawables.push({
                sortY: this.boatman.sortY,
                draw: () => this.boatman.draw(ctx),
            });
        }

        for (const npc of (this.npcs || [])) {
            drawables.push({
                sortY: npc.sortY,
                draw: () => npc.draw(ctx),
            });
        }

        if (this.boat) {
            drawables.push({
                sortY: this.boat.sortY,
                draw: () => this.boat.draw(ctx),
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

        for (const pillar of this.pillars) {
            drawables.push({
                sortY: pillar.sortY,
                draw: () => pillar.draw(ctx),
            });
        }

        for (const stone of this.loreStones) {
            drawables.push({ sortY: stone.sortY, draw: () => stone.draw(ctx) });
        }
        for (const shrine of this.shrines) {
            drawables.push({ sortY: shrine.sortY, draw: () => shrine.draw(ctx) });
        }
        for (const font of (this.aetherFonts || [])) {
            drawables.push({ sortY: font.sortY, draw: () => font.draw(ctx) });
        }
        for (const altar of (this.mnemoforges || [])) {
            drawables.push({ sortY: altar.sortY, draw: () => altar.draw(ctx) });
        }
        for (const shard of (this.boneglassShards || [])) {
            drawables.push({ sortY: shard.y, draw: () => this._drawBoneglassShard(ctx, shard) });
        }
        for (const crystal of this.crystals) {
            drawables.push({ sortY: crystal.sortY, draw: () => crystal.draw(ctx) });
        }

        for (const portal of this.portals) {
            drawables.push({
                sortY: portal.sortY,
                draw: () => portal.draw(ctx),
            });
        }

        if (!this.ridingBoat) {
            drawables.push({
                sortY: this.player.y + this.player.h,
                draw: () => this.player.draw(ctx),
            });
        }

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
        const img = this._getCurrentDialogImage();
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
            if (def && this.player.canSpend(def.id, this.bossDefeated)) {
                if (this.player.spendSkillPoint(def.id, this.bossDefeated)) {
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
        const columnWidth = 80;
        const columnGap = 2;
        const totalColsW = columnWidth * SKILL_COLUMNS.length + columnGap * (SKILL_COLUMNS.length - 1);
        const colsStartX = Math.round((NATIVE_WIDTH - totalColsW) / 2);
        const colsY = 40;
        const colsH = 126;

        for (let c = 0; c < SKILL_COLUMNS.length; c++) {
            const columnKey = SKILL_COLUMNS[c];
            const x = colsStartX + c * (columnWidth + columnGap);
            this._drawSkillColumn(ctx, columnKey, x, colsY, columnWidth, colsH);
        }

        // description panel
        const def = this._currentSkillDef();
        const panelX = frameX + 4;
        const panelY = colsY + colsH + 4;
        const panelW = frameW - 8;
        const panelH = 38;
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
            font.draw(ctx, headline, panelX + 6, panelY + 3, {
                color: atMax ? '#ffe78a' : '#a6ffcb',
            });
            const descLines = this._wrapPixelText(def.desc, panelW - 12, 1).slice(0, 2);
            for (let i = 0; i < descLines.length; i++) {
                font.draw(ctx, descLines[i], panelX + 6, panelY + 12 + i * 8, { color: '#d6e9ff' });
            }
            const nextText = atMax
                ? 'NO MORE RANKS - SKILL MASTERED'
                : `NEXT: ${def.effectText(rank + 1)}`;
            font.draw(ctx, nextText, panelX + 6, panelY + 29, {
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
        const canSpend = this.player.canSpend(def.id, this.bossDefeated);
        const lockedByBoss = !!(def.requires && !(this.bossDefeated && this.bossDefeated[def.requires]));
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

        // icon (compact horizontal cell: icon on left, name+pips on right)
        const iconSize = 12;
        const iconX = x + 3;
        const iconY = y + Math.round((h - iconSize) / 2);
        const iconColor = upgradeFlashVisible ? '#ffe78a' : theme.accent;
        this._drawSkillIcon(ctx, def.icon, iconX, iconY, iconSize, iconColor, rank > 0);

        // name (right of icon)
        const textX = iconX + iconSize + 3;
        const nameColor = upgradeFlashVisible
            ? '#fff4bf'
            : (canSpend
                ? '#fff1b5'
                : (lockedByBoss
                    ? '#6a7a94'
                    : (atMax ? theme.accent : (rank > 0 ? '#d6e9ff' : '#97a8c4'))));
        const displayName = lockedByBoss ? '???' : def.name;
        font.draw(ctx, displayName, textX, y + 3, { color: nameColor });

        // rank pips (compact row under name, right side)
        const pipSize = 3;
        const pipGap = 1;
        const pipsX = textX;
        const pipsY = y + h - 5;
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

        // "NEW" / "MAX" / LOCK badge (right side, vertically centered)
        if (canSpend) {
            const flicker = Math.floor(this.gameTime * 5) % 2;
            if (flicker) {
                const tag = '!';
                const tw = font.measure(tag, 1);
                const bY = y + Math.round((h - 9) / 2);
                ctx.fillStyle = 'rgba(255, 231, 138, 0.95)';
                ctx.fillRect(x + w - tw - 4, bY, tw + 3, 9);
                font.draw(ctx, tag, x + w - tw - 3, bY + 1, { color: '#2a1d06' });
            }
        } else if (atMax) {
            const tag = 'M';
            const tw = font.measure(tag, 1);
            const bY = y + Math.round((h - 9) / 2);
            ctx.fillStyle = theme.accent;
            ctx.fillRect(x + w - tw - 4, bY, tw + 3, 9);
            font.draw(ctx, tag, x + w - tw - 3, bY + 1, { color: '#0a1020' });
        } else if (lockedByBoss) {
            const bY = y + Math.round((h - 7) / 2);
            ctx.fillStyle = 'rgba(106, 122, 148, 0.6)';
            ctx.fillRect(x + w - 8, bY, 5, 7);
            ctx.fillStyle = 'rgba(12, 18, 34, 0.9)';
            ctx.fillRect(x + w - 7, bY + 3, 3, 3);
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

    _drawComboMeter(ctx) {
        const font = this.assets.pixelFont;
        const p = this.player;
        const combo = p.comboCount;
        const tier = p.comboTier;
        const tierNames = ['', 'GOOD!', 'GREAT!', 'LEGEND!'];
        const tierColors = ['#ffe78a', '#ffd27b', '#ff9e5a', '#ff6ec7'];
        const tierGlows = ['rgba(255,231,138,', 'rgba(255,180,90,', 'rgba(255,110,90,', 'rgba(255,110,199,'];
        const color = tierColors[Math.min(tier + 1, tierColors.length - 1)];
        const glow = tierGlows[Math.min(tier + 1, tierGlows.length - 1)];

        // Hit pulse gives the number a scale bump + brightness flash.
        const pulse = p.comboPulse || 0;
        const tierPulse = p.comboTierPulse || 0;
        const scale = tier >= 1 ? 2 : 1;

        // Layout block: sits below the top-left HUD panel so it doesn't cover cooldown pips.
        const hudPanelBottom = this.hasLevelUpAbility ? 60 : 50;
        const centerX = 58;
        const baseY = hudPanelBottom + 6;

        // Backing glow plate — thicker as tier rises, pulses on each hit.
        const plateW = 96;
        const plateH = tier >= 1 ? 22 : 16;
        const plateX = centerX - plateW / 2;
        const plateY = baseY - 4;
        const plateAlpha = 0.62 + pulse * 0.2;
        ctx.fillStyle = `rgba(7, 11, 19, ${plateAlpha})`;
        ctx.fillRect(plateX, plateY, plateW, plateH);
        ctx.fillStyle = `${glow}${0.25 + pulse * 0.35 + tierPulse * 0.3})`;
        ctx.fillRect(plateX, plateY, plateW, plateH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(plateX + 0.5, plateY + 0.5, plateW - 1, plateH - 1);

        // Radial ring flash when a new tier is reached.
        if (tierPulse > 0) {
            const rings = 3;
            for (let i = 0; i < rings; i++) {
                const t = Math.max(0, tierPulse - i * 0.12);
                if (t <= 0) continue;
                const r = (1 - t) * 26 + 8;
                ctx.strokeStyle = `${glow}${t * 0.6})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(centerX, baseY + 6, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Big combo number — scale 2 once a real tier is hit.
        const numText = `x${combo}`;
        const numScale = scale + (pulse > 0 ? Math.min(0.6, pulse * 0.6) : 0);
        // font.measure only supports int scale; measure at base scale and extrapolate.
        const baseW = font.measure(numText, scale);
        const drawX = Math.round(centerX - baseW / 2);
        const drawY = tier >= 1 ? baseY - 1 : baseY;
        // Shadow for legibility over bright tier colors.
        font.draw(ctx, numText, drawX + 1, drawY + 1, { color: 'rgba(0,0,0,0.55)', scale });
        font.draw(ctx, numText, drawX, drawY, { color, scale });

        // Tier label beneath number.
        if (tier >= 1) {
            const label = tierNames[tier];
            const labelW = font.measure(label, 1);
            const labelY = drawY + 9 * scale + 1;
            const labelColor = tierPulse > 0.1
                ? (Math.floor(this.gameTime * 16) % 2 ? '#fff4bf' : color)
                : color;
            font.draw(ctx, label, centerX - labelW / 2 + 1, labelY + 1, { color: 'rgba(0,0,0,0.5)' });
            font.draw(ctx, label, centerX - labelW / 2, labelY, { color: labelColor });
        }

        // Decay ticker — thin bar at the bottom of the plate shrinks as combo ages.
        const decay = Math.max(0, Math.min(1, p.comboTimer / 2.5));
        const decayY = plateY + plateH - 2;
        const decayW = Math.round((plateW - 4) * decay);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(plateX + 2, decayY, plateW - 4, 1);
        ctx.fillStyle = color;
        ctx.fillRect(plateX + 2, decayY, decayW, 1);

        // Edge glow at SAVAGE+ (tier 2+) — subtle vignette around the whole screen.
        if (tier >= 2) {
            const edgeAlpha = 0.05 + tierPulse * 0.08 + Math.sin(this.gameTime * 6) * 0.01;
            ctx.fillStyle = `${glow}${edgeAlpha})`;
            ctx.fillRect(0, 0, NATIVE_WIDTH, 4);
            ctx.fillRect(0, NATIVE_HEIGHT - 4, NATIVE_WIDTH, 4);
            ctx.fillRect(0, 0, 4, NATIVE_HEIGHT);
            ctx.fillRect(NATIVE_WIDTH - 4, 0, 4, NATIVE_HEIGHT);
        }
    }

    _updateLoreReadout() {
        const r = this.activeLoreReadout;
        if (!r) return;
        // Decay via frame delta; the HUD is called once per render so use gameTime delta tracking.
        const now = this.gameTime;
        if (r._last === undefined) r._last = now;
        const dt = Math.max(0, now - r._last);
        r._last = now;
        r.timer = Math.max(0, r.timer - dt);
        if (r.timer <= 0) this.activeLoreReadout = null;
    }

    _drawLoreReadout(ctx) {
        const r = this.activeLoreReadout;
        if (!r) return;
        const font = this.assets.pixelFont;
        const maxW = NATIVE_WIDTH - 40;
        const bodyLines = this._wrapPixelText(r.body, maxW - 10, 1);
        const titleW = font.measure(r.title, 1);
        const bodyLineWidths = bodyLines.map((l) => font.measure(l, 1));
        const contentW = Math.max(titleW + 12, ...bodyLineWidths, 120) + 12;
        const panelW = Math.min(NATIVE_WIDTH - 20, contentW);
        const panelH = 8 + bodyLines.length * 8 + 4;
        const panelX = Math.round((NATIVE_WIDTH - panelW) / 2);
        const panelY = NATIVE_HEIGHT - panelH - 60;

        const fadeIn = r.timer > 4.7 ? (5 - r.timer) / 0.3 : 1;
        const fadeOut = r.timer < 0.5 ? r.timer / 0.5 : 1;
        const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(7, 11, 19, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = 'rgba(169, 240, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

        const titleX = panelX + Math.round((panelW - titleW) / 2);
        font.draw(ctx, r.title, titleX + 1, panelY + 3, { color: 'rgba(0,0,0,0.7)' });
        font.draw(ctx, r.title, titleX, panelY + 2, { color: '#ffd88a' });
        bodyLines.forEach((line, i) => {
            const lw = bodyLineWidths[i];
            const lx = panelX + Math.round((panelW - lw) / 2);
            font.draw(ctx, line, lx, panelY + 12 + i * 8, { color: '#e8f4ff' });
        });
        ctx.restore();
    }

    _drawShrineBuffs(ctx) {
        const p = this.player;
        const active = [];
        if (p.buffMightTimer > 0) active.push({ label: 'MIGHT', color: '#ff9a70', t: p.buffMightTimer });
        if (p.buffSwiftTimer > 0) active.push({ label: 'SWIFT', color: '#8effec', t: p.buffSwiftTimer });
        if (p.buffWardTimer > 0)  active.push({ label: 'WARD',  color: '#dff6ff', t: p.buffWardTimer });
        if (!active.length) return;

        const font = this.assets.pixelFont;
        // Stack buff pills vertically along the right edge, below the OBJECTIVE panel,
        // so they never overlap the player or the bottom hint / prompt row.
        const pillW = 52;
        const pillH = 10;
        const gap = 3;
        const rightEdge = NATIVE_WIDTH - 6;
        const baseY = this.bossState === 'fighting' ? 46 : 68;

        active.forEach((buff, i) => {
            const x = rightEdge - pillW;
            const y = baseY + i * (pillH + gap);
            ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
            ctx.fillRect(x, y, pillW, pillH);
            ctx.strokeStyle = buff.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, pillW - 1, pillH - 1);

            const label = `${buff.label} ${Math.ceil(buff.t)}S`;
            const lw = font.measure(label, 1);
            font.draw(ctx, label, x + Math.round((pillW - lw) / 2), y + 2, { color: buff.color });

            const frac = Math.max(0, Math.min(1, buff.t / 25));
            ctx.fillStyle = buff.color;
            ctx.fillRect(x + 1, y + pillH - 1, Math.round((pillW - 2) * frac), 1);
        });
    }

    _drawBossHpBar(ctx) {
        const boss = this.sandwormBoss;
        if (!boss) return;
        const font = this.assets.pixelFont;
        const ratio = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
        const barW = 180;
        const barH = 10;
        const x = Math.round((NATIVE_WIDTH - barW) / 2);
        const y = NATIVE_HEIGHT - 22;
        const pulse = Math.sin(this.gameTime * 6) * 0.5 + 0.5;

        // Backdrop frame
        ctx.fillStyle = 'rgba(7, 11, 19, 0.92)';
        ctx.fillRect(x - 3, y - 12, barW + 6, barH + 16);
        ctx.strokeStyle = `rgba(255, 120, 120, ${0.5 + pulse * 0.3})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 2.5, y - 11.5, barW + 5, barH + 15);

        // Label
        font.draw(ctx, 'SAND WORM', x, y - 10, { color: '#ffd2d2' });

        // Bar interior
        ctx.fillStyle = '#1a0e0e';
        ctx.fillRect(x, y, barW, barH);
        const fillW = Math.max(0, Math.round((barW - 2) * ratio));
        if (fillW > 0) {
            // Red gradient with hot streak
            const grad = ctx.createLinearGradient(x, y, x + fillW, y);
            grad.addColorStop(0, '#7a1010');
            grad.addColorStop(0.6, '#e23c3c');
            grad.addColorStop(1, '#ffb07a');
            ctx.fillStyle = grad;
            ctx.fillRect(x + 1, y + 1, fillW, barH - 2);
            ctx.fillStyle = `rgba(255, 230, 200, ${0.18 + pulse * 0.22})`;
            ctx.fillRect(x + 1, y + 1, fillW, 2);
            if (this.bossHpFlash > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, this.bossHpFlash * 2.2)})`;
                ctx.fillRect(x + 1, y + 1, fillW, barH - 2);
            }
        }

        // Pips every 25% for visual cadence
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        for (let p = 1; p < 4; p++) {
            ctx.fillRect(x + Math.round((barW * p) / 4), y, 1, barH);
        }
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

    _drawCooldownPip(ctx, x, y, label, fill, color) {
        const w = 38;
        const h = 6;
        const f = Math.max(0, Math.min(1, fill));
        const ready = f >= 1;
        const font = this.assets.pixelFont;
        font.draw(ctx, label, x, y - 7, { color: ready ? color : '#75809a' });
        ctx.fillStyle = '#0c0f17';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = ready ? color : '#3a3142';
        ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * f), h - 2);
        if (ready) {
            const pulse = 0.4 + 0.6 * (Math.sin(this.gameTime * 7) * 0.5 + 0.5);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.35 + pulse * 0.4;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            ctx.globalAlpha = 1;
        } else {
            ctx.strokeStyle = '#1d2230';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
    }

    _drawLevelUpRings(ctx) {
        if (!this.levelUpRings || !this.levelUpRings.length) return;
        for (const ring of this.levelUpRings) {
            if (ring.t < 0) continue;
            const u = Math.max(0, Math.min(1, ring.t / ring.maxT));
            const r = 6 + u * 54;
            const alpha = (1 - u) * 0.85;
            ctx.strokeStyle = `rgba(255, 231, 138, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, r - 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    _drawXpPopups(ctx) {
        if (!this.xpPopups || this.xpPopups.length === 0) return;
        const font = this.assets.pixelFont;
        for (const p of this.xpPopups) {
            const t = 1 - Math.max(0, p.timer / p.maxTimer);
            const alpha = p.timer > 0.25 ? 1 : Math.max(0, p.timer / 0.25);
            const scale = p.isCombo ? 2 : 1;
            const yOff = Math.round(p.y - t * (p.isCombo ? 8 : 4));
            const xOff = Math.round(p.x - font.measure(p.text, scale) / 2);
            const color = p.isCombo ? '#ffd27b' : '#a6ffcb';
            font.draw(ctx, p.text, xOff + 1, yOff + 1, { color: 'rgba(5, 10, 20, 0.75)', alpha, scale });
            font.draw(ctx, p.text, xOff, yOff, { color, alpha, scale });
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

    _drawNpcQuestMarkers(ctx) {
        if (!this.npcs || !this.npcs.length) return;
        const font = this.assets.pixelFont;
        const pulse = Math.sin(this.gameTime * 5) * 0.5 + 0.5;
        for (const npc of this.npcs) {
            const state = this._npcQuestState(npc);
            if (!state || state === 'complete') continue;
            const label = state === 'ready' ? '!' : '?';
            const color = state === 'ready' ? '#ffe78a' : npc.accent;
            const x = Math.round(npc.cx - 4);
            const y = Math.round(npc.y - 13 - pulse * 2);
            ctx.fillStyle = `rgba(7, 11, 19, ${0.72 + pulse * 0.12})`;
            ctx.fillRect(x, y, 8, 9);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, 7, 8);
            font.draw(ctx, label, x + 2, y + 2, { color });
        }
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

    _drawPortalProximityBadge(ctx, portal) {
        const font = this.assets?.pixelFont;
        if (!font || !portal) return;
        const label = 'E: ENTER';
        const textW = font.measure(label, 1);
        const boxW = textW + 10;
        // Drawn in screen space (no camera transform here -- the caller has
        // already ended the camera). Convert portal.cx/y to screen coords.
        const screenX = Math.round(portal.cx - this.camera.x - boxW / 2);
        const screenY = Math.round(portal.y - this.camera.y - 14);
        const pulse = Math.sin(this.gameTime * 5.5) * 0.5 + 0.5;

        ctx.fillStyle = `rgba(7, 11, 19, ${0.72 + pulse * 0.08})`;
        ctx.fillRect(screenX, screenY, boxW, 10);
        ctx.strokeStyle = `rgba(142, 255, 236, ${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX + 0.5, screenY + 0.5, boxW - 1, 9);
        font.draw(ctx, label, screenX + 5, screenY + 2, { color: '#8effec' });
    }

    _drawHUD(ctx) {
        const font = this.assets.pixelFont;
        const biomeInfo = this.world.getBiomeInfoAtWorld(this.player.cx, this.player.cy);
        const regionLabel = biomeInfo.hudLabel || this.world.realmLabel;

        // Left panel: title + sword icon on right side, HP below, cooldown pips at bottom
        const panelH = this.hasLevelUpAbility ? 54 : 44;
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

        // Combo meter is now drawn as a big centered widget — see _drawComboMeter.

        // Cooldown pips: attack on the left, dash on the right.
        const pipY = 6 + panelH - 9;
        this._drawCooldownPip(ctx, 12, pipY, 'ATK',
            1 - (this.player.attackCooldownTimer / Math.max(0.0001, this.player.attackCooldown)),
            '#ffd773');
        this._drawCooldownPip(ctx, 56, pipY, 'DSH',
            1 - (this.player.dashCooldownTimer / Math.max(0.0001, this.player.dashCooldown)),
            '#8effec');

        const objectiveLines = this._wrapPixelText(this._currentObjectiveText(), 122);
        // 'ESC MENU' reminder is only useful before the player has opened the
        // menu once. After they've used Esc, they know it's there, and the HUD
        // gets cleaner without the redundant prompt. Source: P1-6 from the
        // 2026-04-26 playtest meta-analysis (hardcore-sim HUD critique).
        const actionRows = this.hasOpenedPauseMenu ? [] : ['ESC MENU'];
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

        if (this.bossState === 'fighting' && this.sandwormBoss) {
            this._drawBossHpBar(ctx);
        }

        if (this.player.comboCount >= 3) this._drawComboMeter(ctx);

        this._drawShrineBuffs(ctx);
        this._updateLoreReadout();
        this._drawLoreReadout(ctx);

        // Hide the bottom hint when any other bottom-of-screen element could overlap it:
        // the enemy nameplate (bottom-right) or an interact prompt (y = NATIVE_HEIGHT - 40).
        const enemyNearby = this.enemies.some((enemy) => {
            if (!enemy.isAlive()) return false;
            const dx = enemy.cx - this.player.cx;
            const dy = enemy.cy - this.player.cy;
            return dx * dx + dy * dy <= 88 * 88;
        });
        // Once any enemy has come within range of the player, latch the
        // hasSeenEnemy flag so the combat-coaching line stays appropriate
        // even after the enemy moves out of range or dies.
        if (enemyNearby) this.hasSeenEnemy = true;
        const interactPromptActive = !this.dialog && !this.rewardPopup && !this.worldMapOpen && !this.deathState && (
            this._playerNearElara() ||
            this._playerNearTombstone() ||
            this._playerNearBoatman() ||
            this._playerNearBoat() ||
            this.ridingBoat ||
            (this._playerNearTreasureChest() && !this.hasLevelUpAbility) ||
            this._getNearbyShrine() ||
            this._getNearbyAetherFont() ||
            this._getNearbyMnemoforge() ||
            this._getNearbyLoreStone() ||
            this._getNearbyNpc() ||
            this._getNearbyPortal() ||
            this.activeLoreReadout
        );
        const bossActive = this.bossState === 'preparing' || this.bossState === 'fighting';
        if (this.settings.showHints && this.gameTime < 10 && !enemyNearby && !interactPromptActive && !bossActive) {
            const alpha = this.gameTime < 7 ? 1 : 1 - (this.gameTime - 7) / 3;
            // Show the combat hint only after the player has actually been
            // near an enemy. Pre-encounter, combat coaching is noise --
            // the first hint should only teach movement.
            const showCombatLine = this.hasSeenEnemy;
            const bannerH = showCombatLine ? 18 : 10;
            ctx.fillStyle = `rgba(7, 11, 19, ${0.78 * alpha})`;
            ctx.fillRect(42, NATIVE_HEIGHT - (showCombatLine ? 24 : 16), 174, bannerH);
            font.draw(ctx, 'MOVE WITH WASD OR ARROWS.', 48, NATIVE_HEIGHT - (showCombatLine ? 21 : 13), { color: '#eef6ff', alpha });
            if (showCombatLine) {
                font.draw(ctx, 'STEP IN, STRIKE, BACK OFF.', 48, NATIVE_HEIGHT - 12, { color: '#97b6cf', alpha });
            }
        }

        if (this.toastTimer > 0 && this.toast) {
            const maxToastW = NATIVE_WIDTH - 20;
            const lines = this._wrapPixelText(this.toast, maxToastW - 12, 1);
            const lineWidths = lines.map((l) => font.measure(l, 1));
            const toastWidth = Math.max(90, Math.max(...lineWidths) + 12);
            const toastH = 4 + lines.length * 8;
            const toastX = Math.round((NATIVE_WIDTH - toastWidth) / 2);
            const beaconActive = this.hasLevelUpAbility && this.player.skillPoints > 0;
            const toastY = beaconActive ? 72 : (this.hasLevelUpAbility ? 56 : 42);
            ctx.fillStyle = 'rgba(7, 11, 19, 0.82)';
            ctx.fillRect(toastX, toastY, toastWidth, toastH);
            lines.forEach((line, i) => {
                const lw = lineWidths[i];
                font.draw(ctx, line, toastX + Math.round((toastWidth - lw) / 2), toastY + 2 + i * 8, { color: '#8df7d2' });
            });
        }

        // Important toast: center-screen, 2x scale, drop shadow, high-contrast
        // background. Used for must-read prompts (e.g. boatman gating). Source:
        // P0-5 from 2026-04-26 playtest meta-analysis.
        if (this.importantToastTimer > 0 && this.importantToast) {
            const scale = 2;
            const maxW = NATIVE_WIDTH - 24;
            const lines = this._wrapPixelText(this.importantToast, maxW - 24, scale);
            const lineWidths = lines.map((l) => font.measure(l, scale));
            const widest = Math.max(...lineWidths);
            const boxW = Math.max(140, widest + 24);
            const lineH = 18;
            const boxH = 12 + lines.length * lineH;
            const boxX = Math.round((NATIVE_WIDTH - boxW) / 2);
            const boxY = Math.round((NATIVE_HEIGHT - boxH) / 2 - 8);
            // Solid backing for legibility against any biome background.
            ctx.fillStyle = 'rgba(2, 4, 10, 0.92)';
            ctx.fillRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
            ctx.fillStyle = '#3a1410';
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeStyle = '#ffb866';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
            lines.forEach((line, i) => {
                const lw = lineWidths[i];
                const lineX = boxX + Math.round((boxW - lw) / 2);
                const lineY = boxY + 6 + i * lineH;
                font.draw(ctx, line, lineX + 1, lineY + 1, { color: 'rgba(0, 0, 0, 0.7)', scale });
                font.draw(ctx, line, lineX, lineY, { color: '#ffe78a', scale });
            });
        }

        for (const enemy of this.enemies) {
            if (!enemy.isAlive()) continue;
            if (enemy === this.sandwormBoss) continue;
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
        if (this.hasMap) {
            for (const npc of (this.npcs || [])) {
                const questState = this._npcQuestState(npc);
                markers.push({
                    type: questState === 'ready' ? 'npcReady' : questState === 'complete' ? 'npcComplete' : 'npc',
                    x: npc.cx,
                    y: npc.cy,
                    label: npc.name,
                });
            }
        }
        return markers;
    }

    _markerRevealed(marker) {
        if (!this.fogMask || !this.world) return true;
        // Always reveal the player's current location markers (camp/portal) — they're
        // navigational anchors and the player can't exist in an unseen tile anyway.
        // For everything else, show only once the pin's tile has been explored.
        if (marker.type === 'camp' || marker.type === 'portal') return true;
        const TILE_SZ = 16;
        const col = Math.max(0, Math.min(this.world.cols - 1, Math.floor(marker.x / TILE_SZ)));
        const row = Math.max(0, Math.min(this.world.rows - 1, Math.floor(marker.y / TILE_SZ)));
        return !!this.fogMask[row * this.world.cols + col];
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

        // Fog veil over unseen tiles (sample per minimap pixel).
        if (this.fogMask) {
            for (let py = 0; py < innerH; py++) {
                const row = Math.min(this.world.rows - 1, Math.floor(py * rowsPerPx));
                for (let px = 0; px < innerW; px++) {
                    const col = Math.min(this.world.cols - 1, Math.floor(px * colsPerPx));
                    if (this.fogMask[row * this.world.cols + col]) continue;
                    ctx.fillStyle = 'rgba(8, 6, 14, 0.88)';
                    ctx.fillRect(x + 2 + px, y + 2 + py, 1, 1);
                }
            }
        }

        for (const marker of this._getMapMarkers()) {
            if (!this._markerRevealed(marker)) continue;
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
                            : marker.type === 'npcReady'
                                ? '#ffe78a'
                                : marker.type === 'npcComplete'
                                    ? '#7b8b94'
                                    : marker.type === 'npc'
                                        ? '#f6a7ff'
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
        const worldMode = this.worldMapMode === 'world';
        const sourceW = worldMode ? cache.width : Math.min(cache.width, 34 * 16);
        const sourceH = worldMode ? cache.height : Math.min(cache.height, 26 * 16);
        const srcX = worldMode ? 0 : Math.max(0, Math.min(cache.width - sourceW, Math.round(this.player.cx - sourceW / 2)));
        const srcY = worldMode ? 0 : Math.max(0, Math.min(cache.height - sourceH, Math.round(this.player.cy - sourceH / 2)));
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cache, srcX, srcY, sourceW, sourceH, frameX, frameY, frameW, frameH);
        ctx.imageSmoothingEnabled = prevSmoothing;
        // Fog veil: obscure tiles the player has never seen.
        this._drawFogOverlay(ctx, frameX, frameY, frameW, frameH, srcX, srcY, sourceW, sourceH);

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
            lighthouse: '#fff2a0',
            wreck: '#c4a078',
            watchtower: '#c8ffb0',
            stones: '#bba67a',
            desert: '#ffd27b',
            ruins: '#f6a7ff',
            burnt: '#ff7a4a',
            steppe: '#c8b06a',
            npc: '#f6a7ff',
            npcReady: '#ffe78a',
            npcComplete: '#7b8b94',
        };
        for (const marker of this._getMapMarkers()) {
            if (marker.x < srcX || marker.x > srcX + sourceW || marker.y < srcY || marker.y > srcY + sourceH) continue;
            if (!this._markerRevealed(marker)) continue; // fog hides undiscovered pins
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

        const subtitle = worldMode
            ? `WORLD MAP · ${this.world.realmLabel}`
            : `RELATIVE MAP · ${biomeInfo.label}`;
        const sw = font.measure(subtitle, 1);
        font.draw(ctx, subtitle, Math.round((NATIVE_WIDTH - sw) / 2), 18, { color: biomeInfo.accent || '#dff6ff' });

        const foot = worldMode ? 'M: RELATIVE VIEW · ENTER: CLOSE' : 'M: WORLD VIEW · ENTER: CLOSE';
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
            hasTalkedToBoatman: this.hasTalkedToBoatman,
            hasSeenEnemy: this.hasSeenEnemy,
            hasOpenedPauseMenu: this.hasOpenedPauseMenu,
            hasMap: this.hasMap,
            hasBoat: this.hasBoat,
            hasLevelUpAbility: this.hasLevelUpAbility,
            bossDefeated: { ...(this.bossDefeated || {}) },
            enemyKillCounts: this._normalizeEnemyKillCounts(this.enemyKillCounts),
            gameTime: this.gameTime,
            settings: {
                showHints: this.settings.showHints,
                soundEnabled: this.settings.soundEnabled,
            },
        };
    }

    _updateEnemySpawners(dt) {
        if (!this.hasTalkedToElara || !this.enemySpawnNodes.length) return;
        // Pause ambient respawns during the boss sequence so the fight stays focused.
        if (this.bossState === 'preparing' || this.bossState === 'fighting') return;

        const aliveEnemies = this.enemies.filter((enemy) => enemy.isAlive());
        const globalCap = this.currentRealmId === 'frontier' ? 16 : 10;
        if (aliveEnemies.length >= globalCap) return;

        for (const node of this.enemySpawnNodes) {
            if (node.kind === 'goliath' && !this.goliathsUnlocked) continue;
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
            if (aliveEnemies.length >= globalCap) break;

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
            // Hard-stop one-shot SFX so they don't keep playing silently in the
            // background (they'd resume audibly the next time sound is enabled).
            for (const sfx of [this.deathSound, this.textSound, this.swordSlashSound]) {
                if (!sfx) continue;
                try {
                    sfx.pause();
                    sfx.currentTime = 0;
                } catch (_) { /* ignore */ }
            }
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

        const clampVolume = (value) => Math.max(0, Math.min(1, Number(value) || 0));
        const startVolume = clampVolume(audio.volume);
        const targetVolume = clampVolume(target);
        const startTime = performance.now();

        const finish = () => {
            audio.volume = targetVolume;
            if (options.pauseOnComplete) audio.pause();
            if (options.resetOnComplete) {
                try { audio.currentTime = 0; } catch (_) { /* ignore */ }
            }
            if (typeof options.restoreVolume === 'number') {
                audio.volume = clampVolume(options.restoreVolume);
            }
            this.audioFadeHandles[key] = 0;
        };

        if (duration <= 0 || Math.abs(startVolume - targetVolume) < 0.001) {
            finish();
            return;
        }

        const tick = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            audio.volume = clampVolume(startVolume + (targetVolume - startVolume) * t);

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
