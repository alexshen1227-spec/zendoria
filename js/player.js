import { DIR, PLAYER_FRAME_H, PLAYER_FRAME_W, PLAYER_SPEED } from './constants.js?v=20260414-no-bridge-pass2';

export const MAX_PLAYER_LEVEL = 10;

export function xpToNextLevel(level) {
    // Smooth curve: 6, 10, 14, 20, 26, 34, 42, 52, 62
    return 4 + level * 2 + Math.floor((level * level) / 2);
}

// Central skill catalog. Append entries here to add new nodes — the UI auto-lays
// them out in their column and every derived stat flows through computeSkillBonuses.
export const SKILLS = [
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
        name: 'SWIFT STRIKE',
        column: 'blade',
        row: 1,
        maxRank: 1,
        icon: 'bolt',
        short: 'FASTER SLASH',
        desc: 'COOLDOWN BETWEEN SWINGS DROPS BY 30 PERCENT.',
        effectText: () => 'COOLDOWN 0.7X',
    },
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
    return {
        maxHealthBonus: hearty * 1,
        attackDamageBonus: edge * 1,
        speedMult: 1 + swiftfoot * 0.1,
        cooldownMult: swiftstrike > 0 ? 0.7 : 1,
        xpMult: 1 + soullink * 0.25,
        regenPerSec: regen > 0 ? (1 / 12) : 0,
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
    }

    getSkillRank(id) {
        return this.skills[id] || 0;
    }

    canSpend(id) {
        const def = SKILL_BY_ID[id];
        if (!def) return false;
        return this.skillPoints > 0 && this.getSkillRank(id) < def.maxRank;
    }

    spendSkillPoint(id) {
        if (!this.canSpend(id)) return false;
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
        if (dashRequested && this.dashCooldownTimer <= 0 && this.dashTimer <= 0 && this.attackTimer <= 0) {
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
            const movementScale = this.attackTimer > 0 ? 0.72 : 1;
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

        this.health = Math.max(0, this.health - amount);
        this.invulnTimer = 1.0;
        this.damagePush = {
            x: knockback.x,
            y: knockback.y,
            timer: 0.14,
        };

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
        this.attackTimer = this.attackDuration;
        this.attackCooldownTimer = this.attackCooldown;
        this.attackVictims.clear();
        this._attackJustStarted = true;

        this.attackDirection = this.direction;
        if (this.attackDirection === DIR.LEFT) this.facingLeft = true;
        if (this.attackDirection === DIR.RIGHT) this.facingLeft = false;
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
