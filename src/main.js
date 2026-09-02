// Phaser is loaded as a UMD script in index.html and lives on window.Phaser.
import { createGameConfig } from './config/gameConfig.js';

const config = createGameConfig(Phaser);

// Best-effort font preload. Top-level await would block Phaser from
// starting if the font fetch hangs or 403s. Race with a short timeout
// and swallow errors — the CSS @font-face still picks the font up
// once it eventually arrives.
//
// Both faces have to be waited on. Phaser rasterizes a canvas Text object once,
// when it is created, and never repaints it — so a screen built before its font
// arrives is stuck in the fallback for as long as it stays open.
try {
  if (document.fonts?.load) {
    await Promise.race([
      Promise.all([
        document.fonts.load('12px "HoMM Pixel"'),
        document.fonts.load('16px "Garamond UI"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  }
} catch (e) {
  console.warn('Font preload skipped:', e);
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
