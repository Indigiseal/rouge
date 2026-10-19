// The Sigil Room: a TreasureScene with a stamp instead of a chest
// (rewardMode 'sigil'). The stamp is the animal of the sigil's family (see
// content/sigils/sigilStamps.js) on its stone base; what it gives floats in a
// panel beside it. The player drags a weapon or armor card from the bag onto
// the stone slab under the stamp. The stamp lifts, slams down, the room
// rumbles and dust falls from the ceiling, and the card flies back to the bag
// with the sigil on it. One sigil, no other loot. Leave works as in any chest
// room, stamped or not.
//
// Reached from a fight with an elite (SIGIL_ROOM_CHANCE of the time, see
// GameScene.pickEliteRewardMode) and from the secret sigil vault on the map.
import { SoundHelper } from '../audio/SoundHelper.js';
import { createTitle } from '../ui/titleText.js';
import { t, translateItemName } from '../i18n/i18n.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../systems/HumanRunRecorder.js';
import {
  SIGIL_ICONS_KEY, addSigil, canTakeSigil, getSigil, noteSigilTaken, sigilLine,
} from '../content/sigils/sigils.js';
import { SIGIL_ROOM_FLOOR, stampForSigil } from '../content/sigils/sigilStamps.js';
import { sigilCornerOffset } from '../ui/SigilIcons.js';
import { flyCardToBag } from '../ui/RewardFlight.js';

// The info panel: family, the sigil big, its name and rule.
const PANEL_X = 170;
const FAMILY_Y = 84;
const EMBLEM_Y = 120;
const NAME_Y = 156;
const RULE_Y = 172;
const RULE_WIDTH = 200;
// The emblem's drawing fills about this many pixels, at a whole-number scale.
const EMBLEM_TARGET_PX = 24;
const EMBLEM_GLOW = 0xc58cff;
const SPARKS = 8;
const SPARK_STEP_MS = 120;
// The stamp (drawn standing on its bottom edge) and the slab under it.
const STAMP_X = 380;
const STAMP_BOTTOM = 182;
const SLAB_Y = 224;
// The dais under both: its bottom edge just above the bag (which starts
// around y 266), so the slab sits on its inner circle.
const FLOOR_BOTTOM = 264;
const SLAB_W = 62;
const SLAB_H = 80;
// The slam: up this far, then down onto the card.
const LIFT_PX = 12;
const PRESS_PX = 12;
const DUST_BITS = 44;
const DUST_COLORS = [0x9a9187, 0x6f6a63, 0xc9bfae, 0x847b70];

// Sigil icons are drawn small in one corner of their 16px frame (they sit in
// a card's corner). Measure the drawing so it can be centred, and scaled up
// by its own size rather than the frame's.
function iconFit(scene, frame) {
  const f = scene.textures.getFrame(SIGIL_ICONS_KEY, frame);
  const w = f?.width || 16;
  const h = f?.height || 16;
  let minX = w; let minY = h; let maxX = -1; let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((scene.textures.getPixelAlpha(x, y, SIGIL_ICONS_KEY, frame) || 0) > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { originX: 0.5, originY: 0.5, size: Math.max(w, h) };
  return {
    originX: (minX + maxX + 1) / 2 / w,
    originY: (minY + maxY + 1) / 2 / h,
    size: Math.max(maxX - minX + 1, maxY - minY + 1),
  };
}

// The floating emblem in the panel. Returns its parts and a stop().
function createEmblem(scene, def) {
  const glow = scene.add.graphics();
  const drawGlow = (strength) => {
    glow.clear();
    glow.fillStyle(EMBLEM_GLOW, 0.1 * strength);
    glow.fillCircle(PANEL_X, EMBLEM_Y, 22);
    glow.fillStyle(EMBLEM_GLOW, 0.2 * strength);
    glow.fillCircle(PANEL_X, EMBLEM_Y, 16);
  };
  drawGlow(1);
  const pulse = { s: 1 };
  const pulseTween = scene.tweens.add({
    targets: pulse, s: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    onUpdate: () => drawGlow(pulse.s),
  });

  const fit = iconFit(scene, def.frame);
  const scale = Math.max(2, Math.floor(EMBLEM_TARGET_PX / fit.size));
  const icon = scene.add.image(PANEL_X, EMBLEM_Y, SIGIL_ICONS_KEY, def.frame)
    .setOrigin(fit.originX, fit.originY)
    .setScale(scale);
  // A slow bob, in whole pixels.
  const bob = { y: 0 };
  const bobTween = scene.tweens.add({
    targets: bob, y: -3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    onUpdate: () => icon.setY(EMBLEM_Y + Math.round(bob.y)),
  });

  // Sparks: 2x2 pixels drifting up around it, stepped like the fire reach.
  const sparks = scene.add.graphics();
  const spawn = (spark = {}) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 10;
    spark.x = Math.round(PANEL_X + Math.cos(angle) * dist);
    spark.y = Math.round(EMBLEM_Y + Math.sin(angle) * dist * 0.7);
    spark.age = Math.floor(Math.random() * 8);
    return spark;
  };
  const list = Array.from({ length: SPARKS }, () => spawn());
  const timer = scene.time.addEvent({
    delay: SPARK_STEP_MS,
    loop: true,
    callback: () => {
      sparks.clear();
      for (const spark of list) {
        spark.age++;
        if (spark.age >= 8) spawn(spark);
        sparks.fillStyle(spark.age < 4 ? 0xfef0cf : EMBLEM_GLOW, 1 - spark.age / 8);
        sparks.fillRect(spark.x, spark.y - spark.age, 2, 2);
      }
    },
  });

  return {
    glow, icon, sparks,
    stop() {
      timer.remove(false);
      pulseTween.remove();
      bobTween.remove();
      sparks.clear();
    },
  };
}

/** Builds the room in `scene` (a TreasureScene) for `sigilId`. */
export function createSigilRoom(scene, sigilId) {
  const def = getSigil(sigilId);
  const stamp = stampForSigil(sigilId);
  scene.sigilRoom = { sigilId, stampId: stamp.id, stamped: false };

  createTitle(scene, 320, 20, t(scene, 'ui.sigilRoom.title'), { color: '#c58cff', fallbackSize: '24px' });
  scene.instructionText = scene.add.text(320, 46, t(scene, 'ui.sigilRoom.hint'), {
    fontSize: '14px', fill: '#fef0cf', fontFamily: '"HoMM Pixel"',
  }).setOrigin(0.5);

  // What it gives: the family, the sigil big, its name and rule.
  scene.add.text(PANEL_X, FAMILY_Y, t(scene, `ui.sigilRoom.family.${stamp.id}`), {
    fontSize: '12px', fill: '#d6c2c1', fontFamily: '"HoMM Pixel"',
  }).setOrigin(0.5);
  const emblem = def && scene.textures.exists(SIGIL_ICONS_KEY) ? createEmblem(scene, def) : null;
  const name = translateItemName(scene, def?.name) || def?.name || sigilId;
  scene.add.text(PANEL_X, NAME_Y, name, {
    fontSize: '14px', fill: '#c58cff', fontFamily: '"HoMM Pixel"', stroke: '#1c130a', strokeThickness: 3,
  }).setOrigin(0.5);
  scene.add.text(PANEL_X, RULE_Y, sigilLine(sigilId, 1, 'player'), {
    fontSize: '11px', fill: '#d6c2c1', fontFamily: '"HoMM Pixel"', align: 'center', wordWrap: { width: RULE_WIDTH },
  }).setOrigin(0.5, 0);

  // The dais, the slab the card goes on, then the stamp standing over it.
  if (scene.textures.exists(SIGIL_ROOM_FLOOR.key)) {
    scene.add.image(STAMP_X, FLOOR_BOTTOM, SIGIL_ROOM_FLOOR.key).setOrigin(0.5, 1);
  }
  const slab = scene.add.rectangle(STAMP_X, SLAB_Y, SLAB_W, SLAB_H, 0x000000, 0.55)
    .setStrokeStyle(1, 0xa78f70);
  const texture = scene.textures.exists(stamp.key) ? stamp.key : 'cardBack';
  const image = scene.add.image(STAMP_X, STAMP_BOTTOM, texture).setOrigin(0.5, 1).setDepth(5);

  const inv = scene.gameScene?.inventorySystem;
  if (inv) {
    inv.clearDropZones?.();
    inv.addDropZone(slab, (slotIndex, cardData, cardSprite) => (
      stampCard(scene, { image, emblem, stamp, sigilId, name }, slotIndex, cardData, cardSprite)
    ), { sound: null, accepts: (card) => !scene.sigilRoom.stamped && canTakeSigil(card, sigilId) });
    // The bag lives in GameScene, under this room: without this, a carried
    // card was drawn behind the room. Same as the Mirror event.
    inv.setDragOverlayScene?.(scene);
    const release = () => {
      inv.clearDropZones?.();
      inv.setDragOverlayScene?.(null);
    };
    scene.events.once('shutdown', release);
    scene.events.once('sleep', release);
  }

  scene.createStationContinueButton(595, 50, t(scene, 'ui.hud.leave'), () => scene.returnToMap());
}

function floatOver(scene, x, y, text, color) {
  const label = scene.add.text(x, y, text, {
    fontSize: '12px', fill: color, fontFamily: '"HoMM Pixel"', stroke: '#1c130a', strokeThickness: 3,
    align: 'center', wordWrap: { width: 260 },
  }).setOrigin(0.5).setDepth(3000);
  scene.tweens.add({ targets: label, y: y - 18, alpha: 0, delay: 900, duration: 600, onComplete: () => label.destroy() });
}

// The bag card and everything riding it, shown or hidden together.
function setBagCardAlpha(inv, slotIndex, alpha) {
  const card = inv.slotSprites?.[slotIndex]?.card;
  if (!card?.scene) return;
  const riders = card.getData?.('cardRiders');
  [card, card.getData?.('infoText'), ...(riders ? [...riders.values()].map((r) => r.object) : [])]
    .forEach((o) => o?.setAlpha?.(alpha));
}

// Dust and small stones shaken loose from the ceiling: whole-pixel bits.
function playCeilingDust(scene) {
  for (let i = 0; i < DUST_BITS; i++) {
    const stone = i % 7 === 0;
    const size = stone ? 3 : 2;
    const bit = scene.add.rectangle(
      Math.round(40 + Math.random() * 560), Math.round(-4 - Math.random() * 20),
      size, size, DUST_COLORS[i % DUST_COLORS.length], 1,
    ).setDepth(2900);
    scene.tweens.add({
      targets: bit,
      y: Math.round(90 + Math.random() * 170),
      alpha: 0,
      delay: Math.random() * 260,
      duration: (stone ? 520 : 900) + Math.random() * 500,
      ease: 'Quad.easeIn',
      onUpdate: () => bit.setPosition(Math.round(bit.x), Math.round(bit.y)),
      onComplete: () => bit.destroy(),
    });
  }
}

// A puff of dust squeezed out from under the stamp, both sides.
function playImpactPuff(scene, x, y) {
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const bit = scene.add.rectangle(x + side * 26, y, 2, 2, DUST_COLORS[i % DUST_COLORS.length], 1).setDepth(2900);
    scene.tweens.add({
      targets: bit,
      x: x + side * (34 + Math.random() * 22),
      y: y - 4 - Math.random() * 16,
      alpha: 0,
      duration: 380 + Math.random() * 240,
      ease: 'Quad.easeOut',
      onUpdate: () => bit.setPosition(Math.round(bit.x), Math.round(bit.y)),
      onComplete: () => bit.destroy(),
    });
  }
}

// The drop handler: a card the sigil fits goes on the slab and is stamped.
function stampCard(scene, room, slotIndex, cardData, cardSprite) {
  const inv = scene.gameScene?.inventorySystem;
  const state = scene.sigilRoom;
  if (!inv || !cardData || state.stamped) return false;
  if (!canTakeSigil(cardData, room.sigilId)) {
    floatOver(scene, STAMP_X, STAMP_BOTTOM - 60, t(scene, 'ui.sigilRoom.refuse'), '#c45c45');
    return false;
  }

  state.stamped = true;
  inv.clearDropZones?.();
  // The real card goes home hidden; a copy of it lies on the slab.
  const dropX = cardSprite?.x ?? STAMP_X;
  const dropY = cardSprite?.y ?? SLAB_Y;
  const texKey = cardSprite?.texture?.key;
  const texFrame = cardSprite?.frame?.name;
  inv.returnCardToSlot?.(slotIndex, cardSprite);
  setBagCardAlpha(inv, slotIndex, 0);
  const copy = texKey && scene.textures.exists(texKey)
    ? scene.add.image(Math.round(dropX), Math.round(dropY), texKey, texFrame).setDepth(4)
    : null;
  if (copy) scene.tweens.add({ targets: copy, x: STAMP_X, y: SLAB_Y, duration: 120, ease: 'Quad.easeOut' });
  SoundHelper.playVariant(scene, 'card_offered', 0.6);

  // The emblem has done its job: it dims while the stamp works.
  if (room.emblem) {
    room.emblem.stop();
    scene.tweens.add({ targets: [room.emblem.glow, room.emblem.icon, room.emblem.sparks], alpha: 0.25, duration: 300 });
  }

  const { image } = room;
  const rest = STAMP_BOTTOM;
  const snap = () => image.setY(Math.round(image.y));
  // Lift, hold, slam.
  scene.tweens.chain({
    targets: image,
    tweens: [
      { y: rest - LIFT_PX, duration: 260, delay: 150, ease: 'Sine.easeOut', onUpdate: snap },
      { y: rest - LIFT_PX, duration: 180 },
      {
        y: rest + PRESS_PX, duration: 90, ease: 'Quad.easeIn', onUpdate: snap,
        onComplete: () => {
          scene.cameras.main.shake(260, 0.012);
          SoundHelper.playVariant(scene, 'armor_break', 0.6);
          playImpactPuff(scene, STAMP_X, rest + PRESS_PX);
          playCeilingDust(scene);
          if (copy) {
            copy.setTintFill(0xffffff);
            scene.time.delayedCall(90, () => copy.scene && copy.clearTint());
            const corner = sigilCornerOffset(copy.width || 52, copy.height || 70);
            const def = getSigil(room.sigilId);
            if (def && scene.textures.exists(SIGIL_ICONS_KEY)) {
              const mark = scene.add.image(copy.x + corner.x, copy.y + corner.y, SIGIL_ICONS_KEY, def.frame).setDepth(4.5);
              copy.once('destroy', () => mark.destroy());
            }
          }
        },
      },
      { y: rest + PRESS_PX, duration: 260 },
      {
        y: rest, duration: 320, ease: 'Back.easeOut', onUpdate: snap,
        onComplete: () => finishStamp(scene, room, inv, slotIndex, cardData, copy),
      },
    ],
  });
  return true;
}

// The sigil goes on the real card, and the card flies home from the slab.
function finishStamp(scene, room, inv, slotIndex, cardData, copy) {
  addSigil(cardData, room.sigilId);
  noteSigilTaken(scene.gameState, room.sigilId);
  inv.rebuildInventorySprites?.();
  scene.gameScene?.updateUI?.();
  recordHumanRunEvent(scene, 'sigil_taken', {
    source: 'sigil_room',
    sigil: room.sigilId,
    stamp: room.stamp.id,
    card: snapshotHumanRunCard(cardData),
  });
  const fromX = copy?.x ?? STAMP_X;
  const fromY = copy?.y ?? SLAB_Y;
  copy?.destroy();
  // The rebuilt card starts hidden by the flight and appears as it lands.
  flyCardToBag(scene, slotIndex, fromX, fromY);

  const cardName = translateItemName(scene, cardData) || cardData.name || '';
  scene.instructionText?.setText(t(scene, 'ui.sigilRoom.stamped', { sigil: room.name, card: cardName }));
}
