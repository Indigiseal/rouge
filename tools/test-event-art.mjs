import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EVENTS } from '../src/content/events/index.js';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';

// EventScene extends a Phaser class; a stub is enough to read its picture table.
globalThis.Phaser ??= { Scene: class {}, Math: {}, Geom: {}, Display: {}, GameObjects: {} };
const { EVENT_ILLUSTRATION_FRAMES } = await import('../src/scenes/EventScene.js');

const entry = ASSET_MANIFEST.find((asset) => asset.key === 'eventsShops');
assert.deepEqual([entry.frameWidth, entry.frameHeight], [80, 80]);
const png = readFileSync(new URL('../' + entry.path, import.meta.url));
const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
const frames = (width / 80) * (height / 80);

// Every story has a picture of its own choosing, and it is on the sheet.
const stillDefault = EVENTS.filter((event) => EVENT_ILLUSTRATION_FRAMES[event.id] === undefined).map((event) => event.id);
assert.deepEqual(stillDefault, [], `stories with no picture: ${stillDefault.join(', ')}`);
for (const [id, frame] of Object.entries(EVENT_ILLUSTRATION_FRAMES)) {
    assert.ok(Number.isInteger(frame) && frame >= 0 && frame < frames, `${id} frame ${frame} is on the ${frames}-frame sheet`);
}

// The stories added with PixelLab Create Object each have their own frame.
const added = ['mirror_twin', 'abandoned_camp', 'old_chute', 'soup_stand', 'robbed_traveller', 'lost_porter',
    'porter_party_argument', 'reliquary', 'webbed_corridor'];
assert.equal(new Set(added.map((id) => EVENT_ILLUSTRATION_FRAMES[id])).size, added.length, 'one frame each');
console.log('Event art checks passed: every story has a picture, on the sheet; nine new frames.');
