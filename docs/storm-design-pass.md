# Storm: first mechanics pass

The user approved these starting rules on 2026-10-21. This pass supplies the
mechanics under the existing compatibility ID `stormhatch`. The user then
approved the first roster and boss on 2026-10-21. Stormhatch is now playable
in any act through the existing three-choice, no-repeat doors. Its final name
and artwork remain open.

| Sigil | Rule |
| --- | --- |
| Conductive | Lightning gems reach one additional revealed enemy. |
| Shock | A damaging weapon hit has a 10% chance to shock its target, including bosses. |
| Charged | x1.5 weapon damage against a shocked target, rounded down. |
| Twin Socket | Existing second gem socket, unchanged. |

All four fit weapons and use normal equipment sigil caps. Conductive combines
with the existing lightning-reach amulet and lightning in Twin Socket's second
socket. It creates no lightning without a lightning gem. Lightning continues
to prefer revealed ranged targets and never gains access to hidden cards.
Charged checks Shock specifically, not an ordinary freeze or Web.

Shock uses the existing enemy Shock status and visuals. It cannot shorten a
longer freeze or hold. A shocked enemy misses its next attack. Existing innate
gem/Hatchling Zap effects are unchanged; the new Shock sigil has its own
10% roll on a damaging weapon hit. Conductive, Shock and Charged temporarily
use the yellow lightning icon; the staged pool uses the existing lion stamp
until Storm's final stamp is chosen.

## Player and companion Shock

The shared `shockPlayer` / `shockCompanion` functions provide the status.
A repeat application does not stack more misses.

A shocked player misses the next valid weapon action. It spends AP and queues
the normal enemy response, but does not hit, trigger on-hit effects, spend a
weapon pip or make the dual-wield follow-up. Invalid/out-of-range drops retain
the pending Shock. Defensive blocks and magic do not consume it.

A shocked companion misses its next available attack. No valid target, a Web
lock or a web-spinner's cooldown does not spend Shock. This includes the
Crystal Spiderling's web attack. The player HUD and companion hover explain
the pending miss; the miss itself shows a localized floating message.

Player Shock has a backwards-compatible saved boolean. Companion Shock is
saved in its ordinary inventory card data. Old saves default to no Shock.
Live and headless companion attacks consume the same status. The headless
player attack path spends the missed action too; survival forecasts account
for the pending player miss and each companion's one skipped attack without
mutating the real companion's state.

## Approved first roster and boss

| Creature | Rule |
| --- | --- |
| Rain Mite | Plain melee swarm. |
| Storm Boar | Plain melee bruiser. |
| Cliff Gull | Plain ranged attack. |
| Thunder Crow | Shock: 10% chance after a damaging hit. |
| Storm Ram | Charged: x1.5 against a shocked player. |

Enemy Shock chooses equally among the player and distinct carried companions.
An already-shocked recipient wastes the application rather than stacking or
rerolling. A miss, fully absorbed hit, shield, reflection or reviving blow cannot
apply Shock. A webbed companion can receive Shock but retains it until able to
attack. No elemental immunity is introduced.

Tempest Roc has Shock with the same 10% rule and a 25% chance to summon one
Thunder Crow, using the existing summon pity/full-board behavior. Its initial
act-2 base is 167 HP / 17 ATK, with existing scaling for acts 1 and 3. It is
selected by Storm's location rather than being added to the legacy random boss
tier lists, keeping the existing bosses' scaling averages unchanged.

The roster uses floor-band/archetype stats. All five creatures and the Roc use
the existing `enemyPlaceholder` artwork. The door uses generic fallback art
and the room uses `stoneFloor`; no existing location's custom art is overwritten.
The pack replaces `stormhatch`'s existing registry slot, preserving old calendar
indices. Existing cached door offers remain fixed; newly generated offers can
include Stormhatch, excluding previously visited locations as usual.

Live/headless combat share enemy Shock application and Charged damage. A Crow
acting before a Ram can set up its bonus in the same phase. Choosing a weapon
action spends player Shock before the following enemy response; choosing
other actions can leave the Charged vulnerability pending. Forecasts include
an already-shocked player; future random Shock procs are not guaranteed.

## Validation and remaining work

### Thunderclap magic

The user approved Thunderclap's values on 2026-10-21. It deals 3 lightning
damage to each revealed living enemy, including bosses, then shocks survivors
for one missed attack. It uses the ordinary lightning damage/death path, which
bypasses armor, and an explicit targeting override so Taunt cannot protect the
rest of the board from this area spell. Ordinary targeted damage still respects
Taunt. Hidden cards, loot, cocoons and bone piles are excluded. A target replaced
by loot or a death reaction cannot transfer Shock to its replacement. Existing
longer freezes/holds are preserved rather than shortened.

The rare spell is available from floor 1 through normal magic drops, with
provisional Frost Ring artwork under its own sprite key. An invalid cast with
no eligible target spends neither AP nor the card. The simulator can cast and
value it. The magic catalog now has 15 cards, including Sandreach's Desert Feast.

At the Reliquary, Thunderclap grants the existing single-target Shock sigil:
10% per damaging hit, including bosses. The enchantment's timing delegates
to the sigil, so it does not add a second rarity roll or repeat the whole-board
spell. Stored Shock and this enchant display once and roll once. Glass hover
shows the spell description and the separate enchantment explanation. Names,
descriptions and enchantment text have English, Spanish, French, Russian and
German translations. Case-breaking text now says the remaining cases darken,
matching the room's five-choice layout instead of the old three cases.

`npm run test:storm` covers the pool, roster and boss in all acts, placeholder
presentation, enemy target selection, blocked/dodged hits, Crow/Ram synergy,
Roc summon dispatch, proc boundaries and misses, boss Shock, freeze preservation,
Charged conditions, real inventory attacks and AP/pip/on-hit behavior, invalid
drops, companion target availability, live/headless companion consumption,
Conductive reach/hidden exclusions/amulets/Twin Socket, HUD, hover and saves.
It also checks Thunderclap's damage, boss Shock, armor/Taunt bypass and default
Taunt preservation, exclusions, defeated targets, freeze preservation, cast
consumption/refusal, artwork mapping, Reliquary eligibility, enchant hover and
the single proc roll.

The shared any-act suite now covers 30 location/act combinations. The bird nest
and carnival now begin in Storm, with fresh nests independent of the goblin music
box and old pending follow-ups preserved. See [the story pass](storm-story-design-pass.md)
and `npm run test:storm-stories`. Final assets/name, visual review and human
balance testing remain follow-ups.
Storm does not gain AP recovery; that belongs to the sand lizardfolk theme.
