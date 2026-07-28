// The Ogre's Gauntlet — the only card in the game whose job is blocking.
//
// It is NOT a spawnable weapon type: the ogre is the sole source, and he only
// stakes it on the rematch. The five rarities exist because the Copying Mirror
// can duplicate it and two copies can then be merged, so a player who works for
// it can climb the ladder. Nothing else hands one out.
//
// Mechanically it rides the block hook that already exists in
// InventoryCombatUse.useWeapon: a weapon card with `special: 'block'` and a
// non-bow weaponType, dragged from the bag onto the player avatar, arms
// gameState.blockNextAttack. That costs one durability pip and NO action
// points — which is what makes it strong, since AP only refills at rest stops.
// So durability is literally "how many hits you get to erase".

export const GAUNTLET_ID = 'ogreGauntlet';
export const GAUNTLET_SHEET = 'gauntletCards';

/** Frame index per rarity in gauntletSheet.png (52x70, left to right). */
export const GAUNTLET_FRAMES = Object.freeze({
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
});

// Blocks = durability. Deliberately just under an axe (6/8/10/12/14): erasing a
// whole hit for zero AP is worth more per pip than swinging is. Damage is low
// on purpose — you can hit something with it in a pinch, but it is a shield.
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
    // The block hook checks `special === 'block'` and refuses bows.
    special: 'block',
    range: 'melee',
    damage: tier.damage,
    durability: tier.blocks,
    maxDurability: tier.blocks,
    sprite: GAUNTLET_SHEET,
    spriteFrame: gauntletFrame(resolved),
    description: 'Drag onto yourself to block the next attack. Costs a pip, not an action.',
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
