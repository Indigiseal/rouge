// Where a boss's summons stand: one row below the boss, in lanes either side
// of it (lane 0, under the boss, is left clear for its HP/ATK strip). A summon
// in lane n sits at board cell { r: 1, c: n }, the boss at { r: 0, c: 0 }.
import { cameraWorldSize } from '../../config/renderScale.js';

export const BOSS_SUMMON_LANES = Object.freeze([-1, 1, -2, 2, -3, 3]);
const LANE_STEP = 76;

/** Every summon lane as { r, c, x, y } for this boss card. */
export function bossSummonSeats(scene, bossCard) {
    if (!bossCard?.sprite) return [];
    const { height: camH } = cameraWorldSize(scene.cameras.main);
    const y = Math.min(camH - 125, bossCard.sprite.y + 102) - 6;
    return BOSS_SUMMON_LANES.map((lane) => ({ r: 1, c: lane, x: bossCard.sprite.x + lane * LANE_STEP, y }));
}
