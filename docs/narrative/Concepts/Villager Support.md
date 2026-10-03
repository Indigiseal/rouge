---
type: concept
project: Evershift
status: canon-draft
tags:
  - evershift
  - meta
  - village
---

# Villager Support

In-game name (RU): **Поддержка селян**.  
In code the counter is still `xp` on `metaProgression`. The **numbers do not change**. This page is the fiction for that counter, and for what it will buy.

## What the village sees

The villagers do not walk the Path. They see **returns**.

Each time the hero comes home — wounded, empty-handed, or carrying a lesser answer from Act 3 — the village reads how far the rumor reached. A body that fell on day four is one story. A body that fell after a king, a fair, or the Inner Sky is another. The farther the walk (and the bosses named in the telling), the more the village believes this villager is the one who might actually find the source and stop it.

That belief is **Support**. It is not a paycheck and not a prophecy. It is faith made spendable: people who will raise a building because they think the next expedition might finish the road.

A full win (even a wrong Act 3) is still a completed expedition for Support. Mirrorwane and Spherefall are not fake victories. See [[Design Decisions]].

## What Support buys

Meta-progression is **the village**, not a talent tree.

- **Build** a structure → the next expeditions leave with one kind of advantage (the old talent node).
- **Upgrade** that structure → the same advantage grows (the old talent ranks).

The catalog of buildings:

- **Forge** — five ranks. +1 weapon damage per rank, any weapon.
- **Temple** — one rank. Once per run, rise after a killing blow.
- **Armory** — five ranks. Warrior: +1 DEF per rank on armor. Rogue: +10% dodge per rank.
- **Jeweler** — four ranks. At the start of a run, pick 1 of 3 random amulets. Rank sets the rarity: common, uncommon, rare, legendary.
- **Healer's Hut** — four ranks. +15 / +30 / +45 / +60 max HP at the start of a run.

One empty lot sits on the map for a later building. Numbers stay the talent-ladder budget (`2/3/5/8/12`) until a pass retunes them. Live: `VillageScene` spends Support; effects apply on the next leaving. See `docs/MECHANICS.md`.

## What this is not

- Not XP for a class. Support is the village's faith, one shared pool: either walker earns it, either walker spends it.
- Not relics unlocked by dying to a named enemy.
- Not the Waystar "leveling up." The stone still points and still returns the body. The village is what answers the return with timber and work.

## Related

- [[The Village]]
- [[Death and Return]]
- [[Replayability]]
- [[Run Structure]]
