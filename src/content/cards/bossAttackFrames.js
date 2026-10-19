// A boss's attack frame (art: PixelLab, from the boss's own sprite): one pose
// it strikes in. When the boss hits, its sprite swaps to this frame for a
// moment, then back.
//
// Each frame is the boss's canvas grown by padX on both sides and padTop on
// top, so the swing has room; the boss stands on the same pixels in both.

const frame = (key, file) => Object.freeze({
  key, path: `assets/art/bossAttack/${file}.png`, padX: 16, padTop: 24,
});

// Keyed by the boss's sprite key (content/cards/bosses.js).
export const BOSS_ATTACK_FRAMES = Object.freeze({
  GoblinKingSprite: frame('GoblinKingAttack', 'goblinKingAttack'),
  giantSkeleton: frame('GiantSkeletonAttack', 'giantSkeletonAttack'),
  greenWarden: frame('GreenWardenAttack', 'greenWardenAttack'),
  SpiderQween: frame('SpiderQueenAttack', 'spiderQueenAttack'),
  SoulEater: frame('SoulEaterAttack', 'soulEaterAttack'),
  MireBride: frame('MireBrideAttack', 'mireBrideAttackNoFloor'),
  Lich: frame('LichAttack', 'lichAttack'),
  Cerberus: frame('CerberusAttack', 'cerberusAttack'),
  AncientCerberus: frame('AncientCerberusAttack', 'ancientCerberusAttack'),
});

export const BOSS_ATTACK_FRAME_FILES = Object.freeze(
  Object.values(BOSS_ATTACK_FRAMES).map(({ key, path }) => ({ key, path })),
);

// How long the attack frame stays up.
const BOSS_ATTACK_HOLD_MS = 1400;

/** Shows `card`'s attack frame, if its boss has one. */
export function showBossAttackFrame(scene, card) {
  const sprite = card?.sprite;
  const restKey = card?.data?.sprite;
  const frame = BOSS_ATTACK_FRAMES[restKey];
  if (!frame || !sprite?.active || !scene?.textures?.exists?.(frame.key)) return;

  card._attackFrameTimer?.remove?.(false);
  if (sprite.texture?.key !== frame.key) {
    // Keep the boss's own origin pixel under the same screen spot.
    const ox = sprite.displayOriginX;
    const oy = sprite.displayOriginY;
    sprite.setTexture(frame.key);
    sprite.setDisplayOrigin(ox + frame.padX, oy + frame.padTop);
  }
  card._attackFrameTimer = scene.time.delayedCall(BOSS_ATTACK_HOLD_MS, () => {
    card._attackFrameTimer = null;
    if (!sprite.active || sprite.texture?.key !== frame.key) return;
    const ox = sprite.displayOriginX - frame.padX;
    const oy = sprite.displayOriginY - frame.padTop;
    sprite.setTexture(restKey);
    sprite.setDisplayOrigin(ox, oy);
  });
}
