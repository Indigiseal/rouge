// What the player has ever seen, across every run: the Codex reads this and
// draws everything else as a black silhouette.
//
// Profile-wide like heroMemory, not part of the run save — a run that ends,
// or a save that is cleared, never un-discovers anything. Only Reset Progress
// does (MainMenuScene.confirmResetProgress).
import { BOSSES } from '../cards/bosses.js';
import { SIGILS, RENAMED_SIGILS, enemySigils } from '../sigils/sigils.js';
import { FROSTHOLLOW_ENEMY_ALIASES } from '../location-packs/frosthollow/index.js';

export const CODEX_STORAGE_KEY = 'codexDiscoveries';
export const CODEX_KINDS = Object.freeze(['enemies', 'bosses', 'stories', 'sigils', 'amulets', 'magic']);

let cache = null;

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function empty() {
  return Object.fromEntries(CODEX_KINDS.map((kind) => [kind, {}]));
}

function load() {
  if (cache) return cache;
  cache = empty();
  try {
    const parsed = JSON.parse(storage()?.getItem(CODEX_STORAGE_KEY) || 'null');
    for (const kind of CODEX_KINDS) {
      if (parsed?.[kind] && typeof parsed[kind] === 'object') cache[kind] = { ...parsed[kind] };
    }
    // A renamed sigil keeps the player's discovery, just like saved cards do.
    for (const [oldId, id] of Object.entries(RENAMED_SIGILS)) {
      if (cache.sigils[oldId]) cache.sigils[id] = true;
    }
    for (const [oldId, id] of Object.entries(FROSTHOLLOW_ENEMY_ALIASES)) {
      if (cache.enemies[oldId]) cache.enemies[id] = true;
    }
  } catch {
    // A corrupt entry starts the Codex over rather than breaking the game.
  }
  return cache;
}

function save() {
  try {
    storage()?.setItem(CODEX_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or private mode: the discovery still counts for this session.
  }
}

export function isDiscovered(kind, id) {
  if (kind === 'sigils') id = RENAMED_SIGILS[id] || id;
  return Boolean(load()[kind]?.[id]);
}

/** Records `id` under `kind`. Returns true the first time it is seen. */
export function noteDiscovered(kind, id) {
  if (kind === 'sigils') id = RENAMED_SIGILS[id] || id;
  if (!CODEX_KINDS.includes(kind) || typeof id !== 'string' || !id) return false;
  const data = load();
  if (data[kind][id]) return false;
  data[kind][id] = true;
  save();
  return true;
}

/** The boss catalog id for a boss card (cards carry the name, not the id). */
export function bossIdForCard(data) {
  if (!data) return null;
  if (data.bossId && BOSSES[data.bossId]) return data.bossId;
  const match = Object.entries(BOSSES).find(([, boss]) => (
    boss.name === data.name || (data.sprite && boss.sprite === data.sprite)
  ));
  return match ? match[0] : null;
}

/**
 * A board card turning face-up: an enemy or boss is now known, and so is every
 * sigil it carries.
 */
export function noteCardDiscovered(data) {
  if (!data) return;
  if (data.type === 'magic' && data.magicType) noteDiscovered('magic', data.magicType);
  if (data.type === 'enemy' && data.enemyType) noteDiscovered('enemies', data.enemyType);
  if (data.type === 'boss') {
    const bossId = bossIdForCard(data);
    if (bossId) noteDiscovered('bosses', bossId);
  }
  if (data.type === 'enemy' || data.type === 'boss') {
    for (const sigil of enemySigils(data, { lockKind: data.enemyType === 'inkWraith' ? 'ink' : null })) {
      if (SIGILS[sigil?.id]) noteDiscovered('sigils', sigil.id);
    }
  }
}

export function clearDiscoveries() {
  cache = empty();
  try {
    storage()?.removeItem(CODEX_STORAGE_KEY);
  } catch {
    // Nothing stored to clear.
  }
}
