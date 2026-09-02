// Sim-only tuning overrides.
//
// Balance sweeps used to work by rewriting content source files from a throwaway
// script: patch, run, restore. Over one session that produced four separate bugs
// — a guard that threw when a case happened to equal the original, a wrong
// regex capture group, wrong backslash escaping through a heredoc, and a shell
// that did not word-split the way the script assumed — and one sweep whose every
// row was invalid because the patch had silently not applied. A sweep must not
// be able to corrupt the game's content.
//
// So tunable numbers are read through here instead. Production never sets
// anything and every lookup falls straight through to the catalog value; the sim
// installs a set of overrides for the length of a batch. Same shape as
// `setSimTestOptionsOverride` in config/TestOptions.js.

/** @type {Record<string, unknown>} */
let overrides = Object.create(null);

/**
 * Install overrides, keyed by dotted path (e.g. 'talent.twinFang.values').
 * Pass null to clear. Sim only.
 */
export function setTuningOverrides(next) {
  overrides = next && typeof next === 'object' ? { ...next } : Object.create(null);
}

export function getTuningOverrides() {
  return { ...overrides };
}

export function hasTuningOverrides() {
  return Object.keys(overrides).length > 0;
}

/** Catalog value unless a sweep replaced it. */
export function tuned(path, fallback) {
  const value = overrides[path];
  return value === undefined ? fallback : value;
}
