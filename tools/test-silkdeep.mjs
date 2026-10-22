import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { applyVenomousBomb, entangleEnemy } from '../src/content/combat/silkdeep.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { LOCATION_SIGIL_POOLS } from '../src/content/sigils/locationSigils.js';
import { sigilPoolForLocation } from '../src/content/sigils/locationSigils.js';
import { secondGemView } from '../src/content/cards/gems.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { applyEnchantToWeapon, getEnchantChance, describeWeaponEnchant } from '../src/content/balance/WeaponEnchants.js';
import { getMagic } from '../src/content/cards/magic.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { enemySigils } from '../src/content/sigils/sigils.js';
import { strengthenPlayerPoison } from '../src/content/combat/silkdeep.js';

function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['silkdeep', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.inventorySystem = { slots: [{ type: 'weapon', damage: 5, durability: 4, maxDurability: 4 }] };
    scene.createDamageEffect = () => {};
    scene.tutorialMode = true;
    return scene;
}
function enemy(scene, x = 100, extra = {}, revealed = true) {
    const sprite = scene.add.image(x, 100, 'spider');
    sprite.x = x;
    sprite.y = 100;
    sprite.getBounds = () => ({ x: x - 26, y: 65, width: 52, height: 70, left: x - 26, right: x + 26, top: 65, bottom: 135 });
    return { revealed, sprite, data: { type: 'enemy', name: 'Spider', enemyType: 'spider', health: 50, maxHealth: 50,
        attack: 5, role: 'MELEE', features: [], ...extra } };
}
const stacks = card => card.data.statusEffects?.filter(effect => effect.type === 'poison') || [];
const weapon = (...ids) => ({ type: 'weapon', damage: 5, durability: 4, maxDurability: 4,
    rarity: 'rare', gemEffect: 'poison', gemCount: 2, sigils: ids.map(id => ({ id })) });

for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'silkdeep';
    assert.deepEqual(offerableSigils(scene), LOCATION_SIGIL_POOLS.silkdeep);
    assert.ok(offerableSigils(scene).includes('crystalBrood'));
    assert.ok(!offerableSigils(scene).includes('venom'));
    assert.ok(!offerableSigils(scene).includes('ambush'));
}
assert.ok(!sigilPoolForLocation('tollroad').includes('crystalBrood'), 'the old global fallback cannot offer the local crystal sigil');

const scene = fixture(), cs = scene.cardSystem;
const main = enemy(scene), near = enemy(scene, 160), second = enemy(scene, 190);
const hidden = enemy(scene, 130, {}, false), far = enemy(scene, 600);
const pile = enemy(scene, 140, { isBonePile: true });
cs.boardCards = [main, near, second, hidden, far, pile];
cs.applyWeaponPoison(main, weapon('venomStack'));
assert.equal(stacks(main).length, 3, 'two poison gems + one extra stack');
assert.ok(stacks(main).every(stack => stack.damage === 1 && stack.turns === 3));
const noGem = enemy(scene);
cs.applyWeaponPoison(noGem, { ...weapon('venomStack'), gemEffect: null });
assert.equal(stacks(noGem).length, 0, 'the support sigil cannot create poison without a poison gem');
const nativeOnly = enemy(scene);
cs.applyWeaponPoison(nativeOnly, { ...weapon('venomStack'), gemEffect: null, poisonDamage: 2, poisonTurns: 2 });
assert.equal(stacks(nativeOnly).length, 1, 'native venom stays separate from gem support');
const secondSocket = enemy(scene);
const dual = secondGemView({ ...weapon('venomStack'), gemEffect: 'fire', gem2Effect: 'poison', gem2Count: 2 });
cs.applyPoisonGemStacks(secondSocket, dual);
assert.equal(stacks(secondSocket).length, 3);
scene.amuletManager = { modifyPoisonGemTickDamage: () => 3 };
const boosted = enemy(scene);
cs.applyWeaponPoison(boosted, weapon('venomStack'));
assert.equal(stacks(boosted).reduce((sum, stack) => sum + stack.damage, 0), 9);
cs.splashPoisonGem(0, weapon('venomSplash'));
assert.equal(stacks(near).length, 2);
assert.equal(stacks(second).length, 0);
assert.equal(stacks(hidden).length, 0);
assert.equal(stacks(far).length, 0);
assert.equal(stacks(pile).length, 0);
scene.amuletManager.getPoisonGemSplashTargets = () => 1;
cs.splashPoisonGem(0, weapon('venomSplash'));
assert.equal(stacks(hidden).length, 2, 'existing amulet keeps its hidden-target behavior');
assert.equal(stacks(near).length, 4, 'sigil reaches a separate revealed target instead of doubling the amulet target');

const bombing = fixture();
const open = enemy(bombing), boss = enemy(bombing, 170, { type: 'boss' });
const unopened = enemy(bombing, 220, {}, false), dead = enemy(bombing, 230, { health: 0 });
const shell = enemy(bombing, 240, { isCocoon: true }), bones = enemy(bombing, 250, { isBonePile: true });
bombing.cardSystem.boardCards = [open, boss, unopened, dead, shell, bones];
bombing.gameState.relicEffects = { weaponPoisonChance: 1, poisonDamage: 9, poisonTurns: 9 };
assert.equal(applyVenomousBomb(bombing.cardSystem), 2);
assert.deepEqual(stacks(open), [{ type: 'poison', damage: 3, turns: 3, stackable: true }], 'bomb must not roll weapon poison relics');
assert.equal(stacks(boss).length, 1);
for (const card of [unopened, dead, shell, bones]) assert.equal(stacks(card).length, 0);
for (let turn = 0; turn < 3; turn++) bombing.cardSystem.processEnemyPoisonEffects();
assert.equal(open.data.health, 41);
assert.equal(boss.data.health, 41);
assert.equal(stacks(open).length, 0);

// The existing death-explosion amulet must still work when the final poison
// tick is the killing blow; it is not another new sigil or bomb effect.
const plague = fixture();
const dying = enemy(plague, 100, { health: 3, brickNeighbors: [1] });
const neighbor = enemy(plague, 160);
plague.cardSystem.boardCards = [dying, neighbor];
plague.amuletManager = { processEnemyKill(card) { plague.cardSystem.explodePoisonedEnemy(card, 10); } };
plague.cardSystem.applyEnemyPoison(dying, 3, 1);
plague.cardSystem.processEnemyPoisonEffects();
assert.equal(neighbor.data.health, 40, 'Plague Heart sees poison on the final lethal tick');

const originalRandom = Math.random;
try {
    Math.random = () => 0.99;
    const strike = fixture();
    const struck = enemy(strike), splashed = enemy(strike, 160);
    strike.cardSystem.boardCards = [struck, splashed];
    strike.cardSystem.attackEnemy(0, 2, false, weapon('venomStack', 'venomSplash'), true);
    assert.equal(stacks(struck).length, 3, 'real weapon attack applies the supported poison once');
    assert.equal(stacks(splashed).length, 3, 'real weapon attack splashes the supported stacks once');
    Math.random = () => 0.1;
    assert.ok(!onWeaponSigilHit(bombing, weapon('venomousBomb'), open, { damageDealt: 1 }).includes('venomousBomb'), '10% boundary does not trigger');
    Math.random = () => 0.099;
    assert.ok(onWeaponSigilHit(bombing, weapon('venomousBomb'), open, { damageDealt: 1 }).includes('venomousBomb'));
    assert.equal(stacks(open).length, 1);
    onWeaponSigilHit(bombing, weapon('venomousBomb'), open, { damageDealt: 0 });
    assert.equal(stacks(open).length, 1, 'a miss does not proc a bomb');
    Math.random = () => 0.149;
    assert.ok(onWeaponSigilHit(bombing, weapon('web'), open, { damageDealt: 1 }).includes('web'));
    assert.equal(open.data.frozen, 1);
    assert.equal(boss.data.frozen || 0, 0);
    assert.equal(entangleEnemy(bombing.cardSystem, boss), false);
    const frozen = enemy(bombing, 100, { frozen: 3 });
    assert.equal(entangleEnemy(bombing.cardSystem, frozen), false);
    assert.equal(frozen.data.frozen, 3, 'Web must not shorten existing control');
    Math.random = () => 0.15;
    assert.ok(!onWeaponSigilHit(bombing, weapon('web'), boss, { damageDealt: 1 }).includes('web'));
    Math.random = () => 0.99;
    const controller = new CombatTurnController(bombing);
    const before = bombing.gameState.playerHealth;
    controller.processEnemyAttack(open, 0);
    assert.equal(bombing.gameState.playerHealth, before, 'webbed creature misses its next attack');
    assert.equal(open.data.webbedTurns, 0);
    controller.processEnemyAttack(open, 0);
    assert.equal(bombing.gameState.playerHealth, before - 5);
} finally { Math.random = originalRandom; }

const spell = { type: 'magic', ...getMagic('venomousBomb') };
const castSprite = bombing.add.image(0, 0, 'venomousBomb');
const caster = { ...InventoryCombatUse, scene: bombing, slots: [spell], stationMode: true,
    cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; } };
assert.equal(caster.canMagicCardSucceed(spell, castSprite), true);
caster.useMagicCard(0, castSprite);
assert.equal(caster.slots[0], null);
assert.equal(stacks(open).length, 2, 'spell adds its poison once');
const validBoard = bombing.cardSystem.boardCards;
bombing.cardSystem.boardCards = [unopened, dead, shell, bones];
assert.equal(caster.canMagicCardSucceed(spell, castSprite), false);
bombing.cardSystem.boardCards = validBoard;
const enchanted = weapon();
assert.equal(applyEnchantToWeapon(enchanted, 'venomousBomb'), true);
assert.equal(getEnchantChance('venomousBomb'), 0.1);
assert.match(describeWeaponEnchant(bombing, enchanted), /10%/);
const saved = new SaveManager().serializeBoardCards(validBoard);
assert.deepEqual(saved[0].data.statusEffects, open.data.statusEffects);

for (const floor of [1, 16, 31]) {
    for (const [id, sigils] of Object.entries({ spider: ['venom'], caveCrawler: [], silkHusk: [],
        stingerScorpion: ['venomStack'], silkslinger: ['web'] })) {
        assert.deepEqual(enemySigils(buildEnemyCardFromDef(id, floor)).map(sigil => sigil.id), sigils);
    }
    for (const id of ['caveCrawler', 'silkHusk']) assert.deepEqual(buildEnemyCardFromDef(id, floor).features, []);
    const generated = fixture();
    generated.gameState.actLocationIds = ['silkdeep', 'silkdeep', 'silkdeep'];
    const queen = generated.cardSystem.cardDataGenerator.createBossCard(floor + 14, generated.gameState);
    assert.equal(queen.name, 'Spider Queen');
    assert.deepEqual(enemySigils(queen).map(sigil => sigil.id), ['venom', 'summon']);
    assert.equal(queen.abilities.length, 2);
    assert.ok(queen.abilities.some(ability => ability.type === 'summon' && ability.enemyType === 'spider'));
}
assert.equal(BOSSES.spiderQueen.health, 81);
assert.equal(BOSSES.spiderQueen.attack, 11);

const contact = fixture(), contactGs = contact.gameState;
const spider = enemy(contact, 100, buildEnemyCardFromDef('spider', 1));
const scorpion = enemy(contact, 200, buildEnemyCardFromDef('stingerScorpion', 1));
contact.cardSystem.boardCards = [spider, scorpion];
const contactController = new CombatTurnController(contact);
const randomBeforeContact = Math.random;
try {
    Math.random = () => 0.99;
    contactController.processEnemyAttack(scorpion, 1);
    assert.deepEqual(contactGs.playerEffects, [], 'a Scorpion cannot create poison');
    contactController.processEnemyAttack(spider, 0);
    assert.equal(contactGs.playerEffects[0].damage, 2);
    assert.equal(contactGs.playerEffects[0].turns, 3);
    contactController.processEnemyAttack(scorpion, 1);
    assert.equal(contactGs.playerEffects[0].damage, 3);
    assert.equal(contactGs.playerEffects[0].turns, 3, 'amplification does not extend poison');
    assert.equal(contactGs.playerEffects[0].stacks, 1, 'amplification does not add a fresh poison application');
    contactGs.boneWall = 1;
    contactController.processEnemyAttack(scorpion, 1);
    assert.equal(contactGs.playerEffects[0].damage, 3, 'Bone Shield stops poison strengthening');
    contactGs.playerEffects = [];
    contactGs.boneWall = 1;
    contactController.processEnemyAttack(spider, 0);
    assert.deepEqual(contactGs.playerEffects, [], 'Bone Shield prevents fresh poison');
    contactGs.briarShield = 1;
    contactController.processEnemyAttack(spider, 0);
    assert.deepEqual(contactGs.playerEffects, [], 'a reflected Spider attack does not poison the player');
    contactGs.equippedArmor = { type: 'armor', protection: 100, durability: 20, maxDurability: 20,
        sigils: [{ id: 'fleetfoot' }] };
    Math.random = () => 0;
    contactController.processEnemyAttack(spider, 0);
    assert.deepEqual(contactGs.playerEffects, [], 'dodging a Spider prevents poison');
    Math.random = () => 0.99;
    const hpBeforeBlockedContact = contactGs.playerHealth;
    contactController.processEnemyAttack(spider, 0);
    assert.equal(contactGs.playerHealth, hpBeforeBlockedContact);
    assert.equal(contactGs.playerEffects[0].damage, 2, 'ordinary armor retains its existing poison-contact rule');
    contactGs.playerEffects = [];
    contactGs.relicEffects = { poisonImmunity: true };
    contactController.processEnemyAttack(spider, 0);
    assert.deepEqual(contactGs.playerEffects, []);

    const revival = fixture(), revivalGs = revival.gameState;
    const revivalSpider = enemy(revival, 100, buildEnemyCardFromDef('spider', 1));
    revival.cardSystem.boardCards = [revivalSpider];
    revivalGs.playerHealth = 1;
    revivalGs.villageEffects = { templeRevive: true };
    new CombatTurnController(revival).processEnemyAttack(revivalSpider, 0);
    assert.equal(revivalGs.secondWindUsed, 1);
    assert.ok(revivalGs.playerHealth > 0);
    assert.deepEqual(revivalGs.playerEffects, [], 'the reviving blow cannot add fresh poison afterward');

    const headless = fixture(), headlessGs = headless.gameState;
    headlessGs.playerHealth = 1000;
    headlessGs.maxHealth = 1000;
    const headlessSpider = enemy(headless, 100, buildEnemyCardFromDef('spider', 1));
    const headlessScorpion = enemy(headless, 200, buildEnemyCardFromDef('stingerScorpion', 1));
    headless.cardSystem.boardCards = [headlessSpider, headlessScorpion];
    headless.runEnemyTurn();
    assert.equal(headlessGs.playerEffects[0].damage, 3, 'headless Spiders and Scorpions work together');
    assert.equal(headlessGs.playerEffects[0].turns, 2, 'poison ticks once at the end of the phase');
    const poisonSave = new SaveManager();
    poisonSave.saveCurrentRun(headlessGs, headless.inventorySystem, headless.cardSystem);
    assert.equal(poisonSave.loadCurrentRun().effects.playerEffects[0].damage, 3);

    const webbing = fixture();
    webbing.inventorySystem.slots.push({ type: 'food', actions: 5 });
    webbing.inventorySystem._liveDrag = { slotIndex: 0 };
    const silkslinger = enemy(webbing, 100, buildEnemyCardFromDef('silkslinger', 1));
    webbing.cardSystem.boardCards = [silkslinger];
    const webController = new CombatTurnController(webbing);
    webController.processEnemyAttack(silkslinger, 0);
    assert.equal(webbing.inventorySystem.slots.filter(item => item.webbedTurns > 0).length, 1);
    assert.equal(webbing.inventorySystem.slots[1].webbedKind, 'web');
    webController.tickHandWebs();
    assert.equal(webbing.inventorySystem.slots.filter(item => item.webbedTurns > 0).length, 0);
} finally { Math.random = randomBeforeContact; }
assert.equal(strengthenPlayerPoison({ playerEffects: [{ type: 'poison', damage: 2, turns: 0 }] }), null);
console.log('Silkdeep checks passed: all-act roster/boss, shared sigils, Spider/Scorpion synergy, poison defenses and saves, one-card web, local rewards, gem support, bombs, magic and enchantment.');
