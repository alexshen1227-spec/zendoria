class BaseNpcActor {
    constructor(x, y, {
        w,
        h,
        frames = [],
        frameDuration = 0.24,
        shadowInset = 6,
        bobAmplitude = 0,
        bobSpeed = 1.6,
        interactPadX = 12,
        interactPadY = 8,
        colliderInsetX = 6,
        colliderH = 6,
    } = {}) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.frames = frames;
        this.frameDuration = frameDuration;
        this.frameTimer = 0;
        this.frameIndex = 0;
        this.shadowInset = shadowInset;
        this.bobAmplitude = bobAmplitude;
        this.bobSpeed = bobSpeed;
        this.bob = Math.random() * Math.PI * 2;
        this.interactPadX = interactPadX;
        this.interactPadY = interactPadY;
        this.colliderInsetX = colliderInsetX;
        this.colliderH = colliderH;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }
    get currentFrame() {
        if (!this.frames.length) return null;
        return this.frames[this.frameIndex % this.frames.length];
    }
    get portraitFrame() { return this.frames[0] || null; }

    getInteractRect() {
        return {
            x: this.x - this.interactPadX,
            y: this.y - this.interactPadY,
            w: this.w + this.interactPadX * 2,
            h: this.h + this.interactPadY * 2,
        };
    }

    getCollider() {
        return {
            x: Math.round(this.x + this.colliderInsetX),
            y: Math.round(this.y + this.h - this.colliderH - 2),
            w: Math.max(6, this.w - this.colliderInsetX * 2),
            h: this.colliderH,
        };
    }

    update(dt) {
        this.bob += dt;
        if (this.frames.length <= 1) return;
        this.frameTimer += dt;
        if (this.frameTimer >= this.frameDuration) {
            this.frameTimer -= this.frameDuration;
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        }
    }

    _drawShadow(ctx, x, y) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + this.shadowInset, y + this.h - 2, this.w - this.shadowInset * 2, 2);
    }

    draw(ctx) {
        const frame = this.currentFrame;
        if (!frame) return;
        const bobOffset = this.bobAmplitude > 0
            ? Math.round(Math.sin(this.bob * this.bobSpeed) * this.bobAmplitude)
            : 0;
        const x = Math.round(this.x);
        const y = Math.round(this.y) + bobOffset;
        this._drawShadow(ctx, x, y);
        ctx.drawImage(frame, x, y);
    }
}

export class Elara extends BaseNpcActor {
    constructor(x, y, assets) {
        super(x, y, {
            w: 24,
            h: 32,
            frames: assets.elaraIdleFrames || [],
            frameDuration: 0.22,
            shadowInset: 4,
            bobAmplitude: 0,
            bobSpeed: 2.2,
            interactPadX: 10,
            interactPadY: 6,
            colliderInsetX: 6,
            colliderH: 6,
        });
        this.sheet = assets.elaraIdleSheet;
    }

    draw(ctx) {
        const x = Math.round(this.x);
        const y = Math.round(this.y);
        this._drawShadow(ctx, x, y);
        if (this.sheet) {
            this.sheet.drawFrame(ctx, this.frameIndex, 0, x, y);
            return;
        }
        super.draw(ctx);
    }
}

export class Boatman extends BaseNpcActor {
    constructor(x, y, assets) {
        super(x, y, {
            w: 32,
            h: 40,
            frames: assets.boatmanIdleFrames || [assets.boatmanSprite].filter(Boolean),
            frameDuration: 0.42,
            shadowInset: 6,
            bobAmplitude: 0.6,
            bobSpeed: 1.6,
            interactPadX: 12,
            interactPadY: 8,
            colliderInsetX: 8,
            colliderH: 6,
        });
    }
}

export class AmbientNpc extends BaseNpcActor {
    constructor(definition, assets, savedState = null) {
        const variant = assets.npcGeneratedVariants?.[definition.id]
            || assets.npcVariants?.[definition.variant]
            || assets.npcVariants?.['drift-scout']
            || null;
        const family = (variant?.family === 'boatman' || variant?.family === 'unique') ? 'boatman' : 'elara';
        const w = variant?.w || (family === 'boatman' ? 32 : 24);
        const h = variant?.h || (family === 'boatman' ? 40 : 32);
        super(definition.x, definition.y, {
            w,
            h,
            frames: variant?.frames || [],
            frameDuration: definition.frameDuration ?? variant?.frameDuration ?? (family === 'boatman' ? 0.42 : 0.22),
            shadowInset: family === 'boatman' ? 6 : 4,
            bobAmplitude: definition.bobAmplitude ?? variant?.floatAmplitude ?? (family === 'boatman' ? 0.6 : 0.3),
            bobSpeed: definition.bobSpeed ?? variant?.floatSpeed ?? (family === 'boatman' ? 1.6 : 2.1),
            interactPadX: definition.interactPadX ?? 12,
            interactPadY: definition.interactPadY ?? 8,
            colliderInsetX: family === 'boatman' ? 8 : 6,
            colliderH: 6,
        });
        this.definition = definition;
        this.variant = variant;
        this.family = family;
        this.cooldown = Math.max(0, Number(savedState?.cooldown) || 0);
        this.visits = Math.max(0, Math.floor(savedState?.visits || 0));
        this.used = !!savedState?.used;
    }

    get id() { return this.definition.id; }
    get name() { return this.definition.name; }
    get title() { return this.definition.title; }
    get promptLabel() { return this.definition.promptLabel || this.definition.name || 'NPC'; }
    get accent() { return this.variant?.accent || '#8effec'; }
    get effect() { return this.definition.effect || null; }
    get portraitFrame() { return this.variant?.portrait || super.portraitFrame; }

    // True if this NPC carries a light source in their variant flavor (lantern
    // keeper, moon ferrier, star-herd, ember/burnt guides). At night these
    // get a soft warm halo on the ground around them. Source: vibe-code
    // session day/night cycle "NPC torches" feature.
    _isTorchBearer() {
        const v = this.definition.variant || '';
        const id = this.definition.id || '';
        return /lantern|moon|cinder|burnt|ember/i.test(v) || /lantern|moon|halden|kael|tamas/i.test(id);
    }

    drawTorchHalo(ctx, nightFactor = 0) {
        if (nightFactor <= 0.05) return;
        if (!this._isTorchBearer()) return;
        // Halo is centered on the NPC's feet so it reads as light cast on
        // the ground. Warm amber tone matches a torch / lantern.
        const cx = this.x + this.w / 2;
        const cy = this.y + this.h - 2;
        const radius = 22 + nightFactor * 10;
        const flicker = Math.sin(this.bob * 4.2) * 0.5 + 0.5;
        const alpha = (0.18 + flicker * 0.10) * nightFactor;
        const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
        grad.addColorStop(0, `rgba(255, 196, 120, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.6, `rgba(255, 160, 80, ${(alpha * 0.45).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 140, 60, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    update(dt) {
        super.update(dt);
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    }

    markVisited() {
        this.visits += 1;
    }

    markUsed() {
        this.used = true;
    }

    setCooldown(seconds) {
        this.cooldown = Math.max(0, Number(seconds) || 0);
    }

    serializeState() {
        return {
            id: this.id,
            cooldown: Number(this.cooldown.toFixed(2)),
            visits: this.visits,
            used: this.used,
        };
    }
}
