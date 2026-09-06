import assert from 'node:assert/strict';
import {
  TOLLROAD_EVENT_IDS,
  pickTollroadEventId,
} from '../src/content/months/tollroad/events/index.js';
import goblinMine from '../src/content/months/tollroad/events/goblin_mine.js';
import royalBridge from '../src/content/months/tollroad/events/royal_bridge.js';

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
