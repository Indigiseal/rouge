// Strategy-branch amulets: scout a hidden enemy, pull the first back-row
// ranged fighter forward, then cluster revealed enemies by swapping with
// face-down cards. BoardCards indices stay put; brick.r decides melee/ranged.

// Brick neighbor offsets — same as CardSystem.OFFS_EVEN / OFFS_ODD ([dc, dr]).
const OFFS_EVEN = [
    [+1, 0], [0, +1], [-1, +1],
    [-1, 0], [-1, -1], [0, -1],
];
const OFFS_ODD = [
    [+1, 0], [+1, +1], [0, +1],
    [-1, 0], [0, -1], [+1, -1],
];

export const STRATEGY_CLUSTER_DEBOUNCE_MS = 280;

export function isStrategySwappable(card) {
    const data = card?.data;
    if (!data || !card.sprite) return false;
    if (!data.brick || !Number.isFinite(data.brick.r) || !Number.isFinite(data.brick.c)) {
        return false;
    }
    if (data.type === 'boss') return false;
    if (data.isCocoon || data.isMimic) return false;
    const features = Array.isArray(data.features) ? data.features : [];
    if (features.includes('cocoon_shell')) return false;
    return true;
}

export function isStrategyBoardEnemy(card) {
    const type = card?.data?.type;
    return type === 'enemy' || type === 'eliteEnemy';
}

export function isRangedFighter(card) {
    const data = card?.data;
    if (!data) return false;
    return data.isRangedType === true || data.role === 'RANGED';
}

export function seatOfCard(card) {
    return {
        brick: card?.data?.brick
            ? { r: card.data.brick.r, c: card.data.brick.c }
            : null,
        restX: card?.restX,
        restY: card?.restY,
    };
}

export function frontRowR(boardCards) {
    let best = -Infinity;
    for (const card of Array.isArray(boardCards) ? boardCards : []) {
        const row = card?.data?.brick?.r;
        if (Number.isFinite(row) && row > best) best = row;
    }
    return Number.isFinite(best) ? best : null;
}

export function strategyNeighborBricks(row, col) {
    const offs = (row & 1) ? OFFS_ODD : OFFS_EVEN;
    return offs.map(([dc, dr]) => ({ r: row + dr, c: col + dc }));
}

export function bricksAdjacent(a, b) {
    if (!a || !b) return false;
    return strategyNeighborBricks(a.r, a.c).some((n) => n.r === b.r && n.c === b.c);
}

function pickRandom(list) {
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
}

/** One face-down enemy to pin, skipping opening-reveal picks and elite mystery backs. */
export function pickScoutTarget(boardCards, skipCards = []) {
    const skip = new Set(skipCards);
    const pool = (Array.isArray(boardCards) ? boardCards : []).filter((card) => {
        if (!card || skip.has(card) || card.revealed) return false;
        if (card.data?.highlightedBack || card.data?.strategyScout) return false;
        if (!isStrategyBoardEnemy(card) || !isStrategySwappable(card)) return false;
        return true;
    });
    return pickRandom(pool);
}

/**
 * First revealed ranged fighter that is not on the front row, paired with a
 * random card already on that row.
 */
export function pickFirstRangedMarchPair(boardCards, revealedCard) {
    if (!revealedCard || !isStrategyBoardEnemy(revealedCard) || !isStrategySwappable(revealedCard)) {
        return null;
    }
    if (!isRangedFighter(revealedCard)) return null;
    const frontR = frontRowR(boardCards);
    if (!Number.isFinite(frontR)) return null;
    if (revealedCard.data.brick.r === frontR) return null;
    const pool = (Array.isArray(boardCards) ? boardCards : []).filter((card) => (
        card
        && card !== revealedCard
        && isStrategySwappable(card)
        && card.data.brick.r === frontR
    ));
    const target = pickRandom(pool);
    if (!target) return null;
    return [revealedCard, target];
}

function areEnemyNodesConnected(nodes) {
    if (nodes.length <= 1) return true;
    const seen = new Set([nodes[0]]);
    const queue = [nodes[0]];
    while (queue.length) {
        const cur = queue.pop();
        for (const other of nodes) {
            if (seen.has(other)) continue;
            if (!bricksAdjacent(cur.brick, other.brick)) continue;
            seen.add(other);
            queue.push(other);
        }
    }
    return seen.size === nodes.length;
}

function isAdjacentToCluster(node, cluster) {
    return cluster.some((member) => bricksAdjacent(node.brick, member.brick));
}

/**
 * Swap revealed enemies with face-down cards until the enemies share row or
 * column neighbors. `preferFront` grows the cluster toward the front row.
 * Returns an ordered list of [cardA, cardB] pairs to apply on the live board.
 */
export function planClusterSwaps(boardCards, { preferFront = false } = {}) {
    const board = (Array.isArray(boardCards) ? boardCards : []).filter(Boolean);
    const enemyCards = board.filter((card) => (
        card.revealed && isStrategyBoardEnemy(card) && isStrategySwappable(card)
    ));
    if (enemyCards.length < 2) return [];

    const frontR = frontRowR(board);
    const nodes = board.filter(isStrategySwappable).map((card) => ({
        card,
        brick: { r: card.data.brick.r, c: card.data.brick.c },
        restX: card.restX,
        restY: card.restY,
        revealed: !!card.revealed,
        enemy: enemyCards.includes(card),
    }));
    const enemyNodes = nodes.filter((node) => node.enemy);
    const connected = areEnemyNodesConnected(enemyNodes);
    const allOnFront = Number.isFinite(frontR)
        && enemyNodes.every((node) => node.brick.r === frontR);
    if (connected && (!preferFront || allOnFront)) return [];

    const swaps = [];
    const swapNodes = (a, b) => {
        if (!a || !b || a === b) return;
        const brick = a.brick;
        a.brick = b.brick;
        b.brick = brick;
        const restX = a.restX;
        a.restX = b.restX;
        b.restX = restX;
        const restY = a.restY;
        a.restY = b.restY;
        b.restY = restY;
        swaps.push([a.card, b.card]);
    };

    const cluster = [];
    if (preferFront && Number.isFinite(frontR)) {
        const onFront = enemyNodes.filter((node) => node.brick.r === frontR);
        if (onFront.length) {
            cluster.push(onFront[0]);
        } else {
            const mover = enemyNodes.slice().sort((a, b) => b.brick.r - a.brick.r)[0];
            const frontFaceDown = nodes.filter((node) => (
                !node.revealed && !node.enemy && node.brick.r === frontR
            ));
            const anyFaceDown = nodes.filter((node) => !node.revealed && !node.enemy);
            const target = pickRandom(frontFaceDown.length ? frontFaceDown : anyFaceDown);
            if (mover && target) swapNodes(mover, target);
            if (mover) cluster.push(mover);
        }
    } else {
        let best = enemyNodes[0];
        let bestAdj = -1;
        for (const node of enemyNodes) {
            const adj = enemyNodes.filter((other) => (
                other !== node && bricksAdjacent(node.brick, other.brick)
            )).length;
            if (adj > bestAdj || (adj === bestAdj && node.brick.r > best.brick.r)) {
                best = node;
                bestAdj = adj;
            }
        }
        cluster.push(best);
    }

    const remaining = () => enemyNodes.filter((node) => !cluster.includes(node));
    while (remaining().length) {
        const faceDownNear = nodes.filter((node) => (
            !node.revealed && !node.enemy && isAdjacentToCluster(node, cluster)
        ));
        if (preferFront && Number.isFinite(frontR)) {
            faceDownNear.sort((a, b) => {
                const da = a.brick.r === frontR ? 1 : 0;
                const db = b.brick.r === frontR ? 1 : 0;
                return db - da;
            });
        }
        const alreadyNear = remaining().find((node) => isAdjacentToCluster(node, cluster));
        const frontSlot = preferFront && Number.isFinite(frontR)
            ? faceDownNear.find((node) => node.brick.r === frontR)
            : null;
        if (alreadyNear && (!frontSlot || alreadyNear.brick.r === frontR)) {
            cluster.push(alreadyNear);
            continue;
        }
        const slot = frontSlot || faceDownNear[0];
        const mover = alreadyNear && frontSlot
            ? remaining().find((node) => node.brick.r !== frontR) || remaining()[0]
            : remaining()[0];
        if (!slot || !mover) break;
        swapNodes(mover, slot);
        cluster.push(mover);
    }

    return swaps.filter(([a, b]) => a && b && a !== b);
}
