export const TRAPS = [
  {
    weight: 40,
    subType: 'spike',
    name: 'Spike Trap',
    sprite: 'trap',
    createData: (floor) => ({
      damage: 3 + Math.floor(floor * 0.6)
    })
  },
  {
    weight: 30,
    subType: 'poison',
    name: 'Poison Trap',
    sprite: 'trap2',
    createData: (floor) => ({
      // Immediate hit (lower than a spike trap, since it also
      // poisons over the next few turns) plus the lingering poison.
      damage: 2 + Math.floor(floor * 0.4),
      abilities: [{ type: 'poison', damage: 1 + Math.floor(floor / 3), turns: 3 }]
    })
  },
  {
    weight: 30,
    subType: 'reveal',
    name: 'Pressure Plate',
    sprite: 'trapTriggers',
    // A light nick on top of its reveal effect — kept below the spike
    // (3 + 0.6·floor) and poison (2 + 0.4·floor) so it stays the
    // gentlest trap while still showing a number on the card.
    createData: (floor) => ({
      damage: 1 + Math.floor(floor * 0.3)
    })
  }
  // Add more trap types here
];
