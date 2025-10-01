export const TOTAL_ACTS = 3;
export const FLOORS_PER_ACT = 15;
export const MAX_FLOOR = TOTAL_ACTS * FLOORS_PER_ACT;

export function clampFloor(floor) {
  if (!Number.isFinite(floor)) return 1;
  return Math.min(MAX_FLOOR, Math.max(1, Math.floor(floor)));
}

export function getCurrentAct(globalFloor) {
  const clamped = clampFloor(globalFloor);
  return Math.min(TOTAL_ACTS, Math.floor((clamped - 1) / FLOORS_PER_ACT) + 1);
}

export function getActFloor(globalFloor) {
  const clamped = clampFloor(globalFloor);
  return ((clamped - 1) % FLOORS_PER_ACT) + 1;
}

export function getActBounds(actNumber) {
  const act = Math.min(TOTAL_ACTS, Math.max(1, Math.floor(actNumber)));
  const start = (act - 1) * FLOORS_PER_ACT + 1;
  const end = start + FLOORS_PER_ACT - 1;
  return { start, end };
}

export function getBossFloors() {
  return Array.from({ length: TOTAL_ACTS }, (_, idx) => getActBounds(idx + 1).end);
}

export function isFinalBossFloor(globalFloor) {
  return clampFloor(globalFloor) === MAX_FLOOR;
}
