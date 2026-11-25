// A merge keeps what the player put on the card: gems in both sockets, the
// enchant, sigils. Merged here as the Copying Mirror leaves them, two identical
// copies. The Ogre's Gauntlet took a shortcut that rebuilt it bare, and a
// merged gauntlet lost its gems and enchant (Taya saw a gem vanish).
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CardMergeRules } from '../src/systems/inventory/CardMergeRules.js';
import { createGauntletCard } from '../src/content/balance/Gauntlet.js';
import { createWeaponCardData } from '../src/content/cards/weapons.js';
import { carryEnchantToWeapon } from '../src/content/balance/WeaponEnchants.js';

const scene = new MockScene();
scene.gameState = new GameState(scene);
scene.cardSystem = new CardSystem(scene);
const rules = Object.assign(Object.create(CardMergeRules), { scene });
const copy = (card) => JSON.parse(JSON.stringify(card));

const dressed = (card) => {
  Object.assign(card, {
    gemEffect: 'lightning', gemName: 'Lightning Gem', gemCount: 1,
    gem2Effect: 'fire', gem2Name: 'Fire Gem', gem2Count: 1,
    sigils: [{ id: 'twinSocket', level: 1 }],
  });
  carryEnchantToWeapon(card, 'frostRing');
  return card;
};

for (const [label, make] of [
  ['gauntlet', () => createGauntletCard('uncommon')],
  ['sword', () => createWeaponCardData('sword', 'uncommon')],
]) {
  const original = dressed(make());
  const merged = rules.createMergedCard(original, copy(original));
  assert.equal(merged.rarity, 'rare', `${label}: one rarity up`);
  assert.equal(merged.gemEffect, 'lightning', `${label}: keeps its gem`);
  assert.ok(merged.gemCount >= 1, `${label}: gem count`);
  assert.equal(merged.gem2Effect, 'fire', `${label}: keeps its second gem`);
  assert.equal(merged.enchant, 'frostRing', `${label}: keeps its enchant`);
  assert.ok((merged.sigils || []).some((s) => s.id === 'twinSocket'), `${label}: keeps its sigil`);
}
// The gauntlet is still a gauntlet.
assert.equal(rules.createMergedCard(createGauntletCard('rare'), createGauntletCard('rare')).id, 'ogreGauntlet');

console.log('merge keeps gems, enchant, sigils: ok');
