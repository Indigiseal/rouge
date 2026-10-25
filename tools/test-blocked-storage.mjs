// Run against npm start, with Playwright available through NODE_PATH.
// Browsers that block site data (private modes, "block all cookies", some
// embedded frames) throw on every localStorage access. The game must still
// boot, and a new run must still reach combat, just without saving.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.BOARD_TEST_URL || 'http://localhost:4173';

const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
            get() { throw new DOMException('blocked', 'SecurityError'); },
        });
    });
    await page.goto(base + '/');
    const reach = key => page.waitForFunction(
        k => window.__game?.scene.getScenes(true).some(s => s.scene.key === k), key, { timeout: 20000 });
    const scene = key => `window.__game.scene.getScene('${key}')`;

    await reach('MainMenuScene');
    await page.evaluate(`${scene('MainMenuScene')}.startNewGame()`);
    await reach('SanctuaryScene');
    await page.evaluate(`${scene('SanctuaryScene')}.leave()`);
    await reach('LocationPickScene');
    await page.evaluate(`${scene('LocationPickScene')}.leave('thornwake')`);
    await reach('GameScene');
    await page.waitForTimeout(1500);

    // Save & Quit cannot save here: the pause menu stays open and says so,
    // and a second press leaves anyway.
    await page.evaluate(`(() => {
        const game = ${scene('GameScene')};
        game.scene.pause();
        game.scene.launch('PauseMenuScene', { pausedScene: 'GameScene' });
    })()`);
    await reach('PauseMenuScene');
    await page.evaluate(`${scene('PauseMenuScene')}.quitToMainMenu()`);
    await page.waitForTimeout(200);
    const warned = await page.evaluate(`(() => {
        const pause = ${scene('PauseMenuScene')};
        return { open: pause.sys.isActive(), text: pause.saveFailedText?.text || '' };
    })()`);
    assert.ok(warned.open, 'a failed save keeps the pause menu open');
    assert.match(warned.text, /could not be saved/, 'a failed save is explained');
    await page.evaluate(`${scene('PauseMenuScene')}.quitToMainMenu()`);
    await reach('MainMenuScene');

    assert.deepEqual(errors, [], 'no uncaught errors with storage blocked');
    console.log('Blocked storage checks passed: boot, Sanctuary, Choose Your Road, the first room, and a warned Save & Quit.');
} finally {
    await browser.close();
}
