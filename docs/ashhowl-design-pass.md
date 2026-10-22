# Ashhowl: first fire pass

Player rules implemented from the design discussion, with the user's
2026-10-21 clarification: repeat Scorched applications combine into **one
burn counter**, not independent stacks.

## Local sigils

| Sigil | Rule |
| --- | --- |
| Fireball | Existing 10% chance to throw a fireball at another revealed enemy. |
| Scorched | A damaging weapon hit has a 10% chance to add 3 burn to every enemy, including hidden ones. |
| Ash Cloud | Existing Smoke sigil, renamed: a kill hides another enemy. |

Scorched replaces Tsunami. There is no separate Fire Tsunami/wave effect.
Heatproof remains the existing natural enemy trait, never a player reward.
The existing lion stamp and fire artwork are provisional.

## One burn counter

Each enemy's `burn` is a single number. At the end of the enemy phase, after
poison and before companions act, burn deals its current value as fire damage
and drops by 1. A fresh application produces 3, 2, 1, then ends.

Reapplication adds 3 to whatever remains. Two applications before ticking
produce a counter of 6, then damage 6, 5, 4, 3, 2, 1. This deliberately differs
from independent stacks producing 6, 4, 2. There is no new cap.

All living enemy-type cards on the current board are affected, including
hidden enemies, bosses and ordinary Mimics. Non-enemy loot is untouched.
Existing enemy-type containers use the same fire-damage/death path as fire
gems. Reinforcements added later have no burn until another application.

Hidden creatures take damage without flipping or showing a damage number.
Ash Cloud does not clear burn. Revealed creature/boss hover text shows the
remaining counter. Existing fire-hit effects accompany revealed burn ticks.
Burn deaths follow normal kill/floor-clear handling. Bone Heap's first death
clears burn when it becomes a pile, like its existing poison/freeze reset;
a later Scorched application can burn the targetable pile too.

Existing Heatproof still reduces fire damage by 40% with the existing rounding
and minimum of 1. Thus the first 3/2/1 counter deals 2/1/1 to Heatproof enemies.
No new resistance or immunity rules are introduced.

## Magic and Reliquary

Scorched Land magic adds 3 to every enemy's counter immediately. It can be
cast while all enemies are hidden, and does not spend a card/action when only
loot remains. Its Reliquary enchant supplies the same 10% Scorched proc.

Smoke Screen is now named Ash Cloud. The effect is unchanged: close revealed
non-boss enemies. Its stable magic ID `smokeScreen` and sprite `smokeBomb` remain
for saved cards, event integrations and existing art. Its existing hide-on-kill
Reliquary effect is now named Ash Cloud too.

Scorched Land temporarily shares the existing Fireball card/glow frame. Final
spell/stamp/icon artwork remains pending.

## Save compatibility

Old stored Tsunami sigils resolve to Scorched, and old run-level taken-sigil
records also resolve to Scorched so the renamed reward cannot be taken twice.
Burn counters serialize with board data, including on hidden enemies.
Saved Smoke Screen cards refresh their name/description to Ash Cloud without
changing their ID, art or the surrounding board.

## Approved creature and boss pass

The creature roster and player burn rule were approved on 2026-10-21.

| Creature | First-pass ability |
| --- | --- |
| Ember Maw | Plain attack; armor gnaw removed. |
| Cinder Brute | Plain attack; armor bypass removed. |
| Slag Spitter | Plain ranged attack; Spores removed. |
| Cinder Lizard | Scorched replaces Thorns. |
| Lava Slime | Scorched replaces Heavy Shot. |

All five retain their existing natural Heatproof trait. No new elemental
immunity or boss resistance is added. IDs, sprites, archetypes and depth
scaling remain unchanged.

Cerberus and the legacy Ancient Cerberus now have Scorched and their existing
head summons. Rage, armor break, Outnumbered and Ancient Cerberus's Merciless
are removed. Base HP/ATK and existing summon chances are unchanged. Heads
remain ordinary summon-only melee enemies; they do not acquire Scorched.

Enemy Scorched has a 10% chance after a damaging hit to add 3 burn to the
player. Misses, fully absorbed hits, shields and reflection cannot ignite the
player. A reviving blow does not add new burn. The shared Scorched icon has
an explicit enemy-side description.

Player burn uses one entry in the existing saved `playerEffects` array. Its
counter deals its current value and drops by 1 after poison, before regeneration
and companions. Repeat applications add 3 to the remaining counter; there is
no cap. Its synchronized `turns` value is for existing status/save integration,
not a second timer. Burn bypasses protection and armor dodge without spending
armor durability; ordinary amulet defenses continue to apply. It is a distinct
damage source, so poison immunity cannot remove it. Antidotes keep their
existing poison-only rule.

The HUD and portrait hover show the current burn counter and decay, with
English, Spanish, French, Russian and German strings. Lethal fire uses the
ordinary death/revival authority and cannot be undone by end-of-turn healing.
Revival skips remaining damage-over-time effects that phase; an old revival
flag cannot suppress burn in later phases. Live and headless combat share
counter behavior. Survival forecasts include already-active player burn;
future random Scorched procs are not treated as certain hits.

Fresh boards use the new definitions in any act. Saved boards keep their
serialized creature abilities.

## Validation and remaining work

`npm run test:ashhowl` covers all-act local rewards, old sigils/reward records,
3/2/1 decay, combined counters, reapplication, hidden/boss damage, loot safety,
Heatproof, live turn completion, bone-pile reset, save/load, proc boundaries,
the Reliquary enchant, spell consumption, and the actual Ash Cloud + burn combo.
It also covers all-act roster/boss generation, player burn accumulation/decay,
armor bypass and durability, HUD, saves, proc boundaries, dodges and shields,
headless procs and timing, burn death before healing, and revival interactions.

Amulets, final art and human balance testing remain later work. Test the new
roster on a fresh Ashhowl board.
