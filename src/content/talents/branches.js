// Talent branch layout and rank costs.

// Five ranks, rising cost: 30 XP for a full node, 300 for the branch. At the
// measured earn rate (~7 XP/run once rolling) that is roughly 40 runs of growth
// against the 13 the three-rank tree gave — the whole point of the rework was
// that the ladder ran out long before the player did.
export const TALENT_RANK_COSTS = Object.freeze([2, 3, 5, 8, 12]);

export const TALENT_BRANCHES = Object.freeze({
  rogue: [
    {
      id: 'shadow',
      name: 'Shadow',
      nameRu: 'Тень',
      purchasable: true,
      // Deliberately alternating offence / survival / economy so consecutive
      // purchases never feel like the same purchase twice.
      nodes: [
        'keenEdge', 'scarTissue', 'twinFang', 'shadowStep', 'firstBlood',
        'momentum', 'frontVolley', 'prospector', 'assassinate', 'secondWind',
      ],
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
      // Same alternation as Shadow: armour, offence, economy, so no two
      // consecutive purchases feel like the same purchase.
      nodes: [
        'armorerStart', 'hardened', 'rivets', 'ironHide', 'bulwark',
        'grindstone', 'heavyEdge', 'reprisal', 'executioner', 'lastStand',
      ],
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

