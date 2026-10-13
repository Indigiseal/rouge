// scenes/BackgroundAudioScene.js
// Loads LATE_AUDIO (content/assets/AssetManifest.js) quietly behind the main
// menu: sounds only heard mid-fight — every enemy's own death, armor types,
// blocks, the rarer combat moments. Each of them used to be decoded before the
// first screen could draw, and the boot screen waited for all of them.
//
// Launched once by PreloadScene and left running with nothing on screen; the
// audio cache is shared by every scene, so a sound is playable everywhere as
// soon as it lands. Until then SoundHelper skips an unloaded key quietly, and
// each of these has an older sound behind it (a death falls back to the shared
// enemy_death pair, armor to the clank), so nothing in a fight goes silent.

import { LATE_AUDIO } from '../content/assets/AssetManifest.js';

export class BackgroundAudioScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BackgroundAudioScene' });
    }

    create() {
        const pending = LATE_AUDIO.filter((asset) => !this.cache.audio.exists(asset.key));
        if (!pending.length) return;
        pending.forEach((asset) => this.load.audio(asset.key, asset.path));
        // A missing file must not stop the rest; it just stays unloaded.
        this.load.on('loaderror', (file) => console.warn('Background audio failed:', file?.key));
        this.load.start();
    }
}
