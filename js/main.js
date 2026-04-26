import { loadGameAssets } from './assets.js?v=20260426-npc-matte-fix';
import { Game } from './game.js?v=20260425-sidequests';

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
        window.__zendoriaGame = game;
        game.run();

        console.log('%cZendoria - Driftmere Isle build loaded', 'color: #8dffe2; font-weight: bold;');
    } catch (error) {
        console.error(error);
        if (loadingLabel) loadingLabel.textContent = 'Asset load failed. Check console.';
    }
});
