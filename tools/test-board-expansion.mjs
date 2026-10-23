// Run against npm start, with Playwright available through NODE_PATH.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import { ALL_LOCATION_ASSETS } from '../src/content/assets/locationAssets.js';
import { DEFAULT_BOARD_ART, LOCATION_BOARD_ART } from '../src/content/locations/boardArt.js';
import { reinforcementStateFor, reinforcementStateFromSave, serializeReinforcementState } from '../src/content/balance/Reinforcements.js';
const { chromium } = createRequire(import.meta.url)('playwright');
for (const roomType of ['COMBAT', 'ELITE']) {
    assert.equal(reinforcementStateFor(40, roomType, 15), null);
    const wave = reinforcementStateFor(40, roomType, 26);
    assert.equal(wave.initialCards, 15);
    assert.equal(wave.initialCards + wave.cardsPending, 26, 'every excess card remains owed');
    assert.equal(wave.wavesLeft, 2);
    assert.equal(reinforcementStateFromSave(serializeReinforcementState(wave)).cardsPending, 11);
}
assert.equal(reinforcementStateFor(45, 'BOSS', 26), null, 'boss summons keep their own rules');
const boards = { default: DEFAULT_BOARD_ART, ...LOCATION_BOARD_ART };
const assets = Object.values(boards).map(board => [...ASSET_MANIFEST, ...ALL_LOCATION_ASSETS].find(asset => asset.key === board.main));
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 680, height: 400 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.BOARD_TEST_URL || 'http://localhost:4173';
    await page.route('**/__expanded-board-test', route => route.fulfill({ contentType: 'text/html',
        body: '<style>body{margin:0}canvas{display:block}</style><script src="/vendor/phaser-3.70.0.min.js"></script>' }));
    for (const renderer of ['WEBGL', 'CANVAS']) {
        await page.goto(`${base}/__expanded-board-test`);
        await page.evaluate(async ({ renderer, assets }) => {
            const { createBoardPanel } = await import('/src/ui/BoardPanel.js');
            await new Promise(resolve => {
                window.testGame = new Phaser.Game({ type: Phaser[renderer], width: 680, height: 400,
                    backgroundColor: '#785555', pixelArt: true, antialias: false, antialiasGL: false, roundPixels: true,
                    scene: {
                        preload() { for (const a of assets) this.load.image(a.key, a.path); },
                        create() {
                            window.drawBoard = (board, w, h) => {
                                this.children.removeAll(true);
                                const panel = createBoardPanel(this, w, h, { key: board.main, slice: board.slice });
                                panel.setPosition(340, 200);
                                if (this.children.list.length !== 1 || panel.type !== 'Image') throw Error('board split into scene objects');
                                if (this.textures.get(board.main).getFrameNames().length) throw Error('source board frames were modified');
                            };
                            resolve();
                        },
                    },
                });
            });
        }, { renderer, assets });
        for (const [id, board] of Object.entries(boards)) for (const [w, h] of [[366, 304], [368, 304], [426, 304], [640, 350]]) {
            await page.evaluate(async ({ board, w, h }) => {
                window.drawBoard(board, w, h);
                await new Promise(resolve => window.testGame.events.once('postrender', resolve));
            }, { board, w, h });
            const png = await page.locator('canvas').screenshot();
            const mismatches = await page.evaluate(async ({ png, board, path, w, h }) => {
                const load = src => new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.src = src; });
                const art = await load('/' + path), shot = await load('data:image/png;base64,' + png);
                const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false;
                ctx.drawImage(shot, 340 - w / 2, 200 - h / 2, w, h, 0, 0, w, h);
                const actual = ctx.getImageData(0, 0, w, h).data;
                const original = document.createElement('canvas'); original.width = art.width; original.height = art.height;
                const srcCtx = original.getContext('2d'); srcCtx.drawImage(art, 0, 0);
                const source = srcCtx.getImageData(0, 0, art.width, art.height).data;
                const expected = ctx.createImageData(w, h), { left, right, top, bottom } = board.slice;
                // Independent per-pixel oracle: corners occur once; inner rows
                // and columns cycle at their authored size, never stretch.
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    const sx = x < left ? x : x >= w - right ? art.width - (w - x) : left + (x - left) % (art.width - left - right);
                    const sy = y < top ? y : y >= h - bottom ? art.height - (h - y) : top + (y - top) % (art.height - top - bottom);
                    const si = (sy * art.width + sx) * 4, di = (y * w + x) * 4;
                    expected.data.set(source.subarray(si, si + 4), di);
                }
                const ref = document.createElement('canvas'); ref.width = w; ref.height = h;
                ref.getContext('2d').putImageData(expected, 0, 0);
                ctx.fillStyle = '#785555'; ctx.fillRect(0, 0, w, h); ctx.drawImage(ref, 0, 0);
                const composite = ctx.getImageData(0, 0, w, h).data;
                let changed = 0;
                for (let i = 0; i < actual.length; i += 4) if (actual.subarray(i, i + 4).some((v, j) => v !== composite[i + j])) changed++;
                return changed;
            }, { png: png.toString('base64'), board, path: assets.find(a => a.key === board.main).path, w, h });
            assert.equal(mismatches, 0, `${renderer} ${id} ${w}x${h}: unexpected artwork pixels`);
        }
        console.log(`${renderer}: all 11 boards, four sizes, native corners, repeated bands, one image and clean rebuilds passed.`);
    }
    assert.deepEqual(errors, []);
    console.log('Crowded COMBAT/ELITE rooms retain all 26 cards through 15 initial cards and saved reinforcements.');
} finally { await browser.close(); }
