export class Elara {
    constructor(x, y, assets) {
        this.x = x;
        this.y = y;
        this.w = 24;
        this.h = 32;
        this.sheet = assets.elaraIdleSheet;
        this.frameTimer = 0;
        this.frameIndex = 0;
        this.frameDuration = 0.22; // ~4.5 fps idle cycle
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    getInteractRect() {
        return { x: this.x - 10, y: this.y - 6, w: this.w + 20, h: this.h + 12 };
    }

    getCollider() {
        return {
            x: Math.round(this.x + 6),
            y: Math.round(this.y + this.h - 8),
            w: this.w - 12,
            h: 6,
        };
    }

    get sortY() {
        return this.y + this.h;
    }

    update(dt) {
        this.frameTimer += dt;
        if (this.frameTimer >= this.frameDuration) {
            this.frameTimer -= this.frameDuration;
            this.frameIndex = (this.frameIndex + 1) % this.sheet.cols;
        }
    }

    draw(ctx, time) {
        const x = Math.round(this.x);
        const y = Math.round(this.y);

        // shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + 4, y + this.h - 2, this.w - 8, 2);

        this.sheet.drawFrame(ctx, this.frameIndex, 0, x, y);
    }
}
