import tollCollectors from '../../../events/toll_collectors.js';
import armWrestling from '../../../events/arm_wrestling.js';
import goblinMine from './goblin_mine.js';
import goblinMineReturn from './goblin_mine_return.js';
import royalBridge from './royal_bridge.js';
import throneHall from './throne_hall.js';

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
  throneHall,
]);

export const TOLLROAD_EVENT_IDS = Object.freeze(
  TOLLROAD_EVENTS.map((event) => event.id)
);

export function pickTollroadEventId({ story, canArmWrestle = false, random = Math.random }) {
  if (story.pendingEvents.includes('arm_wrestling') && !story.armWrestleRematchDone) {
    return 'arm_wrestling';
  }

  // Main-story scenes are map checkpoints now. When the first match is
  // available, location content gets weight 1 versus 0.67 for the shared pool
  // (roughly 60/40): global stories still appear, just a little less often.
  if (!story.armWrestlingSeen && canArmWrestle && random() < 0.6) return 'arm_wrestling';
  return null;
}
