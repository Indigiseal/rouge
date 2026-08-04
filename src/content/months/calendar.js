// 12-month calendar circle (lore). Gameplay rotates through the first
// MONTH_ROTATION_LENGTH entries until more months ship with rosters.
//
// A run walks three consecutive months in that rotation:
// start N → floors 1–15, N+1 → 16–30, N+2 → 31–45 (wrap).
//
// Month packs: content/months/<id>/{enemies,assets}/

import { THORNWAKE_MONTH } from './thornwake/index.js';
import { SILKDEEP_MONTH } from './silkdeep/index.js';

export const MONTHS = Object.freeze([
  THORNWAKE_MONTH,
  SILKDEEP_MONTH,
  Object.freeze({ id: 'tollroad', name: 'Tollroad', enemies: null }),
  Object.freeze({ id: 'boneflood', name: 'Boneflood', enemies: null }),
  Object.freeze({ id: 'mireturn', name: 'Mireturn', enemies: null }),
  Object.freeze({ id: 'veilbleed', name: 'Veilbleed', enemies: null }),
  Object.freeze({ id: 'ashhowl', name: 'Ashhowl', enemies: null }),
  Object.freeze({ id: 'brassfair', name: 'Brassfair', enemies: null }),
  Object.freeze({ id: 'frosthollow', name: 'Frosthollow', enemies: null }),
  Object.freeze({ id: 'stormhatch', name: 'Stormhatch', enemies: null }),
  Object.freeze({ id: 'mirrorwane', name: 'Mirrorwane', enemies: null }),
  Object.freeze({ id: 'spherefall', name: 'Spherefall', enemies: null }),
]);

export const MONTH_COUNT = MONTHS.length;

/** How many leading months participate in run/act rotation (Thornwake + Silkdeep). */
export const MONTH_ROTATION_LENGTH = 2;

export function normalizeMonthIndex(index) {
  const n = Math.floor(Number(index) || 0);
  const len = MONTH_ROTATION_LENGTH;
  return ((n % len) + len) % len;
}

/**
 * Resolve CLI / config month token to a rotation index.
 * Accepts numeric index ("0", 0) or month id ("thornwake", "silkdeep").
 * Unknown tokens fall back to 0 (Thornwake).
 */
export function resolveMonthIndex(token) {
  if (token == null || token === '') return 0;
  if (typeof token === 'number' && Number.isFinite(token)) {
    return normalizeMonthIndex(token);
  }
  const raw = String(token).trim().toLowerCase();
  if (/^\d+$/.test(raw)) return normalizeMonthIndex(Number(raw));
  const byId = MONTHS.findIndex((m) => m?.id === raw);
  if (byId >= 0 && byId < MONTH_ROTATION_LENGTH) return byId;
  // Allow looking up ids that exist in the full calendar but outside rotation
  // by mapping to their position only when within rotation length.
  if (byId >= 0) return normalizeMonthIndex(byId);
  return 0;
}

export function nextMonthIndex(index) {
  return normalizeMonthIndex(normalizeMonthIndex(index) + 1);
}

/** Act offset 0/1/2 from absolute floor (1–45). */
export function actOffsetForFloor(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return Math.min(2, Math.floor((f - 1) / 15));
}

export function getMonthIndexForFloor(calendarMonthIndex, floor) {
  return normalizeMonthIndex(normalizeMonthIndex(calendarMonthIndex) + actOffsetForFloor(floor));
}

export function getMonthDef(index) {
  return MONTHS[normalizeMonthIndex(index)] || MONTHS[0];
}

export function getMonthDefForFloor(calendarMonthIndex, floor) {
  return getMonthDef(getMonthIndexForFloor(calendarMonthIndex, floor));
}

export function getMonthDisplayName(calendarMonthIndex, floor) {
  return getMonthDefForFloor(calendarMonthIndex, floor).name;
}
