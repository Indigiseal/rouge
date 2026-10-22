# Location identity redesign — working plan

Updated: 2026-10-21.

This document records the user's redesign decisions and outstanding design work.
Implementation progress is recorded below and in the location design passes.
The [remaining-work checklist](location-redesign-remaining-work.md) distinguishes
the playable foundation from open decisions and art/balance work. Existing
true-road documents and act-specific location assignments do not override these
decisions. Assistant suggestions are not approved rules unless identified below.

## Approved structure

- Every location is available in any act. Its combat difficulty must suit that act.
- Remove the true-road/wrong-road distinction. Every road is a valid build choice.
- Offer three distinct locations per act, excluding locations visited earlier in
  the run. Previously offered but unchosen locations remain eligible.
- Retain the existing three-act, fifteen-floors-per-act structure unless revised.
- Locations have coherent identities shared by creatures, sigils, magic, stories,
  and eventually amulets. Matching abilities use recognizable shared sigils.
- Players discover identities through play; do not advertise sigil pools on road cards.
- Locations can have more than five sigils. There is no location-pool cap.
  This does not change the number of sigils an individual equipment card can hold.
- Ordinary creatures should remain simple. Some have no special abilities;
  others demonstrate a small selection of the location's mechanics.
- Ordinary food can drop anywhere. Food-related sigils and AP progression belong
  to the sand lizardfolk location.
- Work incrementally, one location at a time, after its rules are settled.

## Working location roster

| Location | Identity | Confirmed direction |
|---|---|---|
| Thornwake | Hunting pack, companions, thorns | Deer stamp with thorned antlers; retaliation and companion synergy |
| Silkdeep | Poison synergy and entrapment | Spider stamp; enhance poison gems instead of duplicating basic poison |
| Tollroad | Goblins, wealth, theft, carrying capacity | Goblin stories, money rewards, inventory upgrade |
| Boneflood | Armor, repair, preservation, bone assembly | Giant Skeleton is the location boss |
| Mireturn / bog | Healing, growth, allies sustaining one another | New living creatures; bog mermaid boss; toad stamp |
| Ashhowl | Fire spreading across the whole battlefield | Fire reaches hidden enemies; ash conceals threats |
| Veilbleed | Ghosts, weakening and draining strength | Leech, Sapping, Bloodlust, evasion, and Ink |
| Frost (name undecided) | Freezing and exploiting frozen targets | Frost, bonus damage against frozen targets, execution damage, Echo |
| Storm (name undecided) | Lightning reach and shock | Lightning-gem support; bird/chick and carnival encounters |
| Sand lizardfolk (name undecided) | Archery, food, AP and endurance | Skilled archers, food interactions, AP recovery, extra attacks; Glass Scarab concept |

The former Brassfair, Duskhold, Mirrorwane, Spherefall, and Starfold concepts are
not automatically included. Existing encounters may be retained independently.

## Boneflood — decisions for the first candidate implementation

- Boss: **Giant Skeleton**. His approved first-pass mechanics are implemented below.
- Keep Ironclad, Warding, Tempered, Riposte, and add Sunder to this location.
- **Mending:** each damaging weapon attack has a **10% chance to restore 1 pip**
  to a random damaged weapon or armor item, including worn armor.
- Bone Shield blocks attacks; reflection belongs to Thornwake's magic.
- The grappling-hook amulet should receive bone-related art and identity.
- Keep the amulet concept: discarding an item repairs a random remaining item.
- Weapon transformation is **an amulet**, not a Reassemble sigil. Its bone-themed
  name, art, transformation rules, and limits are undecided.
- The user approved plain Skeletons and Archers, an Ironclad Crypt Warden,
  an ally-armor-repairing Skull Mender, and a Bone Heap that leaves a destroyable
  pile before returning once. This first roster pass is implemented.
- Giant Skeleton's approved starting point is implemented: 2 armor, bounded
  repair replacing Honed, and one Skeleton summon at 70% and 35% HP.

## Other location decisions to preserve

### Thornwake

- Thorns is armor-only: retaliate for 1 damage when attacked.
- Keep Mirror on armor; Briar Shield magic reflects the next two attacks.
- Keep current Kinship: adjacent inventory weapons gain +1 damage.
- Companion Strength on intact carried/worn equipment gives companions +1
  damage per source. Pack Strength gives this weapon +1 damage per companion.
- Hunter and Outnumbered belong here.
- Leadership Banner now carries Warcry's companion extra-action effect: a rare
  globally droppable amulet with a 10% chance for one extra action per companion
  that acted. Normal holds/cooldowns apply; extra actions cannot chain.
- The first playable pass and approved roster are documented in
  [Thornwake's design pass](thornwake-design-pass.md). Wolves use Pack Strength;
  Fairies strengthen allies; Ents and Green Warden have Thorns. Sprites and
  Archers are plain. New artwork remains pending; Banner uses provisional art.

### Silkdeep

- Remove basic Venom from the proposed player pool; poison gems provide it.
- Proposed synergy sigils: poison spill to one additional enemy, an extra poison
  stack, and a Venomous Bomb proc that poisons revealed enemies.
- Venomous Bomb's proposed proc chance is 10%; exact poison rules remain open.
- Web entangles **one** enemy, not all enemies. Keep Crystal Brood.
- Replace the proposed Web magic with a venomous-bomb magic concept.
- Plague Heart already supplies a distinct poisoned-enemy death explosion in
  the current game; do not unknowingly duplicate it.
- Player mechanics now have an approved first implementation: poison gems
  gain one extra stack or one nearby revealed target; Web has a 15% one-target
  hold; Venomous Bomb has a 10% chance to apply 3 poison damage for 3 turns to
  revealed enemies. The magic applies that poison immediately. Crystal Brood
  is also a local reward. See [Silkdeep's design pass](silkdeep-design-pass.md).
  The approved creature pass is also implemented: poisonous Spiders,
  poison-strengthening Scorpions, one-card-webbing Silkslingers, and plain
  Crawlers and Husks. Spider Queen retains poison/summons; Ambush is removed.

### Tollroad

- Keep Cutpurse, Bounty, Packrat; move Ambush here.
- Ransom becomes a proposed amulet with a 3% crystal chance on kill.
- Scout becomes a proposed goblin-flavored amulet that may be found anywhere.
- Summon Mimic creates a normal hostile mimic on the board for the player to
  defeat for its normal loot. It is not a companion.
- Separate the music box / goblin inventory-upgrade story from the bird story.
- The first player/story pass is implemented: the four local sigils, ordinary
  Summon Mimic magic, and direct music-box-to-engineer repair without the nest.
  Existing queued bird stories remain compatible. See [Tollroad's design pass](tollroad-design-pass.md).
  The approved creature pass is implemented: plain Goblins/Archers/Brutes,
  stealing Cutpurses and Ambush Snipers. Goblin King has Ambush, coin theft
  and ordinary Goblin summons, replacing Warcry/Outnumbered. Summon Mimic's
  Reliquary conversion remains open.

### Bog

- Keep Regenerate, Unscathed, and Growth.
- A creature gains maximum HP when attacking; another heals nearby allies.
- The player pass is implemented: Regenerate heals 1 HP per carried companion
  per intact sigil item each enemy turn; Growth grants +1 maximum HP on a
  damaging weapon hit without healing current HP, initially uncapped.
- The approved creature pass is implemented: plain Slugs and Spitters,
  growing Brutes, and ally-healing Drowned and Toads. Regenerate heals each
  other revealed living ally by 1 HP; Growth adds maximum HP without healing.
- Bog Mermaid gains +3 maximum HP per attack and summons healing Drowned,
  replacing poison, evasion and Sapping. Stable IDs and temporary art remain;
  fresh boards use the new roster in every act. Nurture is undecided.
- See [Mireturn's design pass](mireturn-design-pass.md). All three local sigils
  use the toad stamp. Restoration's healing enchant is now called Renewal,
  separating it from Boneflood's item-repair Mending.
- Restoration keeps its full HP and AP restoration effect.
- A kill-to-maximum-HP amulet with bog flavor is a possible home for Marrow.

### Ashhowl

- Keep Fireball and Smoke; Smoke Screen magic becomes Ash Cloud.
- Remove Tsunami / Fire Tsunami in favor of **Scorched (Burn)**.
- Scorched has a 10% chance on a damaging hit to add 3 burn to every enemy,
  including hidden ones. The user chose one combined counter: it deals its
  current value each turn and drops by 1; repeat applications add 3 to what
  remains. Non-enemy loot is untouched. Scorched Land magic applies that same
  burn immediately. Ash Cloud keeps Smoke Screen's existing hiding effect.
- The first player pass is implemented; see [Ashhowl's design pass](ashhowl-design-pass.md).
  Old Tsunami sigils map to Scorched, and saved Smoke Screen cards display as
  Ash Cloud. The approved creature pass gives Scorched to Cinder Lizards and
  Lava Slimes; Maws, Brutes and Spitters have plain attacks. Existing Heatproof
  remains. Both Cerberus variants now use Scorched and head summons.
- Enemy Scorched has a 10% chance per damaging hit to add 3 player burn.
  Player burn combines into one decaying counter, bypasses armor without
  wearing it, and resolves before healing. It is saved and shown in the HUD.
- Heatproof is a natural creature trait, not a player sigil. Analogous elemental
  resistances require gameplay testing before approval.

### Veilbleed

- Keep Leech, Sapping, Devouring, evasion, Bloodlust, and enemy Ink.
- Charm moves to an amulet.
- The first pass is implemented; see [Veilbleed's design pass](veilbleed-design-pass.md).
  Its local rewards are Leech, Sapping, Devouring, Fleetfoot and Bloodlust.
  The approved roster uses evasive Lost Souls, plain Mourners, life-draining
  Rippers, weakening Cantors and existing Ink Wraiths. Soul Eater now has
  evasion, lifesteal and summons, replacing armor break/rage/Merciless.
  Existing Siren's Perfume is restored as Charm's amulet home; old Charm
  weapons keep working, but new Charm sigil rewards are retired.

### Storm and Frost

- Shock makes the affected player, companion, or enemy miss its next attack.
- Storm supports extra lightning-gem reach, Shock, Twin Socket, and Charged.
  It does not own the AP recovery theme.
- The approved first mechanics pass is implemented: Conductive adds one
  lightning-gem target; Shock has a 10% damaging-hit chance, including bosses;
  Charged deals x1.5 against shocked targets. Player/companion Shock now causes
  one missed attack and survives saves. See [Storm's design pass](storm-design-pass.md).
  Stormhatch is now playable in any act with the approved provisional roster:
  plain Rain Mites, Cliff Gulls and Storm Boars, shocking Thunder Crows, and
  Charged Storm Rams. Tempest Roc has Shock and Thunder Crow summons. New
  creature/boss art and room/door presentation are temporary. Enemy Shock
  chooses between the player and carried companions after a damaging hit.
- Thunderclap magic is approved and implemented: 3 lightning damage to every
  revealed enemy, including bosses, and one missed attack for survivors.
  Its Reliquary enchant supplies the existing 10% single-target Shock effect.
- Frost keeps Frost; add x1.5 damage against frozen enemies.
- Merciless moves to Frost with a frost-related name; keep its half-health
  execution condition distinct from the frozen-target bonus.
- Frost's first mechanics pass is implemented: Frost, Shatter (x1.5 against
  a Frost-frozen target) and Frozen Hammer (Merciless's existing half-health
  rule, retaining its save ID). Frosthollow is now playable in every act: plain
  Snow Brutes and ranged Snow Archers, freezing Ice Orbs, Shatter Ice Golems and
  Frozen Hammer melee Frozen Knights. Frost Giant has Frost, Shatter and Ice
  Golem summons. The five creatures use Taya's new row after the crystal spiders.
  Enemy Frost has a 10% damaging-hit chance to freeze the player or one
  companion for two attack attempts, refreshing rather than stacking.
  Art remains provisional. See [Frost's design pass](frost-design-pass.md).
- Echo belongs to Frost as a proposal; its final rule remains open.
- Carnival hag / Brass Wizard and mother bird / chick material are candidates
  for Storm. Exact story relocation and dependencies still need planning.

### Sand lizardfolk

- The approved first playable pass is implemented as provisional Sandreach,
  selectable in every act. Its six weapon sigils are Second Wind, Sandstorm
  (stable `daze` ID), Archer Bane, Well Fed, Forage and Quick Strike.
  Forage has the approved 10% food-spawn rule; Quick Strike has the approved
  10% single extra-hit rule, without extra AP/pip cost or chaining.
  Plain Glass Scarabs/Lizard Archers, food-dropping Dune Foragers, quick-striking
  Sand Skirmishers and Sandcallers form its approved roster. Sandscale Chieftain
  has Quick Strike, Sandstorm and Archer summons. Art remains provisional.
  See [Sandreach's design pass](sandreach-design-pass.md).
- Keep Second Wind. Daze becomes a sandstorm-themed effect.
- Proposed attacking sigils: x1.5 damage against ranged enemies, x1.5 damage
  while full on AP, and a chance to attack twice.
- The food-producing version was chosen: 10% after a damaging hit creates
  ordinary food in an empty board space. Fried-meat transformation is parked.
- The approved Endurance amulet is implemented by reusing Glutton's Charm as
  Sandglass Scarab (stable `gluttonsCharm` ID): each food eaten grants +1 maximum
  AP, capped at +10 per run, with saved cap usage. Drops remain global.
- Desert Feast is approved and implemented: fully restores AP without healing
  HP. Its Reliquary enchantment grants Second Wind's existing 10% chance after
  a damaging hit to restore 2 AP, with no duplicate proc from a stored sigil.
- Feast becomes an amulet. Reject Provision and Desperate from this pool.
- A +1 damage to ranged weapons amulet is proposed. Keen and Combo are candidates.

## Shared encounters and parked ideas

- Reliquary supplies the magic; the player supplies a weapon. It remains a way
  to obtain another location's enchantment. User requested all choices or at
  least five, with clear hover explanations. Premature edits already exist in
  the working tree; do not mistake them for approval of the wider redesign.
- Amulets may be found outside their location of origin; their appearance and
  name can still reinforce that origin.
- Tandem and Warcry are retired from new sigil rewards; saved cards retain their
  mechanics. Park Rally. Honed and Crushing
  remain undecided. Avoid forcing generic sigils into a location just to fill it.

## Implementation status

Progress: the user approved the 10% / 1-pip random-equipment Mending rule and
continued work. That first gameplay slice is implemented with a focused test
command, `npm run test:mending`. The approved any-act, three-choice, no-repeat
road foundation is now implemented for the seven original roster-backed locations
and the new Stormhatch, Frosthollow and Sandreach passes (30 location/act combinations),
with act-scaled bosses and persisted next-act offers. See the shared implementation
plan's progress section for limitations and `npm run test:any-act-locations`.
Boneflood's approved creature/boss pass and blocking Bone Shield are implemented.
All ten first creature/boss passes are implemented. Final art, later amulet work,
open mechanics, story migrations and human balance testing remain planned.

The [any-act implementation plan](any-act-location-implementation-plan.md) maps
shared selection, scaling, rewards and save changes to the current code, and
defines staged deliveries and acceptance checks. Pending policies remain marked.

The [Boneflood design proposal](boneflood-design-proposal.md) expands the approved
foundation into a concrete roster, repair contract, boss proposal, any-act
implementation findings, and a sequence of small playable changes. Its suggested
rules and numbers require review; they do not add approvals to this document.

The original six foundation steps are implemented, apart from final artwork
and human balance testing. Continue from the [remaining-work checklist](location-redesign-remaining-work.md):
Storm story integration, remaining amulets, unresolved sigil/enchantment rules,
final art/names, balance and visual/save regression testing.

No game-code changes are authorized by this planning document alone.
