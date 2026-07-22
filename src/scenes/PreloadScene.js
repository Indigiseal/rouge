import { loadAssetManifest } from '../content/assets/AssetManifest.js';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Append a timestamp to every asset URL so Phaser never serves a
        // stale texture from its internal cache during development.
        // Remove queryURL before shipping (or it bloats itch.io logs).
        this.load.setCORS('anonymous');
        this.load.on('filedatareceived', () => {});
        const _origImage = this.load.image.bind(this.load);
        const _origSheet = this.load.spritesheet.bind(this.load);
        const _origAudio = this.load.audio.bind(this.load);
        const _origBitmap = this.load.bitmapFont.bind(this.load);
        const v = `?v=${Date.now()}`;
        this.load.image = (key, url, ...rest) => _origImage(key, Array.isArray(url) ? url.map(u => u + v) : url + v, ...rest);
        this.load.spritesheet = (key, url, ...rest) => _origSheet(key, url + v, ...rest);
        this.load.audio = (key, url, ...rest) => _origAudio(key, Array.isArray(url) ? url.map(u => u + v) : url + v, ...rest);
        this.load.bitmapFont = (key, textureURL, xmlURL, ...rest) => _origBitmap(key, textureURL + v, xmlURL + v, ...rest);

        loadAssetManifest(this.load);
    }

    create() {
        this.installCrispTextFactory();

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

        ['fire', 'poison', 'lightning'].forEach((effect, row) => {
            this.anims.create({
                key: `gem_${effect}_sparkle`,
                frames: this.anims.generateFrameNumbers('gemsRGY', { start: row * 6, end: row * 6 + 5 }),
                frameRate: 8,
                repeat: 0
            });
            this.anims.create({
                key: `gem_${effect}_hover`,
                frames: this.anims.generateFrameNumbers('gemsRGY', { start: row * 6, end: row * 6 + 5 }),
                frameRate: 8,
                repeat: -1
            });
        });
        
    
        this.anims.create({
            key: 'splash_anim',
            frames: this.anims.generateFrameNumbers('splashSheet', { start: 0, end: 6 }),
            frameRate: 12, // Adjust speed (10fps)
            repeat: 0 // Play once
        });

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
         
        this.scene.start('MainMenuScene');
    }

    installCrispTextFactory() {
        const factory = Phaser.GameObjects.GameObjectFactory.prototype;
        if (factory._rogueOriginalTextFactory) return;

        factory._rogueOriginalTextFactory = factory.text;
        const originalTextFactory = factory._rogueOriginalTextFactory;

        const parseColor = (color) => {
            if (typeof color === 'number') return color;
            if (typeof color !== 'string') return 0xffffff;
            if (color.startsWith('#')) return parseInt(color.slice(1), 16);
            if (color.startsWith('0x')) return parseInt(color.slice(2), 16);
            return 0xffffff;
        };

        const parseFontSize = (fontSize) => {
            if (typeof fontSize === 'number') return fontSize;
            const parsed = parseInt(String(fontSize || '12px'), 10);
            return Number.isFinite(parsed) ? parsed : 12;
        };

        const fontSupportsText = (scene, fontKey, text) => {
            const chars = scene.cache?.bitmapFont?.get?.(fontKey)?.data?.chars;
            if (!chars) return false;

            for (const char of String(text)) {
                const code = char.charCodeAt(0);
                if (code === 10 || code === 13) continue;
                if (!chars[code]) return false;
            }

            return true;
        };

        // pixel-font (minogram) is a small ASCII set — missing glyphs used to
        // make BitmapText.setText no-op, so the panel kept the previous talent
        // description (or stayed blank after a clear). Map common extras to
        // ASCII the atlas actually has.
        const BITMAP_CHAR_FALLBACKS = Object.freeze({
            '\u2014': '-', // em dash
            '\u2013': '-', // en dash
            '\u2026': '...',
            '\u00d7': 'x',
            '\u2264': '<=',
            '\u2265': '>=',
            '\u2192': '->',
            '\u2190': '<-',
            ';': ',',
            '_': '-',
        });

        const sanitizeForBitmapFont = (scene, fontKey, text) => {
            const chars = scene.cache?.bitmapFont?.get?.(fontKey)?.data?.chars;
            const raw = String(text ?? '');
            if (!chars) return raw;

            let out = '';
            for (const char of raw) {
                const code = char.charCodeAt(0);
                if (code === 10 || code === 13 || chars[code]) {
                    out += char;
                    continue;
                }
                const replacement = BITMAP_CHAR_FALLBACKS[char];
                if (replacement) {
                    for (const r of replacement) {
                        out += chars[r.charCodeAt(0)] ? r : (chars[63] ? '?' : '');
                    }
                    continue;
                }
                if (chars[63]) out += '?';
            }
            return out;
        };

        factory.text = function (x, y, text = '', style = {}) {
            const scene = this.scene;
            const rawValue = String(text ?? '');
            const fontKey = fontSupportsText(scene, 'pixel-font', rawValue)
                ? 'pixel-font'
                : fontSupportsText(scene, 'cyrillic-ui-font', rawValue)
                    ? 'cyrillic-ui-font'
                    : null;

            if (!fontKey || style.useCanvasText) {
                return originalTextFactory.call(this, x, y, text, style);
            }

            const value = sanitizeForBitmapFont(scene, fontKey, rawValue);

            const resolveBitmapSize = (nextStyle = {}) => {
                const fontSize = parseFontSize(nextStyle.fontSize);
                return fontKey === 'cyrillic-ui-font'
                    ? 12
                    : fontSize >= 18
                        ? 20
                        : 10;
            };
            const fontSize = parseFontSize(style.fontSize);
            const bitmapSize = fontKey === 'cyrillic-ui-font'
                ? 12
                : fontSize >= 18
                    ? 20
                    : 10;
            const align = style.align === 'center' ? 1 : style.align === 'right' ? 2 : 0;
            const bitmapText = this.bitmapText(Math.round(x), Math.round(y), fontKey, value, bitmapSize, align);

            const applyStyle = (nextStyle = {}) => {
                const tintColor = nextStyle.fill ?? nextStyle.color;
                if (tintColor !== undefined) bitmapText.setTint(parseColor(tintColor));
                if (nextStyle.alpha !== undefined) bitmapText.setAlpha(nextStyle.alpha);
                if (nextStyle.fontSize !== undefined) bitmapText.setFontSize(resolveBitmapSize(nextStyle));
                if (nextStyle.lineSpacing !== undefined && bitmapText.setLineSpacing) {
                    bitmapText.setLineSpacing(Math.round(nextStyle.lineSpacing));
                }
                if (nextStyle.wordWrap?.width && bitmapText.setMaxWidth) {
                    bitmapText.setMaxWidth(Math.round(nextStyle.wordWrap.width));
                }
                if ((nextStyle.strokeThickness || 0) > 0 && bitmapText.setDropShadow) {
                    bitmapText.setDropShadow(1, 1, parseColor(nextStyle.stroke || '#000000'), 1);
                }
                return bitmapText;
            };

            applyStyle(style);

            const nativeSetText = bitmapText.setText.bind(bitmapText);
            bitmapText.setText = (nextText = '') => {
                // Always sanitize to the locked bitmap atlas — never no-op, or
                // the UI keeps the previous string (talent tree "swapped" descs).
                const value = sanitizeForBitmapFont(scene, fontKey, String(nextText ?? ''));
                if (!bitmapText.fontData?.chars) {
                    try { bitmapText.text = value; } catch (_) {}
                    return bitmapText;
                }
                try {
                    nativeSetText(value);
                } catch (err) {
                    console.warn('BitmapText setText failed; ignoring', err);
                }
                return bitmapText;
            };
            bitmapText.setStyle = (nextStyle = {}) => applyStyle(nextStyle);
            bitmapText.setFill = (color) => applyStyle({ fill: color });
            bitmapText.setColor = bitmapText.setFill;
            bitmapText.setFont = () => bitmapText;
            bitmapText.setFontSize = (nextFontSize) => {
                bitmapText.fontSize = resolveBitmapSize({ fontSize: nextFontSize });
                return bitmapText;
            };
            bitmapText.setResolution = () => bitmapText;
            bitmapText.setFixedSize = (width) => {
                if (width && bitmapText.setMaxWidth) bitmapText.setMaxWidth(Math.round(width));
                return bitmapText;
            };

            return bitmapText;
        };
    }
}
