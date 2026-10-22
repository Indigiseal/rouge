# Frost: first playable pass

Frosthollow is selectable in every act, using the existing `frosthollow` ID.
Its identity is freezing attacks and exploiting frozen or weakened targets.
Echo's first playtest rule is implemented. Final location name/art remain open.

| Sigil | Rule |
| --- | --- |
| Frost | Existing 25% chance on a damaging hit: the struck non-boss misses its next attack to freeze. |
| Shatter | x1.5 weapon damage against a Frost-frozen target, rounded down. |
| Frozen Hammer | Existing Merciless rule: x1.5 against a target at half HP or less, rounded down. |
| Echo | 10% after a damaging hit: strikes the same surviving target again for half weapon-swing damage, rounded down, with no extra AP or pip spent. Cannot chain. |

All four fit weapons. Shatter and Frozen Hammer are separate conditions and
can multiply together using ordinary sigil caps and sequential rounding.
Shock and Web's shared hold counter does not count as Frost for Shatter.
Charged remains Storm's corresponding Shock damage bonus.

Frozen Hammer retains the stable `merciless` ID, preserving old weapons,
run-level taken rewards, discoveries, enemy definitions and existing damage
logic. Only the displayed name changes. Enemy-side Frozen Hammer also retains
its existing at-half-health-or-less condition.

Frost and Shatter temporarily share the ice icon; Frozen Hammer keeps its old
icon. Echo reuses the existing double-strike icon provisionally. All four use the existing turtle stamp until Frost's
stamp is chosen. There is no new resistance or immunity.

Echo copies half of the resolved input swing, after its class/sigil adjustments,
through the ordinary weapon-hit pipeline: armor, evasion, amulet/enchantment
modifiers, gems, on-hit effects and death handling still apply. It does not
recompute the primary swing's sigil multipliers or spend another pip/AP. Odd
input damage rounds down; a zero rounded strike does nothing. It can hit bosses
and trigger from a weapon's final pip. It never retargets a dead/replaced card,
hidden enemy, cocoon or bone pile. Echo and Quick Strike share one no-chain
guard. Both may independently trigger from a primary hit, but neither secondary
hit can trigger either extra-attack sigil. The enemy roster is unchanged.

`npm run test:echo` checks real inventory attacks, half-damage rounding, armor,
bosses, AP/pip costs, last-pip attacks, normal on-hit effects, mixed-sigil
non-chaining, invalid targets, exact proc boundaries and saved sigils.

## Freeze consistency

The shared freeze function is used by the Frost sigil, Frost Ring magic,
the Frost Ring enchantment and the headless spell path. Frost applications
clear Shock/Web markers and establish Frost while preserving a longer existing
hold. This gives Shatter a consistent status to recognize. Hidden creatures,
loot, defeated creatures, cocoons and bone piles are not valid targets.

The existing Frost sigil still excludes bosses and has a 25% chance. It now
requires actual damage, so a missed swing cannot freeze. The existing Frost
Ring spell still freezes revealed enemies and bosses for 3 attacks; an empty
or container-only board no longer passes its cast validation. Its existing
enchantment chance and one-attack freeze are unchanged.

Freeze kind/duration serialize in existing board fields. No new save version
or destructive conversion is needed. Storm's longer hold protection remains
intact when applying Shock to an already-frozen target.

## Approved creatures and boss

| Creature | Abilities |
| --- | --- |
| Snow Brute | Plain melee bruiser. |
| Snow Archer | Plain ranged attacker. |
| Ice Orb | Ranged; Frost has a 10% chance after a damaging hit to freeze the player or one carried companion. |
| Ice Golem | Melee bruiser; Shatter: x1.5 damage against a frozen player. |
| Frozen Knight | Melee finisher; Frozen Hammer: x1.5 damage against a player at half HP or less. |
| Frost Giant | Frost, Shatter, and a 25% chance to summon one Ice Golem. |

Frost Giant's native act-2 values are 167 HP and 17 attack. Existing act scaling
applies when encountered in another act. It does not change the reference boss
averages used to scale other bosses. Taya's five monsters occupy row 8 of
`assets/art/enemiesSpriteSheet.png`, immediately after the crystal spiders.
Their `SHEET_ORDER` matches the painted Brute/Archer/Orb/Golem/Knight order,
independent of the melee/ranged spawn groups. All three 52x70 tier faces are
composited from that row with the correct live heart/weapon overlays. The row
does not claim a nonexistent Frost card-flip/hover animation row.
Frost Giant has a transparent 128x144 idle sprite
and 160x168 attack pose with the existing 16px side/24px top padding. The road
portrait uses the new boss. The animated ice door uses row 5 of the six-frame
door sheet; the fight background still uses its existing fallback.

Enemy Frost chooses between the player and distinct carried companions, lasts
two attack attempts, and refreshes rather than stacks. Fully blocked, dodged or
reviving hits do not apply it. A frozen player's valid weapon action spends AP
and advances the enemy turn without damage, pip wear or on-hit effects. Invalid
targets retain the freeze. Companions thaw only when they have an available
attack; missing targets, web locks and cooldowns do not spend frozen attempts.
The third available attack proceeds normally. If Shock is also present, the
same missed attempt advances both holds. Enemy Shatter checks whether the player
is still frozen when the enemy strikes.

Player and companion freeze counters survive save/continue, with absent fields
defaulting to zero for older saves. HUD and companion hover show the remaining
attempts. Live combat and the headless simulator use the same hold/proc helpers.

## Validation and remaining work

`npm run test:frost` checks the playable roster, boss and pool across all acts, armor exclusion,
placeholder stamps, stable Frozen Hammer IDs, the exact half-health boundary,
Shatter versus Frost/Shock/Web, combined multipliers, real inventory attacks,
Frost's 25% boundary and miss/boss rules, Frost Ring/enchantment behavior,
hidden/container exclusions, preservation of longer holds and save fields.
It also checks two missed attacks followed by a normal attack, refresh and
Shock overlap, defenses, Orb/Golem synergy, summons, HUD and headless parity.

`npm run test:frost-art` checks the sheet row/columns, all 15 composed tier
textures, correct sword/bow overlays, promotion, card-flip fallback, boss
portrait, attack padding and stable pose-swap anchors. Continue upgrades known
old Frost placeholder/animal cards to the matching new names, roles and tier
art while retaining HP, attack, statuses and abilities. Custom sprite keys and
other locations are untouched. Old queued Ice Wolf summons resolve to Ice Golems.

The earlier generated animal cards are no longer loaded or assigned. Their
generation records remain under `output/art-concepts/frost/`; the generated
Frost Giant idle/attack art remains in use. The current user-sheet preview is
`output/qa-frost/snow-monsters-sheet-preview.png`.

Echo, final stamp/room/door art and names, in-game visual review and human balance
testing remain follow-ups. Generated creature art is ready for user review.
