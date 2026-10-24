// sim/event-bridge.js
// Plays an EVENT room with the game's own story code. EventScene picks the
// story (location pools, story chains, boss-gated and once-per-run rooms) and
// its choice actions apply the outcome, exactly as in a real run; only the
// screen is missing. MockScene's chainable stubs stand in for every drawing
// call, and the bot (a policy from balance-sim.js) clicks the choices, drags
// cards onto drop zones and plays the minigames.
//
// A story added to src/content/events/ is picked up here with no sim change.
// The bot only needs teaching when a story asks for something new: a drop
// zone the generic handling below does not cover, or a minigame.
import './mock.js';
import { EventScene } from '../src/scenes/EventScene.js';

// The minigames are skill tests the sim cannot play. These are modelled odds
// for a reasonably steady hand; tune them against human traces if needed.
export const MINIGAME_ODDS = Object.freeze({
  musicBoxForceOpen: 0.55,       // lock wafers cracked before the charge goes
  birdNestEgg: 0.75,             // egg grabbed before the mother returns
  birdNestCog: 0.8,              // cog grabbed (only when the box needs one)
  birdNestTimeout: 0.1,          // too slow: the raid takes nothing
  birdNestCoins: [0, 6],         // loose coins found
  birdNestCrystals: [0, 1],
});

const MAX_STEPS = 8;

// EventScene methods that only place text, buttons and scroll windows on the
// event paper. Nothing in them touches the run.
const LAYOUT_ONLY = Object.freeze([
  '_setReadingScroll', '_clearReadingScroll', '_enableReadingWheel', '_layoutResolvedOutcome',
  '_layoutRewardIcons', '_buildChoices', '_fitDescriptionAboveChoices', '_centerTextOnPixel',
  '_createContinuePlate', '_refreshRewardText',
]);
const randInt = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** A sprite stand-in for handlers that dissolve or bounce a dragged card. */
function cardSprite(mock) {
  return mock.add.image();
}

function createShim(mock, gs) {
  const shim = Object.create(EventScene.prototype);
  for (const key of ['add', 'tweens', 'time', 'cameras', 'textures', 'anims', 'sound', 'cache', 'input', 'make', 'events', 'game']) {
    shim[key] = mock[key];
  }
  shim.scene = {
    key: 'EventScene',
    get: (key) => (key === 'GameScene' ? mock : null),
    start() {}, stop() {}, wake() {}, sleep() {}, launch() {}, resume() {}, pause() {},
  };
  shim.sys = { settings: { data: {} }, isActive: () => true };
  shim.registry = { get: () => null, set() {} };
  shim.eventLayout = { centerX: 320 };
  shim._choiceBtns = [];
  // Drop zones (mirror, well) attach to the picture.
  shim.eventIllustrationImage = mock.add.image();
  shim.descText = mock.add.text();
  // Layout only: where text and buttons sit on the paper.
  for (const method of LAYOUT_ONLY) shim[method] = () => {};
  // Story memory lives on the run: the sim's runs stay independent of one
  // another, as they did before stories were played for real.
  shim._loadStoredHeroMemory = () => ({ ...(gs.heroMemory || {}) });
  shim._saveStoredHeroMemory = () => {};
  shim._saveStoredStoryRun = () => {};
  return shim;
}

/** Replace the minigame overlays with an immediate, modelled result. */
function installMinigames(shim, queue) {
  shim._openArmWrestleMinigame = function openArmWrestle() {
    const won = Math.random() < this.armWrestleChance();
    queue.push(() => this._finishArmWrestleMatch(won));
  };
  shim._openMusicBoxLockMinigame = function openMusicBox() {
    const won = Math.random() < MINIGAME_ODDS.musicBoxForceOpen;
    queue.push(() => this._finishMusicBoxForceOpen(won));
  };
  shim._openBirdNestMinigame = function openBirdNest() {
    const timedOut = Math.random() < MINIGAME_ODDS.birdNestTimeout;
    const result = {
      timedOut,
      tookEgg: !timedOut && Math.random() < MINIGAME_ODDS.birdNestEgg,
      tookCog: !timedOut && Math.random() < MINIGAME_ODDS.birdNestCog,
      coins: randInt(MINIGAME_ODDS.birdNestCoins),
      crystals: randInt(MINIGAME_ODDS.birdNestCrystals),
    };
    queue.push(() => this._finishBirdNestSearch(result));
  };
}

/**
 * Offer the bot every card a live drop zone would take. Returns true when the
 * bot dropped one (the handler may have resolved the story with it).
 */
function tryDrops(shim, mock, policy, eventId) {
  const inv = mock.inventorySystem;
  const zones = inv.dropZones || [];
  for (const zone of zones) {
    const candidates = inv.slots
      .map((card, slotIndex) => ({ card, slotIndex }))
      .filter(({ card }) => card && zone.accepts(card));
    if (!candidates.length) continue;
    const pick = policy.chooseDrop(eventId, candidates, shim);
    if (!pick) continue;
    const taken = zone.handler(pick.slotIndex, pick.card, cardSprite(mock));
    if (taken !== false) return true;
  }
  return false;
}

/**
 * Play one EVENT room. `policy` is
 *   { chooseChoice(eventId, choices, shim) -> choice,
 *     chooseDrop(eventId, candidates, shim) -> candidate | null,
 *     chooseReliquary(offer, weapons, shim) -> { magicType, slotIndex } | null }
 * `forcedEventId` opens that story whatever the rules say (tests only).
 * Returns { eventId, choices: [ids taken], ambush: bool, error }.
 */
export function playRealEvent(mock, gs, policy, { forcedEventId = null } = {}) {
  const shim = createShim(mock, gs);
  const queue = [];
  installMinigames(shim, queue);
  const taken = [];
  let eventId = null;
  try {
    shim.init({ gameState: gs, forcedEventId });
    eventId = shim.event?.id || null;
    if (!shim.event) return { eventId, choices: taken, ambush: false };
    mock.inventorySystem.clearDropZones?.();
    if (eventId === 'mirror') shim._setupMirrorDropZone();
    if (eventId === 'almost_you_well') shim._setupWellDropZone();

    for (let step = 0; step < MAX_STEPS && !shim.resolved; step++) {
      // The Reliquary's glass cases stand in for buttons: a weapon pressed to
      // a case takes its spell.
      if (eventId === 'reliquary' && step === 0) {
        const offer = shim.getReliquaryOffer();
        const weapons = mock.inventorySystem.slots
          .map((card, slotIndex) => ({ card, slotIndex }))
          .filter(({ card }) => card?.type === 'weapon' && !card.enchant);
        const pick = offer.length && weapons.length ? policy.chooseReliquary(offer, weapons, shim) : null;
        if (pick) {
          shim._handleReliquaryOffering(pick.slotIndex, mock.inventorySystem.slots[pick.slotIndex], cardSprite(mock), pick.magicType);
          taken.push(`case:${pick.magicType}`);
          continue;
        }
      }
      if (tryDrops(shim, mock, policy, eventId)) {
        taken.push('drop');
        while (queue.length) queue.shift()();
        if (shim.resolved) break;
      }
      const choices = shim._visibleChoices || shim._getVisibleChoices();
      if (!choices.length) break;
      const choice = policy.chooseChoice(eventId, choices, shim) || choices[0];
      shim._visibleChoices = choices;
      taken.push(choice.id || choice.text || '?');
      shim._resolve(choice, choices.indexOf(choice));
      while (queue.length) queue.shift()();
      // Offerings (Screaming Head, briars, the card bet) leave the story open
      // with a drop zone up; the next step drops into it or walks away.
    }
    return { eventId, choices: taken, ambush: Boolean(gs.pendingAmbush) };
  } catch (error) {
    return { eventId, choices: taken, ambush: Boolean(gs.pendingAmbush), error };
  }
}
