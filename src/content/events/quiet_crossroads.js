export default {
    id: 'quiet_crossroads',
    title: 'Quiet Crossroads',
    description: 'For one floor, nothing is haunted, cursed, or pretending to be a chest.\n\nThere is a small dry alcove, a few coins someone dropped, and quiet.',
    choices: [
      {
        text: 'Pick up the coins',
        action: (gs, scene) => scene.gainCoins(10),
        outcome: 'You pocket the coins and move on.'
      },
      {
        text: 'Rest in the alcove',
        action: (gs, scene) => scene.heal(5),
        outcome: 'You sit down for a few minutes. Nothing attacks you. It helps more than it should.'
      },
      {
        text: 'Read the scratches on the wall',
        action: (gs, scene) => scene.readCrossroadsWall(),
        outcome: 'Someone scratched a map into the stone, one passage circled twice. You copy it down.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You don\'t trust it. You keep moving.'
      }
    ]
  };
