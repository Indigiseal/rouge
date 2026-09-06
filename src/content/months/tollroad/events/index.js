import tollCollectors from '../../../events/toll_collectors.js';
import armWrestling from '../../../events/arm_wrestling.js';
import goblinMine from './goblin_mine.js';
import goblinMineReturn from './goblin_mine_return.js';
import royalBridge from './royal_bridge.js';

export const TOLLROAD_EVENTS = Object.freeze([
  goblinMine,
  royalBridge,
  tollCollectors,
  armWrestling,
]);

export const TOLLROAD_SUPPORT_EVENTS = Object.freeze([goblinMineReturn]);

export const ALL_TOLLROAD_EVENTS = Object.freeze([
  ...TOLLROAD_EVENTS,
  ...TOLLROAD_SUPPORT_EVENTS,
]);

export const TOLLROAD_EVENT_IDS = Object.freeze(
  TOLLROAD_EVENTS.map((event) => event.id)
);

export function pickTollroadEventId({ story, canArmWrestle = false, random = Math.random }) {
  if (story.pendingEvents.includes('arm_wrestling') && !story.armWrestleRematchDone) {
    return 'arm_wrestling';
  }

  // The mine establishes the local conflict; the bridge pays it off on the
  // next event node regardless of how the player treated the workers.
  if (!story.goblinMineSeen) return 'goblin_mine';
  if (!story.royalBridgeSeen) return 'royal_bridge';

  const available = [];
  if (!story.tollCollectorsSeen) available.push('toll_collectors');
  if (!story.armWrestlingSeen && canArmWrestle) available.push('arm_wrestling');

  if (available.length > 0) {
    return available[Math.floor(random() * available.length)];
  }

  // Maps may contain more event rooms than Tollroad currently has unique
  // stories. Repeating a checkpoint keeps the encounter local instead of
  // leaking a global filler back into the location.
  return 'toll_collectors';
}
