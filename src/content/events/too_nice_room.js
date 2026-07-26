export default {
    id: 'too_nice_room',
    title: 'The Too-Nice Room',
    description: 'Halfway down the corridor there is a room that should not be here.\n\nFlowers. A made bed. Tea, still steaming.\n\nNothing in this dungeon has been kind to you yet.',
    choices: [
      {
        text: 'Rest in the bed',
        action: (gs, scene) => {
          scene.fullHeal();
          if (!scene.stealRandomCard()) {
            const before = gs.coins || 0;
            gs.coins = Math.max(0, before - 10);
            scene.gameScene?.updateUI?.();
            if (before - gs.coins > 0) scene._reward(`-${before - gs.coins} coins`);
          }
        },
        outcome: 'You sleep better than you have in years.\n\nYou wake healed — and one card lighter. From somewhere inside the wall, very quiet laughter.'
      },
      {
        text: 'Leave the room',
        action: () => {},
        outcome: 'You back out. The pillow sighs.'
      },
      {
        text: 'Inspect the room',
        action: () => {},
        outcomeFrame: 13, // reveal the fairy behind the cozy-room facade
        outcome: 'The flowers are cloth. The tea went cold an hour ago at most.\n\nAnd behind the pillow, a fairy is sitting on one of your cards, trying very hard not to giggle.',
        next: {
          choices: [
            {
              text: 'Confront the fairy',
              action: (gs, scene) => { scene.gainRandomAmulet(); },
              outcome: 'You grab her before she can fly. She shrieks, kicks, and finally throws an amulet at your chest. "TAKE IT AND LET GO."\n\nThe moment you do, the room folds into the wall — bed, tea, fairy, and all.'
            },
            {
              text: 'Fight the fairy',
              action: (gs, scene) => {
                scene.loseHealthCapped(12);
                scene.loseActionPoints(4);
                // Current amulet pool only — retired teaRoomBell (rarity old) stays out of events.
                scene.gainRandomAmulet();
              },
              outcome: 'She is faster than you, and her spell hits like a door slamming — but you catch her with the tea table on her second pass.\n\nShe surrenders an amulet, spits on your boot, and vanishes with the room.'
            }
          ]
        }
      }
    ]
  };
