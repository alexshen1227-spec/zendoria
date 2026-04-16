import { DIR } from './constants.js?v=20260414-no-bridge-pass2';

let NEXT_ENEMY_ID = 1;

function dirToVector(direction) {
    switch (direction) {
        case DIR.LEFT: return { x: -1, y: 0 };
        case DIR.RIGHT: return { x: 1, y: 0 };
        case DIR.UP: return { x: 0, y: -1 };
        default: return { x: 0, y: 1 };
    }
}

function frame(col, row = 0) {
    return { col, row };
}

function chooseDuration([min, max]) {
    return min + Math.random() * (max - min);
}

function resolveSequenceFrame(frames, progress) {
    const safeFrames = frames?.length ? frames : [frame(0, 0)];
    const clamped = Math.max(0, Math.min(0.999, progress));
    return safeFrames[Math.min(safeFrames.length - 1, Math.floor(clamped * safeFrames.length))];
}

export const ENEMY_CONFIGS = {
    blightworm: {
        kind: 'blightworm',
        src: 'assets/sprites/enemies/blightworm_sheet.png',
        frameW: 32,
        frameH: 24,
        hudLabel: 'BLIGHTWORM',
        toastLabel: 'BLIGHTWORM',
        maxHealth: 3,
        xpReward: 3,
        wanderSpeed: 14,
        chaseSpeed: 30,
        aggroRadius: 92,
        loseRadius: 130,
        contactDamage: 1,
        contactPush: { x: 22, y: 16 },
        attackCooldown: 0.9,
        hurtDuration: 0.24,
        deathDuration: 0.34,
        knockbackSpeed: 58,
        knockbackDuration: 0.12,
        leashRadius: 52,
        hitbox: { x: 5, y: 10, w: 22, h: 12 },
        shadow: { x: 6, y: 15, w: 18, h: 4 },
        flashJitter: { x: 1.2, y: 0.8 },
        spawnSearch: { maxRadius: 72, step: 6 },
        idleDuration: [0.7, 1.4],
        wanderDuration: [0.7, 1.8],
        walkAnimSpeed: 7,
        chaseAnimSpeed: 11,
        animations: {
            idle: frame(0, 0),
            walk: [frame(0, 0), frame(1, 0), frame(2, 0), frame(3, 0)],
            hurt: [frame(1, 1), frame(2, 1)],
            death: [frame(1, 1), frame(2, 1), frame(3, 1)],
        },
    },
    sunscarab: {
        kind: 'sunscarab',
        src: 'assets/sprites/enemies/sunscarab_strip.png',
        frameW: 48,
        frameH: 32,
        hudLabel: 'SUNSCARAB',
        toastLabel: 'SUNSCARAB',
        maxHealth: 2,
        xpReward: 2,
        wanderSpeed: 18,
        chaseSpeed: 38,
        aggroRadius: 104,
        loseRadius: 148,
        contactDamage: 1,
        contactPush: { x: 24, y: 16 },
        attackCooldown: 0.8,
        hurtDuration: 0.26,
        deathDuration: 0.34,
        knockbackSpeed: 64,
        knockbackDuration: 0.12,
        leashRadius: 64,
        hitbox: { x: 8, y: 16, w: 32, h: 12 },
        shadow: { x: 10, y: 24, w: 26, h: 4 },
        flashJitter: { x: 1.4, y: 0.9 },
        spawnSearch: { maxRadius: 84, step: 6 },
        idleDuration: [0.55, 1.15],
        wanderDuration: [0.65, 1.45],
        walkAnimSpeed: 8,
        chaseAnimSpeed: 12,
        animations: {
            idle: frame(0, 0),
            walk: [frame(1, 0), frame(2, 0), frame(3, 0), frame(4, 0)],
            hurt: [frame(5, 0), frame(6, 0)],
        },
    },
    duneWarden: {
        kind: 'duneWarden',
        src: 'assets/sprites/enemies/dune_warden_strip.png',
        frameW: 40,
        frameH: 48,
        hudLabel: 'DUNE WARDEN',
        toastLabel: 'DUNE WARDEN',
        maxHealth: 4,
        xpReward: 6,
        wanderSpeed: 10,
        chaseSpeed: 21,
        aggroRadius: 116,
        loseRadius: 156,
        contactDamage: 1,
        contactPush: { x: 24, y: 18 },
        attackCooldown: 1.05,
        hurtDuration: 0.28,
        deathDuration: 0.36,
        knockbackSpeed: 52,
        knockbackDuration: 0.12,
        leashRadius: 60,
        hitbox: { x: 11, y: 18, w: 18, h: 26 },
        shadow: { x: 12, y: 44, w: 16, h: 3 },
        flashJitter: { x: 1.1, y: 0.8 },
        spawnSearch: { maxRadius: 90, step: 6 },
        idleDuration: [0.75, 1.35],
        wanderDuration: [0.75, 1.55],
        walkAnimSpeed: 5.5,
        chaseAnimSpeed: 7.5,
        animations: {
            idle: frame(0, 0),
            walk: [frame(1, 0), frame(2, 0)],
            hurt: [frame(3, 0), frame(4, 0)],
        },
    },
};

export function normalizeEnemyKind(kind) {
    return ENEMY_CONFIGS[kind] ? kind : 'blightworm';
}

export function createEnemy(kind, x, y, enemySheets) {
    const resolvedKind = normalizeEnemyKind(kind);
    const config = ENEMY_CONFIGS[resolvedKind];
    const sheet = enemySheets?.[resolvedKind] || null;
    return new Enemy(x, y, config, sheet);
}

export class Enemy {
    constructor(x, y, config, sheet) {
        this.id = NEXT_ENEMY_ID++;
        this.kind = config.kind;
        this.config = config;
        this.sheet = sheet;
        this.x = x;
        this.y = y;
        this.w = config.frameW;
        this.h = config.frameH;

        this.homeX = x;
        this.homeY = y;

        this.health = config.maxHealth;
        this.maxHealth = config.maxHealth;
        this.xpReward = config.xpReward ?? 1;
        this.hudLabel = config.hudLabel;
        this.toastLabel = config.toastLabel;

        this.state = 'idle';
        this.stateTimer = chooseDuration(config.idleDuration);
        this.animTimer = 0;
        this.frame = 0;
        this.facingLeft = false;

        this.move = { x: 0, y: 0 };
        this.biteCooldown = 0;
        this.flashTimer = 0;
        this.knockback = { x: 0, y: 0, timer: 0 };
        this.deathTimer = 0;
        this.stuckTimer = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    isAlive() {
        return this.state !== 'dead';
    }

    isTargetable() {
        return this.state !== 'dead' && this.state !== 'dying';
    }

    getHitbox() {
        const hitbox = this.config.hitbox;
        return {
            x: this.x + hitbox.x,
            y: this.y + hitbox.y,
            w: hitbox.w,
            h: hitbox.h,
        };
    }

    update(dt, player, world) {
        if (this.state === 'dead') return;

        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        this.flashTimer = Math.max(0, this.flashTimer - dt);

        if (this.knockback.timer > 0) {
            this._move(this.knockback.x * dt, this.knockback.y * dt, world);
            this.knockback.timer = Math.max(0, this.knockback.timer - dt);
        }

        if (this.state === 'dying') {
            this.deathTimer = Math.max(0, this.deathTimer - dt);
            if (this.deathTimer <= 0) this.state = 'dead';
            return;
        }

        const toPlayerX = player.cx - this.cx;
        const toPlayerY = player.cy - this.cy;
        const distSq = toPlayerX * toPlayerX + toPlayerY * toPlayerY;
        const chaseDistSq = this.config.aggroRadius * this.config.aggroRadius;
        const loseDistSq = this.config.loseRadius * this.config.loseRadius;

        if (this.state === 'hurt') {
            this.stateTimer = Math.max(0, this.stateTimer - dt);
            if (this.stateTimer <= 0) {
                this.state = distSq < chaseDistSq ? 'chase' : 'wander';
                this.stateTimer = chooseDuration(this.config.wanderDuration);
            }
        } else {
            if (distSq < chaseDistSq) {
                this.state = 'chase';
            } else if (this.state === 'chase' && distSq > loseDistSq) {
                this.state = 'wander';
                this.stateTimer = chooseDuration(this.config.wanderDuration);
            } else if (this.state === 'idle' || this.state === 'wander') {
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) this._pickNewWander();
            }
        }

        const prevX = this.x;
        const prevY = this.y;

        if (this.state === 'chase') {
            const invLen = 1 / Math.max(1, Math.hypot(toPlayerX, toPlayerY));
            this.move.x = toPlayerX * invLen;
            this.move.y = toPlayerY * invLen;
            this._move(this.move.x * this.config.chaseSpeed * dt, this.move.y * this.config.chaseSpeed * dt, world);
        } else if (this.state === 'wander') {
            this._move(this.move.x * this.config.wanderSpeed * dt, this.move.y * this.config.wanderSpeed * dt, world);
        } else {
            this.move.x = 0;
            this.move.y = 0;
        }

        if (Math.abs(this.move.x) > 0.05) this.facingLeft = this.move.x < 0;

        const moving = Math.abs(this.move.x) > 0.05 || Math.abs(this.move.y) > 0.05 || this.state === 'chase';
        const walkFrames = this.config.animations.walk;
        if (moving && this.state !== 'hurt') {
            this.animTimer += dt * (this.state === 'chase' ? this.config.chaseAnimSpeed : this.config.walkAnimSpeed);
            this.frame = Math.floor(this.animTimer) % walkFrames.length;
        } else if (this.state !== 'hurt') {
            this.frame = 0;
            this.animTimer = 0;
        }

        const movedDistance = Math.hypot(this.x - prevX, this.y - prevY);
        if (moving && movedDistance < 0.18) {
            this.stuckTimer += dt;
        } else {
            this.stuckTimer = 0;
        }

        if (this.stuckTimer > 0.35) {
            if (this.state === 'chase') {
                this._sidestepAroundObstacle(world);
            } else if (this.state === 'wander') {
                this._pickNewWander();
            }
            this.stuckTimer = 0;
        }

        if (this.biteCooldown <= 0 && this._overlaps(player.getHitbox())) {
            const pushX = toPlayerX === 0 ? 0 : toPlayerX / Math.abs(toPlayerX);
            const pushY = toPlayerY === 0 ? 0 : toPlayerY / Math.abs(toPlayerY);
            if (player.takeDamage(this.config.contactDamage, {
                x: pushX * this.config.contactPush.x,
                y: pushY * this.config.contactPush.y,
            })) {
                this.biteCooldown = this.config.attackCooldown;
            }
        }
    }

    takeHit(direction, damage = 1) {
        if (!this.isTargetable()) return false;

        this.health -= damage;
        this.flashTimer = 0.18;

        const push = dirToVector(direction);
        this.knockback = {
            x: push.x * this.config.knockbackSpeed,
            y: push.y * this.config.knockbackSpeed,
            timer: this.config.knockbackDuration,
        };

        if (this.health <= 0) {
            this.state = 'dying';
            this.deathTimer = this.config.deathDuration;
        } else {
            this.state = 'hurt';
            this.stateTimer = this.config.hurtDuration;
        }

        return true;
    }

    draw(ctx) {
        if (this.state === 'dead') return;

        const frameCoords = this._currentFrame();
        const shadow = this.config.shadow;
        const alpha = this.state === 'dying'
            ? Math.max(0.25, this.deathTimer / this.config.deathDuration)
            : 1;
        const flash = this.config.flashJitter;
        const jitterX = this.flashTimer > 0 ? (Math.random() * 2 - 1) * flash.x : 0;
        const jitterY = this.flashTimer > 0 ? (Math.random() * 2 - 1) * flash.y : 0;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(
            Math.round(this.x + shadow.x),
            Math.round(this.y + shadow.y),
            shadow.w,
            shadow.h,
        );

        if (!this.sheet) return;

        this.sheet.drawFrame(
            ctx,
            frameCoords.col,
            frameCoords.row,
            this.x + jitterX,
            this.y + jitterY,
            {
                alpha,
                flipX: this.facingLeft,
                originX: this.w / 2,
                originY: this.h / 2,
            },
        );
    }

    _currentFrame() {
        if (this.state === 'hurt') {
            const progress = 1 - (this.stateTimer / this.config.hurtDuration);
            return resolveSequenceFrame(this.config.animations.hurt, progress);
        }

        if (this.state === 'dying') {
            const deathFrames = this.config.animations.death?.length
                ? this.config.animations.death
                : [this.config.animations.hurt[this.config.animations.hurt.length - 1]];
            const progress = 1 - (this.deathTimer / this.config.deathDuration);
            return resolveSequenceFrame(deathFrames, progress);
        }

        const moving = Math.abs(this.move.x) > 0.05 || Math.abs(this.move.y) > 0.05 || this.state === 'chase';
        if (moving) {
            return this.config.animations.walk[this.frame];
        }

        return this.config.animations.idle;
    }

    _pickNewWander() {
        const roll = Math.random();
        if (roll < 0.25) {
            this.state = 'idle';
            this.stateTimer = chooseDuration(this.config.idleDuration);
            this.move.x = 0;
            this.move.y = 0;
            return;
        }

        this.state = 'wander';
        this.stateTimer = chooseDuration(this.config.wanderDuration);

        const angle = Math.random() * Math.PI * 2;
        this.move.x = Math.cos(angle);
        this.move.y = Math.sin(angle);
    }

    _sidestepAroundObstacle(world) {
        const step = 8;
        const sidesteps = [
            { x: -this.move.y * step, y: this.move.x * step },
            { x: this.move.y * step, y: -this.move.x * step },
        ];

        for (const sidestep of sidesteps) {
            const startX = this.x;
            const startY = this.y;
            this._move(sidestep.x, sidestep.y, world);
            if (Math.hypot(this.x - startX, this.y - startY) > 0.15) {
                return;
            }
        }
    }

    _move(dx, dy, world) {
        const hitbox = this.getHitbox();

        if (!world.collides(hitbox.x + dx, hitbox.y, hitbox.w, hitbox.h)) {
            this.x += dx;
        } else if (this.state === 'wander') {
            this.move.x *= -1;
        }

        const movedHitbox = this.getHitbox();
        if (!world.collides(movedHitbox.x, movedHitbox.y + dy, movedHitbox.w, movedHitbox.h)) {
            this.y += dy;
        } else if (this.state === 'wander') {
            this.move.y *= -1;
        }

        if (this.state !== 'chase') {
            const leashX = this.x - this.homeX;
            const leashY = this.y - this.homeY;
            if (leashX * leashX + leashY * leashY > this.config.leashRadius * this.config.leashRadius) {
                const invLen = 1 / Math.max(1, Math.hypot(leashX, leashY));
                this.move.x = -leashX * invLen;
                this.move.y = -leashY * invLen;
            }
        }
    }

    _overlaps(rect) {
        const hitbox = this.getHitbox();
        return (
            hitbox.x < rect.x + rect.w &&
            hitbox.x + hitbox.w > rect.x &&
            hitbox.y < rect.y + rect.h &&
            hitbox.y + hitbox.h > rect.y
        );
    }
}

export class Blightworm extends Enemy {
    constructor(x, y, sheet) {
        super(x, y, ENEMY_CONFIGS.blightworm, sheet);
    }
}
