import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { prepareSimWeaponSwing, resolveSimWeaponSwing } from '../sim/player-weapon-strike.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { consumePlayerAttackHold } from '../src/content/combat/frost.js';

const weapon = (...ids) => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 8,
    durability: 5, maxDurability: 5, sigils: ids.map(id => ({ id })) });
function fixture(wp, { game = {}, target = {}, offhand = null, amulets = [] } = {}) {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    Object.assign(scene.gameState, { playerHealth: 70, maxHealth: 100, currentFloor: 1, ...game });
    scene.gameState.activeAmulets = amulets.map(id => ({ id }));
    scene.amuletManager = new AmuletManager(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.tutorialMode = true;
    scene.createDamageEffect = () => {};
    const sprite = scene.add.image(0, 0, 'enemy');
    Object.assign(sprite, { x: 200, y: 80 });
    scene.cardSystem.boardCards = [{ revealed: true, sprite, restX: 200, restY: 80, data: {
        type: 'enemy', health: 100, maxHealth: 100, attack: 5, role: 'MELEE', features: [], ...target } }];
    scene.inventorySystem = { slots: [wp, ...(offhand ? [offhand] : [])], slotSprites: [], playSlotStrikeAnimation() {} };
    scene._simInventory = scene.inventorySystem.slots;
    scene.gameState.inventory = scene.inventorySystem.slots;
    scene.gameState.equippedWeapon = wp;
    return scene;
}
function liveAttack(scene) {
    const inv = { ...InventoryCombatUse, scene, slots: scene.inventorySystem.slots,
        playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {},
        returnWeaponToSlot() {}, handleWeaponBreak() {}, applyAssassinateTalent() {} };
    const sprite = scene.add.image(0, 0, 'weapon');
    Object.assign(sprite, { x: 200, y: 80 });
    inv.useWeapon(0, sprite);
}
function simulatedAttack(scene) {
    const gs = scene.gameState, wp = scene.inventorySystem.slots[0];
    const actionsBefore = gs.actionsLeft;
    const wasExhausted = actionsBefore <= 0;
    if (!scene.useAction() || consumePlayerAttackHold(gs)) return;
    const swing = prepareSimWeaponSwing(scene, 0, wp, { actionsBefore, wasExhausted });
    resolveSimWeaponSwing(scene, 0, wp, swing);
    const offhand = scene.inventorySystem.slots[1];
    if (!wasExhausted && wp.special === 'dualWield' && offhand?.special === 'dualWield'
        && offhand.durability > 0 && !(offhand.webbedTurns > 0)
        && scene.cardSystem.boardCards[0]?.data?.health > 0) {
        const second = prepareSimWeaponSwing(scene, 0, offhand, { actionsBefore, primary: false });
        resolveSimWeaponSwing(scene, 0, offhand, second, { skipDurability: true });
    }
}
function snapshot(scene) {
    const gs = scene.gameState;
    return JSON.parse(JSON.stringify({
        target: scene.cardSystem.boardCards[0]?.data,
        inventory: scene.inventorySystem.slots,
        health: gs.playerHealth, maxHealth: gs.maxHealth, actions: gs.actionsLeft,
        coins: gs.coins, shocked: gs.playerShocked, frozen: gs.playerFrozenAttacks,
        firstAttack: gs.firstAttackThisFloorUsed, keenFloor: gs.keenEdgeUsedFloor,
    }));
}
const cases = [
    { name: 'Frost conditional damage', wp: weapon('shatter', 'merciless'), target: { health: 40, frozen: 2, frostFrozen: true } },
    { name: 'full-AP ranged bonus', wp: weapon('wellFed', 'archerBane'), target: { role: 'RANGED' } },
    { name: 'Growth and Leech', wp: weapon('growth', 'leech') },
    { name: 'Echo and Cutpurse', wp: weapon('echo', 'cutpurse') },
    { name: 'Quick Strike and Sunder', wp: weapon('quickStrike', 'sunder'), target: { armor: 3 } },
    { name: 'Shock', wp: weapon('shock') },
    { name: 'Ash burn', wp: weapon('scorched') },
    { name: 'Silkdeep bomb', wp: weapon('venomousBomb') },
    { name: 'Second Wind', wp: weapon('secondWind'), game: { actionsLeft: 10 } },
    { name: 'Mending', wp: { ...weapon('mending'), durability: 3 } },
    { name: 'kill rewards and streak', wp: weapon('bounty', 'bloodlust'), target: { health: 7 } },
    { name: 'killing hit cannot echo', wp: weapon('echo', 'growth'), target: { health: 7 } },
    { name: 'evaded hit resets streak', wp: { ...weapon('honed'), honedFloor: 1, honedUses: 2 }, target: { abilities: [{ type: 'evade', chance: 1 }] } },
    { name: 'Warding', wp: weapon('warding') },
    { name: 'First Blood after sigils', wp: weapon('unscathed'), game: { playerHealth: 100, talentEffects: { firstBloodFlat: 2 } } },
    { name: 'Warrior crit after sigils', wp: weapon('merciless'), game: { characterId: 'warrior', warriorStance: 'focus' }, target: { health: 40 } },
    { name: 'Dune Quiver', wp: { ...weapon('echo'), weaponType: 'bow', range: 'ranged' }, amulets: ['duneQuiver'] },
    { name: 'off-hand full-AP snapshot', wp: { ...weapon('wellFed'), weaponType: 'dagger', special: 'dualWield' },
        offhand: { ...weapon('wellFed', 'growth'), weaponType: 'dagger', special: 'dualWield' } },
    { name: 'webbed off-hand', wp: { ...weapon(), weaponType: 'dagger', special: 'dualWield' },
        offhand: { ...weapon('growth'), weaponType: 'dagger', special: 'dualWield', webbedTurns: 1 } },
    { name: 'shocked player', wp: weapon('echo', 'growth'), game: { playerShocked: true, talentEffects: { firstBloodFlat: 2 } } },
    { name: 'frozen player', wp: weapon('quickStrike', 'growth'), game: { playerFrozenAttacks: 2 } },
    { name: 'exhaustion', wp: weapon('echo', 'growth'), game: { actionsLeft: 0 } },
];
const originalRandom = Math.random;
try {
    for (const test of cases) {
        const clone = value => JSON.parse(JSON.stringify(value));
        const live = fixture(clone(test.wp), clone(test));
        const sim = fixture(clone(test.wp), clone(test));
        Math.random = () => 0;
        liveAttack(live);
        Math.random = () => 0;
        simulatedAttack(sim);
        assert.deepEqual(snapshot(sim), snapshot(live), test.name);
    }
} finally { Math.random = originalRandom; }
console.log(`Simulator player-sigil execution matches live inventory attacks in ${cases.length} cases, including primary/off-hand, costs, holds, talents and location procs.`);
