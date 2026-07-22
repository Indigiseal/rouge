// Per-character talent trees. Shadow (rogue) and Iron (warrior) are purchasable;
// other branches are visible with purchasable:false (WIP stub).

export const TALENT_RANK_COSTS = Object.freeze([3, 6, 10]); // XP for ranks 1 / 2 / 3

export const TALENT_BRANCHES = Object.freeze({
  rogue: [
    {
      id: 'shadow',
      name: 'Shadow',
      nameRu: 'Тень',
      purchasable: true,
      nodes: ['keenEdge', 'firstBlood', 'twinFang', 'frontVolley', 'assassinate'],
    },
    {
      id: 'ghost',
      name: 'Ghost',
      nameRu: 'Призрак',
      purchasable: false,
      wip: true,
      nodes: ['softSteps', 'secondSkin', 'slippery', 'shadowRest', 'bloodthirst'],
    },
    {
      id: 'scoundrel',
      name: 'Scoundrel',
      nameRu: 'Плут',
      purchasable: false,
      wip: true,
      nodes: ['toolKit', 'luckyDraw', 'poisonTip', 'scavengerKit', 'quietKill'],
    },
  ],
  warrior: [
    {
      id: 'iron',
      name: 'Iron',
      nameRu: 'Железо',
      purchasable: true,
      nodes: ['armorerStart', 'rivets', 'bulwark', 'hardened', 'reprisal'],
    },
    {
      id: 'edge',
      name: 'Edge',
      nameRu: 'Клинок',
      purchasable: false,
      wip: true,
      nodes: ['veteranGrip', 'sharpened', 'heavyHands', 'bloodPrice', 'executionersEye'],
    },
    {
      id: 'camp',
      name: 'Camp',
      nameRu: 'Лагерь',
      purchasable: false,
      wip: true,
      nodes: ['ironStomach', 'fieldRations', 'muster', 'smithyFavor', 'secondWind'],
    },
  ],
});

/** @type {Record<string, object>} */
export const TALENT_NODES = Object.freeze({
  // ── Rogue / Shadow (live) ───────────────────────────────────────────
  keenEdge: {
    id: 'keenEdge',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Keen Edge',
    maxRank: 3,
    descriptionRanks: [
      'Dagger and bow deal +4% damage (stacks with class bonus).',
      'Dagger and bow deal +7% damage (stacks with class bonus).',
      'Dagger and bow deal +11% damage (stacks with class bonus).',
    ],
    values: [0.04, 0.07, 0.11],
  },
  firstBlood: {
    id: 'firstBlood',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'First Blood',
    maxRank: 3,
    descriptionRanks: [
      'First attack each floor deals +25% damage.',
      'First attack each floor deals +40% damage.',
      'First attack each floor deals +55% damage.',
    ],
    values: [0.25, 0.40, 0.55],
  },
  twinFang: {
    id: 'twinFang',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Twin Fang',
    maxRank: 3,
    descriptionRanks: [
      'Dagger hits +8% damage; bows +4% (off-hand pip still free).',
      'Dagger hits +12% damage; bows +6% (off-hand pip still free).',
      'Dagger hits +18% damage; bows +9% (off-hand pip still free).',
    ],
    values: [0.08, 0.12, 0.18],
  },
  frontVolley: {
    id: 'frontVolley',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Front Volley',
    maxRank: 3,
    descriptionRanks: [
      'Bow attacks also hit a random front enemy for 18% bow damage (no extra pip).',
      'Bow attacks also hit a random front enemy for 26% bow damage (no extra pip).',
      'Bow attacks also hit a random front enemy for 34% bow damage (no extra pip).',
    ],
    values: [0.18, 0.26, 0.34],
  },
  assassinate: {
    id: 'assassinate',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Assassinate',
    maxRank: 3,
    descriptionRanks: [
      'If an enemy has 2 HP or less after your hit, finish them (no extra pip).',
      'If an enemy has 2 HP or less after your hit, finish them (no extra pip).',
      'If an enemy has 3 HP or less after your hit, finish them (no extra pip).',
    ],
    values: [2, 2, 3],
  },

  // ── Rogue / Ghost (WIP) ─────────────────────────────────────────────
  softSteps: {
    id: 'softSteps',
    characterId: 'rogue',
    branchId: 'ghost',
    name: 'Soft Steps',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      '+2% dodge with leather.',
      '+4% dodge with leather.',
      '+6% dodge with leather.',
    ],
    values: [0.02, 0.04, 0.06],
  },
  secondSkin: {
    id: 'secondSkin',
    characterId: 'rogue',
    branchId: 'ghost',
    name: 'Second Skin',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Start each run with common leather.',
      'Start with common leather; +1 max durability on leather.',
      'Start with common leather; +2 max durability on leather.',
    ],
    values: [0, 1, 2],
  },
  slippery: {
    id: 'slippery',
    characterId: 'rogue',
    branchId: 'ghost',
    name: 'Slippery',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'After a dodge, +5% dodge until you are hit.',
      'After a dodge, +8% dodge until you are hit.',
      'After a dodge, +12% dodge until you are hit.',
    ],
    values: [0.05, 0.08, 0.12],
  },
  shadowRest: {
    id: 'shadowRest',
    characterId: 'rogue',
    branchId: 'ghost',
    name: 'Shadow Rest',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Heal 1 HP at the start of each floor.',
      'Heal 2 HP at the start of each floor.',
      'Heal 3 HP at the start of each floor.',
    ],
    values: [1, 2, 3],
  },
  bloodthirst: {
    id: 'bloodthirst',
    characterId: 'rogue',
    branchId: 'ghost',
    name: 'Bloodthirst',
    maxRank: 1,
    wip: true,
    descriptionRanks: [
      'Low HP lifesteal: at ≤50/35/25/10% Max HP heal 10/20/30/40% of damage dealt (highest tier only). Needs playtest.',
    ],
    values: [1],
  },

  // ── Rogue / Scoundrel (WIP; coin/AP nodes replaced) ──────────────────
  toolKit: {
    id: 'toolKit',
    characterId: 'rogue',
    branchId: 'scoundrel',
    name: 'Tool Kit',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      '+1 max durability on starting weapons.',
      '+1 max durability on starting weapons and dagger/bow drops.',
      '+2 max durability on starting weapons and dagger/bow drops.',
    ],
    values: [1, 1, 2],
  },
  luckyDraw: {
    id: 'luckyDraw',
    characterId: 'rogue',
    branchId: 'scoundrel',
    name: 'Lucky Draw',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      '+5% weight for uncommon+ dagger/bow combat loot.',
      '+10% weight for uncommon+ dagger/bow combat loot.',
      '+15% weight for uncommon+ dagger/bow combat loot.',
    ],
    values: [0.05, 0.10, 0.15],
  },
  poisonTip: {
    id: 'poisonTip',
    characterId: 'rogue',
    branchId: 'scoundrel',
    name: 'Poison Tip',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Dagger/bow: 8% chance to poison (2 dmg × 2 turns).',
      'Dagger/bow: 12% chance to poison (2 dmg × 2 turns).',
      'Dagger/bow: 16% chance to poison (3 dmg × 2 turns).',
    ],
    values: [0.08, 0.12, 0.16],
  },
  scavengerKit: {
    id: 'scavengerKit',
    characterId: 'rogue',
    branchId: 'scoundrel',
    name: 'Scavenger',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Start each run with 1 healing potion.',
      'Start with 1 healing potion; another every 10 floors.',
      'Start with 1 healing potion; another every 7 floors.',
    ],
    values: [1, 10, 7],
  },
  quietKill: {
    id: 'quietKill',
    characterId: 'rogue',
    branchId: 'scoundrel',
    name: 'Quiet Kill',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Once per floor: a killing blow skips enemy counter-attacks.',
      'Once per floor: killing blow skips counters; heal 1 HP.',
      'Once per two floors → every floor: killing blow skips counters; heal 2 HP.',
    ],
    values: [1, 1, 2],
  },

  // ── Warrior / Iron (live) ───────────────────────────────────────────
  hardened: {
    id: 'hardened',
    characterId: 'warrior',
    branchId: 'iron',
    name: 'Hardened',
    maxRank: 3,
    descriptionRanks: [
      'Chain and plate: +1 DEF and +1 max durability.',
      'Chain and plate: +1 DEF and +1 max durability.',
      'Chain and plate: +1 DEF, +1 max durability, and +5% to armor procs.',
    ],
    values: [1, 1, 1],
  },
  reprisal: {
    id: 'reprisal',
    characterId: 'warrior',
    branchId: 'iron',
    name: 'Reprisal',
    maxRank: 3,
    descriptionRanks: [
      'When DEF absorbs a hit, reflect 15% of blocked damage (floor; can kill).',
      'When DEF absorbs a hit, reflect 25% of blocked damage (floor; can kill).',
      'When DEF absorbs a hit, reflect 35% of blocked damage (floor; can kill).',
    ],
    values: [0.15, 0.25, 0.35],
  },
  // Kept for old saves; no longer on the Iron branch (chain already has intrinsic counter).
  counterDrill: {
    id: 'counterDrill',
    characterId: 'warrior',
    branchId: 'iron',
    name: 'Counter Drill',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Chain: +3% melee counter chance.',
      'Chain: +6% melee counter chance.',
      'Chain: +9% melee counter chance.',
    ],
    values: [0.03, 0.06, 0.09],
  },
  bulwark: {
    id: 'bulwark',
    characterId: 'warrior',
    branchId: 'iron',
    name: 'Bulwark',
    maxRank: 3,
    descriptionRanks: [
      'Chain and plate: +12% to armor special procs (counter / ranged ignore).',
      'Chain and plate: +24% to armor special procs (counter / ranged ignore).',
      'Chain and plate: +36% to armor special procs (counter / ranged ignore).',
    ],
    values: [0.12, 0.24, 0.36],
  },
  armorerStart: {
    id: 'armorerStart',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Armorer's Start",
    maxRank: 1,
    descriptionRanks: [
      'Start each run with uncommon chain or plate (DEF 3) — pick which at run start.',
    ],
    values: [1],
  },
  rivets: {
    id: 'rivets',
    characterId: 'warrior',
    branchId: 'iron',
    name: 'Rivets',
    maxRank: 3,
    descriptionRanks: [
      '25% chance to skip any armor durability loss (DEF, ignore, dodge).',
      '35% chance to skip any armor durability loss (DEF, ignore, dodge).',
      '45% chance to skip any armor durability loss (DEF, ignore, dodge).',
    ],
    values: [0.25, 0.35, 0.45],
  },

  // ── Warrior / Edge (WIP) ────────────────────────────────────────────
  veteranGrip: {
    id: 'veteranGrip',
    characterId: 'warrior',
    branchId: 'edge',
    name: 'Veteran Grip',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      '+1 max durability on starting swords.',
      '+1 max durability on starting swords and sword/axe drops.',
      '+2 max durability on starting swords and sword/axe drops.',
    ],
    values: [1, 1, 2],
  },
  sharpened: {
    id: 'sharpened',
    characterId: 'warrior',
    branchId: 'edge',
    name: 'Sharpened',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Sword/axe crit chance +2%.',
      'Sword/axe crit chance +4%.',
      'Sword/axe crit chance +6%.',
    ],
    values: [0.02, 0.04, 0.06],
  },
  heavyHands: {
    id: 'heavyHands',
    characterId: 'warrior',
    branchId: 'edge',
    name: 'Heavy Hands',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Crit multiplier gains +1% per rarity tier.',
      'Crit multiplier gains +2% per rarity tier.',
      'Crit multiplier gains +3% per rarity tier.',
    ],
    values: [0.01, 0.02, 0.03],
  },
  bloodPrice: {
    id: 'bloodPrice',
    characterId: 'warrior',
    branchId: 'edge',
    name: 'Blood Price',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Killing with sword/axe heals 1 HP.',
      'Killing with sword/axe heals 2 HP.',
      'Killing with sword/axe heals 3 HP.',
    ],
    values: [1, 2, 3],
  },
  executionersEye: {
    id: 'executionersEye',
    characterId: 'warrior',
    branchId: 'edge',
    name: "Executioner's Eye",
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Vs enemies below 40% HP: sword/axe +5% damage.',
      'Vs enemies below 40% HP: sword/axe +8% damage.',
      'Vs enemies below 40% HP: sword/axe +12% damage.',
    ],
    values: [0.05, 0.08, 0.12],
  },

  // ── Warrior / Camp (WIP; coin node replaced) ─────────────────────────
  ironStomach: {
    id: 'ironStomach',
    characterId: 'warrior',
    branchId: 'camp',
    name: 'Iron Stomach',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      '+3 Max HP at run start.',
      '+6 Max HP at run start.',
      '+9 Max HP at run start.',
    ],
    values: [3, 6, 9],
  },
  fieldRations: {
    id: 'fieldRations',
    characterId: 'warrior',
    branchId: 'camp',
    name: 'Field Rations',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Heal 2 HP at the start of each floor.',
      'Heal 3 HP at the start of each floor.',
      'Heal 4 HP at the start of each floor.',
    ],
    values: [2, 3, 4],
  },
  muster: {
    id: 'muster',
    characterId: 'warrior',
    branchId: 'camp',
    name: 'Muster',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Start each run with 1 healing potion.',
      'Start with 1 healing potion and +2 Max HP.',
      'Start with 1 healing potion and +4 Max HP.',
    ],
    values: [1, 2, 4],
  },
  smithyFavor: {
    id: 'smithyFavor',
    characterId: 'warrior',
    branchId: 'camp',
    name: 'Smithy Favor',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      '1 free anvil repair per act.',
      '1 free anvil repair per act; repairs restore +1 extra pip.',
      '2 free anvil repairs per act; repairs restore +1 extra pip.',
    ],
    values: [1, 1, 2],
  },
  secondWind: {
    id: 'secondWind',
    characterId: 'warrior',
    branchId: 'camp',
    name: 'Second Wind',
    maxRank: 3,
    wip: true,
    descriptionRanks: [
      'Once per act: at ≤25% HP, restore 10% Max HP.',
      'Once per act: at ≤25% HP, restore 15% Max HP.',
      'Once per act: at ≤25% HP, restore 20% Max HP.',
    ],
    values: [0.10, 0.15, 0.20],
  },
});

export function getTalentNode(talentId) {
  return TALENT_NODES[talentId] || null;
}

export function getBranchesForCharacter(characterId) {
  return TALENT_BRANCHES[characterId] || [];
}

/** Previous node in the same branch column, or null if this is the first. */
export function getPreviousTalentId(characterId, talentId) {
  for (const branch of getBranchesForCharacter(characterId)) {
    const idx = branch.nodes.indexOf(talentId);
    if (idx < 0) continue;
    if (idx === 0) return null;
    return branch.nodes[idx - 1];
  }
  return null;
}

export function isBranchPurchasable(characterId, branchId) {
  const branch = getBranchesForCharacter(characterId).find((b) => b.id === branchId);
  return Boolean(branch?.purchasable);
}

export function costForNextRank(currentRank) {
  if (currentRank < 0) return TALENT_RANK_COSTS[0];
  if (currentRank >= TALENT_RANK_COSTS.length) return null;
  return TALENT_RANK_COSTS[currentRank];
}

export function totalCostForRanks(fromRank, toRank) {
  let sum = 0;
  for (let r = fromRank; r < toRank; r++) {
    const c = costForNextRank(r);
    if (c == null) return null;
    sum += c;
  }
  return sum;
}

/**
 * Resolve owned talent ranks into a flat runtime bag for a run.
 * Only live (non-WIP / purchasable branch) effects are applied, even if
 * save data somehow contains WIP ranks.
 */
export function resolveTalentEffects(characterId, talents = {}, choices = {}) {
  const effects = {
    keenEdgePct: 0,
    firstBloodPct: 0,
    twinFangPct: 0,
    frontVolleyPct: 0,
    assassinateThreshold: 0,
    hardenedMaxDur: 0,
    hardenedDef: 0,
    hardenedProcBonus: 0,
    counterDrillBonus: 0,
    bulwarkBonus: 0,
    rivetsChance: 0,
    reprisalReflectPct: 0,
    armorerArmorType: null,
  };

  const rankOf = (id) => Math.max(0, Number(talents[id]) || 0);

  const keen = rankOf('keenEdge');
  if (keen > 0 && characterId === 'rogue') {
    effects.keenEdgePct = TALENT_NODES.keenEdge.values[keen - 1] || 0;
  }
  const fb = rankOf('firstBlood');
  if (fb > 0 && characterId === 'rogue') {
    effects.firstBloodPct = TALENT_NODES.firstBlood.values[fb - 1] || 0;
  }
  const twin = rankOf('twinFang');
  if (twin > 0 && characterId === 'rogue') {
    effects.twinFangPct = TALENT_NODES.twinFang.values[twin - 1] || 0;
  }
  const volley = rankOf('frontVolley');
  if (volley > 0 && characterId === 'rogue') {
    effects.frontVolleyPct = TALENT_NODES.frontVolley.values[volley - 1] || 0;
  }
  const ash = rankOf('assassinate');
  if (ash > 0 && characterId === 'rogue') {
    effects.assassinateThreshold = TALENT_NODES.assassinate.values[ash - 1] || 0;
  }

  const hard = rankOf('hardened');
  if (hard > 0 && characterId === 'warrior') {
    effects.hardenedMaxDur = 1;
    effects.hardenedDef = TALENT_NODES.hardened.values[hard - 1] || hard;
    if (hard >= 3) effects.hardenedProcBonus = 0.05;
  }
  const cd = rankOf('counterDrill');
  if (cd > 0 && characterId === 'warrior' && !TALENT_NODES.counterDrill.wip) {
    effects.counterDrillBonus = TALENT_NODES.counterDrill.values[cd - 1] || 0;
  }
  const rep = rankOf('reprisal');
  if (rep > 0 && characterId === 'warrior') {
    effects.reprisalReflectPct = TALENT_NODES.reprisal.values[rep - 1] || 0;
  }
  const bw = rankOf('bulwark');
  if (bw > 0 && characterId === 'warrior') {
    effects.bulwarkBonus = TALENT_NODES.bulwark.values[bw - 1] || 0;
  }
  const riv = rankOf('rivets');
  if (riv > 0 && characterId === 'warrior') {
    effects.rivetsChance = TALENT_NODES.rivets.values[riv - 1] || 0;
  }
  if (rankOf('armorerStart') > 0 && characterId === 'warrior') {
    // Armor type is chosen on the run-start pick screen (or sim override),
    // not stored as a permanent purchase choice.
    const pick = choices.runArmorerArmorType || choices.armorerArmorType;
    if (pick === 'chain' || pick === 'plate') effects.armorerArmorType = pick;
  }

  return effects;
}

/** Mutate an armor card in place with Hardened / Counter Drill / Bulwark. */
export function applyArmorTalentMods(armor, talentEffects) {
  if (!armor || !talentEffects) return armor;
  const type = armor.armorType;
  if (type !== 'chain' && type !== 'plate') return armor;

  if (talentEffects.hardenedMaxDur > 0) {
    armor.maxDurability = (armor.maxDurability || armor.durability || 0) + talentEffects.hardenedMaxDur;
    armor.durability = Math.min(
      armor.maxDurability,
      (armor.durability || 0) + talentEffects.hardenedMaxDur
    );
  }
  if (talentEffects.hardenedDef > 0) {
    armor.protection = (armor.protection || 0) + talentEffects.hardenedDef;
  }
  if (type === 'chain') {
    const bonus = (talentEffects.counterDrillBonus || 0)
      + (talentEffects.bulwarkBonus || 0)
      + (talentEffects.hardenedProcBonus || 0);
    if (bonus > 0 && armor.meleeCounterChance != null) {
      armor.meleeCounterChance = Math.min(1, armor.meleeCounterChance + bonus);
    }
  }
  if (type === 'plate') {
    const bonus = (talentEffects.bulwarkBonus || 0) + (talentEffects.hardenedProcBonus || 0);
    if (bonus > 0 && armor.rangedIgnoreChance != null) {
      armor.rangedIgnoreChance = Math.min(1, armor.rangedIgnoreChance + bonus);
    }
  }
  return armor;
}

export function createStartingTalentArmor(armorType, talentEffects) {
  if (armorType !== 'chain' && armorType !== 'plate') return null;
  const isChain = armorType === 'chain';
  // Uncommon starter — early Iron ladder step with real DEF/procs.
  const card = {
    type: 'armor',
    name: isChain ? 'Uncommon Chain Armor' : 'Uncommon Plate Armor',
    armorType,
    protection: 3,
    rarity: 'uncommon',
    sprite: isChain ? 'chain_U' : 'plate_U',
    durability: 22,
    maxDurability: 22,
  };
  if (isChain) card.meleeCounterChance = 0.20;
  else card.rangedIgnoreChance = 0.80;
  return applyArmorTalentMods(card, talentEffects);
}
