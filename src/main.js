// Phaser is loaded as a UMD script in index.html and lives on window.Phaser.
import { createGameConfig } from './config/gameConfig.js';

const config = createGameConfig(Phaser);

// Best-effort font preload. Top-level await would block Phaser from
// starting if the font fetch hangs or 403s. Race with a short timeout
// and swallow errors — the CSS @font-face still picks the font up
// once it eventually arrives.
try {
  if (document.fonts?.load) {
    await Promise.race([
      document.fonts.load('12px "HoMM Pixel"'),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  }
} catch (e) {
  console.warn('Font preload skipped:', e);
}

window.__game = new Phaser.Game(config);
