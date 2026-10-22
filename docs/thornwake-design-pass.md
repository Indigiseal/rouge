# Thornwake: first playable identity pass

The user selected Thornwake next and approved this creature roster on
2026-10-21. Identity: a hunting pack supported by companions, with thorns
and reflected attacks punishing attackers. Existing sprites and IDs remain.

## Local sigils

| Sigil | Player rule |
| --- | --- |
| Thorns | Worn armor retaliates for 1 damage against each actual attack. |
| Mirror | Worn armor reflects the first damaging enemy attack each fight. |
| Kinship | Unchanged: weapons in the adjacent bag slots deal +1 damage. |
| Companion Strength | Each intact carried/worn equipment card with this sigil gives damaging companions +1 damage. |
| Pack Strength | This weapon deals +1 damage for each companion in the bag. |
| Hunter | Unchanged: x1.5 against the enemy hit by the previous attack. |
| Outnumbered | Unchanged: +1 damage per revealed living enemy. |

Thorns is now a normal armor-only sigil and occupies a normal sigil slot.
The Briar Room offers it to armor, refusing incompatible or full cards.
Previously saved Briar weapon bonuses are preserved. The separate consumable
Thorns card retains its existing melee-only rules.

Armor Thorns works on ranged attacks, blocks, reflections and dodges; skipped
attacks do not trigger it. The armor's final pip still retaliates. Retaliation
cannot reflect recursively. A webbed companion still counts for Pack Strength
because it remains in the bag, but does not gain an extra turn or lose its web.
Web-spinning companions keep their existing non-damaging action.

## Creatures and boss

| Creature | Rule |
| --- | --- |
| Wolf | Pack Strength: +1 ATK per other revealed living ally. |
| Thorn Ent | Thorns: retaliates for 1 on a connecting weapon hit. |
| Thorn Sprite | Plain melee creature. Ranged immunity removed. |
| Spore Archer | Plain ranged creature. Spore debuff removed. |
| Thorn Fairy | Companion Strength: other revealed living allies gain +1 ATK; no self-buff. Hiding removed. |
| Green Warden | Thorns replaces regeneration. Existing wolf summons retained. |

Hidden/dead creatures and Boneflood bone piles do not supply pack/aura bonuses.
Multiple Fairies add their bonuses. ATK labels refresh on revealing, hiding,
summoning and killing allies, including elite enemies.

## Magic

Briar Shield reflects the next two damaging enemy attacks, including ranged
and boss attacks, and prevents their on-hit effects. Poison ticks and skipped
attacks do not consume charges. Bone Shield resolves first and preserves
reflection charges. Briar Shield then resolves before Mirror/amulet reflection.
Charges are saved with the run and shown in the effects panel.

The Reliquary's rare Briar Guard enchantment has a 15% on-hit chance to ready
one reflection. Repeated procs do not stack charges or reduce an existing two.
Briar Guard is an enchantment marker, separate from the armor-only Mirror sigil.

The existing unused shield frame (index 2) supplies provisional normal and
glowing art. The current deer stamp stands in for the planned thorn-antlered
deer. New sigils use existing placeholder icon frames. User artwork is pending.

## Validation and playtest

`npm run test:thornwake` covers local rewards, stamp mapping, shared sigils,
pack/aura damage, companion attacks, unchanged Kinship, last-pip/ranged armor
retaliation, reflection priority, poison prevention, spell consumption,
enchantment charges and save compatibility. Shared Boneflood, combat, inventory,
any-act and simulator regression checks remain applicable.

Follow-up review: boss hover ATK now uses the same live calculation as the
card and attack, including ally bonuses and Sapping. Mirror's spent charge
and readied Riposte survive Continue; older saves default safely. Briar Shield
reflection feedback names the spell instead of incorrectly saying Mirror.
The focused checks cover a spent Mirror across a save/load, its reset on the
next fight, Riposte persistence, and boosted/weakened boss hover values.

Start a fresh Thornwake board to test the new creatures; existing saved boards
retain their serialized abilities. Check that revealing/killing a Fairy changes
the other creatures' displayed ATK. Test armor Thorns against an Archer, and
Briar Shield against several attackers. Balance values need human playtesting.

Leadership Banner is now implemented as a rare globally droppable amulet with
Thornwake flavor and provisional horn art. Each companion that acted has a 10%
chance to act once more, with no chaining and normal holds, cooldowns and target
selection. Live and headless companion attack paths share its chance calculation.
Completion callbacks explicitly report whether the companion acted, so immediate
timers cannot suppress the effect. New Warcry and Tandem rewards are retired;
legacy sigils keep working. The focused suite checks the exact proc boundary,
no chaining, web/freeze/shock skips, removal, save compatibility and both attack
paths. Other location-flavored amulets remain follow-ups.
