// map/HiddenPaths.js
// Secret branches on the run map: a hidden room off the normal roads, which a
// story reveals (the Porter's Map is the first) and the map draws in purple.
//
// Shape. One secret room per act, as an extra node on floor f+1, reached only
// from one node on floor f and leading on to one node on floor f+2. It is a
// side door off a road the player could already take, not a new floor: it
// replaces the room they would have visited on f+1.
//
// Kept apart from normal routing on purpose. The way IN is listed on the
// parent node's `secretLinks`, never in `connections`, so nothing that does
// not know about secrets — map generation checks, the balance sim, the
// "is this node reachable" rules — can stumble onto one. The secret node's own
// `connections` are ordinary, so once the player stands in it, leaving works
// like anywhere else.
//
// Open while the source is live. A source can name its own test (the
// Porter's Map: while the amulet is held, so handing it back closes any
// secret room not yet reached); any other source counts as open once
// revealed. A visited secret room always stays drawn, as part of the road
// the player walked.

import { getLocationNarrativeCheckpoints } from '../content/locations/rules.js';

/** Map colour for everything on a secret branch: node tint, halo and road. */
export const HIDDEN_PATH_TINT = 0xc58cff;

const hasAmulet = (gameState, id) => (
    Array.isArray(gameState?.activeAmulets)
    && gameState.activeAmulets.some((amulet) => amulet?.id === id)
);

/**
 * Every story that can reveal a hidden path. `roomType` is the room the
 * secret node holds; `isOpen`, when given, decides whether the path is
 * currently showing (default: open once revealed).
 */
export const HIDDEN_PATH_SOURCES = Object.freeze({
    // The Lost Porter (Silkdeep): "a passage you have never seen, drawn in a
    // different hand". A good chest is what that passage leads to.
    porterMap: Object.freeze({
        roomType: 'TREASURE_GOOD',
        isOpen: (gameState) => hasAmulet(gameState, 'porterMap'),
    }),
});

export function isHiddenPathOpen(gameState, source) {
    if (!source) return false;
    const def = HIDDEN_PATH_SOURCES[source];
    if (def?.isOpen) return Boolean(def.isOpen(gameState));
    return Boolean(gameState?.storyRun?.hiddenPaths?.[source]);
}

/** False only for a secret node whose path is closed and was never walked. */
export function isMapNodeVisible(gameState, node) {
    if (!node?.secret) return true;
    return Boolean(node.visited) || isHiddenPathOpen(gameState, node.secretSource);
}

/**
 * Indices into the next floor of the secret rooms `node` currently leads to.
 * Use alongside `node.connections` wherever the map decides what is
 * reachable from a node.
 */
export function openSecretLinks(gameState, node, nextFloor) {
    if (!Array.isArray(node?.secretLinks) || !Array.isArray(nextFloor)) return [];
    return node.secretLinks.filter((idx) => isMapNodeVisible(gameState, nextFloor[idx]));
}

/**
 * Reveal `source`'s hidden path: one secret room in the current act (ahead of
 * the player, on a road they can still take) and in every act still to come.
 * Safe to call again — an act that already has this source's room is left
 * alone — so the map screen also calls it on open, which covers act maps
 * that are rebuilt after the reveal.
 *
 * Returns how many rooms it added.
 */
export function revealHiddenPaths(gameState, source) {
    if (!gameState?.dungeonMap || !HIDDEN_PATH_SOURCES[source]) return 0;
    if (!gameState.storyRun) gameState.storyRun = {};
    gameState.storyRun.hiddenPaths = { ...(gameState.storyRun.hiddenPaths || {}), [source]: true };
    return ensureHiddenPaths(gameState);
}

/** Add any missing secret rooms for every path that is open. */
export function ensureHiddenPaths(gameState) {
    const map = gameState?.dungeonMap;
    if (!map) return 0;
    const sources = Object.keys(gameState.storyRun?.hiddenPaths || {})
        .filter((source) => HIDDEN_PATH_SOURCES[source] && isHiddenPathOpen(gameState, source));
    if (!sources.length) return 0;

    const cursor = gameState.mapCursor || { act: 1, floor: 0, node: 0 };
    let added = 0;
    for (let act = Math.max(1, cursor.act || 1); act <= 3; act++) {
        const actMap = map[`act${act}`];
        if (!actMap?.floors?.length) continue;
        const here = act === (cursor.act || 1) ? cursor : null;
        sources.forEach((source) => {
            if (addSecretRoom(gameState, actMap, act, source, here)) added++;
        });
    }
    return added;
}

function addSecretRoom(gameState, actMap, act, source, cursor) {
    const floors = actMap.floors;
    const hasOne = floors.some((row) => row.some((node) => node?.secret && node.secretSource === source));
    if (hasOne) return false;

    // Never across a mandatory story stop: those sit between two floors and
    // merge every road into one node, which a side branch would skip.
    const startFloor = actMap.startFloor || ((act - 1) * 15 + 1);
    const stops = new Set(getLocationNarrativeCheckpoints(gameState, startFloor)
        .map((checkpoint) => checkpoint.afterFloor));
    const crossesStop = (f) => stops.has(f + 1) || stops.has(f + 2);

    // The branch leaves floor f and rejoins on f+2. f+2 must still be an
    // ordinary floor, not the boss.
    const last = floors.length - 1;
    const maxF = last - 3;

    // Where the branch may leave from. In the current act: a node the player
    // can still reach, from the floor after the one they stand on, so the
    // passage is something to walk toward. Later acts: anywhere mid-act.
    const options = [];
    if (cursor) {
        const reach = reachableFrom(floors, cursor.floor, cursor.node);
        for (let f = cursor.floor + 1; f <= maxF; f++) {
            if (crossesStop(f)) continue;
            floors[f].forEach((node, i) => {
                if (!node?.secret && reach.has(`${f}:${i}`)) options.push([f, i]);
            });
        }
    } else {
        for (let f = 2; f <= maxF; f++) {
            if (crossesStop(f)) continue;
            floors[f].forEach((node, i) => { if (!node?.secret) options.push([f, i]); });
        }
    }
    if (!options.length) return false;

    const [f, parentIdx] = options[Math.floor(Math.random() * options.length)];
    const parent = floors[f][parentIdx];

    // Rejoin on one of the parent's grandchildren, so the branch bends back
    // into roads the player would have met anyway.
    const grandchildren = new Set();
    (parent.connections || []).forEach((c) => {
        (floors[f + 1][c]?.connections || []).forEach((g) => grandchildren.add(g));
    });
    const rejoin = grandchildren.size
        ? [...grandchildren][Math.floor(Math.random() * grandchildren.size)]
        : 0;
    if (!floors[f + 2]?.[rejoin]) return false;

    // Appended, so every existing index into this row stays valid.
    const row = floors[f + 1];
    const secret = {
        id: `act${act}_floor${f + 1}_secret_${source}`,
        type: HIDDEN_PATH_SOURCES[source].roomType,
        x: 0,
        y: f + 1,
        lane: null,
        connections: [rejoin],
        visited: false,
        secret: true,
        secretSource: source,
    };
    row.push(secret);
    parent.secretLinks = [...(parent.secretLinks || []), row.length - 1];
    return true;
}

/** "floor:index" keys of every node reachable from (floor, node) by roads. */
function reachableFrom(floors, floor, node) {
    const seen = new Set([`${floor}:${node}`]);
    let frontier = [node];
    for (let f = floor; f < floors.length - 1 && frontier.length; f++) {
        const next = new Set();
        frontier.forEach((i) => {
            const n = floors[f][i];
            (n?.connections || []).forEach((c) => next.add(c));
        });
        frontier = [...next];
        frontier.forEach((i) => seen.add(`${f + 1}:${i}`));
    }
    return seen;
}
