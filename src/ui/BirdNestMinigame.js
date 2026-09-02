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

function fillRound(g, x, y, w, h, r, color) {
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, w, h, r);
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

  make('birdNestEgg', 36, 44, (g) => {
    g.fillStyle(0x1a120c, 1);
    g.fillEllipse(18, 23, 34, 42);
    g.fillStyle(0xe8d8b0, 1);
    g.fillEllipse(18, 23, 28, 36);
    g.fillStyle(0xf4ead0, 1);
    g.fillEllipse(14, 16, 10, 12);
    g.fillStyle(0xc47a3a, 1);
    g.fillCircle(12, 22, 2);
    g.fillCircle(22, 28, 2);
    g.fillCircle(16, 32, 2);
  });

  make('birdNestCog', 34, 34, (g) => {
    g.fillStyle(0x1a120c, 1);
    g.fillCircle(17, 17, 16);
    g.fillStyle(0xc9a227, 1);
    g.fillCircle(17, 17, 14);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(17 + Math.cos(a) * 14, 17 + Math.sin(a) * 14, 4);
    }
    g.fillStyle(0xc9a227, 1);
    g.fillCircle(17, 17, 12);
    g.fillStyle(0x2a1c10, 1);
    g.fillCircle(17, 17, 5);
  });

  make('birdNestTwig', 52, 14, (g) => {
    g.fillStyle(0x6a4a28, 1);
    g.fillRoundedRect(0, 4, 52, 6, 2);
    g.fillStyle(0x8a6a40, 1);
    g.fillRoundedRect(1, 5, 50, 3, 2);
  });

  make('birdNestButton', 22, 22, (g) => {
    g.fillStyle(0x3a2a18, 1);
    g.fillCircle(11, 11, 10);
    g.fillStyle(0x8a3020, 1);
    g.fillCircle(11, 11, 8);
    g.fillStyle(0xf0d890, 1);
    g.fillCircle(8, 8, 2);
    g.fillCircle(14, 8, 2);
    g.fillCircle(8, 14, 2);
    g.fillCircle(14, 14, 2);
  });

  make('birdNestKey', 32, 16, (g) => {
    g.fillStyle(0xb08a40, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0x2a1c10, 1);
    g.fillCircle(8, 8, 3);
    g.fillRect(8, 6, 22, 4);
    g.fillRect(26, 6, 3, 8);
    g.fillRect(21, 6, 3, 6);
  });

  make('birdNestShell', 26, 20, (g) => {
    g.fillStyle(0xd4c4a0, 1);
    g.fillEllipse(13, 12, 24, 16);
    g.lineStyle(1, 0x8a7048, 1);
    g.beginPath();
    g.moveTo(13, 4);
    g.lineTo(6, 16);
    g.moveTo(13, 4);
    g.lineTo(20, 16);
    g.strokePath();
  });

  make('birdNestLeaf', 28, 18, (g) => {
    g.fillStyle(0x4a7040, 1);
    g.fillEllipse(14, 9, 26, 14);
    g.lineStyle(1, 0x2a4820, 1);
    g.beginPath();
    g.moveTo(2, 9);
    g.lineTo(26, 9);
    g.strokePath();
  });

  make('birdNestScrap', 24, 18, (g) => {
    fillRound(g, 1, 3, 22, 12, 2, 0x8a6a30);
    g.fillStyle(0xd4b060, 1);
    g.fillRect(3, 5, 18, 3);
  });

  make('birdNestStone', 18, 16, (g) => {
    g.fillStyle(0x5a5a58, 1);
    g.fillEllipse(9, 8, 16, 13);
    g.fillStyle(0x7a7a78, 1);
    g.fillEllipse(7, 6, 6, 5);
  });

  make('birdNestShadow', 120, 48, (g) => {
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(60, 24, 118, 40);
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(60, 24, 80, 22);
  });
}

const JUNK = [
  { key: 'birdNestTwig', r: 22 },
  { key: 'birdNestButton', r: 11 },
  { key: 'birdNestKey', r: 16 },
  { key: 'birdNestShell', r: 13 },
  { key: 'birdNestLeaf', r: 14 },
  { key: 'birdNestScrap', r: 12 },
  { key: 'birdNestStone', r: 9 },
  { key: 'birdNestTwig', r: 22 },
  { key: 'birdNestButton', r: 11 },
  { key: 'birdNestLeaf', r: 14 },
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

  const addPiece = (kind, key, x, y, r, draggable) => {
    const image = push(scene.add.image(x, y, key));
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

  addPiece('egg', 'birdNestEgg', cx - (includeCog ? 16 : 0), cy + 22, 16, false);
  if (includeCog) addPiece('cog', 'birdNestCog', cx + 22, cy + 28, 15, false);

  const junkSpots = [
    [cx - 36, cy + 8], [cx + 10, cy + 6], [cx + 40, cy + 24],
    [cx - 8, cy + 36], [cx - 48, cy + 30], [cx + 28, cy + 44],
    [cx - 20, cy + 48], [cx + 4, cy + 18], [cx - 52, cy + 14], [cx + 52, cy + 16],
  ];
  junkSpots.forEach((spot, i) => {
    const def = JUNK[i % JUNK.length];
    const jitter = clampInNest(spot[0] + rand(-8, 8), spot[1] + rand(-6, 6));
    addPiece('junk', def.key, jitter.x, jitter.y, def.r, true);
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
