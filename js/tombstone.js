export class Tombstone {
    constructor(x, y, sheet) {
        this.sheet = sheet;
        const targetH = 44;
        const ratio = sheet ? (sheet.frameW / sheet.frameH) : (34 / 44);
        this.h = targetH;
        this.w = Math.round(targetH * ratio);
        this.x = Math.round(x - this.w / 2);
        this.y = Math.round(y - this.h);
        this.glowTimer = 0;
        this.activeTimer = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    get sortY() { return this.y + this.h; }

    update(dt) {
        this.glowTimer += dt;
        this.activeTimer = Math.max(0, this.activeTimer - dt);
    }

    activate() {
        this.activeTimer = 1.2;
    }

    getCollider() {
        return {
            x: this.x + 4,
            y: this.y + this.h - 6,
            w: this.w - 8,
            h: 5,
        };
    }

    getInteractRect() {
        return {
            x: this.x - 10,
            y: this.y - 6,
            w: this.w + 20,
            h: this.h + 14,
        };
    }

    draw(ctx) {
        const glow = Math.sin(this.glowTimer * 2.2) * 0.5 + 0.5;
        const frameIndex = this._getFrameIndex();
        const activeMix = frameIndex === 1 ? 1 : 0;

        ctx.fillStyle = `rgba(0, 0, 0, ${0.24 + activeMix * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 2, this.w * 0.38, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        const aura = ctx.createRadialGradient(
            this.cx,
            this.y + this.h * 0.32,
            1,
            this.cx,
            this.y + this.h * 0.32,
            this.w * (0.75 + activeMix * 0.25),
        );
        aura.addColorStop(0, `rgba(132, 246, 255, ${0.08 + glow * 0.08 + activeMix * 0.18})`);
        aura.addColorStop(0.55, `rgba(96, 222, 255, ${0.03 + glow * 0.04 + activeMix * 0.08})`);
        aura.addColorStop(1, 'rgba(96, 222, 255, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(this.x - this.w, this.y - this.h * 0.45, this.w * 3, this.h * 1.5);

        if (this.sheet) {
            ctx.drawImage(
                this.sheet.image,
                frameIndex * this.sheet.frameW,
                0,
                this.sheet.frameW,
                this.sheet.frameH,
                this.x,
                this.y,
                this.w,
                this.h,
            );
        } else {
            ctx.fillStyle = '#4a4750';
            ctx.fillRect(this.x, this.y + 4, this.w, this.h - 4);
            ctx.fillStyle = '#6d6a74';
            ctx.fillRect(this.x + 2, this.y + 4, this.w - 4, this.h - 8);
            ctx.fillStyle = '#2b2930';
            ctx.fillRect(this.x + (this.w >> 1) - 1, this.y + 12, 2, 10);
        }
    }

    _getFrameIndex() {
        if (this.activeTimer > 0) return 1;

        const idleCycle = this.glowTimer % 2.8;
        return idleCycle > 2.45 ? 1 : 0;
    }
}
