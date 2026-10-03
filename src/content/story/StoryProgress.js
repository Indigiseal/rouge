// Cross-run story memory.
//
// `storyRun` (which events you've seen, your choices, the pending-event chain)
// normally lives on gameState and is wiped every death. To let the dungeon
// "remember" completed events and resume story chains across deaths, we mirror
// it into localStorage — the same pattern heroMemory already uses — and seed a
// fresh run from it. The live run save (SaveManager) still owns an in-progress
// run's storyRun; this blob is only the cross-death carryover used to seed NEW
// runs so the player never repeats an event they already finished.

const STORY_PROGRESS_KEY = 'storyProgress';
const HERO_MEMORY_KEY = 'heroMemory';

export function loadStoryProgress() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORY_PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : null;
  } catch {
    return null;
  }
}

export function saveStoryProgress(storyRun) {
  try {
    if (typeof localStorage === 'undefined' || !storyRun || typeof storyRun !== 'object') return;
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(storyRun));
  } catch {
    // Non-fatal: story memory still survives on gameState for the current run.
  }
}

export function clearStoryProgress() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORY_PROGRESS_KEY);
  } catch {
    // ignore
  }
}

export function loadHeroMemory() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(HERO_MEMORY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : null;
  } catch {
    return null;
  }
}

export function saveHeroMemory(heroMemory) {
  try {
    if (typeof localStorage === 'undefined' || !heroMemory || typeof heroMemory !== 'object') return;
    localStorage.setItem(HERO_MEMORY_KEY, JSON.stringify(heroMemory));
  } catch {
    // Non-fatal: the live run still retains the unlock until it ends.
  }
}
