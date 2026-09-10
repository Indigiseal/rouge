// Runtime contract for a complete location.
//
// A location owns its presentation, enemy/event pack, mandatory story stops,
// arrival scene and post-boss scene. Consumers ask this module for the active
// rule instead of branching on a location id. Tollroad is the reference
// implementation; unfinished locations can leave optional fields empty.

import { PATH_LOCATIONS } from './catalog.js';
import { LOCATION_PACKS } from '../location-packs/registry.js';
import { TOLLROAD_NARRATIVE_CHECKPOINTS } from '../story/TollroadNarrative.js';

const LOCATION_STORY = Object.freeze({
  silkdeep: Object.freeze({
    introSceneKey: 'SilkdeepIntroScene',
  }),
  tollroad: Object.freeze({
    introSceneKey: 'TollroadIntroScene',
    narrativeCheckpoints: TOLLROAD_NARRATIVE_CHECKPOINTS,
    aftermath: Object.freeze({
      sceneKey: 'TollroadAftermathScene',
      completeFlag: 'tollroadAftermathCompleteThisRun',
    }),
  }),
});

export function getLocationRule(locationId) {
  const location = PATH_LOCATIONS[locationId];
  if (!location) return null;
  const story = LOCATION_STORY[locationId] || {};
  return {
    ...location,
    enemies: LOCATION_PACKS[locationId]?.enemies || null,
    events: LOCATION_PACKS[locationId]?.events || Object.freeze([]),
    introSceneKey: story.introSceneKey || null,
    narrativeCheckpoints: story.narrativeCheckpoints || Object.freeze([]),
    aftermath: story.aftermath || null,
  };
}

export function getLocationNarrativeCheckpoints(gameState, floor = gameState?.currentFloor) {
  const id = getLocationIdFromRun(gameState, floor);
  return getLocationRule(id)?.narrativeCheckpoints || [];
}

export function pendingLocationCheckpoint(gameState) {
  const story = gameState?.storyRun || {};
  const floor = Math.max(1, Number(gameState?.currentFloor) || 1);
  return getLocationNarrativeCheckpoints(gameState, floor).find((checkpoint) => (
    floor >= checkpoint.afterFloor && !story[checkpoint.seenFlag]
  )) || null;
}

export function pendingLocationAftermath(gameState) {
  if (!gameState) return null;
  const rule = getLocationRule(getLocationIdFromRun(gameState, gameState.currentFloor));
  if (!rule?.aftermath || gameState.storyRun?.[rule.aftermath.completeFlag]) return null;
  return rule.aftermath;
}

// Kept local to avoid a rules.js ↔ index.js cycle.
function getLocationIdFromRun(gameState, floor) {
  const act = Math.min(2, Math.floor((Math.max(1, Number(floor) || 1) - 1) / 15));
  return gameState?.actLocationIds?.[act]
    || (gameState?.pinCalendarMonth ? LOCATION_PACKS.__legacyOrder?.[gameState.calendarMonthIndex || 0] : null)
    || 'thornwake';
}
