# Game Mechanics (source of truth)

## Core loop
- Player reveals 2–3 enemies (front/back rows)
- Melee can only hit front row; ranged can hit revealed back (no damage penalty)

## Amulet groups
- Every droppable amulet belongs to a group: offense / survival / magic / utility
- First amulet of a run is biased toward a class group (utility muted x0.35, class groups x1.6)
- Later amulet drops lean x1.5 toward the player's dominant group (soft steering, no lock-in)
- Event-only amulets are outside the pool and outside steering

## Weapon choice (data layer, UI pending)
- `CardDataGenerator.createWeaponChoice(floor, count)` returns 2–3 weapons of
  different types at the same rolled rarity band (play-style pick, not power pick)
- Consumer: boss reward room / weapon drops once a pick-one UI exists

## Meta progression
- Every finished run (death or win) grants **character XP**:
  `2 + floor(reached_floor / 5) + bosses_killed * 3`
- XP and purchased talents are **per character** and persist across runs
- After character select, the talent tree opens (Shadow / Iron purchasable;
  other branches visible as WIP)
- Death no longer unlocks relics; legacy relic/veteran HP meta is retired

## Board rules
- Brick grid, compact cluster centered
- Splash reveals closed cards it would damage

## Thornwake enemy identities
- **Wolf** (skirmisher): `wolf_pack` — +1 ATK per other living revealed Wolf
- **Thorn Ent** (bruiser): `thorns_reflect` — on a connecting player weapon hit, deals 1 true damage through armor
- **Thorn Sprite** (swarm): `ranged_immune` — immune to ranged weapons (melee and spells still work)
- **Spore Archer** (artillery): `spore_on_hit` — applies Spored; next player weapon attack has 15% miss, then clears
- **Thorn Fairy** (artillery): `veil_flip` — each of her turns flips face-up (no strike) or strikes then flips face-down; face-down cannot be attacked and does not strike

## Silkdeep enemy identities
- **Spider** (skirmisher): poison — stacking poison on hit
- **Cave Crawler** (swarm): `gnaw` — 50% chance +1 equipped armor durability loss on hit (extra vs block wear)
- **Silk Husk** (bruiser): `taunt` — while revealed and alive, player may only attack taunting enemies (melee, ranged, magic)
- **Stinger Scorpion** (artillery): `poison_amp` — on hit, +1 to active poison tick damage (no effect if not poisoned)
- **Silkslinger** (artillery): `web_hand` — webs one random hand card for 1 turn (visual overlay; unusable). If the only usable weapon is webbed, treat as no weapon (stalemate enemy turns)

## Acceptance examples
- On new floor: at least 1 front enemy + 1 back enemy is revealed
- If front row is cleared, reveal one enemy behind
- Ranged: printed weapon damage (no ×0.8 penalty)
- Rogue: dagger/bow cards show `ceil(base × 1.10)` plus Twin Fang % when owned.
  Keen Edge is +1/+2/+3 on the first dagger/bow attack each floor (not on the card).
  Catalog `damage` stays base; First Blood / weakness float separately.
- Weapon gem slots by rarity: 1 / 2 / 3 / 4 / 5 (common → legendary)
- Armor spawn pool: leather only (dodge 10–30% by rarity, no protection;
  durability ticks on dodge); chain/plate pending
- AP spent on: weapon merge, attack, armor equip, potions, magic, gem socket.
  Reveals / board loot / discard do not spend AP (reveals still wake enemies).
- Open design questions: `docs/OPEN-QUESTIONS.md`
- Pure-run balance targets: `docs/BALANCE.md`
