import { enemyCardPresentation } from '../../../assets/enemyCards.js';
import spider from './spider.js';
import caveCrawler from './caveCrawler.js';
import silkHusk from './silkHusk.js';
import stingerScorpion from './stingerScorpion.js';
import silkslinger from './silkslinger.js';

export const SILKDEEP_ROSTER = Object.freeze({
  MELEE: Object.freeze(['spider', 'caveCrawler', 'silkHusk']),
  RANGED: Object.freeze(['stingerScorpion', 'silkslinger']),
});

function asDef({ id, placeholderArt: _p, sprite: _s, spriteFrame: _f, ...rest }) {
  return Object.freeze({
    ...rest,
    ...enemyCardPresentation('silkdeep', SILKDEEP_ROSTER, id),
  });
}

export const SILKDEEP_ENEMY_DEFS = Object.freeze({
  spider: asDef(spider),
  caveCrawler: asDef(caveCrawler),
  silkHusk: asDef(silkHusk),
  stingerScorpion: asDef(stingerScorpion),
  silkslinger: asDef(silkslinger),
});
