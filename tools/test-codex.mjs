import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { AMULETS, RETIRED_ACTIVE_AMULETS } from '../src/content/cards/amulets.js';
import { getAmuletAtlasPresentation } from '../src/content/amulets/RelicsOthersAtlas.js';
import { MAGIC } from '../src/content/cards/magic.js';
import { ENEMIES, SUMMON_ONLY_ENEMY_TYPES } from '../src/content/cards/enemies.js';
import { PLAYABLE_LOCATION_IDS } from '../src/content/locations/catalog.js';
import { SIGILS } from '../src/content/sigils/sigils.js';
import { InventorySystem } from '../src/systems/InventorySystem.js';
import { CODEX_STORAGE_KEY, CODEX_KINDS, isDiscovered, noteDiscovered, noteCardDiscovered, clearDiscoveries } from '../src/content/codex/Discoveries.js';

globalThis.Phaser.Scene = class {};
const { CodexScene } = await import('../src/scenes/CodexScene.js');
const stored = new Map([[CODEX_STORAGE_KEY, JSON.stringify({ sigils: { tsunami: true, ripple: true }, amulets: { monocle: true }, enemies: { snowOwl: true } })]]);
globalThis.localStorage = { getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
assert.ok(isDiscovered('sigils', 'scorched'), 'old Tsunami discovery follows its rename');
assert.ok(isDiscovered('sigils', 'fireball'), 'old Ripple discovery follows its rename');
assert.ok(isDiscovered('amulets', 'monocle'), 'stable amulet ID keeps its discovery');
assert.ok(isDiscovered('enemies', 'frozenKnight'), 'replaced Frost creatures retain discoveries');
assert.ok(CODEX_KINDS.includes('magic'));
assert.equal(isDiscovered('magic', 'thunderclap'), false, 'old profiles gain an empty magic section');

const codex = new CodexScene();
codex.game = { globalLanguage: 'en' };
let amulets = codex.amuletEntries();
for (const item of AMULETS) assert.ok(amulets.some(entry => entry.id === item.id), `offerable amulet ${item.id} appears`);
for (const id of ['boneSpool', 'mossyStone', 'duneQuiver', 'travelKitchen', 'gluttonsCharm', 'tacticiansPin', 'runeOfZap', 'monocle']) {
    const entry = amulets.find(entry => entry.id === id), art = getAmuletAtlasPresentation(id);
    assert.equal(entry.name, art.name);
    assert.equal(entry.texture, art.sprite);
    assert.equal(entry.frame, art.spriteFrame);
    assert.ok(entry.info.length > 5);
}
assert.equal(amulets.find(entry => entry.id === 'duneQuiver').info, '+1 damage to bows.');
assert.match(amulets.find(entry => entry.id === 'mossyStone').info, /50/);
assert.equal(amulets.find(entry => entry.id === 'tacticiansPin').texture, 'tacticianPin');
assert.equal(amulets.find(entry => entry.id === 'monocle').known, true);
assert.ok(!amulets.some(entry => entry.id === 'regeneration'), 'undiscovered obsolete items are hidden');
for (const id of RETIRED_ACTIVE_AMULETS) assert.ok(!amulets.some(entry => entry.id === id));
noteDiscovered('amulets', 'regeneration');
noteDiscovered('amulets', 'provisionersBell');
amulets = codex.amuletEntries();
assert.ok(amulets.find(entry => entry.id === 'regeneration').known, 'discovered legacy story amulets remain readable');
assert.ok(amulets.find(entry => entry.id === 'provisionersBell').known);

const enemies = codex.enemyEntries();
assert.equal(enemies.length, Object.keys(ENEMIES).filter(id => !SUMMON_ONLY_ENEMY_TYPES.has(id)).length);
for (const location of PLAYABLE_LOCATION_IDS) assert.ok(enemies.some(entry => entry.locationId === location), location);
const locationIndexes = enemies.map(entry => PLAYABLE_LOCATION_IDS.indexOf(entry.locationId)).filter(i => i >= 0);
assert.deepEqual(locationIndexes, [...locationIndexes].sort((a, b) => a - b));
const knight = enemies.find(entry => entry.id === 'frozenKnight');
assert.ok(knight && knight.silhouette, 'new Frost creatures have sheet silhouettes');
assert.ok(!codex.bossEntries().some(entry => /Act \d boss/.test(entry.info)), 'location bosses are no longer fixed to an act');
assert.match(codex.bossEntries().find(entry => entry.id === 'giantSkeleton').info, /Boneflood/);
assert.ok(!codex.sigilEntries().some(entry => SIGILS[entry.id].retired));
noteDiscovered('sigils', 'charm');
assert.ok(codex.sigilEntries().find(entry => entry.id === 'charm').known);
noteCardDiscovered({ type: 'enemy', enemyType: 'legacySpider', abilities: [{ type: 'poison' }] });
assert.ok(isDiscovered('enemies', 'legacySpider'));
assert.ok(isDiscovered('sigils', 'venom'), 'enemy ability icons count as discovered sigils');
noteCardDiscovered({ type: 'enemy', enemyType: 'testSigilCarrier', sigils: [{ id: 'tsunami' }] });
assert.ok(isDiscovered('sigils', 'scorched'));

assert.equal(codex.entriesFor('magic').length, MAGIC.length);
noteCardDiscovered({ type: 'magic', magicType: 'thunderclap' });
assert.ok(codex.magicEntries().find(entry => entry.id === 'thunderclap').known);
assert.match(codex.magicEntries().find(entry => entry.id === 'boneWall').info, /Blocks the next 2/);
for (const sandboxMode of [false, true]) {
    clearDiscoveries();
    const scene = new MockScene(); scene.sandboxMode = sandboxMode;
    const inventory = { scene, slots: [null], addCardDirect(data, slot) { this.slots[slot] = data; }, updateTwinkleEffects() {} };
    assert.equal(InventorySystem.prototype.addCard.call(inventory, { type: 'magic', magicType: 'desertFeast' }), true);
    assert.equal(isDiscovered('magic', 'desertFeast'), !sandboxMode, 'story rewards count only outside the Test Site');
}
const values = {};
codex.infoName = { setText: value => { values.name = value; } };
codex.infoText = { setText: value => { values.info = value; } };
codex.setInfo({ known: false, name: 'Secret', info: 'Secret rule' });
assert.equal(values.name, '???');
assert.equal(values.info, 'Not found yet.');
{
    const scene = new MockScene(), calls = [];
    const factory = scene.add;
    scene.add = { image: (...args) => { calls.push(args); return factory.image(...args); },
        text: (...args) => factory.text(...args), rectangle: (...args) => factory.rectangle(...args) };
    scene.textures = { exists: () => true, get: key => ({ has: () => key !== 'tacticianPin' }) };
    scene.listView = { add() {} };
    const tab = { cell: { w: 76, h: 70 }, box: { w: 44, h: 44 } };
    CodexScene.prototype.addCell.call(scene, amulets.find(entry => entry.id === 'tacticiansPin'), 40, 64, tab);
    assert.equal(calls[0][2], 'tacticianPin');
    assert.equal(calls[0].length, 3, 'standalone pin uses its base frame instead of missing atlas frame 0');
    CodexScene.prototype.addCell.call(scene, amulets.find(entry => entry.id === 'duneQuiver'), 120, 64, tab);
    assert.equal(calls[1][3], getAmuletAtlasPresentation('duneQuiver').spriteFrame);
}
clearDiscoveries();
assert.ok(CODEX_KINDS.every(kind => !isDiscovered(kind, 'anything')));
console.log('Codex checks passed: current amulets/art/rules, legacy discoveries, all locations, magic rewards, hidden entries and renamed sigils.');
