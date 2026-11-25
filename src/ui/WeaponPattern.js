// The shape a weapon hits in, drawn as a few small cubes for its tooltip:
// the struck enemy in red, the ones its blow carries into in orange. A sword
// is three in a row, an axe a cross, a mace an X, a spear a column going away
// from the player, the Ogre Gauntlet an open hand (Taya). The geometry itself
// lives in content/cards/weapons.js; this only pictures it.
import { translateDescription } from '../i18n/i18n.js';
import { GAUNTLET_DESCRIPTION, isGauntlet } from '../content/balance/Gauntlet.js';

const CUBE = 5;
const GAP = 1;
const TARGET_COLOR = 0xb51f1e;
const SPLASH_COLOR = 0xef7c4b;
const EMPTY_COLOR = 0x8a7a66;

// Cells on a 3x3 grid, [column, row], row 0 the far row (away from the player).
const CENTRE = [1, 1];
// Each pattern sits on a 3x3 grid unless it gives its own size.
const PATTERNS = Object.freeze({
  single: { target: CENTRE, hits: [] },
  cleave: { target: CENTRE, hits: [[0, 1], [2, 1]] },
  cross: { target: CENTRE, hits: [[1, 0], [0, 1], [2, 1], [1, 2]] },
  diagonal: { target: CENTRE, hits: [[0, 0], [2, 0], [0, 2], [2, 2]] },
  // The spear's target stands nearest the player; the thrust goes on behind it.
  pierce: { target: [1, 2], hits: [[1, 1], [1, 0]] },
  // The gauntlet's hand (GAUNTLET_HAND_CELLS): fingers on the far row, the
  // palm either side of the target, the thumb out to the right.
  hand: { cols: 4, rows: 2, target: [1, 1], hits: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [3, 1]] },
});

/** Which pattern a weapon card hits in (a key of PATTERNS). */
export function weaponPatternKind(weapon) {
  if (!weapon || weapon.type !== 'weapon') return null;
  if (isGauntlet(weapon)) return 'hand';
  switch (weapon.special) {
    case 'cleave': return 'cleave';
    case 'specialAttack': return 'cross';
    case 'crush': return 'diagonal';
    case 'pierce':
    case 'reach': return 'pierce';
    default: return 'single';
  }
}

/** The weapon's special, in words, for the tooltips. Empty when it has none. */
export function weaponSpecialText(scene, weapon) {
  if (isGauntlet(weapon)) return translateDescription(scene, GAUNTLET_DESCRIPTION);
  const special = weapon?.special || '';
  if (special === 'dualWield') return translateDescription(scene, 'dual wield');
  if (special === 'cleave') return translateDescription(scene, 'cleave: half damage to adjacent enemies while AP remains');
  if (special === 'pierce' || special === 'reach') return translateDescription(scene, 'piercing: half damage to enemies behind target while AP remains');
  if (special === 'throwing') return translateDescription(scene, 'hits any enemy');
  if (special === 'block' && weapon.weaponType !== 'bow') return translateDescription(scene, 'can block');
  if (special === 'specialAttack') return translateDescription(scene, 'heavy cleave while AP remains; executes wounded non-boss enemies');
  if (special === 'crush') return translateDescription(scene, 'crushing: ignores armor and hits diagonal enemies for half damage while AP remains');
  return special;
}

/**
 * The pattern as a Graphics object with its top-left at 0,0, or null for a
 * weapon that only ever hits its target (nothing to show). Its size, for
 * laying a tooltip out around it, is on it as patternWidth / patternHeight.
 */
export function createWeaponPattern(scene, weapon) {
  const kind = weaponPatternKind(weapon);
  if (!kind || kind === 'single' || !scene?.add?.graphics) return null;
  const { target, hits, cols = 3, rows = 3 } = PATTERNS[kind];
  const g = scene.add.graphics();
  g.patternWidth = cols * CUBE + (cols - 1) * GAP;
  g.patternHeight = rows * CUBE + (rows - 1) * GAP;
  const at = ([c, r]) => [c * (CUBE + GAP), r * (CUBE + GAP)];
  const cells = [...Array(rows).keys()].flatMap((r) => [...Array(cols).keys()].map((c) => [c, r]));
  for (const cell of cells) {
    const [x, y] = at(cell);
    g.lineStyle(1, EMPTY_COLOR, 0.6);
    g.strokeRect(x + 0.5, y + 0.5, CUBE - 1, CUBE - 1);
  }
  g.fillStyle(SPLASH_COLOR, 1);
  for (const cell of hits) {
    const [x, y] = at(cell);
    g.fillRect(x, y, CUBE, CUBE);
  }
  const [tx, ty] = at(target);
  g.fillStyle(TARGET_COLOR, 1);
  g.fillRect(tx, ty, CUBE, CUBE);
  return g;
}
