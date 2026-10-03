export default {
    id: 'briar_room',
    title: 'The Briar Room',
    description: 'The room is walled in briars — floor to ceiling, grown through a litter of old weapons and armor scraps.\n\nWhen you step in, the vines turn toward your bag.',
    choices: [
      {
        text: 'Offer a weapon or armor card',
        action: (gs, scene) => scene.beginBriarOffering(),
        outcome: 'Choose a weapon or armor card and drag it onto the briars.',
        next: {
          choices: [
            {
              text: 'Leave without offering a card',
              action: (gs, scene) => scene.cancelBriarOffering(),
              outcome: 'You back off before the vines reach your boots. Slowly, they settle against the walls.'
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
        outcome: 'You cut through. The thorns score your hands and wrap the blade all the way down.\n\nWhen you reach the far door, some are still knotted around it.'
      },
      {
        text: 'Burn the vines',
        condition: (gs, scene) => scene.hasFireballCard(),
        action: (gs, scene) => {
          scene.consumeFireballCard();
          scene.gainRandomAmulet();
        },
        outcomeFrame: 25,
        outcome: 'One fireball. The vines shrivel and drop, and the room fills with drifting ash.\n\nUnder the blackened roots, something small catches the light.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You keep to the corridor. The vines settle back against the walls.'
      }
    ]
  };
