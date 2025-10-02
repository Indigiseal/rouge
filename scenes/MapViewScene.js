// scenes/MapViewScene.js
import Phaser from 'phaser';
import { MapGenerator } from '../utils/MapGenerator.js';

export class MapViewScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapViewScene' });
    this._wakeHandler = null;
    this._dragHandlers = null;
  }

  // Convert a 0-based floor index (map cursor) into a 1-based absolute floor number
  getAbsoluteFloor(floorIndex) {
    const baseFloor = this.actMap ? this.actMap.startFloor : 1;
    return baseFloor + floorIndex;
  }

  // Convert a 1-based absolute floor number to a 0-based floor index for the map cursor
  getFloorIndex(absoluteFloor) {
    const baseFloor = this.actMap ? this.actMap.startFloor : 1;
    return Math.max(0, absoluteFloor - baseFloor);
  }

  // Convert a 0-based floor index (map cursor) into a 1-based absolute floor number
  getAbsoluteFloor(floorIndex) {
    const baseFloor = this.actMap ? this.actMap.startFloor : 1;
    return baseFloor + floorIndex;
  }

  // Convert a 1-based absolute floor number to a 0-based floor index for the map cursor
  getFloorIndex(absoluteFloor) {
    const baseFloor = this.actMap ? this.actMap.startFloor : 1;
    return Math.max(0, absoluteFloor - baseFloor);
  }

  init(data) {
    this.gameState = data.gameState;

    if (!this.gameState.dungeonMap) {
      const gen = new MapGenerator();
      this.gameState.dungeonMap = gen.generateFullMap();
    }

    const mapKeys = Object.keys(this.gameState.dungeonMap);
    const acts = mapKeys
      .map(key => this.gameState.dungeonMap[key])
      .filter(Boolean);
    const firstAct = acts[0];
    this.totalActs = Math.max(acts.length, 1);
    this.floorsPerAct = firstAct ? (firstAct.endFloor - firstAct.startFloor + 1) : 15;

    // Ensure currentFloor is always stored as a 1-based value for UI
    this.gameState.currentFloor = Math.max(1, this.gameState.currentFloor || 1);
    // Derive current act from currentFloor, defaulting to act 1
    const cf = this.gameState.currentFloor;
    this.currentAct = Math.min(
      this.totalActs,
      Math.floor((cf - 1) / 15) + 1
    );

    this.actMap = this.gameState.dungeonMap[`act${this.currentAct}`] || acts[0];
    if (!this.actMap) {
      throw new Error('Failed to resolve current act map');
    }

    // Ensure a single authoritative cursor (act-local)
    // floor: 0..N (0 is the fixed start node, N is boss floor)
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
    this.add.text(320, 30, `Act ${this.currentAct} – Floor ${this.gameState.currentFloor || 1}`, {
      fontSize: '20px', fill: '#f2d3aa', fontFamily: '"Roboto Condensed"'
    }).setOrigin(0.5);

    // Drag area sits BEHIND nodes so it won't eat clicks
    this.dragArea = this.add.rectangle(320, 180, 640, 360, 0xffffff, 0)
      .setInteractive({ draggable: true })
      .setDepth(-1000);
    this.setupDragging();

    // Map container
    this.mapContainer = this.add.container(320, 180);

    // Render structured map
    this.drawStructuredMap();

    // Center the current node in view (roughly middle of screen)
    const curNode = this.actMap.floors?.[this.gameState.mapCursor.floor]?.[this.gameState.mapCursor.node];
    if (curNode) {
      this.mapContainer.x = 320 - curNode.__x;
      this.mapContainer.y = 180 - curNode.__y;
    }

    // Clamp after centering so we don't overshoot when at edges
    if (this.mapClamp) {
      this.mapContainer.x = Phaser.Math.Clamp(this.mapContainer.x, this.mapClamp.minX, this.mapClamp.maxX);
      this.mapContainer.y = Phaser.Math.Clamp(this.mapContainer.y, this.mapClamp.minY, this.mapClamp.maxY);
    }

    this.add.text(320, 340, 'Click glowing nodes to proceed • Drag to pan', {
      fontSize: '12px', fill: '#d4b896', fontFamily: '"Roboto Condensed"'
    }).setOrigin(0.5);

    // Add wake event handler to refresh visual state without restarting
    this._wakeHandler = () => {
      console.log('MapViewScene woke up - refreshing state');
      console.log('Current cursor:', this.gameState.mapCursor);

      // Hide any tooltips
      if (this.hideTooltip) {
        this.hideTooltip();
      }

      // Properly clear all node visuals from the map container
      if (this.mapContainer) {
        const childrenToRemove = [...this.mapContainer.list];
        childrenToRemove.forEach(child => {
          if (child !== this.linkGfx) {
            child.destroy();
          }
        });
      }

      // Reset the nodeSprites array
      this.nodeSprites = [];

      // Redraw links with current state
      if (this.linkGfx) {
        this.drawLinks();
      }

      // Redraw all nodes with their current states
      if (this.actMap && this.actMap.floors) {
        this.actMap.floors.forEach((floorNodes, f) => {
          floorNodes.forEach((node, i) => {
            this.drawNode(node, f, i);
          });
        });
      }

      // Update the floor display text
      const floorTextElements = this.children.list.filter(child =>
        child.type === 'Text' && child.text && child.text.includes('Act')
      );
      if (floorTextElements.length > 0) {
        floorTextElements[0].setText(`Act ${this.currentAct} – Floor ${this.gameState.currentFloor || 1}`);
      }

      console.log('Wake refresh complete - nodes should be clickable');
    };
    this.events.on('wake', this._wakeHandler, this);

    this.events.once('shutdown', this.shutdown, this);
  }

  setupDragging() {
    this._dragHandlers = {
      start: (p) => {
        this.isDragging = true;
        this.dragStartX = p.x - (this.mapContainer?.x ?? 320);
        this.dragStartY = p.y - (this.mapContainer?.y ?? 180);
      },
      drag: (p) => {
        if (!this.mapContainer) return;
        const nx = p.x - this.dragStartX;
        const ny = p.y - this.dragStartY;
        this.mapContainer.x = Phaser.Math.Clamp(nx, this.mapClamp?.minX ?? nx, this.mapClamp?.maxX ?? nx);
        this.mapContainer.y = Phaser.Math.Clamp(ny, this.mapClamp?.minY ?? ny, this.mapClamp?.maxY ?? ny);
      },
      end: () => {
        this.isDragging = false;
      }
    };
    this.dragArea.on('dragstart', this._dragHandlers.start, this);
    this.dragArea.on('drag', this._dragHandlers.drag, this);
    this.dragArea.on('dragend', this._dragHandlers.end, this);
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

    // Compute dynamic clamp bounds after node positions are assigned
    const xs = [];
    const ys = [];
    this.actMap.floors.forEach(row => row.forEach(n => {
      xs.push(n.__x);
      ys.push(n.__y);
    }));
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 0;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 0;
    const vw = 640; const vh = 360;
    const padX = 60; const padY = 60;
    this.mapClamp = {
      minX: (vw - padX) - maxX,
      maxX: padX - minX,
      minY: (vh - padY) - maxY,
      maxY: padY - minY
    };

    // Draw links (base)
    this.linkGfx = this.add.graphics();
    this.mapContainer.add(this.linkGfx);
    this.drawLinks();

    // Draw nodes
    this.nodeSprites = [];
    this.actMap.floors.forEach((floorNodes, f) => {
      floorNodes.forEach((node, i) => this.drawNode(node, f, i));
    });
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

    const icons = { COMBAT: '⚔', ELITE: '☠', SHOP: '$', RARE_SHOP: '💎', REST: '🔥', ANVIL: '🔨', EVENT: '?', BOSS: '👹', TREASURE: '💰' };
    const label = this.add.text(node.__x, node.__y, icons[node.type] || '?', {
      fontSize: '16px', fill: '#f2f2f2', fontFamily: '"Roboto Condensed"'
    }).setOrigin(0.5).setAlpha(alpha);
    this.mapContainer.add(label);

    if (this.nodeSprites) {
      this.nodeSprites.push(circle, label);
    }

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
    // Update cursor position (0-based index)
    this.gameState.mapCursor = { act: this.currentAct, floor: targetFloorIdx, node: targetNodeIdx };
    // Update absolute floor number (1-based)
    this.gameState.currentFloor = this.getAbsoluteFloor(targetFloorIdx);
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


  shutdown() {
    if (this.events) {
      if (this._wakeHandler) {
        this.events.off('wake', this._wakeHandler, this);
      } else {
        this.events.off('wake');
      }
      this.events.off('shutdown', this.shutdown, this);
    }

    if (this.dragArea) {
      if (this._dragHandlers) {
        this.dragArea.off('dragstart', this._dragHandlers.start, this);
        this.dragArea.off('drag', this._dragHandlers.drag, this);
        this.dragArea.off('dragend', this._dragHandlers.end, this);
      } else {
        this.dragArea.off('dragstart');
        this.dragArea.off('drag');
        this.dragArea.off('dragend');
      }
      this.dragArea.removeInteractive();
      this.dragArea.destroy();
      this.dragArea = null;
    }

    if (this.nodeSprites && Array.isArray(this.nodeSprites)) {
      this.nodeSprites.forEach(sprite => {
        if (!sprite) return;
        if (sprite.off) {
          sprite.off('pointerover');
          sprite.off('pointerout');
          sprite.off('pointerdown');
        }
        if (sprite.removeInteractive) {
          sprite.removeInteractive();
        }
      });
    }

    if (this.tooltip) {
      this.tooltip.destroy(true);
      this.tooltip = null;
    }

    if (this.tweens) {
      this.tweens.killAll();
    }

    this.nodeSprites = [];

    if (this.mapContainer) {
      if (this.mapContainer.list) {
        [...this.mapContainer.list].forEach(child => {
          if (child && child.destroy) {
            child.destroy();
          }
        });
      }
      this.mapContainer.destroy();
      this.mapContainer = null;
    }

    if (this.linkGfx) {
      if (this.linkGfx.destroy) {
        this.linkGfx.destroy();
      }
      this.linkGfx = null;
    }

    this.mapClamp = null;

    this._wakeHandler = null;
    this._dragHandlers = null;

    console.log('MapViewScene shutdown - all listeners cleaned');
  }
}


