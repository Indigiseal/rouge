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

const junkRadius = (frame) =>
  NEST_JUNK_FRAMES.find((j) => j.frame === frame)?.r || 12;

// --- Laying out a nest ------------------------------------------------------
// Every raid gets a different nest, but never an unfair one. Scattering eleven
// pieces at random is easy; the hard part is that a prize is only a puzzle
// while something is lying on it, and pure random regularly leaves the cog
// sitting in the open. So the prizes are placed first, cover is dealt onto
// them deliberately, and only the leftovers are scattered freely.

// Prizes roam most of the floor but keep clear of the rim: three pieces of
// cover have to fit in a ring around each one, and the egg's art is 45x48, so
// a prize pressed against the stones would push its own cover off the pebbles.
const PRIZE_AREA = { hx: 44, hy: 17 };
// Far enough apart that the egg and the cog never overlap each other.
const PRIZE_GAP = 36;
// Cover sits this far from a prize's centre. The ceiling is what matters: the
// loosest piece (r 11) covers a prize out to 18px by prizeCovered's own test,
// so 15 keeps every frame comfortably inside "buried" whichever one is dealt.
const COVER_MIN = 8;
const COVER_MAX = 15;
const COVERS_PER_PRIZE = 3;
// Junk pieces this close read as a stack rather than a scatter.
const MIN_JUNK_SEP = 17;
const PLAN_ATTEMPTS = 80;

function insideFloor(dx, dy) {
  const x = dx / NEST_FLOOR.hx;
  const y = dy / NEST_FLOOR.hy;
  return x * x + y * y <= 1;
}

function randomInEllipse(hx, hy) {
  // sqrt on the radius, or points bunch towards the centre.
  const a = rand(0, Math.PI * 2);
  const r = Math.sqrt(Math.random());
  // Rounded here, at the point of creation, so that every rule below is
  // checked against the whole-pixel position the piece will actually take.
  // Rounding afterwards let a piece that passed cleanly land a pixel over the
  // rim, or a hair inside its neighbour.
  return { dx: Math.round(r * hx * Math.cos(a)), dy: Math.round(r * hy * Math.sin(a)) };
}

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function farEnough(placed, dx, dy) {
  return placed.every((p) => Math.hypot(p.dx - dx, p.dy - dy) >= MIN_JUNK_SEP);
}

/**
 * One candidate nest, or null if this roll painted itself into a corner.
 * Cheap enough to simply throw away and roll again.
 */
function tryPlanNest(includeCog) {
  const egg = randomInEllipse(PRIZE_AREA.hx, PRIZE_AREA.hy);
  let cog = null;
  if (includeCog) {
    for (let i = 0; i < 30; i++) {
      const candidate = randomInEllipse(PRIZE_AREA.hx, PRIZE_AREA.hy);
      if (Math.hypot(candidate.dx - egg.dx, candidate.dy - egg.dy) >= PRIZE_GAP) {
        cog = candidate;
        break;
      }
    }
    if (!cog) return null;
  }

  const frames = shuffled(NEST_JUNK_FRAMES.map((j) => j.frame));
  const junk = [];

  // Cover, dealt around each prize at thirds of a circle so three pieces can
  // ring it without stacking on each other.
  for (const prize of [egg, cog]) {
    if (!prize) continue;
    const base = rand(0, Math.PI * 2);
    for (let k = 0; k < COVERS_PER_PRIZE; k++) {
      const angle = base + (k * Math.PI * 2) / COVERS_PER_PRIZE + rand(-0.4, 0.4);
      const reach = rand(COVER_MIN, COVER_MAX);
      const dx = Math.round(prize.dx + Math.cos(angle) * reach);
      const dy = Math.round(prize.dy + Math.sin(angle) * reach);
      if (!insideFloor(dx, dy) || !farEnough(junk, dx, dy)) return null;
      junk.push({ frame: frames[junk.length], dx, dy });
    }
  }

  // Everything left over goes wherever it fits.
  while (junk.length < frames.length) {
    let placed = false;
    for (let i = 0; i < 60 && !placed; i++) {
      const { dx, dy } = randomInEllipse(NEST_FLOOR.hx, NEST_FLOOR.hy);
      // Re-checked rather than trusted: randomInEllipse rounds to whole
      // pixels, which can carry a point that was inside the floor a pixel back
      // over the rim.
      if (!insideFloor(dx, dy) || !farEnough(junk, dx, dy)) continue;
      junk.push({ frame: frames[junk.length], dx, dy });
      placed = true;
    }
    if (!placed) return null;
  }

  // Everything is already on whole pixels — see randomInEllipse.
  return { egg, cog, junk };
}

/**
 * A nest, guaranteed. Rolls until one satisfies every rule; falls back to a
 * hand-checked layout on the vanishingly unlikely chance that none does, so a
 * bad run of dice can never hand the player an empty or unfair bowl.
 */
export function planNestLayout(includeCog = true) {
  for (let i = 0; i < PLAN_ATTEMPTS; i++) {
    const plan = tryPlanNest(includeCog);
    if (plan) return plan;
  }
  return {
    egg: { dx: -26, dy: -3 },
    cog: includeCog ? { dx: 34, dy: 9 } : null,
    junk: [
      { frame: 4, dx: -26, dy: -16 }, { frame: 1, dx: -40, dy: 4 },
      { frame: 9, dx: -12, dy: 9 }, { frame: 8, dx: 34, dy: -5 },
      { frame: 7, dx: 22, dy: 18 }, { frame: 3, dx: 46, dy: 14 },
      { frame: 5, dx: -4, dy: -24 }, { frame: 10, dx: 26, dy: -24 },
      { frame: 6, dx: 60, dy: -2 }, { frame: 11, dx: -58, dy: -6 },
      { frame: 2, dx: -2, dy: 25 },
    ],
  };
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

  // A fresh nest every raid. The prizes go down first so the junk that follows
  // is drawn — and stacked in prizeCovered's depth test — on top of them.
  const layout = planNestLayout(includeCog);

  // The egg is its own 45x48 image; the cog is frame 0 of the junk sheet.
  addPiece(
    'egg',
    { key: 'eggMiniGame' },
    floorX + layout.egg.dx,
    floorY + layout.egg.dy,
    20,
    false,
  );
  if (layout.cog) {
    addPiece(
      'cog',
      { key: 'nestMiniGame', frame: COG_FRAME },
      floorX + layout.cog.dx,
      floorY + layout.cog.dy,
      15,
      false,
    );
  }

  layout.junk.forEach((spot) => {
    addPiece(
      'junk',
      { key: 'nestMiniGame', frame: spot.frame },
      floorX + spot.dx,
      floorY + spot.dy,
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
