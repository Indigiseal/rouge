// sim/balance-sim.js
// Headless Monte-Carlo balance simulator.
//
// Reuses the REAL combat code (CardSystem.spawnFloorCards / revealCard /
// attackEnemy, GameState.takeDamage, AmuletManager modifiers) via a mock
// scene, and reimplements only the turn loop, a bot policy, and the
// station-room economy. Run with:  node sim/balance-sim.js  [runs]
//
// NOTE on fidelity:
//  - Combat resolution (damage, ranged 0.8x, melee frontline gating, weapon
//    durability, enemy attack vs armor) is the REAL game code.
//  - Floor composition (card counts, enemy/loot mix, roles) is REAL
//    (spawnFloorCards).
//  - Station rooms (shop/treasure/rest/anvil) use approximate economy models
//    documented inline — refine these as needed.
//  - Baseline carries NO meta relics and buys NO amulets.

import { MockScene } from './mock.js'; // also installs globalThis.Phaser + localStorage
import { GameState } from '../gameState.js';
import { CardSystem } from '../cardSystem.js';
import { AmuletManager } from '../AmuletManager.js';
import { MetaProgressionManager } from '../MetaProgressionManager.js';
import { MapGenerator } from '../utils/MapGenerator.js';

// ── Config ────────────────────────────────────────────────────────────────
const RUNS = parseInt(process.argv[2], 10) || 2000;
const MAX_FLOOR = 45;
const BOSS_FLOORS = new Set([15, 30, 45]);

// Room-type mix for non-boss floors (approximates the map generator's feel).
function roomTypeForFloor(floor) {
  if (BOSS_FLOORS.has(floor)) return 'BOSS';
  if (floor === 1) return 'COMBAT';
  if (floor % 5 === 0) return 'REST';
  if (floor % 5 === 3) return 'SHOP';
  if (floor % 6 === 2) return 'ANVIL'; // blacksmith — repair durability
  if (floor % 7 === 0) return 'TREASURE';
  if (Math.random() < 0.18) return 'ELITE';
  return 'COMBAT';
}

const COMBAT_ROOMS = new Set(['COMBAT', 'ELITE', 'BOSS']);

// ── One game ────────────────────────────────────────────────────────────
function setupRun() {
  const mock = new MockScene();
  const gs = new GameState(mock);
  mock.gameState = gs;
  mock.amuletManager = new AmuletManager(mock);
  mock.cardSystem = new CardSystem(mock);
  // Light inventory stub: combat only needs getCurrentWeapon + slots shape.
  // A few amulets (Bottomless Bag, etc.) poke inventory methods on equip.
  mock.inventorySystem = {
    getCurrentWeapon: () => gs.equippedWeapon,
    slots: [],
    slotSprites: [],
    discardArea: null,
    addCard: () => true,
    addCardDirect: () => true,
    removeCard: () => {},
    updateTwinkleEffects: () => {},
    rebuildInventorySprites: () => {},
    expandInventory: (n = 0) => { gs.bonusInventorySlots = (gs.bonusInventorySlots || 0) + n; },
    addInventorySlots: (n = 0) => { gs.bonusInventorySlots = (gs.bonusInventorySlots || 0) + n; },
  };
  return { mock, gs };
}

function startingInventory() {
  return [
    { type: 'weapon', name: 'Common Sword', weaponType: 'sword', damage: 6, rarity: 'common', durability: 6, maxDurability: 6, range: 'melee' },
    { type: 'weapon', name: 'Uncommon Sword', weaponType: 'sword', damage: 7, rarity: 'uncommon', durability: 8, maxDurability: 8, range: 'melee' },
  ];
}

const armorScore = (a) => (a && a.durability > 0 ? (a.protection || 0) : -1);

// ── Merging (mirrors inventorySystem: same type+rarity → next rarity, refreshed
// durability, gems carried). Damage/durability pulled from the REAL tables. ──
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const nextRarity = (r) => RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(r) + 1)];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
// Durability map copied from CardDataGenerator.createWeaponCard.
const WEAPON_DUR = {
  dagger: { common: 4, uncommon: 5, rare: 6, epic: 7, legendary: 8 },
  spear: { common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9 },
  sword: { common: 6, uncommon: 8, rare: 10, epic: 11, legendary: 13 },
  axe: { common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14 },
};

function mergeWeapons(gen, a, b, floor = 0) {
  const type = a.weaponType;
  const r = nextRarity(a.rarity);
  const dmg = gen.weaponUnlocks?.[type]?.[r]?.damage ?? ((a.damage || 1) + 1);
  const dur = WEAPON_DUR[type]?.[r] ?? (a.maxDurability || 6);
  const merged = {
    type: 'weapon', name: `${cap(r)} ${cap(type)}`, weaponType: type,
    damage: dmg, rarity: r, durability: dur, maxDurability: dur, range: a.range || 'melee',
  };
  const g = a.gemEffect ? a : (b.gemEffect ? b : null); // carry sockets
  if (g) { merged.gemEffect = g.gemEffect; merged.gemCount = g.gemCount; merged.gemName = g.gemName; merged.gemColor = g.gemColor; }
  return merged;
}

const ARMOR_DUR = { common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 };
function mergeArmor(gen, a, b, floor = 0) {
  const type = a.armorType;
  const r = nextRarity(a.rarity);
  const prot = gen.armorUnlocks?.[type]?.[r]?.protection ?? ((a.protection || 1) + 1);
  const dur = ARMOR_DUR[r] ?? (a.maxDurability || 25);
  return {
    type: 'armor', name: `${cap(r)} ${cap(type)} Armor`, armorType: type,
    protection: prot, rarity: r, durability: dur, maxDurability: dur,
    dodgeChance: a.dodgeChance || 0, reflection: a.reflection || 0,
  };
}
function mergeArmorList(gen, list, echoChance = 0, tracker = null, floor = 0) {
  let changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    outer:
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.armorType && a.armorType === b.armorType && a.rarity === b.rarity &&
            RARITY_ORDER.indexOf(a.rarity) < RARITY_ORDER.length - 1) {
          const m = mergeArmor(gen, a, b, floor);
          list.splice(j, 1); list.splice(i, 1); list.push(m);
          if (tracker) tracker.recordMerge('armor', m.rarity, floor);
          // Echo Stone: 10% chance one source armor respawns (refreshed durability)
          if (echoChance > 0 && Math.random() < echoChance) {
            const echo = Math.random() < 0.5 ? { ...a } : { ...b };
            echo.durability = echo.maxDurability;
            list.push(echo);
          }
          changed = true; break outer;
        }
      }
    }
  }
}

// Greedily merge every same-type/same-rarity weapon pair (cascades upward).
// echoChance: Echo Stone relic — 10% chance one source card respawns after merge.
function mergeWeaponList(gen, list, echoChance = 0, tracker = null, floor = 0) {
  let changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    outer:
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.weaponType && a.weaponType === b.weaponType && a.rarity === b.rarity &&
            RARITY_ORDER.indexOf(a.rarity) < RARITY_ORDER.length - 1) {
          const merged = mergeWeapons(gen, a, b, floor);
          list.splice(j, 1); list.splice(i, 1); list.push(merged);
          if (tracker) tracker.recordMerge('weapon', merged.rarity, floor);
          // Echo Stone: 10% chance one source card respawns (refreshed at its original rarity)
          if (echoChance > 0 && Math.random() < echoChance) {
            const echo = Math.random() < 0.5 ? { ...a } : { ...b };
            echo.durability = echo.maxDurability; // respawned fresh
            list.push(echo);
          }
          changed = true; break outer;
        }
      }
    }
  }
}

// Weapon desirability: prefer raw damage, but strongly avoid daggers — only
// equip one if nothing else is usable.
function wpnValue(w) {
  if (!w || w.durability <= 0) return -1;
  let v = (w.damage || 0) + (w.gemEffect ? 1 : 0);
  if (w.weaponType === 'dagger') v -= 100;
  return v;
}

// Thorns merging: two equal-damage thorns → stronger thorns with refreshed
// durability (mirrors inventorySystem merge for thorns). The bot "always
// carries and merges thorns," so we accumulate and fuse them.
function mergeThornsList(list) {
  let changed = true, guard = 0;
  while (changed && guard++ < 40) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if ((list[i].thornDamage || 0) === (list[j].thornDamage || 0)) {
          const a = list[i], b = list[j];
          const dmg = Math.max(a.thornDamage || 1, b.thornDamage || 1) + 2;
          const dur = Math.max(a.maxDurability || 3, b.maxDurability || 3) + 1;
          list.splice(j, 1); list.splice(i, 1);
          list.push({ type: 'thorns', name: 'Thorns Card', thornDamage: dmg, durability: dur, maxDurability: dur, rarity: nextRarity(a.rarity || 'common') });
          changed = true; break;
        }
      }
      if (changed) break;
    }
  }
}

// Merge what we can, then equip the best weapon (dagger-averse), armor, and
// carry the strongest thorns card (passively reflects to melee attackers).
function regear(gen, gs, inv) {
  const tracker = gs._mergeTracker || null;
  void tracker; // used implicitly via mergeWeaponList/mergeArmorList args below
  // Keep broken weapons/armor/thorns too — they still merge into fresh,
  // full-durability higher tiers (a key way to recover from breakage).
  const weapons = inv.filter((c) => c.type === 'weapon');
  const armors = inv.filter((c) => c.type === 'armor');
  const thorns = inv.filter((c) => c.type === 'thorns');
  const rest = inv.filter((c) => c.type !== 'weapon' && c.type !== 'armor' && c.type !== 'thorns');
  if (gs.equippedWeapon) weapons.push(gs.equippedWeapon);
  if (gs.equippedArmor) armors.push(gs.equippedArmor);
  if (gs.activeThorns && !thorns.includes(gs.activeThorns)) thorns.push(gs.activeThorns);

  const echoChance = gs.relicEffects?.mergeRespawnChance || 0;
  mergeWeaponList(gen, weapons, echoChance, gs._mergeTracker || null, gs.currentFloor || 0);
  mergeArmorList(gen, armors, echoChance, gs._mergeTracker || null, gs.currentFloor || 0);
  mergeThornsList(thorns);

  weapons.sort((a, b) => wpnValue(b) - wpnValue(a));
  // Protect a strong weapon on its LAST pip: if the best weapon is at 1
  // durability and a backup with spare pips exists, wield the backup and keep
  // the strong (likely gemmed) weapon in reserve to repair/merge — never let
  // it break and vanish.
  let pickIdx = 0;
  if (weapons[0] && weapons[0].durability === 1) {
    const backup = weapons.findIndex((w, i) => i > 0 && w.durability > 1);
    if (backup >= 0) pickIdx = backup;
  } else if (!(weapons[0] && weapons[0].durability > 0)) {
    pickIdx = weapons.findIndex((w) => w.durability > 0);
    if (pickIdx < 0) pickIdx = 0;
  }
  gs.equippedWeapon = weapons.splice(pickIdx, 1)[0] || null;
  if (gs._superWeapon) gs.equippedWeapon = gs._superWeapon; // isolation test: never swap it out
  // Equip the highest-protection armor that still has durability.
  armors.sort((a, b) => armorScore(b) - armorScore(a));
  const usableArmor = armors.findIndex((a) => a.durability > 0);
  gs.equippedArmor = usableArmor >= 0 ? armors.splice(usableArmor, 1)[0] : (armors.shift() || null);
  // Carry the strongest thorns that still has durability.
  thorns.sort((a, b) => (b.thornDamage || 0) - (a.thornDamage || 0));
  const usableThorns = thorns.findIndex((t) => (t.durability ?? 0) > 0);
  gs.activeThorns = usableThorns >= 0 ? thorns.splice(usableThorns, 1)[0] : null;

  inv.length = 0;
  inv.push(...weapons, ...armors, ...thorns, ...rest);
}

function isMelee(w) { return !w || w.range !== 'ranged'; }

// Collect a freshly revealed non-enemy card: apply its effect, drop from board.
function collectLoot(mock, gs, inv, idx) {
  const card = mock.cardSystem.boardCards[idx];
  if (!card || !card.data) return;
  const d = card.data;
  switch (d.type) {
    case 'coin': gs.coins += d.amount || 0; break;
    case 'crystal': gs.crystals += d.amount || 0; break;
    case 'food': gs.actionsLeft = Math.min(gs.maxActions, gs.actionsLeft + (d.actionAmount || 0)); break;
    case 'potion': inv.push(d); break; // used later when hurt
    case 'trap':
      gs.takeDamage(d.damage || d.attack || 5, -1, 'trap');
      if (gs.playerHealth <= 0) mock._lastKiller = 'trap';
      break;
    case 'weapon': case 'armor': inv.push(d); break;
    case 'gem': inv.push(d); mock._gemsSeen = (mock._gemsSeen || 0) + 1; (mock._gemFloors || (mock._gemFloors = [])).push(gs.currentFloor); break; // kept for socketing into weapons
    case 'thorns': inv.push(d); break; // always carried + merged
    case 'amulet': // equip dropped amulets (skip cursed — unbalanced)
      if (d.id && d.rarity !== 'cursed' && !d.cursed) mock.amuletManager.addAmulet(d.id);
      break;
    case 'magic': // keep only Restoration (full HP+AP); discard the rest
      if (d.magicType === 'restoration') inv.push(d);
      break;
    default: break; // empty/key — nothing
  }
  mock.cardSystem.removeCard(idx);
}

// Use a Restoration magic card (full HP + AP) when starving for AP or low HP.
function maybeRestore(mock, gs, inv) {
  if (gs.actionsLeft > 0 && gs.playerHealth > gs.maxHealth * 0.4) return;
  const ri = inv.findIndex((c) => c.type === 'magic' && c.magicType === 'restoration');
  if (ri < 0) return;
  gs.playerHealth = gs.maxHealth;
  gs.actionsLeft = gs.maxActions;
  inv.splice(ri, 1);
  mock._restorationUses = (mock._restorationUses || 0) + 1;
}

// Socket available gems into the equipped weapon (rules mirror
// inventorySystem.applyGemToWeapon: weapons only, max 3, same type only).
// Strategy: poison for bosses/high-HP, lightning when back-row enemies exist,
// fire when there's a face-down cluster to burn; otherwise poison.
function socketGems(gs, inv, ctx) {
  const w = gs.equippedWeapon;
  if (!w || w.type !== 'weapon') return;
  const gems = inv.filter((c) => c.type === 'gem');
  if (!gems.length) return;

  let pref = w.gemEffect || null; // weapon locks to one gem type
  if (!pref) {
    const have = (e) => gems.some((g) => g.gemEffect === e);
    if (ctx.boss && have('poison')) pref = 'poison';
    else if (ctx.ranged && have('lightning')) pref = 'lightning';
    else if (ctx.hiddenCluster && have('fire')) pref = 'fire';
    else pref = have('poison') ? 'poison' : (have('lightning') ? 'lightning' : gems[0].gemEffect);
  }
  for (let i = inv.length - 1; i >= 0; i--) {
    const g = inv[i];
    if (g.type !== 'gem' || g.gemEffect !== pref) continue;
    const count = w.gemEffect ? (w.gemCount || 1) : 0;
    if (count >= 3) break;
    w.gemEffect = g.gemEffect; w.gemName = g.name; w.gemColor = g.color;
    w.gemCount = count + 1;
    inv.splice(i, 1);
  }
}

function maybeHeal(gs, inv) {
  if (gs.playerHealth > gs.maxHealth * 0.5) return;
  const pi = inv.findIndex((c) => c.type === 'potion');
  if (pi >= 0) { gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + (inv[pi].healAmount || 20)); inv.splice(pi, 1); }
}

function aliveEnemies(board, revealedOnly) {
  const out = [];
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    if (c && (c.data?.type === 'enemy' || c.data?.type === 'boss') && c.data.health > 0) {
      if (!revealedOnly || c.revealed) out.push(i);
    }
  }
  return out;
}

// Is any MELEE-role enemy still alive (revealed and/or hidden)? Mirrors
// CardSystem._anyMeleeAlive — used to know a melee weapon's hits on archers
// are blocked by the frontline.
function anyMeleeAlive(board, includeHidden) {
  for (const c of board) {
    if (!c || !(c.data?.type === 'enemy' || c.data?.type === 'boss')) continue;
    if (c.data.health <= 0 || c.data.role !== 'MELEE') continue;
    if (includeHidden || c.revealed) return true;
  }
  return false;
}

function computeContext(board, floor) {
  let boss = BOSS_FLOORS.has(floor), ranged = false, hidden = 0;
  for (const c of board) {
    if (!c) continue;
    if (!c.revealed) hidden++;
    if (c.data?.type === 'boss') boss = true;
    if ((c.data?.type === 'enemy' || c.data?.type === 'boss') && c.data.role === 'RANGED') ranged = true;
  }
  return { boss, ranged, hiddenCluster: hidden >= 4 };
}

function runCombat(mock, gs, inv, floor) {
  // Grace is now per-enemy (card.justRevealed, set in the real revealCard) — no
  // global first-turn skip. A freshly revealed enemy sits out only its reveal action.
  mock.isEnemyTurn = false;
  mock._enemyTurnPending = false;
  mock.enemiesCleared = false;
  mock.dead = false;
  mock.cardSystem.spawnFloorCards();
  regear(mock.cardSystem.cardDataGenerator, gs, inv);

  let guard = 0;
  while (guard++ < 500) {
    if (gs.playerHealth <= 0) break;
    const board = mock.cardSystem.boardCards;

    // Re-evaluate context and socket any collected gems (no-op when none).
    socketGems(gs, inv, computeContext(board, floor));
    // Pop a Restoration card if starving for AP or low on HP.
    maybeRestore(mock, gs, inv);
    // If armor broke mid-fight, swap to a spare so we're not eating full hits.
    if ((!gs.equippedArmor || gs.equippedArmor.durability <= 0) &&
        inv.some((c) => c.type === 'armor' && c.durability > 0)) {
      regear(mock.cardSystem.cardDataGenerator, gs, inv);
    }

    // 1) Pick an attack target, respecting the melee frontline gate.
    const revealed = aliveEnemies(board, true);
    let attackIdx = -1;
    if (revealed.length) {
      const w = gs.equippedWeapon;
      if (w && isMelee(w) && anyMeleeAlive(board, true)) {
        // Melee weapon is blocked from hitting archers while ANY melee (even
        // hidden) lives. Only revealed MELEE are valid targets.
        const meleeTargets = revealed.filter((i) => board[i].data.role === 'MELEE');
        if (meleeTargets.length) {
          meleeTargets.sort((a, b) => board[a].data.health - board[b].data.health);
          attackIdx = meleeTargets[0];
        }
        // else: only archers revealed but a hidden melee blocks them — do NOT
        // waste a hit on the (blocked) archer; fall through to REVEAL and hunt
        // the melee instead (key tactic the bot was missing).
      } else {
        // Ranged weapon (spear bypasses the gate) or no melee blockers → hit
        // the lowest-HP revealed enemy.
        const t = revealed.slice().sort((a, b) => board[a].data.health - board[b].data.health);
        attackIdx = t[0];
      }
    }
    if (attackIdx >= 0) {
      if (!gs.equippedWeapon || gs.equippedWeapon.durability <= 0) regear(mock.cardSystem.cardDataGenerator, gs, inv);
      // Exhaustion penalty: attacks while out of AP deal 20% less (real game rule).
      const wasExhausted = gs.actionsLeft <= 0;
      const effDmg = (wp) => {
        const d = wp ? wp.damage : 1;
        return wasExhausted ? Math.ceil(d * 0.8) : d;
      };

      // --- Economical weapon choice (mirrors a smart player dragging the RIGHT
      // weapon onto an enemy). Each swing is still ONE action; the only thing
      // optimized is which weapon's durability is spent. If any usable weapon
      // would one-shot the target, swing the WEAKEST such weapon to conserve the
      // strong (often gemmed) one; otherwise swing the strongest to chunk it. ---
      const targetCard = board[attackIdx];
      const targetHP = targetCard?.data?.health ?? 0;
      const targetIsRanged = targetCard?.data?.role === 'RANGED';
      const meleeBlocked = targetIsRanged && anyMeleeAlive(board, true);
      const canHit = (wp) => !meleeBlocked || !isMelee(wp);
      const roster = [];
      if (gs.equippedWeapon && gs.equippedWeapon.durability > 0) roster.push(gs.equippedWeapon);
      for (const c of inv) if (c.type === 'weapon' && c.durability > 0) roster.push(c);
      const usable = roster.filter(canHit);
      let chosen = gs.equippedWeapon;
      if (usable.length) {
        const finishers = usable.filter((wp) => effDmg(wp) >= targetHP).sort((a, b) => effDmg(a) - effDmg(b));
        chosen = finishers.length ? finishers[0] : usable.slice().sort((a, b) => effDmg(b) - effDmg(a))[0];
      }
      // Swap the chosen weapon into the equipped slot so the REAL attackEnemy
      // (which decrements gameState.equippedWeapon) spends ITS durability.
      if (chosen && chosen !== gs.equippedWeapon) {
        const idx = inv.indexOf(chosen);
        if (idx >= 0) {
          inv.splice(idx, 1);
          if (gs.equippedWeapon) inv.push(gs.equippedWeapon);
          gs.equippedWeapon = chosen;
        }
      }

      const dmg = effDmg(gs.equippedWeapon);
      mock.useAction();
      mock.cardSystem.attackEnemy(attackIdx, dmg, false, gs.equippedWeapon || null);
      if (!gs.equippedWeapon || gs.equippedWeapon.durability <= 0) regear(mock.cardSystem.cardDataGenerator, gs, inv);
      mock.resolvePendingEnemyTurn();
      maybeHeal(gs, inv);
      continue;
    }

    // 2) No revealed enemies → flip the next face-down card.
    let nextUnrevealed = -1;
    for (let i = 0; i < board.length; i++) {
      if (board[i] && !board[i].revealed) { nextUnrevealed = i; break; }
    }
    if (nextUnrevealed >= 0) {
      mock.cardSystem.revealCard(nextUnrevealed); // calls useAction internally
      const c = board[nextUnrevealed];
      if (c && c.revealed && c.data?.type !== 'enemy' && c.data?.type !== 'boss') {
        collectLoot(mock, gs, inv, nextUnrevealed);
        regear(mock.cardSystem.cardDataGenerator, gs, inv);
      }
      mock.resolvePendingEnemyTurn();
      maybeHeal(gs, inv);
      continue;
    }

    // 3) Nothing left to reveal and no revealed enemies → floor cleared.
    break;
  }

  // Floor-clear reward (mirrors GameScene.floorCleared base payout, cut hard).
  if (gs.playerHealth > 0) gs.coins += 1 + Math.floor(floor / 3);
}

// ── Station rooms (approximate economy) ───────────────────────────────────
function runRest(gs) {
  gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + Math.floor(gs.maxHealth * 0.3));
  gs.actionsLeft = gs.maxActions;
}

// Events are still placeholders in the real game, so model them as a NEUTRAL
// non-combat breather (no reward, no attrition). We'll flesh these out only
// after the core combat/economy is tuned.
// Event rooms (caravan/hermit/crossroads) now reward gems on most branches.
// Modeled as: ~70% chance of a gem drop, plus the small coin/heal/crystal mix
// that the real branches give. Inventory bot grabs the gem for socketing.
function runEvent(mock, gs, inv, floor) {
  gs.coins += 8 + Math.floor(floor / 6);
  if (Math.random() < 0.4) gs.crystals += 1;
  if (gs.playerHealth < gs.maxHealth) {
    gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 5);
  }
  if (Math.random() < 0.7) {
    const gem = mock.cardSystem.cardDataGenerator.createGemCard(floor);
    if (gem) {
      inv.push(gem);
      mock._gemsSeen = (mock._gemsSeen || 0) + 1;
      (mock._gemFloors || (mock._gemFloors = [])).push(floor);
    }
  }
}

function shopPrice(item, floor) {
  let p = 5 + floor * 2;
  const mult = { common: 1, uncommon: 1.5, rare: 2, epic: 2.5, legendary: 3 }[item.rarity] || 1;
  p *= mult;
  if (item.type === 'weapon') p += item.damage || 0;
  else if (item.type === 'armor') p += (item.protection || 0) * 2;
  return Math.floor(p);
}

function runShop(mock, gs, inv, floor) {
  const cs = mock.cardSystem;
  // Shop = the main upgrade hub: buy weapons (upgrades + merge fodder), armor,
  // thorns (always — you carry & merge them), a potion, and an amulet if we
  // have crystals. Extra armor offers so the bot can actually build a merge
  // line (its armor was scaling far too slowly while it hoarded coins).
  const offers = [
    cs.createCardData('weapon', floor), cs.createCardData('weapon', floor),
    cs.createCardData('armor', floor), cs.createCardData('armor', floor), cs.createCardData('armor', floor),
    cs.createCardData('thorns', floor),
    cs.createCardData('potion', floor),
  ].filter(Boolean);
  const eqDmg = gs.equippedWeapon?.damage || 0;
  const matchesForMerge = (w) => [...inv, gs.equippedWeapon].some(
    (c) => c && c.type === 'weapon' && c.weaponType === w.weaponType && c.rarity === w.rarity);
  const armorMerge = (a) => [...inv, gs.equippedArmor].some(
    (c) => c && c.type === 'armor' && c.armorType === a.armorType && c.rarity === a.rarity);
  const thornMatch = (t) => [...inv, gs.activeThorns].some((c) => c && c.type === 'thorns' && (c.thornDamage || 0) === (t.thornDamage || 0));
  const armorLow = !gs.equippedArmor || gs.equippedArmor.durability < (gs.equippedArmor.maxDurability || 1) * 0.5;
  for (const item of offers) {
    const price = item.type === 'potion' ? Math.floor((10 + floor) * 0.8) : shopPrice(item, floor);
    if (gs.coins < price) continue;
    const buy =
      (item.type === 'weapon' && item.weaponType !== 'dagger' && ((item.damage || 0) > eqDmg || matchesForMerge(item))) ||
      // Armor is THE survival lever and the bot is coin-rich, so buy it
      // aggressively: any upgrade, any merge fodder, when low/broken, OR simply
      // whenever we have coins to spare (build the merge line toward plate).
      (item.type === 'armor' && ((item.protection || 0) > (gs.equippedArmor?.protection || 0) || armorMerge(item) || armorLow || gs.coins > price * 3)) ||
      (item.type === 'thorns' && (!gs.activeThorns || thornMatch(item))) ||
      (item.type === 'potion' && gs.playerHealth < gs.maxHealth * 0.7);
    if (!buy) continue;
    gs.coins -= price;
    inv.push(item);
  }

  // Always buy an amulet if we can afford one — but NEVER cursed ones
  // (they're unbalanced; the bot avoids buying/equipping them).
  const amulet = cs.createCardData('amulet', floor, false, gs);
  if (amulet && amulet.id && amulet.rarity !== 'cursed' && !amulet.cursed) {
    const price = Math.max(1, { common: 2, uncommon: 3, rare: 4, epic: 5, legendary: 6 }[amulet.rarity] || 2);
    if (gs.crystals >= price && mock.amuletManager.addAmulet(amulet.id)) gs.crystals -= price;
  }

  regear(mock.cardSystem.cardDataGenerator, gs, inv);
  maybeHeal(gs, inv);
}

function runTreasure(mock, gs, inv, floor, good) {
  // Mirrors TreasureScene.getRewardValues (opened-with-key tier, cut hard).
  if (good) { gs.coins += 12 + Math.floor(floor / 2); gs.crystals += 1 + Math.floor(floor / 12); }
  else { gs.coins += 8 + Math.floor(floor / 3); gs.crystals += 1 + Math.floor(floor / 14); }
  const item = mock.cardSystem.createCardData(Math.random() < 0.55 ? 'weapon' : 'armor', floor, false, null, good && floor >= 20 ? 'epic' : 'rare');
  if (item) inv.push(item);
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
}

// Blacksmith: repair the equipped weapon and armor back to full durability
// for a coin cost (the bot prioritizes its gear). This is the durability
// recovery the bot was previously missing.
function runAnvil(gs, inv) {
  const repair = (item) => {
    if (!item || !item.maxDurability || item.durability >= item.maxDurability) return;
    const missing = item.maxDurability - item.durability;
    const cost = missing * 2;
    if (gs.coins >= cost) { gs.coins -= cost; item.durability = item.maxDurability; }
    else if (gs.coins > 0) { const got = Math.floor(gs.coins / 2); gs.coins -= got * 2; item.durability = Math.min(item.maxDurability, item.durability + got); }
  };
  // Repair the strongest weapons (your protected favorites), equipped armor,
  // and the carried thorns — restoring pips so the good weapon never dies.
  const weapons = (inv || []).filter((c) => c.type === 'weapon');
  if (gs.equippedWeapon) weapons.push(gs.equippedWeapon);
  weapons.sort((a, b) => (b.damage || 0) - (a.damage || 0));
  repair(weapons[0]); repair(weapons[1]);
  repair(gs.equippedArmor);
  repair(gs.activeThorns);
}

// Choose the next map node, strongly preferring branches that lead to a
// blacksmith (ANVIL) — a must for keeping your strong weapon repaired —
// then shops/rests, while avoiding elites. (Mirrors "always pick the
// branch with a blacksmith.")
function reachesType(floors, f, idx, type, memo) {
  const node = floors[f]?.[idx];
  if (!node) return false;
  if (node.type === type) return true;
  if (f >= floors.length - 1) return false;
  const key = f + ':' + idx;
  if (memo.has(key)) return memo.get(key);
  memo.set(key, false);
  let res = false;
  for (const j of (node.connections || [])) { if (reachesType(floors, f + 1, j, type, memo)) { res = true; break; } }
  memo.set(key, res);
  return res;
}

function chooseNextNode(floors, f, cur, memo) {
  const conns = floors[f - 1][cur].connections || [];
  if (!conns.length) return -1;
  let best = -1, bestScore = -Infinity;
  for (const idx of conns) {
    const t = floors[f][idx].type;
    let s = Math.random() * 0.1; // tiny tiebreak
    if (t === 'ANVIL') s += 100;
    else if (reachesType(floors, f, idx, 'ANVIL', memo)) s += 50;
    if (t === 'SHOP' || t === 'RARE_SHOP') s += 20;
    if (t === 'REST') s += 12;
    if (t === 'TREASURE' || t === 'TREASURE_GOOD') s += 8;
    if (t === 'ELITE') s -= 30;
    if (s > bestScore) { bestScore = s; best = idx; }
  }
  return best;
}

// ── Run one full game, recording per-floor metrics ────────────────────────
function runGame(metrics, config = {}) {
  const { mock, gs } = setupRun();
  // Per-run merge tracker: records the FIRST floor we reach each rarity tier,
  // for weapons and armor separately. The mergeWeapon/Armor list functions
  // call recordMerge() whenever a tier-up happens.
  const tracker = {
    firstFloor: { weapon: {}, armor: {} }, // {weapon: {uncommon: 7, rare: 12, ...}, armor: {...}}
    recordMerge(kind, rarity, floor) {
      const slot = this.firstFloor[kind];
      if (slot[rarity] === undefined || floor < slot[rarity]) slot[rarity] = floor;
    },
  };
  gs._mergeTracker = tracker;
  // Apply meta RELICS via the REAL MetaProgressionManager (starting HP/coins/AP/
  // armor bonuses + runtime relicEffects honored by the real combat code).
  if (config.relics && config.relics.length) {
    const meta = new MetaProgressionManager(mock);
    meta.unlockedRelics = config.relics.slice();
    meta.applyRelicEffects(gs, true);
  }
  // Equip the requested amulet loadout via the REAL AmuletManager so all
  // passive modifiers (damage, dodge, durability, gold, free-action, max HP/AP,
  // regen, sunstone, lethal-prevention, ...) apply exactly as in-game.
  // Bottomless Bag is granted by default (you noted it's a huge early crutch);
  // pass config.noBag to exclude it (the sweep does, for clean deltas).
  // NOTE: the sim currently has UNLIMITED inventory, so the bag is effectively
  // a no-op here — see report caveat.
  const amulets = (config.noBag ? [] : ['bottomlessBag']).concat(config.amulets || []);
  for (const id of amulets) mock.amuletManager.addAmulet(id);
  const inv = startingInventory();
  gs.equippedWeapon = null;
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
  // Isolation test: an unbreakable, fully-gemmed legendary axe to see if pure
  // weapon power (fast kills) is the bottleneck.
  if (config.superWeapon) {
    gs.equippedWeapon = { type: 'weapon', name: 'Test Axe', weaponType: 'axe', damage: 16, rarity: 'legendary', durability: 9999, maxDurability: 9999, range: 'melee', gemEffect: 'poison', gemCount: 3, gemName: 'Poison Gem' };
    gs._superWeapon = gs.equippedWeapon;
  }

  // Walk the REAL generated map (3 acts × 15 floors). Each act: start at the
  // floor-0 node and follow a random connection per floor to the floor-14 boss.
  // Room types come straight from the generator (≈37% combat, 22% event, etc.).
  const map = new MapGenerator().generateFullMap();
  let reached = 0, dead = false;
  for (let act = 1; act <= 3 && !dead; act++) {
    const floors = map['act' + act].floors;
    const memo = new Map();
    let cur = 0;
    for (let f = 1; f < floors.length; f++) {
      const next = chooseNextNode(floors, f, cur, memo);
      if (next < 0) break;
      cur = next;
      const node = floors[f][cur];
      const floor = (act - 1) * 15 + f + 1; // global currentFloor (boss → 15/30/45)
      gs.currentFloor = floor;
      const roomType = node.type || 'COMBAT';
      gs.roomType = roomType;
      const hpStart = gs.playerHealth;

      if (COMBAT_ROOMS.has(roomType)) {
        runCombat(mock, gs, inv, floor);
        if (gs.playerHealth > 0) mock.amuletManager.processFloorEnd();
      }
      else if (roomType === 'REST') runRest(gs);
      else if (roomType === 'SHOP' || roomType === 'RARE_SHOP') runShop(mock, gs, inv, floor);
      else if (roomType === 'TREASURE') runTreasure(mock, gs, inv, floor, false);
      else if (roomType === 'TREASURE_GOOD') runTreasure(mock, gs, inv, floor, true);
      else if (roomType === 'ANVIL') runAnvil(gs, inv);
      else if (roomType === 'EVENT') runEvent(mock, gs, inv, floor);

      reached = floor;
      const m = metrics.floors[floor];
      m.reached++;
      m.hpStart += hpStart;
      m.hpEnd += Math.max(0, gs.playerHealth);
      m.hpLost += Math.max(0, hpStart - gs.playerHealth);
      m.coins += gs.coins;
      m.crystals += gs.crystals;
      m.weaponDmg += gs.equippedWeapon ? gs.equippedWeapon.damage : 0;
      m.armor += gs.equippedArmor ? gs.equippedArmor.protection : 0;
      m.maxHp += gs.maxHealth;
      if (COMBAT_ROOMS.has(roomType)) m.combats++;

      if (gs.playerHealth <= 0) {
        metrics.deaths[floor] = (metrics.deaths[floor] || 0) + 1;
        metrics.deathInfo.push({
          floor, roomType,
          wpnDmg: gs.equippedWeapon?.damage || 0,
          gem: gs.equippedWeapon?.gemEffect || 'none',
          thorn: gs.activeThorns?.thornDamage || 0,
          armor: gs.equippedArmor?.protection || 0,
        });
        dead = true; break;
      }
    }
  }

  if (!dead && reached >= MAX_FLOOR) metrics.wins++;
  metrics.finalFloors.push(reached);
  metrics.finalAmulets.push((gs.activeAmulets || []).length);
  metrics.totalActions += mock._actionCount || 0;
  metrics.hungryActions += mock._hungryActions || 0;
  metrics.restorationUses += mock._restorationUses || 0;
  metrics.gemsSeen.push(mock._gemsSeen || 0);
  for (const f of (mock._gemFloors || [])) metrics.gemsByFloor[f] = (metrics.gemsByFloor[f] || 0) + 1;
  // Roll up the per-run merge milestones into the aggregate metrics.
  for (const kind of ['weapon', 'armor']) {
    const slot = tracker.firstFloor[kind];
    for (const r of ['uncommon', 'rare', 'epic', 'legendary']) {
      if (slot[r] !== undefined) {
        const bucket = metrics.mergeFirstFloor[kind][r] || (metrics.mergeFirstFloor[kind][r] = []);
        bucket.push(slot[r]);
      }
    }
  }
  metrics.runs++;
  return { reached, won: !dead && reached >= MAX_FLOOR, killer: mock._lastKiller || 'enemy' };
}

// ── Monte Carlo ───────────────────────────────────────────────────────────
function blankFloor() { return { reached: 0, hpStart: 0, hpEnd: 0, hpLost: 0, coins: 0, crystals: 0, weaponDmg: 0, armor: 0, maxHp: 0, combats: 0 }; }
function newMetrics() {
  const floors = {}; for (let f = 1; f <= MAX_FLOOR; f++) floors[f] = blankFloor();
  return {
    runs: 0, wins: 0, deaths: {}, deathInfo: [], finalFloors: [], finalAmulets: [],
    totalActions: 0, hungryActions: 0, restorationUses: 0, gemsSeen: [], gemsByFloor: {}, floors,
    // mergeFirstFloor[kind][rarity] = [floor, floor, ...] — one entry per run that reached that tier.
    mergeFirstFloor: { weapon: {}, armor: {} },
  };
}

function pct(n, d) { return d ? ((100 * n) / d).toFixed(1) : '0.0'; }
function avg(sum, n) { return n ? (sum / n) : 0; }

function report(metrics) {
  const N = metrics.runs || RUNS;
  const ff = metrics.finalFloors.slice().sort((a, b) => a - b);
  const median = ff[Math.floor(ff.length / 2)];
  const mean = ff.reduce((a, b) => a + b, 0) / ff.length;

  console.log(`\n=== Dungeon Card Crawler — Balance Sim ===`);
  console.log(`runs=${N}  (combat = REAL engine; stations = approximate)\n`);
  console.log(`Win rate (cleared floor ${MAX_FLOOR}): ${pct(metrics.wins, N)}%`);
  console.log(`Final floor: mean=${mean.toFixed(1)}  median=${median}  min=${ff[0]}  max=${ff[ff.length - 1]}`);
  const fa = metrics.finalAmulets;
  if (fa.length) {
    const am = fa.reduce((a, b) => a + b, 0) / fa.length;
    console.log(`Amulets held at run end: mean=${am.toFixed(1)}  max=${Math.max(...fa)}`);
  }
  // AP / food economy
  if (metrics.totalActions) {
    console.log(`AP starvation: ${pct(metrics.hungryActions, metrics.totalActions)}% of all actions taken while out of AP (weakened)`);
    console.log(`Restoration cards used: ${(metrics.restorationUses / N).toFixed(2)} per run`);
  }

  // Gem economy: how many socket gems the player encounters across a run.
  if (metrics.gemsSeen && metrics.gemsSeen.length) {
    const gs = metrics.gemsSeen.slice().sort((a, b) => a - b);
    const gMean = gs.reduce((a, b) => a + b, 0) / gs.length;
    const gMed = gs[Math.floor(gs.length / 2)];
    console.log(`\nGems seen per run (floor drops only): mean=${gMean.toFixed(1)}  median=${gMed}  min=${gs[0]}  max=${gs[gs.length - 1]}`);
    console.log(`Gem drops by floor (avg per run that reached it):`);
    let line = '  ';
    for (let f = 1; f <= MAX_FLOOR; f++) {
      const reached = metrics.floors[f]?.reached || 0;
      if (!reached) continue;
      const g = (metrics.gemsByFloor[f] || 0) / reached;
      if (g > 0.001) line += `f${f}:${g.toFixed(2)} `;
    }
    console.log(line || '  (none)');
  }

  console.log(`\nDeaths by act:`);
  const actDeaths = [0, 0, 0];
  for (const f in metrics.deaths) { const a = Math.floor((f - 1) / 15); actDeaths[a] += metrics.deaths[f]; }
  ['Act 1 (1-15)', 'Act 2 (16-30)', 'Act 3 (31-45)'].forEach((label, i) => console.log(`  ${label}: ${metrics.deaths ? actDeaths[i] : 0} (${pct(actDeaths[i], N)}%)`));

  // ── Death diagnostics: what's actually killing the bot ──────────────────
  const di = metrics.deathInfo;
  if (di.length) {
    const byRoom = {};
    for (const d of di) byRoom[d.roomType] = (byRoom[d.roomType] || 0) + 1;
    console.log(`\nWhat kills the bot (${di.length} deaths):`);
    Object.entries(byRoom).sort((a, b) => b[1] - a[1]).forEach(([room, n]) =>
      console.log(`  ${room.padEnd(8)}: ${pct(n, di.length)}% of deaths`));
    const mean = (f) => (di.reduce((s, d) => s + f(d), 0) / di.length);
    const share = (pred) => pct(di.filter(pred).length, di.length);
    console.log(`  at death: avg weaponDmg=${mean((d) => d.wpnDmg).toFixed(1)}, avg armor=${mean((d) => d.armor).toFixed(1)}, avg thorns=${mean((d) => d.thorn).toFixed(1)}`);
    console.log(`  had a gem socketed: ${share((d) => d.gem !== 'none')}%  (poison ${share((d) => d.gem === 'poison')}%, lightning ${share((d) => d.gem === 'lightning')}%, fire ${share((d) => d.gem === 'fire')}%)`);
    console.log(`  had thorns: ${share((d) => d.thorn > 0)}%`);
  }

  // ── Merge tier-up timing: when do runs first reach each rarity? ────────
  const m = metrics.mergeFirstFloor;
  const hasMerges = ['weapon', 'armor'].some(k => Object.keys(m[k] || {}).length);
  if (hasMerges) {
    console.log(`\nFirst floor each rarity tier was reached (via merging):`);
    console.log(`             %runs reached  mean  median  min  max   distribution (acts: 1=floor 1-15, 2=16-30, 3=31-45)`);
    for (const kind of ['weapon', 'armor']) {
      for (const r of ['uncommon', 'rare', 'epic', 'legendary']) {
        const arr = (m[kind][r] || []).slice().sort((a, b) => a - b);
        if (!arr.length) { console.log(`  ${kind.padEnd(7)} ${r.padEnd(10)}: 0% never reached`); continue; }
        const sum = arr.reduce((s, x) => s + x, 0);
        const mean = sum / arr.length;
        const med = arr[Math.floor(arr.length / 2)];
        const act1 = arr.filter(f => f <= 15).length;
        const act2 = arr.filter(f => f > 15 && f <= 30).length;
        const act3 = arr.filter(f => f > 30).length;
        console.log(
          `  ${kind.padEnd(7)} ${r.padEnd(10)}: ${pct(arr.length, N).padStart(5)}%  ` +
          `${mean.toFixed(1).padStart(5)}  ${String(med).padStart(6)}  ${String(arr[0]).padStart(3)}  ${String(arr[arr.length-1]).padStart(3)}   ` +
          `Act1:${pct(act1, arr.length).padStart(5)}% Act2:${pct(act2, arr.length).padStart(5)}% Act3:${pct(act3, arr.length).padStart(5)}%`
        );
      }
    }
  }

  console.log(`\nDeath hot-spots (floors with >=1% of runs dying):`);
  Object.keys(metrics.deaths).map(Number).sort((a, b) => a - b).forEach((f) => {
    const d = metrics.deaths[f]; if (d / N >= 0.01) console.log(`  Floor ${String(f).padStart(2)}: ${pct(d, N)}% of runs`);
  });

  console.log(`\nPer-floor curve (averaged over runs that reached the floor):`);
  console.log(`fl  reach%  hpStart  hpEnd  hpLost  maxHP  wpnDmg  armor  coins  crys`);
  for (let f = 1; f <= MAX_FLOOR; f++) {
    const m = metrics.floors[f]; if (!m.reached) continue;
    const tag = BOSS_FLOORS.has(f) ? 'B' : '';
    console.log(
      `${String(f).padStart(2)}${tag.padEnd(1)} ${pct(m.reached, N).padStart(6)} ` +
      `${avg(m.hpStart, m.reached).toFixed(0).padStart(7)} ${avg(m.hpEnd, m.reached).toFixed(0).padStart(6)} ` +
      `${avg(m.hpLost, m.reached).toFixed(1).padStart(6)} ${avg(m.maxHp, m.reached).toFixed(0).padStart(6)} ` +
      `${avg(m.weaponDmg, m.reached).toFixed(1).padStart(6)} ${avg(m.armor, m.reached).toFixed(1).padStart(6)} ` +
      `${avg(m.coins, m.reached).toFixed(0).padStart(6)} ${avg(m.crystals, m.reached).toFixed(1).padStart(5)}`
    );
  }
  console.log(`\n(legend: 'B' = boss floor. hpLost = avg HP lost on that floor.)`);
}

// ── Per-amulet impact sweep ────────────────────────────────────────────────
// Runs the baseline, then re-runs with each amulet equipped solo, and reports
// the delta in win-rate and mean final floor. Reuses the REAL AmuletManager,
// so PASSIVE amulets (regen, dodge, max HP/AP, gold, damage, durability,
// free-action, lethal-prevention, sunstone) are measured accurately.
// ACTIVE / gem-synergy amulets are understated until the bot uses gems & magic.
function quickStats(amulets, runs) {
  const m = newMetrics();
  for (let i = 0; i < runs; i++) runGame(m, { amulets, noBag: true });
  const mean = m.finalFloors.reduce((a, b) => a + b, 0) / m.finalFloors.length;
  return { win: (100 * m.wins) / runs, mean };
}

function runSweep() {
  const runs = parseInt(process.argv[3], 10) || 600;
  const ids = Object.keys(setupRun().mock.amuletManager.amuletDefinitions);
  console.log(`\n=== Per-Amulet Impact Sweep ===`);
  console.log(`runs/config=${runs}, amulets=${ids.length}  (solo amulet vs baseline)\n`);

  const base = quickStats([], runs);
  console.log(`Baseline (no amulets):  win=${base.win.toFixed(1)}%  meanFloor=${base.mean.toFixed(1)}\n`);

  const rows = ids.map((id) => {
    const s = quickStats([id], runs);
    return { id, win: s.win, mean: s.mean, dFloor: s.mean - base.mean, dWin: s.win - base.win };
  });
  rows.sort((a, b) => b.dFloor - a.dFloor);

  console.log(`amulet                 win%   meanFloor   Δfloor   Δwin%`);
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(22)} ${r.win.toFixed(1).padStart(5)} ${r.mean.toFixed(1).padStart(10)} ` +
      `${(r.dFloor >= 0 ? '+' : '') + r.dFloor.toFixed(1)}`.padStart(9) +
      `   ${(r.dWin >= 0 ? '+' : '') + r.dWin.toFixed(1)}`.padStart(7)
    );
  }
  console.log(`\n(Δ vs baseline. Positive = amulet helps the bot survive deeper.`);
  console.log(` Gem/active-synergy amulets are understated until the bot uses gems & magic.)`);
}

// ── Loadout mode: run with a fixed amulet set equipped from the start ──────
// Usage: node sim/balance-sim.js loadout <id,id,...|auto> [runs]
function runLoadout() {
  const arg = process.argv[3] || 'auto';
  const runs = parseInt(process.argv[4], 10) || RUNS;
  let amulets;
  if (arg === 'auto') {
    // A representative "strong defensive + utility" stack.
    amulets = ['golemHeart', 'chronosHeart', 'regeneration', 'evasionBoots', 'temperedSteel', 'healingRing', 'merchantPact'];
  } else {
    amulets = arg.split(',').map((s) => s.trim()).filter(Boolean);
  }
  console.log(`\nLoadout: ${amulets.join(', ')}\n`);
  const metrics = newMetrics();
  for (let i = 0; i < runs; i++) runGame(metrics, { amulets });
  report(metrics);
}

// ── Geared mode: model a fully-progressed run (all relics + strong amulets) ─
// Usage: node sim/balance-sim.js geared [runs]
const ALL_RELICS = ['spiderVenom', 'webWeaver', 'boneArmor', 'undeadResilience', 'greedyPockets',
  'scavenger', 'giantStrength', 'queenBlessing', 'lichCurse', 'veteranExplorer', 'tent',
  'luckyScrap', 'dungeonMaster'];
const STRONG_AMULETS = ['golemHeart', 'chronosHeart', 'regeneration', 'evasionBoots',
  'temperedSteel', 'healingRing', 'merchantPact', 'vampiricRing'];

function runGeared() {
  const runs = parseInt(process.argv[3], 10) || RUNS;
  console.log(`\nGeared run — relics: ${ALL_RELICS.length}, amulets: ${STRONG_AMULETS.length}`);
  const metrics = newMetrics();
  for (let i = 0; i < runs; i++) runGame(metrics, { relics: ALL_RELICS, amulets: STRONG_AMULETS });
  report(metrics);
}

// ── Career mode: model the death-driven meta loop ──────────────────────────
// Fresh account (no relics, no starting amulets). Play a run; if you die you
// earn a relic (killer-matched or milestone) and try again, carrying your
// growing relic collection — until you win. Reports deaths-to-win + relics.
// Usage: node sim/balance-sim.js career [careers]
function runCareer() {
  const careers = parseInt(process.argv[3], 10) || 2000;
  const MAX_ATTEMPTS = 60;
  const throwaway = newMetrics();
  const deathsToWin = [], relicsAtWin = [];
  let unwon = 0;

  for (let c = 0; c < careers; c++) {
    const meta = new MetaProgressionManager({}); // persistent across this career
    meta.unlockedRelics = []; meta.totalDeaths = 0; meta.bestFloor = 1; meta.enemyKillStats = {};
    let deaths = 0, won = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Fresh-account run: only the relics earned so far, no starting bag.
      const r = runGame(throwaway, { relics: [...meta.unlockedRelics], noBag: true });
      if (r.won) { won = true; break; }
      deaths++;
      meta.handlePlayerDeath(r.killer, r.reached); // may grant a relic
    }
    if (won) { deathsToWin.push(deaths); relicsAtWin.push(meta.unlockedRelics.length); }
    else unwon++;
  }

  const n = deathsToWin.length;
  const mean = (a) => (a.reduce((s, x) => s + x, 0) / a.length);
  const sorted = deathsToWin.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Distribution of deaths-to-win
  const dist = {};
  for (const d of deathsToWin) dist[d] = (dist[d] || 0) + 1;

  console.log(`\n=== Career sim (death-driven meta) — ${careers} careers ===`);
  console.log(`Fresh account: no relics, no starting amulets; earn a relic per death; retry until win.\n`);
  console.log(`Careers that won within ${MAX_ATTEMPTS} attempts: ${pct(n, careers)}%`);
  console.log(`Deaths before first win: mean=${mean(deathsToWin).toFixed(2)}  median=${median}  min=${sorted[0]}  max=${sorted[sorted.length - 1]}`);
  console.log(`Relics held when winning:  mean=${mean(relicsAtWin).toFixed(2)}  max=${Math.max(...relicsAtWin)}`);
  console.log(`\nDeaths-before-win distribution:`);
  Object.keys(dist).map(Number).sort((a, b) => a - b).forEach((d) =>
    console.log(`  ${d} death${d === 1 ? ' ' : 's'}: ${pct(dist[d], n)}%`));
  if (unwon) console.log(`\n(${unwon} careers did not win within ${MAX_ATTEMPTS} attempts.)`);
}

// ── Relic-compare mode: baseline vs specific relic subsets ────────────────
// Usage: node sim/balance-sim.js reliccompare [runs]
function runRelicCompare() {
  const runs = parseInt(process.argv[3], 10) || 500;
  const configs = [
    { label: 'No relics (baseline)       ', relics: [] },
    { label: 'Ironhide only              ', relics: ['luckyScrap'] },
    { label: 'Echo Stone only            ', relics: ['webWeaver'] },
    { label: "Adventurer's Pack only     ", relics: ['veteranExplorer'] },
    { label: 'All relics MINUS Ironhide  ', relics: ALL_RELICS.filter(r => r !== 'luckyScrap') },
    { label: 'All relics (full account)  ', relics: ALL_RELICS },
  ];
  console.log(`\n=== Relic Impact Comparison — ${runs} runs each ===\n`);
  console.log(`config                        meanFloor  median  wins  actStarv%`);
  console.log('─'.repeat(65));
  for (const cfg of configs) {
    const m = newMetrics();
    for (let i = 0; i < runs; i++) runGame(m, { relics: cfg.relics, noBag: true });
    const ff = m.finalFloors.slice().sort((a, b) => a - b);
    const mean = (ff.reduce((a, b) => a + b, 0) / ff.length).toFixed(1).padStart(9);
    const med = String(ff[Math.floor(ff.length / 2)]).padStart(6);
    const wins = String(m.wins).padStart(4);
    const starv = m.totalActions ? ((100 * m.hungryActions / m.totalActions).toFixed(1) + '%').padStart(9) : '        —';
    console.log(`${cfg.label}  ${mean}  ${med}  ${wins}  ${starv}`);
  }
  console.log('\n(noBag=true for clean deltas — no Bottomless Bag on any config)');
}

// ── main ──────────────────────────────────────────────────────────────────
const MODE = process.argv[2];
const t0 = Date.now();
if (MODE === 'reliccompare') {
  runRelicCompare();
} else if (MODE === 'sweep') {
  runSweep();
} else if (MODE === 'career') {
  runCareer();
} else if (MODE === 'loadout') {
  runLoadout();
} else if (MODE === 'geared') {
  runGeared();
} else if (MODE === 'weapontest') {
  const runs = parseInt(process.argv[3], 10) || RUNS;
  console.log('\nIsolation test: bot wields an unbreakable legendary axe (16 dmg, 3 poison gems).');
  const metrics = newMetrics();
  for (let i = 0; i < runs; i++) runGame(metrics, { relics: ALL_RELICS, superWeapon: true });
  report(metrics);
} else {
  // Default run models a fully-progressed account: ALL relics + Bottomless Bag.
  const metrics = newMetrics();
  for (let i = 0; i < RUNS; i++) runGame(metrics, { relics: ALL_RELICS });
  report(metrics);
}
console.log(`\nElapsed ${((Date.now() - t0) / 1000).toFixed(2)}s`);
