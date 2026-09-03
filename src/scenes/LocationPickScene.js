import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { applyLocationChoice, roadsForAct } from '../content/locations/index.js';
import { PATH_LOCATIONS } from '../content/locations/catalog.js';
import { locationCardBackKey } from '../content/assets/locationCards.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';

const CARD_SCALE = 2;
const CARD_Y = 168;
const CARD_XS = [160, 320, 480];

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

    const backKey = this.textures.exists(locationCardBackKey(loc.id))
      ? locationCardBackKey(loc.id)
      : (this.textures.exists(loc.portrait) ? loc.portrait : 'cardBack');

    const sprite = snapOriginToPixelGrid(
      this.add.sprite(x, CARD_Y + 24, 'cardBack').setScale(CARD_SCALE).setDepth(4)
    );
    sprite.setAlpha(0);

    const nameText = this.add.text(x, CARD_Y + 82, '', {
      fontSize: '12px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5).setAlpha(0).setDepth(6);

    const placeText = this.add.text(x, CARD_Y + 96, '', {
      fontSize: '10px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 140 },
    }).setOrigin(0.5).setAlpha(0).setDepth(6);

    const pitchText = this.add.text(x, CARD_Y + 118, '', {
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
    };
    this._cards.push(entry);

    this.tweens.add({
      targets: sprite,
      y: CARD_Y,
      alpha: 1,
      duration: 280,
      delay: delayIndex * 90,
      ease: 'Quad.easeOut',
      onComplete: () => this.flipToLocationBack(entry),
    });
  }

  flipToLocationBack(entry) {
    const { sprite, backKey } = entry;
    SoundHelper.playSound(this, 'card_flip', 0.55);
    const finish = () => {
      sprite.off('animationcomplete', finish);
      sprite.setTexture(backKey).setScale(CARD_SCALE);
      this.showCardDetails(entry);
      this.enableCard(entry);
    };
    if (this.anims.exists('card_flip_anim')) {
      sprite.once('animationcomplete', finish);
      sprite.play('card_flip_anim');
    } else {
      finish();
    }
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
