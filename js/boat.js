export class Boat {
    constructor(x, y, assets) {
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 20;
        this.sprite = assets.rowboatSprite;
        this.bob = 0;
        this.ridden = false;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    getInteractRect() {
        // Generous range so the player can mount from any approach side.
        return { x: this.x - 14, y: this.y - 12, w: this.w + 28, h: this.h + 26 };
    }

    getCollider() {
        return {
            x: Math.round(this.x + 4),
            y: Math.round(this.y + this.h - 6),
            w: this.w - 8,
            h: 4,
        };
    }

    get sortY() { return this.y + this.h; }

    update(dt) {
        this.bob += dt;
    }

    draw(ctx) {
        const bob = this.ridden ? 0 : Math.round(Math.sin(this.bob * 1.8) * 0.6);
        const x = Math.round(this.x);
        const y = Math.round(this.y) + bob;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(x + 2, y + this.h - 1, this.w - 4, 2);
        ctx.drawImage(this.sprite, x, y);
    }
}
