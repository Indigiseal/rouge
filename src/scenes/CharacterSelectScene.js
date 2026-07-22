// One-shot character pick before a new run starts on floor 1.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { CHARACTER_CLASSES, CHARACTER_IDS } from '../content/characters/CharacterClasses.js';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }
    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.55);

    this.add.text(320, 28, 'Choose your hero', {
      fontSize: '22px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(320, 52, 'Once per run — before floor 1', {
      fontSize: '11px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const slots = [
      { id: 'rogue', x: 170 },
      { id: 'warrior', x: 470 },
    ];
    slots.forEach((slot) => this.createCharacterCard(slot.x, 200, CHARACTER_CLASSES[slot.id]));

    this.createBackButton();

    MusicManager.play(this, 'menu_music', 0.45, 500);
  }

  createCharacterCard(x, y, def) {
    const panel = this.add.rectangle(x, y, 260, 240, 0x2c1810, 0.94)
      .setStrokeStyle(2, 0x8b6914)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y - 95, def.name, {
      fontSize: '18px',
      fill: '#f0d78c',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const startLine = def.id === 'rogue'
      ? 'Start: Dagger + Bow'
      : 'Start: 2x Sword';
    this.add.text(x, y - 68, startLine, {
      fontSize: '12px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const armorLine = def.id === 'rogue'
      ? 'Armor: Leather only'
      : 'Armor: Chain & Plate';
    this.add.text(x, y - 48, armorLine, {
      fontSize: '12px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const passive = def.id === 'rogue'
      ? 'Passive: Dagger & Bow\ndeal +10% damage'
      : 'Passive: 10% crit sword/axe\nChain: melee counter\nPlate: ignore ranged';
    this.add.text(x, y + 10, passive, {
      fontSize: '11px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    const btn = this.add.rectangle(x, y + 90, 140, 28, 0x3d2418, 0.95)
      .setStrokeStyle(1, 0xd4a017)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y + 90, 'Select', {
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
    panel.on('pointerdown', () => this.selectCharacter(def.id));
    btn.on('pointerdown', () => this.selectCharacter(def.id));
  }

  createBackButton() {
    const bg = this.add.rectangle(320, 335, 160, 26, 0x2c1810, 0.92)
      .setStrokeStyle(1, 0x8b6914)
      .setInteractive({ useHandCursor: true });
    this.add.text(320, 335, 'Back', {
      fontSize: '12px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      bg.setStrokeStyle(1, 0xd4a017);
    });
    bg.on('pointerout', () => bg.setStrokeStyle(1, 0x8b6914));
    bg.on('pointerdown', () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainMenuScene');
      });
    });
  }

  selectCharacter(characterId) {
    if (!CHARACTER_IDS.includes(characterId)) characterId = 'rogue';
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TalentTreeScene', { characterId });
    });
  }
}
