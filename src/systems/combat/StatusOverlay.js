// systems/combat/StatusOverlay.js
// A see-through colour over an enemy card or the hero's portrait while an
// effect is on it: charmed pink, frozen ice blue, shocked yellow, stunned or dazed
// grey, sapped purple, spored dusty orange, poisoned green. It is a copy
// of the sprite filled with the colour at low opacity (a translucent layer,
// as in Aseprite), not a tint, so it never fights the elite tint or the hit
// flash. One colour at a time: the first effect in STATUS_COLORS that applies.
//
// Read off the game state every frame, so no status needs to add or remove
// it: when the effect ends, the colour goes.

import { HAND_LOCKS } from '../../content/combat/handLock.js';

export const STATUS_OVERLAY_ALPHA = 0.35;

// Order is priority: the first that applies wins.
// The ones that change what the next action does come before the lingering
// ones; poison, the most common, comes last.
export const STATUS_COLORS = Object.freeze([
    { id: 'charmed',  color: 0xe8588d, enemy: (d) => !!d.charmed }, // the hearts' pink
    { id: 'webbed',   color: 0xd6c2c1, enemy: (d) => (d.webbedTurns || 0) > 0 },
    { id: 'frozen',   color: 0x71b1ae, enemy: (d) => (d.frozen || 0) > 0 },
    { id: 'shocked',  color: 0xfbad19, enemy: (d) => (d.shockedTurns || 0) > 0 },
    { id: 'stunned',  color: 0xafafa2, enemy: (d) => !!d.dazed, player: (gs) => (gs.playerStunnedTurns || 0) > 0 },
    { id: 'sapped',   color: 0x712a65, enemy: (d) => !!d.sapped, player: (gs) => !!gs.playerSapped },
    { id: 'spored',   color: 0xe89353, player: (gs) => !!gs.playerSpored },
    { id: 'poisoned', color: 0x71800b,
        enemy: (d) => Array.isArray(d.statusEffects) && d.statusEffects.some((e) => e?.type === 'poison'),
        player: (gs) => Array.isArray(gs.playerEffects) && gs.playerEffects.some((e) => e?.type === 'poison') },
]);

// Charmed enemies also give off little hearts: one drifts up now and then while the charm
// lasts, and a few at once when it lands. The heart is drawn here, 7x6 whole pixels.
const HEART_KEY = 'charmHeart';
const HEART_ROWS = Object.freeze(['.XX.XX.', 'XhXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']);
const HEART_FILL = '#e8588d';
const HEART_SHINE = '#ffc2d9';
const HEART_GAP_MS = 380;

function ensureHeartTexture(scene) {
    if (scene.textures.exists(HEART_KEY)) return true;
    const canvas = scene.textures.createCanvas?.(HEART_KEY, 7, 6);
    const ctx = canvas?.getContext?.();
    if (!ctx) return false;
    HEART_ROWS.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === '.') return;
        ctx.fillStyle = c === 'h' ? HEART_SHINE : HEART_FILL;
        ctx.fillRect(x, y, 1, 1);
    }));
    canvas.refresh();
    return true;
}

/** Hearts rising from (x, y): `count` of them, a little apart, each fading as it goes. */
export function playCharmHearts(scene, x, y, count = 1, depth = 60) {
    if (!scene?.add || !ensureHeartTexture(scene)) return;
    for (let i = 0; i < count; i++) {
        const startX = Math.round(x + (Math.random() - 0.5) * 36);
        const startY = Math.round(y - 14 + Math.random() * 10);
        const heart = scene.add.image(startX, startY, HEART_KEY).setDepth(depth).setAlpha(0);
        const sway = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.floor(Math.random() * 4));
        scene.tweens.add({
            targets: heart, y: startY - 26 - Math.floor(Math.random() * 8), x: startX + sway,
            duration: 950, delay: i * 120, ease: 'Sine.easeOut',
            onUpdate: () => { heart.x = Math.round(heart.x); heart.y = Math.round(heart.y); },
            onComplete: () => heart.destroy(),
        });
        scene.tweens.add({
            targets: heart, alpha: { from: 0, to: 1 }, duration: 160, delay: i * 120,
            onComplete: () => scene.tweens.add({
                targets: heart, alpha: 0, duration: 640, delay: 150,
            }),
        });
        scene.events.once('shutdown', () => heart.scene && heart.destroy());
    }
}

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
function syncOverlay(scene, holder, key, base, color, depthOffset, webbed = false) {
    let overlay = holder[key];
    if (color == null || !base?.scene || !base.texture || base.type === 'Rectangle') {
        if (overlay) { overlay.destroy(); holder[key] = null; }
        return;
    }
    const web = HAND_LOCKS.web;
    const useWebArt = webbed && scene.textures?.exists?.(web.overlayKey)
        && scene.textures.get(web.overlayKey).has(web.overlayFrame);
    const texture = useWebArt ? web.overlayKey : base.texture.key;
    const frame = useWebArt ? web.overlayFrame : base.frame?.name;
    if (!overlay?.scene) {
        overlay = scene.add.image(base.x, base.y, texture, frame);
        holder[key] = overlay;
    } else if (overlay.texture.key !== texture || overlay.frame?.name !== frame) {
        overlay.setTexture(texture, frame);
    }
    if (useWebArt) {
        overlay.clearTint();
        overlay._statusColor = null;
    } else if (overlay._statusColor !== color) {
        overlay.setTintFill(color);
        overlay._statusColor = color;
    }
    overlay.setPosition(base.x, base.y);
    overlay.setOrigin(base.originX, base.originY);
    overlay.setScale(base.scaleX, base.scaleY);
    overlay.setAngle(base.angle || 0);
    overlay.setFlip(base.flipX, base.flipY);
    overlay.setVisible(base.visible);
    // The silk keeps its native overhang, just like a webbed inventory card.
    overlay.setAlpha((useWebArt ? 1 : STATUS_OVERLAY_ALPHA) * (base.alpha ?? 1));
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
            syncOverlay(scene, card, '_statusOverlay', card.sprite, open ? enemyStatusColor(card.data) : null, 0.5,
                !card.data?.charmed && (card.data?.webbedTurns || 0) > 0);
            if (card._statusOverlay) { holders.add(card); seen.add(card); }
            // Hearts while the charm lasts: a burst when it lands, then a trickle.
            if (open && card.data?.charmed && card.sprite?.scene) {
                if (!card._charmHearts) { card._charmHearts = true; playCharmHearts(scene, card.sprite.x, card.sprite.y, 3, (card.sprite.depth || 1) + 6); }
                else if (scene.time.now >= (card._charmNext || 0)) {
                    playCharmHearts(scene, card.sprite.x, card.sprite.y, 1, (card.sprite.depth || 1) + 6);
                    card._charmNext = scene.time.now + HEART_GAP_MS + Math.random() * 220;
                }
            } else if (card._charmHearts) {
                card._charmHearts = false;
            }
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
