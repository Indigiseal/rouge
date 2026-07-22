export default {
    id: 'screaming_head',
    title: 'The Screaming Head',
    description: 'You find a giant stone head half-buried in the dungeon floor.\n\nThe rest of the statue is gone.\n\nIts face is cracked and crumbling, but the expression remains: a scream frozen in stone.\n\nThe open mouth is full of broken teeth.\n\nThe eye sockets are empty.\n\nDust falls from the statue whenever you move closer.\n\nFor a moment, you think the head is only a ruin.\n\nThen something deep inside its mouth shifts.',
    choices: [
      {
        text: 'Place a card in its mouth',
        condition: (gs, scene) => scene.hasScreamingHeadOfferCard(),
        action: (gs, scene) => scene.beginScreamingHeadOffering(),
        outcome: 'Choose a card from your inventory and drag it into the statue\'s mouth.',
        next: {
          choices: [
            {
              text: 'Pull your hand back',
              action: (gs, scene) => scene.cancelScreamingHeadOffering(),
              outcome: 'You pull the card away. The stone teeth remain open and waiting.'
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
        outcome: 'You reach into the screaming mouth.\n\nAt first, your fingers touch only cold stone and dust.\n\nThen the jaw snaps shut.\n\nPain shoots up your arm as the broken teeth bite down.\n\nYou pull free before the head can crush your hand.\n\nSomething small and hard is clenched in your bleeding palm.'
      },
      {
        text: 'Place a Fire Gem in the eye socket',
        condition: (gs, scene) => scene.hasGem('fire') && !scene.hasAmulet('fireRuneStone'),
        action: (gs, scene) => {
          if (scene.consumeGem('fire')) scene.gainAmulet('fireRuneStone');
        },
        outcome: 'You press the Fire Gem into one empty eye socket.\n\nIt fits perfectly.\n\nA red glow spreads through the cracks in the statue\'s face. The screaming mouth trembles.\n\nThen the head exhales a thick cloud of dusty smoke.\n\nWhen the smoke clears, something red is glowing between its broken teeth.\n\nA Fire Rune rests on the statue\'s stone tongue.'
      },
      {
        text: 'Place a Lightning Gem in the eye socket',
        condition: (gs, scene) => scene.hasGem('lightning') && !scene.hasAmulet('lightningRune'),
        action: (gs, scene) => {
          if (scene.consumeGem('lightning')) scene.gainAmulet('lightningRune');
        },
        outcome: 'You press the Lightning Gem into one empty eye socket.\n\nThe gem clicks into place.\n\nA thin bolt jumps across the statue\'s cracked forehead. The stone teeth chatter once, fast and sharp.\n\nThen the head exhales a cloud of dry gray dust.\n\nWhen the dust falls away, a bright rune flickers inside its open mouth.\n\nA Lightning Rune rests on the statue\'s stone tongue.'
      },
      {
        text: 'Place a Poison Gem in the eye socket',
        condition: (gs, scene) => scene.hasGem('poison') && !scene.hasAmulet('poisonRune'),
        action: (gs, scene) => {
          if (scene.consumeGem('poison')) scene.gainAmulet('poisonRune');
        },
        outcome: 'You press the Poison Gem into one empty eye socket.\n\nGreen light seeps through the cracks in the stone. The statue\'s mouth curls slightly, almost like it remembers pain.\n\nThen it exhales a bitter cloud of dusty smoke.\n\nWhen the smoke thins, a dark green rune lies between its broken teeth.\n\nA Poison Rune rests on the statue\'s stone tongue.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You step away from the broken head.\n\nThe open mouth remains frozen in its silent scream.\n\nAs you leave, a few grains of stone dust fall from its teeth.'
      }
    ]
  };
