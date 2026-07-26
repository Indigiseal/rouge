export default {
    id: 'hatching_egg',
    title: 'The Egg Hatches',
    description: 'The egg starts knocking against the inside of its card. Tap. Tap. Crack.\n\nThe music box scuttles underneath and catches the shell in its open lid.',
    choices: [
      {
        text: 'See what hatches',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('hatching_egg');
          scene.hatchEggIntoCompanion();
        },
        outcome: (gs) => gs?.storyRun?.chickHatched
          ? 'A chick kicks free, glares at the room, and test-fires a yellow spark into the wall.\n\nSatisfied, it climbs into your bag and claims a slot.\n\nChick Companion: 2 lightning damage after enemy turns.'
          : 'The shell taps once more, then goes still. Whatever was inside is already somewhere else.'
      }
    ]
  };
