export default {
    id: 'book_worm',
    title: 'The Book Worm',
    description: 'You step into a quiet underground library.\n\nTall shelves vanish into the darkness above. Small lanterns drift between them.\n\nAt a reading desk, a dark elf woman is reading a huge book. She does not look up. You stand beside her awkwardly. She does not notice you.\n\nThen you see a pale book worm crawling across the open page. It drags itself slowly over the letters, eating a thin path through the ink.\n\nYou gently lift it from the book. The librarian finally looks at you.\n\n"Book worms," she says. "They ruin old spells if you let them feed too long."',
    choices: [
      {
        text: 'Feed it a magic card',
        condition: (gs, scene) => scene.hasMagicCard(),
        action: (gs, scene) => {
          scene.consumeMagicCard();
          scene.gainAmulet('mothWingDust');
        },
        outcomeFrame: 20,
        outcome: 'You hold out one of your magic cards.\n\nThe book worm sways toward it, then devours half the card quickly, as if it has been starving. Its pale body curls tight.\n\nThen it unfolds into a small library moth.\n\nThe moth circles once above your hand, shaking silver dust from its wings. You collect the dust in a small vial.\n\nThe librarian watches the moth disappear into the shelves.\n\n"Moths are better," she says. "They leave the books alone."'
      },
      {
        text: 'Squish the book worm',
        action: (gs, scene) => scene.gainAmulet('wormVenomCharm'),
        outcomeFrame: 21,
        outcome: 'You close your fingers around the book worm.\n\nIt leaves a smear of bitter green venom on your palm.\n\nThe librarian looks at it, then reaches for a tiny glass charm. She scrapes the venom inside and seals it.\n\n"Useful," she says, and gives it to you.'
      },
      {
        text: 'Put it back on the book',
        action: (gs, scene) => scene.gainAmulet('stolenInkPen'),
        outcomeFrame: 22,
        outcome: 'You put the book worm back on the page.\n\nIt immediately starts eating the next line.\n\nThe librarian stares at you. Then she says a quiet "Ugh," just loud enough for you to hear, gathers her things, and retreats deeper into the library.\n\nOn the desk, she leaves behind a black ink pen. You steal it.'
      }
    ]
  };
