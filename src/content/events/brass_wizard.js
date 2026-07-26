export default {
    id: 'brass_wizard',
    title: 'The Brass Wizard',
    description: 'The carnival music thins out near a booth with cracked blue curtains.\n\nBehind the glass sits a fortune-telling machine: a brass wizard in a faded robe, painted stars mostly peeled away. Its mouth hangs open. Its pale eyes point at nothing.\n\nThe coin slot below the glass is polished bright from use.',
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
        outcome: 'You leave the slot empty.\n\nThe wizard watches you go, mouth open, holding a fortune it doesn\'t get to tell.'
      }
    ]
  };
