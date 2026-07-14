// scenes/MapViewScene.js
// Phaser is provided as a UMD global (see index.html) — no import needed.
import { MapGenerator } from '../utils/MapGenerator.js';
import { t } from '../utils/i18n.js';
import { createTitle } from '../utils/titleText.js';
import { MusicManager } from '../utils/MusicManager.js';
import { SoundHelper } from '../utils/SoundHelper.js';

export class MapViewScene extends Phaser.Scene {
  constructor() { super({ key: 'MapViewScene' }); }

  static MAP_CENTER_X = 300;
  static MAP_CENTER_Y = 190;

  init(data) {
    this.gameState = data.gameState;

    // Derive current act from currentFloor (1..45), default to 1.
    // Clamp to acts 1..3 (the generator only produces three) so a stray
    // currentFloor >= 46 can't index a non-existent act and crash.
    const cf = Math.max(1, this.gameState.currentFloor || 1);
    this.currentAct = Math.min(3, Math.max(1, Math.floor((cf - 1) / 15) + 1));

    // Build/keep full map. Regenerate when shape changes or when new node types were added.
    const MAP_VERSION = 5; // v5 caps consecutive non-combat rooms (max 2 in a row)
    const hasCurrentMapShape =
      this.gameState.dungeonMap?.act1?.floors?.length === 15 &&
      this.gameState.dungeonMap?._version === MAP_VERSION;
    if (!this.gameState.dungeonMap || !hasCurrentMapShape) {
      const gen = new MapGenerator();
      this.gameState.dungeonMap = gen.generateFullMap();
    }
    this.actMap = this.gameState.dungeonMap[`act${this.currentAct}`];

    // Safety net: if the act map is missing or malformed, rebuild the whole
    // map so we never dereference an undefined act below.
    if (!this.actMap?.floors?.length) {
      const gen = new MapGenerator();
      this.gameState.dungeonMap = gen.generateFullMap();
      this.actMap = this.gameState.dungeonMap[`act${this.currentAct}`]
                 || this.gameState.dungeonMap.act1;
    }

    // Ensure a single authoritative cursor (act-local)
    // floor: 0..14 (0 is the fixed start node, 14 is boss floor)
    if (!this.gameState.mapCursor || this.gameState.mapCursor.act !== this.currentAct) {
      this.gameState.mapCursor = {
        act: this.currentAct,
        floor: (cf - 1) % 15,
        node: 0
      };
      // Mark the start as visited so connections from start are valid
      this.actMap.floors[0][0].visited = true;
    }
    // Validate cursor against the (possibly freshly regenerated) map.
    // If the saved node index no longer exists in this floor, clamp to 0.
    const cur = this.gameState.mapCursor;
    if (!Number.isInteger(cur.floor) || cur.floor < 0 || cur.floor >= this.actMap.floors.length) {
      cur.floor = (cf - 1) % 15;
    }
    const curFloor = this.actMap.floors[cur.floor];
    if (!curFloor || cur.node >= curFloor.length || !curFloor[cur.node]) {
      cur.node = 0;
    }
    // A migrated legacy save may reconstruct its cursor without a saved map.
    // Mark that reconstructed current node visited so map visuals and movement
    // rules agree about where the player actually is.
    const validatedFloor = this.actMap.floors[cur.floor];
    if (validatedFloor?.[cur.node]) validatedFloor[cur.node].visited = true;

    // Persist the run every time we land on the map — the authoritative
    // "between rooms" checkpoint. Every path back to the map runs through here
    // (floor-clear launch, treasure relaunch, and shop/rest/anvil/event wake ->
    // restart), so this single save:
    //   - records roomType 'MAP', so Continue reopens the map instead of
    //     re-rolling the just-cleared floor (the old save kept roomType 'COMBAT'
    //     with an emptied board), and
    //   - captures coins/items/HP the player just gained in a shop, rest, anvil,
    //     event or treasure room, none of which saved on their own.
    const gameScene = this.scene.get('GameScene');
    if (gameScene?.gameState) {
      gameScene.gameState.roomType = 'MAP';
      gameScene.roomType = 'MAP';
    }
    gameScene?.saveCurrentRun?.();

    // Dragging
    this.isDragging = false;
    this.dragStartX = 0; this.dragStartY = 0;
    this.mapPanBounds = { minX: -200, maxX: 840, minY: -100, maxY: 460 };
  }

  create() {
    // Wake handler installed FIRST so a post-shop wake re-runs create()
    // even when we short-circuit the post-act-shop path below.
    this.events.off('wake', this.handleWake, this);
    this.events.on('wake', this.handleWake, this);
    this.events.once('shutdown', () => {
      this.events.off('wake', this.handleWake, this);
    });
    this._leavingMap = false;

    // Post-act shop: the player just beat the act boss. Skip drawing the map
    // entirely on this pass — sleep ourselves and launch the shop directly so
    // there's no map flash. When the shop closes (closeStation → wake), the
    // wake handler restarts create() and the map draws normally with the flag
    // cleared.
    if (this.gameState.pendingActShop) {
      const shopKey = this.gameState.pendingActShop === 'RARE_SHOP' ? 'RareShopScene' : 'ShopScene';
      this.gameState.pendingActShop = null;
      this.scene.sleep();
      this.scene.launch(shopKey, { gameState: this.gameState });
      return;
    }

    // Background & title
    this.add.rectangle(320, 180, 640, 360, 0x8b7355);
    this.add.rectangle(320, 30, 640, 60, 0x6b5d4f);
    createTitle(this, 320, 30, t(this, 'ui.map.title', { act: this.currentAct, floor: this.gameState.currentFloor || 1 }), {
      color: '#f2d3aa', fallbackSize: '20px'
    });

    // Drag area sits BEHIND nodes so it won't eat clicks
    this.dragArea = this.add.rectangle(320, 200, 600, 280, 0xffffff, 0)
      .setInteractive({ draggable: true }).setDepth(-1000);
    this.setupDragging();

    // Map container
    this.mapContainer = this.add.container(MapViewScene.MAP_CENTER_X, 180);

    // Render structured map
    this.drawStructuredMap();

    // Close → save the run and quit to the main menu. (Waking GameScene here
    // would drop the player back onto their already-cleared current floor, which
    // is empty — this is a between-floors screen, so there is no room to return
    // to.) The run persists so "Continue" from the menu resumes it.
    const closeBtn = this.add.circle(600, 30, 15, 0xae5347).setInteractive({ useHandCursor: true });
    this.add.text(600, 30, 'X', { fontSize: '16px', fill: '#f2d3aa' }).setOrigin(0.5);
    closeBtn.on('pointerdown', () => {
      const gameScene = this.scene.get('GameScene');
      if (gameScene?.gameState) {
        gameScene.gameState.roomType = 'MAP';
        gameScene.roomType = 'MAP';
      }
      gameScene?.saveCurrentRun?.();
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MainMenuScene');
    });

    this.add.text(320, 340, t(this, 'ui.map.instructions'), {
      fontSize: '12px', fill: '#d4b896', fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5);

    // Peaceful theme fades in whenever the map is shown (create() re-runs on
    // every wake because handleWake restarts the scene).
    MusicManager.play(this, 'map_music', 0.5, 900);
  }

  handleWake() {
      console.log('Map restarted on wake');
      this.scene.restart({ gameState: this.gameState }); // Redraws with latest cursor/visited
  }

  setupDragging() {
    this.dragArea.on('dragstart', (p) => {
      this.isDragging = true;
      this.dragStartX = p.x - (this.mapContainer?.x ?? 320);
      this.dragStartY = p.y - (this.mapContainer?.y ?? 180);
    });
    this.dragArea.on('drag', (p) => {
      if (!this.mapContainer) return;
      this.mapContainer.x = Math.round(Phaser.Math.Clamp(p.x - this.dragStartX, this.mapPanBounds.minX, this.mapPanBounds.maxX));
      this.mapContainer.y = Math.round(Phaser.Math.Clamp(p.y - this.dragStartY, this.mapPanBounds.minY, this.mapPanBounds.maxY));
    });
    this.dragArea.on('dragend', () => { this.isDragging = false; });
  }

  // ===== Clean lane layout like StS =====
  drawStructuredMap() {
    const lanes = 7;            // number of vertical lanes
    const laneGap = 80;         // horizontal spacing between lanes
    const floorGap = 60;        // vertical spacing
    const cx = 0;               // container origin is centered already
    const startY = -150;

    // Assign positions per floor: nodes are centered symmetrically around x=0
    this.actMap.floors.forEach((floorNodes, f) => {
      const y = startY + f * floorGap;
      const count = floorNodes.length;
      floorNodes.forEach((node, i) => {
        // Round to whole pixels: even node counts give half-integer offsets,
        // which leave the pixel-art nodes on fractional positions and make them
        // (and the whole map) shimmer/shift by a pixel on render-batch flushes.
        node.__x = Math.round((i - (count - 1) / 2) * laneGap);
        node.__y = Math.round(y);
        node.__idx = i; // index within the floor
      });
    });

    this.updatePanBounds();

    // Draw links — baked into a RenderTexture (see drawLinks). A live Graphics
    // object renders diagonal thick lines as anti-aliased quads whose vertices
    // re-round by a pixel across render-batch flushes (e.g. when a tooltip's text
    // texture is created), making the connections jitter. Baking them to a texture
    // once turns them into a static image that snaps to the pixel grid like the nodes.
    this.drawLinks();

    // Draw nodes
    this.nodeSprites = [];
    this.actMap.floors.forEach((floorNodes, f) => {
      floorNodes.forEach((node, i) => this.drawNode(node, f, i));
    });

    this.centerOnCurrentNode();
  }

  updatePanBounds() {
    const nodes = this.actMap.floors.flat();
    const minX = Math.min(...nodes.map(n => n.__x));
    const maxX = Math.max(...nodes.map(n => n.__x));
    const minY = Math.min(...nodes.map(n => n.__y));
    const maxY = Math.max(...nodes.map(n => n.__y));
    const pad = 70;
    const visibleLeft = 50;
    const visibleRight = 550;
    const visibleTop = 70;
    const visibleBottom = 320;
    const mapWidth = maxX - minX;
    const mapCenterX = (minX + maxX) / 2;
    const visibleWidth = visibleRight - visibleLeft;
    const visibleCenterX = (visibleLeft + visibleRight) / 2;
    const centeredX = visibleCenterX - mapCenterX;

    const xBounds = mapWidth + pad * 2 <= visibleWidth
      ? { minX: centeredX, maxX: centeredX }
      : {
          minX: visibleRight - maxX - pad,
          maxX: visibleLeft - minX + pad
        };

    this.mapPanBounds = {
      minX: xBounds.minX,
      maxX: xBounds.maxX,
      minY: visibleBottom - maxY - pad,
      maxY: visibleTop - minY + pad
    };

    this.mapContainer.x = Math.round(Phaser.Math.Clamp(this.mapContainer.x, this.mapPanBounds.minX, this.mapPanBounds.maxX));
    this.mapContainer.y = Math.round(Phaser.Math.Clamp(this.mapContainer.y, this.mapPanBounds.minY, this.mapPanBounds.maxY));
  }

  centerOnCurrentNode() {
    const cursor = this.gameState.mapCursor;
    const node = this.actMap.floors?.[cursor.floor]?.[cursor.node];
    if (!node || typeof node.__x !== 'number' || typeof node.__y !== 'number') return;

    const nodes = this.actMap.floors.flat();
    const minX = Math.min(...nodes.map(n => n.__x));
    const maxX = Math.max(...nodes.map(n => n.__x));
    const mapCenterX = (minX + maxX) / 2;
    const targetScreenX = MapViewScene.MAP_CENTER_X;
    const targetScreenY = MapViewScene.MAP_CENTER_Y;
    this.mapContainer.x = Math.round(Phaser.Math.Clamp(targetScreenX - mapCenterX, this.mapPanBounds.minX, this.mapPanBounds.maxX));
    this.mapContainer.y = Math.round(Phaser.Math.Clamp(targetScreenY - node.__y, this.mapPanBounds.minY, this.mapPanBounds.maxY));
  }

  drawLinks() {
    // Draw all links into an off-display Graphics in node-coordinate space, then
    // bake it into a RenderTexture so the connections become a static, pixel-snapped
    // image instead of live geometry that jitters on render-batch flushes.
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const drawCurve = (ax, ay, bx, by, color, width) => {
      g.lineStyle(width, color, 1);
      g.lineBetween(Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by));
    };

    // dim base — every connection between adjacent floors
    for (let f = 0; f < this.actMap.floors.length - 1; f++) {
      const cur = this.actMap.floors[f];
      const nxt = this.actMap.floors[f + 1];
      cur.forEach(n => {
        n.connections.forEach(t => {
          drawCurve(n.__x, n.__y, nxt[t].__x, nxt[t].__y, 0x5e5146, 2);
        });
      });
    }
    // highlight from current node
    const curF = this.gameState.mapCursor.floor;
    if (curF < this.actMap.floors.length - 1) {
      const from = this.actMap.floors[curF][this.gameState.mapCursor.node];
      if (from) {
        const nxt = this.actMap.floors[curF + 1];
        from.connections.forEach(t => {
          drawCurve(from.__x, from.__y, nxt[t].__x, nxt[t].__y, 0xf2d3aa, 3);
        });
      }
    }

    // Bake into a RenderTexture sized to the node bounds (with padding for line width).
    const nodes = this.actMap.floors.flat();
    const minX = Math.min(...nodes.map(n => n.__x));
    const maxX = Math.max(...nodes.map(n => n.__x));
    const minY = Math.min(...nodes.map(n => n.__y));
    const maxY = Math.max(...nodes.map(n => n.__y));
    const pad = 6;
    const w = Math.ceil(maxX - minX) + pad * 2;
    const h = Math.ceil(maxY - minY) + pad * 2;

    if (this.linkTexture) { this.linkTexture.destroy(); this.linkTexture = null; }
    const rt = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0);
    // Offset the graphics so negative node coords land inside the texture.
    rt.draw(g, -minX + pad, -minY + pad);
    // Position the texture so its pixels line up with the node coordinates.
    rt.x = minX - pad;
    rt.y = minY - pad;
    this.mapContainer.add(rt);
    this.mapContainer.sendToBack(rt); // keep links behind the nodes
    g.destroy();
    this.linkTexture = rt;
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

    // Spritesheet frame per room type
    // Frame order: 0=normal chest, 1=rest, 2=good chest, 3=shop, 4=rare shop,
    //              5=fight, 6=elite fight, 7=boss, 8=event, 9=blacksmith
    const frameByType = {
      TREASURE: 0, REST: 1, TREASURE_GOOD: 2, SHOP: 3, RARE_SHOP: 4,
      COMBAT: 5, ELITE: 6, BOSS: 7, EVENT: 8, ANVIL: 9
    };
    const frame = frameByType[node.type] ?? 5;

    // Alpha by state — available/current are fully bright, others dimmed
    let alpha = 1;
    if (state === 'behind')                                   alpha = 0.35;
    else if (state === 'locked' || state === 'locked_next')   alpha = 0.22;
    else if (state === 'available')                           alpha = 1;
    else if (state === 'current')                             alpha = 1;

    // Tint: lighten available and current nodes slightly so they stand out
    const AVAILABLE_TINT = 0xddddff;
    const tint = (state === 'available' || state === 'current') ? AVAILABLE_TINT : 0xffffff;

    // Quiet "you are here" ring behind the current node (added before it).
    if (state === 'current') this._addCurrentRing(node);

    // Node sprite
    const useSheet = this.textures.exists('mapNodes');
    let nodeSprite;
    if (useSheet) {
      nodeSprite = this.add.image(node.__x, node.__y, 'mapNodes', frame);
    } else {
      // Fallback: coloured circle if spritesheet hasn't loaded yet
      const fallbackColors = {
        COMBAT: 0x8b7355, ELITE: 0xae5347, SHOP: 0xd4b896, RARE_SHOP: 0xffd700,
        REST: 0xa8c09a, ANVIL: 0x9a9a9a, EVENT: 0xc8a882, BOSS: 0x6b0000,
        TREASURE: 0xdaa520, TREASURE_GOOD: 0xffd700
      };
      nodeSprite = this.add.circle(node.__x, node.__y, 18, fallbackColors[node.type] || 0x8b7355);
    }
    nodeSprite.setAlpha(alpha);
    if (nodeSprite.setTint) nodeSprite.setTint(tint);
    this.mapContainer.add(nodeSprite);

    if (state === 'available') {
      nodeSprite.setInteractive({ useHandCursor: true });
      nodeSprite.on('pointerover', () => {
        if (this.isDragging) return;
        // Soft click when the pointer lands on a selectable node.
        SoundHelper.playSound(this, 'hover_soft', 0.4);
        // Rise one pixel and lighten while hovered.
        nodeSprite.y = node.__y - 1;
        if (nodeSprite.setTint) nodeSprite.setTint(0xffffff);
        this.showTooltip(t(this, this.getNodeTooltipKey(node.type)), node.__x, node.__y - 30);
      });
      nodeSprite.on('pointerout', () => {
        nodeSprite.y = node.__y;
        if (nodeSprite.setTint) nodeSprite.setTint(AVAILABLE_TINT);
        this.hideTooltip();
      });
      nodeSprite.on('pointerdown', () => {
        if (!this.isDragging) this.selectNode(floorIdx, nodeIdx, node);
      });
    }
  }

  // A soft, static gold ring marking the player's current node. Kept understated
  // (no radar pulse) — just a faint outline that gently breathes.
  _addCurrentRing(node) {
    const ring = this.add.circle(node.__x, node.__y, 19, 0xf2d3aa, 0)
      .setStrokeStyle(2, 0xf2d3aa, 0.4);
    this.mapContainer.add(ring);
    this.tweens.add({
      targets: ring,
      alpha: 0.65,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  getNodeTooltipKey(type) {
    const keyByType = {
      COMBAT: 'map.tooltip.combat',
      ELITE: 'map.tooltip.elite',
      SHOP: 'map.tooltip.shop',
      RARE_SHOP: 'map.tooltip.rareShop',
      REST: 'map.tooltip.rest',
      ANVIL: 'map.tooltip.anvil',
      EVENT: 'map.tooltip.event',
      BOSS: 'map.tooltip.boss',
      TREASURE: 'map.tooltip.treasure',
      TREASURE_GOOD: 'map.tooltip.treasureGood'
    };
    return keyByType[type] || 'tooltip.item';
  }

  showTooltip(text, x, y) {
    this.hideTooltip();
    const label = this.add.text(0, 0, text, {
      fontSize: '12px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center'
    }).setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, Math.ceil(label.width) + 12, Math.ceil(label.height) + 8, 0x2c1810, 0.95)
      .setStrokeStyle(1, 0x3f2f28)
      .setOrigin(0.5);
    this.tooltip = this.add.container(Math.round(x), Math.round(y), [bg, label]);
    this.mapContainer.add(this.tooltip);
  }
  hideTooltip() { if (this.tooltip) { this.tooltip.destroy(); this.tooltip = null; } }

  // Only allow moving from the SINGLE current node to connected nodes on the NEXT floor
  selectNode(targetFloorIdx, targetNodeIdx, node) {
    if (this._leavingMap) return; // ignore extra clicks during the exit fade
    const cur = this.gameState.mapCursor;
    if (targetFloorIdx !== cur.floor + 1) return;
    const fromNode = this.actMap.floors[cur.floor][cur.node];
    if (!fromNode.connections.includes(targetNodeIdx)) return;
    SoundHelper.playVariant(this, 'map_select', 0.5);
    // Mark from and to visited (fixes stuck visuals)
    fromNode.visited = true;
    node.visited = true;
    this.gameState.mapCursor = { act: this.currentAct, floor: targetFloorIdx, node: targetNodeIdx };
    this.gameState.currentFloor = (this.gameState.currentFloor || 1) + 1;
    // Store type
    this.gameState.roomType = node.type;

    // Route (deferred so the map theme can fade out first).
    const nonCombat = ['SHOP', 'RARE_SHOP', 'REST', 'ANVIL', 'EVENT', 'TREASURE', 'TREASURE_GOOD'];
    const proceed = () => {
      if (nonCombat.includes(node.type)) {
        // Tea Room Bell (and any future AP-on-non-battle amulet) triggers here.
        this.scene.get('GameScene')?.amuletManager?.processNonBattleSceneEnter?.();
        this.scene.sleep(); // Sleep map for overlay
        const key =
          node.type === 'SHOP'           ? 'ShopScene' :
          node.type === 'RARE_SHOP'      ? 'RareShopScene' :
          node.type === 'REST'           ? 'RestScene' :
          node.type === 'ANVIL'          ? 'AnvilScene' :
          node.type === 'TREASURE'       ? 'TreasureScene' :
          node.type === 'TREASURE_GOOD'  ? 'TreasureScene' : 'EventScene';
        const sceneData = { gameState: this.gameState };
        if (node.type === 'TREASURE_GOOD') sceneData.rewardMode = 'good';
        this.scene.launch(key, sceneData);
        return;
      }
      // Combat-like
      this.scene.stop();
      // Pass a flag to indicate this is a new room transition
      this.scene.wake('GameScene', {
          roomType: node.type,
          isNewRoom: true
      });
      console.log('Woke GameScene for type:', node.type);
    };

    // Fade the peaceful theme out, then hand off (scene stays alive during the
    // fade so the tween actually runs).
    this._leavingMap = true;
    // Fade (300ms) finishes just before the handoff (380ms) so the track is
    // fully stopped while the scene is still awake and the tween can run.
    MusicManager.stopIfPlaying(this, 'map_music', 300);
    this.time.delayedCall(380, proceed);
  }
}
