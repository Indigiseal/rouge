// Nest raid overlay for Monster Bird Nest.
// Drag junk off the egg and/or brass cog. A bird-shadow sweeps the nest;
// holding junk under it costs time. 20 seconds, -5s per catch.

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';
import { snapOriginToPixelGrid } from './PixelSnap.js';
import { cameraWorldSize } from '../config/renderScale.js';
import {
  createNineSlicePanel,
  createUiBar,
  UI_BANNER_KEY,
  UI_PANEL_KEY,
  UI_PANEL_SLICE,
} from './NineSlicePanel.js';

const DEPTH = 3500;
const TIME_LIMIT = 20;

// Window furniture, measured off assets/ui/mockUpNestGame.png.
//
// bannerEvents.png is 256x48 and its ribbon is drawn in the top 39 rows, so
// placing the image 15px below the panel's top edge lands the ribbon 9px above
// it — overlapping the border the way the mock-up does. The title then sits
// 11px higher still, which is the middle of the ribbon's body rather than the
// middle of the image.
const BANNER_DY = 15;
const TITLE_DY = 4;
// shadowBird.png is 276x122. At 0.85 the wingspan is 235 against the bowl's
// 261 — big enough to read as a bird crossing the nest rather than a smear.
// Matching the old blob's footprint was the wrong target: that was a blur
// standing in for art, and at its size this silhouette is unreadable.
const SHADOW_SCALE = 0.85;
// The catch zone, as a fraction of the drawn silhouette's half-extents. Well
// under the bounding box, for two reasons. A spread bird is mostly empty air
// between the wing tips, so being clipped by the gap between primaries is not
// a fair catch; and it keeps the zone near the 151x57 the old blob used, so
// growing the bird for legibility does not quietly make the raid harder.
const SHADOW_CATCH = { w: 0.72, h: 0.62 };
// How far out a pass starts and ends. Both are past the edge of a 640x360
// screen, so the bird flies in from off-frame instead of appearing on top of
// the nest — there is no mask over the overlay, so wherever a pass begins is
// simply where the bird pops into existence.
const SHADOW_RUN_X = 380;
const SHADOW_RUN_Y = 250;
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

  // Window size and every anchor below are measured off assets/ui/mockUpNestGame.png.
  const panelW = 470;
  const panelH = 294;
  const panelTop = cy - panelH / 2;
  const panelBot = cy + panelH / 2;

  // Sliced art when it loaded, the old flat rectangle when it did not — the
  // minigame is still playable either way.
  const panel = push(createNineSlicePanel(scene, panelW, panelH, {
    key: UI_PANEL_KEY,
    slice: UI_PANEL_SLICE,
  }) || scene.add.rectangle(cx, cy, panelW, panelH, 0x1a1420, 0.96).setStrokeStyle(2, 0xc9a227));
  panel.setPosition(cx, cy);
  panel.setDepth(DEPTH + 1);

  // The ribbon straddles the panel's top edge, hanging its tails over the
  // border. It is drawn at its authored width and never sliced: the body
  // carries painted highlights that stretching would smear.
  if (scene.textures?.exists?.(UI_BANNER_KEY)) {
    const banner = push(scene.add.image(cx, panelTop + BANNER_DY, UI_BANNER_KEY));
    snapOriginToPixelGrid(banner);
    banner.setDepth(DEPTH + 2);
  }

  // Title sits above the banner's middle, not on it: the ribbon's body is the
  // top two thirds of the art and the tails hang below, so centring the text
  // on the image would drop it onto the fold.
  push(scene.add.text(cx, panelTop + TITLE_DY, t(scene, 'ui.birdNest.title'), {
    fontSize: '16px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#f0e6d2',
  }).setOrigin(0.5).setDepth(DEPTH + 3));

  push(scene.add.text(cx, panelTop + 34, includeCog
    ? t(scene, 'ui.birdNest.instructionsCog')
    : t(scene, 'ui.birdNest.instructionsEgg'), {
    fontSize: '10px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#c9b48a',
    wordWrap: { width: panelW - 24 },
    align: 'center',
  }).setOrigin(0.5).setDepth(DEPTH + 3));

  const barW = 296;
  const barH = 10;
  const barY = panelTop + 49;
  const bar = createUiBar(scene, barW);
  let barFill = null;
  if (bar) {
    push(bar.container);
    bar.container.setPosition(cx, barY).setDepth(DEPTH + 3);
  } else {
    push(scene.add.rectangle(cx, barY, barW + 4, barH + 4, 0x000000, 0.9).setDepth(DEPTH + 2));
    push(scene.add.rectangle(cx, barY, barW, barH, 0x2a2030, 1).setDepth(DEPTH + 3));
    barFill = push(scene.add.rectangle(cx - barW / 2, barY, barW, barH, 0xc9a227, 1));
    barFill.setOrigin(0, 0.5).setDepth(DEPTH + 4);
  }

  // Clear of the bar's right cap by the same gap the mock-up leaves.
  const timeText = push(scene.add.text(cx + barW / 2 + 20, barY, String(TIME_LIMIT), {
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

  const statusText = push(scene.add.text(cx, panelBot - 36, t(scene, 'ui.birdNest.status'), {
    fontSize: '10px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ffe8b0',
    wordWrap: { width: panelW - 24 },
    align: 'center',
  }).setOrigin(0.5).setDepth(DEPTH + 20));

  const runBg = push(scene.add.rectangle(cx, panelBot - 16, 89, 21, 0x2a2030, 1));
  runBg.setStrokeStyle(1, 0xc9a227).setDepth(DEPTH + 20);
  runBg.setInteractive({ useHandCursor: true });
  const runLabel = push(scene.add.text(cx, panelBot - 16, t(scene, 'ui.birdNest.run'), {
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
  const junkTop = panelTop + 64;
  const junkBot = panelBot - 52;

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

  shadow = push(scene.add.image(cx, cy, 'shadowBird'));
  shadow.setDepth(DEPTH + 200);
  shadow.setScale(SHADOW_SCALE);
  // Hidden between passes rather than dimmed: the art already carries the
  // opacity a shadow should have, so anything less than 1 while it is over the
  // nest would be washing out what was drawn.
  shadow.setAlpha(0);

  const shadowOverlapsHeld = () => {
    if (!held || held.taken || shadow.alpha < 0.2) return false;
    // Into the bird's own frame, then a plain ellipse test. The old version
    // switched between two axis-aligned ellipses depending on whether the pass
    // was roughly vertical, which could not describe a bird flying a diagonal —
    // and every pass is a slight diagonal, because the ends are jittered.
    const dx = held.image.x - shadow.x;
    const dy = held.image.y - shadow.y;
    const c = Math.cos(-shadow.rotation);
    const sn = Math.sin(-shadow.rotation);
    return ellipseContains(
      0,
      0,
      (shadow.displayWidth / 2) * SHADOW_CATCH.w,
      (shadow.displayHeight / 2) * SHADOW_CATCH.h,
      dx * c - dy * sn,
      dx * sn + dy * c,
    );
  };

  const applyCatch = () => {
    if (caughtThisPass || phase !== 'play') return;
    caughtThisPass = true;
    remaining = Math.max(0, remaining - CATCH_PENALTY);
    SoundHelper.playVariant(scene, 'player_hurt', 0.55);
    statusText.setText(t(scene, 'ui.birdNest.caught'));
    statusText.setColor('#ff7b72');
    setBarColor(0xff7b72);
    scene.tweens?.add?.({
      targets: bar ? bar.container : barFill,
      scaleY: 1.6,
      duration: 80,
      yoyo: true,
    });
  };

  // The sliced bar tints its filled pieces; the fallback rectangle restyles
  // itself. Null means "back to the art's own colour", which only the sliced
  // bar can express — the rectangle has no art, so it takes the old gold.
  const setBarColor = (color) => {
    if (bar) bar.setFillTint(color);
    else barFill?.setFillStyle(color ?? 0xc9a227, 1);
  };

  const layoutBar = () => {
    const t = Math.max(0, remaining) / TIME_LIMIT;
    if (bar) bar.setFraction(t);
    else barFill.width = Math.max(1, barW * t);
    // Once the bird has caught the player the bar stays red for the rest of
    // the pass; re-running the drain must not paint it gold again.
    if (!caughtThisPass) setBarColor(t < 0.22 ? 0xff7b72 : null);
    timeText.setText(String(Math.ceil(Math.max(0, remaining))));
  };

  const startShadowPass = () => {
    if (phase !== 'play' || closed) return;
    caughtThisPass = false;
    const side = Math.floor(Math.random() * 4);
    const jitter = rand(-36, 36);
    let fromX = cx;
    let fromY = nestY;
    let toX = cx;
    let toY = nestY;
    if (side === 0) {
      fromX = cx - SHADOW_RUN_X;
      toX = cx + SHADOW_RUN_X;
      fromY = nestY + jitter;
      toY = nestY - jitter;
    } else if (side === 1) {
      fromX = cx + SHADOW_RUN_X;
      toX = cx - SHADOW_RUN_X;
      fromY = nestY + jitter;
      toY = nestY - jitter;
    } else if (side === 2) {
      fromY = nestY - SHADOW_RUN_Y;
      toY = nestY + SHADOW_RUN_Y;
      fromX = cx + jitter;
      toX = cx - jitter;
    } else {
      fromY = nestY + SHADOW_RUN_Y;
      toY = nestY - SHADOW_RUN_Y;
      fromX = cx + jitter;
      toX = cx - jitter;
    }
    shadow.x = fromX;
    shadow.y = fromY;
    // Point the bird along the line it is actually travelling. The art faces
    // up, hence the quarter turn. Taken from the heading rather than the four
    // hardcoded angles the blob used, so the jittered ends read as a bird on a
    // slight diagonal instead of one flying sideways.
    shadow.rotation = Math.atan2(toY - fromY, toX - fromX) + Math.PI / 2;
    shadow.setAlpha(1);
    // Timed by speed, not by a flat duration: the vertical run is much shorter
    // than the horizontal one, and a fixed duration would have made the bird
    // crawl across one axis and bolt across the other.
    const dur = Math.hypot(toX - fromX, toY - fromY) / rand(0.48, 0.62);
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
