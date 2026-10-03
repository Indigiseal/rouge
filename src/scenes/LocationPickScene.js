import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { applyLocationChoice, getLocationRule, roadsForAct } from '../content/locations/index.js';
import { PATH_LOCATIONS } from '../content/locations/catalog.js';
import {
  ensureDoorOpenAnim,
  locationCardBackKey,
  locationDoorArt,
} from '../content/assets/locationCards.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';
import { applyOverlayLight } from '../ui/OverlayLightPipeline.js';
import { setHoverLight } from '../ui/HoverLight.js';

// 1, not 2. The doors are 64x64 pixel art and are drawn at native size — at
// double they filled a third of the screen height each and stopped reading as
// objects you walk through. The card that turns into one is 52x70, so the two
// are near enough in size that the flip no longer changes scale.
const CARD_SCALE = 1;
const CARD_Y = 168;
const CARD_XS = [160, 320, 480];
// The arrival: start this far above the resting line, drop for ARRIVE_MS, and
// let the ease carry it past and back.
const ARRIVE_LIFT = 28;
const ARRIVE_MS = 420;
const ARRIVE_STAGGER = 110;
// After the door has swung open (or, for a door without its own animation,
// shown open), this long a beat before the screen fades out, so the opening
// is seen rather than cut off.
const OPEN_HOLD_MS = 180;

export class LocationPickScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LocationPickScene' });
  }

  init(data = {}) {
    this.pickAct = Math.max(1, Math.min(3, Math.floor(Number(data.act) || 1)));
    this.mode = data.mode === 'nextAct' ? 'nextAct' : 'newRun';
    this.characterId = 'rogue';
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

    // This screen's own light sheet, laid over the finished frame in the same
    // Overlay blend the main menu uses. A camera post-process, so it covers
    // the doors and text without competing for depth.
    applyOverlayLight(this, { key: 'pathOverlayLight' });

    // Same level as the main menu and village (0.6): the one theme carries
    // across all three screens, so a different level here would step.
    MusicManager.play(this, 'menu_music', 0.6, 500);
  }

  dealCard(locationId, x, delayIndex) {
    const loc = PATH_LOCATIONS[locationId];
    if (!loc) return;

    // What the card turns into. A road with a door drawn for it reveals the
    // door itself — 64x64 rather than a 52x70 card, so the sprite grows a
    // little as it turns over. Roads still waiting on a door fall back to the
    // composited card back with the boss portrait on it.
    // Shut, from whichever sheet the road's door is drawn on (Boneflood has
    // its own skull door; the rest share paths.png).
    const door = locationDoorArt(this, loc.id);
    const backKey = this.textures.exists(locationCardBackKey(loc.id))
      ? locationCardBackKey(loc.id)
      : (this.textures.exists(loc.portrait) ? loc.portrait : 'cardBack');

    // The door itself, straight away. There is no card and no flip: it drops in
    // from above, sinks past where it belongs, and rocks back up onto it.
    const sprite = snapOriginToPixelGrid(
      door === null
        ? this.add.sprite(x, CARD_Y - ARRIVE_LIFT, backKey)
        : this.add.sprite(x, CARD_Y - ARRIVE_LIFT, door.key, door.shut)
    );
    sprite.setScale(CARD_SCALE).setDepth(4).setAlpha(0);

    // No writing under the doors: the door art is the road.
    const entry = {
      id: loc.id,
      sprite,
      backKey,
      door,
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

  // Hover and press as the fight's exit door has them: the art lights up and
  // the button hover sound plays, nothing moves.
  enableCard(entry) {
    const { sprite } = entry;
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerover', () => {
      if (this._locked) return;
      SoundHelper.playVariant(this, 'hover_button', 0.4);
      setHoverLight(sprite, true);
    });
    sprite.on('pointerout', () => {
      if (this._locked) return;
      setHoverLight(sprite, false);
    });
    sprite.on('pointerdown', () => this.confirm(entry));
  }

  // The chosen door opens — swinging through its frames if it has its own
  // sheet, or straight to its open frame on paths.png — with the door sound,
  // and the screen fades out once it has.
  confirm(entry) {
    if (this._locked) return;
    this._locked = true;
    this.input.enabled = false;
    this._cards.forEach((card) => {
      card.sprite?.disableInteractive?.();
      setHoverLight(card.sprite, false);
    });

    MusicManager.stopIfPlaying(this, 'menu_music', 300);
    SoundHelper.playSound(this, 'door_open', 0.6);

    const fadeOut = () => {
      this.time.delayedCall(OPEN_HOLD_MS, () => {
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.leave(entry.id));
      });
    };

    const { sprite, door } = entry;
    const anim = door ? ensureDoorOpenAnim(this, door) : null;
    if (anim && sprite?.play) {
      sprite.once('animationcomplete', fadeOut);
      sprite.play(anim);
    } else {
      if (door) sprite?.setFrame?.(door.open);
      fadeOut();
    }
  }

  leave(locationId) {
    if (this.mode === 'nextAct' && this.gameState) {
      applyLocationChoice(this.gameState, locationId);
      const act = this.pickAct;
      const startNode = this.gameState.dungeonMap?.[`act${act}`]?.floors?.[0]?.[0];
      this.gameState.mapCursor = { act, floor: 0, node: 0 };
      this.gameState.currentFloor = (act - 1) * 15 + 1;
      this.gameState.roomType = startNode?.type || 'COMBAT';
      if (startNode) startNode.visited = true;
      const gameScene = this.scene.get('GameScene');
      // BossRewardRoom put the shared combat scene into transition mode before
      // sleeping it. The first room of the new act must start as a normal room,
      // otherwise its cleared-state exit (including the Brassfair door) stays
      // suppressed.
      if (gameScene) gameScene._transitioning = false;
      gameScene?.saveCurrentRun?.();
      this.scene.stop('MapViewScene');
      this.scene.stop();
      this.scene.wake('GameScene', {
        roomType: this.gameState.roomType,
        isNewRoom: true,
      });
      return;
    }

    const runData = {
      newGame: true,
      characterId: this.characterId,
      armorerArmorType: this.armorerArmorType,
      locationId,
    };
    const introSceneKey = getLocationRule(locationId)?.introSceneKey;
    if (introSceneKey) {
      this.scene.start(introSceneKey, { runData });
      return;
    }
    this.scene.start('GameScene', runData);
  }
}
