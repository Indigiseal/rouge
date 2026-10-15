// ui/CardDecorations.js
// What marks a player card as special, drawn the same wherever the card is
// shown (the bag, the anvil):
//
//   enchant  — a Reliquary-enchanted weapon renders brighter. It rides on the
//              card sprite itself (a colour matrix), so it follows the card
//              through drags and survives clearTint(). WebGL only.
//   briar    — a Briar Room card wears the thorn frame (thornFrame.png).
//   gem      — a socketed weapon shows its stone in the socket at the top,
//              drawn at the size its gem level earns.
//
// The frame and the gem are returned, not placed: the caller adds them to its
// own group or container and pins or orders them as that screen needs.

import { snapOriginToPixelGrid } from './PixelSnap.js';
import { attachGemShine } from './GemShine.js';
import { GEM_SPOT_KEY, gemSpotPosition } from './GemSockets.js';
import { gemTierFrame } from '../content/cards/gems.js';
import { CardDataGenerator } from '../systems/loot/CardDataGenerator.js';

const ENCHANT_BRIGHTNESS = 1.35;

/**
 * Decorate `cardSprite` for `cardData`. Positions are in the sprite's own
 * space, so a card inside a container gets decorations for that container.
 * `gemShine: false` skips the hover streak on the stone (its bitmap mask is
 * only reliable one container deep).
 * @returns {{ briarFrame: Phaser.GameObjects.Image|null, gemIndicator: Phaser.GameObjects.Container|null, gemSprite: Phaser.GameObjects.Sprite|null }}
 */
export function buildCardDecorations(scene, cardSprite, cardData, { gemShine = true } = {}) {
    const out = { briarFrame: null, gemIndicator: null, gemSprite: null };
    if (!scene?.add || !cardSprite || !cardData) return out;

    if (cardData.enchant) {
        cardSprite.preFX?.addColorMatrix()?.brightness(ENCHANT_BRIGHTNESS);
    }

    if ((cardData.briarDamageBonus || 0) > 0 && scene.textures.exists('thornFrame')) {
        const briarFrame = snapOriginToPixelGrid(scene.add.image(cardSprite.x, cardSprite.y, 'thornFrame'));
        briarFrame.setDisplaySize(cardSprite.displayWidth || 54, cardSprite.displayHeight || 70);
        out.briarFrame = briarFrame;
    }

    if (cardData.type === 'weapon' && cardData.gemEffect && scene.textures.exists('gemsTiered')) {
        // Top middle, tucked inside the card's top edge: the socket first, then
        // the stone on top of it — set in, not stuck on. Whole pixels, so it
        // cannot jitter when a neighbour's blend-mode hover forces a batch flush.
        const spotAt = gemSpotPosition(cardSprite);
        const gemIndicator = scene.add.container(spotAt.x, spotAt.y);
        if (scene.textures.exists(GEM_SPOT_KEY)) {
            gemIndicator.add(scene.add.image(0, 0, GEM_SPOT_KEY));
        }
        const gemFrame = gemTierFrame(cardData.gemEffect, CardDataGenerator.weaponGemStack(cardData));
        const gemSprite = scene.add.sprite(0, 0, 'gemsTiered', gemFrame);
        gemIndicator.add(gemSprite);
        if (gemShine) attachGemShine(scene, gemSprite, { container: gemIndicator });
        gemIndicator.restX = spotAt.x;
        gemIndicator.restY = spotAt.y;
        out.gemIndicator = gemIndicator;
        out.gemSprite = gemSprite;
    }
    return out;
}
