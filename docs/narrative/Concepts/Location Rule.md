---
type: concept
project: Evershift
status: canon
tags:
  - evershift
  - locations
  - content-rule
---

# Location Rule

A **location** is one self-contained fifteen-day passage through a particular
piece of a country reached through a Waystar door. It is not a month, a global
biome rotation, or the whole country. The door fixes one traversable cut of the
world: a road, cave descent, castle approach, fairground, crater route, or other
bounded passage that can end at a boss.

[[Tollroad]] is the reference implementation. Every finished location follows
the same contract.

## Required contract

1. **Door and promise.** A unique door image, name, place, and short pitch on
   the act-selection screen. The pitch establishes the fantasy without revealing
   whether the road is true.
2. **Arrival.** A short opening scene that shows the passage through the door,
   establishes where the hero emerged, and states the immediate pressure.
3. **Setting.** One strong theme and one bounded signature place. The next
   fifteen days must feel like movement through this same passage.
4. **Cast.** Three melee enemies, two ranged enemies, and one named boss. Their
   silhouettes, mechanics, and language belong to the setting.
5. **Local events.** A location-owned event pool. Shared events may still occur,
   but cannot replace the local identity.
6. **Narrative spine.** Optional mandatory checkpoints at declared days/floors.
   They appear on the map, cannot be bypassed, and change state in the same run.
7. **Boss ending.** A post-boss narrative scene. On a true road it advances the
   macro-plot; on a wrong road it clearly closes the local story and says the
   Waystar still points elsewhere.
8. **Exit.** The next door opens after the boss. Any completed location advances
   the act; truth changes meaning, never access.

## Runtime shape

The code-facing rule is assembled by `src/content/locations/rules.js`:

```text
location identity + enemy/event pack
  + optional intro scene
  + optional mandatory checkpoints
  + optional post-boss scene
```

Content packs live in `src/content/location-packs/<id>/`. The old “month” names
are permitted only in save-migration aliases (`calendarMonthIndex`,
`pinCalendarMonth`) until the frozen save contract can be bumped safely.

## Tollroad as the reference

- Door/promise: Tollroad — The King's Mile — a tax in a new god's name.
- Arrival: `TollroadIntroScene`.
- Cast: Goblin, Highway Cutpurse, Toll Brute, Goblin Archer, Road Sniper;
  Goblin King as boss.
- Local events: toll collectors, arm wrestling, crystal mine, royal bridge,
  throne hall and their support beats.
- Mandatory spine: days 5, 10, 12, and 14.
- Boss ending: `TollroadAftermathScene`; the King names the Magus and the
  pendant awakens.
- Exit: reward, then the three Act 2 doors.

## Acceptance checklist

A location is “full” only when its door, arrival, roster, local events,
checkpoints (if any), boss, ending, localization, art preload, sandbox access,
and save/continue behavior all work together. A roster alone is a content pack,
not a completed location.

## Related

- [[Locations Index]]
- [[Run Structure]]
- [[The Path]]
- [[The True Path]]
- [[Tollroad]]
