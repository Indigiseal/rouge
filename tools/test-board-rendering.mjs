// Requires Playwright (or NODE_PATH pointing to its installation) and the dev
// server: npm start. Run: node tools/test-board-rendering.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 680, height: 400 } });
    const base = process.env.BOARD_TEST_URL || 'http://localhost:4173';
    await page.route('**/__board-render-test', route => route.fulfill({
        contentType: 'text/html',
        body: '<style>body{margin:0}canvas{display:block}</style><script src="/vendor/phaser-3.70.0.min.js"></script>',
    }));
    for (const renderer of ['WEBGL', 'CANVAS']) {
        await page.goto(`${base}/__board-render-test`);
        await page.evaluate(async renderer => {
            const panelModule = await import('/src/ui/NineSlicePanel.js');
            await new Promise(resolve => {
                window.testGame = new Phaser.Game({
                    type: Phaser[renderer], width: 680, height: 400,
                    backgroundColor: '#785555', pixelArt: true,
                    antialias: false, antialiasGL: false, roundPixels: true,
                    scene: {
                        preload() { this.load.image('gamingBoard', '/assets/art/gamingBoard.png'); },
                        create() {
                            window.drawBoard = (w, h) => {
                                this.children.removeAll(true);
                                panelModule.createNineSlicePanel(this, w, h, {
                                    key: 'gamingBoard', slice: panelModule.BOARD_PANEL_SLICE,
                                }).setPosition(340, 200);
                            };
                            resolve();
                        },
                    },
                });
            });
        }, renderer);
        // Authored size, smallest expansion, crowded formations, viewport cap,
        // and growth on both axes. Repeated calls also exercise cached frames.
        for (const [w, h] of [[366, 304], [368, 304], [434, 304], [500, 304], [640, 350]]) {
            await page.evaluate(async ([w, h]) => {
                window.drawBoard(w, h);
                await new Promise(resolve => window.testGame.events.once('postrender', resolve));
            }, [w, h]);
            const png = await page.locator('canvas').screenshot();
            const mismatches = await page.evaluate(async ({ png, w, h }) => {
                const loadImage = src => new Promise(resolve => {
                    const image = new Image(); image.onload = () => resolve(image); image.src = src;
                });
                const shot = await loadImage(`data:image/png;base64,${png}`);
                const art = await loadImage('/assets/art/gamingBoard.png');
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(shot, 340 - w / 2, 200 - h / 2, w, h, 0, 0, w, h);
                const actual = ctx.getImageData(0, 0, w, h).data;
                ctx.fillStyle = '#785555'; ctx.fillRect(0, 0, w, h);
                // Independent reference: copy the source's fixed caps and
                // repeat its identical middle rows/columns with Canvas.
                const sx = [0, 194, 239, 366], sy = [0, 181, 288, 304];
                const dx = [0, 194, w - 127, w], dy = [0, 181, h - 16, h];
                for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                    ctx.drawImage(art, sx[c], sy[r], sx[c + 1] - sx[c], sy[r + 1] - sy[r],
                        dx[c], dy[r], dx[c + 1] - dx[c], dy[r + 1] - dy[r]);
                }
                const expected = ctx.getImageData(0, 0, w, h).data;
                let count = 0;
                for (let i = 0; i < actual.length; i += 4) {
                    if (actual.subarray(i, i + 4).some((v, j) => v !== expected[i + j])) count++;
                }
                return count;
            }, { png: png.toString('base64'), w, h });
            assert.equal(mismatches, 0, `${renderer} ${w}x${h}: changed artwork pixels`);
        }
        console.log(`${renderer}: all five board sizes match the source artwork pixel for pixel.`);
    }
} finally {
    await browser.close();
}
