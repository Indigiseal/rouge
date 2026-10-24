// sim/sim-inventory.js
// The bag the sim plays with: the slots InventorySystem keeps, without its sprites.
export class SimInventorySystem {
  constructor(gs) {
    this.gameState = gs;
    this.slots = new Array(5 + Math.max(0, gs.bonusInventorySlots || 0)).fill(null);
    this.slotSprites = [];
    this.discardArea = null;
  }

  getCurrentWeapon() {
    return this.gameState?.equippedWeapon || null;
  }

  syncGameStateInventory() {
    if (this.gameState) this.gameState.inventory = this.slots;
  }

  expandInventory(n = 0) {
    if (n <= 0) return;
    this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + n;
    for (let i = 0; i < n; i++) this.slots.push(null);
    this.syncGameStateInventory();
  }

  addInventorySlots(n = 0) {
    this.expandInventory(n);
  }

  rebuildInventorySprites() {}

  updateTwinkleEffects() {}

  addCard(card) {
    const idx = this.slots.findIndex((slot) => slot == null);
    this.lastAddedSlot = idx;
    if (idx < 0) return false;
    this.slots[idx] = card;
    this.syncGameStateInventory();
    return true;
  }

  // Stories (sim/event-bridge.js) take cards by drop zone, the way the game's
  // bag hands a dragged card to the mirror, the well or a tray. The bot reads
  // the zones and calls their handlers itself; the sprite work is a no-op.
  addDropZone(target, handler, { accepts } = {}) {
    (this.dropZones ||= []).push({ target, handler, accepts: accepts || (() => true) });
  }

  clearDropZones() {
    this.dropZones = [];
  }

  returnCardToSlot() {}

  cleanupCardSprites() {}

  cleanupBoardArtifacts() {}

  addCardDirect(card, idx) {
    if (idx < 0 || idx >= this.slots.length) return false;
    this.slots[idx] = card;
    this.syncGameStateInventory();
    return true;
  }

  removeCard(idx) {
    if (idx < 0 || idx >= this.slots.length) return;
    this.slots[idx] = null;
    this.syncGameStateInventory();
  }
}
