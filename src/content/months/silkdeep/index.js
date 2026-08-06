import { SILKDEEP_ENEMY_DEFS, SILKDEEP_ROSTER } from './enemies/index.js';
import { SILKDEEP_EVENTS } from './events/index.js';

export const SILKDEEP_MONTH = Object.freeze({
  id: 'silkdeep',
  name: 'Silkdeep',
  enemies: SILKDEEP_ROSTER,
  events: SILKDEEP_EVENTS,
});

export { SILKDEEP_ENEMY_DEFS, SILKDEEP_ROSTER, SILKDEEP_EVENTS };
