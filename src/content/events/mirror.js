export default {
    id: 'mirror',
    title: 'The Copying Mirror',
    description: 'A tall silver mirror leans against the wall, humming to itself.\n\n(Drag a card from your bag onto it and it will conjure a perfect copy — merge the pair here if you like. Or walk on.)',
    choices: [
      {
        text: 'Leave the mirror',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.mirrorSeen = true;
        },
        outcome: 'You walk on. Behind you, the mirror keeps humming to its own reflection.'
      }
    ]
  };
