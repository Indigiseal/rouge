---
type: event
project: Evershift
status: in-game
event_id: mirror_twin
primary_location: Silkdeep
tags:
  - evershift
  - event
---

# The Mirror Twin

A lost reflection from [[Mirrorwane]], far from home in [[Silkdeep]] or [[Thornwake]]. It copies everything you do and will not let you rest. Distract it with something shiny and sneak away, or give it a Hand Mirror and watch it get sucked inside.

## Choices

| Choice | Needs | Result |
|---|---|---|
| Give him a shard | A loose gem card | Lose the gem. Sneak away, fall into an old pit, find an amulet (uncommon or better). |
| Give him the Gemseeker's Lens | That amulet | Lose the lens. Same pit, amulet rare or better. |
| Give him the Hand Mirror | Hand Mirror amulet | The twin is sucked in. Hand Mirror becomes the Twinned Mirror. |
| Try to out-stare him | Nothing | Nothing. He wanders off eventually. |

## Twinned Mirror (amulet)

- Reflects the **first damaging enemy attack of every fight** back at the attacker, at full damage.
- Works on melee, ranged and boss attacks. The player takes no damage, and the hit's riders (poison, theft, webbing) do not land.
- No durability. Recharges at the start of the next fight.
- HUD: the icon greys out after it fires.
- Art: `relicsOthers` frame 83 (Hand Mirror is frame 82).

## Hand Mirror (amulet)

- Common amulet, found like any other on any floor.
- 5% chance to reflect any enemy attack back at the attacker. You take no damage.

## Placement

| Field | Value |
|---|---|
| Event id | `mirror_twin` |
| Locations | [[Silkdeep]], [[Thornwake]] (once per run) |
| Code | `src/content/events/mirror_twin.js` |

## Full copy

In-game narrative text: `docs/event-stories.md` (The Mirror Twin).

## Related

- [[Mirrorwane]]
- [[Any-Location Events]]
