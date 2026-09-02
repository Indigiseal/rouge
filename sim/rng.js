// Seeded randomness for reproducible batches.
//
// Every batch used to draw from Math.random, so two configurations never saw
// the same dungeon. At n=3000 that left about +/-2 pp of noise on clear-rate —
// enough that a sweep could read non-monotonic and a real 2 pp effect could not
// be told from nothing. Common random numbers fix it: run #7 of configuration A
// and run #7 of configuration B start from the same stream, so the same floors,
// the same loot rolls and the same enemy placements meet both. The streams do
// drift apart once the two configurations make different choices — that is
// unavoidable and fine, because the expensive early variance is already gone.
//
// The sim installs this over globalThis.Math.random: game code calls Math.random
// directly in ~124 places and threading a generator through all of them would be
// a far larger change than the problem deserves.

const DEFAULT_SEED = 0x5eed1e;

let currentSeed = DEFAULT_SEED;
let nextValue = null;
let installed = false;
let nativeRandom = null;
let runCounter = 0;

/** mulberry32 — small, fast, good enough for balance sampling. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replace Math.random with a seeded stream. Idempotent.
 * Pass seed = null to leave randomness alone (`--seed random`).
 */
export function installSeededRandom(seed = DEFAULT_SEED) {
  if (seed === null || seed === undefined) return false;
  currentSeed = Number(seed) >>> 0;
  if (!installed) {
    nativeRandom = Math.random;
    installed = true;
  }
  runCounter = 0;
  nextValue = mulberry32(currentSeed);
  Math.random = () => nextValue();
  return true;
}

export function restoreNativeRandom() {
  if (installed && nativeRandom) Math.random = nativeRandom;
  installed = false;
}

export function isSeeded() {
  return installed;
}

/**
 * Start a fresh stream for one run. Called at the top of every run so the Nth
 * run of any batch is reproducible regardless of what earlier runs consumed —
 * without this, a config that draws more randomness on run 1 would shift every
 * later run out of alignment and the pairing would be lost.
 */
export function beginSeededRun(index = null) {
  if (!installed) return;
  const i = index === null ? runCounter : index;
  runCounter = i + 1;
  nextValue = mulberry32((currentSeed + i * 0x9E3779B1) >>> 0);
}

/** Parse `--seed <n|random>` out of argv. Returns a seed, or null for unseeded. */
export function parseSeedArg(argv, fallback = DEFAULT_SEED) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    let raw = null;
    if (token === '--seed') raw = argv[i + 1];
    else if (token.startsWith('--seed=')) raw = token.slice('--seed='.length);
    if (raw == null) continue;
    if (raw === 'random' || raw === 'off' || raw === 'none') return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n >>> 0;
  }
  return fallback;
}

export { DEFAULT_SEED };
