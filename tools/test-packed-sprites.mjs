import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import { PACKED_SHEETS, buildPackedSprites } from '../src/content/assets/packedSprites.js';

// The sheets are up to date with their source PNGs (python tools/pack-sprites.py --check).
const check = spawnSync('python', ['tools/pack-sprites.py', '--check'], { encoding: 'utf8' });
assert.equal(check.status, 0, `packed sprites are out of date: run "python tools/pack-sprites.py"\n${check.stdout}${check.stderr}`);

const spec = JSON.parse(readFileSync(new URL('./packed-sprites.json', import.meta.url), 'utf8'));
const packedKeys = [];
for (const sheet of PACKED_SHEETS) {
    const entry = ASSET_MANIFEST.find((asset) => asset.key === sheet.key);
    assert.ok(entry && entry.type === 'spritesheet' && entry.path === sheet.path, `${sheet.key} is preloaded as a spritesheet`);
    assert.deepEqual([entry.frameWidth, entry.frameHeight], [sheet.frameWidth, sheet.frameHeight]);
    const png = readFileSync(new URL('../' + sheet.path, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const frames = (png.readUInt32BE(16) / sheet.frameWidth) * (png.readUInt32BE(20) / sheet.frameHeight);
    for (const e of sheet.entries) {
        assert.ok(e.frame < frames, `${e.key} sits on the sheet`);
        assert.ok(!ASSET_MANIFEST.some((asset) => asset.key === e.key), `${e.key} is no longer loaded as a loose image`);
        packedKeys.push(e.key);
    }
}
assert.equal(new Set(packedKeys).size, packedKeys.length, 'one frame per key');
assert.equal(packedKeys.length, spec.sheets.reduce((n, s) => n + s.entries.length, 0));
for (const key of ['trap', 'thornsCard', 'chickCompanionUP', 'mimic', 'fireBall1', 'fireBall4']) assert.ok(packedKeys.includes(key), key);

// Boot cuts each frame back into its old key, at the original size, once.
const textures = new Map(PACKED_SHEETS.map((s) => [s.key, {}]));
const drawn = [];
const scene = { textures: {
    exists: (k) => textures.has(k),
    createCanvas: (k, w, h) => { textures.set(k, { w, h }); return { drawFrame: (...a) => drawn.push([k, ...a]), refresh() {} }; },
} };
const built = buildPackedSprites(scene);
assert.equal(built, packedKeys.length);
for (const sheet of PACKED_SHEETS) for (const e of sheet.entries) {
    assert.deepEqual([textures.get(e.key).w, textures.get(e.key).h], [e.width, e.height], `${e.key} keeps its size`);
    assert.ok(drawn.some(([k, from, frame]) => k === e.key && from === sheet.key && frame === e.frame));
}
assert.equal(buildPackedSprites(scene), 0, 'a second call builds nothing');
assert.equal(buildPackedSprites({ textures: { exists: () => false } }), 0, 'sheets that did not load leave everything alone');
console.log(`Packed sprite checks passed: ${PACKED_SHEETS.length} sheets, ${packedKeys.length} sprites, sizes kept, sheets up to date.`);
