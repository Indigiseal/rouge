// Which boards a location's rooms are drawn on. A location listed here swaps
// all three pieces; any other location keeps the shared ones.
//
//   main       the fight / boss board (gamingBoard, 366x304)
//   slice      its nine-slice insets: the band between them is what repeats
//              when a big formation grows the board, so it must be plain
//   sideSmall  the side panel events and stations show their picture on
//              (gamingBoardSideSmall, 208x144 frames; a custom one is a
//              single image)
//   sideExtra  the wing that slides out behind a wide board (200x206)
//
// Tollroad (Taya, PixelLab): crude goblin planks tied with rope.
// Mireturn: a frame of bog roots. Thornwake: a frame wrapped in thorn vines.
// Their side panels are the same board with the middle cut out, so corners
// and edges keep their pixels.
// Silkdeep: grey-purple cave stone hung with cobwebs, to match its background;
// its side panels are cut from a thin PixelLab frame in the same style.
import { getLocationIdForFloor } from './index.js';
import { BOARD_PANEL_KEY, BOARD_PANEL_SLICE } from '../../ui/NineSlicePanel.js';

export const DEFAULT_BOARD_ART = Object.freeze({
  main: BOARD_PANEL_KEY,
  slice: BOARD_PANEL_SLICE,
  sideSmall: 'gamingBoardSideSmall',
  sideSmallFrame: null, // the caller's own frame (brown 0 / purple 1)
  sideExtra: 'gamingBoardSideExtra',
});

export const LOCATION_BOARD_ART = Object.freeze({
  tollroad: Object.freeze({
    main: 'gamingBoardTollroad',
    // Plain plank between the rope ties across, clear of ropes and iron
    // brackets down the sides.
    slice: Object.freeze({ left: 150, right: 146, top: 110, bottom: 154 }),
    sideSmall: 'gamingBoardSideSmallTollroad',
    sideSmallFrame: 0,
    sideExtra: 'gamingBoardSideExtraTollroad',
  }),
  mireturn: Object.freeze({
    main: 'gamingBoardMireturn',
    slice: Object.freeze({ left: 150, right: 150, top: 120, bottom: 150 }),
    sideSmall: 'gamingBoardSideSmallMireturn',
    sideSmallFrame: 0,
    sideExtra: 'gamingBoardSideExtraMireturn',
  }),
  silkdeep: Object.freeze({
    main: 'gamingBoardSilkdeep',
    slice: Object.freeze({ left: 150, right: 150, top: 120, bottom: 150 }),
    sideSmall: 'gamingBoardSideSmallSilkdeep',
    sideSmallFrame: 0,
    sideExtra: 'gamingBoardSideExtraSilkdeep',
  }),
  thornwake: Object.freeze({
    main: 'gamingBoardThornwake',
    slice: Object.freeze({ left: 150, right: 150, top: 120, bottom: 150 }),
    sideSmall: 'gamingBoardSideSmallThornwake',
    sideSmallFrame: 0,
    sideExtra: 'gamingBoardSideExtraThornwake',
  }),
});

// Files for the asset manifest.
export const LOCATION_BOARD_FILES = Object.freeze([
  { key: 'gamingBoardTollroad', path: 'assets/art/boards/tollroadBoard.png' },
  { key: 'gamingBoardSideSmallTollroad', path: 'assets/art/boards/tollroadSideSmall.png' },
  { key: 'gamingBoardSideExtraTollroad', path: 'assets/art/boards/tollroadSideExtra.png' },
  { key: 'gamingBoardMireturn', path: 'assets/art/boards/mireturnBoard.png' },
  { key: 'gamingBoardSideSmallMireturn', path: 'assets/art/boards/mireturnSideSmall.png' },
  { key: 'gamingBoardSideExtraMireturn', path: 'assets/art/boards/mireturnSideExtra.png' },
  { key: 'gamingBoardSilkdeep', path: 'assets/art/boards/silkdeepBoard.png' },
  { key: 'gamingBoardSideSmallSilkdeep', path: 'assets/art/boards/silkdeepSideSmall.png' },
  { key: 'gamingBoardSideExtraSilkdeep', path: 'assets/art/boards/silkdeepSideExtra.png' },
  { key: 'gamingBoardThornwake', path: 'assets/art/boards/thornwakeBoard.png' },
  { key: 'gamingBoardSideSmallThornwake', path: 'assets/art/boards/thornwakeSideSmall.png' },
  { key: 'gamingBoardSideExtraThornwake', path: 'assets/art/boards/thornwakeSideExtra.png' },
]);

/**
 * The boards for the room the player is in. Falls back piece by piece to the
 * shared art when a location's texture did not load.
 */
export function boardArtFor(scene, gameState = scene?.gameState) {
  const own = LOCATION_BOARD_ART[getLocationIdForFloor(gameState)];
  if (!own) return DEFAULT_BOARD_ART;
  const has = (key) => Boolean(scene?.textures?.exists?.(key));
  return {
    main: has(own.main) ? own.main : DEFAULT_BOARD_ART.main,
    slice: has(own.main) ? own.slice : DEFAULT_BOARD_ART.slice,
    sideSmall: has(own.sideSmall) ? own.sideSmall : DEFAULT_BOARD_ART.sideSmall,
    sideSmallFrame: has(own.sideSmall) ? own.sideSmallFrame : null,
    sideExtra: has(own.sideExtra) ? own.sideExtra : DEFAULT_BOARD_ART.sideExtra,
  };
}
