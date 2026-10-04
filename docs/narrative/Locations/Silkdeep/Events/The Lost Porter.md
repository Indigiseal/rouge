---
type: event-chain
project: Evershift
status: proposed
event_id: lost_porter
primary_location: Silkdeep
tags:
  - evershift
  - event
  - chain
---

# The Lost Porter

A simple, cheerful porter hangs in old web, holding a cut rope. He thinks he got lost. In truth his party left him behind. Help him and he walks home along the corridor you already cleared, and gives you the party's map. Later you overhear the party arguing about the missing map.

Tone reference: Dungeon Meshi. Light, kind, a little absurd. No fighting the party, no revenge.

## Part 1 — The Lost Porter

| Choice | Needs | Result |
|---|---|---|
| Give him your armor | An armor card | Lose the armor. Get the Porter's Map. |
| Give him your weapon | A weapon card | Lose the weapon. Get the Porter's Map. |
| Heal him | A potion | Lose the potion. Get the Porter's Map. |
| Point the way and walk on | Nothing | Nothing. He thanks you anyway. |

He is not a fighter and does not want to be an adventurer. He leaves along the path the player has already cleared, so nothing big can find him.

## Part 2 — Voices Around the Corner

Delayed follow-up, a few floors later in the same act. Only if the player has the Porter's Map.

| Choice | Result |
|---|---|
| Sneak past | Keep the map. |
| Confront them | Keep the map. They are embarrassed. |
| Give them back the map | Lose the map. Get nothing but a smug pat on the shoulder. |

## The Porter's Map (amulet)

- Opens a **secret floor in each act** for the rest of the run.
- On the run map, the secret branch appears in **its own colour**, different from normal and detour nodes.
- The map can leave the player in two ways: returned to the party (Part 2, no reward), or given to a lost creature from another biome (see Lost Far From Home, +1 inventory slot).

## Implementation notes

- Flags: `storyRun.porterHelped`, `storyRun.porterMap`.
- Part 2 is queued like the [[Music Box Chain]] beats (pending event).
- Map screen: `MapViewScene` already tints detour nodes gold (`DETOUR_TINT`). The secret branch needs a new node state and colour, plus a branch added in `MapGenerator` while the map is held.
- Extra inventory slot reward uses the existing `gameState.bonusInventorySlots`.

## Full copy

In-game narrative text: `docs/event-stories.md` (The Lost Porter, Voices Around the Corner). Code: the events in `src/content/location-packs/silkdeep/events/`; the secret branch in `src/map/HiddenPaths.js` (one good-chest room per act, off a normal road, drawn purple by `MapViewScene` while the map is held).

## Related

- [[Silkdeep]]
- [[Event Sequences]]
- [[Encounter Philosophy]]
