// systems/combat/StatusOverlay.js
// A see-through colour over an enemy card or the hero's portrait while an
// effect is on it: charmed pink, frozen ice blue, shocked yellow, stunned
// grey, sapped purple, spored dusty orange, poisoned green. It is a copy
// of the sprite filled with the colour at low opacity (a translucent layer,
// as in Aseprite), not a tint, so it never fights the elite tint or the hit
// flash. One colour at a time: the first effect in STATUS_COLORS that applies.
//
// Read off the game state every frame, so no status needs to add or remove
// it: when the effect ends, the colour goes.

export const STATUS_OVERLAY_ALPHA = 0.35;

// Order is priority: the first that applies wins.
// The ones that change what the next action does come before the lingering
// ones; poison, the most common, comes last.
export const STATUS_COLORS = Object.freeze([
    { id: 'charmed',  color: 0xa83c69, enemy: (d) => !!d.charmed },
    { id: 'frozen',   color: 0x71b1ae, enemy: (d) => (d.frozen || 0) > 0 },
    { id: 'shocked',  color: 0xfbad19, enemy: (d) => (d.shockedTurns || 0) > 0 },
    { id: 'stunned',  color: 0xafafa2, player: (gs) => (gs.playerStunnedTurns || 0) > 0 },
    { id: 'sapped',   color: 0x712a65, enemy: (d) => !!d.sapped, player: (gs) => !!gs.playerSapped },
    { id: 'spored',   color: 0xe89353, player: (gs) => !!gs.playerSpored },
    { id: 'poisoned', color: 0x71800b,
        enemy: (d) => Array.isArray(d.statusEffects) && d.statusEffects.some((e) => e?.type === 'poison'),
        player: (gs) => Array.isArray(gs.playerEffects) && gs.playerEffects.some((e) => e?.type === 'poison') },
]);

/** The overlay colour an enemy's data calls for, or null. */
export function enemyStatusColor(data) {
    if (!data || (data.health ?? 0) <= 0) return null;
    return STATUS_COLORS.find((s) => s.enemy?.(data))?.color ?? null;
}

/** The overlay colour the hero calls for, or null. */
export function playerStatusColor(gameState) {
    if (!gameState) return null;
    return STATUS_COLORS.find((s) => s.player?.(gameState))?.color ?? null;
}

// Keep `holder[key]` a colour copy of `base`, or remove it when color is null.
function syncOverlay(scene, holder, key, base, color, depthOffset) {
    let overlay = holder[key];
    if (color == null || !base?.scene || !base.texture || base.type === 'Rectangle') {
        if (overlay) { overlay.destroy(); holder[key] = null; }
        return;
    }
    const frame = base.frame?.name;
    if (!overlay?.scene) {
        overlay = scene.add.image(base.x, base.y, base.texture.key, frame);
        holder[key] = overlay;
    } else if (overlay.texture.key !== base.texture.key || overlay.frame?.name !== frame) {
        overlay.setTexture(base.texture.key, frame);
    }
    if (overlay._statusColor !== color) {
        overlay.setTintFill(color);
        overlay._statusColor = color;
    }
    overlay.setPosition(base.x, base.y);
    overlay.setOrigin(base.originX, base.originY);
    overlay.setScale(base.scaleX, base.scaleY);
    overlay.setAngle(base.angle || 0);
    overlay.setFlip(base.flipX, base.flipY);
    overlay.setVisible(base.visible);
    overlay.setAlpha(STATUS_OVERLAY_ALPHA * (base.alpha ?? 1));
    overlay.setDepth((base.depth || 0) + depthOffset);
}

/** Start the overlays for a fight scene; they clean up when it shuts down. */
export function installStatusOverlays(scene) {
    if (!scene?.events || scene._statusOverlaysInstalled) return;
    scene._statusOverlaysInstalled = true;
    const holders = new Set();
    const update = () => {
        const cs = scene.cardSystem;
        const seen = new Set();
        for (const card of cs?.boardCards || []) {
            if (!card) continue;
            const open = card.revealed && cs.isEnemyType?.(card.data?.type);
            // Between the card's art (+0) and its numbers (+2).
            syncOverlay(scene, card, '_statusOverlay', card.sprite, open ? enemyStatusColor(card.data) : null, 0.5);
            if (card._statusOverlay) { holders.add(card); seen.add(card); }
        }
        // A card that left the board (killed, swapped) takes its colour with it.
        for (const card of holders) {
            if (seen.has(card)) continue;
            card._statusOverlay?.destroy();
            card._statusOverlay = null;
            holders.delete(card);
        }
        // The hero's face, under the portrait frame's overlays (depth 4+).
        syncOverlay(scene, scene, '_playerStatusOverlay', scene.playerPortrait,
            playerStatusColor(scene.gameState), 0.5);
    };
    scene.events.on('postupdate', update);
    scene.events.once('shutdown', () => {
        scene.events.off('postupdate', update);
        for (const card of holders) { card._statusOverlay?.destroy(); card._statusOverlay = null; }
        holders.clear();
        scene._playerStatusOverlay?.destroy();
        scene._playerStatusOverlay = null;
        scene._statusOverlaysInstalled = false;
    });
}
