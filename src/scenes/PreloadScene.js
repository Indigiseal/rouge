import { loadAssetManifest } from '../content/assets/AssetManifest.js';
import { fontFamily } from '../ui/fontFamilies.js';
import { PIXEL_SCALE } from '../config/renderScale.js';
import { wrapUiText } from '../ui/wrapText.js';
import { buildResourceCardTextures } from '../content/assets/resourceCards.js';
import { buildEnemyCardTextures } from '../content/assets/enemyCards.js';
import { buildLocationCardArt } from '../content/assets/locationCardArt.js';
import { buildLocationCardTextures } from '../content/assets/locationCards.js';
import { LOCATION_PACK_LIST } from '../content/location-packs/registry.js';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Draw this before queueing anything: the manifest is ~19MB, most of it
        // audio, and on a cold itch.io load that is several seconds of blank
        // brown canvas that players read as a hang.
        this.createLoadingUI();

        // Asset URLs are plain — no `?v=<timestamp>` suffix.
        //
        // That suffix made every URL unique on every boot, so the browser had
        // never seen any of them and re-downloaded the whole game each load,
        // for players on itch as much as in development. Freshness is the dev
        // server's job now: it answers with an ETag, so an edited file resends
        // and an untouched one costs nothing. See tools/server.mjs.
        this.load.setCORS('anonymous');

        loadAssetManifest(this.load);
    }

    // Loading screen. There is deliberately NO canvas loading UI: the overlay
    // in index.html (#boot-loader) is already on screen before Phaser exists,
    // so this just takes it over and drives it to 100%.
    //
    // Drawing a second bar in the canvas and handing over to it looked broken:
    // the canvas runs at zoom 2, so the same numbers came out twice the size,
    // and canvas text upscaled 2x is blurry next to browser-rendered text. The
    // player saw the bar jump and the font go soft. One screen, one renderer.
    createLoadingUI() {
        const el = (sel) => (typeof document !== 'undefined' ? document.querySelector(sel) : null);
        const track = el('#boot-loader .boot-track');
        const fill = el('#boot-loader .boot-fill');
        const status = el('#boot-loader .boot-status');
        const errors = el('#boot-loader .boot-errors');
        // Headless (sim/tests) or the overlay already removed: nothing to drive.
        if (!track && !status) return;

        // Swap the indeterminate sweep for a real bar now that we can measure.
        track?.classList.add('is-determinate');

        this.load.on('progress', (value) => {
            const pct = Math.round(value * 100);
            if (fill) fill.style.width = `${pct}%`;
            if (status) status.textContent = `Loading... ${pct}%`;
        });

        // itch.io has served 403s for individual files before (see the note in
        // index.html). Phaser carries on regardless, which turns a broken asset
        // into a mystery crash later — so say so here, while it is still cheap
        // to notice.
        let failed = 0;
        this.load.on('loaderror', () => {
            failed += 1;
            if (errors) errors.textContent = `${failed} file${failed === 1 ? '' : 's'} failed to load`;
        });

        this.load.on('complete', () => {
            if (fill) fill.style.width = '100%';
            if (status) status.textContent = 'Ready';
        });
    }

    // Pulled down once the assets are in, so the game is never revealed behind
    // a still-visible loading overlay. main.js keeps a long safety net in case
    // this scene never gets here.
    removeBootLoader() {
        if (typeof document === 'undefined') return;
        document.getElementById('boot-loader')?.remove();
    }

    create() {
        // Assets are in — take the loading overlay down before anything draws.
        this.removeBootLoader();
        this.installCrispTextFactory();

        // Each location's back, flip and hover, off the shared sheets. Built
        // before the fallbacks below so a missing row falls back to them.
        buildLocationCardArt(this);

        this.anims.create({
            key: 'card_flip_anim',
            frames: [
                { key: 'cardFlip1' },
                { key: 'cardFlip2' },
                { key: 'cardFlip3' },
                { key: 'cardFlip4' },
                { key: 'cardFlip5' },
            ],
            frameRate: 24,
            repeat: 0
        });
        this.anims.create({
            key: 'card_hover_anim',
            frames: [
                { key: 'cardHover1' },
                { key: 'cardHover2' },
                { key: 'cardHover3' },
                { key: 'cardHover4' },
                { key: 'cardHover5' },
            ],
            frameRate: 24,
            repeat: 0
        });
        // Create twinkle animation for mergeable cards
        this.anims.create({
            key: 'twinkle_anim',
            frames: this.anims.generateFrameNumbers('twinkle', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // The gem_*_sparkle / gem_*_hover animations used to live here, six
        // frames per colour off gemsRGY. They are gone with that sheet: a loose
        // gem now wears gemsTiered, and playing an animation built from the old
        // texture would have swapped the stone back to the 16x16 art the moment
        // the pointer touched it.
        //
        // enableGemDrag asks anims.exists() before playing either, so their
        // absence is handled: the gem simply sits still. The masked sweep in
        // ui/GemShine.js is the replacement when we want loose gems to catch
        // the light too.
        
    
        this.anims.create({
            key: 'splash_anim',
            frames: this.anims.generateFrameNumbers('splashSheet', { start: 0, end: 6 }),
            frameRate: 12, // Adjust speed (10fps)
            repeat: 0 // Play once
        });

        // Smoke burst — the Smoke Screen spell, and the toll goblins vanishing.
        if (this.textures.exists('smokeBombAnim')) {
            this.anims.create({
                key: 'smoke_bomb_anim',
                frames: this.anims.generateFrameNumbers('smokeBombAnim', { start: 0, end: 10 }),
                frameRate: 16,
                repeat: 0
            });
        }

        // Board defeat-loot pickups (Prospector's Pick). Play on the tile where
        // an enemy died, like the mimic's treasure scatter.
        this.anims.create({
            key: 'coin_jump_anim',
            frames: this.anims.generateFrameNumbers('coinJumpSheet', { start: 0, end: 8 }),
            frameRate: 15,
            repeat: 0
        });
        this.anims.create({
            key: 'crystal_scatter_anim',
            frames: this.anims.generateFrameNumbers('crystalScatterSheet', { start: 0, end: 10 }),
            frameRate: 15,
            repeat: 0
        });

        if (this.textures.exists('bossDeathMask')) {
            this.anims.create({
                key: 'boss_death_mask',
                frames: this.anims.generateFrameNumbers('bossDeathMask', { start: 0, end: 4 }),
                frameRate: 12,
                repeat: 0
            });
        }

        this.anims.create({
            key: 'poof_empty_anim',
            frames: this.anims.generateFrameNumbers('poofEmpty', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });

        this.anims.create({
            key: 'poison_poof_anim',
            frames: this.anims.generateFrameNumbers('poisonPoof', { start: 0, end: 4 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'poison_status_anim',
            frames: this.anims.generateFrameNumbers('poisonedStatus', { start: 0, end: 4 }),
            frameRate: 6,
            repeat: -1
        });

        this.anims.create({
            key: 'shock_status_anim',
            frames: this.anims.generateFrameNumbers('shockedStatus', { start: 0, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        ['fire', 'poison', 'lightning'].forEach((effect, row) => {
            this.anims.create({
                key: `gem_card_${effect}_loop`,
                frames: this.anims.generateFrameNumbers('gemEffectsOnCards', { start: row * 7, end: row * 7 + 6 }),
                frameRate: 10,
                repeat: -1
            });
        });

        // Enemy hit effects (64x80, 5 frames/row): fire, poison, lightning. Play once.
        ['fire', 'poison', 'lightning'].forEach((effect, row) => {
            this.anims.create({
                key: `enemy_hit_${effect}`,
                frames: this.anims.generateFrameNumbers('enemiesHitEffects', { start: row * 5, end: row * 5 + 4 }),
                frameRate: 14,
                repeat: 0
            });
        });

        this.anims.create({
            key: 'big_chest_open',
            frames: this.anims.generateFrameNumbers('bigChestAnimation', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: 0
        });
         
        // Resource cards are the sheet's icon and backing drawn together, so
        // the rest of the game keeps handling them as ordinary one-sprite cards.
        buildResourceCardTextures(this);
        buildEnemyCardTextures(this, LOCATION_PACK_LIST);
        buildLocationCardTextures(this);

        this.scene.start('MainMenuScene');
    }

    installCrispTextFactory() {
        const factory = Phaser.GameObjects.GameObjectFactory.prototype;
        if (factory._rogueOriginalTextFactory) return;
        factory._rogueOriginalTextFactory = factory.text;
        const original = factory.text;
        // All ordinary UI uses real Unicode text. The old global bitmap
        // substitution ignored fonts, weights, outlines, colors, and glyphs.
        factory.text = function (x, y, text = '', style = {}) {
            const role = style.fontRole || (String(style.fontFamily).includes('UI Serif') ? 'reading' : 'feedback');
            const locale = this.scene.game?.language || 'en';
            const resolved = {
                ...style,
                fontFamily: fontFamily(role, locale),
                fontStyle: style.fontStyle || (role === 'reading' ? '500' : '600'),
                resolution: style.resolution || PIXEL_SCALE,
            };
            if (style.wordWrap?.width && !style.wordWrap.callback) {
                resolved.wordWrap = { ...style.wordWrap, callback: wrapUiText };
            }
            const object = original.call(this, x, y, text, resolved);
            const nativeSetText = object.setText.bind(object);
            object.setText = value => {
                const family = fontFamily(role, this.scene.game?.language || 'en');
                if (object.style.fontFamily !== family) object.setFontFamily(family);
                return nativeSetText(value);
            };
            // A font that arrives after a slow boot must repaint existing Text
            // textures too; loading the face alone doesn't update Phaser text.
            const refresh = () => { if (object.scene) object.updateText(); };
            document.fonts?.addEventListener('loadingdone', refresh);
            object.once('destroy', () => document.fonts?.removeEventListener('loadingdone', refresh));
            return object;
        };
    }
}
