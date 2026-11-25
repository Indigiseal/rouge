// The Ogre's Gauntlet comes down as an open hand on the enemies around its target.
//
// It is NOT a spawnable weapon type: the ogre is the sole source, and he only
// stakes it on the rematch. The five rarities exist because the Copying Mirror
// can duplicate it and two copies can then be merged, so a player who works for
// it can climb the ladder.
//
// It used to block as well (dragged onto the player, it erased the next hit for
// a pip and no AP). Taya took the block away on Nov 2 once the hand reach was
// in, and kept its damage as it was. Saves still holding `special: 'block'` on
// a gauntlet are refused the block in InventoryCombatUse.useWeapon.

export const GAUNTLET_ID = 'ogreGauntlet';
// Its blow comes down as a hand (GAUNTLET_HAND_CELLS in content/cards/weapons.js).
// It used to smash every other face-up enemy on the board.
export const GAUNTLET_DESCRIPTION = 'A strike comes down as an open hand: enemies under the palm, thumb and fingers take half damage while AP remains.';
export const GAUNTLET_SHEET = 'gauntletCards';

/** Frame index per rarity in gauntletSheet.png (52x70, left to right). */
export const GAUNTLET_FRAMES = Object.freeze({
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
});

// Durability was set as its count of blocks, just under an axe (6/8/10/12/14),
// and its damage kept low because it was a shield. Both stay as they were when
// the block went (Taya: don't raise its damage).
export const GAUNTLET_TIERS = Object.freeze({
  common: { blocks: 5, damage: 2 },
  uncommon: { blocks: 7, damage: 3 },
  rare: { blocks: 9, damage: 4 },
  epic: { blocks: 11, damage: 5 },
  legendary: { blocks: 13, damage: 6 },
});

/** The rarity the ogre stakes. Two matches to win it, so it starts high. */
export const GAUNTLET_PRIZE_RARITY = 'rare';

export function isGauntlet(card) {
  return Boolean(card && card.id === GAUNTLET_ID);
}

export function gauntletFrame(rarity) {
  const frame = GAUNTLET_FRAMES[rarity];
  return Number.isInteger(frame) ? frame : GAUNTLET_FRAMES.rare;
}

export function createGauntletCard(rarity = GAUNTLET_PRIZE_RARITY) {
  const tier = GAUNTLET_TIERS[rarity] || GAUNTLET_TIERS.rare;
  const resolved = GAUNTLET_TIERS[rarity] ? rarity : 'rare';
  return {
    id: GAUNTLET_ID,
    type: 'weapon',
    weaponType: 'gauntlet',
    name: "Ogre's Gauntlet",
    rarity: resolved,
    // Its reach (the hand) is keyed on the id, not on `special`.
    special: 'hand',
    range: 'melee',
    damage: tier.damage,
    durability: tier.blocks,
    maxDurability: tier.blocks,
    sprite: GAUNTLET_SHEET,
    spriteFrame: gauntletFrame(resolved),
    description: GAUNTLET_DESCRIPTION,
    // NOTE: deliberately no `unique: true`. That flag is what the Copying Mirror
    // checks (_isMirrorCopyable), and duplication is the whole reason the other
    // four rarities exist. It is protected from the Screaming Head and the
    // sacrifice picker by id instead — see EventRunHelpers.
  };
}

/** Next rarity up, or null at the top of the ladder. */
export function nextGauntletRarity(rarity) {
  const ladder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const index = ladder.indexOf(rarity);
  return index >= 0 && index < ladder.length - 1 ? ladder[index + 1] : null;
}
