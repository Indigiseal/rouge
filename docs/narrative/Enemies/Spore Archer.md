---
type: enemy
project: Evershift
status: proposed
role: ranged
archetype: artillery
primary_month: Thornwake
game_id: sporeArcher
tags:
  - evershift
  - enemy
  - artillery
---

# Spore Archer

Small awakened mushrooms of the Briar March — sporelings that have learned to throw what they grow. They stand barely knee-high, caps soft and pale, stalks faintly lit with a sickly green glow. From under the brim hang damp spore-sacs; what pass for arms cradle those orbs and hurl them at anything that walks the Path. Where a sac bursts, the air turns thick and the next swing often goes wide.

## Combat sheet

| Field | Value |
|---|---|
| Role | ranged |
| Archetype | `artillery` (HP ×0.7 · ATK ×1.15) |
| Game id | `sporeArcher` |
| Status | proposed |
| Primary month | [[Thornwake]] |
| Location | [[Thornwake#The Briar March]] |

Power: `band(floor) × archetype` — see [[Enemy Power]] and `docs/BALANCE.md`.

## Feature

`spore_on_hit` — on attack, applies **Spored**. The player's next weapon attack has a **15%** chance to miss, then the status clears.

## Related

- [[Enemies Index]]
- [[Thornwake]]
- Location: [[Thornwake#The Briar March]]
- [[Enemy Power]]
- [[Months Index]]
