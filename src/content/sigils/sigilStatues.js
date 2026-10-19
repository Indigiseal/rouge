// The Sigil Room's statues (art: PixelLab, picked by Taya). One is chosen at
// random for each room. The sigil on offer sits in the carved circle on its
// forehead; the player drags a card into its mouth and it bites the sigil on.
//
// `forehead` and `mouth` are pixel positions inside the 96x96 image.

export const SIGIL_STATUES = Object.freeze([
  Object.freeze({ id: 'lion', key: 'sigilStatueLion', path: 'assets/art/sigilStatues/lion.png', forehead: { x: 50, y: 21 }, mouth: { x: 49, y: 51 } }),
  Object.freeze({ id: 'cobra', key: 'sigilStatueCobra', path: 'assets/art/sigilStatues/cobra.png', forehead: { x: 48, y: 11 }, mouth: { x: 49, y: 36 } }),
  Object.freeze({ id: 'toad', key: 'sigilStatueToad', path: 'assets/art/sigilStatues/toad.png', forehead: { x: 48, y: 20 }, mouth: { x: 48, y: 46 } }),
  Object.freeze({ id: 'fish', key: 'sigilStatueFish', path: 'assets/art/sigilStatues/fish.png', forehead: { x: 49, y: 22 }, mouth: { x: 49, y: 56 } }),
]);

// Share of elite rewards that are a Sigil Room instead of a chest, and with
// the Sapphire Brooch.
export const SIGIL_ROOM_CHANCE = 0.3;
export const SIGIL_ROOM_CHANCE_BROOCH = 0.6;

export function pickSigilStatue(random = Math.random) {
  return SIGIL_STATUES[Math.floor(random() * SIGIL_STATUES.length)];
}
