// Non-destructive design study. Only changes objects in an isolated browser.
// Requires the dev server and Playwright (NODE_PATH may point to the bundled runtime).
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.UI_PREVIEW_URL || 'http://localhost:4173';
const out = new URL('../output/ui-layout/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?dev=0`);
  await page.waitForFunction(() => window.__game?.scene?.isActive('MainMenuScene'));
  await page.evaluate(() => {
    // Deterministic design fixture; no access to the user's browser profile.
    let seed = 923;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    window.__game.scene.start('GameScene', { sandbox: true, sandboxRoom: 'COMBAT' });
  });
  await page.waitForFunction(() => window.__game.scene.getScene('GameScene').combatLog?.body);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene');
    s.input.enabled = false;
    s.gameState.coins = 128;
    s.gameState.crystals = 12;
    s.updateUI();
    s.combatLog.lines = ['You strike for 7 damage.', 'Enemy loses 7 HP.', 'Armor absorbs 3 damage.', 'You take 2 damage.', 'Poison deals 1 damage.', 'You gain 4 action points.'];
    s.setCombatLogVisible(true);
    s.renderCombatLog();
    window.layoutStudy = { s, original: s.children.list.map(o => [o, o.x, o.y]), added: [] };
  });
  for (const variant of ['original', 'a', 'b']) {
    await page.evaluate(variant => {
      const { s, original, added } = window.layoutStudy;
      added.splice(0).forEach(o => o.destroy());
      original.forEach(([o, x, y]) => o.setPosition(x, y));
      const log = s.combatLog;
      const [panel, title, rule, body, track] = log.objects;
      const x = variant === 'original' ? 577 : 574;
      const w = variant === 'original' ? 128 : 124;
      const top = variant === 'b' ? 150 : 85;
      const bottom = variant === 'original' ? 285 : 350;
      const h = bottom - top;
      panel.setVisible(true);
      title.setColor('#584339');
      body.setColor('#584339');
      panel.setPosition(x, top + h / 2);
      if (panel.setSize) panel.setSize(w, h);
      title.setPosition(x, top + 8);
      rule.setPosition(x, top + 22).setSize(w - 18, 1);
      body.setPosition(x - w / 2 + 7, top + 27).setWordWrapWidth(w - 22, true);
      log.bounds = { left: x - w / 2, right: x + w / 2, top, bottom };
      log.bodyMaxHeight = h - 37;
      log.trackX = x + w / 2 - 7;
      log.trackTop = top + 27;
      log.trackHeight = log.bodyMaxHeight;
      track.setPosition(log.trackX, log.trackTop).setSize(3, log.trackHeight);
      if (variant === 'b') {
        panel.setVisible(false);
        const backing = s.add.graphics().setDepth(40);
        backing.fillStyle(0x211b20, 0.96).fillRect(x - w / 2, top, w, h);
        backing.lineStyle(1, 0x926b4a).strokeRect(x - w / 2 + 0.5, top + 0.5, w - 1, h - 1);
        added.push(backing);
        title.setColor('#e5bca4');
        body.setColor('#e5d7bf');
      }
      if (variant !== 'original') {
        // A shallow pixel-aligned backing unifies the three resource readings.
        const g = s.add.graphics().setDepth(4);
        g.fillStyle(0x211b20, 0.96).fillRect(6, 185, 108, 54);
        g.lineStyle(1, 0x926b4a).strokeRect(6.5, 185.5, 107, 53);
        g.lineStyle(1, 0x544237).lineBetween(12, 211, 108, 211);
        added.push(g);
        const label = s.add.text(13, 195, 'AP', {
          fontFamily: '"HoMM Pixel"', fontSize: '10px', color: '#e5bca4',
        }).setOrigin(0, 0.5).setDepth(8);
        added.push(label);
        s.actionPointSprites.forEach((o, i) => o.setPosition(48 + i * 16, 197));
        s.updateActionPointUI();
        s.coinSprite.setPosition(19, 225).setDepth(8);
        s.coinsText.setPosition(43, 225).setDepth(8);
        s.crystalSprite.setPosition(74, 225).setDepth(8);
        s.crystalsText.setPosition(96, 225).setDepth(8);
      }
      s.renderCombatLog();
      if (body.y + body.height > bottom - 8) throw new Error('Log text exceeds panel');
      if (variant !== 'original' && log.bounds.right > 640) throw new Error('Log exceeds viewport');
    }, variant);
    await page.waitForTimeout(150);
    await page.locator('canvas').screenshot({ path: new URL(`${variant}.png`, out).pathname.replace(/^\/(\w:)/, '$1') });
    console.log(`Rendered ${variant}: 1280 × 720; log text and viewport bounds checked.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
