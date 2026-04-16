export class Portal {
    constructor(definition, image) {
        this.id = definition.id;
        this.targetRealmId = definition.targetRealmId;
        this.arrivalKey = definition.arrivalKey;
        this.prompt = definition.prompt;
        this.image = image;
        this.baseX = definition.x;
        this.baseY = definition.y;
        this.markerType = definition.markerType || 'portal';

        if (image) {
            const maxW = 82;
            const maxH = 88;
            const scale = Math.min(maxW / image.width, maxH / image.height);
            this.w = Math.max(44, Math.round(image.width * scale));
            this.h = Math.max(48, Math.round(image.height * scale));
        } else {
            this.w = 44;
            this.h = 36;
        }
        this.x = Math.round(this.baseX - this.w / 2);
        this.y = Math.round(this.baseY - this.h);
        this.pulseTimer = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get sortY() { return this.y + this.h; }

    update(dt) {
        this.pulseTimer += dt;
    }

    getInteractRect() {
        return {
            x: this.x + 4,
            y: this.y + Math.max(8, Math.round(this.h * 0.28)),
            w: this.w - 8,
            h: Math.max(48, Math.round(this.h * 0.9)),
        };
    }

    getCollider() {
        const colliderW = Math.max(12, Math.round(this.w * 0.42));
        const colliderH = 6;
        return {
            x: Math.round(this.cx - colliderW / 2),
            y: Math.round(this.y + this.h - colliderH - 2),
            w: colliderW,
            h: colliderH,
        };
    }

    draw(ctx) {
        const pulse = Math.sin(this.pulseTimer * 3.4) * 0.5 + 0.5;

        ctx.fillStyle = `rgba(10, 14, 24, ${0.24 + pulse * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h - 2, this.w * 0.32, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        const aura = ctx.createRadialGradient(
            this.cx,
            this.y + this.h * 0.5,
            2,
            this.cx,
            this.y + this.h * 0.5,
            this.w * 0.7,
        );
        aura.addColorStop(0, `rgba(155, 240, 255, ${0.1 + pulse * 0.1})`);
        aura.addColorStop(0.5, `rgba(117, 169, 255, ${0.07 + pulse * 0.08})`);
        aura.addColorStop(1, 'rgba(117, 169, 255, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(this.x - 10, this.y - 6, this.w + 20, this.h + 12);

        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
        } else {
            ctx.fillStyle = '#34294f';
            ctx.fillRect(this.x + 4, this.y + 2, this.w - 8, this.h - 2);
            ctx.fillStyle = '#78d7ff';
            ctx.fillRect(this.x + 8, this.y + 5, this.w - 16, this.h - 8);
        }
    }
}
