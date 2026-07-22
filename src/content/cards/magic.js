export const MAGIC = [
  {
    magicType: 'fireball',
    name: 'Fireball',
    description: 'Deals 15 damage to a single enemy',
    damage: 15,
    minFloor: 1,
    rarity: 'uncommon',
    sprite: 'fireBall',
  },
  {
    magicType: 'frostRing',
    name: 'Frost Ring',
    description: 'Freezes all enemies for 3 turns',
    minFloor: 3,
    rarity: 'rare',
    sprite: 'frozenRing',
  },
  {
    magicType: 'restoration',
    name: 'Restoration',
    description: 'Fully restores HP and Action Points',
    minFloor: 2,
    rarity: 'uncommon',
    sprite: 'recovery',
  },
  {
    magicType: 'soulDrain',
    name: 'Soul Drain',
    description: 'Instantly kills a non-boss enemy and heals 30 HP',
    healAmount: 30,
    minFloor: 8,
    rarity: 'legendary',
    sprite: 'soulSucking',
  },
  {
    magicType: 'shadowBlade',
    name: 'Shadow Blade',
    description: 'Increases attack damage by 50% for 10 turns',
    minFloor: 5,
    rarity: 'rare',
    sprite: 'shadowDagger',
  },
  {
    magicType: 'weakness',
    name: 'Weakness',
    description: 'Reduces all enemies damage by 30%',
    minFloor: 4,
    rarity: 'uncommon',
    sprite: 'weakening',
  },
  {
    magicType: 'boneWall',
    name: 'Bone Wall',
    description: 'Reflects the next 2 enemy attacks',
    minFloor: 6,
    rarity: 'rare',
    sprite: 'boneWall',
  },
  {
    magicType: 'magicShield',
    name: 'Magic Shield',
    description: 'Increases armor by 20% for 10 turns',
    minFloor: 3,
    rarity: 'uncommon',
    sprite: 'macigShield',
  },
  {
    magicType: 'mirrorShield',
    name: 'Mirror Shield',
    description: 'Reflects the next enemy attack',
    minFloor: 2,
    rarity: 'common',
    sprite: 'mirrorShield',
  },
  {
    magicType: 'smokeScreen',
    name: 'Smoke Screen',
    description: 'Flips all face-up enemy cards back down',
    minFloor: 7,
    rarity: 'rare',
    sprite: 'smokeBomb',
  }
];

export function getMagic(magicType) {
  return MAGIC.find((card) => card.magicType === magicType) || null;
}
