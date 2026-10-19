// Eggs that hatch into companions (Taya): the chick's egg and the Old Chute's
// crystal spider egg. Both count down the same way, with no event to find:
// every fight room the player clears takes one off, and after the third the
// egg cracks open in its bag slot and the companion takes the slot.
// Hovering the egg shows how many fights are left (ui/ItemTooltip.js).

export const EGG_HATCH_FIGHTS = 3;

// The rooms that count.
export const EGG_HATCH_ROOMS = Object.freeze(['COMBAT', 'ELITE', 'BOSS']);

/** True for an egg that hatches: the chick's egg or the crystal spider egg. */
export function isHatchingEgg(item) {
  return item?.id === 'monsterEgg' || item?.id === 'crystalSpiderEgg'
    || (item?.name === 'Egg' && item?.type === 'food');
}

/** Fights left before it hatches. Eggs from older saves start the full count. */
export function eggFightsLeft(item) {
  const left = Number(item?.hatchFightsLeft);
  return Number.isFinite(left) ? Math.max(0, left) : EGG_HATCH_FIGHTS;
}
