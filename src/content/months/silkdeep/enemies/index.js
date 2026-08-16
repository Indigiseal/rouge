import spider from './spider.js';
import caveCrawler from './caveCrawler.js';
import silkHusk from './silkHusk.js';
import stingerScorpion from './stingerScorpion.js';
import silkslinger from './silkslinger.js';

function asDef({ id: _id, ...rest }) {
  return Object.freeze(rest);
}

export const SILKDEEP_ENEMY_DEFS = Object.freeze({
  spider: asDef(spider),
  caveCrawler: asDef(caveCrawler),
  silkHusk: asDef(silkHusk),
  stingerScorpion: asDef(stingerScorpion),
  silkslinger: asDef(silkslinger),
});

export const SILKDEEP_ROSTER = Object.freeze({
  MELEE: Object.freeze(['spider', 'caveCrawler', 'silkHusk']),
  RANGED: Object.freeze(['stingerScorpion', 'silkslinger']),
});
