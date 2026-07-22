export default {
    id: 'brass_wizard',
    title: 'The Brass Wizard',
    description: 'The carnival music leads you to a narrow booth with cracked blue curtains.\n\nBehind the glass sits an old fortune-telling machine.\n\nIt is shaped like a brass wizard in a faded blue robe. Old stars are painted across the robe, but most of the color has peeled away.\n\nThe wizard\'s pale eyes stare forward. They may have been blue once.\n\nIts puppet-like mouth hangs slightly open.\n\nA coin slot waits beneath the glass.',
    choices: [
      {
        text: 'Insert 1 coin',
        condition: (gs) => (gs?.coins || 0) >= 1,
        action: (gs, scene) => scene.insertBrassWizardCoin(),
        outcome: (gs, scene) => scene.brassWizardOutcome
      },
      {
        text: 'Leave the booth',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.brassWizardSeen = true;
          scene.clearPendingEvent('brass_wizard');
        },
        outcome: 'You leave the coin slot empty.\n\nThe brass wizard watches you through the dusty glass.\n\nIts mouth hangs open, waiting for a fortune it does not get to speak.'
      }
    ]
  };
