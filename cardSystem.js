//cardSystem
import { CardDataGenerator } from './CardDataGenerator.js';
import { SoundHelper } from './utils/SoundHelper.js';
import { getBossFloors, getCurrentAct, MAX_FLOOR } from './utils/ActUtils.js';

export class CardSystem {
    constructor(scene) {
        this.scene = scene;
        this.boardCards = new Array(8).fill(null);
        this.cardDataGenerator = new CardDataGenerator();
    }
    // ===== Front/back combat config =====
    static RANGED_MULTIPLIER = 0.8; // ranged deals 80% to compensate for reach
    static TREASURE_CHEST_CONFIG = {
      WOODEN: {
        name: 'Wooden Chest',
        tint: 0xb8864f,
        goldRange: [18, 26],
        crystalRange: [1, 3],
        amuletGrades: [
          { grade: 'Common', chance: 0.7 },
          { grade: 'Uncommon', chance: 0.3 },
        ],
      },
      SILVER: {
        name: 'Silver Chest',
        tint: 0xc0d8ff,
        goldRange: [36, 78],
        crystalRange: [3, 8],
        amuletGrades: [
          { grade: 'Uncommon', chance: 0.6 },
          { grade: 'Rare', chance: 0.4 },
        ],
      },
      GOLDEN: {
        name: 'Golden Chest',
        tint: 0xffd700,
        goldRange: [72, 130],
        crystalRange: [6, 12],
        amuletGrades: [
          { grade: 'Epic', chance: 0.6 },
          { grade: 'Legendary', chance: 0.4 },
        ],
      },
    };
    static AMULET_GRADE_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    // --- weapon helpers (be liberal: support multiple schemas) ---
    isMeleeWeapon(w) {
      if (!w) return false;
      const n = (w.name || w.id || '').toLowerCase();
      return (
        w.range === 'melee' ||
        w.isRanged === false ||
        w.subType === 'sword' ||
        n.includes('sword') || n.includes('dagger') || n.includes('mace') || n.includes('hammer') ||
        n.includes('axe') || n.includes('spear')
      );
    }
    isRangedWeapon(w) {
      if (!w) return false;
      const n = (w.name || w.id || '').toLowerCase();
      return (
        w.range === 'ranged' ||
        w.isRanged === true ||
        w.subType === 'bow' ||
        n.includes('bow') || n.includes('crossbow')
      );
    }
    // --- enemy queries ---
    _aliveEnemyIndices({ revealedOnly = false } = {}) {
      const out = [];
      for (let i = 0; i < this.boardCards.length; i++) {
        const c = this.boardCards[i];
        if (!c) continue;
        const isEnemy = c.data?.type === 'enemy' || c.data?.type === 'eliteEnemy' || c.data?.type === 'boss';
        if (!isEnemy) continue;
        if (revealedOnly && !c.revealed) continue;
        out.push(i);
      }
      return out;
    }
    _anyMeleeAlive({ includeHidden = true } = {}) {
      for (let i = 0; i < this.boardCards.length; i++) {
        const c = this.boardCards[i];
        if (!c) continue;
        const isEnemy = c.data?.type === 'enemy' || c.data?.type === 'eliteEnemy' || c.data?.type === 'boss';
        if (!isEnemy) continue;
        if (!includeHidden && !c.revealed) continue;
        if (c.data.role === 'MELEE') return true;
      }
      return false;
    }
    currentFrontRowR() {
      let best = -Infinity;
      for (const i of this._aliveEnemyIndices({ revealedOnly: true })) {
        const br = this.boardCards[i]?.data?.brick?.r;
        if (typeof br === 'number' && br > best) best = br;
      }
      return best;
    }
    maxHiddenMeleeRowR() {
      let best = -Infinity;
      for (let i = 0; i < this.boardCards.length; i++) {
        const c = this.boardCards[i];
        if (!c || c.revealed) continue;
        const isEnemy = c.data?.type === 'enemy' || c.data?.type === 'eliteEnemy' || c.data?.type === 'boss';
        if (!isEnemy) continue;
        if (c.data.role !== 'MELEE') continue;
        const br = c.data?.brick?.r;
        if (typeof br === 'number' && br > best) best = br;
      }
      return best;
    }
    canMeleeHit(targetIndex) {
      const target = this.boardCards[targetIndex];
      if (!target) return false;
      const tEnemy = target.data?.type === 'enemy' || target.data?.type === 'eliteEnemy' || target.data?.type === 'boss';
      if (!tEnemy) return false;
      
      if (!this._anyMeleeAlive({ includeHidden: true })) return target.revealed;
      if (target.data.role !== 'MELEE') {
        console.log('[Hex] melee blocked by front line');
        return false;
      }
      return target.revealed;
    }
    _revealOneBehindAfterFrontClears(killedIndex) {
      if (this._anyMeleeAlive({ includeHidden: true })) return;
      const killed = this.boardCards[killedIndex];
      const neighborIdxs = (killed && killed.data?.brickNeighbors?.length) ? killed.data.brickNeighbors.slice() : [];
      const pickFrom = (arr) => {
        const candidates = arr.filter(i => {
          const c = this.boardCards[i];
          if (!c || c.revealed) return false;
          const enemy = c.data?.type === 'enemy' || c.data?.type === 'eliteEnemy' || c.data?.type === 'boss';
          return enemy && c.data.role !== 'MELEE';
        });
        if (candidates.length) {
          const idx = candidates[Math.floor(Math.random() * candidates.length)];
          this.revealCard(idx, true);
          console.log('[Hex] reveal behind ->', idx);
          return true;
        }
        return false;
      };
      if (neighborIdxs.length && pickFrom(neighborIdxs)) return;
      const all = [];
      for (let i = 0; i < this.boardCards.length; i++) all.push(i);
      pickFrom(all);
    }
    // ----- BOARD AREA where we want the cluster to live (right side) -----
    // Static safe margins as fractions of screen (for responsive)
    static BOARD_SAFE_FRAC = { left: 0.6, right: 0.05, top: 0.15, bottom: 0.15 };
    // Extra hard pixel padding so the panel never touches screen edges
    static BOARD_SAFE_PX = { left: 16, right: 16, top: 16, bottom: 16 };
    
    static USE_FIXED_PANEL = true; // turn on fixed panel layout
    // Design-space rect tuned for 640x360 (centered panel now)
    static FIXED_PANEL_640x360 = { left: 200, top: 50, width: 240, height: 260 };
    // Odd-row (r%2===1) offset neighbors for a "brick"/offset grid
    static OFFS_EVEN = [  // r % 2 === 0
      [+1,  0], [ 0, +1], [-1, +1],
      [-1,  0], [-1, -1], [ 0, -1],
    ];
    static OFFS_ODD  = [  // r % 2 === 1
      [+1,  0], [+1, +1], [ 0, +1],
      [-1,  0], [ 0, -1], [+1, -1],
    ];
    // Build a rectangular brick grid for better centering and structure
    buildBrickGrid(n) {
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
    // Build a connected "blob" of brick cells of size n starting at (0,0)
    pickConnectedBrick(n) {
      const key = (r,c) => `${r},${c}`;
      const chosen = new Set([key(0,0)]);
      const frontier = [{ r:0, c:0 }];
      while (chosen.size < n) {
        const from = frontier[Math.floor(Math.random() * frontier.length)];
        const OFFS = (from.r & 1) ? CardSystem.OFFS_ODD : CardSystem.OFFS_EVEN;
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
    // Build a compact, centered, non-branching brick cluster.
    // Rows are balanced (lengths differ by at most 1) and longest in the middle.
    buildCompactBrickCluster(n) {
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
    // Compute placement (steps + centering) for the current camera size
    computePlacement(cells) {
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
      if (CardSystem.USE_FIXED_PANEL) {
        // Scale the 640x360 design rect to the current camera
        const sx = cam.width  / 640;
        const sy = cam.height / 360;
        const R  = CardSystem.FIXED_PANEL_640x360;
        areaLeft   = R.left   * sx;
        areaTop    = R.top    * sy;
        areaRight  = (R.left + R.width)  * sx;
        areaBottom = (R.top  + R.height) * sy;
      } else {
        // fallback to fractional+padded panel (what you already have)
        const fracLeft   = cam.width  * CardSystem.BOARD_SAFE_FRAC.left;
        const fracRight  = cam.width  * (1 - CardSystem.BOARD_SAFE_FRAC.right);
        const fracTop    = cam.height * CardSystem.BOARD_SAFE_FRAC.top;
        const fracBottom = cam.height * (1 - CardSystem.BOARD_SAFE_FRAC.bottom);
        areaLeft   = Math.max(fracLeft,   CardSystem.BOARD_SAFE_PX.left);
        areaRight  = Math.min(fracRight,  cam.width  - CardSystem.BOARD_SAFE_PX.right);
        areaTop    = Math.max(fracTop,    CardSystem.BOARD_SAFE_PX.top);
        areaBottom = Math.min(fracBottom, cam.height - CardSystem.BOARD_SAFE_PX.bottom);
        const maxPanelW = Math.min(cam.width * 0.42, 340);
        const maxPanelH = Math.min(cam.height * 0.78, 300);
        if ((areaRight - areaLeft) > maxPanelW)  areaLeft  = areaRight  - maxPanelW;
        if ((areaBottom - areaTop) > maxPanelH)  areaTop   = areaBottom - maxPanelH;
      }
      const areaW = Math.max(10, areaRight - areaLeft);
      const areaH = Math.max(10, areaBottom - areaTop);
      const widthUnits  = (maxXp - minXp) + 1;
      const heightUnits = (maxR  - minR ) + 1;
      // a little breathing room
      const padX = 24, padY = 24;
      const HSTEP = Math.min((areaW - padX) / Math.max(1, widthUnits), 65);
      const VSTEP = Math.min((areaH - padY) / Math.max(1, heightUnits), 75);
      const cx = areaLeft + areaW / 2;
      const cy = areaTop  + areaH / 2;
      const midXp = (minXp + maxXp) / 2;
      const midR  = (minR  + maxR ) / 2;
      // // debug: uncomment to see the panel box
      // const g = this.scene.add.graphics().lineStyle(1, 0x00ff00, 0.6);
      // g.strokeRect(areaLeft, areaTop, areaW, areaH).setDepth(-1);
      return { HSTEP, VSTEP, cx, cy, midXp, midR };
    }
    // Brick (r,c) -> pixel using placement
    brickToPixel(r, c, place) {
      const xp = c + ((r & 1) ? 0.5 : 0);        // primitive x' (offset for odd rows = brick stagger)
      const x  = place.cx + (xp - place.midXp) * place.HSTEP;
      const y  = place.cy + (r  - place.midR)  * place.VSTEP;
      return { x, y };
    }
    // ===== BRICK / OFFSET-ROWS LAYOUT (odd-r) =====
    static BOARD_CENTER_BRICK = { x: 0, y: 0 }; // Dynamic now, not used
    _brickSizeForCount(n) {
      // card-center spacing and card sprite scale
      if (n <= 10) return { colGap: 64, rowGap: 60, scale: 0.95 };
      if (n <= 16) return { colGap: 56, rowGap: 54, scale: 0.88 };
      return           { colGap: 50, rowGap: 48, scale: 0.82 }; // 17..26
    }
    // Legacy pixel conversion (kept for backward compatibility)
    brickToPixelLegacy(row, col, colGap, rowGap) {
      const cam = this.scene.cameras.main;
      const x = (cam.width * 0.75) + col * colGap + ((row & 1) ? colGap / 2 : 0); // Responsive center
      const y = (cam.height / 2) + row * rowGap;
      return { x, y };
    }
    // brick neighbors (odd-r) — 6-way like hex but arranged visually as bricks
    brickNeighbors(row, col) {
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
    // band rows by Y so we know what's "front" (closer to player)
    computeRowBands(cards, vStep) {
      const ys = cards.map(c => c.sprite.y).sort((a,b)=>b-a); // deepest first
      const bands = [];
      const tol = vStep * 0.5;
      ys.forEach(y => {
        if (!bands.some(by => Math.abs(by - y) <= tol)) bands.push(y);
      });
      // assign band index 0.. (0 = closest to player / deepest Y)
      cards.forEach(c => {
        c.data.band = bands.findIndex(by => Math.abs(by - c.sprite.y) <= tol);
      });
      return bands.length;
    }
    frontBandCount(cardCount) {
      return cardCount >= 14 ? 2 : 1; // two front rows on denser boards
    }
    // ===== FLOOR-SCALED CARD COUNT =====
    static MIN_CARDS = 6;
    static MAX_CARDS = 26;
    static ELITE_MULT = 1.25;
    // 1..45 → 6..26 (linear). Clamp to be safe.
    _baseCardsForFloor(cf) {
        const clamped = Math.max(1, Math.min(MAX_FLOOR, cf));
        const t = (clamped - 1) / (MAX_FLOOR - 1); // 0..1
        return Math.round(CardSystem.MIN_CARDS + t * (CardSystem.MAX_CARDS - CardSystem.MIN_CARDS));
    }
    _effectiveCardCount(roomType, cf) {
        const base = this._baseCardsForFloor(cf);
        const scaled = (roomType === 'ELITE') ? Math.ceil(base * CardSystem.ELITE_MULT) : base;
        return Math.min(scaled, CardSystem.MAX_CARDS); // never exceed 26
    }
    spawnFloorCards() {
      // === clear previous ===
      this.boardCards.forEach(card => {
        if (!card) return;
        card.sprite?.destroy();
        card.shadow?.destroy();
        if (card.infoText) {
          if (card.infoText.list) card.infoText.destroy(true);
          else card.infoText.destroy();
        }
      });
      this.boardCards = [];
      const cf = this.scene.gameState?.currentFloor || 1;
      const roomType = this.scene.gameState?.roomType || this.scene.roomType || 'COMBAT';

      if (roomType === 'TREASURE') {
        this.spawnTreasureChests();
        return;
      }

      // === boss shortcut (keep your logic) ===
      const currentFloor = this.scene.gameState.currentFloor;
      const bossFloors = getBossFloors();
      if (bossFloors.includes(currentFloor)) { this.spawnBoss(); return; }
      // Determine scaled count (your code that decides roomType etc. can stay)
      const cardCount = this._effectiveCardCount ? this._effectiveCardCount(roomType, cf) : Math.min(6 + Math.floor((cf - 1) * (20 / 29)), 26);
      // 1) build a connected brick "blob" for a nicer cluster
      const cells = this.buildCompactBrickCluster(cardCount);
      // 2) compute steps & centering for current camera
      const place = this.computePlacement(cells);
      // 3) create the cards at proper pixels
      this.boardCards = new Array(cardCount).fill(null);
      for (let i = 0; i < cardCount; i++) {
        const { r, c } = cells[i];
        const { x, y } = this.brickToPixel(r, c, place);
        const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
        shadow.setAlpha(0);
        const cardSprite = this.scene.add.sprite(x, y, 'cardBack');
        cardSprite.setScale(1);          // tweak if you want tighter/looser
        cardSprite.setInteractive();
        cardSprite.on('pointerdown', () => this.revealCard(i));
        cardSprite.on('pointerover', () => {
          const card = this.boardCards[i];
          if (card && !card.revealed) {
            shadow.setAlpha(1);
            this.scene.tweens.add({ targets: cardSprite, y: y - 5, duration: 150 });
            cardSprite.play('card_hover_anim');
          }
        });
        cardSprite.on('pointerout', () => {
          const card = this.boardCards[i];
          if (card && !card.revealed) {
            shadow.setAlpha(0);
            this.scene.tweens.add({ targets: cardSprite, y: y, duration: 150 });
          }
        });
        const type = this.pickCardType(cf);
        const data = this.createCardData(type, cf, roomType === 'ELITE');
        // Assign roles to enemies based on row position
        if (data && (data.type === 'enemy' || data.type === 'boss')) {
            // Higher r values = closer to player = front row = MELEE
            // Lower/negative r values = back row = RANGED
            const isFrontRow = r > 0;
            data.role = isFrontRow ? 'MELEE' : 'RANGED';
            
            console.log(`Enemy at r=${r} assigned role: ${data.role}`);
        }
        
        // store brick coords for mechanics
        if (data) {
          data.brick = { r, c };
        }
        this.boardCards[i] = { sprite: cardSprite, shadow, revealed: false, data };
      }
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
        const OFFS = (r & 1) ? CardSystem.OFFS_ODD : CardSystem.OFFS_EVEN;
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
      // === reveal 2–3 enemies with a front/back mix and try to keep them close ===
      const wantReveals = (cf >= 4) ? 3 : 2;
      const enemyIdx = [];
      const frontIdx = [];
      const backIdx  = [];
      this.boardCards.forEach((c, i) => {
        if (!c) return;
        if (c.data?.type === 'enemy' || c.data?.type === 'eliteEnemy' || c.data?.type === 'boss') {
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
      console.log('[Hex] initial reveal ->', picks);
      // finally reveal them
      picks.forEach(i => this.revealCard(i));
    }

    spawnBoss() {
        const bossData = this.cardDataGenerator.createCardData('boss', this.scene.gameState.currentFloor);
        const cam = this.scene.cameras.main;
        const x = cam.width / 2;
        const y = cam.height / 2;
        const cardSprite = this.scene.add.image(x, y, bossData.sprite);
        cardSprite.setScale(1.2);
        
        const card = {
            sprite: cardSprite,
            revealed: true,
            data: bossData
        };
        this.boardCards[4] = card;
        this.createCardInfoText(card);
        card.sprite.setInteractive();
    }

    pickCardType(currentFloor) {
        const weights = this.cardDataGenerator.getCardWeights(currentFloor);
        
        // Calculate total weight
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        // Select card type based on weights
        for (let [cardType, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                return cardType;
            }
        }
        
        // Fallback (should never reach here)
        return 'coin';
    }
    generateRandomCard() {
        const currentFloor = this.scene.gameState.currentFloor;
        const type = this.pickCardType(currentFloor);
        return this.cardDataGenerator.createCardData(type, currentFloor);
    }

    revealCard(index, freeAction = false) {
        if (!freeAction && !this.scene.useAction()) return;
        
        const card = this.boardCards[index];
        if (!card || card.revealed) return;
        
        SoundHelper.playSound(this.scene, 'card_flip', 0.7);
        card.revealed = true;
        if (card.glow) card.glow.destroy();
        
        if (card.shadow) card.shadow.setAlpha(1);
        
        card.sprite.off('pointerover');
        card.sprite.off('pointerout');
        card.sprite.play('card_flip_anim');
        
        card.sprite.once('animationcomplete', () => {
            if (card.data.sprite) {
                // Set sprite based on type
                let spriteKey = card.data.sprite || 'default_enemy';
                if (card.data.name === 'Mimic') spriteKey = 'mimic';
                card.sprite.setTexture(spriteKey);
            } else {
                card.sprite.destroy();
                const colors = {
                    coin: 0xffd700,
                    crystal: 0x00ffff,
                    trap: 0xff4500,
                    armor: 0x888888,
                    potion: 0xff69b4
                };
                card.sprite = this.scene.add.rectangle(
                    card.sprite.x, card.sprite.y, 70, 90, 
                    colors[card.data.type] || 0x666666
                );
            }
            card.sprite.setScale(1);
            
            this.createCardInfoText(card);
            card.sprite.setInteractive();
            card.sprite.on('pointerdown', () => this.interactWithCard(index));
            
            if (card.data.type === 'enemy' || card.data.type === 'boss') {
                this.scene.skipNextEnemyAttack = true;
            }
            
            if (card.data.type === 'trap') {
                this.handleTrap(card, index);
            }
        });
    }

    handleTrap(card, index) {
        if (card.data.subType === 'spike') {
            SoundHelper.playSound(this.scene, 'trap_woosh', 0.7);
            const { actualDamage, tookDamage } = this.scene.gameState.takeDamage(card.data.damage);
            if (tookDamage) {
                SoundHelper.playSound(this.scene, 'player_hurt', 0.5);
            }
            if (actualDamage > 0) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${actualDamage}`, 0xff0000);
            }
        } else if (card.data.subType === 'poison') {
            this.scene.gameState.addPlayerEffect({ ...card.data.abilities[0] });
            this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Poisoned!', 0x00ff00);
        } else if (card.data.subType === 'reveal') {
            SoundHelper.playSound(this.scene, 'trap_spring', 0.6);
            this.revealAdjacentCards(index);
        }
        this.scene.updateUI();
        this.scene.time.delayedCall(1000, () => this.removeCard(index));
    }

    revealAdjacentCards(index) {
        const currentCard = this.boardCards[index];
        if (!currentCard || !currentCard.data.brick) return;
        
        const currentBrick = currentCard.data.brick;
        const adjacent = [];
        
        // Find brick neighbors using brick coordinates
        const neigh = this.brickNeighbors(currentBrick.r, currentBrick.c);
        for (const [nr, nc] of neigh) {
            // Find card at this brick position
            for (let i = 0; i < this.boardCards.length; i++) {
                const card = this.boardCards[i];
                if (card && card.data.brick && 
                    card.data.brick.r === nr && 
                    card.data.brick.c === nc) {
                    adjacent.push(i);
                    break;
                }
            }
        }
        
        adjacent.forEach(adjIndex => {
            const card = this.boardCards[adjIndex];
            if (card && !card.revealed && card.data.type === 'enemy') {
                this.revealCard(adjIndex, true);
            }
        });
    }

    createCardInfoText(card) {
        const x = card.sprite.x;
        const y = card.sprite.y + 50;
        let infoText = '';
        
        switch (card.data.type) {
            case 'enemy':
            case 'boss':
                // Add role indicator to the info text
                const roleText = card.data.role === 'MELEE' ? '[Melee]' : '[Ranged]';
                infoText = `${roleText} ${card.data.health}HP ${card.data.attack}ATK`;
                
                if (card.data.abilities && card.data.abilities.some(a => a.type === 'poison')) {
                    infoText += ' (Poison)';
                }
                if (card.data.abilities && card.data.abilities.some(a => a.type === 'evade')) {
                    infoText += ' (Evasive)';
                }
                if (card.data.name === 'Mimic') infoText += ' (Surprise Attack)';
                break;
                
            case 'coin':
                const coinLabel = this.scene.add.text(x, card.sprite.y + 7, 'Coins', {
                    fontSize: '11px', fill: '#f8ab2e', fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                const coinAmount = this.scene.add.text(x, card.sprite.y + 20, `${card.data.amount}`, {
                    fontSize: '12px', fill: '#ffcf7f', fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [coinLabel, coinAmount]);
                return;
                
            case 'crystal':
                const crystalLabel = this.scene.add.text(x, card.sprite.y + 7, 'Crystals', {
                    fontSize: '11px', fill: '#4e1e45', fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                const crystalAmount = this.scene.add.text(x, card.sprite.y + 20, `${card.data.amount}`, {
                    fontSize: '12px', fill: '#a83c69', fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [crystalLabel, crystalAmount]);
                return;
                
            case 'trap':
                if (card.data.subType === 'spike') {
                    infoText = `Spike Trap! -${card.data.damage} HP`;
                } else if (card.data.subType === 'poison') {
                    const poison = card.data.abilities[0];
                    infoText = `Poison Trap! ${poison.damage} DMG for ${poison.turns} turns`;
                } else if (card.data.subType === 'reveal') {
                    infoText = `Reveals adjacent cards!`;
                }
                break;
                
            case 'food':
                const foodLabel = this.scene.add.text(x, card.sprite.y + 19, `+${card.data.actionAmount} AP`, {
                    fontSize: '12px', fill: '#a55119', fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [foodLabel]);
                return;
                
            case 'key':
                const keyLabel = this.scene.add.text(x, card.sprite.y + 18, 'Key', {
                    fontSize: '12px', fill: '#51484b', fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [keyLabel]);
                return;
                
            case 'magic':
                const magicLabel = this.scene.add.text(x, card.sprite.y - 25, card.data.name, {
                    fontSize: '11px', 
                    fill: '#9932cc', 
                    fontFamily: '"Roboto Condensed"',
                    wordWrap: { width: 60 },
                    align: 'center'
                }).setOrigin(0.5);
                
                // Show abbreviated description
                let shortDesc = '';
                switch(card.data.magicType) {
                    case 'fireball': shortDesc = '15 DMG'; break;
                    case 'frostRing': shortDesc = 'Freeze 3T'; break;
                    case 'restoration': shortDesc = '+20HP +10AP'; break;
                    case 'soulDrain': shortDesc = 'Kill +30HP'; break;
                    case 'shadowBlade': shortDesc = '+50% ATK'; break;
                    case 'weakness': shortDesc = '-30% Enemy'; break;
                    case 'boneWall': shortDesc = 'Reflect x2'; break;
                    case 'magicShield': shortDesc = '+20% Armor'; break;
                    case 'mirrorShield': shortDesc = 'Reflect x1'; break;
                    case 'smokeScreen': shortDesc = 'Hide All'; break;
                }
                
                const magicDesc = this.scene.add.text(x, card.sprite.y + 20, shortDesc, {
                    fontSize: '10px', 
                    fill: '#cc99ff', 
                    fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                
                card.infoText = this.scene.add.container(0, 0, [magicLabel, magicDesc]);
                return;
                
            case 'weapon': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                
                // Add weapon type indicator
                const weaponTypeText = this.isMeleeWeapon(card.data) ? 'Melee' : 
                                       this.isRangedWeapon(card.data) ? 'Ranged' : 'Unknown';
                const typeLabel = this.scene.add.text(0, -40, weaponTypeText, {
                    fontSize: '9px',
                    fill: '#aaaaaa',
                    fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                container.add(typeLabel);
                
                const damageText = this.scene.add.text(17, 22, `${card.data.damage}`, {
                    fontSize: '11px',
                    fill: '#ffcf7f',
                    fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                container.add(damageText);
                
                // Durability display with 10-point sprites and individual dots
                const startY = -27;
                const dotSpacing = 7;
                const tenDurabilitySpacing = 12; // Space between 10-point sprites
                
                const tensCount = Math.floor(card.data.durability / 10);
                const remainingDots = card.data.durability % 10;
                
                let currentY = startY;
                
                // Add 10-durability sprites
                for (let i = 0; i < tensCount; i++) {
                    const tenSprite = this.scene.add.image(-19, currentY, 'ten_durability');
                    container.add(tenSprite);
                    currentY += tenDurabilitySpacing;
                }
                
                // Add remaining individual dots
                for (let i = 0; i < remainingDots; i++) {
                    const dot = this.scene.add.image(-19, currentY + (i * dotSpacing), 'durability_dot');
                    container.add(dot);
                }
                
                container.setDepth(1001);
                card.infoText = container;
                return;
            }
            
            case 'armor': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const protectionText = this.scene.add.text(18, 25, `${card.data.protection}`, {
                    fontSize: '12px',
                    fill: '#ffcf7f',
                    fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
                container.add(protectionText);
                
                // Durability display with 10-point sprites and individual dots
                const startY = -25;
                const dotSpacing = 7;
                const tenDurabilitySpacing = 12; // Space between 10-point sprites
                
                const tensCount = Math.floor(card.data.durability / 10);
                const remainingDots = card.data.durability % 10;
                
                let currentY = startY;
                
                // Add 10-durability sprites
                for (let i = 0; i < tensCount; i++) {
                    const tenSprite = this.scene.add.image(-22, currentY, 'ten_durability');
                    container.add(tenSprite);
                    currentY += tenDurabilitySpacing;
                }
                
                // Add remaining individual dots
                for (let i = 0; i < remainingDots; i++) {
                    const dot = this.scene.add.image(-22, currentY + (i * dotSpacing), 'durability_dot');
                    container.add(dot);
                }
                
                container.setDepth(1001);
                card.infoText = container;
                return;
            }
                
            case 'amulet':
                // Use the new amulet system for tooltips
                if (this.scene.amuletManager && card.data.id) {
                    const definition = this.scene.amuletManager.amuletDefinitions[card.data.id];
                    if (definition) {
                        infoText = definition.description;
                        if (definition.cursed) {
                            infoText = `[CURSED] ${infoText}`;
                        }
                    }
                } else {
                    // Fallback for legacy amulets
                    if (card.data.effect === 'health') {
                        infoText = `+${card.data.value} Max HP`;
                    } else if (card.data.abilities && card.data.abilities.some(a => a.type === 'regeneration')) {
                        const regen = card.data.abilities.find(a => a.type === 'regeneration');
                        infoText = `Regen +${regen.amount}/turn`;
                    } else if (card.data.effect === 'max_actions') {
                        infoText = `+${card.data.value} Max Actions`;
                    } else if (card.data.abilities && card.data.abilities.some(a => a.type === 'action_on_kill')) {
                        const actionOnKill = card.data.abilities.find(a => a.type === 'action_on_kill');
                        infoText = `+${actionOnKill.amount} action on kill`;
                    }
                }
                break;

            case 'treasureChest': {
                const cfg = CardSystem.TREASURE_CHEST_CONFIG[card.data.chestType] || CardSystem.TREASURE_CHEST_CONFIG.WOODEN;
                infoText = `${cfg.name}\nKey: full rewards\nWeapon: risky`;
                break;
            }
        }
        
        // Create default text for cases that didn't return early
        if (infoText) {
            const textColor = card.data.type === 'amulet' && 
                this.scene.amuletManager && 
                card.data.id && 
                this.scene.amuletManager.amuletDefinitions[card.data.id]?.cursed 
                ? '#ff6666' : '#ffffff';
                
            card.infoText = this.scene.add.text(x, y, infoText, {
                fontSize: '10px',
                fill: textColor,
                fontFamily: '"Roboto Condensed"',
                align: 'center',
                lineSpacing: 2
            }).setOrigin(0.5);
        }
        
        // Add hover tooltip for enemies
        if (card.data.type === 'enemy' || card.data.type === 'boss') {
            card.sprite.on('pointerover', () => {
                if (card.revealed) {
                    const roleDesc = card.data.role === 'MELEE' ? 
                        'Melee: Blocks ranged attacks to back row' : 
                        'Ranged: Can be targeted only after melee cleared';
                    this.scene.createFloatingText(card.sprite.x, card.sprite.y - 60, roleDesc, 0xffffaa);
                }
            });
        }
    }

    removeCard(index) {
        const card = this.boardCards[index];
        if (card) {
            if (card.sprite) card.sprite.destroy();
            if (card.shadow) card.shadow.destroy();
            if (card.highlight) card.highlight.destroy();
            if (card.infoText) {
                if (card.infoText.list) {
                    card.infoText.destroy(true);
                } else {
                    card.infoText.destroy();
                }
            }
            this.boardCards[index] = null;
        }
    }

    interactWithCard(index) {
        const card = this.boardCards[index];
        if (!card || !card.revealed) return;
        
        switch (card.data.type) {
            case 'coin':
                SoundHelper.playSound(this.scene, 'coin_collect', 0.4);
                
                // Apply gold modifier from amulets
                const coinAmount = this.scene.amuletManager ? 
                    this.scene.amuletManager.modifyGoldFound(card.data.amount) : card.data.amount;
                
                this.scene.gameState.coins += coinAmount;
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${coinAmount}`, 0xffd700);
                this.removeCard(index);
                break;
                
            case 'crystal':
                SoundHelper.playSound(this.scene, 'crystal_collect', 0.5);
                this.scene.gameState.crystals += card.data.amount;
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${card.data.amount}`, 0x00ffff);
                this.removeCard(index);
                break;
                
            case 'potion':
            case 'weapon':
            case 'armor':
            case 'key':
            case 'magic':
                if (this.scene.inventorySystem.addCard(card.data)) {
                    this.removeCard(index);
                }
                break;
                
            case 'food':
                // Apply amulet food AP modifiers
                const baseAP = card.data.actionAmount;
                const modifiedAP = this.scene.amuletManager ? 
                    this.scene.amuletManager.modifyFoodAP(baseAP) : baseAP;
                
                this.scene.gameState.actionsLeft = Math.min(
                    this.scene.gameState.maxActions, 
                    this.scene.gameState.actionsLeft + modifiedAP
                );
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${modifiedAP} AP`, 0x00ff00);
                this.removeCard(index);
                break;
                
            case 'amulet':
                this.consumeAmulet(card.data, index);
                break;
        }
        
        this.scene.updateUI();
    }

    consumeAmulet(amulet, index) {
        // Use the new AmuletManager system
        if (this.scene.amuletManager && amulet.id) {
            const success = this.scene.amuletManager.addAmulet(amulet.id);
            if (success) {
                this.removeCard(index);
            }
        } else {
            // Fallback to old system for legacy amulets without IDs
            if (amulet.effect === 'health') {
                this.scene.gameState.maxHealth += amulet.value;
                this.scene.gameState.playerHealth += amulet.value;
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x, 
                    this.scene.playerAvatar.y, 
                    `+${amulet.value} Max HP`, 
                    0x00ff00
                );
            } else if (amulet.effect === 'max_actions') {
                this.scene.gameState.maxActions += amulet.value;
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x, 
                    this.scene.playerAvatar.y, 
                    `+${amulet.value} Max Actions`, 
                    0x00ff00
                );
            }
            
            this.scene.gameState.activeAmulets.push(amulet);
            this.removeCard(index);
        }
    }
    summonEnemy(enemyType, bossCard) {
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
        
        // Use the cardDataGenerator to create the right enemy type
        summonedEnemy = this.cardDataGenerator.createCardData('enemy', floor);
        
        // Override the enemy to match what the boss should summon
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
        
        const cardSprite = this.scene.add.sprite(x, y, summonedEnemy.sprite);
        cardSprite.setScale(0);
        cardSprite.setInteractive();
        
        // Animate the summon
        this.scene.tweens.add({
            targets: cardSprite,
            scale: 1,
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
    attackEnemy(index, damage, isReflection = false, weaponUsed = null) {
        const card = this.boardCards[index];
        if (!card || !card.revealed || (card.data.type !== 'enemy' && card.data.type !== 'boss')) return;
        
        // === front/back gating ===
        // Check what weapon is being used
        const weapon = weaponUsed || this.scene.inventorySystem?.getCurrentWeapon?.() || null;
        
        if (!isReflection && weapon) {
            const isMelee = this.isMeleeWeapon(weapon);
            const isRanged = this.isRangedWeapon(weapon);
            
            // Check if there are any melee enemies alive (revealed or hidden)
            const meleeBlockers = this._anyMeleeAlive({ includeHidden: true });
            
            if (isMelee && meleeBlockers) {
                // Melee weapons can only hit MELEE role enemies when blockers exist
                if (card.data.role !== 'MELEE') {
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x, 
                        this.scene.playerAvatar.y, 
                        'Blocked by frontline!', 
                        0xff6666
                    );
                    console.log('[Hex] melee blocked by front line');
                    return;
                }
            }
            
            // Ranged weapons get a damage penalty
            if (isRanged) {
                damage = Math.floor(damage * CardSystem.RANGED_MULTIPLIER);
                console.log('[Hex] ranged penalty applied');
            }
        }
        
        // Apply amulet damage modifiers to weapon damage (not reflection)
        let finalDamage = damage;
        if (!isReflection && this.scene.amuletManager) {
            finalDamage = this.scene.amuletManager.modifyWeaponDamage(damage);
        }
        
        // Evasion doesn't work against reflection damage
        if (!isReflection) {
            const evadeAbility = card.data.abilities?.find(a => a.type === 'evade');
            if (evadeAbility && Math.random() < evadeAbility.chance) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Miss!', 0xffffff);
                return;
            }
        }
        
        if (!isReflection) {
            this.scene.createSlashEffect(card.sprite.x, card.sprite.y);
        }
        
        this.scene.shakeCard(card.sprite);
        
        // Handle Hungry Dagger special damage
        if (!isReflection && this.scene.amuletManager) {
            const originalHealth = card.data.health;
            
            // Check for hungry dagger effect
            const hasHungryDagger = this.scene.amuletManager.hasAmulet('hungryDagger');
            if (hasHungryDagger) {
                const newHealth = originalHealth - finalDamage;
                if (newHealth === 1) {
                    // Instant kill
                    card.data.health = 0;
                    this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'EXECUTED!', 0xff0000);
                } else if (newHealth > 1) {
                    // Heal enemy by 1
                    card.data.health = newHealth + 1;
                    this.scene.createFloatingText(card.sprite.x, card.sprite.y, '+1 HP', 0x00ff00);
                    
                    // Update info text
                    this.updateEnemyInfoText(card);
                    return; // Don't process normal damage
                } else {
                    // Normal kill
                    card.data.health = newHealth;
                }
            } else {
                // Normal damage with amulet modifiers
                card.data.health -= finalDamage;
            }
        } else {
            // Normal damage for reflection or no amulet manager
            card.data.health -= finalDamage;
        }
        
        // Reduce weapon durability on attack (only if not reflection damage)
        if (!isReflection && this.scene.gameState.equippedWeapon) {
            this.scene.gameState.equippedWeapon.durability -= 1;
            console.log('Weapon dur now:', this.scene.gameState.equippedWeapon.durability);
            if (this.scene.gameState.equippedWeapon.durability <= 0) {
                this.scene.gameState.equippedWeapon = null;
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weapon Broke!', 0xff0000);
            }
            this.scene.updateUI();
        }
        
        if (card.infoText) {
            const roleText = card.data.role === 'MELEE' ? '[Melee]' : '[Ranged]';
            let infoText = `${roleText} ${card.data.health}HP ${card.data.attack}ATK`;
            if (card.data.abilities && card.data.abilities.some(a => a.type === 'poison')) {
                infoText += ' (Poison)';
            }
            if (card.data.abilities && card.data.abilities.some(a => a.type === 'evade')) {
                infoText += ' (Evasive)';
            }
            if (card.data.name === 'Mimic') infoText += ' (Surprise Attack)';
            card.infoText.setText(infoText);
        }
        
        this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${finalDamage}`, 0xff0000);
        
        // Update counter for mimic
        if (card.data.name === 'Mimic') {
            if (!card.data.hitCounter) card.data.hitCounter = 0;
            card.data.hitCounter += 1;
            console.log('Mimic hit count:', card.data.hitCounter);
            
            if (card.data.hitCounter >= 4 && card.data.health > 0) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Mimic Escapes!', 0xff0000);
                this.removeCard(index);
                return;
            }
        }
        
        if (card.data.health <= 0) {
            // Process amulet kill effects
            if (this.scene.amuletManager) {
                this.scene.amuletManager.processEnemyKill();
            }
            
            // Mimic explosion
            if (card.data.name === 'Mimic') {
                this.mimicTreasureExplosion(card.sprite.x, card.sprite.y);
            }
            
            // Enemy defeated - reward coins
            const baseReward = 3 + this.scene.gameState.currentFloor;
            
            // Apply gold modifier from amulets
            const reward = this.scene.amuletManager ? 
                this.scene.amuletManager.modifyGoldFound(baseReward) : baseReward;
            
            SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);
            this.scene.gameState.coins += reward;
            this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${reward} coins`, 0xffd700);
            
            // Check for on-kill effects from old amulet system (legacy support)
            this.scene.gameState.activeAmulets.forEach(amulet => {
                amulet.abilities?.forEach(ability => {
                    if (ability.type === 'action_on_kill') {
                        this.scene.gameState.actionsLeft = Math.min(
                            this.scene.gameState.maxActions, 
                            this.scene.gameState.actionsLeft + ability.amount
                        );
                        this.scene.createFloatingText(
                            this.scene.playerAvatar.x, 
                            this.scene.playerAvatar.y, 
                            `+${ability.amount} Action`, 
                            0x00ff00
                        );
                        this.scene.updateUI();
                    }
                });
            });
            
            const savedNeighbors = card.data?.brickNeighbors ? card.data.brickNeighbors.slice() : null;
            this.removeCard(index);
            // temporarily keep a stub with neighbors
            if (savedNeighbors) {
              this.boardCards[index] = { data: { brickNeighbors: savedNeighbors }, revealed: true, sprite: null, shadow: null };
            }
            // try to reveal one behind if melee line is now gone
            this._revealOneBehindAfterFrontClears(index);
            // clean up the stub
            if (this.boardCards[index] && !this.boardCards[index].sprite) {
              this.boardCards[index] = null;
            }
            this.checkFloorClear();
        }
    }

    spawnTreasureChests() {
      const cells = [{ r: 1, c: 0 }];
      const place = this.computePlacement(cells);

      this.boardCards = new Array(1).fill(null);

      const { r, c } = cells[0];
      const { x, y } = this.brickToPixel(r, c, place);
      const chestType = this.pickTreasureChestType();
      const cfg = CardSystem.TREASURE_CHEST_CONFIG[chestType] || CardSystem.TREASURE_CHEST_CONFIG.WOODEN;

      const shadow = this.scene.add.rectangle(x, y + 30, 70, 18, 0x000000, 0.45);
      shadow.setDepth(0);

      const highlight = this.scene.add.rectangle(x, y, 88, 96, cfg.tint, 0.18);
      highlight.setStrokeStyle(2, cfg.tint, 0.85);
      highlight.setVisible(false);
      highlight.setDepth(1);

      const sprite = this.scene.add.sprite(x, y, 'chest');
      sprite.setScale(1.25);
      sprite.setTint(cfg.tint);
      sprite.setDepth(2);
      sprite.setInteractive({ useHandCursor: true, dropZone: true });
      sprite.on('pointerover', () => this.handleChestPointerState(0, true));
      sprite.on('pointerout', () => this.handleChestPointerState(0, false));
      sprite.on('pointerdown', () => {
        if (!this.scene.inventorySystem?.dragState) {
          this.scene.createFloatingText(x, y - 60, 'Use a key or weapon', 0xfff5a5);
        }
      });

      const data = {
        type: 'treasureChest',
        chestType,
        state: 'locked',
        brick: { r, c },
        baseTint: cfg.tint,
        brickNeighbors: [],
      };

      this.boardCards[0] = {
        sprite,
        shadow,
        highlight,
        revealed: true,
        data,
        infoText: null,
      };

      this.createCardInfoText(this.boardCards[0]);
    }

    pickTreasureChestType(floor = this.scene.gameState?.currentFloor || 1) {
      const act = getCurrentAct(floor);
      if (act === 1) return 'WOODEN';
      if (act === 2) return 'SILVER';
      return 'GOLDEN';
    }

    handleChestPointerState(index, isOver) {
      const card = this.boardCards[index];
      if (!card || card.data?.type !== 'treasureChest') return;

      if (!isOver) {
        this.resetChestHighlight(card);
        return;
      }

      if (card.data.state !== 'locked') return;
      const dragState = this.scene.inventorySystem?.dragState;
      if (!dragState || !dragState.cardData) return;

      let tint = null;
      if (dragState.cardData.type === 'key') {
        tint = 0x66ff99;
      } else if (dragState.cardData.type === 'weapon') {
        tint = 0xffaa33;
      }

      if (!tint) return;

      card.highlight?.setFillStyle(tint, 0.2);
      card.highlight?.setStrokeStyle(2, tint, 0.9);
      card.highlight?.setVisible(true);
      card.sprite?.setTint(tint);
    }

    resetChestHighlight(card) {
      if (!card) return;
      if (card.highlight) {
        card.highlight.setVisible(false);
      }
      if (card.sprite) {
        if (card.data?.baseTint) {
          card.sprite.setTint(card.data.baseTint);
        } else {
          card.sprite.clearTint();
        }
      }
    }

    clearTreasureHighlights() {
      this.boardCards.forEach(card => {
        if (card && card.data?.type === 'treasureChest') {
          this.resetChestHighlight(card);
        }
      });
    }

    findChestAt(x, y) {
      for (let i = 0; i < this.boardCards.length; i++) {
        const card = this.boardCards[i];
        if (!card || card.data?.type !== 'treasureChest') continue;
        if (card.data.state !== 'locked') continue;
        if (!card.sprite) continue;
        const bounds = card.sprite.getBounds();
        if (Phaser.Geom.Rectangle.Contains(bounds, x, y)) {
          return i;
        }
      }
      return -1;
    }

    openChestWithKey(index) {
      const card = this.boardCards[index];
      if (!card || card.data?.type !== 'treasureChest') return false;
      if (card.data.state !== 'locked') return false;

      this.resetChestHighlight(card);
      this.resolveChestOpen(index, { multiplier: 1, downgrade: false, method: 'key' });
      return true;
    }

    openChestWithWeapon(index) {
      const card = this.boardCards[index];
      if (!card || card.data?.type !== 'treasureChest') return { success: false, trapTriggered: false };
      if (card.data.state !== 'locked') return { success: false, trapTriggered: false };

      this.resetChestHighlight(card);

      const trapTriggered = Math.random() < 0.5;
      if (trapTriggered) {
        this.triggerChestTrap(card);
      }

      const multiplier = trapTriggered ? 0.5 : 0.75;
      this.resolveChestOpen(index, {
        multiplier,
        downgrade: trapTriggered,
        method: 'weapon',
        trapTriggered,
      });

      return { success: true, trapTriggered };
    }

    triggerChestTrap(card) {
      if (!card || !card.sprite) return;
      const trapSprite = this.scene.add.sprite(card.sprite.x, card.sprite.y, 'trap');
      trapSprite.setScale(1.2);
      trapSprite.setDepth(card.sprite.depth + 1);
      trapSprite.setAlpha(0);
      SoundHelper.playSound(this.scene, 'trap_trigger', 0.6);

      this.scene.tweens.add({
        targets: trapSprite,
        alpha: 1,
        scale: 1.6,
        duration: 200,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => trapSprite.destroy(),
      });

      const trapDamage = 8;
      const result = this.scene.gameState.takeDamage(trapDamage, -1, 'trap');
      if (result.actualDamage > 0) {
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 60, `Trap! -${result.actualDamage} HP`, 0xff4444);
      } else {
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 60, 'Trap avoided!', 0x66ff99);
      }

      if (this.scene.gameState?.damageTracking?.runStats) {
        this.scene.gameState.damageTracking.runStats.trapsTriggered++;
      }
    }

    resolveChestOpen(index, options = {}) {
      const card = this.boardCards[index];
      if (!card || card.data?.type !== 'treasureChest') return false;
      if (card.data.state !== 'locked') return false;

      card.data.state = 'opened';
      card.sprite.disableInteractive();

      const cfg = CardSystem.TREASURE_CHEST_CONFIG[card.data.chestType] || CardSystem.TREASURE_CHEST_CONFIG.WOODEN;
      const baseRewards = this.calculateChestRewards(card.data.chestType);
      let amuletGrade = baseRewards.amuletGrade;
      const originalGrade = amuletGrade;
      if (options.downgrade && amuletGrade) {
        amuletGrade = this.downgradeAmuletGrade(amuletGrade);
      }
      const downgraded = Boolean(options.downgrade && originalGrade);

      const multiplier = options.multiplier ?? 1;
      const rawGold = Math.max(0, Math.round(baseRewards.gold * multiplier));
      const rawCrystals = Math.max(0, Math.round(baseRewards.crystals * multiplier));

      const goldReward = this.scene.amuletManager ? this.scene.amuletManager.modifyGoldFound(rawGold) : rawGold;
      this.scene.gameState.coins += goldReward;
      this.scene.gameState.crystals += rawCrystals;

      SoundHelper.playSound(this.scene, 'chest_open', 0.6);

      this.scene.createFloatingText(card.sprite.x, card.sprite.y - 40, `+${goldReward} Gold`, 0xffd700);
      if (rawCrystals > 0) {
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 20, `+${rawCrystals} Crystals`, 0x66ccff);
      }

      let amuletMessage = null;
      let rewardGradeLabel = amuletGrade;
      if (amuletGrade) {
        const amuletReward = this.cardDataGenerator.getRandomAmuletByGrade(amuletGrade, this.scene.gameState.currentFloor);
        if (amuletReward) {
          rewardGradeLabel = amuletReward.grade || rewardGradeLabel || originalGrade;
        }
        if (amuletReward && this.scene.amuletManager) {
          const added = this.scene.amuletManager.addAmulet(amuletReward.id);
          if (added) {
            amuletMessage = `${rewardGradeLabel || amuletGrade || originalGrade} Amulet: ${amuletReward.name}`;
          } else {
            const fallback = Math.max(1, 2 + CardSystem.AMULET_GRADE_ORDER.indexOf(amuletGrade) * 2);
            this.scene.gameState.crystals += fallback;
            this.scene.createFloatingText(card.sprite.x, card.sprite.y, `Duplicate! +${fallback} Crystals`, 0x66ccff);
          }
        }
      }

      if (downgraded) {
        const displayGrade = rewardGradeLabel || amuletGrade || originalGrade;
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 70, `Amulet downgraded to ${displayGrade}`, 0xff8844);
      }

      if (amuletMessage) {
        this.scene.createFloatingText(card.sprite.x, card.sprite.y, amuletMessage, 0xfff1b5);
      }

      this.scene.tweens.add({
        targets: card.sprite,
        scale: card.sprite.scale * 1.1,
        yoyo: true,
        duration: 160,
        onComplete: () => {
          this.removeCard(index);
          this.checkFloorClear();
        },
      });

      this.scene.updateUI();
      return true;
    }

    calculateChestRewards(chestType) {
      const cfg = CardSystem.TREASURE_CHEST_CONFIG[chestType] || CardSystem.TREASURE_CHEST_CONFIG.WOODEN;
      const gold = Phaser.Math.Between(cfg.goldRange[0], cfg.goldRange[1]);
      const crystals = Phaser.Math.Between(cfg.crystalRange[0], cfg.crystalRange[1]);
      const amuletGrade = this.pickAmuletGrade(cfg.amuletGrades);
      return { gold, crystals, amuletGrade };
    }

    pickAmuletGrade(entries = []) {
      if (!entries.length) return null;
      const total = entries.reduce((sum, entry) => sum + entry.chance, 0);
      let roll = Math.random() * total;
      for (const entry of entries) {
        roll -= entry.chance;
        if (roll <= 0) {
          return entry.grade;
        }
      }
      return entries[entries.length - 1].grade;
    }

    downgradeAmuletGrade(grade) {
      const order = CardSystem.AMULET_GRADE_ORDER;
      const idx = order.indexOf(grade);
      if (idx <= 0) return order[0];
      return order[idx - 1];
    }

    checkFloorClear() {
        if (this.scene.roomType === 'TREASURE') {
            const chestsRemaining = this.boardCards.some(c =>
                c && c.data?.type === 'treasureChest' && c.data.state !== 'opened'
            );

            if (!chestsRemaining && !this.scene.enemiesCleared) {
                this.scene.onEnemiesCleared();
            }
            return;
        }

        const enemiesRemaining = this.boardCards.some(c =>
            c && c.revealed && (c.data.type === 'enemy' || c.data.type === 'boss')
        );

        if (!enemiesRemaining && !this.scene.enemiesCleared) {
            // Check if there are any unrevealed cards that could be enemies
            const potentialEnemies = this.boardCards.some(c =>
                c && !c.revealed && c.data.type === 'enemy'
            );

            if (potentialEnemies) return;

            const currentFloor = this.scene.gameState.currentFloor;
            const bossFloors = getBossFloors();

            if (bossFloors.includes(currentFloor)) {
                // Check if this is the final floor
                if (currentFloor === MAX_FLOOR) {
                    this.scene.time.delayedCall(1000, () => this.scene.gameWon());
                } else {
                    // Boss defeated, continue to next floor
                    this.scene.onEnemiesCleared();
                }
            } else {
                this.scene.onEnemiesCleared();
            }
        }
    }
    
    updateEnemyInfoText(card) {
        if (card.infoText) {
            const roleText = card.data.role === 'MELEE' ? '[Melee]' : '[Ranged]';
            let infoText = `${roleText} ${card.data.health}HP ${card.data.attack}ATK`;
            if (card.data.abilities && card.data.abilities.some(a => a.type === 'poison')) {
                infoText += ' (Poison)';
            }
            if (card.data.abilities && card.data.abilities.some(a => a.type === 'evade')) {
                infoText += ' (Evasive)';
            }
            if (card.data.name === 'Mimic') infoText += ' (Surprise Attack)';
            card.infoText.setText(infoText);
        }
    }
    
    createCardData(type, floor, isElite = false) {
        return this.cardDataGenerator.createCardData(type, floor || this.scene.gameState.currentFloor, isElite);
    }
    
    // No longer need the createEnemyWithPreferredRole call.
    mimicTreasureExplosion(x, y) {
        // Create splash sprite
        const splashSprite = this.scene.add.sprite(x, y, 'splash1');
        splashSprite.setScale(1.5); // Adjust size if needed
        splashSprite.play('splash_anim');
        
        // On complete: Destroy sprite, add loot
        splashSprite.on('animationcomplete', () => {
            splashSprite.destroy();
            SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);
            this.scene.gameState.coins += 20;
            this.scene.gameState.crystals += 5;
            this.scene.createFloatingText(x, y - 20, '+20 Coins +5 Crystals!', 0xffd700);
        });
    }
}
