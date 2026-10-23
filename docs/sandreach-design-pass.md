# Sandreach: first playable pass

Sandreach is the provisional sand lizardfolk location, available in every act.
It owns archery, food and action-point momentum. Ordinary food still drops in
all locations. Taya's lizardfolk enemy row and two-pose boss art are wired.
Names, stamp and room art remain provisional; the deer stamp and existing
room fallbacks remain in use.

## Player sigils

| Sigil | Starting rule |
| --- | --- |
| Second Wind | Existing 10% chance after a damaging hit to restore 2 AP, capped at maximum AP. |
| Sandstorm | Existing `daze` save ID; 20% chance after a damaging hit for the struck non-boss to miss its next attack. |
| Archer Bane | x1.5 weapon damage against a ranged enemy. |
| Well Fed | x1.5 weapon damage when starting the attack at full AP. |
| Forage | 10% chance after a damaging hit to create ordinary food in an empty board space. |
| Quick Strike | 10% chance after a damaging hit to strike the same surviving enemy once more, without another AP or pip cost. |

All six fit weapons, not armor. Normal sigil caps and taken-sigil exclusions apply.
Damage multipliers round down separately and can combine. Well Fed snapshots AP
before paying the action cost; a free off-hand strike shares that snapshot.
Second Wind therefore cannot retroactively enable Well Fed for the current action.

Quick Strike copies that swing's resolved attack damage through ordinary target
validation, armor, dodge, gem, enchantment and death handling. Other on-hit sigils
can fire on the extra hit, but Quick Strike cannot chain from itself. It cannot
retarget after a kill or attack loot, bone piles or cocoons. Each dagger in a
dual-wield action can roll its own sigil after its own damaging hit. Special
cleave/pierce attacks are not repeated as additional player actions.

Forage uses the ordinary base-tier food generator. It places a revealed food
card on the board for normal pickup/merging/eating, without requiring free bag
space. A full board, occupied boss lane, completed/transitioning fight or station
never gets overwritten. Boss rooms use available summon lanes. A failed spawn
is simply a missed opportunity; no deferred inventory reward is created.

## Approved roster and boss

| Creature | Abilities |
| --- | --- |
| Glass Scarab | Plain melee swarm creature. |
| Dune Forager | Forage: leaves ordinary food in its own board space when defeated. |
| Sand Skirmisher | Quick Strike: 10% chance after dealing damage to attack once more. |
| Lizard Archer | Plain ranged attacker. |
| Sandcaller | Ranged; Sandstorm: 20% chance after dealing damage to make the player miss one weapon attack. |
| Sandscale Chieftain | Quick Strike, Sandstorm, and a 25% chance to summon one Lizard Archer. |

The boss's native act-2 values are 167 HP and 17 attack, using existing act
scaling elsewhere. It is outside the old reference boss tiers, preserving their
scaling averages. All creatures use the existing floor/archetype stat bands.

Enemy Quick Strike cannot chain and does not trigger on frozen/skipped, dodged,
fully blocked or reviving hits. Thorns resolves before checking whether the
attacker survived to strike again. Its extra attack uses the full normal defense
path. Enemy Sandstorm only applies after actual damage and never stacks beyond
one pending missed weapon attack. Invalid weapon drops, spells and blocking do
not consume it. The missed valid attack spends its normal AP and enemy response,
with no damage or pip wear. Overlapping Frost, Shock and Sandstorm advance on the
same attempted attack. The flag survives save/continue and appears in the HUD.

Forager food uses the normal death-drop presentation and pickup behavior. It
takes priority over the random Mask death drop. The defeated enemy's data stays
intact for hit/kill rewards, while its board slot receives a separate food card;
stale death callbacks cannot award the kill or replace the food again.

## Desert Feast and Sandglass Scarab

The approved Desert Feast spell fully restores AP without healing HP. It is
uncommon, available from floor 1, and uses provisional recovery art (frame 9).
It pays the normal action cost before refilling AP; a player already at full AP
gets the card back without spending an action. It does not count as eating food
and cannot revive a defeated player. Its description is visible on hover.

Its Reliquary enchantment is Second Wind: one 10% roll after a damaging hit
restores 2 AP, capped at maximum AP. A stored Second Wind sigil and the enchant
share the same effect and icon, with no extra rarity roll or duplicate trigger.

The existing Glutton's Charm is reused as **Sandglass Scarab**, retaining its
`gluttonsCharm` ID, rarity, global drop entry and placeholder art. Each food eaten
while carrying it adds 1 maximum AP, up to **+10 per run**, before that food fills
AP. The cap increases from its old +5 value. Earned maximum AP remains after
removing the amulet, and re-equipping it does not reset cap usage. Its name and
description refresh in saved equipped items without replaying earned bonuses.

## Validation and follow-ups

`npm run test:sandreach` covers all-act roster/boss/reward generation, painted
art, stable IDs, damage conditions, actual inventory attacks and costs, extra-hit
armor/on-hit behavior, no chaining, food placement/full boards/boss lanes, Forager
death drops, enemy extra attacks, Sandstorm, HUD and save compatibility. The
headless enemy phase shares the live proc helpers. A pinned simulator smoke run
checks generation and combat execution; its player-sigil tactical forecasting
remains an approximation and is not balance validation.

Dune Quiver now supplies +1 damage to bows only. Sandspice Pouch implements
the Feast amulet by reusing Travel Kitchen (`travelKitchen`): food restores
50% more AP, rounded down. Both are global uncommon drops with provisional art.
Sandspice Pouch stacks with Sandglass Scarab's +1 maximum AP per meal without
changing that growth amount. Old owners keep one effect and receive the new name.

Still open: any additional maximum-AP
sigil, final names and remaining room/stamp art, visual review and human balance testing. No food
transformation or new resistance was added.

## Painted enemy and boss art

Enemy sheet row 10 uses the painted order Glass Scarab, Dune Forager, Sand
Skirmisher, Lizard Archer, Sandcaller. Each has normal/veteran/elite card faces
from that row, with live stats and the correct melee/ranged icon. It is an
enemy-only row, so it does not point to nonexistent hover or flip animation rows.

`assets/art/lizardBoss.png` is the editable 224x144 source: two 112x144 frames,
idle left and attack right. Preload creates separate single-pose textures from
those frames, keeping portraits and boss layout at the correct single-frame
width. Combat uses the existing attack-pose timer with zero padding offsets,
so the boss anchor stays fixed. The location portrait and Codex use idle art.
Old saved enemy/boss placeholders refresh on Continue without resetting combat
state. Stats, abilities, rewards and sounds are unchanged by this art pass.

`npm run test:sandreach-art` checks all 15 tier cards, painted columns and weapon
icons, the original two-frame PNG and generated pose textures, repeat attack
timers/anchors, portraits and actual saved-run art refresh.

The existing food-growth amulet's run counter (`gluttonMaxApGained`) is now
saved alongside maximum AP and restored on Continue. Older saves without a
counter default to zero; their existing maximum AP is preserved. Live food use
and headless food consumption share the same capped-growth helper. Earned AP
and cap usage remain after removing/re-equipping the amulet. Tests also cover
the literal +10 cap, old-name save refresh, spell consumption/full-AP rejection,
no HP healing, and the exact single-roll Second Wind enchantment.
