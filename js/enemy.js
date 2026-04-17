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
    rusher: {
        kind: 'rusher',
        src: 'assets/sprites/enemies/rusher_sheet.png',
        frameW: 28,
        frameH: 28,
        hudLabel: 'RUSHER',
        toastLabel: 'RUSHER',
        maxHealth: 2,
        xpReward: 4,
        wanderSpeed: 22,
        chaseSpeed: 62,
        aggroRadius: 118,
        loseRadius: 168,
        contactDamage: 1,
        contactPush: { x: 26, y: 18 },
        attackCooldown: 0.7,
        hurtDuration: 0.22,
        deathDuration: 0.42,
        knockbackSpeed: 70,
        knockbackDuration: 0.10,
        leashRadius: 100,
        hitbox: { x: 6, y: 14, w: 16, h: 12 },
        shadow: { x: 7, y: 24, w: 14, h: 3 },
        flashJitter: { x: 1.6, y: 1.0 },
        spawnSearch: { maxRadius: 80, step: 6 },
        idleDuration: [0.4, 0.9],
        wanderDuration: [0.4, 1.0],
        walkAnimSpeed: 9,
        chaseAnimSpeed: 14,
        // Sheet rows: 0=walkN, 1=walkE, 2=walkS, 3=walkW, 4=hurt, 5=death
        // We use the side view (row 1) for the universal walk and rely on facingLeft flipping.
        animations: {
            idle: frame(0, 1),
            walk: [frame(0, 1), frame(1, 1)],
            hurt: [frame(0, 4), frame(1, 4)],
            death: [frame(0, 5), frame(1, 5)],
        },
    },
    tacticalArcher: {
        kind: 'tacticalArcher',
        src: 'assets/sprites/enemies/archer_sheet.png',
        frameW: 22,
        frameH: 32,
        hudLabel: 'TACTICAL ARCHER',
        toastLabel: 'ARCHER',
        maxHealth: 2,
        xpReward: 5,
        wanderSpeed: 12,
        chaseSpeed: 22,
        aggroRadius: 150,
        loseRadius: 200,
        contactDamage: 1,
        contactPush: { x: 18, y: 14 },
        attackCooldown: 1.4,
        hurtDuration: 0.26,
        deathDuration: 0.46,
        knockbackSpeed: 50,
        knockbackDuration: 0.12,
        leashRadius: 90,
        hitbox: { x: 6, y: 12, w: 12, h: 18 },
        shadow: { x: 6, y: 28, w: 12, h: 3 },
        flashJitter: { x: 1.3, y: 0.9 },
        spawnSearch: { maxRadius: 96, step: 6 },
        idleDuration: [0.7, 1.4],
        wanderDuration: [0.7, 1.6],
        walkAnimSpeed: 6,
        chaseAnimSpeed: 8,
        // Ranged tunables
        isRanged: true,
        arrowSpeed: 130,
        arrowDamage: 1,
        shootRange: 142,
        keepDistance: 88,
        retreatSpeed: 28,
        // Sheet rows: 0=walk, 1=attack N, 2=attack E, 3=damage, 4=death(wisp)
        animations: {
            idle: frame(0, 0),
            walk: [frame(0, 0), frame(1, 0)],
            attack: [frame(0, 2), frame(1, 2)],
            hurt: [frame(0, 3), frame(1, 3)],
            death: [frame(0, 4), frame(1, 4)],
        },
    },
    goliath: {
        kind: 'goliath',
        src: 'assets/sprites/enemies/goliath_sheet.png',
        frameW: 64,
        frameH: 56,
        hudLabel: 'GOLIATH CHAKRAM BEETLE',
        toastLabel: 'GOLIATH',
        maxHealth: 9,
        xpReward: 18,
        wanderSpeed: 8,
        chaseSpeed: 17,
        aggroRadius: 130,
        loseRadius: 200,
        contactDamage: 2,
        contactPush: { x: 36, y: 24 },
        attackCooldown: 1.6,
        hurtDuration: 0.32,
        deathDuration: 0.62,
        knockbackSpeed: 26,
        knockbackDuration: 0.10,
        leashRadius: 110,
        hitbox: { x: 16, y: 24, w: 32, h: 24 },
        shadow: { x: 18, y: 50, w: 28, h: 4 },
        flashJitter: { x: 1.0, y: 0.6 },
        spawnSearch: { maxRadius: 110, step: 8 },
        idleDuration: [0.8, 1.6],
        wanderDuration: [0.8, 1.8],
        walkAnimSpeed: 4,
        chaseAnimSpeed: 6,
        // Tank tunables
        isTank: true,
        blockChance: 0.45,
        blockReduction: 0.6,
        aoeAttackInterval: 3.4,
        aoeWindup: 0.35,
        aoeRadius: 56,
        aoeDamage: 2,
        // Sheet rows: 0=idle, 1=walk, 2=block, 3=attack, 4=hurt, 5=death
        animations: {
            idle: frame(0, 0),
            walk: [frame(0, 1), frame(1, 1)],
            block: [frame(0, 2), frame(1, 2)],
            attack: [frame(0, 3), frame(1, 3)],
            hurt: [frame(0, 4), frame(1, 4)],
            death: [frame(0, 5), frame(1, 5)],
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
    if (config.isRanged) return new RangedEnemy(x, y, config, sheet);
    if (config.isTank) return new TankEnemy(x, y, config, sheet);
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

/**
 * RangedEnemy: Tactical Archer.
 * Tries to maintain a comfortable shooting distance from the player and
 * fires arrow projectiles on a cooldown when within range and line-of-sight.
 */
export class RangedEnemy extends Enemy {
    constructor(x, y, config, sheet) {
        super(x, y, config, sheet);
        this.shootCooldown = 0.6 + Math.random() * 0.8;
        this.attackTimer = 0;            // remaining time on attack pose
        this.attackTotal = 0.32;
        this.firedThisAttack = false;
        this.pendingProjectile = null;   // { dirX, dirY, originX, originY }
    }

    consumeProjectile() {
        const p = this.pendingProjectile;
        this.pendingProjectile = null;
        return p;
    }

    update(dt, player, world) {
        if (this.state === 'dead') return;

        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        this.flashTimer = Math.max(0, this.flashTimer - dt);
        this.shootCooldown = Math.max(0, this.shootCooldown - dt);
        if (this.attackTimer > 0) {
            this.attackTimer = Math.max(0, this.attackTimer - dt);
        }

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
        const dist = Math.hypot(toPlayerX, toPlayerY);
        const aggro = this.config.aggroRadius;
        const lose = this.config.loseRadius;
        const shootRange = this.config.shootRange;
        const keep = this.config.keepDistance;

        if (this.state === 'hurt') {
            this.stateTimer = Math.max(0, this.stateTimer - dt);
            if (this.stateTimer <= 0) {
                this.state = dist < aggro ? 'chase' : 'wander';
                this.stateTimer = chooseDuration(this.config.wanderDuration);
            }
        } else {
            if (dist < aggro) {
                this.state = 'chase';
            } else if (this.state === 'chase' && dist > lose) {
                this.state = 'wander';
                this.stateTimer = chooseDuration(this.config.wanderDuration);
            } else if (this.state === 'idle' || this.state === 'wander') {
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) this._pickNewWander();
            }
        }

        // Movement: kite away if too close, hold if in shoot zone, approach if too far.
        const invDist = dist > 0.001 ? 1 / dist : 0;
        const dirToPlayerX = toPlayerX * invDist;
        const dirToPlayerY = toPlayerY * invDist;
        if (this.state === 'chase') {
            if (this.attackTimer > 0) {
                this.move.x = 0;
                this.move.y = 0;
            } else if (dist < keep - 6) {
                // retreat
                this.move.x = -dirToPlayerX;
                this.move.y = -dirToPlayerY;
                this._move(this.move.x * this.config.retreatSpeed * dt, this.move.y * this.config.retreatSpeed * dt, world);
            } else if (dist > shootRange) {
                // close in
                this.move.x = dirToPlayerX;
                this.move.y = dirToPlayerY;
                this._move(this.move.x * this.config.chaseSpeed * dt, this.move.y * this.config.chaseSpeed * dt, world);
            } else {
                // strafe a tiny bit so they're not statues
                const strafe = Math.sin(performance.now() * 0.002 + this.id) * 0.4;
                this.move.x = -dirToPlayerY * strafe;
                this.move.y = dirToPlayerX * strafe;
                this._move(this.move.x * this.config.wanderSpeed * dt, this.move.y * this.config.wanderSpeed * dt, world);
            }
        } else if (this.state === 'wander') {
            this._move(this.move.x * this.config.wanderSpeed * dt, this.move.y * this.config.wanderSpeed * dt, world);
        } else {
            this.move.x = 0;
            this.move.y = 0;
        }

        // Always face the player when in combat
        if (this.state === 'chase' || this.attackTimer > 0) {
            this.facingLeft = toPlayerX < 0;
        } else if (Math.abs(this.move.x) > 0.05) {
            this.facingLeft = this.move.x < 0;
        }

        // Animate
        const moving = this.attackTimer <= 0 && (Math.abs(this.move.x) > 0.05 || Math.abs(this.move.y) > 0.05);
        const walkFrames = this.config.animations.walk;
        if (this.attackTimer > 0) {
            // hold attack frame mapped over windup
            this.frame = this.attackTimer > this.attackTotal * 0.5 ? 0 : 1;
        } else if (moving && this.state !== 'hurt') {
            this.animTimer += dt * (this.state === 'chase' ? this.config.chaseAnimSpeed : this.config.walkAnimSpeed);
            this.frame = Math.floor(this.animTimer) % walkFrames.length;
        } else if (this.state !== 'hurt') {
            this.frame = 0;
            this.animTimer = 0;
        }

        // Try to shoot
        if (
            this.state === 'chase' &&
            this.attackTimer <= 0 &&
            this.shootCooldown <= 0 &&
            dist <= shootRange &&
            dist >= keep * 0.5
        ) {
            this.attackTimer = this.attackTotal;
            this.firedThisAttack = false;
            this.shootCooldown = this.config.attackCooldown;
        }

        // Spawn the arrow at the midpoint of the attack windup (release on string)
        if (this.attackTimer > 0 && !this.firedThisAttack && this.attackTimer <= this.attackTotal * 0.55) {
            this.firedThisAttack = true;
            this.pendingProjectile = {
                originX: this.cx,
                originY: this.cy - 4,
                dirX: dirToPlayerX,
                dirY: dirToPlayerY,
                speed: this.config.arrowSpeed,
                damage: this.config.arrowDamage,
            };
        }
    }

    _currentFrame() {
        if (this.attackTimer > 0 && this.config.animations.attack) {
            return this.config.animations.attack[this.frame] ?? this.config.animations.attack[0];
        }
        return super._currentFrame();
    }
}

/**
 * TankEnemy: Goliath Chakram Beetle.
 * Heavy melee with two extras: it can BLOCK incoming damage (random chance,
 * playing a block pose with reduced damage), and it periodically performs an
 * AOE swing that hits the player if they're within `aoeRadius`.
 */
export class TankEnemy extends Enemy {
    constructor(x, y, config, sheet) {
        super(x, y, config, sheet);
        this.aoeCooldown = config.aoeAttackInterval * (0.5 + Math.random() * 0.6);
        this.aoeWindup = 0;        // remaining wind-up time before swing
        this.aoeSwingTimer = 0;    // remaining time for swing FX overlay
        this.aoeSwingTotal = 0.22;
        this.aoeFired = false;
        this.blockTimer = 0;       // remaining block pose time
        this.blockTotal = 0.5;
        this.lastSwingFx = null;   // { x, y, timer, total }
    }

    consumeSwingFx() {
        const fx = this.lastSwingFx;
        this.lastSwingFx = null;
        return fx;
    }

    takeHit(direction, damage = 1) {
        if (!this.isTargetable()) return false;
        // Roll block chance unless mid-swing
        if (this.aoeWindup <= 0 && this.aoeSwingTimer <= 0 && Math.random() < this.config.blockChance) {
            const reduced = Math.max(0, Math.round(damage * (1 - this.config.blockReduction)));
            this.blockTimer = this.blockTotal;
            this.flashTimer = 0.12;
            // Light knockback even on block
            const push = dirToVector(direction);
            this.knockback = {
                x: push.x * this.config.knockbackSpeed * 0.4,
                y: push.y * this.config.knockbackSpeed * 0.4,
                timer: this.config.knockbackDuration,
            };
            if (reduced > 0) {
                this.health -= reduced;
                if (this.health <= 0) {
                    this.state = 'dying';
                    this.deathTimer = this.config.deathDuration;
                }
            }
            return true;
        }
        return super.takeHit(direction, damage);
    }

    update(dt, player, world) {
        if (this.state === 'dead') return;
        this.aoeCooldown = Math.max(0, this.aoeCooldown - dt);
        this.blockTimer = Math.max(0, this.blockTimer - dt);
        const prevWindup = this.aoeWindup;
        if (this.aoeWindup > 0) this.aoeWindup = Math.max(0, this.aoeWindup - dt);
        if (this.aoeSwingTimer > 0) this.aoeSwingTimer = Math.max(0, this.aoeSwingTimer - dt);

        super.update(dt, player, world);
        if (this.state === 'dead' || this.state === 'dying') return;

        const toPlayerX = player.cx - this.cx;
        const toPlayerY = player.cy - this.cy;
        const dist = Math.hypot(toPlayerX, toPlayerY);

        // Trigger AOE windup when close & cooldown ready
        if (
            this.state === 'chase' &&
            this.aoeCooldown <= 0 &&
            this.aoeWindup <= 0 &&
            this.aoeSwingTimer <= 0 &&
            dist <= this.config.aoeRadius * 1.1
        ) {
            this.aoeWindup = this.config.aoeWindup;
            this.aoeFired = false;
            this.aoeCooldown = this.config.aoeAttackInterval;
        }

        // Fire the swing when windup completes (transition this frame)
        if (prevWindup > 0 && this.aoeWindup <= 0 && !this.aoeFired) {
            this.aoeFired = true;
            this.aoeSwingTimer = this.aoeSwingTotal;
            const r = this.config.aoeRadius;
            const dx = player.cx - this.cx;
            const dy = player.cy - this.cy;
            if (dx * dx + dy * dy <= r * r) {
                const len = Math.max(0.001, Math.hypot(dx, dy));
                player.takeDamage(this.config.aoeDamage, {
                    x: (dx / len) * this.config.contactPush.x * 1.6,
                    y: (dy / len) * this.config.contactPush.y * 1.6,
                });
            }
            this.lastSwingFx = { x: this.cx, y: this.cy + 4, timer: this.aoeSwingTotal, total: this.aoeSwingTotal };
        }
    }

    _currentFrame() {
        if (this.aoeSwingTimer > 0 || this.aoeWindup > 0) {
            const attack = this.config.animations.attack;
            const i = (this.aoeWindup > 0)
                ? 0
                : 1;
            return attack[i] ?? attack[0];
        }
        if (this.blockTimer > 0) {
            const block = this.config.animations.block;
            const i = this.blockTimer > this.blockTotal * 0.5 ? 0 : 1;
            return block[i] ?? block[0];
        }
        return super._currentFrame();
    }
}
