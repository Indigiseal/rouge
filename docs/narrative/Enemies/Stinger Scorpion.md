---
type: enemy
project: Evershift
status: proposed
role: ranged
archetype: artillery
primary_location: Silkdeep
game_id: stingerScorpion
tags:
  - evershift
  - enemy
  - artillery
---

# Stinger Scorpion

A cave scorpion that has learned to spend its sting as a bolt. The barb launches, finds flesh, and a new tip is already budding on the tail — the cave does not wait for molting seasons. It does not spin silk. Where venom already runs, the sting makes it meaner.

## Combat sheet

| Field | Value |
|---|---|
| Role | ranged |
| Archetype | `artillery` (HP ×0.7 · ATK ×1.15) |
| Game id | `stingerScorpion` |
| Status | proposed |
| Primary location | [[Silkdeep]] |
| Place | [[Silkdeep#The Silkdeep Caves]] |

Power: `band(floor) × archetype` — see [[Enemy Power]] and `docs/BALANCE.md`.

## Feature

`poison_amp` — on a connecting hit, if the player is already poisoned, **+1 to poison tick damage**. Does nothing without an active poison stack (spiders / traps / other venom). Duration is unchanged; only the per-tick number grows.

## Related

- [[Enemies Index]]
- [[Silkdeep]]
- Place: [[Silkdeep#The Silkdeep Caves]]
- [[Enemy Power]]
- [[Locations Index]]
