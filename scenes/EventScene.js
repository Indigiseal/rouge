// EventScene.js
// Unknown encounter events. Each event has a title, description, and a list of choices.
// Choices can have a condition (function returning bool) that hides them if not met.
// After a choice is made, an optional outcome message is shown before returning to the map.
// To add new events, add objects to the EVENTS array below.

import { CardDataGenerator } from '../CardDataGenerator.js';
import { loadHeroMemory, saveHeroMemory, saveStoryProgress } from '../utils/StoryProgress.js';

const EVENT_ILLUSTRATION_FRAMES = {
  burning_caravan: 3,
  robbed_hermit: 4,
  cheerful_hermit: 8,
  broken_music_box: 2,
  monster_bird_nest: 9,
  goblin_engineer: 12,
  hatching_egg: 9,
  caravan_aftermath: 3,
  quiet_crossroads: 7,
  mirror: 11,
  too_nice_room: 14,
  almost_you_well: 15,
  slimy_prison: 16,
  book_worm: 19,
  briar_room: 23,
  old_drill_room: 26
};

const EVENTS = [
  {
    id: 'burning_caravan',
    title: 'Burning Caravan',
    description: 'A spice caravan is half-stuck, half-burning, and fully chaotic. A little donkey is tangled in the reins. Bandits are running away with a sack of supplies. A merchant is yelling about cinnamon.',
    choices: [
      {
        text: 'Save the donkey',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.banditsEscaped = true;
          scene.addPendingEvent('robbed_hermit');
          scene.markHeroMemory('learnedDonkeyCanBeSaved');
          scene.heal(5);
        },
        outcome: 'You cut the donkey free. It bumps your shoulder gratefully, then trots away. In the distance, the bandits vanish with the supply sack.'
      },
      {
        text: 'Chase the bandits',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.donkeyLost = true;
          gs.storyRun.hermitState = 'safe';
          scene.gainCoins(15);
          scene.gainCrystals(1);
        },
        outcome: 'You sprint after the bandits and scatter them before they can cause more trouble. When you return, the donkey is gone.'
      },
      {
        text: 'Save the merchant crates',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.merchantGrateful = true;
          gs.storyRun.banditsEscaped = true;
          gs.storyRun.donkeyLost = true;
          scene.addPendingEvent('robbed_hermit');
          scene.gainCoins(25);
        },
        outcome: 'You drag the spice crates away from the flames. The merchant pays you with shaking hands. The donkey and bandits are both gone.'
      },
      {
        text: "Use a key to unlock the donkey's hitch",
        condition: (gs, scene) => scene.hasKeyCard() || scene.hasAmulet('skeletonKey'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          const usesSkeletonKey = scene.hasAmulet('skeletonKey');
          scene.logStoryKeyChoice(usesSkeletonKey ? 'skeletonKey_caravan_hitch' : 'key_card_caravan_hitch');
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.donkeyLost = false;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.banditsEscaped = false;
          gs.storyRun.hermitState = 'safe';
          scene.clearPendingEvent('robbed_hermit');
          if (!usesSkeletonKey) scene.consumeKeyCard();
          scene.markHeroMemory('solvedCaravanPerfectly');
          scene.gainCoins(10);
          scene.gainCrystals(1);
        },
        outcome: 'The lock gives way almost too easily. You free the donkey, then block the bandits before they reach the trees.'
      },
      {
        text: "Use Watcher's Lamp to reveal the bandits' path",
        condition: (gs, scene) => scene.hasAmulet('watchersLamp'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('watchersLamp_caravan_path');
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = false;
          gs.storyRun.donkeyLost = true;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.banditsEscaped = false;
          gs.storyRun.hermitState = 'safe';
          scene.clearPendingEvent('robbed_hermit');
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.gainCrystals(2);
        },
        outcome: "The lamp flickers toward the stolen sack. You suddenly understand where the bandits are headed and cut them off before they reach the hermit."
      },
      {
        text: 'Play a charming tune to calm the donkey',
        condition: (gs, scene) => scene.hasAmulet('charmingTune'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('charmingTune_caravan_donkey');
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.donkeyLost = false;
          gs.storyRun.banditsEscaped = true;
          gs.storyRun.banditsStopped = false;
          gs.storyRun.merchantGrateful = true;
          scene.addPendingEvent('robbed_hermit');
          scene.heal(10);
        },
        outcome: 'The tune settles the terrified donkey instantly. The merchant cheers, the donkey bows, and the bandits use the applause as cover to escape.'
      },
      {
        text: 'Sacrifice an unwanted card to block the road',
        condition: (gs, scene) => scene.hasSacrificeCard(),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('inventory_sacrifice_caravan_roadblock');
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.donkeyLost = false;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.banditsEscaped = false;
          gs.storyRun.hermitState = 'safe';
          scene.clearPendingEvent('robbed_hermit');
          scene.sacrificeFirstNonEssentialCard();
          scene.markHeroMemory('solvedCaravanPerfectly');
          scene.gainCoins(5);
        },
        outcome: 'You throw a spare card into the road at exactly the wrong angle. The bandits trip over destiny.'
      },
      {
        text: 'Trust your memory: save everyone',
        condition: (gs) => Boolean(
          gs?.heroMemory?.solvedCaravanPerfectly
          || (gs?.heroMemory?.learnedDonkeyCanBeSaved && gs?.heroMemory?.learnedBanditsThreatenHermit)
        ),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('hero_memory_caravan_perfect');
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.donkeyLost = false;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.banditsEscaped = false;
          gs.storyRun.merchantGrateful = true;
          gs.storyRun.hermitState = 'safe';
          scene.clearPendingEvent('robbed_hermit');
          scene.markHeroMemory('solvedCaravanPerfectly');
          scene.gainCoins(10);
          scene.gainCrystals(1);
          scene.heal(5);
        },
        outcome: 'You have seen every danger before it happens. Donkey, merchant, medicine, and soup all survive the afternoon.'
      }
    ]
  },
  {
    id: 'robbed_hermit',
    title: 'The Robbed Hermit',
    description: 'You find the old hermit beside an overturned soup pot. Bandits stole his medicine shelf and spilled something he insists was "structurally important soup."',
    choices: [
      {
        text: 'Help clean up',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'robbed';
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = 'helped_hermit';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.clearPendingEvent('robbed_hermit');
          scene.addPendingEvent('caravan_aftermath');
          if (!scene.repairRandomDamagedItem(1)) scene.heal(5);
        },
        outcome: 'The hermit grumbles, but he fixes what he can. "Next time," he mutters, "stop the soup criminals first."'
      },
      {
        text: 'Offer 10 coins for supplies',
        condition: (gs) => (gs?.coins || 0) >= 10,
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.coins = Math.max(0, (gs.coins || 0) - 10);
          gs.storyRun.hermitState = 'robbed';
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = 'supplied_hermit';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.clearPendingEvent('robbed_hermit');
          scene.addPendingEvent('caravan_aftermath');
          if (!scene.addPotionToInventory()) scene.heal(15);
        },
        outcome: 'He accepts the coins with wounded dignity and gives you a spare bottle from under his hat.'
      },
      {
        text: 'Leave quietly',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'robbed';
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = 'left_hermit';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.clearPendingEvent('robbed_hermit');
          scene.addPendingEvent('caravan_aftermath');
        },
        outcome: 'You leave the hermit arguing with his soup pot. You will remember what the escaped bandits did.'
      },
      {
        text: 'Use the Harvest Crown to remake the soup',
        condition: (gs, scene) => scene.hasAmulet('travelKitchen'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('travelKitchen_robbed_hermit_soup');
          gs.storyRun.hermitState = 'comforted';
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = 'comforted_hermit';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.clearPendingEvent('robbed_hermit');
          scene.addPendingEvent('caravan_aftermath');
          scene.heal(15);
          scene.gainCoins(5);
        },
        outcome: "You somehow rebuild the soup from three crumbs and one heroic bubble. The hermit stops yelling at the pot and calls you 'almost competent.'"
      },
      {
        text: "Use Watcher's Lamp to find the thieves' trail",
        condition: (gs, scene) => scene.hasAmulet('watchersLamp'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('watchersLamp_robbed_hermit_trail');
          gs.storyRun.hermitState = 'robbed';
          gs.storyRun.banditTrailFound = true;
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = 'found_bandit_trail';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.clearPendingEvent('robbed_hermit');
          scene.addPendingEvent('caravan_aftermath');
          scene.gainCrystals(1);
        },
        outcome: "The lamp reveals cinnamon footprints leading deeper into the dungeon. The hermit squints. 'That is either justice or very dirty baking.'"
      }
    ]
  },
  {
    id: 'cheerful_hermit',
    title: 'The Cheerful Hermit',
    description: 'The hermit is peacefully stirring soup in a dented helmet. He says fewer bandits means better soup weather.',
    choices: [
      {
        text: 'Listen to advice',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.cheerfulHermitVisited = true;
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = gs.storyRun.donkeySaved ? 'road_saved' : 'hermit_saved';
          scene.addPendingEvent('caravan_aftermath');
          if (!scene.repairRandomDamagedItem(1)) scene.heal(10);
        },
        outcome: 'He explains three impossible things about soup and somehow your gear feels better.'
      },
      {
        text: 'Ask for medicine',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.cheerfulHermitVisited = true;
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = gs.storyRun.donkeySaved ? 'road_saved' : 'hermit_saved';
          scene.addPendingEvent('caravan_aftermath');
          if (!scene.addPotionToInventory()) scene.heal(10);
        },
        outcome: 'He hands you a healing potion labeled "probably safe."'
      },
      {
        text: 'Compliment the soup',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.cheerfulHermitVisited = true;
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = gs.storyRun.donkeySaved ? 'road_saved' : 'hermit_saved';
          scene.addPendingEvent('caravan_aftermath');
          scene.heal(5);
        },
        outcome: 'The hermit beams. The soup bubbles approvingly.'
      },
      {
        text: 'Cook with the hermit',
        condition: (gs, scene) => scene.hasAmulet('travelKitchen'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('travelKitchen_cheerful_hermit_cook');
          scene.heal(20);
          scene.gainCoins(5);
          gs.storyRun.hermitState = 'friend';
          gs.storyRun.cheerfulHermitVisited = true;
          gs.storyRun.caravanResolved = true;
          gs.storyRun.caravanEnding = 'hermit_friend';
          scene.addPendingEvent('caravan_aftermath');
        },
        outcome: 'Together you create a soup so sturdy it may legally count as armor. The hermit gives you supplies for the road.'
      }
    ]
  },
  {
    id: 'caravan_aftermath',
    title: 'The Cinnamon Road',
    description: (gs) => {
      const story = gs?.storyRun || {};
      if (story.banditTrailFound) {
        return 'The cinnamon footprints end at an abandoned cache. The hermit recovers his medicine, and the merchant quietly rebuilds the road beside him.';
      }
      if (story.donkeySaved && story.banditsStopped) {
        return 'The caravan rolls again beneath a clean evening sky. The merchant, the hermit, and one extremely proud donkey are all arguing about who saved whom.';
      }
      if (story.donkeySaved) {
        return 'The rescued donkey returns pulling a patched little cart. The merchant has rebuilt what he can, while the hermit guards a fresh pot of soup.';
      }
      if (story.banditsStopped) {
        return 'The road is safe. The hermit has medicine, the merchant has new crates, and someone swears the missing donkey joined a richer caravan.';
      }
      if (story.hermitState === 'comforted') {
        return 'The losses remain, but the hermit has rebuilt his fire. He serves the merchant a bowl of heroic soup, and the cinnamon road begins again.';
      }
      return 'The burned caravan is gone. In its place stands a small roadside marker wrapped with a rein, a spice ribbon, and one stubborn soup spoon.';
    },
    choices: [
      {
        text: 'Share one last bowl of soup',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.finishStoryEpilogue('caravan', 'shared_soup');
          scene.heal(12);
        },
        outcome: 'The soup is too hot and exactly what the road needed. The story ends among friends.'
      },
      {
        text: "Accept the merchant's road gift",
        condition: (gs) => Boolean(gs?.storyRun?.merchantGrateful || gs?.storyRun?.banditsStopped),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.finishStoryEpilogue('caravan', 'accepted_gift');
          scene.gainCoins(18);
        },
        outcome: 'The merchant presses a cinnamon-scented purse into your hand. Behind him, the caravan finally starts moving forward.'
      },
      {
        text: "Scratch the donkey's ears",
        condition: (gs) => Boolean(gs?.storyRun?.donkeySaved),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.finishStoryEpilogue('caravan', 'thanked_donkey');
          scene.heal(8);
          scene.gainCrystals(1);
        },
        outcome: 'The donkey leans against you with enough force to count as a blessing. Its bell rings once as you leave the cinnamon road behind.'
      },
      {
        text: 'Recover the stolen medicine',
        condition: (gs) => Boolean(gs?.storyRun?.banditTrailFound),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.finishStoryEpilogue('caravan', 'recovered_medicine');
          scene.gainCrystals(2);
          scene.heal(5);
        },
        outcome: 'You return the medicine shelf intact. The hermit calls this acceptable heroism, which appears to be his highest praise.'
      }
    ]
  },
  {
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
  },
  {
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
  },
  {
    id: 'goblin_engineer',
    title: 'Goblin Engineer',
    description: (gs) => {
      const intro = 'A goblin engineer pops out from behind a broken machine and points at the music box.\n\n"Oh. Sleepy Snatch Box. Old robber model. Plays song, puffs smoke, hero sleeps, pockets empty. Very illegal. Very profitable."\n\nThe music box hides behind your boot. The goblin squints. "Yours is broken. Also emotionally confused."';
      const cogLine = gs?.storyRun?.boxHasCog
        ? '"Ah! You found its heart cog. I can prepare the casing. Maybe it becomes useful. Maybe it becomes smoke."'
        : '"No cog? Bad. I can still fake the repair. Goblin confidence: fifty percent."';
      return `${intro}\n\n${cogLine}`;
    },
    choices: [
      {
        text: 'Refuse to pay',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.boxPrep = 'none';
          gs.storyRun.boxRepairChance = 50;
          scene.markHeroMemory('learnedEngineerCanRepairBox');
          scene.resolveBoxRepair('You refuse to pay. The goblin shrugs. "Free repair is still repair. Just shorter."');
        },
        outcome: (gs, scene) => scene.boxRepairOutcome
      },
      {
        text: 'Give him an unwanted card for spare parts',
        condition: (gs, scene) => Boolean(gs?.storyRun?.boxHasCog && scene.hasSacrificeCard()),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.sacrificeFirstNonEssentialCard();
          gs.storyRun.boxPrep = 'cheap';
          gs.storyRun.boxRepairChance = 80;
          scene.markHeroMemory('learnedEngineerCanRepairBox');
          scene.resolveBoxRepair('The goblin chews thoughtfully on your spare card, then bolts part of it into the music box. "Good enough for machines with low standards."');
        },
        outcome: (gs, scene) => scene.boxRepairOutcome
      },
      {
        text: 'Pay 30 coins for full repair',
        condition: (gs) => Boolean(gs?.storyRun?.boxHasCog && (gs?.coins || 0) >= 30),
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.coins = Math.max(0, (gs.coins || 0) - 30);
          gs.storyRun.boxPrep = 'full';
          gs.storyRun.boxRepairChance = 100;
          scene.markHeroMemory('learnedEngineerCanRepairBox');
          scene.resolveBoxRepair('You pay the goblin. He suddenly becomes professional, which is alarming. He opens the casing and prepares the perfect place for the cog.');
        },
        outcome: (gs, scene) => scene.boxRepairOutcome
      }
    ]
  },
  {
    id: 'hatching_egg',
    title: 'The Egg Hatches',
    description: 'The warm egg in your inventory begins knocking against its card. Tap. Tap. CRACK.\n\nThe battered music box scuttles underneath and catches the egg in its open lid.',
    choices: [
      {
        text: 'See what hatches',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('hatching_egg');
          scene.hatchEggIntoCompanion();
        },
        outcome: (gs) => gs?.storyRun?.chickHatched
          ? 'A furious little chick kicks free of the shell, looks around, and fires a yellow spark into the wall. Satisfied, it climbs back into the same inventory slot.\n\nChick Companion: 2 lightning damage after enemy turns.'
          : 'The shell gives one final tap, then goes still. Whatever was inside has already escaped.'
      }
    ]
  },
  {
    id: 'too_nice_room',
    title: 'The Too-Nice Room',
    description: 'You find a beautiful little room tucked inside the dungeon wall.\n\nIt is sweet-scented and filled with flowers. A tiny table waits with a cup of tea, and on the bed lies a huge comforting blanket you could sink into completely.\n\nThe safest-looking place you have seen all day. That is suspicious.',
    choices: [
      {
        text: 'Rest in the bed',
        action: (gs, scene) => {
          scene.fullHeal();
          if (!scene.stealRandomCard()) {
            const before = gs.coins || 0;
            gs.coins = Math.max(0, before - 10);
            scene.gameScene?.updateUI?.();
            if (before - gs.coins > 0) scene._reward(`-${before - gs.coins} coins`);
          }
        },
        outcome: 'You sink into the soft bed and fall asleep almost instantly.\n\nWhen you wake up, your wounds are gone. So is one of your cards.\n\nSomewhere inside the wall, you hear tiny annoying laughter.'
      },
      {
        text: 'Leave the room',
        action: () => {},
        outcome: 'You back out of the room carefully. The pillow sighs in disappointment.'
      },
      {
        text: 'Inspect the room',
        action: () => {},
        outcomeFrame: 13, // reveal the fairy behind the cozy-room facade
        outcome: 'You look closer. The flowers are fake. The tea is cold. And behind the pillow, a tiny fairy is holding one of your cards and trying very hard not to giggle.',
        next: {
          choices: [
            {
              text: 'Confront the fairy',
              action: (gs, scene) => { scene.gainRandomAmulet(); },
              outcome: 'You lunge across the bed and grab the fairy by her wings. She freezes, then you pluck your stolen card back from her tiny arms.\n\nShe kicks and squeaks and throws a random amulet at your chest. "FINE! TAKE ONE! JUST LET GO!"\n\nThe instant you release her, the bed, tea, flowers and fairy are sucked into the wall like a stage prop.'
            },
            {
              text: 'Fight the fairy',
              action: (gs, scene) => {
                scene.loseHealthCapped(12);
                scene.loseActionPoints(4);
                scene.gainAmulet('teaRoomBell');
              },
              outcome: 'You swing your weapon. The fairy darts aside and snaps her fingers — a spell cracks through the room, your chest tightens and your action points drain.\n\nYou grab the tea table and smash it against the wall. The fairy tumbles down, defeated. "Fine. Take my shiniest one. I hope it rings forever."\n\nShe throws you a tiny golden bell, then the whole room folds into the wall and vanishes.'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'book_worm',
    title: 'The Book Worm',
    description: 'You step into a quiet underground library.\n\nTall shelves vanish into the darkness above. Small lanterns drift between them.\n\nAt a reading desk, a dark elf woman is reading a huge book. She does not look up. You stand beside her awkwardly. She does not notice you.\n\nThen you see a pale book worm crawling across the open page. It drags itself slowly over the letters, eating a thin path through the ink.\n\nYou gently lift it from the book. The librarian finally looks at you.\n\n“Book worms,” she says. “They ruin old spells if you let them feed too long.”',
    choices: [
      {
        text: 'Feed it a magic card',
        condition: (gs, scene) => scene.hasMagicCard(),
        action: (gs, scene) => {
          scene.consumeMagicCard();
          scene.gainAmulet('mothWingDust');
        },
        outcomeFrame: 20,
        outcome: 'You hold out one of your magic cards.\n\nThe book worm sways toward it, then devours half the card quickly, as if it has been starving. Its pale body curls tight.\n\nThen it unfolds into a small library moth.\n\nThe moth circles once above your hand, shaking silver dust from its wings. You collect the dust in a small vial.\n\nThe librarian watches the moth disappear into the shelves.\n\n“Moths are better,” she says. “They leave the books alone.”'
      },
      {
        text: 'Squish the book worm',
        action: (gs, scene) => scene.gainAmulet('wormVenomCharm'),
        outcomeFrame: 21,
        outcome: 'You close your fingers around the book worm.\n\nIt leaves a smear of bitter green venom on your palm.\n\nThe librarian looks at it, then reaches for a tiny glass charm. She scrapes the venom inside and seals it.\n\n“Useful,” she says, and gives it to you.'
      },
      {
        text: 'Put it back on the book',
        action: (gs, scene) => scene.gainAmulet('stolenInkPen'),
        outcomeFrame: 22,
        outcome: 'You put the book worm back on the page.\n\nIt immediately starts eating the next line.\n\nThe librarian stares at you. Then she says a quiet “Ugh,” just loud enough for you to hear, gathers her things, and retreats deeper into the library.\n\nOn the desk, she leaves behind a black ink pen. You steal it.'
      }
    ]
  },
  {
    id: 'briar_room',
    title: 'The Briar Room',
    description: 'You enter a narrow room covered in thorn vines.\n\nThey crawl over the walls, across the ceiling, and down between the stones.\n\nThe floor is littered with old broken weapons and scraps of armor caught in the brambles.\n\nAs you step inside, the vines slowly turn toward your inventory.',
    choices: [
      {
        text: 'Offer a weapon or armor card',
        action: (gs, scene) => scene.beginBriarOffering(),
        outcome: 'Choose a weapon or armor card from your inventory and drag it onto the briars.',
        next: {
          choices: [
            {
              text: 'Leave without offering a card',
              action: (gs, scene) => scene.cancelBriarOffering(),
              outcome: 'You back away before the vines reach your boots.\n\nThe brambles slowly turn back toward the walls.'
            }
          ]
        }
      },
      {
        text: 'Slash through the vines',
        action: (gs, scene) => {
          scene.loseHealthCapped(10);
          scene.gainRareThornsCard();
        },
        outcomeFrame: 24,
        outcome: 'You draw your weapon and cut into the wall of thorns.\n\nThe vines twist around the blade, scraping against the metal as you hack your way through.\n\nBy the time the path opens, your hands are scratched and the floor is covered in broken briars.\n\nSomething sharp is still tangled around your weapon.'
      },
      {
        text: 'Burn the vines',
        condition: (gs, scene) => scene.hasFireballCard(),
        action: (gs, scene) => {
          scene.consumeFireballCard();
          scene.gainRandomAmulet();
        },
        outcomeFrame: 25,
        outcome: 'The vines twist and shrivel, filling the room with smoke and falling ash.\n\nWhen the fire dies, something small shines among the blackened roots.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You back away before the vines reach your boots.\n\nThe brambles slowly turn back toward the walls.'
      }
    ]
  },
  {
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
  },
  {
    id: 'almost_you_well',
    title: 'The Well of Almost-You',
    description: 'A stone well stands in the middle of the room, filled almost to the top with thick black water — more tar than water.\n\nYou lean over and see your reflection. But it is wrong: frizzled hair, cracked armor, and one card in its hand you have never seen.\n\n(Drag a weapon, armor or thorns card onto the well. It sinks — and a different item of the same rarity rises back in its place.)',
    choices: [
      {
        text: 'Reach into the well',
        action: (gs, scene) => {
          scene.loseHealthCapped(15);
          if (scene.damageEquippedArmor(1)) scene._reward('Armor -1 pip');
          scene.gainRandomAmulet();
        },
        outcome: 'You push your hand into the black water. It is cold — then it grabs back. For a moment your arm is somewhere else: another room, another run, another ending. You pull free with something clenched in your fist. Your reflection is smiling now.'
      },
      {
        text: 'Drop a crystal into the well',
        condition: (gs) => (gs?.crystals || 0) >= 1,
        action: (gs, scene) => {
          const before = gs.crystals || 0;
          gs.crystals = Math.max(0, before - 1) + 4;
          scene.gameScene?.updateUI?.();
          scene._reward(`+${gs.crystals - before} crystals`);
        },
        outcome: 'You drop one crystal into the black water. It falls upward. Your reflection catches it, studies it, and drops something back. Four crystals rise from the well and clatter onto the stone.'
      },
      {
        text: 'Walk away',
        action: () => {},
        outcome: 'You step back from the well. Your reflection stays where it is. Then, one second too late, it also steps back.'
      }
    ]
  },
  {
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
  },
  {
    id: 'slimy_prison',
    title: 'The Slimy Prison',
    description: 'A gelatinous cube blocks the hallway.\n\nAt first, you think there is just an old skeleton floating inside it. Then the skeleton moves. Torn mage robes drift around him like weeds in water. A green glow crawls over his ribs, rebuilding the bones as fast as the cube eats them away.\n\nThe skeleton mage turns his skull toward you and opens his jaw. Green light burns in his empty eye sockets.',
    choices: [
      {
        text: 'Pull him free',
        outcomeFrame: 17,
        action: (gs, scene) => {
          scene.damagePlayer(10, 'gelatinous_cube', 'The Slimy Prison');
          scene.gainSkeletonWarriorCompanion();
        },
        outcome: 'You drag the skeleton mage out of the cube.\n\nSlime drips from his torn robes as he places a slimy card in your hand. A Skeleton Warrior is painted on it, holding a cracked sword.\n\nThe mage nods once. A dark portal opens behind him, and he vanishes.'
      },
      {
        text: 'End his suffering',
        outcomeFrame: 18,
        action: (gs, scene) => scene.gainRandomCursedAmulet(),
        outcome: 'You raise your weapon and strike through the cube.\n\nThe green spell inside the mage’s ribs cracks. For the first time, the bones stop healing. The skeleton mage sinks slowly into the slime.\n\nA dark amulet rises from what is left of him.'
      },
      {
        text: 'Grab the floating amulet',
        outcomeFrame: 16,
        action: (gs, scene) => {
          scene.damagePlayer(8, 'gelatinous_cube', 'The Slimy Prison');
          scene.gainRandomNonCursedAmulet();
        },
        outcome: 'There is an amulet floating near the mage’s ribs.\n\nYou ignore his reaching hand and shove your arm into the cube. The slime burns your skin as you pull the amulet free.\n\nThe skeleton mage watches you through the black-green glass. He remains trapped.'
      }
    ]
  },
  {
    id: 'quiet_crossroads',
    title: 'Quiet Crossroads',
    description: 'For once, the road is only strange in the normal dungeon way.',
    choices: [
      {
        text: 'Gain 10 coins',
        action: (gs, scene) => scene.gainCoins(10),
        outcome: 'You pocket the coins and move on.'
      },
      {
        text: 'Heal 5 HP',
        action: (gs, scene) => scene.heal(5),
        outcome: 'You rest briefly and feel a little better.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You decide not to linger.'
      }
    ]
  }
];

export class EventScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EventScene' });
  }

  init(data = {}) {
    this.gameState = data.gameState || {};
    this.gameScene = this.scene?.get?.('GameScene');
    this.ensureStoryState();
    this.event = this._pickEvent();
    this.resolved = false;
  }

  _pickEvent() {
    this.ensureStoryState();
    const story = this.gameState.storyRun;

    const forcedId = this._getForcedEventId();
    if (forcedId && (forcedId !== 'hatching_egg' || this.canShowEggHatchingEvent())) {
      return this.getEventById(forcedId);
    }

    if (story.pendingEvents.includes('robbed_hermit')) return this.getEventById('robbed_hermit');
    if (story.pendingEvents.includes('caravan_aftermath')) return this.getEventById('caravan_aftermath');
    if (story.pendingEvents.includes('monster_bird_nest')) return this.getEventById('monster_bird_nest');
    if (
      story.pendingEvents.includes('goblin_engineer')
      && story.boxState !== 'unknown'
      && !story.latchboxRewardClaimed
    ) return this.getEventById('goblin_engineer');
    if (story.pendingEvents.includes('hatching_egg')) {
      if (this.canShowEggHatchingEvent()) return this.getEventById('hatching_egg');
      story.pendingEvents = story.pendingEvents.filter(id => id !== 'hatching_egg');
    }
    // Fresh profiles used to be forced into the donkey caravan before every
    // other storyline. Randomize the two unresolved story openers; the one not
    // selected remains unresolved and naturally appears later.
    if (story.caravanSeen === false && story.boxState === 'unknown') {
      return this.getEventById(Math.random() < 0.5 ? 'burning_caravan' : 'broken_music_box');
    }
    if (story.caravanSeen === false) return this.getEventById('burning_caravan');
    if (story.banditsStopped === true && story.hermitState === 'safe' && !story.cheerfulHermitVisited) {
      return this.getEventById('cheerful_hermit');
    }
    if (story.caravanResolved && !story.caravanEpilogueSeen) return this.getEventById('caravan_aftermath');
    if (story.boxState === 'unknown') return this.getEventById('broken_music_box');
    // Once the main story beats are past, offer a special bonus room (copying
    // mirror / too-nice room) once each per run, chosen at random, before
    // falling back to the plain filler.
    const bonusFillers = [];
    if (!story.mirrorSeen) bonusFillers.push('mirror');
    if (!story.tooNiceRoomSeen) bonusFillers.push('too_nice_room');
    if (!story.wellSeen) bonusFillers.push('almost_you_well');
    if (!story.slimyPrisonSeen) bonusFillers.push('slimy_prison');
    if (!story.bookWormSeen) bonusFillers.push('book_worm');
    if (!story.briarRoomSeen) bonusFillers.push('briar_room');
    if (this.getQualifyingCompanions().length > 0) bonusFillers.push('old_drill_room');
    if (bonusFillers.length > 0) {
      return this.getEventById(bonusFillers[Math.floor(Math.random() * bonusFillers.length)]);
    }
    return this.getEventById('quiet_crossroads');
  }

  getEventById(id) {
    const resolvedId = id === 'singing_box' ? 'broken_music_box' : id;
    return EVENTS.find(event => event.id === resolvedId) || EVENTS[0];
  }

  _getForcedEventId() {
    try {
      if (typeof window === 'undefined') return null;
      const requestedId = new URLSearchParams(window.location.search).get('event');
      if (!requestedId) return null;
      const resolvedId = requestedId === 'singing_box' ? 'broken_music_box' : requestedId;
      const forceable = new Set(['broken_music_box', 'monster_bird_nest', 'goblin_engineer', 'hatching_egg', 'mirror', 'too_nice_room', 'almost_you_well', 'slimy_prison', 'book_worm', 'briar_room', 'old_drill_room']);
      return forceable.has(resolvedId) ? resolvedId : null;
    } catch {
      return null;
    }
  }

  ensureStoryState() {
    if (!this.gameState) this.gameState = {};

    const defaultStoryRun = {
      caravanSeen: false,
      donkeySaved: false,
      donkeyLost: false,
      banditsStopped: false,
      banditsEscaped: false,
      merchantGrateful: false,
      hermitState: 'unknown',
      banditTrailFound: false,
      cheerfulHermitVisited: false,
      caravanResolved: false,
      caravanEnding: 'unresolved',
      caravanEpilogueSeen: false,
      caravanEpilogueChoice: 'none',
      boxState: 'unknown',
      boxFollowing: false,
      boxHasCog: false,
      boxPrep: 'none',
      boxRepairChance: 50,
      birdAngry: false,
      stoleBirdEgg: false,
      latchboxRewardClaimed: false,
      goblinEngineerResolved: false,
      chickHatched: false,
      skeletonCompanionObtained: false,
      angryNestmotherRollFloor: null,
      mirrorSeen: false,
      tooNiceRoomSeen: false,
      wellSeen: false,
      slimyPrisonSeen: false,
      bookWormSeen: false,
      briarRoomSeen: false,
      pendingEvents: []
    };

    const defaultHeroMemory = {
      learnedBanditsThreatenHermit: false,
      learnedDonkeyCanBeSaved: false,
      solvedCaravanPerfectly: false,
      learnedMusicBoxExplodes: false,
      learnedBirdNestHasCog: false,
      learnedEngineerCanRepairBox: false,
      chickRareShopUnlocked: false,
      skeletonRareShopUnlocked: false
    };

    const existingStoryRun = this._isPlainObject(this.gameState.storyRun)
      ? this.gameState.storyRun
      : {};
    const retiredEventIds = new Set([
      'singing_box',
      'masked_duelist',
      'tiny_thief_bird',
      'missing_bard_camp',
      'last_refrain'
    ]);
    const pendingEvents = Array.isArray(existingStoryRun.pendingEvents)
      ? [...new Set(existingStoryRun.pendingEvents.filter(id => (
        typeof id === 'string' && !retiredEventIds.has(id)
      )))]
      : [];
    const inferredCaravanResolved = Boolean(
      existingStoryRun.caravanSeen
      && ['robbed', 'comforted', 'friend'].includes(existingStoryRun.hermitState)
    );
    this.gameState.storyRun = {
      ...defaultStoryRun,
      ...existingStoryRun,
      caravanResolved: typeof existingStoryRun.caravanResolved === 'boolean'
        ? existingStoryRun.caravanResolved
        : inferredCaravanResolved,
      caravanEnding: typeof existingStoryRun.caravanEnding === 'string'
        ? existingStoryRun.caravanEnding
        : inferredCaravanResolved ? 'legacy_resolved' : defaultStoryRun.caravanEnding,
      caravanEpilogueSeen: Boolean(existingStoryRun.caravanEpilogueSeen),
      cheerfulHermitVisited: Boolean(existingStoryRun.cheerfulHermitVisited),
      hermitState: typeof existingStoryRun.hermitState === 'string'
        ? existingStoryRun.hermitState
        : defaultStoryRun.hermitState,
      boxState: typeof existingStoryRun.boxState === 'string'
        ? existingStoryRun.boxState
        : defaultStoryRun.boxState,
      boxFollowing: Boolean(existingStoryRun.boxFollowing),
      boxHasCog: Boolean(existingStoryRun.boxHasCog),
      boxPrep: ['none', 'cheap', 'full'].includes(existingStoryRun.boxPrep)
        ? existingStoryRun.boxPrep
        : defaultStoryRun.boxPrep,
      boxRepairChance: Number.isFinite(existingStoryRun.boxRepairChance)
        ? existingStoryRun.boxRepairChance
        : defaultStoryRun.boxRepairChance,
      birdAngry: Boolean(existingStoryRun.birdAngry),
      stoleBirdEgg: Boolean(existingStoryRun.stoleBirdEgg),
      latchboxRewardClaimed: Boolean(existingStoryRun.latchboxRewardClaimed),
      goblinEngineerResolved: typeof existingStoryRun.goblinEngineerResolved === 'boolean'
        ? existingStoryRun.goblinEngineerResolved
        : Boolean(existingStoryRun.latchboxRewardClaimed),
      chickHatched: Boolean(existingStoryRun.chickHatched),
      skeletonCompanionObtained: Boolean(existingStoryRun.skeletonCompanionObtained),
      angryNestmotherRollFloor: Number.isFinite(existingStoryRun.angryNestmotherRollFloor)
        ? existingStoryRun.angryNestmotherRollFloor
        : null,
      mirrorSeen: Boolean(existingStoryRun.mirrorSeen),
      tooNiceRoomSeen: Boolean(existingStoryRun.tooNiceRoomSeen),
      wellSeen: Boolean(existingStoryRun.wellSeen),
      slimyPrisonSeen: Boolean(existingStoryRun.slimyPrisonSeen),
      bookWormSeen: Boolean(existingStoryRun.bookWormSeen),
      briarRoomSeen: Boolean(existingStoryRun.briarRoomSeen),
      pendingEvents
    };

    const storedMemory = this._loadStoredHeroMemory();
    const existingMemory = this._isPlainObject(this.gameState.heroMemory)
      ? this.gameState.heroMemory
      : {};
    const heroMemory = { ...defaultHeroMemory };
    Object.keys(heroMemory).forEach(key => {
      heroMemory[key] = Boolean(existingMemory[key] || storedMemory[key]);
    });
    this.gameState.heroMemory = heroMemory;
  }

  hasAmulet(id) {
    const activeAmulets = Array.isArray(this.gameState?.activeAmulets)
      ? this.gameState.activeAmulets
      : [];
    return activeAmulets.some(amulet => amulet === id || amulet?.id === id);
  }

  hasRelic(id) {
    return Boolean(this.gameScene?.metaManager?.hasRelic?.(id));
  }

  hasKeyCard() {
    return this._findInventoryIndex(item => this._isKeyCard(item)) >= 0;
  }

  consumeKeyCard() {
    const index = this._findInventoryIndex(item => this._isKeyCard(item));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  }

  hasPotion() {
    return this._findInventoryIndex(item => this._isPotionCard(item)) >= 0;
  }

  consumePotion() {
    const index = this._findInventoryIndex(item => this._isPotionCard(item));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  }

  hasFoodCard() {
    return this._findInventoryIndex(item => item?.type === 'food') >= 0;
  }

  consumeFoodCard() {
    const index = this._findInventoryIndex(item => item?.type === 'food');
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  }

  hasMagicCard() {
    return this._findInventoryIndex(item => item?.type === 'magic') >= 0;
  }

  consumeMagicCard() {
    const index = this._findInventoryIndex(item => item?.type === 'magic');
    if (index < 0) return false;
    const card = this.getInventorySlots()[index];
    const removed = this._removeInventoryCard(index);
    if (removed) this._reward(`Fed magic card: ${card?.name || 'Magic Card'}`);
    return removed;
  }

  hasFireballCard() {
    return this._findInventoryIndex(item => (
      item?.type === 'magic' && item?.magicType === 'fireball'
    )) >= 0;
  }

  consumeFireballCard() {
    const index = this._findInventoryIndex(item => (
      item?.type === 'magic' && item?.magicType === 'fireball'
    ));
    if (index < 0) return false;
    const removed = this._removeInventoryCard(index);
    if (removed) this._reward('Consumed magic card: Fireball');
    return removed;
  }

  gainRareThornsCard() {
    const thorns = new CardDataGenerator().createThornsCard(
      this.gameState?.currentFloor || 1,
      'rare'
    );
    return this._deliverCardReward(thorns, 'Rare Thorns', 'Gained card: Rare Thorns');
  }

  hasSacrificeCard() {
    return this.getStoryInventorySlots().some(item => this._isSacrificeCard(item));
  }

  sacrificeFirstNonEssentialCard() {
    const slots = this.getStoryInventorySlots();
    const preferredTypes = new Set(['magic', 'food', 'thorns', 'weapon', 'armor']);
    const commonPreferredIndex = slots.findIndex(item => (
      this._isSacrificeCard(item)
      && item?.rarity === 'common'
      && preferredTypes.has(item?.type)
    ));
    const preferredIndex = slots.findIndex(item => (
      this._isSacrificeCard(item)
      && preferredTypes.has(item?.type)
    ));
    const commonIndex = slots.findIndex(item => (
      this._isSacrificeCard(item)
      && item?.rarity === 'common'
    ));
    const index = commonPreferredIndex >= 0
      ? commonPreferredIndex
      : preferredIndex >= 0
        ? preferredIndex
        : commonIndex >= 0
          ? commonIndex
          : slots.findIndex(item => this._isSacrificeCard(item));

    if (index < 0) return false;
    return this._removeStoryInventoryCard(index);
  }

  heal(amount) {
    if (!this.gameState || !Number.isFinite(amount)) return;
    if (typeof this.gameState.heal === 'function') {
      this.gameState.heal(amount);
      return;
    }

    const currentHealth = Number.isFinite(this.gameState.playerHealth)
      ? this.gameState.playerHealth
      : 0;
    const maxHealth = Number.isFinite(this.gameState.maxHealth)
      ? this.gameState.maxHealth
      : currentHealth + amount;
    this.gameState.playerHealth = Math.min(maxHealth, currentHealth + amount);
  }

  gainCoins(amount) {
    if (!this.gameState || !Number.isFinite(amount)) return;
    const currentCoins = Number.isFinite(this.gameState.coins) ? this.gameState.coins : 0;
    this.gameState.coins = currentCoins + amount;
  }

  gainCrystals(amount) {
    if (!this.gameState || !Number.isFinite(amount)) return;
    const currentCrystals = Number.isFinite(this.gameState.crystals) ? this.gameState.crystals : 0;
    this.gameState.crystals = currentCrystals + amount;
  }

  damagePlayer(amount, deathCause = 'environmental', killedBy = 'Dungeon Event') {
    if (!this.gameState || !Number.isFinite(amount) || amount <= 0) return;
    const currentHealth = Number.isFinite(this.gameState.playerHealth)
      ? this.gameState.playerHealth
      : 0;
    const actualDamage = Math.min(currentHealth, amount);
    this.gameState.playerHealth = Math.max(0, currentHealth - amount);

    if (actualDamage > 0 && typeof this.gameState.trackDamage === 'function') {
      this.gameState.trackDamage(actualDamage, 'environmental');
    }

    if (this.gameState.playerHealth <= 0) {
      this.gameState.lastDeathCause = deathCause;
      if (typeof this.gameState.setDeathCause === 'function') {
        this.gameState.setDeathCause(deathCause);
      } else if (this.gameState.damageTracking) {
        this.gameState.damageTracking.deathCause = deathCause;
      }
      this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
      if (this.gameScene) this.gameScene.killedBy = killedBy;
    }
  }

  addEggOrFallback() {
    const egg = new CardDataGenerator().createEggCard();
    if (this._addCardToInventory(egg)) return true;
    this.heal(5);
    return false;
  }

  hasEggCard() {
    return this.getInventorySlots().some(item => item?.id === 'monsterEgg' || item?.name === 'Egg');
  }

  hasChickCompanion() {
    return this.getInventorySlots().some(item => item?.id === 'chickCompanion');
  }

  canShowEggHatchingEvent() {
    this.ensureStoryState();
    const story = this.gameState.storyRun;
    return Boolean(
      story.goblinEngineerResolved
      && !story.chickHatched
      && !this.hasChickCompanion()
      && this.hasEggCard()
    );
  }

  queueEggHatchingEvent() {
    this.ensureStoryState();
    if (!this.canShowEggHatchingEvent()) return false;
    this.addPendingEvent('hatching_egg');
    return true;
  }

  hatchEggIntoCompanion() {
    this.ensureStoryState();
    if (!this.canShowEggHatchingEvent()) return false;
    const slots = this.getInventorySlots();

    const eggIndex = slots.findIndex(item => item?.id === 'monsterEgg' || item?.name === 'Egg');
    if (eggIndex < 0) return false;

    slots[eggIndex] = new CardDataGenerator().createChickCompanionCard();
    this.gameState.inventory = slots;
    this.gameState.storyRun.chickHatched = true;
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    return true;
  }

  damageEquippedArmor(amount = 1) {
    const armor = this.gameState?.equippedArmor;
    if (!armor || !Number.isFinite(amount) || amount <= 0) return false;
    const durability = Number(armor.durability);
    if (!Number.isFinite(durability)) return false;

    armor.durability = Math.max(0, durability - amount);
    if (armor.durability <= 0) this.gameState.equippedArmor = null;
    this.gameScene?.updateEquippedArmorPanel?.();
    this.gameScene?.updateUI?.();
    return true;
  }

  expandInventorySlots(additionalSlots = 1) {
    if (!this.gameState || !Number.isFinite(additionalSlots) || additionalSlots <= 0) return false;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const inventorySystem = this.gameScene?.inventorySystem;

    if (inventorySystem?.expandInventory) {
      inventorySystem.expandInventory(additionalSlots);
      this.gameState.inventory = inventorySystem.slots;
      return true;
    }

    const slots = this.getStoryInventorySlots();
    for (let i = 0; i < additionalSlots; i++) slots.push(null);
    this.gameState.inventory = slots;
    this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + additionalSlots;
    // TODO: promote Loyal Latchbox to a true cross-run meta upgrade if desired.
    return true;
  }

  resolveBoxRepair(prelude) {
    this.ensureStoryState();
    this.clearPendingEvent('goblin_engineer');
    const story = this.gameState.storyRun;
    story.goblinEngineerResolved = true;

    const requestedChance = Number.isFinite(story.boxRepairChance) ? story.boxRepairChance : 50;
    const chance = story.boxHasCog ? Math.max(0, Math.min(100, requestedChance)) : 50;
    story.boxRepairChance = chance;
    const succeeded = Math.random() * 100 < chance;

    if (succeeded) {
      story.boxState = 'repaired';
      story.latchboxRewardClaimed = true;
      story.boxFollowing = false;
      this.expandInventorySlots(1);
      this.boxRepairOutcome = `${prelude}\n\nThe music box snatches the cog, clicks once, then unfolds a hidden drawer from a place where no drawer should fit. Then another drawer opens. Then a third. It climbs into your pack like it has always belonged there.\n\nLoyal Latchbox: +1 inventory slot`;
      this.queueEggHatchingEvent();
      return true;
    }

    story.boxState = 'failed_repair';
    story.latchboxRewardClaimed = true;
    story.boxFollowing = false;
    this.gainCoins(12);
    this.gainCrystals(1);
    this.boxRepairOutcome = `${prelude}\n\nThe music box swallows the cog. It clicks. It coughs. A puff of sleepy smoke leaks out, followed by three embarrassed notes. Then it spits out a few valuables and refuses to discuss what happened.`;
    this.queueEggHatchingEvent();
    return false;
  }

  addPendingEvent(id) {
    if (typeof id !== 'string') return;
    this.ensureStoryState();
    if (!this.gameState.storyRun.pendingEvents.includes(id)) {
      this.gameState.storyRun.pendingEvents.push(id);
    }
  }

  clearPendingEvent(id) {
    if (typeof id !== 'string') return;
    this.ensureStoryState();
    this.gameState.storyRun.pendingEvents = this.gameState.storyRun.pendingEvents
      .filter(eventId => eventId !== id);
  }

  finishStoryEpilogue(thread, choice) {
    this.ensureStoryState();
    if (thread === 'caravan') {
      this.clearPendingEvent('caravan_aftermath');
      this.gameState.storyRun.caravanResolved = true;
      this.gameState.storyRun.caravanEpilogueSeen = true;
      this.gameState.storyRun.caravanEpilogueChoice = choice;
      return;
    }
  }

  markHeroMemory(key) {
    this.ensureStoryState();
    if (!(key in this.gameState.heroMemory)) return false;

    this.gameState.heroMemory[key] = true;
    this._saveStoredHeroMemory();
    return true;
  }

  addPotionToInventory() {
    const potion = new CardDataGenerator().createPotionCard(this.gameState?.currentFloor || 1);
    return this._addCardToInventory(potion);
  }

  repairRandomDamagedItem(amount) {
    if (!Number.isFinite(amount)) return false;

    const candidates = [];
    const addCandidate = (item) => {
      const durability = Number(item?.durability);
      const maxDurability = Number(item?.maxDurability);
      if (Number.isFinite(durability) && Number.isFinite(maxDurability) && durability < maxDurability) {
        candidates.push(item);
      }
    };

    this.getInventorySlots().forEach(addCandidate);
    addCandidate(this.gameState?.equippedWeapon);
    addCandidate(this.gameState?.equippedArmor);

    if (candidates.length === 0) return false;
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    item.durability = Math.min(Number(item.maxDurability), Number(item.durability) + amount);
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    this.gameScene?.updateEquippedArmorPanel?.();
    this.gameScene?.updateUI?.();
    return true;
  }

  getInventorySlots() {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const liveSlots = this.gameScene?.inventorySystem?.slots;
    if (Array.isArray(liveSlots)) return liveSlots;

    if (!this.gameState) return [];
    if (!Array.isArray(this.gameState.inventory)) {
      this.gameState.inventory = new Array(5).fill(null);
    }
    return this.gameState.inventory;
  }

  getStoryInventorySlots() {
    if (!this.gameState) return [];
    if (!Array.isArray(this.gameState.inventory)) {
      this.gameState.inventory = new Array(5).fill(null);
    }
    return this.gameState.inventory;
  }

  _addCardToInventory(card) {
    if (!card) return false;

    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    if (this.gameScene?.inventorySystem?.addCard) {
      return this.gameScene.inventorySystem.addCard(card);
    }

    const slots = this.getInventorySlots();
    const emptyIndex = slots.findIndex(item => item == null);
    if (emptyIndex < 0) return false;
    slots[emptyIndex] = card;
    this.gameState.inventory = slots;
    return true;
  }

  _removeInventoryCard(index) {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots) || index < 0 || index >= slots.length || !slots[index]) return false;

    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    if (this.gameScene?.inventorySystem?.removeCard) {
      this.gameScene.inventorySystem.removeCard(index);
      return true;
    }

    slots[index] = null;
    if (this.gameState) this.gameState.inventory = slots;
    return true;
  }

  _removeStoryInventoryCard(index) {
    const slots = this.getStoryInventorySlots();
    if (!Array.isArray(slots) || index < 0 || index >= slots.length || !slots[index]) return false;

    slots[index] = null;
    this.gameState.inventory = slots;
    if (this.gameScene?.inventorySystem?.slots === slots) {
      this.gameScene.inventorySystem.removeCard?.(index);
    }
    return true;
  }

  _findInventoryIndex(predicate) {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots)) return -1;

    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item) continue;
      if (predicate(item, i)) return i;
    }
    return -1;
  }

  _isKeyCard(item) {
    if (!item) return false;
    return item.type === 'key'
      || item.cardType === 'key'
      || item.id === 'key'
      || item.keyType === 'key'
      || item.sprite === 'keyCard';
  }

  _isPotionCard(item) {
    return item?.type === 'potion';
  }

  _isSacrificeCard(item) {
    return Boolean(
      item
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
      && !this._isKeyCard(item)
      && !this._isPotionCard(item)
    );
  }

  logStoryKeyChoice(choiceId) {
    if (typeof choiceId !== 'string') return;
    console.log('[EventScene] Story key choice used:', choiceId);
  }

  _isChoiceVisible(choice) {
    if (!choice?.condition) return true;
    try {
      return Boolean(choice.condition(this.gameState, this));
    } catch (error) {
      console.warn('Event choice condition failed', error);
      return false;
    }
  }

  _getVisibleChoices() {
    const choices = typeof this.event.choices === 'function'
      ? this.event.choices(this.gameState, this)
      : this.event.choices;
    return (Array.isArray(choices) ? choices : []).filter(choice => this._isChoiceVisible(choice));
  }

  _getEventDescription() {
    if (typeof this.event.description === 'function') {
      return this.event.description(this.gameState, this);
    }
    return this.event.description;
  }

  _getChoiceOutcome(choice) {
    if (typeof choice.outcome === 'function') {
      return choice.outcome(this.gameState, this);
    }
    return choice.outcome;
  }

  _getEventIllustrationFrame() {
    return EVENT_ILLUSTRATION_FRAMES[this.event?.id] ?? 7;
  }

  _createEventPaper(x, y) {
    // Shorter than before so the panel sits in the top region and never covers
    // the inventory strip (bottom ~110px) shown during the event.
    const paperWidth = 388;
    const paperHeight = 232;
    const startY = y + 34;
    let paper = null;
    if (this.textures.exists('eventPaper9Slice')) {
      const addNineSlice = this.add.nineslice || this.add.nineSlice;
      if (addNineSlice) {
        try {
          paper = addNineSlice.call(this.add, x, startY, 'eventPaper9Slice', null, paperWidth, paperHeight, 32, 32, 32, 32);
        } catch {
          paper = null;
        }
      }
    }

    if (paper) {
      paper.setDepth(0).setAlpha(0);
      this.tweens.add({
        targets: paper,
        y,
        alpha: 1,
        duration: 360,
        delay: 70,
        ease: 'Cubic.easeOut'
      });
      return;
    }

    if (this.textures.exists('eventPaper')) {
      paper = this.add.image(x, startY, 'eventPaper')
        .setDisplaySize(paperWidth, paperHeight)
        .setDepth(0)
        .setAlpha(0);
      this.tweens.add({
        targets: paper,
        y,
        alpha: 1,
        duration: 360,
        delay: 70,
        ease: 'Cubic.easeOut'
      });
      return;
    }

    paper = this.add.rectangle(x, startY, paperWidth, paperHeight, 0xd9b98e)
      .setStrokeStyle(2, 0x6c4f35)
      .setDepth(0)
      .setAlpha(0);
    this.tweens.add({
      targets: paper,
      y,
      alpha: 1,
      duration: 360,
      delay: 70,
      ease: 'Cubic.easeOut'
    });
  }

  _createEventBoardBase(x, y) {
    const boardTexture = this.textures.exists('gamingBoard2') ? 'gamingBoard2' : 'gamingBoard';
    if (!this.textures.exists(boardTexture)) return;
    // Shortened to match the compressed paper so the decorative board doesn't
    // spill over the inventory strip at the bottom of the screen.
    const board = this.add.image(x, y + 34, boardTexture)
      .setDisplaySize(456, 236)
      .setDepth(-1)
      .setAlpha(0);
    this.tweens.add({
      targets: board,
      y,
      alpha: 1,
      duration: 360,
      ease: 'Cubic.easeOut'
    });
  }

  _createEventIllustrationBoard(frame) {
    if (!this.textures.exists('gamingBoardSideSmall')) return;

    const targetX = 486;
    const slideDistance = 56;
    const container = this.add.container(targetX - slideDistance, 173).setDepth(-2).setAlpha(0);
    container.add(this.add.image(0, 0, 'gamingBoardSideSmall', 1).setOrigin(0.5));

    if (this.textures.exists('eventsShops')) {
      this.eventIllustrationImage = this.add.image(17, -5, 'eventsShops', frame)
        .setOrigin(0.5)
        .setScale(1);
      container.add(this.eventIllustrationImage);
    }

    this.eventIllustrationBoard = container;
    this.tweens.add({
      targets: container,
      x: targetX,
      alpha: 1,
      duration: 320,
      ease: 'Cubic.easeOut'
    });
  }

  _loadStoredHeroMemory() {
    return loadHeroMemory() || {};
  }

  _saveStoredHeroMemory() {
    saveHeroMemory(this.gameState.heroMemory);
  }

  _saveStoredStoryRun() {
    this.ensureStoryState();
    saveStoryProgress(this.gameState.storyRun);
  }

  _isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  create() {
    const W = 640, H = 360;
    const PURPLE = '#9370db';
    const INK = '#382615';
    const WHITE = '#ffffff';

    this.gameScene = this.scene.get('GameScene');
    this._visibleChoices = this._getVisibleChoices();
    this.eventLayout = {
      centerX: 255,
      textWidth: 312,
      buttonWidth: 324,
      buttonTextWidth: 300
    };

    // Keep the player's real inventory visible & interactive underneath the
    // event (the same "station" the shops use) so bread/potions can be used and
    // a slot freed mid-event — e.g. to actually receive the egg in the bird
    // nest. The event panel is laid out in the top ~2/3; the inventory owns the
    // bottom strip (below y≈250), so nothing opaque is drawn over it.
    this._enableEventStation();
    this.events.once('shutdown', () => {
      this.gameScene?.inventorySystem?.setDragOverlayScene?.(null);
    });

    // Background — dim only the top region so the bottom inventory strip shows
    // through on the dungeon floor (like combat) instead of being covered.
    this.add.rectangle(W / 2, 124, W, 250, 0x1a1a2e, 0.92).setDepth(-10);
    this._createEventIllustrationBoard(this._getEventIllustrationFrame());
    this._createEventBoardBase(this.eventLayout.centerX, 132);
    this._createEventPaper(this.eventLayout.centerX, 132);

    // The copying mirror and the well use their illustration as a card drop target.
    if (this.event?.id === 'mirror') this._setupMirrorDropZone();
    if (this.event?.id === 'almost_you_well') this._setupWellDropZone();

    // Title
    this.add.text(this.eventLayout.centerX, 26, this.event.title, {
      fontSize: '20px', fill: PURPLE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5).setDepth(2);

    // Description — top-anchored just under the title so a tall description
    // grows downward instead of overlapping the title.
    const eventDescription = this._getEventDescription();
    const veryCompactDescription = eventDescription.length > 450;
    const compactDescription = eventDescription.length > 280;
    this.descText = this.add.text(this.eventLayout.centerX, 42, eventDescription, {
      fontSize: veryCompactDescription ? '7px' : compactDescription ? '9px' : '12px', fill: INK, fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: compactDescription ? 328 : this.eventLayout.textWidth }
    }).setOrigin(0.5, 0).setDepth(2);

    // Divider — below the description (derived from its real height), above the
    // choice stack. Capped so a very tall description still leaves room for the
    // choices above the inventory strip.
    const dividerY = Math.min(150, 42 + this.descText.height + 8);
    this.dividerRect = this.add.rectangle(this.eventLayout.centerX, dividerY, 340, 1, 0x8f6b45).setDepth(2);
    this._choiceTopY = dividerY + 8;

    // Choice buttons
    this._choiceBtns = [];
    this._buildChoices();

    // Outcome text (hidden until a choice is made). Positioned on resolve so it
    // stays within the panel, above the inventory strip.
    this.outcomeText = this.add.text(this.eventLayout.centerX, 150, '', {
      fontSize: '11px',
      fill: '#fff2d0',
      fontFamily: '"HoMM Pixel"',
      align: 'center',
      wordWrap: { width: 330 }
    }).setOrigin(0.5).setAlpha(0);
    this.outcomeText.setDepth(4);

    // Give terminal narration its own high-contrast reading surface instead of
    // letting it compete with the event art and the consequences ledger.
    this.outcomeBackdrop = this.add.rectangle(this.eventLayout.centerX, 145, 354, 184, 0x1b120c, 0.82)
      .setStrokeStyle(1, 0x8f6b45)
      .setAlpha(0)
      .setDepth(3);
    this.outcomeLabel = this.add.text(this.eventLayout.centerX, 50, 'Outcome', {
      fontSize: '11px',
      fill: PURPLE,
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(4);

    // Rewards summary (hidden until a choice is made) — a concrete "what you
    // gained/lost" list shown under the outcome, so amulets/HP/crystals that
    // otherwise land silently in the corners are actually announced.
    this.rewardText = this.add.text(this.eventLayout.centerX, 200, '', {
      fontSize: '12px',
      fill: '#ffe066',
      fontFamily: '"HoMM Pixel"',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: this.eventLayout.textWidth }
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(4);

    // Continue button (hidden until resolved). Lives in the top-right corner —
    // like the shops' Next button — so it never overlaps the inventory strip.
    const continueX = 595, continueY = 50;
    if (this.textures.exists('nextTurnUp')) {
      this.continueBtn = this.add.image(continueX, continueY, 'nextTurnUp')
        .setInteractive({ useHandCursor: true })
        .setAlpha(0)
        .setDepth(2);
    } else {
      this.continueBtn = this.add.rectangle(continueX, continueY, 78, 28, 0x080808, 0.66)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0)
        .setDepth(2);
    }
    this.continueBtnText = this.add.text(continueX, continueY, 'Continue', {
      fontSize: '12px', fill: WHITE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5).setAlpha(0).setDepth(3);

    this.continueBtn.on('pointerdown', () => {
      if (this.continueBtn.setTexture && this.textures.exists('nextTurnDown')) {
        this.continueBtn.setTexture('nextTurnDown');
      }
    });
    this.continueBtn.on('pointerup', () => this.continueAdventure());
    this.continueBtn.on('pointerover', () => {
      if (this.continueBtn.setTint) this.continueBtn.setTint(0xfff2c8);
      else this.continueBtn.setFillStyle?.(0x151515, 0.78);
    });
    this.continueBtn.on('pointerout', () => {
      if (this.continueBtn.clearTint) {
        this.continueBtn.clearTint();
        if (this.continueBtn.setTexture && this.textures.exists('nextTurnUp')) this.continueBtn.setTexture('nextTurnUp');
      } else {
        this.continueBtn.setFillStyle?.(0x080808, 0.66);
      }
    });
  }

  _buildChoices() {
    const choices = this._visibleChoices || this._getVisibleChoices();
    const n = choices.length;
    const layout = this.eventLayout || {
      centerX: 255,
      buttonWidth: 324,
      buttonTextWidth: 300
    };

    // The choice stack must fit between the divider and the inventory strip.
    // Dense events use two columns; the old forced minimum gap pushed later
    // choices off the paper and underneath the inventory strip.
    const INV_TOP = 246;
    const startY = this._choiceTopY ?? 108;
    const columns = n > 5 ? 2 : 1;
    const rows = Math.max(1, Math.ceil(n / columns));
    const lastCenterY = INV_TOP - 12;
    const maxGap = columns === 2 ? 28 : (n > 4 ? 24 : n > 3 ? 32 : 38);
    const gap = rows > 1
      ? Math.max(18, Math.min(maxGap, Math.floor((lastCenterY - startY) / (rows - 1))))
      : maxGap;
    const buttonHeight = Math.max(14, Math.min(24, gap - 4));
    const smallFont = columns === 2 || gap < 24;
    this._choiceStartY = startY;

    choices.forEach((choice, i) => {
      const row = columns === 2 ? Math.floor(i / 2) : i;
      const col = columns === 2 ? i % 2 : 0;
      const y = startY + row * gap;
      const buttonWidth = columns === 2 ? 158 : layout.buttonWidth;
      const textWidth = columns === 2 ? 146 : layout.buttonTextWidth;
      const x = columns === 2
        ? layout.centerX + (col === 0 ? -83 : 83)
        : layout.centerX;

      const bg = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0x050505, 0.58)
        .setDepth(2);

      const label = this.add.text(x, y, choice.text, {
        fontSize: smallFont ? (choice.text.length > 34 ? '8px' : '9px') : (choice.text.length > 44 ? '11px' : '13px'),
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel"',
        align: 'center',
        wordWrap: { width: textWidth }
      }).setOrigin(0.5).setDepth(3);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(0x111111, 0.78); });
      bg.on('pointerout', () => { bg.setFillStyle(0x050505, 0.58); });
      bg.on('pointerdown', () => this._resolve(choice, i));

      this._choiceBtns.push({ bg, label });
    });
  }

  _resolve(choice, choiceIdx, opts = {}) {
    if (this.resolved) return;
    this.resolved = true;

    // Effect helpers push concrete "gained/lost" lines here during the action.
    // (The well trade fills these before calling _resolve, so keepRewards.)
    if (!opts.keepRewards) this._rewardLines = [];
    choice.action?.(this.gameState, this);

    // A choice with `next` isn't terminal — it reveals more choices in place
    // (e.g. Inspect → Confront/Fight) instead of ending the event.
    if (choice.next && Array.isArray(choice.next.choices)) {
      this._saveStoredStoryRun();
      this._transitionToStage(choice);
      return;
    }

    // Once-per-run bonus rooms are marked seen on any terminal resolution.
    this._markBonusEventSeen();

    // Persist story progress across deaths so this event (and its choices) is
    // remembered on future runs and never repeats.
    this._saveStoredStoryRun();
    if (Number.isInteger(choice.outcomeFrame) && this.eventIllustrationImage?.setFrame) {
      this.eventIllustrationImage.setFrame(choice.outcomeFrame);
    }
    const outcome = this._getChoiceOutcome(choice);
    this._resolvedOutcome = outcome; // kept so a delayed reward can re-render the panel

    // Terminal presentation: clear the situation text, divider and every choice
    // button so the outcome owns the whole panel. Previously the outcome was
    // squeezed below the collapsed button and overlapped the (still-visible)
    // description — long outcomes like the fairy fight became an unreadable
    // jumble. Top-anchor the outcome just under the title so even long text
    // flows downward with room to spare above the inventory strip.
    this.descText?.setVisible(false);
    this.dividerRect?.setVisible(false);
    this._choiceBtns.forEach(({ bg, label }) => {
      bg.removeInteractive();
      bg.setAlpha(0);
      label.setAlpha(0);
    });

    const rewards = this._rewardLines || [];
    this._layoutResolvedOutcome(outcome, rewards);

    // Show narration immediately. A short fade on a previously invisible text
    // object made the reward animation easier to notice than the actual story.
    this.outcomeBackdrop?.setAlpha(1);
    this.outcomeLabel?.setAlpha(1);
    if (outcome) this.outcomeText?.setAlpha(1);
    if (rewards.length) this.rewardText?.setAlpha(1);

    // The event scene may be launched above a paused GameScene, where a delayed
    // tween can remain invisible. Make the exit control immediately available
    // and keep it above the outcome reading surface.
    this.continueBtn?.setAlpha(1).setDepth(6);
    this.continueBtnText?.setAlpha(1).setDepth(7);
  }

  // Fits narration and consequences into one bounded panel. In particular, a
  // long second-stage outcome can no longer be covered by a reward block that
  // has been forcibly moved upward.
  _layoutResolvedOutcome(outcome, rewards) {
    const story = typeof outcome === 'string' ? outcome : '';
    const rewardLines = Array.isArray(rewards) ? rewards : [];
    const top = 66;
    const gap = story && rewardLines.length ? 8 : 0;

    // Choose the compact size up front. Phaser's setFontSize() internally
    // refreshes a Text object without preserving its contents, so resizing an
    // already-populated outcome is precisely what made long outcomes vanish.
    const denseOutcome = story.length > 400 || (story.length > 300 && rewardLines.length >= 3);
    const storyFont = denseOutcome ? 8 : story.length > 300 ? 9 : story.length > 150 ? 10 : 12;
    const rewardFont = denseOutcome || rewardLines.length > 3 ? 8 : 10;

    // Recreate the narration object instead of resizing the hidden placeholder.
    // Phaser clears that reused Text object's internal value on the nested
    // Inspect -> Fight path, even though the outcome string is still present.
    this.outcomeText?.destroy?.();
    this.outcomeText = this.add.text(this.eventLayout.centerX, top, story, {
      fontSize: `${storyFont}px`,
      fill: '#fff2d0',
      fontFamily: '"HoMM Pixel"',
      align: 'center',
      wordWrap: { width: 330 }
    }).setOrigin(0.5, 0).setAlpha(story ? 1 : 0).setDepth(4);

    this.rewardText
      ?.setFontSize(`${rewardFont}px`)
      .setText(rewardLines.join('\n'));

    const rewardY = top + (story ? this.outcomeText.height : 0) + gap;
    this.rewardText?.setY(rewardY);
    if (!story) this.outcomeText?.setAlpha(0);
    if (!rewardLines.length) this.rewardText?.setAlpha(0).setText('');
  }

  // Records a concrete reward/loss line shown in the outcome's summary.
  _reward(text) {
    if (typeof text !== 'string' || !text) return;
    (this._rewardLines ||= []).push(text);
  }

  // Adds an awarded card to the inventory — but, crucially, never loses it when
  // the bag is full. Instead the card is held as a "pending reward": the outcome
  // tells the player to discard a card to claim it, and update() hands the held
  // card over the instant a slot frees (station-mode discards are free during an
  // event). Used by companion/card rewards so a full inventory only ever *delays*
  // the reward, never silently deletes it.
  _deliverCardReward(card, shortName, gainedLabel = `Gained: ${shortName}`) {
    if (!card) return false;
    if (this._addCardToInventory(card)) {
      this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
      this.gameScene?.updateUI?.();
      this._reward(gainedLabel);
      return true;
    }

    const pending = { card, shortName, gainedLabel };
    (this._pendingCardRewards ||= []).push(pending);
    this._reward(`Inventory full — discard a card to claim the ${shortName}`);
    pending.rewardLineIndex = (this._rewardLines || []).length - 1;
    return false;
  }

  // Re-renders the resolved outcome + reward summary in place. Called when a
  // held reward is finally delivered so its "discard to claim" line flips to
  // "Gained:".
  _refreshRewardText() {
    if (!this.resolved) return;
    this._layoutResolvedOutcome(this._resolvedOutcome, this._rewardLines || []);
    this.outcomeBackdrop?.setAlpha(1);
    this.outcomeLabel?.setAlpha(1);
    if (this._resolvedOutcome) this.outcomeText?.setAlpha(1);
    if ((this._rewardLines || []).length) this.rewardText?.setAlpha(1);
  }

  // Swaps the reveal narration into the description and replaces the choice
  // buttons with the next stage's choices, in place (no Continue yet).
  _transitionToStage(choice) {
    const revealText = this._getChoiceOutcome(choice) || '';
    if (this.descText) {
      this.descText.setVisible(true).setAlpha(1).setText(revealText);
      const dividerY = Math.min(150, 42 + this.descText.height + 8);
      this.dividerRect?.setY(dividerY);
      this._choiceTopY = dividerY + 8;
    }

    (this._choiceBtns || []).forEach(({ bg, label }) => { bg.destroy(); label.destroy(); });
    this._choiceBtns = [];

    this._visibleChoices = choice.next.choices.filter(c => this._isChoiceVisible(c));
    this._buildChoices();

    if (Number.isInteger(choice.outcomeFrame) && this.eventIllustrationImage?.setFrame) {
      this.eventIllustrationImage.setFrame(choice.outcomeFrame);
    }

    this.resolved = false; // allow picking a sub-choice
  }

  // ─── Too-Nice Room effects ───────────────────────────────────────────────

  fullHeal() {
    // Heals up to the (amulet-capped) max via the shared heal path.
    const before = Number.isFinite(this.gameState?.playerHealth) ? this.gameState.playerHealth : 0;
    this.heal(this.gameState?.maxHealth || 9999);
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    const gained = (this.gameState?.playerHealth || 0) - before;
    this._reward(gained > 0 ? `Fully healed (+${gained} HP)` : 'Already at full HP');
  }

  // Removes a random inventory card that isn't a key or potion. Returns false
  // if there's nothing safe to steal.
  stealRandomCard() {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots)) return false;
    const candidates = [];
    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item || this._isKeyCard(item) || this._isPotionCard(item)) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return false;
    const index = candidates[Math.floor(Math.random() * candidates.length)];
    const name = slots[index]?.name || 'a card';
    const removed = this._removeInventoryCard(index);
    if (removed) this._reward(`Lost: ${name}`);
    return removed;
  }

  // Deals damage that can't be lethal — the fairy fight always ends in victory.
  loseHealthCapped(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const current = Number.isFinite(this.gameState?.playerHealth) ? this.gameState.playerHealth : 1;
    this.gameState.playerHealth = Math.max(1, current - amount);
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    const lost = current - this.gameState.playerHealth;
    if (lost > 0) this._reward(`-${lost} HP`);
  }

  loseActionPoints(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const current = Number.isFinite(this.gameState?.actionsLeft) ? this.gameState.actionsLeft : 0;
    this.gameState.actionsLeft = Math.max(0, current - amount);
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateActionPointUI?.();
    this.gameScene?.updateUI?.();
    const lost = current - this.gameState.actionsLeft;
    if (lost > 0) this._reward(`-${lost} AP`);
  }

  gainRandomAmulet() {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const mgr = this.gameScene?.amuletManager;
    if (!mgr?.addAmulet) return false;
    const amulet = new CardDataGenerator().createAmuletCard(this.gameState?.currentFloor || 1, this.gameState);
    if (!amulet?.id) return false;
    const ok = mgr.addAmulet(amulet.id);
    this.gameScene.updateUI?.();
    if (ok) this._reward(`Gained amulet: ${amulet.name || 'Amulet'}`);
    return ok;
  }

  gainRandomCursedAmulet() {
    return this.gainRandomAmuletFromPool(amulet => amulet.rarity === 'cursed');
  }

  gainRandomNonCursedAmulet() {
    return this.gainRandomAmuletFromPool(amulet => amulet.rarity !== 'cursed');
  }

  gainRandomAmuletFromPool(predicate) {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const mgr = this.gameScene?.amuletManager;
    if (!mgr?.addAmulet || typeof predicate !== 'function') return false;

    const owned = new Set((this.gameState?.activeAmulets || []).map(amulet => amulet?.id));
    const pool = new CardDataGenerator().amuletTypes.filter(amulet => (
      predicate(amulet)
      && (!owned.has(amulet.id) || mgr.amuletDefinitions?.[amulet.id]?.stackable)
    ));
    if (pool.length === 0) return false;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return this.gainAmulet(chosen.id);
  }

  gainSkeletonWarriorCompanion() {
    // Durable achievement flag: pulling the skeleton mage free is what unlocks
    // the Skeleton Warrior in future heroes' rare shops (mirrors chickHatched).
    // Recorded even if the bag is full, since the card is only *held*, not lost.
    this.ensureStoryState();
    this.gameState.storyRun.skeletonCompanionObtained = true;
    this._saveStoredStoryRun();
    const companion = new CardDataGenerator().createSkeletonWarriorCompanionCard();
    return this._deliverCardReward(companion, 'Skeleton Warrior', 'Gained companion: Skeleton Warrior');
  }

  getCompanionKey(companion) {
    const raw = companion?.companionId
      || companion?.id
      || companion?.companionType
      || companion?.name;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }

  getQualifyingCompanions() {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.syncCompanionHistory?.();
    const history = this.gameState?.companionHistory || {};
    return this.getInventorySlots()
      .filter(companion => companion?.type === 'companion')
      .map(companion => ({ companion, key: this.getCompanionKey(companion) }))
      .filter(({ key }) => {
        const entry = key ? history[key] : null;
        return entry && (Number(entry.roomsFought) || 0) >= 3 && entry.upgraded !== true;
      });
  }

  getCompanionTrainingChoiceLabel(companion) {
    if (companion?.id === 'chickCompanion') return 'Train Storm Chick';
    if (companion?.id === 'skeletonWarriorCompanion') return 'Train Skeleton Warrior';
    return `Train ${companion?.name || 'Companion'}`;
  }

  trainCompanion(key) {
    const companion = this.getInventorySlots().find(item => (
      item?.type === 'companion' && this.getCompanionKey(item) === key
    ));
    const history = this.gameState?.companionHistory?.[key];
    if (!companion || !history || history.upgraded === true) return false;

    if (companion.id === 'chickCompanion') {
      companion.name = 'Storm Hatchling';
      companion.shockChance = 0.20;
      companion.upgradedForm = 'stormHatchling';
      this.companionTrainingOutcome = 'You place the Storm Chick card near the old lightning rods.\n\nThe rods begin to hum.\n\nA small bolt jumps between them and strikes the card.\n\nInside the picture, the chick puffs up, feathers crackling with blue sparks.';
      this._reward('Storm Hatchling: 20% chance to Shock for 1 turn');
    } else if (companion.id === 'skeletonWarriorCompanion') {
      companion.name = 'Slimebone Guard';
      companion.guardProtection = Math.max(1, Number(companion.guardProtection) || 0);
      companion.upgradedForm = 'slimeboneGuard';
      companion.sprite = 'skeletonCompanionUP'; // upgraded art: skeleton with a raised shield
      this.companionTrainingOutcome = 'You place the Skeleton Warrior card beside the broken shields.\n\nThe shield scraps rattle across the floor and stack themselves over the card.\n\nInside the picture, the skeleton lowers its cracked sword and raises a battered shield.';
      this._reward('Slimebone Guard: +1 protection while carried');
    } else {
      companion.attack = Math.max(0, Number(companion.attack) || 0) + 1;
      companion.upgradedForm = 'trained';
      this.companionTrainingOutcome = 'You place the companion card in the center of the drill room.\n\nThe old training marks on the floor glow faintly.\n\nFor a moment, something inside the card moves faster, sharper, more awake.';
      this._reward(`${companion.name || 'Companion'}: +1 damage`);
    }

    companion.trained = true;
    history.upgraded = true;
    history.name = companion.name || history.name;
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    this.gameScene?.updateUI?.();
    return true;
  }

  gainAmulet(id) {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const mgr = this.gameScene?.amuletManager;
    if (!mgr?.addAmulet || typeof id !== 'string') return false;
    const name = mgr.amuletDefinitions?.[id]?.name || 'Amulet';
    const ok = mgr.addAmulet(id);
    this.gameScene.updateUI?.();
    if (ok) this._reward(`Gained amulet: ${name}`);
    return ok;
  }

  // Brings the GameScene inventory forward, in station mode, beneath the event.
  _enableEventStation() {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const inv = this.gameScene?.inventorySystem;
    if (!inv) return;
    this.scene.wake('GameScene', { shopStation: true });
    inv.setStationMode(true);
    inv.setVisibility(true);
    inv.setDragOverlayScene?.(this);
    inv.clearDropZones?.(); // start clean; the mirror re-registers below if needed
    this._stationActive = true;
  }

  // Restores the inventory to its normal (non-station) layer/visibility.
  // setStationMode(false) re-applies the standard combat depths.
  _disableEventStation() {
    if (!this._stationActive) return;
    const inv = this.gameScene?.inventorySystem;
    if (inv) {
      inv.setDragOverlayScene?.(null);
      inv.clearDropZones?.();
      inv.setStationMode(false);
      inv.setVisibility(false);
    }
    this._stationActive = false;
  }

  // ─── Copying mirror ──────────────────────────────────────────────────────

  _setupMirrorDropZone() {
    const inv = this.gameScene?.inventorySystem;
    const target = this.eventIllustrationImage;
    if (!inv || !target?.getBounds) return;
    this.mirrorUsed = false;
    inv.clearDropZones();
    inv.addDropZone(target, (slotIndex, cardData, cardSprite) =>
      this._handleMirrorDrop(slotIndex, cardData, cardSprite));
  }

  _handleMirrorDrop(slotIndex, cardData, cardSprite) {
    const inv = this.gameScene?.inventorySystem;
    if (!inv || !cardData) return false;

    if (this.mirrorUsed) {
      this._mirrorFloat('The mirror already copied a card', 0xffaa66, cardSprite);
      return false; // let it bounce back to its slot
    }
    if (!this._isMirrorCopyable(cardData)) {
      this._mirrorFloat("The mirror won't copy that", 0xff6666, cardSprite);
      return false;
    }
    if (!inv.slots.some(slot => slot === null)) {
      this._mirrorFloat('No empty slot for the copy', 0xff6666, cardSprite);
      return false;
    }

    // Keep the original where it was; drop a fresh duplicate into an empty slot.
    inv.returnCardToSlot(slotIndex, cardSprite);
    inv.addCard(this._duplicateCardData(cardData));
    this.mirrorUsed = true;
    this._mirrorFloat('Copied!', 0x8ad6ff, cardSprite);
    this.gameScene?.updateUI?.();
    return true;
  }

  _isMirrorCopyable(card) {
    if (!card) return false;
    if (card.unique) return false;          // e.g. the Chick Companion
    if (card.id === 'monsterEgg') return false; // story item
    return true;
  }

  _duplicateCardData(card) {
    try {
      return JSON.parse(JSON.stringify(card));
    } catch {
      return { ...card };
    }
  }

  _mirrorFloat(text, color, cardSprite) {
    const x = cardSprite?.x ?? 320;
    const y = cardSprite?.y ?? 300;
    this.gameScene?.createFloatingText?.(x, y, text, color);
  }

  // ─── Briar Room (drag a weapon/armor in to grow a permanent thorn) ───────

  beginBriarOffering() {
    const inv = this.gameScene?.inventorySystem;
    const target = this.eventIllustrationImage;
    if (!inv || !target?.getBounds) return false;
    this.briarOfferingActive = true;
    inv.clearDropZones();
    inv.addDropZone(target, (slotIndex, cardData, cardSprite) => (
      this._handleBriarOffering(slotIndex, cardData, cardSprite)
    ));
    return true;
  }

  cancelBriarOffering() {
    this.briarOfferingActive = false;
    this.gameScene?.inventorySystem?.clearDropZones?.();
  }

  _handleBriarOffering(slotIndex, cardData, cardSprite) {
    const inv = this.gameScene?.inventorySystem;
    if (!inv || !cardData || !this.briarOfferingActive || this.resolved) return false;
    if (cardData.type !== 'weapon' && cardData.type !== 'armor') {
      this._mirrorFloat('The briars only want a weapon or armor card', 0xff6666, cardSprite);
      return false;
    }

    cardData.briarDamageBonus = (cardData.briarDamageBonus || 0) + 1;
    if (cardData.type === 'weapon') {
      cardData.damage = (cardData.damage || 0) + 1;
    } else {
      cardData.thornDamage = (cardData.thornDamage || 0) + 1;
    }

    inv.returnCardToSlot(slotIndex, cardSprite);
    inv.clearDropZones();
    inv.rebuildInventorySprites?.();
    this.briarOfferingActive = false;
    this.gameScene?.updateUI?.();

    this._rewardLines = [];
    this._reward(cardData.type === 'weapon'
      ? `${cardData.name || 'Weapon'}: +1 permanent damage`
      : `${cardData.name || 'Armor'}: +1 thorn damage`);
    this._resolve({
      text: 'Offer card',
      action: () => {},
      outcome: 'You hold one of your cards toward the vines.\n\nThe brambles wrap around it carefully, almost gently.\n\nTiny black thorns sink into the card’s edge.\n\nWhen the vines pull away, the card is changed.'
    }, -1, { keepRewards: true });
    return true;
  }

  // ─── Well of Almost-You (drag a gear card in to trade it up a tier) ───────

  _setupWellDropZone() {
    const inv = this.gameScene?.inventorySystem;
    const target = this.eventIllustrationImage;
    if (!inv || !target?.getBounds) return;
    inv.clearDropZones();
    inv.addDropZone(target, (slotIndex, cardData, cardSprite) =>
      this._handleWellDrop(slotIndex, cardData, cardSprite));
  }

  _handleWellDrop(slotIndex, cardData, cardSprite) {
    const inv = this.gameScene?.inventorySystem;
    if (!inv || !cardData) return false;
    if (this.resolved) return false; // event already ended — bounce back

    if (!this._isWellTradeable(cardData)) {
      this._mirrorFloat('The reflection only wants gear (weapon/armor/thorns)', 0xff6666, cardSprite);
      return false;
    }

    const oldName = cardData.name || 'a card';
    const newCard = this._wellReroll(cardData);
    if (!newCard) {
      this._mirrorFloat("The well won't take that", 0xff6666, cardSprite);
      return false;
    }

    // Consume the dropped card (same cleanup path as a discard), then hand back
    // the rerolled card.
    inv.cleanupCardSprites(slotIndex, cardSprite);
    // The well art sits in the board area (screen centre), so the card — and its
    // merge "twinkle" — was dragged there. cleanupCardSprites clears the slot's
    // own twinkle, but sweep the board area too so a stray sparkle can't hang in
    // empty space over the well (the same orphan weapon attacks guard against).
    inv.cleanupBoardArtifacts?.(cardSprite);
    inv.removeCard(slotIndex, false);
    cardSprite.destroy();
    inv.addCard(newCard);
    this.gameScene?.updateUI?.();

    // The trade is one of the well's outcomes — resolve the event with it,
    // carrying the reward line we just recorded.
    this._rewardLines = [];
    this._reward(`Traded: ${oldName} → ${newCard.name || 'upgraded card'}`);
    this._resolve({
      text: 'Trade',
      action: () => {},
      outcome: 'You hold one card over the well. Your reflection lifts the wrong hand. The card sinks into the black water without a sound, and a different one rises back — cold and dripping with tar. For one second, you feel like you just made a deal with yourself.'
    }, -1, { keepRewards: true });
    return true;
  }

  _isWellTradeable(card) {
    return ['weapon', 'armor', 'thorns'].includes(card?.type);
  }

  // The well changes weapon/armor/thorns into one of the OTHER two categories,
  // while preserving the exact rarity and the real stats/art for that tier.
  _wellReroll(card) {
    const cs = this.gameScene?.cardSystem;
    if (!cs) return null;

    const gearTypes = ['weapon', 'armor', 'thorns'];
    const possibleTypes = gearTypes.filter(type => type !== card.type);
    if (possibleTypes.length === 0) return null;

    // The well changes the card category, not its tier.
    const type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const rarity = validRarities.includes(card.rarity) ? card.rarity : 'common';
    const floor = this.gameState?.currentFloor || 1;

    // Generate where this tier is fully unlocked across the selected category.
    // At an earlier floor the normal generator can mix (for example) rare
    // leather with common chain, even when rare was explicitly requested.
    const generator = cs.cardDataGenerator;
    let fullTierUnlockFloor = 1;
    if (type === 'weapon') {
      const unlockFloors = Object.values(generator?.weaponUnlocks || {})
        .map(tiers => tiers?.[rarity]?.floor)
        .filter(Number.isFinite);
      if (unlockFloors.length > 0) fullTierUnlockFloor = Math.max(...unlockFloors);
    } else if (type === 'armor') {
      const unlockFloors = Object.values(generator?.armorUnlocks || {})
        .map(tiers => tiers?.[rarity]?.floor)
        .filter(Number.isFinite);
      if (unlockFloors.length > 0) fullTierUnlockFloor = Math.max(...unlockFloors);
    }

    const generationFloor = Math.max(floor, fullTierUnlockFloor);
    const chosen = cs.createCardData(type, generationFloor, false, null, rarity);
    if (!chosen || chosen.type !== type || chosen.rarity !== rarity) return null;
    return chosen;
  }

  // Marks the once-per-run bonus rooms as seen when they resolve.
  _markBonusEventSeen() {
    const flagByEvent = {
      mirror: 'mirrorSeen',
      too_nice_room: 'tooNiceRoomSeen',
      almost_you_well: 'wellSeen',
      slimy_prison: 'slimyPrisonSeen',
      book_worm: 'bookWormSeen',
      briar_room: 'briarRoomSeen'
    };
    const flag = flagByEvent[this.event?.id];
    if (!flag) return;
    this.ensureStoryState();
    this.gameState.storyRun[flag] = true;
  }

  // Delivers any card reward that was held back because the inventory was full,
  // the moment the player frees a slot (e.g. by discarding a card). Only touches
  // the inventory when a slot is actually open, so it never spams "Inventory
  // Full!" while the player is still deciding.
  update() {
    const pending = this._pendingCardRewards;
    if (!pending || pending.length === 0) return;

    const slots = this.getInventorySlots();
    if (!Array.isArray(slots)) return;

    let delivered = false;
    while (pending.length > 0 && slots.some(slot => slot == null)) {
      const reward = pending[0];
      if (!this._addCardToInventory(reward.card)) break;
      pending.shift();
      if (Number.isInteger(reward.rewardLineIndex) && this._rewardLines) {
        this._rewardLines[reward.rewardLineIndex] = reward.gainedLabel;
      }
      this.gameScene?.createFloatingText?.(512, 400, `${reward.shortName} claimed!`, 0x66ff66);
      delivered = true;
    }

    if (delivered) {
      this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
      this.gameScene?.updateUI?.();
      this._refreshRewardText();
    }
  }

  continueAdventure() {
    this._disableEventStation();

    if ((this.gameState?.playerHealth || 0) <= 0) {
      this.scene.stop('MapViewScene');
      this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
      // Bring GameScene forward so its defeat screen renders, then hand off.
      this.scene.wake('GameScene');
      this.scene.stop();
      this.gameScene?.gameOver?.();
      return;
    }
    // Park GameScene back to sleep (we woke it for the station) and return to map.
    this.scene.sleep('GameScene');
    this.scene.stop();
    this.scene.wake('MapViewScene');
  }
}
