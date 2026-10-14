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
import { createOptionsCog } from '../ui/OptionsCog.js';

// 1, not 2. The doors are 64x64 pixel art and are drawn at native size — at
// double they filled a third of the screen height each and stopped reading as
// objects you walk through. The card that turns into one is 52x70, so the two
// are near enough in size that the flip no longer changes scale.
const CARD_SCALE = 1;
// Each door stands in one of the three arches of pathsBackground.png, its foot
// on the arch floor. Move these with the arches if the backdrop is redrawn.
// The middle arch is the tallest, so its door stands higher than the outer two.
const CARD_XS = [176, 320, 464];
const CARD_YS = [208, 196, 205];
// The arrival: start this far above the resting line, drop for ARRIVE_MS, and
// let the ease carry it past and back.
const ARRIVE_LIFT = 28;
const ARRIVE_MS = 420;
// Far enough apart that each door's creak is heard on its own.
const ARRIVE_STAGGER = 240;
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
    // This screen's own backdrop is drawn dark already, so it goes in undimmed;
    // the main menu's art, if it is ever all there is, still gets the shade.
    if (this.textures.exists('pathsBackground')) {
      this.add.image(320, 180, 'pathsBackground');
    } else {
      if (this.textures.exists('mainBG')) {
        this.add.image(320, 180, 'mainBG');
      } else {
        this.add.rectangle(320, 180, 640, 360, 0x0a1514);
      }
      this.add.rectangle(320, 180, 640, 360, 0x000000, 0.55);
    }

    // Centred in the banner painted across the top of pathsBackground.png.
    createTitle(this, 320, 23, t(this, 'ui.locationPick.title'), {
      color: '#f2d3aa',
      fallbackSize: '20px',
    });
    this.add.text(320, 54, t(this, 'ui.locationPick.subtitle', { act: this.pickAct }), {
      fontSize: '11px',
      fill: '#869089',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    this.add.text(320, 338, t(this, 'ui.locationPick.hint'), {
      fontSize: '10px',
      fill: '#c8b08a',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5);

    // Same corner as every other screen's cog. It opens the in-run options
    // (sound, quit to menu), the way the village does.
    createOptionsCog(this, () => this.openOptions());

    const roads = roadsForAct(this.pickAct);
    Phaser.Utils.Array.Shuffle(roads);

    roads.forEach((id, i) => this.dealCard(id, CARD_XS[i], CARD_YS[i], i));

    // The backdrop's own light, painted in Lighten over pathsBackground.png
    // and laid on the same way. It goes on first, so the Overlay sheet below
    // is applied on top of it.
    applyOverlayLight(this, { key: 'pathsBackgroundLight', mode: 'lighten' });

    // This screen's own light sheet, laid over the finished frame in the same
    // Overlay blend the main menu uses. A camera post-process, so it covers
    // the doors and text without competing for depth.
    // The sheet was painted for the doors' old line (y 168); they now stand in
    // the backdrop's arches, so it is moved down to match.
    applyOverlayLight(this, { key: 'pathOverlayLight', offsetY: 36 });

    // Same level as the main menu and village (0.6): the one theme carries
    // across all three screens, so a different level here would step.
    MusicManager.play(this, 'menu_music', 0.6, 500);
  }

  // Pauses this screen under the pause menu, as the village does.
  openOptions() {
    if (this._locked || this.scene.isActive('PauseMenuScene')) return;
    this.scene.launch('PauseMenuScene', { pausedScene: this.scene.key });
    this.scene.pause();
  }

  dealCard(locationId, x, y, delayIndex) {
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
        ? this.add.sprite(x, y - ARRIVE_LIFT, backKey)
        : this.add.sprite(x, y - ARRIVE_LIFT, door.key, door.shut)
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

    // Back.easeOut on a downward move is the dip: it travels past y and
    // eases back up onto it. The fade is a separate tween because a Back ease
    // would overshoot alpha past 1 as well.
    this.tweens.add({
      targets: sprite,
      y,
      duration: ARRIVE_MS,
      delay,
      ease: 'Back.easeOut',
      onUpdate: () => { sprite.y = Math.round(sprite.y); },
      onComplete: () => {
        snapOriginToPixelGrid(sprite);
        SoundHelper.playVariant(this, 'door_land', 0.5);
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
  // the door creaks on its hinge, nothing moves.
  enableCard(entry) {
    const { sprite } = entry;
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerover', () => {
      if (this._locked) return;
      SoundHelper.playVariant(this, 'door_hover', 0.4);
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
