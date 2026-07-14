// EventScene.js
// Unknown encounter events. Each event has a title, description, and a list of choices.
// Choices can have a condition (function returning bool) that hides them if not met.
// After a choice is made, an optional outcome message is shown before returning to the map.
// To add new events, add objects to the EVENTS array below.

import { CardDataGenerator } from '../CardDataGenerator.js';
import { loadHeroMemory, saveHeroMemory, saveStoryProgress } from '../utils/StoryProgress.js';
import { t, translateDescription, translateItemName } from '../utils/i18n.js';
import { createTitle } from '../utils/titleText.js';
import { SoundHelper } from '../utils/SoundHelper.js';

const EVENT_ILLUSTRATION_FRAMES = {
  broken_music_box: 2,
  monster_bird_nest: 9,
  goblin_engineer: 12,
  hatching_egg: 9,
  quiet_crossroads: 7,
  mirror: 11,
  too_nice_room: 14,
  almost_you_well: 15,
  slimy_prison: 16,
  book_worm: 19,
  briar_room: 23,
  old_drill_room: 26,
  something_wicked: 7,
  brass_wizard: 28
};

const CARNIVAL_HAG_FRAME = 27;

const EVENTS = [
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
    description: 'You step into a quiet underground library.\n\nTall shelves vanish into the darkness above. Small lanterns drift between them.\n\nAt a reading desk, a dark elf woman is reading a huge book. She does not look up. You stand beside her awkwardly. She does not notice you.\n\nThen you see a pale book worm crawling across the open page. It drags itself slowly over the letters, eating a thin path through the ink.\n\nYou gently lift it from the book. The librarian finally looks at you.\n\n"Book worms," she says. "They ruin old spells if you let them feed too long."',
    choices: [
      {
        text: 'Feed it a magic card',
        condition: (gs, scene) => scene.hasMagicCard(),
        action: (gs, scene) => {
          scene.consumeMagicCard();
          scene.gainAmulet('mothWingDust');
        },
        outcomeFrame: 20,
        outcome: 'You hold out one of your magic cards.\n\nThe book worm sways toward it, then devours half the card quickly, as if it has been starving. Its pale body curls tight.\n\nThen it unfolds into a small library moth.\n\nThe moth circles once above your hand, shaking silver dust from its wings. You collect the dust in a small vial.\n\nThe librarian watches the moth disappear into the shelves.\n\n"Moths are better," she says. "They leave the books alone."'
      },
      {
        text: 'Squish the book worm',
        action: (gs, scene) => scene.gainAmulet('wormVenomCharm'),
        outcomeFrame: 21,
        outcome: 'You close your fingers around the book worm.\n\nIt leaves a smear of bitter green venom on your palm.\n\nThe librarian looks at it, then reaches for a tiny glass charm. She scrapes the venom inside and seals it.\n\n"Useful," she says, and gives it to you.'
      },
      {
        text: 'Put it back on the book',
        action: (gs, scene) => scene.gainAmulet('stolenInkPen'),
        outcomeFrame: 22,
        outcome: 'You put the book worm back on the page.\n\nIt immediately starts eating the next line.\n\nThe librarian stares at you. Then she says a quiet "Ugh," just loud enough for you to hear, gathers her things, and retreats deeper into the library.\n\nOn the desk, she leaves behind a black ink pen. You steal it.'
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
    id: 'something_wicked',
    title: 'Something Wicked',
    description: 'In the dark of the dungeon, you hear voices.\n\nCrowd chatter. Laughter. A thin happy tune played slightly out of tune.\n\nThe corridor opens into a vast carnival chamber. Colored lanterns swing overhead. Monsters crowd the prize booths. Everyone is smiling. No one looks at you.\n\nThen a hand grabs your shoulder. You turn, ready to strike — an old woman stands too close, pressing a tray of dusty trinkets against your chest.\n\n"One coin," she says. "Wonderful things. Very cheap."\n\nHer grip does not move.',
    choices: [
      {
        text: 'Buy the dusty pipe',
        trayItem: 'dustyPipe',
        traySprite: 'carnivalPipe',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('dustyPipe'),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe pipe remains in your palm. It smells like cold ash.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Buy the rubber duck',
        trayItem: 'rubberDuck',
        traySprite: 'carnivalDucky',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('rubberDuck'),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe rubber duck remains in your palm. Its painted eyes are almost worn away.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Buy the broken ring',
        trayItem: 'brokenRing',
        traySprite: 'carnivalRing',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyCarnivalJunk('brokenRing'),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe broken ring remains in your palm. The cracked gem catches no light.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Buy the four-leaf clover',
        trayItem: 'luckyClover',
        traySprite: 'luckyClover',
        condition: (gs) => (gs?.coins || 0) >= 1,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.buyLuckyClover(),
        outcome: 'You press one coin into the old woman\'s hand.\n\nHer fingers finally release your shoulder.\n\nThe clover remains in your palm, sealed under cloudy glass.\n\nFor one second, it glitters green.\n\nWhen you look up, the old woman has vanished into the crowd.'
      },
      {
        text: 'Refuse',
        trayRefuse: true,
        outcomeFrame: CARNIVAL_HAG_FRAME,
        action: (gs, scene) => scene.refuseCarnivalHag(),
        outcome: 'You twist away from the old woman\'s grip.\n\nHer nails scrape your shoulder.\n\nShe watches you disappear into the carnival crowd without blinking.'
      }
    ]
  },
  {
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
    if (story.pendingEvents.includes('brass_wizard')) return this.getEventById('brass_wizard');
    // The music box is the sole story opener. (The donkey caravan + hermit
    // thread was removed and no longer appears at all.)
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
    if (!story.carnivalVisited) bonusFillers.push('something_wicked');
    if (story.carnivalVisited && !story.brassWizardSeen) bonusFillers.push('brass_wizard');
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
      const forceable = new Set(['broken_music_box', 'monster_bird_nest', 'goblin_engineer', 'hatching_egg', 'mirror', 'too_nice_room', 'almost_you_well', 'slimy_prison', 'book_worm', 'briar_room', 'old_drill_room', 'something_wicked', 'brass_wizard']);
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
      carnivalVisited: false,
      carnivalHagMet: false,
      brassWizardSeen: false,
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
      carnivalVisited: Boolean(existingStoryRun.carnivalVisited),
      carnivalHagMet: Boolean(existingStoryRun.carnivalHagMet),
      brassWizardSeen: Boolean(existingStoryRun.brassWizardSeen),
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

  // Raw HP mutation, no reward text — shared by heal() and fullHeal() so each
  // can report its own wording without double-printing a reward line.
  _applyHeal(amount) {
    if (!this.gameState || !Number.isFinite(amount)) return 0;
    const before = Number.isFinite(this.gameState.playerHealth) ? this.gameState.playerHealth : 0;
    if (typeof this.gameState.heal === 'function') {
      this.gameState.heal(amount);
    } else {
      const maxHealth = Number.isFinite(this.gameState.maxHealth)
        ? this.gameState.maxHealth
        : before + amount;
      this.gameState.playerHealth = Math.min(maxHealth, before + amount);
    }
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    return (this.gameState.playerHealth || 0) - before;
  }

  heal(amount) {
    const gained = this._applyHeal(amount);
    if (gained > 0) this._reward(`+${gained} HP`);
    return gained;
  }

  gainCoins(amount) {
    if (!this.gameState || !Number.isFinite(amount) || amount === 0) return;
    const currentCoins = Number.isFinite(this.gameState.coins) ? this.gameState.coins : 0;
    this.gameState.coins = currentCoins + amount;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    this._reward(`${amount > 0 ? '+' : ''}${amount} coins`);
  }

  gainCrystals(amount) {
    if (!this.gameState || !Number.isFinite(amount) || amount === 0) return;
    const currentCrystals = Number.isFinite(this.gameState.crystals) ? this.gameState.crystals : 0;
    this.gameState.crystals = currentCrystals + amount;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    this._reward(`${amount > 0 ? '+' : ''}${amount} crystals`);
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
    if (this._addCardToInventory(egg)) {
      this._reward(`Gained: ${egg?.name || 'Egg'}`);
      return true;
    }
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

  markHeroMemory(key) {
    this.ensureStoryState();
    if (!(key in this.gameState.heroMemory)) return false;

    this.gameState.heroMemory[key] = true;
    this._saveStoredHeroMemory();
    return true;
  }

  addPotionToInventory() {
    const potion = new CardDataGenerator().createPotionCard(this.gameState?.currentFloor || 1);
    const added = this._addCardToInventory(potion);
    if (added) this._reward(`Gained: ${potion?.name || 'Potion'}`);
    return added;
  }

  markCarnivalHagMet() {
    this.ensureStoryState();
    this.gameState.storyRun.carnivalVisited = true;
    this.gameState.storyRun.carnivalHagMet = true;
  }

  spendCoins(amount) {
    if (!this.gameState || !Number.isFinite(amount) || amount <= 0) return false;
    const before = Number.isFinite(this.gameState.coins) ? this.gameState.coins : 0;
    if (before < amount) return false;
    this.gameState.coins = before - amount;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    this._reward(`-${amount} coin${amount === 1 ? '' : 's'}`);
    return true;
  }

  buyCarnivalJunk(junkId) {
    this.markCarnivalHagMet();
    if (!this.spendCoins(1)) return false;
    const junk = this.createCarnivalJunkCard(junkId);
    const added = this._deliverCardReward(junk, junk.name || 'Carnival Junk', `Gained junk card: ${junk.name || 'Carnival Junk'}`);
    this.addPendingEvent('brass_wizard');
    return added;
  }

  buyLuckyClover() {
    this.markCarnivalHagMet();
    if (!this.spendCoins(1)) return false;
    this.addPendingEvent('brass_wizard');

    // The clover lands in the bag as an equipable amulet card (with a little
    // card→amulet morph), rather than auto-equipping. The player taps it in a
    // later battle to actually wear it. If the bag is full, fall back to
    // equipping it outright so the coin is never wasted.
    const inv = this.gameScene?.inventorySystem;
    const slot = inv?.deliverCloverAmulet?.();
    if (Number.isInteger(slot) && slot >= 0) {
      this.gameScene?.updateUI?.();
      this._reward('Gained: Lucky Clover — tap it in battle to equip');
      this._pushRewardIcon('relicsOthers', 69, 'luckyClover');
      return true;
    }
    return this.gainAmulet('luckyClover');
  }

  refuseCarnivalHag() {
    this.markCarnivalHagMet();
    this.loseHealthCapped(3);
    this.addPendingEvent('brass_wizard');
  }

  createCarnivalJunkCard(junkId) {
    const data = {
      dustyPipe: {
        id: 'carnivalDustyPipe',
        name: 'Dusty Pipe',
        sprite: 'carnivalPipe',
        description: 'Cold ash clings to the bowl. The stem points toward bad ideas.'
      },
      rubberDuck: {
        id: 'carnivalRubberDuck',
        name: 'Rubber Duck',
        sprite: 'carnivalDucky',
        description: 'Its painted eyes are almost gone. It still seems amused.'
      },
      brokenRing: {
        id: 'carnivalBrokenRing',
        name: 'Broken Ring',
        sprite: 'carnivalRing',
        description: 'A cracked gem catches no light, but it remembers being expensive.'
      }
    }[junkId] || {
      id: 'carnivalJunk',
      name: 'Carnival Junk',
      description: 'A cheap prize from a carnival that should not fit inside the dungeon.'
    };

    return {
      ...data,
      type: 'junk',
      rarity: 'common',
      carnivalToken: true,
      noEffect: true,
      cost: 1
    };
  }

  hasCarnivalJunk() {
    return Boolean(this.getFirstCarnivalJunk());
  }

  getFirstCarnivalJunk() {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots)) return null;
    return slots.find(item => this.isCarnivalJunk(item)) || null;
  }

  isCarnivalJunk(item) {
    return Boolean(item?.type === 'junk' && item?.carnivalToken);
  }

  createRespectableCarnivalCard() {
    const generator = new CardDataGenerator();
    const floor = this.gameState?.currentFloor || 1;
    const types = ['weapon', 'armor', 'thorns', 'potion', 'food', 'magic'];
    let type = types[Math.floor(Math.random() * types.length)];
    const rarityRoll = Math.random();
    const rarity = rarityRoll < 0.12 ? 'rare' : rarityRoll < 0.42 ? 'uncommon' : 'common';

    for (let tries = 0; tries < 8; tries++) {
      const targetRarity = ['weapon', 'armor', 'thorns'].includes(type) ? rarity : null;
      const card = generator.createCardData(type, floor, false, this.gameState, targetRarity);
      if (card) {
        card.carnivalTouched = true;
        return card;
      }
      type = types[Math.floor(Math.random() * types.length)];
    }

    const fallback = generator.createPotionCard(floor);
    fallback.carnivalTouched = true;
    return fallback;
  }

  insertBrassWizardCoin() {
    this.ensureStoryState();
    this.clearPendingEvent('brass_wizard');
    this.gameState.storyRun.carnivalVisited = true;
    this.gameState.storyRun.brassWizardSeen = true;
    if (!this.spendCoins(1)) return false;

    const roll = Math.random();
    if (roll < 0.25) {
      this.brassWizardOutcome = 'The brass wizard\'s hand jerks toward the deck inside its chest.\n\nThen it stops.\n\nIts painted mouth snaps open.\n\nClick.\n\nClick-click.\n\nClick-click-click.\n\nThe sound grows louder, sharp and metallic, echoing from inside the booth.\n\nThe wizard\'s pale eyes stare past you while its puppet mouth keeps clacking faster and faster.\n\nFor a moment, you are sure you broke something.\n\nOr woke something.\n\nYou step back, then turn and push your way into the carnival crowd, just to get away from that awful clicking.';
      this._reward('No reward');
      return true;
    }

    if (roll < 0.55) {
      const card = this.createRespectableCarnivalCard();
      this._deliverCardReward(card, card?.name || 'fortune card', `Gained card: ${card?.name || 'Fortune Card'}`);
      this.brassWizardOutcome = 'The brass wizard\'s hand moves stiffly behind the glass.\n\nIts fingers scrape across the deck inside its chest.\n\nAfter a long pause, one card slides out through the slot.\n\nThe card is warm, as if the machine had been holding it for years.';
      return true;
    }

    if (roll < 0.80) {
      this.brassWizardOutcome = 'The brass wizard\'s hand lifts behind the glass.\n\nIt cannot reach you.\n\nInstead, a narrow tray snaps out from the booth with a hard wooden clack.\n\nThe tray is exactly the size of a card.\n\nThe wizard\'s pale eyes lower toward your inventory.\n\nIts puppet mouth clicks once.\n\nThen it waits.';
      this._brassWizardTrayOpen = true;
      return true;
    }

    this.gainAmulet('fortuneCard');
    this.brassWizardOutcome = 'The brass wizard\'s pale eyes roll upward.\n\nFor a moment, they are blank.\n\nThen they settle into a color they should not have.\n\nHuman eyes.\n\nThe machine goes still.\n\nIt looks at you for a little too long.\n\nNo music reaches this booth now.\n\nThe puppet mouth opens.\n\nClick.\n\nClick.\n\nIts brass hand opens slowly behind the glass.\n\nA single fortune card slides out.';
    return true;
  }

  // The wizard's tray is now a physical drop target (_setupWizardTray): the
  // player drags a card from their bag onto it. Only the "decline" option
  // remains as a button; the junk-trade and reroll happen on drop.
  getBrassWizardTrayChoices() {
    return [{
      text: 'Pull your hand back',
      trayDecline: true,
      action: () => {},
      outcome: 'You step away from the waiting tray.\n\nThe brass wizard does not move.\n\nAfter a few seconds, the tray slides back into the booth by itself.'
    }];
  }

  isBrassWizardRerollable(item) {
    return Boolean(
      item
      && !this.isCarnivalJunk(item)
      && item.type !== 'junk'
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
    );
  }

  createHolographicOmenCard() {
    return {
      id: 'holographicOmen',
      type: 'passive',
      name: 'Holographic Omen',
      rarity: 'rare',
      sprite: 'holographicOmen',
      passiveEffect: 'holographicOmen',
      description: 'At the start of combat, revealed enemies receive random status effects. Sometimes backfires.',
      flavor: 'A shiny carnival card that makes every fight begin wrong.',
      unique: true
    };
  }

  createSameTypeRerollCard(oldCard) {
    const generator = new CardDataGenerator();
    const floor = this.gameState?.currentFloor || 1;
    const rarity = oldCard?.rarity || 'common';
    const type = oldCard?.type;
    const targetRarity = ['weapon', 'armor', 'thorns'].includes(type) ? rarity : null;

    for (let tries = 0; tries < 12; tries++) {
      const card = generator.createCardData(type, floor, false, this.gameState, targetRarity);
      if (!card) continue;
      if (oldCard?.rarity && card.rarity && card.rarity !== oldCard.rarity) continue;
      if ((card.name || card.id) === (oldCard.name || oldCard.id) && tries < 8) continue;
      card.carnivalTouched = true;
      return card;
    }
    return this.createRespectableCarnivalCard();
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
    const before = Number(item.durability);
    item.durability = Math.min(Number(item.maxDurability), before + amount);
    const repaired = item.durability - before;
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    this.gameScene?.updateEquippedArmorPanel?.();
    this.gameScene?.updateUI?.();
    if (repaired > 0) this._reward(`Repaired: ${item.name || 'item'} (+${repaired} durability)`);
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

  _centerTextOnPixel(textObject, centerX) {
    if (!textObject) return textObject;
    // A centered origin can put an odd-width text texture on a half pixel,
    // which makes the pixel font look soft (most visible in Book Worm's long
    // scrolling paragraph). Anchor its top-left corner to whole pixels instead.
    textObject.setOrigin(0, 0);
    textObject.x = Math.round(centerX - textObject.width / 2);
    textObject.y = Math.round(textObject.y);
    return textObject;
  }

  _createEventPaper(x, y) {
    // Grown upward (taller top, same bottom) so the parchment sits behind the
    // title instead of the title floating at its top edge. The bottom is
    // unchanged so it still clears the inventory strip shown during the event.
    const paperWidth = 388;
    const paperHeight = 244;
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
      .setDisplaySize(456, 248)
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
      this.eventIllustrationImage = this.add.image(23, -5, 'eventsShops', frame)
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

  _clearReadingScroll() {
    const scroll = this._readingScroll;
    if (!scroll) return;
    scroll.targets?.forEach(entry => (entry?.target || entry)?.clearMask?.());
    scroll.mask?.destroy?.();
    scroll.maskShape?.destroy?.();
    scroll.up?.destroy?.();
    scroll.down?.destroy?.();
    scroll.track?.destroy?.();
    scroll.thumb?.destroy?.();
    this._readingScroll = null;
  }

  _setReadingScroll(targets, top, bottom, contentBottom) {
    this._clearReadingScroll();
    const liveTargets = (targets || []).filter(target => target?.scene);
    if (!liveTargets.length) return;

    const maxOffset = Math.max(0, Math.ceil(contentBottom - bottom));
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff).fillRect(
      this.eventLayout.centerX - 172,
      top,
      344,
      bottom - top
    );
    const mask = maskShape.createGeometryMask();
    liveTargets.forEach(target => target.setMask(mask));

    const scroll = {
      targets: liveTargets.map(target => ({ target, baseY: target.y })),
      top,
      bottom,
      maxOffset,
      offset: 0,
      mask,
      maskShape,
      bounds: new Phaser.Geom.Rectangle(this.eventLayout.centerX - 172, top, 344, bottom - top)
    };
    this._readingScroll = scroll;

    if (maxOffset <= 0) return;

    const arrowX = this.eventLayout.centerX + 178;
    const makeArrow = (label, y, delta) => {
      const arrow = this.add.text(arrowX, y, label, {
        fontSize: '11px', fill: '#6c4f35', fontFamily: '"HoMM Pixel"',
        backgroundColor: '#ead2aa', padding: { x: 3, y: 1 }
      }).setOrigin(0.5).setDepth(8).setInteractive({ useHandCursor: true });
      arrow.on('pointerdown', () => this._scrollReading(delta));
      return arrow;
    };

    scroll.up = makeArrow('^', top + 10, -24);
    scroll.down = makeArrow('v', bottom - 10, 24);

    // Regular scroll bar: a track rail between the arrows with a draggable thumb
    // (replaces the old vertical "scroll" hint word). The thumb is the scroll.png
    // pixel-art icon at native size — a fixed-size handle rather than one sized
    // to the visible-content proportion, since stretching an 8x24 pixel-art
    // sprite to arbitrary heights would smear it. Drag the thumb, or click the
    // track, to scroll.
    const trackTop = top + 20;
    const trackBottom = bottom - 20;
    const trackHeight = Math.max(10, trackBottom - trackTop);
    scroll.track = this.add.rectangle(arrowX, (trackTop + trackBottom) / 2, 4, trackHeight, 0x8f6b45, 0.35)
      .setDepth(8).setInteractive({ useHandCursor: true });

    const hasHandleTexture = this.textures.exists('scrollHandle');
    const thumbHeight = hasHandleTexture
      ? Math.min(this.textures.get('scrollHandle').getSourceImage().height, trackHeight)
      : Phaser.Math.Clamp(Math.round(trackHeight * (bottom - top) / ((bottom - top) + maxOffset)), 12, trackHeight);
    scroll.thumbMinY = trackTop + thumbHeight / 2;
    scroll.thumbMaxY = trackBottom - thumbHeight / 2;
    scroll.thumbTravel = scroll.thumbMaxY - scroll.thumbMinY;
    scroll.thumb = hasHandleTexture
      ? this.add.image(arrowX, scroll.thumbMinY, 'scrollHandle').setOrigin(0.5)
      : this.add.rectangle(arrowX, scroll.thumbMinY, 6, thumbHeight, 0x6c4f35, 1);
    scroll.thumb.setDepth(9).setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(scroll.thumb);
    scroll.thumb.on('drag', (pointer, dragX, dragY) => {
      const clamped = Phaser.Math.Clamp(dragY, scroll.thumbMinY, scroll.thumbMaxY);
      const frac = scroll.thumbTravel > 0 ? (clamped - scroll.thumbMinY) / scroll.thumbTravel : 0;
      this._setScrollOffset(Math.round(frac * scroll.maxOffset));
    });
    scroll.track.on('pointerdown', (pointer) => {
      const frac = scroll.thumbTravel > 0
        ? Phaser.Math.Clamp((pointer.y - scroll.thumbMinY) / scroll.thumbTravel, 0, 1)
        : 0;
      this._setScrollOffset(Math.round(frac * scroll.maxOffset));
    });

    this._setScrollOffset(0);
  }

  _scrollReading(delta) {
    const scroll = this._readingScroll;
    if (!scroll?.maxOffset) return;
    this._setScrollOffset(scroll.offset + delta);
  }

  _setScrollOffset(value) {
    const scroll = this._readingScroll;
    if (!scroll?.maxOffset) return;
    scroll.offset = Phaser.Math.Clamp(value, 0, scroll.maxOffset);
    scroll.targets.forEach(({ target, baseY }) => {
      if (target?.scene) target.y = baseY - scroll.offset;
    });
    scroll.up?.setAlpha(scroll.offset > 0 ? 1 : 0.35);
    scroll.down?.setAlpha(scroll.offset < scroll.maxOffset ? 1 : 0.35);
    if (scroll.thumb) {
      const frac = scroll.maxOffset > 0 ? scroll.offset / scroll.maxOffset : 0;
      scroll.thumb.y = scroll.thumbMinY + frac * scroll.thumbTravel;
    }
  }

  _enableReadingWheel() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const scroll = this._readingScroll;
      if (!scroll?.maxOffset || !Phaser.Geom.Rectangle.Contains(scroll.bounds, pointer.x, pointer.y)) return;
      this._scrollReading(deltaY > 0 ? 24 : -24);
    });
  }

  _getChoiceBounds() {
    const objects = (this._choiceBtns || [])
      .flatMap(({ bg, label }) => [bg, label])
      .filter(object => object?.scene && object.visible !== false);
    if (!objects.length) return null;

    let top = Infinity;
    let bottom = -Infinity;
    objects.forEach(object => {
      const height = object.displayHeight || object.height || 0;
      const originY = Number.isFinite(object.originY) ? object.originY : 0.5;
      const objectTop = object.y - height * originY;
      top = Math.min(top, objectTop);
      bottom = Math.max(bottom, objectTop + height);
    });

    return Number.isFinite(top) && Number.isFinite(bottom)
      ? { top: Math.floor(top), bottom: Math.ceil(bottom), height: Math.ceil(bottom - top) }
      : null;
  }

  _fitDescriptionAboveChoices() {
    if (!this.descText?.scene) return;

    const top = 42;
    const choiceBounds = this._getChoiceBounds();
    const fallbackBottom = 132;
    const gapAboveChoices = 6;
    const bottom = choiceBounds
      ? Math.max(top + 24, Math.floor(choiceBounds.top - gapAboveChoices))
      : fallbackBottom;

    this._descriptionViewportBottom = bottom;
    this._setReadingScroll(
      [this.descText],
      top,
      bottom,
      this.descText.y + this.descText.height
    );
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
    this._enableReadingWheel();
    this.events.once('shutdown', () => {
      // Also clean up abnormal exits (scene replacement, defeat, etc.). The
      // normal Continue path already does this, making the call idempotent.
      this._disableEventStation();
    });

    // Background — dim only the top region so the bottom inventory strip shows
    // through on the dungeon floor (like combat) instead of being covered.
    this.add.rectangle(W / 2, 124, W, 250, 0x1a1a2e, 0.92).setDepth(-10);
    this._createEventIllustrationBoard(this._getEventIllustrationFrame());
    this._createEventBoardBase(this.eventLayout.centerX, 126);
    this._createEventPaper(this.eventLayout.centerX, 126);

    // The copying mirror and the well use their illustration as a card drop target.
    if (this.event?.id === 'mirror') this._setupMirrorDropZone();
    if (this.event?.id === 'almost_you_well') this._setupWellDropZone();

    // Title — dedicated crisp 16px bitmap font (1-bit rasterized from Able5.ttf),
    // shared with the other screen titles via createTitle. The body bitmap font
    // only has crisp 10px/20px steps and a scaled TTF was soft; this pre-
    // rasterized font is pixel-sharp at 16px under the 2x zoom.
    createTitle(this, this.eventLayout.centerX, 26, this.event.title, {
      color: PURPLE, fallbackSize: '20px', depth: 2
    });

    // Description — top-anchored just under the title so a tall description
    // grows downward instead of overlapping the title.
    const eventDescription = this._getEventDescription();
    this.descText = this.add.text(this.eventLayout.centerX, 42, eventDescription, {
      fontSize: '12px', fill: INK, fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: 328 }
    }).setDepth(2);
    this._centerTextOnPixel(this.descText, this.eventLayout.centerX);

    // The choices keep their own safe area above the inventory. Once they are
    // rendered, their measured bounds determine how tall the description's
    // reading viewport can be.
    // The thin divider between the story text and the choices is intentionally
    // omitted — the open gap between the two blocks separates them well enough.
    // dividerY is kept only to anchor where the choice stack may begin.
    const dividerY = 138;
    this._choiceTopY = dividerY + 8;

    // Choice buttons
    this._choiceBtns = [];
    this._buildChoices();
    this._fitDescriptionAboveChoices();

    // The carnival hag presents her wares as a physical tray of trinkets the
    // player drags into their bag, instead of a stack of text buttons.
    if (this.event?.id === 'something_wicked') this._setupCarnivalTray();

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
      SoundHelper.playSound(this, 'hover_soft', 0.4);
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
    // The carnival hag renders her buy/refuse options as a draggable tray
    // (_setupCarnivalTray), so skip the normal text-button stack entirely.
    if (this.event?.id === 'something_wicked') return;

    const choices = this._visibleChoices || this._getVisibleChoices();
    const n = choices.length;
    const layout = this.eventLayout || {
      centerX: 255,
      buttonWidth: 324,
      buttonTextWidth: 300
    };

    // Choices are packed tightly and bottom-anchored low on the paper, so the
    // stack reads as one grouped block near the inventory strip rather than a
    // spread-out ladder starting right under the description. Dense events
    // (>5 choices) still split into two columns; the gap compresses to fit
    // when there are enough rows to need it.
    const INV_TOP = 246;
    const columns = n > 5 ? 2 : 1;
    const rows = Math.max(1, Math.ceil(n / columns));
    const lastCenterY = INV_TOP - 19;                  // bottom-most row center (nudged up 3px)
    const topLimit = (this._choiceTopY ?? 146) + 20;   // stay >=20px below the story text
    const availSpan = lastCenterY - topLimit;
    const gap = rows > 1
      ? Math.max(16, Math.min(24, Math.floor(availSpan / (rows - 1))))
      : 0;
    // Anchor the block to the bottom; clamp so it never rides up into the text.
    const startY = rows > 1
      ? Math.max(topLimit, lastCenterY - (rows - 1) * gap)
      : Math.round((topLimit + lastCenterY) / 2);
    // buttonHeight = gap - 2 keeps a consistent ~2px gutter between buttons.
    const buttonHeight = gap ? Math.max(12, gap - 2) : 22;
    const smallFont = columns === 2 || buttonHeight < 16;
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
        fontSize: smallFont ? '10px' : (choice.text.length > 44 ? '11px' : '13px'),
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel"',
        align: 'center',
        wordWrap: { width: textWidth }
      }).setOrigin(0.5).setDepth(3);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { SoundHelper.playSound(this, 'hover_soft', 0.4); bg.setFillStyle(0x111111, 0.78); });
      bg.on('pointerout', () => { bg.setFillStyle(0x050505, 0.58); });
      bg.on('pointerdown', () => this._resolve(choice, i));

      this._choiceBtns.push({ bg, label });
    });
  }

  _resolve(choice, choiceIdx, opts = {}) {
    if (this.resolved) return;
    this.resolved = true;

    // Effect helpers push concrete "gained/lost" lines (and amulet icons) here
    // during the action. (The well trade fills these before calling _resolve,
    // so keepRewards.)
    if (!opts.keepRewards) { this._rewardLines = []; this._rewardIcons = []; }
    choice.action?.(this.gameState, this);

    if (this.event?.id === 'brass_wizard' && this._brassWizardTrayOpen) {
      this._brassWizardTrayOpen = false;
      choice.next = { choices: this.getBrassWizardTrayChoices(), wizardTray: true };
    }

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
    this._destroyCarnivalTray();
    this._destroyWizardTray();

    const rewards = this._rewardLines || [];
    this._layoutResolvedOutcome(outcome, rewards);

    // Show narration immediately. A short fade on a previously invisible text
    // object made the reward animation easier to notice than the actual story.
    this.outcomeBackdrop?.setAlpha(1);
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
    this._clearReadingScroll();
    this._hideRewardAmuletTooltip();
    const story = typeof outcome === 'string' ? outcome : '';
    const rewardLines = Array.isArray(rewards) ? rewards : [];
    const top = 66;
    const gap = story && rewardLines.length ? 8 : 0;

    // Never shrink narrative copy below the normal UI reading size. Overflow
    // is handled by the scroll window below.
    const storyFont = story.length > 150 ? 11 : 12;
    const rewardFont = 10;

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

    this._layoutRewardIcons(rewardY, rewardLines.length ? this.rewardText?.height || 0 : 0);
    const scrollTargets = [this.outcomeText, this.rewardText, ...(this._rewardIconSprites || [])];
    const iconBottom = (this._rewardIconSprites || []).reduce(
      (bottom, sprite) => Math.max(bottom, sprite.y + (sprite.displayHeight || 0)),
      0
    );
    const contentBottom = Math.max(
      story ? this.outcomeText.y + this.outcomeText.height : top,
      rewardLines.length ? this.rewardText.y + this.rewardText.height : top,
      iconBottom
    );
    this._setReadingScroll(scrollTargets, top, 238, contentBottom);
  }

  // Draws the sprite for any amulet(s) gained this resolution, centered under
  // the reward text summary — so a "Gained amulet: X" line is immediately
  // backed by the actual icon instead of just a name.
  _layoutRewardIcons(rewardY, rewardTextHeight) {
    this._rewardIconSprites?.forEach(sprite => sprite.destroy());
    this._rewardIconSprites = [];

    const icons = this._rewardIcons || [];
    if (!icons.length) return;

    const iconGap = 6;
    const iconY = rewardY + rewardTextHeight + iconGap;
    const spacing = 34;
    const startX = this.eventLayout.centerX - ((icons.length - 1) * spacing) / 2;

    icons.forEach((icon, i) => {
      if (!icon?.sprite || !this.textures.exists(icon.sprite)) return;
      const x = startX + i * spacing;
      const sprite = this.add.image(x, iconY, icon.sprite, icon.spriteFrame)
        .setOrigin(0.5, 0)
        .setDepth(4);
      if (icon.amuletId) {
        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerover', () => this._showRewardAmuletTooltip(icon.amuletId, sprite));
        sprite.on('pointerout', () => this._hideRewardAmuletTooltip());
      }
      this._rewardIconSprites.push(sprite);
    });
  }

  _showRewardAmuletTooltip(amuletId, iconSprite) {
    this._hideRewardAmuletTooltip();
    const mgr = this.gameScene?.amuletManager;
    const definition = mgr?.amuletDefinitions?.[amuletId];
    if (!definition || !iconSprite?.scene) return;

    const amulet = (this.gameState?.activeAmulets || []).find(item => item?.id === amuletId)
      || { id: amuletId, name: definition.name };
    let description = translateItemName(this, amulet) || definition.name || 'Amulet';
    description += `\n${translateDescription(this, definition.description)}`;
    if (amulet.level > 1) description += ` (${t(this, 'tooltip.level', { level: amulet.level })})`;
    if (definition.cursed) description = `${t(this, 'tooltip.cursed')} ${description}`;

    const text = this.add.text(6, 4, description, {
      fontSize: '11px',
      fill: definition.cursed ? '#ff7777' : '#ffffff',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      wordWrap: { width: 190 }
    }).setOrigin(0);
    const width = Math.ceil(text.width + 12);
    const height = Math.ceil(text.height + 8);
    const bg = this.add.rectangle(0, 0, width, height, 0x080808, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, definition.cursed ? 0xff6666 : 0xf2d3aa);

    const x = Phaser.Math.Clamp(iconSprite.x + 18, 6, 640 - width - 6);
    const y = Phaser.Math.Clamp(iconSprite.y - height - 4, 6, 244 - height);
    this.rewardAmuletTooltip = this.add.container(x, y, [bg, text]).setDepth(30);
  }

  _hideRewardAmuletTooltip() {
    this.rewardAmuletTooltip?.destroy?.(true);
    this.rewardAmuletTooltip = null;
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
    if (this._resolvedOutcome) this.outcomeText?.setAlpha(1);
    if ((this._rewardLines || []).length) this.rewardText?.setAlpha(1);
  }

  // Swaps the reveal narration into the description and replaces the choice
  // buttons with the next stage's choices, in place (no Continue yet).
  _transitionToStage(choice) {
    const revealText = this._getChoiceOutcome(choice) || '';
    if (this.descText) {
      this.descText.setVisible(true).setAlpha(1).setText(revealText);
      this.descText.setY(42);
      this._centerTextOnPixel(this.descText, this.eventLayout.centerX);
      const dividerY = 138;
      this.dividerRect?.setY(dividerY);
      this._choiceTopY = dividerY + 8;
    }

    (this._choiceBtns || []).forEach(({ bg, label }) => { bg.destroy(); label.destroy(); });
    this._choiceBtns = [];

    this._visibleChoices = choice.next.choices.filter(c => this._isChoiceVisible(c));

    if (choice.next.wizardTray) {
      // The brass wizard's tray is a drop target, not a button stack.
      this._setupWizardTray(this._visibleChoices);
    } else {
      this._buildChoices();
      this._fitDescriptionAboveChoices();
    }

    if (Number.isInteger(choice.outcomeFrame) && this.eventIllustrationImage?.setFrame) {
      this.eventIllustrationImage.setFrame(choice.outcomeFrame);
    }

    this.resolved = false; // allow picking a sub-choice
  }

  // ─── Too-Nice Room effects ───────────────────────────────────────────────

  fullHeal() {
    // Heals up to the (amulet-capped) max via the shared raw-heal path — NOT
    // heal(), which would push its own "+X HP" line and double-report
    // alongside this method's "Fully healed" wording.
    const gained = this._applyHeal(this.gameState?.maxHealth || 9999);
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
    // Delegate to gainAmulet so both entry points share one reward-text +
    // reward-icon path instead of duplicating the addAmulet/_reward calls.
    return this.gainAmulet(amulet.id);
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
      companion.sprite = 'chickCompanionUP'; // upgraded art: crackling storm chick
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
    const def = mgr.amuletDefinitions?.[id];
    const name = def?.name || 'Amulet';
    const ok = mgr.addAmulet(id);
    this.gameScene.updateUI?.();
    if (ok) {
      this._reward(`Gained amulet: ${name}`);
      this._pushRewardIcon(def?.sprite || 'relicsOthers', def?.spriteFrame ?? 0, id);
    }
    return ok;
  }

  // Records an icon to render under the reward text summary — currently only
  // used for gained amulets, so the player can immediately see what they got
  // instead of just reading its name.
  _pushRewardIcon(sprite, spriteFrame, amuletId = null) {
    if (!sprite) return;
    (this._rewardIcons ||= []).push({ sprite, spriteFrame, amuletId });
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
    this._rewardIcons = [];
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
    this._rewardIcons = [];
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

  // ─── Something Wicked (drag a trinket off the hag's tray into your bag) ───

  // Renders the carnival hag's wares as a physical tray of draggable trinkets
  // instead of a stack of text buttons. Each trinket maps to one of the event's
  // buy choices; dropping it over the inventory resolves that choice. "Refuse"
  // stays as a small button tucked below the tray.
  _setupCarnivalTray() {
    const visible = this._visibleChoices || this._getVisibleChoices();
    const trayChoices = visible.filter(choice => choice.trayItem);
    const refuseChoice = visible.find(choice => choice.trayRefuse);
    const centerX = this.eventLayout.centerX;

    // Pull the story text's reading window up so it clears the tray region.
    this._setReadingScroll([this.descText], 42, 124, this.descText.y + this.descText.height);

    this._carnivalItems = [];

    this._carnivalHint = this.add.text(
      centerX, 131,
      trayChoices.length ? 'Drag a trinket into your bag   ·   1 coin each' : 'Nothing here you can afford.',
      { fontSize: '10px', fill: '#ffe8b0', fontFamily: '"HoMM Pixel"', align: 'center' }
    ).setOrigin(0.5).setDepth(5);

    if (this.textures.exists('carnivalTray')) {
      this._carnivalTray = this.add.image(centerX, 198, 'carnivalTray').setDepth(3);
    }

    const n = trayChoices.length;
    const spacing = 62;
    const startX = centerX - ((n - 1) * spacing) / 2;
    const cardY = 176;

    trayChoices.forEach((choice, i) => {
      const x = Math.round(startX + i * spacing);
      const card = this.add.image(x, cardY, choice.traySprite)
        .setDepth(6)
        .setInteractive({ useHandCursor: true, draggable: true });
      card.setData('choice', choice);
      card.setData('homeX', x);
      card.setData('homeY', cardY);
      this.input.setDraggable(card);

      card.on('pointerover', () => {
        if (this.resolved || card.getData('dragging')) return;
        this.tweens.add({ targets: card, y: cardY - 7, scale: 1.06, duration: 110, ease: 'Cubic.easeOut' });
      });
      card.on('pointerout', () => {
        if (this.resolved || card.getData('dragging')) return;
        this.tweens.add({ targets: card, y: cardY, scale: 1, duration: 110, ease: 'Cubic.easeOut' });
      });
      card.on('dragstart', () => {
        card.setData('dragging', true);
        card.setDepth(30).setScale(1.06);
      });
      card.on('drag', (pointer, dragX, dragY) => {
        card.x = dragX;
        card.y = dragY;
      });
      card.on('dragend', (pointer) => this._handleCarnivalDrop(card, pointer));

      this._carnivalItems.push(card);
    });

    if (refuseChoice) {
      const y = 244;
      const bg = this.add.rectangle(centerX, y, 130, 15, 0x050505, 0.58)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(centerX, y, refuseChoice.text, {
        fontSize: '11px', fill: '#ffffff', fontFamily: '"HoMM Pixel"'
      }).setOrigin(0.5).setDepth(6);
      bg.on('pointerover', () => { SoundHelper.playSound(this, 'hover_soft', 0.4); bg.setFillStyle(0x111111, 0.78); });
      bg.on('pointerout', () => bg.setFillStyle(0x050505, 0.58));
      bg.on('pointerdown', () => this._resolve(refuseChoice, -1));
      this._carnivalRefuse = { bg, label };
    }
  }

  _handleCarnivalDrop(card, pointer) {
    card.setData('dragging', false);
    if (this.resolved) { this._returnCarnivalCard(card); return; }

    const choice = card.getData('choice');
    const target = this._carnivalDropTarget(pointer);
    const isAmulet = choice.trayItem === 'luckyClover';

    if (!target.over) { this._returnCarnivalCard(card); return; }
    if ((this.gameState?.coins || 0) < 1) {
      this.gameScene?.createFloatingText?.(pointer.x, pointer.y, 'You need a coin', 0xff6666);
      this._returnCarnivalCard(card);
      return;
    }
    // Junk trinkets need an open slot; the clover becomes an amulet and doesn't.
    if (!isAmulet && target.emptySlot < 0) {
      this.gameScene?.createFloatingText?.(pointer.x, pointer.y, 'Your bag is full', 0xff6666);
      this._returnCarnivalCard(card);
      return;
    }

    card.disableInteractive();
    this._resolve(choice, -1);
  }

  // Returns whether the pointer was released over the inventory strip and, if so,
  // the first empty slot to receive a junk trinket.
  _carnivalDropTarget(pointer) {
    const inv = this.gameScene?.inventorySystem;
    const slots = inv?.slotSprites || [];
    let minX = Infinity;
    let maxX = -Infinity;
    let midY = 309;
    let halfH = 35;
    slots.forEach(slot => {
      const bg = slot?.background;
      if (!bg) return;
      const halfW = (bg.width || 50) / 2;
      minX = Math.min(minX, bg.x - halfW);
      maxX = Math.max(maxX, bg.x + halfW);
      midY = bg.y;
      halfH = (bg.height || 70) / 2;
    });
    if (minX === Infinity) return { over: false, emptySlot: -1 };

    const pad = 14;
    const over = pointer.x >= minX - pad && pointer.x <= maxX + pad
      && pointer.y >= midY - halfH - pad && pointer.y <= midY + halfH + pad;
    if (!over) return { over: false, emptySlot: -1 };

    let emptySlot = -1;
    slots.forEach((slot, i) => {
      const bg = slot?.background;
      if (!bg || inv.slots[i] != null || emptySlot >= 0) return;
      if (Math.abs(pointer.x - bg.x) <= (bg.width || 50) / 2 + pad) emptySlot = i;
    });
    if (emptySlot < 0) emptySlot = inv.slots.findIndex(item => item == null);
    return { over: true, emptySlot };
  }

  _returnCarnivalCard(card) {
    if (!card?.scene) return;
    card.setDepth(6);
    this.tweens.add({
      targets: card,
      x: card.getData('homeX'),
      y: card.getData('homeY'),
      scale: 1,
      duration: 200,
      ease: 'Cubic.easeOut'
    });
  }

  _destroyCarnivalTray() {
    (this._carnivalItems || []).forEach(card => card?.destroy?.());
    this._carnivalItems = [];
    this._carnivalTray?.destroy?.();
    this._carnivalTray = null;
    this._carnivalHint?.destroy?.();
    this._carnivalHint = null;
    if (this._carnivalRefuse) {
      this._carnivalRefuse.bg?.destroy?.();
      this._carnivalRefuse.label?.destroy?.();
      this._carnivalRefuse = null;
    }
  }

  // ─── Brass Wizard tray (drag a card from the bag onto the wizard's tray) ──

  // Presents the wizard's tray as a physical drop target. Dropping a carnival
  // junk card trades it for the Holographic Omen; dropping a real card rerolls
  // it into another of the same type. A "pull your hand back" button declines.
  _setupWizardTray(choices) {
    const inv = this.gameScene?.inventorySystem;
    const declineChoice = (choices || []).find(c => c.trayDecline) || (choices || [])[0];
    const centerX = this.eventLayout.centerX;

    // Shorten the wizard's narration window so it clears the tray.
    this._setReadingScroll([this.descText], 42, 120, this.descText.y + this.descText.height);

    this._wizardHint = this.add.text(centerX, 128, 'Drag a card onto the tray', {
      fontSize: '11px', fill: '#ffe8b0', fontFamily: '"HoMM Pixel"', align: 'center'
    }).setOrigin(0.5).setDepth(5);

    if (this.textures.exists('wizardTray')) {
      this._wizardTray = this.add.image(centerX, 182, 'wizardTray').setDepth(3);
    }

    if (inv?.addDropZone && this._wizardTray) {
      inv.clearDropZones();
      inv.addDropZone(this._wizardTray, (slotIndex, cardData, cardSprite) =>
        this._handleWizardTrayDrop(slotIndex, cardData, cardSprite));
    }

    if (declineChoice) {
      const y = 244;
      const bg = this.add.rectangle(centerX, y, 150, 15, 0x050505, 0.58)
        .setDepth(5).setInteractive({ useHandCursor: true });
      const label = this.add.text(centerX, y, declineChoice.text, {
        fontSize: '11px', fill: '#ffffff', fontFamily: '"HoMM Pixel"'
      }).setOrigin(0.5).setDepth(6);
      bg.on('pointerover', () => { SoundHelper.playSound(this, 'hover_soft', 0.4); bg.setFillStyle(0x111111, 0.78); });
      bg.on('pointerout', () => bg.setFillStyle(0x050505, 0.58));
      bg.on('pointerdown', () => this._resolve(declineChoice, -1));
      this._wizardDecline = { bg, label };
    }
  }

  _handleWizardTrayDrop(slotIndex, cardData, cardSprite) {
    const inv = this.gameScene?.inventorySystem;
    if (!inv || !cardData || this.resolved) return false;

    if (this.isCarnivalJunk(cardData)) {
      inv.cleanupCardSprites?.(slotIndex, cardSprite);
      inv.cleanupBoardArtifacts?.(cardSprite);
      inv.removeCard(slotIndex, false);
      cardSprite.destroy();
      this._rewardLines = [];
      this._rewardIcons = [];
      this._reward(`Traded: ${cardData.name || 'Carnival Junk'}`);
      this._deliverCardReward(this.createHolographicOmenCard(), 'Holographic Omen', 'Gained passive card: Holographic Omen');
      this._resolve({
        text: 'Trade junk',
        action: () => {},
        outcome: 'You place the useless carnival trinket on the tray.\n\nThe tray snaps back into the booth. The booth goes dark, then a rainbow sheen spreads across the glass from the inside — thin and oily, like light on spilled ink.\n\nA card slides out. It is too bright for the old machine that made it.'
      }, -1, { keepRewards: true });
      return true;
    }

    if (this.isBrassWizardRerollable(cardData)) {
      const newCard = this.createSameTypeRerollCard(cardData);
      if (!newCard) {
        this._mirrorFloat("The wizard won't take that", 0xff6666, cardSprite);
        return false;
      }
      const oldName = cardData.name || 'card';
      inv.cleanupCardSprites?.(slotIndex, cardSprite);
      inv.cleanupBoardArtifacts?.(cardSprite);
      inv.removeCard(slotIndex, false);
      cardSprite.destroy();
      inv.addCard(newCard);
      this.gameScene?.updateUI?.();
      this._rewardLines = [];
      this._rewardIcons = [];
      this._reward(`Traded: ${oldName} → ${newCard.name || 'a new card'}`);
      this._resolve({
        text: 'Reroll',
        action: () => {},
        outcome: 'You place one of your cards on the tray.\n\nThe tray snaps back before you can change your mind. Behind the glass, the brass wizard stares down at it for a long time, then taps the glass twice.\n\nA different card slides out.'
      }, -1, { keepRewards: true });
      return true;
    }

    this._mirrorFloat("The wizard doesn't want that", 0xff6666, cardSprite);
    return false;
  }

  _destroyWizardTray() {
    this.gameScene?.inventorySystem?.clearDropZones?.();
    this._wizardTray?.destroy?.();
    this._wizardTray = null;
    this._wizardHint?.destroy?.();
    this._wizardHint = null;
    if (this._wizardDecline) {
      this._wizardDecline.bg?.destroy?.();
      this._wizardDecline.label?.destroy?.();
      this._wizardDecline = null;
    }
  }

  // Marks the once-per-run bonus rooms as seen when they resolve.
  _markBonusEventSeen() {
    const flagByEvent = {
      mirror: 'mirrorSeen',
      too_nice_room: 'tooNiceRoomSeen',
      almost_you_well: 'wellSeen',
      slimy_prison: 'slimyPrisonSeen',
      book_worm: 'bookWormSeen',
      briar_room: 'briarRoomSeen',
      something_wicked: 'carnivalVisited',
      brass_wizard: 'brassWizardSeen'
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
