# Relic System — Notes & Roadmap

## Current roster (shipped)

Triggered/conditional relics, each wired to a real runtime hook.

| Relic | Unlock | Effect | Hook |
|---|---|---|---|
| Venom Glands | die to spider | Every weapon hit poisons (2 dmg / 3 turns) | `weaponPoisonChance` |
| Web Weaver | die to spider (2nd) | 25% to freeze an enemy on hit | `slowChance` |
| Second Wind | die to skeleton | Once per run, survive a lethal hit at 1 HP | `reviveOncePerRun` |
| Gravekeeper | die to skeleton (2nd) | Heal 4 HP at start of each floor | `healPerFloor` |
| Blood Money | die to goblin | Coin drops +50%, killing blows heal 1 HP | `coinMultiplier` + `lifestealOnKill` |
| Broodmother's Spite | kill Giant Spider (f15) | Poison immune; your poison +2 dmg | `poisonImmunity` + `poisonDamageBonus` |
| Giant's Grip | kill Skeleton King (f30) | Weapons lose durability half as often | `weaponDurabilityRate` |
| Dragon's Hunger (cursed) | kill Dragon (f45) | Heal 3 HP/kill, −15 max HP | `lifestealOnKill` + `maxHPPenalty` |
| Quartermaster | 3 deaths | Start with an uncommon weapon in pack | `startingWeapon` |
| Cartographer | reach floor 10 | Reveal 2 extra cards at floor start | `revealExtraCard` |
| Executioner | reach floor 20 | First attack each floor deals double dmg | `firstAttackDoubleDamage` |

### Known limitations (tune later)
- **Same-key relics don't stack.** `applyRelicEffects` uses `Object.assign`, so
  two relics writing the same effect key (e.g. Blood Money's `lifestealOnKill: 1`
  and Dragon's Hunger's `lifestealOnKill: 3`) — only the last-applied value wins,
  they don't add. If we want stacking, change `applyRelicEffects` to sum numeric
  keys instead of overwrite.
- Numbers are first-pass and meant for playtest tuning.

---

## Roadmap: expanded relics by rarity

Goal: a deeper pool, drawn/offered by rarity instead of 1:1 enemy→relic. Keep
each relic *build-defining*, not a flat stat.

### Common (small but always-relevant)
- **Coin Magnet** — +25% coins.
- **Field Rations** — food restores +1 AP.
- **Whetstone** — +1 weapon damage on the first hit of each combat.

### Uncommon (a clear playstyle nudge)
- **Venom Glands** (current) — poison on hit.
- **Web Weaver** (current) — freeze chance.
- **Gravekeeper** (current) — heal per floor.
- **Packrat** — +2 inventory slots.

### Rare (changes a system)
- **Second Wind** (current) — once-per-run revive.
- **Giant's Grip** (current) — durability saver.
- **Chain Lightning** — killing an enemy zaps a random other enemy for 3.
- **Alchemist** — potions and food also grant a small shield.

### Epic (run-shaping)
- **Executioner** (current) — first attack doubles.
- **Twin Strike** — every weapon attacks twice (half durability cost each).
- **Hoarder's Vault** — chests always roll one rarity tier higher.

### Legendary (build-defining, rare unlocks)
- **Dragon's Hunger** (current, cursed) — big lifesteal, max HP cost.
- **Time Loop** — once per run, undo the last floor (refight for full reward).
- **Midas Touch** — every 50 coins = +1 max HP permanently this run.

### Implementation notes for expansion
- Add a `rarity` field to each relic definition and an offer/draft flow
  (e.g. DeathRewardScene shows 1 of N weighted by rarity instead of a fixed
  enemy→relic map).
- New hooks likely needed: `attackCount`/twin-strike (InventorySystem.useWeapon),
  chest rarity bump (TreasureScene/RareShop), shield-on-heal (GameState.heal),
  permanent max-HP-from-coins (coin gain path).
- Consider a relic cap per run (e.g. max 5 equipped) if the pool grows large,
  to keep runs from becoming trivially strong.
