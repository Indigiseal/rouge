// The Ogre's Gauntlet comes down as an open hand (Taya): palm on the target
// and a cell to each side, the thumb one more to the right, short fingers on
// the row behind. Nothing else on the board is touched.
import assert from 'node:assert/strict';
import { gauntletHandTargetIndices } from '../src/content/cards/weapons.js';

// A 5x4 board of face-up enemies; r 0 is the far row, r 3 nearest the player.
const board = [];
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 5; c++) {
    board.push({ revealed: true, data: { type: 'enemy', health: 5, brick: { r, c } } });
  }
}
const at = (c, r) => board.findIndex((card) => card.data.brick.c === c && card.data.brick.r === r);
const cells = (indices) => indices.map((i) => `${board[i].data.brick.c},${board[i].data.brick.r}`).sort();

// Target at column 1, row 2.
assert.deepEqual(cells(gauntletHandTargetIndices(board, at(1, 2))), [
  '0,1', '1,1', '2,1', // fingers
  '0,2', '2,2', // palm
  '3,2', // thumb, on the right
].sort());

// At the board's right edge the thumb and a palm side fall off the board.
assert.deepEqual(cells(gauntletHandTargetIndices(board, at(4, 0))), ['3,0']);

// Face-down and dead enemies under the hand are left alone.
board[at(0, 1)].revealed = false;
board[at(2, 1)].data.health = 0;
assert.deepEqual(cells(gauntletHandTargetIndices(board, at(1, 2))), ['0,2', '1,1', '2,2', '3,2']);

// A boss room: the boss owns the far row (r 0), summons stand below it in
// lanes (r 1). A blow on a summon reaches the boss with its fingers; a blow on
// the boss reaches nothing behind it.
const bossRoom = [
  { revealed: true, data: { type: 'boss', health: 80, alwaysBackline: true, brick: { r: 0, c: 0 } } },
  ...[-2, -1, 1, 2].map((c) => ({ revealed: true, data: { type: 'enemy', health: 5, brick: { r: 1, c } } })),
];
const lane = (c) => bossRoom.findIndex((card) => card.data.brick.r === 1 && card.data.brick.c === c);
const onSummon = gauntletHandTargetIndices(bossRoom, lane(-1));
assert.ok(onSummon.includes(0), 'the fingers reach the boss');
assert.ok(onSummon.includes(lane(-2)) && onSummon.includes(lane(1)), 'palm and thumb on the summons');
assert.deepEqual(gauntletHandTargetIndices(bossRoom, 0), [], 'a blow on the boss reaches nothing behind it');

console.log('gauntlet hand: ok');
