import assert from 'node:assert/strict';
import {
  TOLLROAD_EVENT_IDS,
  pickTollroadEventId,
} from '../src/content/months/tollroad/events/index.js';
import goblinMine from '../src/content/months/tollroad/events/goblin_mine.js';
import royalBridge from '../src/content/months/tollroad/events/royal_bridge.js';
import tollCollectors from '../src/content/events/toll_collectors.js';
import armWrestling from '../src/content/events/arm_wrestling.js';
import { getSandboxStories } from '../src/sandbox/SandboxMode.js';

const story = (overrides = {}) => ({
  pendingEvents: [],
  tollCollectorsSeen: false,
  armWrestlingSeen: false,
  armWrestleRematchDone: false,
  goblinMineSeen: false,
  royalBridgeSeen: false,
  ...overrides,
});

assert.equal(pickTollroadEventId({ story: story(), random: () => 0 }), 'goblin_mine');
assert.equal(
  pickTollroadEventId({ story: story({ goblinMineSeen: true }) }),
  'royal_bridge',
);

const intactState = { coins: 250, storyRun: { bridgeDestroyed: false, tollWatchFailed: false } };
const intactChoices = tollCollectors.choices(intactState);
assert.match(intactChoices.find((choice) => choice.id === 'toll_pay').text, /100/);
assert.ok(intactChoices.some((choice) => choice.id === 'toll_wait'));
const alertChoices = tollCollectors.choices({ coins: 250, storyRun: { bridgeDestroyed: false, tollWatchFailed: true } });
assert.match(alertChoices.find((choice) => choice.id === 'toll_pay').text, /200/);
assert.equal(alertChoices.some((choice) => choice.id === 'toll_wait'), false);
const brokenChoices = tollCollectors.choices({ coins: 250, storyRun: { bridgeDestroyed: true } });
assert.match(brokenChoices.find((choice) => choice.id === 'toll_jetpack').text, /150/);
assert.ok(brokenChoices.some((choice) => choice.id === 'toll_ask_detour'));

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
assert.equal(
  sandboxRematchChoices.find((choice) => choice.id === 'arm_bet_card')?.condition(
    { sandboxMode: true }, { hasArmWrestleCard: () => false },
  ),
  true,
  'Test Site rematch must always expose the card-bet button',
);
const sandboxTolls = getSandboxStories().filter((entry) => entry.eventId === 'toll_collectors');
assert.deepEqual(
  sandboxTolls.map((entry) => entry.id).sort(),
  ['toll_collectors_destroyed', 'toll_collectors_intact'],
  'Test Site must expose both bridge states for the toll collectors',
);
assert.equal(
  pickTollroadEventId({
    story: story({ goblinMineSeen: true, royalBridgeSeen: true, tollCollectorsSeen: true }),
    canArmWrestle: true,
  }),
  'arm_wrestling',
);
assert.equal(
  pickTollroadEventId({
    story: story({ pendingEvents: ['arm_wrestling'], armWrestlingSeen: true }),
  }),
  'arm_wrestling',
);
assert.equal(
  pickTollroadEventId({
    story: story({
      goblinMineSeen: true,
      royalBridgeSeen: true,
      tollCollectorsSeen: true,
      armWrestlingSeen: true,
    }),
  }),
  'toll_collectors',
);

for (const roll of [0, 0.49, 0.99]) {
  const eventId = pickTollroadEventId({
    story: story({ goblinMineSeen: true, royalBridgeSeen: true }),
    canArmWrestle: true,
    random: () => roll,
  });
  assert.ok(TOLLROAD_EVENT_IDS.includes(eventId), `${eventId} must belong to Tollroad`);
}

const fireballChoice = goblinMine.choices.find((choice) => choice.id === 'mine_fireball');
assert.equal(fireballChoice.condition({}, { hasFireballCard: () => true }), true);

const sandboxBridgeChoices = royalBridge.choices({ sandboxMode: true, storyRun: {} });
assert.ok(
  sandboxBridgeChoices.some((choice) => (
    choice.id === 'bridge_preview_sabotage' && choice.condition({ sandboxMode: true })
  )),
  'Test Site must expose the miners’ sabotage preview',
);
const liveBridgeChoices = royalBridge.choices({ sandboxMode: false, storyRun: {} });
assert.equal(
  liveBridgeChoices.find((choice) => choice.id === 'bridge_preview_sabotage')
    .condition({ sandboxMode: false }),
  false,
  'the preview control must stay hidden in normal runs',
);

console.log('Tollroad event selection stays inside its location pool.');
