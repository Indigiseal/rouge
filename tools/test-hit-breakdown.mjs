// A weapon hit's combat-log line lists everything that changed its damage, in
// order, from the weapon's own number: "Boss -12 (Sword 5: Ambush x1.5,
// CRIT x1.5, Armor -1)". Taya saw a 40 from a 9 and could not tell why.
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { applyWeaponSigils } from '../src/systems/combat/SigilEffects.js';

const randomBefore = Math.random;
const scene = new MockScene();
scene.gameState = new GameState(scene);
const cs = new CardSystem(scene);
scene.cardSystem = cs;
const log = [];
scene.pushCombatLog = (line) => log.push(line);

const sword = (extra = {}) => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5, durability: 5, maxDurability: 5, sigils: [], ...extra });
const faceUp = () => Object.assign(scene.add.image(), { texture: { key: 'enemyCard' } });
const boss = (extra = {}) => ({ revealed: true, sprite: faceUp(), data: { type: 'boss', name: 'Boss', role: 'MELEE', health: 50, maxHealth: 50, attack: 3, armor: 0, features: [], ...extra } });

try {
    // Rolls: no evade, no block; crit only when asked.
    const swing = (weapon, card, { crit = false } = {}) => {
        cs.boardCards = [card];
        log.length = 0;
        const hit = applyWeaponSigils(scene, weapon, card, weapon.damage);
        Math.random = () => 0.999;
        if (crit) scene.gameState.discardCritChance = 1;
        cs.attackEnemy(0, hit.damage, false, weapon, true, { steps: hit.steps, baseDamage: weapon.damage });
        scene.gameState.discardCritChance = 0;
        return log.at(-1);
    };

    // A plain hit names only the weapon, as before.
    assert.match(swing(sword(), boss()), /-5 \(.+\)$/);
    assert.doesNotMatch(swing(sword(), boss()), /:/, 'nothing to break down');

    // Ambush on a full-health boss, then a crit, then armor: each in order.
    const line = swing(sword({ sigils: [{ id: 'ambush' }] }), boss({ armor: 1 }), { crit: true });
    // 5 → Ambush 7 → CRIT 10 → armor 9.
    assert.match(line, /-9 \(.+ 5: .+ x1\.5, .+ x1\.5, .+ -1\)$/, line);

    // Reflected damage keeps its old line.
    cs.boardCards = [boss()];
    log.length = 0;
    cs.attackEnemy(0, 3, true);
    assert.match(log.at(-1), /-3 \(Reflected\)$/);

    console.log('hit breakdown: ok');
} finally {
    Math.random = randomBefore;
}
