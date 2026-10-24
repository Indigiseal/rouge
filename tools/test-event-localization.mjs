import assert from 'node:assert/strict';
import fs from 'node:fs';
import { t, translateDescription, translateItemName, translateTemplate } from '../src/i18n/i18n.js';
import goblin from '../src/content/events/goblin_engineer.js';
import armWrestling from '../src/content/events/arm_wrestling.js';
import reliquary from '../src/content/events/reliquary.js';
import { openSigilOffer } from '../src/ui/SigilOffer.js';
import { getBossAbilityLines } from '../src/ui/ItemTooltip.js';

globalThis.Phaser ??= { Scene: class {} };
const { EventScene } = await import('../src/scenes/EventScene.js');

const source = JSON.parse(fs.readFileSync(new URL('../docs/localization/stories-runtime-to-translate.json', import.meta.url)));
const translated = JSON.parse(fs.readFileSync(new URL('../docs/localization/stories-runtime-translated.json', import.meta.url)));
assert.deepEqual(translated.map(row => row.id), source.map(row => row.id));
const matches = (text, pattern) => [...text.matchAll(pattern)].map(match => match[0]);
for (const language of ['es', 'fr', 'ru']) {
    const scene = { game: { language } };
    for (let i = 0; i < source.length; i++) {
        const en = source[i].en;
        const result = translated[i][language];
        assert.equal(translateDescription(scene, en), result, `runtime story ${source[i].id} ${language} is wired`);
        assert.deepEqual(matches(result, /\n+/g), matches(en, /\n+/g), 'paragraph breaks');
        assert.deepEqual(matches(result, /\{\w+\}/g).sort(), matches(en, /\{\w+\}/g).sort(), 'placeholders');
        assert.deepEqual(matches(result, /\d+/g), matches(en, /\d+/g), 'numbers');
        const filled = translateTemplate(scene, en, { card: 'TEST_CARD', magic: 'TEST_MAGIC', weapon: 'TEST_WEAPON' });
        assert(!/\{(?:card|magic|weapon)\}/.test(filled), 'dynamic item names are inserted');
    }
    for (const name of ['Toll Collector', 'Veteran Toll Collector', 'Silk Cocoon', 'Poisoned Soup',
        'Crystal Spider Egg', 'Unknown Enemy', 'your card', 'the card']) {
        assert.notEqual(translateItemName(scene, name), name, `${language} name ${name}`);
    }
    // Exercise actual assembled descriptions: translating only the whole English result fails.
    for (const boxState of ['following', 'exploded']) for (const boxHasCog of [false, true]) {
        const text = goblin.description({ storyRun: { boxState, boxHasCog } }, scene);
        assert(!/A goblin|Snatch Box|No cog|You found its heart cog/.test(text), text);
    }
    for (const rematch of [false, true]) {
        const text = armWrestling.description({}, { ...scene, isArmWrestleRematch: () => rematch,
            getArmWrestleCrowdLine: () => source.find(row => row.en.startsWith('A few of them stop chewing')).en });
        assert(!/The ogre is|An ogre sits|A few of them/.test(text), text);
    }
    for (const hasWeapon of [false, true]) for (const offers of [[], ['fireRune', 'lightningRune']]) {
        const eventScene = { ...scene, hasEnchantableWeapon: () => hasWeapon, getReliquaryOffer: () => offers };
        const text = reliquary.description({}, eventScene);
        assert(!/The corridor ends|Drag a weapon|You have no weapon|\{\w+\}/.test(text), text);
        const outcome = reliquary.choices({}, eventScene).find(choice => choice.id === 'reliquary_leave').outcome({}, eventScene);
        assert(!/You leave the wall|Behind you|Fire Rune|Lightning Rune|\{names\}/.test(outcome), outcome);
    }
    let message;
    EventScene.prototype._mirrorFloat.call({ ...scene,
        gameScene: { createFloatingText: (x, y, text) => { message = text; } },
    }, "The mirror won't copy that", 0, { x: 1, y: 2 });
    assert.notEqual(message, "The mirror won't copy that");
    for (const notice of ['No hidden weapons', 'No hidden potions', 'No hidden gems', 'Weapon revealed', 'Potion revealed', 'Gem revealed']) {
        assert.notEqual(t(scene, notice), notice);
    }
    const growth = getBossAbilityLines(scene, { sigils: [{ id: 'growth' }], growthPerAttack: 3 });
    assert(growth.includes(t(scene, 'tooltip.enemyGrowth', { amount: 3 })), 'Growth uses its real amount');
    assert.equal(t(scene, 'ui.card.bonePileReforms', { amount: 1 }).split('\n').length, 2);
    const texts = [];
    // Fluent display objects are sufficient here: inspect text passed to the actual panel builder.
    const displayObject = { scene };
    for (const method of ['setDepth', 'setStrokeStyle', 'setInteractive', 'setOrigin', 'on']) {
        displayObject[method] = () => displayObject;
    }
    const panelScene = { ...scene, textures: { exists: () => false }, add: {
        rectangle: () => displayObject,
        text: (x, y, text) => { texts.push(text); return displayObject; },
    } };
    assert(openSigilOffer(panelScene, { inventorySystem: { slots: [{ type: 'weapon', rarity: 'common', sigils: [] }] } }, 'growth'));
    assert(texts.includes(t(scene, 'ui.sigilOffer.title')));
    assert(texts.includes(t(scene, 'ui.sigilOffer.chooseCard')));
    assert(texts.includes(t(scene, 'ui.tutorial.skip')));
}
console.log(`Event localization passed: ${source.length} runtime passages, composed stories, notices, names, Growth, bone label and sigil headings in es/fr/ru.`);
