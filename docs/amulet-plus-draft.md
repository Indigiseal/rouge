# "+" amulets: draft for Taya and Petr

**Status: draft, nothing here is in the game yet** except the first two rows marked *done*.

## The rule

Finding an amulet you already wear upgrades it to its "+" version. The "+" keeps the same name with a "+"
("Ring of Regeneration+") and the same art, with a small "+" badge on the fight bar icon. A "+" is never
dropped or sold: the only way to get one is to find the plain amulet again. Once you have the "+", the
plain one stops being offered. Code: `src/content/amulets/amuletPlus.js`.

Rule of thumb used below: a "+" is about **1.5x** the plain effect, not double. The player has already been
paid once by the first copy. Amulets that only switch something on get **no "+"**: once owned, they stop
being offered, as today.

Please mark each row ✔ (keep), ✘ (no "+"), or write a different number.

## Common

| Amulet | Now | "+" draft | Notes |
|---|---|---|---|
| Ring of Regeneration | +8 HP each combat floor, +1 every 3 floors | +12 HP, +1 every 2 floors | *done* (was the Ring of Greater Regeneration) |
| Tactician's Pin | Marks 1 face-down enemy at combat start | Marks **2** | |
| Forced March | The first back-row ranged enemy swaps to the front | The first **two** | |
| Hand Mirror | 5% chance to reflect an attack | **no "+"** | The Mirror Twin story turns it into the Twinned Mirror; that is its upgrade |

## Uncommon

| Amulet | Now | "+" draft | Notes |
|---|---|---|---|
| Cartographer's Ink | Sees much further through the map's fog | No fog at all | *done* (was Oracle's Eye) |
| Pouch of Greed | +20% gold | **+35%** | |
| Goblin's Ransom | 3% crystal per kill | **5%** | |
| Goblin's Spyglass | 15% to reveal a safe face-down card on a hit | **25%** | |
| Bone Spool | Discarding repairs 1 pip | Repairs **2** pips | |
| Mossy Stone | +1 max HP per merge, up to +50 a run | **+2** per merge, still up to +50 | Gets there faster, same ceiling |
| Dune Quiver | +1 bow damage | **+2** | |
| Sandspice Pouch | Food gives 50% more AP | **75%** more | |
| Emberstone | Fire gem splash radius x1.5 | **x2** | |
| Storm Shard | Lightning gems bounce to 1 more enemy | **2** more | |
| Spider Fang | Poison gems also poison 1 nearby enemy | **2** nearby | |
| Quickstep Charm | +1 max AP | **no "+"**? | A "+" would be +2 AP, which is exactly Heart of Hours (rare). Either no "+", or accept the overlap |
| Heartblood Vial | Potions heal 25% more | **40%** more | |
| Wayfarer's Lamp | 1 face-down card turns over at fight start | **2** cards | |
| Gilded Leaf | Shop pays 50% more for sales | **80%** more | |
| Looking Glass | Secret rooms show 1 floor earlier | **2** floors earlier | |
| Trapwise Boots | Traps deal half damage | Traps deal a **quarter** | |

## Rare

| Amulet | Now | "+" draft | Notes |
|---|---|---|---|
| Vampire Fang | Heal 15% of damage dealt | **22%** | |
| Dragon Claw | +15% damage | **+22%** | |
| Molten Heart | +20% fire gem damage | **+30%** | Stacks with the Gloves |
| Tempest Heart | +20% lightning gem damage | **+30%** | Stacks with the Gloves |
| Broodmother's Fang | +2 poison gem tick damage | **+3** | |
| Mask of Hollow Whispers | 25% a kill leaves a card | **40%** | |
| Siren's Perfume | 15% enemies attack their own kind (charm) | **22%** | This is the charm amulet now that the Marks are gone |
| Bone Hook | Once, pulls scattered enemies together | **no "+"** | A one-off trick; "twice" adds little |
| Keeper's Ward | 30% not to spend durability | **45%** | |
| Heart of Hours | +2 max AP | **+3** | |
| Sandglass Scarab | +1 max AP per food, up to +10 a run | Up to **+15** | Same speed, higher ceiling |
| Leadership Banner | Companions 10% to act again | **18%** | |
| Veteran's Carryall | +1 bag slot | **+2** slots | |
| Starfall Pendant | +5% crit chance | **+8%** | |
| Sapphire Brooch | Twice as many elite rewards are Sigil Rooms | **no "+"** | On/off |
| Mask of Embers | Enemies that hurt you take 2 fire damage | **3** | |
| Blood Signet | Crits deal x1.8 instead of x1.5 | **x2.1** | |

## Legendary

Finding the same legendary twice will be very rare, so these "+" versions matter little either way.

| Amulet | Now | "+" draft | Notes |
|---|---|---|---|
| Gloves of the Hermit Wizard | +25% all gem damage (stacks with gem amulets) | **+35%** | |
| General's Glasses | Once per act, pick any room on the next floor | **Twice** per act | |
| Plague Chalice | A poisoned enemy explodes for 10 on death | **15** | |

## Not covered

Story amulets (the Twinned Mirror, Porter's Map, Alchemist Bag, Robber's Bedroll, Toll Writ and others)
are never dropped, so the "find it again" rule does not touch them.

## Taya's decisions (2026-10-25)

- **Quickstep Charm:** Heart of Hours is no longer offered. Quickstep Charm gets a "+" (+2 max AP), so
  finding it twice gives what Heart of Hours gave.
- **Question 1 (offer worn amulets more often):** no.
- **Question 3 (sim the survival ones once agreed):** yes.

## Open questions

1. **How often:** finding a specific amulet twice is rare. Should an amulet you wear be offered a little
   more often, so "+" upgrades actually happen?
2. **Quickstep Charm:** no "+", or a "+" that matches Heart of Hours?
3. **Balance:** the numbers above are first guesses at ~1.5x. The balance sim can check the ones that change
   survival (Vampire Fang, Keeper's Ward, Heart of Hours, Veteran's Carryall) once they are agreed.
