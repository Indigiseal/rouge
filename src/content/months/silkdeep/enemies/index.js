import spider from './spider.js';
import caveCrawler from './caveCrawler.js';
import webBoundSkeleton from './webBoundSkeleton.js';
import spittingSpider from './spittingSpider.js';
import silkslinger from './silkslinger.js';

function asDef({ id: _id, ...rest }) {
  return Object.freeze(rest);
}

export const SILKDEEP_ENEMY_DEFS = Object.freeze({
  spider: asDef(spider),
  caveCrawler: asDef(caveCrawler),
  webBoundSkeleton: asDef(webBoundSkeleton),
  spittingSpider: asDef(spittingSpider),
  silkslinger: asDef(silkslinger),
});

export const SILKDEEP_ROSTER = Object.freeze({
  MELEE: Object.freeze(['spider', 'caveCrawler', 'webBoundSkeleton']),
  RANGED: Object.freeze(['spittingSpider', 'silkslinger']),
});
