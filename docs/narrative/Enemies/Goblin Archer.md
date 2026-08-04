---
type: enemy
project: Evershift
status: in-game
role: ranged
archetype: artillery
primary_month: Tollroad
game_id: goblin_archer
tags:
  - evershift
  - enemy
  - artillery
---

# Goblin Archer

A classic **goblin archer** — roadside ambush, not a parade soldier. On the King's Mile he is "licensed" violence: shots that sometimes slip past plating as if the King stamped a waiver on your armor.

## Combat sheet

| Field | Value |
|---|---|
| Role | ranged |
| Archetype | `artillery` (HP ×0.7 · ATK ×1.15) |
| Game id | `goblin_archer` |
| Status | in-game |
| Primary month | [[Tollroad]] |
| Location | [[Tollroad#The King's Mile]] |
| Readable type | Goblin archer |

Power: `band(floor) × archetype` — see [[Enemy Power]] and `docs/BALANCE.md`.

## Feature

`ignore_armor` — on each attack, **after** hit/miss is resolved (dodge / miss first — same timing family as warrior **plate** `rangedIgnoreChance`, but inverted): if the shot **lands**, **10%** chance to **ignore equipped armor** for that hit — DEF does not reduce damage, and the armor does **not** lose durability from this hit.

## Art note

Readable as a **goblin with a bow** (or short / scrap bow). Pose and kit open.

## Related

- [[Enemies Index]]
- [[Tollroad]]
- Location: [[Tollroad#The King's Mile]]
- [[Enemy Power]]
- [[Months Index]]

In-game id: `goblin_archer` (`src/content/cards/enemies.js`).
