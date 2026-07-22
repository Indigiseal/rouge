// Event content pack registry.
import brokenMusicBox from './broken_music_box.js';
import monsterBirdNest from './monster_bird_nest.js';
import goblinEngineer from './goblin_engineer.js';
import hatchingEgg from './hatching_egg.js';
import tooNiceRoom from './too_nice_room.js';
import bookWorm from './book_worm.js';
import briarRoom from './briar_room.js';
import oldDrillRoom from './old_drill_room.js';
import somethingWicked from './something_wicked.js';
import brassWizard from './brass_wizard.js';
import almostYouWell from './almost_you_well.js';
import mirror from './mirror.js';
import slimyPrison from './slimy_prison.js';
import quietCrossroads from './quiet_crossroads.js';
import screamingHead from './screaming_head.js';

export const EVENTS = [
  brokenMusicBox,
  monsterBirdNest,
  goblinEngineer,
  hatchingEgg,
  tooNiceRoom,
  bookWorm,
  briarRoom,
  oldDrillRoom,
  somethingWicked,
  brassWizard,
  almostYouWell,
  mirror,
  slimyPrison,
  quietCrossroads,
  screamingHead,
];

export function getEvent(id) {
  return EVENTS.find((event) => event.id === id) || null;
}
