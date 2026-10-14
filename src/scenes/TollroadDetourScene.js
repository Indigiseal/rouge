import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { serifStyle } from '../ui/uiFont.js';

/** Three-stop linear side map used to walk around the destroyed royal bridge. */
export class TollroadDetourScene extends Phaser.Scene {
  constructor() { super({ key: 'TollroadDetourScene' }); }

  init(data = {}) { this.gameState = data.gameState; }

  create() {
    const detour = this.gameState?.storyRun?.tollroadDetour;
    if (!detour) {
      this.scene.start('MapViewScene', { gameState: this.gameState });
      return;
    }
    if (detour.complete || detour.index >= 3) {
      detour.complete = true;
      this.showCompletion();
      return;
    }
    this.add.rectangle(320, 180, 640, 360, 0x293129);
    this.add.rectangle(320, 30, 640, 60, 0x1a241b);
    createTitle(this, 320, 28, t(this, 'ui.detour.title'), { color: '#fef0cf', fallbackSize: '20px' });
    this.add.text(320, 56, t(this, 'ui.detour.subtitle'), { fontSize: '11px', fill: '#9fa081', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);

    const xs = [175, 320, 465];
    for (let i = 0; i < 3; i++) {
      if (i > 0) this.add.rectangle((xs[i - 1] + xs[i]) / 2, 178, 112, 3, 0x9fa081);
      const done = i < detour.index;
      const current = i === detour.index;
      const merchant = detour.merchantAt === i + 1;
      const node = this.add.circle(xs[i], 178, current ? 25 : 20, done ? 0x4d6b57 : current ? 0xae8b57 : 0x37473a)
        .setStrokeStyle(2, current ? 0xffcf7f : 0x738672);
      this.add.text(xs[i], 178, done ? '✓' : merchant ? '$' : '⚔', { fontSize: '18px', fill: '#fef0cf', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(xs[i], 218, t(this, merchant ? 'ui.detour.merchant' : 'ui.detour.fight', { number: i + 1 }), { fontSize: '10px', fill: '#d6c7b3', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
      if (current) node.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.enterNext(merchant));
    }
  }

  showCompletion() {
    this.add.rectangle(320, 180, 640, 360, 0x293129);
    this.add.rectangle(320, 180, 570, 282, 0x0a1514, 0.94).setStrokeStyle(1, 0x9fa081);
    createTitle(this, 320, 38, t(this, 'ui.detour.exitTitle'), { color: '#fef0cf', fallbackSize: '20px' });
    this.add.text(320, 82, t(this, 'ui.detour.exitBody'), {
      ...serifStyle('14px', '#fef0cf'),
      align: 'left',
      wordWrap: { width: 500 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
    const button = this.add.rectangle(320, 309, 210, 28, 0x36442e, 1)
      .setStrokeStyle(1, 0xd3c294).setInteractive({ useHandCursor: true });
    this.add.text(320, 309, t(this, 'ui.detour.return'), {
      fontSize: '12px', fill: '#fef0cf', fontFamily: '"HoMM Pixel"',
    }).setOrigin(0.5);
    button.on('pointerdown', () => this.finishCompletion());
    this.input.keyboard?.on('keydown-ENTER', () => this.finishCompletion());
    this.input.keyboard?.on('keydown-SPACE', () => this.finishCompletion());
  }

  finishCompletion() {
    if (this._leaving) return;
    this._leaving = true;
    if (isSandboxMode(this)) {
      exitToSandboxHub(this);
      return;
    }
    this.scene.start('MapViewScene', { gameState: this.gameState });
  }

  enterNext(merchant) {
    const detour = this.gameState.storyRun.tollroadDetour;
    SoundHelper.playVariant(this, 'map_select', 0.5);
    if (merchant) {
      detour.index += 1;
      this.scene.stop();
      this.scene.launch('ShopScene', { gameState: this.gameState });
      return;
    }
    detour.inCombat = true;
    this.gameState.pendingAmbush = {
      id: 'tollroad_detour',
      normalCombatBoard: true,
      enemyTypes: ['bogSlug', 'drowned', 'mireBrute', 'fenSpitter', 'mireToad'],
    };
    this.gameState.roomType = 'COMBAT';
    this.scene.wake('GameScene', { roomType: 'COMBAT', isNewRoom: true });
    this.scene.stop();
  }
}
