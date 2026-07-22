// Encounter sandbox hub — pick any room type, play it, return here.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { SANDBOX_ENCOUNTERS } from '../sandbox/SandboxMode.js';

export class SandboxHubScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SandboxHubScene' });
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }

    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.45);

    this.add.text(320, 22, 'Test Polygon', {
      fontSize: '22px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(320, 44, 'Pick an encounter. When it ends, you return here.', {
      fontSize: '11px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const cols = 3;
    const startX = 120;
    const startY = 78;
    const gapX = 200;
    const gapY = 34;

    SANDBOX_ENCOUNTERS.forEach((entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * gapX;
      const y = startY + row * gapY;
      this.createEncounterButton(x, y, entry.label, () => this.launchEncounter(entry.id));
    });

    this.createEncounterButton(320, 330, 'Back to Main Menu', () => {
      MusicManager.stopIfPlaying(this, 'menu_music', 300);
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainMenuScene');
      });
    }, 180);

    MusicManager.play(this, 'menu_music', 0.45, 600);
  }

  createEncounterButton(x, y, label, onClick, width = 170) {
    const bg = this.add.rectangle(x, y, width, 26, 0x2c1810, 0.92)
      .setStrokeStyle(1, 0x8b6914)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: '12px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      bg.setFillStyle(0x3d2418, 0.95);
      bg.setStrokeStyle(1, 0xd4a017);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x2c1810, 0.92);
      bg.setStrokeStyle(1, 0x8b6914);
    });
    bg.on('pointerdown', () => onClick?.());

    return { bg, text };
  }

  launchEncounter(roomId) {
    MusicManager.stopIfPlaying(this, 'menu_music', 250);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { sandbox: true, sandboxRoom: roomId });
    });
  }
}
