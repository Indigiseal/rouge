# Mireturn: healing, growth and companions

The player rules and the first creature/boss roster were approved on
2026-10-21. Existing creature IDs, art and depth scaling are retained for
the first playable pass while the living Bog art is being designed.

## Local rewards

| Sigil | Player rule |
| --- | --- |
| Regenerate | Each intact carried or worn item heals 1 HP per carried companion after each enemy turn. No companions means no healing. |
| Unscathed | Existing weapon rule: x1.5 damage while the player is at full HP, rounded down. |
| Growth | Each damaging weapon hit grants +1 maximum HP without restoring current HP. No cap for the initial playtest. |

All three use the existing toad stamp. Growth temporarily shares Bloodlust's
plus-one icon (frame 48). Regenerate fits weapons and armor; Growth and
Unscathed fit weapons. Existing per-card sigil caps remain in force.

Multiple Regenerate items add their healing. Broken items do not contribute;
duplicate references to worn/bag gear count only once. Temporarily locked
companions still count as carried companions. Healing caps at maximum HP and
cannot rescue a player already killed by an attack or poison tick. Growth
does not trigger on a missed or non-damaging hit. Gained maximum HP persists
through the existing player save fields and is not tied to keeping the weapon.

## Shared creature rules

The approved enemy Regenerate rule is implemented in shared combat logic:
each revealed living healer restores 1 HP to every other revealed living
ally at the end of the enemy turn. It cannot heal itself. Two healers can
heal one another. Hidden creatures, defeated creatures, bone piles, cocoons
and loot are excluded. Multiple healers add their healing, capped at each
recipient's maximum HP. Poison and burn resolve before regeneration.

The shared enemy Growth rule grants +1 maximum HP per attack without healing.
An attempted attack still grows through shields or reflection; a skipped
attack does not. A creature can specify `growthPerAttack` for the mermaid's
+3 rule without changing player sigil levels. Growth and healing are
shared between live and headless combat, and enemy maximum HP serializes
with ordinary board data. The simulator's survival forecast also accounts for
enemy growth and ally healing, so healers can prolong a projected fight.

| Creature | First-pass ability |
| --- | --- |
| Bog Slug | Plain melee; armor gnaw removed. |
| Fen Spitter | Plain ranged; Spores removed. |
| Mire Brute | Growth: +1 maximum HP per attack, without healing. Armor bypass removed. |
| Drowned | Regenerate: heals other revealed living allies. Taunt and Sapping removed. |
| Mire Toad | Regenerate: heals other revealed living allies. Poison amplification removed. |

## Bog Mermaid

The boss keeps the stable `mireBride` ID and `MireBride` art temporarily, with
the display name **Bog Mermaid**. Growth grants +3 maximum HP per attack;
her existing 25% chance to summon one Drowned now supplies a healer. Existing
summon pity and full-board behavior remain. Poison, evasion and Sapping are
removed. She cannot heal herself without another living healer on the board.
Base HP 158 and ATK 16 and the existing act scaling are unchanged for playtesting.

The Growth hover states the actual +1 or +3 amount. Existing saved boards keep
their serialized creature definitions; newly generated creatures and bosses
use the approved roster in every act.

## Restoration and Renewal

Restoration retains its existing full HP and Action Point restoration.
Its weapon enchantment is now named **Renewal**, keeping its existing chance
and 3 HP healing effect. This separates healing from Boneflood's **Mending**
item repair. English, Spanish, French, Russian and German enchantment titles
are updated. Saved Restoration weapons keep their enchantment and chance;
their printed Mending prefix refreshes to Renewal on Continue.

## Validation and remaining work

`npm run test:mireturn` covers all-act local rewards, armor eligibility, toad
stamps, companion counting, broken gear, healing caps, self-heal exclusion,
multiple healers, hidden/dead/container safety, live/headless phase timing,
Growth on real inventory attacks (including killing hits and elite enemies),
blocked/skipped creature attacks, the mermaid/healer pairing and summon queue,
all-act creature/boss generation, Growth hover amounts, Unscathed, Restoration
casting, Renewal and save compatibility. Inventory attack execution now uses
the same enemy-type check as selection, fixing an inconsistency that could
skip an `eliteEnemy` after accepting it as a target.

Final living creature and mermaid art, the final Growth icon, the possible
Marrow amulet and human balance testing remain follow-ups.
