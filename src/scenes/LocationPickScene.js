import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { applyLocationChoice, roadsForAct } from '../content/locations/index.js';
import { PATH_LOCATIONS } from '../content/locations/catalog.js';
import {
  LOCATION_DOORS_KEY,
  locationCardBackKey,
  locationDoorFrame,
} from '../content/assets/locationCards.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';

// 1, not 2. The doors are 64x64 pixel art and are drawn at native size — at
// double they filled a third of the screen height each and stopped reading as
// objects you walk through. The card that turns into one is 52x70, so the two
// are near enough in size that the flip no longer changes scale.
const CARD_SCALE = 1;
const CARD_Y = 168;
const CARD_XS = [160, 320, 480];
// The writing sits under art that is now roughly 64-70px tall, so it comes up
// with it. Offsets from CARD_Y, keeping the old rhythm: name, place a line
// under it, then the pitch a little clear of both.
// The arrival: start this far above the resting line, drop for ARRIVE_MS, and
// let the ease carry it past and back.
const ARRIVE_LIFT = 28;
const ARRIVE_MS = 420;
const ARRIVE_STAGGER = 110;
const NAME_DY = 46;
const PLACE_DY = 60;
const PITCH_DY = 82;

export class LocationPickScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LocationPickScene' });
  }

  init(data = {}) {
    this.pickAct = Math.max(1, Math.min(3, Math.floor(Number(data.act) || 1)));
    this.mode = data.mode === 'nextAct' ? 'nextAct' : 'newRun';
    this.characterId = data.characterId === 'warrior' ? 'warrior' : 'rogue';
    this.armorerArmorType = data.armorerArmorType || null;
    this.gameState = data.gameState || null;
    this._locked = false;
    this._cards = [];
  }

  create() {
    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }
    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.55);

    createTitle(this, 320, 28, t(this, 'ui.locationPick.title'), {
      color: '#f2d3aa',
      fallbackSize: '20px',
    });
    this.add.text(320, 48, t(this, 'ui.locationPick.subtitle', { act: this.pickAct }), {
      fontSize: '11px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    this.add.text(320, 338, t(this, 'ui.locationPick.hint'), {
      fontSize: '10px',
      fill: '#d4b896',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5);

    const roads = roadsForAct(this.pickAct);
    Phaser.Utils.Array.Shuffle(roads);

    roads.forEach((id, i) => this.dealCard(id, CARD_XS[i], i));

    MusicManager.play(this, 'menu_music', 0.45, 500);
  }

  dealCard(locationId, x, delayIndex) {
    const loc = PATH_LOCATIONS[locationId];
    if (!loc) return;

    // What the card turns into. A road with a door drawn for it reveals the
    // door itself — 64x64 rather than a 52x70 card, so the sprite grows a
    // little as it turns over. Roads still waiting on a door fall back to the
    // composited card back with the boss portrait on it.
    const doorFrame = this.textures.exists(LOCATION_DOORS_KEY)
      ? locationDoorFrame(loc.id)
      : null;
    const backKey = this.textures.exists(locationCardBackKey(loc.id))
      ? locationCardBackKey(loc.id)
      : (this.textures.exists(loc.portrait) ? loc.portrait : 'cardBack');

    // The door itself, straight away. There is no card and no flip: it drops in
    // from above, sinks past where it belongs, and rocks back up onto it.
    const sprite = snapOriginToPixelGrid(
      doorFrame === null
        ? this.add.sprite(x, CARD_Y - ARRIVE_LIFT, backKey)
        : this.add.sprite(x, CARD_Y - ARRIVE_LIFT, LOCATION_DOORS_KEY, doorFrame)
    );
    sprite.setScale(CARD_SCALE).setDepth(4).setAlpha(0);

    const nameText = this.add.text(x, CARD_Y + NAME_DY, '', {
      fontSize: '12px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5).setAlpha(0).setDepth(6);

    const placeText = this.add.text(x, CARD_Y + PLACE_DY, '', {
      fontSize: '10px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 140 },
    }).setOrigin(0.5).setAlpha(0).setDepth(6);

    const pitchText = this.add.text(x, CARD_Y + PITCH_DY, '', {
      fontSize: '10px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 150 },
    }).setOrigin(0.5).setAlpha(0).setDepth(6);

    const entry = {
      id: loc.id,
      sprite,
      nameText,
      placeText,
      pitchText,
      backKey,
      doorFrame,
    };
    this._cards.push(entry);

    const delay = delayIndex * ARRIVE_STAGGER;

    // Back.easeOut on a downward move is the dip: it travels past CARD_Y and
    // eases back up onto it. The fade is a separate tween because a Back ease
    // would overshoot alpha past 1 as well.
    this.tweens.add({
      targets: sprite,
      y: CARD_Y,
      duration: ARRIVE_MS,
      delay,
      ease: 'Back.easeOut',
      onUpdate: () => { sprite.y = Math.round(sprite.y); },
      onComplete: () => {
        snapOriginToPixelGrid(sprite);
        SoundHelper.playVariant(this, 'card_place', 0.4);
        this.showCardDetails(entry);
        this.enableCard(entry);
      },
    });
    this.tweens.add({
      targets: sprite,
      alpha: 1,
      duration: 160,
      delay,
      ease: 'Quad.easeOut',
    });
  }

  enableCard(entry) {
    const { sprite } = entry;
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerover', () => {
      if (this._locked) return;
      SoundHelper.playVariant(this, 'hover_button', 0.3);
      this.tweens.add({ targets: sprite, y: CARD_Y - 6, duration: 80 });
    });
    sprite.on('pointerout', () => {
      if (this._locked) return;
      this.tweens.add({ targets: sprite, y: CARD_Y, duration: 80 });
    });
    sprite.on('pointerdown', () => this.confirm(entry.id));
  }

  showCardDetails(entry) {
    entry.nameText.setText(t(this, `location.${entry.id}.name`));
    entry.placeText.setText(t(this, `location.${entry.id}.place`));
    entry.pitchText.setText(t(this, `location.${entry.id}.pitch`));
    this.tweens.add({
      targets: [entry.nameText, entry.placeText, entry.pitchText],
      alpha: 1,
      duration: 160,
    });
  }

  confirm(locationId) {
    if (this._locked) return;
    this._locked = true;
    this.input.enabled = false;
    this._cards.forEach((entry) => entry.sprite?.disableInteractive?.());

    MusicManager.stopIfPlaying(this, 'menu_music', 300);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.leave(locationId));
  }

  leave(locationId) {
    if (this.mode === 'nextAct' && this.gameState) {
      applyLocationChoice(this.gameState, locationId);
      const gameScene = this.scene.get('GameScene');
      gameScene?.saveCurrentRun?.();
      this.scene.start('MapViewScene', { gameState: this.gameState });
      return;
    }

    this.scene.start('GameScene', {
      newGame: true,
      characterId: this.characterId,
      armorerArmorType: this.armorerArmorType,
      locationId,
    });
  }
}
