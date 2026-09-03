# Game Mechanics (source of truth)

## Run structure
- A run is **3 acts × 15 floors = 45 floors**. One location per act.
- Nine locations total, **three offered per act**. The player picks one; killing its
  boss ends the act. Any of the three advances — the choice is flavour + roster, not a gate.

| Act | Floors | Choices (true road in bold) |
|---|---|---|
| 1 | 1–15 | Thornwake / Silkdeep / **Tollroad** |
| 2 | 16–30 | Boneflood / **Brassfair** / Duskhold |
| 3 | 31–45 | Mirrorwane / Spherefall / **Starfold** |

- **True path** = Tollroad → Brassfair → Starfold. Its bosses carry the macro-plot:
  the Goblin King taxes in a new god's name → the Ringmaster sells that god → the
  Magus *is* it. A wrong road still finishes the act and still counts as a completed
  run for meta; the after-boss card just says it was not the Waystar's road.
- Never gate a true location behind the previous one. Starfold must be reachable
  without having cleared Tollroad or Brassfair.
- **Location decides who spawns** (roster, events, tone). **Floor decides how strong**
  (power band) — see `docs/BALANCE.md`.
- Lore SoT: `docs/narrative/Locations/Locations Index.md` and
  `docs/narrative/Concepts/The True Path.md`.

**Code reality:** `LocationPickScene` deals three cards per act; the **back**
is the location portrait (`locBack_<id>`), with name / place / pitch shown as
soon as the card opens. A click walks that road. Packs still live under
`src/content/months/<id>/`. Act 2–3 rosters and named bosses are incomplete
(Duskhold / Brassfair / Starfold packs not shipped). The after-boss true/wrong
card is not in yet. Tracked in `docs/OPEN-QUESTIONS.md`.
`MapViewScene` has a debug **Choose manually** button to jump to any room in
the current act; after that room the run continues from that floor.

## Core loop
- Player reveals 2–3 enemies (front/back rows)
- Melee can only hit front row; ranged can hit revealed back (no damage penalty)

## Amulet groups
- Every droppable amulet belongs to a group: offense / survival / magic / utility / strategy
- First amulet of a run is biased toward a class group (utility muted x0.35, class groups x1.6)
- Later amulet drops lean x1.5 toward the player's dominant group (soft steering, no lock-in)
- Event-only amulets are outside the pool and outside steering

## Weapon specials
- **dagger** `dualWield` — a second dagger swings for free (off-hand pip is free)
- **bow** ranged — reaches past the frontline gate
- **sword** `cleave` — the blow carries into one other front enemy for 50%
  (`SWORD_CLEAVE_FRACTION`), no extra pip or AP; taunt respected, boss counts as front
- **axe** `specialAttack` — Heavy Strike, 150% for +1 durability, finisher only

## Weapon choice (data layer, UI pending)
- `CardDataGenerator.createWeaponChoice(floor, count)` returns 2–3 weapons of
  different types at the same rolled rarity band (play-style pick, not power pick)
- Consumer: boss reward room / weapon drops once a pick-one UI exists

## Meta progression
- Player-facing currency: **Villager Support** (RU: *Поддержка селян*). Lore:
  `docs/narrative/Concepts/Villager Support.md`. Code still stores `xp`.
- Every finished run (death or win) grants Support:
  `2 + floor(reached_floor / 5) + bosses_killed * 3` — **numbers unchanged**.
- Support is a **shared pool** (any hero earns it, any hero spends it) and persists
  in `metaProgression.xp`.
- Spend: **buildings** instead of talents — build for an advantage, upgrade for
  more of the same. Live: `VillageScene` after character pick; catalog in
  `src/content/village/`. Buildings are shared.
  - **Forge** (5): +1/2/3/4/5 damage on any weapon (printed).
  - **Temple** (1): one revive per run after a killing blow (50% HP). Remaining
    enemy swings and poison this phase stop so the rise is visible.
  - **Armory** (5): warrior +1..5 DEF on armor; rogue +10/20/30/40/50% dodge.
  - **Healer's House** (4): at run start, pick 1 of 3 amulets; rank sets rarity
    common / uncommon / rare / legendary.
  - **Healer's Hut** (`cottage`, 4): +15 / +30 / +45 / +60 max HP at run start.
    One empty lot remains on the village map.
  Old tree still lives in `TalentTreeScene` / `content/talents/` for the
  talentcompare / talentladder simulator modes. Live meta in the simulator is
  `--buildings` (and `--meta` alone means all buildings at max rank).

## Board rules
- Brick grid, compact cluster centered
- Splash reveals closed cards it would damage

## Thornwake enemy identities
- **Wolf** (skirmisher): `wolf_pack` — +1 ATK per other living revealed Wolf
- **Thorn Ent** (bruiser): `thorns_reflect` — on a connecting player weapon hit, deals 1 true damage through armor
- **Thorn Sprite** (swarm): `ranged_immune` — immune to ranged weapons (melee and spells still work).
  Counts as a stalemate when every usable weapon is ranged — see Stalemate rule below.
- **Spore Archer** (artillery): `spore_on_hit` — applies Spored; next player weapon attack has 15% miss, then clears
- **Thorn Fairy** (artillery): `veil_flip` — each of her turns flips face-up (no strike) or strikes then flips face-down; face-down cannot be attacked and does not strike

## Silkdeep enemy identities
- **Spider** (skirmisher): poison — stacking poison on hit
- **Cave Crawler** (swarm): `gnaw` — 50% chance +1 equipped armor durability loss on hit (extra vs block wear)
- **Silk Husk** (bruiser): `taunt` — while revealed (face-up art, not card back) and alive, player may only **attack** taunting enemies (melee, ranged, magic). Fire gem splash (and other fire splash) still hits neighbours. Face-down / mid-flip husks do not provoke.
- **Stinger Scorpion** (artillery): `poison_amp` — on hit, +1 to active poison tick damage (no effect if not poisoned)
- **Silkslinger** (artillery): `web_hand` — webs one random hand card for 1 turn (visual overlay; unusable). If the only usable weapon is webbed, treat as no weapon (stalemate enemy turns)

## Tollroad enemy identities
- **Goblin** (skirmisher): `club_stun` — on hit, 5% stun (player skips next action; enemies still respond)
- **Highway Cutpurse** (swarm): `coin_steal` — each attack steals 10 coins
- **Toll Brute** (bruiser): `goblin_rally` — on attack, 15% other living goblin allies each make an extra attack
- **Goblin Archer** (artillery): `ignore_armor` — after hit/miss resolved, if the shot lands, 10% ignore DEF and skip armor durability loss
- **Road Sniper** (artillery): `heavy_shot` — 20% deal 150% damage instead of 100%

## Event Sequences (any-location)
- Optional lanes that are **not owned by a location**. Code lives in `src/content/events/`; the player's road must never soft-lock them.
- **Music Box** (`broken_music_box` → `monster_bird_nest` → `goblin_engineer` → optional `hatching_egg`):
  - Opener while `boxState === 'unknown'` (first event of a run that has not met the box).
  - **Force it open** → lock-wafer overlay (`MusicBoxLockMinigame`): brief with example wafers, then 10 wafers (4 complementary pairs + 1 detonator pair). Seat all 4 safe pairs to succeed (`opened`, +1 crystal, box follows). Matching the detonators detonates (`boxState: exploded`, **35 HP**). After each attempt, three face-down wafers rotate. Nest then hides the cog prize (egg still available); engineer hides all repair (walk away).
  - **Open it carefully** (key card or Skeleton Key) → extract the charge, crystal cog crumbles (+1 crystal), missing repair cog, legs unfold, box follows.
  - **Leave it alone** → no reward; lock stays shut; legs unfold; box follows.
  - **Monster Bird Nest** → overlay (`BirdNestMinigame`): drag stacked junk off the egg and/or brass cog. A bird-shadow sweeps from random sides; holding junk under it costs **−5s** immediately and drains the 20s bar faster. Timeout = fail (no loot; `nestRaidTimedOut`; punishment TBD). Run keeps whatever was already taken. No HP/armor tax on the egg. Then `goblin_engineer`.

## Silkdeep event — The Silk Cache
- Event id `silk_cocoon_cache` (location pack `src/content/months/silkdeep/events/`); once per run while the act location is Silkdeep.
- Choices: leave / search cocoons / burn them all (requires Fireball scroll, consumes it).
- Search → combat board of 8 revealed cocoon shells (1 HP). Clicking does not flip; any 1 damage cracks a shell.
  Three shells hide loot (1 amulet + 2 weapon/armor for the floor); five hide a random Silkdeep enemy (**not** Silkslinger).
- Burn → combat board with no enemies; three loot cards already revealed (same loot table).
- Leave combat anytime while no hatched (non-cocoon) enemies remain.
- If the only usable weapon is webbed/unavailable and no damaging magic can open shells, the player turn auto-skips (stalemate enemy turns), same idea as Silkslinger softlock in normal combat.

## Stalemate rule

A floor only clears when no revealed enemy is alive, and there is no way to leave
one early (outside the Silk Cache). So the game has to notice a dead position and
resolve it instead of leaving the player on a frozen board.

`CombatTurnController.hasCombatStalemate()` calls it a stalemate when **all** hold:

1. a revealed enemy is alive;
2. no non-enemy card is left on the board (nothing to pick up);
3. no face-down enemy card is left (flips are free);
4. **no usable weapon can damage any revealed enemy** — `weaponCanDamageEnemy()`,
   the same predicate `attackEnemy` uses to reject a swing;
5. no magic in the pack (cocoon cache: no fireball / soul drain).

Point 4 used to read "the player holds a weapon". A rogue whose dagger broke and
who carried only bows would meet a Thorn Sprite and freeze: the swing returned
before spending AP or handing enemies a turn, the floor could not clear, and no
stalemate was declared. It ended ~2.6% of runs. Regression test:
`npm run test:combat-stalemate`.

Immunities belong in `weaponCanDamageEnemy`. Rules that only *redirect* a hit
(frontline gate, taunt) must not — they always leave some other enemy to hit and
can never make a position dead.

## Acceptance examples
- On new floor: at least 1 front enemy + 1 back enemy is revealed
- If front row is cleared, reveal one enemy behind
- Ranged: printed weapon damage (no ×0.8 penalty)
- Rogue: dagger/bow cards show `ceil(base × 1.10)` plus Twin Fang % when owned.
  Keen Edge is +1/+2/+3 on the first dagger/bow attack each floor (not on the card).
  Catalog `damage` stays base; First Blood / weakness float separately.
- Weapon gem slots by rarity: 1 / 2 / 3 / 4 / 5 (common → legendary)
- Gems never enter inventory. Socket from the board or shop by dragging onto a weapon.
  Shop drag pays the price and sockets in one drop. Clicking a gem does nothing but hint.
- Fire gem splash ignores taunt (the swing itself still must hit a taunter).
- Rune of Fire (uncommon): splash radius ×1.5. Greater Rune of Fire (rare): +20% fire gem damage.
- Rune of Zap (uncommon): +1 lightning bounce. Greater Rune of Zap (rare): +20% zap damage.
- Rune of Poison (uncommon): poison gem also poisons 1 neighbour in base fire-gem radius.
  Greater Rune of Poison (rare): +2 poison gem tick. Gloves of the Hermit Wizard replace all six.
- Armor spawn pool: leather only (dodge 10–30% by rarity, no protection;
  durability ticks on dodge); chain/plate pending
- AP spent on: weapon merge, attack, armor equip, potions, magic, gem socket.
  Reveals / board loot / discard do not spend AP (reveals still wake enemies).
- Open design questions: `docs/OPEN-QUESTIONS.md`
- Pure-run balance targets: `docs/BALANCE.md`
