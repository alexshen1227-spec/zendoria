import { loadGameAssets } from './assets.js?v=20260416-realm-split';
import { Game } from './game.js?v=20260416-realm-split';

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
