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

## Acceptance examples
- On new floor: at least 1 front enemy + 1 back enemy is revealed
- If front row is cleared, reveal one enemy behind
- Ranged: printed weapon damage (no ×0.8 penalty)
- Weapon gem slots by rarity: 1 / 2 / 3 / 4 / 5 (common → legendary)
- Armor spawn pool: leather only (dodge 10–30% by rarity, no protection;
  durability ticks on dodge); chain/plate pending
- AP spent on: weapon merge, attack, armor equip, potions, magic, gem socket.
  Reveals / board loot / discard do not spend AP (reveals still wake enemies).
- Open design questions: `docs/OPEN-QUESTIONS.md`
- Pure-run balance targets: `docs/BALANCE.md`
