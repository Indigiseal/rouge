// Phaser is loaded as a UMD script in index.html and lives on window.Phaser.
import { createGameConfig } from './config/gameConfig.js';
import { loadUiFonts } from './ui/fontFamilies.js';

const config = createGameConfig(Phaser);
let fontLocale = 'en';
try { fontLocale = localStorage.getItem('gameLanguage') || 'en'; } catch {}
try {
  await Promise.race([
    loadUiFonts(fontLocale),
    new Promise(resolve => setTimeout(resolve, 4000)),
  ]);
} catch (error) {
  console.warn('Font preload:', error);
}

window.__game = new Phaser.Game(config);

// The overlay is NOT removed on 'ready'. 'ready' fires when the engine has
// booted, which is long before the ~19MB of assets have downloaded — removing
// it there is what forced PreloadScene to draw a second loading screen and
// hand over to it, and that handover visibly jumped. PreloadScene now drives
// this same overlay and takes it down itself in create().
//
// This is only a safety net: if PreloadScene never gets there (a hard load
// failure), an opaque div must not sit on top of the game forever. Generous,
// because a slow cold load on itch.io legitimately takes a while.
const bootLoader = document.getElementById('boot-loader');
if (bootLoader) {
  setTimeout(() => bootLoader.remove(), 120000);
}
