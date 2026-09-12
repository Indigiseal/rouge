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
const NEST_W = 220;
const NEST_H = 150;

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

function ensureNestTextures(scene) {
  if (!scene?.textures || scene.textures.exists('birdNestBowl')) return;

  const make = (key, w, h, draw) => {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  make('birdNestBowl', 240, 168, (g) => {
    g.fillStyle(0x3a2414, 1);
    g.fillEllipse(120, 88, 230, 155);
    g.fillStyle(0x5a3820, 1);
    g.fillEllipse(120, 84, 210, 138);
    g.fillStyle(0x2a180c, 1);
    g.fillEllipse(120, 90, 168, 100);
    g.lineStyle(3, 0x6a4a28, 1);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(120 + Math.cos(a) * 70, 88 + Math.sin(a) * 46);
      g.lineTo(120 + Math.cos(a) * 112, 88 + Math.sin(a) * 74);
      g.strokePath();
    }
  });

  make('birdNestShadow', 120, 48, (g) => {
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(60, 24, 118, 40);
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(60, 24, 80, 22);
  });
}

// nestMiniGame is 8 frames of 32x32. Frame 0 is the cog — the prize — so the
// junk is frames 1..7: feather, spectacles, twig bundle, tusk, acorns, grass
// tuft, mossy stone. The radius is the piece's own silhouette rather than the
// 32px cell, so a thin feather does not bury the egg the way a twig bundle does.
const COG_FRAME = 0;
const NEST_JUNK_FRAMES = [
  { frame: 1, r: 13 },  // feather
  { frame: 2, r: 11 },  // spectacles
  { frame: 3, r: 14 },  // twig bundle
  { frame: 4, r: 13 },  // tusk
  { frame: 5, r: 13 },  // acorns
  { frame: 6, r: 12 },  // grass tuft
  { frame: 7, r: 10 },  // mossy stone
];

// Ten pieces over two prizes, so some frames repeat. Ordered rather than
// random: the same nest every time is easier to tune than a lucky one.
const JUNK = [
  NEST_JUNK_FRAMES[2], NEST_JUNK_FRAMES[0], NEST_JUNK_FRAMES[4],
  NEST_JUNK_FRAMES[5], NEST_JUNK_FRAMES[1], NEST_JUNK_FRAMES[3],
  NEST_JUNK_FRAMES[6], NEST_JUNK_FRAMES[2], NEST_JUNK_FRAMES[4],
  NEST_JUNK_FRAMES[0],
];


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

  const nest = push(scene.add.image(cx, cy + 18, 'birdNestBowl'));
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

  const nestLeft = cx - NEST_W / 2 + 18;
  const nestRight = cx + NEST_W / 2 - 18;
  const nestTop = cy + 18 - NEST_H / 2 + 22;
  const nestBot = cy + 18 + NEST_H / 2 - 18;
  const junkLeft = cx - panelW / 2 + 28;
  const junkRight = cx + panelW / 2 - 28;
  const junkTop = cy - panelH / 2 + 64;
  const junkBot = cy + panelH / 2 - 52;

  const clampInNest = (x, y) => ({
    x: Phaser.Math.Clamp(x, nestLeft, nestRight),
    y: Phaser.Math.Clamp(y, nestTop, nestBot),
  });
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

  // The egg is its own 45x48 image; the cog is frame 0 of the junk sheet. They
  // sit further apart than the old generated pair, because both are bigger now.
  addPiece('egg', { key: 'eggMiniGame' }, cx - (includeCog ? 30 : 0), cy + 20, 20, false);
  if (includeCog) {
    addPiece('cog', { key: 'nestMiniGame', frame: COG_FRAME }, cx + 34, cy + 30, 15, false);
  }

  // Two loose rows across the bowl's dark inner floor. The old spots were
  // tuned for the generated junk, which was much smaller than these 32px
  // pieces; kept that tight, the nest read as a bare ring around one clump.
  const junkSpots = [
    [cx - 58, cy + 6], [cx - 30, cy + 12], [cx - 2, cy + 2],
    [cx + 24, cy + 10], [cx + 54, cy + 6],
    [cx - 60, cy + 38], [cx - 32, cy + 42], [cx - 4, cy + 32],
    [cx + 26, cy + 40], [cx + 56, cy + 32],
  ];
  junkSpots.forEach((spot, i) => {
    const def = JUNK[i % JUNK.length];
    const jitter = clampInNest(spot[0] + rand(-8, 8), spot[1] + rand(-6, 6));
    addPiece('junk', { key: 'nestMiniGame', frame: def.frame }, jitter.x, jitter.y, def.r, true);
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
    let fromY = cy + 18;
    let toX = cx;
    let toY = cy + 18;
    let rot = 0;
    if (side === 0) {
      fromX = cx - span;
      toX = cx + span;
      fromY = cy + 18 + jitter;
      toY = cy + 18 - jitter;
    } else if (side === 1) {
      fromX = cx + span;
      toX = cx - span;
      fromY = cy + 18 + jitter;
      toY = cy + 18 - jitter;
      rot = Math.PI;
    } else if (side === 2) {
      fromY = cy + 18 - 110;
      toY = cy + 18 + 110;
      fromX = cx + jitter;
      toX = cx - jitter;
      rot = Math.PI / 2;
    } else {
      fromY = cy + 18 + 110;
      toY = cy + 18 - 110;
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
