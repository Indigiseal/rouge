export default {
    id: 'broken_music_box',
    title: 'The Broken Music Box',
    description: 'A small black music box lies under the rubble — lid cracked, one brass leg twitching.\n\nAs you lean in, it plays three notes and snaps shut.',
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
          ? 'You pry at the lid. The music box plays one warning note, then explodes.\n\nWhen the smoke clears you are still standing, and the floor around you is scattered with coins.'
          : 'You pry at the lid. The box explodes.'
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
        outcome: 'The lock gives. Inside, where the cylinder should turn, a cog is missing.\n\nThe box looks at you — somehow — then grows two more legs and falls in behind you.'
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
        outcome: 'You step over it and keep walking.\n\nTen steps later: small metal feet on the stones behind you.'
      }
    ]
  };
