import { DIR, PLAYER_FRAME_H, PLAYER_FRAME_W, PLAYER_SPEED } from './constants.js?v=20260414-no-bridge-pass2';

export const MAX_PLAYER_LEVEL = 15;

export function xpToNextLevel(level) {
    // Amberwake curve: L1->2=46, L5->6=350, L10->11=1000, L14->15=1736
    return level * 40 + level * level * 6;
}

// Central skill catalog. Append entries here to add new nodes — the UI auto-lays
// them out in their column and every derived stat flows through computeSkillBonuses.
// `requires: 'sandworm'` marks a capstone that only unlocks after defeating the
// Sand Worm boss (gated via Game.bossDefeated.sandworm).
export const SKILLS = [
    // BODY column — survival
    {
        id: 'hearty',
        name: 'HEARTY',
        column: 'body',
        row: 0,
        maxRank: 3,
        icon: 'heart',
        short: 'MAX HP',
        desc: 'RAISE MAX HP BY 1.',
        effectText: (rank) => `MAX HP /${rank}`,
    },
    {
        id: 'regen',
        name: 'REGEN',
        column: 'body',
        row: 1,
        maxRank: 1,
        icon: 'regen',
        short: 'HEAL OVER TIME',
        desc: 'RECOVER 1 HP EVERY 12 SECONDS.',
        effectText: () => 'HEAL /12S',
    },
    {
        id: 'wardskin',
        name: 'WARD SKIN',
        column: 'body',
        row: 2,
        maxRank: 2,
        icon: 'heart',
        short: 'ABSORB HITS',
        desc: 'ABSORB 1 DAMAGE FROM EACH HIT PER RANK.',
        effectText: (rank) => `ABSORB -${rank}`,
    },
    {
        id: 'worm_heart',
        name: 'WORM HEART',
        column: 'body',
        row: 3,
        maxRank: 1,
        icon: 'heart',
        short: 'SECOND WIND',
        desc: 'MAX HP +3. ONCE PER FIGHT A FATAL HIT HEALS 2 HP INSTEAD.',
        effectText: () => 'WORM HEART',
        requires: 'sandworm',
    },

    // BLADE column — offense
    {
        id: 'edge',
        name: 'EDGE',
        column: 'blade',
        row: 0,
        maxRank: 3,
        icon: 'edge',
        short: 'DAMAGE',
        desc: 'RAISE DAMAGE BY 1.',
        effectText: (rank) => `DAMAGE /${rank}`,
    },
    {
        id: 'swiftstrike',
        name: 'SWIFTCUT',
        column: 'blade',
        row: 1,
        maxRank: 1,
        icon: 'bolt',
        short: 'FASTER SLASH',
        desc: 'COOLDOWN BETWEEN SWINGS DROPS BY 30 PERCENT.',
        effectText: () => 'COOLDOWN 0.7X',
    },
    {
        id: 'keenedge',
        name: 'KEEN EDGE',
        column: 'blade',
        row: 2,
        maxRank: 3,
        icon: 'edge',
        short: 'CRIT CHANCE',
        desc: 'EACH RANK GIVES 8 PERCENT CHANCE TO DEAL DOUBLE DAMAGE.',
        effectText: (rank) => `CRIT +${rank * 8}%`,
    },
    {
        id: 'lifedrinker',
        name: 'DRINKER',
        column: 'blade',
        row: 3,
        maxRank: 1,
        icon: 'heart',
        short: 'HEAL ON KILL',
        desc: 'KILLS HAVE A 18 PERCENT CHANCE TO RESTORE 1 HP.',
        effectText: () => 'LIFESTEAL 18%',
    },
    {
        id: 'amberwake',
        name: 'AMBERWAKE',
        column: 'blade',
        row: 4,
        maxRank: 1,
        icon: 'bolt',
        short: '5TH HIT CLEAVES',
        desc: 'EVERY FIFTH SWING RELEASES A 360 DEGREE CLEAVE.',
        effectText: () => '5TH SWING CLEAVE',
        requires: 'sandworm',
    },

    // SPIRIT column — mobility / utility
    {
        id: 'soullink',
        name: 'SOUL LINK',
        column: 'spirit',
        row: 0,
        maxRank: 2,
        icon: 'link',
        short: 'MORE XP',
        desc: 'XP GAINED FROM ENEMIES RISES BY 25 PERCENT.',
        effectText: (rank) => `XP /${1 + rank * 0.25}X`,
    },
    {
        id: 'swiftfoot',
        name: 'SWIFT FOOT',
        column: 'spirit',
        row: 1,
        maxRank: 2,
        icon: 'wing',
        short: 'MOVE FASTER',
        desc: 'MOVEMENT SPEED RISES BY 10 PERCENT.',
        effectText: (rank) => `SPEED /${1 + rank * 0.1}X`,
    },
    {
        id: 'soulmagnet',
        name: 'SOUL MAGNET',
        column: 'spirit',
        row: 2,
        maxRank: 2,
        icon: 'link',
        short: 'PICKUP REACH',
        desc: 'XP ORBS DRIFT TOWARD YOU FROM FAR AWAY.',
        effectText: (rank) => `REACH +${rank * 24}`,
    },
    {
        id: 'twinstep',
        name: 'TWIN STEP',
        column: 'spirit',
        row: 3,
        maxRank: 1,
        icon: 'wing',
        short: 'DOUBLE DASH',
        desc: 'HOLD A SECOND DASH CHARGE IN RESERVE.',
        effectText: () => 'DASH /2',
    },
    {
        id: 'amber_echo',
        name: 'AMBER ECHO',
        column: 'spirit',
        row: 4,
        maxRank: 1,
        icon: 'bolt',
        short: 'KILL HASTE',
        desc: 'KILLS GRANT 25 PERCENT MOVE AND ATTACK HASTE FOR 1.2 SECONDS.',
        effectText: () => 'KILL HASTE',
        requires: 'sandworm',
    },
];

export const SKILL_COLUMNS = ['body', 'blade', 'spirit'];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

function computeSkillBonuses(skills) {
    const hearty = skills.hearty || 0;
    const edge = skills.edge || 0;
    const swiftfoot = skills.swiftfoot || 0;
    const swiftstrike = skills.swiftstrike || 0;
    const soullink = skills.soullink || 0;
    const regen = skills.regen || 0;
    const keenedge = skills.keenedge || 0;
    const lifedrinker = skills.lifedrinker || 0;
    const wardskin = skills.wardskin || 0;
    const soulmagnet = skills.soulmagnet || 0;
    const twinstep = skills.twinstep || 0;
    const amberwake = skills.amberwake || 0;
    const wormheart = skills.worm_heart || 0;
    const amberecho = skills.amber_echo || 0;
    return {
        maxHealthBonus: hearty * 1 + wormheart * 3,
        attackDamageBonus: edge * 1,
        speedMult: 1 + swiftfoot * 0.1,
        cooldownMult: swiftstrike > 0 ? 0.7 : 1,
        xpMult: 1 + soullink * 0.25,
        regenPerSec: regen > 0 ? (1 / 12) : 0,
        critChance: keenedge * 0.08,
        lifestealChance: lifedrinker > 0 ? 0.18 : 0,
        wardAbsorb: wardskin,
        pickupRadius: 32 + soulmagnet * 24,
        maxDashCharges: 1 + twinstep,
        amberwake: amberwake > 0,
        wormHeart: wormheart > 0,
        amberEcho: amberecho > 0,
    };
}

function directionToAngle(direction) {
    switch (direction) {
        case DIR.LEFT: return Math.PI;
        case DIR.UP: return -Math.PI / 2;
        case DIR.DOWN: return Math.PI / 2;
        default: return 0;
    }
}

export class Player {
    constructor(x, y, assets) {
        this.x = x;
        this.y = y;
        this.w = PLAYER_FRAME_W;
        this.h = PLAYER_FRAME_H;

        this.baseSpeed = PLAYER_SPEED;
        this.speed = PLAYER_SPEED;
        this.direction = DIR.RIGHT;
        this.facingLeft = false;
        this.moving = false;

        this.hitbox = { ox: 11, oy: 26, w: 10, h: 10 };

        this.playerSheet = assets.playerSheet;
        this.slashSheet = assets.slashSheet;

        this.walkTimer = 0;
        this.walkFrame = 0;
        this.echoTrail = [];
        this.echoTimer = 0;

        this.baseMaxHealth = 5;
        this.maxHealth = 5;
        this.health = 5;
        this.invulnTimer = 0;
        this.damagePush = { x: 0, y: 0, timer: 0 };

        this.attackDuration = 0.28;
        this.baseAttackCooldown = 0.36;
        this.attackCooldown = 0.36;
        this.attackTimer = 0;
        this.attackCooldownTimer = 0;
        this.attackDirection = DIR.RIGHT;
        this.attackVictims = new Set();

        this.baseAttackDamage = 1;
        this.attackDamage = 1;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = xpToNextLevel(this.level);

        // Dash ability: Shift or F triggers a short high-speed burst with i-frames.
        this.dashDuration = 0.16;
        this.dashCooldown = 0.85;
        this.dashSpeed = 260;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.dashDir = { x: 1, y: 0 };
        this._dashJustStarted = false;

        this.skills = {};
        this.skillPoints = 0;
        this.xpMultiplier = 1;
        this.regenPerSec = 0;
        this._regenAcc = 0;

        // Expanded bonus fields (populated by applySkillEffects).
        this.critChance = 0;
        this.lifestealChance = 0;
        this.wardAbsorb = 0;
        this.pickupRadius = 32;
        this.maxDashCharges = 1;
        this.dashCharges = 1;
        this.dashRechargeTimer = 0;
        this.hasAmberwake = false;
        this.hasWormHeart = false;
        this.hasAmberEcho = false;
        this.wormHeartReady = false;
        this.wormHeartCooldown = 0;

        // Combat flow trackers (combo, amberwake cleave counter, kill-haste buff).
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboPulse = 0;
        this.comboTier = 0;
        this.comboTierPulse = 0;
        this.swingCount = 0;
        this.pendingAmberwakeCleave = false;
        this.killHasteTimer = 0;

        this.applySkillEffects({ heal: false });
    }

    applySkillEffects({ heal = false } = {}) {
        const b = computeSkillBonuses(this.skills);
        const prevMax = this.maxHealth;
        this.maxHealth = this.baseMaxHealth + b.maxHealthBonus;
        const maxDelta = this.maxHealth - prevMax;
        if (maxDelta > 0) this.health += maxDelta;
        this.health = Math.max(0, Math.min(this.maxHealth, this.health));
        if (heal) this.health = this.maxHealth;

        this.attackDamage = this.baseAttackDamage + b.attackDamageBonus;
        this.speed = this.baseSpeed * b.speedMult;
        this.attackCooldown = this.baseAttackCooldown * b.cooldownMult;
        this.xpMultiplier = b.xpMult;
        this.regenPerSec = b.regenPerSec;

        this.critChance = b.critChance;
        this.lifestealChance = b.lifestealChance;
        this.wardAbsorb = b.wardAbsorb;
        this.pickupRadius = b.pickupRadius;
        const prevMaxDash = this.maxDashCharges;
        this.maxDashCharges = b.maxDashCharges;
        if (this.maxDashCharges > prevMaxDash) {
            this.dashCharges = Math.min(this.maxDashCharges, this.dashCharges + (this.maxDashCharges - prevMaxDash));
        } else {
            this.dashCharges = Math.min(this.maxDashCharges, this.dashCharges);
        }
        this.hasAmberwake = b.amberwake;
        this.hasWormHeart = b.wormHeart;
        this.hasAmberEcho = b.amberEcho;
        if (this.hasWormHeart && this.wormHeartCooldown <= 0) this.wormHeartReady = true;
    }

    getSkillRank(id) {
        return this.skills[id] || 0;
    }

    canSpend(id, bossDefeated = null) {
        const def = SKILL_BY_ID[id];
        if (!def) return false;
        if (this.skillPoints <= 0) return false;
        if (this.getSkillRank(id) >= def.maxRank) return false;
        if (def.requires && !(bossDefeated && bossDefeated[def.requires])) return false;
        return true;
    }

    spendSkillPoint(id, bossDefeated = null) {
        if (!this.canSpend(id, bossDefeated)) return false;
        this.skills[id] = (this.skills[id] || 0) + 1;
        this.skillPoints -= 1;
        this.applySkillEffects();
        return true;
    }

    gainXp(amount) {
        if (amount <= 0 || this.level >= MAX_PLAYER_LEVEL) return { levelsGained: 0, pointsGained: 0 };

        this.xp += amount;
        let levelsGained = 0;
        while (this.level < MAX_PLAYER_LEVEL && this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level += 1;
            this.skillPoints += 1;
            this.health = this.maxHealth;
            this.xpToNext = xpToNextLevel(this.level);
            levelsGained += 1;
        }
        if (this.level >= MAX_PLAYER_LEVEL) {
            this.xp = 0;
            this.xpToNext = 1;
        }
        return { levelsGained, pointsGained: levelsGained };
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    getHitbox() {
        return {
            x: this.x + this.hitbox.ox,
            y: this.y + this.hitbox.oy,
            w: this.hitbox.w,
            h: this.hitbox.h,
        };
    }

    update(dt, input, world) {
        this.invulnTimer = Math.max(0, this.invulnTimer - dt);
        this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
        this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);

        // Combo decay: any gap longer than 2.5s after a hit resets the streak.
        if (this.comboTimer > 0) {
            this.comboTimer = Math.max(0, this.comboTimer - dt);
            if (this.comboTimer === 0) {
                this.comboCount = 0;
                this.comboTier = 0;
            }
        }
        if (this.comboPulse > 0) this.comboPulse = Math.max(0, this.comboPulse - dt * 5);
        if (this.comboTierPulse > 0) this.comboTierPulse = Math.max(0, this.comboTierPulse - dt * 1.6);

        if (this.killHasteTimer > 0) this.killHasteTimer = Math.max(0, this.killHasteTimer - dt);

        if (this.wormHeartCooldown > 0) {
            this.wormHeartCooldown = Math.max(0, this.wormHeartCooldown - dt);
            if (this.wormHeartCooldown === 0 && this.hasWormHeart) this.wormHeartReady = true;
        }

        // Recharge extra dash charges (twinstep). Charge comes back over dashCooldown
        // once the player has stopped dashing.
        if (this.dashCharges < this.maxDashCharges && this.dashTimer <= 0) {
            this.dashRechargeTimer += dt;
            if (this.dashRechargeTimer >= this.dashCooldown) {
                this.dashCharges = Math.min(this.maxDashCharges, this.dashCharges + 1);
                this.dashRechargeTimer = 0;
            }
        } else if (this.dashCharges >= this.maxDashCharges) {
            this.dashRechargeTimer = 0;
        }

        if (!this.healingBlocked && this.regenPerSec > 0 && this.health > 0 && this.health < this.maxHealth) {
            this._regenAcc += dt * this.regenPerSec;
            while (this._regenAcc >= 1) {
                this._regenAcc -= 1;
                this.health = Math.min(this.maxHealth, this.health + 1);
            }
        } else {
            this._regenAcc = 0;
        }

        if (this.damagePush.timer > 0) {
            this._move(this.damagePush.x * dt, this.damagePush.y * dt, world);
            this.damagePush.timer = Math.max(0, this.damagePush.timer - dt);
        }

        const move = input.getMovement();
        this.moving = move.x !== 0 || move.y !== 0;

        if (this.moving) {
            if (Math.abs(move.x) >= Math.abs(move.y) && move.x !== 0) {
                this.direction = move.x < 0 ? DIR.LEFT : DIR.RIGHT;
                this.facingLeft = move.x < 0;
            } else if (move.y !== 0) {
                this.direction = move.y < 0 ? DIR.UP : DIR.DOWN;
            }
        }

        // Dash input: ShiftLeft / ShiftRight / KeyF. Queues a dash in the current
        // movement direction, or the facing direction if standing still.
        const dashRequested =
            input.wasPressed('ShiftLeft') ||
            input.wasPressed('ShiftRight') ||
            input.wasPressed('KeyF');
        if (dashRequested && this.dashCharges > 0 && this.dashCooldownTimer <= 0 && this.dashTimer <= 0 && this.attackTimer <= 0) {
            this.dashCharges = Math.max(0, this.dashCharges - 1);
            this.dashRechargeTimer = 0;
            let ddx = move.x;
            let ddy = move.y;
            if (ddx === 0 && ddy === 0) {
                switch (this.direction) {
                    case DIR.LEFT: ddx = -1; break;
                    case DIR.RIGHT: ddx = 1; break;
                    case DIR.UP: ddy = -1; break;
                    case DIR.DOWN: ddy = 1; break;
                    default: ddx = 1; break;
                }
            }
            const mag = Math.hypot(ddx, ddy) || 1;
            this.dashDir = { x: ddx / mag, y: ddy / mag };
            this.dashTimer = this.dashDuration;
            this.dashCooldownTimer = this.dashCooldown;
            this.invulnTimer = Math.max(this.invulnTimer, this.dashDuration + 0.1);
            this._dashJustStarted = true;
            if (this.dashDir.x < -0.05) this.facingLeft = true;
            else if (this.dashDir.x > 0.05) this.facingLeft = false;
        }

        if ((input.wasPressed('Space') || input.wasPressed('KeyJ') || input.wasLeftClicked()) && this.attackCooldownTimer <= 0 && this.dashTimer <= 0) {
            this._startAttack();
        }

        // Dash overrides normal movement for its duration, leaves a rapid echo trail,
        // and keeps granting i-frames.
        if (this.dashTimer > 0) {
            this.dashTimer = Math.max(0, this.dashTimer - dt);
            const dx = this.dashDir.x * this.dashSpeed * dt;
            const dy = this.dashDir.y * this.dashSpeed * dt;
            this._move(dx, dy, world);

            this.echoTimer += dt;
            if (this.echoTimer >= 0.025) {
                this.echoTimer = 0;
                this.echoTrail.push({
                    x: this.x,
                    y: this.y,
                    frame: this._currentFrame(),
                    facingLeft: this.facingLeft,
                    alpha: 0.5,
                });
                if (this.echoTrail.length > 10) this.echoTrail.shift();
            }
        } else {
            const haste = this.killHasteTimer > 0 ? 1.25 : 1;
            const movementScale = (this.attackTimer > 0 ? 0.72 : 1) * haste;
            if (this.moving) {
                const dx = move.x * this.speed * movementScale * dt;
                const dy = move.y * this.speed * movementScale * dt;
                this._move(dx, dy, world);

                this.echoTimer += dt;
                if (this.echoTimer >= 0.08) {
                    this.echoTimer = 0;
                    this.echoTrail.push({
                        x: this.x,
                        y: this.y,
                        frame: this._currentFrame(),
                        facingLeft: this.facingLeft,
                        alpha: 0.16,
                    });
                    if (this.echoTrail.length > 6) this.echoTrail.shift();
                }

                this.walkTimer += dt * 10;
                this.walkFrame = 1 + (Math.floor(this.walkTimer) % 4);
            } else {
                this.echoTimer = 0;
                this.walkTimer = 0;
                this.walkFrame = 0;
            }
        }

        if (this.attackTimer > 0) {
            this.attackTimer = Math.max(0, this.attackTimer - dt);
            if (this.attackTimer <= 0) {
                this.attackVictims.clear();
            }
        }

        for (let i = this.echoTrail.length - 1; i >= 0; i--) {
            this.echoTrail[i].alpha -= dt * 0.65;
            if (this.echoTrail[i].alpha <= 0) this.echoTrail.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const echo of this.echoTrail) {
            this.playerSheet.drawFrame(ctx, echo.frame, 0, echo.x, echo.y, {
                alpha: echo.alpha,
                flipX: echo.facingLeft,
                originX: this.w / 2,
                originY: this.h / 2,
            });
        }

        const bodyFrame = this._currentFrame();
        const blinkOff = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 18) % 2 === 0;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
        ctx.fillRect(Math.round(this.x + 8), Math.round(this.y + 33), 16, 4);

        if (this.attackTimer > 0 && this.attackDirection === DIR.UP) {
            this._drawSlash(ctx);
        }

        if (!blinkOff) {
            this.playerSheet.drawFrame(ctx, bodyFrame, 0, this.x, this.y, {
                flipX: this.facingLeft,
                originX: this.w / 2,
                originY: this.h / 2,
            });
        }

        if (this.attackTimer > 0 && this.attackDirection !== DIR.UP) {
            this._drawSlash(ctx);
        }
    }

    takeDamage(amount, knockback = { x: 0, y: 0 }) {
        if (this.invulnTimer > 0) return false;

        const absorbed = Math.min(amount, this.wardAbsorb);
        const taken = Math.max(0, amount - absorbed);
        const wouldBeFatal = taken >= this.health;

        // Worm Heart: one-time fatal negate per 30s cooldown.
        if (wouldBeFatal && this.hasWormHeart && this.wormHeartReady) {
            this.wormHeartReady = false;
            this.wormHeartCooldown = 30;
            this.health = Math.min(this.maxHealth, 2);
            this.invulnTimer = 1.4;
            this.damagePush = { x: knockback.x * 0.5, y: knockback.y * 0.5, timer: 0.16 };
            this.wormHeartJustTriggered = true;
            // Reset combo when rescued.
            this.comboCount = 0;
            this.comboTimer = 0;
            this.comboTier = 0;
            return true;
        }

        this.health = Math.max(0, this.health - taken);
        this.invulnTimer = 1.0;
        this.damagePush = {
            x: knockback.x,
            y: knockback.y,
            timer: 0.14,
        };
        // Any incoming damage resets the combo chain.
        this.comboCount = 0;
        this.comboTimer = 0;

        return true;
    }

    getAttackRect() {
        if (this.attackTimer <= 0) return null;

        const progress = 1 - this.attackTimer / this.attackDuration;
        if (progress < 0.18 || progress > 0.72) return null;

        switch (this.attackDirection) {
            case DIR.LEFT:
                return { x: this.x - 14, y: this.y + 12, w: 24, h: 18 };
            case DIR.UP:
                return { x: this.x + 8, y: this.y - 12, w: 16, h: 24 };
            case DIR.DOWN:
                return { x: this.x + 8, y: this.y + 18, w: 16, h: 22 };
            default:
                return { x: this.x + 18, y: this.y + 12, w: 24, h: 18 };
        }
    }

    canHitEnemy(enemyId) {
        return !this.attackVictims.has(enemyId);
    }

    registerAttackHit(enemyId) {
        this.attackVictims.add(enemyId);
    }

    _startAttack() {
        const haste = this.killHasteTimer > 0 ? 0.8 : 1;
        this.attackTimer = this.attackDuration * haste;
        this.attackCooldownTimer = this.attackCooldown * haste;
        this.attackVictims.clear();
        this._attackJustStarted = true;

        this.swingCount = (this.swingCount || 0) + 1;
        this.pendingAmberwakeCleave = this.hasAmberwake && (this.swingCount % 5 === 0);

        this.attackDirection = this.direction;
        if (this.attackDirection === DIR.LEFT) this.facingLeft = true;
        if (this.attackDirection === DIR.RIGHT) this.facingLeft = false;
    }

    // Called by game.js on every registered hit. Extends combo streak for 2.5s.
    // Returns the tier that was newly reached, or -1 if no tier change.
    registerComboHit() {
        const prevTier = this.comboTier;
        this.comboCount = Math.min(99, (this.comboCount || 0) + 1);
        this.comboTimer = 2.5;
        this.comboPulse = 1;
        const c = this.comboCount;
        const newTier = c >= 50 ? 3 : c >= 25 ? 2 : c >= 10 ? 1 : 0;
        this.comboTier = newTier;
        if (newTier > prevTier) {
            this.comboTierPulse = 1;
            return newTier;
        }
        return -1;
    }

    comboDamageMult() {
        const c = this.comboCount || 0;
        if (c >= 50) return 1.15;
        if (c >= 25) return 1.10;
        if (c >= 10) return 1.05;
        return 1;
    }

    comboXpMult() {
        // Scales XP gained with current combo so long streaks feel rewarding.
        switch (this.comboTier) {
            case 3: return 1.6;
            case 2: return 1.35;
            case 1: return 1.15;
            default: return 1;
        }
    }

    // Called when an enemy is slain. Triggers amber echo haste if unlocked.
    onEnemySlain() {
        if (this.hasAmberEcho) {
            this.killHasteTimer = Math.min(2.5, this.killHasteTimer + 1.2);
        }
    }

    _drawSlash(ctx) {
        const progress = 1 - this.attackTimer / this.attackDuration;
        const frame = Math.min(3, Math.floor(progress * 4));
        const angle = directionToAngle(this.attackDirection);
        const offset = this._slashOffset();

        this.slashSheet.drawFrame(
            ctx,
            frame,
            0,
            this.x + offset.x - 24,
            this.y + offset.y - 24,
            {
                alpha: 0.92,
                rotation: angle,
                originX: 24,
                originY: 24,
            },
        );
    }

    _slashOffset() {
        switch (this.attackDirection) {
            case DIR.LEFT:
                return { x: 8, y: 19 };
            case DIR.UP:
                return { x: 17, y: 10 };
            case DIR.DOWN:
                return { x: 16, y: 28 };
            default:
                return { x: 24, y: 19 };
        }
    }

    _currentFrame() {
        if (this.attackTimer > 0) return 4;
        return this.moving ? this.walkFrame : 0;
    }

    _move(dx, dy, world) {
        const hitbox = this.getHitbox();
        if (!world.collides(hitbox.x + dx, hitbox.y, hitbox.w, hitbox.h)) {
            this.x += dx;
        }

        const movedHitbox = this.getHitbox();
        if (!world.collides(movedHitbox.x, movedHitbox.y + dy, movedHitbox.w, movedHitbox.h)) {
            this.y += dy;
        }
    }
}
