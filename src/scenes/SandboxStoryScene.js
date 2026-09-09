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
import { t } from '../i18n/i18n.js';

// The scrolling window: under the subtitle, clear of the Back button at 338.
const LIST_TOP = 52;
const LIST_BOTTOM = 322;
const ROW_H = 20;
const SCROLL_STEP = 28;


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

    this.add.text(320, 18, t(this, 'ui.sandbox.storiesTitle'), {
      fontSize: '20px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.add.text(320, 38, t(this, 'ui.sandbox.storiesSubtitle'), {
      fontSize: '10px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    // Two columns inside a scrolling viewport. The roster passed the point where
    // a 360px screen could hold it — 22 stories filled the last row down to the
    // Back button — and it is still growing, so the list scrolls rather than
    // being re-tuned every time a story lands.
    const stories = getSandboxStories();
    const cols = 2;
    const startX = 168;
    const startY = 62;
    const gapX = 304;
    // 30, not 24: at 24 the rows were packed edge to edge — 20px buttons with
    // 4px between them — and the list ended 10px above the Back button, which
    // is what "the scene is full" looked like. At 30 they breathe, and the
    // roster no longer fits the window, so the scroll is a real control today
    // rather than one that appears on some future story.
    const gapY = 30;
    const perCol = Math.ceil(stories.length / cols);

    // Everything scrollable lives in one container; the mask is what makes rows
    // disappear at the viewport's edges instead of over the title and Back.
    this.listView = this.add.container(0, 0);
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillRect(0, LIST_TOP, 640, LIST_BOTTOM - LIST_TOP);
    this.listView.setMask(maskShape.createGeometryMask());

    stories.forEach((story, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const parts = this.createStoryButton(
        startX + col * gapX,
        startY + row * gapY,
        story.label,
        () => this.launchStory(story.eventId || story.id, story.id),
      );
      this.listView.add([parts.bg, parts.text]);
    });

    // How far the content can travel: the last row's bottom edge against the
    // viewport's. Zero when everything already fits, which parks the scroll.
    const contentBottom = startY + (perCol - 1) * gapY + ROW_H / 2;
    this.scrollMax = Math.max(0, contentBottom - LIST_BOTTOM + 6);
    this.scrollY = 0;
    this.buildScrollBar();
    this.attachScrolling();

    this.createStoryButton(320, 338, t(this, 'ui.sandbox.backToSite'), () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SANDBOX_HUB_KEY);
      });
    }, 180);

    MusicManager.play(this, 'menu_music', 0.45, 600);
  }

  // The window the list scrolls inside: below the subtitle, above the Back
  // button, both of which stay put.
  buildScrollBar() {
    if (this.scrollMax <= 0) return;
    const x = 632;
    this.add.rectangle(x, LIST_TOP, 3, LIST_BOTTOM - LIST_TOP, 0x8b6914, 0.2)
      .setOrigin(0.5, 0);
    const visible = LIST_BOTTOM - LIST_TOP;
    const thumbH = Math.max(18, Math.round(visible * (visible / (visible + this.scrollMax))));
    this.scrollThumb = this.add.rectangle(x, LIST_TOP, 3, thumbH, 0xd4a017, 0.75)
      .setOrigin(0.5, 0);
  }

  attachScrolling() {
    if (this.scrollMax <= 0) return;

    // Scene-level rather than per-object: a 'wheel' bound to a game object
    // frequently never fires, which is the lesson the combat log already
    // learned.
    this.input.on('wheel', (pointer, over, dx, dy) => this.scrollList(dy > 0 ? SCROLL_STEP : -SCROLL_STEP));

    // Dragging the list is the only gesture available on a trackpad or touch,
    // and it does not fight the buttons: a click that never moves still fires.
    this.input.on('pointerdown', (pointer) => {
      if (pointer.y < LIST_TOP || pointer.y > LIST_BOTTOM) return;
      this._drag = { y: pointer.y, from: this.scrollY };
    });
    this.input.on('pointermove', (pointer) => {
      if (!this._drag || !pointer.isDown) return;
      this.setScroll(this._drag.from - (pointer.y - this._drag.y));
    });
    this.input.on('pointerup', () => { this._drag = null; });
  }

  scrollList(delta) {
    this.setScroll(this.scrollY + delta);
  }

  setScroll(value) {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.scrollMax);
    this.listView.y = -this.scrollY;
    if (this.scrollThumb) {
      const visible = LIST_BOTTOM - LIST_TOP;
      const travel = visible - this.scrollThumb.height;
      this.scrollThumb.y = LIST_TOP + Math.round(travel * (this.scrollY / this.scrollMax));
    }
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
    bg.on('pointerdown', () => {
      SoundHelper.playVariant(this, 'button_click', 0.5);
      onClick?.();
    });

    return { bg, text };
  }

  launchStory(eventId, setupId = eventId) {
    MusicManager.stopIfPlaying(this, 'menu_music', 250);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        sandbox: true,
        sandboxRoom: 'EVENT',
        sandboxEventId: eventId,
        sandboxStorySetupId: setupId,
      });
    });
  }
}
