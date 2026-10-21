// The Sigil Room's stamps (art: PixelLab, an animal figurine on its own stone
// base, picked and paired by Taya and Claude). Every sigil belongs to one
// animal's family, and the room shows that animal's stamp, so the animal
// tells the player what kind of sigil it is before they read it.
//
// The animation is shared by every stamp (scenes/SigilRoom.js): it lifts,
// slams down on the card, the room rumbles and dust falls.

export const SIGIL_STAMPS = Object.freeze([
  Object.freeze({
    id: 'lion', family: 'might', key: 'sigilStampLion', path: 'assets/art/sigilStamps/lion.png',
    // Hitting hard: crits, finishing blows, raw damage, fire.
    sigils: ['crushing', 'keen', 'merciless', 'honed', 'ironclad', 'devouring', 'fireball', 'outnumbered', 'bloodlust', 'warcry'],
  }),
  Object.freeze({
    id: 'turtle', family: 'shell', key: 'sigilStampTurtle', path: 'assets/art/sigilStamps/turtle.png',
    // Staying alive: armour, healing, hitting back, the sea.
    sigils: ['warding', 'tempered', 'mirror', 'thorns', 'riposte', 'desperate', 'regenerate', 'leech', 'mending', 'tsunami'],
  }),
  Object.freeze({
    id: 'toad', family: 'wealth', key: 'sigilStampToad', path: 'assets/art/sigilStamps/toad.png',
    // The money toad: coins, crystals, a full bag, a second socket.
    sigils: ['cutpurse', 'bounty', 'ransom', 'packrat', 'twinSocket', 'scout', 'crystalBrood'],
  }),
  Object.freeze({
    id: 'cobra', family: 'venom', key: 'sigilStampCobra', path: 'assets/art/sigilStamps/cobra.png',
    // Poison and control: slowing, freezing, turning enemies.
    sigils: ['venom', 'daze', 'sapping', 'sunder', 'charm', 'smoke', 'frost'],
  }),
  Object.freeze({
    id: 'deer', family: 'grace', key: 'sigilStampDeer', path: 'assets/art/sigilStamps/deer.png',
    // Speed: first strikes, chains, dodging, action points back.
    sigils: ['fleetfoot', 'ambush', 'unscathed', 'secondWind', 'combo', 'tandem', 'hunter', 'kinship'],
  }),
]);

// The round stone dais the stamp and slab stand on (PixelLab, picked by Taya).
export const SIGIL_ROOM_FLOOR = Object.freeze({ key: 'sigilRoomFloor', path: 'assets/art/sigilStamps/floor.png' });

// Share of elite rewards that are a Sigil Room instead of a chest, and with
// the Sapphire Brooch.
export const SIGIL_ROOM_CHANCE = 0.3;
export const SIGIL_ROOM_CHANCE_BROOCH = 0.6;

/** The stamp whose family holds `sigilId` (the lion for anything unlisted). */
export function stampForSigil(sigilId) {
  return SIGIL_STAMPS.find((stamp) => stamp.sigils.includes(sigilId)) || SIGIL_STAMPS[0];
}
