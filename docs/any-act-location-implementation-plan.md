# Any-act locations — implementation plan

Date: 2026-10-21. Status: shared selection/scaling foundation implemented;
location-specific redesign and balancing remain in progress.

## Implemented foundation

- Three doors are dealt from ten roster-backed locations in
  every act; earlier selected locations are excluded. Unchosen doors can reappear.
- Removed true-road preference and fixed location-to-act ownership from the catalog.
- Location choices write to the explicitly selected act and pin its matching boss.
- Boneflood now pins Giant Skeleton. Local enemies are no longer excluded by a
  global floor gate when their location has been selected.
- Boss HP/attack scale relative to average existing boss values for the source
  and destination acts. Native-act values are preserved. This replaces the earlier
  proposed explicit-profile implementation as an initial tuning baseline; it
  still needs balance playtesting. Other ability values are not multiplied.
- Next-act offers and their order are serialized in save version 1.0.8, with
  defaults for older saves. Before a new run starts, its initial offer is cached
  only in the selection scene; it is not a separate durable pending-run save.
- Old selected ids and already planned boss identities remain valid. Restored
  board objects are not regenerated or rescaled by these changes.
- Added `npm run test:any-act-locations`: 30 location/act combinations, generated
  rosters and bosses, no repeated visited locations, cached offers, save/load,
  and legacy planned bosses. Existing inventory, event-pool, victory, combat
  feedback, and simulator policy checks also pass.

The remaining sections record implementation rationale and follow-up work.
Boneflood's local six-sigil pool and deterministic eligibility filtering are now
implemented (`npm run test:location-sigil-pools`). The other six original locations,
Stormhatch, Frosthollow and provisional Sandreach now also have local sigil pools
and approved first creature/boss passes. Boneflood's blocking Bone Shield is
implemented. See each location's design-pass document and focused tests for
rules and remaining work. Final stamp/creature art, some magic and amulet work,
and human balance testing remain in progress.

Approved design: every location may appear in any act, and no road is true or
wrong. Combat difficulty follows progression; location determines identity.
See [the redesign record](location-identity-redesign-plan.md) and
[the Boneflood proposal](boneflood-design-proposal.md).

## Boundaries

Retain three acts of fifteen floors and the existing three-door presentation.
Three doors and excluding already-visited locations are approved rules.
Ten locations are the design
target; incomplete locations must not be silently populated with unrelated enemies.

Do not expose sigil-pool advertisements on doors. Keep discovery through play.
All eligible locations should be eligible in act 1 as well as acts 2 and 3; do
not quietly retain a preferred road in one slot.

## Proposed content contract

A location definition should own:

- Stable location id, name, presentation and door assets.
- Roster pack, boss identity, local event policy, optional story dependencies.
- Explicit sigil pool and stamp identity.
- An internal readiness flag for the playable build; this is not a player unlock.

Act difficulty should own:

- Ordinary enemy values from the existing global-floor bands and archetypes.
- Boss HP/attack profiles for the selected boss at each act.
- Progression-dependent reward amounts and equipment quality.

Do not give the location a single required act. Keep existing stable ids even
when names or art change, and handle any necessary renamed ids through migration.

## Concrete work map

| Area | Current behavior found | Planned change |
|---|---|---|
| `src/content/locations/catalog.js` | Fixed act lists, `truePath`, privileged true-road array | Separate location catalog from road dealing; add explicit playable readiness |
| `src/content/locations/index.js` | Deals a true road plus sides; writes choices using `loc.act`; rejects mismatched acts for bosses | Pass the selected act explicitly; deal from the shared ready pool; resolve the location's boss in any act |
| `src/scenes/LocationPickScene.js` | Three doors; road offer rerolled on scene creation | Pass act and visited-location context; persist an offer once dealt |
| `src/map/MapGenerator.js` | Uses act-tier boss fallback for unassigned maps | Pin a boss when a location is chosen, without rerolling map routes |
| `src/systems/loot/CardDataGenerator.js` | Local enemy floor gates; planned bosses accepted only inside legacy act pools | Respect chosen roster in every act; generate its boss using the selected act's difficulty profile |
| `src/content/cards/enemies.js`, `src/content/balance/EnemyPower.js` | Ordinary roster enemies already use floor bands and archetypes | Retain shared stat generation; remove only inappropriate location-wide eligibility gates |
| `src/content/cards/bosses.js` and future boss-profile data | Bosses carry one fixed stat block and legacy tier membership | Define explicit per-act profiles; keep identity and difficulty separate |
| `src/ui/SigilOffer.js` | Random reward comes from global `WORKING_PLAYER_SIGILS` | Accept an explicit source/location pool, then filter for compatible equipment and existing acquisition rules |
| `src/scenes/TreasureScene.js`, `src/scenes/GameScene.js` | Sigil rooms and elite rewards use shared global offering helpers | Carry source location and chosen reward id through the complete reward flow |
| `src/scenes/SigilRoom.js`, `src/content/sigils/sigilStamps.js` | Stamp chosen from sigil's old animal family | A location's stamp represents its local reward pool; design the exceptional cross-location cases explicitly |
| `src/managers/SaveManager.js`, `src/systems/GameState.js` | Stores act location ids, current board, navigation and progression | Version new rules and persisted offers; preserve active encounter state and permanent progression |
| Sandbox, simulator, audit/test tools | Some callers use calendar flags, act road arrays, and tier bosses | Resolve identity/difficulty through shared content helpers; preserve explicit test overrides |

## Road offers and choosing a location

The three-choice, no-visited-location rule is approved. Persistence details in
the lifecycle below remain implementation recommendations:

1. Deal three distinct ids from the ready pool when an act first needs a location.
2. Exclude locations actually chosen in earlier acts.
   Previously offered but unchosen locations remain eligible.
3. Save the offer before accepting a choice. Pausing, reloading, or returning to
   the screen should not offer a free reroll.
4. On selection, write the id to the selected act's slot, not a property of the
   location. Pin the correct boss on that act's map and save the result.
5. Future acts stay unchosen. Generating a map early does not commit its location.

New-run selection currently precedes construction of the live GameState. The
implementation must explicitly choose where a pending new-run offer is stored;
do not assume the existing current-run save can already represent that screen.

If the playable pool cannot supply three offers under a no-repeat policy, this
must be handled deliberately. Do not silently permit repeats or introduce an
unfinished road. The seven existing roster packs provide enough identities for
three non-repeating acts, once their matching bosses and difficulty profiles are ready.

## Enemy and boss scaling

Ordinary enemy stat generation already accepts global floor. Reuse it rather
than applying an additional act multiplier on top. Inspect local summons,
event ambushes, elite promotions, and hard-coded floor unlocks separately.

For each boss, define act-1, act-2 and act-3 HP and attack values. Preserve its
recognizable rule across acts; do not multiply armor, status duration, proc
chance, minion count, or healing blindly with the stat profile.

Giant Skeleton is the first profile to implement and review. His existing
act-1 values provide a baseline, not proof of balanced redesigned behavior.
Set later-act values against existing boss balance targets and representative
player equipment. Do not substitute an unrelated act-tier boss on resolution.

## Local rewards and intentional exceptions

- Location stamp rooms draw only from that location's approved, implemented pool.
- Apply card compatibility and existing acquired-sigil filters within the pool.
- If no local sigil can be applied, use an explicit ordinary-reward fallback;
  do not silently give a different location's sigil. The exact fallback is open.
- Roll once and persist the selected reward; eligibility checks must not roll
  one sigil and display another independently.
- Crystal Brood and similar special-event rewards retain explicit sources.
- Reliquary intentionally supplies cross-location magic/enchantments.
- Ordinary food may drop everywhere. Amulets may be found outside their origin.
- Generic magic drop availability is not yet fully specified; do not infer
  location exclusivity for every magic drop from the stamp-room rule.

Guaranteeing a local sigil-room opportunity every act was an assistant proposal,
not an approved change to map generation. Keep that decision open.

## Save strategy to specify before patching

Preserve village progression, XP, unlocked discoveries, and settings. Never erase
permanent progress as a shortcut to implementing a location redesign.

Recommended run strategy: add a content/rules version for newly started runs.
Existing valid runs retain their selected locations, board state, map and rolled
boss; new choices follow the explicitly chosen compatibility policy. This policy
requires implementation review before editing shared card definitions, because
a rules-version field alone cannot preserve old behavior.

Decide how to handle old future selections, placeholder roads, retired sigils,
and reflection-bearing Bone Shield enchants. Do not silently replace equipment
or replay a reward, story outcome, floor-end effect, death, or resurrection.

Migration invariants:

- Restoring a live encounter does not regenerate its board or rescale current HP.
- Restoring a reward room does not repay currency or heal the hero again.
- A pending location choice restores the same offered doors.
- A new act is written to the correct location slot and uses the matching boss.
- Missing legacy fields have explicit defaults; old calendar fixtures stay usable.
- Export/import goes through the same migration as normal Continue.

## Small implementation deliveries

1. **Shared identity/act seam:** explicit act assignment and boss resolution,
   tested through existing forced-location/sandbox paths before changing road dealing.
2. **Difficulty profiles:** Giant Skeleton in all three acts and ordinary Boneflood
   roster eligibility. Validate that no unrelated fallback creatures appear.
3. **Road dealing:** shared ready pool, pending offers, approved no-repeat policy,
   and save behavior. Preserve the three-door discovery presentation.
4. **Boneflood mechanics:** approved Mending/protection/creature rules from the
   separate proposal, with current effective values shown on cards.
5. **Local rewards:** explicit Boneflood sigil pool and its approved stamp;
   roll/persist/apply the same reward. Stage other pools as their designs become ready.
6. **Visible playtest:** act 1, act 2, act 3; then simulator parity and tuning.

Do not enable a location/difficulty combination merely because its roster exists.
Its matching boss and rewards must be playable, or the build needs an explicit
interim testing scope rather than an undocumented partial public feature.

## Acceptance checks

- Every ready location can be forced and correctly resolved in each act.
- Act choice modifies the intended slot and planned boss only.
- No true-road preference remains in fresh-run dealing or outcome text.
- Ordinary stats match shared floor-band generation exactly once.
- Giant Skeleton remains Giant Skeleton in all three acts, with the correct profile.
- Pause, reload, Continue, export/import and act transition preserve pending choices.
- Sigil rooms offer their local pool; Reliquary can deliberately cross locations.
- Sigil caps, worn armor eligibility, merges, gems, starred items and inventory
  transactions retain their existing contracts unless explicitly redesigned.
- Boss fanfare, automatic reward reveal and door timing continue to work.
- Sandbox and simulation use the same identity and difficulty data as gameplay.

## Pending user decisions

- Road-offer persistence and incomplete-location handling under the approved
  three-choice, no-visited-location policy.
- Mending edge cases beyond its approved 10% chance / 1 pip / random damaged
  weapon or armor target rule (including worn armor).
- Boneflood creature redesign, Giant Skeleton abilities, pile behavior and stamp.
- Bone Shield's exact block contract and Reliquary conversion.
- Old-run transition policy for this major redesign.

Implementation begins after the relevant design slice is approved. This file
does not turn the recommendations above into approved game rules.
