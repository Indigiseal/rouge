const CARNIVAL_HAG_FRAME = 27;

export default {
    id: 'something_wicked',
    title: 'Something Wicked',
    description: 'You hear the carnival before you see it — crowd noise, and a happy tune played slightly wrong.\n\nThe corridor opens into a chamber strung with lanterns. Monsters crowd the prize booths. Everyone is smiling. No one looks at you.\n\nThen a hand closes on your shoulder. An old woman, a tray of trinkets pressed against your chest.\n\n"One coin. Wonderful things. Very cheap."\n\nHer grip does not loosen.',
    choices: [
      {
        text: 'Buy the dusty pipe',
        trayItem: 'dustyPipe',
        traySprite: 'carnivalPipe',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('dustyPipe'),
        outcome: 'You pay. Her fingers open.\n\nThe pipe smells of cold ash. When you look for her again, she is gone.'
      },
      {
        text: 'Buy the rubber duck',
        trayItem: 'rubberDuck',
        traySprite: 'carnivalDucky',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('rubberDuck'),
        outcome: 'You pay. Her fingers open.\n\nThe duck\'s painted eyes are nearly worn away. It still looks amused. When you look for her again, she is gone.'
      },
      {
        text: 'Buy the broken ring',
        trayItem: 'brokenRing',
        traySprite: 'carnivalRing',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('brokenRing'),
        outcome: 'You pay. Her fingers open.\n\nThe cracked gem catches no light at all. When you look for her again, she is gone.'
      },
      {
        text: 'Buy the four-leaf clover',
        trayItem: 'luckyClover',
        traySprite: 'luckyClover',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyLuckyClover(),
        outcome: 'You pay. Her fingers open.\n\nUnder the cloudy glass, the clover glitters green — once. When you look for her again, she is gone.'
      },
      {
        text: 'Refuse',
        trayRefuse: true,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.refuseCarnivalHag(),
        outcome: 'You twist free. Her nails catch your shoulder on the way out — three thin lines that sting longer than they should.'
      }
    ]
  };
