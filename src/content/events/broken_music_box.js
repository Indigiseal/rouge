export const MUSIC_BOX_OPENED_BY_KEY =
  'The lock gives without a fight.\n\n'
  + 'Inside, a crude charge sits against the cylinder — easy to pinch out now that the lid is open. You set the powder aside.\n\n'
  + 'A larger cog, cut from resonating crystal, is already failing. It powderizes in your fingers. One shard remains.\n\n'
  + 'Where the cylinder should turn, a second cog is missing. Without it the melody cannot finish.\n\n'
  + 'Hidden panels click. Brass legs unfold. The box falls in behind you.';

export const MUSIC_BOX_OPENED_BY_FORCE =
  'The lock does not want to give. You force it anyway.\n\n'
  + 'Inside, a crude charge sits against the cylinder — easy to pinch out now that the lid is open. You set the powder aside.\n\n'
  + 'A larger cog, cut from resonating crystal, is already failing. It powderizes in your fingers. One shard remains.\n\n'
  + 'Where the cylinder should turn, a second cog is missing. Without it the melody cannot finish.\n\n'
  + 'Hidden panels click. Brass legs unfold. The box falls in behind you.';

export const MUSIC_BOX_EXPLODED =
  'You brace the lid and pull.\n\n'
  + 'The lock holds. The charge does not.\n\n'
  + 'When the smoke clears, the music box is a scatter of blackened brass. The melted heads on the floor suddenly make sense.';

export const MUSIC_BOX_LEFT =
  'You set it down and walk on.\n\n'
  + 'Ten steps later: small metal feet on the stones behind you. The lock is still shut.';

export default {
  id: 'broken_music_box',
  title: 'The Broken Music Box',
  description:
    'The chamber is a ruin. Columns that once held the ceiling lie in heaps, split the way old stone splits when something vast has finished fighting here.\n\n'
    + 'A short phrase of music threads the dust. You follow it through the rubble and find the source: a small music box, badly damaged, half-buried under a fallen capital.\n\n'
    + 'The moment you look at it, the last note cuts off. Snap.\n\n'
    + 'You lift it free. The works are a wreck, but the lock is shut tight. Around your feet, the floor is littered with other wind-up heads — boxes gone, casings crushed, some of them melted into slag.',
  choices: [
    {
      id: 'music_box_force',
      text: 'Force it open',
      action: (gs, scene) => scene.beginMusicBoxForceOpen(),
      outcome:
        'You brace the lid. Behind the cracked plate, brass wafers sit in two rows — pins, wards, and something darker that does not belong in a lock.',
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
