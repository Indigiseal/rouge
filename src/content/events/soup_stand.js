// A soup stand with nobody minding it: a robbers' trap. Shared: appears once
// per run in any location.
//
// Eating the soup poisons the player and costs half their coins. Eating it or
// walking past both leave the trap set, and a few floors on the player meets
// the next traveller who fell for it (robbed_traveller.js). Kicking the pot
// over ruins the trap, so that traveller never comes.

// Share of the player's coins the robbers take.
export const SOUP_ROBBERY_SHARE = 0.5;

export default {
  id: 'soup_stand',
  title: 'The Soup Stand',
  description:
    'A wooden stand against the wall. On it, a pot of soup, still steaming, a ladle and two clean bowls.\n\n'
    + 'You call out. Nobody answers. You call again, louder. Nothing.',
  choices: [
    {
      id: 'soup_eat',
      text: 'Eat the soup',
      action: (gs, scene) => scene.eatPoisonedSoup(),
      outcome:
        'It is good soup. You have a second bowl.\n\n'
        + 'Halfway through it your fingers go numb, and you understand why nobody was minding the stand. Too late.\n\n'
        + 'When you wake up the pot is gone, and so is half your purse.',
    },
    {
      id: 'soup_ignore',
      text: 'Leave it and keep going',
      action: (gs, scene) => scene.passSoupStand(),
      outcome: 'You leave the soup where it is and keep walking. Behind you it goes on steaming.',
    },
    {
      id: 'soup_kick',
      text: 'Kick the pot over',
      action: (gs, scene) => scene.kickSoupPot(),
      outcome:
        'You kick the pot off the stand. Soup runs across the stones, and where it pools, it fizzes.\n\n'
        + 'You keep walking.',
    },
  ],
};
