// Silkdeep month event: a silk-choked cave of cocoons that may hold loot — or
// the month's spiders. Inspect opens a custom 8-cocoon board; Fireball burns
// the nest and leaves only the rewards already cracked open.

export default {
  id: 'silk_cocoon_cache',
  title: 'The Silk Cache',
  description:
    'The passage widens into a low chamber. Silk hangs in sheets from the ceiling, '
    + 'and beneath it the floor is crowded with pale cocoons — some the size of a fist, '
    + 'some large enough to hold a man.\n\n'
    + 'Scattered between them: a buckled breastplate, a snapped spear, a glove still '
    + 'shaped around an empty hand. Someone fought here. Someone lost.\n\n'
    + 'The cocoons twitch when you breathe too loud.',
  choices: [
    {
      id: 'silk_cocoon_leave',
      text: 'Leave quietly',
      action: () => {},
      outcome:
        'You ease back into the corridor without touching a strand.\n\n'
        + 'Behind you the silk settles, and the twitching stops.',
    },
    {
      id: 'silk_cocoon_inspect',
      text: 'Search the cocoons',
      action: (gs, scene) => scene.beginSilkCocoonCache('inspect'),
      outcome:
        'You draw a blade and step into the silk.\n\n'
        + 'The nearest cocoon does not open when you cut it — it resists, tough as wet leather. '
        + 'You will have to break them properly.',
    },
    {
      id: 'silk_cocoon_burn',
      text: 'Burn them all!',
      condition: (gs, scene) => scene.hasFireballCard(),
      action: (gs, scene) => {
        scene.consumeFireballCard();
        scene.beginSilkCocoonCache('burn');
      },
      outcome:
        'The fireball takes the chamber in one breath.\n\n'
        + 'Silk blackens. Cocoons split and collapse. When the smoke thins, '
        + 'three scorched prizes lie open on the stone — and nothing moves to claim them.',
    },
  ],
};
