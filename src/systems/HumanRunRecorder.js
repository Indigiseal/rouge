const STORAGE_KEY = 'dungeonCardCrawler.humanRunTrace.v1';
const TRACE_VERSION = 1;
// A complete run is normally a few hundred decisions. Keeping a conservative
// ceiling avoids exhausting the browser's localStorage quota on unusually long
// sessions while still retaining the run start and the newest decisions.
const MAX_EVENTS = 1200;

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}

function resolveGameScene(scene) {
    if (!scene) return null;
    try {
        const gameScene = scene.scene?.get?.('GameScene');
        if (gameScene?.gameState) return gameScene;
    } catch {
        // The scene plugin can be unavailable during shutdown. Fall back to the
        // supplied scene so recording never interferes with gameplay.
    }
    return scene.gameState ? scene : null;
}

function numberOrNull(value) {
    return Number.isFinite(value) ? value : null;
}

function cardLabel(card) {
    return card?.name || card?.id || card?.cardId || card?.type || 'unknown';
}

export class HumanRunRecorder {
    constructor() {
        this.trace = null;
        this.cardIds = new WeakMap();
        this.nextCardId = 1;
        this.storageError = null;
        this.load();
    }

    load() {
        const storage = getStorage();
        if (!storage) return;
        try {
            const stored = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
            if (stored?.schemaVersion === TRACE_VERSION && Array.isArray(stored.events)) {
                this.trace = stored;
            }
        } catch (error) {
            this.storageError = String(error?.message || error);
        }
    }

    save() {
        const storage = getStorage();
        if (!storage || !this.trace) return;
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(this.trace));
            this.storageError = null;
        } catch (error) {
            this.storageError = String(error?.message || error);
        }
    }

    isRecording() {
        return Boolean(this.trace?.active);
    }

    getStatus() {
        return {
            active: this.isRecording(),
            eventCount: this.trace?.events?.length || 0,
            startedAt: this.trace?.startedAt || null,
            storageError: this.storageError,
        };
    }

    start(scene) {
        this.cardIds = new WeakMap();
        this.nextCardId = 1;
        this.trace = {
            schemaVersion: TRACE_VERSION,
            source: 'human',
            sessionId: `human-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            startedAt: new Date().toISOString(),
            stoppedAt: null,
            active: true,
            events: [],
        };
        this.record(scene, 'recording_started', { reason: 'manual' });
        return this.getStatus();
    }

    stop(scene, reason = 'manual') {
        if (!this.trace) return this.getStatus();
        if (this.trace.active) {
            this.record(scene, 'recording_stopped', { reason });
            this.trace.active = false;
            this.trace.stoppedAt = new Date().toISOString();
            this.save();
        }
        return this.getStatus();
    }

    toggle(scene) {
        return this.isRecording() ? this.stop(scene) : this.start(scene);
    }

    clear() {
        this.trace = null;
        this.cardIds = new WeakMap();
        this.nextCardId = 1;
        const storage = getStorage();
        if (storage) {
            try {
                storage.removeItem(STORAGE_KEY);
            } catch {
                // Clearing telemetry should never affect the game.
            }
        }
    }

    getCardTraceId(card) {
        if (!card || typeof card !== 'object') return null;
        let id = this.cardIds.get(card);
        if (!id) {
            id = `c${this.nextCardId++}`;
            this.cardIds.set(card, id);
        }
        return id;
    }

    snapshotCard(card) {
        if (!card || typeof card !== 'object') return null;
        const snapshot = {
            traceId: this.getCardTraceId(card),
            type: card.type || null,
            id: card.id || card.cardId || null,
            name: cardLabel(card),
            rarity: card.rarity ?? null,
        };

        if (card.weaponType || card.type === 'weapon') {
            Object.assign(snapshot, {
                weaponType: card.weaponType || card.subtype || null,
                damage: numberOrNull(card.damage),
                durability: numberOrNull(card.durability),
                maxDurability: numberOrNull(card.maxDurability),
                range: numberOrNull(card.range),
                special: card.special || null,
                gemEffect: card.gemEffect || card.gem?.effect || null,
                gemCount: Array.isArray(card.gems) ? card.gems.length : (card.gem ? 1 : 0),
            });
        }

        if (card.type === 'armor') {
            Object.assign(snapshot, {
                armorType: card.armorType || card.subtype || null,
                block: numberOrNull(card.block),
                durability: numberOrNull(card.durability),
                maxDurability: numberOrNull(card.maxDurability),
            });
        }

        if (card.type === 'enemy' || card.health != null) {
            Object.assign(snapshot, {
                health: numberOrNull(card.health),
                maxHealth: numberOrNull(card.maxHealth),
                attack: numberOrNull(card.attack),
                enemyRole: card.enemyRole || card.role || null,
            });
        }

        if (card.type === 'potion' || card.type === 'magic') {
            Object.assign(snapshot, {
                effect: card.effect || card.magicType || card.potionType || null,
                value: numberOrNull(card.value ?? card.healAmount ?? card.amount),
            });
        }

        return snapshot;
    }

    snapshotState(scene) {
        const gameScene = resolveGameScene(scene);
        const gameState = gameScene?.gameState || scene?.gameState || null;
        const slots = gameScene?.inventorySystem?.slots || gameState?.inventory || [];
        const boardCards = gameScene?.cardSystem?.boardCards || [];
        const mapCursor = gameState?.mapCursor || null;

        return {
            scene: scene?.scene?.key || scene?.sys?.settings?.key || null,
            floor: numberOrNull(gameState?.currentFloor),
            act: numberOrNull(gameState?.currentAct),
            roomType: gameState?.roomType || gameScene?.currentRoomType || null,
            characterId: gameState?.characterId || null,
            player: {
                health: numberOrNull(gameState?.playerHealth),
                maxHealth: numberOrNull(gameState?.maxHealth ?? gameState?.playerMaxHealth),
                actionPoints: numberOrNull(gameState?.actionsLeft ?? gameState?.actionPoints),
                maxActionPoints: numberOrNull(gameState?.maxActions ?? gameState?.maxActionPoints),
                coins: numberOrNull(gameState?.coins),
                crystals: numberOrNull(gameState?.crystals),
            },
            mapCursor: mapCursor ? {
                floor: numberOrNull(mapCursor.floor),
                nodeIndex: numberOrNull(mapCursor.node ?? mapCursor.nodeIndex),
                nodeId: mapCursor.nodeId || null,
            } : null,
            equipped: {
                weapon: this.snapshotCard(
                    gameScene?.inventorySystem?.equippedWeapon
                    || gameState?.equippedWeapon
                ),
                armor: this.snapshotCard(
                    gameScene?.inventorySystem?.equippedArmor
                    || gameState?.equippedArmor
                ),
            },
            inventory: Array.isArray(slots)
                ? slots.map((card, slot) => card ? { slot, card: this.snapshotCard(card) } : null).filter(Boolean)
                : [],
            board: Array.isArray(boardCards)
                ? boardCards.map((entry, index) => {
                    const card = entry?.data || entry?.card || entry;
                    if (!card) return null;
                    return {
                        index,
                        revealed: entry?.isRevealed ?? entry?.revealed ?? true,
                        card: this.snapshotCard(card),
                    };
                }).filter(Boolean)
                : [],
        };
    }

    record(scene, type, details = {}, options = {}) {
        if (!this.isRecording() && type !== 'recording_started') return null;
        if (!this.trace) return null;

        const event = {
            sequence: (this.trace.events[this.trace.events.length - 1]?.sequence || 0) + 1,
            at: new Date().toISOString(),
            elapsedMs: Date.now() - Date.parse(this.trace.startedAt),
            type,
            details,
        };
        if (options.snapshot !== false) event.state = this.snapshotState(scene);
        this.trace.events.push(event);

        if (this.trace.events.length > MAX_EVENTS) {
            this.trace.events.splice(1, this.trace.events.length - MAX_EVENTS);
            this.trace.truncated = true;
        }
        this.save();
        return event;
    }

    exportJson() {
        return this.trace ? JSON.stringify(this.trace, null, 2) : null;
    }

    download() {
        const json = this.exportJson();
        if (!json) return { ok: false, reason: 'no_trace' };
        if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
            return { ok: false, reason: 'download_unavailable', json };
        }

        const date = (this.trace.startedAt || new Date().toISOString()).slice(0, 10);
        const filename = `human-run-trace-${date}-${this.trace.sessionId}.json`;
        const blobUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
        return { ok: true, filename };
    }
}

export const humanRunRecorder = new HumanRunRecorder();

export function recordHumanRunEvent(scene, type, details = {}, options = {}) {
    return humanRunRecorder.record(scene, type, details, options);
}

export function snapshotHumanRunCard(card) {
    return humanRunRecorder.snapshotCard(card);
}
