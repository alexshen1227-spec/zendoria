import { NATIVE_WIDTH, NATIVE_HEIGHT } from './constants.js?v=20260414-no-bridge-pass2';

const DEADZONE_W = 28;
const DEADZONE_H = 22;
const SMOOTH_RATE = 9;

export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this._initialized = false;
    }

    follow(target, worldW, worldH, dt = 1 / 60) {
        const cx = NATIVE_WIDTH / 2;
        const cy = NATIVE_HEIGHT / 2;

        // Convert current camera origin into a "screen-relative target" so the
        // deadzone box stays centered. We only move the camera if the player
        // strays outside this box.
        const screenX = target.cx - this.x;
        const screenY = target.cy - this.y;

        let desiredX = this.x;
        let desiredY = this.y;
        if (screenX < cx - DEADZONE_W) desiredX = target.cx - (cx - DEADZONE_W);
        else if (screenX > cx + DEADZONE_W) desiredX = target.cx - (cx + DEADZONE_W);
        if (screenY < cy - DEADZONE_H) desiredY = target.cy - (cy - DEADZONE_H);
        else if (screenY > cy + DEADZONE_H) desiredY = target.cy - (cy + DEADZONE_H);

        desiredX = Math.max(0, Math.min(desiredX, worldW - NATIVE_WIDTH));
        desiredY = Math.max(0, Math.min(desiredY, worldH - NATIVE_HEIGHT));

        if (!this._initialized) {
            this.x = desiredX;
            this.y = desiredY;
            this._initialized = true;
        } else {
            const k = 1 - Math.exp(-SMOOTH_RATE * dt);
            this.x += (desiredX - this.x) * k;
            this.y += (desiredY - this.y) * k;
        }
    }

    snap(target, worldW, worldH) {
        // Used after teleports / realm switches so the camera doesn't ease in.
        this._initialized = false;
        this.follow(target, worldW, worldH, 1);
    }

    begin(ctx, shakeX = 0, shakeY = 0) {
        ctx.save();
        ctx.translate(Math.round(-this.x + shakeX), Math.round(-this.y + shakeY));
    }

    end(ctx) {
        ctx.restore();
    }
}
