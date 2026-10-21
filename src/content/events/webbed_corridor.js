// The crystal spider brood, grown. Shared: once per run, in an act where the
// hatchlings were left alive: the Old Chute's nest left or only one egg taken
// (storyRun.crystalBroodAct), or the Crystal Lair's door walked past
// (storyRun.crystalLairPassedAct). It comes a couple of floors later
// (EventScene.isWebbedCorridorDue).
//
// Cutting through is a fight with the brood; going round costs blood; food
// buys a way past, and they leave crystal behind.

// HP the rubble takes going round, and the crystal caught on the way.
export const CORRIDOR_ROUND_HP = 8;
export const CORRIDOR_ROUND_CRYSTALS = 1;
// Crystals the fed brood leaves.
export const CORRIDOR_FED_CRYSTALS = 2;
// Floors after the brood is left before the corridor can come.
export const CORRIDOR_DELAY_FLOORS = 2;

export default {
  id: 'webbed_corridor',
  title: 'The Webbed Corridor',
  description:
    'The corridor ahead is strung across with webs. The strands are thin and clear, and they catch the light like glass.\n\n'
    + 'Small crystal spiders sit along them, a dozen at least, each about the size of your hand. '
    + 'The ones nearest you turn to watch.',
  choices: [
    {
      id: 'corridor_cut',
      text: 'Cut through the webs',
      action: (gs, scene) => scene.cutWebbedCorridor(),
      outcome:
        'The first strand you cut rings like a wire.\n\n'
        + 'Every spider on the web turns toward you at once.',
    },
    {
      id: 'corridor_round',
      text: 'Go round through the rubble',
      action: (gs, scene) => scene.climbRoundWebbedCorridor(),
      outcome:
        'There is a gap where the wall has fallen in. You squeeze through it on your stomach and come out bleeding from both elbows.\n\n'
        + 'A strand of web has caught on your sleeve. By the time you pick it off, it has gone hard and clear.',
    },
    {
      id: 'corridor_feed',
      text: 'Toss them some food',
      condition: (gs, scene) => scene.hasSpareFood(),
      action: (gs, scene) => scene.feedWebbedCorridor(),
      outcome:
        'The food lands on the web and the nearest spiders are on it before it stops shaking.\n\n'
        + 'The rest climb up out of the way. Where they were sitting, the web has left a few shards of crystal behind.',
    },
    {
      id: 'corridor_leave',
      text: 'Turn back',
      action: () => {},
      outcome: 'You go back the way you came. Behind you, something ticks along the strands.',
    },
  ],
};
