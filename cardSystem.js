//cardSystem
import { CardDataGenerator } from './CardDataGenerator.js';
import { SoundHelper } from './utils/SoundHelper.js';
import { showItemTooltip, hideItemTooltip } from './utils/ItemTooltip.js';
import { snapOriginToPixelGrid } from './utils/PixelSnap.js';

export class CardSystem {
    constructor(scene) {
        this.scene = scene;
        this.boardCards = new Array(8).fill(null);
        this.cardDataGenerator = new CardDataGenerator();
        this.floorBoardPanel = null;
    }
    // ===== Front/back combat config =====
    static RANGED_MULTIPLIER = 0.8; // ranged deals 80% to compensate for reach
    // --- weapon helpers (be liberal: support multiple schemas) ---
    isMeleeWeapon(w) {
      if (!w) return false;
      if (this.isRangedWeapon(w)) return false;
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
    isVenomousWeapon(w) {
      return !!w && ((w.poisonDamage || 0) > 0 || (w.name || '').toLowerCase().includes('venomous dagger'));
    }
    applyWeaponPoison(card, weapon) {
      const poisonStacks = [];
      if (this.isVenomousWeapon(weapon)) {
        poisonStacks.push({
          damage: Math.max(1, weapon.poisonDamage || 1),
          turns: Math.max(1, weapon.poisonTurns || 3)
        });
      }

      if (weapon?.gemEffect === 'poison') {
        const stacks = Math.max(1, Math.min(3, weapon.gemCount || 1));
        for (let i = 0; i < stacks; i++) {
          poisonStacks.push({
            damage: 1,
            turns: 3
          });
        }
      }

      const relicEffects = this.scene.gameState?.relicEffects || {};
      if (relicEffects.weaponPoisonChance && Math.random() < relicEffects.weaponPoisonChance) {
        poisonStacks.push({
          damage: Math.max(1, relicEffects.poisonDamage || 1),
          turns: Math.max(1, relicEffects.poisonTurns || 3)
        });
      }

      if (poisonStacks.length === 0) return;
      if (!card.data.statusEffects) card.data.statusEffects = [];
      poisonStacks.forEach(stack => {
        card.data.statusEffects.push({
          type: 'poison',
          damage: stack.damage,
          turns: stack.turns,
          stackable: true
        });
      });
      const totalDamage = poisonStacks.reduce((sum, stack) => sum + stack.damage, 0);
      this.scene.createFloatingText(card.sprite.x, card.sprite.y - 16, `Poison +${totalDamage}`, 0x66ff66);
    }
    getEnemyPoisonSummary(enemyData) {
      const stacks = enemyData.statusEffects?.filter(effect => effect.type === 'poison') || [];
      if (stacks.length === 0) return null;
      return {
        stacks: stacks.length,
        damage: stacks.reduce((sum, effect) => sum + effect.damage, 0)
      };
    }
    processEnemyPoisonEffects() {
      for (let i = this.boardCards.length - 1; i >= 0; i--) {
        const card = this.boardCards[i];
        if (!card?.revealed || !card.sprite || (card.data.type !== 'enemy' && card.data.type !== 'boss')) continue;
        const effects = card.data.statusEffects;
        if (!effects?.length) continue;

        let poisonDamage = 0;
        for (let e = effects.length - 1; e >= 0; e--) {
          const effect = effects[e];
          if (effect.type !== 'poison') continue;
          poisonDamage += effect.damage;
          effect.turns--;
          if (effect.turns <= 0) effects.splice(e, 1);
        }

        if (poisonDamage <= 0) continue;
        card.data.health -= poisonDamage;
        this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${poisonDamage} Poison`, 0x66ff66);
        this.scene.shakeCard(card.sprite);

        if (card.data.health <= 0) {
          this.removeDefeatedEnemy(i, card);
        } else {
          this.updateEnemyInfoText(card);
        }
      }
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
    computePlacement(cells, opts = {}) {
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
      const padX = 24, padY = 24;
      // Cap on per-cell horizontal step. Default 65 keeps small clusters
      // from spreading out absurdly; callers extending the area can raise
      // it so cards actually use the new room.
      const maxHStep = opts.maxHStep ?? 65;
      const HSTEP = Math.min((areaW - padX) / Math.max(1, widthUnits), maxHStep);
      const VSTEP = Math.min((areaH - padY) / Math.max(1, heightUnits), 75);
      const cx = areaLeft + areaW / 2 + 40;
      const cy = areaTop  + areaH / 2 - 27;
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
      // Snap to integer pixels. Sub-pixel positions caused the whole board
      // to look like it shifted 1px every time a card hovered/tweened — the
      // pixel-rounded render position would alternate as decimals carried.
      return { x: Math.round(x), y: Math.round(y) };
    }

    clearFloorBoardPanel() {
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

    // Slides a wing-shaped extra board out from under the main panel for
    // crowded boards (lots of cards, or shops with bonus slots). Pass
    // side='left' to flip the art horizontally for left-side reveal.
    // animate=false drops it straight into its final position.
    createSideExtraPanel(side = 'right', { animate = true, delayMs = 200 } = {}) {
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

    // Public: tears down every board card and the board panel.
    // Used when entering shops/stations so leftover combat cards don't bleed through.
    clearBoard() {
      this.clearFloorBoardPanel();
      this.boardCards.forEach(card => {
        if (!card) return;
        card.gemIdleTimer?.remove?.(false);
        // Kill any in-flight tweens (e.g. Watcher's Lamp trap-peek) so their
        // onComplete callbacks don't fire on a destroyed sprite.
        if (card.sprite) this.scene.tweens.killTweensOf(card.sprite);
        card.sprite?.destroy();
        card.shadow?.destroy();
        card.gemShadow?.destroy();
        card.glow?.destroy();
        card.roleMarker?.destroy();
        card.poisonMarker?.destroy();
        if (card.infoText) {
          if (card.infoText.list) card.infoText.destroy(true);
          else card.infoText.destroy();
        }
        // Null references so any lingering closures see a falsy sprite.
        card.sprite = null;
        card.shadow = null;
        card.gemShadow = null;
        card.glow = null;
        card.roleMarker = null;
        card.poisonMarker = null;
        card.infoText = null;
      });
      this.boardCards = [];
    }

    createFloorBoardPanel(cells, place, animate = true, textureKey = 'gamingBoard') {
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

    createBossBoardPanel() {
      this.clearFloorBoardPanel();
      if (!this.scene.textures.exists('gamingBoard')) return;

      const cam = this.scene.cameras.main;
      const y = Math.min(cam.height - 122, cam.height / 2 + 8) - 18;
      const panel = this.scene.add.image((cam.width / 2) + 10, y + 34, 'gamingBoard');
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
    static MAX_CARDS = 16;
    static ELITE_MULT = 1.15;
    // Piecewise card-count curve. Tuned via the balance sim — the old 6→18
    // linear ramp made late floors a loot firehose with only 3-4 enemies.
    // The new piecewise shape gives the player enough merge fodder while
    // letting ensureEnemyMinimum push enemies up to 30-35% of the board.
    //   Act 1 (1-15) :  6 → 11
    //   Act 2 (16-30): 11 → 14
    //   Act 3 (31-45): 14 → 16
    _baseCardsForFloor(cf) {
        const f = Math.max(1, Math.min(45, cf));
        if (f <= 15)      return Math.round(6  + ((f - 1)  / 14) * (11 - 6));
        else if (f <= 30) return Math.round(11 + ((f - 15) / 15) * (14 - 11));
        else              return Math.round(14 + ((f - 30) / 15) * (16 - 14));
    }
    _effectiveCardCount(roomType, cf) {
        const base = this._baseCardsForFloor(cf);
        const scaled = (roomType === 'ELITE') ? Math.ceil(base * CardSystem.ELITE_MULT) : base;
        return Math.min(scaled, CardSystem.MAX_CARDS); // never exceed 26
    }
    spawnFloorCards() {
      // === per-floor relic effects ===
      // Healing Pact relic: heal at the start of every combat floor.
      const heal = this.scene.gameState?.relicEffects?.healPerFloor || 0;
      if (heal > 0 && this.scene.gameState && this.scene.gameState.playerHealth > 0 && this.scene.gameState.playerHealth < this.scene.gameState.maxHealth) {
        const before = this.scene.gameState.playerHealth;
        this.scene.gameState.playerHealth = Math.min(this.scene.gameState.maxHealth, before + heal);
        const gained = this.scene.gameState.playerHealth - before;
        if (gained > 0 && this.scene.playerAvatar) {
          this.scene.createFloatingText?.(this.scene.playerAvatar.x, this.scene.playerAvatar.y, `+${gained} HP (Pact)`, 0x66ff99);
        }
        this.scene.updateUI?.();
      }
      // Lucky Strike relic: arm the "first attack" flag for this floor.
      if (this.scene.gameState) this.scene.gameState.firstAttackThisFloorUsed = false;

      // === clear previous ===
      // Use the canonical teardown so leftover gem shadows, glows and idle
      // timers from un-picked cards on the previous floor are fully removed.
      // (The old inline loop only destroyed sprite/shadow/infoText, leaving
      // gemShadow sprites behind on the next combat floor.)
      this.clearBoard();
      // === boss shortcut (keep your logic) ===
      const currentFloor = this.scene.gameState.currentFloor;
      const bossFloors = [15, 30, 45];
      if (bossFloors.includes(currentFloor)) { this.spawnBoss(); return; }
      // Determine scaled count (your code that decides roomType etc. can stay)
      const cf = this.scene.gameState?.currentFloor || 1;
      const roomType = this.scene.gameState?.roomType || this.scene.roomType || 'COMBAT';
      const cardCount = this._effectiveCardCount ? this._effectiveCardCount(roomType, cf) : Math.min(6 + Math.floor((cf - 1) * (20 / 44)), 26);
      // 1) build a connected brick "blob" for a nicer cluster
      const cells = this.buildCompactBrickCluster(cardCount);
      // 2) compute steps & centering. Crowded boards request a widened area
      // and a larger per-cell step so cards actually use the wing panel.
      const wantsWing = cardCount > 14;
      const place = wantsWing
        ? this.computePlacement(cells, { extraRightWidth: 100, maxHStep: 78 })
        : this.computePlacement(cells);
      this.createFloorBoardPanel(cells, place, true);
      if (wantsWing) this.createSideExtraPanel('right', { delayMs: 260 });
      // Cache layout so mid-floor respawns (Echo Stone relic) can reuse positions.
      this._boardCells = cells;
      this._boardPlace = place;
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
        cardSprite.setScale(1);          // tweak if you want tighter/looser
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
        const data = this.createCardData(type, cf, roomType === 'ELITE');
        if (data?.type === 'trap') trapsPlaced++;
        if (data?.type === 'key') keysPlaced++;
        if (data?.type === 'gem') gemsPlaced++;
        if (data?.type === 'empty') emptyPlaced++;
        // Assign roles to enemies based on row position
        if (data && (data.type === 'enemy' || data.type === 'boss')) {
            // Higher r values = closer to player = front row = MELEE
            // Lower/negative r values = back row = RANGED
            const isFrontRow = r > 0;
            data.role = isFrontRow ? 'MELEE' : 'RANGED';
            
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
      // === Greasewing's Feast: convert one non-essential card into food ===
      if (this.scene.amuletManager?.wantsFoodCardConversion?.() &&
          roomType !== 'BOSS' && roomType !== 'ELITE') {
        this.convertCardToFood(cf);
      }

      // === reveal 2–3 enemies with a front/back mix and try to keep them close ===
      const extraRelicReveals = this.scene.gameState?.relicEffects?.revealExtraCard || 0;
      const wantReveals = Math.min(3, ((cf >= 4) ? 3 : 2) + extraRelicReveals);
      const enemyIdx = [];
      const frontIdx = [];
      const backIdx  = [];
      this.boardCards.forEach((c, i) => {
        if (!c) return;
        // Mimics stay hidden — the player must reveal them to start the timer.
        if (c.data?.isMimic) return;
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
      // Initial room reveals should not consume actions or queue enemy turns.
      picks.forEach(i => this.revealCard(i, true));

      // Watcher's Lamp — preview one trap (no damage)
      if (this.scene.amuletManager?.wantsTrapPreview?.()) {
        const trapIdx = this.boardCards.findIndex(c => c && !c.revealed && c.data?.type === 'trap');
        if (trapIdx !== -1) this.previewTrapAt(trapIdx);
      }

      // Wayfinder: reveal extra non-enemy cards (skip traps so we don't auto-trigger them)
      const extraNonEnemy = this.scene.amuletManager?.getExtraNonEnemyReveals?.() || 0;
      if (extraNonEnemy > 0) {
        const candidates = [];
        this.boardCards.forEach((c, i) => {
          if (!c || c.revealed) return;
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

    // Greasewing's Feast hook — convert one harmless card into food.
    // Prefers traps/coins so we don't eat key/weapon/armor pickups.
    convertCardToFood(floor) {
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

    // ─── Boss reward room ────────────────────────────────────────────────────
    // Special "floor" used after defeating an act boss. Reuses the GameScene
    // shell (avatar, inventory, UI) and just swaps the board contents.

    spawnBossRewardBoard(items) {
        // Clear whatever was on the board (boss fight remnants)
        this.clearFloorBoardPanel();
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
        this.clearBossRewardChest();

        // Decorative chest sprite at the top of the play area
        const chestX = 320;
        const chestY = 95;
        const chestTexture = this.scene.textures.exists('bigChestAnimation') ? 'bigChestAnimation' : 'chest';
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
            const shadow = this.scene.add.rectangle(x, cardY + 28, 52, 15, 0x000000, 0.6);
            shadow.setAlpha(notACard ? 0 : 1);

            const spriteKey = item.sprite || 'cardBack';
            const cardSprite = snapOriginToPixelGrid(item.spriteFrame !== undefined
                ? this.scene.add.sprite(x, cardY, spriteKey, item.spriteFrame)
                : this.scene.add.sprite(x, cardY, spriteKey));
            cardSprite.setScale(1);
            cardSprite.setInteractive({ useHandCursor: true });

            const cardEntry = { sprite: cardSprite, shadow, revealed: true, data: item };
            this.boardCards.push(cardEntry);
            const myIndex = this.boardCards.length - 1;

            cardSprite.on('pointerdown', () => this.takeRewardCard(myIndex));
            cardSprite.on('pointerover', () => {
                this.scene.tweens.add({ targets: cardSprite, y: cardY - 5, duration: 150 });
                showItemTooltip(this.scene, item, cardSprite.x, cardSprite.y);
            });
            cardSprite.on('pointerout', () => {
                this.scene.tweens.add({ targets: cardSprite, y: cardY, duration: 150 });
                hideItemTooltip(this.scene);
            });
            cardSprite.once('destroy', () => hideItemTooltip(this.scene));

            // Drop-in animation from above the chest
            cardSprite.setAlpha(0);
            cardSprite.y = cardY - 60;
            this.scene.tweens.add({
                targets: cardSprite,
                y: cardY,
                alpha: 1,
                duration: 400 + i * 120,
                ease: 'Back.Out'
            });

            this.createCardInfoText(cardEntry);
        });
    }

    takeRewardCard(index) {
        const card = this.boardCards[index];
        if (!card) return;

        const data = card.data;
        let success = false;

        if (data.type === 'amulet') {
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

    clearBossRewardChest() {
        if (this.bossRewardChest) {
            this.bossRewardChest.destroy();
            this.bossRewardChest = null;
        }
    }

    // Reaper's Mask — replace a defeated enemy with a random pickup card.
    // The drop sits in the enemy's exact brick position so neighbor logic
    // stays intact, already revealed and immediately clickable.
    spawnDeathDrop(index, originalCard) {
        const card = this.boardCards[index];
        if (!card || !card.sprite) return;

        // Random non-enemy pickup type. Anything the player can actually use.
        const dropTypes = ['coin', 'crystal', 'gem', 'food', 'potion', 'weapon', 'armor', 'magic', 'thorns', 'amulet'];
        const type = dropTypes[Math.floor(Math.random() * dropTypes.length)];
        const newData = this.cardDataGenerator.createCardData(
            type,
            this.scene.gameState.currentFloor,
            false,
            this.scene.gameState
        );
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
        card.sprite.destroy();
        card.data = newData;

        // Build a new sprite already in the "revealed" state
        const spriteKey = newData.sprite || 'cardBack';
        const newSprite = snapOriginToPixelGrid(newData.spriteFrame !== undefined
            ? this.scene.add.sprite(x, y, spriteKey, newData.spriteFrame)
            : this.scene.add.sprite(x, y, spriteKey));
        newSprite.setScale(1);
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
        newSprite.setAlpha(0);
        this.scene.tweens.add({
            targets: newSprite,
            alpha: 1,
            duration: 350,
            ease: 'Power2'
        });
        SoundHelper.playSound(this.scene, 'card_flip', 0.5);
        this.scene.createFloatingText(x, y - 24, 'Loot!', 0xffd700);
    }

    // Watcher's Lamp — briefly peek at a trap, then close it back face-down.
    // The trap is *not* triggered by the peek itself, and the player has to
    // remember which card it was. Interaction is paused during the peek so
    // accidental clicks don't reveal it for real.
    previewTrapAt(index) {
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

    ensureWeaponSupply(floor, roomType) {
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

    limitEnemyDensity(floor, roomType) {
      if (!this.boardCards?.length || roomType === 'BOSS') return;

      const maxRatio = floor <= 14 ? 0.45 : 0.55;
      const bonus = roomType === 'ELITE' ? 1 : 0;
      const maxEnemies = Math.max(2, Math.ceil(this.boardCards.length * maxRatio) + bonus);
      const enemyIndexes = this.boardCards
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card?.data?.type === 'enemy' || card?.data?.type === 'eliteEnemy')
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
        const replacement = this.cardDataGenerator.createCardData(replacementType, floor);
        if (!replacement) continue;
        replacement.brick = brick;
        card.data = replacement;
        if (replacement.type === 'gem') gemsOnBoard++;
        excess--;
      }
    }

    // Guarantee a real fight: combat/elite floors must have a minimum number of
    // enemies. Without this, floors could randomly roll ZERO enemies (free loot,
    // way too easy). Runs AFTER limitEnemyDensity so the cap isn't undone.
    ensureEnemyMinimum(floor, roomType) {
      if (!this.boardCards?.length || roomType === 'BOSS') return;
      // Sim showed the old 12/16% ratios let the player kill a few enemies
      // then loot the rest of the board — way too easy. Act 2 jumps to 35%
      // and act 3 to 45%, so most cards on the board are fights.
      const minRatio =
          floor <= 15 ? 0.18 :   // act 1 — gentle
          floor <= 30 ? 0.28 :   // act 2 — fights become majority
                        0.33;    // act 3 — pressure without wall
      const bonus = roomType === 'ELITE' ? 1 : 0;
      const minEnemies = Math.max(2, Math.round(this.boardCards.length * minRatio) + bonus);
      const isEnemy = (c) => c?.data?.type === 'enemy' || c?.data?.type === 'boss';
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

    spawnBoss() {
        const bossData = this.cardDataGenerator.createCardData('boss', this.scene.gameState.currentFloor);
        bossData.maxHealth = bossData.maxHealth || bossData.health;
        const cam = this.scene.cameras.main;
        const x = cam.width / 2;
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
    }

    playBossEntrance(cardSprite, bossData) {
        if (!cardSprite || bossData.name !== 'Spider Queen') return;

        const targetY = cardSprite.y;
        cardSprite.y = targetY - 70;
        cardSprite.setAlpha(0);
        this.scene.tweens.add({
            targets: cardSprite,
            y: targetY + 8,
            alpha: 1,
            duration: 420,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: cardSprite,
                    y: targetY,
                    duration: 180,
                    ease: 'Back.easeOut'
                });
            }
        });
    }

    pickCardType(currentFloor, excludedTypes = []) {
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
    generateRandomCard() {
        const currentFloor = this.scene.gameState.currentFloor;
        const type = this.pickCardType(currentFloor);
        return this.cardDataGenerator.createCardData(type, currentFloor, false, this.scene.gameState);
    }

    revealCard(index, freeAction = false) {
        const card = this.boardCards[index];
        if (!card || card.revealed) return;
        if (!freeAction && !this.scene.useAction()) return;
        
        SoundHelper.playSound(this.scene, 'card_flip', 0.7);
        card.revealed = true;
        // Per-enemy grace: when YOU flip a hidden card mid-floor and it's an enemy, it
        // sits out the action that revealed it (no instant zap), then attacks from the
        // next action onward. Set this immediately (not in the flip-animation callback)
        // so the enemy turn this action schedules sees the flag before it fires.
        // NOTE: only for real player reveals — the floor-start auto-reveals pass
        // freeAction=true and schedule NO enemy turn, so flagging them would leave the
        // grace unconsumed and steal the enemies' attack on the player's first action.
        if (!freeAction &&
            (card.data.type === 'enemy' || card.data.type === 'boss' || card.data.type === 'eliteEnemy')) {
            card.justRevealed = true;
        }
        if (card.glow) card.glow.destroy();

        // Gems and relics/amulets aren't cards — skip the rectangular card
        // shadow for them (gems get their own hand-painted shadow instead).
        if (card.shadow) {
            const t = card.data?.type;
            // No card-shaped shadow under gems/amulets/relics (they have
            // their own art) or under the "Nothing" card (we want the slot
            // to read as visually empty).
            const notACard = t === 'gem' || t === 'amulet' || t === 'relic' || t === 'empty';
            card.shadow.setAlpha(notACard ? 0 : 1);
        }

        card.sprite.off('pointerover');
        card.sprite.off('pointerout');
        card.sprite.play('card_flip_anim');
        
        card.sprite.once('animationcomplete', () => {
            if (card.data.sprite) {
                // Set sprite based on type
                let spriteKey = card.data.sprite || 'default_enemy';
                if (card.data.name === 'Mimic') spriteKey = 'mimic';
                card.sprite.setTexture(spriteKey, card.data.spriteFrame);
                snapOriginToPixelGrid(card.sprite);
            } else if (card.data.type === 'empty') {
                // "Nothing" card: don't render any tile body. Replace the
                // flipped sprite with an invisible hit target so the slot
                // remains clickable (interactWithCard fires the floating
                // "Nothing..." text), but the space looks empty.
                const px = card.sprite.x;
                const py = card.sprite.y;
                card.sprite.destroy();
                card.sprite = this.scene.add.rectangle(px, py, 70, 90, 0x000000, 0);
            } else {
                card.sprite.destroy();
                const colors = {
                    coin: 0xffd700,
                    crystal: 0x00ffff,
                    trap: 0xff4500,
                    armor: 0x888888,
                    potion: 0xff69b4,
                    gem: card.data.color || 0xffe066
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
            // Hover tooltip for board items — same renderer the shop / chest
            // rooms use. Skipped for things that already self-describe (enemies
            // show HP/ATK text; coins/crystals are obvious) or have nothing
            // useful to read (traps shouldn't be spoiled, empty cards are
            // literally nothing).
            this._attachBoardItemTooltip(card);
            if (card.data.type === 'gem') {
                this.attachGemShadow(card);
                this.enableGemDrag(card, index);
            }
            
            // Mimic: start the escape timer. Player must kill it before it runs.
            if (card.data.isMimic) {
                card.data.escapeTurnsLeft = card.data.escapeTurns || 3;
                this.scene.createFloatingText(
                    card.sprite.x, card.sprite.y - 32,
                    `Mimic! Kill in ${card.data.escapeTurnsLeft} turns`,
                    0xffaa00
                );
            }

            if (card.data.type === 'trap') {
                this.scene.cameras.main.shake(120, 0.006);
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
                // Enemy HP/ATK are rendered as two small numbers tucked into
                // the lower corners of the card art itself — no descriptive
                // text below the card. The new enemy sprites already bake the
                // melee/ranged/poison badges into the art, so the old role
                // and poison marker sprites are gone too.
                this._buildEnemyCornerStats(card);
                return;
                
            case 'coin':
                const coinLabel = this.scene.add.text(x, card.sprite.y + 7, 'Coins', {
                    fontSize: '11px', fill: '#f8ab2e', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                const coinAmount = this.scene.add.text(x, card.sprite.y + 20, `${card.data.amount}`, {
                    fontSize: '12px', fill: '#ffcf7f', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [coinLabel, coinAmount]);
                return;
                
            case 'crystal':
                const crystalLabel = this.scene.add.text(x, card.sprite.y + 7, 'Crystals', {
                    fontSize: '11px', fill: '#4e1e45', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                const crystalAmount = this.scene.add.text(x, card.sprite.y + 20, `${card.data.amount}`, {
                    fontSize: '12px', fill: '#a83c69', fontFamily: '"HoMM Pixel"'
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
                    fontSize: '12px', fill: '#a55119', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [foodLabel]);
                return;
                
            case 'key':
                const keyLabel = this.scene.add.text(x, card.sprite.y + 18, 'Key', {
                    fontSize: '12px', fill: '#51484b', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                card.infoText = this.scene.add.container(0, 0, [keyLabel]);
                return;
                
            case 'magic':
                const magicLabel = this.scene.add.text(x, card.sprite.y - 25, card.data.name, {
                    fontSize: '11px', 
                    fill: '#9932cc', 
                    fontFamily: '"HoMM Pixel"',
                    wordWrap: { width: 60 },
                    align: 'center'
                }).setOrigin(0.5);
                
                // Show abbreviated description
                let shortDesc = '';
                switch(card.data.magicType) {
                    case 'fireball': shortDesc = '15 DMG'; break;
                    case 'frostRing': shortDesc = 'Freeze 3T'; break;
                    case 'restoration': shortDesc = 'Full HP+AP'; break;
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
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                
                card.infoText = this.scene.add.container(0, 0, [magicLabel, magicDesc]);
                return;

            case 'thorns': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const damageText = this.scene.add.text(17, 22, `${card.data.thornDamage}`, {
                    fontSize: '11px',
                    fill: '#9dff7a',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add(damageText);

                const startY = -27;
                const dotSpacing = 6;
                const tenDurabilitySpacing = 11;
                const tensCount = Math.floor(card.data.durability / 10);
                const remainingDots = card.data.durability % 10;
                let currentY = startY;

                for (let i = 0; i < tensCount; i++) {
                    const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-19, currentY, 'ten_durability'));
                    container.add(tenSprite);
                    currentY += tenDurabilitySpacing;
                }

                for (let i = 0; i < remainingDots; i++) {
                    const dot = snapOriginToPixelGrid(this.scene.add.image(-19, currentY + (i * dotSpacing), 'durability_dot'));
                    container.add(dot);
                }

                container.setDepth(1001);
                card.infoText = container;
                return;
            }

            case 'gem': {
                const label = this.scene.add.text(card.sprite.x, card.sprite.y + 22, this.getGemLabel(card.data), {
                    fontSize: '9px',
                    fill: '#ffe8b0',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                card.infoText = label;
                return;
            }
                
            case 'weapon': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                
                const damageText = this.scene.add.text(17, 22, `${card.data.damage}`, {
                    fontSize: '11px',
                    fill: '#ffcf7f',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add(damageText);
                
                // Durability display with 10-point sprites and individual dots
                const startY = -27;
                const dotSpacing = 6;
                const tenDurabilitySpacing = 11; // Space between 10-point sprites
                
                const tensCount = Math.floor(card.data.durability / 10);
                const remainingDots = card.data.durability % 10;
                
                let currentY = startY;
                
                // Add 10-durability sprites
                for (let i = 0; i < tensCount; i++) {
                    const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-19, currentY, 'ten_durability'));
                    container.add(tenSprite);
                    currentY += tenDurabilitySpacing;
                }
                
                // Add remaining individual dots
                for (let i = 0; i < remainingDots; i++) {
                    const dot = snapOriginToPixelGrid(this.scene.add.image(-19, currentY + (i * dotSpacing), 'durability_dot'));
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
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add(protectionText);
                
                // Durability display with 10-point sprites and individual dots
                const startY = -25;
                const dotSpacing = 6;
                const tenDurabilitySpacing = 11; // Space between 10-point sprites
                
                const tensCount = Math.floor(card.data.durability / 10);
                const remainingDots = card.data.durability % 10;
                
                let currentY = startY;
                
                // Add 10-durability sprites
                for (let i = 0; i < tensCount; i++) {
                    const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-22, currentY, 'ten_durability'));
                    container.add(tenSprite);
                    currentY += tenDurabilitySpacing;
                }
                
                // Add remaining individual dots
                for (let i = 0; i < remainingDots; i++) {
                    const dot = snapOriginToPixelGrid(this.scene.add.image(-22, currentY + (i * dotSpacing), 'durability_dot'));
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
                fontFamily: '"HoMM Pixel"',
                align: 'center',
                lineSpacing: 2
            }).setOrigin(0.5);
        }

        // Old role/poison markers used the enemyCardType.png sprite sheet. The
        // new enemy artwork already includes those badges, and stat numbers
        // now live in the card corners — so nothing extra to stamp here.
    }

    // Renders HP (bottom-left, red) and ATK (bottom-right, orange) directly
    // on top of the card art. Both numbers share a container stored on
    // card.infoText, so the existing reveal/update/teardown plumbing handles
    // them without changes.
    _buildEnemyCornerStats(card) {
        if (!card?.sprite || !card.data) return;
        if (card.data.type === 'boss') {
            this._buildBossStats(card);
            return;
        }

        // Corner inset (px from the card centre). Tuned to drop into the
        // little stat-plate slots painted onto the new card art — HP to the
        // bottom-left, ATK to the bottom-right.
        const dx = 18;   // pulled further inward so the digits sit in the slots
        const dy = 27;   // raised 5px from the original bottom edge

        const style = (fill) => ({
            fontSize: '11px',
            fill,
            fontFamily: '"HoMM Pixel"',
        });

        // Dark fills with a thin white outline for legibility on the busy
        // enemy art. HP keeps a red tint, ATK a warm amber.
        const hpText = this.scene.add.text(
            -dx, dy, `${card.data.health ?? 0}`, style('#5a0000')
        ).setOrigin(0.5);
        const atkText = this.scene.add.text(
            dx, dy, `${card.data.attack ?? 0}`, style('#3a1f00')
        ).setOrigin(0.5);

        const container = this.scene.add.container(card.sprite.x, card.sprite.y, [hpText, atkText]);
        container.setDepth((card.sprite.depth || 1) + 2);

        // Tag the child texts so updateEnemyInfoText can refresh in place
        // without rebuilding the whole container.
        container._hpText = hpText;
        container._atkText = atkText;

        card.infoText = container;
    }

    _buildBossStats(card) {
        if (!card?.sprite || !card.data) return;

        const maxHealth = Math.max(1, card.data.maxHealth || card.data.health || 1);
        card.data.maxHealth = maxHealth;

        const barFrame = this.scene.textures.getFrame('healthBar');
        const barWidth = barFrame?.width || 84;
        const bossBottom = (card.sprite.displayHeight || card.sprite.height || 100) / 2;
        const y = card.sprite.y + bossBottom + 18;

        const emptyBar = this.scene.add.image(0, 0, 'healthBarEmpty').setOrigin(0.5);
        const fillBar = this.scene.add.image(-barWidth / 2, 0, 'healthBar').setOrigin(0, 0.5);
        const hpText = this.scene.add.text(0, -1, '', {
            fontSize: '9px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"',
            stroke: '#230000',
            strokeThickness: 2
        }).setOrigin(0.5);
        const atkText = this.scene.add.text(0, 14, '', {
            fontSize: '10px',
            fill: '#ffcf7f',
            fontFamily: '"HoMM Pixel"',
            stroke: '#2b1600',
            strokeThickness: 2
        }).setOrigin(0.5);

        const container = this.scene.add.container(card.sprite.x, y, [emptyBar, fillBar, hpText, atkText]);
        container.setDepth((card.sprite.depth || 1) + 8);
        container._bossHpFill = fillBar;
        container._bossHpText = hpText;
        container._bossAtkText = atkText;
        container._bossBarWidth = barWidth;

        card.infoText = container;
        this.updateBossInfoText(card);
    }

    getGemLabel(gem) {
        if (gem?.gemEffect === 'fire') return 'Fire';
        if (gem?.gemEffect === 'poison') return 'Poison';
        if (gem?.gemEffect === 'lightning') return 'Zap';
        return 'Gem';
    }

    attachGemShadow(card) {
        const shadowFrameByEffect = { fire: 0, poison: 1, lightning: 2 };
        const frame = shadowFrameByEffect[card.data.gemEffect];
        if (frame === undefined || !card.sprite) return;
        const offsetX = 0;
        const offsetY = 3;
        const gemShadow = this.scene.add.sprite(
            card.sprite.x + offsetX,
            card.sprite.y + offsetY,
            'shadowsGems',
            frame
        );
        gemShadow.setDepth((card.sprite.depth || 1) - 0.1);
        card.gemShadow = gemShadow;
        card.gemShadowOffset = { x: offsetX, y: offsetY };
    }

    enableGemDrag(card, index) {
        if (!card?.sprite || !card?.data) return;
        card.sprite.setInteractive({ draggable: true, useHandCursor: true });
        const home = { x: card.sprite.x, y: card.sprite.y };
        const animKey = `gem_${card.data.gemEffect}_sparkle`;
        const hoverAnimKey = `gem_${card.data.gemEffect}_hover`;
        let idleTimer = null;
        if (this.scene.anims.exists(animKey)) {
            card.sprite.on('pointerover', () => {
                if (this.scene.anims.exists(hoverAnimKey)) {
                    card.sprite.play(hoverAnimKey);
                } else {
                    card.sprite.play(animKey);
                }
            });
            card.sprite.on('pointerout', () => {
                card.sprite.stop();
                card.sprite.setFrame(card.data.spriteFrame || 0);
            });
            card.sprite.on('animationcomplete', (animation) => {
                if (animation?.key === animKey) {
                    card.sprite.setFrame(card.data.spriteFrame || 0);
                }
            });
            idleTimer = this.scene.time.addEvent({
                delay: 2600 + Math.floor(Math.random() * 1800),
                loop: true,
                callback: () => {
                    if (card.sprite?.scene && !card.sprite.input?.dragState && !card.sprite.input?.enabled) return;
                    if (card.sprite?.scene && !card.sprite.input?.dragState && !card.sprite.anims?.isPlaying) {
                        card.sprite.play(animKey);
                    }
                }
            });
            card.gemIdleTimer = idleTimer;
        }

        card.sprite.on('dragstart', () => {
            card.sprite.stop();
            card.sprite.setDepth(2500);
            if (card.shadow) card.shadow.setAlpha(0);
            if (card.gemShadow) card.gemShadow.setVisible(false);
        });
        card.sprite.on('drag', (pointer, dragX, dragY) => {
            card.sprite.x = Phaser.Math.Clamp(dragX, 0, 640);
            card.sprite.y = Phaser.Math.Clamp(dragY, 0, 360);
            if (card.infoText?.scene) {
                card.infoText.x = card.sprite.x;
                card.infoText.y = card.sprite.y + 22;
            }
        });
        card.sprite.on('dragend', () => {
            if (this.tryApplyBoardGem(card, index)) return;
            card.sprite.setDepth(1);
            card.sprite.x = home.x;
            card.sprite.y = home.y;
            if (card.infoText?.scene) {
                card.infoText.x = home.x;
                card.infoText.y = home.y + 22;
            }
            if (card.gemShadow && card.gemShadow.scene) {
                const off = card.gemShadowOffset || { x: 0, y: 3 };
                card.gemShadow.x = home.x + off.x;
                card.gemShadow.y = home.y + off.y;
                card.gemShadow.setDepth((card.sprite.depth || 1) - 0.1);
                card.gemShadow.setVisible(true);
            }
        });
    }

    tryApplyBoardGem(card, index) {
        const inventory = this.scene.inventorySystem;
        if (!inventory || !card?.sprite) return false;

        if (inventory.discardArea && Phaser.Geom.Intersects.RectangleToRectangle(card.sprite.getBounds(), inventory.discardArea.getBounds())) {
            SoundHelper.playSound(this.scene, 'item_discard', 0.7);
            this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Discarded!', 0xff0000);
            this.scene.recordCardDiscarded?.(card.data, card.sprite.x, card.sprite.y);
            this.removeCard(index);
            this.scene.useAction?.();
            return true;
        }

        for (let i = 0; i < inventory.slotSprites.length; i++) {
            const slot = inventory.slotSprites[i];
            if (!slot?.background) continue;
            if (!Phaser.Geom.Intersects.RectangleToRectangle(card.sprite.getBounds(), slot.background.getBounds())) continue;

            const targetCard = inventory.slots[i];
            if (targetCard?.type === 'weapon') {
                if (inventory.applyGemToWeapon(card.data, i)) {
                    this.removeCard(index);
                    this.scene.useAction?.();
                    return true;
                }
                break;
            }
            if (!targetCard && inventory.addCard(card.data, i)) {
                this.removeCard(index);
                this.scene.useAction?.();
                return true;
            }
        }

        return false;
    }

    // Hover info for revealed item cards on the gaming board. Uses the same
    // tooltip renderer as the shop / chest / reward rooms (utils/ItemTooltip).
    // Tooltip skips card types that already show their info or that we don't
    // want to spoil.
    _attachBoardItemTooltip(card) {
        if (!card?.sprite || !card.data) return;
        const t = card.data.type;
        const tooltipped = new Set([
            'weapon', 'armor', 'amulet', 'gem', 'potion',
            'food', 'magic', 'thorns', 'key'
        ]);
        if (!tooltipped.has(t)) return;

        const sprite = card.sprite;
        const data = card.data;
        const scene = this.scene;

        sprite.on('pointerover', () => {
            // Re-derive position each time — gems/animations can shift y.
            showItemTooltip(scene, data, sprite.x, sprite.y);
        });
        sprite.on('pointerout', () => {
            hideItemTooltip(scene);
        });
        // Belt-and-suspenders: if the card is destroyed mid-hover, kill any
        // lingering tooltip so it doesn't stick on screen.
        sprite.once('destroy', () => hideItemTooltip(scene));
    }

    removeCard(index) {
        const card = this.boardCards[index];
        if (card) {
            card.gemIdleTimer?.remove?.(false);
            if (card.sprite) card.sprite.destroy();
            if (card.shadow) card.shadow.destroy();
            if (card.gemShadow) card.gemShadow.destroy();
            if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
            if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
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
                
            case 'crystal': {
                SoundHelper.playSound(this.scene, 'crystal_collect', 0.5);
                const crystalAmount = this.scene.amuletManager
                    ? this.scene.amuletManager.modifyCrystalFound(card.data.amount)
                    : card.data.amount;
                this.scene.gameState.crystals += crystalAmount;
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${crystalAmount}`, 0x00ffff);
                this.removeCard(index);
                break;
            }
                
            case 'potion':
            case 'weapon':
            case 'armor':
            case 'key':
            case 'magic':
            case 'thorns':
            case 'gem':
                if (this.scene.inventorySystem.addCard(card.data)) {
                    this.removeCard(index);
                    // Picking an item off the board costs an action point and wakes the enemies.
                    this.scene.useAction?.();
                }
                break;

            case 'food': {
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
                this.scene.scheduleEnemyTurn?.();
                break;
            }

            case 'amulet':
                this.consumeAmulet(card.data, index);
                // Equipping an amulet costs an action point and wakes the enemies.
                this.scene.useAction?.();
                break;

            case 'empty':
                // Nothing here — clear the card, no reward.
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Nothing...', 0x999999);
                this.removeCard(index);
                break;
        }

        this.scene.updateUI();
        // Defensive: a few death paths (fire splash on hidden enemies, etc.)
        // can take the last enemy off the board without then triggering the
        // clear check. Re-validating after any card interaction guarantees
        // that picking up a coin / "Nothing" / etc. unsticks a phantom
        // "still in combat" state if the board is actually clear.
        this.checkFloorClear();
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

    // Echo Stone relic: respawn a card on the board after a merge.
    // Uses the cached floor layout (this._boardCells / this._boardPlace) so the
    // new card slots into the original brick grid. Spawns face-down — the player
    // has to click to reveal, same as any normal floor card.
    respawnCardOnBoard(cardData) {
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
        cardSprite.setScale(1);
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
        cardSprite.setScale(0.1);
        this.scene.tweens.add({ targets: cardSprite, scale: 1, duration: 250, ease: 'Back.easeOut' });
        const flash = this.scene.add.circle(x, y, 30, 0x66ddff, 0.7);
        this.scene.tweens.add({
            targets: flash, alpha: 0, scale: 2, duration: 400,
            onComplete: () => flash.destroy()
        });
        SoundHelper.playSound(this.scene, 'magic_cast', 0.4);
        this.scene.createFloatingText(x, y - 30, 'Echoed!', 0x66ddff);

        // Card is face-down — player must reveal it like any other floor card.
        // Deep-copy the data so it's independent from the merged source object.
        this.boardCards[slot] = {
            sprite: cardSprite,
            shadow,
            revealed: false,
            data: JSON.parse(JSON.stringify(cardData))
        };
        return true;
    }

    attackEnemy(index, damage, isReflection = false, weaponUsed = null, skipDurability = false) {
        const card = this.boardCards[index];
        if (!card || !card.revealed || (card.data.type !== 'enemy' && card.data.type !== 'boss')) return;
        
        // === front/back gating ===
        // Check what weapon is being used
        const weapon = weaponUsed || this.scene.inventorySystem?.getCurrentWeapon?.() || null;
        
        if (!isReflection && weapon) {
            const isRanged = this.isRangedWeapon(weapon);

            // Check if there are any melee enemies alive (revealed or hidden)
            const meleeBlockers = this._anyMeleeAlive({ includeHidden: true });

            // RANGED weapons (spears, bows) bypass the frontline gate — that's
            // their whole point. They pay a damage penalty (RANGED_MULTIPLIER)
            // in exchange for being able to hit back-row archers regardless
            // of front-row blockers.
            if (!isRanged && meleeBlockers && card.data.role !== 'MELEE') {
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x,
                    this.scene.playerAvatar.y,
                    'Blocked by frontline!',
                    0xff6666
                );
                return;
            }

            // Ranged weapons get a damage penalty
            if (isRanged) {
                damage = Math.floor(damage * CardSystem.RANGED_MULTIPLIER);
            }
        }
        
        // Apply amulet damage modifiers to weapon damage (not reflection)
        let finalDamage = damage;
        if (!isReflection && weapon && this.scene.amuletManager) {
            finalDamage = this.scene.amuletManager.modifyWeaponDamage(damage);
        }
        // Giant's Strength relic: +1 flat damage on every weapon attack.
        if (!isReflection && weapon) {
            const dmgBonus = this.scene.gameState?.relicEffects?.weaponDamageBonus || 0;
            if (dmgBonus) finalDamage += dmgBonus;
        }
        if (!isReflection && weapon && this.scene.gameState?.shadowBlade?.turns > 0) {
            finalDamage = Math.floor(finalDamage * (this.scene.gameState.shadowBlade.multiplier || 1.5));
        }

        const critChance = this.scene.gameState?.discardCritChance || 0;
        if (!isReflection && weapon && critChance > 0 && Math.random() < critChance) {
            finalDamage *= 2;
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 24, 'CRIT!', 0xffd700);
        }

        // Lucky Strike relic: the first attack each floor deals double damage.
        // (Stacks multiplicatively with CRIT — if both fire, you get x4.)
        if (!isReflection && weapon && this.scene.gameState?.relicEffects?.firstAttackDoubleDamage
            && !this.scene.gameState.firstAttackThisFloorUsed) {
            finalDamage *= 2;
            this.scene.gameState.firstAttackThisFloorUsed = true;
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 38, 'LUCKY STRIKE!', 0xffaa00);
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
        
        // Gem effects fire BEFORE the weapon damage lands. If we waited until
        // after, a killing weapon hit would knock the target's health to ≤ 0
        // and burnEnemy / damageGemTarget would short-circuit, silently
        // dropping the gem damage and its "-X Fire" / "Zap" floating text on
        // the main target. Splash to neighbours still works because they
        // weren't touched by the weapon yet.
        if (!isReflection && weapon?.gemEffect && card.sprite?.scene) {
            this.applyWeaponGemEffect(index, weapon, finalDamage);
        }

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
        
        // Reduce weapon durability on attack (only if not reflection damage).
        // Tempered Steel: halves the rate at which durability is lost.
        // skipDurability=true for the second hit of a dual-wield so it costs only 1 pip total.
        if (!isReflection && !skipDurability && this.scene.gameState.equippedWeapon) {
            const durabilityLoss = this.scene.amuletManager
                ? (Math.random() < this.scene.amuletManager.getWeaponDurabilityRate() ? 1 : 0)
                : 1;
            this.scene.gameState.equippedWeapon.durability -= durabilityLoss;
            if (this.scene.gameState.equippedWeapon.durability <= 0) {
                this.scene.gameState.equippedWeapon = null;
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weapon Broke!', 0xff0000);
            }
            this.scene.updateUI();
        }
        
        // Elemental hit animation on the struck enemy (fire / poison / lightning)
        if (!isReflection && weapon) {
            let hitFx = null;
            if (weapon.gemEffect === 'fire' || weapon.gemEffect === 'lightning' || weapon.gemEffect === 'poison') {
                hitFx = weapon.gemEffect;
            } else if (weapon.poisonDamage > 0) {
                hitFx = 'poison'; // native venomous weapons
            }
            if (hitFx) this.playEnemyHitEffect(card, hitFx);
        }

        if (!isReflection && weapon && card.data.health > 0) {
            this.applyWeaponPoison(card, weapon);
            this.applyRelicSlow(card);
        }

        // (Gem effect ran above, before the weapon damage was applied, so we
        // don't re-trigger it here.)

        this.updateEnemyInfoText(card);

        this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${finalDamage}`, 0xff0000);

        if (card.data.health <= 0) {
            this.removeDefeatedEnemy(index, card);
        }
    }

    applyWeaponGemEffect(targetIndex, weapon, baseDamage) {
        const target = this.boardCards[targetIndex];
        if (!target?.data) return;

        const stack = Math.max(1, Math.min(3, weapon.gemCount || 1));

        if (weapon.gemEffect === 'fire') {
            // Fire: FLAT +3 / +4 / +5 fire damage. The MAIN target takes
            // weapon damage AND the fire damage (so sword 8 + 3-stack fire = 13
            // on the main enemy). Every other enemy within splash radius also
            // takes the +3/+4/+5 fire damage. Scales by gem stack with
            // diminishing returns; weak weapons benefit hugely (gems add
            // meaningful damage), legendary weapons not much (5 on top of 16
            // is modest).
            const splashDamage = [3, 4, 5][stack - 1];
            // Main target: bonus fire damage on top of the weapon hit.
            this.burnEnemy(targetIndex, splashDamage);
            // Measure to the NEAREST EDGE of each enemy's sprite, not its center.
            // A big sprite like the boss has a far-off center but its body can be
            // right next to the minion you hit — center distance would miss it.
            // Max brick-adjacent distance is ~82px; 100px gives a safe margin.
            const SPLASH_RADIUS = 100;
            const tx = target.sprite?.x ?? 0;
            const ty = target.sprite?.y ?? 0;
            this.boardCards.forEach((card, i) => {
                if (i === targetIndex || !card?.sprite) return;
                const b = card.sprite.getBounds();
                // Closest point on this sprite's bounding box to the struck card.
                const nx = Phaser.Math.Clamp(tx, b.left, b.right);
                const ny = Phaser.Math.Clamp(ty, b.top, b.bottom);
                const dx = nx - tx;
                const dy = ny - ty;
                if (dx * dx + dy * dy <= SPLASH_RADIUS * SPLASH_RADIUS) {
                    this.burnEnemy(i, splashDamage);
                }
            });
            return;
        }

        if (weapon.gemEffect === 'lightning') {
            // Lightning: FLAT +3 / +4 / +5 lightning damage (scales with stacks).
            // Always hits 3 enemies total: main target + 2 others, regardless
            // of how many gems are socketed. Stacks only increase the damage.
            //   1 gem  → 3 enemies take +3 lightning each
            //   2 gems → 3 enemies take +4 lightning each
            //   3 gems → 3 enemies take +5 lightning each
            // Back-row RANGED enemies prioritized as zap targets.
            const zapDamage = [3, 4, 5][stack - 1];
            const extraZaps = 2; // always 2 additional = 3 total
            // Main target: bonus lightning damage on top of the weapon hit.
            this.damageGemTarget(targetIndex, zapDamage, 'Zap', 0xffe066, 'lightning');
            if (extraZaps > 0) {
                const candidates = this.boardCards
                    .map((card, i) => ({ card, i }))
                    .filter(({ card, i }) => i !== targetIndex && this.isOpenEnemyCard(card));
                const ranged = candidates.filter(({ card }) => card.data?.role === 'RANGED');
                const melee = candidates.filter(({ card }) => card.data?.role !== 'RANGED');
                const picks = [
                    ...Phaser.Utils.Array.Shuffle(ranged).slice(0, extraZaps),
                    ...Phaser.Utils.Array.Shuffle(melee),
                ].slice(0, extraZaps);
                picks.forEach(({ i }, zapIndex) => {
                    this.scene.time.delayedCall((zapIndex + 1) * 90, () => {
                        this.damageGemTarget(i, zapDamage, 'Zap', 0xffe066, 'lightning');
                    });
                });
            }
        }
    }

    isOpenEnemyCard(card) {
        return !!card?.revealed && !!card.sprite && (card.data?.type === 'enemy' || card.data?.type === 'boss');
    }

    // Enemy/boss with HP left — revealed OR still face-down.
    isAnyEnemyCard(card) {
        return !!card && (card.data?.type === 'enemy' || card.data?.type === 'boss') && card.data.health > 0;
    }

    // Fire burn that also affects hidden enemies. Open enemies get the full
    // hit FX; face-down ones take damage quietly and die in place if it's
    // lethal (they never get to open).
    burnEnemy(index, amount) {
        const card = this.boardCards[index];
        if (!this.isAnyEnemyCard(card)) return;
        card.data.health -= amount;
        if (card.revealed && card.sprite?.scene) {
            this.playEnemyHitEffect(card, 'fire');
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, `-${amount} Fire`, 0xff7040);
            this.scene.shakeCard(card.sprite);
            this.updateEnemyInfoText(card);
        } else if (card.sprite?.scene) {
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, `-${amount} Burn`, 0xff7040);
        }
        if (card.data.health <= 0) this.removeDefeatedEnemy(index, card);
    }

    // Spawns a one-shot elemental hit animation over an enemy card.
    // effect: 'fire' | 'poison' | 'lightning'
    playEnemyHitEffect(card, effect) {
        if (!card?.sprite?.scene) return;
        const animKey = `enemy_hit_${effect}`;
        if (!this.scene.anims.exists(animKey)) return;
        const fx = this.scene.add.sprite(card.sprite.x, card.sprite.y, 'enemiesHitEffects');
        fx.setDepth((card.sprite.depth || 0) + 5);
        fx.play(animKey);
        fx.once('animationcomplete', () => fx.destroy());
        // Safety cleanup in case the complete event is missed
        this.scene.time.delayedCall(600, () => fx.active && fx.destroy());
    }

    damageGemTarget(index, amount, label, color, effect = null) {
        const card = this.boardCards[index];
        if (!this.isOpenEnemyCard(card)) return;
        if (effect) this.playEnemyHitEffect(card, effect);
        card.data.health -= amount;
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, `-${amount} ${label}`, color);
        this.scene.shakeCard(card.sprite);
        if (card.data.health <= 0) {
            this.removeDefeatedEnemy(index, card);
        } else {
            this.updateEnemyInfoText(card);
        }
    }

    applyRelicSlow(card) {
        const slowChance = this.scene.gameState?.relicEffects?.slowChance || 0;
        if (!slowChance || Math.random() >= slowChance || !card?.data || card.data.frozen > 0) return;
        card.data.frozen = 1;
        if (card.sprite) {
            card.sprite.setTint(0x99ccff);
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Slowed!', 0x99ccff);
        }
    }

    removeDefeatedEnemy(index, card) {
            // Process amulet kill effects
            if (this.scene.amuletManager) {
                this.scene.amuletManager.processEnemyKill();
            }

            const relicLifesteal = this.scene.gameState.relicEffects?.lifestealOnKill || 0;
            if (relicLifesteal) {
                this.scene.gameState.playerHealth = Math.min(
                    this.scene.gameState.maxHealth,
                    this.scene.gameState.playerHealth + relicLifesteal
                );
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x,
                    this.scene.playerAvatar.y,
                    `+${relicLifesteal} HP (Lich)`,
                    0x9932cc
                );
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
            
            // Reaper's Mask — chance to drop a random pickup in the enemy's spot
            const dropChance = this.scene.amuletManager?.getDeathDropChance?.() || 0;
            if (dropChance > 0 && Math.random() < dropChance) {
                this.spawnDeathDrop(index, card);
                // The slot now holds a non-enemy pickup. If that enemy was the
                // last one on the board, the floor is actually clear — we must
                // still run the clear check before bailing, or the Next button
                // never appears.
                this.checkFloorClear();
                return; // skip the normal removal; new card stands in its place
            }

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

    checkFloorClear() {
        // 'eliteEnemy' is used as a third enemy type throughout the codebase;
        // it must be treated the same as 'enemy' here or hidden elites get
        // ignored and the floor "clears" while one is still on the board.
        const isEnemyType = (t) => t === 'enemy' || t === 'boss' || t === 'eliteEnemy';

        const enemiesRemaining = this.boardCards.some(c =>
            c && c.revealed && isEnemyType(c.data?.type)
        );

        if (!enemiesRemaining && !this.scene.enemiesCleared) {
            // Check if there are any unrevealed cards that could be enemies
            // A hidden mimic is optional treasure — it shouldn't block floor clear
            const potentialEnemies = this.boardCards.some(c =>
                c && !c.revealed && isEnemyType(c.data?.type) && !c.data?.isMimic
            );
            
            if (potentialEnemies) return;
            
            const currentFloor = this.scene.gameState.currentFloor;
            const bossFloors = [15, 30, 45];
            
            if (bossFloors.includes(currentFloor)) {
                // Check if this is the final floor
                if (currentFloor === 45) {
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
        if (!card?.data || !card.sprite) return;

        // Fast path: the corner-stat container we built in createCardInfoText
        // exposes _hpText / _atkText. Refresh those in place when they're
        // still valid Phaser objects.
        const container = card.infoText;
        if (card.data.type === 'boss' && container?._bossHpFill) {
            this.updateBossInfoText(card);
            return;
        }

        const hpText = container?._hpText;
        const atkText = container?._atkText;
        if (hpText && atkText
            && typeof hpText.setText === 'function'
            && typeof atkText.setText === 'function') {
            try {
                hpText.setText(`${card.data.health ?? 0}`);
                atkText.setText(`${card.data.attack ?? 0}`);
                return;
            } catch (_) { /* fall through to rebuild */ }
        }

        // Stale or wrong-shaped container — drop and rebuild via the standard
        // reveal path so styling stays consistent.
        try { if (container && typeof container.destroy === 'function') container.destroy(true); } catch (_) {}
        card.infoText = null;
        this._buildEnemyCornerStats(card);
    }

    updateBossInfoText(card) {
        const container = card?.infoText;
        if (!container?._bossHpFill || !container._bossHpText || !container._bossAtkText) return;

        const maxHealth = Math.max(1, card.data.maxHealth || card.data.health || 1);
        const health = Phaser.Math.Clamp(card.data.health || 0, 0, maxHealth);
        const barWidth = container._bossBarWidth || 84;
        const fillWidth = Math.max(0, Math.ceil(barWidth * (health / maxHealth)));

        container._bossHpFill.setVisible(fillWidth > 0);
        container._bossHpFill.setCrop(0, 0, fillWidth, container._bossHpFill.height);
        container._bossHpText.setText(`${health}/${maxHealth}`);
        container._bossAtkText.setText(`ATK ${card.data.attack ?? 0}`);
    }
    
    createCardData(type, floor, isElite = false, gameState = null, targetRarity = null) {
        // Forward gameState (for amulet no-reroll rules) and targetRarity
        // (for forced shop/reward rarities). Defaulting gameState to the
        // scene's keeps board amulet drops consistent too.
        return this.cardDataGenerator.createCardData(
            type,
            floor || this.scene.gameState.currentFloor,
            isElite,
            gameState || this.scene.gameState,
            targetRarity
        );
    }

    // Delegate to CardDataGenerator so reward scenes (RareShop, Treasure, etc.)
    // can call this on a CardSystem instance the same way they call
    // createCardData.
    capRewardRarity(rarity, floor) {
        return this.cardDataGenerator.capRewardRarity(rarity, floor);
    }
    
    // No longer need the createEnemyWithPreferredRole call.
    mimicTreasureExplosion(x, y) {
        // Loot scales a little with depth
        const floor = this.scene.gameState.currentFloor || 1;
        const coinReward = 20 + floor * 2;
        const crystalReward = 5 + Math.floor(floor / 5);

        // Create splash sprite
        const splashSprite = this.scene.add.sprite(x, y, 'splash1');
        if (this.scene.anims.exists('splash_anim')) splashSprite.play('splash_anim');

        // On complete: Destroy sprite, add loot
        splashSprite.on('animationcomplete', () => {
            splashSprite.destroy();
            SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);
            this.scene.gameState.coins += coinReward;
            this.scene.gameState.crystals += crystalReward;
            this.scene.createFloatingText(x, y - 20, `+${coinReward} Coins +${crystalReward} Crystals!`, 0xffd700);
            this.scene.updateUI?.();
        });
        // Safety: ensure the splash clears even if the anim event misses
        this.scene.time.delayedCall(900, () => splashSprite.active && splashSprite.destroy());
    }

    // Mimic ran away — poof of splash, no loot.
    mimicEscape(index) {
        const card = this.boardCards[index];
        if (!card || !card.sprite) {
            this.removeCard(index);
            this.checkFloorClear();
            return;
        }
        const x = card.sprite.x;
        const y = card.sprite.y;
        this.scene.createFloatingText(x, y - 20, 'Mimic Escaped!', 0xff6600);

        const splash = this.scene.add.sprite(x, y, 'splash1');
        if (this.scene.anims.exists('splash_anim')) splash.play('splash_anim');
        splash.once('animationcomplete', () => splash.destroy());
        this.scene.time.delayedCall(900, () => splash.active && splash.destroy());
        SoundHelper.playSound(this.scene, 'card_flip', 0.4);

        this.removeCard(index);
        this.checkFloorClear();
    }
}
