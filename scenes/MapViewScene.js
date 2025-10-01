// scenes/MapViewScene.js
import Phaser from 'phaser';
import { MapGenerator } from '../utils/MapGenerator.js';
import {
  FLOORS_PER_ACT,
  MAX_FLOOR,
  getActBounds,
  getActFloor,
  getCurrentAct
} from '../utils/ActUtils.js';

export class MapViewScene extends Phaser.Scene {
  constructor() { super({ key: 'MapViewScene' }); }

  init(data) {
    this.gameState = data.gameState;

    // Derive current act from the global floor (1..45)
    const globalFloor = Math.max(1, Math.min(MAX_FLOOR, this.gameState.currentFloor || 1));
    this.globalFloor = globalFloor;
    this.currentAct = getCurrentAct(globalFloor);

    // Build/keep full map
    if (!this.gameState.dungeonMap) {
      const gen = new MapGenerator();
      this.gameState.dungeonMap = gen.generateFullMap();
    }
    this.actMap = this.gameState.dungeonMap[`act${this.currentAct}`];

    // Ensure a single authoritative cursor (act-local)
    // floor: 0..FLOORS_PER_ACT (0 is the fixed start node, last is boss floor)
    if (!this.gameState.mapCursor || this.gameState.mapCursor.act !== this.currentAct) {
      this.gameState.mapCursor = { act: this.currentAct, floor: 0, node: 0 };
      // Mark the start as visited so connections from start are valid
      this.actMap.floors[0][0].visited = true;
    }

    // Dragging
    this.isDragging = false;
    this.dragStartX = 0; this.dragStartY = 0;
  }

  create() {
    // Background & title
    this.add.rectangle(320, 180, 640, 360, 0x8b7355);
    this.add.rectangle(320, 30, 640, 60, 0x6b5d4f);
    const actFloor = getActFloor(this.globalFloor);
    this.add.text(320, 30, `Act ${this.currentAct} – Floor ${actFloor}`, {
      fontSize: '20px', fill: '#f2d3aa', fontFamily: '"Roboto Condensed"'
    }).setOrigin(0.5);

    // Drag area sits BEHIND nodes so it won't eat clicks
    this.dragArea = this.add.rectangle(320, 190, 620, 300, 0xffffff, 0)
      .setInteractive({ draggable: true }).setDepth(-1000);

    // Map container
    this.mapContainer = this.add.container(320, 180);

    // Render structured map
    this.drawStructuredMap();

    this.setupDragging();
    this.setupScrollWheel();
    this.setupKeyboardPan();

    // Center on player's current floor with a smart offset so upcoming paths are visible.
    this.centerOnCurrentFloor({ animate: false, ratio: 0.65 });

    this.createEdgeIndicators();
    this.addCenterButton();

    this.add.text(320, 340, 'Click glowing nodes to proceed • Drag / scroll / arrows to pan', {
      fontSize: '12px', fill: '#d4b896', fontFamily: '"Roboto Condensed"'
    }).setOrigin(0.5);
    this.events.on('wake', () => {
      console.log('Map restarted on wake');
      this.scene.restart({ gameState: this.gameState }); // Redraws with latest cursor/visited
    }, this);
  }

  setupDragging() {
    this.dragArea.on('dragstart', (p) => {
      this.isDragging = true;
      this.dragStartX = p.x - (this.mapContainer?.x ?? 320);
      this.dragStartY = p.y - (this.mapContainer?.y ?? 180);
    });
    this.dragArea.on('drag', (p) => {
      if (!this.mapContainer || !this.dragLimits) return;
      const targetX = p.x - this.dragStartX;
      const targetY = p.y - this.dragStartY;
      this.mapContainer.x = Phaser.Math.Clamp(targetX, this.dragLimits.minX, this.dragLimits.maxX);
      this.mapContainer.y = Phaser.Math.Clamp(targetY, this.dragLimits.minY, this.dragLimits.maxY);
      this.refreshEdgeIndicators();
    });
    this.dragArea.on('dragend', () => { this.isDragging = false; });
  }

  setupScrollWheel() {
    this.input.on('wheel', (_pointer, _objects, _dx, dy) => {
      if (!this.mapContainer || !this.dragLimits) return;
      const speed = 0.35;
      this.panMap(0, dy * speed);
    });
  }

  setupKeyboardPan() {
    this.cursors = this.input.keyboard?.createCursorKeys();
  }

  update(time, delta) {
    super.update?.(time, delta);
    if (!this.mapContainer || !this.cursors) return;
    const speed = 0.25 * (delta ?? 16);
    let dx = 0;
    let dy = 0;
    if (this.cursors.left?.isDown) dx += speed;
    if (this.cursors.right?.isDown) dx -= speed;
    if (this.cursors.up?.isDown) dy += speed;
    if (this.cursors.down?.isDown) dy -= speed;
    if (dx !== 0 || dy !== 0) {
      this.panMap(dx, dy);
    }
  }

  panMap(dx, dy) {
    if (!this.mapContainer || !this.dragLimits) return;
    const nextX = Phaser.Math.Clamp(this.mapContainer.x - dx, this.dragLimits.minX, this.dragLimits.maxX);
    const nextY = Phaser.Math.Clamp(this.mapContainer.y - dy, this.dragLimits.minY, this.dragLimits.maxY);
    this.mapContainer.setPosition(nextX, nextY);
    this.refreshEdgeIndicators();
  }

  // ===== Clean lane layout like StS =====
  drawStructuredMap() {
    const lanes = 7;            // number of vertical lanes
    const laneGap = 80;         // horizontal spacing between lanes
    const floorGap = 60;        // vertical spacing
    const cx = 0;               // container origin is centered already
    const startY = -150;

    // Precompute lane X positions (centered)
    const laneXs = Array.from({ length: lanes }, (_, i) => (i - (lanes - 1) / 2) * laneGap);

    // Assign positions per floor: nodes occupy a centered block of contiguous lanes
    this.actMap.floors.forEach((floorNodes, f) => {
      const y = startY + f * floorGap;
      const count = floorNodes.length;
      const leftLane = Math.max(0, Math.floor((lanes - count) / 2));
      floorNodes.forEach((node, i) => {
        node.__x = laneXs[leftLane + i];
        node.__y = y;
        node.__idx = i; // index within the floor
      });
    });

    // Draw links (base)
    this.linkGfx = this.add.graphics();
    this.mapContainer.add(this.linkGfx);
    this.drawLinks();

    // Draw nodes
    this.nodeSprites = [];
    this.actMap.floors.forEach((floorNodes, f) => {
      floorNodes.forEach((node, i) => this.drawNode(node, f, i));
    });

    this.updateMapBounds();
  }

  drawLinks() {
    this.linkGfx.clear();
    const drawCurve = (ax, ay, bx, by, color, width, arch = -12) => {
      this.linkGfx.lineStyle(width, color, 1);
      this.linkGfx.lineBetween(ax, ay, bx, by);
    };
    // dim base
    this.linkGfx.lineStyle(2, 0x5e5146, 0.35);
    for (let f = 0; f < this.actMap.floors.length - 1; f++) {
      const cur = this.actMap.floors[f];
      const nxt = this.actMap.floors[f + 1];
      cur.forEach(n => {
        n.connections.forEach(t => {
          const a = { x: n.__x, y: n.__y };
          const b = { x: nxt[t].__x, y: nxt[t].__y };
          drawCurve(a.x, a.y, b.x, b.y, 0x5e5146, 2, -12);
        });
      });
    }
    // highlight from current node
    const curF = this.gameState.mapCursor.floor;
    if (curF < this.actMap.floors.length - 1) {
      const from = this.actMap.floors[curF][this.gameState.mapCursor.node];
      const nxt = this.actMap.floors[curF + 1];
      from.connections.forEach(t => {
        const a = { x: from.__x, y: from.__y };
        const b = { x: nxt[t].__x, y: nxt[t].__y };
        drawCurve(a.x, a.y, b.x, b.y, 0xf2d3aa, 3, -14);
      });
    }
  }

  getNodeVisualState(floorIdx, nodeIdx) {
    const curF = this.gameState.mapCursor.floor;
    const curN = this.gameState.mapCursor.node;

    if (floorIdx < curF) return 'behind';
    if (floorIdx === curF && nodeIdx === curN) return 'current';
    if (floorIdx === curF + 1) {
      const curNode = this.actMap.floors[curF][curN];
      return curNode.connections.includes(nodeIdx) ? 'available' : 'locked_next';
    }
    return 'locked';
  }

  drawNode(node, floorIdx, nodeIdx) {
    const state = this.getNodeVisualState(floorIdx, nodeIdx);

    const palette = {
      fillByType: {
        COMBAT: 0x8b7355, ELITE: 0xae5347, SHOP: 0xd4b896, RARE_SHOP: 0xffd700,
        REST: 0xa8c09a, ANVIL: 0x9a9a9a, EVENT: 0xc8a882, BOSS: 0xae5347, TREASURE: 0xdaa520
      },
      ring: { current: 0xffffff, available: 0xf2d3aa, behind: 0x6b5d4f, locked: 0x6b5d4f }
    };

    const radius = 18;
    const baseFill = palette.fillByType[node.type] || 0x8b7355;
    let alpha = 1, ringColor = palette.ring.locked, ringWidth = 2;

    if (state === 'behind') { alpha = 0.3; ringColor = palette.ring.behind; }
    if (state === 'locked' || state === 'locked_next') { alpha = 0.25; ringColor = palette.ring.locked; }
    if (state === 'available') { alpha = 1; ringColor = palette.ring.available; ringWidth = 3; }
    if (state === 'current') { alpha = 1; ringColor = palette.ring.current; ringWidth = 4; }

    const circle = this.add.circle(node.__x, node.__y, radius, baseFill, 1);
    circle.setStrokeStyle(ringWidth, ringColor).setAlpha(alpha);
    this.mapContainer.add(circle);

    if (state === 'current') {
      const glow = this.add.circle(node.__x, node.__y, radius + 8, 0xffffff, 0.15)
        .setBlendMode(Phaser.BlendModes.SCREEN);
      this.mapContainer.add(glow);
      this.tweens.add({
        targets: glow,
        scale: { from: 1, to: 1.25 },
        alpha: { from: 0.35, to: 0 },
        duration: 1400,
        repeat: -1,
        ease: 'sine.inout'
      });
    }

    const icons = { COMBAT: '⚔', ELITE: '☠', SHOP: '$', RARE_SHOP: '💎', REST: '🔥', ANVIL: '🔨', EVENT: '?', BOSS: '👹', TREASURE: '💰' };
    const label = this.add.text(node.__x, node.__y, icons[node.type] || '?', {
      fontSize: '16px', fill: '#f2f2f2', fontFamily: '"Roboto Condensed"'
    }).setOrigin(0.5).setAlpha(alpha);
    this.mapContainer.add(label);

    // Pulse for available nodes
    if (state === 'available') {
      this.tweens.add({
        targets: circle, scale: { from: 1, to: 1.12 }, yoyo: true,
        duration: 650, repeat: -1, ease: 'sine.inout'
      });
    }

    // Tooltip on hover
    const desc = {
      COMBAT: 'Battle enemies', ELITE: 'Tough fight, better rewards', SHOP: 'Purchase items',
      RARE_SHOP: 'Rare goods available!', REST: 'Restore health & actions', ANVIL: 'Repair gear',
      EVENT: 'Unknown encounter', BOSS: 'Boss fight!', TREASURE: 'Mysterious treasure chest!'
    };

    const canClick = (state === 'available');
    if (canClick) {
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerover', () => { if (!this.isDragging) this.showTooltip(desc[node.type], node.__x, node.__y - 28); });
      circle.on('pointerout', () => this.hideTooltip());
      circle.on('pointerdown', () => { if (!this.isDragging) this.selectNode(floorIdx, nodeIdx, node); });
    }
  }

  showTooltip(text, x, y) {
    this.hideTooltip();
    const bg = this.add.rectangle(x, y, 10, 10, 0x2c1810, 0.95).setStrokeStyle(1, 0x3f2f28);
    const t = this.add.text(x, y, text, { fontSize: '12px', fill: '#f2d3aa', fontFamily: '"Roboto Condensed"' }).setOrigin(0.5);
    bg.width = t.width + 12; bg.height = t.height + 8;
    this.tooltip = this.add.container(0, 0, [bg, t]);
    this.mapContainer.add(this.tooltip);
  }
  hideTooltip() { if (this.tooltip) { this.tooltip.destroy(); this.tooltip = null; } }

  // Only allow moving from the SINGLE current node to connected nodes on the NEXT floor
  selectNode(targetFloorIdx, targetNodeIdx, node) {
    const cur = this.gameState.mapCursor;
    if (targetFloorIdx !== cur.floor + 1) return;
    const fromNode = this.actMap.floors[cur.floor][cur.node];
    if (!fromNode.connections.includes(targetNodeIdx)) return;
    // Mark from and to visited (fixes stuck visuals)
    fromNode.visited = true;
    node.visited = true;
    const safeFloorIdx = Math.min(targetFloorIdx, FLOORS_PER_ACT);
    this.gameState.mapCursor = { act: this.currentAct, floor: safeFloorIdx, node: targetNodeIdx };
    const { start } = getActBounds(this.currentAct);
    const globalFloor = Math.min(MAX_FLOOR, start + safeFloorIdx - 1);
    this.gameState.currentFloor = globalFloor;
    // Store type
    this.gameState.roomType = node.type;
    const isCombatRoom = ['COMBAT', 'ELITE', 'BOSS', 'TREASURE'].includes(node.type);
    if (isCombatRoom) {
      const currentId = Number.isFinite(this.gameState.activeRoomId)
        ? this.gameState.activeRoomId
        : 0;
      this.gameState.activeRoomId = currentId + 1;
      this.gameState.roomInitialized = false;
    }
    console.log('Stored roomType:', this.gameState.roomType);
    // Route
    const nonCombat = ['SHOP', 'RARE_SHOP', 'REST', 'ANVIL', 'EVENT'];
    if (nonCombat.includes(node.type)) {
      this.scene.sleep(); // Sleep map for overlay
      const key =
        node.type === 'SHOP' ? 'ShopScene' :
        node.type === 'RARE_SHOP' ? 'RareShopScene' :
        node.type === 'REST' ? 'RestScene' :
        node.type === 'ANVIL' ? 'AnvilScene' : 'EventScene';
      this.scene.launch(key, { gameState: this.gameState });
      return;
    }
    // Combat-like
    this.scene.stop();
    this.scene.wake('GameScene');
    console.log('Woke GameScene for type:', node.type);
  }

  updateMapBounds() {
    const padding = 120;
    const nodes = this.actMap.floors.flat();
    const minX = Math.min(...nodes.map(n => n.__x));
    const maxX = Math.max(...nodes.map(n => n.__x));
    const minY = Math.min(...nodes.map(n => n.__y));
    const maxY = Math.max(...nodes.map(n => n.__y));

    this.rawBounds = { minX, maxX, minY, maxY };

    this.mapBounds = {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };

    const viewWidth = this.scale.width;
    const viewHeight = this.scale.height;
    this.dragLimits = {
      minX: viewWidth - 40 - this.mapBounds.maxX,
      maxX: 40 - this.mapBounds.minX,
      minY: viewHeight - 40 - this.mapBounds.maxY,
      maxY: 40 - this.mapBounds.minY
    };
  }

  centerOnCurrentFloor({ animate = true, ratio = 0.5 } = {}) {
    if (!this.mapContainer || !this.dragLimits) return;
    const cursor = this.gameState.mapCursor;
    const floorNodes = this.actMap.floors[cursor.floor];
    const node = floorNodes?.[cursor.node];
    if (!node) return;

    const targetX = this.scale.width * 0.5;
    const targetY = this.scale.height * Phaser.Math.Clamp(ratio, 0.2, 0.85);

    let destX = targetX - node.__x;
    let destY = targetY - node.__y;
    destX = Phaser.Math.Clamp(destX, this.dragLimits.minX, this.dragLimits.maxX);
    destY = Phaser.Math.Clamp(destY, this.dragLimits.minY, this.dragLimits.maxY);

    if (animate) {
      this.tweens.add({
        targets: this.mapContainer,
        x: destX,
        y: destY,
        ease: 'sine.out',
        duration: 400,
        onUpdate: () => this.refreshEdgeIndicators(),
        onComplete: () => this.refreshEdgeIndicators()
      });
    } else {
      this.mapContainer.setPosition(destX, destY);
      this.refreshEdgeIndicators();
    }
  }

  addCenterButton() {
    const btn = this.add.text(600, 320, 'Center', {
      fontSize: '14px', fill: '#f2d3aa', backgroundColor: '#3f2f28', padding: { x: 8, y: 4 },
      fontFamily: '"Roboto Condensed"'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#6b5d4f' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#3f2f28' }));
    btn.on('pointerdown', () => {
      this.centerOnCurrentFloor({ animate: true, ratio: 0.65 });
    });
  }

  createEdgeIndicators() {
    const arrowColor = 0xf2d3aa;
    const top = this.add.triangle(320, 68, 0, 14, 12, 14, 6, 0, arrowColor, 0.6)
      .setAlpha(0).setDepth(1000);
    const bottom = this.add.triangle(320, 292, 0, 0, 12, 0, 6, 14, arrowColor, 0.6)
      .setAlpha(0).setDepth(1000);
    this.edgeIndicators = { top, bottom };
    this.refreshEdgeIndicators();
  }

  refreshEdgeIndicators() {
    if (!this.edgeIndicators || !this.rawBounds || !this.mapContainer) return;
    const topScreen = this.mapContainer.y + this.rawBounds.minY;
    const bottomScreen = this.mapContainer.y + this.rawBounds.maxY;
    const topMargin = 60;
    const bottomMargin = this.scale.height - 60;
    const hasAbove = topScreen < topMargin;
    const hasBelow = bottomScreen > bottomMargin;
    this.edgeIndicators.top?.setAlpha(hasAbove ? 0.6 : 0);
    this.edgeIndicators.bottom?.setAlpha(hasBelow ? 0.6 : 0);
  }
}
