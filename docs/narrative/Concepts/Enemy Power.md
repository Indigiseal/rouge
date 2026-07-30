---
type: concept
project: Evershift
status: canon-draft
tags:
  - evershift
  - combat
  - balance
---

# Enemy Power

How month faces stay readable while difficulty follows the calendar day (floor).

## Split

- **Month** → who appears (3 melee + 2 ranged + boss), tone, feature text
- **Floor / day** → which **power band** supplies base HP / ATK
- **Archetype** → shape multipliers on that band

A Wolf in Thornwake as act 1 and the same Wolf when Thornwake is act 3 share identity; only the band changes.

## Bands (summary)

Full numbers live in repo balance docs: `docs/BALANCE.md` → **Enemy power: bands + archetypes**.

| Band | Floors | Role on the curve |
|---|---|---|
| A | 1–4 | early act 1 |
| B | 5–9 | mid act 1 |
| C | 10–15 | late act 1 (boss carries the finale spike) |
| D | 16–22 | act 2 open (gate spike) |
| E | 23–30 | mid/late act 2 |
| F | 31–37 | act 3 open (gate spike) |
| G | 38–45 | late act 3 |

Skirmisher uses the band verbatim. Other archetypes multiply HP/ATK.

## Archetypes

| Archetype | Feel |
|---|---|
| skirmisher | default melee |
| bruiser | tankier, slightly softer hit |
| swarm | fragile pressure |
| artillery | ranged: lower HP, higher ATK |

## Pages

Each enemy has a note under `Enemies/`; bosses under `Bosses/`. Month cast tables link to those notes.

## Features

Write monster features as rules without passport damage numbers. Power comes from band + archetype.

**Thornwake (locked in code under `src/content/months/thornwake/`):**

| Enemy | Feature | Rule |
|---|---|---|
| [[Wolf]] | `wolf_pack` | +1 ATK per other revealed living Wolf on the board |
| [[Thorn Ent]] | `thorns_reflect` | On a connecting player weapon hit, deals 1 true damage through armor |
| [[Thorn Sprite]] | `ranged_immune` | Immune to ranged weapons (melee / spells still work) |
| [[Spore Archer]] | `spore_on_hit` | Applies Spored; next player weapon attack has 15% miss, then clears |
| [[Thorn Fairy]] | `veil_flip` | Each of her turns flips face-up (no strike) or strikes then flips face-down |

Other months: features TBD per cast note.


## Related

- [[Enemies Index]]
- [[Bosses Index]]
- [[Run Structure]]
- [[Day and Floor]]
- [[Months Index]]
- [[Design Decisions]]
