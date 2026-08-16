import goblin from './goblin.js';
import highwayCutpurse from './highwayCutpurse.js';
import tollBrute from './tollBrute.js';
import goblinArcher from './goblin_archer.js';
import roadSniper from './roadSniper.js';

function asDef({ id: _id, ...rest }) {
  return Object.freeze(rest);
}

export const TOLLROAD_ENEMY_DEFS = Object.freeze({
  goblin: asDef(goblin),
  highwayCutpurse: asDef(highwayCutpurse),
  tollBrute: asDef(tollBrute),
  goblin_archer: asDef(goblinArcher),
  roadSniper: asDef(roadSniper),
});

export const TOLLROAD_ROSTER = Object.freeze({
  MELEE: Object.freeze(['goblin', 'highwayCutpurse', 'tollBrute']),
  RANGED: Object.freeze(['goblin_archer', 'roadSniper']),
});

/** Enemy types that answer Toll Brute `goblin_rally`. */
export const TOLLROAD_GOBLIN_ALLY_TYPES = Object.freeze(
  Object.keys(TOLLROAD_ENEMY_DEFS).filter((id) => TOLLROAD_ENEMY_DEFS[id].goblinAlly)
);
