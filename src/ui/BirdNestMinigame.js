// Nest raid overlay for Monster Bird Nest.
// Drag junk off the egg and/or brass cog. A bird-shadow sweeps the nest;
// holding junk under it costs time. 20 seconds, -5s per catch.

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';
import { snapOriginToPixelGrid } from './PixelSnap.js';
import { cameraWorldSize } from '../config/renderScale.js';

const DEPTH = 3500;
const TIME_LIMIT = 20;
const SHADOW_SCALE = 1.3;
const CATCH_PENALTY = 5;
const CATCH_DRAIN = 2.4;
// The bowl art sits 10px below the panel's centre — far enough down to look
// seated, not so far that its rim reaches the status line beneath it.
const NEST_OFFSET_Y = 10;
// nest.png's pebbled floor, measured off the art: an ellipse 150x96 whose
// centre is 3px below the image's own middle. Pieces are placed inside a
// slightly tighter ellipse so a 32px piece leans on the stones rather than
// sitting on top of them.
const NEST_FLOOR = { dy: 3, hx: 62, hy: 34 };

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function ellipseContains(ex, ey, hw, hh, px, py) {
  const dx = (px - ex) / hw;
  const dy = (py - ey) / hh;
  return dx * dx + dy * dy <= 1;
}

function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

// The bird's shadow is the last thing here without art of its own.
function ensureNestTextures(scene) {
  if (!scene?.textures || scene.textures.exists('birdNestShadow')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x000000, 0.55);
  g.fillEllipse(60, 24, 118, 40);
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(60, 24, 80, 22);
  g.generateTexture('birdNestShadow', 120, 48);
  g.destroy();
}

// nestMiniGame is 12 frames of 32x32. Frame 0 is the cog — the prize — so the
// junk is frames 1..11. The radius is the piece's own silhouette rather than
// the 32px cell, so a leaf does not bury the egg the way a twig bundle does.
const COG_FRAME = 0;
const NEST_JUNK_FRAMES = [
  { frame: 1,  r: 12 },  // feather
  { frame: 2,  r: 11 },  // violet button
  { frame: 3,  r: 14 },  // twig bundle
  { frame: 4,  r: 13 },  // tusk
  { frame: 5,  r: 13 },  // acorns
  { frame: 6,  r: 12 },  // grass tuft
  { frame: 7,  r: 11 },  // green button
  { frame: 8,  r: 12 },  // brown leaf
  { frame: 9,  r: 13 },  // pale leaf
  { frame: 10, r: 13 },  // budded twig
  { frame: 11, r: 13 },  // river stone
];

// Eleven pieces, every frame exactly once. Positions are offsets from the
// CENTRE OF THE FLOOR, not from the panel, so moving the bowl carries the
// nest's contents with it.
//
// They are deliberate, not jittered. The old spots were nudged randomly at
// spawn, which was fine while the prizes sat under one heap — with the pieces
// spread over the whole floor a few pixels of drift is the difference between
// a buried cog and one sitting in plain sight. These are checked against
// prizeCovered's own overlap test rather than judged by eye: three pieces over
// the egg, three over the cog, every piece on the pebbled floor, and no two
// junk pieces closer than 18px.
const JUNK_LAYOUT = [
  // Three lying over the egg and three over the cog — a prize is only a puzzle
  // while something is on it.
  { frame: 4,  dx: -26, dy: -16 },
  { frame: 1,  dx: -40, dy:   4 },
  { frame: 9,  dx: -12, dy:   9 },
  { frame: 8,  dx:  34, dy:  -5 },
  { frame: 7,  dx:  22, dy:  18 },
  { frame: 3,  dx:  46, dy:  14 },
  // The rest scattered to the edges so the floor reads as a nest someone has
  // been hoarding in, rather than one heap in the middle of bare pebbles.
  { frame: 5,  dx:  -4, dy: -24 },
  { frame: 10, dx:  26, dy: -24 },
  { frame: 6,  dx:  60, dy:  -2 },
  { frame: 11, dx: -58, dy:  -6 },
  { frame: 2,  dx:  -2, dy:  25 },
];

// Both prizes, on the same floor-relative footing as the junk.
const EGG_SPOT = { dx: -26, dy: -3 };
const COG_SPOT = { dx: 34, dy: 9 };

const junkRadius = (frame) =>
  NEST_JUNK_FRAMES.find((j) => j.frame === frame)?.r || 12;

// Pulls a layout offset back onto the pebbled floor if it strays off it. Every
// position above is already inside; this is here so that editing one of them,
// or adding a piece, cannot quietly leave it sitting up on the rim stones.
function clampToFloor(dx, dy) {
  const k = Math.hypot(dx / NEST_FLOOR.hx, dy / NEST_FLOOR.hy);
  if (k <= 1) return { dx, dy };
  return { dx: Math.round(dx / k), dy: Math.round(dy / k) };
}


/**
 * @param {Phaser.Scene} scene
 * @param {{
 *   includeCog?: boolean,
 *   onDone: (result: { tookCog: boolean, tookEgg: boolean, timedOut: boolean }) => void,
 * }} cfg
 */
export function openBirdNestMinigame(scene, cfg) {
  if (!scene || typeof cfg?.onDone !== 'function') return null;
  if (scene._birdNestMinigameOpen) return null;
  scene._birdNestMinigameOpen = true;

  ensureNestTextures(scene);

  const includeCog = cfg.includeCog !== false;
  const nodes = [];
  const push = (obj) => { nodes.push(obj); return obj; };
  let closed = false;
  let phase = 'play';
  let remaining = TIME_LIMIT;
  let held = null;
  let nextDepth = 40;
  let caughtThisPass = false;
  let shadow = null;
  let shadowTween = null;
  let updateHandler = null;
  const pieces = [];

  const cam = scene.cameras?.main;
  // Viewport in world units, not device pixels — see cameraWorldSize.
  const { width: w, height: h } = cameraWorldSize(cam);
  const cx = w / 2;
  const cy = h / 2 - 6;

  const close = () => {
    if (closed) return;
    closed = true;
    if (updateHandler) scene.events?.off?.('update', updateHandler);
    if (shadowTween) {
      try { shadowTween.stop(); } catch (_) { /* gone */ }
    }
    for (const p of pieces) {
      try {
        scene.input?.setDraggable?.(p.image, false);
        p.image.disableInteractive();
      } catch (_) { /* gone */ }
    }
    for (const n of nodes) {
      try { n.destroy?.(); } catch (_) { /* gone */ }
    }
    scene._birdNestMinigameOpen = false;
  };

  const finish = (timedOut) => {
    if (phase === 'done') return;
    phase = 'done';
    const egg = pieces.find((p) => p.kind === 'egg');
    const cog = pieces.find((p) => p.kind === 'cog');
    close();
    cfg.onDone({
      tookCog: timedOut ? false : Boolean(cog?.taken),
      tookEgg: timedOut ? false : Boolean(egg?.taken),
      timedOut: Boolean(timedOut),
    });
  };

  scene.events?.once?.('shutdown', close);

  const veil = push(scene.add.rectangle(cx, cy + 6, w + 4, h + 4, 0x000000, 0.78));
  veil.setDepth(DEPTH).setInteractive();

  const panelW = 468;
  const panelH = 292;
  const panel = push(scene.add.rectangle(cx, cy, panelW, panelH, 0x1a1420, 0.96));
  panel.setStrokeStyle(2, 0xc9a227).setDepth(DEPTH + 1);

  push(scene.add.text(cx, cy - panelH / 2 + 14, t(scene, 'ui.birdNest.title'), {
    fontSize: '16px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#f0e6d2',
  }).setOrigin(0.5).setDepth(DEPTH + 2));

  push(scene.add.text(cx, cy - panelH / 2 + 32, includeCog
    ? t(scene, 'ui.birdNest.instructionsCog')
    : t(scene, 'ui.birdNest.instructionsEgg'), {
    fontSize: '10px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#c9b48a',
    wordWrap: { width: panelW - 24 },
    align: 'center',
  }).setOrigin(0.5).setDepth(DEPTH + 2));

  const barW = 280;
  const barH = 10;
  const barY = cy - panelH / 2 + 48;
  push(scene.add.rectangle(cx, barY, barW + 4, barH + 4, 0x000000, 0.9).setDepth(DEPTH + 2));
  const barTrack = push(scene.add.rectangle(cx, barY, barW, barH, 0x2a2030, 1).setDepth(DEPTH + 3));
  const barFill = push(scene.add.rectangle(cx - barW / 2, barY, barW, barH, 0xc9a227, 1));
  barFill.setOrigin(0, 0.5).setDepth(DEPTH + 4);

  const timeText = push(scene.add.text(cx + barW / 2 + 28, barY, String(TIME_LIMIT), {
    fontSize: '12px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ffe8b0',
  }).setOrigin(0.5).setDepth(DEPTH + 4));

  const nestY = cy + NEST_OFFSET_Y;
  // Centre of the pebbled floor: everything in the bowl is placed off this,
  // not off the panel, so the bowl and its contents move as one.
  const floorX = cx;
  const floorY = nestY + NEST_FLOOR.dy;
  const nest = push(scene.add.image(cx, nestY, 'nestBowl'));
  nest.setDepth(DEPTH + 5);
  snapOriginToPixelGrid(nest);

  const statusText = push(scene.add.text(cx, cy + panelH / 2 - 36, t(scene, 'ui.birdNest.status'), {
    fontSize: '10px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ffe8b0',
    wordWrap: { width: panelW - 24 },
    align: 'center',
  }).setOrigin(0.5).setDepth(DEPTH + 20));

  const runBg = push(scene.add.rectangle(cx, cy + panelH / 2 - 16, 88, 20, 0x2a2030, 1));
  runBg.setStrokeStyle(1, 0xc9a227).setDepth(DEPTH + 20);
  runBg.setInteractive({ useHandCursor: true });
  const runLabel = push(scene.add.text(cx, cy + panelH / 2 - 16, t(scene, 'ui.birdNest.run'), {
    fontSize: '11px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#f0e6d2',
  }).setOrigin(0.5).setDepth(DEPTH + 21));
  const onRun = () => {
    if (phase !== 'play') return;
    SoundHelper.playVariant(scene, 'button_click', 0.5);
    finish(false);
  };
  runBg.on('pointerover', () => runBg.setFillStyle(0x3a3040, 1));
  runBg.on('pointerout', () => runBg.setFillStyle(0x2a2030, 1));
  runBg.on('pointerdown', onRun);
  runLabel.setInteractive({ useHandCursor: true });
  runLabel.on('pointerdown', onRun);

  const junkLeft = cx - panelW / 2 + 28;
  const junkRight = cx + panelW / 2 - 28;
  const junkTop = cy - panelH / 2 + 64;
  const junkBot = cy + panelH / 2 - 52;

  const clampJunk = (x, y) => ({
    x: Phaser.Math.Clamp(x, junkLeft, junkRight),
    y: Phaser.Math.Clamp(y, junkTop, junkBot),
  });

  const addPiece = (kind, art, x, y, r, draggable) => {
    // `art` is a key, or a key plus a frame for anything off nestMiniGame.
    const image = push(art.frame === undefined
      ? scene.add.image(x, y, art.key)
      : scene.add.image(x, y, art.key, art.frame));
    image.setDepth(DEPTH + nextDepth);
    snapOriginToPixelGrid(image);
    const piece = {
      kind,
      image,
      r,
      draggable,
      taken: false,
      depth: DEPTH + nextDepth,
    };
    nextDepth += 1;
    if (draggable) {
      image.setInteractive({ useHandCursor: true });
      scene.input?.setDraggable?.(image, true);
      image.on('dragstart', () => {
        if (phase !== 'play' || piece.taken) return;
        nextDepth += 1;
        piece.depth = DEPTH + nextDepth;
        image.setDepth(piece.depth);
        held = piece;
      });
      image.on('drag', (pointer, dragX, dragY) => {
        if (phase !== 'play' || held !== piece) return;
        const pos = clampJunk(dragX, dragY);
        image.x = pos.x;
        image.y = pos.y;
        snapOriginToPixelGrid(image);
      });
      image.on('dragend', () => {
        if (held === piece) held = null;
      });
    } else {
      image.setInteractive({ useHandCursor: true });
      image.on('pointerdown', () => tryTake(piece));
    }
    pieces.push(piece);
    return piece;
  };

  const prizeCovered = (prize) => {
    if (prize.taken) return true;
    return pieces.some((other) => (
      other !== prize
      && !other.taken
      && other.draggable
      && other.depth > prize.depth
      && circlesOverlap(prize.image.x, prize.image.y, prize.r * 0.35, other.image.x, other.image.y, other.r)
    ));
  };

  const refreshPrizes = () => {
    for (const prize of pieces) {
      if (prize.draggable || prize.taken) continue;
      const covered = prizeCovered(prize);
      prize.image.clearTint();
      if (!covered) prize.image.setTint(0xfff0c0);
    }
  };

  const tryTake = (prize) => {
    if (phase !== 'play' || prize.taken || prize.draggable) return;
    if (prizeCovered(prize)) {
      statusText.setText(t(scene, 'ui.birdNest.buried'));
      SoundHelper.playVariant(scene, 'invalid_action', 0.4);
      return;
    }
    prize.taken = true;
    prize.image.disableInteractive();
    SoundHelper.playVariant(scene, 'gem_pickup', 0.55);
    scene.tweens?.add?.({
      targets: prize.image,
      alpha: 0,
      scale: 0.4,
      y: prize.image.y - 16,
      duration: 180,
    });
    if (prize.kind === 'cog') statusText.setText(t(scene, 'ui.birdNest.cogTaken'));
    else statusText.setText(t(scene, 'ui.birdNest.eggTaken'));
    refreshPrizes();
    const egg = pieces.find((p) => p.kind === 'egg');
    const cog = pieces.find((p) => p.kind === 'cog');
    const eggDone = !egg || egg.taken;
    const cogDone = !cog || cog.taken;
    if (eggDone && cogDone) {
      scene.time?.delayedCall?.(280, () => finish(false));
    }
  };

  // The egg is its own 45x48 image; the cog is frame 0 of the junk sheet.
  // With no cog to share the floor with, the egg takes the middle.
  addPiece(
    'egg',
    { key: 'eggMiniGame' },
    floorX + (includeCog ? EGG_SPOT.dx : 0),
    floorY + (includeCog ? EGG_SPOT.dy : 0),
    20,
    false,
  );
  if (includeCog) {
    addPiece(
      'cog',
      { key: 'nestMiniGame', frame: COG_FRAME },
      floorX + COG_SPOT.dx,
      floorY + COG_SPOT.dy,
      15,
      false,
    );
  }

  // Two loose rows across the bowl's dark inner floor. The old spots were
  // tuned for the generated junk, which was much smaller than these 32px
  // pieces; kept that tight, the nest read as a bare ring around one clump.
  //
  // Spreading them is not free, though: the prizes are only a puzzle while
  // something is lying on them. These positions put two pieces over the egg
  // and three over the cog — checked against prizeCovered's own overlap test,
  // not by eye — while leaving 19px between the nearest pair of junk pieces so
  // the nest still reads as scattered rather than piled.
  JUNK_LAYOUT.forEach((spot) => {
    const { dx, dy } = clampToFloor(spot.dx, spot.dy);
    addPiece(
      'junk',
      { key: 'nestMiniGame', frame: spot.frame },
      floorX + dx,
      floorY + dy,
      junkRadius(spot.frame),
      true,
    );
  });
  refreshPrizes();

  shadow = push(scene.add.image(cx, cy, 'birdNestShadow'));
  shadow.setDepth(DEPTH + 200);
  shadow.setScale(SHADOW_SCALE);
  shadow.setAlpha(0);
  snapOriginToPixelGrid(shadow);

  const shadowOverlapsHeld = () => {
    if (!held || held.taken || shadow.alpha < 0.2) return false;
    const vertical = Math.abs(Math.sin(shadow.rotation)) > 0.5;
    const longR = 58 * SHADOW_SCALE;
    const shortR = 22 * SHADOW_SCALE;
    return ellipseContains(
      shadow.x,
      shadow.y,
      vertical ? shortR : longR,
      vertical ? longR : shortR,
      held.image.x,
      held.image.y,
    );
  };

  const applyCatch = () => {
    if (caughtThisPass || phase !== 'play') return;
    caughtThisPass = true;
    remaining = Math.max(0, remaining - CATCH_PENALTY);
    SoundHelper.playVariant(scene, 'player_hurt', 0.55);
    statusText.setText(t(scene, 'ui.birdNest.caught'));
    statusText.setColor('#ff7b72');
    barFill.setFillStyle(0xff7b72, 1);
    scene.tweens?.add?.({
      targets: barFill,
      scaleY: 1.6,
      duration: 80,
      yoyo: true,
    });
  };

  const layoutBar = () => {
    const t = Math.max(0, remaining) / TIME_LIMIT;
    barFill.width = Math.max(1, barW * t);
    barFill.setFillStyle(t < 0.22 ? 0xff7b72 : 0xc9a227, 1);
    timeText.setText(String(Math.ceil(Math.max(0, remaining))));
  };

  const startShadowPass = () => {
    if (phase !== 'play' || closed) return;
    caughtThisPass = false;
    const side = Math.floor(Math.random() * 4);
    const span = 210;
    const jitter = rand(-36, 36);
    let fromX = cx;
    let fromY = nestY;
    let toX = cx;
    let toY = nestY;
    let rot = 0;
    if (side === 0) {
      fromX = cx - span;
      toX = cx + span;
      fromY = nestY + jitter;
      toY = nestY - jitter;
    } else if (side === 1) {
      fromX = cx + span;
      toX = cx - span;
      fromY = nestY + jitter;
      toY = nestY - jitter;
      rot = Math.PI;
    } else if (side === 2) {
      fromY = nestY - 110;
      toY = nestY + 110;
      fromX = cx + jitter;
      toX = cx - jitter;
      rot = Math.PI / 2;
    } else {
      fromY = nestY + 110;
      toY = nestY - 110;
      fromX = cx + jitter;
      toX = cx - jitter;
      rot = -Math.PI / 2;
    }
    shadow.x = fromX;
    shadow.y = fromY;
    shadow.rotation = rot;
    shadow.setAlpha(0.82);
    const dur = rand(620, 970);
    shadowTween = scene.tweens.add({
      targets: shadow,
      x: toX,
      y: toY,
      duration: dur,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        shadow.setAlpha(0);
        scene.time?.delayedCall?.(rand(100, 1000), startShadowPass);
      },
    });
  };

  layoutBar();
  scene.time?.delayedCall?.(400, startShadowPass);

  let lastStamp = scene.time?.now || Date.now();
  updateHandler = () => {
    if (phase !== 'play' || closed) return;
    const now = scene.time?.now || Date.now();
    const dt = Math.min(0.05, Math.max(0, (now - lastStamp) / 1000));
    lastStamp = now;
    const overlapping = shadowOverlapsHeld();
    if (overlapping) applyCatch();
    const rate = (overlapping && held) ? CATCH_DRAIN : 1;
    remaining -= dt * rate;
    layoutBar();
    refreshPrizes();
    if (remaining <= 0) finish(true);
  };
  scene.events?.on?.('update', updateHandler);

  return { close };
}
