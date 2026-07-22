// Talent branch layout and rank costs.

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

