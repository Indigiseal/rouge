// The balance sim keeps up with the game.
//
// 1. Every story in src/content/events plays through the sim's event bridge
//    (sim/event-bridge.js) with the game's own EventScene code, many times
//    over, without throwing. A new story that needs something the bridge
//    cannot do (a new drop zone, a new minigame) fails here.
// 2. Every enemy rule the game's turn loop checks (CombatTurnController) is
//    handled in sim/, or listed below with why the sim can skip it. The sim
//    rewrites that loop (sim/mock.js runEnemyTurn), so a rule added there
//    alone would silently never happen in simulated runs.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MockScene } from '../sim/mock.js';
import { SimInventorySystem } from '../sim/sim-inventory.js';
import { playRealEvent } from '../sim/event-bridge.js';
import { GameState } from '../src/systems/GameState.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { EVENTS } from '../src/content/events/index.js';

// ── 1. Stories ──────────────────────────────────────────────────────────
const ROADS = ['thornwake', 'silkdeep', 'tollroad', 'stormhatch', 'frosthollow', 'sandreach', 'ashhowl', 'boneflood', 'mireturn', 'veilbleed'];
const CARD_TYPES = ['weapon', 'armor', 'potion', 'food', 'magic', 'gem', 'thorns'];
const PLAYS = 40;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const policy = {
    chooseChoice: (_id, choices) => pick(choices),
    chooseDrop: (_id, candidates) => (Math.random() < 0.6 ? pick(candidates) : null),
    chooseReliquary: (offer, weapons) => ({ magicType: pick(offer), slotIndex: pick(weapons).slotIndex }),
};

function run(floor) {
    const mock = new MockScene();
    const gs = new GameState(mock);
    mock.gameState = gs;
    mock.amuletManager = new AmuletManager(mock);
    mock.cardSystem = new CardSystem(mock);
    mock.inventorySystem = new SimInventorySystem(gs);
    mock.inventorySystem.syncGameStateInventory();
    gs.currentFloor = floor;
    gs.coins = Math.floor(Math.random() * 80);
    gs.actLocationIds = [pick(ROADS), null, null];
    const gen = mock.cardSystem.cardDataGenerator;
    for (let i = 0; i < 4; i++) {
        const card = gen.createCardData(pick(CARD_TYPES), floor, false, gs);
        if (card) mock.inventorySystem.addCard(card);
    }
    gs.equippedWeapon = gen.createCardData('weapon', floor, false, gs);
    return { mock, gs };
}

const failures = [];
for (const event of EVENTS) {
    for (let i = 0; i < PLAYS; i++) {
        const { mock, gs } = run(1 + (i % 14));
        const result = playRealEvent(mock, gs, policy, { forcedEventId: event.id });
        assert.equal(result.eventId, event.id, `${event.id} opens when forced`);
        if (result.error) {
            failures.push(`${event.id} (${result.choices.join(' > ') || 'opening'}): ${result.error.message}`);
            break;
        }
    }
}
assert.deepEqual(failures, [], `stories the sim cannot play:\n  ${failures.join('\n  ')}`);

// ── 2. Enemy turn rules ─────────────────────────────────────────────────
// Rules the sim does not need to copy, and why. Anything else the turn loop
// checks must appear in sim/.
const NOT_IN_SIM = {
    taunt: 'no enemy carries it; the Taunt sigil is not marked working yet',
    spore_on_hit: 'no enemy carries it; Spore Archer has the Daze sigil, applied in shared code',
    boss: 'card type, not a rule',
};

const turnLoop = readFileSync(new URL('../src/systems/combat/CombatTurnController.js', import.meta.url), 'utf8');
const sim = readdirSync(new URL('../sim/', import.meta.url))
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(new URL(`../sim/${name}`, import.meta.url), 'utf8'))
    .join('\n');
const rules = new Set();
const patterns = [
    /features\??\.includes\('([A-Za-z_]+)'\)/g,
    /sigilLevel\([^,]+, '([A-Za-z]+)'\)/g,
    /\b(?:ability|ab|a)\.type === '([a-z_]+)'/g,
];
for (const pattern of patterns) for (const [, id] of turnLoop.matchAll(pattern)) rules.add(id);
assert.ok(rules.size > 10, 'the turn loop rules were found');
const missing = [...rules].filter((id) => !NOT_IN_SIM[id] && !sim.includes(`'${id}'`));
assert.deepEqual(missing, [],
    `CombatTurnController handles these but sim/ never does: ${missing.join(', ')}. `
    + 'Teach sim/mock.js runEnemyTurn, or add them to NOT_IN_SIM with the reason.');

console.log(`Sim coverage checks passed: ${EVENTS.length} stories x ${PLAYS} plays, ${rules.size} enemy turn rules.`);
