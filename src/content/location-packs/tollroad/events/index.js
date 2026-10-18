import tollCollectors from '../../../events/toll_collectors.js';
import armWrestling from '../../../events/arm_wrestling.js';

export const TOLLROAD_EVENTS = Object.freeze([
  tollCollectors,
  armWrestling,
]);

export const ALL_TOLLROAD_EVENTS = TOLLROAD_EVENTS;

export const TOLLROAD_EVENT_IDS = Object.freeze(
  TOLLROAD_EVENTS.map((event) => event.id)
);

export function pickTollroadEventId({ story, canArmWrestle = false, random = Math.random }) {
  if (story.pendingEvents.includes('arm_wrestling') && !story.armWrestleRematchDone) {
    return 'arm_wrestling';
  }

  // When the first match is available, location content gets weight 1 versus
  // 0.67 for the shared pool (roughly 60/40): global stories still appear,
  // just a little less often.
  if (!story.armWrestlingSeen && canArmWrestle && random() < 0.6) return 'arm_wrestling';
  return null;
}
