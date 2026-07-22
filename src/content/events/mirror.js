export default {
    id: 'mirror',
    title: 'The Copying Mirror',
    description: 'A tall silver mirror leans against the dungeon wall, humming faintly.\n\nDrag a card from your bag onto the mirror and it will conjure a perfect copy — then merge the pair right here if you like. Or simply walk on.',
    choices: [
      {
        text: 'Leave the mirror',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.mirrorSeen = true;
        },
        outcome: 'You step away. The mirror keeps humming to its own reflection.'
      }
    ]
  };
