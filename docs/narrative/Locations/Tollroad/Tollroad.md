---
type: location
project: Evershift
status: canon-draft
act: 1
true_path: true
name: Tollroad
theme: False kingdom
place: The King's Mile
boss: Goblin King
melee_count: 3
ranged_count: 2
archetypes: skirmisher,swarm,bruiser,artillery,artillery
tags:
  - evershift
  - location
  - act-1
  - true-path
---

# Tollroad

> [!info] Location — Act 1 (**true road**)
> The King's Mile. The Goblin King names a new deity and points at the carnival. See [[The True Path]], [[Locations Index]].

A **real mile of road** with booths, chains, and stolen banners. A greedy Goblin King stamped a fake kingdom onto it: tariffs, "guards," scrap seals. This is not random banditry. It is a **false kingdom** — a price on every mile, now collected **in a god's name the goblins did not invent**.

## Theme

False kingdom — whoever stamps the pass owns the way

## Place

### The King's Mile

**The King's Mile** is the signature place of this location.

Booths, barriers, and overpainted crests line a road that used to belong to everyone. Someone is always collecting. Carnival posters — brass lanterns, a painted sphere — are nailed to the booths. The goblins cannot read them well. They copy the seal onto tax chits anyway.

Roster encountered here: [[Goblin]], [[Highway Cutpurse]], [[Toll Brute]], [[Goblin Archer]], [[Road Sniper]].
Boss: [[Goblin King]].

> [!note] Art direction
> Brief enemies as **clear fantasy archetypes** (goblin thug, thief, club brute, archer, king). Location context = toll / badge / barrier — not a locked costume sheet. Leave silhouette and kit details open.

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
| [[Goblin King]] | in-game | False sovereign. Names the new deity; points at the Night Fair. Echoes [[Toll Collectors]]. |

> [!note] Links
> Enemy and boss names link to [[Enemies Index]] / [[Bosses Index]] pages.

## Features

- A false state plants tolls, passes, and "law" on the open road.
- The tax is collected **in the name of a new deity** taught by carnival priests (see [[The True Path]]).
- Coin walks off the Mile: cutpurses take purse, collectors take "tax."
- Goblin pack tactics: stun clubs, armor-slipping arrows, and brutes who rally other goblins.
- Scrap-tech goblins thrive in the King's shadow (engineer, jury-rigged gear).

## Events

- [[Toll Collectors]] — The Goblin King's tax men block the road. Pay, intimidate, fight, or wait — choices spill into the boss fight and shops.

## Soft fits

- [[Goblin Engineer]] _(sequence)_ — Any-location [[Event Sequences|Event Sequence]] beat. A goblin offers to repair the Latchbox.

## Gaps

- Optional vignettes: Weighing Shed / Counterfeit Pass (not drafted).
- Identity features locked in code under `src/content/months/tollroad/`.

## Opening text (draft)

> **Tollroad.** The King's Mile.
> Every mile has a price. The King taxes it for a god he cannot pronounce.

## After the boss (true road)

> The King named a god. The Waystar burns toward the lanterns.

## Related

- [[Enemies Index]]
- [[Bosses Index]]
- [[Enemy Power]]

- [[Locations Index]]
- [[The Calendar]]
- [[Music Box Chain]]
- [[Event Sequences]]
- [[Any-Location Events]]
