// sim/mock.js
// Headless substrate so the REAL game classes (GameState, CardSystem,
// AmuletManager, CardDataGenerator) can run in Node with no Phaser engine.
//
// Two pieces:
//   1. A global `Phaser` shim covering the handful of Phaser.* helpers the
//      logic files call (Math.Clamp, Geom.Intersects, etc.).
//   2. A MockScene that stubs every scene method the logic touches and runs
//      tweens / timers synchronously so combat resolves in one call.

// ── 1. Global Phaser shim ────────────────────────────────────────────────
const rngInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
globalThis.Phaser = {
  Math: {
    Clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    Between: (a, b) => rngInt(a, b),
    FloatBetween: (a, b) => Math.random() * (b - a) + a,
    Linear: (a, b, t) => a + (b - a) * t,
    Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) },
  },
  Geom: {
    // Drag / hit-testing only — never true in headless combat.
    Intersects: { RectangleToRectangle: () => false },
  },
  Utils: {
    Array: {
      GetRandom: (arr) => arr[Math.floor(Math.random() * arr.length)],
      Shuffle: (arr) => arr,
      Remove: (arr, item) => { const i = arr.indexOf(item); if (i >= 0) arr.splice(i, 1); return item; },
    },
  },
  BlendModes: { SCREEN: 'SCREEN', NORMAL: 'NORMAL' },
};

// MetaProgressionManager reads localStorage directly (no try/catch), so give
// it an in-memory shim under Node.
globalThis.localStorage = globalThis.localStorage || {
  _d: {},
  getItem(k) { return k in this._d ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

// ── 2. Chainable GameObject stub ─────────────────────────────────────────
// Any method call returns the stub itself (chainable). `once`/`on` store
// callbacks; `play` fires the stored animationcomplete handler immediately so
// CardSystem.revealCard finishes its flip synchronously.
function makeGameObject() {
  let proxy;
  const t = {
    x: 0, y: 0, width: 10, height: 10, displayWidth: 10, displayHeight: 10,
    alpha: 1, scaleX: 1, scaleY: 1, depth: 0, active: true, visible: true,
    scene: null, _once: {}, _data: {},
    getBounds() { return { x: t.x, y: t.y, width: t.width, height: t.height }; },
    getData(k) { return t._data[k]; },
    setData(k, v) { t._data[k] = v; return proxy; },
    once(evt, cb) { t._once[evt] = cb; return proxy; },
    on() { return proxy; },
    off() { return proxy; },
    play(anim) {
      for (const e of ['animationcomplete', `animationcomplete-${anim}`]) {
        const cb = t._once[e]; if (cb) { delete t._once[e]; cb(); }
      }
      return proxy;
    },
    destroy() { t.active = false; return proxy; },
    setTexture() { return proxy; },
  };
  proxy = new Proxy(t, {
    get(o, p) {
      if (p in o) return o[p];
      return () => proxy;
    },
    set(o, p, v) { o[p] = v; return true; },
  });
  return proxy;
}

// add.* factory — every creator returns a fresh chainable GameObject.
function makeAddFactory() {
  return new Proxy({}, {
    get() { return (...args) => makeGameObject(); },
  });
}

export class MockScene {
  constructor() {
    this.add = makeAddFactory();
    this.tweens = {
      add: (cfg) => { if (cfg && typeof cfg.onComplete === 'function') cfg.onComplete(); return makeGameObject(); },
      killTweensOf: () => {},
      chain: () => makeGameObject(),
    };
    this.time = {
      // Run callbacks immediately; return a removable handle.
      delayedCall: (_ms, cb) => { if (typeof cb === 'function') cb(); return { remove() {} }; },
      addEvent: (cfg) => ({ remove() {}, ...cfg }),
    };
    this.cameras = { main: { width: 640, height: 360, shake() {}, flash() {} } };
    this.textures = {
      exists: () => false,
      getFrame: () => ({ width: 84, height: 8 }),
      get: () => ({
        getSourceImage: () => ({ width: 100, height: 100 }),
        getFrame: () => ({ width: 42, height: 42 })
      })
    };
    this.anims = { exists: () => false, create: () => {} };
    this.sound = { play: () => {}, add: () => makeGameObject(), get: () => null, stopByKey: () => {} };
    this.cache = { audio: { exists: () => false } };
    this.input = { keyboard: { on() {}, off() {} }, on() {}, off() {} };
    this.events = (() => {
      const m = new Map();
      return {
        on(e, cb) { (m.get(e) || m.set(e, []).get(e)).push(cb); },
        once(e, cb) { this.on(e, cb); },
        off() {},
        emit(e, ...a) { (m.get(e) || []).forEach((cb) => cb(...a)); },
      };
    })();
    this.scene = {
      get: () => this, wake: () => {}, sleep: () => {}, stop: () => {},
      launch: () => {}, start: () => {}, restart: () => {}, isActive: () => true,
      isSleeping: () => false,
    };
    this.game = { globalVolume: { master: 1, sfx: 1, music: 1 } };
    this.playerAvatar = makeGameObject();

    // Combat / turn state mirrored from GameScene
    this.isEnemyTurn = false;
    this.skipNextEnemyAttack = false;
    this._enemyTurnPending = false;
    this.dead = false;

    // Filled in by the engine after construction:
    this.gameState = null;
    this.cardSystem = null;
    this.amuletManager = null;
    this.inventorySystem = null;
  }

  // ── No-op visual / audio / UI hooks the logic calls ───────────────────
  createFloatingText() {}
  createSlashEffect() {}
  shakeCard() {}
  playEnemyHitEffect() {}
  createSmokeEffect() {}
  playCoinAnimation() {}
  playCrystalAnimation() {}
  updateUI() {}
  updateActionPointUI() {}
  updateRelicsUI() {}
  updateAmuletsUI() {}
  updateEquippedArmorPanel() {}
  updateRoomTitle() {}
  recordCardDiscarded() {}
  getCompanionProtectionBonus() {
    return (this._simInventory || []).reduce((total, item) => (
      total + (item?.type === 'companion' ? Math.max(0, Number(item.guardProtection) || 0) : 0)
    ), 0);
  }
  // Tent relic: gain max HP whenever a card (weapon/armor) is spent/breaks.
  grantCardSpentRelicBonus(card) {
    const amount = this.gameState?.relicEffects?.cardSpentMaxHP || 0;
    if (!amount || !card) return;
    this.gameState.maxHealth += amount;
    this.gameState.playerHealth = Math.min(this.gameState.maxHealth, this.gameState.playerHealth + amount);
  }
  saveCurrentRun() {}
  setupBossRewardRoom() {}
  isEnemyCard(card) { return !!card && (card.data?.type === 'enemy' || card.data?.type === 'boss'); }

  gameOver() { this.dead = true; }
  gameWon() { this.won = true; }
  onEnemiesCleared() { this.enemiesCleared = true; }

  // ── Action economy (mirrors GameScene.useAction) ──────────────────────
  // Consumes an AP and QUEUES one enemy turn to run after the player's
  // current action resolves (the engine drains the queue each step).
  useAction() {
    if (this.isEnemyTurn) return false;
    // Track AP starvation: actions taken while "hungry" (out of AP).
    this._actionCount = (this._actionCount || 0) + 1;
    if ((this.gameState.actionsLeft || 0) <= 0) this._hungryActions = (this._hungryActions || 0) + 1;
    if (this.gameState.shouldUseFreeAction && this.gameState.shouldUseFreeAction()) {
      this._enemyTurnPending = true;
      return true;
    }
    let consumed = true;
    if (this.amuletManager) {
      const free = this.amuletManager.getFreeActionChance?.() || 0;
      if (free > 0 && Math.random() < free) consumed = false;
    }
    if (consumed && this.gameState.actionsLeft > 0) this.gameState.actionsLeft--;
    this._enemyTurnPending = true;
    return true;
  }

  // ── Enemy turn (faithful subset of revealedEnemiesAttack) ─────────────
  // No shields/bonewall/mirror in baseline (no amulets). Each revealed,
  // alive, non-frozen enemy deals its attack to the player via the REAL
  // gameState.takeDamage (armor / dodge / reflection all honored).
  runEnemyTurn() {
    if (this.gameState.playerHealth <= 0) return;
    const board = this.cardSystem.boardCards;
    // Per-enemy grace (mirrors GameScene.revealedEnemiesAttack): a freshly revealed
    // enemy sits out the action that revealed it, then joins the fight on the next
    // action. Snapshot who's eligible now, then clear the flag. This is per-enemy —
    // revealing a new enemy no longer cancels attacks from enemies already revealed.
    const eligible = new Set();
    for (let i = 0; i < board.length; i++) {
      const c = board[i];
      if (c && c.revealed && this.isEnemyCard(c) && !c.justRevealed) eligible.add(i);
    }
    for (const c of board) { if (c && c.justRevealed) c.justRevealed = false; }
    for (let i = 0; i < board.length; i++) {
      if (!eligible.has(i)) continue;
      const card = board[i];
      if (!card || !card.revealed || !this.isEnemyCard(card)) continue;
      if (card.data.frozen && card.data.frozen > 0) continue;
      if (card.data.health <= 0) continue;

      if (card.data.type === 'boss' && card.data.abilities) {
        for (const ab of card.data.abilities) {
          if (ab.type === 'summon' && Math.random() < ab.chance) {
            const n = ab.count || 1;
            for (let k = 0; k < n; k++) this._summonMinion(ab.enemyType);
          }
        }
      }

      let damageDealt = card.data.attack;
      const rage = card.data.abilities?.find((a) => a.type === 'rage');
      if (rage) {
        const maxHp = card.data.maxHealth || card.data.health;
        if (maxHp > 0 && (card.data.health / maxHp) <= (rage.threshold ?? 0.3)) {
          damageDealt = Math.ceil(damageDealt * (rage.damageBoost || 1.5));
        }
      }
      const armorBreak = card.data.abilities?.find((a) => a.type === 'armor_break');
      const armorPierce = armorBreak?.amount || 0;

      card.data.abilities?.forEach((ability) => {
        if (ability.type === 'poison') {
          this.gameState.addPlayerEffect({ ...ability, killedBy: card.data.name || 'Enemy' });
        } else if (ability.type === 'coin_steal') {
          if (Math.random() < ability.chance && this.gameState.coins > 0) {
            this.gameState.coins -= Math.min(ability.amount, this.gameState.coins);
          }
        }
      });

      const armorBeforeHit = this.gameState.equippedArmor;
      const { actualDamage } = this.gameState.takeDamage(damageDealt, i, 'enemy', armorPierce);
      if (armorBeforeHit && !this.gameState.equippedArmor) {
        this._armorBreaks = (this._armorBreaks || 0) + 1;
      }
      if (this.gameState.playerHealth <= 0) { this._lastKiller = card.data.name || 'enemy'; return; }
      // Thorns: reflect to MELEE attackers (mirrors GameScene.applyThornsDamage),
      // consuming 1 durability per reflect; the bot's strongest thorns is active.
      const t = this.gameState.activeThorns;
      const isMeleeAttacker = card.data.type === 'boss' || (card.data.role === 'MELEE' && !card.data.isRangedType);
      if (isMeleeAttacker && t && t.durability > 0 && card.data.health > 0) {
        this.cardSystem.attackEnemy(i, t.thornDamage || 2, true);
        t.durability -= 1;
        if (t.durability <= 0) {
          this.gameState.activeThorns = null;
          this._thornBreaks = (this._thornBreaks || 0) + 1;
        }
      }
      // Boss abilities: leech (heal from damage ACTUALLY landed, after armor —
      // mirrors GameScene) + summon minions.
      if (card.data.type === 'boss' && card.data.abilities) {
        for (const ab of card.data.abilities) {
          if (ab.type === 'lifesteal' && actualDamage > 0) {
            const heal = Math.max(1, Math.ceil(actualDamage * (ab.percentage || 0.3)));
            if (card.data.maxHealth === undefined) card.data.maxHealth = card.data.health;
            card.data.health = Math.min(card.data.maxHealth, card.data.health + heal);
          }
        }
      }
    }
    // Companions strike after the enemy phase in the live game. The simulator
    // keeps its inventory on the mock scene, so event-earned companions now
    // contribute their real card attack instead of being dead weight.
    const companions = (this._simInventory || []).filter((item) => item?.type === 'companion');
    for (const companion of companions) {
      const targets = board
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card?.revealed && this.isEnemyCard(card) && card.data.health > 0);
      if (!targets.length) break;
      const meleeTargets = companion.attackStyle === 'melee'
        ? targets.filter(({ card }) => card.data.role === 'MELEE' || card.data.type === 'boss')
        : targets;
      const pool = meleeTargets.length ? meleeTargets : targets;
      pool.sort((a, b) => a.card.data.health - b.card.data.health);
      const target = pool[0];
      this.cardSystem.attackEnemy(target.index, companion.attack || 2, true);
      const shockedTarget = board[target.index];
      if ((companion.shockChance || 0) > 0
          && shockedTarget === target.card
          && shockedTarget?.data?.health > 0
          && Math.random() < companion.shockChance) {
        this.cardSystem.applyShockStatus?.(shockedTarget, 1);
      }
    }
    // End-of-enemy-turn effects: poison damage-over-time ticks on enemies
    // (mirrors GameScene.finishEnemyTurnEffects → processEnemyPoisonEffects).
    this.cardSystem.processEnemyPoisonEffects?.();
    let effectDamage = 0;
    let poisonKilledBy = null;
    for (let i = this.gameState.playerEffects.length - 1; i >= 0; i--) {
      const effect = this.gameState.playerEffects[i];
      if (effect.type === 'poison') {
        effectDamage += effect.damage || 0;
        poisonKilledBy = effect.killedBy || poisonKilledBy;
      }
      effect.turns--;
      if (effect.turns <= 0) this.gameState.playerEffects.splice(i, 1);
    }
    if (effectDamage > 0) {
      this.gameState.takeDamage(effectDamage, -1, 'poison');
      if (this.gameState.playerHealth <= 0) this._lastKiller = poisonKilledBy || 'Poison';
    }
  }

  // Inject a summoned minion (revealed enemy) onto the board — boss summon.
  // Mirrors cardSystem.summonEnemy: the boss summons a SPECIFIC enemy type, so
  // stats come from that creature's tier (not a random enemy).
  _summonMinion(enemyType) {
    const floor = this.gameState.currentFloor;
    const gen = this.cardSystem.cardDataGenerator;
    const e = enemyType
      ? gen.createTieredEnemy(enemyType, floor)
      : gen.createCardData('enemy', floor);
    if (!e) return;
    // Mirror cardSystem.summonEnemy: summoned minions come in weaker than the
    // real thing (0.6 attack / 0.65 HP) so boss summons don't overpower the sim.
    e.attack = Math.max(1, Math.round((e.attack || 1) * 0.6));
    e.health = Math.max(1, Math.round((e.health || 1) * 0.65));
    e.maxHealth = e.health;
    // Summoned spiders carry the toned-down poison the real game gives them.
    if (enemyType === 'spider') e.abilities = [{ type: 'poison', damage: 1, turns: 2, stackable: true }];
    e.role = Math.random() < 0.5 ? 'MELEE' : 'RANGED';
    const sprite = {
      x: 0, y: 0, active: true, scene: this,
      setTexture() { return this; }, setScale() { return this; }, setTint() { return this; },
      clearTint() { return this; }, destroy() { this.active = false; return this; },
      play() { return this; }, once() { return this; }, on() { return this; },
      getBounds() { return { x: 0, y: 0, width: 1, height: 1 }; },
    };
    this.cardSystem.boardCards.push({ data: e, revealed: true, sprite });
  }

  // Drain a queued enemy turn (called by the engine after each player action).
  resolvePendingEnemyTurn() {
    if (!this._enemyTurnPending) return;
    this._enemyTurnPending = false;
    this.runEnemyTurn();
  }
}
