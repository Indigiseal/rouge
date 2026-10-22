# Silkdeep: poison and web pass

Player mechanics and starting values approved on 2026-10-21. Identity:
poison accumulation, spreading poison gems, and silk that holds one target.
Basic player Venom and Ambush are excluded from the local reward pool.

## Implemented local sigils

| Sigil | Rule |
| --- | --- |
| Venom Stacking | A poison gem hit applies one extra gem-poison stack. |
| Venom Splash | Poison gems also poison one nearby revealed enemy. |
| Venomous Bomb | A damaging weapon hit has a 10% chance to poison every revealed enemy for 3 damage per turn for 3 turns. |
| Web | A damaging hit has a 15% chance to make the struck non-boss miss its next attack. |
| Crystal Brood | Existing effect unchanged: a kill opens one hidden card, with a 15% chance of a crystal. Now also offered locally. |

All five fit weapons and use the normal equipment sigil cap. Crystal Lair's
named reward remains available; Crystal Brood stays excluded from unfinished
locations' global fallback pool. Normal local rewards respect taken sigils.

Venom Stacking adds one stack independently of the gem's count and retains
the existing 3-turn duration and poison-gem amulet damage bonuses. It works
with poison in Twin Socket's second socket. It creates no poison without a
poison gem and does not amplify native venom, relic poison, or bomb poison.

Venom Splash uses the existing nearby-poison radius (59 pixels to a card's
edge). Hidden enemies, dead creatures, bone piles and cocoon containers do
not receive the sigil's splash. An existing splash amulet still chooses by
its original rules; the sigil adds a separate revealed target instead of
applying two splashes to the amulet's first target.

Web affects only the struck creature. Bosses are excluded, and existing
longer freezes/holds are not shortened. It uses the established companion
web status/visual and expires after one missed attack. No board-wide web.

Bombs affect living revealed enemies and bosses. Hidden cards, loot, dead
creatures, bone piles and cocoon containers are excluded. Each application
adds one 3-damage, 3-turn poison status; repeated applications stack using
the game's existing poison rules. Misses do not trigger the sigil.

## Magic and Reliquary

Venomous Bomb magic immediately applies the same poison to all valid revealed
enemies. It does not spend the spell when no valid target exists.
Its Reliquary enchantment supplies the same 10% bomb sigil, with one proc
roll per damaging hit. This poison uses the normal status/marker/death path,
without rerolling weapon poison relics on every bomb target.

The old Smoke Screen bomb frame is provisional art for the new spell and
its glass-case glow. The existing cobra stamp is a temporary venom-family
stand-in for the user's planned spider stamp. New icons remain placeholders.

## Existing amulet interaction

Plague Heart remains the separate poisoned-enemy death explosion. No new
death-explosion sigil is introduced. Its existing explosion now correctly
triggers when an enemy dies to the final tick of its last poison status;
expiry is resolved after death handling rather than before it.

## Approved creature pass

The separate roster was approved on 2026-10-21 and is implemented:

| Creature | Rule |
| --- | --- |
| Spider | Existing poison: 2 damage for 3 turns, through the existing player-poison system. |
| Stinger Scorpion | A connecting hit adds 1 to active poison's damage per tick; it cannot create poison or extend its duration. |
| Silkslinger | Existing Web locks one bag card for one turn. |
| Cave Crawler | Plain melee; armor gnaw removed. |
| Silk Husk | Plain melee; Taunt removed. |

Spider Queen retains poison and spider summons, with Ambush removed because
goblins own it. Her base HP 81, ATK 11, poison parameters, summon chance and
existing act scaling are unchanged. The roster keeps stable IDs and artwork.
New boards use these definitions in every act; already-saved boards retain
their serialized creature definitions.

Scorpions display **Venom Stacking**, with an enemy-side explanation of their
poison strengthening. Basic Venom remains the Spider/Queen's innate poison
icon, not a new player stamp reward. Venom Stacking's player poison-gem rule
is unchanged.

Fresh poison now resolves after the incoming attack's dodge result: a dodged
Spider/Queen attack cannot poison the player. Ordinary armor retains the
existing contact-poison rule; Bone Shield and reflection prevent poison and
Scorpion strengthening. Poison immunity still rejects a new application.
Revival skips a new poison application from the reviving blow. The headless
combat path shares these poison/contact and strengthening rules, and its
survival forecast now includes Scorpion strengthening.

## Validation

`npm run test:silkdeep` exercises local rewards in every act, gem count and
amulet bonuses, Twin Socket, splash selection and hidden-target exclusions,
bomb duration/stacking and target exclusions, proc boundaries, single-target
Web, one missed attack, spell validation/consumption, the Reliquary chance,
saved poison statuses and Plague Heart's final-tick death interaction. It also
checks all-act creature/boss generation and shared icons, the Spider/Scorpion
pairing, poison defenses/immunity, one-card enemy Web and expiry, and saving
the strengthened player poison.

Test on a fresh Silkdeep board. Final spider stamp/icon art and human balance
testing remain open; these are initial playtest values, not final balance.
