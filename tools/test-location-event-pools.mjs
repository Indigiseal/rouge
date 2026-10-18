import assert from 'node:assert/strict';
import {
  TOLLROAD_EVENT_IDS,
  pickTollroadEventId,
} from '../src/content/location-packs/tollroad/events/index.js';
import tollCollectors, { tollForFloor } from '../src/content/events/toll_collectors.js';
import armWrestling from '../src/content/events/arm_wrestling.js';
import { getSandboxStories } from '../src/sandbox/SandboxMode.js';
import {
  getLocationRule,
  pendingLocationAftermath,
  pendingLocationCheckpoint,
} from '../src/content/locations/rules.js';

const story = (overrides = {}) => ({
  pendingEvents: [],
  tollCollectorsSeen: false,
  armWrestlingSeen: false,
  armWrestleRematchDone: false,
  ...overrides,
});

assert.equal(pickTollroadEventId({ story: story(), canArmWrestle: true, random: () => 0 }), 'arm_wrestling');
assert.equal(
  pickTollroadEventId({ story: story(), canArmWrestle: true, random: () => 0.6 }),
  null,
);
const tollroadRun = (currentFloor, storyRun) => ({
  currentFloor,
  actLocationIds: ['tollroad', null, null],
  storyRun,
});
const tollroadRule = getLocationRule('tollroad');
assert.equal(tollroadRule?.introSceneKey, null);
assert.equal(getLocationRule('silkdeep')?.introSceneKey, 'SilkdeepIntroScene');
assert.equal(tollroadRule?.enemies?.MELEE?.length, 3);
assert.equal(tollroadRule?.enemies?.RANGED?.length, 2);
assert.deepEqual([...TOLLROAD_EVENT_IDS].sort(), ['arm_wrestling', 'toll_collectors']);
// No forced story stops and no post-boss scene: the Tollroad map is open.
assert.equal(pendingLocationCheckpoint(tollroadRun(12, story())), null);
assert.equal(pendingLocationAftermath(tollroadRun(15, story())), null);

// Toll Collectors: the toll scales with depth, and Intimidate needs real steel.
assert.equal(tollForFloor(5), 30);
const choices = tollCollectors.choices({ currentFloor: 5, coins: 250 });
assert.match(choices.find((choice) => choice.id === 'toll_pay').text, /30/);
assert.deepEqual(choices.map((choice) => choice.id), ['toll_pay', 'toll_intimidate', 'toll_attack', 'toll_wait']);
assert.equal(
  choices.find((choice) => choice.id === 'toll_intimidate').condition({}, { hasIntimidatingWeapon: () => false }),
  false,
);

const sandboxTolls = getSandboxStories().filter((entry) => entry.eventId === 'toll_collectors');
assert.deepEqual(sandboxTolls.map((entry) => entry.id), ['toll_collectors']);

const rematch = getSandboxStories().find((entry) => entry.id === 'arm_wrestling_rematch');
assert.equal(rematch?.eventId, 'arm_wrestling', 'Test Site must expose the arm-wrestling rematch');
const sandboxRematchChoices = armWrestling.choices(
  { sandboxMode: true, storyRun: { armWrestleWon: true, armWrestleRematchDone: false } },
  {
    isArmWrestleRematch: () => true,
    getArmWrestleCoinStake: () => 10,
    hasArmWrestleCard: () => false,
  },
);
assert.deepEqual(
  sandboxRematchChoices.map((choice) => choice.id),
  ['arm_decline'],
  'The rematch must accept a card directly on the ogre and only render the exit button',
);
assert.match(
  armWrestling.rematchHint,
  /Drag a card onto the ogre.*uncommon or better/i,
  'The rematch must provide a separate drag hint with its minimum rarity',
);
assert.equal(
  pickTollroadEventId({
    story: story({ pendingEvents: ['arm_wrestling'], armWrestlingSeen: true }),
  }),
  'arm_wrestling',
);
assert.equal(
  pickTollroadEventId({ story: story({ tollCollectorsSeen: true, armWrestlingSeen: true }) }),
  null,
);

for (const roll of [0, 0.59, 0.6, 0.99]) {
  const eventId = pickTollroadEventId({ story: story(), canArmWrestle: true, random: () => roll });
  assert.ok(eventId === null || TOLLROAD_EVENT_IDS.includes(eventId), `${eventId} must be optional Tollroad content`);
}

console.log('Tollroad event selection stays inside its location pool.');
