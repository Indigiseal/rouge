export default {
    id: 'screaming_head',
    title: 'The Screaming Head',
    description: 'A stone head, half-buried in the floor, big as a cart. The rest of the statue is not in the room.\n\nThe face is frozen mid-scream — broken teeth, empty eye sockets. Dust trickles from the mouth when you step closer.\n\nDeep inside the mouth, something shifts.',
    choices: [
      {
        text: 'Place a card in its mouth',
        condition: (gs, scene) => scene.hasScreamingHeadOfferCard(),
        action: (gs, scene) => scene.beginScreamingHeadOffering(),
        outcome: 'Choose a card and drag it into the statue\'s mouth.',
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
        text: 'Place a Fire Gem in the eye socket',
        condition: (gs, scene) => scene.hasGem('fire') && !scene.hasAmulet('fireRuneStone'),
        action: (gs, scene) => {
          if (scene.consumeGem('fire')) scene.gainAmulet('fireRuneStone');
        },
        outcome: 'The gem fits the socket exactly.\n\nRed light spreads through the cracks in the face. The head exhales one slow cloud of dust — and when it clears, a Fire Rune is resting on the stone tongue.'
      },
      {
        text: 'Place a Lightning Gem in the eye socket',
        condition: (gs, scene) => scene.hasGem('lightning') && !scene.hasAmulet('lightningRune'),
        action: (gs, scene) => {
          if (scene.consumeGem('lightning')) scene.gainAmulet('lightningRune');
        },
        outcome: 'The gem clicks into place.\n\nA thin bolt skips across the cracked forehead, and the teeth chatter once. The head exhales dust — and a Lightning Rune flickers between its teeth.'
      },
      {
        text: 'Place a Poison Gem in the eye socket',
        condition: (gs, scene) => scene.hasGem('poison') && !scene.hasAmulet('poisonRune'),
        action: (gs, scene) => {
          if (scene.consumeGem('poison')) scene.gainAmulet('poisonRune');
        },
        outcome: 'Green light seeps through the cracks, and the mouth curls — almost like remembering pain.\n\nThe head exhales a bitter cloud. Behind it, a dark green rune rests on the stone tongue.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You leave it screaming at the ceiling.\n\nA little more dust falls from its teeth as you pass.'
      }
    ]
  };
