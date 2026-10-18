const boxIntact = (gs) => gs?.storyRun?.boxState !== 'exploded';

export const NEST_TOOK_COG =
  'You take the cog and nothing else, and you run.\n\n'
  + 'The box rides quietly the rest of the way.';

export const NEST_TOOK_EGG =
  'You take one warm egg and run.\n\n'
  + 'A shadow crosses the stones behind you. Then again, lower.';

export const NEST_TOOK_BOTH =
  'You take the cog and one warm egg, and you run.\n\n'
  + 'In your pack, the box rattles. Grateful, or judging. Hard to say.';

export const NEST_TIMEOUT =
  'The shadow drops onto the nest. You run with nothing.';

export const NEST_LEFT =
  'You leave it. The box clicks once, then stops.';

export const NEST_LEFT_NO_BOX = 'You leave it.';

export default {
  id: 'monster_bird_nest',
  title: 'Monster Bird Nest',
  description: (gs) => {
    const shadow = 'A shadow crosses the nest. Then again, lower.';
    if (!boxIntact(gs)) {
      return `A nest sits wedged between two fallen pillars — speckled eggs, bent keys, old buttons.\n\n${shadow}`;
    }
    return 'A nest sits wedged between two fallen pillars — speckled eggs, bent keys, old buttons, and one small brass cog.\n\n'
      + `In your pack, the music box starts clicking.\n\n${shadow}`;
  },
  choices: [
    {
      id: 'nest_search',
      text: 'Search the nest',
      action: (gs, scene) => scene.beginBirdNestSearch(),
      outcome: 'You reach into the nest.',
    },
    {
      id: 'nest_leave',
      text: 'Leave it alone',
      action: (gs, scene) => scene.resolveBirdNestRaid({ tookCog: false, tookEgg: false, timedOut: false, left: true }),
      outcome: (gs) => (boxIntact(gs) ? NEST_LEFT : NEST_LEFT_NO_BOX),
    },
  ],
};
