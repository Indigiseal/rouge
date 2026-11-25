# Simulator and balance check — 28 October 2026

## Current-code results

Each configuration ran 500 runs with seed 777, Rogue, the current armor/weapon catalogs, and the corrected shield forecast. Full runs through floor 45, normal loot/amulet access. Max statues means forge 5, armory 5, cottage 5, healer at maximum and temple 1; no legacy talent tree. Armor/weapon input hashes were unchanged across these batches. Earlier batches were discarded from the comparison after the armor durability table changed during investigation.

| Configuration | Wins / 500 | Win rate | Mean final floor |
|---|---:|---:|---:|
| No statues | 0 | 0.0% | 10.03 |
| Max statues | 5 | 1.0% | 25.00 |
| Max statues + strong starting amulets | 22 | 4.4% | 29.09 |
| Max statues + chain/plate pool | 4 | 0.8% | 25.69 |
| Max statues, lookahead disabled | 4 | 0.8% | 24.76 |
| Max statues + reduced Act 2–3 enemy HP | 19 | 3.8% | 27.31 |

These are bot results, not estimates of human win probability. With 500 runs, differences such as 1.0% versus 0.8% do not establish a meaningful balance effect. Different configurations share seeds but consume randomness differently and do not play identical encounters.

## Wiring verified

- Padded armor is in the shared class loot pool. The real generator applies its current floor weights, protection and durability. Test coverage checks the early 70% padded / 30% leather band and later armor families.
- Mace enters loot from floor 31, with the same Act 3 schedule as axe. Tested absent at floor 30 and present at floor 31. The simulated attack uses the shared attack resolver and ignores enemy armor via `special: crush`. A regression case checks that an 8-damage mace plus max Forge deals 13 through 20 armor and matches the live inventory attack, including Growth.
- Sigils are acquired from map nodes, reward rows, elites, vaults and Crystal Lairs. Shared `applyWeaponSigils` and `onWeaponSigilHit` execute their effects; armor sigils run through shared player damage code. The live-versus-sim suite passes 23 attack cases. This is substantial coverage, not proof that every planner estimate models every sigil perfectly.
- Statues are applied through MetaProgressionManager and the shared village effects. Forge adds weapon damage, Armory adds armor DEF, Cottage adds max HP, Keeper grants a starting amulet and Phoenix supplies revival.

## Why the bot loses

Max-statue baseline:

- 442 of 500 runs (88.4%) die in Act 2. Average final floor 25; median 24.
- 78.8% of deaths occur in ordinary COMBAT rooms; 11.3% in bosses, 8.9% elites and 1.0% events.
- 94% of deaths are classified as HP loss; 6% weapon stalemate. This classifier does not distinguish every tactical cause of HP loss.
- At death, weapons retain 56% durability on average; armor retains 9%. Armor breaks 2.11 times per run.
- Only 1.97 sigils are acquired per run; 97.4% go on weapons. Sigil choice is random among eligible options, not optimized for a coherent build.
- 13.8% of actions occur while exhausted. End-of-run companion count is zero in this batch; that metric alone does not prove companions were never used earlier.

The current enemy ramp raises base HP from 18 on floor 16 to 34 on floor 23 (+89%) and base attack from 9 to 11. Meanwhile the report's average equipped weapon base damage changes from about 5.8 on floor 16 to 6.3 on floor 24 (Forge adds another 5 at attack time). More enemy HP means more counterattacks per kill; pressure rises while armor stock is wearing down. EnemyPower.js documents that deeper enemy bands were strengthened for the older expanded talent tree.

Armory also changes leather's lifetime: adding DEF means the shared damage resolver spends a pip on ordinary incoming hits as well as on dodges. Leather no longer has dodge-only durability consumption with Armory upgrades. Its current 12–22 pips and padded's 12–20 can disappear quickly against several enemies. This is live gameplay behavior, not a simulator-only bug.

Mace cannot solve the main Act 2 bottleneck because it first drops on floor 31. Excluding padded AND leather did not materially improve wins in this sample, so padded alone is not supported as the main cause.

## Diagnostic tuning experiment

The HP probe replaces `enemy.powerBands` for that process only: band HP from floor 16 onward is multiplied by 0.8 and rounded, with attack and all Act 1 bands unchanged. Wins rose to 19/500 (3.8%), mean final floor to 27.3, and floor-30 reach from 14% to 29%. This supports enemy HP/attrition as a contributor; the remaining low win rate means this is not a complete solution. The tuning JSON is included; live content balance was not changed.

## Simulator correction made

The survival planner used `Math.floor` for Magic Shield DEF even though the live resolver rounds up and guarantees at least +1. It also read dodge shielding from the live state after projected shield turns expired. `sim/projected-armor.js` now uses the shared armor math against the forecast's own armor/shield snapshot. Regression checks cover low-DEF rounding and shield expiry. Updated a stale test that assumed padded and leather still had identical durability.

## Recommended next balance work

1. Test Act 2 enemy HP and armor lifetime/repair supply together, using the current statue progression rather than old max talents as the reference.
2. Decide whether Armory is intended to remove leather's dodge-only wear rule; preserve its identity if that consequence is unwanted.
3. Improve sigil choice/placement, companion acquisition and armor-preservation policy before treating the bot as a skilled player's ceiling.
4. Set an intended fresh-account and max-statue win-rate target, then tune toward it. The present results establish a bottleneck but cannot choose the intended difficulty.

## Reproduce

```
node sim/balance-sim.js fresh 500 --seed=777 --buildings none
node sim/balance-sim.js fresh 500 --seed=777 --buildings max
node sim/balance-sim.js fresh 500 --seed=777 --buildings max --amulet-loadout strong
node sim/balance-sim.js fresh 500 --seed=777 --buildings max --armor-pool both
node sim/balance-sim.js fresh 500 --seed=777 --buildings max --no-lookahead
node sim/balance-sim.js fresh 500 --seed=777 --buildings max --tune=docs/balance/2026-10-28/hp-probe-tuning.json
```

Validation: sim armor, weapon preservation, attack priority, player sigils, and story/enemy coverage suites all pass (26 stories × 40 plays; 18 enemy turn rules). Raw text reports and JSON summaries are in this directory.
