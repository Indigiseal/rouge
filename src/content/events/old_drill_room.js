export default {
    id: 'old_drill_room',
    title: 'The Old Drill Room',
    description: 'You enter an old training room buried deep in the dungeon.\n\nBroken shields hang from the walls. Wooden targets lean in the corners, covered in claw marks, sword cuts, and small burned holes.\n\nThe floor is scratched with old practice circles.\n\nSomething in the room reacts to your companion cards.',
    choices: (gs, scene) => {
      const qualifying = scene.getQualifyingCompanions();
      if (qualifying.length === 0) {
        return [{
          text: 'Search the room',
          action: () => scene.gainCoins(5),
          outcome: 'You search the broken training room and find a few coins under an old shield.'
        }];
      }
      return qualifying.map(({ key, companion }) => ({
        text: scene.getCompanionTrainingChoiceLabel(companion),
        action: () => scene.trainCompanion(key),
        outcome: () => scene.companionTrainingOutcome
      }));
    }
  };
