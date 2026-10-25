// Encounter sandbox hub — pick any room type, play it, return here.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { SANDBOX_ENCOUNTERS, SANDBOX_STORY_KEY } from '../sandbox/SandboxMode.js';
import { t, translateItemName } from '../i18n/i18n.js';
import { PATH_LOCATIONS } from '../content/locations/catalog.js';
import { BOSSES } from '../content/cards/bosses.js';

export class SandboxHubScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SandboxHubScene' });
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x0a1514);
    }

    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.45);

    this.add.text(320, 22, t(this, 'ui.sandbox.title'), {
      fontSize: '22px',
      fill: '#d6c2c1',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(320, 44, t(this, 'ui.sandbox.subtitle'), {
      fontSize: '11px',
      fill: '#869089',
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
      this.createEncounterButton(x, y, t(this, entry.labelKey ?? entry.label), () => this.launchEncounter(entry.id));
    });

    // "Event" above rolls whatever the story rules would serve next. This picks
    // a specific one instead, ignoring whether it has already been played.
    const rows = Math.ceil(SANDBOX_ENCOUNTERS.length / cols);
    this.createEncounterButton(320, startY + rows * gapY + 8, t(this, 'ui.sandbox.pickStory'), () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SANDBOX_STORY_KEY);
      });
    }, 180);

    this.createEncounterButton(320, 330, t(this, 'ui.sandbox.backToMenu'), () => {
      MusicManager.stopIfPlaying(this, 'menu_music', 300);
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainMenuScene');
      });
    }, 180);

    MusicManager.play(this, 'menu_music', 0.45, 600);
  }

  createEncounterButton(x, y, label, onClick, width = 170) {
    const bg = this.add.rectangle(x, y, width, 26, 0x28150c, 0.92)
      .setStrokeStyle(1, 0x9b6a1b)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: '12px',
      fill: '#d6c2c1',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      bg.setFillStyle(0x46261b, 0.95);
      bg.setStrokeStyle(1, 0xd48e17);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x28150c, 0.92);
      bg.setStrokeStyle(1, 0x9b6a1b);
    });
    bg.on('pointerdown', () => {
      SoundHelper.playVariant(this, 'button_click', 0.5);
      onClick?.();
    });

    return { bg, text };
  }

  launchEncounter(roomId, sandboxLocation = null) {
    // Every location has its own boss: ask which one first.
    if (roomId === 'BOSS' && !sandboxLocation) {
      this.showBossPicker();
      return;
    }
    MusicManager.stopIfPlaying(this, 'menu_music', 250);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const entry = SANDBOX_ENCOUNTERS.find(encounter => encounter.id === roomId);
      if (entry?.kind === 'preview') this.scene.start(entry.sceneKey);
      else this.scene.start('GameScene', { sandbox: true, sandboxRoom: roomId, sandboxLocation });
    });
  }

  // One button per location that has a boss; the fight happens in that location.
  showBossPicker() {
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(this.add.rectangle(320, 180, 640, 360, 0x000000, 0.82).setInteractive());
    layer.add(this.add.text(320, 34, t(this, 'ui.sandbox.encounter.boss'), {
      fontSize: '18px', fill: '#d6c2c1', fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5));
    const bosses = Object.values(PATH_LOCATIONS).filter(loc => loc.bossId && BOSSES[loc.bossId]);
    bosses.forEach((loc, i) => {
      const x = 200 + (i % 2) * 240;
      const y = 76 + Math.floor(i / 2) * 34;
      const label = `${loc.name}: ${translateItemName(this, BOSSES[loc.bossId]) || BOSSES[loc.bossId].name}`;
      const button = this.createEncounterButton(x, y, label, () => this.launchEncounter('BOSS', loc.id), 220);
      layer.add([button.bg, button.text]);
    });
    // Back closes the list, not the Test Site.
    const back = this.createEncounterButton(320, 330, t(this, 'ui.common.back'), () => layer.destroy(), 180);
    layer.add([back.bg, back.text]);
  }
}
