export default {
    id: 'old_drill_room',
    title: 'The Old Drill Room',
    description: 'An old training room. Broken shields on the walls, wooden targets in the corners — claw marks, sword cuts, small burned holes.\n\nPractice circles are scratched into the floor.\n\nSomething in the room reacts to your companion cards.',
    choices: (gs, scene) => {
      const qualifying = scene.getQualifyingCompanions();
      if (qualifying.length === 0) {
        return [{
          text: 'Search the room',
          action: () => scene.gainCoins(5),
          outcome: 'You go through the room properly — behind the targets, under the shields.\n\nA few coins somebody never came back for.'
        }];
      }
      return qualifying.map(({ key, companion }) => ({
        text: scene.getCompanionTrainingChoiceLabel(companion),
        action: () => scene.trainCompanion(key),
        outcome: () => scene.companionTrainingOutcome
      }));
    }
  };
