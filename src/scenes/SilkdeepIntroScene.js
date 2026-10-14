import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { serifStyle } from '../ui/uiFont.js';

const PAGE_COUNT = 3;

/** Arrival scene shown after the player chooses Silkdeep, before floor 1. */
export class SilkdeepIntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SilkdeepIntroScene' });
  }

  init(data = {}) {
    this.runData = data.runData || { newGame: true, locationId: 'silkdeep' };
    this.page = 0;
    this._leaving = false;
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG').setTint(0x686873);
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x2b2428);
    }
    this.add.rectangle(320, 180, 640, 360, 0x050505, 0.76);

    createTitle(this, 320, 25, t(this, 'ui.silkdeepIntro.title'), {
      color: '#d6c2c1',
      fallbackSize: '20px',
    });
    this.add.rectangle(320, 184, 574, 264, 0x0e0b10, 0.9)
      .setStrokeStyle(1, 0x6c6885, 0.85);

    this.body = this.add.text(320, 64, '', {
      ...serifStyle('14px', '#d6c2c1'),
      align: 'left',
      wordWrap: { width: 520 },
      lineSpacing: 3,
    }).setOrigin(0.5, 0);

    this.button = this.add.rectangle(320, 329, 190, 28, 0x2b2332, 0.98)
      .setStrokeStyle(1, 0x877c80)
      .setInteractive({ useHandCursor: true });
    this.buttonLabel = this.add.text(320, 329, '', {
      ...serifStyle('14px', '#d6c2c1'),
    }).setOrigin(0.5);

    this.button.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.4);
      this.button.setFillStyle(0x383348, 1);
    });
    this.button.on('pointerout', () => this.button.setFillStyle(0x2b2332, 0.98));
    this.button.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());

    this.showPage(0);
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  showPage(page) {
    this.page = page;
    this.body.setText(t(this, `ui.silkdeepIntro.page${page + 1}`));
    this.buttonLabel.setText(t(this,
      page < PAGE_COUNT - 1 ? 'ui.common.continue' : 'ui.silkdeepIntro.goOn'
    ));
  }

  advance() {
    if (this._leaving) return;
    SoundHelper.playSound(this, 'card_flip', 0.4);
    if (this.page < PAGE_COUNT - 1) {
      this.showPage(this.page + 1);
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
