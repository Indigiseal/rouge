// FloorSpawner — spawnFloorCards and spawn-related helpers
import { SoundHelper } from '../../audio/SoundHelper.js';
import { showItemTooltip, hideItemTooltip } from '../../ui/ItemTooltip.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { openAmuletChoiceOverlay } from '../../ui/AmuletChoiceOverlay.js';
import { minEnemyRatioForFloor } from '../../content/balance/EnemyDensity.js';

export class FloorSpawner {
    constructor(cs) {
        this._baseCardsForFloor = _baseCardsForFloor.bind(cs);
        this._effectiveCardCount = _effectiveCardCount.bind(cs);
        this.spawnFloorCards = spawnFloorCards.bind(cs);
        this.spawnTutorialCards = spawnTutorialCards.bind(cs);
        this.revealTutorialLightningTargets = revealTutorialLightningTargets.bind(cs);
        this.findTutorialCard = findTutorialCard.bind(cs);
        this.restoreSavedBoard = restoreSavedBoard.bind(cs);
        this.convertCardToFood = convertCardToFood.bind(cs);
        this.spawnBossRewardBoard = spawnBossRewardBoard.bind(cs);
        this.takeRewardCard = takeRewardCard.bind(cs);
        this.clearBossRewardChest = clearBossRewardChest.bind(cs);
        this.spawnDeathDrop = spawnDeathDrop.bind(cs);
        this.previewTrapAt = previewTrapAt.bind(cs);
        this.ensureWeaponSupply = ensureWeaponSupply.bind(cs);
        this.limitEnemyDensity = limitEnemyDensity.bind(cs);
        this.ensureEnemyMinimum = ensureEnemyMinimum.bind(cs);
        this.assignEliteMiniBoss = assignEliteMiniBoss.bind(cs);
        this.assignEliteHighlightCards = assignEliteHighlightCards.bind(cs);
        this.injectAngryNestmother = injectAngryNestmother.bind(cs);
        this.spawnBoss = spawnBoss.bind(cs);
        this.pickCardType = pickCardType.bind(cs);
        this.generateRandomCard = generateRandomCard.bind(cs);
        this.summonEnemy = summonEnemy.bind(cs);
        this.respawnCardOnBoard = respawnCardOnBoard.bind(cs);
        this.dropWaveCards = dropWaveCards.bind(cs);
        this.createCardData = createCardData.bind(cs);
        this.capRewardRarity = capRewardRarity.bind(cs);
    }
}

function _baseCardsForFloor(cf) {
    const f = Math.max(1, Math.min(45, cf));
    if (f <= 15)      return Math.round(6  + ((f - 1)  / 14) * (11 - 6));
    else if (f <= 30) return Math.round(11 + ((f - 15) / 15) * (14 - 11));
    else              return Math.round(14 + ((f - 30) / 15) * (16 - 14));
}

function _effectiveCardCount(roomType, cf) {
    const base = this._baseCardsForFloor(cf);
    const scaled = (roomType === 'ELITE') ? Math.ceil(base * this.constructor.ELITE_MULT) : base;
    return Math.min(scaled, this.constructor.MAX_CARDS); // never exceed 26
}

function spawnFloorCards() {
  // === per-floor relic effects ===
  // Gravebloom Bundle relic: heal at the start of every combat floor.
  const heal = this.scene.gameState?.relicEffects?.healPerFloor || 0;
  if (heal > 0 && this.scene.gameState && this.scene.gameState.playerHealth > 0 && this.scene.gameState.playerHealth < this.scene.gameState.maxHealth) {
    const before = this.scene.gameState.playerHealth;
    this.scene.gameState.playerHealth = Math.min(this.scene.gameState.maxHealth, before + heal);
    const gained = this.scene.gameState.playerHealth - before;
    if (gained > 0 && this.scene.playerAvatar) {
      this.scene.createFloatingText?.(this.scene.playerAvatar.x, this.scene.playerAvatar.y, `+${gained} HP (Gravebloom)`, 0x66ff99);
    }
    this.scene.updateUI?.();
  }
  // Goblin War Horn relic: arm the "first attack" flag for this floor.
  if (this.scene.gameState) {
    this.scene.gameState.firstAttackThisFloorUsed = false;
    this.scene.gameState.keenEdgeUsedThisFloor = false;
  }

  // === clear previous ===
  // Use the canonical teardown so leftover gem shadows, glows and idle
  // timers from un-picked cards on the previous floor are fully removed.
  // (The old inline loop only destroyed sprite/shadow/infoText, leaving
  // gemShadow sprites behind on the next combat floor.)
  this.clearBoard();
  // === boss shortcut ===
  // Spawn the act boss when ANY of these say "this is the boss room":
  //   1. the floor number lines up with a boss floor (15/30/45),
  //   2. the room type is BOSS,
  //   3. the map cursor sits on the act's final floor (node index >= 14).
  // currentFloor, roomType and the map cursor are tracked separately and can
  // each drift or get reset (act transitions, save/load, returning from a
  // sub-scene), which is how the player reached a boss node but got a scaled-up
  // normal combat floor. The map-cursor floor is the same authoritative signal
  // the boss-completion check uses, so spawn and completion now agree.
  const currentFloor = this.scene.gameState.currentFloor;
  const bossFloors = [15, 30, 45];
  const enteringBossRoom = (this.scene.gameState?.roomType || this.scene.roomType) === 'BOSS';
  const onBossNode = (this.scene.gameState?.mapCursor?.floor ?? -1) >= 14;
  if (bossFloors.includes(currentFloor) || enteringBossRoom || onBossNode) { this.spawnBoss(); return; }
  // Determine scaled count (your code that decides roomType etc. can stay)
  const cf = this.scene.gameState?.currentFloor || 1;
  const roomType = this.scene.gameState?.roomType || this.scene.roomType || 'COMBAT';
  const cardCount = this._effectiveCardCount ? this._effectiveCardCount(roomType, cf) : Math.min(6 + Math.floor((cf - 1) * (20 / 44)), 26);
  // Build the standard compact brick cluster used by every combat floor.
  const cells = this.buildCompactBrickCluster(cardCount);
  // 2) compute steps & centering. Crowded boards request a widened area
  // and a larger per-cell step so cards actually use the wing panel.
  // Wing earlier so mid-size 4-row boards get horizontal room (and better VSTEP via area).
  const wantsWing = cardCount > 12;
  const place = wantsWing
    ? this.computePlacement(cells, { extraRightWidth: 100, maxHStep: 78 })
    : this.computePlacement(cells);
  this.createFloorBoardPanel(cells, place, true);
  if (wantsWing) this.createSideExtraPanel('right', { delayMs: 260 });
  // Cache layout so mid-floor respawns (Webweaver's Thread relic) can reuse positions.
  this._boardCells = cells;
  this._boardPlace = place;
  // TEMP (prototype): "falling waves" test. On the wave-test floor the room
  // refills in waves that drop from the top once the board is nearly empty,
  // instead of one crowded board. Reset every floor so it never leaks.
  this._waveState = null;
  const WAVE_TEST_FLOOR = 5;
  if (cf === WAVE_TEST_FLOOR && roomType === 'COMBAT') {
    this._waveState = { wavesLeft: 2, threshold: 3, dropping: false };
  }
  // 3) create the cards at proper pixels
  this.boardCards = new Array(cardCount).fill(null);
  let trapsPlaced = 0;
  let keysPlaced = 0;
  let gemsPlaced = 0;
  let emptyPlaced = 0;
  for (let i = 0; i < cardCount; i++) {
    const { r, c } = cells[i];
    const { x, y } = this.brickToPixel(r, c, place);
    const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
    shadow.setAlpha(0);
    const cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'cardBack'));
    cardSprite.setScale(place.cardScale || 1);          // shrink on crowded 4-row boards
    cardSprite.setInteractive();
    cardSprite.on('pointerdown', () => this.revealCard(i));
    cardSprite.on('pointerover', () => {
      const card = this.boardCards[i];
      if (card && !card.revealed) {
        shadow.setAlpha(1);
        this.scene.tweens.add({ targets: cardSprite, y: y - 5, duration: 150 });
        cardSprite.setTexture('cardBack');
        snapOriginToPixelGrid(cardSprite);
        cardSprite.play('card_hover_anim');
      }
    });
    cardSprite.on('pointerout', () => {
      const card = this.boardCards[i];
      if (card && !card.revealed) {
        shadow.setAlpha(0);
        this.scene.tweens.add({ targets: cardSprite, y: y, duration: 150 });
        cardSprite.stop();
        cardSprite.setTexture('cardBack');
        snapOriginToPixelGrid(cardSprite);
      }
    });
    // Act 1 keeps the single-trap cap; act 2+ can stack two traps per
    // floor to punish careless flips on harder runs.
    const trapCap = cf <= 15 ? 1 : 2;
    let type = this.pickCardType(cf);
    if (type === 'trap' && trapsPlaced >= trapCap) {
      type = this.pickCardType(cf, ['trap']);
    }
    if (type === 'key' && keysPlaced >= 1) {
      const exclude = ['key'];
      if (trapsPlaced >= trapCap) exclude.push('trap');
      type = this.pickCardType(cf, exclude);
    }
    if (type === 'gem' && gemsPlaced >= 2) {
      // Cap gems at two per floor — re-roll excluding 'gem' (and any other
      // already-capped types) so floors don't hand out a stack of sockets.
      const exclude = ['gem'];
      if (trapsPlaced >= trapCap) exclude.push('trap');
      if (keysPlaced >= 1) exclude.push('key');
      if (emptyPlaced >= 1) exclude.push('empty');
      type = this.pickCardType(cf, exclude);
    }
    if (type === 'empty' && emptyPlaced >= 1) {
      // Cap "nothing" cards at one per floor — re-roll excluding 'empty'
      // (and any other already-capped types).
      const exclude = ['empty'];
      if (trapsPlaced >= trapCap) exclude.push('trap');
      if (keysPlaced >= 1) exclude.push('key');
      if (gemsPlaced >= 2) exclude.push('gem');
      type = this.pickCardType(cf, exclude);
    }
    // Front rows (r > 0, closer to the player) get MELEE-type enemies; back
    // rows get RANGED (archers). Pass the desired role into creation so the
    // enemy TYPE/sprite is picked to match the position, not just its behavior.
    const desiredRole = r > 0 ? 'MELEE' : 'RANGED';
    let data = this.createCardData(type, cf, roomType === 'ELITE', this.scene.gameState, null, desiredRole);
    // Amulet offers can return null (empty pool / floor gate) — never leave a
    // face-down slot with data=null or revealCard crashes the run/sim.
    if (!data) {
      data = this.createCardData('coin', cf) || {
        type: 'coin', name: 'Coin', value: 1, sprite: 'coin',
      };
    }
    if (data?.type === 'trap') trapsPlaced++;
    if (data?.type === 'key') keysPlaced++;
    if (data?.type === 'gem') gemsPlaced++;
    if (data?.type === 'empty') emptyPlaced++;
    // Keep role in sync with the row (the type now matches, but a back-row
    // fallback melee — if no archer is unlocked yet — still reads as RANGED here).
    if (data && this.isEnemyType(data.type)) {
        data.role = desiredRole;
    }
    
    // store brick coords for mechanics
    if (data) {
      data.brick = { r, c };
    }
    this.boardCards[i] = { sprite: cardSprite, shadow, revealed: false, data };
  }
  this.ensureWeaponSupply(cf, roomType);
  this.limitEnemyDensity(cf, roomType);
  this.ensureEnemyMinimum(cf, roomType);
  this.injectAngryNestmother(cf, roomType);
  this.assignEliteMiniBoss(roomType);
  this.assignEliteHighlightCards(roomType, cf);
  // 4) second-pass: safe neighbor build (using brick offsets)
  const indexByRC = new Map();
  for (let i = 0; i < this.boardCards.length; i++) {
    const card = this.boardCards[i];
    if (!card || !card.data?.brick) continue;
    const { r, c } = card.data.brick;
    indexByRC.set(`${r},${c}`, i);
    card.data.brickNeighbors = [];
  }
  for (let i = 0; i < this.boardCards.length; i++) {
    const card = this.boardCards[i];
    if (!card || !card.data?.brick) continue;
    const { r, c } = card.data.brick;
    const OFFS = (r & 1) ? this.constructor.OFFS_ODD : this.constructor.OFFS_EVEN;
    const nbrs = [];
    for (const [dc, dr] of OFFS) {
      const rr = r + dr, cc = c + dc;
      const key = `${rr},${cc}`;
      if (indexByRC.has(key)) {
        const ni = indexByRC.get(key);
        if (this.boardCards[ni]) nbrs.push(ni);
      }
    }
    card.data.brickNeighbors = nbrs;
  }
  // === compute bands (rows) ===
  this.computeRowBands(this.boardCards, place.VSTEP);
  // Role is assigned during creation based on position preference.
  // === Greasewing's Feast: convert one non-essential card into food ===
  if (this.scene.amuletManager?.wantsFoodCardConversion?.() &&
      roomType !== 'BOSS' && roomType !== 'ELITE') {
    this.convertCardToFood(cf);
  }

  // === reveal a random 3–4 enemies with a front/back mix, kept close ===
  // Opening reveals are randomized so floors don't always feel identical:
  // normal floors (4+) open 3 most of the time and 4 now and then; floors
  // 1-3 stay a calmer 2 for a gentle start. Relic bonuses stack on top,
  // and the pick loop below caps at however many enemies actually exist.
  const extraRelicReveals = this.scene.gameState?.relicEffects?.revealExtraCard || 0;
  const baseReveals = (cf >= 4) ? (Math.random() < 0.4 ? 4 : 3) : 2;
  const wantReveals = Math.min(4, baseReveals + extraRelicReveals);
  const enemyIdx = [];
  const frontIdx = [];
  const backIdx  = [];
  this.boardCards.forEach((c, i) => {
    if (!c) return;
    // Mimics stay hidden — the player must reveal them to start the timer.
    if (c.data?.isMimic) return;
    // Elite "mystery" cards (mini-boss / hidden reward) stay face-down so the
    // player chooses to gamble on flipping their glowing gold backs.
    if (c.data?.highlightedBack) return;
    if (this.isEnemyType(c.data?.type)) {
      enemyIdx.push(i);
      if (c.data.role === 'MELEE') frontIdx.push(i); else backIdx.push(i);
    }
  });
  const picks = [];
  // ensure at least one front (if available)
  if (frontIdx.length) picks.push(frontIdx[Math.floor(Math.random() * frontIdx.length)]);
  // ensure at least one back (if available and needed)
  if (backIdx.length && picks.length < 2) {
    picks.push(backIdx[Math.floor(Math.random() * backIdx.length)]);
  }
  // fill the rest: prefer enemies adjacent to already picked ones
  const neighborsOfIndex = (i) => {
    const { r, c } = cells[i];
    const neigh = this.brickNeighbors(r, c).map(([nr, nc]) =>
      cells.findIndex(cc => cc.r === nr && cc.c === nc)
    ).filter(k => k >= 0);
    return neigh;
  };
  while (picks.length < Math.min(wantReveals, enemyIdx.length)) {
    // collect enemy neighbors of current picks
    const pool = new Set();
    picks.forEach(pi => {
      neighborsOfIndex(pi).forEach(n => {
        if (enemyIdx.includes(n) && !picks.includes(n)) pool.add(n);
      });
    });
    let add = null;
    if (pool.size) {
      const arr = Array.from(pool);
      add = arr[Math.floor(Math.random() * arr.length)];
    } else {
      // fallback: any remaining enemy
      const remaining = enemyIdx.filter(i => !picks.includes(i));
      if (!remaining.length) break;
      add = remaining[Math.floor(Math.random() * remaining.length)];
    }
    picks.push(add);
  }
  // Initial room reveals should not consume actions or queue enemy turns.
  // Flip them open one-by-one in a small cascade — matching the shop's
  // flip-open feel — instead of popping them all at once. Order by board
  // position (top row first, then left→right) so the wave reads cleanly,
  // and wait a short beat for the board panel to settle in first.
  const revealSettleMs = 150;
  const revealStaggerMs = 120;
  const revealOrder = picks.slice().sort((a, b) => {
    const ca = cells[a], cb = cells[b];
    return (ca.r - cb.r) || (ca.c - cb.c);
  });
  revealOrder.forEach((idx, order) => {
    this.scene.time.delayedCall(revealSettleMs + order * revealStaggerMs, () => this.revealCard(idx, true));
  });

  const omenDelay = revealSettleMs + (Math.max(0, revealOrder.length - 1) * revealStaggerMs) + 160;
  this.scene.time.delayedCall(omenDelay, () => this.applyHolographicOmenStartEffect());

  // Watcher's Lamp — preview one trap (no damage)
  if (this.scene.amuletManager?.wantsTrapPreview?.()) {
    const trapIdx = this.boardCards.findIndex(c => c && !c.revealed && c.data?.type === 'trap');
    if (trapIdx !== -1) this.previewTrapAt(trapIdx);
  }

  // Wayfinder's Compass: reveal extra non-enemy cards (skip traps so we don't auto-trigger them)
  const extraNonEnemy = this.scene.amuletManager?.getExtraNonEnemyReveals?.() || 0;
  if (extraNonEnemy > 0) {
    const candidates = [];
    this.boardCards.forEach((c, i) => {
      if (!c || c.revealed) return;
      if (c.data?.highlightedBack) return; // keep elite mystery cards hidden
      const t = c.data?.type;
      if (t === 'enemy' || t === 'boss' || t === 'trap') return;
      candidates.push(i);
    });
    for (let n = 0; n < extraNonEnemy && candidates.length > 0; n++) {
      const pickIdx = Math.floor(Math.random() * candidates.length);
      const cardIdx = candidates.splice(pickIdx, 1)[0];
      this.revealCard(cardIdx, true);
    }
  }
}

function spawnTutorialCards() {
  this.clearBoard();
  const cf = 1;
  const mkSword = (tag) => {
    const card = this.cardDataGenerator.createWeaponCardOfType('sword', 99, 'common')
      || this.cardDataGenerator.createWeaponCard(99, 'common');
    return { ...card, tutorialTag: tag };
  };
  const mkMelee = (tag) => {
    const e = this.cardDataGenerator.createTieredEnemy('skeleton', cf);
    e.role = 'MELEE'; e.isRangedType = false;
    e.health = 6; e.attack = 3; e.abilities = [];
    e.tutorialTag = tag;
    return e;
  };
  const archer = this.cardDataGenerator.createTieredEnemy('goblin_archer', cf);
  archer.role = 'RANGED'; archer.isRangedType = true;
  archer.health = 6; archer.attack = 3; archer.abilities = [];
  archer.tutorialTag = 'archer';

  const food = this.cardDataGenerator.createCardData('food', cf);   food.tutorialTag = 'food';
  const potion = this.cardDataGenerator.createCardData('potion', cf); potion.tutorialTag = 'potion';
  const coin = this.cardDataGenerator.createCardData('coin', cf);   coin.tutorialTag = 'coin';
  const lightningGem = {
    type: 'gem', gemEffect: 'lightning', name: 'Lightning Gem',
    sprite: 'gemsRGY', spriteFrame: 12, color: 0xffe066,
    rarity: 'common', tutorialTag: 'lightningGem'
  };
  const mkLightningTarget = (tag, enemyType, role) => {
    const enemy = this.cardDataGenerator.createTieredEnemy(enemyType, cf);
    enemy.role = role;
    enemy.isRangedType = role === 'RANGED';
    const health = tag === 'lightningTarget1' ? 9 : 3;
    enemy.health = health;
    enemy.maxHealth = health;
    enemy.attack = 1;
    enemy.abilities = [];
    enemy.tutorialTag = tag;
    enemy.tutorialDormant = true;
    return enemy;
  };

  // 8-cell compact cluster (rows: back r=0 → front larger r).
  const cells = this.buildCompactBrickCluster(12);
  const place = this.computePlacement(cells);
  this.createFloorBoardPanel(cells, place, true);
  this._boardCells = cells;
  this._boardPlace = place;

  // Group cell indices by row so enemies land where their role reads right.
  const minR = Math.min(...cells.map(c => c.r));
  const maxR = Math.max(...cells.map(c => c.r));
  const backIdx = cells.map((c, i) => (c.r === minR ? i : -1)).filter(i => i >= 0);
  const frontIdx = cells.map((c, i) => (c.r === maxR ? i : -1)).filter(i => i >= 0);
  const used = new Set();
  const takeFrom = (arr) => { for (const i of arr) if (!used.has(i)) { used.add(i); return i; } return -1; };

  const deck = new Array(cells.length).fill(null);
  deck[takeFrom(backIdx)] = archer;                 // archer in the back row
  deck[takeFrom(frontIdx)] = mkMelee('skeleton');   // first foe, front row
  deck[takeFrom(frontIdx.length > 1 ? frontIdx : cells.map((_, i) => i))] = mkMelee('guard');
  // Fill the remaining slots with the item deck.
  const items = [
    mkSword('sword1'), food, mkSword('sword2'), potion, coin, lightningGem,
    mkLightningTarget('lightningTarget1', 'skeleton', 'MELEE'),
    mkLightningTarget('lightningTarget2', 'skeleton', 'MELEE'),
    mkLightningTarget('lightningTarget3', 'goblin_archer', 'RANGED')
  ];
  for (let i = 0; i < cells.length && items.length; i++) {
    if (!deck[i]) deck[i] = items.shift();
  }

  this.boardCards = new Array(cells.length).fill(null);
  for (let i = 0; i < cells.length; i++) {
    const { r, c } = cells[i];
    const { x, y } = this.brickToPixel(r, c, place);
    const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
    shadow.setAlpha(0);
    const cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'cardBack'));
    cardSprite.setScale(this._boardPlace?.cardScale || 1);
    cardSprite.setInteractive();
    cardSprite.on('pointerdown', () => this.revealCard(i));
    cardSprite.on('pointerover', () => {
      const card = this.boardCards[i];
      if (card && !card.revealed) {
        shadow.setAlpha(1);
        this.scene.tweens.add({ targets: cardSprite, y: y - 5, duration: 150 });
        cardSprite.setTexture('cardBack');
        snapOriginToPixelGrid(cardSprite);
        cardSprite.play('card_hover_anim');
      }
    });
    cardSprite.on('pointerout', () => {
      const card = this.boardCards[i];
      if (card && !card.revealed) {
        shadow.setAlpha(0);
        this.scene.tweens.add({ targets: cardSprite, y: y, duration: 150 });
        cardSprite.stop();
        cardSprite.setTexture('cardBack');
        snapOriginToPixelGrid(cardSprite);
      }
    });
    const data = deck[i];
    if (data) data.brick = { r, c };
    this.boardCards[i] = { sprite: cardSprite, shadow, revealed: false, data };
  }

  // Neighbor links (used by "reveal one behind" after a front clears).
  const indexByRC = new Map();
  for (let i = 0; i < this.boardCards.length; i++) {
    const card = this.boardCards[i];
    if (!card || !card.data?.brick) continue;
    const { r, c } = card.data.brick;
    indexByRC.set(`${r},${c}`, i);
    card.data.brickNeighbors = [];
  }
  for (let i = 0; i < this.boardCards.length; i++) {
    const card = this.boardCards[i];
    if (!card || !card.data?.brick) continue;
    const { r, c } = card.data.brick;
    const OFFS = (r & 1) ? this.constructor.OFFS_ODD : this.constructor.OFFS_EVEN;
    const nbrs = [];
    for (const [dc, dr] of OFFS) {
      const key = `${r + dr},${c + dc}`;
      if (indexByRC.has(key)) nbrs.push(indexByRC.get(key));
    }
    card.data.brickNeighbors = nbrs;
  }
  this.computeRowBands(this.boardCards, place.VSTEP);

  // Only the front skeleton is face-up at the start (free — no enemy turn).
  const skelIdx = this.boardCards.findIndex(c => c?.data?.tutorialTag === 'skeleton');
  if (skelIdx >= 0) this.revealCard(skelIdx, true);
}

function revealTutorialLightningTargets() {
  if (!this.scene.tutorialMode || this._tutorialLightningTargetsRevealed) return;
  this._tutorialLightningTargetsRevealed = true;

  ['lightningTarget1', 'lightningTarget2', 'lightningTarget3'].forEach(tag => {
    const target = this.findTutorialCard(tag);
    if (!target) return;
    target.card.data.tutorialDormant = false;
    if (!target.card.revealed) this.revealCard(target.index, true);
  });
}

function findTutorialCard(tag) {
  const index = this.boardCards.findIndex(c => c?.data?.tutorialTag === tag);
  return index >= 0 ? { index, card: this.boardCards[index] } : null;
}

function restoreSavedBoard(savedCards, savedLayout = null) {
  if (!Array.isArray(savedCards)) return false;

  this.clearBoard();
  const hasBoss = savedCards.some(saved => saved?.data?.type === 'boss');
  const layoutCells = Array.isArray(savedLayout?.cells)
    ? savedLayout.cells.map(cell => cell ? { r: cell.r, c: cell.c } : null)
    : savedCards.map(saved => saved?.data?.brick || null);
  const validCells = layoutCells.filter(cell =>
    Number.isFinite(cell?.r) && Number.isFinite(cell?.c)
  );

  let place = savedLayout?.place || null;
  if (hasBoss) {
    this.createBossBoardPanel();
  } else if (validCells.length > 0) {
    if (!place) {
      const wantsWing = layoutCells.length > 12;
      place = wantsWing
        ? this.computePlacement(validCells, { extraRightWidth: 100, maxHStep: 78 })
        : this.computePlacement(validCells);
    }
    this.createFloorBoardPanel(validCells, place, false);
    if (layoutCells.length > 12) this.createSideExtraPanel('right', { animate: false });
  }

  this._boardCells = layoutCells;
  this._boardPlace = place;
  this.boardCards = new Array(savedCards.length).fill(null);

  savedCards.forEach((saved, index) => {
    if (!saved?.data) return;
    const data = saved.data;
    const fallbackCell = layoutCells[index] || data.brick;
    const fallbackPosition = fallbackCell && place
      ? this.brickToPixel(fallbackCell.r, fallbackCell.c, place)
      : { x: 320, y: 180 };
    const x = Number.isFinite(saved.position?.x) ? saved.position.x : fallbackPosition.x;
    const y = Number.isFinite(saved.position?.y) ? saved.position.y : fallbackPosition.y;
    const revealed = !!saved.revealed;

    let cardSprite;
    if (!revealed) {
      cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'cardBack'));
    } else if (data.type === 'empty') {
      cardSprite = this.scene.add.rectangle(x, y, 70, 90, 0x000000, 0);
    } else if (data.sprite || data.name === 'Mimic') {
      const key = data.name === 'Mimic' ? 'mimic' : data.sprite;
      cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, key, data.spriteFrame));
    } else {
      const colors = {
        coin: 0xffd700, crystal: 0x00ffff, trap: 0xff4500,
        armor: 0x888888, potion: 0xff69b4, gem: data.color || 0xffe066
      };
      cardSprite = this.scene.add.rectangle(x, y, 70, 90, colors[data.type] || 0x666666);
    }
    cardSprite.setScale(this._boardPlace?.cardScale || 1).setDepth(2).setInteractive();

    const notACard = ['gem', 'amulet', 'relic', 'empty', 'boss'].includes(data.type);
    const shadow = data.type === 'boss'
      ? null
      : this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6)
          .setDepth(1)
          .setAlpha(revealed && !notACard ? 1 : 0);
    const card = {
      sprite: cardSprite,
      shadow,
      revealed,
      justRevealed: !!saved.justRevealed,
      data
    };
    this.boardCards[index] = card;
    // Restore the elite "mystery" gold back on still-hidden highlight cards.
    if (!revealed && data.highlightedBack && cardSprite.setTint) cardSprite.setTint(this.constructor.ELITE_HIGHLIGHT_TINT);
    this.applyEliteMiniBossVisual(card);

    if (!revealed) {
      cardSprite.on('pointerdown', () => this.revealCard(index));
      cardSprite.on('pointerover', () => {
        const current = this.boardCards[index];
        if (!current || current.revealed) return;
        shadow?.setAlpha(1);
        this.scene.tweens.add({ targets: cardSprite, y: y - 5, duration: 150 });
        cardSprite.setTexture('cardBack');
        snapOriginToPixelGrid(cardSprite);
        if (this.scene.anims.exists('card_hover_anim')) cardSprite.play('card_hover_anim');
      });
      cardSprite.on('pointerout', () => {
        const current = this.boardCards[index];
        if (!current || current.revealed) return;
        shadow?.setAlpha(0);
        this.scene.tweens.add({ targets: cardSprite, y, duration: 150 });
        cardSprite.stop?.();
        cardSprite.setTexture('cardBack');
        snapOriginToPixelGrid(cardSprite);
      });
      return;
    }

    this.createCardInfoText(card);
    card.infoText?.setDepth?.(3);
    cardSprite.on('pointerdown', () => this.interactWithCard(index));
    this._attachBoardItemTooltip(card);
    if (data.type === 'boss') this._attachBossTooltip(card);
    if (data.type === 'gem') {
      this.attachGemShadow(card);
      this.enableGemDrag(card, index);
    }
    this.restoreEnemyStatusMarkers(card);
    if ((data.frozen || 0) > 0) this.attachFrozenFrame(card);

    // Trap damage already happened before the save; only finish its pending
    // removal rather than applying the trap a second time on Continue.
    if (data.type === 'trap') {
      this.scene.time.delayedCall(250, () => {
        if (this.boardCards[index] === card) this.removeCard(index);
      });
    }
  });

  if (place?.VSTEP) this.computeRowBands(this.boardCards, place.VSTEP);
  return true;
}

function convertCardToFood(floor) {
    const candidates = [];
    const preferredTypes = ['trap', 'coin', 'crystal'];
    this.boardCards.forEach((card, i) => {
        if (!card || !card.data) return;
        if (preferredTypes.includes(card.data.type)) candidates.push(i);
    });
    if (candidates.length === 0) return;
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const card = this.boardCards[idx];
    const foodData = this.cardDataGenerator.createCardData('food', floor);
    if (!foodData) return;
    // Preserve brick layout info so neighbor lookups still work
    foodData.brick = card.data.brick;
    card.data = foodData;
}

function spawnBossRewardBoard(items) {
    items = (items || []).filter(Boolean);
    // Clear whatever was on the board (boss fight remnants)
    this.clearFloorBoardPanel();
    this.boardCards.forEach(card => {
        if (!card) return;
        this.killCardTweens(card);
        card.sprite?.destroy();
        card.shadow?.destroy();
        card.hoverSprite?.destroy();
        card.frozenFrame?.destroy();
        if (card.infoText) {
            if (card.infoText.list) card.infoText.destroy(true);
            else card.infoText.destroy();
        }
    });
    this.boardCards = [];
    this.clearBossRewardChest();

    // Decorative chest sprite at the top of the play area
    const chestX = 320;
    const chestY = 95;
    const chestTexture = this.scene.textures.exists('bigChestAnimation') ? 'bigChestAnimation' : 'cardBack';
    this.bossRewardChest = this.scene.add.sprite(chestX, chestY, chestTexture, 0);
    if (this.scene.anims.exists('big_chest_open')) {
        this.bossRewardChest.play('big_chest_open');
    }
    SoundHelper.playSound(this.scene, 'chest_open', 0.5);

    // Three reward cards face-up below the chest
    const spacing = 100;
    const startX = 320 - spacing;
    const cardY = 195;
    items.forEach((item, i) => {
        const x = startX + i * spacing;
        // Gems and relics/amulets aren't cards — no rectangular card shadow
        const notACard = item.type === 'gem' || item.type === 'amulet' || item.type === 'relic';
        // Shadow starts hidden — revealed once the card lands so it doesn't
        // sit 60px below the card during the drop-in animation.
        const shadow = this.scene.add.rectangle(x, cardY + 28, 52, 15, 0x000000, 0.6);
        shadow.setAlpha(0);

        const spriteKey = item.sprite || 'cardBack';
        const cardSprite = snapOriginToPixelGrid(item.spriteFrame !== undefined
            ? this.scene.add.sprite(x, cardY, spriteKey, item.spriteFrame)
            : this.scene.add.sprite(x, cardY, spriteKey));
        cardSprite.setScale(this._boardPlace?.cardScale || 1);
        cardSprite.setInteractive({ useHandCursor: true });

        // Hover shine sprite (cards only) — same animation the inventory uses.
        // Starts hidden via alpha 0 + invisible so there's no first-frame flash.
        let hoverSprite = null;
        if (!notACard && this.scene.textures.exists('hoverCardsUpSheet')) {
            hoverSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, cardY, 'hoverCardsUpSheet', 0));
            hoverSprite.setVisible(false);
            hoverSprite.setAlpha(0);
            hoverSprite.setBlendMode(Phaser.BlendModes.SCREEN);
            hoverSprite.setDepth((cardSprite.depth || 0) + 1);
        }

        const cardEntry = { sprite: cardSprite, shadow, hoverSprite, revealed: true, data: item };
        this.boardCards.push(cardEntry);
        const myIndex = this.boardCards.length - 1;

        cardSprite.on('pointerdown', () => this.takeRewardCard(myIndex));
        cardSprite.on('pointerover', () => {
            // Lift the card and round each frame so its pixel art stays crisp.
            this.scene.tweens.add({
                targets: cardSprite, y: cardY - 5, duration: 150, ease: 'Power2',
                onUpdate: this.snapYOnUpdate
            });
            // Lift the pips/value container with the card (it was lagging behind).
            // Lift is relative to the container's resting y — some info containers
            // sit at the card (y=cardY), others at (0,0) with absolute children.
            if (cardEntry.infoText && cardEntry.infoText.scene) {
                const infoTarget = cardEntry.infoText;
                const restY = cardEntry.infoRestY ?? infoTarget.y;
                this.scene.tweens.add({
                    targets: infoTarget, y: restY - 5, duration: 150, ease: 'Power2',
                    onUpdate: this.snapYOnUpdate
                });
            }
            // Play the shine animation, lifting it with the card.
            if (hoverSprite && this.scene.anims?.exists?.('hover_cards_anim')) {
                hoverSprite.setVisible(true);
                hoverSprite.setAlpha(1);
                hoverSprite.play('hover_cards_anim');
                this.scene.tweens.add({
                    targets: hoverSprite, y: cardY - 5, duration: 150, ease: 'Power2',
                    onUpdate: this.snapYOnUpdate
                });
            }
            showItemTooltip(this.scene, item, cardSprite.x, cardSprite.y);
        });
        cardSprite.on('pointerout', () => {
            this.scene.tweens.add({
                targets: cardSprite, y: cardY, duration: 150, ease: 'Power2',
                onUpdate: this.snapYOnUpdate
            });
            if (cardEntry.infoText && cardEntry.infoText.scene) {
                const infoTarget = cardEntry.infoText;
                const restY = cardEntry.infoRestY ?? infoTarget.y;
                this.scene.tweens.add({
                    targets: infoTarget, y: restY, duration: 150, ease: 'Power2',
                    onUpdate: this.snapYOnUpdate
                });
            }
            if (hoverSprite) {
                this.scene.tweens.add({
                    targets: hoverSprite, y: cardY, duration: 150, ease: 'Power2',
                    onUpdate: this.snapYOnUpdate
                });
                hoverSprite.setVisible(false);
                hoverSprite.setAlpha(0);
                hoverSprite.stop?.();
            }
            hideItemTooltip(this.scene);
        });
        cardSprite.once('destroy', () => hideItemTooltip(this.scene));

        // Drop-in animation from above the chest.
        // createCardInfoText is deferred to onComplete so the pips/durability
        // dots are positioned at the card's final resting y, not its start y.
        cardSprite.setAlpha(0);
        cardSprite.y = cardY - 60;
        this.scene.tweens.add({
            targets: cardSprite,
            y: cardY,
            alpha: 1,
            duration: 400 + i * 120,
            ease: 'Back.Out',
            onComplete: () => {
                this.createCardInfoText(cardEntry);
                // Remember the info container's resting y so hover lifts it relative
                // to where it actually sits (some sit at the card, some at y=0).
                if (cardEntry.infoText) cardEntry.infoRestY = cardEntry.infoText.y;
                if (!notACard) shadow.setAlpha(0.6);
            }
        });
    });
}

function takeRewardCard(index) {
    const card = this.boardCards[index];
    if (!card) return;

    const data = card.data;
    let success = false;

    if (data.type === 'amulet') {
        if (data.pendingChoice || (data.options?.length && !data.id)) {
            const floor = this.scene.gameState?.currentFloor || 1;
            const offer = data.options?.length
                ? data
                : this.cardDataGenerator.createAmuletOffer(data.source || 'boss', floor, this.scene.gameState);
            if (!offer?.options?.length) return;
            // A stale boss-reward offer can be entirely owned by now; don't
            // open a window whose every choice would be refused.
            const takeable = this.scene.amuletManager?.takeableOptions?.(offer.options)
                ?? offer.options;
            if (!takeable.length) {
                this.removeCard(index);
                this.scene.createFloatingText?.(320, 180, 'Nothing new to offer', 0xaaaaaa);
                return;
            }
            this.removeCard(index);
            openAmuletChoiceOverlay(this.scene, {
                rarity: offer.rarity,
                options: takeable,
                amuletManager: this.scene.amuletManager,
                title: `Boss reward — ${offer.rarity} amulet`,
                onPicked: () => this.scene.updateUI?.(),
            });
            return;
        }
        if (this.scene.amuletManager && data.id) {
            success = this.scene.amuletManager.addAmulet(data.id);
            if (!success) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Already owned!', 0xff4444);
                return;
            }
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, `${data.name} equipped!`, 0x9932cc);
        }
    } else if (this.scene.inventorySystem.addCard(data)) {
        success = true;
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Taken!', 0x00ff00);
    } else {
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Inventory Full!', 0xff4444);
        return;
    }

    if (success) {
        SoundHelper.playSound(this.scene, 'shop_buy', 0.5);
        this.removeCard(index);
        this.scene.updateUI();
    }
}

function clearBossRewardChest() {
    if (this.bossRewardChest) {
        this.bossRewardChest.destroy();
        this.bossRewardChest = null;
    }
}

function spawnDeathDrop(index, originalCard) {
    const card = this.boardCards[index];
    if (!card || !card.sprite) return;

    // Random non-enemy pickup type. Mask of Hollow Whispers cannot leave
    // traps, enemies, or empty cards behind.
    const dropTypes = ['coin', 'crystal', 'gem', 'food', 'potion', 'weapon', 'armor', 'magic', 'thorns', 'amulet'];
    const type = dropTypes[Math.floor(Math.random() * dropTypes.length)];
    let newData = this.cardDataGenerator.createCardData(
        type,
        this.scene.gameState.currentFloor,
        false,
        this.scene.gameState
    );
    // Guard against a generator returning a forbidden type.
    if (newData && (newData.type === 'trap' || newData.type === 'empty'
        || newData.type === 'enemy' || newData.type === 'eliteEnemy' || newData.type === 'boss')) {
        newData = this.cardDataGenerator.createCardData(
            'coin',
            this.scene.gameState.currentFloor,
            false,
            this.scene.gameState
        );
    }
    if (!newData) {
        this.removeCard(index);
        return;
    }

    // Preserve brick position so neighbor reveals still work
    if (card.data?.brick) newData.brick = card.data.brick;
    if (card.data?.brickNeighbors) newData.brickNeighbors = card.data.brickNeighbors;

    // Position & info text cleanup
    const x = card.sprite.x;
    const y = card.sprite.y;
    if (card.infoText) {
        if (card.infoText.list) card.infoText.destroy(true);
        else card.infoText.destroy();
        card.infoText = null;
    }
    // The dying card may have carried enemy-only overlays (poison status icon,
    // role badge). Destroy them or they linger on top of the new loot card.
    if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
    if (card.shockMarker) { card.shockMarker.destroy(); card.shockMarker = null; }
    if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
    if (card.frozenFrame) { card.frozenFrame.destroy(); card.frozenFrame = null; }
    card.sprite.destroy();
    card.data = newData;

    // Build a new sprite already in the "revealed" state
    const spriteKey = newData.sprite || 'cardBack';
    const newSprite = snapOriginToPixelGrid(newData.spriteFrame !== undefined
        ? this.scene.add.sprite(x, y, spriteKey, newData.spriteFrame)
        : this.scene.add.sprite(x, y, spriteKey));
    newSprite.setScale(this._boardPlace?.cardScale || 1);
    newSprite.setInteractive();
    newSprite.on('pointerdown', () => this.interactWithCard(index));
    card.sprite = newSprite;
    card.revealed = true;

    this.createCardInfoText(card);
    // Same hover tooltip the normal reveal path attaches.
    this._attachBoardItemTooltip(card);
    // Gems and relics/amulets aren't cards — hide the inherited rectangular shadow
    if (newData.type === 'gem' || newData.type === 'amulet' || newData.type === 'relic') {
        if (card.shadow) card.shadow.setAlpha(0);
    }
    if (newData.type === 'gem') {
        this.attachGemShadow(card);
        this.enableGemDrag(card, index);
    }

    // Visual feedback — small fade-in and "Loot!" floater
    // The dropped card hops out of the defeated enemy's tile, then settles
    // exactly back into its board slot. Move its info/gem overlay by the
    // same relative amount so the card stays attached to its own UI.
    const entranceParts = [newSprite, card.infoText, card.gemShadow]
        .filter(part => part?.scene)
        .map(part => ({ part, homeY: part.y }));
    entranceParts.forEach(({ part, homeY }) => {
        part.y = homeY + 12;
        part.setAlpha?.(0);
    });
    newSprite.setScale(0.88);
    this.scene.tweens.add({
        targets: entranceParts.map(({ part }) => part),
        y: '-=22',
        alpha: 1,
        duration: 220,
        ease: 'Sine.easeOut',
        onComplete: () => {
            this.scene.tweens.add({
                targets: entranceParts.map(({ part }) => part),
                y: '+=10',
                duration: 180,
                ease: 'Bounce.easeOut',
                onComplete: () => {
                    entranceParts.forEach(({ part, homeY }) => {
                        if (part?.scene) part.y = homeY;
                    });
                }
            });
        }
    });
    this.scene.tweens.add({
        targets: newSprite,
        scaleX: 1,
        scaleY: 1,
        duration: 260,
        ease: 'Back.easeOut'
    });
    SoundHelper.playSound(this.scene, 'card_flip', 0.5);
    this.scene.createFloatingText(x, y - 24, 'Loot!', 0xffd700);
}

function previewTrapAt(index) {
    const card = this.boardCards[index];
    if (!card || card.revealed || card.data?.type !== 'trap') return;

    // Temporarily mark revealed so hover-lift / pointerdown don't fire
    card.revealed = true;

    const spriteKey = card.data.sprite || 'default_enemy';
    card.sprite.setTexture(spriteKey, card.data.spriteFrame);
    snapOriginToPixelGrid(card.sprite);
    this.createCardInfoText(card);
    SoundHelper.playSound(this.scene, 'card_flip', 0.4);
    this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Trap! Remember…', 0xff6644);

    // Peek window — close back after a moment
    this.scene.time.delayedCall(2500, () => {
        // Bail if the board was cleared (floor change / shop) — the sprite
        // may be destroyed even though the reference still exists.
        if (!card.sprite || !card.sprite.scene) return;
        // Subtle squish to imply the card is flipping back over
        this.scene.tweens.add({
            targets: card.sprite,
            scaleX: 0.05,
            duration: 120,
            ease: 'Quad.In',
            onComplete: () => {
                if (!card.sprite || !card.sprite.scene) return;
                card.sprite.setTexture('cardBack');
                snapOriginToPixelGrid(card.sprite);
                if (card.infoText) {
                    if (card.infoText.list) card.infoText.destroy(true);
                    else card.infoText.destroy();
                    card.infoText = null;
                }
                card.revealed = false;
                this.scene.tweens.add({
                    targets: card.sprite,
                    scaleX: 1,
                    duration: 120,
                    ease: 'Quad.Out'
                });
                SoundHelper.playSound(this.scene, 'card_flip', 0.35);
            }
        });
    });
}

function ensureWeaponSupply(floor, roomType) {
  if (!this.boardCards?.length || roomType === 'BOSS') return;

  const desiredWeapons = floor >= 10 || roomType === 'ELITE' || this.boardCards.length >= 10 ? 2 : 1;
  const currentWeapons = this.boardCards.filter(card => card?.data?.type === 'weapon').length;
  let missing = Math.max(0, desiredWeapons - currentWeapons);
  if (missing === 0) return;

  const replacePriority = ['coin', 'food', 'armor', 'crystal', 'amulet', 'potion'];
  for (const type of replacePriority) {
    for (let i = 0; i < this.boardCards.length && missing > 0; i++) {
      const card = this.boardCards[i];
      if (!card?.data || card.data.type !== type) continue;

      const brick = card.data.brick;
      const brickNeighbors = card.data.brickNeighbors;
      card.data = this.cardDataGenerator.createCardData('weapon', floor);
      if (card.data) {
        card.data.brick = brick;
        if (brickNeighbors) card.data.brickNeighbors = brickNeighbors;
        missing--;
      }
    }
  }
}

function limitEnemyDensity(floor, roomType) {
  if (!this.boardCards?.length || roomType === 'BOSS') return;

  const maxRatio = floor <= 14 ? 0.45 : 0.55;
  const bonus = roomType === 'ELITE' ? 1 : 0;
  const maxEnemies = Math.max(2, Math.ceil(this.boardCards.length * maxRatio) + bonus);
  const enemyIndexes = this.boardCards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => this.isEnemyType(card?.data?.type) && card?.data?.type !== 'boss')
    .map(({ index }) => index);
  let excess = enemyIndexes.length - maxEnemies;
  if (excess <= 0) return;

  Phaser.Utils.Array.Shuffle(enemyIndexes);
  // 'gem' is gated to floor 7+ to match the loot-weight curve (no gems in
  // early act 1); otherwise density replacement leaks gems off-curve.
  const baseTypes = floor < 7
    ? ['weapon', 'armor', 'potion', 'magic', 'coin', 'crystal', 'food']
    : ['weapon', 'armor', 'potion', 'gem', 'magic', 'coin', 'crystal', 'food'];
  let gemsOnBoard = this.boardCards.filter((c) => c?.data?.type === 'gem').length;
  for (const index of enemyIndexes) {
    if (excess <= 0) break;
    const card = this.boardCards[index];
    if (!card?.data) continue;
    const brick = card.data.brick;
    // Honor the 2-gem-per-floor cap: drop 'gem' from the pool once reached.
    const replacementTypes = gemsOnBoard >= 2 ? baseTypes.filter((t) => t !== 'gem') : baseTypes;
    const replacementType = replacementTypes[Math.floor(Math.random() * replacementTypes.length)];
    const replacement = this.cardDataGenerator.createCardData(
      replacementType,
      floor,
      false,
      this.scene.gameState
    );
    if (!replacement) continue;
    replacement.brick = brick;
    card.data = replacement;
    if (replacement.type === 'gem') gemsOnBoard++;
    excess--;
  }
}

function ensureEnemyMinimum(floor, roomType) {
  if (!this.boardCards?.length || roomType === 'BOSS') return;
  // Sim showed the old 12/16% ratios let the player kill a few enemies
  // then loot the rest of the board — way too easy. Act 2 jumps to 35%
  // and act 3 to 45%, so most cards on the board are fights.
  const minRatio = minEnemyRatioForFloor(floor);
  const bonus = roomType === 'ELITE' ? 1 : 0;
  const minEnemies = Math.max(2, Math.round(this.boardCards.length * minRatio) + bonus);
  const isEnemy = (c) => this.isEnemyType(c?.data?.type);
  let count = this.boardCards.filter(isEnemy).length;
  if (count >= minEnemies) return;

  const convertible = this.boardCards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.data && !isEnemy(card) && card.data.type !== 'key')
    .map(({ index }) => index);
  Phaser.Utils.Array.Shuffle(convertible);
  for (const index of convertible) {
    if (count >= minEnemies) break;
    const card = this.boardCards[index];
    const brick = card.data.brick;
    const enemyData = this.cardDataGenerator.createCardData('enemy', floor, roomType === 'ELITE');
    if (!enemyData) continue;
    if (brick) { enemyData.brick = brick; enemyData.role = brick.r > 0 ? 'MELEE' : 'RANGED'; }
    card.data = enemyData;
    count++;
  }
}

function assignEliteMiniBoss(roomType) {
  if (roomType !== 'ELITE' || !this.boardCards?.length) return;
  const enemies = this.boardCards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => (
      card?.data
      && this.isEnemyType(card.data.type)
      && card.data.type !== 'boss'
      && card.data.name !== 'Angry Nestmother'
    ));
  if (enemies.length === 0) return;
  if (enemies.some(({ card }) => card.data.isEliteMiniBoss)) return;

  const selected = Phaser.Utils.Array.GetRandom(enemies);
  if (!selected?.card?.data) return;

  const data = selected.card.data;
  data.isEliteMiniBoss = true;
  data.health = Math.max(1, Math.ceil((data.health || 1) * 1.3));
  data.attack = Math.max(1, Math.ceil((data.attack || 1) * 1.3));
}

function assignEliteHighlightCards(roomType, floor) {
  if (roomType !== 'ELITE' || !this.boardCards?.length) return;

  const HL_TINT = this.constructor.ELITE_HIGHLIGHT_TINT; // light, non-yellow highlight
  const markHighlight = (card) => {
    if (!card?.data) return;
    card.data.highlightedBack = true;
    if (!card.revealed && card.sprite?.setTint) card.sprite.setTint(HL_TINT);
  };

  // 1) The mini-boss is the "danger" highlight (already boosted + flagged).
  const miniBoss = this.boardCards.find(c => c?.data?.isEliteMiniBoss);
  if (miniBoss) markHighlight(miniBoss);

  // 2) The "reward" highlight: overwrite a still-hidden, non-essential card
  //    with a rare item or amulet. Prefer a non-enemy slot so the elite
  //    fight keeps its teeth; fall back to any non-mini-boss card.
  const isReplaceable = (c) => c?.data && !c.data.highlightedBack
    && !c.data.isMimic && c.data.type !== 'boss' && c.data.type !== 'key';
  const nonEnemy = this.boardCards.filter(c => isReplaceable(c) && !this.isEnemyType(c.data.type));
  const pool = nonEnemy.length ? nonEnemy
    : this.boardCards.filter(c => isReplaceable(c) && !c.data.isEliteMiniBoss);
  if (!pool.length) return;

  const rewardCard = Phaser.Utils.Array.GetRandom(pool);
  const brick = rewardCard.data.brick;
  let rewardData;
  if (Math.random() < 0.45) {
    rewardData = this.createCardData('amulet', floor, false, this.scene.gameState);
  } else {
    const t = Phaser.Utils.Array.GetRandom(['weapon', 'armor']);
    rewardData = this.createCardData(t, floor, false, null, 'rare');
  }
  if (!rewardData) return;
  if (brick) rewardData.brick = brick;
  rewardCard.data = rewardData;
  markHighlight(rewardCard);
}

function injectAngryNestmother(floor, roomType) {
  const story = this.scene.gameState?.storyRun;
  if (!story || story.birdAngry !== true) return false;
  if (roomType !== 'COMBAT' && roomType !== 'ELITE') return false;

  // One roll per floor spawn — re-entering the room won't re-roll.
  if (story.angryNestmotherRollFloor === floor) return false;
  story.angryNestmotherRollFloor = floor;

  // Never stack a second nestmother onto a board that already has one.
  if (this.boardCards.some(c => c?.data?.storyEnemy === 'angry_nestmother')) return false;

  if (Math.random() >= 0.22) return false;

  // Take over an existing enemy slot. Prefer a back-row (RANGED) slot so the
  // archer sits where she belongs; fall back to any enemy on an all-melee
  // board. She's forced to RANGED either way.
  const enemyCards = this.boardCards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.data?.type === 'enemy' && card?.data?.storyEnemy !== 'angry_nestmother');
  if (enemyCards.length === 0) return false;

  const backRow = enemyCards.filter(({ card }) => (card.data.brick?.r ?? 1) === 0);
  const pool = backRow.length > 0 ? backRow : enemyCards;
  const { card } = pool[Math.floor(Math.random() * pool.length)];

  const brick = card.data.brick;
  const nestmother = this.cardDataGenerator.createAngryNestmotherCard(floor);
  if (brick) nestmother.brick = brick;
  nestmother.role = 'RANGED';
  nestmother.isRangedType = true;
  card.data = nestmother;
  return true;
}

function spawnBoss() {
    const bossData = this.cardDataGenerator.createCardData('boss', this.scene.gameState.currentFloor);
    bossData.maxHealth = bossData.maxHealth || bossData.health;
    const cam = this.scene.cameras.main;
    const x = cam.width / 2 - 20; // match the 20px-left board shift
    const bossOffsetY = bossData.name === 'Spider Queen' ? -100 : 0;
    const y = cam.height / 2 + bossOffsetY;
    this.createBossBoardPanel();
    const cardSprite = snapOriginToPixelGrid(this.scene.add.image(x, y, bossData.sprite));
    
    const card = {
        sprite: cardSprite,
        revealed: true,
        data: bossData
    };
    this.boardCards[4] = card;
    this.createCardInfoText(card);
    this.playBossEntrance(cardSprite, bossData);
    card.sprite.setInteractive();
    // Hover the boss to read its attack and abilities.
    this._attachBossTooltip(card);
    this.scene.time.delayedCall(650, () => this.applyHolographicOmenStartEffect());
}

function pickCardType(currentFloor, excludedTypes = []) {
    const weights = this.cardDataGenerator.getCardWeights(currentFloor);
    const excluded = new Set(excludedTypes);
    
    // Calculate total weight
    const totalWeight = Object.entries(weights).reduce((sum, [type, weight]) => (
        excluded.has(type) ? sum : sum + weight
    ), 0);
    if (totalWeight <= 0) return 'coin';
    let random = Math.random() * totalWeight;
    
    // Select card type based on weights
    for (let [cardType, weight] of Object.entries(weights)) {
        if (excluded.has(cardType)) continue;
        random -= weight;
        if (random <= 0) {
            return cardType;
        }
    }
    
    // Fallback (should never reach here)
    return 'coin';
}

function generateRandomCard() {
    const currentFloor = this.scene.gameState.currentFloor;
    const type = this.pickCardType(currentFloor);
    return this.cardDataGenerator.createCardData(type, currentFloor, false, this.scene.gameState);
}

function summonEnemy(enemyType, bossCard) {
    // Find empty slot
    let emptySlot = -1;
    for (let i = 0; i < this.boardCards.length; i++) {
        if (!this.boardCards[i]) {
            emptySlot = i;
            break;
        }
    }
    
    if (emptySlot === -1) return;
    
    // Create the appropriate enemy based on what the boss summons
    const floor = this.scene.gameState.currentFloor;
    let summonedEnemy;
    
    // Build the SPECIFIC enemy type the boss summons so its HP/attack come from
    // that creature's tier — NOT a random enemy. createCardData('enemy') rolls a
    // random type, which let summoned "spiders" secretly carry skeleton/goblin
    // stats (way more HP & damage than a real spider).
    summonedEnemy = this.cardDataGenerator.createTieredEnemy(enemyType, floor);

    // Cosmetic overrides for the summoned variant.
    switch(enemyType) {
        case 'spider':
            summonedEnemy.name = 'Spider';
            summonedEnemy.sprite = 'spider_c';
            summonedEnemy.abilities = [{ type: 'poison', damage: 1, turns: 2, stackable: true }];
            break;
        case 'goblin':
            summonedEnemy.name = 'Goblin';
            summonedEnemy.sprite = 'goblin_c';
            break;
        case 'skeleton':
            summonedEnemy.name = 'Skeleton';
            summonedEnemy.sprite = 'skeleton_c';
            break;
    }
    
    // Summoned minions come in weaker than the real thing — they're conjured
    // mid-fight, so they hit softer and have less HP. Without this, a boss that
    // summons every couple of turns (Lich, Giant Skeleton) buries the player
    // under a wall of full-strength adds faster than they can be cleared.
    summonedEnemy.attack = Math.max(1, Math.round(summonedEnemy.attack * 0.6));
    summonedEnemy.health = Math.max(1, Math.round(summonedEnemy.health * 0.65));
    summonedEnemy.maxHealth = summonedEnemy.health;

    // Add "Summoned" prefix to distinguish from regular enemies
    summonedEnemy.name = 'Summoned ' + summonedEnemy.name;
    
    // Calculate position and create the card (rest of your existing code)
    const row = Math.floor(emptySlot / 4);
    const col = emptySlot % 4;
    const x = 220 + col * (52 + 8);
    const y = 145 + row * (70 + 12);
    
    // Create card sprite with animation
    const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
    shadow.setAlpha(0);
    
    const cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, summonedEnemy.sprite));
    cardSprite.setAlpha(0);
    cardSprite.setInteractive();
    
    // Animate the summon
    this.scene.tweens.add({
        targets: cardSprite,
        alpha: 1,
        duration: 500,
        ease: 'Back.easeOut',
        onComplete: () => {
            const flash = this.scene.add.circle(x, y, 40, 0x9932cc, 0.8);
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: 2,
                duration: 400,
                onComplete: () => flash.destroy()
            });
        }
    });
    
    // Create the board card
    this.boardCards[emptySlot] = {
        sprite: cardSprite,
        shadow: shadow,
        revealed: true,
        data: summonedEnemy
    };
    
    this.createCardInfoText(this.boardCards[emptySlot]);
    
    // Visual feedback
    this.scene.createFloatingText(bossCard.sprite.x, bossCard.sprite.y, 'Summoning!', 0x9932cc);
    this.scene.createFloatingText(x, y - 30, 'Summoned!', 0xff00ff);
    
    SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
}

function respawnCardOnBoard(cardData, options = {}) {
    if (!cardData) return false;
    // Find a slot that's currently empty (a previously-cleared brick cell).
    let slot = -1;
    for (let i = 0; i < this.boardCards.length; i++) {
        if (!this.boardCards[i]) { slot = i; break; }
    }
    if (slot === -1 || !this._boardCells || !this._boardPlace) return false;
    const cell = this._boardCells[slot];
    if (!cell) return false;
    const { x, y } = this.brickToPixel(cell.r, cell.c, this._boardPlace);

    const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
    shadow.setAlpha(0);
    const cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'cardBack'));
    cardSprite.setScale(this._boardPlace?.cardScale || 1);
    cardSprite.setInteractive();
    cardSprite.on('pointerdown', () => this.revealCard(slot));
    cardSprite.on('pointerover', () => {
        const c = this.boardCards[slot];
        if (c && !c.revealed) {
            shadow.setAlpha(1);
            this.scene.tweens.add({ targets: cardSprite, y: y - 5, duration: 150 });
            cardSprite.setTexture('cardBack');
            snapOriginToPixelGrid(cardSprite);
            if (this.scene.anims.exists('card_hover_anim')) cardSprite.play('card_hover_anim');
        }
    });
    cardSprite.on('pointerout', () => {
        const c = this.boardCards[slot];
        if (c && !c.revealed) {
            shadow.setAlpha(0);
            this.scene.tweens.add({ targets: cardSprite, y: y, duration: 150 });
            cardSprite.stop();
            cardSprite.setTexture('cardBack');
            snapOriginToPixelGrid(cardSprite);
        }
    });

    // Sparkly entry — quick scale-in + magic flash so the player notices.
    if (!options.silent) {
        const endScale = this._boardPlace?.cardScale || 1;
        cardSprite.setScale(0.1);
        this.scene.tweens.add({ targets: cardSprite, scale: endScale, duration: 250, ease: 'Back.easeOut' });
        const flash = this.scene.add.circle(x, y, 30, 0x66ddff, 0.7);
        this.scene.tweens.add({
            targets: flash, alpha: 0, scale: 2, duration: 400,
            onComplete: () => flash.destroy()
        });
        SoundHelper.playSound(this.scene, 'magic_cast', 0.4);
        this.scene.createFloatingText(x, y - 30, 'Webwoven!', 0x66ddff);
    }

    // Card is face-down — player must reveal it like any other floor card.
    // Deep-copy the data so it's independent from the merged source object.
    const respawnedData = JSON.parse(JSON.stringify(cardData));
    // The source card was consumed mid-merge and may have been worn down, so
    // restore its pips to full — a respawned card should arrive at full durability.
    if (respawnedData.maxDurability) {
        respawnedData.durability = respawnedData.maxDurability;
    }
    this.boardCards[slot] = {
        sprite: cardSprite,
        shadow,
        revealed: false,
        data: respawnedData
    };
    return true;
}

function dropWaveCards() {
    if (!this._boardCells || !this._boardPlace) { if (this._waveState) this._waveState.dropping = false; return false; }

    // Every empty slot that still has a cached cell to drop into.
    const emptySlots = [];
    for (let i = 0; i < this.boardCards.length; i++) {
        if (!this.boardCards[i] && this._boardCells[i]) emptySlots.push(i);
    }
    if (!emptySlots.length) { if (this._waveState) this._waveState.dropping = false; return false; }

    if (this._waveState) this._waveState.dropping = true;
    const cf = this.scene.gameState?.currentFloor || 1;
    const roomType = this.scene.gameState?.roomType || this.scene.roomType || 'COMBAT';

    // Cascade order: top rows first, then left→right, so it reads as a pour.
    emptySlots.sort((a, b) => {
        const ca = this._boardCells[a], cb = this._boardCells[b];
        return (ca.r - cb.r) || (ca.c - cb.c);
    });

    const STAGGER = 90, FALL_MS = 430, DROP_HEIGHT = 280;
    emptySlots.forEach((slot, order) => {
        const cell = this._boardCells[slot];
        const { x, y } = this.brickToPixel(cell.r, cell.c, this._boardPlace);

        const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6).setAlpha(0);
        const cardSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y - DROP_HEIGHT, 'cardBack'));
        cardSprite.setScale(this._boardPlace?.cardScale || 1).setInteractive();
        cardSprite.on('pointerdown', () => this.revealCard(slot));
        cardSprite.on('pointerover', () => {
            const c = this.boardCards[slot];
            if (c && !c.revealed) {
                shadow.setAlpha(1);
                this.scene.tweens.add({ targets: cardSprite, y: y - 5, duration: 150 });
                cardSprite.setTexture('cardBack');
                snapOriginToPixelGrid(cardSprite);
                if (this.scene.anims.exists('card_hover_anim')) cardSprite.play('card_hover_anim');
            }
        });
        cardSprite.on('pointerout', () => {
            const c = this.boardCards[slot];
            if (c && !c.revealed) {
                shadow.setAlpha(0);
                this.scene.tweens.add({ targets: cardSprite, y: y, duration: 150 });
                cardSprite.stop();
                cardSprite.setTexture('cardBack');
                snapOriginToPixelGrid(cardSprite);
            }
        });

        // Fresh floor-appropriate card (mostly enemies, via pickCardType).
        const desiredRole = cell.r > 0 ? 'MELEE' : 'RANGED';
        const type = this.pickCardType(cf);
        let data = this.createCardData(type, cf, roomType === 'ELITE', this.scene.gameState, null, desiredRole);
        if (!data) {
            data = this.createCardData('coin', cf) || {
                type: 'coin', name: 'Coin', value: 1, sprite: 'coin',
            };
        }
        if (data) {
            data.brick = { r: cell.r, c: cell.c };
            if (this.isEnemyType(data.type)) data.role = desiredRole;
        }
        this.boardCards[slot] = { sprite: cardSprite, shadow, revealed: false, data };

        this.scene.tweens.add({
            targets: cardSprite,
            y,
            delay: order * STAGGER,
            duration: FALL_MS,
            ease: 'Bounce.easeOut',
            onComplete: () => { if (cardSprite.active) SoundHelper.playVariant(this.scene, 'card_place', 0.35); }
        });
    });

    this.scene.createFloatingText?.(320, 70, 'Reinforcements!', 0xffcc66);

    // After the last card lands, refresh adjacency/bands, release the lock,
    // and re-check clear (in case the wave was all loot and is already thin).
    const settleMs = (emptySlots.length - 1) * STAGGER + FALL_MS + 60;
    this.scene.time.delayedCall(settleMs, () => {
        this._rebuildBrickNeighbors();
        if (this._boardPlace?.VSTEP) this.computeRowBands(this.boardCards, this._boardPlace.VSTEP);
        if (this._waveState) this._waveState.dropping = false;
        this.checkFloorClear();
    });
    return true;
}

function createCardData(type, floor, isElite = false, gameState = null, targetRarity = null, preferredRole = null) {
    // Forward gameState (for amulet no-reroll rules) and targetRarity
    // (for forced shop/reward rarities). Defaulting gameState to the
    // scene's keeps board amulet drops consistent too. preferredRole lets the
    // caller request a MELEE/RANGED enemy so front/back rows get matching types.
    return this.cardDataGenerator.createCardData(
        type,
        floor || this.scene.gameState.currentFloor,
        isElite,
        gameState || this.scene.gameState,
        targetRarity,
        preferredRole
    );
}

function capRewardRarity(rarity, floor) {
    return this.cardDataGenerator.capRewardRarity(rarity, floor);
}

