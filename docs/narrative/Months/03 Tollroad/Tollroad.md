---
type: month
project: Evershift
status: example
month_number: 3
name: Tollroad
theme: False kingdom
location: The King's Mile
boss: Goblin King
melee_count: 3
ranged_count: 2
archetypes: skirmisher,swarm,bruiser,artillery,artillery
tags:
  - evershift
  - month
  - example
---

# Tollroad

The month of crooked law. A greedy Goblin King arrives and claims the road as his province: tariffs, "guards," scrap seals on stolen banners. This is not random banditry. It is a **false kingdom** — rules without fairness, a price on every mile.

## Theme

False kingdom — whoever stamps the pass owns the way

## Location

### The King's Mile

**The King's Mile** is the signature place of this month.

Booths, barriers, and overpainted crests line a road that used to belong to everyone. The Mile feels administered: someone is always collecting, weighing, or waving you through for coin.

Roster encountered here: [[Goblin]], [[Highway Cutpurse]], [[Toll Brute]], [[Goblin Archer]], [[Road Sniper]].  
Boss: [[Goblin King]].

> [!note] Art direction
> Brief enemies as **clear fantasy archetypes** (goblin thug, thief, club brute, archer, king). Month context = toll / badge / barrier — not a locked costume sheet. Leave silhouette and kit details open.

## Cast

Required roster: **3 melee**, **2 ranged**, **1 boss**. Archetype multipliers: [[Enemy Power]] / `docs/BALANCE.md`.

### Melee (3)

| Enemy | Role | Archetype | Status | Readable type | Note |
| --- | --- | --- | --- | --- | --- |
| [[Goblin]] | melee | `skirmisher` | in-game | Classic goblin (club preferred) | `club_stun` — 5% on hit to stun; player skips next turn. |
| [[Highway Cutpurse]] | melee | `swarm` | proposed | Classic cutpurse / thief | `coin_steal` — each attack steals 10 coins. |
| [[Toll Brute]] | melee | `bruiser` | proposed | Club brute / gate guard | `goblin_rally` — 15% on attack to trigger extra attacks from other goblins. |

### Ranged (2)

| Enemy | Role | Archetype | Status | Readable type | Note |
| --- | --- | --- | --- | --- | --- |
| [[Goblin Archer]] | ranged | `artillery` | in-game | Goblin archer | `ignore_armor` — after hit lands, 10% ignore DEF (no armor durability loss). |
| [[Road Sniper]] | ranged | `artillery` | proposed | Fantasy long-shot (crossbow / wagon archer) | `heavy_shot` — 20% deal 150% damage instead of 100%. |

### Boss (1)

| Boss | Status | Note |
|---|---|---|
| [[Goblin King]] | in-game | Parody sovereign of the Mile; finale echoes [[03 Tollroad/Events/Toll Collectors\|Toll Collectors]]. |

> [!note] Links
> Enemy and boss names link to [[Enemies Index]] / [[Bosses Index]] pages.

## Features

- A false state plants tolls, passes, and "law" on the open road.
- Coin walks off the Mile: cutpurses take purse, collectors take "tax."
- Goblin pack tactics: stun clubs, armor-slipping arrows, and brutes who rally other goblins.
- Scrap-tech goblins thrive in the King's shadow (engineer, jury-rigged gear).

## Events

- [[03 Tollroad/Events/Toll Collectors|Toll Collectors]] — The Goblin King's tax men block the road. Pay, intimidate, fight, or wait — choices spill into the boss fight and shops.
- [[03 Tollroad/Events/Goblin Engineer|Goblin Engineer]] — A goblin offers to repair the Latchbox — properly for coin or card parts, or poorly for free. Success unlocks the box's drawers.

## Gaps

- Optional vignettes: Weighing Shed / Counterfeit Pass (not drafted).
- Identity features are locked in narrative ([[Enemy Power]]); code under `src/content/months/tollroad/` still TBD.

## Opening text (draft)

> The month of **Tollroad** has begun.  
> Every mile has a price. The King just got here first.

## Related

- [[Enemies Index]]
- [[Bosses Index]]
- [[Enemy Power]]

- [[Months Index]]
- [[The Calendar]]
- [[_Shared/Music Box Chain|Music Box Chain]]
- [[_Shared/Any-Month Events|Any-Month Events]]
