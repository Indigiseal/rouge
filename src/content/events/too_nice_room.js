export default {
    id: 'too_nice_room',
    title: 'The Too-Nice Room',
    description: 'You find a beautiful little room tucked inside the dungeon wall.\n\nIt is sweet-scented and filled with flowers. A tiny table waits with a cup of tea, and on the bed lies a huge comforting blanket you could sink into completely.\n\nThe safest-looking place you have seen all day. That is suspicious.',
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
        outcome: 'You sink into the soft bed and fall asleep almost instantly.\n\nWhen you wake up, your wounds are gone. So is one of your cards.\n\nSomewhere inside the wall, you hear tiny annoying laughter.'
      },
      {
        text: 'Leave the room',
        action: () => {},
        outcome: 'You back out of the room carefully. The pillow sighs in disappointment.'
      },
      {
        text: 'Inspect the room',
        action: () => {},
        outcomeFrame: 13, // reveal the fairy behind the cozy-room facade
        outcome: 'You look closer. The flowers are fake. The tea is cold. And behind the pillow, a tiny fairy is holding one of your cards and trying very hard not to giggle.',
        next: {
          choices: [
            {
              text: 'Confront the fairy',
              action: (gs, scene) => { scene.gainRandomAmulet(); },
              outcome: 'You lunge across the bed and grab the fairy by her wings. She freezes, then you pluck your stolen card back from her tiny arms.\n\nShe kicks and squeaks and throws a random amulet at your chest. "FINE! TAKE ONE! JUST LET GO!"\n\nThe instant you release her, the bed, tea, flowers and fairy are sucked into the wall like a stage prop.'
            },
            {
              text: 'Fight the fairy',
              action: (gs, scene) => {
                scene.loseHealthCapped(12);
                scene.loseActionPoints(4);
                // Current amulet pool only — retired teaRoomBell (rarity old) stays out of events.
                scene.gainRandomAmulet();
              },
              outcome: 'You swing your weapon. The fairy darts aside and snaps her fingers — a spell cracks through the room, your chest tightens and your action points drain.\n\nYou grab the tea table and smash it against the wall. The fairy tumbles down, defeated. "Fine. Take this! Just stop!"\n\nShe flings a random amulet at you, then the whole room folds into the wall and vanishes.'
            }
          ]
        }
      }
    ]
  };
