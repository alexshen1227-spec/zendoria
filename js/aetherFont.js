// Aether Font — a tide-blessed shrine that releases a radial surge on command.
// When the player activates it, it heals them and damages enemies in a large
// ring. Always visible via a persistent glow + drifting motes so the player
// can spot it from across the beach.
//
// Interface matches BuffShrine / LoreStone:
//   getCollider(), getInteractRect(), update(dt), draw(ctx), sortY, prompt
// plus `cooldown` / `cooldownMax` for save persistence.

const SURGE_RADIUS = 64;
const SURGE_HEAL = 4;
const SURGE_DAMAGE = 3;
const SURGE_COOLDOWN = 28; // seconds
const SURGE_DURATION = 0.9; // seconds the visual ring lives
const PALETTE = {
    core: '#a6f6ff',
    mid: '#3cc7e0',
    deep: '#186680',
    rune: '#e8fbff',
    cooled: '#476a7a',
};

export class AetherFont {
    constructor(definition) {
        this.id = definition.id || 'aether-font';
        // Anchor: the definition gives us the bottom-center of the shrine.
        this.x = Math.round(definition.x) - 10;
        this.y = Math.round(definition.y) - 28;
        this.w = 20;
        this.h = 32;

        this.cooldown = 0;
        this.cooldownMax = SURGE_COOLDOWN;
        this.glowTimer = Math.random() * Math.PI * 2;
        this.activateFlash = 0;
        this.surgeTimer = 0;          // counts down during the visible shockwave
        this.surgeLifetime = SURGE_DURATION;

        // Continuous ambient motes: tiny particles that rise from the bowl.
        this.motes = [];
        this._moteSpawnTimer = 0;

        this.prompt = 'E: CALL THE TIDE';
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }
    get ready() { return this.cooldown <= 0; }

    update(dt) {
        this.glowTimer += dt;
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.activateFlash > 0) this.activateFlash = Math.max(0, this.activateFlash - dt * 1.4);
        if (this.surgeTimer > 0) this.surgeTimer = Math.max(0, this.surgeTimer - dt);

        // Ambient motes — faster spawn when ready, sparser when smoldering.
        this._moteSpawnTimer -= dt;
        const spawnInterval = this.ready ? 0.085 : 0.28;
        if (this._moteSpawnTimer <= 0) {
            this._moteSpawnTimer = spawnInterval;
            this.motes.push({
                x: this.cx + (Math.random() - 0.5) * 6,
                y: this.y + 4 + Math.random() * 2,
                vx: (Math.random() - 0.5) * 6,
                vy: -14 - Math.random() * 10,
                life: 0.9 + Math.random() * 0.5,
                max: 1.1,
                size: Math.random() < 0.3 ? 2 : 1,
                hue: this.ready ? PALETTE.core : PALETTE.cooled,
            });
        }
        for (let i = this.motes.length - 1; i >= 0; i--) {
            const m = this.motes[i];
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.vy += 8 * dt; // very slight gravity pulls motes back down
            m.life -= dt;
            if (m.life <= 0) this.motes.splice(i, 1);
        }
    }

    /**
     * Returns surge data on success, or null if still on cooldown.
     * The game layer consumes this to apply heal/damage/particles.
     */
    activate() {
        if (!this.ready) return null;
        this.cooldown = this.cooldownMax;
        this.activateFlash = 1;
        this.surgeTimer = this.surgeLifetime;
        return {
            cx: this.cx,
            cy: this.y + this.h - 4,
            radius: SURGE_RADIUS,
            heal: SURGE_HEAL,
            damage: SURGE_DAMAGE,
            duration: SURGE_DURATION,
        };
    }

    getCollider() {
        // Small base collider so the player/enemies can't walk through the plinth,
        // but the shrine itself stays openly approachable from all sides.
        return { x: this.x + 5, y: this.y + this.h - 6, w: 10, h: 5 };
    }

    getInteractRect() {
        // Generous rect: covers the shrine plus a pace in every direction so
        // the player can interact from any approach angle without nudging.
        return { x: this.x - 10, y: this.y - 6, w: this.w + 20, h: this.h + 22 };
    }

    draw(ctx) {
        const pulse = Math.sin(this.glowTimer * 2.4) * 0.5 + 0.5;
        const fastPulse = Math.sin(this.glowTimer * 6.2) * 0.5 + 0.5;
        const ready = this.ready;

        // --- Shadow ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 1, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Surge shockwave ring (drawn UNDER the font so the font overlays cleanly) ---
        if (this.surgeTimer > 0) {
            const progress = 1 - (this.surgeTimer / this.surgeLifetime);
            const ringR = 8 + progress * SURGE_RADIUS;
            const alpha = 0.75 * (1 - progress);
            // Outer ring
            ctx.strokeStyle = `rgba(166, 246, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.cx, this.y + this.h - 4, ringR, 0, Math.PI * 2);
            ctx.stroke();
            // Inner softer ring
            ctx.strokeStyle = `rgba(60, 199, 224, ${alpha * 0.7})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.cx, this.y + this.h - 4, ringR - 3, 0, Math.PI * 2);
            ctx.stroke();
            // Soft fill haze
            const grad = ctx.createRadialGradient(this.cx, this.y + this.h - 4, ringR - 6, this.cx, this.y + this.h - 4, ringR);
            grad.addColorStop(0, `rgba(166, 246, 255, 0)`);
            grad.addColorStop(0.7, `rgba(166, 246, 255, ${alpha * 0.22})`);
            grad.addColorStop(1, `rgba(166, 246, 255, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(this.cx - ringR - 2, this.y + this.h - 4 - ringR - 2, ringR * 2 + 4, ringR * 2 + 4);
        }

        // --- Aura (soft radial glow) ---
        const auraA = ready
            ? 0.18 + pulse * 0.14 + this.activateFlash * 0.5
            : 0.05 + pulse * 0.02;
        const aura = ctx.createRadialGradient(this.cx, this.cy, 1, this.cx, this.cy, 34);
        aura.addColorStop(0, `rgba(166, 246, 255, ${auraA})`);
        aura.addColorStop(1, 'rgba(166, 246, 255, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(this.x - 18, this.y - 18, this.w + 36, this.h + 36);

        // --- Stone plinth base ---
        ctx.fillStyle = '#2e3944';
        ctx.fillRect(this.x + 1, this.y + this.h - 8, this.w - 2, 7);
        ctx.fillStyle = '#46556a';
        ctx.fillRect(this.x + 2, this.y + this.h - 9, this.w - 4, 2);
        ctx.fillStyle = '#1e2630';
        ctx.fillRect(this.x + 1, this.y + this.h - 2, this.w - 2, 1);

        // --- Pedestal column ---
        ctx.fillStyle = ready ? '#546a7d' : '#3a4853';
        ctx.fillRect(this.x + 5, this.y + 10, this.w - 10, this.h - 19);
        ctx.fillStyle = ready ? '#6e8aa0' : '#4a5a68';
        ctx.fillRect(this.x + 6, this.y + 11, this.w - 12, 2);
        // Dark seam down the middle
        ctx.fillStyle = '#22303c';
        ctx.fillRect(this.x + Math.floor(this.w / 2) - 1, this.y + 12, 1, this.h - 22);

        // Glowing rune inscribed on the column (triangle-like)
        if (ready) {
            ctx.fillStyle = `rgba(232, 251, 255, ${0.6 + fastPulse * 0.4})`;
            ctx.fillRect(this.x + this.w / 2 - 1, this.y + 16, 2, 1);
            ctx.fillRect(this.x + this.w / 2 - 2, this.y + 17, 4, 1);
            ctx.fillRect(this.x + this.w / 2 - 3, this.y + 18, 6, 1);
            ctx.fillRect(this.x + this.w / 2 - 1, this.y + 20, 2, 2);
        } else {
            ctx.fillStyle = 'rgba(80, 95, 108, 0.8)';
            ctx.fillRect(this.x + this.w / 2 - 2, this.y + 17, 4, 1);
            ctx.fillRect(this.x + this.w / 2 - 3, this.y + 18, 6, 1);
        }

        // --- Floating crystal core above the plinth ---
        const floatOffset = Math.sin(this.glowTimer * 2.4) * 1.2;
        const coreCx = this.cx;
        const coreCy = this.y + 6 + floatOffset;
        if (ready) {
            // Outer halo
            ctx.fillStyle = `rgba(166, 246, 255, ${0.35 + pulse * 0.3})`;
            ctx.beginPath();
            ctx.arc(coreCx, coreCy, 5.2 + pulse * 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Crystal body (diamond)
            ctx.fillStyle = '#3cc7e0';
            ctx.beginPath();
            ctx.moveTo(coreCx, coreCy - 4);
            ctx.lineTo(coreCx + 3, coreCy);
            ctx.lineTo(coreCx, coreCy + 4);
            ctx.lineTo(coreCx - 3, coreCy);
            ctx.closePath();
            ctx.fill();
            // Highlight sliver
            ctx.fillStyle = '#e8fbff';
            ctx.fillRect(Math.round(coreCx - 1), Math.round(coreCy - 2), 1, 2);
            // Flash on activation
            if (this.activateFlash > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.activateFlash * 0.85})`;
                ctx.beginPath();
                ctx.arc(coreCx, coreCy, 7 + (1 - this.activateFlash) * 6, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Dormant — dark cracked diamond
            ctx.fillStyle = '#2e4552';
            ctx.beginPath();
            ctx.moveTo(coreCx, coreCy - 3);
            ctx.lineTo(coreCx + 2, coreCy);
            ctx.lineTo(coreCx, coreCy + 3);
            ctx.lineTo(coreCx - 2, coreCy);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#1a2630';
            ctx.fillRect(Math.round(coreCx), Math.round(coreCy - 1), 1, 2);
        }

        // --- Ambient motes ---
        for (const m of this.motes) {
            const a = Math.max(0, m.life / m.max);
            ctx.fillStyle = this.ready
                ? `rgba(200, 248, 255, ${a * 0.85})`
                : `rgba(140, 170, 190, ${a * 0.55})`;
            ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
        }

        // --- Cooldown meter (bar beneath when recharging) ---
        if (!ready) {
            const frac = 1 - this.cooldown / this.cooldownMax;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(this.x + 3, this.y + this.h - 1, this.w - 6, 2);
            ctx.fillStyle = PALETTE.mid;
            ctx.fillRect(this.x + 3, this.y + this.h - 1, Math.round((this.w - 6) * frac), 2);
        }
    }
}

export const AETHER_FONT_CONSTANTS = {
    SURGE_RADIUS,
    SURGE_HEAL,
    SURGE_DAMAGE,
    SURGE_COOLDOWN,
};
