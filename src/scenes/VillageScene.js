// Village map: dedicated lots for named buildings. Empty lots wait for Support.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { MetaProgressionManager } from '../managers/MetaProgressionManager.js';
import {
  VILLAGE_PLOTS,
  getVillageBuilding,
} from '../content/village/index.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { openConfirmModal } from '../ui/ConfirmModal.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';
import { applyOverlayLight } from '../ui/OverlayLightPipeline.js';
import { createSelectionCorners } from '../ui/NineSlicePanel.js';
import { createOptionsCog } from '../ui/OptionsCog.js';
import { setHoverLight } from '../ui/HoverLight.js';

// Every number here is measured off assets/ui/mockUpVillage.png, which is
// authored at the world size, so it transfers 1:1.
//
// The three board layers and the thorns are each placed by their own centre
// rather than being centred on the screen: two of them deliberately overhang
// the bottom edge, because the art carries extra length there for a slide-in
// that does not exist yet.
const BACKDROP = 0x584339;          // flat fill behind everything, from the mock
const LAYERS = Object.freeze([
  { key: 'villageBoardWood',  x: 316, y: 184 },   // 644x368, flush to the top
  { key: 'villageBoardMetal', x: 320, y: 186 },   // 524x296, the play surface
  { key: 'villageBoardWood2', x: 320, y: 347 },   // 672x98, footer rail
  { key: 'villageThorn',      x: 320, y: 293 },   // 640x134, sits on the bottom
]);

// Card grid. The mock-up's columns land at 184/325/469 and its rows at ~115
// and ~229; the columns are re-centred on the board (320) and the rows
// levelled, because the mock was assembled by eye and says so.
const CARD_COLS = Object.freeze([177, 320, 463]);
const CARD_ROWS = Object.freeze([116, 228]);
// The slate plate tucks under the card by 11px, so the card sits on it.
const PLATE_DY = 47;

// Which frame of buildings.png belongs to which plot.
const VILLAGE_FRAME = Object.freeze({
  forge: 0, temple: 1, armory: 2, cottage: 3, healer: 4, __empty: 5,
});

const BANNER_Y = 25;
const FOOTER_Y = 337;
const FOOTER_X = Object.freeze([64, 192, 320, 448, 576]);

// House card feel, lifted from FloorSpawner: rise 5px over 150ms, shadow
// underneath, shine sheet over the top in SCREEN.
const CARD_LIFT = 5;
const CARD_LIFT_MS = 150;
const VILLAGE_HOVER_ANIM = 'village_card_hover';
const VILLAGE_FLIP_ANIM = 'village_card_flip';
// Shared with GameScene's bag cards, so the same key and settings.
const FACE_SHINE_ANIM = 'hover_cards_anim';

// cardFlip54x86Sheet frame 0 is the card back, and the same sprite carries the
// flip. The drawn card inside that 54x86 frame is 52x70 at x1..52 / y13..82 —
// the same size as a building card, but sitting low in the frame to leave room
// for the lift in frames 1-4. Origin is set to the drawn card's own centre so
// a face-down lot lands exactly where its building would.
const BACK_ORIGIN_X = 26.5 / 54;
const BACK_ORIGIN_Y = 47.5 / 86;

// Selection brackets around the chosen card. The bracket's elbow is drawn 6px
// up-left of the sprite's centre, so these put each elbow 2px clear of the
// 52x70 card: 26 + 2 - 6 across, 35 + 2 - 6 down.
const CORNER_OFFSET = Object.freeze({ x: 22, y: 31 });

// Rank stars along the bottom of a built card, one per rank, centred on the
// green band at the foot of the card art. Laid out as in
// assets/ui/rankStarExample.png: each star 6px right of the one before and
// drawn over it, so the 11px stars overlap by about 5px and the newest rank
// sits on top.
const STAR_DY = 31;
const STAR_STEP = 6;
const STAR_SIZE = 12;

// Entrance. The boards rise a short way into place one after another, each
// running a little past its spot and settling back: the back wooden board
// first, then the metal play surface, then the footer rail and the thorns
// together. Everything drawn on a board rides with it. Every group is in view
// from the first frame, faint and a little low, and firms up as it rises.
const INTRO_STAGES = Object.freeze(['wood', 'metal', 'rail']);
const INTRO_STAGE_OF_LAYER = Object.freeze({
  villageBoardWood: 'wood',
  villageBoardMetal: 'metal',
  villageBoardWood2: 'rail',
  villageThorn: 'rail',
});
const INTRO_DROP = 24;           // how far below the rest spot each group starts
const INTRO_MS = 520;
// Fade-in over the start of the rise, per group. The wood and the rail are
// close in colour to the backdrop and get away with a quick fade; the grey
// metal over brown, carrying every card, popped at that speed, so it fades
// for longer.
const INTRO_FADE_MS = Object.freeze({ wood: 100, metal: 220, rail: 160 });
// Every group waits at this opacity, below its spot, until its start, then
// fades the rest of the way up as it rises.
const INTRO_FADE_FROM = 0.7;
// When each group starts. The metal starts a touch early so it rises while the
// wood is still arriving; the rail keeps its old 400ms start.
const INTRO_START_MS = Object.freeze({ wood: 0, metal: 150, rail: 400 });
// Back ease strength. Over a short drop Phaser's default (1.70158) overshoots
// by only ~2px; 2.5 runs ~19% of the drop past the spot, about 4-5px.
const INTRO_OVERSHOOT = 2.5;

export class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VillageScene' });
  }

  init(data = {}) {
    this.characterId = 'rogue';
    this.selectedId = null;
    this.plotViews = [];
    this.selectCorners = null;
    this.introGroups = { wood: [], metal: [], rail: [] };
  }

  create() {
    this.meta = new MetaProgressionManager(this);

    this.registerCardAnimations();

    // Flat fill first: two of the board layers hang off the bottom of the
    // screen and the thorns have gaps, so bare canvas would show through.
    this.add.rectangle(320, 180, 640, 360, BACKDROP).setDepth(0);
    LAYERS.forEach(({ key, x, y }, i) => {
      if (!this.textures.exists(key)) return;
      const layer = snapOriginToPixelGrid(this.add.image(x, y, key)).setDepth(1 + i);
      this.introGroups[INTRO_STAGE_OF_LAYER[key]].push(layer);
    });

    if (this.textures.exists('villageBanner')) {
      this.introGroups.wood.push(
        snapOriginToPixelGrid(this.add.image(320, BANNER_Y, 'villageBanner')).setDepth(40),
      );
    }
    // depth matters here: createTitle leaves a text at depth 0 unless told
    // otherwise, which put the title underneath the board layers and the
    // ribbon rather than on them.
    this.introGroups.wood.push(createTitle(this, 320, BANNER_Y - 1, t(this, 'ui.village.title'), {
      color: '#f2d3aa',
      fallbackSize: '18px',
      depth: 41,
    }));

    // Same corner as the main menu's cog. It opens the in-run options (sound,
    // quit to menu), the way the rest and anvil rooms do.
    createOptionsCog(this, () => this.openOptions());

    VILLAGE_PLOTS.forEach((plot, index) => this.drawPlot(plot, index));

    // The name lives on each card's plate and the rank in its stars, so the only thing left
    // to say here is what the selected building does. It goes in the thin band
    // between the bottom row and the footer rail — the one strip the art
    // leaves clear — and is outlined so it survives the thorns behind it.
    this.detailTitle = this.add.text(320, 0, '', { fontSize: '1px' })
      .setVisible(false).setActive(false);
    this.detailBody = this.add.text(320, 306, t(this, 'ui.village.pickPlot'), {
      fontSize: '9px',
      fill: '#e6d6b8',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 470 },
      stroke: '#17120f',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(45);
    this.introGroups.metal.push(this.detailBody);

    // Five painted slots across the footer rail, evenly spaced. Build is the
    // middle one because it is the action the screen exists for.
    this.buildBtn = this.makeFooterButton(FOOTER_X[2], t(this, 'ui.village.build'),
      () => this.tryBuild());
    this.buildLabel = this.buildBtn.label;

    // Back is the main menu: there is one hero, so New Game comes straight
    // here and the character select is no longer registered.
    this.makeFooterButton(FOOTER_X[0], t(this, 'ui.village.back'), () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainMenuScene');
      });
    });
    this.makeFooterButton(FOOTER_X[1], t(this, 'ui.village.leave'), () => this.leave());
    this.makeFooterButton(FOOTER_X[3], '+25', () => {
      this.meta.grantDebugXp(this.characterId, 25);
      this.refresh();
    });
    this.makeFooterButton(FOOTER_X[4], t(this, 'ui.village.debugResetMeta'),
      () => this.confirmResetMetaProgression(),
      { fontSize: '8px', upKey: 'villageButtonUp', downKey: 'villageButtonDown' });

    applyOverlayLight(this);

    this.refresh();
    this.playIntro();
    // Same level as the main menu (0.6), whose theme this carries on.
    MusicManager.play(this, 'menu_music', 0.6, 500);
  }

  // Slide the three board groups in, staggered. One counter per group drives
  // every object in it, rounded to whole pixels so the art never smears
  // between them. Input is off until the last group lands: a hover mid-slide
  // would start the card lift from the wrong height, and the hit zones are
  // already sitting at the rest spots.
  playIntro() {
    const stages = INTRO_STAGES
      .map((name) => ({ name, objs: this.introGroups[name].filter((o) => o?.scene) }))
      .filter(({ objs }) => objs.length);
    if (!stages.length) return;

    this.input.enabled = false;
    let landed = 0;
    stages.forEach(({ name, objs }) => {
      const fadeMs = INTRO_FADE_MS[name];
      const rest = objs.map((o) => o.y);
      // Fade relative to each object's own alpha: refresh() has already
      // dimmed the unavailable buttons, and the shadows are half-strength.
      const restAlpha = objs.map((o) => o.alpha);
      const place = (offset, fade) => {
        objs.forEach((o, j) => {
          o.y = rest[j] + Math.round(offset);
          o.setAlpha(restAlpha[j] * fade);
        });
      };
      place(INTRO_DROP, INTRO_FADE_FROM);
      this.tweens.addCounter({
        from: INTRO_DROP,
        to: 0,
        delay: INTRO_START_MS[name],
        duration: INTRO_MS,
        ease: 'Back.easeOut',
        easeParams: [INTRO_OVERSHOOT],
        onUpdate: (tween) => place(
          tween.getValue(),
          INTRO_FADE_FROM + (1 - INTRO_FADE_FROM)
            * Math.min(1, (tween.progress * INTRO_MS) / fadeMs),
        ),
        onComplete: () => {
          place(0, 1);
          landed += 1;
          if (landed === stages.length) this.input.enabled = true;
        },
      });
    });
  }

  // The hover shine and the flip are the same two sheets the board cards use,
  // just the plain pair rather than the per-location "All" variants. Frame
  // rates match locationCardArt so a building flips at the speed a loot card
  // does.
  registerCardAnimations() {
    if (this.textures.exists('villageCardHover') && !this.anims.exists(VILLAGE_HOVER_ANIM)) {
      this.anims.create({
        key: VILLAGE_HOVER_ANIM,
        frames: this.anims.generateFrameNumbers('villageCardHover', { start: 0, end: 4 }),
        frameRate: 24,
        repeat: 0,
      });
    }
    if (this.textures.exists('villageCardFlip') && !this.anims.exists(VILLAGE_FLIP_ANIM)) {
      this.anims.create({
        key: VILLAGE_FLIP_ANIM,
        frames: this.anims.generateFrameNumbers('villageCardFlip', { start: 0, end: 4 }),
        frameRate: 24,
        repeat: 0,
      });
    }
    // The face-up shine the bag cards use. Same key and settings as
    // GameScene's, which may not have run yet when the village opens first.
    if (this.textures.exists('hoverCardsUpSheet') && !this.anims.exists(FACE_SHINE_ANIM)) {
      this.anims.create({
        key: FACE_SHINE_ANIM,
        frames: this.anims.generateFrameNumbers('hoverCardsUpSheet', { start: 0, end: 4 }),
        frameRate: 12,
        repeat: 0,
      });
    }
  }

  // Where a plot's card sits. VILLAGE_PLOTS is ordered forge/temple/armory
  // then healer/cottage/empty, but the grid reads left to right, so the slot
  // comes from the plot's own x rather than from its index.
  cardSlot(plot, index) {
    const col = plot.x <= 220 ? 0 : (plot.x >= 420 ? 2 : 1);
    const row = index < 3 ? 0 : 1;
    return { x: CARD_COLS[col], y: CARD_ROWS[row] };
  }

  drawPlot(plot, index) {
    const empty = !plot.id;
    const { x, y } = this.cardSlot(plot, index);
    const frame = empty ? VILLAGE_FRAME.__empty : (VILLAGE_FRAME[plot.id] ?? 0);

    // Slate name plate, under the card and overlapping it, exactly as the
    // mock-up stacks them.
    if (this.textures.exists('villagePlate')) {
      this.introGroups.metal.push(
        snapOriginToPixelGrid(this.add.image(x, y + PLATE_DY, 'villagePlate')).setDepth(10),
      );
    }

    // Shadow first, so the card lifts away from it.
    const shadow = this.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6).setDepth(11);

    const card = snapOriginToPixelGrid(
      this.add.sprite(x, y, 'villageBuildings', frame),
    ).setDepth(12);

    // Face-down state. An unbuilt lot shows the card back; building it flips
    // the card over to reveal the art. Same sprite does both, because frame 0
    // of the flip sheet IS the back.
    let back = null;
    if (this.textures.exists('villageCardFlip')) {
      back = this.add.sprite(x, y, 'villageCardFlip', 0)
        .setOrigin(BACK_ORIGIN_X, BACK_ORIGIN_Y)
        .setDepth(14);
    }

    // Hover sheet for the face-down state. It is not a light layer: every
    // frame is the whole card back with the light swept across it, so it
    // stands in for the back while hovered and is drawn normally. Laid over
    // a built card in SCREEN it left the back washed across the building.
    // Hidden until hover so there is no first-frame flash.
    let shine = null;
    if (this.textures.exists('villageCardHover')) {
      shine = snapOriginToPixelGrid(this.add.sprite(x, y, 'villageCardHover', 0));
      shine.setVisible(false).setDepth(14);
    }

    // Hover light for a built card: the light-only sheet the bag cards sweep
    // in SCREEN. Over the face and its stars, under the back. Hidden until
    // hover.
    let faceShine = null;
    if (this.textures.exists('hoverCardsUpSheet')) {
      faceShine = snapOriginToPixelGrid(this.add.sprite(x, y, 'hoverCardsUpSheet', 0));
      faceShine.setVisible(false).setDepth(13.5);
      faceShine.setBlendMode(Phaser.BlendModes.SCREEN);
    }

    // The plate carries the name alone now that the stars show the rank.
    const name = this.add.text(x, y + PLATE_DY, '', {
      fontSize: '10px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5).setDepth(15);

    // Input goes on a zone rather than on a sprite: the card and the back
    // take turns being visible, and an invisible sprite takes no pointer
    // events, so hover would die the moment a lot flipped.
    const zone = this.add.zone(x, y, 52, 70).setInteractive({ useHandCursor: true });

    // One star per possible rank, made once and shown as ranks are bought.
    // Depth climbs left to right so each star covers the one before it; all
    // of them sit over the face (12) and under the back (14), so a face-down
    // card hides them.
    const stars = [];
    const maxRank = plot.id ? (getVillageBuilding(plot.id)?.maxRank ?? 0) : 0;
    if (this.textures.exists('villageRankStar')) {
      for (let i = 0; i < maxRank; i++) {
        stars.push(this.add.image(x, y + STAR_DY, 'villageRankStar')
          .setVisible(false)
          .setDepth(13 + i * 0.01));
      }
    }

    this.introGroups.metal.push(card, back, shadow, shine, faceShine, name, ...stars);
    const view = {
      plot, card, back, shadow, shine, faceShine, name, stars,
      restY: y, revealed: false, lifted: false,
    };
    this.plotViews.push(view);

    if (empty) {
      name.setText(t(this, 'ui.village.emptyLot'));
      name.setColor('#6e7681');
      // A lot with nothing planned for it stays face down for good.
      card.setVisible(false);
      zone.destroy();
      return;
    }

    zone.on('pointerover', () => this.liftCard(view, true));
    zone.on('pointerout', () => this.liftCard(view, false));
    zone.on('pointerdown', () => {
      if (this.selectedId === plot.id) return;
      this.selectedId = plot.id;
      SoundHelper.playSound(this, 'ui_card_hover', 0.3);
      this.refresh();
    });
  }

  // Rise, shine and shadow, at the board's timings.
  liftCard(view, lifted) {
    const { card, back, shine, shadow, restY } = view;
    const target = lifted ? restY - CARD_LIFT : restY;
    view.lifted = lifted;

    if (lifted) SoundHelper.playSound(this, 'ui_card_hover', 0.35);

    // Both faces ride the lift. Only one is ever visible, but tweening both
    // keeps them in step so a flip mid-hover does not snap.
    [card, back].forEach((face) => {
      if (!face?.scene) return;
      this.tweens.add({
        targets: face, y: target, duration: CARD_LIFT_MS, ease: 'Power2',
        onUpdate: () => { face.y = Math.round(face.y); },
      });
    });
    [shine, view.faceShine].forEach((light) => {
      if (!light?.scene) return;
      this.tweens.add({
        targets: light, y: target, duration: CARD_LIFT_MS, ease: 'Power2',
        onUpdate: () => { light.y = Math.round(light.y); },
      });
    });
    // A built card sweeps the face-up light across its art on hover.
    const faceShine = view.faceShine;
    if (faceShine?.scene) {
      const flipping = back?.anims?.isPlaying;
      if (lifted && view.revealed && !flipping && this.anims.exists(FACE_SHINE_ANIM)) {
        faceShine.setVisible(true).play(FACE_SHINE_ANIM);
      } else {
        faceShine.stop();
        faceShine.setVisible(false);
      }
    }
    // The rank stars are painted onto the card, so they rise with it.
    view.stars.forEach((star) => {
      this.tweens.add({
        targets: star, y: target + STAR_DY, duration: CARD_LIFT_MS, ease: 'Power2',
        onUpdate: () => { star.y = Math.round(star.y); },
      });
    });
    this.setHoverSheet(view, lifted);
    // The brackets ride the lift with the card they frame.
    const corners = this.selectCorners;
    if (corners?.view === view && corners.container.scene) {
      this.tweens.add({
        targets: corners.container, y: target, duration: CARD_LIFT_MS, ease: 'Power2',
        onUpdate: () => { corners.container.y = Math.round(corners.container.y); },
      });
    }
    // The shadow stays put and softens instead of moving: the card is rising
    // off the board, not carrying its shadow with it.
    if (shadow?.scene) {
      this.tweens.add({
        targets: shadow, alpha: lifted ? 0.35 : 0.6,
        scaleX: lifted ? 1.08 : 1,
        duration: CARD_LIFT_MS, ease: 'Power2',
      });
    }
  }

  // A face-down card plays the hover sheet in place of its back. A face-up
  // card has no hover art of its own; it only lifts.
  setHoverSheet(view, on) {
    const { shine, back } = view;
    if (!shine?.scene) return;
    const flipping = back?.anims?.isPlaying;
    if (on && !view.revealed && !flipping && this.anims.exists(VILLAGE_HOVER_ANIM)) {
      back?.setVisible(false);
      shine.setVisible(true).play(VILLAGE_HOVER_ANIM);
      return;
    }
    if (shine.visible) {
      shine.stop();
      shine.setVisible(false);
      if (!view.revealed && !flipping) back?.setVisible(true);
    }
  }

  // Brackets around the selected card. Rebuilt on every refresh so they
  // always follow selectedId; the container starts at the card's current
  // height so a click on a lifted card does not drop them to rest.
  drawSelectCorners() {
    if (this.selectCorners) {
      this.selectCorners.container.destroy();
      this.selectCorners = null;
    }
    const view = this.plotViews.find((v) => v.plot.id && v.plot.id === this.selectedId);
    if (!view) return;
    const x = view.card.x;
    const y = view.lifted ? view.restY - CARD_LIFT : view.restY;
    const sprites = createSelectionCorners(this, 0, 0, CORNER_OFFSET);
    if (!sprites.length) return;
    const container = this.add.container(x, y, sprites).setDepth(16);
    this.selectCorners = { view, container };
  }

  // Show one star per bought rank, centred on the card as a group. Hidden
  // whenever the face is, so a face-down or mid-flip card shows none.
  layoutRankStars(view) {
    const { stars, card, plot } = view;
    if (!stars.length || !card?.scene) return;
    const count = Math.min(stars.length, Math.max(0, this.meta.getBuildingRank(plot.id)));
    const width = STAR_SIZE + STAR_STEP * (count - 1);
    const left = card.x - width / 2 + STAR_SIZE / 2;
    stars.forEach((star, i) => {
      star.x = Math.round(left + i * STAR_STEP);
      star.setVisible(card.visible && i < count);
    });
  }

  // Turn a lot face up. The back plays the flip and hands over to the
  // building art on the frame the card is edge-on, so the swap is hidden.
  revealCard(view) {
    const { card, back } = view;
    if (view.revealed) return;
    view.revealed = true;
    if (!back?.scene || !this.anims.exists(VILLAGE_FLIP_ANIM)) {
      card?.setVisible(true);
      back?.setVisible(false);
      this.layoutRankStars(view);
      return;
    }
    SoundHelper.playSound(this, 'card_flip', 0.45);
    this.setHoverSheet(view, false);
    view.faceShine?.stop();
    view.faceShine?.setVisible(false);
    card.setVisible(false);
    // The stars belong to the face, so they wait out the flip with it.
    this.layoutRankStars(view);
    back.setVisible(true).play(VILLAGE_FLIP_ANIM);
    back.once('animationcomplete', () => {
      back.setVisible(false);
      back.setFrame(0);
      card.setVisible(true);
      this.layoutRankStars(view);
    });
  }

  // State without the animation, for the first draw of an already-built lot.
  setCardFace(view, faceUp) {
    view.revealed = faceUp;
    if (view.back?.anims?.isPlaying) return;
    view.card?.setVisible(faceUp);
    // While the hover sheet is standing in for the back, leave the back off.
    const hoverShowing = view.shine?.visible;
    if (view.back?.scene) view.back.setVisible(!faceUp && !hoverShowing).setFrame(0);
    if (faceUp && hoverShowing) this.setHoverSheet(view, false);
  }

  // Footer button from a painted up/down pair, drawn at the colour it was
  // painted. No tint: recolouring pixel art by multiply muddies it. The
  // buttons use the next-turn pair; Reset keeps its own pair so the
  // destructive one still stands apart.
  makeFooterButton(x, label, onClick, opts = {}) {
    const {
      danger = false, fontSize = '10px', upKey = 'nextTurnUp', downKey = 'nextTurnDown',
    } = opts;
    const hasArt = this.textures.exists(upKey);
    const bg = hasArt
      ? snapOriginToPixelGrid(this.add.image(x, FOOTER_Y, upKey))
      : this.add.rectangle(x, FOOTER_Y, 118, 30, 0x3d2418, 0.95).setStrokeStyle(1, 0xd4a017);
    bg.setDepth(50);

    const text = this.add.text(x, FOOTER_Y, label, {
      fontSize,
      fill: '#f4e2c2',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 104 },
    }).setOrigin(0.5).setDepth(51);
    // The buttons are painted onto the rail, so they arrive with it.
    this.introGroups.rail.push(bg, text);

    const setFrame = (down) => {
      if (!hasArt) return;
      const key = down ? downKey : upKey;
      if (this.textures.exists(key)) bg.setTexture(key);
      // The down art sits a pixel lower, so the label rides with it.
      text.y = FOOTER_Y + (down ? 1 : 0);
    };

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.3);
      if (hasArt) setHoverLight(bg, true);
    });
    bg.on('pointerout', () => {
      setFrame(false);
      setHoverLight(bg, false);
    });
    bg.on('pointerdown', () => setFrame(true));
    bg.on('pointerup', () => {
      setFrame(false);
      // Off on click too: a confirm modal or a scene change can take the
      // pointer away without a pointerout.
      setHoverLight(bg, false);
      SoundHelper.playVariant(this, 'button_click', 0.5);
      onClick();
    });

    return { bg, label: text, setAlpha: (a) => { bg.setAlpha(a); text.setAlpha(a); } };
  }

  confirmResetMetaProgression() {
    openConfirmModal(this, {
      title: t(this, 'ui.village.resetMetaTitle'),
      body: t(this, 'ui.village.resetMetaBody'),
      confirmLabel: t(this, 'ui.options.reset'),
      cancelLabel: t(this, 'ui.options.cancel'),
      onConfirm: () => {
        this.selectedId = null;
        this.meta.resetProgression();
        this.refresh();
      },
    });
  }

  tryBuild() {
    if (!this.selectedId) return;
    const result = this.meta.upgradeBuilding(this.characterId, this.selectedId);
    if (!result.ok) {
      SoundHelper.playVariant(this, 'hover_button', 0.2);
      return;
    }
    SoundHelper.playVariant(this, 'hover_button', 0.55);

    // A lot going from vacant to built turns face up. Later ranks are already
    // face up, so they just refresh.
    const view = this.plotViews.find((v) => v.plot.id === this.selectedId);
    const wasHidden = Boolean(view && !view.revealed);
    this.refresh();
    if (wasHidden && view) {
      // refresh() has already flipped the state flag to "built"; clear it so
      // revealCard plays the animation instead of treating the job as done.
      view.revealed = false;
      this.revealCard(view);
    }
  }

  // Pauses the village under the pause menu, as the rest room does.
  openOptions() {
    if (this.scene.isActive('PauseMenuScene')) return;
    this.scene.launch('PauseMenuScene', { pausedScene: this.scene.key });
    this.scene.pause();
  }

  leave() {
    // The music keeps going: Choose Your Road plays this same theme, and a
    // fade-out here made it start again from the top. That screen fades it
    // when the run actually begins.
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.input.enabled = false;
      this.scene.start('LocationPickScene', {
        mode: 'newRun',
        act: 1,
        characterId: this.characterId,
      });
    });
  }

  refresh() {
    this.plotViews.forEach((view) => {
      const { plot, card, name } = view;
      if (!plot.id) return;
      const built = this.meta.getBuildingRank(plot.id) > 0;
      name.setText(t(this, `village.${plot.id}.name`));
      // An unbuilt lot greys its name; the rank reads off the stars and the
      // selection off the brackets.
      name.setColor(built ? '#f2d3aa' : '#8b949e');
      if (!card?.scene) return;

      // Unbuilt lots sit face down; built ones show their building.
      // setCardFace leaves a flip that is mid-play alone, so a refresh during
      // the reveal does not snap the card to its end state.
      this.setCardFace(view, built);
      this.layoutRankStars(view);
    });
    this.drawSelectCorners();

    if (!this.selectedId) {
      this.detailTitle.setText('');
      this.detailBody.setText(t(this, 'ui.village.pickPlot'));
      this.buildLabel.setText(t(this, 'ui.village.build'));
      this.buildBtn.setAlpha(0.45);
      return;
    }

    const current = this.meta.getBuildingRank(this.selectedId);
    const check = this.meta.canUpgradeBuilding(this.characterId, this.selectedId);
    this.detailTitle.setText(t(this, `village.${this.selectedId}.name`));
    this.detailBody.setText(t(this, `village.${this.selectedId}.desc`));
    if (!check.ok && check.reason === 'max') {
      this.buildLabel.setText(t(this, 'ui.village.maxed'));
      this.buildBtn.setAlpha(0.45);
    } else if (!check.ok && check.reason === 'support') {
      this.buildLabel.setText(t(this, 'ui.village.need', { cost: check.cost }));
      this.buildBtn.setAlpha(0.7);
    } else {
      const verb = current <= 0 ? t(this, 'ui.village.build') : t(this, 'ui.village.upgrade');
      this.buildLabel.setText(`${verb}  ${check.cost}`);
      this.buildBtn.setAlpha(1);
    }
  }
}
