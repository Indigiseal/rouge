// The Soup Stand's next victim. Queued when the player ate the soup or walked
// past it (soup_stand.js), and shown at least ROBBED_TRAVELLER_DELAY floors on.
// An Antidote saves him, and he pays with the one thing the robbers missed.

export const ROBBED_TRAVELLER_DELAY = 2;
// What he has sewn into his collar.
export const ROBBED_TRAVELLER_AMULET = 'alchemistBag';

export default {
  id: 'robbed_traveller',
  title: 'The Robbed Traveller',
  description:
    'A man sits against the wall with his pack turned out beside him. His lips are blue. He sees you and tries to stand, and can\'t.\n\n'
    + '"There was a stand," he says. "Soup. Nobody there." He laughs, and it turns into a cough. "They took everything."',
  choices: [
    {
      id: 'traveller_antidote',
      text: 'Give him your Antidote',
      condition: (gs, scene) => scene.hasAntidote(),
      action: (gs, scene) => scene.saveRobbedTraveller(),
      outcome: (gs, scene) => (scene.travellerPaid
        ? 'He drinks it in one go. After a while the blue goes out of his lips.\n\n'
          + 'He has nothing left to pay you with, except the one thing they missed. He unpicks his collar and puts it in your hand.'
        : 'He drinks it in one go. After a while the blue goes out of his lips.\n\n'
          + 'He unpicks his collar to pay you, and finds it empty. He looks at you for a long time. "Thank you," he says.'),
    },
    {
      id: 'traveller_leave',
      text: 'Leave him',
      action: (gs, scene) => scene.leaveRobbedTraveller(),
      outcome: 'There is nothing you can do for him. You leave him sitting against the wall.',
    },
  ],
};
