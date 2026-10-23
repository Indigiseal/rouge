// The Sigil Room: a TreasureScene with a stamp instead of a chest
// (rewardMode 'sigil'). The stamp is the animal of the sigil's family (see
// content/sigils/sigilStamps.js) on its stone base; its sigil sits on the front
// stone face, with a small explanation tablet beside it. The player drags a
// weapon or armor card from the bag onto
// the stone slab under the stamp. The stamp lifts, slams down, the room
// rumbles and dust falls from the ceiling, and the card flies back to the bag
// with the sigil on it. One sigil, no other loot. Leave works as in any chest
// room, stamped or not.
//
// Reached from a fight with an elite (SIGIL_ROOM_CHANCE of the time, see
// GameScene.pickEliteRewardMode) and from the secret sigil vault on the map.
import { SoundHelper } from '../audio/SoundHelper.js';
import { createTitle } from '../ui/titleText.js';
import { t, translateDescription, translateItemName } from '../i18n/i18n.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../systems/HumanRunRecorder.js';
import {
  SIGIL_ICONS_KEY, addSigil, canTakeSigil, getSigil, noteSigilTaken, sigilIconArt,
} from '../content/sigils/sigils.js';
import { SIGIL_ROOM_FLOOR, stampForSigil } from '../content/sigils/sigilStamps.js';
import { sigilCornerOffset } from '../ui/SigilIcons.js';
import { createCardFlightVisual, flyCardToBag } from '../ui/RewardFlight.js';
import { createNineSlicePanel } from '../ui/NineSlicePanel.js';

// A compact explanation tablet beside the stamp.
const PANEL_X = 274;
const PANEL_TOP = 110;
const PANEL_WIDTH = 152;
const PANEL_HEIGHT = 132;
const NAME_Y = 128;
const RULE_Y = 148;
const RULE_WIDTH = 120;
const EMBLEM_TARGET_PX = 20;
const EMBLEM_GLOW = 0xc58cff;
// Centre of the recessed face, measured up from each stamp's bottom edge.
const EMBLEM_FACE_HEIGHT = { lion: 28, turtle: 28, toad: 29, cobra: 25, deer: 28 };
// The stamp (drawn standing on its bottom edge) and the slab under it.
const STAMP_X = 420;
const STAMP_BOTTOM = 182;
const SLAB_Y = 224;
// The dais under both: its bottom edge just above the bag (which starts
// around y 266), so the slab sits on its inner circle.
const FLOOR_BOTTOM = 264;
// Match the anvil's native 69x89 animated outline without stretching its pixels.
const SLAB_W = 68;
const SLAB_H = 88;
// The slam: up this far, then down onto the card.
const LIFT_PX = 12;
const PRESS_PX = 12;
const DUST_BITS = 44;
const DUST_COLORS = [0x9a9187, 0x6f6a63, 0xc9bfae, 0x847b70];

// Sigil icons are drawn small in one corner of their 16px frame (they sit in
// a card's corner). Measure the drawing so it can be centred, and scaled up
// by its own size rather than the frame's.
function iconFit(scene, key, frame) {
  const f = scene.textures.getFrame(key, frame);
  const w = f?.width || 16;
  const h = f?.height || 16;
  let minX = w; let minY = h; let maxX = -1; let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((scene.textures.getPixelAlpha(x, y, key, frame) || 0) > 0) {
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

// The mark is inlaid in the stamp's stone face and travels with its slam.
function createEmblem(scene, def, stampImage, stamp) {
  const glow = scene.add.graphics();
  glow.fillStyle(EMBLEM_GLOW, 0.18);
  glow.fillCircle(0, 0, 13);
  const art = sigilIconArt(def, scene.textures);
  const fit = iconFit(scene, art.key, art.frame);
  const scale = Math.max(1, Math.floor(EMBLEM_TARGET_PX / fit.size));
  const icon = scene.add.image(0, 0, art.key, art.frame)
    .setOrigin(fit.originX, fit.originY).setScale(scale);
  const mark = scene.add.container(0, 0, [glow, icon]).setDepth(stampImage.depth + 1);
  const sync = () => mark.setPosition(stampImage.x, stampImage.y - EMBLEM_FACE_HEIGHT[stamp.id]);
  sync();
  stampImage.once('destroy', () => mark.destroy());
  return { mark, sync, consume: () => mark.setVisible(false) };
}

// The same invitation as the anvil: light the slab while considering or
// carrying a card that can receive this sigil. Rebind after bag redraws.
function bindDropHint(scene, inv, sigilId) {
  if (!scene.textures.exists('anvilDropAnim')) return () => {};
  if (!scene.anims.exists('anvil_drop_loop')) {
    scene.anims.create({
      key: 'anvil_drop_loop',
      frames: scene.anims.generateFrameNumbers('anvilDropAnim', { start: 0, end: 6 }),
      frameRate: 14, repeat: -1,
    });
  }
  const hint = scene.add.sprite(STAMP_X, SLAB_Y, 'anvilDropAnim', 0).setDepth(1).setVisible(false);
  scene.sigilDropAnimation = hint;
  const hide = () => { if (hint.scene) hint.stop().setVisible(false); };
  const bindings = new Map();
  const bind = () => {
    for (const [card] of bindings) if (!card.scene) bindings.delete(card);
    [...inv.slotSprites, { card: scene.gameScene?.armorPanelEquippedSprite }].forEach((slot, index) => {
      const card = slot?.card;
      if (!card?.scene || bindings.has(card)) return;
      const show = () => {
        const data = index === inv.slotSprites.length ? scene.gameState.equippedArmor : inv.slots[index];
        if (!scene.sigilRoom.stamped && canTakeSigil(data, sigilId) && !hint.visible) {
          hint.setVisible(true).play('anvil_drop_loop');
        }
      };
      const out = () => {
        if (inv._liveDrag?.cardSprite !== card && inv.dragOverlay?.cardSprite !== card) hide();
      };
      card.on('pointerover', show);
      card.on('pointerout', out);
      card.on('dragstart', show);
      card.on('dragend', hide);
      card.once('destroy', hide);
      bindings.set(card, { show, out });
    });
  };
  bind();
  scene.events.on('update', bind);
  const release = () => {
    scene.events.off('update', bind);
    for (const [card, { show, out }] of bindings) {
      card.off('pointerover', show);
      card.off('pointerout', out);
      card.off('dragstart', show);
      card.off('dragend', hide);
      card.off('destroy', hide);
    }
    bindings.clear();
    hide();
  };
  scene.events.once('shutdown', release);
  scene.events.once('sleep', release);
  return hide;
}

/** Builds the room in `scene` (a TreasureScene) for `sigilId`. */
export function createSigilRoom(scene, sigilId) {
  const def = getSigil(sigilId);
  const stamp = stampForSigil(sigilId);
  scene.sigilRoom = { sigilId, stampId: stamp.id, stamped: false };

  // The heading's ribbon (packed with the other banners). Its band is rows 11-40 of the
  // image, so the title sits at y 26; the hint keeps its place just under it.
  if (scene.textures.exists('sigilBanner')) scene.add.image(320, 0, 'sigilBanner').setOrigin(0.5, 0);
  createTitle(scene, 320, scene.textures.exists('sigilBanner') ? 26 : 20, t(scene, 'ui.sigilRoom.title'), { color: '#c58cff', fallbackSize: '24px' });
  scene.instructionText = scene.add.text(320, 46, t(scene, 'ui.sigilRoom.hint'), {
    fontSize: '14px', fill: '#fef0cf', fontFamily: '"HoMM Pixel"',
  }).setOrigin(0.5);

  const name = translateItemName(scene, def?.name) || def?.name || sigilId;
  scene.sigilNameText = scene.add.text(PANEL_X, NAME_Y, name, {
    fontSize: '11px', fill: '#c58cff', fontFamily: '"HoMM Pixel"', stroke: '#1c130a', strokeThickness: 2,
    align: 'center', wordWrap: { width: RULE_WIDTH },
  }).setOrigin(0.5);
  scene.sigilRuleText = scene.add.text(PANEL_X, RULE_Y, translateDescription(scene, def?.player || ''), {
    fontSize: '9px', fill: '#f2e6d2', fontFamily: '"HoMM Pixel"', align: 'center', wordWrap: { width: RULE_WIDTH },
  }).setOrigin(0.5, 0);
  if (scene.sigilRuleText.height > PANEL_TOP + PANEL_HEIGHT - RULE_Y - 22) {
    scene.sigilRuleText.setFontSize('8px');
  }
  // Keep the tablet compact; longer translations can use a little more height.
  scene.sigilRuleText.setY(Math.max(RULE_Y, scene.sigilNameText.getBounds().bottom + 8));
  const panelHeight = Math.max(PANEL_HEIGHT, scene.sigilRuleText.y + scene.sigilRuleText.height + 22 - PANEL_TOP);
  scene.sigilInfoPanel = createNineSlicePanel(scene, PANEL_WIDTH, panelHeight, {
    key: 'sigilStonePanel', slice: { left: 16, right: 16, top: 14, bottom: 22 },
  });
  scene.sigilInfoPanel?.setPosition(PANEL_X, PANEL_TOP + panelHeight / 2).setDepth(-1);


  // The dais, the slab the card goes on, then the stamp standing over it.
  if (scene.textures.exists(SIGIL_ROOM_FLOOR.key)) {
    scene.add.image(STAMP_X, FLOOR_BOTTOM, SIGIL_ROOM_FLOOR.key).setOrigin(0.5, 1);
  }
  const slab = scene.add.rectangle(STAMP_X, SLAB_Y, SLAB_W, SLAB_H, 0x000000, 0.55)
    .setStrokeStyle(1, 0xa78f70);
  const texture = scene.textures.exists(stamp.key) ? stamp.key : 'cardBack';
  const image = scene.add.image(STAMP_X, STAMP_BOTTOM, texture).setOrigin(0.5, 1).setDepth(5);
  const emblem = def && scene.textures.exists(SIGIL_ICONS_KEY) ? createEmblem(scene, def, image, stamp) : null;

  const inv = scene.gameScene?.inventorySystem;
  if (inv) {
    const hideDropHint = bindDropHint(scene, inv, sigilId);
    inv.clearDropZones?.();
    const offer = (slotIndex, cardData, cardSprite) => {
      const accepted = stampCard(scene, { image, emblem, stamp, sigilId, name }, slotIndex, cardData, cardSprite);
      if (accepted) hideDropHint();
      return accepted;
    };
    const accepts = (card) => !scene.sigilRoom.stamped && canTakeSigil(card, sigilId);
    inv.addDropZone(slab, offer, { sound: null, accepts });
    const armorTarget = {
      accepts,
      onDrop: (card, sprite) => accepts(card) && sprite?.scene
        && Phaser.Geom.Intersects.RectangleToRectangle(sprite.getBounds(), slab.getBounds())
        && offer(-1, card, sprite),
    };
    inv.equippedArmorDropTarget = armorTarget;
    // The bag lives in GameScene, under this room: without this, a carried
    // card was drawn behind the room. Same as the Mirror event.
    inv.setDragOverlayScene?.(scene);
    const release = () => {
      inv.clearDropZones?.();
      inv.setDragOverlayScene?.(null);
      if (inv.equippedArmorDropTarget === armorTarget) inv.equippedArmorDropTarget = null;
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
  const card = slotIndex === -1 ? inv.scene?.armorPanelEquippedSprite : inv.slotSprites?.[slotIndex]?.card;
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
  cardSprite?.clearTint?.();
  // Copy it BEFORE it goes home: its pips and numbers follow the card one frame
  // late (ui/CardRiders.js), so once the card is back in its slot they are still
  // where the drag left them, and a copy taken then has them all misplaced.
  const copy = createCardFlightVisual(scene, cardSprite);
  if (slotIndex !== -1) inv.returnCardToSlot?.(slotIndex, cardSprite);
  copy?.setPosition(Math.round(dropX), Math.round(dropY)).setDepth(4);
  setBagCardAlpha(inv, slotIndex, 0);
  if (copy) scene.tweens.add({ targets: copy, x: STAMP_X, y: SLAB_Y, duration: 120, ease: 'Quad.easeOut' });
  SoundHelper.playVariant(scene, 'card_offered', 0.6);

  const { image } = room;
  const rest = STAMP_BOTTOM;
  const snap = () => {
    image.setY(Math.round(image.y));
    room.emblem?.sync();
  };
  // Lift, hold, slam.
  scene.tweens.chain({
    targets: image,
    tweens: [
      { y: rest - LIFT_PX, duration: 260, delay: 150, ease: 'Sine.easeOut', onUpdate: snap },
      { y: rest - LIFT_PX, duration: 180 },
      {
        y: rest + PRESS_PX, duration: 90, ease: 'Quad.easeIn', onUpdate: snap,
        onComplete: () => {
          room.emblem?.consume();
          scene.cameras.main.shake(260, 0.012);
          SoundHelper.playVariant(scene, 'armor_break', 0.6);
          playImpactPuff(scene, STAMP_X, rest + PRESS_PX);
          playCeilingDust(scene);
          if (copy) {
            copy.setTintFill(0xffffff);
            scene.time.delayedCall(90, () => copy.scene && copy.clearTint());
            const corner = sigilCornerOffset(cardSprite?.displayWidth || 52, cardSprite?.displayHeight || 70);
            const def = getSigil(room.sigilId);
            if (def && scene.textures.exists(SIGIL_ICONS_KEY)) {
              const markArt = sigilIconArt(def, scene.textures);
              const mark = scene.add.image(copy.x + corner.x, copy.y + corner.y, markArt.key, markArt.frame).setDepth(4.5);
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
