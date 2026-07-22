// Run-start pick: chain vs plate when Armorer's Start is owned.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { createArmorCardData } from '../content/cards/armor.js';

export class ArmorerPickScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmorerPickScene' });
  }

  init(data) {
    this.characterId = data?.characterId === 'warrior' ? 'warrior' : 'rogue';
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }
    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.55);

    this.add.text(320, 28, "Armorer's Start", {
      fontSize: '20px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(320, 52, 'Choose starting armor for this run', {
      fontSize: '11px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const chain = createArmorCardData('chain', 'uncommon');
    const plate = createArmorCardData('plate', 'uncommon');
    const chainBlurb = chain
      ? `Uncommon · DEF ${chain.protection} + melee counter`
      : 'Uncommon chain';
    const plateBlurb = plate
      ? `Uncommon · DEF ${plate.protection} + ignore ranged`
      : 'Uncommon plate';

    this.createArmorCard(170, 200, 'chain', 'Chain', chainBlurb);
    this.createArmorCard(470, 200, 'plate', 'Plate', plateBlurb);

    MusicManager.play(this, 'menu_music', 0.45, 500);
  }

  createArmorCard(x, y, armorType, title, blurb) {
    const panel = this.add.rectangle(x, y, 240, 200, 0x2c1810, 0.94)
      .setStrokeStyle(2, 0x8b6914)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y - 70, title, {
      fontSize: '18px',
      fill: '#f0d78c',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(x, y - 20, 'Uncommon', {
      fontSize: '12px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(x, y + 20, blurb, {
      fontSize: '11px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 200 },
    }).setOrigin(0.5);

    const btn = this.add.rectangle(x, y + 70, 140, 28, 0x3d2418, 0.95)
      .setStrokeStyle(1, 0xd4a017)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y + 70, 'Select', {
      fontSize: '13px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const hoverOn = () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      panel.setStrokeStyle(2, 0xd4a017);
      btn.setFillStyle(0x5a3820, 0.98);
    };
    const hoverOff = () => {
      panel.setStrokeStyle(2, 0x8b6914);
      btn.setFillStyle(0x3d2418, 0.95);
    };

    panel.on('pointerover', hoverOn);
    panel.on('pointerout', hoverOff);
    btn.on('pointerover', hoverOn);
    btn.on('pointerout', hoverOff);
    panel.on('pointerdown', () => this.pick(armorType));
    btn.on('pointerdown', () => this.pick(armorType));
  }

  pick(armorerArmorType) {
    MusicManager.stopIfPlaying(this, 'menu_music', 300);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        newGame: true,
        characterId: this.characterId,
        armorerArmorType,
      });
    });
  }
}
