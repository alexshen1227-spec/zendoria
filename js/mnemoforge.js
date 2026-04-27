// Mnemoforge Altar — a Zen'Korah-era re-temper slab.
// Interacting respecs the player's skill tree. The altar is lore-described as
// "a forge powered by memory loss" (ReadMeForContext1 #42). Each use after the
// first taxes a portion of current-level XP — the altar quite literally
// consumes a memory to melt the soul.
//
// Interface matches BuffShrine / AetherFont:
//   getCollider(), getInteractRect(), update(dt), draw(ctx), sortY, prompt
//
// State surfaces consumed by Game.js:
//   used (bool)    — has the player ever used it? First use is free.
//   glyphs[]       — floating Wyrmscript glyphs drawn above the slab.

const PALETTE = {
    slabDark: '#141018',
    slabMid: '#241d2c',
    slabLight: '#3a2e46',
    seam: '#f0e6ff',
    glyph: '#c2b0ff',
    glyphFaint: '#6b568c',
    emberCore: '#ffb8f5',
    emberOuter: '#5c2f7e',
};

export class Mnemoforge {
    constructor(definition) {
        this.id = definition.id || 'mnemoforge-altar';
        // Definition x/y = bottom-center of the slab; convert to top-left box.
        this.x = Math.round(definition.x) - 14;
        this.y = Math.round(definition.y) - 10;
        this.w = 28;
        this.h = 12;

        this.glowTimer = Math.random() * Math.PI * 2;
        this.used = false;
        this.flash = 0;           // brief bright spike after use
        this.prompt = 'E: TEMPER MEMORY';

        // Three glyphs that slowly rotate above the slab in Wyrmscript.
        // Values are stable — script "rearranges itself when you look away"
        // so we only reseed on activation to keep it feeling inscribed.
        this.glyphs = [];
        for (let i = 0; i < 3; i++) this.glyphs.push(this._rollGlyph(i));
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }

    _rollGlyph(index) {
        // Small 3x3 glyph table — each rolls a subset of lit bits.
        const GLYPHS = [
            0b101010101, 0b010111010, 0b111010111, 0b110101011,
            0b011101110, 0b100111001, 0b001111100, 0b101101101,
        ];
        return {
            bits: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
            offset: index * (Math.PI * 2 / 3),
        };
    }

    update(dt) {
        this.glowTimer += dt;
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);
    }

    activate() {
        // Re-inscribe glyphs every use (the slab literally rearranges).
        for (let i = 0; i < this.glyphs.length; i++) this.glyphs[i] = this._rollGlyph(i);
        this.flash = 1;
        this.used = true;
    }

    getCollider() {
        // Low flat slab — block the middle 20px with 4px depth so enemies and
        // player can't clip through, but the approach is wide open.
        return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 };
    }

    getInteractRect() {
        // Generous rect: the slab is low, so let the player stand over it.
        return { x: this.x - 6, y: this.y - 10, w: this.w + 12, h: this.h + 22 };
    }

    draw(ctx) {
        const pulse = Math.sin(this.glowTimer * 2.1) * 0.5 + 0.5;

        // Shadow halo (a dim absence — the altar eats light).
        ctx.fillStyle = 'rgba(12, 6, 20, 0.55)';
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 1, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Faint purple aura that breathes.
        const auraA = 0.08 + pulse * 0.06 + this.flash * 0.4;
        const aura = ctx.createRadialGradient(this.cx, this.cy, 2, this.cx, this.cy, 30);
        aura.addColorStop(0, `rgba(200, 160, 255, ${auraA})`);
        aura.addColorStop(1, 'rgba(200, 160, 255, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(this.x - 12, this.y - 14, this.w + 24, this.h + 28);

        // Slab body — three horizontal bands of polished volcanic glass.
        ctx.fillStyle = PALETTE.slabDark;
        ctx.fillRect(this.x, this.y + this.h - 4, this.w, 4);
        ctx.fillStyle = PALETTE.slabMid;
        ctx.fillRect(this.x + 1, this.y + this.h - 8, this.w - 2, 4);
        ctx.fillStyle = PALETTE.slabLight;
        ctx.fillRect(this.x + 2, this.y + this.h - 12, this.w - 4, 4);

        // Top seam — a pale crack that splits the slab lengthwise.
        ctx.fillStyle = `rgba(240, 230, 255, ${0.55 + pulse * 0.35})`;
        ctx.fillRect(this.x + 3, this.y + 1, this.w - 6, 1);
        // Reflected smear beneath the seam.
        ctx.fillStyle = `rgba(240, 230, 255, ${0.12 + pulse * 0.08})`;
        ctx.fillRect(this.x + 5, this.y + 3, this.w - 10, 1);

        // Floating glyphs — rotate slowly above the slab.
        for (const glyph of this.glyphs) {
            const t = this.glowTimer * 0.8 + glyph.offset;
            const gx = Math.round(this.cx + Math.cos(t) * 10 - 1);
            const gy = Math.round(this.y - 3 + Math.sin(t * 0.7) * 1.5);
            this._drawGlyph(ctx, gx, gy, glyph.bits, pulse);
        }

        // Ember core — the hungry mouth of the forge. During flash it pops.
        const emberA = 0.5 + pulse * 0.3 + this.flash * 0.6;
        ctx.fillStyle = `rgba(255, 184, 245, ${emberA})`;
        ctx.fillRect(this.cx - 2, this.y + this.h - 7, 4, 2);
        ctx.fillStyle = `rgba(92, 47, 126, ${0.4 + this.flash * 0.4})`;
        ctx.fillRect(this.cx - 3, this.y + this.h - 6, 6, 1);
    }

    _drawGlyph(ctx, x, y, bits, pulse) {
        // 3x3 lit/dim matrix, bit 8 = top-left.
        const hot = this.flash > 0;
        const col = hot
            ? `rgba(255, 220, 255, ${0.8 + this.flash * 0.2})`
            : `rgba(194, 176, 255, ${0.55 + pulse * 0.35})`;
        const cold = `rgba(107, 86, 140, ${0.25})`;
        for (let row = 0; row < 3; row++) {
            for (let c = 0; c < 3; c++) {
                const b = (bits >> (8 - (row * 3 + c))) & 1;
                ctx.fillStyle = b ? col : cold;
                ctx.fillRect(x + c, y + row, 1, 1);
            }
        }
    }
}
