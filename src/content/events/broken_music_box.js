export function canStartMusicBox(gameState, locationId) {
  return locationId === 'tollroad' && (gameState?.storyRun?.boxState || 'unknown') === 'unknown';
}

export const MUSIC_BOX_OPENED_BY_KEY =
  'The lock gives. Inside, where the cylinder should turn, a cog is missing.\n\n'
  + 'The box looks at you — somehow — then grows two more legs and falls in behind you.';

export const MUSIC_BOX_OPENED_BY_FORCE =
  'The lid gives. Inside, where the cylinder should turn, a cog is missing.\n\n'
  + 'The box looks at you — somehow — then grows two more legs and falls in behind you.';

export const MUSIC_BOX_EXPLODED =
  'You pry at the lid. The music box plays one warning note, then explodes.\n\n'
  + 'When the smoke clears you are still standing.';

export const MUSIC_BOX_LEFT =
  'You step over it and keep walking.\n\n'
  + 'Ten steps later: small metal feet on the stones behind you.';

export default {
  id: 'broken_music_box',
  title: 'The Broken Music Box',
  description:
    'A small black music box lies under the rubble — lid cracked, one brass leg twitching.\n\n'
    + 'As you lean in, it plays three notes and snaps shut.',
  choices: [
    {
      id: 'music_box_force',
      text: 'Force it open',
      action: (gs, scene) => scene.beginMusicBoxForceOpen(),
      outcome: 'You pry at the lid.',
    },
    {
      id: 'music_box_key',
      text: 'Open it carefully',
      condition: (gs, scene) => scene.hasKeyCard() || scene.hasAmulet('skeletonKey'),
      action: (gs, scene) => scene.resolveMusicBoxOpened('key'),
      outcome: MUSIC_BOX_OPENED_BY_KEY,
    },
    {
      id: 'music_box_leave',
      text: 'Leave it alone',
      action: (gs, scene) => scene.resolveMusicBoxLeft(),
      outcome: MUSIC_BOX_LEFT,
    },
  ],
};
