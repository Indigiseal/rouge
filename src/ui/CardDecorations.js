// ui/CardDecorations.js
// What marks a player card as special, drawn the same wherever the card is
// shown (the bag, the anvil):
//
//   enchant  — a Reliquary-enchanted weapon renders brighter (off on the
//              sigils branch: the enchant shows as its sigil icon). It rides
//              on the card sprite itself (a colour matrix), so it follows the
//              card through drags and survives clearTint(). WebGL only.
//   briar    — a Briar Room card wears the thorn frame (thornFrame.png).
//   gem      — a socketed weapon shows its stone in the socket at the top,
//              drawn at the size its gem level earns.
//   sigils   — the card's sigils, small icons stacked down its top-right
//              corner (content/sigils/sigils.js, ui/SigilIcons.js).
//
// The frame and the gem are returned, not placed: the caller adds them to its
// own group or container and pins or orders them as that screen needs.

import { snapOriginToPixelGrid } from './PixelSnap.js';
import { attachGemShine } from './GemShine.js';
import { GEM_SPOT_KEY, createGlintingSpot, gemSpotPosition } from './GemSockets.js';
import { gemTierFrame } from '../content/cards/gems.js';
import { cardSigils, sigilLevel } from '../content/sigils/sigils.js';
import { buildSigilIcons, sigilCornerOffset } from './SigilIcons.js';
import { CardDataGenerator } from '../systems/loot/CardDataGenerator.js';

const ENCHANT_BRIGHTNESS = 1.35;
// Twin Socket: how far apart the two stones sit.
const SECOND_GEM_GAP = 18;
// Sigils branch: a Reliquary enchant shows as its sigil icon (Frost Ring as
// Frost...), so the brighter card art is off. true brings it back.
export const SHOW_ENCHANT_GLOW = false;
// Sigils branch: the Briar Room's thorns show as the Thorns sigil icon, so the
// full thorn frame over the art is off. true brings it back.
export const SHOW_BRIAR_FRAME = false;

/**
 * Decorate `cardSprite` for `cardData`. Positions are in the sprite's own
 * space, so a card inside a container gets decorations for that container.
 * `gemShine: false` skips the hover streak on the stone (its bitmap mask is
 * only reliable one container deep).
 * @returns {{ briarFrame: Phaser.GameObjects.Image|null, gemIndicator: Phaser.GameObjects.Container|null, gemSprite: Phaser.GameObjects.Sprite|null }}
 */
export function buildCardDecorations(scene, cardSprite, cardData, { gemShine = true } = {}) {
    const out = { briarFrame: null, gemIndicator: null, gemSprite: null, sigilIcons: [] };
    if (!scene?.add || !cardSprite || !cardData) return out;

    if (SHOW_ENCHANT_GLOW && cardData.enchant) {
        cardSprite.preFX?.addColorMatrix()?.brightness(ENCHANT_BRIGHTNESS);
    }

    if (SHOW_BRIAR_FRAME && (cardData.briarDamageBonus || 0) > 0 && scene.textures.exists('thornFrame')) {
        const briarFrame = snapOriginToPixelGrid(scene.add.image(cardSprite.x, cardSprite.y, 'thornFrame'));
        briarFrame.setDisplaySize(cardSprite.displayWidth || 54, cardSprite.displayHeight || 70);
        out.briarFrame = briarFrame;
    }

    const twinSocket = cardData.type === 'weapon' && sigilLevel(cardData, 'twinSocket') > 0;
    if (cardData.type === 'weapon' && cardData.gemEffect && scene.textures.exists('gemsTiered')) {
        // Top middle, tucked inside the card's top edge: the socket first, then
        // the stone on top of it — set in, not stuck on. Whole pixels, so it
        // cannot jitter when a neighbour's blend-mode hover forces a batch flush.
        const spotAt = gemSpotPosition(cardSprite);
        const gemIndicator = scene.add.container(spotAt.x, spotAt.y);
        if (scene.textures.exists(GEM_SPOT_KEY)) gemIndicator.add(scene.add.image(0, 0, GEM_SPOT_KEY));
        const gemFrame = gemTierFrame(cardData.gemEffect, CardDataGenerator.weaponGemStack(cardData));
        const gemSprite = scene.add.sprite(0, 0, 'gemsTiered', gemFrame);
        gemIndicator.add(gemSprite);
        if (gemShine) attachGemShine(scene, gemSprite, { container: gemIndicator });
        // Twin Socket: the second stone sits beside the first, or, while that
        // socket is still free, a glinting socket (Taya's gemSpotAnim) says so.
        if (cardData.gem2Effect || twinSocket) {
            gemIndicator.each((part) => part.setX(-SECOND_GEM_GAP / 2));
            if (cardData.gem2Effect) {
                if (scene.textures.exists(GEM_SPOT_KEY)) gemIndicator.add(scene.add.image(SECOND_GEM_GAP / 2, 0, GEM_SPOT_KEY));
                const gem2Frame = gemTierFrame(cardData.gem2Effect, Math.max(1, cardData.gem2Count || 1));
                gemIndicator.add(scene.add.sprite(SECOND_GEM_GAP / 2, 0, 'gemsTiered', gem2Frame));
            } else {
                const free = createGlintingSpot(scene, SECOND_GEM_GAP / 2, 0);
                if (free) gemIndicator.add(free);
            }
        }
        gemIndicator.restX = spotAt.x;
        gemIndicator.restY = spotAt.y;
        out.gemIndicator = gemIndicator;
        out.gemSprite = gemSprite;
    } else if (twinSocket) {
        // A Twin Socket card with no gem yet: its socket glints, so the card
        // reads as one made for gems.
        const spotAt = gemSpotPosition(cardSprite);
        const gemIndicator = scene.add.container(spotAt.x, spotAt.y);
        const free = createGlintingSpot(scene, 0, 0);
        if (free) {
            gemIndicator.add(free);
            gemIndicator.restX = spotAt.x;
            gemIndicator.restY = spotAt.y;
            out.gemIndicator = gemIndicator;
        } else {
            gemIndicator.destroy();
        }
    }

    const sigils = cardSigils(cardData);
    // The Crystal Spiderling wears the Web icon to say what it does. Only the
    // icon: it is not a Web sigil (whose rule is a 15% on-hit chance), so its
    // tooltip keeps describing the spiderling's own web.
    const spinsWebs = cardData.type === 'companion'
        && (cardData.websEnemies || cardData.id === 'crystalSpiderlingCompanion');
    if (spinsWebs && !sigils.some((s) => s.id === 'web')) sigils.push({ id: 'web', level: 1 });
    if (sigils.length) {
        const corner = sigilCornerOffset(cardSprite.displayWidth || 52, cardSprite.displayHeight || 70);
        out.sigilIcons = buildSigilIcons(scene, sigils, cardSprite.x + corner.x, cardSprite.y + corner.y);
    }
    return out;
}
