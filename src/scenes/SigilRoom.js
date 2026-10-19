// The Sigil Room: a TreasureScene with a statue instead of a chest
// (rewardMode 'sigil'). The sigil on offer sits on the statue's forehead; the
// player drags a weapon or armor card from the bag into its mouth, the statue
// bites, and the card comes back stamped. One sigil, no other loot. Leave
// works as in any chest room, stamped or not.
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
import { pickSigilStatue } from '../content/sigils/sigilStatues.js';

const STATUE_X = 320;
const STATUE_Y = 150;
// The sigil on offer, shown big above the statue: its icon at 3x (a whole
// number, so the pixels stay square) in a pulsing glow, with sparks rising.
const EMBLEM_Y = 82;
// The emblem's drawing fills about this many pixels, at a whole-number scale.
const EMBLEM_TARGET_PX = 24;
const EMBLEM_GLOW = 0xc58cff;
const SPARKS = 8;
const SPARK_STEP_MS = 120;
const TEXT_Y = 212;

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

// The floating emblem. Returns its parts and a stop() for the sparks.
function createEmblem(scene, def) {
  const glow = scene.add.graphics();
  const drawGlow = (strength) => {
    glow.clear();
    glow.fillStyle(EMBLEM_GLOW, 0.1 * strength);
    glow.fillCircle(STATUE_X, EMBLEM_Y, 22);
    glow.fillStyle(EMBLEM_GLOW, 0.2 * strength);
    glow.fillCircle(STATUE_X, EMBLEM_Y, 16);
  };
  drawGlow(1);
  const pulse = { s: 1 };
  const pulseTween = scene.tweens.add({
    targets: pulse, s: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    onUpdate: () => drawGlow(pulse.s),
  });

  const fit = iconFit(scene, def.frame);
  const scale = Math.max(2, Math.floor(EMBLEM_TARGET_PX / fit.size));
  const icon = scene.add.image(STATUE_X, EMBLEM_Y, SIGIL_ICONS_KEY, def.frame)
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
    spark.x = Math.round(STATUE_X + Math.cos(angle) * dist);
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
  const statue = pickSigilStatue();
  scene.sigilRoom = { sigilId, statueId: statue.id, stamped: false };

  createTitle(scene, 320, 20, t(scene, 'ui.sigilRoom.title'), { color: '#c58cff', fallbackSize: '24px' });
  scene.instructionText = scene.add.text(320, 46, t(scene, 'ui.sigilRoom.hint'), {
    fontSize: '14px', fill: '#fef0cf', fontFamily: '"HoMM Pixel"',
  }).setOrigin(0.5);

  const texture = scene.textures.exists(statue.key) ? statue.key : 'cardBack';
  const image = scene.add.image(STATUE_X, STATUE_Y, texture);
  const left = STATUE_X - image.width / 2;
  const top = STATUE_Y - image.height / 2;

  // The sigil: big above the statue, and small in the carved circle on its
  // forehead, glowing in time with the big one.
  let icon = null;
  let emblem = null;
  if (def && scene.textures.exists(SIGIL_ICONS_KEY)) {
    emblem = createEmblem(scene, def);
    const fit = iconFit(scene, def.frame);
    icon = scene.add.image(left + statue.forehead.x, top + statue.forehead.y, SIGIL_ICONS_KEY, def.frame)
      .setOrigin(fit.originX, fit.originY);
    scene.tweens.add({ targets: icon, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const name = translateItemName(scene, def?.name) || def?.name || sigilId;
  scene.add.text(320, TEXT_Y, name, {
    fontSize: '14px', fill: '#c58cff', fontFamily: '"HoMM Pixel"', stroke: '#1c130a', strokeThickness: 3,
  }).setOrigin(0.5);
  scene.add.text(320, TEXT_Y + 16, sigilLine(sigilId, 1, 'player'), {
    fontSize: '11px', fill: '#d6c2c1', fontFamily: '"HoMM Pixel"', align: 'center', wordWrap: { width: 380 },
  }).setOrigin(0.5, 0);

  const inv = scene.gameScene?.inventorySystem;
  if (inv) {
    inv.clearDropZones?.();
    inv.addDropZone(image, (slotIndex, cardData, cardSprite) => (
      stampCard(scene, { image, icon, emblem, statue, sigilId, name }, slotIndex, cardData, cardSprite)
    ), { sound: null, accepts: (card) => !scene.sigilRoom.stamped && canTakeSigil(card, sigilId) });
    // The bag lives in GameScene, under this room: without this, a card
    // dragged to the statue was drawn behind it. Same as the Mirror event.
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

// The drop handler: a card the sigil fits gets bitten and stamped.
function stampCard(scene, room, slotIndex, cardData, cardSprite) {
  const inv = scene.gameScene?.inventorySystem;
  const state = scene.sigilRoom;
  if (!inv || !cardData || state.stamped) return false;
  if (!canTakeSigil(cardData, room.sigilId)) {
    floatOver(scene, STATUE_X, STATUE_Y - 60, t(scene, 'ui.sigilRoom.refuse'), '#c45c45');
    return false;
  }

  state.stamped = true;
  inv.clearDropZones?.();
  inv.returnCardToSlot?.(slotIndex, cardSprite);

  // The bite: the jaw drops on the card and the stone jolts.
  const { image, icon } = room;
  SoundHelper.playVariant(scene, 'card_offered', 0.6);
  scene.tweens.add({
    targets: image, scaleY: 0.9, scaleX: 1.06, y: image.y + 4, duration: 90, yoyo: true, ease: 'Quad.easeIn',
    onYoyo: () => {
      scene.cameras.main.shake(120, 0.006);
      SoundHelper.playVariant(scene, 'armor_break', 0.45);
    },
  });
  if (icon) {
    scene.tweens.killTweensOf(icon);
    scene.tweens.add({ targets: icon, alpha: 0.15, duration: 300 });
  }
  // The big emblem goes down into the card it was bitten onto.
  if (room.emblem) {
    const { glow, icon: big, sparks } = room.emblem;
    room.emblem.stop();
    scene.tweens.killTweensOf(big);
    scene.tweens.add({ targets: [glow, sparks], alpha: 0, duration: 250 });
    const slot = inv.slotSprites?.[slotIndex]?.card;
    scene.tweens.add({
      targets: big,
      x: Math.round(slot?.x ?? big.x),
      y: Math.round(slot?.y ?? big.y + 160),
      duration: 380,
      delay: 120,
      ease: 'Quad.easeIn',
      onUpdate: () => big.setPosition(Math.round(big.x), Math.round(big.y)),
      onComplete: () => {
        big.destroy();
        inv.sparkleAtSlot?.(slotIndex);
      },
    });
  }

  addSigil(cardData, room.sigilId);
  noteSigilTaken(scene.gameState, room.sigilId);
  inv.rebuildInventorySprites?.();
  scene.gameScene?.updateUI?.();
  recordHumanRunEvent(scene, 'sigil_taken', {
    source: 'sigil_room',
    sigil: room.sigilId,
    statue: room.statue.id,
    card: snapshotHumanRunCard(cardData),
  });

  const cardName = translateItemName(scene, cardData) || cardData.name || '';
  scene.instructionText?.setText(t(scene, 'ui.sigilRoom.stamped', { sigil: room.name, card: cardName }));
  return true;
}
