// BoardLayout — brick grid, placement, floor/boss panels, layout serialization
export class BoardLayout {
    constructor(cs) {
        this.buildBrickGrid = buildBrickGrid.bind(cs);
        this.pickConnectedBrick = pickConnectedBrick.bind(cs);
        this.buildCompactBrickCluster = buildCompactBrickCluster.bind(cs);
        this.computePlacement = computePlacement.bind(cs);
        this.brickToPixel = brickToPixel.bind(cs);
        this.clearFloorBoardPanel = clearFloorBoardPanel.bind(cs);
        this.createSideExtraPanel = createSideExtraPanel.bind(cs);
        this.killCardTweens = killCardTweens.bind(cs);
        this.snapYOnUpdate = snapYOnUpdate.bind(cs);
        this.clearBoard = clearBoard.bind(cs);
        this.createFloorBoardPanel = createFloorBoardPanel.bind(cs);
        this.createBossBoardPanel = createBossBoardPanel.bind(cs);
        this._brickSizeForCount = _brickSizeForCount.bind(cs);
        this.brickToPixelLegacy = brickToPixelLegacy.bind(cs);
        this.brickNeighbors = brickNeighbors.bind(cs);
        this.computeRowBands = computeRowBands.bind(cs);
        this.frontBandCount = frontBandCount.bind(cs);
        this.getSerializableBoardLayout = getSerializableBoardLayout.bind(cs);
        this._rebuildBrickNeighbors = _rebuildBrickNeighbors.bind(cs);
    }
}

function buildBrickGrid(n) {
  // Aim for a roughly square-ish grid, adjusted for brick density (odd rows offset)
  const aspect = 1.1; // Slightly wider for brick stagger
  let num_rows = Math.max(2, Math.round(Math.sqrt(n / aspect)));
  let num_cols = Math.ceil(n / num_rows);
  // Adjust if too skinny/tall
  while (num_rows * num_cols < n) num_cols++;
  while (num_cols > num_rows * 1.5) { num_rows++; num_cols = Math.ceil(n / num_rows); }
  
  const cells = [];
  let idx = 0;
  for (let r = 0; r < num_rows && idx < n; r++) {
    for (let c = 0; c < num_cols && idx < n; c++) {
      cells.push({ r, c });
      idx++;
    }
  }
  // Center the grid coords around (0,0) for better primitive midpoint
  const minR = Math.min(...cells.map(cell => cell.r));
  const minC = Math.min(...cells.map(cell => cell.c));
  return cells.map(cell => ({
    r: cell.r - minR,
    c: cell.c - minC
  }));
}

function pickConnectedBrick(n) {
  const key = (r,c) => `${r},${c}`;
  const chosen = new Set([key(0,0)]);
  const frontier = [{ r:0, c:0 }];
  while (chosen.size < n) {
    const from = frontier[Math.floor(Math.random() * frontier.length)];
    const OFFS = (from.r & 1) ? this.constructor.OFFS_ODD : this.constructor.OFFS_EVEN;
    // shuffle neighbors
    for (let i = OFFS.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [OFFS[i], OFFS[j]] = [OFFS[j], OFFS[i]];
    }
    let placed = false;
    for (const [dc, dr] of OFFS) {
      const nr = from.r + dr, nc = from.c + dc;
      const k = key(nr, nc);
      if (!chosen.has(k)) {
        chosen.add(k);
        frontier.push({ r: nr, c: nc });
        placed = true;
        break;
      }
    }
    // if stuck, push another existing tile to keep expanding
    if (!placed) {
      const any = Array.from(chosen)[Math.floor(Math.random() * chosen.size)];
      const [rr, cc] = any.split(',').map(Number);
      frontier.push({ r: rr, c: cc });
    }
  }
  // normalize so min r/c = 0 (helps centering)
  const cells = Array.from(chosen).map(s => {
    const [r,c] = s.split(',').map(Number);
    return { r, c };
  });
  const minR = Math.min(...cells.map(x => x.r));
  const minC = Math.min(...cells.map(x => x.c));
  return cells.map(x => ({ r: x.r - minR, c: x.c - minC }));
}

function buildCompactBrickCluster(n) {
  // choose a near-square row count
  let rows = Math.max(2, Math.round(Math.sqrt(n)));
  // distribute columns across rows as evenly as possible
  const base = Math.floor(n / rows);
  const rem  = n % rows;
  // row lengths (all base, then +1 given to middle rows first)
  const lens = new Array(rows).fill(base);
  // order rows from center outward: e.g. [2,1,3,0,4,...]
  const order = [];
  const mid = Math.floor(rows / 2);
  order.push(mid);
  for (let d = 1; order.length < rows; d++) {
    if (mid - d >= 0) order.push(mid - d);
    if (mid + d <  rows) order.push(mid + d);
  }
  for (let i = 0; i < rem; i++) lens[order[i]] += 1;
  // build cells; each row is centered horizontally
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const cols = lens[r];
    const startC = -Math.floor((cols - 1) / 2);  // centers the row
    for (let k = 0; k < cols; k++) {
      cells.push({ r, c: startC + k });
    }
  }
  return cells;
}

function computePlacement(cells, opts = {}) {
  // measure primitive bounds
  let minR = Infinity, maxR = -Infinity, minXp = Infinity, maxXp = -Infinity;
  for (const { r, c } of cells) {
    const xp = c + ((r & 1) ? 0.5 : 0);
    if (r  < minR)  minR  = r;
    if (r  > maxR)  maxR  = r;
    if (xp < minXp) minXp = xp;
    if (xp > maxXp) maxXp = xp;
  }
  const cam = this.scene.cameras.main;
  let areaLeft, areaRight, areaTop, areaBottom;
  if (this.constructor.USE_FIXED_PANEL) {
    // Scale the 640x360 design rect to the current camera
    const sx = cam.width  / 640;
    const sy = cam.height / 360;
    const R  = this.constructor.FIXED_PANEL_640x360;
    areaLeft   = R.left   * sx;
    areaTop    = R.top    * sy;
    areaRight  = (R.left + R.width)  * sx;
    areaBottom = (R.top  + R.height) * sy;
  } else {
    // fallback to fractional+padded panel (what you already have)
    const fracLeft   = cam.width  * this.constructor.BOARD_SAFE_FRAC.left;
    const fracRight  = cam.width  * (1 - this.constructor.BOARD_SAFE_FRAC.right);
    const fracTop    = cam.height * this.constructor.BOARD_SAFE_FRAC.top;
    const fracBottom = cam.height * (1 - this.constructor.BOARD_SAFE_FRAC.bottom);
    areaLeft   = Math.max(fracLeft,   this.constructor.BOARD_SAFE_PX.left);
    areaRight  = Math.min(fracRight,  cam.width  - this.constructor.BOARD_SAFE_PX.right);
    areaTop    = Math.max(fracTop,    this.constructor.BOARD_SAFE_PX.top);
    areaBottom = Math.min(fracBottom, cam.height - this.constructor.BOARD_SAFE_PX.bottom);
    const maxPanelW = Math.min(cam.width * 0.42, 340);
    const maxPanelH = Math.min(cam.height * 0.78, 300);
    if ((areaRight - areaLeft) > maxPanelW)  areaLeft  = areaRight  - maxPanelW;
    if ((areaBottom - areaTop) > maxPanelH)  areaTop   = areaBottom - maxPanelH;
  }
  // Optional caller override: clamp the bottom of the usable area so the
  // cluster stays above e.g. the shop's inventory bar.
  if (typeof opts.areaBottom === 'number') areaBottom = Math.min(areaBottom, opts.areaBottom);
  // Optional caller override: widen the usable area when an extension
  // panel (the wing) is being shown so cards actually spread into the
  // extra space instead of crowding the original panel.
  const extraRight = Math.max(0, opts.extraRightWidth || 0);
  const extraLeft  = Math.max(0, opts.extraLeftWidth  || 0);
  areaRight += extraRight;
  areaLeft  -= extraLeft;

  const areaW = Math.max(10, areaRight - areaLeft);
  const areaH = Math.max(10, areaBottom - areaTop);
  const widthUnits  = (maxXp - minXp) + 1;
  const heightUnits = (maxR  - minR ) + 1;
  // a little breathing room
  const padX = 24, padY = 16;
  // Cap on per-cell horizontal step. Default 65 keeps small clusters
  // from spreading out absurdly; callers extending the area can raise
  // it so cards actually use the new room.
  const maxHStep = opts.maxHStep ?? 65;
  const HSTEP = Math.min((areaW - padX) / Math.max(1, widthUnits), maxHStep);
  // Card art is ~70px tall at scale 1; keep a floor so 4-row boards do not overlap.
  const MIN_VSTEP = 70;
  const rawV = (areaH - padY) / Math.max(1, heightUnits);
  const VSTEP = Math.min(rawV, 75);
  // If the panel is too short for comfortable spacing, shrink sprites instead of stacking.
  const cardScale = VSTEP < MIN_VSTEP ? Math.max(0.72, VSTEP / MIN_VSTEP) : 1;
  // Centre on the BASE play area, excluding any wing extension. Adding extra
  // width for crowded floors used to drag the whole board to the right
  // (cx shifted by extraRight/2); centring on the base keeps the board in the
  // same spot regardless of card count, while the extra width still feeds
  // HSTEP so the cards spread out instead of overlapping.
  const baseAreaW = areaW - extraRight - extraLeft;
  // +20 (was +40) nudges the cluster right of centre; trimmed by 20px to
  // make room for the combat-log panel on the right without overlap.
  const cx = areaLeft + extraLeft + baseAreaW / 2 + 20;
  const cy = areaTop  + areaH / 2 - 27;
  const midXp = (minXp + maxXp) / 2;
  const midR  = (minR  + maxR ) / 2;
  // // debug: uncomment to see the panel box
  // const g = this.scene.add.graphics().lineStyle(1, 0x00ff00, 0.6);
  // g.strokeRect(areaLeft, areaTop, areaW, areaH).setDepth(-1);
  return { HSTEP, VSTEP, cx, cy, midXp, midR, cardScale };
}

function brickToPixel(r, c, place) {
  const xp = c + ((r & 1) ? 0.5 : 0);        // primitive x' (offset for odd rows = brick stagger)
  const x  = place.cx + (xp - place.midXp) * place.HSTEP;
  const y  = place.cy + (r  - place.midR)  * place.VSTEP;
  // Snap to integer pixels. Sub-pixel positions caused the whole board
  // to look like it shifted 1px every time a card hovered/tweened — the
  // pixel-rounded render position would alternate as decimals carried.
  return { x: Math.round(x), y: Math.round(y) };
}

function clearFloorBoardPanel() {
  // Tear down the side-extra panel first; it sits behind the main board
  // and shares its lifecycle.
  if (this.sideExtraPanel) {
    this.scene.tweens.killTweensOf(this.sideExtraPanel);
    this.sideExtraPanel.destroy();
    this.sideExtraPanel = null;
  }
  if (!this.floorBoardPanel) return;
  this.scene.tweens.killTweensOf(this.floorBoardPanel);
  this.floorBoardPanel.destroy();
  this.floorBoardPanel = null;
}

function createSideExtraPanel(side = 'right', { animate = true, delayMs = 200 } = {}) {
  if (!this.floorBoardPanel) return;
  if (!this.scene.textures.exists('gamingBoardSideExtra')) return;
  // Replace any existing side panel so re-spawns don't stack.
  if (this.sideExtraPanel) {
    this.scene.tweens.killTweensOf(this.sideExtraPanel);
    this.sideExtraPanel.destroy();
    this.sideExtraPanel = null;
  }

  const main = this.floorBoardPanel;
  const dir = side === 'left' ? -1 : 1;
  // Start tucked behind the main board's centre, then slide outward so
  // roughly half of the extra panel pokes past the main board edge.
  const startX = main.x;
  const tex = this.scene.textures.get('gamingBoardSideExtra').getSourceImage();
  const sideW = tex.width || 200;
  const endX  = main.x + dir * (main.displayWidth * 0.45 - sideW * 0.1);

  const panel = this.scene.add.image(startX, main.y, 'gamingBoardSideExtra');
  panel.setOrigin(0.5);
  panel.setDepth(main.depth - 1); // sit BEHIND the main board
  if (side === 'left') panel.setFlipX(true);
  panel.setAlpha(animate ? 0 : 1);
  this.sideExtraPanel = panel;

  if (!animate) {
    panel.x = endX;
    return;
  }
  this.scene.tweens.add({
    targets: panel, alpha: 1, duration: 180, delay: delayMs
  });
  this.scene.tweens.add({
    targets: panel, x: endX, duration: 420, delay: delayMs, ease: 'Cubic.easeOut'
  });
}

function killCardTweens(card) {
  if (card.sprite) this.scene.tweens.killTweensOf(card.sprite);
  if (card.infoText) this.scene.tweens.killTweensOf(card.infoText);
  if (card.hoverSprite) this.scene.tweens.killTweensOf(card.hoverSprite);
}

function snapYOnUpdate(_tween, target) {
  if (target?.scene) target.y = Math.round(target.y);
}

function clearBoard() {
  this.clearFloorBoardPanel();
  this.boardCards.forEach(card => {
    if (!card) return;
    card.gemIdleTimer?.remove?.(false);
    this.killCardTweens(card);
    card.sprite?.destroy();
    card.shadow?.destroy();
    card.gemShadow?.destroy();
    card.hoverSprite?.destroy();
    card.glow?.destroy();
    card.roleMarker?.destroy();
    card.poisonMarker?.destroy();
    card.shockMarker?.destroy();
    card.frozenFrame?.destroy();
    if (card.infoText) {
      if (card.infoText.list) card.infoText.destroy(true);
      else card.infoText.destroy();
    }
    // Null references so any lingering closures see a falsy sprite.
    card.sprite = null;
    card.shadow = null;
    card.gemShadow = null;
    card.hoverSprite = null;
    card.glow = null;
    card.roleMarker = null;
    card.poisonMarker = null;
    card.shockMarker = null;
    card.frozenFrame = null;
    card.infoText = null;
  });
  this.boardCards = [];
}

function createFloorBoardPanel(cells, place, animate = true, textureKey = 'gamingBoard') {
  this.clearFloorBoardPanel();
  if (!this.scene.textures.exists(textureKey)) return;

  const points = cells.map(({ r, c }) => this.brickToPixel(r, c, place));
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const cam = this.scene.cameras.main;
  const x = ((minX + maxX) / 2) + 10;
  const y = Math.min(cam.height - 122, ((minY + maxY) / 2) + 8) - 18;

  const panel = this.scene.add.image(x, animate ? y + 34 : y, textureKey);
  panel.setDepth(0);
  this.floorBoardPanel = panel;

  if (animate) {
    this.scene.tweens.add({
      targets: panel,
      y: y - 8,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!panel.scene) return;
        this.scene.tweens.add({
          targets: panel,
          y,
          duration: 180,
          ease: 'Bounce.easeOut'
        });
      }
    });
  }
}

function createBossBoardPanel() {
  this.clearFloorBoardPanel();
  if (!this.scene.textures.exists('gamingBoard')) return;

  const cam = this.scene.cameras.main;
  const y = Math.min(cam.height - 122, cam.height / 2 + 8) - 18;
  // -10 (was +10): shifted 20px left to match the combat board and clear
  // the combat-log panel on the right.
  const panel = this.scene.add.image((cam.width / 2) - 10, y + 34, 'gamingBoard');
  panel.setDepth(0);
  this.floorBoardPanel = panel;
  this.scene.tweens.add({
    targets: panel,
    y: y - 8,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!panel.scene) return;
      this.scene.tweens.add({ targets: panel, y, duration: 180, ease: 'Bounce.easeOut' });
    }
  });
}

function _brickSizeForCount(n) {
  // card-center spacing and card sprite scale
  if (n <= 10) return { colGap: 64, rowGap: 60, scale: 0.95 };
  if (n <= 16) return { colGap: 56, rowGap: 54, scale: 0.88 };
  return           { colGap: 50, rowGap: 48, scale: 0.82 }; // 17..26
}

function brickToPixelLegacy(row, col, colGap, rowGap) {
  const cam = this.scene.cameras.main;
  const x = (cam.width * 0.75) + col * colGap + ((row & 1) ? colGap / 2 : 0); // Responsive center
  const y = (cam.height / 2) + row * rowGap;
  return { x, y };
}

function brickNeighbors(row, col) {
  const odd = row & 1;
  return odd ? [
    [row-1, col],   [row-1, col+1],
    [row,   col-1], [row,   col+1],
    [row+1, col],   [row+1, col+1],
  ] : [
    [row-1, col-1], [row-1, col],
    [row,   col-1], [row,   col+1],
    [row+1, col-1], [row+1, col],
  ];
}

function computeRowBands(cards, vStep) {
  // The board array can hold null slots (cards already removed before a
  // save) and rare entries without a sprite — skip both so restore doesn't
  // crash on `c.sprite`.
  const valid = cards.filter(c => c?.sprite);
  const ys = valid.map(c => c.sprite.y).sort((a,b)=>b-a); // deepest first
  const bands = [];
  const tol = vStep * 0.5;
  ys.forEach(y => {
    if (!bands.some(by => Math.abs(by - y) <= tol)) bands.push(y);
  });
  // assign band index 0.. (0 = closest to player / deepest Y)
  valid.forEach(c => {
    if (c.data) c.data.band = bands.findIndex(by => Math.abs(by - c.sprite.y) <= tol);
  });
  return bands.length;
}

function frontBandCount(cardCount) {
  return cardCount >= 14 ? 2 : 1; // two front rows on denser boards
}

function getSerializableBoardLayout() {
  if (!Array.isArray(this._boardCells) || !this._boardPlace) return null;
  return {
    cells: this._boardCells.map(cell => cell ? { r: cell.r, c: cell.c } : null),
    place: { ...this._boardPlace }
  };
}

function _rebuildBrickNeighbors() {
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
}

