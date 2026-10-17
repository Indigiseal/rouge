export default {
    id: 'screaming_head',
    title: 'The Screaming Head',
    description: 'A stone head, half-buried in the floor, big as a cart. The rest of the statue is not in the room.\n\nThe face is frozen mid-scream — broken teeth, empty eye sockets. Dust trickles from the mouth when you step closer.\n\nDeep inside the mouth, something shifts.',
    choices: [
      {
        text: 'Put an item in its mouth',
        condition: (gs, scene) => scene.hasScreamingHeadOfferCard(),
        action: (gs, scene) => scene.beginScreamingHeadOffering(),
        outcome: 'Choose an item and drag it into the statue\'s mouth.',
        next: {
          choices: [
            {
              text: 'Pull your hand back',
              action: (gs, scene) => scene.cancelScreamingHeadOffering(),
              outcome: 'You pull the card away. The teeth stay open. Waiting.'
            }
          ]
        }
      },
      {
        text: 'Reach into the mouth',
        action: (gs, scene) => {
          scene.damagePlayer(12, 'screaming_head_bite', 'The Screaming Head');
          if ((gs.playerHealth || 0) > 0) scene.gainRandomAmulet();
        },
        outcome: 'Cold stone. Dust. Then the jaw snaps shut.\n\nThe teeth catch your arm on the way out — and so does something small and hard, clenched in your fist.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You leave it screaming at the ceiling.\n\nA little more dust falls from its teeth as you pass.'
      }
    ]
  };
