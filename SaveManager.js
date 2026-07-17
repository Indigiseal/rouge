// SaveManager.js - Complete fixed version

import { applyAmuletAtlasPresentation } from './utils/RelicsOthersAtlas.js';

export class SaveManager {
  constructor() {
    this.META_SAVE_KEY = 'metaProgression';
    this.RUN_SAVE_KEY = 'currentRun';
    this.SETTINGS_SAVE_KEY = 'gameSettings';
    this.SAVE_VERSION = '1.0.3'; // Combat board layout/state added to run saves
  }

  // ============ Internal helpers ============

  // Unicode-safe base64 helpers
  toBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
  fromBase64(b64) { return decodeURIComponent(escape(atob(b64))); }

  // localStorage guards (quota/private mode/etc.)
  safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { console.warn('Storage set failed', e); return false; }
  }
  safeGet(key) {
    try { return localStorage.getItem(key); }
    catch (e) { console.warn('Storage get failed', e); return null; }
  }
  safeRemove(key) {
    try { localStorage.removeItem(key); }
    catch (e) { console.warn('Storage remove failed', e); }
  }

  // ============ META PROGRESSION (Permanent) ============

  saveMetaProgression(metaData) {
    const data = {
      unlockedRelics: metaData?.unlockedRelics ?? [],
      totalDeaths: metaData?.totalDeaths ?? 0,
      bestFloor: metaData?.bestFloor ?? 1,
      enemyKillStats: metaData?.enemyKillStats ?? {},
      totalRuns: metaData?.totalRuns ?? 0,
      totalEnemiesKilled: metaData?.totalEnemiesKilled ?? 0,
      saveVersion: this.SAVE_VERSION,
    };
    this.safeSet(this.META_SAVE_KEY, JSON.stringify(data));
  }

  loadMetaProgression() {
    const saved = this.safeGet(this.META_SAVE_KEY);
    if (!saved) {
      return {
        unlockedRelics: [],
        totalDeaths: 0,
        bestFloor: 1,
        enemyKillStats: {},
        totalRuns: 0,
        totalEnemiesKilled: 0,
        saveVersion: this.SAVE_VERSION,
      };
    }
    try {
      const meta = JSON.parse(saved);
      return this.migrateMeta(meta);
    } catch {
      return {
        unlockedRelics: [],
        totalDeaths: 0,
        bestFloor: 1,
        enemyKillStats: {},
        totalRuns: 0,
        totalEnemiesKilled: 0,
        saveVersion: this.SAVE_VERSION,
      };
    }
  }

  migrateMeta(meta) {
    return {
      unlockedRelics: Array.isArray(meta.unlockedRelics) ? meta.unlockedRelics : [],
      totalDeaths: Number.isFinite(meta.totalDeaths) ? meta.totalDeaths : 0,
      bestFloor: Number.isFinite(meta.bestFloor) ? meta.bestFloor : 1,
      enemyKillStats: meta.enemyKillStats && typeof meta.enemyKillStats === 'object' ? meta.enemyKillStats : {},
      totalRuns: Number.isFinite(meta.totalRuns) ? meta.totalRuns : 0,
      totalEnemiesKilled: Number.isFinite(meta.totalEnemiesKilled) ? meta.totalEnemiesKilled : 0,
      saveVersion: meta.saveVersion ?? this.SAVE_VERSION,
    };
  }

  // ============ CURRENT RUN (Temporary) ============

  saveCurrentRun(gameState, inventorySystem, cardSystem) {
    const serializedBoard = cardSystem ? this.serializeBoardCards(cardSystem.boardCards) : [];
    const enemiesCleared = gameState?.scene?.enemiesCleared ?? false;
    const roomType = this.resolveRoomTypeForSave(gameState, serializedBoard, enemiesCleared);

    const runData = {
      player: {
        health: gameState?.playerHealth ?? 50,
        maxHealth: gameState?.maxHealth ?? 50,
        actionsLeft: gameState?.actionsLeft ?? 15,
        maxActions: gameState?.maxActions ?? 15,
        coins: gameState?.coins ?? 0,
        crystals: gameState?.crystals ?? 0,
        currentFloor: gameState?.currentFloor ?? 1,
        // Added missing fields
        bonusInventorySlots: gameState?.bonusInventorySlots ?? 0,
        firstActionUsed: gameState?.firstActionUsed ?? false,
        baseMaxHealth: gameState?.baseMaxHealth ?? 50,
        bottomlessBagApplied: gameState?.bottomlessBagApplied ?? false,
        discardedCardsThisRun: gameState?.discardedCardsThisRun ?? 0,
        discardCritChance: gameState?.discardCritChance ?? 0,
        // Amulet-tracking fields (Traveler's Journal, Wayfarer's Map)
        journalBonusHP: gameState?.journalBonusHP ?? 0,
        mapBonusAP: gameState?.mapBonusAP ?? 0,
        mapFloorCount: gameState?.mapFloorCount ?? 0,
      },
      equipment: {
        equippedWeapon: gameState?.equippedWeapon ?? null,
        equippedArmor: gameState?.equippedArmor ?? null,
        inventory: inventorySystem ? this.serializeInventory(inventorySystem.slots) : [],
      },
      effects: {
        activeAmulets: (gameState?.activeAmulets ?? []).map(amulet =>
          applyAmuletAtlasPresentation(amulet)
        ),
        playerEffects: gameState?.playerEffects ?? [],
        // Fixed: Preserve full object data instead of converting to boolean
        shadowBlade: gameState?.shadowBlade || null,
        magicShield: gameState?.magicShield || null,
        boneWall: gameState?.boneWall ?? 0,
        mirrorShield: gameState?.mirrorShield ?? false,
        blockNextAttack: gameState?.blockNextAttack ?? false,
      },
      // Add damage tracking for death stats
      damageTracking: gameState?.damageTracking ?? {
        totalDamageTaken: 0,
        damageBySource: { enemies: 0, traps: 0, exhaustion: 0, environmental: 0 },
        enemiesKilledBy: {},
        lastDamageSource: null,
        deathCause: null,
        runStats: { floorsReached: 1, enemiesDefeated: 0, trapsTriggered: 0, coinsEarned: 0, crystalsEarned: 0 }
      },
      story: {
        storyRun: gameState?.storyRun ?? null,
        heroMemory: gameState?.heroMemory ?? null,
      },
      companions: {
        history: gameState?.companionHistory ?? {},
        roomParticipants: gameState?.companionRoomParticipants ?? {},
      },
      navigation: {
        roomType,
        mapCursor: gameState?.mapCursor ?? null,
        dungeonMap: gameState?.dungeonMap ?? null,
        pendingActShop: gameState?.pendingActShop ?? null,
      },
      board: {
        cards: serializedBoard,
        enemiesCleared,
        layout: cardSystem?.getSerializableBoardLayout?.() ?? null,
      },
      savedAt: Date.now(),
      saveVersion: this.SAVE_VERSION,
    };

    return this.safeSet(this.RUN_SAVE_KEY, JSON.stringify(runData));
  }

  loadCurrentRun() {
    const saved = this.safeGet(this.RUN_SAVE_KEY);
    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);

      const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
      const daysSinceSave = (Date.now() - savedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceSave > 7) {
        console.log('Save file is too old, ignoring');
        this.clearCurrentRun();
        return null;
      }

      const runData = {
        player: {
          health: parsed.player?.health ?? 50,
          maxHealth: parsed.player?.maxHealth ?? 50,
          actionsLeft: parsed.player?.actionsLeft ?? 15,
          maxActions: parsed.player?.maxActions ?? 15,
          coins: parsed.player?.coins ?? 0,
          crystals: parsed.player?.crystals ?? 0,
          currentFloor: Number.isFinite(parsed.player?.currentFloor)
            ? Math.max(1, Math.min(45, Math.floor(parsed.player.currentFloor)))
            : 1,
          bonusInventorySlots: parsed.player?.bonusInventorySlots ?? 0,
          firstActionUsed: parsed.player?.firstActionUsed ?? false,
          baseMaxHealth: parsed.player?.baseMaxHealth ?? 50,
          bottomlessBagApplied: parsed.player?.bottomlessBagApplied ?? false,
          discardedCardsThisRun: parsed.player?.discardedCardsThisRun ?? 0,
          discardCritChance: parsed.player?.discardCritChance ?? 0,
          journalBonusHP: parsed.player?.journalBonusHP ?? 0,
          mapBonusAP: parsed.player?.mapBonusAP ?? 0,
          mapFloorCount: parsed.player?.mapFloorCount ?? 0,
        },
        equipment: {
          equippedWeapon: parsed.equipment?.equippedWeapon ?? null,
          equippedArmor: parsed.equipment?.equippedArmor ?? null,
          inventory: Array.isArray(parsed.equipment?.inventory) ? parsed.equipment.inventory : [],
        },
        effects: {
          activeAmulets: parsed.effects?.activeAmulets ?? [],
          playerEffects: parsed.effects?.playerEffects ?? [],
          shadowBlade: parsed.effects?.shadowBlade || null,
          magicShield: parsed.effects?.magicShield || null,
          boneWall: parsed.effects?.boneWall ?? 0,
          mirrorShield: parsed.effects?.mirrorShield ?? false,
          blockNextAttack: parsed.effects?.blockNextAttack ?? false,
        },
        damageTracking: parsed.damageTracking ?? {
          totalDamageTaken: 0,
          damageBySource: { enemies: 0, traps: 0, exhaustion: 0, environmental: 0 },
          enemiesKilledBy: {},
          lastDamageSource: null,
          deathCause: null,
          runStats: { floorsReached: 1, enemiesDefeated: 0, trapsTriggered: 0, coinsEarned: 0, crystalsEarned: 0 }
        },
        story: {
          storyRun: parsed.story?.storyRun ?? null,
          heroMemory: parsed.story?.heroMemory ?? null,
        },
        companions: {
          history: parsed.companions?.history && typeof parsed.companions.history === 'object'
            ? parsed.companions.history
            : {},
          roomParticipants: parsed.companions?.roomParticipants && typeof parsed.companions.roomParticipants === 'object'
            ? parsed.companions.roomParticipants
            : {},
        },
        navigation: {
          roomType: typeof parsed.navigation?.roomType === 'string'
            ? parsed.navigation.roomType
            : 'COMBAT',
          mapCursor: parsed.navigation?.mapCursor && typeof parsed.navigation.mapCursor === 'object'
            ? parsed.navigation.mapCursor
            : null,
          dungeonMap: parsed.navigation?.dungeonMap && typeof parsed.navigation.dungeonMap === 'object'
            ? parsed.navigation.dungeonMap
            : null,
          pendingActShop: ['SHOP', 'RARE_SHOP'].includes(parsed.navigation?.pendingActShop)
            ? parsed.navigation.pendingActShop
            : null,
        },
        board: {
          cards: Array.isArray(parsed.board?.cards) ? parsed.board.cards : [],
          enemiesCleared: parsed.board?.enemiesCleared ?? false,
          layout: parsed.board?.layout && typeof parsed.board.layout === 'object'
            ? parsed.board.layout
            : null,
        },
        savedAt,
        saveVersion: parsed.saveVersion ?? this.SAVE_VERSION,
      };

      return this.migrateRun(runData);
    } catch (e) {
      console.error('Failed to load save:', e);
      this.clearCurrentRun();
      return null;
    }
  }

  migrateRun(run) {
    // Migration for version changes
    if (!run.saveVersion || run.saveVersion < '1.0.1') {
      // Add new fields if upgrading from old version
      run.player.bonusInventorySlots = run.player.bonusInventorySlots ?? 0;
      run.player.firstActionUsed = run.player.firstActionUsed ?? false;
      run.player.baseMaxHealth = run.player.baseMaxHealth ?? 50;
      run.player.bottomlessBagApplied = run.player.bottomlessBagApplied ?? false;
    }

    if (Array.isArray(run.effects?.activeAmulets)) {
      run.effects.activeAmulets = run.effects.activeAmulets.map(amulet =>
        applyAmuletAtlasPresentation(amulet)
      );
    }

    run.navigation = run.navigation && typeof run.navigation === 'object'
      ? run.navigation
      : { roomType: 'COMBAT', mapCursor: null, dungeonMap: null, pendingActShop: null };

    // Legacy saves had currentFloor but no map cursor. Reconstruct the matching
    // act-local cursor so Continue cannot pair (for example) Floor 6 with the
    // first node of Act 1.
    if (!run.navigation.mapCursor) {
      const floor = Math.max(1, Math.min(45, run.player?.currentFloor || 1));
      run.navigation.mapCursor = {
        act: Math.floor((floor - 1) / 15) + 1,
        floor: (floor - 1) % 15,
        node: 0,
      };
    }

    if (Array.isArray(run.equipment?.inventory)) {
      run.equipment.inventory = run.equipment.inventory.map(item =>
        item?.type === 'amulet' ? applyAmuletAtlasPresentation(item) : item
      );
    }

    run.board = run.board && typeof run.board === 'object'
      ? run.board
      : { cards: [], enemiesCleared: false, layout: null };
    run.board.layout = run.board.layout && typeof run.board.layout === 'object'
      ? run.board.layout
      : null;

    // Ensure board cards are properly structured and refresh saved amulet art.
    if (Array.isArray(run.board.cards)) {
      run.board.cards = run.board.cards.map(c => {
        if (!c) return null;
        const data = c.data?.type === 'amulet'
          ? applyAmuletAtlasPresentation(c.data)
          : (c.data ?? null);
        return {
          revealed: !!c.revealed,
          justRevealed: !!c.justRevealed,
          data,
          position: c.position && typeof c.position.x === 'number' && typeof c.position.y === 'number'
            ? { x: c.position.x, y: c.position.y }
            : null,
        };
      });
    }

    run.navigation.roomType = this.resolveRoomTypeForSave(
      { roomType: run.navigation.roomType, scene: { roomType: run.navigation.roomType } },
      run.board.cards,
      run.board.enemiesCleared
    );
    return run;
  }

  clearCurrentRun() { 
    this.safeRemove(this.RUN_SAVE_KEY); 
  }

  hasCurrentRun() {
    const s = this.safeGet(this.RUN_SAVE_KEY);
    if (!s) return false;
    try { 
      JSON.parse(s); 
      return true; 
    }
    catch { 
      this.clearCurrentRun(); 
      return false; 
    }
  }

  // ============ SETTINGS (Permanent) ============

  saveSettings(settings) {
    const def = { 
      volume: { master: 1, sfx: 1, music: 0.5 }, 
      language: 'en', 
      displayMode: 'windowed' 
    };
    const merged = {
      ...def,
      ...settings,
      volume: { ...def.volume, ...(settings?.volume ?? {}) },
    };
    this.safeSet(this.SETTINGS_SAVE_KEY, JSON.stringify(merged));
  }

  loadSettings() {
    const def = { 
      volume: { master: 1, sfx: 1, music: 0.5 }, 
      language: 'en', 
      displayMode: 'windowed' 
    };
    const saved = this.safeGet(this.SETTINGS_SAVE_KEY);
    if (!saved) return def;
    try {
      const parsed = JSON.parse(saved);
      return {
        ...def,
        ...parsed,
        volume: { ...def.volume, ...(parsed.volume ?? {}) },
      };
    } catch {
      return def;
    }
  }

  // ============ SERIALIZATION HELPERS ============

  serializeInventory(slots) {
    if (!Array.isArray(slots)) return [];
    return slots.map(item => {
      if (!item) return null;
      // Strip any non-serializable properties (functions, Phaser objects)
      return JSON.parse(JSON.stringify(item));
    });
  }

  serializeBoardCards(boardCards) {
    if (!Array.isArray(boardCards)) return [];
    return boardCards.map(card => {
      if (!card) return null;
      return {
        revealed: !!card.revealed,
        justRevealed: !!card.justRevealed,
        data: card.data ? JSON.parse(JSON.stringify(card.data)) : null,
        position: card.sprite && card.sprite.x != null && card.sprite.y != null
          ? { x: card.sprite.x, y: card.sprite.y }
          : null,
      };
    });
  }

  resolveRoomTypeForSave(gameState, boardCards, enemiesCleared = false) {
    const savedRoomType = gameState?.roomType || gameState?.scene?.roomType || 'COMBAT';
    const sceneRoomType = gameState?.scene?.roomType || savedRoomType;
    const combatTypes = ['COMBAT', 'ELITE', 'BOSS'];

    if (combatTypes.includes(savedRoomType)) return savedRoomType;
    if (combatTypes.includes(sceneRoomType)) return sceneRoomType;
    if (enemiesCleared || !this.hasLiveEnemyOnBoard(boardCards)) return savedRoomType;

    if (boardCards.some(card => card?.data?.type === 'boss')) return 'BOSS';
    if (boardCards.some(card => card?.data?.type === 'eliteEnemy')) return 'ELITE';
    return 'COMBAT';
  }

  hasLiveEnemyOnBoard(boardCards) {
    if (!Array.isArray(boardCards)) return false;
    return boardCards.some(card => {
      const type = card?.data?.type;
      if (type !== 'enemy' && type !== 'eliteEnemy' && type !== 'boss') return false;
      return (card.data?.health ?? 1) > 0;
    });
  }

  // ============ Export / Import ============

  exportSave() {
    const fullSave = {
      meta: this.loadMetaProgression(),
      currentRun: this.loadCurrentRun(),
      settings: this.loadSettings(),
      exportDate: new Date().toISOString(),
      saveVersion: this.SAVE_VERSION,
    };
    return this.toBase64(JSON.stringify(fullSave));
  }

  importSave(saveString) {
    try {
      const fullSave = JSON.parse(this.fromBase64(saveString));

      if (fullSave.meta) {
        this.safeSet(this.META_SAVE_KEY, JSON.stringify(this.migrateMeta(fullSave.meta)));
      }
      if (fullSave.currentRun) {
        this.safeSet(this.RUN_SAVE_KEY, JSON.stringify(this.migrateRun(fullSave.currentRun)));
      }
      if (fullSave.settings) {
        this.safeSet(this.SETTINGS_SAVE_KEY, JSON.stringify(fullSave.settings));
      }

      return true;
    } catch (e) {
      console.error('Failed to import save:', e);
      return false;
    }
  }

  // ============ Clear all ============

  clearAllData() {
    this.safeRemove(this.META_SAVE_KEY);
    this.safeRemove(this.RUN_SAVE_KEY);
    this.safeRemove(this.SETTINGS_SAVE_KEY);
    this.safeRemove('heroMemory');
    this.safeRemove('storyProgress');
  }
}
