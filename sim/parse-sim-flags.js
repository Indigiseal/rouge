// CLI flags for headless sim: independent meta / amulet toggles + granular pools.
//
//   --meta | --no-meta | --meta on | --meta off
//   --amulets | --no-amulets | --amulets on | --amulets off
//   --amulet-loadout none|bag|strong   (shortcut for starting amulets)
//   --meta-pool id,id                 (which relics exist in this experiment)
//   --meta-start id,id                (which relics are unlocked at run start)
//   --amulet-pool id,id               (which amulets may drop/shop/event)
//   --amulet-start id,id              (equipped at run start; implies force)
//   --character rogue|warrior         Playable class for the run
//   --armor-pool chain|plate|both     Warrior armor spawn filter (default: both)
//   --talents none|max|id:rank,...    Character talent loadout
//   --month thornwake|silkdeep|tollroad|0|1|2    Pin / start calendar month
//   --act 1|2|3                       Run only that act (mid-act start kit)

import {
  setSimTestOptionsOverride,
  TEST_OPTION_IDS,
} from '../src/config/TestOptions.js';
import { CHARACTER_IDS, normalizeCharacterId } from '../src/content/characters/CharacterClasses.js';
import { resolveMonthIndex } from '../src/content/months/index.js';
import { MONTHS } from '../src/content/months/calendar.js';
import { PATH_LOCATIONS } from '../src/content/locations/catalog.js';
import { getBranchesForCharacter, getTalentNode } from '../src/content/talents/index.js';
import {
  getVillageBuilding,
  emptyVillageBuildings,
  maxVillageBuildings,
  normalizeVillageBuildings,
} from '../src/content/village/index.js';

export const SIM_META_MODES = new Set(['fresh', 'geared', 'accumulate', 'balance']);
export const SIM_CHARACTER_IDS = new Set(CHARACTER_IDS);
export const SIM_ARMOR_POOLS = new Set(['chain', 'plate', 'both']);
export const ACT_START_WEAPON_RARITY = Object.freeze({
  1: 'common',
  2: 'uncommon',
  3: 'rare',
});
export const ACT_START_AMULET_COUNT = Object.freeze({
  1: 0,
  2: 3,
  3: 6,
});

function parseArmorPool(val) {
  if (!val || !SIM_ARMOR_POOLS.has(val)) return null;
  if (val === 'both') return ['chain', 'plate'];
  return [val];
}

function parseAct(val) {
  const n = Number(val);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

const MODE_DEFAULTS = {
  balance: { meta: false, amulets: false },
  fresh: { meta: false, amulets: true },
  geared: { meta: true, amulets: true },
  accumulate: { meta: true, amulets: true },
};

const LOADOUTS = new Set(['none', 'bag', 'strong']);
const TALENT_PRESETS = new Set(['none', 'max']);

const VALUE_FLAGS = new Set([
  '--amulet-loadout', '--meta-pool', '--meta-start',
  '--amulet-pool', '--amulet-start', '--character',
  '--armor-pool', '--talents', '--buildings', '--month', '--location', '--act',
]);

function buildMaxTalentLoadout(characterId, armorPool = null) {
  const talents = {};
  for (const branch of getBranchesForCharacter(characterId)) {
    if (!branch?.purchasable || branch.wip) continue;
    for (const talentId of branch.nodes || []) {
      const node = getTalentNode(talentId);
      if (!node || node.wip) continue;
      talents[talentId] = node.maxRank || 1;
    }
  }
  const choices = {};
  if (characterId === 'warrior' && talents.armorerStart > 0) {
    choices.armorerArmorType = armorPool?.length === 1 ? armorPool[0] : 'plate';
  }
  return { talents, talentChoices: choices };
}

/**
 * Parse --talents none|max|id:rank,id:rank
 * @returns {{ preset: 'none'|'max'|'custom', talents: object, talentChoices: object }}
 */
export function parseTalentSpec(val, characterId = 'rogue', armorPool = null) {
  const raw = String(val || '').trim();
  if (!raw || raw === 'none') {
    return { preset: 'none', talents: {}, talentChoices: {} };
  }
  if (raw === 'max') {
    const built = buildMaxTalentLoadout(characterId, armorPool);
    return { preset: 'max', ...built };
  }

  const talents = {};
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const colon = token.indexOf(':');
    const id = colon >= 0 ? token.slice(0, colon).trim() : token;
    const rankRaw = colon >= 0 ? token.slice(colon + 1).trim() : '1';
    const node = getTalentNode(id);
    if (!node || node.wip) {
      console.warn(`[sim] unknown/wip talent id ignored: ${id}`);
      continue;
    }
    const maxRank = node.maxRank || 1;
    let rank = Number(rankRaw);
    if (!Number.isFinite(rank) || rank <= 0) rank = 1;
    talents[id] = Math.min(maxRank, Math.max(1, Math.floor(rank)));
  }
  const choices = {};
  if (characterId === 'warrior' && (talents.armorerStart || 0) > 0) {
    choices.armorerArmorType = armorPool?.length === 1 ? armorPool[0] : 'plate';
  }
  return { preset: 'custom', talents, talentChoices: choices };
}

export function buildMaxBuildingLoadout() {
  return maxVillageBuildings();
}

/**
 * Parse --buildings none|max|id:rank,id:rank
 * @returns {{ preset: 'none'|'max'|'custom', buildings: object }}
 */
export function parseBuildingSpec(val) {
  const raw = String(val || '').trim();
  if (!raw || raw === 'none') {
    return { preset: 'none', buildings: emptyVillageBuildings() };
  }
  if (raw === 'max') {
    return { preset: 'max', buildings: maxVillageBuildings() };
  }

  const buildings = emptyVillageBuildings();
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const colon = token.indexOf(':');
    const id = colon >= 0 ? token.slice(0, colon).trim() : token;
    const rankRaw = colon >= 0 ? token.slice(colon + 1).trim() : '1';
    const def = getVillageBuilding(id);
    if (!def) {
      console.warn(`[sim] unknown building id ignored: ${id}`);
      continue;
    }
    let rank = Number(rankRaw);
    if (!Number.isFinite(rank) || rank <= 0) rank = 1;
    buildings[id] = Math.min(def.maxRank, Math.max(1, Math.floor(rank)));
  }
  return { preset: 'custom', buildings: normalizeVillageBuildings(buildings) };
}

function acceptLocationId(raw) {
  const id = String(raw || '').trim().toLowerCase();
  if (!id) return null;
  if (PATH_LOCATIONS[id]) return id;
  if (MONTHS.some((m) => m?.id === id)) return id;
  return null;
}

/**
 * Parse --location id  or  --location id,id,id (one road per act).
 * A single id is pinned on all three acts.
 * @returns {string[]|null} length-3 actLocationIds or null
 */
export function parseLocationSpec(val) {
  const raw = String(val || '').trim();
  if (!raw) return null;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const ids = [];
  for (const part of parts) {
    const id = acceptLocationId(part);
    if (!id) {
      console.warn(`[sim] unknown location ignored: ${part}`);
      continue;
    }
    ids.push(id);
  }
  if (!ids.length) return null;
  if (ids.length === 1) return [ids[0], ids[0], ids[0]];
  return [ids[0] || null, ids[1] || ids[0] || null, ids[2] || ids[0] || null];
}

function parseIdList(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return [];
  return [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];
}

/** Fisher–Yates sample of up to `count` unique ids from pool. */
export function sampleAmuletIds(pool, count, rng = Math.random) {
  const src = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (!src.length || count <= 0) return [];
  const bag = src.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag.slice(0, Math.min(count, bag.length));
}

export function actStartWeaponRarity(act) {
  return ACT_START_WEAPON_RARITY[act] || 'common';
}

export function actStartAmuletCount(act) {
  return ACT_START_AMULET_COUNT[act] || 0;
}

/** Split argv into positional tokens and sim flags (supports --meta on). */
export function splitSimArgv(argv) {
  const positional = [];
  const flags = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db' || a === '--name') {
      positional.push(a, argv[++i]);
      continue;
    }
    if (a.startsWith('--')) {
      if ((a === '--meta' || a === '--amulets') && ['on', 'off'].includes(argv[i + 1])) {
        flags.push(`${a} ${argv[++i]}`);
        continue;
      }
      if (VALUE_FLAGS.has(a) && argv[i + 1] && !argv[i + 1].startsWith('--')) {
        flags.push(`${a} ${argv[++i]}`);
        continue;
      }
      if ([...VALUE_FLAGS].some((p) => a.startsWith(`${p}=`))) {
        flags.push(a);
        continue;
      }
      flags.push(a);
      continue;
    }
    positional.push(a);
  }
  return { positional, flags };
}

export function isSimFlagToken(a) {
  return a.startsWith('--meta')
    || a.startsWith('--amulets')
    || a.startsWith('--amulet-loadout')
    || a.startsWith('--meta-pool')
    || a.startsWith('--meta-start')
    || a.startsWith('--amulet-pool')
    || a.startsWith('--amulet-start')
    || a.startsWith('--character')
    || a.startsWith('--armor-pool')
    || a.startsWith('--talents')
    || a.startsWith('--buildings')
    || a.startsWith('--month')
    || a.startsWith('--location')
    || a.startsWith('--act')
    || a === '--no-meta'
    || a === '--no-amulets';
}

function flagValue(token, prefix) {
  if (token === prefix) return '';
  if (token.startsWith(`${prefix}=`)) return token.slice(prefix.length + 1);
  if (token.startsWith(`${prefix} `)) return token.slice(prefix.length + 1).trim();
  return null;
}

/**
 * @param {string[]} flagTokens
 * @param {string} metaMode
 */
export function parseSimFlags(flagTokens, metaMode = 'fresh') {
  const base = MODE_DEFAULTS[metaMode] || MODE_DEFAULTS.fresh;
  let enableMeta = base.meta;
  let enableAmulets = base.amulets;
  let amuletLoadout = 'none';
  let metaPool = null;
  let metaStart = null;
  let amuletPool = null;
  let amuletStart = null;
  let characterId = 'rogue';
  let armorPool = null;
  let talentSpec = 'none';
  let buildingSpec = 'none';
  let monthToken = null;
  let locationToken = null;
  let act = null;
  let explicitAmuletStart = false;
  let explicitAmuletLoadout = false;

  for (const raw of flagTokens) {
    const token = raw.trim();
    if (token === '--meta' || token === '--meta on') enableMeta = true;
    else if (token === '--no-meta' || token === '--meta off') enableMeta = false;
    else if (token === '--amulets' || token === '--amulets on') enableAmulets = true;
    else if (token === '--no-amulets' || token === '--amulets off') enableAmulets = false;
    else if (token.startsWith('--amulet-loadout')) {
      const val = flagValue(token, '--amulet-loadout');
      if (LOADOUTS.has(val)) {
        amuletLoadout = val;
        explicitAmuletLoadout = true;
      }
    } else if (token.startsWith('--meta-pool')) {
      metaPool = parseIdList(flagValue(token, '--meta-pool'));
    } else if (token.startsWith('--meta-start')) {
      metaStart = parseIdList(flagValue(token, '--meta-start'));
    } else if (token.startsWith('--amulet-pool')) {
      amuletPool = parseIdList(flagValue(token, '--amulet-pool'));
    } else if (token.startsWith('--amulet-start')) {
      amuletStart = parseIdList(flagValue(token, '--amulet-start'));
      explicitAmuletStart = true;
    } else if (token.startsWith('--character')) {
      const val = flagValue(token, '--character');
      if (val && SIM_CHARACTER_IDS.has(val)) characterId = val;
      else if (val) characterId = normalizeCharacterId(val);
    } else if (token.startsWith('--armor-pool')) {
      armorPool = parseArmorPool(flagValue(token, '--armor-pool'));
    } else if (token.startsWith('--talents')) {
      const val = flagValue(token, '--talents');
      if (val != null && val !== '') talentSpec = val;
      if (val && val !== 'none') enableMeta = true;
    } else if (token.startsWith('--buildings')) {
      const val = flagValue(token, '--buildings');
      if (val != null && val !== '') buildingSpec = val;
      if (val && val !== 'none') enableMeta = true;
    } else if (token.startsWith('--location')) {
      const val = flagValue(token, '--location');
      if (val != null && val !== '') locationToken = val;
    } else if (token.startsWith('--month')) {
      const val = flagValue(token, '--month');
      if (val != null && val !== '') monthToken = val;
    } else if (token.startsWith('--act')) {
      const parsed = parseAct(flagValue(token, '--act'));
      if (parsed != null) act = parsed;
    }
  }

  if (!enableAmulets) {
    // Mid-act random seed still applies later via forceStartingAmulets; only
    // clear drop/shop loadouts here. Leave amuletPool null → full catalog for seeds.
    if (!explicitAmuletStart && !(explicitAmuletLoadout && amuletLoadout !== 'none')) {
      amuletLoadout = 'none';
      amuletStart = [];
    }
  }
  if (!enableMeta) {
    metaPool = [];
    metaStart = [];
    talentSpec = 'none';
    buildingSpec = 'none';
  } else if (
    (talentSpec === 'none' || !talentSpec)
    && (buildingSpec === 'none' || !buildingSpec)
  ) {
    // --meta with no explicit tree: village buildings are the live meta.
    buildingSpec = 'max';
  }

  const calendarMonthIndex = monthToken != null ? resolveMonthIndex(monthToken) : 0;
  // Pin when month was explicitly set (full run or with --act).
  const pinCalendarMonth = monthToken != null && !locationToken;
  const actLocationIds = parseLocationSpec(locationToken);
  const talentParsed = parseTalentSpec(talentSpec, normalizeCharacterId(characterId), armorPool);
  const talentLoadout = talentParsed.preset === 'custom' ? 'custom' : talentParsed.preset;
  const buildingParsed = parseBuildingSpec(buildingSpec);
  const buildingLoadout = buildingParsed.preset === 'custom' ? 'custom' : buildingParsed.preset;

  return {
    enableMeta,
    enableAmulets,
    amuletLoadout,
    metaPool,
    metaStart,
    amuletPool,
    amuletStart,
    characterId: normalizeCharacterId(characterId),
    armorPool,
    talentLoadout,
    talentSpec,
    talents: talentParsed.talents,
    talentChoices: talentParsed.talentChoices,
    buildingLoadout,
    buildingSpec,
    buildings: buildingParsed.buildings,
    monthToken,
    locationToken,
    actLocationIds,
    calendarMonthIndex,
    pinCalendarMonth,
    act,
    explicitAmuletStart,
    explicitAmuletLoadout,
  };
}

/** Ensure start ⊆ pool; null pools mean "all known ids". */
export function normalizeSimPools(flags, { allRelics = [], allAmulets = [], metaMode = 'fresh' } = {}) {
  const out = { ...flags };

  if (out.enableMeta) {
    const pool = out.metaPool == null ? allRelics.slice() : out.metaPool.slice();
    const poolSet = new Set(pool);
    let start;
    if (out.metaStart != null) {
      start = out.metaStart.slice();
    } else if (metaMode === 'accumulate') {
      start = [];
    } else {
      start = pool.slice();
    }
    start = start.filter((id) => poolSet.has(id) || allRelics.includes(id));
    for (const id of start) poolSet.add(id);
    out.metaPool = [...poolSet];
    out.metaStart = start;
  } else {
    out.metaPool = [];
    out.metaStart = [];
  }

  if (out.enableAmulets) {
    const pool = out.amuletPool == null ? allAmulets.slice() : out.amuletPool.slice();
    const poolSet = new Set(pool);
    let start = out.amuletStart;
    if (start == null) {
      if (out.amuletLoadout === 'strong') start = [];
      else if (out.amuletLoadout === 'bag') start = ['ringOfRegeneration'];
      else start = [];
    } else {
      start = start.slice();
    }
    for (const id of start) poolSet.add(id);
    out.amuletPool = [...poolSet];
    out.amuletStart = start;
  } else {
    // Keep an explicit pool for mid-act random seeds even when drops are off.
    out.amuletPool = out.amuletPool == null ? allAmulets.slice() : out.amuletPool.slice();
    out.amuletStart = out.amuletStart == null ? [] : out.amuletStart.slice();
  }

  return out;
}

export function applySimFlags({ enableMeta, enableAmulets }) {
  setSimTestOptionsOverride({
    [TEST_OPTION_IDS.disableMetaProgression]: !enableMeta,
    [TEST_OPTION_IDS.disableAmulets]: !enableAmulets,
  });
}

export function formatSimFlagsLabel(flags) {
  const parts = [
    `character:${flags.characterId || 'rogue'}`,
    flags.enableMeta ? 'meta' : 'no-meta',
    flags.enableAmulets ? 'amulets' : 'no-amulets',
  ];
  if (flags.armorPool?.length) parts.push(`armor:${flags.armorPool.join('+')}`);
  if (flags.talentLoadout === 'custom') {
    const n = Object.keys(flags.talents || {}).length;
    parts.push(`talents:custom(${n})`);
  } else {
    parts.push(`talents:${flags.talentLoadout || 'none'}`);
  }
  if (flags.buildingLoadout === 'custom') {
    const built = flags.buildings || {};
    const bits = Object.entries(built)
      .filter(([, rank]) => rank > 0)
      .map(([id, rank]) => `${id}${rank}`);
    parts.push(`buildings:${bits.join('+') || 'none'}`);
  } else {
    parts.push(`buildings:${flags.buildingLoadout || 'none'}`);
  }
  if (flags.actLocationIds?.some(Boolean)) {
    const ids = flags.actLocationIds;
    const same = ids[0] && ids[0] === ids[1] && ids[1] === ids[2];
    parts.push(same ? `location:${ids[0]}` : `location:${ids.filter(Boolean).join('+')}`);
  } else if (flags.monthToken != null || flags.pinCalendarMonth) {
    parts.push(`month:${flags.monthToken ?? flags.calendarMonthIndex ?? 0}`);
  }
  if (flags.act) parts.push(`act:${flags.act}`);
  const seedN = flags.act ? (ACT_START_AMULET_COUNT[flags.act] || 0) : 0;
  const hasExplicitKit = Boolean(
    flags.explicitAmuletStart
    || (flags.explicitAmuletLoadout && flags.amuletLoadout !== 'none')
  );
  if (seedN > 0 && !hasExplicitKit) parts.push(`amulets:${seedN}rand`);
  else if (hasExplicitKit && flags.amuletLoadout && flags.amuletLoadout !== 'none') {
    parts.push(`loadout:${flags.amuletLoadout}`);
  } else if (hasExplicitKit && flags.explicitAmuletStart) {
    parts.push(`amulet-start:${(flags.amuletStart || []).length}`);
  }
  if (flags.enableMeta) {
    const nPool = flags.metaPool?.length;
    const nStart = flags.metaStart?.length;
    if (nPool != null) parts.push(`relics:${nStart ?? '?'}/${nPool}`);
  }
  if (flags.enableAmulets) {
    if (flags.amuletLoadout && flags.amuletLoadout !== 'none' && flags.amuletStart == null) {
      parts.push(`loadout:${flags.amuletLoadout}`);
    }
    const nPool = flags.amuletPool?.length;
    const nStart = flags.amuletStart?.length;
    if (nPool != null && !(seedN > 0 && !hasExplicitKit)) parts.push(`amulets:${nStart ?? '?'}/${nPool}`);
  }
  return parts.join(', ');
}

/** Build runGame config slice from parsed flags. */
export function buildSimRunExtras(flags, { allRelics = [], strongAmulets = [], allAmulets = [], metaMode = 'fresh' } = {}) {
  const norm = normalizeSimPools(flags, { allRelics, allAmulets, metaMode });
  const relics = norm.enableMeta ? norm.metaStart.slice() : [];
  const veteranHp = 0;

  let amulets = [];
  let noBag = true;
  let forceStartingAmulets = false;
  let amuletPool = (norm.amuletPool && norm.amuletPool.length)
    ? norm.amuletPool.slice()
    : allAmulets.slice();
  let actAmuletSeed = 0;

  const talentConfig = {
    talents: { ...(flags.talents || {}) },
    talentChoices: { ...(flags.talentChoices || {}) },
  };
  if (flags.talentLoadout === 'max' && !Object.keys(talentConfig.talents).length) {
    const built = buildMaxTalentLoadout(norm.characterId, norm.armorPool);
    talentConfig.talents = built.talents;
    talentConfig.talentChoices = built.talentChoices;
  }

  const hasExplicitAmuletKit = Boolean(
    flags.explicitAmuletStart
    || (flags.explicitAmuletLoadout && flags.amuletLoadout !== 'none')
  );

  // Mid-run drop/shop pool only when amulets are enabled.
  if (norm.enableAmulets) {
    amuletPool = norm.amuletPool.slice();
  }

  // Explicit start kits apply even under --no-amulets (forced loadout).
  if (flags.explicitAmuletStart && Array.isArray(flags.amuletStart)) {
    amulets = flags.amuletStart.slice();
    forceStartingAmulets = true;
    noBag = true;
  } else if (flags.explicitAmuletLoadout && flags.amuletLoadout === 'bag') {
    amulets = ['ringOfRegeneration'];
    forceStartingAmulets = true;
    noBag = true;
  } else if (flags.explicitAmuletLoadout && flags.amuletLoadout === 'strong') {
    amulets = strongAmulets.slice();
    for (const id of amulets) {
      if (!amuletPool.includes(id)) amuletPool.push(id);
    }
    forceStartingAmulets = true;
    noBag = true;
  } else if (norm.enableAmulets && flags.amuletLoadout === 'bag') {
    amulets = norm.amuletStart.slice();
    forceStartingAmulets = true;
    noBag = true;
  } else if (norm.enableAmulets && flags.amuletLoadout === 'strong') {
    amulets = strongAmulets.slice();
    for (const id of amulets) {
      if (!amuletPool.includes(id)) amuletPool.push(id);
    }
    forceStartingAmulets = true;
    noBag = true;
  } else if (norm.enableAmulets && flags.amuletStart != null) {
    amulets = norm.amuletStart.slice();
    forceStartingAmulets = true;
    noBag = true;
  }

  // Mid-act kit: random amulets unless caller already chose a start loadout.
  const act = flags.act;
  const seedCount = actStartAmuletCount(act);
  if (seedCount > 0 && !hasExplicitAmuletKit) {
    const poolForSeed = amuletPool.length ? amuletPool : allAmulets.slice();
    amulets = sampleAmuletIds(poolForSeed, seedCount);
    forceStartingAmulets = true;
    noBag = true;
    actAmuletSeed = amulets.length;
  }

  return {
    relics,
    veteranHp,
    amulets,
    noBag,
    forceStartingAmulets,
    amuletPool: norm.enableAmulets ? amuletPool : (forceStartingAmulets ? amuletPool : []),
    metaPool: norm.enableMeta ? norm.metaPool.slice() : [],
    characterId: normalizeCharacterId(flags.characterId || 'rogue'),
    armorPool: flags.armorPool ? flags.armorPool.slice() : null,
    talents: talentConfig.talents,
    talentChoices: talentConfig.talentChoices,
    buildings: normalizeVillageBuildings(flags.buildings),
    calendarMonthIndex: flags.calendarMonthIndex ?? 0,
    pinCalendarMonth: Boolean(flags.pinCalendarMonth) && !flags.actLocationIds?.some(Boolean),
    actLocationIds: Array.isArray(flags.actLocationIds) ? flags.actLocationIds.slice() : null,
    act: act || null,
    startingWeaponRarity: actStartWeaponRarity(act || 1),
    actAmuletSeed,
  };
}

/** Append CLI tokens for pool/start lists (skip when null = default-all). */
export function simPoolFlagArgs(flags) {
  const args = [];
  if (flags.enableMeta) {
    if (flags.metaPool) args.push('--meta-pool', flags.metaPool.join(','));
    if (flags.metaStart) args.push('--meta-start', flags.metaStart.join(','));
  }
  if (flags.enableAmulets) {
    if (flags.amuletPool) args.push('--amulet-pool', flags.amuletPool.join(','));
    if (flags.amuletStart && flags.amuletStart.length) {
      args.push('--amulet-start', flags.amuletStart.join(','));
    } else if (flags.amuletLoadout && flags.amuletLoadout !== 'none' && !flags.amuletStart) {
      args.push('--amulet-loadout', flags.amuletLoadout);
    }
  }
  if (flags.locationToken != null) args.push('--location', String(flags.locationToken));
  else if (flags.monthToken != null) args.push('--month', String(flags.monthToken));
  if (flags.act) args.push('--act', String(flags.act));
  if (flags.buildingLoadout && flags.buildingLoadout !== 'none') {
    args.push('--buildings', flags.buildingSpec || flags.buildingLoadout);
  }
  if (flags.talentLoadout && flags.talentLoadout !== 'none') {
    args.push('--talents', flags.talentSpec || flags.talentLoadout);
  }
  return args;
}

export function simFlagsUsage() {
  return `
Sim flags (combine with stats-db / loot-stats / fresh):
  --character rogue|warrior   Playable class (default: rogue)
  --armor-pool chain|plate|both   Warrior armor spawn filter (default: both)
  --talents none|max|id:rank,...  No talents, max live branch, or custom ranks
  --buildings none|max|id:rank,...  Village buildings (live meta). --meta alone = max
  --location id | id,id,id     Pin Path location(s). One id covers all acts
  --month thornwake|silkdeep|tollroad|0|1|2  Pin calendar month roster (no act rotation)
  --act 1|2|3                 Run only that act; starters: common/uncommon/rare
                              Act 2/3 also seed 3/6 random starting amulets
  --meta | --no-meta          Enable meta (village buildings by default)
  --amulets | --no-amulets    Floor drops, events, shop amulets
  --amulet-loadout none|bag|strong   Starting amulets shortcut (overrides act seed)
  --meta-pool id,id           Relics allowed in this experiment
  --meta-start id,id          Relics unlocked at run start (subset of pool)
  --amulet-pool id,id         Amulets allowed in drops/shops/events
  --amulet-start id,id        Amulets equipped at run start (overrides act seed)

Presets:
  balance          no meta, no amulets
  fresh            no meta, amulets on (shop/drops)
  geared           meta + amulets (all relics start)
  accumulate       meta career unlocks + amulets
`.trim();
}
