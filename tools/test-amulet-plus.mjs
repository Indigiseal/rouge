// "+" amulets (content/amulets/amuletPlus.js): finding an amulet you wear upgrades
// it to its "+"; the "+" is never dropped; the gloves stack with the gem amulets;
// the retired Marks are gone.
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { AMULET_PLUS, isPlusAmulet, plusIdFor } from '../src/content/amulets/amuletPlus.js';
import { AMULETS } from '../src/content/cards/amulets.js';
import { translateItemName } from '../src/i18n/i18n.js';

const scene = new MockScene();
scene.gameState = new GameState(scene);
scene.cardSystem = new CardSystem(scene);
scene.amuletManager = new AmuletManager(scene);
scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
scene.inventorySystem = { slots: [], slotSprites: [] };
scene.tutorialMode = true;
const mgr = scene.amuletManager;
const gen = scene.cardSystem.cardDataGenerator;
scene.gameState.activeAmulets = [];
scene.gameState.currentFloor = 12;

for (const [base, plus] of Object.entries(AMULET_PLUS)) {
    assert.ok(mgr.amuletDefinitions[plus], `${plus} is defined`);
    assert.equal(mgr.amuletDefinitions[plus].name, `${mgr.amuletDefinitions[base].name}+`, `${plus} shows as the plain name with a plus`);
    assert.equal(mgr.amuletDefinitions[plus].spriteFrame, mgr.amuletDefinitions[base].spriteFrame, `${plus} wears the plain amulet's art`);
    assert.ok(!AMULETS.some(a => a.id === plus), `${plus} is never dropped`);
    assert.ok(isPlusAmulet(plus) && !isPlusAmulet(base));
}

// Taking the ring once, then again: it becomes Ring of Regeneration+.
assert.equal(mgr.addAmulet('ringOfRegeneration'), true);
assert.equal(mgr.upgradesToPlus('ringOfRegeneration'), true);
assert.equal(mgr.canAddAmulet('ringOfRegeneration'), true, 'a worn ring can be taken again to upgrade');
assert.ok(gen.getAmuletsOfRarity('common', 12, scene.gameState).some(a => a.id === 'ringOfRegeneration'),
    'a worn ring with a "+" to become is still offered');
assert.equal(mgr.addAmulet('ringOfRegeneration'), true);
assert.deepEqual(scene.gameState.activeAmulets.map(a => a.id), [plusIdFor('ringOfRegeneration')], 'the plain ring is replaced by its "+"');
assert.equal(mgr.canAddAmulet('ringOfRegeneration'), false, 'nothing past the "+"');
assert.ok(!gen.getAmuletsOfRarity('common', 12, scene.gameState).some(a => a.id === 'ringOfRegeneration'),
    'once upgraded, the plain ring is no longer offered');

// Names translate as the plain name plus the "+".
const fakeScene = { game: { language: 'es' } };
const es = translateItemName(fakeScene, 'Ring of Regeneration+');
assert.ok(es.endsWith('+') && es !== 'Ring of Regeneration+', `translated with its plus (${es})`);

// The gloves stack with a typed gem amulet: Molten Heart +20%, then gloves +25%.
scene.gameState.activeAmulets = [];
mgr.addAmulet('greaterRuneOfFire');
mgr.addAmulet('glovesOfHermitWizard');
assert.deepEqual(scene.gameState.activeAmulets.map(a => a.id).sort(), ['glovesOfHermitWizard', 'greaterRuneOfFire'], 'the gloves keep the rune');
assert.equal(mgr.modifyGemDamage(10, 'fire'), 15, '10 x1.2 = 12, x1.25 = 15');

// The Marks are retired.
for (const id of ['markOfHesitation', 'markOfTreachery', 'twinMarks', 'collarOfBinding']) {
    assert.equal(mgr.amuletDefinitions[id], undefined, `${id} is retired`);
}
console.log('Amulet "+": a worn amulet found again becomes its "+", which is never dropped and translates; gloves stack; Marks retired.');
