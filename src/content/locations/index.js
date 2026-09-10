import { BOSSES } from '../cards/bosses.js';
import {
  getMonthDef,
  getMonthDefForFloor,
  getMonthIndexForFloor,
  actOffsetForFloor,
} from '../location-packs/calendar.js';
import { LOCATION_PACK_LIST, getLocationPack } from '../location-packs/registry.js';
import { ACT_ROADS, PATH_LOCATIONS, TRUE_PATH } from './catalog.js';
export {
  getLocationRule,
  getLocationNarrativeCheckpoints,
  pendingLocationCheckpoint,
  pendingLocationAftermath,
} from './rules.js';

export { ACT_ROADS, PATH_LOCATIONS, TRUE_PATH };

export function getLocation(id) {
  return PATH_LOCATIONS[id] || null;
}

export function roadsForAct(act) {
  const n = Math.max(1, Math.min(3, Math.floor(Number(act) || 1)));
  return [...(ACT_ROADS[n] || ACT_ROADS[1])];
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
export function applyLocationChoice(gameState, locationId) {
  const loc = PATH_LOCATIONS[locationId];
  if (!gameState || !loc) return false;
  if (!Array.isArray(gameState.actLocationIds) || gameState.actLocationIds.length !== 3) {
    gameState.actLocationIds = emptyActLocationIds();
  }
  gameState.actLocationIds[loc.act - 1] = loc.id;
  const actMap = gameState.dungeonMap?.[`act${loc.act}`];
  const bossId = resolveActBossId(loc.act, loc.id);
  if (actMap && bossId) actMap.bossId = bossId;
  return true;
}

export function resolveActBossId(act, locationId) {
  const loc = PATH_LOCATIONS[locationId];
  if (!loc || loc.act !== act) return null;
  if (loc.bossId && BOSSES[loc.bossId]) return loc.bossId;
  return null;
}

export { actOffsetForFloor };
