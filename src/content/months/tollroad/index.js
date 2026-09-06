import { TOLLROAD_ENEMY_DEFS, TOLLROAD_ROSTER } from './enemies/index.js';
import { TOLLROAD_EVENTS } from './events/index.js';

export const TOLLROAD_MONTH = Object.freeze({
  id: 'tollroad',
  name: 'Tollroad',
  enemies: TOLLROAD_ROSTER,
  events: TOLLROAD_EVENTS,
});

export { TOLLROAD_ENEMY_DEFS, TOLLROAD_ROSTER, TOLLROAD_EVENTS };
export { TOLLROAD_GOBLIN_ALLY_TYPES } from './enemies/index.js';
export { TOLLROAD_EVENT_IDS, pickTollroadEventId } from './events/index.js';
