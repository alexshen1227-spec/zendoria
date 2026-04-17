const STAGE_HP = [6, 3];
const DRAW_SCALE = 0.82;

export class Pillar {
    constructor(definition, sheet, savedStage = 0) {
        this.id = definition.id;
        this.biome = definition.biome || 'desert';
        this.accent = definition.accent || '#c68bff';
        this.baseX = definition.x;
        this.baseY = definition.y;
        this.sheet = sheet;

        this.drawW = sheet ? Math.round(sheet.frameW * DRAW_SCALE) : 38;
        this.drawH = sheet ? Math.round(sheet.frameH * DRAW_SCALE) : 40;
        this.x = Math.round(this.baseX - this.drawW / 2);
        this.y = Math.round(this.baseY - this.drawH);

        const clampedStage = Math.max(0, Math.min(2, savedStage | 0));
        this.stage = clampedStage;
        this.health = clampedStage >= 2 ? 0 : STAGE_HP[clampedStage];

        this.flashTimer = 0;
        this.hitTimer = 0;
        this.glowTimer = Math.random() * Math.PI * 2;
        this.shatterTimer = 0;
    }

    get cx() { return this.x + this.drawW / 2; }
    get cy() { return this.y + this.drawH / 2; }
    get sortY() { return this.y + this.drawH; }
    get destroyed() { return this.stage >= 2; }

    update(dt) {
        this.glowTimer += dt;
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);
        if (this.hitTimer > 0) this.hitTimer = Math.max(0, this.hitTimer - dt);
        if (this.shatterTimer > 0) this.shatterTimer = Math.max(0, this.shatterTimer - dt);
    }

    getCollider() {
        if (this.destroyed) return null;
        const w = Math.max(12, Math.round(this.drawW * 0.36));
        const h = 7;
        return {
            x: Math.round(this.cx - w / 2),
            y: this.y + this.drawH - h,
            w,
            h,
        };
    }

    getInteractRect() {
        if (this.destroyed) return null;
        const w = Math.max(18, Math.round(this.drawW * 0.72));
        const h = Math.max(20, Math.round(this.drawH * 0.58));
        return {
            x: Math.round(this.cx - w / 2),
            y: Math.round(this.y + this.drawH - h),
            w,
            h,
        };
    }

    // Returns { landed, stageChanged, destroyed }.
    takeHit(damage = 1) {
        if (this.destroyed) return { landed: false, stageChanged: false, destroyed: false };

        const prevStage = this.stage;
        this.health = Math.max(0, this.health - damage);
        this.flashTimer = 0.18;
        this.hitTimer = 0.28;

        if (this.stage === 0 && this.health <= 0) {
            this.stage = 1;
            this.health = STAGE_HP[1];
        } else if (this.stage === 1 && this.health <= 0) {
            this.stage = 2;
            this.health = 0;
            this.shatterTimer = 0.6;
        }

        return {
            landed: true,
            stageChanged: this.stage !== prevStage,
            destroyed: this.stage >= 2,
        };
    }

    draw(ctx) {
        const pulse = Math.sin(this.glowTimer * 2.2) * 0.5 + 0.5;
        const shadowAlpha = this.destroyed ? 0.3 : 0.28 + pulse * 0.05;

        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.drawH - 2, this.drawW * 0.38, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (!this.destroyed) {
            const glowAlpha = this.stage === 0
                ? 0.14 + pulse * 0.12
                : 0.08 + pulse * 0.08;
            const gx = this.cx;
            const gy = this.y + this.drawH * 0.45;
            const grad = ctx.createRadialGradient(gx, gy, 1, gx, gy, this.drawW * 0.95);
            grad.addColorStop(0, this._glowColor(glowAlpha));
            grad.addColorStop(0.55, this._glowColor(glowAlpha * 0.55));
            grad.addColorStop(1, this._glowColor(0));
            ctx.fillStyle = grad;
            ctx.fillRect(this.x - 10, this.y - 12, this.drawW + 20, this.drawH + 18);
        }

        if (this.sheet) {
            const jitterX = this.flashTimer > 0 ? (Math.random() * 2 - 1) * 1.1 : 0;
            const jitterY = this.flashTimer > 0 ? (Math.random() * 2 - 1) * 0.7 : 0;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            const sx = this.stage * this.sheet.frameW;
            ctx.drawImage(
                this.sheet.image,
                sx, 0,
                this.sheet.frameW, this.sheet.frameH,
                Math.round(this.x + jitterX),
                Math.round(this.y + jitterY),
                this.drawW,
                this.drawH,
            );
            if (this.flashTimer > 0) {
                const t = this.flashTimer / 0.18;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.55 * t;
                ctx.drawImage(
                    this.sheet.image,
                    sx, 0,
                    this.sheet.frameW, this.sheet.frameH,
                    Math.round(this.x + jitterX),
                    Math.round(this.y + jitterY),
                    this.drawW,
                    this.drawH,
                );
                ctx.restore();
            }
            ctx.restore();
        }

        if (!this.destroyed) {
            // Tiny rune runes drifting upward from the pillar top
            const driftT = (this.glowTimer * 0.55) % 1;
            const dy = this.y + this.drawH * 0.25 - driftT * 10;
            ctx.fillStyle = `rgba(220, 180, 255, ${0.28 * (1 - driftT)})`;
            ctx.fillRect(Math.round(this.cx - 1), Math.round(dy), 2, 2);
            const driftT2 = ((this.glowTimer * 0.55) + 0.5) % 1;
            const dy2 = this.y + this.drawH * 0.3 - driftT2 * 12;
            ctx.fillStyle = `rgba(180, 255, 240, ${0.25 * (1 - driftT2)})`;
            ctx.fillRect(Math.round(this.cx + 3), Math.round(dy2), 2, 2);
        }
    }

    _glowColor(alpha) {
        if (this.accent.startsWith('rgba') || this.accent.startsWith('rgb')) {
            return this.accent;
        }
        const hex = this.accent.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}
