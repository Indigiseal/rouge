// The Soup Stand's next victim. Queued when the player ate the soup or walked
// past it (soup_stand.js), and shown at least ROBBED_TRAVELLER_DELAY floors on.
// The soup only puts people to sleep so the gang can rob them; nobody dies. An
// Antidote wakes him, and so does a Restoration card. He pays with the one
// thing the robbers missed.

export const ROBBED_TRAVELLER_DELAY = 2;
// What he has sewn into his collar.
export const ROBBED_TRAVELLER_AMULET = 'alchemistBag';

export default {
  id: 'robbed_traveller',
  title: 'The Robbed Traveller',
  description:
    'A man sits against the wall with his pack turned out beside him. His eyes are half shut. He sees you and tries to stand, and can\'t.\n\n'
    + '"There was a stand," he says. "Soup. Nobody there." He laughs, and it turns into a yawn. "They took everything."',
  choices: [
    {
      id: 'traveller_antidote',
      text: 'Give him your Antidote',
      condition: (gs, scene) => scene.hasAntidote(),
      action: (gs, scene) => scene.saveRobbedTraveller(),
      outcome: (gs, scene) => (scene.travellerPaid
        ? 'He drinks it in one go. After a while his eyes open properly and he sits up straight.\n\n'
          + 'He has nothing left to pay you with, except the one thing they missed. He unpicks his collar and puts it in your hand.'
        : 'He drinks it in one go. After a while his eyes open properly and he sits up straight.\n\n'
          + 'He unpicks his collar to pay you, and finds it empty. He looks at you for a long time. "Thank you," he says.'),
    },
    {
      id: 'traveller_restoration',
      text: 'Cast Restoration on him',
      condition: (gs, scene) => scene.hasRestorationMagic(),
      action: (gs, scene) => scene.saveRobbedTraveller('restoration'),
      outcome: (gs, scene) => (scene.travellerPaid
        ? 'You hold the card over him. The light goes into him and he sits up straight.\n\n'
          + 'He has nothing left to pay you with, except the one thing they missed. He unpicks his collar and puts it in your hand.'
        : 'You hold the card over him. The light goes into him and he sits up straight.\n\n'
          + 'He unpicks his collar to pay you, and finds it empty. He looks at you for a long time. "Thank you," he says.'),
    },
    {
      id: 'traveller_ask',
      text: 'Ask what happened',
      action: (gs, scene) => scene.askRobbedTraveller(),
      outcome:
        '"Three of them. A stand, a pot." He yawns. "Green scarves. I had one bowl and woke up like this. They took my antidotes."\n\n'
        + 'He tells you where they sleep. It isn\'t far.',
    },
    {
      id: 'traveller_food',
      text: 'Give him food',
      condition: (gs, scene) => scene.hasSpareFood(),
      action: (gs, scene) => scene.giveTravellerFood(),
      outcome:
        'He eats, and perks up enough to talk.\n\n'
        + '"My purse is in the lining," he says, and tells you where the gang sleeps. Then he nods off again, smiling.',
    },
    {
      id: 'traveller_search',
      text: 'Search his pack',
      action: (gs, scene) => scene.searchRobbedTraveller(),
      outcome:
        'There is a purse sewn into the lining. He watches you cut it out, too sleepy to stop you.\n\n'
        + '"Of course," he mumbles. "Of course you would."',
    },
    {
      id: 'traveller_leave',
      text: 'Leave him',
      action: (gs, scene) => scene.leaveRobbedTraveller(),
      outcome: 'You leave him dozing against the wall. He will wake up eventually.',
    },
  ],
};
