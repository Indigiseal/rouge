# Player power, area effects and progression — research and verification

## Result

The earlier HP-only charts and sim win-rate diagnosis were incomplete. Two real simulator defects suppressed player power: fire splash failed its geometric radius test, and axe cross attacks used an obsolete target API. Both are corrected. The current smoother health progression remains provisional; no further enemy HP change was made during this research pass.

## What the design sources support

- [Ian Schreiber, Advancement, Progression and Pacing](https://gamebalanceconcepts.wordpress.com/2010/08/18/level-7-advancement-progression-and-pacing/): compare avatar power with opposition power, distinguish skill from numerical progression, and assess how quickly relative challenge changes. Applied here: a visually smooth enemy HP curve is insufficient without the player's growing tools and damage.
- [Ian Schreiber, Metrics and Statistics](https://gamebalanceconcepts.wordpress.com/2010/08/25/level-8-metrics-and-statistics/): use measurement to investigate balance. Applied here: preserve sample counts and variation rather than reducing everything to a single average.
- [Anthony Giovannetti / Mega Crit, GDC 2019 slides](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf): combine iterative balance, metrics and playtester feedback; data supports a conclusion but does not establish it alone. Applied here: the human observation that optimized gem builds cruise after Act 2 matters even when the bot wins rarely.
- [Riot Games, Champion Durability Update](https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-5-6/): damage/durability tuning should preserve opportunities for decisions while retaining different build identities. This is a different genre; the applicable idea is combat duration and decision opportunities, not copying League's numbers.

These sources do not prescribe one universal numerical curve. The concrete targets below are design proposals for this game, not sourced industry constants.

## A better way to design this game's curve

1. Define actions-to-kill and actions-to-clear targets first. A reasonable first playtest anchor is around 2–3 solid ordinary hits for a standard enemy later in a run, about one for fragile enemies, and more for a bruiser. A completed gem/sigil combination should beat that baseline convincingly. These targets need validation against actual play, AP costs and healing windows.
2. Track primary-target damage separately from total board damage per action. Sword and axe collateral, repeated gem procs and hidden fire damage can multiply output without changing the printed weapon number. Do not divide one enemy's HP by whole-board splash damage to estimate hits-to-kill.
3. For an initial health budget use `reference single-target damage × desired ordinary attacks`, then validate with actual hits, armor, misses, DOT and counterattacks. Include room density and arrangement because they determine how many times area damage pays off.
4. Assess at least ordinary builds and successful gem builds independently. Preserve the pleasure of assembling a powerful combination; raising every enemy's HP to match the best combo would punish ungemmed runs and erase the payoff.
5. Preserve small increases every couple of floors, with short relief after upgrades. Use late-game enemy variety, positioning and counterplay as well as HP. Increasing HP alone increases incoming hits, armor wear, AP consumption and the value of sustain simultaneously.
6. Track per-room incoming damage, armor spent, AP spent, turns to clear and survival alongside damage. Prefer short controlled experiments and human playtests over optimizing a single bot win-rate target.

The current revised schedule already follows the requested pacing shape: lower HP around F20–25, increases through late Act 2, then small steps through late Act 3. Its average enemy HP grows from 21.5 at F23 to 44.7 at F44; typical prepared main swings in the strong-loadout sample grow from roughly 10–11 around Act 2 to 15.6 at F44, before gem damage and enemy mitigation. This is a useful initial screen, not a measured hits-to-kill result. I would validate this curve against human room-clear timing before another HP increase.

## Simulator fixes

- **Fire splash:** live `nearestEdgeDistSq` reads `bounds.left/right/top/bottom`. Mock bounds previously supplied only x/y/width/height, yielding NaN distance and silently skipping splash. The main-target fire bonus still worked. The mock now returns the full rectangle, tracks positions/scales, reads actual PNG/spritesheet dimensions and applies numeric tween destinations. Hidden enemies now take fire damage within the same radius the live code uses.
- **Fire is spatial:** it is not globally applied to every enemy on an arbitrarily large board. The base radius is 59 pixels measured to the nearest sprite edge; radius amulets expand it. On a compact board it can cover nearly everything, including hidden enemies. Tests include one distant enemy to verify the boundary.
- **Lightning:** the shared live code already executed primary damage and chains, preferring revealed ranged targets. Default is primary + two hops; Rune of Zap and Conductive add hops. Hidden cards are not ordinary lightning-hop candidates. The planner now also includes elite enemies in its lightning estimate.
- **Axe:** sim expected `targets.upper`, but the current helper returns `vertical` and `sides`; its early return skipped all collateral. The old side fraction was 25% instead of the live 50%. Simulation now calls the live inventory special helper, hitting the full cross. Its planner uses both vertical and side targets at 50%.
- **Sword and spear:** sim secondary attacks now use live inventory helpers, including incidental-targeting bypass. This preserves secondary gem triggering and prevents frontline/taunt rules from incorrectly suppressing collateral.
- **Statistics:** fire damage was omitted from the old gem-specialization bucket, which wrapped only `damageGemTarget`; it now wraps `burnEnemy` too. New action telemetry measures actual HP removed across original enemy references, including elites and hidden enemies, capped at remaining HP.

The decision planner remains an approximation: it does not model every recursive secondary-hit gem combination, Twin Socket interaction or future poison outcome as exactly as execution does. Lightning's mock shuffle is deterministic. The successful effect tests are not a claim that the bot plays an optimized human build.

## Measured damage during real simulated runs

[Player damage progression](player-damage-growth.png) shows two 500-run batches (seed 777), current enemy curve, max statues, normal inventory/loot progression. The right panel adds the strong starting amulet preset. Lines compare ungemmed and gemmed weapon actions; these are observational groups, not matched builds. Amulets and sigils acquired during runs apply normally.

Immediate damage includes main/off-hand hits, gems, immediate sigil effects and secondary weapon hits. Later poison ticks and enemy-turn companion attacks are excluded. Killing blows are capped at remaining HP, so a low average can reflect finishing weak enemies rather than low attack strength. Boss floors are omitted from the chart. Means with fewer than 30 actions are omitted. Late-game averages describe survivors only.

| Floor | Ungemmed total / action | Gemmed total / action | Gemmed action count |
|---|---:|---:|---:|
| 10 | 9.9 | 13.4 | 37 |
| 20 | 9.8 | 19.2 | 823 |
| 25 | 9.7 | 20.0 | 849 |
| 35 | 11.4 | 25.8 | 691 |
| 44 | 12.5 | 31.9 | 225 |

The table is the strong-starting-amulet sample. See CSV/JSON for both setups and percentile ranges. Enemy HP on the graph is an equal-location reference, not the exact encountered-HP distribution of survivors.

## Controlled proof of build interactions

[Combo damage chart](player-combo-damage.png): same dense 3×3 formation, two hidden enemies, one distant enemy. Each weapon starts at 8 damage; no Forge, crit or evade randomness. Enemies have enough HP to avoid overkill. First seven cases are floor 1 with no amulets. Final two use floor 31, three gems and the amulets listed in controlled-damage.json; the lightning case also uses Conductive.

- Plain bow: 8 total to one target.
- One fire gem: 35 total to nine targets, including 6 damage to the two hidden enemies.
- One lightning gem: 17 total to three targets.
- Sword: 16 total across primary plus two sides.
- Axe: 24 total across the five-cell cross.
- Sword + two fire gems: 100 total because the secondary hits also trigger gems.
- Axe + two lightning gems: 84 total.
- Fire with the specified amulets: 116 total; lightning with amulets and Conductive: 68.

These are controlled examples of combination power, not an average run, a maximum-damage claim, or equal-cost build comparisons. Immediate damage on a packed board can greatly exceed a primary hit while actual HP removed in a normal fight is limited by remaining enemies and health.

## Corrected win-rate context

| Setup, 500 runs | Earlier sim on current curve | Corrected effect execution |
|---|---:|---:|
| Max statues | 1.0% | 1.8% |
| Max statues + strong starting amulets | 5.6% | 11.6% |

These comparisons include the full mock geometry and special-attack corrections, not fire in isolation. Identical seeds do not guarantee identical encounter histories after decisions and effect outcomes change. The small max-statue difference is not evidence of a precise causal effect; strong builds show a much larger change. Human strength can still exceed bot strength substantially.

## Validation and reproduction

`npm run test:sim-area-effects` checks ten live-versus-sim scenarios, including hidden fire splash, range boundaries, chains, Conductive/amulets, sword and axe gem retriggers, and side-only axe hits. It also checks overkill accounting. Sigil parity passes 23 cases; sim coverage passes 26 stories × 40 plays and 18 enemy rules. Armor/mace, weapon policy, Combo, Mending and Frenzy checks also pass.

See sim/README.md for telemetry and plotting commands. Raw batches: effects-fixed-max.json/txt and effects-fixed-strong.json/txt. Player CSV: player-damage-growth.csv. Combo fixture: sim/combat-probe.js; focused test: tools/test-sim-area-effects.mjs.
