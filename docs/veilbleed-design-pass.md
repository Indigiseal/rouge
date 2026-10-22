# Veilbleed: drain, weakening and evasion

The user approved the ordinary creature roster on 2026-10-21, then approved
Soul Eater's corrected three-ability proposal after inspection showed that
the previous boss did not actually have lifesteal.

## Local sigils

| Sigil | Existing player rule |
| --- | --- |
| Leech | Heal 15% of actual damage dealt, rounded up and capped by maximum HP. |
| Sapping | 20% chance on a damaging hit: the struck enemy's next attack deals 30% less, rounded down. |
| Devouring | 8% chance to kill a non-boss through the ordinary attack pipeline. |
| Fleetfoot | Worn armor: 10% chance to dodge a hit. |
| Bloodlust | +1 weapon damage per consecutive kill this fight; a non-killing hit resets it. |

Ink remains an enemy hand-lock ability. It is not a newly invented player
sigil. The existing cobra/control-family stamp is temporary until Veilbleed's
own stamp is finalized.

Sapping now requires actual damage on both sides: a missed weapon attack
cannot apply it, and a fully blocked creature attack cannot apply it to the
player. The player debuff survives Continue, just as enemy debuffs already
serialize with board data. It is spent by the next connecting weapon hit.

## Creatures

| Creature | First-pass ability |
| --- | --- |
| Lost Soul | 10% evasion, wearing Fleetfoot. No automatic hiding. |
| Hollow Mourner | Plain melee enemy; taunt removed. |
| Veil Ripper | Leech: heal 15% of actual damage inflicted on the player. Armor-chewing removed. |
| Grave Cantor | Sapping: 20% chance after a damaging hit to weaken the player's next weapon hit by 30%. Heavy shot removed. |
| Ink Wraith | Existing Ink: lock one bag card for a turn. |

Definitions keep their stable IDs, sprites, archetypes and depth scaling.
The player and creatures share the Leech/Sapping/Fleetfoot icons. Leech never
heals from a fully blocked hit and never exceeds the creature's maximum HP.

## Soul Eater

Exactly three abilities: existing 12% evasion, 15% lifesteal from actual
post-armor damage, and existing 15% Lost Soul summons (with existing summon
pity behavior). Armor break and rage are removed. Merciless is removed from
the boss because its approved home is Frost. Base HP/ATK and act scaling are
unchanged; the new ability combination still needs human balance testing.

## Charm's amulet home

Siren's Perfume already existed with suitable art and a 15% chance to redirect
an enemy attack. It is restored to the current rare amulet catalog, with the
normal rare drop weight and floor gating, and can drop outside Veilbleed.
Its stable gameplay ID remains `sirensPendant` and atlas frame remains 60.

This preserves the existing amulet trigger: roll when an enemy attacks, then
redirect to another revealed living enemy if possible. With nobody to attack,
the ordinary player-directed attack proceeds. The amulet can redirect bosses
by its established rule; it does not permanently convert a creature.

Charm is retired from new sigil rewards and stamping. Saved weapons that
already carry Charm retain their original 15% on-hit, non-boss charm rule;
the save is not stripped or automatically converted into an amulet. Their
existing sigil slots still count normally.

## Magic, saves and validation

Existing Soul Drain and Weakness magic/enchantments remain available; no
additional spell or unapproved magic replacement is introduced in this pass.
Existing saved enemy boards retain their serialized abilities. Newly generated
Veilbleed creatures and Soul Eater use the new definitions in every act.

`npm run test:veilbleed` checks local rewards across all acts, armor eligibility,
shared creature icons, the three-ability boss, actual-damage lifesteal and caps,
one-hit Sapping, blocked/missed hits, evasion, Devouring's boss exclusion,
Bloodlust, restored Perfume and its target selection, legacy Charm, and save
compatibility. Headless combat uses the updated normal-creature lifesteal and
Sapping rules too.

Final location stamp art, additional amulet flavor work and balance remain
separate follow-ups. Other locations' unanswered roster proposals stay pending.
