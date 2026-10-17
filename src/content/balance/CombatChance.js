// content/balance/CombatChance.js
// The small, always-on luck in every fight (sigils branch), so no two fights
// play out the same: both sides can crit, dodge and block a little. All under
// 5%. Amulets, armor, sigils and enemy traits stack on top of these.

// The hero.
export const PLAYER_BASE_CRIT = 0.05;   // a hit does double (the shared crit roll)
export const PLAYER_BASE_DODGE = 0.04;  // an enemy hit misses the hero entirely
export const PLAYER_BASE_BLOCK = 0.04;  // an enemy hit is halved (rounded up)

// Every enemy and boss.
export const ENEMY_BASE_EVADE = 0.04;   // the hero's hit misses (an enemy's own evade wins if higher)
export const ENEMY_BASE_CRIT = 0.04;    // its hit does x ENEMY_CRIT_MULT (rounded down)
export const ENEMY_CRIT_MULT = 1.5;
export const ENEMY_BASE_BLOCK = 0.04;   // the hero's hit is halved (rounded up)
