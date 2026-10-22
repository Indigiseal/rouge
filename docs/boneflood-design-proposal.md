# Boneflood — first playable redesign proposal

Date: 2026-10-21.

Status: first playable mechanics pass implemented after user approval of the
roster and Giant Skeleton starting point. New stamp art, amulets and balance
playtesting remain open.
See [the overall redesign plan](location-identity-redesign-plan.md).

## Implementation progress

- Approved roster implemented: plain Skeleton and Skeleton Archer; Crypt Warden
  starts with 2 armor and Ironclad; Skull Mender repairs lost armor; Bone Heap
  leaves a destroyable pile and can return once at half HP.
- Piles have 1 HP, a visible return label, no attack, no initial kill payout,
  and a fresh-action grace before their return countdown. Returned creatures
  also sit out the phase they return in. State is saved on the card. Old poison
  and freeze markers are cleared on collapse; the spent return sigil disappears.
- Giant Skeleton keeps 2 armor, repairs 1 lost armor per attack up to 2, and
  summons once at each 70% / 35% HP threshold. Failed placements remain pending;
  crossing both thresholds can place both minions. Spent thresholds are serialized.
- Bone Shield and its Bulwark enchant now block individual attacks without
  reflection. The spell supplies 2 charges; the enchant readies at least 1.
  Blocks precede Mirror/dodge, preserve those defenses, prevent on-hit riders,
  and ready Riposte. Poison ticks are not blocked. This is the implemented
  priority, replacing the earlier unapproved dodge-first suggestion below.
- Save version 1.0.9 refreshes saved Bone Shield descriptions while retaining
  ids and art. Existing card data is not wholesale replaced with new definitions.
- Shared helpers support live combat and headless turns. Simulator projections
  also account for individual shield blocks, pile timing and armor repair.
- Focused checks: `npm run test:boneflood`, `npm run test:bone-shield`.
- Visual QA used real Phaser rendering and existing art in a headless browser;
  preview files are under `output/qa-boneflood*`. Seeded one-run simulator smoke
  checks completed without exceptions; they are not balance conclusions.
- Final regression pass: all 12 focused/related test commands passed. Automatic
  approval review blocked a second browser launch with "blocked by policy";
  the initial rendered preview was inspected. Stamp art and player balance
  testing are still required before treating this as a finished location.

- Work now lives on `codex/location-identity-redesign`, branched from the previous
  `sigils` checkout without discarding its uncommitted changes.
- Boneflood's ambient sigil rewards now use its approved six-sigil pool:
  Ironclad, Warding, Tempered, Mending, Riposte and Sunder, in any act. Existing
  compatibility, equipment capacity and already-taken filters still apply.
- Eligibility checks no longer consume a random sigil roll. An exhausted local
  pool returns no offer and allows the existing chest fallback; it does not draw
  an unrelated sigil. Explicit named event rewards remain separate.
- Added `npm run test:location-sigil-pools`. Other locations retain their current
  global pool until migrated; Boneflood's location-specific stamp/art remains open.

- Player Mending now rolls at 10% per damaging weapon hit and restores 1 pip to
  random damaged equipment, including worn armor. It excludes full and broken
  items, counts shared references once, and cannot exceed capacity.
- A source weapon that breaks can repair another item. Killing blows qualify;
  misses and zero-damage attacks do not. Splash targets do not independently call
  the weapon on-hit hook. Dual-wield daggers each use their own sigils on their hit.
- The repaired inventory card refreshes its pips without rebuilding the bag;
  worn armor refreshes through the normal HUD update. Feedback names the item.
- Added `npm run test:mending` for deterministic repair and on-hit checks.
- The balance simulator currently has no sigil-effect implementation; its results
  must not be presented as validation of Mending's balance. The repair helper is
  separate from UI so future simulation support can use the same selection rules.

## Approved foundation

- Boneflood can be chosen in any act, with difficulty appropriate to that act.
- Giant Skeleton is its boss.
- Identity: bones used as armor, damaged equipment repaired, broken pieces reused.
- Player sigils: Ironclad, Warding, Tempered, Mending, Riposte, Sunder.
- Mending: a damaging weapon attack has a 10% chance to restore 1 pip to a random
  damaged weapon or armor item, including worn armor.
- Bone Shield blocks attacks; the reflected-attack spell belongs to Thornwake.
- Equipment transformation belongs to an amulet, not a Reassemble sigil.

The basic Mending contract, five-creature roster and Giant Skeleton's bounded
armor repair / two threshold summons are approved. The progress section records
implemented edge cases. Other future suggestions below remain proposals.

## Proposed ordinary creatures

Retain the five existing art slots and their melee/ranged roles. Keep ordinary
attacks readable and avoid giving every creature several special rules.

| Creature | Proposed role | Ability | Replaces |
|---|---|---|---|
| Skeleton | Plain melee fighter | None | Already plain; keep |
| Bone Heap | Fragile creature that must be finished | Reassemble: first defeat leaves a bone pile; it can return once | Reflected damage |
| Crypt Warden | Armored melee fighter | Ironclad: its current armor adds to attack; begin with a small armor value | Complete ranged immunity |
| Skeleton Archer | Plain ranged fighter | None | Heavy-shot proc |
| Skull Lobber / proposed Skull Mender | Ranged support using the existing robed art | Mending: after attacking, restores 1 lost armor to a random damaged ally, up to that ally's starting armor | Stun proc |

Enemy armor repair does not restore HP or add new maximum armor. That keeps it
distinct from the bog's healing and growth. The mender has no repair effect when
no ally has lost armor. Renaming the Skull Lobber is optional and unapproved.

The key interaction: Sunder strips a Warden's armor, reducing both protection and
Ironclad damage; a mender can rebuild that protection if left alive. Plain
skeletons and archers keep some threats straightforward.

### Bone-pile rule requiring review

Suggested first version: a Bone Heap's first defeat leaves a visible, targetable
pile. The pile does not attack. After one enemy turn it reforms at half maximum
HP, once only. A damaging hit to the pile destroys it permanently.

- Show the pending return clearly with a one-turn indicator and tooltip.
- Keep the pile in its board slot and prevent floor-clear while a return is pending.
- Award loot, kill rewards, and kill-triggered effects once, on final destruction.
- The returned creature cannot repeat the process.
- Poison/burn on the pile and whether its return retains statuses need a decision.
- New pile art/animation is a dependency. Do not silently substitute an unclear
  resurrection flash if the player cannot understand what happened.

This tests reassembly on one ordinary creature before adding it to a boss.

## Proposed Giant Skeleton fight

Keep the existing sprite. His identity should come from protection and rebuilding
his defenses, not from acquiring unrelated damage bonuses.

- Start with 2 armor, matching his current definition.
- Replace Honed with Warding: after his attack, restore 1 lost armor, capped at
  his starting armor. It does not grant unlimited new armor.
- Replace unlimited random summoning with one ordinary Skeleton at each of two
  health thresholds: 70% and 35%, at most two summoned creatures in the fight.
- Mark each threshold as spent, including across save/load. A large hit crossing
  both thresholds must have an explicit rule; proposed behavior queues the two
  summons without placing cards on occupied spaces.
- Show armor and effective attack accurately, including changes from Sunder.

The player can strip his armor and exploit the opening; he repairs it by acting.
Ordinary minions create pressure without a healer swarm, which belongs to the bog.
Boss resurrection is not part of this first proposed slice.

Act scaling should change combat values while retaining these recognizable rules.
Do not multiply armor indiscriminately: early weapons must be able to hurt him.
HP, attack, armor limits, and summon strength need act-specific playtesting.

## Player Mending contract

Approved: damaging weapon attacks, 10% chance, 1 pip, random damaged weapons or
armor including worn armor. The additional edge cases below remain recommendations.

| Question | Recommended first rule |
|---|---|
| Trigger | Once after a successful damaging weapon attack, including a killing blow |
| Chance | 10%, preserving the current base proc chance |
| Amount | Restore 1 pip to one random eligible item |
| Eligible items | Damaged weapons and armor the player currently owns, including worn armor |
| Selection | Equal chance among eligible items; full items are excluded |
| Attacking weapon | Eligible if still present and damaged |
| Weapon that just broke | Cannot be resurrected by ordinary Mending; the attack can still repair another item |
| Maximum | Never exceed the item's existing pip capacity |
| Multi-target attacks | One roll per weapon attack, not per cleave, gem bounce, burn tick, or splash target |
| No eligible target | No repair and no misleading repair feedback |
| Rare full repair | Deferred to a later amulet decision |

Count an equipped item once even if inventory and equipped state reference the
same object. A repair must update the affected item and show which one received
the pip. Exact behavior for multiple Mending levels is still open.

## Proposed Bone Shield and Reliquary relationship

- Bone Shield grants two blocks of incoming direct enemy attacks, without reflection.
- Proposed consumption: spend a charge only on an attack that would connect;
  a dodge does not spend one. Poison/burn ticks do not consume charges.
- Blocking an attack should prevent its damage and on-hit riders, and count as
  a block for Riposte. The current meaning of Riposte's block must be checked.
- Reliquary proposal: Bone Shield grants a repeatable chance to block one future
  attack. Chance, refresh/stack behavior, and duration remain open.
- Preserve old saved spell/enchantment ids through an explicit migration; do not
  accidentally leave reflection attached to a bone-labelled effect.

## Stamp and presentation

Boneflood's stamp is not selected yet. A small skeleton beetle on a bone base is
one candidate; the user has not approved it. Art can follow the mechanics review.
Keep the bone hook, discard-to-repair charm, and transformation amulet for a later
amulet pass rather than expanding the first playable slice.

## Shared work needed for any-act locations

Current implementation findings:

- Location records contain a fixed act and truePath flag; road selection has a
  privileged true road and act-specific side pools.
- All five Boneflood ordinary enemies currently have minFloor 16. An act-1
  Boneflood selection would exhaust its local roster and use fallback enemies.
- Boneflood currently has no pinned boss in the location catalog.
- Boss generation accepts a planned boss only if it is in that act's legacy
  boss pool. Giant Skeleton is currently act-1-only and uses fixed stats.
- Default registry entries for unfinished locations have no enemy roster.

Required design/implementation approach:

1. Separate location identity from act difficulty. The chosen location selects
   its creatures and boss; the act/floor supplies an appropriate difficulty profile.
2. Remove roster-wide floor gates that prohibit an otherwise chosen location.
   Keep any intentional local enemy progression explicit and separate.
3. Honor the chosen location's boss in every act; use per-act boss profiles.
4. Route location sigil rewards through explicit location pools. The Reliquary
   remains an intentional way to obtain another location's enchantment.
5. Define fresh-run selection separately from old-save compatibility. Existing
   saved runs must not reroll their current encounter or multiply rewards.
6. Ensure map, sandbox, simulator, and normal gameplay resolve the same location.

Approved road dealing: offer three distinct complete locations per act from the
shared pool, excluding locations already visited in the run.
Do not expose unfinished Frost, Storm, or desert entries as complete encounters.
Decide how to handle the resulting partial roster during implementation.

## Incremental implementation sequence

| Slice | Work | Review outcome |
|---|---|---|
| 1. Shared selection and scaling | Any-act location resolution, Boneflood roster access, Giant Skeleton pinning and act profiles, old-save behavior | Boneflood can be selected and completed in acts 1, 2, and 3 with its own enemies and boss |
| 2. Equipment repair | Random-item Mending, target feedback, appropriate localized descriptions | Player understands which item repaired; attack/merge/discard/break interactions preserve inventory data |
| 3. Protection and rewards | Bone Shield, related enchantment, Boneflood sigil pool, armor/attack display | Spell, tooltip, stamp reward, and combat agree |
| 4. Creature and boss identity | Warden, mender, plain attackers, Giant Skeleton's bounded repair and summons | Location has clear defensive interactions without endless armor or minions |
| 5. Reassembly | Targetable pile, one-time return, save/load and exactly-once rewards | Player can see and prevent the return; the room clears correctly |
| 6. Playtest and tune | Test each act and representative weapon/gem builds, then adjust | Difficulty scales with act while location identity stays recognizable |

For each slice, run focused behavioral checks and play the visible interaction.
Compare simulator behavior whenever combat rules change. Do not treat a working
act-1 fight as evidence that act-2 and act-3 boss scaling is balanced.

## Decisions needed before the first gameplay patch

- Approve or revise the ordinary roster and Giant Skeleton behavior above.
- Settle Mending edge cases beyond its approved 10% / 1-pip base rule.
- Specify persistence and incomplete-content handling for the approved three
  doors with no repeated visited locations.
- Approve Bone Shield's blocking and Reliquary conversion rules before that slice.
- Choose a stamp and supply/approve any art needed before final visual delivery.
