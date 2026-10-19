// Requires Playwright and the dev server (npm start).
// NODE_PATH may point to a shared Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MAGIC } from '../src/content/cards/magic.js';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
assert.equal(ASSET_MANIFEST.find(asset => asset.key === 'magicCards').path, 'assets/art/magicCardsOriginalSheet1.png');
assert.equal(ASSET_MANIFEST.find(asset => asset.key === 'glowingMagicCards').path, 'assets/art/glowingMagicCardsSheetNew1.png');
const { chromium } = createRequire(import.meta.url)('playwright');
assert.equal(ASSET_MANIFEST.find(asset => asset.key === 'cardBack').path, 'assets/art/cardBack.png');
assert.equal(MAGIC.length, 9);
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 720, height: 600 } });
    await page.route('**/__magic-card-art-test', route => route.fulfill({
        contentType: 'text/html',
        body: '<style>body{margin:0}canvas{display:block}</style><link rel="stylesheet" href="/src/ui/fontFaces.css"><script src="/vendor/phaser-3.70.0.min.js"></script>',
    }));
    await page.goto(`${process.env.BOARD_TEST_URL || 'http://localhost:4173'}/__magic-card-art-test`);
    const report = await page.evaluate(async () => {
        const { MAGIC } = await import('/src/content/cards/magic.js');
        window.magicFrameModule = await import('/src/content/balance/WeaponEnchants.js');
        const { ASSET_MANIFEST } = await import('/src/content/assets/AssetManifest.js');
        const { PreloadScene } = await import('/src/scenes/PreloadScene.js');
        const { BoardCardFx } = await import('/src/systems/board/BoardCardFx.js');
        const { loadUiFonts } = await import('/src/ui/fontFamilies.js');
        await loadUiFonts('en');
        PreloadScene.prototype.installCrispTextFactory.call({});
        return new Promise(resolve => {
            window.artTest = new Phaser.Game({
                type: Phaser.WEBGL, width: 360, height: 300,
                zoom: 2, pixelArt: true, backgroundColor: '#211d28',
                scene: {
                    preload() {
                        for (const key of ['magicCards', 'glowingMagicCards']) {
                            const asset = ASSET_MANIFEST.find(asset => asset.key === key);
                            this.load.spritesheet(asset.key, '/' + asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
                        }

                    },
                    create() {
                        this.game.language = 'en';
                        PreloadScene.prototype.buildMagicCardTextures.call(this);
                        PreloadScene.prototype.buildMagicCardTextures.call(this);
                        const fx = new BoardCardFx({ scene: this });
                        const rows = [];
                        for (let i = 0; i < MAGIC.length; i++) {
                            const data = { ...MAGIC[i], type: 'magic' };
                            const x = 65 + (i % 3) * 115, y = 50 + Math.floor(i / 3) * 98;
                            const sprite = this.add.image(x, y, data.sprite);
                            const card = { data, sprite };
                            fx.createCardInfoText(card);
                            const label = card.infoText.list[0];
                            rows.push({ key: data.sprite, width: sprite.width, height: sprite.height,
                                scaleX: sprite.scaleX, scaleY: sprite.scaleY,
                                labelWidth: label.width, labelHeight: label.height, labelY: label.y,
                                label: label.text });
                        }
                        for (const locale of ['es', 'fr', 'ru']) {
                            this.game.language = locale;
                            for (const magic of MAGIC) {
                                const sprite = this.add.image(-1000, -1000, magic.sprite);
                                const card = { data: { ...magic, type: 'magic' }, sprite };
                                fx.createCardInfoText(card);
                                const label = card.infoText.list[0];
                                rows.push({ key: magic.sprite, width: sprite.width, height: sprite.height,
                                    scaleX: sprite.scaleX, scaleY: sprite.scaleY,
                                    labelWidth: label.width, labelHeight: label.height, labelY: label.y,
                                    label: locale + ': ' + label.text });
                                card.infoText.destroy(true);
                                sprite.destroy();
                            }
                        }
                        this.game.language = 'en';
                        const canvas = document.createElement('canvas');
                        canvas.width = 52; canvas.height = 70;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        const { getGlowCardFrame } = window.magicFrameModule;
                        const aliasesMatchSheet = MAGIC.every(data => {
                            const frame = this.textures.getFrame('magicCards', getGlowCardFrame(data.magicType));
                            ctx.clearRect(0, 0, 52, 70);
                            ctx.drawImage(this.textures.get('magicCards').getSourceImage(),
                                frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
                            const expected = ctx.getImageData(0, 0, 52, 70).data;
                            ctx.clearRect(0, 0, 52, 70);
                            ctx.drawImage(this.textures.get(data.sprite).getSourceImage(), 0, 0);
                            const actual = ctx.getImageData(0, 0, 52, 70).data;
                            return actual.every((value, i) => value === expected[i]);
                        });
                        const sheet = this.textures.get('magicCards').getSourceImage();
                        const glowingFramesValid = MAGIC.every(data => {
                            const frame = this.textures.getFrame('glowingMagicCards', getGlowCardFrame(data.magicType));
                            return frame && frame.width === 52 && frame.height === 69;
                        });
                        resolve({ rows, aliasesMatchSheet, glowingFramesValid, sheetSize: [sheet.width, sheet.height] });
                    },
                },
            });
        });
    });
    for (const row of report.rows) {
        assert.deepEqual([row.width, row.height, row.scaleX, row.scaleY], [52, 70, 1, 1], row.key);
        assert.ok(row.labelWidth <= 44, `${row.label} exceeds its name band (${row.labelWidth}px)`);
        assert.ok(row.labelHeight <= 13, `${row.label} is too tall (${row.labelHeight}px)`);
        assert.equal(row.labelY, 25);
    }
    assert.deepEqual(report.sheetSize, [520, 69]);
    assert.ok(report.glowingFramesValid, 'all Reliquary spells must have the matching glowing frame');
    assert.ok(report.aliasesMatchSheet, 'saved spell texture keys must match the correct sheet frames');
    await page.waitForTimeout(100);
    await page.locator('canvas').screenshot({ path: 'output/art-concepts/magic-cards/wired-magic-cards-preview.png' });
    console.log('Magic sheets passed: separate normal/glowing art, native frames, localized labels, and unchanged card back.');
} finally {
    await browser.close();
}

