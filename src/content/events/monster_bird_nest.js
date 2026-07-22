export default {
    id: 'monster_bird_nest',
    title: 'Monster Bird Nest',
    description: 'You find a huge nest tucked between cracked stones. Inside are speckled eggs, old buttons, bent keys, shiny junk, and one tiny brass cog.\n\nThe music box in your backpack starts clicking like crazy. Click-click-click-click. It jumps against your bag and plays a tiny warning tune: Dun. Dun.\n\nA giant shadow slides over the nest. Mama bird is coming back.',
    choices: [
      {
        text: 'Grab just the cog',
        outcomeFrame: 10,
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('monster_bird_nest');
          gs.storyRun.boxHasCog = true;
          gs.storyRun.boxState = 'has_cog';
          scene.markHeroMemory('learnedBirdNestHasCog');
          scene.addPendingEvent('goblin_engineer');
        },
        outcome: 'You grab only the brass cog and run. The music box clicks so hard it almost sounds proud.'
      },
      {
        text: 'Grab the egg and the cog',
        outcomeFrame: 10,
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('monster_bird_nest');
          gs.storyRun.boxHasCog = true;
          gs.storyRun.boxState = 'has_cog';
          gs.storyRun.stoleBirdEgg = true;
          gs.storyRun.birdAngry = true;
          scene.markHeroMemory('learnedBirdNestHasCog');
          scene.addEggOrFallback();
          scene.damagePlayer(20, 'monster_bird_attack', 'Angry Nestmother');
          scene.damageEquippedArmor(1);
          scene.addPendingEvent('goblin_engineer');
        },
        outcome: 'You grab the cog and one warm egg. Mama bird slashes across your armor as you escape. The music box rattles in your bag like it is both grateful and judging you.'
      },
      {
        text: 'Leave the nest alone',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('monster_bird_nest');
          gs.storyRun.boxHasCog = false;
          scene.markHeroMemory('learnedBirdNestHasCog');
          scene.addPendingEvent('goblin_engineer');
        },
        outcome: 'You leave the nest untouched. The music box gives one small click from your bag, then goes quiet.'
      }
    ]
  };
