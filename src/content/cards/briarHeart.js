// The Heart of the Briars: Thornwake's secret room (map/HiddenPaths.js,
// source 'briarHeart'). Where the briars come from: a heart of root and thorn
// that grows while it lives, guarded by thorn sprites and calling more. Beaten,
// it gives the Heartwood sigil, found nowhere else (GameScene.rewardBriarHeart).
//
// Art: row 12 of enemiesSpriteSheet (PixelLab, option E picked by Taya;
// source in assets/_sources/briar-heart-pixellab/), on Thornwake's card faces.
// Off every roster, so it is never dealt onto an ordinary board.
import { enemyCardPresentation } from '../assets/enemyCards.js';

export const BRIAR_HEART_ROSTER = Object.freeze({
  MELEE: Object.freeze(['briarHeart']),
  RANGED: Object.freeze([]),
});

/** What PreloadScene composites the card from, like a location pack. */
export const BRIAR_HEART_SHEET = Object.freeze({ id: 'briarHeart', enemies: BRIAR_HEART_ROSTER });

export const BRIAR_HEART_DEFS = Object.freeze({
  briarHeart: Object.freeze({
    name: 'Heart of the Briars',
    ...enemyCardPresentation('briarHeart', BRIAR_HEART_ROSTER, 'briarHeart'),
    role: 'MELEE',
    archetype: 'bruiser',
    abilities: [],
    // It pricks what strikes it, and grows with every lash: kill it quickly.
    sigils: [{ id: 'thorns' }, { id: 'growth' }],
    // As an elite it calls thorn sprites out of the walls (FloorSpawner.summonForElite).
    summons: 'thornSprite',
    briarHeart: true,
  }),
});
