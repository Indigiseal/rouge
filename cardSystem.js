//cardSystem
import { CardDataGenerator } from './CardDataGenerator.js';
import { SoundHelper } from './utils/SoundHelper.js';
import { CombatSequencer } from './utils/CombatSequencer.js';
import { showItemTooltip, hideItemTooltip, showBossTooltip } from './utils/ItemTooltip.js';
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
        n.includes('axe')
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
      this.scene.createFloatingText(card.sprite.x, card.sprite.y - 16, 'Poisoned!', 0x44ff44);
      this.scene.createFloatingText(card.sprite.x, card.sprite.y - 32, `poison -${totalDamage}/turn`, 0x88dd88);

      // Show looping poison icon at top-right corner of the enemy card
      if (card.sprite && !card.poisonMarker && this.scene.textures.exists('poisonedStatus')) {
        const halfW = (card.sprite.displayWidth || 52) / 2;
        const halfH = (card.sprite.displayHeight || 70) / 2;
        // The Spider Queen's tall sprite has a web hanging upward, so her real
        // body sits in the lower half — drop the marker 60px to land on her body.
        const bodyOffsetY = card.data.name === 'Spider Queen' ? 60 : 0;
        const marker = this.scene.add.sprite(
          Math.round(card.sprite.x + halfW - 2),
          Math.round(card.sprite.y - halfH + 2 + bodyOffsetY),
          'poisonedStatus'
        );
        marker.setOrigin(1, 0);
        marker.setDepth((card.sprite.depth || 1) + 3);
        if (this.scene.anims?.exists('poison_status_anim')) marker.play('poison_status_anim');
        card.poisonMarker = marker;
      }
    }
    getEnemyPoisonSummary(enemyData) {
      const stacks = enemyData.statusEffects?.filter(effect => effect.type === 'poison') || [];
      if (stacks.length === 0) return null;
      return {
        stacks: stacks.length,
        damage: stacks.reduce((sum, effect) => sum + effect.damage, 0)
      };
    }

    applyShockStatus(card, turns = 1) {
      if (!card?.data || !card.sprite || (card.data.health || 0) <= 0) return false;
      if ((card.data.frozen || 0) > 0) return false;

      card.data.frozen = Math.max(1, turns);
      card.data.shockedTurns = Math.max(1, turns);
      this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, 'Shocked!', 0x66ccff);

      if (!card.shockMarker && this.scene.textures.exists('shockedStatus')) {
        const halfW = (card.sprite.displayWidth || 52) / 2;
        const halfH = (card.sprite.displayHeight || 70) / 2;
        const bodyOffsetY = card.data.name === 'Spider Queen' ? 60 : 0;
        const marker = this.scene.add.sprite(
          Math.round(card.sprite.x + halfW - 2),
          Math.round(card.sprite.y - halfH + 2 + bodyOffsetY),
          'shockedStatus'
        );
        marker.setOrigin(1, 0);
        marker.setDepth((card.sprite.depth || 1) + 4);
        if (this.scene.anims?.exists('shock_status_anim')) marker.play('shock_status_anim');
        card.shockMarker = marker;
      }
      return true;
    }

    // Frozen frame overlay — drawn on top of a frozen card in place of the old
    // blue tint. Idempotent and safe headlessly. Skipped for shocked cards,
    // which share the `frozen` counter (to skip turns) but carry their own
    // marker, so they shouldn't also get the ice frame.
    attachFrozenFrame(card) {
      if (!card?.sprite || (card.data?.frozen || 0) <= 0) return;
      if ((card.data?.shockedTurns || 0) > 0) return;
      const textureKey = card.data?.type === 'boss' && this.scene.textures?.exists?.('bossFrozenFrame')
        ? 'bossFrozenFrame'
        : 'frozenFrame';
      if (!this.scene.textures?.exists?.(textureKey)) return;
      if (card.frozenFrame && card.frozenFrame.active) {
        if (card.frozenFrame.texture?.key !== textureKey) card.frozenFrame.setTexture(textureKey);
        card.frozenFrame.setPosition(Math.round(card.sprite.x), Math.round(card.sprite.y));
        return;
      }
      const frame = snapOriginToPixelGrid(
        this.scene.add.image(card.sprite.x, card.sprite.y, textureKey)
      );
      frame.setDepth((card.sprite.depth || 1) + 2);
      card.frozenFrame = frame;
    }

    removeFrozenFrame(card) {
      if (card?.frozenFrame) {
        card.frozenFrame.destroy();
        card.frozenFrame = null;
      }
    }

    processEnemyPoisonEffects() {
      for (let i = this.boardCards.length - 1; i >= 0; i--) {
        const card = this.boardCards[i];
        if (!this.isOpenEnemyCard(card)) continue;
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

        // Remove the poison icon once all stacks have expired
        if (card.poisonMarker && !effects.some(e => e.type === 'poison')) {
          card.poisonMarker.destroy();
          card.poisonMarker = null;
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
        if (!this.isEnemyType(c.data?.type)) continue;
        if (revealedOnly && !c.revealed) continue;
        out.push(i);
      }
      return out;
    }
    _anyMeleeAlive({ includeHidden = true } = {}) {
      for (let i = 0; i < this.boardCards.length; i++) {
        const c = this.boardCards[i];
        if (!c) continue;
        if (c.data?.tutorialDormant) continue;
        if (!this.isEnemyType(c.data?.type)) continue;
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
        if (!this.isEnemyType(c.data?.type)) continue;
        if (c.data.role !== 'MELEE') continue;
        const br = c.data?.brick?.r;
        if (typeof br === 'number' && br > best) best = br;
      }
      return best;
    }
    canMeleeHit(targetIndex) {
      const target = this.boardCards[targetIndex];
      if (!target) return false;
      if (!this.isEnemyType(target.data?.type)) return false;
      
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
          if (c.data?.tutorialDormant) return false;
          return this.isEnemyType(c.data?.type) && c.data.role !== 'MELEE';
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

    // Stop in-flight tweens on a card's animated parts (hover lift, entrance,
    // trap-peek) before destroying or re-targeting them; a live tween could
    // otherwise fire once more on a destroyed sprite later this frame.
    killCardTweens(card) {
      if (card.sprite) this.scene.tweens.killTweensOf(card.sprite);
      if (card.infoText) this.scene.tweens.killTweensOf(card.infoText);
      if (card.hoverSprite) this.scene.tweens.killTweensOf(card.hoverSprite);
    }

    // Tween onUpdate handler: round the target's y each frame so pixel art
    // stays crisp while it moves. Doesn't use `this`, safe to pass by reference.
    snapYOnUpdate(_tween, target) {
      if (target?.scene) target.y = Math.round(target.y);
    }

    // Public: tears down every board card and the board panel.
    // Used when entering shops/stations so leftover combat cards don't bleed through.
    clearBoard() {
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
      if (this.scene.gameState) this.scene.gameState.firstAttackThisFloorUsed = false;

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
      // Cache layout so mid-floor respawns (Webweaver's Thread relic) can reuse positions.
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
        // Front rows (r > 0, closer to the player) get MELEE-type enemies; back
        // rows get RANGED (archers). Pass the desired role into creation so the
        // enemy TYPE/sprite is picked to match the position, not just its behavior.
        const desiredRole = r > 0 ? 'MELEE' : 'RANGED';
        const data = this.createCardData(type, cf, roomType === 'ELITE', null, null, desiredRole);
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

    // Deal a fixed, rigged 12-card board for the guided tutorial. Unlike
    // spawnFloorCards this uses no randomness: each card carries a
    // `tutorialTag` so TutorialManager can locate it, and only the front-row
    // skeleton starts revealed. The front/back reach lesson works because the
    // melee "guard" stays face-down until the player is told to flip it, so an
    // early sword swing at the archer trips the built-in frontline gate.
    spawnTutorialCards() {
      this.clearBoard();
      const cf = 1;
      const mkSword = (tag) => ({
        type: 'weapon', name: 'Common Sword', weaponType: 'sword',
        damage: 6, rarity: 'common', sprite: 'sword_C',
        durability: 6, maxDurability: 6, special: null, range: 'melee',
        tutorialTag: tag
      });
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
        cardSprite.setScale(1);
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
        const OFFS = (r & 1) ? CardSystem.OFFS_ODD : CardSystem.OFFS_EVEN;
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

    revealTutorialLightningTargets() {
      if (!this.scene.tutorialMode || this._tutorialLightningTargetsRevealed) return;
      this._tutorialLightningTargetsRevealed = true;

      ['lightningTarget1', 'lightningTarget2', 'lightningTarget3'].forEach(tag => {
        const target = this.findTutorialCard(tag);
        if (!target) return;
        target.card.data.tutorialDormant = false;
        if (!target.card.revealed) this.revealCard(target.index, true);
      });
    }

    // Find a live board card by its tutorial tag; returns { index, card } or null.
    findTutorialCard(tag) {
      const index = this.boardCards.findIndex(c => c?.data?.tutorialTag === tag);
      return index >= 0 ? { index, card: this.boardCards[index] } : null;
    }

    // Greasewing's Feast hook — convert one harmless card into food.
    // Prefers traps/coins so we don't eat key/weapon/armor pickups.
    getSerializableBoardLayout() {
      if (!Array.isArray(this._boardCells) || !this._boardPlace) return null;
      return {
        cells: this._boardCells.map(cell => cell ? { r: cell.r, c: cell.c } : null),
        place: { ...this._boardPlace }
      };
    }

    // Rebuild an in-progress combat board from the save instead of rolling a
    // new floor. Card data and positions are authoritative; the optional layout
    // preserves already-used/null slots for neighbor and respawn mechanics.
    restoreSavedBoard(savedCards, savedLayout = null) {
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
          const wantsWing = layoutCells.length > 14;
          place = wantsWing
            ? this.computePlacement(validCells, { extraRightWidth: 100, maxHStep: 78 })
            : this.computePlacement(validCells);
        }
        this.createFloorBoardPanel(validCells, place, false);
        if (layoutCells.length > 14) this.createSideExtraPanel('right', { animate: false });
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
        cardSprite.setScale(1).setDepth(2).setInteractive();

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

    restoreEnemyStatusMarkers(card) {
      if (!this.isOpenEnemyCard(card)) return;
      const makeMarker = (texture, anim, depthOffset) => {
        const halfW = (card.sprite.displayWidth || 52) / 2;
        const halfH = (card.sprite.displayHeight || 70) / 2;
        const bodyOffsetY = card.data.name === 'Spider Queen' ? 60 : 0;
        const marker = this.scene.add.sprite(
          Math.round(card.sprite.x + halfW - 2),
          Math.round(card.sprite.y - halfH + 2 + bodyOffsetY),
          texture
        ).setOrigin(1, 0).setDepth((card.sprite.depth || 1) + depthOffset);
        if (this.scene.anims.exists(anim)) marker.play(anim);
        return marker;
      };

      if (card.data.statusEffects?.some(effect => effect.type === 'poison')
          && this.scene.textures.exists('poisonedStatus')) {
        card.poisonMarker = makeMarker('poisonedStatus', 'poison_status_anim', 3);
      }
      if ((card.data.shockedTurns || 0) > 0 && this.scene.textures.exists('shockedStatus')) {
        card.shockMarker = makeMarker('shockedStatus', 'shock_status_anim', 4);
      }
    }

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
            cardSprite.setScale(1);
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

    // Mask of Hollow Whispers — replace a defeated enemy with a random pickup card.
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

    assignEliteMiniBoss(roomType) {
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

    // The Angry Nestmother stalks the player for the rest of the run in which
    // they stole her egg (birdAngry, set by the bird-nest event and reset each
    // new run). She turns up "once in a while" in regular AND elite battles —
    // never bosses — as a single ranged archer. Never more than one per battle.
    injectAngryNestmother(floor, roomType) {
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

    spawnBoss() {
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
        // Flipping a legendary item gets its own reveal fanfare.
        if (card.data?.rarity === 'legendary') {
            SoundHelper.playVariant(this.scene, 'legendary_reveal', 0.6);
        }
        card.revealed = true;
        if (card.data?.tutorialTag) {
            this.scene.events.emit('tutorialProgress', `revealed:${card.data.tutorialTag}`);
            this.scene.tutorialManager?._handleProgress?.(`revealed:${card.data.tutorialTag}`);
        }
        // Per-enemy grace: when YOU flip a hidden card mid-floor and it's an enemy, it
        // sits out the action that revealed it (no instant zap), then attacks from the
        // next action onward. Set this immediately (not in the flip-animation callback)
        // so the enemy turn this action schedules sees the flag before it fires.
        // NOTE: only for real player reveals — the floor-start auto-reveals pass
        // freeAction=true and schedule NO enemy turn, so flagging them would leave the
        // grace unconsumed and steal the enemies' attack on the player's first action.
        if (!freeAction && this.isEnemyType(card.data.type)) {
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
                // Nothing under the card — whoosh paired with the empty poof.
                SoundHelper.playSound(this.scene, 'empty_whoosh', 0.6);
                // Poof effect
                if (this.scene.anims.exists('poof_empty_anim')) {
                    const poof = this.scene.add.sprite(px, py, 'poofEmpty').setDepth(5);
                    poof.play('poof_empty_anim');
                    poof.once('animationcomplete', () => poof.destroy());
                }
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
            this.applyEliteMiniBossVisual(card);
            
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

    applyEliteMiniBossVisual(card) {
        if (!card?.revealed || !card.data?.isEliteMiniBoss || !card.sprite?.setTint) return;
        card.sprite.setTint(0xfff0c8);
    }

    handleTrap(card, index) {
        const trapName = card.data.name || 'Trap';
        if (card.data.subType === 'spike') {
            SoundHelper.playSound(this.scene, 'trap_woosh', 0.7);
            const { actualDamage, tookDamage } = this.scene.gameState.takeDamage(card.data.damage, -1, 'trap');
            if (this.scene.gameState.playerHealth <= 0) this.scene.killedBy = trapName;
            if (tookDamage) {
                SoundHelper.playVariant(this.scene, 'player_hurt', 0.5);
            }
            if (actualDamage > 0) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${actualDamage}`, 0xff0000);
            }
        } else if (card.data.subType === 'poison') {
            // Acid trap opens with its smoke-poof SFX (paired with the poof anim below).
            SoundHelper.playSound(this.scene, 'poison_trap', 0.6);
            // Immediate hit on top of the lingering poison-over-time.
            const hit = card.data.damage || 0;
            if (hit > 0) {
                const { actualDamage, tookDamage } = this.scene.gameState.takeDamage(hit, -1, 'trap');
                if (this.scene.gameState.playerHealth <= 0) this.scene.killedBy = trapName;
                if (tookDamage) {
                    SoundHelper.playVariant(this.scene, 'player_hurt', 0.5);
                }
                if (actualDamage > 0) {
                    this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${actualDamage}`, 0xff0000);
                }
            }
            if (this.scene.anims.exists('poison_poof_anim')) {
                const poof = this.scene.add.sprite(card.sprite.x, card.sprite.y, 'poisonPoof').setDepth(6);
                poof.play('poison_poof_anim');
                poof.once('animationcomplete', () => poof.destroy());
            }
            if (this.scene.gameState.addPlayerEffect({ ...card.data.abilities[0], killedBy: trapName })) {
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Poisoned!', 0x00ff00);
            }
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
        const attachInfoText = (info) => {
            card.infoText = info;
            card.sprite?.setData?.('infoText', info);
            return info;
        };
        
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
                
            case 'coin': {
                // Anchor the container at the card and offset children relative to
                // it (not absolute), so hover/drag can move it as a single unit —
                // matching the weapon pips. Absolute children get flung off-card
                // when the inventory sets infoText.x/y = cardSprite.x/y.
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const coinLabel = this.scene.add.text(0, 7, 'Coins', {
                    fontSize: '11px', fill: '#f8ab2e', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                const coinAmount = this.scene.add.text(0, 20, `${card.data.amount}`, {
                    fontSize: '12px', fill: '#ffcf7f', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add([coinLabel, coinAmount]);
                attachInfoText(container);
                return;
            }

            case 'crystal': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const crystalLabel = this.scene.add.text(0, 7, 'Crystals', {
                    fontSize: '11px', fill: '#4e1e45', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                const crystalAmount = this.scene.add.text(0, 20, `${card.data.amount}`, {
                    fontSize: '12px', fill: '#a83c69', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add([crystalLabel, crystalAmount]);
                attachInfoText(container);
                return;
            }
                
            case 'trap': {
                // Spike/poison traps show their damage in the same value slot
                // that weapon cards use (offset 17,22 from card centre).
                let trapDamage = null;
                if (card.data.subType === 'spike') {
                    trapDamage = card.data.damage;
                } else if (card.data.subType === 'poison') {
                    trapDamage = card.data.abilities?.[0]?.damage;
                }

                if (trapDamage != null) {
                    const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                    const damageText = this.scene.add.text(17, 22, `${trapDamage}`, {
                        fontSize: '11px',
                        fill: '#ffcf7f',
                        fontFamily: '"HoMM Pixel"'
                    }).setOrigin(0.5);
                    container.add(damageText);
                    container.setDepth(1001);
                    attachInfoText(container);
                    return;
                }

                // Reveal traps have no damage value — keep the descriptive label.
                if (card.data.subType === 'reveal') {
                    infoText = `Reveals adjacent cards!`;
                }
                break;
            }
                
            case 'food': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                // The carry-over egg is a food card under the hood, but it reads as
                // an "Egg" to the player rather than a +30 AP snack — label it so.
                const isEgg = card.data.id === 'monsterEgg' || card.data.name === 'Egg';
                const foodLabel = this.scene.add.text(0, 19, isEgg ? 'Egg' : `+${card.data.actionAmount} AP`, {
                    fontSize: '12px', fill: '#a55119', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add(foodLabel);
                attachInfoText(container);
                return;
            }

            case 'key': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const keyLabel = this.scene.add.text(0, 18, 'Key', {
                    fontSize: '12px', fill: '#51484b', fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add(keyLabel);
                attachInfoText(container);
                return;
            }

            case 'magic': {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const magicLabel = this.scene.add.text(0, -25, card.data.name, {
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

                const magicDesc = this.scene.add.text(0, 20, shortDesc, {
                    fontSize: '10px',
                    fill: '#cc99ff',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);

                container.add([magicLabel, magicDesc]);
                attachInfoText(container);
                return;
            }

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
                attachInfoText(container);
                return;
            }

            case 'gem': {
                const label = this.scene.add.text(card.sprite.x, card.sprite.y + 22, this.getGemLabel(card.data), {
                    fontSize: '9px',
                    fill: '#ffe8b0',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                attachInfoText(label);
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
                attachInfoText(container);
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
                attachInfoText(container);
                return;
            }
                
            case 'amulet':
                // Amulets show no descriptive text on the board — it just clutters
                // the playfield. The full description is available on hover via the
                // item tooltip, so there's nothing to stamp under the card here.
                return;
        }
        
        // Create default text for cases that didn't return early
        if (infoText) {
            const textColor = card.data.type === 'amulet' && 
                this.scene.amuletManager && 
                card.data.id && 
                this.scene.amuletManager.amuletDefinitions[card.data.id]?.cursed 
                ? '#ff6666' : '#ffffff';
                
            attachInfoText(this.scene.add.text(x, y, infoText, {
                fontSize: '10px',
                fill: textColor,
                fontFamily: '"HoMM Pixel"',
                align: 'center',
                lineSpacing: 2
            }).setOrigin(0.5));
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
        card.sprite?.setData?.('infoText', container);
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
        card.sprite?.setData?.('infoText', container);
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

    // Hover info for boss cards: shows the boss's attack and a plain-language
    // line for each ability (lifesteal, summon, rage, etc.) so the player can
    // read what they're up against. Shares the item-tooltip container/renderer.
    _attachBossTooltip(card) {
        if (!card?.sprite || card.data?.type !== 'boss') return;
        const sprite = card.sprite;
        const data = card.data;
        const scene = this.scene;

        sprite.on('pointerover', () => {
            showBossTooltip(scene, data, sprite.x, sprite.y);
        });
        sprite.on('pointerout', () => hideItemTooltip(scene));
        sprite.once('destroy', () => hideItemTooltip(scene));
    }

    removeCard(index) {
        const card = this.boardCards[index];
        if (card) {
            if (card.data?.tutorialTag) {
                this.scene.events.emit('tutorialProgress', `removed:${card.data.tutorialTag}`);
                this.scene.tutorialManager?._handleProgress?.(`removed:${card.data.tutorialTag}`);
            }
            card.gemIdleTimer?.remove?.(false);
            this.killCardTweens(card);
            if (card.sprite) card.sprite.destroy();
            if (card.shadow) card.shadow.destroy();
            if (card.gemShadow) card.gemShadow.destroy();
            if (card.hoverSprite) { card.hoverSprite.destroy(); card.hoverSprite = null; }
            if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
            if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
            if (card.shockMarker) { card.shockMarker.destroy(); card.shockMarker = null; }
            if (card.frozenFrame) { card.frozenFrame.destroy(); card.frozenFrame = null; }
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
                SoundHelper.playSound(this.scene, 'key_pickup', 0.5);
                // falls through to the shared pickup handling below
            case 'magic':
            case 'thorns':
            case 'gem':
                if (card.data.type === 'gem') SoundHelper.playSound(this.scene, 'gem_pickup', 0.5);
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
        this.scene.queueStalemateEnemyTurn?.();
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

    // Webweaver's Thread relic: respawn a card on the board after a merge.
    // Uses the cached floor layout (this._boardCells / this._boardPlace) so the
    // new card slots into the original brick grid. Spawns face-down — the player
    // has to click to reveal, same as any normal floor card.
    respawnCardOnBoard(cardData, options = {}) {
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
        if (!options.silent) {
            cardSprite.setScale(0.1);
            this.scene.tweens.add({ targets: cardSprite, scale: 1, duration: 250, ease: 'Back.easeOut' });
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

    // Shared evasion check. An enemy carrying an { type: 'evade', chance }
    // ability (e.g. the Lost Soul) has that chance to phase through a direct
    // attack — the player's weapon/magic OR a companion strike. Returns true when
    // the hit is dodged (and shows the "Miss!" text); the caller must then skip
    // its damage. Reflection (thorns) and damage-over-time bypass this.
    rollEvade(card) {
        if (!card?.data || !card.sprite?.scene) return false;
        const evadeAbility = card.data.abilities?.find(a => a.type === 'evade');
        const chance = Number(evadeAbility?.chance) || 0;
        if (chance <= 0 || Math.random() >= chance) return false;
        SoundHelper.playVariant(this.scene, 'dodge_miss', 0.5);
        this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Miss!', 0xffffff);
        return true;
    }

    attackEnemy(index, damage, isReflection = false, weaponUsed = null, skipDurability = false) {
        const card = this.boardCards[index];
        if (!card || !card.revealed || !this.isEnemyType(card.data.type)) return;
        
        // === front/back gating ===
        // Check what weapon is being used
        const weapon = weaponUsed || this.scene.inventorySystem?.getCurrentWeapon?.() || null;
        
        if (!isReflection && weapon) {
            const isRanged = this.isRangedWeapon(weapon);

            // Check if there are any melee enemies alive (revealed or hidden)
            const meleeBlockers = this._anyMeleeAlive({ includeHidden: true });

            // RANGED weapons (bows) bypass the frontline gate — that's
            // their whole point. They pay a damage penalty (RANGED_MULTIPLIER)
            // in exchange for being able to hit back-row archers regardless
            // of front-row blockers.
            if (!isRanged && meleeBlockers && card.data.role !== 'MELEE') {
                SoundHelper.playVariant(this.scene, 'invalid_action', 0.5);
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x,
                    this.scene.playerAvatar.y,
                    'Blocked by frontline!',
                    0xff6666
                );
                // Let the tutorial (or any listener) react to a blocked swing.
                this.scene.events.emit('frontlineBlocked', index);
                this.scene.events.emit('tutorialProgress', 'blocked');
                this.scene.tutorialManager?._handleProgress?.('blocked');
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
        // Giant's Morningstar relic: +1 flat damage on every weapon attack.
        if (!isReflection && weapon) {
            const dmgBonus = this.scene.gameState?.relicEffects?.weaponDamageBonus || 0;
            if (dmgBonus) finalDamage += dmgBonus;
        }
        if (!isReflection && weapon && this.scene.gameState?.shadowBlade?.turns > 0) {
            finalDamage = Math.floor(finalDamage * (this.scene.gameState.shadowBlade.multiplier || 1.5));
        }

        // Resolve evasion before rolling/showing critical hits or consuming the
        // once-per-floor War Horn charge. A missed attack must not announce a
        // CRIT or spend a one-shot bonus that never dealt damage.
        if (!isReflection && this.rollEvade(card)) return;

        const critChance = (this.scene.gameState?.discardCritChance || 0)
            + (this.scene.amuletManager?.getCriticalChanceBonus?.() || 0);
        if (!isReflection && weapon && critChance > 0 && Math.random() < critChance) {
            finalDamage *= 2;
            // Big yellow CRIT! plus a sharp screen shake so a crit really lands.
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 24, 'CRIT!', 0xffe066, '26px');
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 46, 'Double Damage!', 0xff8800);
            this.scene.cameras.main.shake(200, 0.012);
            // Lucky Streak (Fortune Card): a crit can shake loose a coin or crystal.
            const luckyReward = this.scene.amuletManager?.rollLuckyStreakCritReward?.();
            if (luckyReward) this.playKillLootPickup(card.sprite.x, card.sprite.y, luckyReward, 'Lucky');
        }

        // Goblin War Horn relic: the first attack each floor deals double damage.
        // (Stacks multiplicatively with CRIT — if both fire, you get x4.)
        if (!isReflection && weapon && this.scene.gameState?.relicEffects?.firstAttackDoubleDamage
            && !this.scene.gameState.firstAttackThisFloorUsed) {
            finalDamage *= 2;
            this.scene.gameState.firstAttackThisFloorUsed = true;
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 38, 'WAR HORN!', 0xffaa00);
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 54, 'Double Damage!', 0xff8800);
        }
        
        if (!isReflection) {
            const sx = card.sprite.x;
            const sy = card.sprite.y;
            CombatSequencer.schedule(this.scene, 'hit', () => this.scene.createSlashEffect(sx, sy));
            // Random impact sound on the struck enemy (variants avoid monotony).
            CombatSequencer.playVariant(this.scene, 'hit', 'enemy_hit', 0.4);
        }

        // Reflected damage is the answer to a blow, not a blow of its own, so it
        // shakes on the reflect beat rather than crowding the enemy's own hit.
        CombatSequencer.shakeCard(this.scene, isReflection ? 'reflect' : 'hit', card.sprite);
        
        // Gem effects fire BEFORE the weapon damage lands. If we waited until
        // after, a killing weapon hit would knock the target's health to ≤ 0
        // and burnEnemy / damageGemTarget would short-circuit, silently
        // dropping the gem damage and its "-X Fire" / "Zap" floating text on
        // the main target. Splash to neighbours still works because they
        // weren't touched by the weapon yet.
        if (!isReflection && weapon?.gemEffect && card.sprite?.scene) {
            this.applyWeaponGemEffect(index, weapon, finalDamage);
        }

        // Apply damage. (Carrion Oath / hungryDagger no longer alters combat — it was
        // reworked into a potion-based poison cleanse, handled in AmuletManager.)
        card.data.health -= finalDamage;
        
        // Reduce weapon durability on attack (only if not reflection damage).
        // Tempered Ingot: halves the rate at which durability is lost.
        // skipDurability=true for the second hit of a dual-wield so it costs only 1 pip total.
        if (!isReflection && !skipDurability && this.scene.gameState.equippedWeapon) {
            const durabilityLoss = this.scene.amuletManager
                ? (Math.random() < this.scene.amuletManager.getWeaponDurabilityRate() ? 1 : 0)
                : 1;
            this.scene.gameState.equippedWeapon.durability -= durabilityLoss;
            if (this.scene.gameState.equippedWeapon.durability <= 0) {
                this.scene.gameState.equippedWeapon = null;
                CombatSequencer.floatingText(this.scene, 'break',
                    this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weapon Broke!', 0xff0000);
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
            if (hitFx) CombatSequencer.schedule(this.scene, 'gem', () => {
                if (card.sprite?.scene) this.playEnemyHitEffect(card, hitFx);
            });
        }

        if (!isReflection && weapon && card.data.health > 0) {
            this.applyWeaponPoison(card, weapon);
            this.applyRelicSlow(card);
        }

        // (Gem effect ran above, before the weapon damage was applied, so we
        // don't re-trigger it here.)

        this.updateEnemyInfoText(card);

        // Show the weapon damage number on screen, but log it ourselves with an
        // explicit label so the player's own hit is unmistakable in the combat
        // log next to gem "Zap"/"Fire" numbers (skipLog avoids double-logging).
        CombatSequencer.floatingText(this.scene, isReflection ? 'reflect_damage' : 'damage',
            card.sprite.x, card.sprite.y, `-${finalDamage}`, 0xff0000, '15px', { skipLog: true });
        const targetName = card.data?.name || 'Enemy';
        const weaponLabel = (!isReflection && weapon?.weaponType)
            ? ` (${weapon.weaponType.charAt(0).toUpperCase()}${weapon.weaponType.slice(1)})`
            : (isReflection ? ' (Reflected)' : '');
        this.scene.pushCombatLog?.(`${targetName} -${finalDamage}${weaponLabel}`);

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
            // Tightened to 70px so the splash mostly catches directly-adjacent
            // enemies instead of a wide blast; Ember Rune still extends it.
            const SPLASH_RADIUS = 70 + (this.scene.amuletManager?.getFireSplashRadiusBonus?.() || 0);
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
            // One random zap SFX per lightning-gem swing (not per hop). Sits on
            // the gem beat so the zap answers the sword hit instead of racing it.
            CombatSequencer.playVariant(this.scene, 'gem', 'lightning_zap', 0.45);
            if (this.scene.tutorialMode) {
                this.scene.events.emit('tutorialProgress', 'gemEffect:lightning');
                this.scene.tutorialManager?._handleProgress?.('gemEffect:lightning');
            }
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
                // The spark travels enemy → enemy: each hop waits ZAP_STEP ms, draws
                // an arc from the previous target's position, then lands its hit.
                const ZAP_STEP = 170;
                const mainCard = this.boardCards[targetIndex];
                let fromPos = mainCard?.sprite
                    ? { x: mainCard.sprite.x, y: mainCard.sprite.y }
                    : null;
                picks.forEach(({ i }, zapIndex) => {
                    const targetCard = this.boardCards[i];
                    const toPos = targetCard?.sprite
                        ? { x: targetCard.sprite.x, y: targetCard.sprite.y }
                        : null;
                    const arcFrom = fromPos;
                    // Hops start from the gem beat, not from now, so the first
                    // hop follows the main target's zap instead of landing on it.
                    const hopDelay = CombatSequencer.BEATS.gem + (zapIndex + 1) * ZAP_STEP;
                    const hopTimer = this.scene.time.delayedCall(hopDelay, () => {
                        if (arcFrom && toPos) {
                            this.playLightningArc(arcFrom.x, arcFrom.y, toPos.x, toPos.y);
                        }
                        // Each hop opens its own moment: the arc flies, then the
                        // number lands on the hit beat a beat later.
                        this.damageGemTarget(i, zapDamage, 'Zap', 0xffe066, 'lightning', 'hit');
                    });
                    this.scene.enemyTurnTimers?.push(hopTimer);
                    if (toPos) fromPos = toPos; // next hop starts where this one landed
                });
            }
        }
    }

    // Single source of truth for "is this card type an enemy?". Several
    // hand-rolled copies of this check had drifted over whether 'eliteEnemy'
    // counts — new enemy types only need to be added here.
    isEnemyType(type) {
        return type === 'enemy' || type === 'eliteEnemy' || type === 'boss';
    }

    isOpenEnemyCard(card) {
        return !!card?.revealed && !!card.sprite && this.isEnemyType(card.data?.type);
    }

    hasHolographicOmen() {
        const slots = this.scene.inventorySystem?.slots || this.scene.gameState?.inventory || [];
        return slots.some(item => item?.id === 'holographicOmen' || item?.passiveEffect === 'holographicOmen');
    }

    applyHolographicOmenStartEffect() {
        if (!this.hasHolographicOmen()) return false;
        const roomType = this.scene.gameState?.roomType || this.scene.roomType || 'COMBAT';
        if (!['COMBAT', 'ELITE', 'BOSS'].includes(roomType)) return false;

        const revealedEnemies = this.boardCards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => this.isOpenEnemyCard(card));
        if (revealedEnemies.length === 0) return false;

        revealedEnemies.forEach(({ card, index }) => {
            const roll = Math.floor(Math.random() * 4);
            if (roll === 0) {
                card.data.frozen = Math.max(card.data.frozen || 0, 1);
                this.attachFrozenFrame(card);
                this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, 'Frozen!', 0x66ddff);
            } else if (roll === 1) {
                this.applyWeaponPoison(card, { poisonDamage: 1, poisonTurns: 3 });
            } else if (roll === 2) {
                this.burnEnemy(index, 1);
            } else {
                this.applyShockStatus(card, 1);
            }
            if (this.boardCards[index] === card && card.data?.health > 0) {
                this.updateEnemyInfoText(card);
            }
        });

        if (Math.random() < 0.10) {
            const before = this.scene.gameState?.actionsLeft || 0;
            this.scene.gameState.actionsLeft = Math.max(0, before - 2);
            const lost = before - this.scene.gameState.actionsLeft;
            if (lost > 0) {
                const x = this.scene.playerAvatar?.x || 320;
                const y = this.scene.playerAvatar?.y || 300;
                this.scene.createFloatingText?.(x, y, 'Omen Backfires!', 0xff66cc);
                this.scene.createFloatingText?.(x, y - 16, `-${lost} AP`, 0xff99dd);
                this.scene.updateActionPointUI?.();
                this.scene.updateUI?.();
            }
        }
        return true;
    }

    // Enemy/boss with HP left — revealed OR still face-down.
    isAnyEnemyCard(card) {
        return !!card && this.isEnemyType(card.data?.type) && card.data.health > 0;
    }

    // Fire burn that also affects hidden enemies. Open enemies get the full
    // hit FX; face-down ones take damage quietly and die in place if it's
    // lethal (they never get to open).
    burnEnemy(index, amount) {
        const card = this.boardCards[index];
        if (!this.isAnyEnemyCard(card)) return;
        card.data.health -= amount;
        if (card.revealed && card.sprite?.scene) {
            CombatSequencer.schedule(this.scene, 'gem', () => {
                if (card.sprite?.scene) this.playEnemyHitEffect(card, 'fire');
            });
            CombatSequencer.floatingText(this.scene, 'gem', card.sprite.x, card.sprite.y - 18, `-${amount} Fire`, 0xff7040);
            CombatSequencer.shakeCard(this.scene, 'gem', card.sprite);
            this.updateEnemyInfoText(card);
        } else if (card.sprite?.scene) {
            CombatSequencer.floatingText(this.scene, 'gem', card.sprite.x, card.sprite.y - 18, `-${amount} Burn`, 0xff7040);
        }
        if (card.data.health <= 0) this.removeDefeatedEnemy(index, card);
    }

    // Spawns a one-shot elemental hit animation over an enemy card.
    // effect: 'fire' | 'poison' | 'lightning'
    playEnemyHitEffect(card, effect) {
        if (!card?.sprite?.scene) return;
        // Lightning gets an extra electric shine (bright flash + jagged bolts) on
        // top of its sprite animation, so chick zaps and lightning-gem hits crackle.
        if (effect === 'lightning') this.playLightningShine(card.sprite.x, card.sprite.y, card.sprite);
        const animKey = `enemy_hit_${effect}`;
        if (!this.scene.anims.exists(animKey)) return;
        const fx = this.scene.add.sprite(card.sprite.x, card.sprite.y, 'enemiesHitEffects');
        fx.setDepth((card.sprite.depth || 0) + 5);
        // Fire's burst reads as oversized on the card, so shrink it a touch.
        if (effect === 'fire') fx.setScale(0.6);
        fx.play(animKey);
        fx.once('animationcomplete', () => fx.destroy());
        // Safety cleanup in case the complete event is missed
        this.scene.time.delayedCall(600, () => fx.active && fx.destroy());
    }

    // A quick, asset-free electric flourish over a struck enemy: a bright additive
    // glow that pops and fades, a couple of jagged bolts striking down into it, and
    // a brief white flash on the enemy sprite (restoring any status tint after).
    playLightningShine(x, y, targetSprite) {
        const scene = this.scene;
        const depth = (targetSprite?.depth || 0) + 6;

        // Bright electric burst.
        const glow = scene.add.circle(x, y, 24, 0xfff6a0, 0.9)
            .setBlendMode(Phaser.BlendModes.SCREEN)
            .setDepth(depth)
            .setScale(0.4);
        scene.tweens.add({
            targets: glow, scale: 1.5, alpha: 0, duration: 200, ease: 'Cubic.easeOut',
            onComplete: () => glow.destroy()
        });

        // Jagged bolts striking down into the enemy — a glowing yellow core under a
        // crisp white streak.
        const bolts = scene.add.graphics().setDepth(depth + 1).setBlendMode(Phaser.BlendModes.SCREEN);
        const drawBolt = (startX) => {
            const segs = 5;
            const topY = y - 46;
            const pts = [{ x: startX, y: topY }];
            for (let s = 1; s <= segs; s++) {
                const f = s / segs;
                pts.push({
                    x: Math.round(Phaser.Math.Linear(startX, x, f) + (Math.random() - 0.5) * 12),
                    y: Math.round(Phaser.Math.Linear(topY, y, f))
                });
            }
            const stroke = (width, color, alpha) => {
                bolts.lineStyle(width, color, alpha);
                bolts.beginPath();
                bolts.moveTo(pts[0].x, pts[0].y);
                for (let k = 1; k < pts.length; k++) bolts.lineTo(pts[k].x, pts[k].y);
                bolts.strokePath();
            };
            stroke(4, 0xffe066, 0.6);
            stroke(2, 0xffffff, 1);
        };
        drawBolt(x - 6);
        drawBolt(x + 8);
        scene.tweens.add({
            targets: bolts, alpha: 0, duration: 170, ease: 'Cubic.easeIn', delay: 70,
            onComplete: () => bolts.destroy()
        });

        // Brief white flash on the struck enemy, then restore its prior tint.
        if (targetSprite?.setTint) {
            const hadTint = targetSprite.isTinted;
            const prevTint = targetSprite.tintTopLeft;
            targetSprite.setTint(0xffffff);
            scene.time.delayedCall(90, () => {
                if (!targetSprite?.scene) return;
                if (hadTint) targetSprite.setTint(prevTint);
                else targetSprite.clearTint();
            });
        }
    }

    // Jagged bolt that arcs FROM one enemy TO the next, so a chain zap reads as
    // a single spark travelling across the board rather than three separate
    // strikes. Drawn just before the destination enemy takes its hit.
    playLightningArc(fromX, fromY, toX, toY) {
        const scene = this.scene;
        if (!scene?.add) return;
        const bolts = scene.add.graphics().setDepth(10050).setBlendMode(Phaser.BlendModes.SCREEN);

        // Break the line into jagged segments, jittered perpendicular to the
        // travel direction so the crackle follows the path between the two enemies.
        const segs = 7;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / len; // unit normal
        const ny = dx / len;
        const pts = [{ x: fromX, y: fromY }];
        for (let s = 1; s < segs; s++) {
            const f = s / segs;
            const jitter = (Math.random() - 0.5) * 22;
            pts.push({
                x: Math.round(Phaser.Math.Linear(fromX, toX, f) + nx * jitter),
                y: Math.round(Phaser.Math.Linear(fromY, toY, f) + ny * jitter)
            });
        }
        pts.push({ x: toX, y: toY });

        const stroke = (width, color, alpha) => {
            bolts.lineStyle(width, color, alpha);
            bolts.beginPath();
            bolts.moveTo(pts[0].x, pts[0].y);
            for (let k = 1; k < pts.length; k++) bolts.lineTo(pts[k].x, pts[k].y);
            bolts.strokePath();
        };
        stroke(5, 0xffe066, 0.5);
        stroke(2, 0xffffff, 1);

        scene.tweens.add({
            targets: bolts, alpha: 0, duration: 180, ease: 'Cubic.easeIn', delay: 60,
            onComplete: () => bolts.destroy()
        });
    }

    damageGemTarget(index, amount, label, color, effect = null, beat = 'gem') {
        const card = this.boardCards[index];
        if (!this.isOpenEnemyCard(card)) return;
        if (effect) CombatSequencer.schedule(this.scene, beat, () => {
            if (card.sprite?.scene) this.playEnemyHitEffect(card, effect);
        });
        card.data.health -= amount;
        CombatSequencer.floatingText(this.scene, beat, card.sprite.x, card.sprite.y - 18, `-${amount} ${label}`, color);
        CombatSequencer.shakeCard(this.scene, beat, card.sprite);
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
            this.attachFrozenFrame(card);
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Slowed!', 0x99ccff);
        }
    }

    removeDefeatedEnemy(index, card) {
            // Note: defeating the Angry Nestmother does NOT end the grudge — she
            // keeps turning up "once in a while" for the rest of the run you
            // stole her egg (birdAngry stays set until the next run reseeds).

            CombatSequencer.playVariant(this.scene, 'death', 'enemy_death', 0.5);

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

            // Prospector's Pick — small chance the kill drops a coin/crystal,
            // shown with a pickup animation on the enemy's board tile (captured
            // now, before removeCard() destroys the sprite below).
            const pickReward = this.scene.amuletManager?.rollProspectorPickReward?.();
            if (pickReward) {
                this.playKillLootPickup(card.sprite?.x ?? 0, card.sprite?.y ?? 0, pickReward);
            }

            // NOTE: individual enemy kills no longer pay coins. The per-kill
            // faucet (3 + floor, every enemy) flooded the economy — coins are now
            // granted once per floor on clear (GameScene.onEnemiesCleared) plus
            // coin cards / chests / events. Mimic treasure above is unaffected.
            SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);

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
            
            // Mask of Hollow Whispers — chance to drop a random pickup in the enemy's spot
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

            // Bosses get a bespoke death — a mask animation over the boss, then
            // the silhouette recolors and fades. Regular enemies dissolve as usual.
            if (card.data?.type === 'boss') {
                this.playBossDeathEffect(card.sprite);
            } else {
                this.playCardDisappearEffect(card.sprite);
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
        // A reflect/thorns kill can finish off the boss on the same action that
        // its own attack drops the player to 0 HP. Without this guard the floor
        // still "clears" — the Next Floor button appears and, if clicked, revives
        // the player via setupBossRewardRoom() — racing against the death screen
        // that gameState.takeDamage() already scheduled.
        if (this.scene.gameState.playerHealth <= 0) return;

        const enemiesRemaining = this.boardCards.some(c =>
            c && c.revealed && this.isEnemyType(c.data?.type) && (c.data?.health ?? 1) > 0
        );

        if (!enemiesRemaining && !this.scene.enemiesCleared) {
            // Check if there are any unrevealed cards that could be enemies
            // A hidden mimic is optional treasure — it shouldn't block floor clear
            const potentialEnemies = this.boardCards.some(c =>
                c && !c.revealed && this.isEnemyType(c.data?.type)
                && (c.data?.health ?? 1) > 0 && !c.data?.isMimic
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
        } else if (!enemiesRemaining && this.scene.enemiesCleared) {
            // Clear detection is intentionally idempotent. If another scene or
            // stale input state hid/disabled Next after the first check, any
            // later interaction repairs the button instead of leaving the run
            // permanently stuck with an empty board.
            const potentialEnemies = this.boardCards.some(c =>
                c && !c.revealed && this.isEnemyType(c.data?.type)
                && (c.data?.health ?? 1) > 0 && !c.data?.isMimic
            );
            if (!potentialEnemies) this.scene.showNextFloorButton?.();
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
    
    createCardData(type, floor, isElite = false, gameState = null, targetRarity = null, preferredRole = null) {
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

    // Delegate to CardDataGenerator so reward scenes (RareShop, Treasure, etc.)
    // can call this on a CardSystem instance the same way they call
    // createCardData.
    capRewardRarity(rarity, floor) {
        return this.cardDataGenerator.capRewardRarity(rarity, floor);
    }
    
    // Prospector's Pick pickup: grant the rolled coin/crystal and play its
    // jump/scatter animation at (x, y), the tile where the enemy died.
    playKillLootPickup(x, y, reward, sourceLabel = 'Pick') {
        const isCoin = reward?.kind === 'coin';
        const amount = reward?.amount || 1;

        // Grant FIRST (and unconditionally) so the reward can never be lost if
        // the sprite/animation is unavailable or the anim event misses.
        if (isCoin) {
            this.scene.gameState.coins = (this.scene.gameState.coins || 0) + amount;
        } else {
            this.scene.gameState.crystals = (this.scene.gameState.crystals || 0) + amount;
        }
        this.scene.createFloatingText(
            x, y - 18,
            isCoin ? `+${amount} Coin (${sourceLabel})` : `+${amount} Crystal (${sourceLabel})`,
            isCoin ? 0xffd700 : 0x00ffff
        );
        this.scene.updateUI?.();

        // Visual flourish (skipped headlessly in the sim, where textures are absent).
        const sheetKey = isCoin ? 'coinJumpSheet' : 'crystalScatterSheet';
        const animKey = isCoin ? 'coin_jump_anim' : 'crystal_scatter_anim';
        if (!this.scene.textures?.exists?.(sheetKey)) return;
        const fx = this.scene.add.sprite(x, y, sheetKey);
        fx.setDepth((this.scene.playerAvatar?.depth || 0) + 50);
        if (this.scene.anims.exists(animKey)) fx.play(animKey);
        fx.once('animationcomplete', () => fx.destroy());
        this.scene.time.delayedCall(1000, () => fx.active && fx.destroy());
    }

    // Bespoke boss death. Clones the boss into a ghost (so the effect survives the
    // card's removal), plays the boss-death mask over it, then recolors the ghost
    // to a dark silhouette and fades it out quickly. Safe headlessly / if the mask
    // asset is missing — it just recolors and fades.
    playBossDeathEffect(sprite) {
        if (!sprite?.scene) return;
        const scene = this.scene;
        const x = sprite.x;
        const y = sprite.y;
        const depth = (sprite.depth || 0) + 5;

        // Ghost clone so the visual persists after removeCard() destroys the boss.
        let ghost = null;
        const texKey = sprite.texture?.key;
        if (texKey && texKey !== '__MISSING' && texKey !== '__DEFAULT') {
            ghost = scene.add.sprite(x, y, texKey, sprite.frame?.name);
            ghost.setScale(sprite.scaleX, sprite.scaleY);
            ghost.setOrigin(sprite.originX, sprite.originY);
            ghost.setFlipX?.(sprite.flipX);
            ghost.setDepth(depth);
        }

        // Recolor the silhouette to 0x2f2230 and fade it out quickly.
        const dissolveGhost = () => {
            if (!ghost?.scene) return;
            ghost.setTint(0x2f2230);
            scene.tweens.add({
                targets: ghost,
                alpha: 0,
                duration: 240,
                ease: 'Cubic.easeIn',
                onComplete: () => ghost.destroy()
            });
        };

        if (scene.textures?.exists?.('bossDeathMask') && scene.anims?.exists?.('boss_death_mask')) {
            const mask = scene.add.sprite(x, y, 'bossDeathMask');
            mask.setDepth(depth + 1);
            // Overlay the mask exactly on top of the boss, whatever its display size.
            if (sprite.displayWidth && sprite.displayHeight) {
                mask.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
            }
            mask.play('boss_death_mask');
            const finish = () => {
                if (mask.active) mask.destroy();
                dissolveGhost();
            };
            mask.once('animationcomplete', finish);
            // Safety net in case the complete event is missed.
            scene.time.delayedCall(1200, () => { if (mask.active) finish(); });
        } else {
            dissolveGhost();
        }
    }

    // Card disappear flourish. Lifts a ghost clone of the card a couple of
    // pixels and dissolves the 6-frame `card_disappear_anim` on top before it
    // vanishes — used when an enemy is defeated or a weapon's pips are all
    // spent. Purely visual: the caller still removes the real card immediately,
    // so board/inventory bookkeeping stays synchronous and this never blocks it.
    // Safe headlessly (sim has no textures) — it no-ops when the sheet is absent.
    playCardDisappearEffect(cardSprite, options = {}) {
        if (!cardSprite || !this.scene.textures?.exists?.('cardDisappearSheet')) return;
        const x = cardSprite.x;
        const y = cardSprite.y;
        const depth = options.depth ?? ((cardSprite.depth || 0) + 5);
        const lift = options.lift ?? 4;
        const liftDuration = 220;
        // Short beat where the card hovers (lifted) before the dissolve plays.
        const holdDuration = options.hold ?? 100;

        // Ghost clone that lifts as it dissolves, so the player sees the actual
        // card rise while the dissolve plays over it. Skipped for placeholder
        // textures (rectangles, missing art) which have nothing meaningful to copy.
        let ghost = null;
        const texKey = cardSprite.texture?.key;
        if (texKey && texKey !== '__MISSING' && texKey !== '__DEFAULT') {
            ghost = this.scene.add.sprite(x, y, texKey, cardSprite.frame?.name);
            ghost.setScale(cardSprite.scaleX, cardSprite.scaleY);
            ghost.setOrigin(cardSprite.originX, cardSprite.originY);
            ghost.setDepth(depth);
            this.scene.tweens.add({ targets: ghost, y: y - lift, duration: liftDuration, ease: 'Sine.easeOut' });
        }

        const fx = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'cardDisappearSheet', 0));
        fx.setDepth(depth + 1);
        this.scene.tweens.add({ targets: fx, y: y - lift, duration: liftDuration, ease: 'Sine.easeOut' });

        const cleanup = () => {
            if (fx.active) fx.destroy();
            if (ghost && ghost.active) ghost.destroy();
        };
        // Let the card hover for the hold beat, then dissolve. The dissolve
        // frames depict the card vanishing on their own, so the ghost is removed
        // the instant it starts — otherwise the intact card underneath shows
        // through the later (near-transparent) frames and flickers back in.
        this.scene.time.delayedCall(holdDuration, () => {
            if (!fx.active) return;
            if (ghost && ghost.active) ghost.destroy();
            if (this.scene.anims.exists('card_disappear_anim')) {
                fx.play('card_disappear_anim');
                fx.once('animationcomplete', cleanup);
            } else {
                cleanup();
            }
        });
        // Safety net in case the animation event is missed (e.g. anim missing).
        this.scene.time.delayedCall(holdDuration + 1000, cleanup);
        return fx;
    }

    // Card merge flicker. Plays the 2-frame merge animation (twice, via the
    // anim's repeat) on top of the freshly merged card at (x, y). Uses the
    // legendary variant when `isLegendary` is set. Safe headlessly — no-ops when
    // the sheet is absent.
    playMergeEffect(x, y, isLegendary = false, options = {}) {
        const sheetKey = isLegendary ? 'mergeLegendarySheet' : 'mergeSheet';
        const animKey = isLegendary ? 'merge_legendary_anim' : 'merge_anim';
        if (!this.scene.textures?.exists?.(sheetKey)) return;
        const depth = options.depth ?? 1200;

        const fx = snapOriginToPixelGrid(this.scene.add.sprite(x, y, sheetKey, 0));
        fx.setDepth(depth);
        const cleanup = () => { if (fx.active) fx.destroy(); };
        if (this.scene.anims.exists(animKey)) {
            fx.play(animKey);
            fx.once('animationcomplete', cleanup);
        } else {
            cleanup();
            return;
        }
        // Safety net in case the animation event is missed.
        this.scene.time.delayedCall(1000, cleanup);
        return fx;
    }

    // No longer need the createEnemyWithPreferredRole call.
    mimicTreasureExplosion(x, y) {
        // Loot scales a little with depth
        const floor = this.scene.gameState.currentFloor || 1;
        const coinReward = 20 + floor * 2;
        const crystalReward = 5 + Math.floor(floor / 5);

        // Create splash sprite
        const splashSprite = this.scene.add.sprite(x, y, 'splashSheet');
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

        const splash = this.scene.add.sprite(x, y, 'splashSheet');
        if (this.scene.anims.exists('splash_anim')) splash.play('splash_anim');
        splash.once('animationcomplete', () => splash.destroy());
        this.scene.time.delayedCall(900, () => splash.active && splash.destroy());
        SoundHelper.playSound(this.scene, 'card_flip', 0.4);

        this.removeCard(index);
        this.checkFloorClear();
    }
}
