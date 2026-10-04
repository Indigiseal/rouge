// Silkdeep: a simple porter left behind by his party thinks he just got lost.
// Help him (armor, weapon or a potion) and he walks home through the corridor
// the player already cleared, leaving the party's map behind. The map is the
// Porter's Map amulet; taking it queues Voices Around the Corner.

const takeTheMap = {
  id: 'lost_porter_take_map',
  text: 'Take the map',
  action: (gs, scene) => scene.givePorterMap(),
  outcome:
    '"I don\'t think I\'m cut out for adventuring," he says. "Ma said so. I\'m going home."\n\n'
    + 'He presses the rolled map into your hands. "I only carried it because I carry everything."\n\n'
    + 'In one corner, in faded ink and a different hand, a passage is marked that you have never seen.\n\n'
    + 'He clanks away down your cleared corridor, humming, frying pan first.',
};

export default {
  id: 'lost_porter',
  title: 'The Lost Porter',
  description:
    'A side corridor has gone white with old web. Halfway along it, a man hangs upside down, '
    + 'wrapped to the armpits, holding a frying pan.\n\n'
    + '"Oh! Hello! Have you seen my party? They told me to hold the rope while they scouted ahead. So I held it."\n\n'
    + 'He lifts the end of the rope. It has been cut clean through.\n\n'
    + '"Must have snapped. Anyway, I think I\'m lost."',
  choices: [
    {
      id: 'lost_porter_armor',
      text: 'Give him your spare armor',
      condition: (gs, scene) => scene.hasSpareArmorCard(),
      action: (gs, scene) => scene.giveAwayWeakestCard('armor'),
      outcome:
        'You cut him down and help him into the armor. It is far too big. '
        + 'The helmet turns when he turns his head, a little after.\n\n'
        + '"It\'s like wearing a house," he says happily, and knocks on his own chest.',
      next: { choices: [takeTheMap] },
    },
    {
      id: 'lost_porter_weapon',
      text: 'Give him a weapon',
      condition: (gs, scene) => scene.hasWeaponCard(),
      action: (gs, scene) => scene.giveAwayWeakestCard('weapon'),
      outcome:
        'You cut him down and put a weapon in his hands. He holds it like a broom.\n\n'
        + '"I\'ll just wave it if anything\'s scary. Things don\'t like being waved at. I bet."',
      next: { choices: [takeTheMap] },
    },
    {
      id: 'lost_porter_heal',
      text: 'Heal him',
      condition: (gs, scene) => scene.hasPotion(),
      action: (gs, scene) => scene.giveAwayPotion(),
      outcome:
        'You cut him down. The web has left a red rash up both arms, and he has gone a little purple.\n\n'
        + 'He drinks your potion, blinks twice, and bounces on his toes. "Oh, that\'s much better. That\'s like breakfast."',
      next: { choices: [takeTheMap] },
    },
    {
      id: 'lost_porter_point',
      text: 'Point the way and walk on',
      action: (gs, scene) => scene.markPorterMet(false),
      outcome:
        'You cut him down and point back the way you came. "That way\'s safe. I already cleared it."\n\n'
        + 'He shakes your hand with both of his. "You\'re very kind. Everyone in this place is so kind."',
    },
  ],
};
