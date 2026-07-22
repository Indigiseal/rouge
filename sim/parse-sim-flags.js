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

import {
  setSimTestOptionsOverride,
  TEST_OPTION_IDS,
} from '../src/config/TestOptions.js';
import { CHARACTER_IDS, normalizeCharacterId } from '../src/content/characters/CharacterClasses.js';

export const SIM_META_MODES = new Set(['fresh', 'geared', 'accumulate', 'balance']);
export const SIM_CHARACTER_IDS = new Set(CHARACTER_IDS);
export const SIM_ARMOR_POOLS = new Set(['chain', 'plate', 'both']);

function parseArmorPool(val) {
  if (!val || !SIM_ARMOR_POOLS.has(val)) return null;
  if (val === 'both') return ['chain', 'plate'];
  return [val];
}

const MODE_DEFAULTS = {
  balance: { meta: false, amulets: false },
  fresh: { meta: false, amulets: true },
  geared: { meta: true, amulets: true },
  accumulate: { meta: true, amulets: true },
};

const LOADOUTS = new Set(['none', 'bag', 'strong']);

function parseIdList(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return [];
  return [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];
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
      if (
        (a === '--amulet-loadout' || a === '--meta-pool' || a === '--meta-start'
          || a === '--amulet-pool' || a === '--amulet-start' || a === '--character'
          || a === '--armor-pool')
        && argv[i + 1] && !argv[i + 1].startsWith('--')
      ) {
        flags.push(`${a} ${argv[++i]}`);
        continue;
      }
      if (a.startsWith('--meta-pool=') || a.startsWith('--meta-start=')
        || a.startsWith('--amulet-pool=') || a.startsWith('--amulet-start=')
        || a.startsWith('--amulet-loadout=') || a.startsWith('--character=')
        || a.startsWith('--armor-pool=')) {
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
 * @returns {{
 *   enableMeta: boolean,
 *   enableAmulets: boolean,
 *   amuletLoadout: 'none'|'bag'|'strong',
 *   metaPool: string[]|null,
 *   metaStart: string[]|null,
 *   amuletPool: string[]|null,
 *   amuletStart: string[]|null,
 *   characterId: 'rogue'|'warrior',
 *   armorPool: string[]|null,
 * }}
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

  for (const raw of flagTokens) {
    const token = raw.trim();
    if (token === '--meta' || token === '--meta on') enableMeta = true;
    else if (token === '--no-meta' || token === '--meta off') enableMeta = false;
    else if (token === '--amulets' || token === '--amulets on') enableAmulets = true;
    else if (token === '--no-amulets' || token === '--amulets off') enableAmulets = false;
    else if (token.startsWith('--amulet-loadout')) {
      const val = flagValue(token, '--amulet-loadout');
      if (LOADOUTS.has(val)) amuletLoadout = val;
    } else if (token.startsWith('--meta-pool')) {
      metaPool = parseIdList(flagValue(token, '--meta-pool'));
    } else if (token.startsWith('--meta-start')) {
      metaStart = parseIdList(flagValue(token, '--meta-start'));
    } else if (token.startsWith('--amulet-pool')) {
      amuletPool = parseIdList(flagValue(token, '--amulet-pool'));
    } else if (token.startsWith('--amulet-start')) {
      amuletStart = parseIdList(flagValue(token, '--amulet-start'));
    } else if (token.startsWith('--character')) {
      const val = flagValue(token, '--character');
      if (val && SIM_CHARACTER_IDS.has(val)) characterId = val;
      else if (val) characterId = normalizeCharacterId(val);
    } else if (token.startsWith('--armor-pool')) {
      armorPool = parseArmorPool(flagValue(token, '--armor-pool'));
    }
  }

  if (!enableAmulets) {
    amuletLoadout = 'none';
    amuletPool = [];
    amuletStart = [];
  }
  if (!enableMeta) {
    metaPool = [];
    metaStart = [];
  }

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
      // Career loop: earn relics on death; start empty unless --meta-start given.
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
      if (out.amuletLoadout === 'strong') start = []; // filled by caller with STRONG_AMULETS
      else if (out.amuletLoadout === 'bag') start = ['ringOfHealth'];
      else start = [];
    } else {
      start = start.slice();
    }
    for (const id of start) poolSet.add(id);
    out.amuletPool = [...poolSet];
    out.amuletStart = start;
  } else {
    out.amuletPool = [];
    out.amuletStart = [];
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
    if (nPool != null) parts.push(`amulets:${nStart ?? '?'}/${nPool}`);
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
  let amuletPool = null;

  if (norm.enableAmulets) {
    amuletPool = norm.amuletPool.slice();
    if (flags.amuletStart != null || flags.amuletLoadout === 'bag') {
      amulets = norm.amuletStart.slice();
      forceStartingAmulets = true;
      noBag = true;
    } else if (flags.amuletLoadout === 'strong') {
      amulets = strongAmulets.slice();
      for (const id of amulets) {
        if (!amuletPool.includes(id)) amuletPool.push(id);
      }
      forceStartingAmulets = true;
      noBag = true;
    } else {
      // Fresh-style: no starting amulets; pool controls mid-run finds.
      amulets = [];
      noBag = true;
      forceStartingAmulets = false;
    }
  }

  return {
    relics,
    veteranHp,
    amulets,
    noBag,
    forceStartingAmulets,
    amuletPool,
    metaPool: norm.enableMeta ? norm.metaPool.slice() : [],
    characterId: normalizeCharacterId(flags.characterId || 'rogue'),
    armorPool: flags.armorPool ? flags.armorPool.slice() : null,
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
  return args;
}

export function simFlagsUsage() {
  return `
Sim flags (combine with stats-db / loot-stats / fresh):
  --character rogue|warrior   Playable class (default: rogue)
  --armor-pool chain|plate|both   Warrior armor spawn filter (default: both)
  --meta | --no-meta          Enable meta relics for the run
  --amulets | --no-amulets    Floor drops, events, shop amulets
  --amulet-loadout none|bag|strong   Starting amulets shortcut
  --meta-pool id,id           Relics allowed in this experiment
  --meta-start id,id          Relics unlocked at run start (subset of pool)
  --amulet-pool id,id         Amulets allowed in drops/shops/events
  --amulet-start id,id        Amulets equipped at run start

Presets:
  balance          no meta, no amulets
  fresh            no meta, amulets on (shop/drops)
  geared           meta + amulets (all relics start)
  accumulate       meta career unlocks + amulets
`.trim();
}
