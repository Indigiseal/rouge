import assert from 'node:assert/strict';
import { offerableSigils, rollOfferableSigil, canOfferSigil } from '../src/ui/SigilOffer.js';
import { LOCATION_SIGIL_POOLS, sigilPoolForLocation } from '../src/content/sigils/locationSigils.js';
import { WORKING_PLAYER_SIGILS } from '../src/content/sigils/sigils.js';

const bone = ['ironclad', 'warding', 'tempered', 'mending', 'riposte', 'sunder'];
const weapon = () => ({ type: 'weapon', name: 'Sword', damage: 5, durability: 3, maxDurability: 5 });
function fixture(act = 1) {
    const slots = [weapon()];
    const ids = [null, null, null];
    ids[act - 1] = 'boneflood';
    return {
        gameState: { currentFloor: (act - 1) * 15 + 1, actLocationIds: ids, storyRun: {} },
        inventorySystem: { slots },
    };
}

assert.deepEqual(LOCATION_SIGIL_POOLS.boneflood, bone);
assert.equal(sigilPoolForLocation('not-yet-redesigned'), WORKING_PLAYER_SIGILS);
const originalRandom = Math.random;
try {
    for (const act of [1, 2, 3]) {
        const scene = fixture(act);
        Math.random = () => { throw new Error('eligibility must not consume RNG'); };
        assert.deepEqual(offerableSigils(scene), bone);
        for (let i = 0; i < bone.length; i++) {
            Math.random = () => (i + 0.5) / bone.length;
            assert.equal(rollOfferableSigil(scene), bone[i]);
        }
    }

    const taken = fixture();
    taken.gameState.storyRun.sigilsTaken = ['ironclad', 'mending'];
    taken.inventorySystem.slots[0].sigils = [{ id: 'sunder' }];
    assert.deepEqual(offerableSigils(taken), ['warding', 'tempered', 'riposte']);

    const full = fixture();
    full.inventorySystem.slots[0].sigils = [{ id: 'cutpurse' }, { id: 'bounty' }];
    assert.deepEqual(offerableSigils(full), [], 'normal equipment sigil caps remain in force');
    assert.equal(rollOfferableSigil(full), null, 'a full card must not cause a global-pool fallback');

    const wornOnly = fixture();
    wornOnly.inventorySystem.slots = [];
    wornOnly.gameState.equippedArmor = { type: 'armor', durability: 3, maxDurability: 5 };
    assert.deepEqual(offerableSigils(wornOnly), ['tempered'], 'worn armor remains eligible according to existing card-fit rules');

    const exhausted = fixture();
    exhausted.gameState.storyRun.sigilsTaken = bone;
    assert.deepEqual(offerableSigils(exhausted), []);
    assert.equal(rollOfferableSigil(exhausted), null);

    const explicit = fixture();
    assert.equal(canOfferSigil(explicit, 'crystalBrood'), true,
        'named special-event rewards are not restricted by the ambient location pool');
    assert.ok(!offerableSigils(explicit).includes('crystalBrood'));

    const other = fixture();
    other.gameState.actLocationIds[0] = 'mireturn';
    assert.deepEqual(offerableSigils(other), ['regenerate', 'unscathed', 'growth'], 'Bog uses its own healing/growth pool');

    console.log('Local sigil checks passed: Boneflood in every act, compatible equipment, taken sigils, exhausted pools, explicit event rewards, and RNG-free eligibility.');
} finally { Math.random = originalRandom; }
