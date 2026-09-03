// Lock-wafer overlay for The Broken Music Box (Force it open).
// Complementary pairs seat a pin; matching the detonator pair detonates.
// After each attempt, three face-down wafers rotate so positions cannot be memorized.

import { SoundHelper } from '../audio/SoundHelper.js';
import { snapOriginToPixelGrid } from './PixelSnap.js';
import { cameraWorldSize } from '../config/renderScale.js';
import { t } from '../i18n/i18n.js';

const DEPTH = 3500;
const COLS = 5;
const ROWS = 2;
const TILE_W = 58;
const TILE_H = 72;
const GAP = 8;
const SAFE_PAIR_COUNT = 4;
const MISMATCH_MS = 700;
const FINISH_MS = 650;
const SCRAMBLE_MS = 340;
const SHEET_KEY = 'musicBoxLockWafers';

const PAIR_DEFS = Object.freeze([
  { id: 'pin', kind: 'pin', charge: false, frameA: 1, frameB: 2 },
  { id: 'ward', kind: 'ward', charge: false, frameA: 3, frameB: 4 },
  { id: 'cog', kind: 'cog', charge: false, frameA: 5, frameB: 6 },
  { id: 'comb', kind: 'comb', charge: false, frameA: 7, frameB: 8 },
  { id: 'charge', kind: 'charge', charge: true, frameA: 9, frameB: 9 },
]);

const FRAME_BACK = 0;
const FRAME_FIT_A = 5;
const FRAME_FIT_B = 6;
const FRAME_CHARGE = 9;

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function hasSheet(scene) {
  return Boolean(scene?.textures?.exists?.(SHEET_KEY));
}

function faceFrame(tile) {
  return tile.half === 'b' ? tile.frameB : tile.frameA;
}

/**
 * @param {Phaser.Scene} scene
 * @param {{ onDone: (won: boolean) => void }} cfg
 * @returns {{ close: () => void } | null}
 */
export function openMusicBoxLockMinigame(scene, cfg) {
  if (!scene || typeof cfg?.onDone !== 'function') return null;
  if (scene._musicBoxLockMinigameOpen) return null;
  scene._musicBoxLockMinigameOpen = true;

  const nodes = [];
  const push = (obj) => { nodes.push(obj); return obj; };
  let closed = false;
  let phase = 'brief';
  let busy = false;
  let picked = [];
  let seated = 0;
  let statusText = null;
  const tiles = [];
  const briefNodes = [];
  const useSheet = hasSheet(scene);

  const cam = scene.cameras?.main;
  // Viewport in world units, not device pixels — see cameraWorldSize.
  const { width: w, height: h } = cameraWorldSize(cam);
  const cx = w / 2;
  const cy = h / 2;

  const close = () => {
    if (closed) return;
    closed = true;
    scene.events?.off?.('shutdown', close);
    for (const n of nodes) {
      try { n.destroy?.(); } catch (_) { /* already gone */ }
    }
    scene._musicBoxLockMinigameOpen = false;
  };

  const finish = (won) => {
    if (phase === 'done') return;
    phase = 'done';
    busy = true;
    statusText?.setText(t(scene, won ? 'ui.musicBox.success' : 'ui.musicBox.detonated'));
    statusText?.setColor(won ? '#7ee787' : '#ff7b72');
    scene.time?.delayedCall?.(FINISH_MS, () => {
      close();
      cfg.onDone(won);
    });
  };

  scene.events?.once?.('shutdown', close);

  const veil = push(scene.add.rectangle(cx, cy, w + 4, h + 4, 0x000000, 0.78));
  veil.setDepth(DEPTH).setInteractive();

  const gridW = COLS * TILE_W + (COLS - 1) * GAP;
  const gridH = ROWS * TILE_H + (ROWS - 1) * GAP;
  const panelW = Math.max(440, gridW + 40);
  const panelH = gridH + 128;
  const panel = push(scene.add.rectangle(cx, cy - 4, panelW, panelH, 0x1a1420, 0.96));
  panel.setStrokeStyle(2, 0xc9a227).setDepth(DEPTH + 1);

  push(scene.add.text(cx, cy - panelH / 2 + 16, t(scene, 'ui.musicBox.title'), {
    fontSize: '16px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#f0e6d2',
  }).setOrigin(0.5).setDepth(DEPTH + 2));

  const addBrief = (obj) => {
    briefNodes.push(obj);
    return push(obj);
  };

  const wafer = (x, y, frame, tint) => {
    if (!useSheet) {
      const fallback = addBrief(scene.add.rectangle(x, y, 40, 50, 0x4a3424, 1));
      fallback.setStrokeStyle(1, tint || 0xc9a227).setDepth(DEPTH + 4);
      return fallback;
    }
    const image = addBrief(scene.add.image(x, y, SHEET_KEY, frame));
    image.setScale(0.72);
    if (tint) image.setTint(tint);
    image.setDepth(DEPTH + 4);
    snapOriginToPixelGrid(image);
    return image;
  };

  addBrief(scene.add.text(cx, cy - panelH / 2 + 38, t(scene, 'ui.musicBox.brief'), {
    fontSize: '11px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ffe8b0',
    wordWrap: { width: panelW - 28 },
    align: 'center',
  }).setOrigin(0.5).setDepth(DEPTH + 2));

  const pairY = cy - 18;
  const detY = cy + 48;
  wafer(cx - 78, pairY, FRAME_FIT_A);
  wafer(cx - 28, pairY, FRAME_FIT_B);
  addBrief(scene.add.text(cx + 52, pairY, t(scene, 'ui.musicBox.safePairs'), {
    fontSize: '11px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#7ee787',
    align: 'left',
  }).setOrigin(0, 0.5).setDepth(DEPTH + 3));

  wafer(cx - 78, detY, FRAME_CHARGE, 0xff8866);
  wafer(cx - 28, detY, FRAME_CHARGE, 0xff8866);
  addBrief(scene.add.text(cx + 52, detY, t(scene, 'ui.musicBox.detonators'), {
    fontSize: '11px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ff7b72',
    align: 'left',
  }).setOrigin(0, 0.5).setDepth(DEPTH + 3));

  const beginBg = addBrief(scene.add.rectangle(cx, cy + panelH / 2 - 22, 120, 24, 0x2a2030, 1));
  beginBg.setStrokeStyle(2, 0xc9a227).setDepth(DEPTH + 5);
  beginBg.setInteractive({ useHandCursor: true });
  const beginLabel = addBrief(scene.add.text(cx, cy + panelH / 2 - 22, t(scene, 'ui.musicBox.begin'), {
    fontSize: '12px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#f0e6d2',
  }).setOrigin(0.5).setDepth(DEPTH + 6));

  const clearBrief = () => {
    for (const n of briefNodes) {
      try { n.destroy?.(); } catch (_) { /* already gone */ }
    }
    briefNodes.length = 0;
  };

  const startPlay = () => {
    if (phase !== 'brief') return;
    phase = 'play';
    clearBrief();
    SoundHelper.playVariant(scene, 'button_click', 0.5);

    push(scene.add.text(cx, cy - panelH / 2 + 34, t(scene, 'ui.musicBox.instructions'), {
      fontSize: '10px',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      color: '#c9b48a',
      wordWrap: { width: panelW - 28 },
      align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH + 2));

    statusText = push(scene.add.text(cx, cy + panelH / 2 - 16, t(scene, 'ui.musicBox.ready'), {
      fontSize: '11px',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      color: '#ffe8b0',
      wordWrap: { width: panelW - 28 },
      align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH + 3));

    const deck = shuffle(PAIR_DEFS.flatMap((def) => ([
      { pairId: def.id, kind: def.kind, charge: def.charge, half: 'a', frameA: def.frameA, frameB: def.frameB },
      { pairId: def.id, kind: def.kind, charge: def.charge, half: 'b', frameA: def.frameA, frameB: def.frameB },
    ])));

    const gridLeft = cx - gridW / 2 + TILE_W / 2;
    const gridTop = cy - 6 - gridH / 2 + TILE_H / 2;

    const slotXY = (index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      return {
        x: Math.round(gridLeft + col * (TILE_W + GAP)),
        y: Math.round(gridTop + row * (TILE_H + GAP)),
      };
    };

    const applyFrame = (image, frame) => {
      if (useSheet && typeof image.setFrame === 'function') image.setFrame(frame);
    };

    const setFace = (tile, faceUp) => {
      tile.faceUp = faceUp;
      if (phase !== 'done') tile.image.clearTint();
      applyFrame(tile.image, faceUp ? faceFrame(tile) : FRAME_BACK);
      snapOriginToPixelGrid(tile.image);
    };

    const flipTo = (tile, faceUp, onComplete) => {
      const img = tile.image;
      const done = typeof onComplete === 'function' ? onComplete : () => {};
      if (!scene.tweens?.add) {
        setFace(tile, faceUp);
        done();
        return;
      }
      scene.tweens.add({
        targets: img,
        scaleX: 0.02,
        duration: 90,
        onComplete: () => {
          setFace(tile, faceUp);
          scene.tweens.add({
            targets: img,
            scaleX: 1,
            duration: 90,
            onComplete: done,
          });
        },
      });
    };

    const clearPicked = () => {
      picked = [];
      busy = false;
    };

    const scrambleThree = (onDone) => {
      const done = typeof onDone === 'function' ? onDone : () => {};
      const pool = tiles.filter((tile) => !tile.seated && !tile.faceUp);
      if (pool.length < 3 || !scene.tweens?.add) {
        done();
        return;
      }
      const trio = shuffle(pool).slice(0, 3);
      const destSlots = [trio[1].slot, trio[2].slot, trio[0].slot];
      SoundHelper.playVariant(scene, 'card_place', 0.4);
      let left = 3;
      trio.forEach((tile, i) => {
        tile.image.clearTint();
        const dest = destSlots[i];
        const { x, y } = slotXY(dest);
        const fromX = tile.image.x;
        const fromY = tile.image.y;
        tile.slot = dest;
        tile.image.setDepth(DEPTH + 6);
        const fly = scene.tweens.addCounter
          ? scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: SCRAMBLE_MS,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
              const p = tween.getValue();
              tile.image.x = fromX + (x - fromX) * p;
              tile.image.y = fromY + (y - fromY) * p - Math.sin(p * Math.PI) * 14;
              snapOriginToPixelGrid(tile.image);
            },
            onComplete: () => {
              tile.image.x = x;
              tile.image.y = y;
              tile.image.setDepth(DEPTH + 4);
              snapOriginToPixelGrid(tile.image);
              left -= 1;
              if (left <= 0) done();
            },
          })
          : null;
        if (fly) return;
        scene.tweens.add({
          targets: tile.image,
          x,
          y,
          duration: SCRAMBLE_MS,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            tile.image.setDepth(DEPTH + 4);
            snapOriginToPixelGrid(tile.image);
            left -= 1;
            if (left <= 0) done();
          },
        });
      });
    };

    const afterAttempt = () => {
      if (phase !== 'play') return;
      scrambleThree(() => {
        if (phase === 'play') clearPicked();
      });
    };

    const onTile = (tile) => {
      if (phase !== 'play' || busy || tile.seated || tile.faceUp) return;
      SoundHelper.playVariant(scene, 'card_flip', 0.45);

      if (picked.length === 0) {
        busy = true;
        flipTo(tile, true, () => {
          picked = [tile];
          busy = false;
        });
        return;
      }

      const first = picked[0];
      if (first === tile) return;
      busy = true;
      flipTo(tile, true, () => {
        if (first.pairId === tile.pairId) {
          if (first.charge || tile.charge) {
            SoundHelper.playVariant(scene, 'player_hurt', 0.7);
            statusText.setText(t(scene, 'ui.musicBox.detonated'));
            statusText.setColor('#ff7b72');
            first.image.setTint(0xff6644);
            tile.image.setTint(0xff6644);
            finish(false);
            return;
          }
          first.seated = true;
          tile.seated = true;
          seated += 1;
          SoundHelper.playVariant(scene, 'anvil_upgrade', 0.5);
          statusText.setText(t(scene, 'ui.musicBox.pinSeated', { seated, total: SAFE_PAIR_COUNT }));
          statusText.setColor('#7ee787');
          if (seated >= SAFE_PAIR_COUNT) {
            finish(true);
            return;
          }
          afterAttempt();
          return;
        }

        SoundHelper.playVariant(scene, 'invalid_action', 0.45);
        statusText.setText(t(scene, 'ui.musicBox.noFit'));
        statusText.setColor('#ffe8b0');
        scene.time?.delayedCall?.(MISMATCH_MS, () => {
          if (phase !== 'play') return;
          let pending = 2;
          const flipped = () => {
            pending -= 1;
            if (pending <= 0) afterAttempt();
          };
          flipTo(first, false, flipped);
          flipTo(tile, false, flipped);
        });
      });
    };

    deck.forEach((spec, index) => {
      const { x, y } = slotXY(index);
      const image = useSheet
        ? push(scene.add.image(x, y, SHEET_KEY, FRAME_BACK))
        : push(scene.add.rectangle(x, y, TILE_W, TILE_H, 0x4a3424, 1));
      image.setDepth(DEPTH + 4);
      snapOriginToPixelGrid(image);
      image.setInteractive({ useHandCursor: true });
      const tile = {
        ...spec,
        image,
        slot: index,
        faceUp: false,
        seated: false,
      };
      image.on('pointerover', () => {
        if (phase !== 'play' || tile.seated || busy) return;
        image.setTint(0xffe0b0);
      });
      image.on('pointerout', () => {
        if (tile.seated || phase === 'done') return;
        image.clearTint();
      });
      image.on('pointerdown', () => onTile(tile));
      tiles.push(tile);
    });
  };

  const onBegin = () => {
    beginBg.disableInteractive();
    startPlay();
  };
  beginBg.on('pointerover', () => beginBg.setFillStyle(0x3a3040, 1));
  beginBg.on('pointerout', () => beginBg.setFillStyle(0x2a2030, 1));
  beginBg.on('pointerdown', onBegin);
  beginLabel.setInteractive({ useHandCursor: true });
  beginLabel.on('pointerdown', onBegin);

  return { close };
}
