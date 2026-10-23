import assert from 'node:assert/strict';
import { SANCTUARY_GUARDIANS, freshSanctuaryPreview, phoenixUnlocked,
    previewRestoration } from '../src/content/sanctuary/preview.js';

const state = freshSanctuaryPreview();
const original = structuredClone(state);
assert.equal(phoenixUnlocked(state.ranks), false);
assert.equal(previewRestoration(state, 'phoenix').locked, true);
assert.deepEqual(state, original, 'a dormant Phoenix spends no points');
for (const guardian of SANCTUARY_GUARDIANS.slice(0, 3)) {
    assert.equal(previewRestoration(state, guardian.id).ok, true);
    assert.equal(phoenixUnlocked(state.ranks), false, 'all four guardians are required');
}
assert.equal(previewRestoration(state, SANCTUARY_GUARDIANS[3].id).awakened, true);
assert.equal(state.points, original.points - 8);
assert.equal(previewRestoration(state, 'phoenix').ok, true);
assert.equal(state.points, original.points - 8 - 7, 'Phoenix restoration costs seven points');
const afterPhoenix = structuredClone(state);
assert.equal(previewRestoration(state, 'phoenix').maxed, true);
assert.deepEqual(state, afterPhoenix);
const notEnoughForPhoenix = { points: 6, ranks: { lion: 1, turtle: 1, toad: 1, bird: 1, phoenix: 0 } };
assert.equal(previewRestoration(notEnoughForPhoenix, 'phoenix').ok, false);
assert.equal(notEnoughForPhoenix.points, 6);
const poor = freshSanctuaryPreview();
poor.points = 1;
assert.equal(previewRestoration(poor, 'lion').ok, false);
assert.equal(poor.ranks.lion, 0);
const full = freshSanctuaryPreview();
for (let i = 0; i < 5; i++) assert.equal(previewRestoration(full, 'lion').ok, true);
assert.equal(previewRestoration(full, 'lion').maxed, true);
assert.deepEqual(freshSanctuaryPreview(), original, 'reset creates fresh independent state');
assert.deepEqual(previewRestoration(state, 'missing'), { ok: false });
console.log('Sanctuary preview passed: four-guardian gate, one revival rank, costs, caps, insufficient points and independent resets.');
