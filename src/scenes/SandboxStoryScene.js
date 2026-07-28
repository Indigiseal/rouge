// Story picker for the Test Site — play any event on demand.
//
// The dungeon normally shows each story once and then remembers it forever
// (see content/story/StoryProgress.js), which makes a finished story
// untestable without wiping progress. Everything launched from here ignores
// that saved progress and never writes to it, so a story can be replayed as
// many times as it takes to get it right.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { SANDBOX_HUB_KEY, getSandboxStories } from '../sandbox/SandboxMode.js';

export class SandboxStoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SandboxStoryScene' });
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }

    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.45);

    this.add.text(320, 18, 'Test Site — Stories', {
      fontSize: '20px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(320, 38, 'Any story, already played or not. Progress is not saved.', {
      fontSize: '10px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    // Two columns: the roster is ~17 stories and still has to clear the Back
    // button at the bottom of a 360px-tall screen.
    const stories = getSandboxStories();
    const cols = 2;
    const startX = 168;
    const startY = 62;
    const gapX = 304;
    const gapY = 24;
    const perCol = Math.ceil(stories.length / cols);

    stories.forEach((story, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      this.createStoryButton(
        startX + col * gapX,
        startY + row * gapY,
        story.label,
        () => this.launchStory(story.id),
      );
    });

    this.createStoryButton(320, 338, 'Back to Test Site', () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SANDBOX_HUB_KEY);
      });
    }, 180);

    MusicManager.play(this, 'menu_music', 0.45, 600);
  }

  createStoryButton(x, y, label, onClick, width = 280) {
    const bg = this.add.rectangle(x, y, width, 20, 0x2c1810, 0.92)
      .setStrokeStyle(1, 0x8b6914)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: '11px',
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

  launchStory(eventId) {
    MusicManager.stopIfPlaying(this, 'menu_music', 250);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        sandbox: true,
        sandboxRoom: 'EVENT',
        sandboxEventId: eventId,
      });
    });
  }
}
