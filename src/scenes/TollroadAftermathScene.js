import { SoundHelper } from '../audio/SoundHelper.js';
import { saveStoryProgress } from '../content/story/StoryProgress.js';
import { completeTollroadAftermath } from '../content/story/TollroadAftermath.js';
import { t } from '../i18n/i18n.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { createTitle } from '../ui/titleText.js';
import { serifStyle } from '../ui/uiFont.js';

/** A one-time story scene shown after the Goblin King falls on Tollroad. */
export class TollroadAftermathScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TollroadAftermathScene' });
  }

  init(data = {}) {
    this.gameState = data.gameState || {};
    this.page = 0;
    this._leaving = false;
  }

  create() {
    if (this.textures.exists('stoneFloor')) {
      this.add.image(320, 180, 'stoneFloor').setDisplaySize(640, 360);
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x160f0b);
    }
    this.add.rectangle(320, 180, 640, 360, 0x05070b, 0.72);

    // The dead king remains at the edge of the composition while the pendant
    // and the apparition take over the visual focus.
    this.king = this.add.image(105, 245, 'GoblinKingSprite')
      .setScale(0.72)
      .setAngle(-12)
      .setTint(0x77706a)
      .setAlpha(0.78);

    this.glow = this.add.circle(153, 224, 21, 0x76dfff, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);
    // Last Light Pendant is the clearest stone-on-a-chain silhouette already
    // present in the relic atlas; the story item itself remains a separate id.
    this.pendant = this.add.image(153, 224, 'relicsOthers', 46)
      .setScale(1.25)
      .setTint(0x9fe8ff);
    this.tweens.add({
      targets: [this.glow, this.pendant],
      alpha: { from: 0.38, to: 1 },
      scale: { from: 1, to: 1.12 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.apparition = this.add.image(112, 133, 'holographicOmen')
      .setScale(2.15)
      .setTint(0x9bdcff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);

    this.add.rectangle(421, 180, 414, 330, 0x100d12, 0.9)
      .setStrokeStyle(1, 0x7399aa, 0.7);
    createTitle(this, 421, 28, t(this, 'ui.tollroadAftermath.title'), {
      color: '#bcecff',
      depth: 3,
    });

    this.body = this.add.text(421, 56, '', {
      ...serifStyle('14px', '#e8dfcf'),
      align: 'left',
      wordWrap: { width: 366 },
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(3);

    this.button = this.add.rectangle(421, 329, 196, 28, 0x241a18, 0.96)
      .setStrokeStyle(1, 0x9bc7d8)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);
    this.buttonLabel = this.add.text(421, 329, '', {
      ...serifStyle('14px', '#f4ead9'),
      align: 'center',
    }).setOrigin(0.5).setDepth(5);

    this.button.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      this.button.setFillStyle(0x31414b, 1);
    });
    this.button.on('pointerout', () => this.button.setFillStyle(0x241a18, 0.96));
    this.button.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());

    this.showPage(0);
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  showPage(page) {
    this.page = page;
    this.body.setText(t(this, `ui.tollroadAftermath.page${page + 1}`));
    const buttonKey = page === 0
      ? 'ui.tollroadAftermath.touch'
      : page === 1
        ? 'ui.common.continue'
        : 'ui.tollroadAftermath.keep';
    this.buttonLabel.setText(t(this, buttonKey));
  }

  advance() {
    if (this._leaving) return;
    SoundHelper.playSound(this, 'card_flip', 0.45);

    if (this.page === 0) {
      this.king.setAlpha(0.38);
      this.tweens.add({
        targets: this.apparition,
        alpha: 0.92,
        y: 125,
        duration: 420,
        ease: 'Cubic.easeOut',
      });
      this.showPage(1);
      return;
    }

    if (this.page === 1) {
      this.tweens.add({
        targets: this.apparition,
        alpha: 0,
        duration: 360,
        ease: 'Sine.easeIn',
      });
      this.pendant.setTint(0xd7c6a0);
      this.showPage(2);
      return;
    }

    this.finish();
  }

  finish() {
    if (this._leaving) return;
    this._leaving = true;
    this.input.enabled = false;

    if (isSandboxMode(this)) {
      exitToSandboxHub(this);
      return;
    }

    completeTollroadAftermath(this.gameState);
    saveStoryProgress(this.gameState.storyRun);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.wake('GameScene', { bossNarrativeComplete: true });
      this.scene.stop();
    });
  }
}
