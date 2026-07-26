export default {
    id: 'monster_bird_nest',
    title: 'Monster Bird Nest',
    description: 'A nest sits wedged between two fallen pillars — speckled eggs, bent keys, old buttons, and one small brass cog.\n\nIn your pack, the music box starts clicking.\n\nA shadow crosses the nest. Then again, lower.',
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
        outcome: 'You take the cog and nothing else, and you run.\n\nThe box rides quietly the rest of the way.'
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
        outcome: 'You take the cog and one warm egg. The mother catches you at the edge of the nest — her talons open your armor before you pull free.\n\nIn your pack, the box rattles. Grateful, or judging. Hard to say.'
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
        outcome: 'You leave it. The box clicks once, then stops.'
      }
    ]
  };
