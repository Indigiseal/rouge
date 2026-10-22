# Simulator player-sigil execution

The simulator previously called `CardSystem.attackEnemy` directly for primary
and off-hand weapon hits. This applied native armor/gem/enchantment handling,
but skipped the live inventory's `applyWeaponSigils` and `onWeaponSigilHit` hooks.
Location build effects such as Growth, Echo and Second Wind therefore did not
resolve through its normal attack loop.

`sim/player-weapon-strike.js` now prepares each actual swing in the live order:
exhaustion, permanent class/talent bonuses, conditional/flat sigils, primary
Keen Edge/First Blood and class crit. Off-hand daggers use their own sigils and
the original action's AP snapshot, without receiving primary-only bonuses.
The real `attackEnemy` still resolves armor, evasion, gems, enchantments and pips;
the shared on-hit hook then handles hit/kill effects and guarded extra strikes.
The original struck-card reference is retained when its board slot becomes loot.

The simulator now pays the action and resolves Shock/Frost/Sandstorm holds before
rolling hit preparation or spending a talent/extra axe pip. A missed attack
therefore cannot build Growth, heal through Leech or spend a first-hit talent.
Webbed off-hand daggers are excluded as in live inventory combat. Gameplay code
and balancing values are unchanged by this pass.

`npm run test:sim-player-sigils` compares simulated swings with actual
`InventoryCombatUse.useWeapon` transactions across 22 cases. It compares enemy
state, card state, HP/max HP, AP and currency, covering location sigils, kill
rewards, extra attacks, armor, evasion/streaks, primary talents, off-hand bonuses,
holds, exhaustion and an amulet synergy. Pinned-location simulator smoke runs
check that the full loop still executes; they do not establish balance.

Still incomplete: the tactical forecast uses approximations rather than the
full conditional/proc pipeline, and simulated equipment merging needs its
sigil/enchantment preservation aligned with live merging. Acquisition policy,
station economics and proc-damage breakdowns also need review before drawing
conclusions about the relative strength of new builds.
