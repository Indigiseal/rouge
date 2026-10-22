import { BOSSES } from '../cards/bosses.js';
import {
  getMonthDef,
  getMonthDefForFloor,
  getMonthIndexForFloor,
  actOffsetForFloor,
} from '../location-packs/calendar.js';
import { LOCATION_PACK_LIST, getLocationPack } from '../location-packs/registry.js';
import { ACT_ROADS, PATH_LOCATIONS, PLAYABLE_LOCATION_IDS, allRoadsForAct } from './catalog.js';
export {
  getLocationRule,
  getLocationNarrativeCheckpoints,
  pendingLocationCheckpoint,
  pendingLocationAftermath,
} from './rules.js';

export { ACT_ROADS, PATH_LOCATIONS, PLAYABLE_LOCATION_IDS, allRoadsForAct };

export function getLocation(id) {
  return PATH_LOCATIONS[id] || null;
}

// Three equal choices. Previously offered but unchosen roads remain eligible.
export function roadsForAct(act, gameState = null) {
  const n = Math.max(1, Math.min(3, Math.floor(Number(act) || 1)));
  const visited = new Set(gameState?.actLocationIds?.slice(0, n - 1) || []);
  const sides = allRoadsForAct(n).filter(id => !visited.has(id));
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  return sides.slice(0, 3);
}

/** Persist an act's doors so reopening selection cannot reroll them. */
export function getLocationOffer(gameState, act) {
  const n = Math.max(1, Math.min(3, Math.floor(Number(act) || 1)));
  gameState.locationOffers ||= [null, null, null];
  const existing = gameState.locationOffers[n - 1];
  const visited = gameState.actLocationIds?.slice(0, n - 1) || [];
  if (Array.isArray(existing) && existing.length === 3 && new Set(existing).size === 3
      && existing.every(id => PLAYABLE_LOCATION_IDS.includes(id) && !visited.includes(id))) return [...existing];
  const offer = roadsForAct(n, gameState);
  gameState.locationOffers[n - 1] = offer;
  return [...offer];
}

/** Saved offers use stable ids; reject malformed or unfinished choices. */
export function normalizeLocationOffers(offers) {
  return [0, 1, 2].map(index => {
    const offer = offers?.[index];
    return Array.isArray(offer) && offer.length === 3 && new Set(offer).size === 3
      && offer.every(id => PLAYABLE_LOCATION_IDS.includes(id)) ? [...offer] : null;
  });
}

export function emptyActLocationIds() {
  return [null, null, null];
}

/**
 * @param {unknown} ids
 * @param {number} [fallbackCalendarIndex]
 * @param {{ legacyFill?: boolean }} [opts]
 */
export function normalizeActLocationIds(ids, fallbackCalendarIndex = 0, opts = {}) {
  const out = emptyActLocationIds();
  const accept = (id) => {
    if (!id) return null;
    if (PATH_LOCATIONS[id]) return id;
    if (getLocationPack(id)) return id;
    return null;
  };
  if (Array.isArray(ids)) {
    for (let i = 0; i < 3; i += 1) {
      out[i] = accept(ids[i]);
    }
    return out;
  }
  if (opts.legacyFill) {
    for (let i = 0; i < 3; i += 1) {
      const legacyPack = LOCATION_PACK_LIST[getMonthIndexForFloor(fallbackCalendarIndex, 1 + i * 15)];
      out[i] = accept(legacyPack?.id);
    }
  }
  return out;
}

export function getLocationIdForFloor(gameState, floor = gameState?.currentFloor) {
  if (gameState?.pinCalendarMonth) {
    return getMonthDef(gameState.calendarMonthIndex ?? 0)?.id || 'thornwake';
  }
  const act = actOffsetForFloor(floor);
  const chosen = gameState?.actLocationIds?.[act];
  if (chosen && (PATH_LOCATIONS[chosen] || getLocationPack(chosen))) return chosen;
  return getMonthDefForFloor(gameState?.calendarMonthIndex ?? 0, floor)?.id || 'thornwake';
}

export function getLocationContent(gameState, floor) {
  const id = getLocationIdForFloor(gameState, floor);
  return getLocationPack(id) || {
    id,
    name: PATH_LOCATIONS[id]?.name || id,
    enemies: null,
  };
}

/** @deprecated Compatibility alias for older callers. */
export const getLocationMonthDef = getLocationContent;

export function getLocationDisplayName(gameState, floor) {
  const id = getLocationIdForFloor(gameState, floor);
  return PATH_LOCATIONS[id]?.name || getLocationContent(gameState, floor).name;
}

/** True when this act still needs a road pick (sandbox pin and tutorial skip). */
export function needsLocationPick(gameState, act) {
  if (!gameState || gameState.pinCalendarMonth || gameState.sandboxMode) return false;
  const n = Math.max(1, Math.min(3, Math.floor(Number(act) || 1)));
  const id = gameState.actLocationIds?.[n - 1];
  return !id;
}

/** Pin a chosen road onto the run and, if the map exists, its act boss. */
export function applyLocationChoice(gameState, locationId, act = actOffsetForFloor(gameState?.currentFloor || 1) + 1) {
  const loc = PATH_LOCATIONS[locationId];
  if (!gameState || !loc) return false;
  if (!Array.isArray(gameState.actLocationIds) || gameState.actLocationIds.length !== 3) {
    gameState.actLocationIds = emptyActLocationIds();
  }
  if (!Number.isInteger(act) || act < 1 || act > 3) return false;
  if (gameState.actLocationIds.slice(0, act - 1).includes(loc.id)) return false;
  gameState.actLocationIds[act - 1] = loc.id;
  const actMap = gameState.dungeonMap?.[`act${act}`];
  const bossId = resolveActBossId(act, loc.id);
  if (actMap && bossId) actMap.bossId = bossId;
  return true;
}

export function resolveActBossId(act, locationId) {
  const loc = PATH_LOCATIONS[locationId];
  if (!loc || !Number.isInteger(act) || act < 1 || act > 3) return null;
  if (loc.bossId && BOSSES[loc.bossId]) return loc.bossId;
  return null;
}

export { actOffsetForFloor };
