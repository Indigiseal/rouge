# Tollroad: wealth, ambush and goblins

Implements the previously agreed coin/loot sigils, ordinary hostile Summon
Mimic spell, and music-box inventory upgrade independent of the bird nest.
The first creature and boss roster was approved on 2026-10-21 and is now
implemented alongside the player/story pass.

## Local sigils

| Sigil | Existing rule, unchanged |
| --- | --- |
| Cutpurse | +1 coin on each hit. |
| Bounty | +2 coins on a kill. |
| Packrat | +1 weapon damage per empty bag slot. |
| Ambush | x1.5 damage against an enemy at full health. |

All four are local rewards in any act. Ransom and Scout are not in this
pool; their goblin-flavored amulet conversions remain a later pass. The
existing wealth-family stamp is provisional until Tollroad's art is chosen.

## Summon Mimic magic

Creates the same hostile Mimic returned by the ordinary card generator:
normal floor-scaled health, 2 attack, and the ordinary three-attack escape
countdown and coin/crystal loot. It arrives face-up with normal reveal grace.
It is neither a companion nor a weakened boss summon. Summoning pays nothing;
escape pays nothing; defeating it uses the existing loot/death path.

The spell requires genuinely empty board space, including after cards have
been rearranged. Boss rooms use available minion lanes, avoiding enemies and
loot already in those lanes. A full board does not consume a card or action.
Cleared ordinary combat rooms can summon: the exit closes until the Mimic is
defeated or escapes. The original room-clear coins, egg progress and companion
history rewards are not granted again. A saved `board.clearRewardsGranted`
flag preserves this rule through Save & Quit / Continue. Boss victory handoffs,
scene transitions and non-combat stations cannot summon.
Explicit spell summons mark the room's existing natural-Mimic spawn flag;
later random reinforcements do not introduce another natural Mimic.

Normal Mimic loot now has an exactly-once fallback: missing animation
completion still grants the loot, and late completion cannot grant it twice.
The new spell's card art temporarily uses an existing conjuring frame.

No Reliquary enchantment has been invented for Summon Mimic. Its conversion
rule remains open; the other existing enchantable magic cards remain available.

## Music box and inventory slot

New music-box stories start in Tollroad. Opening, leaving or exploding the
box leads directly to the goblin engineer instead of queuing the bird nest.
The engineer can supply the missing cog, so the nest is not a prerequisite.

Existing prices and odds are retained: free repair 50%, an unwanted card 80%,
30 coins for full repair 100%. Successful repair grants the existing +1 bag
slot. Resolution is guarded so the reward cannot be claimed twice.

Legacy saves that already queued the bird nest retain that encounter and
their cog/egg state. Those legacy bird helpers are deliberately preserved;
the independent bird story's final migration belongs to the future Storm
location pass. There is no new Storm location or rewritten bird minigame here.

## Approved creature and boss pass

| Creature | First-pass ability |
| --- | --- |
| Goblin | Plain melee; club stun removed. |
| Goblin Archer | Plain ranged; armor bypass removed. |
| Toll Brute | Plain bruiser; Rally removed. |
| Highway Cutpurse | Existing theft: steals up to 10 available coins on its swing. |
| Road Sniper | Ambush: x1.5 damage against a full-health player, rounded down. Heavy Shot removed. |

Goblin King has three effects: Ambush, his existing 50% chance to steal up to
3 available coins, and his existing 35% chance to summon an ordinary Goblin.
Warcry and Outnumbered are removed. Base HP 84, ATK 12, summon pity and act
scaling remain unchanged. Summoned Goblins use the new plain definition.

Stable IDs, art and creature depth scaling remain. Legacy Rally handling is
retained for saved enemies that already carry it; fresh Tollroad creatures
do not gain Rally, stun, armor bypass or heavy shots. Saved boards retain their
serialized definitions; test the new roster on a fresh board.

Conditional enemy damage now shares its calculation between live combat,
headless combat, survival forecasts and boss hover. Ambush checks the player's
current HP for each attack, so a hit that injures the player removes the bonus
from subsequent attackers. Sapping rounds before the x1.5 multiplier, keeping
the existing live order. Unscathed and Merciless use the same shared path.

## Validation

`npm run test:tollroad` checks all-act local rewards, ordinary Mimic stats,
safe grid/boss placement, preserving existing cards, full-board refusal,
spell consumption, normal escape and loot, saved countdowns, animation/fallback
ordering, local music-box starts, direct engineer follow-ups, legacy nest queues,
repair costs/odds, and the exactly-once inventory upgrade. It also checks the
all-act roster/boss and shared sigils, theft limits/chance boundary, real Goblin
summon dispatch, Ambush's full-health condition, Sapping order, removal of
Outnumbered damage, and live/headless conditional-damage agreement.

Playtest the new box-to-engineer route on Tollroad, and carry Summon Mimic
into a fight with an empty space. Summon Mimic's enchantment design, amulet
conversions, final art and human balance testing remain separate work.
