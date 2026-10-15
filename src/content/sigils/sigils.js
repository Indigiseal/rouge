// content/sigils/sigils.js
// Sigils: one set of abilities shared by the player's cards and by enemies
// (design: docs/SIGILS.md). A sigil is a small icon in a card's top-right
// corner plus a one-line rule. Enemy traits are sigils too — an enemy that
// poisons wears the same Venom icon a poisoned dagger would.
//
// Icons live in enemyIcons.png (16x16 frames): frames 14-46 are the sigils in
// the design doc's order, 56-59 the four Arrest looks (Zap, Frost, Web, Ink).
//
// Every sigil has an icon and a rule text; `works: true` marks the ones whose
// player-side rule is built (systems/combat/SigilEffects.js). Thorns is the
// Briar Room's thorn wrap, shown as a sigil. Enemy sigils are read off the traits enemies already
// have, so they show without changing how any enemy plays.

export const SIGIL_ICONS_KEY = 'enemyIcons';
export const SIGIL_CAP = 2;            // different sigils per card
export const SIGIL_MULTIPLIER = 1.5;   // never x2 — rounds down, both sides

// side: 'both' | 'player' | 'enemy'. `player` / `enemy`: the rule as it reads
// on that side. `works`: true once the player-side rule is built.
export const SIGILS = Object.freeze({
    arrest:      { name: 'Arrest',      frame: 14, side: 'both',   enemy: 'locks one of your cards for a turn', player: '25% chance the enemy hit skips its next turn', works: true },
    venom:       { name: 'Venom',       frame: 15, side: 'both',   enemy: 'poisons you on hit', player: 'poisons the enemy hit: 1 per level for 3 turns', works: true },
    thorns:      { name: 'Thorns',      frame: 16, side: 'both',   enemy: 'damages whoever hits it', player: '+1 damage per level (Briar Room)', works: true },
    sunder:      { name: 'Sunder',      frame: 17, side: 'both',   enemy: 'wears down your armor', player: 'strips armor from the enemy' },
    daze:        { name: 'Daze',        frame: 18, side: 'both',   enemy: 'can make you lose an action or miss', player: 'can make the enemy miss its next attack' },
    crushing:    { name: 'Crushing',    frame: 19, side: 'both',   enemy: 'can hit harder or ignore armor', player: 'chance of a heavy hit' },
    cutpurse:    { name: 'Cutpurse',    frame: 20, side: 'both',   enemy: 'steals coins on hit', player: '+1 coin per level on each hit', works: true },
    leech:       { name: 'Leech',       frame: 21, side: 'both',   enemy: 'heals when it hits you', player: 'heals you 15% of the damage dealt', works: true },
    fleetfoot:   { name: 'Fleetfoot',   frame: 22, side: 'both',   enemy: 'your attacks can miss it', player: 'chance to dodge' },
    desperate:   { name: 'Desperate',   frame: 23, side: 'both',   enemy: 'hits x1.5 harder near death', player: 'x1.5 while you are below a quarter health', works: true },
    outnumbered: { name: 'Outnumbered', frame: 24, side: 'both',   enemy: '+1 attack per other enemy on the board', player: '+1 damage per enemy on the board', works: true },
    merciless:   { name: 'Merciless',   frame: 25, side: 'both',   enemy: 'x1.5 once you are below half health', player: 'x1.5 against enemies at half health or less', works: true },
    ambush:      { name: 'Ambush',      frame: 26, side: 'both',   enemy: 'x1.5 while you are unhurt', player: 'x1.5 against unhurt enemies', works: true },
    unscathed:   { name: 'Unscathed',   frame: 27, side: 'both',   enemy: 'x1.5 until you chip it once', player: 'x1.5 while you are at full health', works: true },
    honed:       { name: 'Honed',       frame: 28, side: 'both',   enemy: '+1 attack after each attack this fight', player: '+1 damage after each use this fight', works: true },
    ironclad:    { name: 'Ironclad',    frame: 29, side: 'both',   enemy: 'its armor adds to its damage', player: 'your worn armor protection adds to damage', works: true },
    ember:       { name: 'Ember',       frame: 30, side: 'both',   enemy: 'its hits burn you next turn', player: 'fire splash to nearby enemies' },
    sapping:     { name: 'Sapping',     frame: 31, side: 'both',   enemy: 'your weapons deal less for a turn', player: 'the struck enemy deals less' },
    warding:     { name: 'Warding',     frame: 32, side: 'both',   enemy: 'gains armor after it attacks', player: 'your armor is stronger for a turn' },
    mirror:      { name: 'Mirror',      frame: 33, side: 'both',   enemy: 'sends your next hit back', player: 'on armor: sends the first enemy attack each fight back (one more per level)', works: true },
    regenerate:  { name: 'Regenerate',  frame: 34, side: 'both',   enemy: 'heals at the end of each turn', player: 'heals you 1 per level each enemy turn', works: true },
    devouring:   { name: 'Devouring',   frame: 35, side: 'player', player: '8% chance per level to kill a non-boss outright', works: true },
    smoke:       { name: 'Smoke',       frame: 36, side: 'player', player: 'a kill hides another enemy', works: true },
    tempered:    { name: 'Tempered',    frame: 37, side: 'player', player: '30% chance per level this card keeps its pip', works: true },
    hunter:      { name: 'Hunter',      frame: 38, side: 'player', player: 'x1.5 against the enemy you hit last', works: true },
    combo:       { name: 'Combo',       frame: 39, side: 'player', player: 'x1.5 if your previous weapon also had Combo', works: true },
    tandem:      { name: 'Tandem',      frame: 40, side: 'player', player: 'x1.5 if your previous attack hit for the same damage', works: true },
    packrat:     { name: 'Packrat',     frame: 41, side: 'player', player: '+1 damage per empty bag slot', works: true },
    summon:      { name: 'Summon',      frame: 42, side: 'enemy',  enemy: 'calls a minion to fight beside it' },
    taunt:       { name: 'Taunt',       frame: 43, side: 'enemy',  enemy: 'must be attacked first' },
    veil:        { name: 'Veil',        frame: 44, side: 'enemy',  enemy: 'flips face-down each turn' },
    barkskin:    { name: 'Barkskin',    frame: 45, side: 'enemy',  enemy: 'immune to ranged attacks' },
    rally:       { name: 'Rally',       frame: 46, side: 'enemy',  enemy: 'goblins attack more often' },
    // A buffer: it never acts twice itself, its side does. Frame 47 is its
    // own icon slot; until that is drawn it wears Rally's horn.
    warcry:      { name: 'Warcry',      frame: 46, side: 'both',   enemy: 'other enemies: 10% chance per level to act twice', player: 'carried: your companions get 10% chance per level to act twice', works: true },
    // The four looks of Arrest: same rule, each with its own source.
    zap:         { name: 'Zap',         frame: 56, side: 'both',   enemy: 'locks one of your cards for a turn', player: 'the enemy hit skips its next turn (shock)' },
    frost:       { name: 'Frost',       frame: 57, side: 'both',   enemy: 'locks one of your cards for a turn', player: 'the enemy hit skips its next turn (freeze)' },
    web:         { name: 'Web',         frame: 58, side: 'both',   enemy: 'locks one of your cards for a turn', player: 'the enemy hit skips its next turn' },
    ink:         { name: 'Ink',         frame: 59, side: 'both',   enemy: 'locks one of your cards for a turn', player: 'the enemy hit skips its next turn' },
});

// Player sigils that work today: the ones the vault and elite chests hand out.
export const WORKING_PLAYER_SIGILS = Object.freeze(
    Object.keys(SIGILS).filter((id) => SIGILS[id].works && SIGILS[id].side !== 'enemy')
);

// Which card types a sigil can go on. Most act when a weapon strikes;
// Regenerate, Thorns, Tempered and Warcry also work from armor, and Mirror only does.
const ARMOR_SIGILS = new Set(['regenerate', 'thorns', 'tempered', 'mirror', 'warcry']);
const ARMOR_ONLY_SIGILS = new Set(['mirror']);
export function sigilFitsCardType(id, card) {
    if (!card || !SIGILS[id]) return false;
    if (card.type === 'weapon') return !ARMOR_ONLY_SIGILS.has(id);
    if (card.type === 'armor') return ARMOR_SIGILS.has(id);
    return false;
}

/** Whether `card` can take `id` now: right type, and room (or the same sigil to level up). */
export function canTakeSigil(card, id) {
    if (!sigilFitsCardType(id, card)) return false;
    if (id === 'thorns') return true;
    const list = storedSigils(card);
    return list.some((s) => s.id === id) || list.length < SIGIL_CAP;
}

// A Reliquary enchant shows as the sigil it becomes (design doc table).
const ENCHANT_SIGIL = Object.freeze({
    frostRing: 'frost', shadowBlade: 'crushing', restoration: 'leech', fireball: 'ember',
    weakness: 'sapping', magicShield: 'warding', boneWall: 'mirror', soulDrain: 'devouring',
    smokeScreen: 'smoke',
});

// An enemy's existing traits, as the sigils that will replace them.
const FEATURE_SIGIL = Object.freeze({
    poison_amp: 'venom', thorns_reflect: 'thorns', gnaw: 'sunder', club_stun: 'daze',
    spore_on_hit: 'daze', heavy_shot: 'crushing', ignore_armor: 'crushing', coin_steal: 'cutpurse',
    wolf_pack: 'outnumbered', taunt: 'taunt', veil_flip: 'veil', ranged_immune: 'barkskin',
    goblin_rally: 'rally',
});
const ABILITY_SIGIL = Object.freeze({
    poison: 'venom', armor_break: 'sunder', coin_steal: 'cutpurse', lifesteal: 'leech',
    evade: 'fleetfoot', rage: 'desperate', summon: 'summon',
});

export function getSigil(id) {
    return SIGILS[id] || null;
}

/** The sigils stored on a card: [{ id, level }], never undefined. */
export function storedSigils(card) {
    return Array.isArray(card?.sigils) ? card.sigils.filter((s) => s && SIGILS[s.id]) : [];
}

/**
 * Every sigil a player's card shows: the ones stored on it, plus those its
 * existing systems already give it (Briar thorns, a Reliquary enchant, the
 * chick's shock). [{ id, level }]
 */
export function cardSigils(card) {
    if (!card) return [];
    const out = storedSigils(card).map((s) => ({ id: s.id, level: Math.max(1, s.level || 1) }));
    const has = (id) => out.some((s) => s.id === id);
    if ((card.briarDamageBonus || 0) > 0 && !has('thorns')) out.push({ id: 'thorns', level: card.briarDamageBonus });
    const fromEnchant = ENCHANT_SIGIL[card.enchant];
    if (fromEnchant && !has(fromEnchant)) out.push({ id: fromEnchant, level: 1 });
    if ((card.shockChance || 0) > 0 && !has('zap')) out.push({ id: 'zap', level: 1 });
    return out;
}

/** The sigils an enemy or boss shows, read off its traits. [{ id, level }] */
export function enemySigils(data, { lockKind = null } = {}) {
    if (!data) return [];
    const ids = [];
    const levels = {};
    const add = (id) => { if (id && SIGILS[id] && !ids.includes(id)) ids.push(id); };
    // Sigils the enemy carries in its own right (a boss's), then its traits.
    for (const s of storedSigils(data)) {
        add(s.id);
        levels[s.id] = Math.max(1, s.level || 1);
    }
    for (const f of Array.isArray(data.features) ? data.features : []) {
        if (f === 'web_hand') add(lockKind === 'ink' ? 'ink' : 'web');
        else add(FEATURE_SIGIL[f]);
    }
    for (const a of Array.isArray(data.abilities) ? data.abilities : []) add(ABILITY_SIGIL[a?.type]);
    return ids.map((id) => ({ id, level: levels[id] || 1 }));
}

/** Level of one stored sigil on a card (0 if it has none). */
export function sigilLevel(card, id) {
    return cardSigils(card).find((s) => s.id === id)?.level || 0;
}

/**
 * Put a sigil on a card. The same sigil again goes up a level; a different one
 * takes a free slot, up to SIGIL_CAP. Returns false when the card is full.
 * Thorns is the Briar Room's wrap, so it raises that bonus instead.
 */
export function addSigil(card, id) {
    if (!card || !SIGILS[id]) return false;
    if (id === 'thorns') {
        card.briarDamageBonus = (card.briarDamageBonus || 0) + 1;
        if (card.type === 'weapon') card.damage = (card.damage || 0) + 1;
        else if (card.type === 'armor') card.thornDamage = card.briarDamageBonus;
        return true;
    }
    const list = storedSigils(card).map((s) => ({ ...s }));
    const existing = list.find((s) => s.id === id);
    if (existing) {
        existing.level = (existing.level || 1) + 1;
    } else {
        if (list.length >= SIGIL_CAP) return false;
        list.push({ id, level: 1 });
    }
    card.sigils = list;
    return true;
}

/**
 * The sigils a merged card carries: both cards' sigils, the same sigil's
 * levels added together, different ones up to SIGIL_CAP (the base card's
 * first). Sigils are never lost to an upgrade, only to the card's destruction.
 */
export function mergeSigils(baseCard, secondCard) {
    const out = [];
    for (const s of [...storedSigils(baseCard), ...storedSigils(secondCard)]) {
        const same = out.find((o) => o.id === s.id);
        if (same) same.level += Math.max(1, s.level || 1);
        else if (out.length < SIGIL_CAP) out.push({ id: s.id, level: Math.max(1, s.level || 1) });
    }
    return out;
}

/**
 * Whether two cards can merge without losing a sigil: their different sigils
 * together fit the cap (the same sigil on both just levels up).
 */
export function sigilsFitOnMerge(cardA, cardB) {
    const ids = new Set([...storedSigils(cardA), ...storedSigils(cardB)].map((s) => s.id));
    return ids.size <= SIGIL_CAP;
}

/** One tooltip line: "Merciless: x1.5 against ..." (+ level when above 1). */
export function sigilLine(id, level = 1, side = 'player') {
    const s = SIGILS[id];
    if (!s) return '';
    const rule = (side === 'enemy' ? s.enemy : s.player) || s.player || s.enemy || '';
    const lvl = level > 1 ? ` ${level}` : '';
    return `${s.name}${lvl}: ${rule}`;
}
