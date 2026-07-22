export default {
    id: 'quiet_crossroads',
    title: 'Quiet Crossroads',
    description: 'For once, the road is only strange in the normal dungeon way.',
    choices: [
      {
        text: 'Gain 10 coins',
        action: (gs, scene) => scene.gainCoins(10),
        outcome: 'You pocket the coins and move on.'
      },
      {
        text: 'Heal 5 HP',
        action: (gs, scene) => scene.heal(5),
        outcome: 'You rest briefly and feel a little better.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You decide not to linger.'
      }
    ]
  };
