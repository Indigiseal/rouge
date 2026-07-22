export default {
    id: 'briar_room',
    title: 'The Briar Room',
    description: 'You enter a narrow room covered in thorn vines.\n\nThey crawl over the walls, across the ceiling, and down between the stones.\n\nThe floor is littered with old broken weapons and scraps of armor caught in the brambles.\n\nAs you step inside, the vines slowly turn toward your inventory.',
    choices: [
      {
        text: 'Offer a weapon or armor card',
        action: (gs, scene) => scene.beginBriarOffering(),
        outcome: 'Choose a weapon or armor card from your inventory and drag it onto the briars.',
        next: {
          choices: [
            {
              text: 'Leave without offering a card',
              action: (gs, scene) => scene.cancelBriarOffering(),
              outcome: 'You back away before the vines reach your boots.\n\nThe brambles slowly turn back toward the walls.'
            }
          ]
        }
      },
      {
        text: 'Slash through the vines',
        action: (gs, scene) => {
          scene.loseHealthCapped(10);
          scene.gainRareThornsCard();
        },
        outcomeFrame: 24,
        outcome: 'You draw your weapon and cut into the wall of thorns.\n\nThe vines twist around the blade, scraping against the metal as you hack your way through.\n\nBy the time the path opens, your hands are scratched and the floor is covered in broken briars.\n\nSomething sharp is still tangled around your weapon.'
      },
      {
        text: 'Burn the vines',
        condition: (gs, scene) => scene.hasFireballCard(),
        action: (gs, scene) => {
          scene.consumeFireballCard();
          scene.gainRandomAmulet();
        },
        outcomeFrame: 25,
        outcome: 'The vines twist and shrivel, filling the room with smoke and falling ash.\n\nWhen the fire dies, something small shines among the blackened roots.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You back away before the vines reach your boots.\n\nThe brambles slowly turn back toward the walls.'
      }
    ]
  };
