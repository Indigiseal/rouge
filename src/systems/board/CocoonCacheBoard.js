// Silk Cocoon Cache board — event ambush for Silkdeep.
// Inspect: 8 revealed cocoons (1 HP shells). Deal any damage to crack one open;
// three hide loot (1 amulet + 2 weapon/armor), five hide month enemies.
// Burn: no enemies — three loot cards already revealed.

import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';

const COCOON_COUNT = 8;
const LOOT_COCOON_COUNT = 3;
/** Silkslinger webs the hand — useless / softlocky on a board you must damage to open. */
const COCOON_ENEMY_EXCLUDE = Object.freeze(new Set(['silkslinger']));

export function isSilkCocoonCard(data) {
  return !!(data?.isCocoon || (Array.isArray(data?.features) && data.features.includes('cocoon_shell')));
}

export function isSilkCocoonCacheRoom(gameState) {
  return gameState?.ambushId === 'silk_cocoon_cache';
}

/** Live hatched enemies (not unopened shells). */
export function boardHasOpenCocoonEnemies(boardCards = []) {
  return boardCards.some((card) => (
    card?.revealed
    && (card.data?.type === 'enemy' || card.data?.type === 'eliteEnemy' || card.data?.type === 'boss')
    && (card.data?.health ?? 1) > 0
    && !isSilkCocoonCard(card.data)
  ));
}

function rollCocoonEnemy(generator, floor, gameState) {
  const pool = (generator.getMonthEnemyPool?.(floor, null, gameState) || [])
    .filter((key) => !COCOON_ENEMY_EXCLUDE.has(key));
  if (pool.length > 0) {
    const enemyType = pool[Math.floor(Math.random() * pool.length)];
    return generator.createTieredEnemy(enemyType, floor, false);
  }
  // Fallback: keep rolling until we get a non-excluded type (or give up).
  for (let i = 0; i < 16; i++) {
    const enemy = generator.createEnemyCard(floor, false, null, gameState);
    if (enemy && !COCOON_ENEMY_EXCLUDE.has(enemy.enemyType)) return enemy;
  }
  return generator.createTieredEnemy('spider', floor, false)
    || generator.createEnemyCard(floor, false, null, gameState);
}

export function ensureSilkCocoonTexture(scene) {
  if (!scene?.textures || scene.textures.exists('silkCocoon')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x1a1520, 1);
  g.fillRoundedRect(0, 0, 54, 70, 4);
  g.fillStyle(0x2a2433, 1);
  g.fillRoundedRect(3, 3, 48, 64, 3);
  g.fillStyle(0xd4c4a0, 1);
  g.fillEllipse(27, 36, 30, 50);
  g.fillStyle(0xb8a878, 1);
  g.fillEllipse(27, 36, 22, 40);
  g.lineStyle(1, 0x8a7048, 0.9);
  for (let i = 0; i < 5; i++) {
    const y = 14 + i * 10;
    g.beginPath();
    g.moveTo(14, y);
    g.lineTo(40, y + 4);
    g.strokePath();
  }
  g.lineStyle(2, 0x6a5538, 0.7);
  g.strokeEllipse(27, 36, 30, 50);
  g.generateTexture('silkCocoon', 54, 70);
  g.destroy();
}

function rollCocoonLootSet(generator, floor, gameState) {
  const amulet = generator.createCardData('amulet', floor, false, gameState);
  const gearTypes = ['weapon', 'armor'];
  const gearA = generator.createCardData(
    gearTypes[Math.floor(Math.random() * gearTypes.length)],
    floor,
    false,
    gameState
  );
  const gearB = generator.createCardData(
    gearTypes[Math.floor(Math.random() * gearTypes.length)],
    floor,
    false,
    gameState
  );
  return [amulet, gearA, gearB].filter(Boolean);
}

function createCocoonShell(payload) {
  return {
    type: 'enemy',
    name: 'Silk Cocoon',
    health: 1,
    maxHealth: 1,
    attack: 0,
    sprite: 'silkCocoon',
    role: 'MELEE',
    features: ['cocoon_shell'],
    isCocoon: true,
    evadeChance: 0,
    cocoonPayload: payload,
  };
}

function placeBoardCard(cs, index, data, cells, place, revealed) {
  const { r, c } = cells[index];
  const { x, y } = cs.brickToPixel(r, c, place);
  const shadow = cs.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
  shadow.setAlpha(revealed && data.type !== 'amulet' && data.type !== 'gem' ? 1 : 0);

  const spriteKey = cs.scene.textures.exists(data.sprite) ? data.sprite : 'cardBack';
  const sprite = snapOriginToPixelGrid(
    data.spriteFrame !== undefined
      ? cs.scene.add.sprite(x, y, spriteKey, data.spriteFrame)
      : cs.scene.add.sprite(x, y, spriteKey)
  );
  sprite.setScale(place.cardScale || 1);
  sprite.setInteractive();

  const card = {
    sprite,
    shadow,
    revealed,
    data: { ...data, brick: { r, c } },
    restX: x,
    restY: y,
  };
  cs.boardCards[index] = card;

  if (revealed) {
    sprite.on('pointerdown', () => cs.interactWithCard(index));
    cs.createCardInfoText(card);
    cs._attachBoardItemTooltip?.(card);
    cs._attachEnemyBoardHover?.(card);
    if (data.type === 'gem') {
      cs.attachGemShadow?.(card);
      cs.enableGemDrag?.(card, index);
    }
  } else {
    sprite.setTexture('cardBack');
    sprite.on('pointerdown', () => cs.revealCard(index));
  }
  return card;
}

/**
 * @param {object} cs CardSystem (bound as `this` from FloorSpawner helpers)
 * @param {{ mode?: 'inspect'|'burn', id?: string }} ambush
 */
export function spawnSilkCocoonCacheBoard(cs, ambush) {
  const mode = ambush?.mode === 'burn' ? 'burn' : 'inspect';
  const floor = cs.scene.gameState?.currentFloor || 1;
  const gs = cs.scene.gameState;
  const gen = cs.cardDataGenerator;

  ensureSilkCocoonTexture(cs.scene);

  cs.scene.gameState.pendingAmbush = null;
  cs.scene.gameState.ambushId = ambush?.id || 'silk_cocoon_cache';
  cs._waveState = null;

  const lootSet = rollCocoonLootSet(gen, floor, gs);
  // Burn may leave fewer than 3 if amulets are disabled — still place what we have.
  while (lootSet.length < LOOT_COCOON_COUNT && mode === 'inspect') {
    const filler = gen.createCardData(
      Math.random() < 0.5 ? 'weapon' : 'armor',
      floor,
      false,
      gs
    );
    if (!filler) break;
    lootSet.push(filler);
  }

  if (mode === 'burn') {
    const count = Math.max(1, lootSet.length);
    const cells = cs.buildCompactBrickCluster(count);
    const place = cs.computePlacement(cells);
    cs.createFloorBoardPanel(cells, place, true);
    cs._boardCells = cells;
    cs._boardPlace = place;
    cs.boardCards = new Array(count).fill(null);
    lootSet.forEach((loot, i) => {
      if (i >= count) return;
      placeBoardCard(cs, i, loot, cells, place, true);
    });
    cs.scene.time.delayedCall(100, () => {
      cs.checkFloorClear?.();
      cs.scene.refreshSilkCocoonLeaveButton?.();
    });
    return;
  }

  // Inspect: eight cocoons, three pre-rolled as loot payloads.
  const cells = cs.buildCompactBrickCluster(COCOON_COUNT);
  const place = cs.computePlacement(cells);
  cs.createFloorBoardPanel(cells, place, true);
  cs._boardCells = cells;
  cs._boardPlace = place;
  cs.boardCards = new Array(COCOON_COUNT).fill(null);

  const lootSlots = new Set();
  while (lootSlots.size < Math.min(LOOT_COCOON_COUNT, lootSet.length)) {
    lootSlots.add(Math.floor(Math.random() * COCOON_COUNT));
  }
  const lootQueue = [...lootSet];

  for (let i = 0; i < COCOON_COUNT; i++) {
    let payload;
    if (lootSlots.has(i) && lootQueue.length > 0) {
      payload = { kind: 'loot', card: lootQueue.shift() };
    } else {
      payload = { kind: 'enemy', card: rollCocoonEnemy(gen, floor, gs) };
    }
    placeBoardCard(cs, i, createCocoonShell(payload), cells, place, true);
  }

  cs.scene.time.delayedCall(650, () => cs.applyHolographicOmenStartEffect?.());
  cs.scene.time.delayedCall(100, () => cs.scene.refreshSilkCocoonLeaveButton?.());
}

/**
 * Crack a cocoon open in-place: replace the shell with loot or a month enemy.
 * Called instead of a normal enemy death (opening is not a kill).
 */
export function openSilkCocoon(cs, index, cocoonCard) {
  const boardCard = cs.boardCards[index];
  if (!boardCard || !cocoonCard) return;

  const payload = cocoonCard.data?.cocoonPayload;
  const x = boardCard.sprite?.x ?? 0;
  const y = boardCard.sprite?.y ?? 0;
  const brick = cocoonCard.data?.brick;
  const brickNeighbors = cocoonCard.data?.brickNeighbors;

  if (boardCard.infoText) cs.destroyCardInfoText?.(boardCard);
  if (boardCard.poisonMarker) { boardCard.poisonMarker.destroy(); boardCard.poisonMarker = null; }
  if (boardCard.shockMarker) { boardCard.shockMarker.destroy(); boardCard.shockMarker = null; }
  if (boardCard.roleMarker) { boardCard.roleMarker.destroy(); boardCard.roleMarker = null; }
  if (boardCard.frozenFrame) { boardCard.frozenFrame.destroy(); boardCard.frozenFrame = null; }
  boardCard.sprite?.destroy?.();

  let newData = payload?.card;
  if (!newData || payload?.kind === 'enemy') {
    newData = payload?.card;
    if (!newData || COCOON_ENEMY_EXCLUDE.has(newData.enemyType)) {
      newData = rollCocoonEnemy(
        cs.cardDataGenerator,
        cs.scene.gameState?.currentFloor || 1,
        cs.scene.gameState
      );
    }
  }
  if (!newData) {
    cs.removeCard(index);
    cs.checkFloorClear?.();
    return;
  }

  if (brick) newData.brick = brick;
  if (brickNeighbors) newData.brickNeighbors = brickNeighbors;
  // Hatched enemies sit out the swing that cracked them open.
  const hatchedEnemy = newData.type === 'enemy' || newData.type === 'eliteEnemy';

  ensureSilkCocoonTexture(cs.scene);
  const spriteKey = cs.scene.textures.exists(newData.sprite)
    ? newData.sprite
    : (hatchedEnemy && cs.scene.textures.exists('spider_c') ? 'spider_c' : 'cardBack');
  const newSprite = snapOriginToPixelGrid(
    newData.spriteFrame !== undefined
      ? cs.scene.add.sprite(x, y, spriteKey, newData.spriteFrame)
      : cs.scene.add.sprite(x, y, spriteKey)
  );
  newSprite.setScale(cs._boardPlace?.cardScale || 1);
  newSprite.setInteractive();
  newSprite.on('pointerdown', () => cs.interactWithCard(index));

  boardCard.sprite = newSprite;
  boardCard.revealed = true;
  boardCard.data = newData;
  boardCard.justRevealed = hatchedEnemy;
  boardCard.restX = x;
  boardCard.restY = y;

  if (boardCard.shadow?.scene) {
    const hideShadow = newData.type === 'gem' || newData.type === 'amulet' || newData.type === 'relic';
    boardCard.shadow.setAlpha(hideShadow ? 0 : 1);
    boardCard.shadow.x = x;
    boardCard.shadow.y = y + 28;
  }

  cs.createCardInfoText(boardCard);
  cs._attachBoardItemTooltip?.(boardCard);
  cs._attachEnemyBoardHover?.(boardCard);
  if (newData.type === 'gem') {
    cs.attachGemShadow?.(boardCard);
    cs.enableGemDrag?.(boardCard, index);
  }

  const label = hatchedEnemy
    ? (newData.name || 'Enemy!')
    : (newData.name || 'Loot!');
  cs.scene.createFloatingText?.(x, y - 24, hatchedEnemy ? `${label}!` : 'Opened!', hatchedEnemy ? 0xff6666 : 0x66ff66);

  cs.checkFloorClear?.();
  cs.scene.refreshSilkCocoonLeaveButton?.();
}
