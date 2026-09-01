---
type: enemy
project: Evershift
status: in-game
role: melee
archetype: skirmisher
primary_location: Tollroad
game_id: goblin
tags:
  - evershift
  - enemy
  - skirmisher
---

# Goblin

A classic **goblin** — preferably with a **club**. On the King's Mile he is the false kingdom's street collector: small, mean, and happy to knock the wind out of anyone who argues the tariff.

## Combat sheet

| Field | Value |
|---|---|
| Role | melee |
| Archetype | `skirmisher` (HP ×1.0 · ATK ×1.0) |
| Game id | `goblin` |
| Status | in-game |
| Primary location | [[Tollroad]] |
| Place | [[Tollroad#The King's Mile]] |
| Readable type | Classic goblin (club preferred) |

Power: `band(floor) × archetype` — see [[Enemy Power]] and `docs/BALANCE.md`.

## Feature

`club_stun` — on each hit, **5%** chance to **stun** the player: they skip their next turn (no player action that turn).

## Art note

Readable as a **classic goblin**. Prefer a club over a blade. Toll badge optional. No locked outfit.

## Related

- [[Enemies Index]]
- [[Tollroad]]
- Place: [[Tollroad#The King's Mile]]
- [[Enemy Power]]
- [[Locations Index]]

In-game id: `goblin` (`src/content/cards/enemies.js`).
