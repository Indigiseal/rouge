export default {
    id: 'hatching_egg',
    title: 'The Egg Hatches',
    description: 'The warm egg in your inventory begins knocking against its card. Tap. Tap. CRACK.\n\nThe battered music box scuttles underneath and catches the egg in its open lid.',
    choices: [
      {
        text: 'See what hatches',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('hatching_egg');
          scene.hatchEggIntoCompanion();
        },
        outcome: (gs) => gs?.storyRun?.chickHatched
          ? 'A furious little chick kicks free of the shell, looks around, and fires a yellow spark into the wall. Satisfied, it climbs back into the same inventory slot.\n\nChick Companion: 2 lightning damage after enemy turns.'
          : 'The shell gives one final tap, then goes still. Whatever was inside has already escaped.'
      }
    ]
  };
