// Run against npm start, with Playwright available through NODE_PATH.
// A boss sheet is the idle pose in frame 0, then the attack, any number of frames.
// For every sheet: the idle picture is cut from frame 0 without losing a pixel,
// the attack plays every frame after it, and the boss returns to idle afterwards.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.BOARD_TEST_URL || 'http://localhost:4173';

const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/__boss-sheet-test', route => route.fulfill({ contentType: 'text/html',
        body: '<script src="/vendor/phaser-3.70.0.min.js"></script>' }));
    await page.goto(`${base}/__boss-sheet-test`);

    const results = await page.evaluate(async () => {
        const mod = await import('/src/content/cards/bossAttackFrames.js');
        const sheets = Object.entries(mod.BOSS_ATTACK_FRAMES).filter(([, f]) => f.sheet);
        return new Promise(resolve => {
            const game = new Phaser.Game({ type: Phaser.CANVAS, width: 320, height: 200, banner: false,
                scene: {
                    preload() {
                        for (const [, f] of sheets) this.load.spritesheet(f.key, '/' + f.path,
                            { frameWidth: f.frameWidth, frameHeight: f.frameHeight });
                    },
                    create() {
                        mod.buildBossPoseTextures(this);
                        const opaque = (src, sx, sy, w, h) => {
                            const c = document.createElement('canvas'); c.width = w; c.height = h;
                            const g = c.getContext('2d'); g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
                            const d = g.getImageData(0, 0, w, h).data; let n = 0;
                            for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
                            return n;
                        };
                        const out = [];
                        for (const [idleKey, f] of sheets) {
                            const frames = this.textures.get(f.key).frameTotal - 1;
                            const sheetImg = this.textures.get(f.key).getSourceImage();
                            const idleImg = this.textures.get(idleKey).getSourceImage();
                            // A plain Image, like the boss on the board (it cannot play a Phaser animation).
                            const sprite = this.add.image(160, 100, idleKey);
                            const card = { sprite, data: { sprite: idleKey } };
                            const before = [sprite.displayOriginX, sprite.displayOriginY];
                            mod.showBossAttackFrame(this, card);
                            const attacking = { key: sprite.texture.key, frame: sprite.frame.name };
                            // Run each frame step in order and record what is shown.
                            const shown = [sprite.frame.name];
                            for (const step of card._attackStepTimers || []) { step.callback(); shown.push(sprite.frame.name); }
                            // Jump to the end of the hold: back to idle on the same anchor.
                            card._attackFrameTimer.callback();
                            out.push({ idleKey, frames, sheetWidth: sheetImg.width, frameWidth: f.frameWidth,
                                frame0: opaque(sheetImg, 0, 0, f.frameWidth, f.frameHeight),
                                idle: opaque(idleImg, 0, 0, idleImg.width, idleImg.height),
                                shown, attacking,
                                backTo: sprite.texture.key, before, after: [sprite.displayOriginX, sprite.displayOriginY], sameAnchor: before[0] === sprite.displayOriginX && before[1] === sprite.displayOriginY });
                        }
                        game.destroy(true);
                        resolve(out);
                    },
                } });
        });
    });

    for (const r of results) {
        assert.equal(r.sheetWidth % r.frameWidth, 0, `${r.idleKey}: whole frames only`);
        assert.ok(r.frames >= 2, `${r.idleKey}: idle pose and at least one attack frame`);
        assert.equal(r.idle, r.frame0, `${r.idleKey}: the idle pose keeps every pixel of frame 0`);
        assert.deepEqual(r.shown, Array.from({ length: r.frames - 1 }, (_, i) => i + 1), `${r.idleKey}: the attack shows every frame after the idle one, in order`);
        assert.equal(r.attacking.frame, 1, `${r.idleKey}: the attack starts on frame 1`);
        assert.equal(r.backTo, r.idleKey, `${r.idleKey}: back to idle afterwards`);
        if (!r.sameAnchor) console.log(r.idleKey, r.before, r.after);
        assert.ok(r.sameAnchor, `${r.idleKey}: idle keeps its anchor through the attack`);
    }
    assert.deepEqual(errors, []);
    console.log(`Boss sheets: ${results.map(r => `${r.idleKey} ${r.frames}`).join(', ')} frames; `
        + 'idle cut from frame 0 with every pixel, attack plays the rest, back to idle on the same anchor.');
} finally {
    await browser.close();
}
