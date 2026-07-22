export default {
    id: 'broken_music_box',
    title: 'The Broken Music Box',
    description: 'A tiny black music box lies half-buried under broken stones. Its lid is cracked. One little brass leg twitches under it.\n\nIt plays three tired notes, then clicks shut like it is embarrassed.',
    choices: [
      {
        text: 'Force it open',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('broken_music_box');
          gs.storyRun.boxState = 'exploded';
          gs.storyRun.boxFollowing = false;
          scene.markHeroMemory('learnedMusicBoxExplodes');
          // TODO: music_box_explosion can unlock a dedicated rare death relic later.
          scene.damagePlayer(35, 'music_box_explosion', 'Exploding Music Box');
          if ((gs.playerHealth || 0) > 0) {
            scene.gainCoins(16);
            scene.addPendingEvent('monster_bird_nest');
          }
        },
        outcome: (gs) => (gs?.playerHealth || 0) > 0
          ? 'You force the lid open. The music box plays one brave little note, then explodes in silver smoke. A crushed flute sound squeals through the rubble. Somehow, you are still standing.'
          : 'You force the lid open. The music box explodes with a sound like a flute being stepped on by fate.'
      },
      {
        text: 'Open it carefully',
        condition: (gs, scene) => scene.hasKeyCard() || scene.hasAmulet('skeletonKey'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('broken_music_box');
          const usesSkeletonKey = scene.hasAmulet('skeletonKey');
          scene.logStoryKeyChoice(usesSkeletonKey ? 'skeletonKey_broken_music_box' : 'key_card_broken_music_box');
          if (!usesSkeletonKey) scene.consumeKeyCard();
          gs.storyRun.boxState = 'opened';
          gs.storyRun.boxFollowing = true;
          scene.gainCrystals(1);
          scene.addPendingEvent('monster_bird_nest');
        },
        outcome: 'The lock gives a tiny click. The lid opens just enough to show a missing brass cog inside. The box clicks at you, grows two little legs, and climbs after you.'
      },
      {
        text: 'Leave it alone',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('broken_music_box');
          gs.storyRun.boxState = 'following';
          gs.storyRun.boxFollowing = true;
          scene.heal(5);
          scene.addPendingEvent('monster_bird_nest');
        },
        outcome: 'You walk away. After three steps, you hear tiny metal feet behind you. The music box is following you, playing louder whenever you pretend not to notice.'
      }
    ]
  };
