# Location amulets: identity follow-through

These items reinforce their origin location but remain in the global drop pool.
Current art is reused until the user supplies replacement sprites.

Tactician's Pin now uses the actual `tacticianPin` battle image (`assets/art/pin.png`)
in offers, equipped icons and saved-item presentation, replacing its compass.
Its hidden-enemy marker lifts 22 pixels, plunges 4 pixels past its resting point,
rebounds 2 pixels and settles over 410 ms. It waits for its card to land, follows
card movement through an animated offset, plays once per marker and cancels on
reveal/removal. Scout rules and amulet effects are unchanged.
`npm run test:tactician-pin` covers presentation, animation endpoints and cleanup.

| Item | Stable ID | Origin | Rule |
| --- | --- | --- | --- |
| Goblin's Ransom | `monocle` | Tollroad | 3% chance for one crystal per defeated enemy. Reuses Monocle's existing kill-reward implementation; its previous 10% becomes the approved 3%. |
| Goblin's Spyglass | `goblinSpyglass` | Tollroad | 15% chance after a damaging weapon hit to reveal one safe face-down card for free. |
| Bone Hook | `vacancyStep` | Boneflood | Close Order's existing once-per-floor hook and enemy clustering behavior, unchanged. |
| Bone Spool | `boneSpool` | Boneflood | Discarding a card restores 1 pip to a random remaining damaged weapon or armor, including worn armor. |
| Dune Quiver | `duneQuiver` | Sandreach | +1 damage to bows only. |
| Mossy Stone | `mossyStone` | Mireturn (Bog) | Each successful card merge grants +1 maximum HP, capped at +50 per run, without healing. |
| Sandspice Pouch | `travelKitchen` | Sandreach | Food restores 50% more AP, rounded down. Reuses the former Travel Kitchen. |
| Emberstone | `runeOfFire` | Ashhowl | Fire-gem splash radius ×1.5. |
| Molten Heart | `greaterRuneOfFire` | Ashhowl | +20% fire-gem damage, rounded up. |
| Storm Shard | `runeOfZap` | Stormhatch | Lightning gems reach one additional enemy. |
| Tempest Heart | `greaterRuneOfZap` | Stormhatch | +20% lightning-gem damage, rounded up. |
| Spider Fang | `runeOfPoison` | Silkdeep | Poison gems also poison one nearby enemy. |
| Broodmother's Fang | `greaterRuneOfPoison` | Silkdeep | +2 poison-gem tick damage. |

Ransom and Spyglass use the standard uncommon floor-10 drop band, weight 5.
Bone Hook retains its rare floor-16 drop band and weight 4. No location gating
is introduced. Ransom reuses the existing monocle art; Spyglass uses the existing
magnifying-glass frame; Bone Hook keeps the existing grappling-hook frame and
animation. Identity metadata is shared by definitions, drop/offer presentation
and save refresh, so renaming does not create duplicate items or replay equip effects.

Spyglass preserves Scout's existing exclusions: revealed cards, enemies, bosses,
traps, mimics and tutorial-dormant cards are ineligible. No eligible card means
no reveal. Its free reveal uses normal board behavior and does not spend AP.
A legacy Scout sigil and Spyglass share one 15% roll rather than doubling reveals.
Missed/zero-damage hits do not roll. Removing the amulet removes its effect.

New Scout and Ransom sigil rewards are retired. Existing saved Scout weapons
retain 15% safe reveal; existing Ransom weapons retain their old 10% crystal rule.
The 3% rule belongs to the amulet. Ransom uses normal enemy-death handling, so
poison/burn/companion kills can also pay, and stale death callbacks cannot pay twice.
The shared crystal-reward label now reads Crystal find, since multiple existing
amulets can contribute to that path.

`npm run test:location-amulets` checks safe targets, exact proc boundaries,
zero-damage hits, removal, legacy compatibility, actual kill rewards, duplicate
death callbacks, shared saved names and global drop entries. Existing Sandglass
Scarab and location suites remain regression checks.

Bone Spool and Dune Quiver are uncommon, floor 10, weight 5, in survival and
offense respectively. Bone Spool's bone-scroll art is provisional; Dune Quiver
now uses the existing quiver at atlas frame 73. Both remain
global drops. Bone Spool's first playtest rule is guaranteed 1-pip repair per
deliberately discarded card, including gems. Consumption, breakage and merging
do not trigger it. The discarded card is excluded even before removal; broken
and full items are ineligible, worn/bag duplicates count once, and no eligible
target means no reward. It uses the same repair eligibility as Mending.

Dune Quiver adds its damage to bows in normal weapon combat, including extra
attacks. Spears and other ranged weapons do not qualify; the bonus follows bow
identity rather than reach or range. It does not boost spells, reflection or companions.
Carried weapon numbers and hover damage include the bonus. Neither amulet
rewrites base stats or grants an equip-time bonus, so reloading cannot duplicate
their effects. Tests exercise an actual drag discard and scene reward hook,
normal weapon hits, displayed damage, removal and saved-name refresh.

The six former gem runes now use location-specific names. Their art, effect
values, rarity, drop weights and stable IDs are unchanged. Runtime definitions,
offers and saved items use the same presentation metadata. Existing elemental
enchants and Hermit Wizard replacement rules still use the original IDs.
Localized names are supplied for Spanish, French, Russian and German. Tests
verify shared names, old-save name refresh and unchanged gem bonuses.

Mossy Stone replaces Marrow's old kill-based proposal with the user's approved
merge rule. It awards once per successful two-card merge, for weapons, armor,
potions, food and thorns, including merges into worn armor. Preview construction,
failed merges, kills, discarded cards and item consumption award nothing.
It is a global uncommon survival drop (floor 10, weight 5), with provisional
grey-green standing-stone art (frame 5). Current HP never rises with the effect. Earned maximum HP and the
`mossyMaxHpGained` counter persist through removal, re-equipping and Continue;
the cap is +50 for the entire run. Older runs default their counter to zero.
Live and simulator merge commits share the same amulet hook.
`npm run test:mossy-stone` exercises real merge transactions and Continue,
the full cap, removal/re-equipping, and all merge families.

Sandreach's Feast follow-through reuses the retired Travel Kitchen as Sandspice
Pouch, keeping its stable `travelKitchen` ID and existing pale-pouch art (frame 74),
and 50%-more-food-AP rule. It returns to global uncommon drops from floor 10,
weight 5, magic group. There is only one definition/drop identity for it. Existing
owners receive the new name and remain excluded from duplicate offers. Food
bonuses round down and still respect maximum AP. Sandglass Scarab continues
to give exactly +1 maximum AP per meal; Mossy Stone does not trigger on eating.
The shared manager applies the same food bonus in live play and simulator food
consumption. Focused tests cover actual food use, the AP cap, removal, saved
owners, drop eligibility and Scarab synergy.

Existing names/effects also have explicit origin metadata where the identity is
already clear: Keeper's Ward (Boneflood), Vampire Fang and Siren's Perfume
(Veilbleed), Plague Heart (Silkdeep), Leadership Banner (Thornwake), and Mask of
Embers (Ashhowl). They remain global drops with unchanged mechanics and art.
Shared presentation keeps their names consistent in saved items and offers.

Boneflood weapon transformation is explicitly deferred by the user. Still open:
final sprites and playtesting. Frost Echo now has its approved half-damage
extra-hit implementation; the unplaced Honed/Crushing/Keen/Combo sigils remain
separate design decisions.
