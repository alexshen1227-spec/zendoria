export class Input {
    constructor() {
        this.held = {};
        this.pressed = {};
        this.mouseHeld = false;
        this.mousePressed = false;

        window.addEventListener('keydown', (event) => {
            if (!this.held[event.code]) this.pressed[event.code] = true;
            this.held[event.code] = true;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Backspace'].includes(event.code)) {
                event.preventDefault();
            }
        });

        window.addEventListener('keyup', (event) => {
            this.held[event.code] = false;
        });

        window.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            if (!this.mouseHeld) this.mousePressed = true;
            this.mouseHeld = true;
        });

        window.addEventListener('mouseup', (event) => {
            if (event.button === 0) this.mouseHeld = false;
        });

        // Clear stuck inputs when window loses focus or visibility — otherwise
        // a held key during alt-tab can leave the player walking forever.
        const clearAll = () => {
            this.held = {};
            this.pressed = {};
            this.mouseHeld = false;
            this.mousePressed = false;
        };
        window.addEventListener('blur', clearAll);
        window.addEventListener('contextmenu', clearAll);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearAll();
        });
    }

    clearAll() {
        this.held = {};
        this.pressed = {};
        this.mouseHeld = false;
        this.mousePressed = false;
    }

    isDown(code) {
        return !!this.held[code];
    }

    wasPressed(code) {
        return !!this.pressed[code];
    }

    wasLeftClicked() {
        return this.mousePressed;
    }

    isLeftHeld() {
        return this.mouseHeld;
    }

    endFrame() {
        this.pressed = {};
        this.mousePressed = false;
    }

    getMovement() {
        let dx = 0;
        let dy = 0;

        if (this.isDown('ArrowLeft') || this.isDown('KeyA')) dx -= 1;
        if (this.isDown('ArrowRight') || this.isDown('KeyD')) dx += 1;
        if (this.isDown('ArrowUp') || this.isDown('KeyW')) dy -= 1;
        if (this.isDown('ArrowDown') || this.isDown('KeyS')) dy += 1;

        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.SQRT2;
            dx *= inv;
            dy *= inv;
        }

        return { x: dx, y: dy };
    }
}
