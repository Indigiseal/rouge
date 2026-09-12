import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { serifStyle } from '../ui/uiFont.js';

/** Arrival scene shown after the player chooses Tollroad. */
export class TollroadIntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TollroadIntroScene' });
  }

  init(data = {}) {
    this.runData = data.runData || { newGame: true, locationId: 'tollroad' };
    this.page = 0;
    this._leaving = false;
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG').setTint(0x718568);
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x263525);
    }
    this.add.rectangle(320, 180, 640, 360, 0x050806, 0.7);

    createTitle(this, 320, 25, t(this, 'ui.tollroadIntro.title'), {
      color: '#e8d7af',
      fallbackSize: '20px',
    });
    this.add.rectangle(320, 184, 574, 264, 0x100e0b, 0.88)
      .setStrokeStyle(1, 0x8e7957, 0.8);

    this.body = this.add.text(320, 64, '', {
      ...serifStyle('14px', '#eee4d0'),
      align: 'left',
      wordWrap: { width: 520 },
      lineSpacing: 3,
    }).setOrigin(0.5, 0);

    this.button = this.add.rectangle(320, 329, 190, 28, 0x2b2118, 0.98)
      .setStrokeStyle(1, 0xb99a68)
      .setInteractive({ useHandCursor: true });
    this.buttonLabel = this.add.text(320, 329, '', {
      ...serifStyle('14px', '#f4ead9'),
    }).setOrigin(0.5);

    this.button.on('pointerover', () => this.button.setFillStyle(0x493924, 1));
    this.button.on('pointerout', () => this.button.setFillStyle(0x2b2118, 0.98));
    this.button.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());

    this.showPage(0);
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  showPage(page) {
    this.page = page;
    this.body.setText(t(this, `ui.tollroadIntro.page${page + 1}`));
    this.buttonLabel.setText(t(this, page === 0 ? 'ui.common.continue' : 'ui.tollroadIntro.goOn'));
  }

  advance() {
    if (this._leaving) return;
    SoundHelper.playSound(this, 'card_flip', 0.4);
    if (this.page === 0) {
      this.showPage(1);
      return;
    }
    this._leaving = true;
    this.input.enabled = false;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', this.runData);
    });
  }
}
