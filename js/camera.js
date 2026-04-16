import { NATIVE_WIDTH, NATIVE_HEIGHT } from './constants.js?v=20260414-no-bridge-pass2';

export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
    }

    follow(target, worldW, worldH) {
        let tx = target.cx - NATIVE_WIDTH / 2;
        let ty = target.cy - NATIVE_HEIGHT / 2;

        tx = Math.max(0, Math.min(tx, worldW - NATIVE_WIDTH));
        ty = Math.max(0, Math.min(ty, worldH - NATIVE_HEIGHT));

        this.x = Math.round(tx);
        this.y = Math.round(ty);
    }

    begin(ctx, shakeX = 0, shakeY = 0) {
        ctx.save();
        ctx.translate(-this.x + shakeX, -this.y + shakeY);
    }

    end(ctx) {
        ctx.restore();
    }
}
