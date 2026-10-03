export default {
    id: 'book_worm',
    title: 'The Book Worm',
    description: 'An underground library. The shelves go up past the lantern light.\n\nAt the reading desk, a dark elf woman sits over an open book. She doesn\'t look up — not at your footsteps, not at your cough.\n\nThen you see the worm. Pale, slow, chewing a path through the ink. You lift it off the page.\n\nNow she looks up.\n\n"Book worms," she says. "They ruin old spells if they feed too long."',
    choices: [
      {
        text: 'Feed it a magic card',
        condition: (gs, scene) => scene.hasMagicCard(),
        action: (gs, scene) => {
          scene.consumeMagicCard();
          scene.gainAmulet('mothWingDust');
        },
        outcomeFrame: 20,
        outcome: 'You hold out a magic card. The worm devours half of it like it has been starving, curls tight — and unfolds into a small gray moth.\n\nIt circles your hand once, shedding silver dust. You catch what you can in a vial.\n\n"Moths are better," the librarian says. "They leave the books alone."'
      },
      {
        text: 'Squish the book worm',
        action: (gs, scene) => scene.gainAmulet('wormVenomCharm'),
        outcomeFrame: 21,
        outcome: 'You close your fist. The worm leaves a smear of bitter green venom across your palm.\n\nThe librarian studies it, scrapes it into a small glass charm, and hands the charm to you.\n\n"Useful," she says.'
      },
      {
        text: 'Put it back on the book',
        action: (gs, scene) => scene.gainAmulet('stolenInkPen'),
        outcomeFrame: 22,
        outcome: 'You set the worm back on the page. It resumes eating mid-sentence.\n\nThe librarian stares at you. Then she says a very quiet "ugh," gathers her things, and disappears into the shelves.\n\nShe leaves her ink pen on the desk. You take it.'
      }
    ]
  };
