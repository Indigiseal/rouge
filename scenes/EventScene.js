// EventScene.js
// Unknown encounter events. Each event has a title, description, and a list of choices.
// Choices can have a condition (function returning bool) that hides them if not met.
// After a choice is made, an optional outcome message is shown before returning to the map.
// To add new events, add objects to the EVENTS array below.

import { CardDataGenerator } from '../CardDataGenerator.js';

const HERO_MEMORY_SAVE_KEY = 'heroMemory';
const EVENT_ILLUSTRATION_FRAMES = {
  burning_caravan: 3,
  robbed_hermit: 4,
  cheerful_hermit: 8,
  singing_box: 2,
  masked_duelist: 5,
  tiny_thief_bird: 6,
  missing_bard_camp: 0,
  caravan_aftermath: 3,
  last_refrain: 0,
  quiet_crossroads: 7
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
    id: 'singing_box',
    title: 'The Singing Box',
    description: 'A tiny music box sits in the middle of the path, playing a lonely tune through its locked lid. A note tied around it says: "Do not open unless you can handle applause."',
    choices: [
      {
        text: 'Open it by force',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'broken';
          gs.storyRun.bardThreadState = 'song_broken';
          scene.markHeroMemory('learnedMusicBoxBreaks');
          scene.addPendingEvent('masked_duelist');
          scene.gainCoins(12);
        },
        outcome: 'You pry the box open. The song snaps into one ugly little note. Inside, you find coins and a bent silver feather.'
      },
      {
        text: 'Leave it alone',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'ignored';
          gs.storyRun.bardThreadState = 'released';
          gs.storyRun.bardResolved = true;
          gs.storyRun.bardEnding = 'left_box_singing';
          scene.addPendingEvent('last_refrain');
          scene.heal(5);
        },
        outcome: 'You leave the box singing to itself. The melody follows you for a while, like it is trying to remember your name.'
      },
      {
        text: 'Use a key to open it carefully',
        condition: (gs, scene) => scene.hasKeyCard() || scene.hasAmulet('skeletonKey'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          const usesSkeletonKey = scene.hasAmulet('skeletonKey');
          scene.logStoryKeyChoice(usesSkeletonKey ? 'skeletonKey_singing_box' : 'key_card_singing_box');
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'opened';
          gs.storyRun.bardThreadState = 'clue_found';
          if (!usesSkeletonKey) scene.consumeKeyCard();
          scene.addPendingEvent('masked_duelist');
          scene.gainCrystals(1);
        },
        outcome: 'The lock clicks open without hurting the song. Inside is a silver feather and a half-written verse.'
      },
      {
        text: 'Answer the melody',
        condition: (gs, scene) => scene.hasAmulet('charmingTune'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('charmingTune_singing_box_answer');
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'answered';
          gs.storyRun.bardThreadState = 'song_repaired';
          scene.addPendingEvent('masked_duelist');
          scene.heal(10);
          scene.gainCrystals(1);
        },
        outcome: 'You hum the missing note. The box stops crying and opens by itself, as if it had been waiting for someone to sing back.'
      },
      {
        text: "Use Watcher's Lamp to inspect it",
        condition: (gs, scene) => scene.hasAmulet('watchersLamp'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('watchersLamp_singing_box_inspect');
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'opened';
          gs.storyRun.bardThreadState = 'clue_found';
          scene.addPendingEvent('tiny_thief_bird');
          scene.gainCrystals(1);
        },
        outcome: 'The lamp reveals tiny footprints circling the box. Whoever left it here was very small, very proud, and probably stealing things.'
      },
      {
        text: 'Remember the damage: open it gently',
        condition: (gs) => Boolean(gs?.heroMemory?.learnedMusicBoxBreaks && !gs?.heroMemory?.solvedBardSong),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('hero_memory_singing_box_careful');
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'opened';
          gs.storyRun.bardThreadState = 'clue_found';
          scene.addPendingEvent('masked_duelist');
          scene.gainCrystals(1);
        },
        outcome: 'Your hands remember the ugly snapped note. This time the lid opens without a struggle, revealing the silver feather beneath.'
      },
      {
        text: 'Sing the final refrain you remember',
        condition: (gs) => Boolean(gs?.heroMemory?.solvedBardSong),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('hero_memory_singing_box_refrain');
          gs.storyRun.musicBoxSeen = true;
          gs.storyRun.musicBoxState = 'answered';
          gs.storyRun.bardThreadState = 'song_repaired';
          scene.addPendingEvent('masked_duelist');
          scene.heal(10);
          scene.gainCrystals(1);
        },
        outcome: 'The melody recognizes you. The box opens on the remembered note, and somewhere deeper below, another instrument answers.'
      }
    ]
  },
  {
    id: 'masked_duelist',
    title: 'The Masked Duelist',
    description: (gs) => {
      const state = gs?.storyRun?.musicBoxState;
      if (state === 'broken') {
        return 'A masked duelist blocks your path and freezes when he hears the broken tune rattling from your pack. "Who hurt that song?" he demands.';
      }
      if (state === 'opened') {
        return 'A masked duelist lowers his wooden sword when he sees the silver feather. "That belonged to the bard," he says quietly.';
      }
      if (state === 'answered') {
        return 'A masked duelist hears the completed melody and nearly drops his sword. "You know the missing note?"';
      }
      return 'A masked duelist blocks your path with a wooden practice sword and far too much confidence.';
    },
    choices: [
      {
        text: 'Explain what happened',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('masked_duelist');
          scene.markHeroMemory('learnedDuelistKnowsSong');

          if (gs.storyRun.musicBoxState === 'broken') {
            gs.storyRun.duelistState = 'angry';
            scene.addPendingEvent('tiny_thief_bird');
            scene.gainCoins(5);
            return;
          }

          if (gs.storyRun.musicBoxState === 'answered') {
            gs.storyRun.duelistState = 'inspired';
            scene.addPendingEvent('tiny_thief_bird');
            scene.repairRandomDamagedItem(1);
            scene.heal(5);
            return;
          }

          gs.storyRun.duelistState = 'trusting';
          scene.addPendingEvent('tiny_thief_bird');
          scene.repairRandomDamagedItem(1);
        },
        outcome: (gs) => {
          if (gs?.storyRun?.musicBoxState === 'broken') {
            return 'He glares at the bent feather. "Then we find the rest of the song before it forgets itself."';
          }
          if (gs?.storyRun?.musicBoxState === 'answered') {
            return 'He bows so dramatically his mask nearly falls off. "Then the song still has a champion."';
          }
          return 'He nods and repairs a nick in your gear with surprising gentleness. "The bard trusted careful hands."';
        }
      },
      {
        text: 'Accept a practice duel',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('masked_duelist');
          gs.storyRun.duelistState = 'angry';
          scene.addPendingEvent('tiny_thief_bird');
          scene.gainCoins(15);
          scene.gainCrystals(1);
        },
        outcome: 'The duel is mostly shouting and footwork, but you leave with a few coins and a new bruise.'
      },
      {
        text: "Show the Lost Princess's Diadem",
        condition: (gs, scene) => scene.hasAmulet('invulnerability'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('royal_authority_masked_duelist');
          scene.clearPendingEvent('masked_duelist');
          gs.storyRun.duelistState = 'trusting';
          scene.addPendingEvent('tiny_thief_bird');
          scene.gainCoins(10);
          scene.repairRandomDamagedItem(1);
        },
        outcome: 'You declare yourself Judge of the Grand Duel. The duelist salutes immediately, then whispers that he has been waiting years for proper paperwork.'
      },
      {
        text: 'Sound the Goblin War Horn',
        condition: (gs, scene) => scene.hasRelic('greedyPockets'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('horn_masked_duelist');
          scene.clearPendingEvent('masked_duelist');
          gs.storyRun.duelistState = 'inspired';
          scene.addPendingEvent('tiny_thief_bird');
          scene.gainCrystals(1);
          scene.heal(5);
        },
        outcome: 'The horn blast turns the duel into an official ceremony. Nobody knows the rules, but everyone respects them.'
      },
      {
        text: 'Tell him you remember the missing song',
        condition: (gs) => Boolean(gs?.heroMemory?.learnedDuelistKnowsSong),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('hero_memory_masked_duelist');
          scene.clearPendingEvent('masked_duelist');
          gs.storyRun.duelistState = gs.storyRun.bardThreadState === 'song_repaired'
            ? 'inspired'
            : 'trusting';
          scene.addPendingEvent('tiny_thief_bird');
          scene.repairRandomDamagedItem(1);
          scene.heal(5);
        },
        outcome: 'You repeat the words he once gave you. He goes still, then bows. "Good. Some songs are stronger the second time."'
      }
    ]
  },
  {
    id: 'tiny_thief_bird',
    title: 'Tiny Thief Bird',
    description: 'A tiny bird wearing a button like a helmet hops in front of you. In its beak is a golden music string, humming with the same lonely melody.',
    choices: [
      {
        text: 'Grab the string',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('tiny_thief_bird');
          gs.storyRun.birdState = 'offended';
          gs.storyRun.bardThreadState = gs.storyRun.bardThreadState === 'song_broken'
            ? 'song_broken'
            : 'clue_found';
          scene.addPendingEvent('missing_bard_camp');
          if ((gs.coins || 0) >= 5) {
            gs.coins -= 5;
          } else {
            scene.damagePlayer(3);
          }
        },
        outcome: 'The bird drops the string, steals something shiny from your dignity, and flaps away offended.'
      },
      {
        text: 'Trade a food card or bread',
        condition: (gs, scene) => scene.hasFoodCard(),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('tiny_thief_bird');
          scene.consumeFoodCard();
          gs.storyRun.birdState = 'friend';
          gs.storyRun.bardThreadState = gs.storyRun.musicBoxState === 'answered'
            ? 'song_repaired'
            : 'clue_found';
          scene.markHeroMemory('learnedBirdLikesFood');
          scene.addPendingEvent('missing_bard_camp');
          scene.heal(5);
        },
        outcome: 'The bird accepts the snack with the seriousness of a tiny king and drops the golden string into your hand.'
      },
      {
        text: 'Trade an unwanted card',
        condition: (gs, scene) => scene.hasSacrificeCard(),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('tiny_thief_bird');
          scene.sacrificeFirstNonEssentialCard();
          gs.storyRun.birdState = 'traded';
          scene.addPendingEvent('missing_bard_camp');
          scene.gainCrystals(1);
        },
        outcome: 'The bird examines your card, decides it is treasure, and leaves the golden string behind.'
      },
      {
        text: 'Play the Lute of First Light',
        condition: (gs, scene) => scene.hasAmulet('charmingTune'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('charmingTune_tiny_thief_bird');
          scene.clearPendingEvent('tiny_thief_bird');
          gs.storyRun.birdState = 'friend';
          gs.storyRun.bardThreadState = 'song_repaired';
          scene.addPendingEvent('missing_bard_camp');
          scene.heal(10);
        },
        outcome: 'The bird chirps the harmony back at you. The golden string stops trembling and glows warmly.'
      },
      {
        text: 'Wear the Harvest Crown',
        condition: (gs, scene) => scene.hasAmulet('travelKitchen'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('strawHat_tiny_thief_bird');
          scene.clearPendingEvent('tiny_thief_bird');
          gs.storyRun.birdState = 'offended';
          scene.addPendingEvent('missing_bard_camp');
          scene.gainCoins(10);
        },
        outcome: 'The bird mistakes you for a scarecrow, drops everything, and flees. This works, but feels socially complicated.'
      },
      {
        text: 'Offer the crumbs it liked before',
        condition: (gs) => Boolean(gs?.heroMemory?.learnedBirdLikesFood),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('hero_memory_tiny_thief_bird');
          scene.clearPendingEvent('tiny_thief_bird');
          gs.storyRun.birdState = 'friend';
          gs.storyRun.bardThreadState = gs.storyRun.musicBoxState === 'answered'
            ? 'song_repaired'
            : 'clue_found';
          scene.addPendingEvent('missing_bard_camp');
          scene.heal(5);
        },
        outcome: 'You hold out the same crumbs in the same open palm. The bird recognizes the bargain and returns the golden string without ceremony.'
      }
    ]
  },
  {
    id: 'missing_bard_camp',
    title: "The Missing Bard's Camp",
    description: (gs) => {
      const state = gs?.storyRun?.bardThreadState;
      if (state === 'song_broken') {
        return 'You find a small camp full of torn music sheets. The melody from the box limps through the air, missing too many pieces.';
      }
      if (state === 'song_repaired') {
        return 'You find a small camp glowing with quiet music. The repaired melody floats between the silver feather and golden string.';
      }
      return 'You find a small camp tucked behind a cracked wall. A lute case lies open beside a half-finished song.';
    },
    choices: [
      {
        text: 'Finish what you can',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('missing_bard_camp');

          if (gs.storyRun.bardThreadState === 'song_broken') {
            gs.storyRun.bardThreadState = 'salvaged';
            gs.storyRun.bardResolved = true;
            gs.storyRun.bardEnding = 'salvaged_song';
            scene.markHeroMemory('learnedMusicBoxBreaks');
            scene.addPendingEvent('last_refrain');
            scene.gainCoins(10);
            scene.repairRandomDamagedItem(1);
            return;
          }

          if (gs.storyRun.bardThreadState === 'song_repaired') {
            gs.storyRun.bardThreadState = 'complete';
            gs.storyRun.bardResolved = true;
            gs.storyRun.bardEnding = 'restored_song';
            scene.markHeroMemory('solvedBardSong');
            scene.addPendingEvent('last_refrain');
            scene.gainCrystals(3);
            scene.heal(15);
            scene.repairRandomDamagedItem(2);
            return;
          }

          gs.storyRun.bardThreadState = 'complete';
          gs.storyRun.bardResolved = true;
          gs.storyRun.bardEnding = 'completed_song';
          scene.addPendingEvent('last_refrain');
          scene.gainCrystals(2);
          scene.repairRandomDamagedItem(1);
        },
        outcome: (gs) => {
          if (gs?.storyRun?.bardEnding === 'salvaged_song') {
            return 'The song cannot fully return, but you salvage what remains. Somewhere, a lonely note finally rests.';
          }
          if (gs?.storyRun?.bardEnding === 'restored_song') {
            return 'The final note rings clear. For a moment, a smiling bard appears in the music and bows before fading into warm light.';
          }
          return 'You place the feather and string together. The song completes one bright phrase, then leaves you a gift.';
        }
      },
      {
        text: 'Pocket the supplies',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('missing_bard_camp');
          gs.storyRun.bardThreadState = 'abandoned';
          gs.storyRun.bardResolved = true;
          gs.storyRun.bardEnding = 'took_supplies';
          scene.addPendingEvent('last_refrain');
          scene.gainCoins(20);
        },
        outcome: 'You take the useful supplies and leave the unfinished song behind. Practical, but not poetic.'
      },
      {
        text: 'Leave the camp untouched',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.clearPendingEvent('missing_bard_camp');
          gs.storyRun.bardThreadState = 'released';
          gs.storyRun.bardResolved = true;
          gs.storyRun.bardEnding = 'left_camp_untouched';
          scene.addPendingEvent('last_refrain');
          scene.heal(5);
        },
        outcome: 'You leave the camp as you found it. The song follows for a few steps, then lets you go.'
      },
      {
        text: "Use Dungeonmaster's Spectacles to read the tiny music notes",
        condition: (gs, scene) => scene.hasRelic('dungeonMaster'),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.logStoryKeyChoice('glasses_missing_bard_camp');
          scene.clearPendingEvent('missing_bard_camp');
          gs.storyRun.bardThreadState = 'complete';
          gs.storyRun.bardResolved = true;
          gs.storyRun.bardEnding = 'restored_song';
          scene.markHeroMemory('solvedBardSong');
          scene.addPendingEvent('last_refrain');
          scene.gainCrystals(3);
          scene.repairRandomDamagedItem(2);
        },
        outcome: 'With the glasses, the tiny notes finally make sense. The melody folds itself into a complete song and thanks you without words.'
      }
    ]
  },
  {
    id: 'last_refrain',
    title: 'The Last Refrain',
    description: (gs) => {
      const ending = gs?.storyRun?.bardEnding;
      if (ending === 'restored_song') {
        return 'The repaired melody fills the corridor. The duelist keeps time with his wooden sword, the tiny bird sings harmony, and a smiling bard appears in the warm light.';
      }
      if (ending === 'completed_song') {
        return 'The silver feather and golden string answer each other. The song is not exactly as it was, but it stands on its own and bows to you.';
      }
      if (ending === 'salvaged_song') {
        return 'One clear note survives the broken melody. The duelist removes his mask, the bird grows quiet, and together you let the smaller song be enough.';
      }
      if (ending === 'took_supplies') {
        return 'A single coin from the bard\'s camp hums inside your purse. The tune has no ending now, only the faint sound of a choice that cannot be unmade.';
      }
      if (ending === 'left_camp_untouched') {
        return 'Behind you, the untouched camp plays one final phrase by itself. The melody fades gently, keeping its mysteries and asking nothing more.';
      }
      return 'The singing box grows quiet at last. Its lonely melody drifts away through the dungeon, unfinished but freely given.';
    },
    choices: [
      {
        text: 'Carry the melody forward',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.finishStoryEpilogue('bard', 'carried_melody');
          if (gs.storyRun.bardEnding === 'restored_song') {
            scene.gainCrystals(2);
            scene.heal(10);
          } else {
            scene.heal(8);
          }
        },
        outcome: 'You leave with the final note held somewhere beyond inventory. The missing bard has an ending now, and the road ahead has music.'
      },
      {
        text: 'Leave the last note here',
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.finishStoryEpilogue('bard', 'left_last_note');
          scene.repairRandomDamagedItem(2);
        },
        outcome: 'You set the feather beside the silent instrument. The dungeon keeps one gentle note, and the story closes around it.'
      },
      {
        text: 'Return part of what you took',
        condition: (gs) => gs?.storyRun?.bardEnding === 'took_supplies' && (gs?.coins || 0) >= 5,
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.coins = Math.max(0, (gs.coins || 0) - 5);
          gs.storyRun.bardEnding = 'made_amends';
          scene.finishStoryEpilogue('bard', 'returned_keepsake');
          scene.heal(5);
        },
        outcome: 'You leave a small purse beside the lute case. The humming coin falls silent, and the last note softens into forgiveness.'
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

    if (story.pendingEvents.includes('robbed_hermit')) return this.getEventById('robbed_hermit');
    if (story.pendingEvents.includes('caravan_aftermath')) return this.getEventById('caravan_aftermath');
    if (story.pendingEvents.includes('masked_duelist')) return this.getEventById('masked_duelist');
    if (story.pendingEvents.includes('tiny_thief_bird')) return this.getEventById('tiny_thief_bird');
    if (story.pendingEvents.includes('missing_bard_camp')) return this.getEventById('missing_bard_camp');
    if (story.pendingEvents.includes('last_refrain')) return this.getEventById('last_refrain');
    if (story.caravanSeen === false) return this.getEventById('burning_caravan');
    if (story.banditsStopped === true && story.hermitState === 'safe' && !story.cheerfulHermitVisited) {
      return this.getEventById('cheerful_hermit');
    }
    if (story.caravanResolved && !story.caravanEpilogueSeen) return this.getEventById('caravan_aftermath');
    if (story.musicBoxSeen === false) return this.getEventById('singing_box');
    if (story.bardResolved && !story.bardEpilogueSeen) return this.getEventById('last_refrain');
    return this.getEventById('quiet_crossroads');
  }

  getEventById(id) {
    return EVENTS.find(event => event.id === id) || EVENTS[0];
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
      musicBoxSeen: false,
      musicBoxState: 'unknown',
      duelistState: 'unknown',
      birdState: 'unknown',
      bardThreadState: 'unknown',
      bardResolved: false,
      bardEnding: 'unresolved',
      bardEpilogueSeen: false,
      bardEpilogueChoice: 'none',
      pendingEvents: []
    };

    const defaultHeroMemory = {
      learnedBanditsThreatenHermit: false,
      learnedDonkeyCanBeSaved: false,
      solvedCaravanPerfectly: false,
      learnedMusicBoxBreaks: false,
      learnedDuelistKnowsSong: false,
      learnedBirdLikesFood: false,
      solvedBardSong: false
    };

    const existingStoryRun = this._isPlainObject(this.gameState.storyRun)
      ? this.gameState.storyRun
      : {};
    const pendingEvents = Array.isArray(existingStoryRun.pendingEvents)
      ? [...new Set(existingStoryRun.pendingEvents.filter(id => typeof id === 'string'))]
      : [];
    const inferredCaravanResolved = Boolean(
      existingStoryRun.caravanSeen
      && ['robbed', 'comforted', 'friend'].includes(existingStoryRun.hermitState)
    );
    const inferredBardResolved = ['complete', 'salvaged', 'abandoned', 'released']
      .includes(existingStoryRun.bardThreadState);

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
      musicBoxState: typeof existingStoryRun.musicBoxState === 'string'
        ? existingStoryRun.musicBoxState
        : defaultStoryRun.musicBoxState,
      duelistState: typeof existingStoryRun.duelistState === 'string'
        ? existingStoryRun.duelistState
        : defaultStoryRun.duelistState,
      birdState: typeof existingStoryRun.birdState === 'string'
        ? existingStoryRun.birdState
        : defaultStoryRun.birdState,
      bardThreadState: typeof existingStoryRun.bardThreadState === 'string'
        ? existingStoryRun.bardThreadState
        : defaultStoryRun.bardThreadState,
      bardResolved: typeof existingStoryRun.bardResolved === 'boolean'
        ? existingStoryRun.bardResolved
        : inferredBardResolved,
      bardEnding: typeof existingStoryRun.bardEnding === 'string'
        ? existingStoryRun.bardEnding
        : existingStoryRun.bardThreadState === 'complete'
          ? 'completed_song'
          : defaultStoryRun.bardEnding,
      bardEpilogueSeen: Boolean(existingStoryRun.bardEpilogueSeen),
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

  damagePlayer(amount) {
    if (!this.gameState || !Number.isFinite(amount) || amount <= 0) return;
    const currentHealth = Number.isFinite(this.gameState.playerHealth)
      ? this.gameState.playerHealth
      : 0;
    this.gameState.playerHealth = Math.max(0, currentHealth - amount);
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
    if (thread === 'bard') {
      this.clearPendingEvent('last_refrain');
      this.gameState.storyRun.bardResolved = true;
      this.gameState.storyRun.bardEpilogueSeen = true;
      this.gameState.storyRun.bardEpilogueChoice = choice;
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
    return Boolean(item && !this._isKeyCard(item) && !this._isPotionCard(item));
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
    return this.event.choices.filter(choice => this._isChoiceVisible(choice));
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
    const paperWidth = 388;
    const paperHeight = 318;
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
    const board = this.add.image(x, y + 34, boardTexture)
      .setDisplaySize(456, 342)
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
      container.add(
        this.add.image(17, -5, 'eventsShops', frame)
          .setOrigin(0.5)
          .setScale(1)
      );
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
    try {
      if (typeof localStorage === 'undefined') return {};
      const stored = JSON.parse(localStorage.getItem(HERO_MEMORY_SAVE_KEY) || '{}');
      return this._isPlainObject(stored) ? stored : {};
    } catch {
      return {};
    }
  }

  _saveStoredHeroMemory() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(HERO_MEMORY_SAVE_KEY, JSON.stringify(this.gameState.heroMemory));
    } catch {
      // Memory still survives on gameState even if storage is unavailable.
    }
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
    const compactChoices = this._visibleChoices.length > 4;
    this.eventLayout = {
      centerX: 255,
      textWidth: 312,
      buttonWidth: 324,
      buttonTextWidth: 300
    };

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2e).setDepth(-10);
    this._createEventIllustrationBoard(this._getEventIllustrationFrame());
    this._createEventBoardBase(this.eventLayout.centerX, 182);
    this._createEventPaper(this.eventLayout.centerX, 182);

    // Title
    this.add.text(this.eventLayout.centerX, 42, this.event.title, {
      fontSize: '20px', fill: PURPLE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5).setDepth(2);

    // Description
    this.descText = this.add.text(this.eventLayout.centerX, 98, this._getEventDescription(), {
      fontSize: '12px', fill: INK, fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: this.eventLayout.textWidth }
    }).setOrigin(0.5).setDepth(2);

    // Divider
    this.add.rectangle(this.eventLayout.centerX, 137, 340, 1, 0x8f6b45).setDepth(2);

    // Choice buttons
    this._choiceBtns = [];
    this._buildChoices();

    // Outcome text (hidden until a choice is made)
    this.outcomeText = this.add.text(this.eventLayout.centerX, compactChoices ? 313 : 306, '', {
      fontSize: compactChoices ? '11px' : '13px',
      fill: '#225a2a',
      fontFamily: '"HoMM Pixel"',
      align: 'center',
      wordWrap: { width: this.eventLayout.textWidth }
    }).setOrigin(0.5).setAlpha(0);
    this.outcomeText.setDepth(2);

    // Continue button (hidden until resolved)
    if (this.textures.exists('nextTurnUp')) {
      this.continueBtn = this.add.image(this.eventLayout.centerX, 340, 'nextTurnUp')
        .setDisplaySize(164, 28)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0)
        .setDepth(2);
    } else {
      this.continueBtn = this.add.rectangle(this.eventLayout.centerX, 340, 164, 24, 0x080808, 0.66)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0)
        .setDepth(2);
    }
    this.continueBtnText = this.add.text(this.eventLayout.centerX, 340, 'Continue', {
      fontSize: '14px', fill: WHITE, fontFamily: '"HoMM Pixel"'
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
    const compactChoices = choices.length > 4;
    const veryCompactChoices = choices.length > 6;
    const layout = this.eventLayout || {
      centerX: 255,
      buttonWidth: 372,
      buttonTextWidth: 340
    };
    const startY = veryCompactChoices ? 151 : compactChoices ? 158 : 166;
    const gap = veryCompactChoices ? 20 : compactChoices ? 23 : choices.length > 3 ? 31 : 38;
    const buttonHeight = veryCompactChoices ? 20 : compactChoices ? 23 : 34;

    choices.forEach((choice, i) => {
      const y = startY + i * gap;

      const bg = this.add.rectangle(layout.centerX, y, layout.buttonWidth, buttonHeight, 0x050505, 0.58)
        .setDepth(2);

      const label = this.add.text(layout.centerX, y, choice.text, {
        fontSize: veryCompactChoices ? '10px' : compactChoices || choice.text.length > 44 ? '11px' : '13px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel"',
        align: 'center',
        wordWrap: { width: layout.buttonTextWidth }
      }).setOrigin(0.5).setDepth(3);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { bg.setFillStyle(0x111111, 0.78); });
      bg.on('pointerout', () => { bg.setFillStyle(0x050505, 0.58); });
      bg.on('pointerdown', () => this._resolve(choice, i));

      this._choiceBtns.push({ bg, label });
    });
  }

  _resolve(choice, choiceIdx) {
    if (this.resolved) return;
    this.resolved = true;

    choice.action?.(this.gameState, this);
    const compactResolution = this._choiceBtns.length > 4;

    // Highlight chosen, fade the rest
    this._choiceBtns.forEach(({ bg, label }, i) => {
      if (i === choiceIdx) {
        bg.setFillStyle(0x1f1a12, 0.86);
        bg.removeInteractive();
        if (compactResolution) {
          bg.setY(165);
          label.setY(165);
        }
      } else {
        bg.setAlpha(compactResolution ? 0 : 0.3);
        label.setAlpha(compactResolution ? 0 : 0.3);
        bg.removeInteractive();
      }
    });

    // Show outcome and continue button
    const outcome = this._getChoiceOutcome(choice);
    if (outcome) {
      if (compactResolution) {
        this.outcomeText.setY(250).setFontSize('12px');
      }
      this.outcomeText.setText(outcome);
      this.tweens.add({ targets: this.outcomeText, alpha: 1, duration: 300 });
    }
    this.tweens.add({
      targets: [this.continueBtn, this.continueBtnText],
      alpha: 1, duration: 300, delay: outcome ? 400 : 0
    });
  }

  continueAdventure() {
    this.scene.stop();
    this.scene.wake('MapViewScene');
  }
}
