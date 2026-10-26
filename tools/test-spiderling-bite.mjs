// The Crystal Spiderling bites and webs in one move every other turn, spins
// between, and only bites a boss (sim/mock.js mirrors CombatTurnController).
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { CardDataGenerator } from '../src/systems/loot/CardDataGenerator.js';

function fight(attack, enemies) {
    const mock = new MockScene();
    const gs = new GameState(mock);
    mock.gameState = gs;
    mock.amuletManager = new AmuletManager(mock);
    mock.cardSystem = new CardSystem(mock);
    gs.playerHealth = gs.maxHealth = 100;
    const spider = { ...new CardDataGenerator().createCrystalSpiderlingCompanionCard(), attack };
    mock._simInventory = [spider];
    mock.cardSystem.boardCards = enemies.map((data) => ({ revealed: true, data: { maxHealth: data.health, ...data }, sprite: mock.add.image(0, 0, 'x') }));
    return { mock, spider, board: mock.cardSystem.boardCards };
}
const goblin = () => ({ type: 'enemy', name: 'Goblin', health: 20, attack: 5, role: 'MELEE' });

// Untrained in act 1 (0 attack): it webs, does no damage, then spins.
{
    const { mock, board } = fight(0, [goblin()]);
    mock._runCompanionTurns();
    assert.equal(board[0].data.webbedTurns, 1, 'webbed');
    assert.equal(board[0].data.health, 20, 'no bite at 0 attack');
}
// With attack (act 3, or trained): the web and the bite land together; next turn it spins.
{
    const { mock, board, spider } = fight(4, [goblin()]);
    mock._runCompanionTurns();
    assert.equal(board[0].data.webbedTurns, 1, 'webbed');
    assert.equal(board[0].data.health, 16, 'bitten for its attack in the same move');
    board[0].data.frozen = 0; board[0].data.webbedTurns = 0;
    mock._runCompanionTurns();
    assert.equal(board[0].data.health, 16, 'spinning: no bite');
    assert.ok(!(board[0].data.webbedTurns > 0), 'spinning: no web');
    assert.equal(spider.webSpinTurns, 0);
}
// Only a boss left: too big to web, but it still gets bitten.
{
    const boss = { type: 'boss', name: 'Cerberus', health: 100, attack: 17 };
    const { mock, board } = fight(3, [boss]);
    mock._runCompanionTurns();
    assert.equal(board[0].data.health, 97, 'the boss is bitten');
    assert.ok(!(board[0].data.webbedTurns > 0), 'a boss is never webbed');
}
console.log('Spiderling: web + bite every other turn (bite = its attack), spins between, bites a boss it cannot web.');
