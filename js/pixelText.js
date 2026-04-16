const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.,!?-/ ';
const CELL_W = 6;
const CELL_H = 8;
const COLS = 8;

export class PixelFont {
    constructor(image) {
        this.image = image;
        this.tintCache = new Map();
    }

    measure(text, scale = 1) {
        const normalized = (text || '').toUpperCase();
        if (!normalized.length) return 0;
        return ((normalized.length * CELL_W) - 1) * scale;
    }

    draw(ctx, text, x, y, options = {}) {
        const {
            color = '#f5f7ff',
            shadow = '#08111d',
            scale = 1,
            alpha = 1,
            align = 'left',
            shadowOffsetX = 1,
            shadowOffsetY = 1,
        } = options;

        const normalized = (text || '').toUpperCase();
        if (!normalized.length) return;

        let drawX = Math.round(x);
        const drawY = Math.round(y);
        const width = this.measure(normalized, scale);

        if (align === 'center') {
            drawX -= Math.round(width / 2);
        } else if (align === 'right') {
            drawX -= width;
        }

        ctx.save();
        ctx.globalAlpha *= alpha;

        if (shadow) {
            this._drawPass(
                ctx,
                normalized,
                drawX + shadowOffsetX,
                drawY + shadowOffsetY,
                this._getTintedAtlas(shadow),
                scale,
            );
        }

        this._drawPass(ctx, normalized, drawX, drawY, this._getTintedAtlas(color), scale);
        ctx.restore();
    }

    _drawPass(ctx, text, x, y, atlas, scale) {
        let cursorX = Math.round(x);
        const drawY = Math.round(y);

        for (const char of text) {
            if (char === ' ') {
                cursorX += CELL_W * scale;
                continue;
            }

            const index = CHARSET.indexOf(char);
            const glyphIndex = index >= 0 ? index : CHARSET.length - 1;
            const sx = (glyphIndex % COLS) * CELL_W;
            const sy = Math.floor(glyphIndex / COLS) * CELL_H;

            ctx.drawImage(
                atlas,
                sx,
                sy,
                CELL_W,
                CELL_H,
                cursorX,
                drawY,
                CELL_W * scale,
                CELL_H * scale,
            );

            cursorX += CELL_W * scale;
        }
    }

    _getTintedAtlas(color) {
        if (this.tintCache.has(color)) {
            return this.tintCache.get(color);
        }

        const canvas = document.createElement('canvas');
        canvas.width = this.image.width;
        canvas.height = this.image.height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.image, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        this.tintCache.set(color, canvas);
        return canvas;
    }
}
