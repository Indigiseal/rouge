// ui/SigilOffer.js
// A found sigil goes onto a card the player picks right away (docs/SIGILS.md):
// a panel shows the sigil — icon, name, rule — and the cards that can take it
// (bag weapons and armor, and the worn armor). Clicking one puts the sigil on
// it; Skip leaves it. Used by elite chests now, secret rooms later.
//
// Drawn in `scene` (the room above the fight scene); the cards are the fight
// scene's bag, so the bag is rebuilt afterwards to show the new icon.

import { SoundHelper } from '../audio/SoundHelper.js';
import {
    SIGIL_ICONS_KEY, addSigil, canTakeSigil, cardSigils, getSigil, noteSigilTaken, sigilIconArt, sigilLine, takenSigils,
} from '../content/sigils/sigils.js';
import { setHoverLight } from './HoverLight.js';
import { getLocationIdForFloor } from '../content/locations/index.js';
import { sigilPoolForLocation } from '../content/sigils/locationSigils.js';

const DEPTH = 600;
const PANEL = { x: 320, y: 118, w: 300, h: 154 };
const THUMB_SCALE = 0.7;

/** The cards a sigil could go on: bag weapons/armor, then the worn armor. */
function candidateCards(gameScene) {
    const gs = gameScene?.gameState;
    const bag = (gameScene?.inventorySystem?.slots || gs?.inventory || []).filter(Boolean);
    return [...bag, gs?.equippedArmor].filter(Boolean);
}

/** Eligible local rewards, without consuming a random roll to check eligibility. */
export function offerableSigils(gameScene) {
    const cards = candidateCards(gameScene);
    // Warcry only helps companions: not offered to a hero who has none.
    const hasCompanion = (gameScene?.getCompanionEntries?.() || []).length > 0;
    // Never one taken earlier this run, nor one a card already shows.
    const taken = new Set(takenSigils(gameScene?.gameState));
    cards.forEach((card) => cardSigils(card).forEach((s) => taken.add(s.id)));
    const pool = sigilPoolForLocation(getLocationIdForFloor(gameScene?.gameState));
    return pool.filter((id) => getSigil(id)?.works && getSigil(id)?.side !== 'enemy' && !taken.has(id)
        && (id !== 'warcry' || hasCompanion)
        && cards.some((card) => canTakeSigil(card, id)));
}

/** Roll once from the eligible local pool; never fall back to another location. */
export function rollOfferableSigil(gameScene) {
    const options = offerableSigils(gameScene);
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
}

/** True when at least one of the player's cards could take `sigilId`. */
export function canOfferSigil(gameScene, sigilId) {
    return candidateCards(gameScene).some((card) => canTakeSigil(card, sigilId));
}

/**
 * Open the panel for `sigilId`. `onDone(card | null)` runs once the player has
 * chosen a card or skipped. Returns false (and calls nothing) when no card can
 * take the sigil.
 */
export function openSigilOffer(scene, gameScene, sigilId, onDone = () => {}) {
    const def = getSigil(sigilId);
    const cards = candidateCards(gameScene).filter((card) => canTakeSigil(card, sigilId));
    if (!def || !cards.length || !scene?.add) return false;

    const parts = [];
    const add = (obj) => { parts.push(obj); return obj.setDepth(DEPTH + parts.length * 0.01); };
    const close = () => parts.forEach((p) => p?.scene && p.destroy());
    const text = (x, y, value, size, color, opts = {}) => add(scene.add.text(x, y, value, {
        fontSize: size, fill: color, fontFamily: '"HoMM Pixel"', ...opts,
    }));

    // Interactive so a click on the panel can't fall through to the reward
    // card under it.
    add(scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0x1c130a, 0.96)
        .setStrokeStyle(2, 0xc8ab78).setInteractive());
    text(PANEL.x, PANEL.y - PANEL.h / 2 + 14, 'The chest holds a sigil', '12px', '#fed991').setOrigin(0.5);
    if (scene.textures.exists(SIGIL_ICONS_KEY)) {
        const art = sigilIconArt(sigilId, scene.textures);
        add(scene.add.image(PANEL.x - 118, PANEL.y - 38, art.key, art.frame).setScale(2));
    }
    text(PANEL.x - 98, PANEL.y - 50, def.name, '11px', '#fef0cf').setOrigin(0, 0.5);
    text(PANEL.x - 98, PANEL.y - 30, sigilLine(sigilId).slice(def.name.length + 2), '9px', '#f2d3aa',
        { wordWrap: { width: 210 } }).setOrigin(0, 0.5);
    text(PANEL.x, PANEL.y - 6, 'Choose a card for it:', '9px', '#d6c7b3').setOrigin(0.5);

    const slotW = Math.min(46, (PANEL.w - 30) / cards.length);
    const rowX = PANEL.x - ((cards.length - 1) * slotW) / 2;
    const rowY = PANEL.y + 32;
    const choose = (card) => {
        addSigil(card, sigilId);
        noteSigilTaken(gameScene?.gameState, sigilId);
        SoundHelper.playSound(scene, 'gem_socket', 0.5);
        gameScene?.inventorySystem?.rebuildInventorySprites?.();
        gameScene?.updateEquippedArmorPanel?.();
        scene.refreshStationInventoryDisplay?.();
        gameScene?.saveCurrentRun?.();
        close();
        onDone(card);
    };
    cards.forEach((card, i) => {
        if (!card.sprite || !scene.textures.exists(card.sprite)) return;
        const thumb = add(scene.add.image(Math.round(rowX + i * slotW), rowY, card.sprite, card.spriteFrame)
            .setScale(THUMB_SCALE).setInteractive({ useHandCursor: true }));
        thumb.on('pointerover', () => { SoundHelper.playVariant(scene, 'ui_card_hover', 0.35); setHoverLight(thumb, true); });
        thumb.on('pointerout', () => setHoverLight(thumb, false));
        thumb.on('pointerdown', () => choose(card));
    });

    const skip = text(PANEL.x + PANEL.w / 2 - 12, PANEL.y + PANEL.h / 2 - 10, 'Skip', '9px', '#869089')
        .setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    skip.on('pointerover', () => skip.setColor('#fef0cf'));
    skip.on('pointerout', () => skip.setColor('#869089'));
    skip.on('pointerdown', () => { SoundHelper.playVariant(scene, 'button_click', 0.5); close(); onDone(null); });
    return true;
}
