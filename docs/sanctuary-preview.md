# Forgotten Court preview

Open **Test Site → Statue Sanctuary** in Developer mode. The normal village,
run setup and permanent upgrades are unchanged.

Four guardians form a half-circle around a central Phoenix:

| Statue | Proposed role |
|---|---|
| Fanged Guardian (lion) | Weapon damage |
| Shelled Sentinel (turtle) | +1 DEF (shield) per restoration |
| Deep Toad | Maximum health |
| Trinket Keeper (bird) | Starting amulet and its quality |
| Phoenix | Once-per-run resurrection at 50% HP |

The Phoenix becomes available after every guardian has at least one
restoration. Its own restoration has one rank. Other statues have five.
The preview begins with 60 points. Guardians use the existing 2/3/5/8/12
rank-cost ladder as provisional tuning; the Phoenix costs 7 points.

Select a statue, then click Restore. Restorations show the village rank stars and a brief
lifting/settling effect. Reset Preview starts over. Preview state survives a
return to the Test Site during the same app session, but is held in memory:
no real Support, permanent ranks, run save or combat bonuses are changed.

The background illustration fills the room without the battle HUD frame or
inventory footer. Each statue displays its short bonus underneath; the shared
description rectangle has been removed. Restoration stars show bought ranks.

## Art

Runtime sprites live in `assets/art/sanctuary/`, at 128x128 with bottom-centred
origins. The Phoenix has a separate damaged sprite. The other unrestored
statues use a muted tint until matching damaged versions are supplied. For
replacement states, keep the same canvas, pedestal position and silhouette
alignment so restoration does not make the statue jump sideways.

The Phoenix came from PixelLab Create Object; its four candidates and complete
prompt are in `output/art-concepts/forgotten-court-phoenix/phoenix/`. The four
other guardians reuse the approved Forgotten Court concepts.

## Sigil Room panel

All Sigil Rooms now use stone-panel candidate 02. Its transparent outer padding
was trimmed into `assets/art/sigilStamps/stonePanel.png`; the original candidate
is preserved. Nine-slice insets are left/right 16, top 14 and bottom 22. The
chipped corners and pedestal retain their size while the dark slate face grows
to fit the emblem, title and rule. The old transparent rectangle is removed.

## Verification

- Unlock gate, rank costs/caps, insufficient points and resets: `node tools/test-sanctuary-preview.mjs`.
- Browser: actual Test Site entry, all four guardian clicks, locked Phoenix,
  Phoenix restoration, Back, re-entry and Reset; real save data unchanged.
- Sigil Room: stone rendering, text fit across English/Spanish/French/Russian,
  and dragging a real weapon onto the moved slab successfully adds Mending.
- Screenshots and browser scripts: `output/qa-sanctuary-preview/` and
  `output/qa-sigil-panel/`.
