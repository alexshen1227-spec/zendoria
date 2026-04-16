export class SpriteSheet {
    constructor(image, frameW, frameH) {
        this.image = image;
        this.frameW = frameW;
        this.frameH = frameH;
        this.cols = Math.floor(image.width / frameW);
        this.rows = Math.floor(image.height / frameH);
    }

    drawFrame(ctx, col, row, x, y, options = {}) {
        const {
            alpha = 1,
            flipX = false,
            flipY = false,
            rotation = 0,
            originX = 0,
            originY = 0,
        } = options;

        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.translate(Math.round(x + originX), Math.round(y + originY));
        if (rotation) ctx.rotate(rotation);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(
            this.image,
            col * this.frameW,
            row * this.frameH,
            this.frameW,
            this.frameH,
            -originX,
            -originY,
            this.frameW,
            this.frameH,
        );
        ctx.restore();
    }
}

export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}
