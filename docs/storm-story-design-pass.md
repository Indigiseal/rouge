# Storm story integration

New bird-family and carnival encounters now begin in Stormhatch in any act.
They share the existing optional event pool; neither is a forced story stop.
Rooms continue to use their existing art and writing. No new rewards, prices,
combat stats or elemental resistances are introduced by this pass.

| Story | New start | Follow-through |
| --- | --- | --- |
| Monster Bird Nest | Stormhatch, once per story progression | Search for the egg or leave. Taking the egg or timing out can anger the mother. The egg uses the existing reward delivery and hatching behavior. |
| Something Wicked | Stormhatch, before the carnival is visited | The hag keeps her existing purchases, clover and refusal penalty. Each existing outcome queues the Brass Wizard. |
| Brass Wizard | Stormhatch after the carnival, or an already queued follow-up | Keeps its existing coin cost, fortune-card reward and card-reroll branches. |

Fresh Storm nests have no brass cog, music-box references or engineer follow-up,
including when the player is carrying a music box from the new Tollroad chain.
Their minigame uses the existing `includeCog: false` variant. Resolution validates
the same condition, so a stale cog flag cannot grant a cog or narrate one.
`birdNestSeen` is saved in story state and prevents fresh repeated nest starts.
Older egg theft/timeout state also counts as having visited the nest.

Existing pending nest and Wizard stories remain playable outside Storm, including
Tollroad, so changing acts/locations cannot strand a queued story. An old queued
nest with an unfinished music box keeps its cog and engineer path; an exploded
box keeps its no-cog nest and engineer farewell. Completed box repairs do not
restart. New Tollroad music boxes still go directly to their engineer.

The mother's anger and once-per-floor pursuit rolls remain unchanged. She can
follow the player beyond Storm. Story state, pending events and anger continue
through saves and existing cross-run story memory. The Test Site now opens the
independent nest and a cog-free engineer repair by default; forced story access
still overrides normal location selection.

`npm run test:storm-stories` exercises the real event picker in all 30 playable
location/act combinations, fresh/legacy nest descriptions and outcomes, cog
exclusions, egg delivery, leaving/timeout, old engineer follow-ups, carnival
refusal and queued Wizard portability, the mother's actual spawn hook and saves.
Tollroad, event-pool, inventory-transaction and Storm mechanics suites remain
regression checks. Visual review of the minigame and carnival is still pending.
