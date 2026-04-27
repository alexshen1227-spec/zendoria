import { loadGameAssets } from './assets.js?v=20260426-npc-matte-fix';
import { Game } from './game.js?v=20260426-hint-and-esc';

const params = new URLSearchParams(window.location.search);
if (params.get('resetSave') === '1') {
    try {
        localStorage.removeItem('zendoria-save-v1');
        localStorage.removeItem('zendoria-checkpoints-v1');
        console.warn('Zendoria: save state cleared by ?resetSave=1');
    } catch (err) {
        console.warn('Zendoria: unable to clear save state', err);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('game-canvas');
    const loadingLabel = document.querySelector('[data-loading-label]');

    if (!canvas) {
        console.error('Zendoria: #game-canvas element not found.');
        return;
    }

    try {
        if (loadingLabel) loadingLabel.textContent = 'Loading Driftmere Isle build...';
        const assets = await loadGameAssets();
        if (loadingLabel) loadingLabel.textContent = 'Up/Down or W/S to move, Enter or Space to select. Esc opens settings in-game.';

        const game = new Game(canvas, assets);
        // Dev hook: only expose the game on window when explicitly opted in.
        // Keeps console access for the developer (?dev=1 or localStorage flag)
        // while staying invisible to itch.io / public players.
        const devEnabled =
            params.get('dev') === '1' ||
            (() => {
                try { return localStorage.getItem('zendoria-dev-mode') === 'true'; }
                catch (_) { return false; }
            })();
        if (devEnabled) window.__zendoriaGame = game;
        game.run();

        console.log('%cZendoria - Driftmere Isle build loaded', 'color: #8dffe2; font-weight: bold;');
    } catch (error) {
        console.error(error);
        if (loadingLabel) loadingLabel.textContent = 'Asset load failed. Check console.';
    }
});
