export class TreasureChest {
    constructor(definition, images = {}, opened = false) {
        this.id = definition.id || 'desert-treasure-chest';
        this.prompt = definition.prompt || 'E: OPEN TREASURE';
        this.baseX = definition.x;
        this.baseY = definition.y;
        this.closedImage = images.closed || null;
        this.openImage = images.open || null;
        this.glowTimer = 0;
        this.activeTimer = 0;
        this.opened = !!opened;

        this._syncBounds();
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }

    update(dt) {
        this.glowTimer += dt;
        this.activeTimer = Math.max(0, this.activeTimer - dt);
    }

    setOpened(opened = true) {
        this.opened = !!opened;
        this.activeTimer = 1.35;
        this._syncBounds();
    }

    getCollider() {
        const footprintW = Math.max(18, Math.round(this.w * 0.46));
        const footprintH = 6;
        return {
            x: Math.round(this.cx - footprintW / 2),
            y: this.y + this.h - footprintH,
            w: footprintW,
            h: footprintH,
        };
    }

    getInteractRect() {
        return {
            x: this.x - 10,
            y: this.y - 8,
            w: this.w + 20,
            h: this.h + 16,
        };
    }

    draw(ctx) {
        const image = this._currentImage();
        const pulse = Math.sin(this.glowTimer * 3.1) * 0.5 + 0.5;
        const activeMix = this.activeTimer > 0 ? Math.min(1, this.activeTimer / 1.35) : 0;
        const glowAlpha = this.opened
            ? 0.08 + pulse * 0.05 + activeMix * 0.16
            : 0.12 + pulse * 0.09 + activeMix * 0.18;

        ctx.fillStyle = `rgba(0, 0, 0, ${0.22 + activeMix * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 3, this.w * 0.36, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        const aura = ctx.createRadialGradient(
            this.cx,
            this.y + this.h * 0.44,
            1,
            this.cx,
            this.y + this.h * 0.44,
            this.w * (this.opened ? 0.72 : 0.82),
        );
        aura.addColorStop(0, `rgba(255, 224, 116, ${glowAlpha})`);
        aura.addColorStop(0.55, `rgba(255, 182, 82, ${glowAlpha * 0.55})`);
        aura.addColorStop(1, 'rgba(255, 182, 82, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(this.x - 14, this.y - 14, this.w + 28, this.h + 24);

        if (image) {
            ctx.drawImage(image, this.x, this.y, this.w, this.h);
            return;
        }

        ctx.fillStyle = '#5f442c';
        ctx.fillRect(this.x + 4, this.y + 14, this.w - 8, this.h - 16);
        ctx.fillStyle = '#8e6a43';
        ctx.fillRect(this.x + 8, this.y + 8, this.w - 16, 12);
    }

    _currentImage() {
        return this.opened
            ? (this.openImage || this.closedImage)
            : (this.closedImage || this.openImage);
    }

    _syncBounds() {
        const image = this._currentImage();

        if (image) {
            const maxW = 76;
            const maxH = 64;
            const scale = Math.min(maxW / image.width, maxH / image.height);
            this.w = Math.max(48, Math.round(image.width * scale));
            this.h = Math.max(36, Math.round(image.height * scale));
        } else {
            this.w = 62;
            this.h = 48;
        }

        this.x = Math.round(this.baseX - this.w / 2);
        this.y = Math.round(this.baseY - this.h);
    }
}
