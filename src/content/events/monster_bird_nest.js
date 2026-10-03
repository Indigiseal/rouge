const boxIntact = (gs) => gs?.storyRun?.boxState !== 'exploded';

export const NEST_TOOK_COG =
  'You free the brass cog and nothing else, and you run.\n\n'
  + 'In your pack the box goes quiet, as if a missing tooth had been promised back.';

export const NEST_TOOK_EGG =
  'You free one warm egg and run.\n\n'
  + 'The shadow drops behind you. The mother will not forget.';

export const NEST_TOOK_BOTH =
  'You free the cog and one warm egg. The box clicks once in your pack — grateful, or judging.\n\n'
  + 'The shadow drops behind you. The mother will not forget.';

export const NEST_TIMEOUT =
  'The shadow drops onto the nest. You leave what you came for and run.\n\n'
  + 'Whatever you meant to take stays behind.';

export const NEST_LEFT =
  'You step back from the nest.\n\nTen steps later the shadow crosses the stones where you were standing.';

export default {
  id: 'monster_bird_nest',
  title: 'Monster Bird Nest',
  description: (gs) => {
    const nest =
      'The pillars here are split the same way as the chamber of the box — something vast fought, then left. A nest is jammed in the wreckage: twigs, bent keys, old buttons, a warm egg, and one small brass cog that does not belong to any bird.';
    const shadow = 'A shadow crosses the nest. Then again, lower. The mother is still circling.';
    if (!boxIntact(gs)) {
      return `${nest}\n\nThe cog would have mattered, if you still had a box to put it in.\n\n${shadow}`;
    }
    return `${nest}\n\nIn your pack, the music box starts clicking. It knows its missing heart.\n\n${shadow}`;
  },
  choices: [
    {
      id: 'nest_search',
      text: 'Search the nest',
      action: (gs, scene) => scene.beginBirdNestSearch(),
      outcome:
        'You crouch at the rim. Junk is piled over the prize, and the shadow keeps coming back.',
    },
    {
      id: 'nest_leave',
      text: 'Leave it alone',
      action: (gs, scene) => scene.resolveBirdNestRaid({ tookCog: false, tookEgg: false, timedOut: false, left: true }),
      outcome: NEST_LEFT,
    },
  ],
};
