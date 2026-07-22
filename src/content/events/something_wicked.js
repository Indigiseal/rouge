const CARNIVAL_HAG_FRAME = 27;

export default {
    id: 'something_wicked',
    title: 'Something Wicked',
    description: 'In the dark of the dungeon, you hear voices.\n\nCrowd chatter. Laughter. A thin happy tune played slightly out of tune.\n\nThe corridor opens into a vast carnival chamber. Colored lanterns swing overhead. Monsters crowd the prize booths. Everyone is smiling. No one looks at you.\n\nThen a hand grabs your shoulder. You turn, ready to strike — an old woman stands too close, pressing a tray of dusty trinkets against your chest.\n\n"One coin," she says. "Wonderful things. Very cheap."\n\nHer grip does not move.',
    choices: [
      {
        text: 'Buy the dusty pipe',
        trayItem: 'dustyPipe',
        traySprite: 'carnivalPipe',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('dustyPipe'),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe pipe remains in your palm. It smells like cold ash.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Buy the rubber duck',
        trayItem: 'rubberDuck',
        traySprite: 'carnivalDucky',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('rubberDuck'),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe rubber duck remains in your palm. Its painted eyes are almost worn away.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Buy the broken ring',
        trayItem: 'brokenRing',
        traySprite: 'carnivalRing',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('brokenRing'),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe broken ring remains in your palm. The cracked gem catches no light.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Buy the four-leaf clover',
        trayItem: 'luckyClover',
        traySprite: 'luckyClover',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyLuckyClover(),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe clover remains in your palm, sealed under cloudy glass.\n\nFor one second, it glitters green.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Refuse',
        trayRefuse: true,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.refuseCarnivalHag(),
        outcome: 'You twist away from the old woman\'s grip.\n\nHer nails scrape your shoulder.\n\nShe watches you disappear into the carnival crowd without blinking.'
      }
    ]
  };
