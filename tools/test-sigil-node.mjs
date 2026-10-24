import assert from 'node:assert/strict';
import { MapGenerator, MAP_ROWS, floorOfRow, rowOfFloor, isBonusRow, onBossRow } from '../src/map/MapGenerator.js';

// Every act gets at least one Sigil Room on an ordinary row of the road, never in the first rooms or at the
// boss's door, and two reward rows that sit between floors: they hold no fight, are flanked by fights, and
// leave the act 15 floors long, boss on floor 15.
const runs = 200;
let sigils = 0;
let capBroken = 0;
let acts = 0;
for (let r = 0; r < runs; r++) {
    const map = new MapGenerator().generateFullMap();
    for (const act of ['act1', 'act2', 'act3']) {
        acts++;
        const floors = map[act].floors;
        const last = floors.length - 1;
        assert.equal(floors.length, MAP_ROWS);

        // Reward rows.
        const bonus = floors.map((row, f) => (isBonusRow(floors, f) ? f : -1)).filter((f) => f >= 0);
        assert.equal(bonus.length, 2, `${act} run ${r} has two reward rows`);
        for (const f of bonus) {
            assert.ok(f >= 4 && f <= 12, `reward row ${f} is in the middle of the act`);
            assert.ok(floors[f].every((n) => n.bonus && !['COMBAT', 'ELITE', 'BOSS'].includes(n.type)), 'reward rows hold no fight');
            for (const side of [f - 1, f + 1]) {
                assert.ok(floors[side].every((n) => n.type === 'COMBAT' || n.type === 'BOSS'), 'a reward row is flanked by fights');
            }
        }
        // Only the last row is the boss row (rows 14 and 15 used to be, when an act was 15 rows).
        const gs = { dungeonMap: map, mapCursor: { act: Number(act.slice(3)), floor: 0, node: 0 } };
        for (let row = 0; row <= last; row++) {
            gs.mapCursor.floor = row;
            assert.equal(onBossRow(gs), row === last, `row ${row} is ${row === last ? '' : 'not '}the boss row`);
        }
        // Floors: the boss is floor 15 and a reward row shares its predecessor's floor.
        assert.equal(floorOfRow(floors, last), 15);
        for (const f of bonus) assert.equal(floorOfRow(floors, f), floorOfRow(floors, f - 1));
        for (let floor = 1; floor <= 15; floor++) assert.equal(floorOfRow(floors, rowOfFloor(floors, floor)), floor);

        // Sigil Rooms on ordinary rows.
        const ordinary = [];
        floors.forEach((row, f) => row.forEach((node) => { if (node?.type === 'SIGIL' && !node.bonus) ordinary.push(f); }));
        assert.ok(ordinary.length >= 1, `${act} run ${r} has a sigil room on an ordinary row`);
        for (const f of ordinary) assert.ok(f >= 3 && f <= last - 3, `sigil room on row ${f} is inside its window`);
        sigils += ordinary.length;

        // Rooms in a row without a fight, kept to 2 (a rare map may fail it when every room in the chain is a guarantee).
        const run = floors.map((row) => row.map(() => 0));
        let broken = false;
        floors.forEach((row, f) => row.forEach((n, i) => {
            if (!n?.type || ['COMBAT', 'ELITE', 'BOSS'].includes(n.type)) return;
            let best = 0;
            if (f > 0) floors[f - 1].forEach((p, pi) => { if (p.connections.includes(i)) best = Math.max(best, run[f - 1][pi]); });
            run[f][i] = 1 + best;
            if (run[f][i] > 2) broken = true;
        }));
        if (broken) capBroken++;
    }
}
assert.ok(capBroken / acts < 0.005, `the no-fight run cap held on ${acts - capBroken} of ${acts} acts`);
console.log(`Sigil node checks passed: ${runs} maps, ${sigils} sigil rooms on ordinary rows, two reward rows per act, floors still 15, cap held on ${acts - capBroken}/${acts} acts.`);
