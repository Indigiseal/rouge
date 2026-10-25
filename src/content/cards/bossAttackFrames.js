// How a boss strikes. When it hits, its sprite swaps to its attack art for a
// moment, then back to its idle pose.
//
// Two kinds of attack art:
// - frame(): one attack picture (art: PixelLab, from the boss's own sprite).
// - sheet(): Taya's strips. Frame 0 is the idle pose and every frame after it is
//   the attack, played once, holding the last. The game counts the frames itself,
//   so any number works (the plan is five: idle and four attack frames). The
//   boss's idle picture is cut from frame 0.
//
// Each attack frame is the boss's idle canvas grown by padX on both sides and
// padTop on top, so the swing has room; the boss stands on the same pixels in both.

const frame = (key, file) => Object.freeze({
  key, path: `assets/art/bossAttack/${file}.png`, padX: 16, padTop: 24,
});

// `path`, `padX` and `padTop` override the bossAttack/ file and its usual padding.
// 11 frames a second: four attack frames take about a third of a second (Taya asked for quicker than 8).
const sheet = (key, file, { frameWidth, frameHeight, frameRate = 11, ...overrides }) => Object.freeze({
  ...frame(key, file), sheet: true, frameWidth, frameHeight, frameRate, ...overrides,
});

// Keyed by the boss's sprite key (content/cards/bosses.js), which is also the
// key its idle picture is built under from a sheet's frame 0.
export const BOSS_ATTACK_FRAMES = Object.freeze({
  // Sandscale Chieftain: the poses were drawn to share one canvas, so no padding.
  lizardBoss: sheet('LizardBossAttack', null,
    { frameWidth: 112, frameHeight: 144, path: 'assets/art/lizardBoss.png', padX: 0, padTop: 0 }),
  greenWarden: sheet('GreenWardenAttack', 'greenWardenAttack-Sheet', { frameWidth: 142, frameHeight: 132 }),
  SoulEater: sheet('SoulEaterAttack', 'soulEaterAttack-Sheet', { frameWidth: 144, frameHeight: 140 }),
  MireBride: sheet('MireBrideAttack', 'mireBrideAttackNoFloor-Sheet', { frameWidth: 156, frameHeight: 144 }),
  Cerberus: sheet('CerberusAttack', 'cerberusAttack-Sheet', { frameWidth: 154, frameHeight: 138 }),
  GoblinKingSprite: sheet('GoblinKingAttack', 'goblinKingAttack-Sheet', { frameWidth: 168, frameHeight: 156 }),
  giantSkeleton: sheet('GiantSkeletonAttack', 'giantSkeletonAttack-Sheet', { frameWidth: 131, frameHeight: 159 }),
  // Still one attack picture each, until their sheets are drawn.
  frostGiant: frame('FrostGiantAttack', 'frostGiantAttack'),
  SpiderQween: frame('SpiderQueenAttack', 'spiderQueenAttack'),
  Lich: frame('LichAttack', 'lichAttack'),
  AncientCerberus: frame('AncientCerberusAttack', 'ancientCerberusAttack'),
});

/** Boss sprite keys whose idle picture comes from their sheet, not a file of its own. */
export const SHEET_IDLE_KEYS = Object.freeze(
  Object.entries(BOSS_ATTACK_FRAMES).filter(([, f]) => f.sheet).map(([idleKey]) => idleKey),
);

export const BOSS_ATTACK_FRAME_FILES = Object.freeze(
  Object.values(BOSS_ATTACK_FRAMES).filter(({ path }) => path)
    .map(({ key, path, frameWidth, frameHeight }) => ({ key, path, frameWidth, frameHeight })),
);

// How many attack frames each sheet has (frames after the idle one), and the
// padding actually trimmed off its idle pose: at most padX/padTop, less where the
// idle art reaches into the padding, so no pixel is lost.
const ATTACK_FRAME_COUNT = new Map();
const SHEET_PAD = new Map();

function sheetFrameCount(scene, key) {
  return (scene.textures.get(key)?.frameTotal ?? 1) - 1; // frameTotal counts the whole-image __BASE frame
}

// How far frame 0's art stays clear of the left, right and top edges.
function idleMargins(scene, f) {
  const canvas = document.createElement('canvas');
  canvas.width = f.frameWidth; canvas.height = f.frameHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const f0 = scene.textures.getFrame(f.key, 0);
  ctx.drawImage(f0.source.image, f0.cutX, f0.cutY, f0.cutWidth, f0.cutHeight, 0, 0, f0.cutWidth, f0.cutHeight);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = canvas.width, top = canvas.height;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (!data[(y * canvas.width + x) * 4 + 3]) continue;
    left = Math.min(left, x); right = Math.min(right, canvas.width - 1 - x); top = Math.min(top, y);
  }
  return { left, right, top };
}

/** The padding between `f`'s idle and attack canvases. */
function padOf(f) {
  return SHEET_PAD.get(f.key) ?? { padX: f.padX, padTop: f.padTop };
}

/** Cut every sheet boss's idle picture from frame 0. Returns how many were built. */
export function buildBossPoseTextures(scene) {
  let built = 0;
  for (const [idleKey, f] of Object.entries(BOSS_ATTACK_FRAMES)) {
    if (!f.sheet || !scene.textures.exists(f.key)) continue;
    const count = sheetFrameCount(scene, f.key);
    ATTACK_FRAME_COUNT.delete(f.key);
    SHEET_PAD.delete(f.key);
    if (count < 2) {
      console.warn(`${f.path}: ${count} frame(s) of ${f.frameWidth}x${f.frameHeight}; expected the idle pose and at least one attack frame`);
      continue;
    }
    ATTACK_FRAME_COUNT.set(f.key, count - 1);
    // Trim the padding, but never into the idle art. Both sides by the same amount,
    // so the boss stays centred on its slot.
    const margins = idleMargins(scene, f);
    const pad = { padX: Math.min(f.padX, margins.left, margins.right), padTop: Math.min(f.padTop, margins.top) };
    SHEET_PAD.set(f.key, pad);
    if (scene.textures.exists(idleKey)) scene.textures.remove(idleKey);
    const texture = scene.textures.createCanvas(idleKey, f.frameWidth - pad.padX * 2, f.frameHeight - pad.padTop);
    texture.drawFrame(f.key, 0, -pad.padX, -pad.padTop);
    texture.refresh();
    built++;
  }
  return built;
}

// How long a single attack picture stays up. A sheet instead shows each attack
// frame for one beat (1000 / frameRate ms), the last one included, then idles.
const BOSS_ATTACK_HOLD_MS = 1400;

function attackDurationMs(f) {
  if (!f.sheet) return BOSS_ATTACK_HOLD_MS;
  return (ATTACK_FRAME_COUNT.get(f.key) || 1) * 1000 / f.frameRate;
}

// Step a sheet's attack frames on a timer. The boss on the board is a plain
// Image, which cannot play a Phaser animation, so the frames are set by hand.
function playAttackFrames(scene, card, f) {
  const count = ATTACK_FRAME_COUNT.get(f.key) || 1;
  const sprite = card.sprite;
  card._attackStepTimers = [];
  for (let i = 2; i <= count; i++) {
    card._attackStepTimers.push(scene.time.delayedCall((i - 1) * 1000 / f.frameRate, () => {
      if (sprite.active && sprite.texture?.key === f.key) sprite.setFrame(i, false, false);
    }));
  }
}

function stopAttackFrames(card) {
  card._attackStepTimers?.forEach(timer => timer?.remove?.(false));
  card._attackStepTimers = null;
}

// Phaser keeps the origin as a fraction, so swapping textures leaves float dust
// (59.000000000000014) that builds up over many attacks. Anchors are whole or half pixels.
const halfPixel = (v) => Math.round(v * 2) / 2;

/** Shows `card`'s attack, if its boss has one. Returns whether it did. */
export function showBossAttackFrame(scene, card) {
  const sprite = card?.sprite;
  const restKey = card?.data?.sprite;
  const f = BOSS_ATTACK_FRAMES[restKey];
  if (!f || !sprite?.active || !scene?.textures?.exists?.(f.key)) return false;

  card._attackFrameTimer?.remove?.(false);
  stopAttackFrames(card);
  const { padX, padTop } = padOf(f);
  if (sprite.texture?.key !== f.key) {
    // Keep the boss's own origin pixel under the same screen spot.
    const ox = sprite.displayOriginX;
    const oy = sprite.displayOriginY;
    if (f.sheet) sprite.setTexture(f.key, 1);
    else sprite.setTexture(f.key);
    sprite.setDisplayOrigin(halfPixel(ox + padX), halfPixel(oy + padTop));
  } else if (f.sheet) {
    // Struck again mid-swing: start the swing over.
    sprite.setFrame?.(1, false, false);
  }
  if (f.sheet) playAttackFrames(scene, card, f);
  card._attackFrameTimer = scene.time.delayedCall(attackDurationMs(f), () => {
    card._attackFrameTimer = null;
    stopAttackFrames(card);
    if (!sprite.active || sprite.texture?.key !== f.key) return;
    const ox = sprite.displayOriginX - padX;
    const oy = sprite.displayOriginY - padTop;
    sprite.setTexture(restKey);
    sprite.setDisplayOrigin(halfPixel(ox), halfPixel(oy));
  });
  return true;
}
