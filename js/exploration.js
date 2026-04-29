// Lightweight exploration entities — lore stones, buff shrines, and destructible
// crystal clusters. Each follows the shared interface used by pillars and chests:
// getCollider(), getInteractRect(), update(dt), draw(ctx), plus a sortY getter.

export class LoreStone {
    constructor(definition) {
        this.id = definition.id;
        this.title = (definition.title || 'ANCIENT MARKER').toUpperCase();
        this.body = (definition.body || '').toUpperCase();
        this.x = Math.round(definition.x) - 9;
        this.y = Math.round(definition.y) - 20;
        this.w = 18;
        this.h = 22;
        this.read = false;
        this.glowTimer = Math.random() * Math.PI * 2;
        this.readPulse = 0;
        this.prompt = 'E: READ MARKER';
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }

    update(dt) {
        this.glowTimer += dt;
        if (this.readPulse > 0) this.readPulse = Math.max(0, this.readPulse - dt * 1.4);
    }

    setRead(read = true) {
        if (read && !this.read) this.readPulse = 1;
        this.read = !!read;
    }

    getCollider() {
        return { x: this.x + 5, y: this.y + this.h - 5, w: 8, h: 4 };
    }

    getInteractRect() {
        return { x: this.x - 6, y: this.y - 4, w: this.w + 12, h: this.h + 10 };
    }

    draw(ctx) {
        const pulse = Math.sin(this.glowTimer * 2.1) * 0.5 + 0.5;
        const glowAlpha = this.read
            ? 0.05 + pulse * 0.04
            : 0.1 + pulse * 0.1 + this.readPulse * 0.2;

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 2, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Aura
        const grad = ctx.createRadialGradient(this.cx, this.cy, 1, this.cx, this.cy, 22);
        const color = this.read ? '230, 215, 170' : '142, 220, 236';
        grad.addColorStop(0, `rgba(${color}, ${glowAlpha})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(this.x - 10, this.y - 10, this.w + 20, this.h + 20);

        // Stone base
        ctx.fillStyle = '#4a4339';
        ctx.fillRect(this.x + 2, this.y + this.h - 6, this.w - 4, 5);
        // Stele body
        ctx.fillStyle = '#6d6152';
        ctx.fillRect(this.x + 4, this.y + 3, this.w - 8, this.h - 8);
        ctx.fillStyle = '#8b7d66';
        ctx.fillRect(this.x + 5, this.y + 4, this.w - 11, 3);
        // Carved face
        ctx.fillStyle = '#3a3229';
        ctx.fillRect(this.x + 6, this.y + 8, this.w - 12, this.h - 16);
        // Rune marks
        const runeColor = this.read ? '#ffd88a' : '#a9f0ff';
        ctx.fillStyle = runeColor;
        ctx.fillRect(this.x + 7, this.y + 9, 1, 2);
        ctx.fillRect(this.x + this.w - 9, this.y + 9, 1, 2);
        ctx.fillRect(this.x + 8, this.y + 13, this.w - 16, 1);
        ctx.fillRect(this.x + 7, this.y + 16, 1, 2);
        ctx.fillRect(this.x + this.w - 9, this.y + 16, 1, 2);

        if (!this.read) {
            // Floating spark to draw the eye
            const bob = Math.sin(this.glowTimer * 2.8) * 1.5;
            ctx.fillStyle = `rgba(169, 240, 255, ${0.4 + pulse * 0.4})`;
            ctx.fillRect(Math.round(this.cx - 1), Math.round(this.y - 2 + bob), 2, 2);
        }
    }
}

const SHRINE_KINDS = {
    might: { label: 'SHRINE OF MIGHT',  buff: 'DAMAGE +1',      color: '#ff9a70', buffId: 'might', duration: 25 },
    swift: { label: 'SHRINE OF SWIFTNESS', buff: 'SPEED +25%',  color: '#8effec', buffId: 'swift', duration: 25 },
    ward:  { label: 'SHRINE OF WARD',   buff: 'LONGER I-FRAMES', color: '#dff6ff', buffId: 'ward',  duration: 25 },
};

export class BuffShrine {
    constructor(definition) {
        this.id = definition.id;
        const config = SHRINE_KINDS[definition.kind] || SHRINE_KINDS.might;
        this.kind = definition.kind;
        this.label = config.label;
        this.buff = config.buff;
        this.color = config.color;
        this.buffId = config.buffId;
        this.duration = config.duration;
        this.x = Math.round(definition.x) - 10;
        this.y = Math.round(definition.y) - 22;
        this.w = 20;
        this.h = 26;
        this.cooldown = 0;
        this.cooldownMax = 35;
        this.glowTimer = Math.random() * Math.PI * 2;
        this.activateFlash = 0;
        this.prompt = `E: ${this.label}`;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }
    get ready() { return this.cooldown <= 0; }

    update(dt) {
        this.glowTimer += dt;
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.activateFlash > 0) this.activateFlash = Math.max(0, this.activateFlash - dt * 1.6);
    }

    activate() {
        if (!this.ready) return false;
        this.cooldown = this.cooldownMax;
        this.activateFlash = 1;
        return true;
    }

    getCollider() {
        return { x: this.x + 5, y: this.y + this.h - 6, w: 10, h: 5 };
    }

    getInteractRect() {
        return { x: this.x - 6, y: this.y - 4, w: this.w + 12, h: this.h + 10 };
    }

    draw(ctx) {
        const pulse = Math.sin(this.glowTimer * 2.6) * 0.5 + 0.5;
        const ready = this.ready;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 2, 10, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Aura
        const alpha = ready
            ? 0.14 + pulse * 0.14 + this.activateFlash * 0.4
            : 0.04 + pulse * 0.03;
        const rgb = this._hexToRgb(this.color);
        const grad = ctx.createRadialGradient(this.cx, this.cy, 1, this.cx, this.cy, 28);
        grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(this.x - 14, this.y - 14, this.w + 28, this.h + 28);

        // Basin (stone base)
        ctx.fillStyle = '#3b342c';
        ctx.fillRect(this.x + 1, this.y + this.h - 7, this.w - 2, 6);
        ctx.fillStyle = '#5c5141';
        ctx.fillRect(this.x + 2, this.y + this.h - 8, this.w - 4, 2);
        // Pedestal
        ctx.fillStyle = ready ? '#7b6c55' : '#473f34';
        ctx.fillRect(this.x + 4, this.y + 6, this.w - 8, this.h - 13);
        ctx.fillStyle = ready ? '#9d8a6e' : '#5a4f41';
        ctx.fillRect(this.x + 5, this.y + 7, this.w - 10, 2);
        // Bowl / flame
        if (ready) {
            const flame = Math.sin(this.glowTimer * 9) * 0.5 + 0.5;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x + 7, this.y + 1, this.w - 14, 5);
            ctx.fillStyle = `rgba(${rgb}, ${0.6 + flame * 0.4})`;
            ctx.fillRect(this.x + 8, this.y - 1, this.w - 16, 3);
            ctx.fillStyle = '#fff7c8';
            ctx.fillRect(this.x + 9, this.y + 2, 1, 2);
        } else {
            // Smoldering when on cooldown
            ctx.fillStyle = '#2a2119';
            ctx.fillRect(this.x + 7, this.y + 2, this.w - 14, 4);
            const wisp = (this.glowTimer * 0.8) % 1;
            ctx.fillStyle = `rgba(170, 170, 170, ${0.3 * (1 - wisp)})`;
            ctx.fillRect(Math.round(this.cx - 1), Math.round(this.y - wisp * 8), 2, 2);
        }

        // Cooldown meter — small bar beneath the shrine when recharging.
        if (!ready) {
            const frac = 1 - this.cooldown / this.cooldownMax;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(this.x + 3, this.y + this.h - 1, this.w - 6, 2);
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x + 3, this.y + this.h - 1, Math.round((this.w - 6) * frac), 2);
        }
    }

    _hexToRgb(hex) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }
}

const CRYSTAL_KINDS = {
    tidestone: { colorA: '#8effec', colorB: '#2f8c80', xp: 8 },
    salt:      { colorA: '#e8f8ff', colorB: '#8ea9c8', xp: 8 },
    amber:     { colorA: '#ffd27b', colorB: '#b5722d', xp: 10 },
    rust:      { colorA: '#ff9a70', colorB: '#7a3324', xp: 10 },
};

export class CrystalCluster {
    constructor(definition, destroyed = false) {
        this.id = definition.id;
        const config = CRYSTAL_KINDS[definition.kind] || CRYSTAL_KINDS.tidestone;
        this.kind = definition.kind;
        this.colorA = config.colorA;
        this.colorB = config.colorB;
        this.xp = config.xp;
        this.x = Math.round(definition.x) - 9;
        this.y = Math.round(definition.y) - 16;
        this.w = 18;
        this.h = 20;
        this.health = 2;
        this.destroyed = !!destroyed;
        this.flashTimer = 0;
        this.glowTimer = Math.random() * Math.PI * 2;
        this.shatterTimer = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }

    update(dt) {
        this.glowTimer += dt;
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);
        if (this.shatterTimer > 0) this.shatterTimer = Math.max(0, this.shatterTimer - dt);
    }

    getCollider() {
        if (this.destroyed) return null;
        return { x: this.x + 4, y: this.y + this.h - 5, w: 10, h: 4 };
    }

    getInteractRect() {
        if (this.destroyed) return null;
        return { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h };
    }

    takeHit(damage = 1) {
        if (this.destroyed) return { landed: false, destroyed: false };
        this.health = Math.max(0, this.health - damage);
        this.flashTimer = 0.16;
        if (this.health <= 0) {
            this.destroyed = true;
            this.shatterTimer = 0.6;
            return { landed: true, destroyed: true };
        }
        return { landed: true, destroyed: false };
    }

    draw(ctx, nightFactor = 0) {
        // Shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${this.destroyed ? 0.2 : 0.32})`;
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 2, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.destroyed) {
            // Rubble remnant
            ctx.fillStyle = this.colorB;
            ctx.fillRect(this.x + 5, this.y + this.h - 4, 3, 2);
            ctx.fillRect(this.x + this.w - 8, this.y + this.h - 4, 3, 2);
            return;
        }

        const pulse = Math.sin(this.glowTimer * 3.2) * 0.5 + 0.5;
        const rgb = this._hexToRgb(this.colorA);
        // Night boost: gradient grows up to ~50% brighter and ~50% wider so
        // crystals read like beacons in the dark. Day stays subtle.
        const glowAlpha = 0.18 + pulse * 0.14 + nightFactor * (0.16 + pulse * 0.08);
        const glowRadius = 18 + nightFactor * 10;
        const grad = ctx.createRadialGradient(this.cx, this.cy, 1, this.cx, this.cy, glowRadius);
        grad.addColorStop(0, `rgba(${rgb}, ${glowAlpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = grad;
        const padBox = Math.round(8 + nightFactor * 6);
        ctx.fillRect(this.x - padBox, this.y - padBox, this.w + padBox * 2, this.h + padBox * 2);

        const jx = this.flashTimer > 0 ? (Math.random() * 2 - 1) * 1.2 : 0;
        const jy = this.flashTimer > 0 ? (Math.random() * 2 - 1) * 0.8 : 0;
        const ox = Math.round(this.x + jx);
        const oy = Math.round(this.y + jy);

        // Main crystal shard cluster — three tall shards.
        ctx.fillStyle = this.colorB;
        ctx.fillRect(ox + 4, oy + 6, 3, this.h - 10);
        ctx.fillRect(ox + 8, oy + 3, 3, this.h - 7);
        ctx.fillRect(ox + 12, oy + 7, 3, this.h - 11);
        ctx.fillStyle = this.colorA;
        ctx.fillRect(ox + 5, oy + 7, 1, this.h - 12);
        ctx.fillRect(ox + 9, oy + 4, 1, this.h - 9);
        ctx.fillRect(ox + 13, oy + 8, 1, this.h - 13);

        // Highlight tips
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox + 9, oy + 3, 1, 2);
        ctx.fillRect(ox + 5, oy + 7, 1, 1);
        ctx.fillRect(ox + 13, oy + 7, 1, 1);

        // Crack appears at low HP
        if (this.health === 1) {
            ctx.fillStyle = 'rgba(20, 10, 8, 0.55)';
            ctx.fillRect(ox + 8, oy + 8, 1, 4);
            ctx.fillRect(ox + 9, oy + 11, 1, 2);
        }

        if (this.flashTimer > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5 * (this.flashTimer / 0.16);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ox + 4, oy + 3, 11, this.h - 7);
            ctx.restore();
        }
    }

    _hexToRgb(hex) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }
}
