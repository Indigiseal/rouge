# Crowded board expansion investigation

## Implemented follow-up

Combat expansion now uses `src/ui/BoardPanel.js`: nine source regions are
composed into a single cached canvas texture. The four corner regions stay at
native size, and the edge/interior bands repeat native pixels instead of
stretching location ornaments. The resulting scene object is one Image, like
the ordinary board. Combat no longer attaches legacy side-extra wings.

`ELITE` now follows the existing `COMBAT` reinforcement policy: a maximum of
15 initial cards, then bounded waves. A 26-card encounter still owes all 26
cards (15 + 6 + 5). Boss summons retain their existing rules.

Restore testing also exposed checkpoints capturing entry/hover animation
positions. Board serialization now prefers each card's settled `restX/restY`
seat, with sprite coordinates retained as a fallback for older card objects.

Validation:

- `tools/test-board-expansion.mjs` checks all 11 board styles at native size,
  2-pixel expansion, crowded width, and expansion on both axes, in WebGL and
  Canvas. An independent per-pixel oracle verifies the copied corners and
  repeating strips. It also checks one scene object, clean rebuilds, unchanged
  source frames, and COMBAT/ELITE reinforcement serialization.
- Isolated GameScene verification covered all ten locations in both room
  types, restored the remaining 11 cards, and delivered both waves without
  clearing the room prematurely. Forced 426x304 growth used one Image and no
  wings. No browser errors. Audio was disabled only in this rendering fixture.
- The 36 existing test suites passed; the save/restore regression suite also
  covers settled positions during card entrances.

Evidence: `output/qa-board-investigation/fix-verification.json`,
`elite-fixed-15-plus-waves.png`, `forced-expansion-fixed.png`, and each
`*-expanded-fixed.png` native-versus-expanded comparison.

The audit below records the previous implementation. Its exact reported
corner-in-the-middle artifact was not reproduced; the distorted stretch bands
and overcrowded elite layouts were reproduced and the affected growth path
has now been replaced.

## What renders the board

`src/systems/board/BoardLayout.js:createFloorBoardPanel` measures the card
formation. At native size it uses one main board image. When the formation is
wider or taller, it calls `createNineSlicePanel` and draws nine named regions
from the main board image. It does not use the side-panel image as its middle.

There are two separate side assets:

- `sideSmall`: illustration panels for events/stations. Not combat expansion.
- `sideExtra`: the legacy sliding wings behind a plain main board. The combat
  layout explicitly suppresses these for a grown nine-slice board.

No wing was created in the forced crowded-layout reproductions below.

## Confirmed problems

### Elite rooms bypass the visible-card cap

`src/content/balance/Reinforcements.js` currently applies the 15-card cap only
to `COMBAT`. `ELITE` bypasses that rule. `FloorSpawner.spawnFloorCards` can thus
deal 26 elite-room cards at once. `computePlacement` retains full-size 52x70
cards but reduces horizontal spacing to fit the same fixed play area. At nine
columns, cards overlap. Expanding the backing board does not expand the safe
area between the hero/HUD and the combat log.

Reproduced in an isolated browser running the actual GameScene: an elite room
with 26 generated cards uses a 426x304 main board at the game's 2x render scale.
Its wings count is zero. Cards overlap horizontally and reach beneath the
combat log. The main board's bottom extends beneath the independently drawn
inventory frame, so both frames can be visible around that overlap.

Evidence: `output/qa-board-investigation/sandreach-elite26.png` and
`elite-layouts.json`. The location label/background still says Thornwake because
the fixture changes the combat location without restarting its HUD/backdrop;
the dealt enemies and board are Sandreach, which uses the shared board art.

### Location-board stretch bands contain decorative pixels

The default board's selected stretch bands are safe: 45 columns contain one
distinct source column, and 107 rows contain one distinct source row. Those
bands can stretch without changing their texture.

The four custom boards use textured/decorated bands rather than identical
rows/columns. For example, Tollroad's 70-column band contains 70 distinct columns;
Silkdeep's 66-column band contains 65. The renderer stretches those variations,
so planks, roots and stone detail become elongated. This is a visual quality
issue, but does not explain a misplaced corner on the default board.

Evidence: `source-slices.png`, `band-variation.json` and the per-location
`*-expanded.png` WebGL comparisons under `output/qa-board-investigation/`.

## What passed / what remains unconfirmed

- Existing `tools/test-board-rendering.mjs` passed all five default-board sizes
  in both WebGL and Canvas, comparing actual pixels against independently
  composed source slices.
- Native-versus-expanded WebGL comparisons were inspected for all five styles.
- Actual GameScene was exercised at 2x scale for 6/10/13/16 requested regular
  cards. The reinforcement cap held the last case at 15 visible cards, so those
  cases correctly remained native-size boards.
- Forced 16/20/26-card layouts exercised actual growth for every style, repeated
  cleanup/rebuilds, entrance animation and camera post-processing. Boards became
  406/414/426 pixels wide. No side wings or browser errors appeared.
- Real elite-room generation was exercised at 16 and 26 cards. Overlapping
  cards/HUD were reproduced; an actual corner moved into the middle was not.

No production code or user artwork was changed in this investigation. The exact
misplaced-corner report remains open; a screenshot and the URL/build being
tested would distinguish an overlap from a different running renderer.

Recommended follow-up: apply the visible-card policy to elite rooms, account
for the board frame and inventory/HUD safe bounds when placing cards, then
choose genuinely repeatable stretch bands for the decorated location boards.
